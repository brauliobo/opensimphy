import { artifactRecordById } from '../../artifactManifest'
import type { ArtifactRecordV1 } from '../../artifactManifest'
import { loadVerifiedWasmArtifact } from '../../wasmArtifactLoader'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const NCOLLIDE_ADAPTER_ID = 'awesome-ncollide-wasm'
export const NCOLLIDE_MANIFEST_ID = 'ncollide'
export const NCOLLIDE_SOURCE_REVISION = 'f3c3ecb3c98d1c2698574372b6b0e9d0032bc0c5'
export const NCOLLIDE_IMPLEMENTATION_REVISION = 'ncollide2d-headless-collision-wasm-v1'
export const NCOLLIDE_OUTPUT_REVISION = 'ncollide2d-collision-output-v1'
export const NCOLLIDE_ARTIFACT_INTEGRITY = Object.freeze({
  path: 'wasm/awesomePhysics/ncollide/ncollide2d.wasm',
  sha256: '57ca3a88ae50d98a93221ae161143b991f0f3e0c3c52c687348216ea2c35da6a',
  byteSize: 113119,
})

export const NCOLLIDE_BOUNDS = Object.freeze({
  maximumStepsPerCall: 600,
  maximumInputBytes: 1024,
  maximumOutputBytes: 4096,
  maximumArtifactBytes: 1_048_576,
  maximumOutputAbsoluteValue: 1_000_000,
})

export const NCOLLIDE_PROVENANCE = Object.freeze({
  source: 'ncollide',
  sourceRevision: NCOLLIDE_SOURCE_REVISION,
  implementationRevision: NCOLLIDE_IMPLEMENTATION_REVISION,
  execution: 'verified-local-raw-wasm',
  license: 'Apache-2.0',
  validatesTheory: false,
  doesNotEstablish: 'A finite ncollide2d collision fixture is not a validation of a physical theory, model, or experimental result.',
  artifact: NCOLLIDE_ARTIFACT_INTEGRITY,
})

export interface NcollideDistanceInputV1 {
  operation: 'distance'
}

export interface NcollideContactInputV1 {
  operation: 'contact'
}

export interface NcollideRayInputV1 {
  operation: 'ray'
}

export interface NcollideTimeOfImpactInputV1 {
  operation: 'time-of-impact'
}

export interface NcollideStepInputV1 {
  operation: 'step'
  steps: number
}

export type NcollideInputV1 =
  | NcollideDistanceInputV1
  | NcollideContactInputV1
  | NcollideRayInputV1
  | NcollideTimeOfImpactInputV1
  | NcollideStepInputV1

export interface NcollideScalarOutputV1 {
  schemaVersion: 1
  operation: Exclude<NcollideInputV1['operation'], 'step'>
  value: number
  provenance: typeof NCOLLIDE_PROVENANCE
}

export interface NcollideStepOutputV1 {
  schemaVersion: 1
  operation: 'step'
  steps: number
  y: number
  value: number
  units: 'world-units'
  provenance: typeof NCOLLIDE_PROVENANCE
}

export type NcollideOutputV1 = NcollideScalarOutputV1 | NcollideStepOutputV1
export type NcollideAdapterV1 = AwesomePhysicsAdapterV1<NcollideInputV1, NcollideOutputV1>
export type NcollideAdapterFactoryV1 = AwesomePhysicsAdapterFactoryV1<NcollideInputV1, NcollideOutputV1>

export interface NcollideWasmExportsV1 {
  ncollide_distance: () => number
  ncollide_contact_depth: () => number
  ncollide_ray_toi: () => number
  ncollide_time_of_impact: () => number
  ncollide_step: (steps: number) => number
}

function fail(path: string, message: string): never {
  throw new TypeError(`${path} ${message}`)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'must be a JSON object')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) fail(path, 'must be a plain JSON object')
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], path: string): void {
  const allowed = new Set(required)
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  const missing = required.filter((key) => !Object.hasOwn(value, key))
  if (unknown.length > 0) fail(path, `has unknown properties: ${unknown.join(', ')}`)
  if (missing.length > 0) fail(path, `is missing properties: ${missing.join(', ')}`)
}

