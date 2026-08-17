import { artifactRecordById } from '../../artifactManifest'
import type { ArtifactRecordV1 } from '../../artifactManifest'
import { loadVerifiedWasmArtifact } from '../../wasmArtifactLoader'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const PYMUNK_ADAPTER_ID = 'awesome-pymunk-wasm'
export const PYMUNK_MANIFEST_ID = 'pymunk'
export const PYMUNK_SOURCE_REVISION = '6287ce6d9223d1d79d28b2c26f37499f45b445b8'
export const PYMUNK_CHIPMUNK_REVISION = '47b0e6b200c1aedb7b9ee09a998a2ef0bbad8f82'
export const PYMUNK_IMPLEMENTATION_REVISION = 'pymunk-chipmunk-headless-wasm-v1'
export const PYMUNK_OUTPUT_REVISION = 'pymunk-headless-output-v1'
export const PYMUNK_ARTIFACT_INTEGRITY = Object.freeze({
  path: 'wasm/awesomePhysics/pymunk/pymunk.wasm',
  sha256: '0166b68c54e17b3892ca675749afdc065806e8df5636fc55e89d8d4badb67158',
  byteSize: 76555,
})

export const PYMUNK_BOUNDS = Object.freeze({
  maximumStepsPerCall: 600,
  maximumInputBytes: 1024,
  maximumOutputBytes: 4096,
  maximumArtifactBytes: 1_048_576,
  maximumSnapshotAbsoluteValue: 1_000_000,
})

export const PYMUNK_PROVENANCE = Object.freeze({
  source: 'pymunk',
  sourceRevision: PYMUNK_SOURCE_REVISION,
  chipmunkRevision: PYMUNK_CHIPMUNK_REVISION,
  implementationRevision: PYMUNK_IMPLEMENTATION_REVISION,
  execution: 'verified-local-raw-wasm',
  license: 'MIT',
  validatesTheory: false,
  doesNotEstablish: 'A finite pymunk/Chipmunk fixture result is not a validation of a physical theory, model, or experimental result.',
  artifact: PYMUNK_ARTIFACT_INTEGRITY,
})

export interface PymunkSnapshotInputV1 {
  operation: 'snapshot'
}

export interface PymunkStepInputV1 {
  operation: 'step'
  steps: number
}

export type PymunkInputV1 = PymunkSnapshotInputV1 | PymunkStepInputV1

export interface PymunkSnapshotV1 {
  x: number
  y: number
  angle: number
  steps: number
}

export interface PymunkSnapshotOutputV1 {
  schemaVersion: 1
  dimension: 2
  operation: 'snapshot'
  input: PymunkSnapshotInputV1
  snapshot: PymunkSnapshotV1
  provenance: typeof PYMUNK_PROVENANCE
}

export interface PymunkStepOutputV1 {
  schemaVersion: 1
  dimension: 2
  operation: 'step'
  input: PymunkStepInputV1
  y: number
  snapshot: PymunkSnapshotV1
  provenance: typeof PYMUNK_PROVENANCE
}

export type PymunkOutputV1 = PymunkSnapshotOutputV1 | PymunkStepOutputV1
export type PymunkAdapterV1 = AwesomePhysicsAdapterV1<PymunkInputV1, PymunkOutputV1>
export type PymunkAdapterFactoryV1 = AwesomePhysicsAdapterFactoryV1<PymunkInputV1, PymunkOutputV1>

export interface PymunkWasmExportsV1 {
  __wasm_call_ctors?: () => void
  pymunk_version: () => number
  pymunk_step: (steps: number) => number
  pymunk_x: () => number
  pymunk_angle: () => number
  pymunk_steps: () => number
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
  if (byteLength > PYMUNK_BOUNDS.maximumInputBytes) {
    fail(path, `exceeds the ${PYMUNK_BOUNDS.maximumInputBytes}-byte input limit`)
  }
  return byteLength
}

function boundedStepCount(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) fail(path, 'must be an integer')
  if (value < 0 || value > PYMUNK_BOUNDS.maximumStepsPerCall) {
    fail(path, `must be between 0 and ${PYMUNK_BOUNDS.maximumStepsPerCall}`)
  }
  return value
}

export function parsePymunkInput(value: unknown): PymunkInputV1 {
  inputByteLength(value, 'pymunk input')
  const input = record(value, 'pymunk input')
  if (input.operation === 'snapshot') {
    exactKeys(input, ['operation'], 'pymunk input')
    return { operation: 'snapshot' }
  }
  if (input.operation === 'step') {
    exactKeys(input, ['operation', 'steps'], 'pymunk input')
    return { operation: 'step', steps: boundedStepCount(input.steps, 'pymunk input.steps') }
  }
  fail('pymunk input.operation', 'must be snapshot or step')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  const error = signal.reason instanceof Error ? signal.reason : new Error('The pymunk operation was aborted')
  error.name = 'AbortError'
  throw error
}

function finiteSnapshotValue(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
  if (Math.abs(value) > PYMUNK_BOUNDS.maximumSnapshotAbsoluteValue) {
    fail(path, `must be within +/-${PYMUNK_BOUNDS.maximumSnapshotAbsoluteValue}`)
  }
  return value
}

