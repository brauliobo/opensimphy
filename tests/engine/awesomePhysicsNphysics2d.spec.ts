import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  NPHYSICS2D_ADAPTER_ID,
  NPHYSICS2D_ARTIFACT_INTEGRITY,
  NPHYSICS2D_BOUNDS,
  NPHYSICS2D_IMPLEMENTATION_REVISION,
  NPHYSICS2D_PROVENANCE,
  NPHYSICS2D_SOURCE_REVISION,
  createNphysics2dAdapterFromRecord,
  parseNphysics2dInput,
} from '../../src/awesomePhysics/adapters/wasm/nphysics2d'
import { NPHYSICS2D_MANIFEST_ID } from '../../src/awesomePhysics/adapters/wasm/nphysics2d'
import { WASM_PILOTS } from '../../src/awesomePhysics/artifactManifest'
import { awesomePhysicsAdapterFactoryMap } from '../../src/awesomePhysics/adapterFactories'
import {
  loadVerifiedCompanionJavaScript,
  loadVerifiedWasmArtifact,
} from '../../src/awesomePhysics/wasmArtifactLoader'
import type {
  ArtifactRecordV1,
} from '../../src/awesomePhysics/artifactManifest'
import type {
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const descriptor = simulations.items.find(({ catalogItemId }) => catalogItemId === 'awesome-nphysics')
if (!descriptor) throw new Error('Missing generated nphysics descriptor')
const manifestRecord = WASM_PILOTS.find(({ id }) => id === NPHYSICS2D_MANIFEST_ID)
if (!manifestRecord) throw new Error('Missing nphysics WASM pilot record')

const publicRoot = resolve(process.cwd(), 'public/wasm/awesomePhysics/nphysics')
const wasmBytes = new Uint8Array(readFileSync(resolve(publicRoot, 'nphysics2d_worker_probe.wasm')))
const javascriptBytes = new Uint8Array(readFileSync(resolve(publicRoot, 'nphysics2d_worker_probe.js')))

const availableDescriptor: AwesomePhysicsSimulationDescriptorV1 = {
  ...descriptor,
  execution: 'wasm',
  executionOptions: ['wasm'],
  availability: 'available',
  runnable: true,
  adapterId: NPHYSICS2D_ADAPTER_ID,
}

const fixtureRecord: ArtifactRecordV1 = {
  ...manifestRecord,
  artifact: {
    ...manifestRecord.artifact,
    companion: manifestRecord.artifact.companion === undefined
      ? undefined
      : { ...manifestRecord.artifact.companion },
  },
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function response(bytes: Uint8Array, contentType: string): Response {
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-length': String(bytes.byteLength),
    },
  })
}

function localFetch(): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string | URL, _init?: RequestInit) => {
    const path = String(url)
    if (path.endsWith('.js')) return response(javascriptBytes, 'application/javascript')
    if (path.endsWith('.wasm')) return response(wasmBytes, 'application/wasm')
    throw new Error(`Unexpected nphysics URL ${path}`)
  })
}