function inputByteLength(value: unknown, path: string): number {
  let json: string | undefined
  try {
    json = JSON.stringify(value)
  } catch {
    fail(path, 'must be JSON serializable')
  }
  if (json === undefined) fail(path, 'must be JSON serializable')
  const byteLength = new TextEncoder().encode(json).byteLength
  if (byteLength > NCOLLIDE_BOUNDS.maximumInputBytes) {
    fail(path, `exceeds the ${NCOLLIDE_BOUNDS.maximumInputBytes}-byte input limit`)
  }
  return byteLength
}

function boundedStepCount(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) fail(path, 'must be an integer')
  if (value < 0 || value > NCOLLIDE_BOUNDS.maximumStepsPerCall) {
    fail(path, `must be between 0 and ${NCOLLIDE_BOUNDS.maximumStepsPerCall}`)
  }
  return value
}

export function parseNcollideInput(value: unknown): NcollideInputV1 {
  inputByteLength(value, 'ncollide input')
  const input = record(value, 'ncollide input')
  if (input.operation === 'distance') {
    exactKeys(input, ['operation'], 'ncollide input')
    return { operation: 'distance' }
  }
  if (input.operation === 'contact') {
    exactKeys(input, ['operation'], 'ncollide input')
    return { operation: 'contact' }
  }
  if (input.operation === 'ray') {
    exactKeys(input, ['operation'], 'ncollide input')
    return { operation: 'ray' }
  }
  if (input.operation === 'time-of-impact') {
    exactKeys(input, ['operation'], 'ncollide input')
    return { operation: 'time-of-impact' }
  }
  if (input.operation === 'step') {
    exactKeys(input, ['operation', 'steps'], 'ncollide input')
    return { operation: 'step', steps: boundedStepCount(input.steps, 'ncollide input.steps') }
  }
  fail('ncollide input.operation', 'must be distance, contact, ray, time-of-impact, or step')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  const error = signal.reason instanceof Error ? signal.reason : new Error('The ncollide operation was aborted')
  error.name = 'AbortError'
  throw error
}

function finiteScalar(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
  if (Math.abs(value) > NCOLLIDE_BOUNDS.maximumOutputAbsoluteValue) {
    fail(path, `must be within +/-${NCOLLIDE_BOUNDS.maximumOutputAbsoluteValue}`)
  }
  return value
}

function boundedOutput<T extends NcollideOutputV1>(value: T): T {
  const byteLength = new TextEncoder().encode(JSON.stringify(value)).byteLength
  if (byteLength > NCOLLIDE_BOUNDS.maximumOutputBytes) {
    throw new RangeError(`ncollide output exceeds the ${NCOLLIDE_BOUNDS.maximumOutputBytes}-byte output limit`)
  }
  return value
}

function safeRevision(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'must be a non-empty string')
  return value
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-ncollide' || descriptor.title !== 'ncollide') {
    throw new TypeError('ncollide adapter requires the ncollide simulation descriptor')
  }
  if (descriptor.execution !== 'wasm') throw new TypeError('ncollide adapter requires WASM execution')
  if (descriptor.availability !== 'available' || descriptor.runnable !== true) {
    throw new TypeError('ncollide adapter requires an available runnable descriptor')
  }
  const adapterId = descriptor.adapterId ?? NCOLLIDE_ADAPTER_ID
  if (adapterId !== NCOLLIDE_ADAPTER_ID) throw new TypeError('ncollide descriptor adapterId is incompatible')
  return {
    adapterId,
    compatibility: {
      contentRevision: safeRevision(descriptor.contentRevision, 'ncollide descriptor.contentRevision'),
      modelRevision: safeRevision(descriptor.modelRevision, 'ncollide descriptor.modelRevision'),
      implementationRevision: safeRevision(descriptor.implementationRevision, 'ncollide descriptor.implementationRevision'),
      outputRevision: safeRevision(descriptor.outputRevision, 'ncollide descriptor.outputRevision'),
    },
  }
}

