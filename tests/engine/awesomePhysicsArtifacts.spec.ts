import {
  NATIVE_CANDIDATE_MANIFEST,
  NATIVE_CANDIDATES,
  REFERENCE_LEDGER,
  REFERENCE_LEDGER_MANIFEST,
  SOURCE_ARTIFACTS,
  SOURCE_ARTIFACT_MANIFEST,
  WASM_PILOT_MANIFEST,
  WASM_PILOTS,
  parseNativeCandidateManifest,
  parseReferenceLedgerManifest,
  parseSourceArtifactManifest,
  parseWasmPilotManifest,
} from '../../src/awesomePhysics/artifactManifest'
import type { ArtifactIntegrityV1, ArtifactRecordV1 } from '../../src/awesomePhysics/artifactManifest'
import { loadVerifiedWasmArtifact } from '../../src/awesomePhysics/wasmArtifactLoader'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import type { AwesomePhysicsSimulationArtifactV1 } from '../../src/types/awesomePhysics'
import { vi } from 'vitest'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1

const WASM_BYTES = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function availableWasmRecord(record: ArtifactRecordV1, artifact: ArtifactIntegrityV1): ArtifactRecordV1 {
  return {
    ...record,
    status: 'available',
    output: { ...record.output, artifactKind: 'wasm-module' },
    artifact,
  }
}

function wasmResponse(bytes: Uint8Array, contentType = 'application/wasm'): Response {
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-length': String(bytes.byteLength),
    },
  })
}