function boundedOutput<T extends PymunkOutputV1>(value: T): T {
  const byteLength = new TextEncoder().encode(JSON.stringify(value)).byteLength
  if (byteLength > PYMUNK_BOUNDS.maximumOutputBytes) {
    throw new RangeError(`pymunk output exceeds the ${PYMUNK_BOUNDS.maximumOutputBytes}-byte output limit`)
  }
  return value
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-pymunk' || descriptor.title !== 'pymunk') {
    throw new TypeError('pymunk adapter requires the pymunk simulation descriptor')
  }
  if (descriptor.execution !== 'wasm') throw new TypeError('pymunk adapter requires WASM execution')
  if (descriptor.availability !== 'available' || descriptor.runnable !== true) {
    throw new TypeError('pymunk adapter requires an available runnable descriptor')
  }
  const adapterId = descriptor.adapterId ?? PYMUNK_ADAPTER_ID
  if (adapterId !== PYMUNK_ADAPTER_ID) throw new TypeError('pymunk descriptor adapterId is incompatible')
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

function verifiedArtifactRecord(): ArtifactRecordV1 {
  const record = artifactRecordById(PYMUNK_MANIFEST_ID)
  if (record === null) throw new Error('The pymunk WASM artifact manifest record is missing')
  if (record.status !== 'available') {
    throw new Error(`The pymunk WASM artifact manifest record is ${record.status}, not available`)
  }
  if (
    record.source.revision !== PYMUNK_SOURCE_REVISION
    || record.artifact.path !== PYMUNK_ARTIFACT_INTEGRITY.path
    || record.artifact.sha256 !== PYMUNK_ARTIFACT_INTEGRITY.sha256
    || record.artifact.byteSize !== PYMUNK_ARTIFACT_INTEGRITY.byteSize
  ) {
    throw new Error('The pymunk WASM artifact manifest record does not match the verified artifact')
  }
  return record
}

function createWasmImports() {
  return {
    env: {
      _abort_js() {
        throw new Error('pymunk WASM aborted')
      },
      emscripten_resize_heap() {
        return 0
      },
    },
    wasi_snapshot_preview1: {
      fd_close() {
        return 0
      },
      fd_seek() {
        return 0
      },
      fd_write() {
        return 0
      },
    },
  }
}

function requireWasmExports(value: WebAssembly.Exports): PymunkWasmExportsV1 {
  const exports = value as unknown as Partial<PymunkWasmExportsV1>
  if (
    typeof exports.pymunk_version !== 'function'
    || typeof exports.pymunk_step !== 'function'
    || typeof exports.pymunk_x !== 'function'
    || typeof exports.pymunk_angle !== 'function'
    || typeof exports.pymunk_steps !== 'function'
  ) {
    throw new Error('The pymunk WASM module does not expose the verified Chipmunk ABI')
  }
  return exports as PymunkWasmExportsV1
}

export async function instantiatePymunkModule(module: WebAssembly.Module): Promise<PymunkWasmExportsV1> {
  const instance = await WebAssembly.instantiate(module, createWasmImports())
  const exports = requireWasmExports(instance.exports)
  exports.__wasm_call_ctors?.()
  return exports
}

function snapshotFromStep(exports: PymunkWasmExportsV1, y: number, expectedSteps: number): PymunkSnapshotV1 {
  const snapshot = {
    x: finiteSnapshotValue(exports.pymunk_x(), 'pymunk output.snapshot.x'),
    y: finiteSnapshotValue(y, 'pymunk output.snapshot.y'),
    angle: finiteSnapshotValue(exports.pymunk_angle(), 'pymunk output.snapshot.angle'),
    steps: finiteSnapshotValue(exports.pymunk_steps(), 'pymunk output.snapshot.steps'),
  }
  if (!Number.isInteger(snapshot.steps) || snapshot.steps !== expectedSteps) {
    throw new Error('pymunk WASM returned an unexpected step count')
  }
  return snapshot
}

async function runPymunk(input: PymunkInputV1, signal: AbortSignal, descriptorSignal: AbortSignal): Promise<PymunkOutputV1> {
  throwIfAborted(descriptorSignal)
  throwIfAborted(signal)
  const record = verifiedArtifactRecord()
  throwIfAborted(signal)
  const module = await loadVerifiedWasmArtifact(record, {
    maxBytes: Math.min(record.runtime.maxArtifactBytes, PYMUNK_BOUNDS.maximumArtifactBytes),
    signal,
  })
  throwIfAborted(signal)
  const exports = await instantiatePymunkModule(module)
  throwIfAborted(signal)
  const steps = input.operation === 'snapshot' ? 0 : input.steps
  const y = finiteSnapshotValue(exports.pymunk_step(steps), 'pymunk output.y')
  const snapshot = snapshotFromStep(exports, y, steps)
  if (input.operation === 'snapshot') {
    return boundedOutput({
      schemaVersion: 1,
      dimension: 2,
      operation: 'snapshot',
      input,
      snapshot,
      provenance: PYMUNK_PROVENANCE,
    })
  }
  return boundedOutput({
    schemaVersion: 1,
    dimension: 2,
    operation: 'step',
    input,
    y,
    snapshot,
    provenance: PYMUNK_PROVENANCE,
  })
}

export const createPymunkAdapter: PymunkAdapterFactoryV1 = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    async run(input, runSignal) {
      throwIfAborted(signal)
      throwIfAborted(runSignal)
      const parsedInput = parsePymunkInput(input)
      return runPymunk(parsedInput, runSignal ?? signal, signal)
    },
  }
}

export const createPymunkAdapterFactory = createPymunkAdapter
export const pymunkAdapterFactory = createPymunkAdapter

