import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  NATIVE_CANDIDATES,
} from '../../src/awesomePhysics/artifactManifest'
import {
  createPositionBasedDynamicsAdapter,
  createPositionBasedDynamicsAdapterFromRecord,
  parsePositionBasedDynamicsInput,
  POSITION_BASED_DYNAMICS_ADAPTER_ID,
  POSITION_BASED_DYNAMICS_ARTIFACT_INTEGRITY,
  POSITION_BASED_DYNAMICS_BOUNDS,
  POSITION_BASED_DYNAMICS_IMPLEMENTATION_REVISION,
  POSITION_BASED_DYNAMICS_MANIFEST_ID,
  POSITION_BASED_DYNAMICS_OUTPUT_REVISION,
  POSITION_BASED_DYNAMICS_PROVENANCE,
} from '../../src/awesomePhysics/adapters/wasm/positionBasedDynamics'
import type { ArtifactRecordV1 } from '../../src/awesomePhysics/artifactManifest'
import type {
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const positionDescriptor = simulations.items.find(({ catalogItemId }) => catalogItemId === 'awesome-positionbaseddynamics')
if (!positionDescriptor) throw new Error('Missing generated PositionBasedDynamics descriptor')

const publicArtifactPath = resolve(process.cwd(), 'public/wasm/awesomePhysics/position-based-dynamics/position-based-dynamics-headless.wasm')
const artifactBytes = new Uint8Array(readFileSync(publicArtifactPath))
const manifestRecord = NATIVE_CANDIDATES.find(({ id }) => id === POSITION_BASED_DYNAMICS_MANIFEST_ID)
if (!manifestRecord) throw new Error('Missing PositionBasedDynamics native candidate record')

const fixtureDescriptor: AwesomePhysicsSimulationDescriptorV1 = {
  ...positionDescriptor,
  execution: 'wasm',
  executionOptions: ['wasm'],
  availability: 'available',
  runnable: true,
  adapterId: POSITION_BASED_DYNAMICS_ADAPTER_ID,
  implementationRevision: POSITION_BASED_DYNAMICS_IMPLEMENTATION_REVISION,
  outputRevision: POSITION_BASED_DYNAMICS_OUTPUT_REVISION,
}

const fixtureRecord: ArtifactRecordV1 = {
  ...manifestRecord,
  artifact: { ...manifestRecord.artifact },
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function wasmResponse(bytes = artifactBytes): Response {
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': 'application/wasm',
      'content-length': String(bytes.byteLength),
    },
  })
}

