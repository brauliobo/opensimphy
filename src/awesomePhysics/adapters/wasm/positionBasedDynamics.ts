import { artifactRecordById } from '../../artifactManifest'
import type { ArtifactRecordV1 } from '../../artifactManifest'
import { loadVerifiedWasmArtifact } from '../../wasmArtifactLoader'
import { fail, jsonRecord as record, exactKeys, boundedNumber, throwIfAborted, throwIfAnyAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const POSITION_BASED_DYNAMICS_ADAPTER_ID = 'awesome-positionbaseddynamics-wasm'
export const POSITION_BASED_DYNAMICS_MANIFEST_ID = 'position-based-dynamics'
export const POSITION_BASED_DYNAMICS_SOURCE_REVISION = 'beafc921e21553515b4f406258e5b16054a45268'
export const POSITION_BASED_DYNAMICS_IMPLEMENTATION_REVISION = 'position-based-dynamics-headless-v1'
export const POSITION_BASED_DYNAMICS_OUTPUT_REVISION = 'position-based-dynamics-distance-output-v1'

export const POSITION_BASED_DYNAMICS_ARTIFACT_INTEGRITY = Object.freeze({
  path: 'wasm/awesomePhysics/position-based-dynamics/position-based-dynamics-headless.wasm',
  sha256: '3182948748996ee1f755a4092bde52cea0c8ba586d66d5c54690b8a63d8362df',
  byteSize: 1256,
})

export const POSITION_BASED_DYNAMICS_BOUNDS = Object.freeze({
  maximumAbsoluteCoordinate: 1_000_000,
  maximumRestLength: 2_000_000,
  maximumInverseMass: 1_000_000,
  maximumStiffness: 1,
  maximumAbsoluteCorrection: 2_000_000,
  maximumArtifactBytes: 4 * 1024 * 1024,
  maximumOutputBytes: 1024,
})

export const POSITION_BASED_DYNAMICS_PROVENANCE = Object.freeze({
  source: 'PositionBasedDynamics',
  sourceRevision: POSITION_BASED_DYNAMICS_SOURCE_REVISION,
  implementationRevision: POSITION_BASED_DYNAMICS_IMPLEMENTATION_REVISION,
  execution: 'verified-local-raw-wasm',
  license: 'MIT',
  validatesTheory: false,
  doesNotEstablish: 'A distance-constraint correction is not a validation of a physical theory, model, or experimental result.',
  artifact: POSITION_BASED_DYNAMICS_ARTIFACT_INTEGRITY,
})

export interface PositionBasedDynamicsDistanceInputV1 {
  operation: 'solve-distance'
  x0: number
  x1: number
  restLength: number
  inverseMass0: number
  inverseMass1: number
  stiffness: number
}

export interface PositionBasedDynamicsDistanceOutputV1 {
  schemaVersion: 1
  operation: 'solve-distance'
  input: PositionBasedDynamicsDistanceInputV1
  status: 0 | 1
  solved: boolean
  correction0: number
  correction1: number
  provenance: PositionBasedDynamicsOutputProvenanceV1
}

export interface PositionBasedDynamicsOutputProvenanceV1 {
  source: 'PositionBasedDynamics'
  sourceRevision: string
  implementationRevision: string
  execution: 'verified-local-raw-wasm'
  license: 'MIT'
  validatesTheory: false
  doesNotEstablish: string
  artifact: typeof POSITION_BASED_DYNAMICS_ARTIFACT_INTEGRITY
}

export type PositionBasedDynamicsCompatibilityV1 = AwesomePhysicsAdapterCompatibilityV1
export type PositionBasedDynamicsAdapterV1 = AwesomePhysicsAdapterV1<
  PositionBasedDynamicsDistanceInputV1,
  PositionBasedDynamicsDistanceOutputV1
>
export type PositionBasedDynamicsAdapterFactoryV1 = AwesomePhysicsAdapterFactoryV1<
  PositionBasedDynamicsDistanceInputV1,
  PositionBasedDynamicsDistanceOutputV1
>

export interface PositionBasedDynamicsWasmLoadOptions {
  fetch?: typeof globalThis.fetch
  basePath?: string
  maxBytes?: number
}

interface PositionBasedDynamicsWasmExports {
  pbd_solve_distance: (...args: PositionBasedDynamicsWasmArguments) => number
  pbd_solve_distance_correction0: (...args: PositionBasedDynamicsWasmArguments) => number
  pbd_solve_distance_correction1: (...args: PositionBasedDynamicsWasmArguments) => number
}

type PositionBasedDynamicsWasmArguments = [number, number, number, number, number, number]
export function parsePositionBasedDynamicsInput(value: unknown): PositionBasedDynamicsDistanceInputV1 {
  const input = record(value, 'PositionBasedDynamics input')
  exactKeys(input, ['operation', 'x0', 'x1', 'restLength', 'inverseMass0', 'inverseMass1', 'stiffness'], 'PositionBasedDynamics input')
  if (input.operation !== 'solve-distance') fail('PositionBasedDynamics input.operation', 'must be solve-distance')
  return {
    operation: 'solve-distance',
    x0: boundedNumber(input.x0, 'PositionBasedDynamics input.x0', -POSITION_BASED_DYNAMICS_BOUNDS.maximumAbsoluteCoordinate, POSITION_BASED_DYNAMICS_BOUNDS.maximumAbsoluteCoordinate),
    x1: boundedNumber(input.x1, 'PositionBasedDynamics input.x1', -POSITION_BASED_DYNAMICS_BOUNDS.maximumAbsoluteCoordinate, POSITION_BASED_DYNAMICS_BOUNDS.maximumAbsoluteCoordinate),
    restLength: boundedNumber(input.restLength, 'PositionBasedDynamics input.restLength', 0, POSITION_BASED_DYNAMICS_BOUNDS.maximumRestLength),
    inverseMass0: boundedNumber(input.inverseMass0, 'PositionBasedDynamics input.inverseMass0', 0, POSITION_BASED_DYNAMICS_BOUNDS.maximumInverseMass),
    inverseMass1: boundedNumber(input.inverseMass1, 'PositionBasedDynamics input.inverseMass1', 0, POSITION_BASED_DYNAMICS_BOUNDS.maximumInverseMass),
    stiffness: boundedNumber(input.stiffness, 'PositionBasedDynamics input.stiffness', 0, POSITION_BASED_DYNAMICS_BOUNDS.maximumStiffness),
  }
}
function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: PositionBasedDynamicsCompatibilityV1 } {
  throwIfAborted(signal, 'The PositionBasedDynamics operation was aborted')
  if (descriptor.catalogItemId !== 'awesome-positionbaseddynamics' || descriptor.title !== 'PositionBasedDynamics') {
    throw new TypeError('PositionBasedDynamics adapter requires the PositionBasedDynamics simulation descriptor')
  }
  if (descriptor.execution !== 'wasm' && descriptor.execution !== 'wasm-candidate') {
    throw new TypeError('PositionBasedDynamics adapter requires WASM execution')
  }
  const adapterId = descriptor.adapterId ?? POSITION_BASED_DYNAMICS_ADAPTER_ID
  if (adapterId !== POSITION_BASED_DYNAMICS_ADAPTER_ID) {
    throw new TypeError('PositionBasedDynamics descriptor adapterId is incompatible')
  }
  return {
    adapterId,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

function assertArtifactRecord(record: ArtifactRecordV1): asserts record is ArtifactRecordV1 & {
  status: 'available'
  artifact: { path: string; sha256: string; byteSize: number }
} {
  if (record.id !== POSITION_BASED_DYNAMICS_MANIFEST_ID) {
    throw new Error(`PositionBasedDynamics requires the ${POSITION_BASED_DYNAMICS_MANIFEST_ID} manifest record`)
  }
  if (record.status !== 'available') {
    throw new Error(`PositionBasedDynamics requires an available manifest record; ${record.id} is ${record.status}`)
  }
  if (record.output.artifactKind !== 'wasm-module') {
    throw new Error('PositionBasedDynamics manifest record must declare a raw wasm-module output')
  }
  if (
    record.artifact.path !== POSITION_BASED_DYNAMICS_ARTIFACT_INTEGRITY.path
    || record.artifact.sha256 !== POSITION_BASED_DYNAMICS_ARTIFACT_INTEGRITY.sha256
    || record.artifact.byteSize !== POSITION_BASED_DYNAMICS_ARTIFACT_INTEGRITY.byteSize
  ) {
    throw new Error('PositionBasedDynamics manifest integrity does not match the verified artifact')
  }
}

function wasmExports(instance: WebAssembly.Instance): PositionBasedDynamicsWasmExports {
  const exports = instance.exports as unknown as Record<string, unknown>
  const names = [
    'pbd_solve_distance',
    'pbd_solve_distance_correction0',
    'pbd_solve_distance_correction1',
  ] as const
  for (const name of names) {
    if (typeof exports[name] !== 'function') throw new Error(`PositionBasedDynamics WASM export ${name} is unavailable`)
  }
  return exports as unknown as PositionBasedDynamicsWasmExports
}

function linkedSignals(
  first: AbortSignal | undefined,
  second: AbortSignal | undefined,
): { signal: AbortSignal | undefined; dispose: () => void } {
  if (first === undefined) return { signal: second, dispose: () => undefined }
  if (second === undefined || first === second) return { signal: first, dispose: () => undefined }

  const controller = new AbortController()
  const abort = (signal: AbortSignal) => controller.abort(signal.reason)
  const abortFirst = () => abort(first)
  const abortSecond = () => abort(second)
  if (first.aborted) abort(first)
  if (second.aborted) abort(second)
  first.addEventListener('abort', abortFirst, { once: true })
  second.addEventListener('abort', abortSecond, { once: true })
  return {
    signal: controller.signal,
    dispose: () => {
      first.removeEventListener('abort', abortFirst)
      second.removeEventListener('abort', abortSecond)
    },
  }
}

export function createPositionBasedDynamicsAdapterFromRecord(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
  artifactRecord: ArtifactRecordV1,
  options: PositionBasedDynamicsWasmLoadOptions = {},
): PositionBasedDynamicsAdapterV1 {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  assertArtifactRecord(artifactRecord)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    async run(value, runSignal) {
      throwIfAborted(signal, 'The PositionBasedDynamics operation was aborted')
      throwIfAborted(runSignal, 'The PositionBasedDynamics operation was aborted')
      const input = parsePositionBasedDynamicsInput(value)
      const linked = linkedSignals(signal, runSignal)
      try {
        const module = await loadVerifiedWasmArtifact(artifactRecord, {
          fetch: options.fetch,
          basePath: options.basePath,
          maxBytes: options.maxBytes ?? POSITION_BASED_DYNAMICS_BOUNDS.maximumArtifactBytes,
          signal: linked.signal,
        })
        throwIfAborted(linked.signal, 'The PositionBasedDynamics operation was aborted')
        const instance = await WebAssembly.instantiate(module, {})
        throwIfAborted(linked.signal, 'The PositionBasedDynamics operation was aborted')
        const exports = wasmExports(instance)
        const args: PositionBasedDynamicsWasmArguments = [
          input.x0,
          input.x1,
          input.restLength,
          input.inverseMass0,
          input.inverseMass1,
          input.stiffness,
        ]
        const status = exports.pbd_solve_distance(...args)
        const correction0 = exports.pbd_solve_distance_correction0(...args)
        const correction1 = exports.pbd_solve_distance_correction1(...args)
        if ((status !== 0 && status !== 1) || !Number.isInteger(status)) {
          throw new Error('PositionBasedDynamics WASM returned an invalid status')
        }
        if (!Number.isFinite(correction0) || !Number.isFinite(correction1)) {
          throw new Error('PositionBasedDynamics WASM returned a non-finite correction')
        }
        if (
          Math.abs(correction0) > POSITION_BASED_DYNAMICS_BOUNDS.maximumAbsoluteCorrection
          || Math.abs(correction1) > POSITION_BASED_DYNAMICS_BOUNDS.maximumAbsoluteCorrection
        ) {
          throw new Error('PositionBasedDynamics WASM returned an out-of-bounds correction')
        }
        return {
          schemaVersion: 1,
          operation: 'solve-distance',
          input,
          status: status as 0 | 1,
          solved: status === 1,
          correction0,
          correction1,
          provenance: POSITION_BASED_DYNAMICS_PROVENANCE,
        }
      } finally {
        linked.dispose()
      }
    },
  }
}

export const createPositionBasedDynamicsAdapter: PositionBasedDynamicsAdapterFactoryV1 = (descriptor, signal) => {
  const artifactRecord = artifactRecordById(POSITION_BASED_DYNAMICS_MANIFEST_ID)
  if (artifactRecord === null) {
    throw new Error('PositionBasedDynamics has no central manifest record; adapter registration is deferred')
  }
  return createPositionBasedDynamicsAdapterFromRecord(descriptor, signal, artifactRecord)
}

export const positionBasedDynamicsAdapterFactory = createPositionBasedDynamicsAdapter