describe('Awesome Physics artifact manifests and loader', () => {
  it('contains the eight pilots and ten native candidates', () => {
    expect(WASM_PILOTS).toHaveLength(8)
    expect(WASM_PILOTS.map(({ project }) => project)).toEqual([
      'CoolProp',
      'galpy',
      'cantera',
      'spirit',
      'nphysics',
      'pymunk',
      'fluids',
      'thermo',
    ])
    expect(NATIVE_CANDIDATES).toHaveLength(11)
    expect(NATIVE_CANDIDATES.map(({ project }) => project)).toEqual([
      'PositionBasedDynamics',
      'bullet3',
      'PhysX-3.4',
      'simbody',
      'newton-dynamics',
      'fluid-engine-dev',
      'Gravisim',
      'euclider',
      'TFG',
      'ncollide',
      'spirit',
    ])
    expect(NATIVE_CANDIDATES.find(({ project }) => project === 'ncollide')?.optional).toBe(true)
  })

  it('keeps artifact claims aligned with each entry lifecycle', () => {
    const records = [...WASM_PILOTS, ...NATIVE_CANDIDATES]
    const available = records.filter(({ status }) => status === 'available')
    const unavailable = records.filter(({ status }) => status !== 'available')
    expect(available.map(({ id }) => id)).toEqual([
      'coolprop',
      'galpy',
      'cantera',
      'nphysics',
      'pymunk',
      'position-based-dynamics',
      'bullet3',
      'physx-3-4',
      'newton-dynamics',
      'fluid-engine-dev',
      'ncollide',
      'spirit-headless',
    ])
    for (const record of available) {
      expect(record.artifact.path).not.toBeNull()
      expect(record.artifact.sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(record.artifact.byteSize).toBeGreaterThan(0)
    }
    expect(WASM_PILOTS.find(({ id }) => id === 'coolprop')).toMatchObject({
      status: 'available',
      licenseGate: { status: 'pass' },
      artifact: {
        path: 'wasm/awesomePhysics/coolprop/coolprop.wasm',
        sha256: '57742e874984ad5cddb12db534ea3a9c9903e5c5c518a08e18a099827a3a9829',
        byteSize: 9352013,
        companion: {
          path: 'wasm/awesomePhysics/coolprop/coolprop.js',
          sha256: '0ffde908dc61430b78e02f5b60a1eee04d4b80f69af72739235b3ecb16eac7f6',
          byteSize: 171012,
        },
      },
    })
    expect(WASM_PILOTS.find(({ id }) => id === 'nphysics')).toMatchObject({
      status: 'available',
      licenseGate: { status: 'pass' },
      source: { revision: '65aa85c5470a5da85e0c13652ce58400ae2e2201' },
      artifact: {
        path: 'wasm/awesomePhysics/nphysics/nphysics2d_worker_probe.wasm',
        sha256: 'e549cc0b2af0084dd7ba6908c07357ba4b447516dd799c26763ee4b8a381b2ba',
        byteSize: 366856,
        companion: {
          path: 'wasm/awesomePhysics/nphysics/nphysics2d_worker_probe.js',
          sha256: '364889e36d2218a7da8fcd55e1c4c97b227ceb68b4dfcf840b1d934c6b96bc26',
          byteSize: 12916,
        },
      },
    })
    expect(NATIVE_CANDIDATES.find(({ id }) => id === 'position-based-dynamics')).toMatchObject({
      status: 'available',
      licenseGate: { status: 'pass' },
      source: { revision: 'beafc921e21553515b4f406258e5b16054a45268' },
      artifact: {
        path: 'wasm/awesomePhysics/position-based-dynamics/position-based-dynamics-headless.wasm',
        sha256: '3182948748996ee1f755a4092bde52cea0c8ba586d66d5c54690b8a63d8362df',
        byteSize: 1256,
      },
    })
    expect(NATIVE_CANDIDATES.find(({ id }) => id === 'bullet3')).toMatchObject({
      status: 'available',
      licenseGate: { status: 'pass' },
      source: { revision: '63c4d67e337017f9d8b298c900e9aabdb69296e7' },
      artifact: {
        path: 'wasm/awesomePhysics/bullet3/bullet3.wasm',
        sha256: '1f255bb36e7c7a4f14a03cccfb95f13a39fdf50a9c2b2259faa1048e0473b425',
        byteSize: 333983,
      },
    })
    for (const project of ['PositionBasedDynamics', 'bullet3', 'spirit', 'galpy', 'cantera', 'ncollide', 'pymunk', 'PhysX', 'newton-dynamics', 'fluid-engine-dev']) {
      const descriptor = simulations.items.find(({ title }) => title === project)
      expect(descriptor).toMatchObject({
        execution: 'wasm',
        availability: 'available',
        runnable: true,
      })
      expect(descriptor?.adapterId).toBeTruthy()
    }
    for (const record of unavailable) {
      expect(['planned', 'blocked']).toContain(record.status)
      expect(record.artifact).toEqual({ path: null, sha256: null, byteSize: null })
    }
    expect(WASM_PILOTS.find(({ project }) => project === 'fluids')?.status).toBe('blocked')
    expect(WASM_PILOTS.find(({ project }) => project === 'thermo')?.status).toBe('blocked')
    expect(WASM_PILOT_MANIFEST.records).toHaveLength(8)
    expect(NATIVE_CANDIDATE_MANIFEST.records).toHaveLength(11)
  })

  it('maps every artifact, reference, and blocked descriptor to one ledger record', () => {
    const artifactDescriptors = simulations.items.filter(({ execution }) => execution === 'artifact')
    const referenceDescriptors = simulations.items.filter(({ execution }) => execution === 'reference')
    const blockedDescriptors = simulations.items.filter(({ execution }) => execution === 'blocked')

    expect(SOURCE_ARTIFACTS).toHaveLength(8)
    expect(SOURCE_ARTIFACTS.map(({ id }) => id)).toEqual(artifactDescriptors.map(({ id }) => id))
    expect(SOURCE_ARTIFACTS.map(({ descriptorId }) => descriptorId)).toEqual(artifactDescriptors.map(({ id }) => id))
    expect(SOURCE_ARTIFACTS.map(({ catalogItemId }) => catalogItemId)).toEqual(artifactDescriptors.map(({ catalogItemId }) => catalogItemId))
    expect(SOURCE_ARTIFACTS.map(({ project }) => project)).toEqual(artifactDescriptors.map(({ title }) => title))

    expect(REFERENCE_LEDGER.filter(({ execution }) => execution === 'reference')).toHaveLength(2)
    expect(REFERENCE_LEDGER.filter(({ execution }) => execution === 'blocked')).toHaveLength(1)
    expect(REFERENCE_LEDGER.map(({ id }) => id)).toEqual([...referenceDescriptors, ...blockedDescriptors].map(({ id }) => id))
    expect(REFERENCE_LEDGER.map(({ catalogItemId }) => catalogItemId)).toEqual(
      [...referenceDescriptors, ...blockedDescriptors].map(({ catalogItemId }) => catalogItemId),
    )
    expect(REFERENCE_LEDGER.map(({ project }) => project)).toEqual(
      [...referenceDescriptors, ...blockedDescriptors].map(({ title }) => title),
    )
    expect(new Set(SOURCE_ARTIFACTS.map(({ id }) => id)).size).toBe(SOURCE_ARTIFACTS.length)
    expect(new Set(REFERENCE_LEDGER.map(({ id }) => id)).size).toBe(REFERENCE_LEDGER.length)
    expect(new Set([...SOURCE_ARTIFACTS, ...REFERENCE_LEDGER].map(({ catalogItemId }) => catalogItemId)).size)
      .toBe(SOURCE_ARTIFACTS.length + REFERENCE_LEDGER.length)
  })

  it('preserves repository-relative source and evidence metadata without Run capability', () => {
    for (const record of [...SOURCE_ARTIFACTS, ...REFERENCE_LEDGER]) {
      expect(['planned', 'blocked']).toContain(record.status)
      expect(record.artifact).toEqual({ path: null, sha256: null, byteSize: null })
      expect(record.runCapability).toBe('none')
      expect(record.runnable).toBe(false)
      expect(record.sourceUrl !== null || record.dataUrl !== null || record.unavailableNote !== null).toBe(true)
      expect(record.source.path === null).toBe(record.source.revision === null)
      for (const reference of [...record.source.evidenceRefs, ...record.evidenceRefs]) {
        expect(reference.startsWith('/')).toBe(false)
        expect(reference).not.toContain('..')
        expect(reference).not.toContain('\\')
        expect(reference).not.toMatch(/^[a-z][a-z\d+.-]*:/i)
      }
      if (record.source.path !== null) {
        expect(record.source.path.startsWith('/')).toBe(false)
        expect(record.source.path).not.toContain('..')
        expect(record.source.path).not.toContain('\\')
      }
    }
    expect(SOURCE_ARTIFACT_MANIFEST.records).toHaveLength(8)
    expect(REFERENCE_LEDGER_MANIFEST.records).toHaveLength(3)
    expect(REFERENCE_LEDGER.find(({ project }) => project === 'pypdt')?.status).toBe('blocked')
  })

  it('rejects a planned record before attempting a fetch', async () => {
    const plannedRecord = WASM_PILOTS.find(({ status }) => status === 'planned')
    expect(plannedRecord).toBeDefined()
    const fetch = vi.fn(async () => wasmResponse(WASM_BYTES))
    await expect(loadVerifiedWasmArtifact(plannedRecord!, { fetch })).rejects.toThrow(/is planned, not available/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('loads only a local artifact after checking its content type, size, hash, and WebAssembly validity', async () => {
    const record = availableWasmRecord(WASM_PILOTS[0]!, {
      path: 'artifacts/coolprop.wasm',
      sha256: await sha256(WASM_BYTES),
      byteSize: WASM_BYTES.byteLength,
    })
    const fetch = vi.fn(async () => wasmResponse(WASM_BYTES))

    const module = await loadVerifiedWasmArtifact(record, { fetch, basePath: '/local/' })

    expect(module).toBeInstanceOf(WebAssembly.Module)
    expect(fetch).toHaveBeenCalledWith('/local/artifacts/coolprop.wasm', { signal: undefined })
  })

  it('rejects a missing or mismatched SHA-256 digest', async () => {
    const record = availableWasmRecord(WASM_PILOTS[0]!, {
      path: 'artifacts/coolprop.wasm',
      sha256: '0'.repeat(64),
      byteSize: WASM_BYTES.byteLength,
    })
    const fetch = vi.fn(async () => wasmResponse(WASM_BYTES))

    await expect(loadVerifiedWasmArtifact(record, { fetch })).rejects.toThrow(/SHA-256 does not match/)
  })

  it('rejects a response with an unapproved content type or over the byte limit', async () => {
    const digest = await sha256(WASM_BYTES)
    const record = availableWasmRecord(WASM_PILOTS[0]!, {
      path: 'artifacts/coolprop.wasm',
      sha256: digest,
      byteSize: WASM_BYTES.byteLength,
    })
    const wrongTypeFetch = vi.fn(async () => wasmResponse(WASM_BYTES, 'application/octet-stream'))
    await expect(loadVerifiedWasmArtifact(record, { fetch: wrongTypeFetch })).rejects.toThrow(/content-type must be application\/wasm/)

    const limitedFetch = vi.fn(async () => wasmResponse(WASM_BYTES))
    await expect(loadVerifiedWasmArtifact(record, { fetch: limitedFetch, maxBytes: WASM_BYTES.byteLength - 1 }))
      .rejects.toThrow(/over the .*-byte limit/)
    expect(limitedFetch).not.toHaveBeenCalled()
  })

  it('rejects remote artifact paths and invalid candidate paths or statuses', async () => {
    const remoteRecord = availableWasmRecord(WASM_PILOTS[0]!, {
      path: 'https://cdn.example.test/coolprop.wasm',
      sha256: '0'.repeat(64),
      byteSize: WASM_BYTES.byteLength,
    })
    const fetch = vi.fn(async () => wasmResponse(WASM_BYTES))
    await expect(loadVerifiedWasmArtifact(remoteRecord, { fetch })).rejects.toThrow(/local repository-relative/)

    const invalidPathManifest = clone(NATIVE_CANDIDATE_MANIFEST)
    invalidPathManifest.records[0]!.source.path = '../outside'
    expect(() => parseNativeCandidateManifest(invalidPathManifest)).toThrow(/source\.path/)

    const invalidStatusManifest = clone(NATIVE_CANDIDATE_MANIFEST)
    ;(invalidStatusManifest.records[0] as unknown as { status: unknown }).status = 'ready'
    expect(() => parseNativeCandidateManifest(invalidStatusManifest)).toThrow(/status has an unsupported value/)
  })

  it('requires complete SHA-256 and byte-size metadata before an entry can become available', () => {
    const incomplete = clone(WASM_PILOT_MANIFEST)
    const plannedIndex = incomplete.records.findIndex(({ status }) => status === 'planned')
    expect(plannedIndex).toBeGreaterThanOrEqual(0)
    incomplete.records[plannedIndex]!.status = 'available'
    expect(() => parseWasmPilotManifest(incomplete)).toThrow(/available artifacts require path, sha256, and byteSize/)

    const malformedHash = clone(WASM_PILOT_MANIFEST)
    malformedHash.records[plannedIndex]!.status = 'available'
    malformedHash.records[plannedIndex]!.artifact = {
      path: 'artifacts/coolprop.wasm',
      sha256: 'not-a-hash',
      byteSize: 8,
    }
    expect(() => parseWasmPilotManifest(malformedHash)).toThrow(/artifact\.sha256.*SHA-256/)
  })

  it('rejects malformed ledger records and available records without immutable integrity', () => {
    const malformed = clone(SOURCE_ARTIFACT_MANIFEST)
    malformed.records[0]!.source.path = '../outside'
    expect(() => parseSourceArtifactManifest(malformed)).toThrow(/source\.path/)

    const incompleteSource = clone(SOURCE_ARTIFACT_MANIFEST)
    incompleteSource.records[0]!.status = 'available'
    incompleteSource.records[0]!.artifact = { path: 'artifacts/pyrocko.json', sha256: null, byteSize: 8 }
    expect(() => parseSourceArtifactManifest(incompleteSource)).toThrow(/available artifacts require path, sha256, and byteSize/)

    const incompleteReference = clone(REFERENCE_LEDGER_MANIFEST)
    incompleteReference.records[0]!.status = 'available'
    incompleteReference.records[0]!.artifact = { path: 'artifacts/reference.json', sha256: null, byteSize: 8 }
    expect(() => parseReferenceLedgerManifest(incompleteReference)).toThrow(/available artifacts require path, sha256, and byteSize/)

    const wrongKind = clone(REFERENCE_LEDGER_MANIFEST)
    expect(() => parseSourceArtifactManifest(wrongKind)).toThrow(/manifest\.manifestKind/)
  })
})
