import { artifactRecordById } from '../../artifactManifest'
import type { ArtifactRecordV1 } from '../../artifactManifest'
import { loadVerifiedWasmArtifact } from '../../wasmArtifactLoader'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const NEWTON_ADAPTER_ID = 'awesome-newton-dynamics-wasm'
export const NEWTON_MANIFEST_ID = 'newton-dynamics'
export const NEWTON_SOURCE_REVISION = 'a9c460c3509c935e65c5b1196b955d56627c3ffa'
export const NEWTON_IMPLEMENTATION_REVISION = 'newton-dynamics-headless-scalar-wasm-v1'
export const NEWTON_OUTPUT_REVISION = 'newton-dynamics-headless-scalar-output-v1'
export const NEWTON_ARTIFACT_INTEGRITY = Object.freeze({
  path: 'wasm/awesomePhysics/newton-dynamics/newton-dynamics.wasm',
  sha256: 'a78e1d46238dbb218f48ce3818082a6db9b8ef492f02085c8df182fa611c58a9',
  byteSize: 362424,
})

export const NEWTON_BOUNDS = Object.freeze({
  maximumInputBytes: 1024,
  maximumOutputBytes: 4096,
  maximumArtifactBytes: 1_048_576,
  maximumOutputAbsoluteValue: 1_000_000,
})

export const NEWTON_PROVENANCE = Object.freeze({
  source: 'newton-dynamics',
  sourceRevision: NEWTON_SOURCE_REVISION,
  implementationRevision: NEWTON_IMPLEMENTATION_REVISION,
  execution: 'verified-local-raw-wasm',
  license: 'zlib',
  validatesTheory: false,
  doesNotEstablish: 'A finite Newton fixture result is not a validation of a physical theory, model, or experimental result.',
  artifact: NEWTON_ARTIFACT_INTEGRITY,
})

export interface NewtonVersionInputV1 {
  operation: 'version'
}

export interface NewtonStepInputV1 {
  operation: 'step'
}

export type NewtonInputV1 = NewtonVersionInputV1 | NewtonStepInputV1

export interface NewtonVersionOutputV1 {
  schemaVersion: 1
  operation: 'version'
  version: number
  value: number
  provenance: typeof NEWTON_PROVENANCE
}

export interface NewtonStepOutputV1 {
  schemaVersion: 1
  operation: 'step'
  y: number
  value: number
  units: 'world-units'
  provenance: typeof NEWTON_PROVENANCE
}

export type NewtonOutputV1 = NewtonVersionOutputV1 | NewtonStepOutputV1
export type NewtonAdapterV1 = AwesomePhysicsAdapterV1<NewtonInputV1, NewtonOutputV1>
export type NewtonAdapterFactoryV1 = AwesomePhysicsAdapterFactoryV1<NewtonInputV1, NewtonOutputV1>

export interface NewtonWasmExportsV1 {
  __wasm_call_ctors: () => void
  newton_version: () => number
  newton_step: () => number
  memory: WebAssembly.Memory
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
  if (byteLength > NEWTON_BOUNDS.maximumInputBytes) {
    fail(path, `exceeds the ${NEWTON_BOUNDS.maximumInputBytes}-byte input limit`)
  }
  return byteLength
}

function parseNewtonInput(value: unknown): NewtonInputV1 {
  inputByteLength(value, 'Newton input')
  const input = record(value, 'Newton input')
  if (input.operation === 'version') {
    exactKeys(input, ['operation'], 'Newton input')
    return { operation: 'version' }
  }
  if (input.operation === 'step') {
    exactKeys(input, ['operation'], 'Newton input')
    return { operation: 'step' }
  }
  fail('Newton input.operation', 'must be version or step')
}

export { parseNewtonInput }

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  const error = signal.reason instanceof Error ? signal.reason : new Error('The Newton operation was aborted')
  error.name = 'AbortError'
  throw error
}

function finiteScalar(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
  if (Math.abs(value) > NEWTON_BOUNDS.maximumOutputAbsoluteValue) {
    fail(path, `must be within +/-${NEWTON_BOUNDS.maximumOutputAbsoluteValue}`)
  }
  return value
}