describe('PositionBasedDynamics headless WASM artifact', () => {
  it('matches the fixed artifact ledger and exposes only the standalone scalar ABI', async () => {
    const ledger = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/awesomePhysics/wasm/position-based-dynamics/build-ledger.json'), 'utf8')) as {
      artifact: { name: string; path: string; byteSize: number; sha256: string }
    }
    expect(ledger.artifact).toEqual({
      name: 'position-based-dynamics-headless.wasm',
      path: POSITION_BASED_DYNAMICS_ARTIFACT_INTEGRITY.path,
      byteSize: POSITION_BASED_DYNAMICS_ARTIFACT_INTEGRITY.byteSize,
      sha256: POSITION_BASED_DYNAMICS_ARTIFACT_INTEGRITY.sha256,
    })
    expect(artifactBytes.byteLength).toBe(POSITION_BASED_DYNAMICS_ARTIFACT_INTEGRITY.byteSize)
    expect(sha256(artifactBytes)).toBe(POSITION_BASED_DYNAMICS_ARTIFACT_INTEGRITY.sha256)

    const module = await WebAssembly.compile(artifactBytes)
    expect(WebAssembly.Module.imports(module)).toEqual([])
    expect(WebAssembly.Module.exports(module).map(({ name }) => name)).toEqual(expect.arrayContaining([
      'pbd_solve_distance',
      'pbd_solve_distance_correction0',
      'pbd_solve_distance_correction1',
    ]))
  })

  it('returns known finite distance corrections through the raw ABI', async () => {
    const module = await WebAssembly.compile(artifactBytes)
    const instance = await WebAssembly.instantiate(module, {})
    const exports = instance.exports as unknown as {
      pbd_solve_distance: (...args: [number, number, number, number, number, number]) => number
      pbd_solve_distance_correction0: (...args: [number, number, number, number, number, number]) => number
      pbd_solve_distance_correction1: (...args: [number, number, number, number, number, number]) => number
    }
    const stretched = [0, 2, 1, 1, 1, 1] as [number, number, number, number, number, number]
    expect(exports.pbd_solve_distance(...stretched)).toBe(1)
    expect(exports.pbd_solve_distance_correction0(...stretched)).toBeCloseTo(0.5, 12)
    expect(exports.pbd_solve_distance_correction1(...stretched)).toBeCloseTo(-0.5, 12)

    const weighted = [-1, 1, 1.5, 0, 2, 0.5] as [number, number, number, number, number, number]
    expect(exports.pbd_solve_distance(...weighted)).toBe(1)
    expect(exports.pbd_solve_distance_correction0(...weighted)).toBeCloseTo(0, 12)
    expect(exports.pbd_solve_distance_correction1(...weighted)).toBeCloseTo(-0.25, 12)

    const unsolved = [0, 0, 1, 1, 1, 1] as [number, number, number, number, number, number]
    expect(exports.pbd_solve_distance(...unsolved)).toBe(0)
    expect(exports.pbd_solve_distance_correction0(...unsolved)).toBe(0)
    expect(exports.pbd_solve_distance_correction1(...unsolved)).toBe(0)
  })

  it('rejects malformed and out-of-bounds scalar input before loading WASM', () => {
    const valid = {
      operation: 'solve-distance',
      x0: 0,
      x1: 2,
      restLength: 1,
      inverseMass0: 1,
      inverseMass1: 1,
      stiffness: 1,
    }
    expect(parsePositionBasedDynamicsInput(valid)).toEqual(valid)
    expect(() => parsePositionBasedDynamicsInput({ ...valid, unexpected: true })).toThrow(/unknown properties/)
    expect(() => parsePositionBasedDynamicsInput({ ...valid, x0: Number.NaN })).toThrow(/finite number/)
    expect(() => parsePositionBasedDynamicsInput({ ...valid, x1: POSITION_BASED_DYNAMICS_BOUNDS.maximumAbsoluteCoordinate + 1 })).toThrow(/between/)
    expect(() => parsePositionBasedDynamicsInput({ ...valid, restLength: -1 })).toThrow(/between/)
    expect(() => parsePositionBasedDynamicsInput({ ...valid, inverseMass0: -1 })).toThrow(/between/)
    expect(() => parsePositionBasedDynamicsInput({ ...valid, stiffness: 1.01 })).toThrow(/between/)
  })

  it('loads the verified module through the existing loader and returns compatibility metadata', async () => {
    const fetch = vi.fn(async () => wasmResponse())
    const adapter = createPositionBasedDynamicsAdapterFromRecord(
      fixtureDescriptor,
      new AbortController().signal,
      fixtureRecord,
      { fetch, basePath: '/' },
    )
    expect(adapter).toMatchObject({
      adapterId: POSITION_BASED_DYNAMICS_ADAPTER_ID,
      protocol: 'awesome-physics-adapter-v1',
      compatibility: {
        contentRevision: fixtureDescriptor.contentRevision,
        modelRevision: fixtureDescriptor.modelRevision,
        implementationRevision: fixtureDescriptor.implementationRevision,
        outputRevision: fixtureDescriptor.outputRevision,
      },
    })

    await expect(adapter.run({
      operation: 'solve-distance',
      x0: 0,
      x1: 2,
      restLength: 1,
      inverseMass0: 1,
      inverseMass1: 1,
      stiffness: 1,
    })).resolves.toMatchObject({
      schemaVersion: 1,
      status: 1,
      solved: true,
      correction0: 0.5,
      correction1: -0.5,
      provenance: POSITION_BASED_DYNAMICS_PROVENANCE,
    })
    expect(fetch).toHaveBeenCalledWith(
      '/wasm/awesomePhysics/position-based-dynamics/position-based-dynamics-headless.wasm',
      { signal: expect.any(AbortSignal) },
    )
  })

  it('fails closed on compatibility, cancellation, and unavailable records', async () => {
    expect(() => createPositionBasedDynamicsAdapterFromRecord(
      { ...fixtureDescriptor, catalogItemId: 'wrong-catalog-item' },
      new AbortController().signal,
      fixtureRecord,
    )).toThrow(/requires the PositionBasedDynamics simulation descriptor/)
    expect(() => createPositionBasedDynamicsAdapterFromRecord(
      { ...fixtureDescriptor, adapterId: 'wrong-adapter' },
      new AbortController().signal,
      fixtureRecord,
    )).toThrow(/adapterId is incompatible/)

    const abortedFactory = new AbortController()
    abortedFactory.abort()
    expect(() => createPositionBasedDynamicsAdapterFromRecord(
      fixtureDescriptor,
      abortedFactory.signal,
      fixtureRecord,
    )).toThrow(/aborted/)

    const fetch = vi.fn(async () => wasmResponse())
    const adapter = createPositionBasedDynamicsAdapterFromRecord(
      fixtureDescriptor,
      new AbortController().signal,
      fixtureRecord,
      { fetch },
    )
    const abortedRun = new AbortController()
    abortedRun.abort()
    await expect(adapter.run({
      operation: 'solve-distance',
      x0: 0,
      x1: 2,
      restLength: 1,
      inverseMass0: 1,
      inverseMass1: 1,
      stiffness: 1,
    }, abortedRun.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).not.toHaveBeenCalled()

    expect(() => createPositionBasedDynamicsAdapterFromRecord(
      fixtureDescriptor,
      new AbortController().signal,
      { ...fixtureRecord, status: 'planned', artifact: { path: null, sha256: null, byteSize: null } },
    )).toThrow(/requires an available manifest record/)
    expect(createPositionBasedDynamicsAdapter(positionDescriptor, new AbortController().signal)).toMatchObject({
      adapterId: POSITION_BASED_DYNAMICS_ADAPTER_ID,
      protocol: 'awesome-physics-adapter-v1',
    })
  })

  it('publishes the verified descriptor and central adapter registration', () => {
    expect(positionDescriptor).toMatchObject({
      execution: 'wasm',
      availability: 'available',
      runnable: true,
      adapterId: POSITION_BASED_DYNAMICS_ADAPTER_ID,
      sourceRevision: POSITION_BASED_DYNAMICS_PROVENANCE.sourceRevision,
      implementationRevision: POSITION_BASED_DYNAMICS_IMPLEMENTATION_REVISION,
    })
    expect(manifestRecord).toMatchObject({
      status: 'available',
      artifact: POSITION_BASED_DYNAMICS_ARTIFACT_INTEGRITY,
    })
    const adapterFactories = readFileSync(resolve(process.cwd(), 'src/awesomePhysics/adapterFactories.ts'), 'utf8')
    expect(adapterFactories).toContain(POSITION_BASED_DYNAMICS_ADAPTER_ID)
  })
})
