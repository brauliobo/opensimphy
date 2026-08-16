import {
  NATIVE_CANDIDATE_MANIFEST,
  NATIVE_CANDIDATES,
  WASM_PILOT_MANIFEST,
  WASM_PILOTS,
  parseNativeCandidateManifest,
  parseWasmPilotManifest,
} from '../../src/awesomePhysics/artifactManifest'
import type { ArtifactIntegrityV1, ArtifactRecordV1 } from '../../src/awesomePhysics/artifactManifest'
import { loadVerifiedWasmArtifact } from '../../src/awesomePhysics/wasmArtifactLoader'
import { vi } from 'vitest'

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
  it('contains the six pilots, two deferred proofs, and ten native candidates', () => {
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
    expect(NATIVE_CANDIDATES).toHaveLength(10)
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
    ])
    expect(NATIVE_CANDIDATES.find(({ project }) => project === 'ncollide')?.optional).toBe(true)
  })

  it('keeps every current entry unavailable and without an artifact claim', () => {
    for (const record of [...WASM_PILOTS, ...NATIVE_CANDIDATES]) {
      expect(['planned', 'blocked']).toContain(record.status)
      expect(record.artifact).toEqual({ path: null, sha256: null, byteSize: null })
    }
    expect(WASM_PILOTS.find(({ project }) => project === 'fluids')?.status).toBe('blocked')
    expect(WASM_PILOTS.find(({ project }) => project === 'thermo')?.status).toBe('blocked')
    expect(WASM_PILOT_MANIFEST.records).toHaveLength(8)
    expect(NATIVE_CANDIDATE_MANIFEST.records).toHaveLength(10)
  })

  it('rejects a planned record before attempting a fetch', async () => {
    const fetch = vi.fn(async () => wasmResponse(WASM_BYTES))
    await expect(loadVerifiedWasmArtifact(WASM_PILOTS[0]!, { fetch })).rejects.toThrow(/is planned, not available/)
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
    incomplete.records[0]!.status = 'available'
    expect(() => parseWasmPilotManifest(incomplete)).toThrow(/available artifacts require path, sha256, and byteSize/)

    const malformedHash = clone(WASM_PILOT_MANIFEST)
    malformedHash.records[0]!.status = 'available'
    malformedHash.records[0]!.artifact = {
      path: 'artifacts/coolprop.wasm',
      sha256: 'not-a-hash',
      byteSize: 8,
    }
    expect(() => parseWasmPilotManifest(malformedHash)).toThrow(/artifact\.sha256.*SHA-256/)
  })
})