function boundedOutput<T extends NewtonOutputV1>(value: T): T {
  const byteLength = new TextEncoder().encode(JSON.stringify(value)).byteLength
  if (byteLength > NEWTON_BOUNDS.maximumOutputBytes) {
    throw new RangeError(`Newton output exceeds the ${NEWTON_BOUNDS.maximumOutputBytes}-byte output limit`)
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
  if (descriptor.catalogItemId !== 'awesome-newton-dynamics' || descriptor.title !== 'newton-dynamics') {
    throw new TypeError('Newton adapter requires the newton-dynamics simulation descriptor')
  }
  if (descriptor.execution !== 'wasm') throw new TypeError('Newton adapter requires WASM execution')
  if (descriptor.availability !== 'available' || descriptor.runnable !== true) {
    throw new TypeError('Newton adapter requires an available runnable descriptor')
  }
  const adapterId = descriptor.adapterId ?? NEWTON_ADAPTER_ID
  if (adapterId !== NEWTON_ADAPTER_ID) throw new TypeError('Newton descriptor adapterId is incompatible')
  return {
    adapterId,
    compatibility: {
      contentRevision: safeRevision(descriptor.contentRevision, 'Newton descriptor.contentRevision'),
      modelRevision: safeRevision(descriptor.modelRevision, 'Newton descriptor.modelRevision'),
      implementationRevision: safeRevision(descriptor.implementationRevision, 'Newton descriptor.implementationRevision'),
      outputRevision: safeRevision(descriptor.outputRevision, 'Newton descriptor.outputRevision'),
    },
  }
}

function verifiedArtifactRecord(): ArtifactRecordV1 {
  const record = artifactRecordById(NEWTON_MANIFEST_ID)
  if (record === null) throw new Error('The Newton WASM artifact manifest record is missing')
  if (record.status !== 'available') {
    throw new Error(`The Newton WASM artifact manifest record is ${record.status}, not available`)
  }
  if (
    record.source.revision !== NEWTON_SOURCE_REVISION
    || record.artifact.path !== NEWTON_ARTIFACT_INTEGRITY.path
    || record.artifact.sha256 !== NEWTON_ARTIFACT_INTEGRITY.sha256
    || record.artifact.byteSize !== NEWTON_ARTIFACT_INTEGRITY.byteSize
  ) {
    throw new Error('The Newton WASM artifact manifest record does not match the verified artifact')
  }
  return record
}

function createWasmImports(): {
  imports: WebAssembly.Imports
  memoryBox: { memory: WebAssembly.Memory | null }
} {
  const memoryBox: { memory: WebAssembly.Memory | null } = { memory: null }
  return {
    memoryBox,
    imports: {
    env: {
      _abort_js() {
        throw new Error('Newton WASM aborted')
      },
      emscripten_resize_heap() {
        return 0
      },
      emscripten_date_now() {
        return Date.now()
      },
      emscripten_get_now() {
        return performance.now()
      },
      exit(status: number) {
        throw new Error(`Newton WASM exit ${status}`)
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
      clock_time_get(_clockId: number, _precision: number, timePtr: number) {
        if (memoryBox.memory !== null) {
          const ns = BigInt(Date.now()) * 1_000_000n
          new DataView(memoryBox.memory.buffer).setBigUint64(timePtr, ns, true)
        }
        return 0
      },
    },
    },
  }
}

function requireWasmExports(value: WebAssembly.Exports): NewtonWasmExportsV1 {
  const exports = value as unknown as Partial<NewtonWasmExportsV1>
  if (
    typeof exports.__wasm_call_ctors !== 'function'
    || typeof exports.newton_version !== 'function'
    || typeof exports.newton_step !== 'function'
    || !(exports.memory instanceof WebAssembly.Memory)
  ) {
    throw new Error('The Newton WASM module does not expose the verified scalar ABI')
  }
  return exports as NewtonWasmExportsV1
}

export async function instantiateNewtonModule(module: WebAssembly.Module): Promise<NewtonWasmExportsV1> {
  const { imports, memoryBox } = createWasmImports()
  const instance = await WebAssembly.instantiate(module, imports)
  const exports = requireWasmExports(instance.exports)
  memoryBox.memory = exports.memory
  exports.__wasm_call_ctors()
  return exports
}

async function runNewton(input: NewtonInputV1, signal: AbortSignal, descriptorSignal: AbortSignal): Promise<NewtonOutputV1> {
  throwIfAborted(descriptorSignal)
  throwIfAborted(signal)
  const record = verifiedArtifactRecord()
  throwIfAborted(signal)
  const module = await loadVerifiedWasmArtifact(record, {
    maxBytes: Math.min(record.runtime.maxArtifactBytes, NEWTON_BOUNDS.maximumArtifactBytes),
    signal,
  })
  throwIfAborted(signal)
  const exports = await instantiateNewtonModule(module)
  throwIfAborted(signal)

  if (input.operation === 'version') {
    const version = finiteScalar(exports.newton_version(), 'Newton output.version')
    if (!Number.isSafeInteger(version)) throw new Error('Newton output.version must be a safe integer')
    return boundedOutput({
      schemaVersion: 1,
      operation: input.operation,
      version,
      value: version,
      provenance: NEWTON_PROVENANCE,
    })
  }

  const y = finiteScalar(exports.newton_step(), 'Newton output.y')
  return boundedOutput({
    schemaVersion: 1,
    operation: input.operation,
    y,
    value: y,
    units: 'world-units',
    provenance: NEWTON_PROVENANCE,
  })
}

export const createNewtonAdapter: NewtonAdapterFactoryV1 = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    async run(input, runSignal) {
      throwIfAborted(signal)
      throwIfAborted(runSignal)
      const parsedInput = parseNewtonInput(input)
      return runNewton(parsedInput, runSignal ?? signal, signal)
    },
  }
}

export const createNewtonDynamicsAdapterFactory = createNewtonAdapter
export const newtonDynamicsAdapterFactory = createNewtonAdapter