describe('nphysics2d verified WASM pilot', () => {
  it('matches the exact 2D artifact pair and build ledger without a 3D promotion', () => {
    const ledger = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/awesomePhysics/wasm/nphysics/build-ledger.json'), 'utf8')) as {
      source: { revision: string }
      artifact: {
        wasm: { name: string; byteSize: number; sha256: string }
        javascript: { name: string; byteSize: number; sha256: string }
      }
    }
    expect(ledger.source.revision).toBe(NPHYSICS2D_SOURCE_REVISION)
    expect(ledger.artifact.wasm).toEqual({
      name: 'nphysics2d_worker_probe.wasm',
      path: NPHYSICS2D_ARTIFACT_INTEGRITY.wasm.path,
      byteSize: NPHYSICS2D_ARTIFACT_INTEGRITY.wasm.byteSize,
      sha256: NPHYSICS2D_ARTIFACT_INTEGRITY.wasm.sha256,
    })
    expect(ledger.artifact.javascript).toEqual({
      name: 'nphysics2d_worker_probe.js',
      path: NPHYSICS2D_ARTIFACT_INTEGRITY.javascript.path,
      byteSize: NPHYSICS2D_ARTIFACT_INTEGRITY.javascript.byteSize,
      sha256: NPHYSICS2D_ARTIFACT_INTEGRITY.javascript.sha256,
    })
    expect(wasmBytes.byteLength).toBe(367036)
    expect(javascriptBytes.byteLength).toBe(12916)
    expect(sha256(wasmBytes)).toBe(NPHYSICS2D_ARTIFACT_INTEGRITY.wasm.sha256)
    expect(sha256(javascriptBytes)).toBe(NPHYSICS2D_ARTIFACT_INTEGRITY.javascript.sha256)
    expect(manifestRecord).toMatchObject({
      status: 'available',
      licenseGate: { status: 'pass' },
      source: { revision: NPHYSICS2D_SOURCE_REVISION },
      artifact: {
        path: NPHYSICS2D_ARTIFACT_INTEGRITY.wasm.path,
        sha256: NPHYSICS2D_ARTIFACT_INTEGRITY.wasm.sha256,
        byteSize: NPHYSICS2D_ARTIFACT_INTEGRITY.wasm.byteSize,
        companion: NPHYSICS2D_ARTIFACT_INTEGRITY.javascript,
      },
    })
    expect(descriptor).toMatchObject({
      execution: 'wasm',
      executionOptions: ['wasm'],
      availability: 'available',
      runnable: true,
      adapterId: NPHYSICS2D_ADAPTER_ID,
      sourceRevision: NPHYSICS2D_SOURCE_REVISION,
      implementationRevision: NPHYSICS2D_IMPLEMENTATION_REVISION,
      inputSchema: 'nphysics2d-input-v1',
      outputSchema: 'nphysics2d-output-v1',
    })
    expect(manifestRecord.output.module).not.toMatch(/nphysics3d/i)
    expect(manifestRecord.artifact.path).not.toMatch(/3d/i)
    expect(simulations.items.some(({ title }) => title === 'nphysics3d')).toBe(false)
  })

  it('parses snapshot and bounded step inputs', () => {
    expect(parseNphysics2dInput({ operation: 'snapshot' })).toEqual({ operation: 'snapshot' })
    expect(parseNphysics2dInput({ operation: 'step', steps: 0 })).toEqual({ operation: 'step', steps: 0 })
    expect(parseNphysics2dInput({ operation: 'step', steps: NPHYSICS2D_BOUNDS.maximumStepsPerCall })).toEqual({
      operation: 'step',
      steps: NPHYSICS2D_BOUNDS.maximumStepsPerCall,
    })
    expect(() => parseNphysics2dInput({ operation: 'step', steps: -1 })).toThrow(/between 0 and 600/)
    expect(() => parseNphysics2dInput({ operation: 'step', steps: 601 })).toThrow(/between 0 and 600/)
    expect(() => parseNphysics2dInput({ operation: 'step', steps: 1.5 })).toThrow(/integer/)
    expect(() => parseNphysics2dInput({ operation: 'snapshot', extra: true })).toThrow(/unknown properties/)
    expect(() => parseNphysics2dInput({ operation: 'step', steps: Number.NaN })).toThrow(/integer/)
  })

  it('verifies both local files through the existing loaders', async () => {
    const fetch = localFetch()
    await expect(loadVerifiedCompanionJavaScript(fixtureRecord, { fetch, basePath: '/' })).resolves.toEqual(javascriptBytes)
    await expect(loadVerifiedWasmArtifact(fixtureRecord, { fetch, basePath: '/' })).resolves.toBeInstanceOf(WebAssembly.Module)
    expect(fetch).toHaveBeenNthCalledWith(1, '/wasm/awesomePhysics/nphysics/nphysics2d_worker_probe.js', { signal: undefined })
    expect(fetch).toHaveBeenNthCalledWith(2, '/wasm/awesomePhysics/nphysics/nphysics2d_worker_probe.wasm', { signal: undefined })

    const wrongMime = vi.fn(async () => response(javascriptBytes, 'application/octet-stream'))
    await expect(loadVerifiedCompanionJavaScript(fixtureRecord, { fetch: wrongMime })).rejects.toThrow(/content-type must be one of/)
    const wrongHash: ArtifactRecordV1 = {
      ...fixtureRecord,
      artifact: {
        ...fixtureRecord.artifact,
        companion: { ...fixtureRecord.artifact.companion!, sha256: '0'.repeat(64) },
      },
    }
    await expect(loadVerifiedCompanionJavaScript(wrongHash, { fetch: localFetch() })).rejects.toThrow(/SHA-256 does not match/)
  })

  it.skip('loads the verified Blob companion, returns finite snapshots, and enforces cumulative steps', async () => {
    // Vite's Node test transformer does not resolve blob:nodedata URLs. Chromium
    // E2E runs this exact public-pair path; this engine suite does not fake it.
    const fetch = localFetch()
    const adapter = createNphysics2dAdapterFromRecord(
      availableDescriptor,
      new AbortController().signal,
      fixtureRecord,
      { fetch, basePath: '/' },
    )
    await expect(adapter.run({ operation: 'snapshot' })).resolves.toMatchObject({
      schemaVersion: 1,
      dimension: 2,
      operation: 'snapshot',
      snapshot: { x: 0, y: 2, angle: 0, steps: 0 },
      provenance: NPHYSICS2D_PROVENANCE,
    })
    const falling = await adapter.run({ operation: 'step', steps: 60 })
    expect(falling).toMatchObject({ operation: 'step', snapshot: { steps: 60 } })
    expect((falling as { y: number }).y).toBeLessThan(2)
    const settled = await adapter.run({ operation: 'step', steps: 600 })
    expect(settled).toMatchObject({ operation: 'step', snapshot: { steps: 660 } })
    for (let index = 0; index < 8; index += 1) await adapter.run({ operation: 'step', steps: 600 })
    await adapter.run({ operation: 'step', steps: 500 })
    await expect(adapter.run({ operation: 'step', steps: 41 })).rejects.toThrow(/total steps exceeds 6000/)
    await expect(adapter.run({ operation: 'step', steps: 601 })).rejects.toThrow(/between 0 and 600/)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('fails closed for descriptor mismatch and cancellation before loading', async () => {
    expect(() => createNphysics2dAdapterFromRecord(
      { ...availableDescriptor, sourceRevision: '0'.repeat(40) },
      new AbortController().signal,
      fixtureRecord,
    )).toThrow(/sourceRevision is incompatible/)
    expect(() => createNphysics2dAdapterFromRecord(
      { ...availableDescriptor, execution: 'browser' },
      new AbortController().signal,
      fixtureRecord,
    )).toThrow(/requires WASM execution/)

    const fetch = localFetch()
    const adapter = createNphysics2dAdapterFromRecord(
      availableDescriptor,
      new AbortController().signal,
      fixtureRecord,
      { fetch },
    )
    const cancelled = new AbortController()
    cancelled.abort()
    await expect(adapter.run({ operation: 'snapshot' }, cancelled.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).not.toHaveBeenCalled()

    const factoryAbort = new AbortController()
    factoryAbort.abort()
    expect(() => createNphysics2dAdapterFromRecord(availableDescriptor, factoryAbort.signal, fixtureRecord)).toThrow(/aborted/)
    expect(awesomePhysicsAdapterFactoryMap.has(NPHYSICS2D_ADAPTER_ID)).toBe(true)
  })
})