function verifiedArtifactRecord(): ArtifactRecordV1 {
  const record = artifactRecordById(NCOLLIDE_MANIFEST_ID)
  if (record === null) throw new Error('The ncollide WASM artifact manifest record is missing')
  if (record.status !== 'available') {
    throw new Error(`The ncollide WASM artifact manifest record is ${record.status}, not available`)
  }
  if (
    record.source.revision !== NCOLLIDE_SOURCE_REVISION
    || record.artifact.path !== NCOLLIDE_ARTIFACT_INTEGRITY.path
    || record.artifact.sha256 !== NCOLLIDE_ARTIFACT_INTEGRITY.sha256
    || record.artifact.byteSize !== NCOLLIDE_ARTIFACT_INTEGRITY.byteSize
  ) {
    throw new Error('The ncollide WASM artifact manifest record does not match the verified artifact')
  }
  return record
}

function requireWasmExports(value: WebAssembly.Exports): NcollideWasmExportsV1 {
  const exports = value as unknown as Partial<NcollideWasmExportsV1>
  if (
    typeof exports.ncollide_distance !== 'function'
    || typeof exports.ncollide_contact_depth !== 'function'
    || typeof exports.ncollide_ray_toi !== 'function'
    || typeof exports.ncollide_time_of_impact !== 'function'
    || typeof exports.ncollide_step !== 'function'
  ) {
    throw new Error('The ncollide WASM module does not expose the verified collision ABI')
  }
  return exports as NcollideWasmExportsV1
}

export async function instantiateNcollideModule(module: WebAssembly.Module): Promise<NcollideWasmExportsV1> {
  const instance = await WebAssembly.instantiate(module, {})
  return requireWasmExports(instance.exports)
}

async function runNcollide(input: NcollideInputV1, signal: AbortSignal, descriptorSignal: AbortSignal): Promise<NcollideOutputV1> {
  throwIfAborted(descriptorSignal)
  throwIfAborted(signal)
  const record = verifiedArtifactRecord()
  throwIfAborted(signal)
  const module = await loadVerifiedWasmArtifact(record, {
    maxBytes: Math.min(record.runtime.maxArtifactBytes, NCOLLIDE_BOUNDS.maximumArtifactBytes),
    signal,
  })
  throwIfAborted(signal)
  const exports = await instantiateNcollideModule(module)
  throwIfAborted(signal)

  if (input.operation === 'step') {
    const y = finiteScalar(exports.ncollide_step(input.steps), 'ncollide output.y')
    return boundedOutput({
      schemaVersion: 1,
      operation: input.operation,
      steps: input.steps,
      y,
      value: y,
      units: 'world-units',
      provenance: NCOLLIDE_PROVENANCE,
    })
  }

  const readers = {
    distance: exports.ncollide_distance,
    contact: exports.ncollide_contact_depth,
    ray: exports.ncollide_ray_toi,
    'time-of-impact': exports.ncollide_time_of_impact,
  } as const
  const value = finiteScalar(readers[input.operation](), `ncollide output.value`)
  return boundedOutput({
    schemaVersion: 1,
    operation: input.operation,
    value,
    provenance: NCOLLIDE_PROVENANCE,
  })
}

export const createNcollideAdapter: NcollideAdapterFactoryV1 = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    async run(input, runSignal) {
      throwIfAborted(signal)
      throwIfAborted(runSignal)
      const parsedInput = parseNcollideInput(input)
      return runNcollide(parsedInput, runSignal ?? signal, signal)
    },
  }
}

export const createNcollideAdapterFactory = createNcollideAdapter
export const ncollideAdapterFactory = createNcollideAdapter
