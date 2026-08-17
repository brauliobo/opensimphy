import { artifactRecordById } from '../../artifactManifest'
import type { ArtifactRecordV1 } from '../../artifactManifest'
import { loadVerifiedWasmArtifact } from '../../wasmArtifactLoader'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const FLUID_ENGINE_DEV_ADAPTER_ID = 'awesome-fluid-engine-dev-wasm'
export const FLUID_ENGINE_DEV_MANIFEST_ID = 'fluid-engine-dev'
export const FLUID_ENGINE_DEV_SOURCE_REVISION = '94c300ff5ad8a2f588e5e27e8e9746a424b29863'
export const FLUID_ENGINE_DEV_IMPLEMENTATION_REVISION = 'fluid-engine-dev-sph2-headless-wasm-v1'
export const FLUID_ENGINE_DEV_OUTPUT_REVISION = 'fluid-engine-dev-sph2-output-v1'
export const FLUID_ENGINE_DEV_ARTIFACT_INTEGRITY = Object.freeze({
  path: 'wasm/awesomePhysics/fluid-engine-dev/fluid-engine-dev.wasm',
  sha256: 'd8bdd5c4841ab009e0b008cacbee88660c09bf8906714c388decd548934e389e',
  byteSize: 230684,
})

export const FLUID_ENGINE_DEV_BOUNDS = Object.freeze({
  maximumStepsPerCall: 600,
  maximumInputBytes: 1024,
  maximumOutputBytes: 4096,
  maximumArtifactBytes: 4 * 1024 * 1024,
  maximumOutputAbsoluteValue: 1_000_000,
})

export const FLUID_ENGINE_DEV_PROVENANCE = Object.freeze({
  source: 'fluid-engine-dev',
  sourceRevision: FLUID_ENGINE_DEV_SOURCE_REVISION,
  implementationRevision: FLUID_ENGINE_DEV_IMPLEMENTATION_REVISION,
  execution: 'verified-local-raw-wasm',
  license: 'MIT',
  validatesTheory: false,
  doesNotEstablish: 'A finite Jet 2D SPH fixture is not a validation of a physical theory, model, or experimental result.',
  artifact: FLUID_ENGINE_DEV_ARTIFACT_INTEGRITY,
})

export interface FluidEngineDevStepInputV1 {
  operation: 'step'
  steps: number
}

export type FluidEngineDevInputV1 = FluidEngineDevStepInputV1

export interface FluidEngineDevStepOutputV1 {
  schemaVersion: 1
  operation: 'step'
  steps: number
  y: number
  value: number
  units: 'world-units'
  provenance: typeof FLUID_ENGINE_DEV_PROVENANCE
}

export type FluidEngineDevOutputV1 = FluidEngineDevStepOutputV1
export type FluidEngineDevAdapterV1 = AwesomePhysicsAdapterV1<FluidEngineDevInputV1, FluidEngineDevOutputV1>
export type FluidEngineDevAdapterFactoryV1 = AwesomePhysicsAdapterFactoryV1<FluidEngineDevInputV1, FluidEngineDevOutputV1>

interface FluidEngineDevWasmExportsV1 {
  memory: WebAssembly.Memory
  jet_sph2_step: (steps: number) => number
  _initialize: () => void
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

function boundedStepCount(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) fail(path, 'must be an integer')
  if (value < 0 || value > FLUID_ENGINE_DEV_BOUNDS.maximumStepsPerCall) {
    fail(path, `must be between 0 and ${FLUID_ENGINE_DEV_BOUNDS.maximumStepsPerCall}`)
  }
  return value
}

export function parseFluidEngineDevInput(value: unknown): FluidEngineDevInputV1 {
  const json = JSON.stringify(value)
  if (new TextEncoder().encode(json).byteLength > FLUID_ENGINE_DEV_BOUNDS.maximumInputBytes) {
    fail('fluid-engine-dev input', `exceeds the ${FLUID_ENGINE_DEV_BOUNDS.maximumInputBytes}-byte input limit`)
  }
  const input = record(value, 'fluid-engine-dev input')
  if (input.operation !== 'step') fail('fluid-engine-dev input.operation', 'must be step')
  exactKeys(input, ['operation', 'steps'], 'fluid-engine-dev input')
  return { operation: 'step', steps: boundedStepCount(input.steps, 'fluid-engine-dev input.steps') }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  const error = signal.reason instanceof Error ? signal.reason : new Error('The fluid-engine-dev operation was aborted')
  error.name = 'AbortError'
  throw error
}

function finiteScalar(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
  if (Math.abs(value) > FLUID_ENGINE_DEV_BOUNDS.maximumOutputAbsoluteValue) {
    fail(path, `must be within +/-${FLUID_ENGINE_DEV_BOUNDS.maximumOutputAbsoluteValue}`)
  }
  return value
}

function createWasmImports(runtime: { memory: WebAssembly.Memory | null }) {
  const view = () => new DataView(runtime.memory!.buffer)
  const writeU32 = (ptr: number, value: number) => { view().setUint32(ptr, value, true) }
  const writeU64 = (ptr: number, value: number) => { view().setBigUint64(ptr, BigInt(value), true) }
  return {
    env: {
      emscripten_notify_memory_growth() { return 0 },
    },
    wasi_snapshot_preview1: {
      clock_time_get(_clock: number, _precision: bigint, ptr: number) {
        writeU64(ptr, 0)
        return 0
      },
      environ_sizes_get(countPtr: number, sizePtr: number) {
        writeU32(countPtr, 0)
        writeU32(sizePtr, 0)
        return 0
      },
      environ_get() { return 0 },
      fd_close() { return 0 },
      fd_seek() { return 0 },
      fd_write(_fd: number, iovs: number, iovsLen: number, nwrittenPtr: number) {
        let written = 0
        const bytes = view()
        for (let index = 0; index < iovsLen; index += 1) written += bytes.getUint32(iovs + index * 8 + 4, true)
        writeU32(nwrittenPtr, written)
        return 0
      },
      fd_read() { return 0 },
    },
  }
}

function verifiedArtifactRecord(): ArtifactRecordV1 {
  const record = artifactRecordById(FLUID_ENGINE_DEV_MANIFEST_ID)
  if (record === null) throw new Error('The fluid-engine-dev WASM artifact manifest record is missing')
  if (record.status !== 'available') {
    throw new Error(`The fluid-engine-dev WASM artifact manifest record is ${record.status}, not available`)
  }
  if (
    record.source.revision !== FLUID_ENGINE_DEV_SOURCE_REVISION
    || record.artifact.path !== FLUID_ENGINE_DEV_ARTIFACT_INTEGRITY.path
    || record.artifact.sha256 !== FLUID_ENGINE_DEV_ARTIFACT_INTEGRITY.sha256
    || record.artifact.byteSize !== FLUID_ENGINE_DEV_ARTIFACT_INTEGRITY.byteSize
  ) {
    throw new Error('The fluid-engine-dev WASM artifact manifest record does not match the verified artifact')
  }
  return record
}

export async function instantiateFluidEngineDevModule(module: WebAssembly.Module): Promise<FluidEngineDevWasmExportsV1> {
  const runtime = { memory: null as WebAssembly.Memory | null }
  const instance = await WebAssembly.instantiate(module, createWasmImports(runtime))
  const exports = instance.exports as unknown as Partial<FluidEngineDevWasmExportsV1>
  if (
    !(exports.memory instanceof WebAssembly.Memory)
    || typeof exports.jet_sph2_step !== 'function'
    || typeof exports._initialize !== 'function'
  ) {
    throw new Error('The fluid-engine-dev WASM module does not expose the verified SPH ABI')
  }
  runtime.memory = exports.memory
  exports._initialize()
  return exports as FluidEngineDevWasmExportsV1
}

async function runFluidEngineDev(input: FluidEngineDevInputV1, signal: AbortSignal, descriptorSignal: AbortSignal): Promise<FluidEngineDevOutputV1> {
  throwIfAborted(descriptorSignal)
  throwIfAborted(signal)
  const record = verifiedArtifactRecord()
  const module = await loadVerifiedWasmArtifact(record, {
    maxBytes: Math.min(record.runtime.maxArtifactBytes, FLUID_ENGINE_DEV_BOUNDS.maximumArtifactBytes),
    signal,
  })
  throwIfAborted(signal)
  const exports = await instantiateFluidEngineDevModule(module)
  throwIfAborted(signal)
  const y = finiteScalar(exports.jet_sph2_step(input.steps), 'fluid-engine-dev output.y')
  const output = {
    schemaVersion: 1 as const,
    operation: 'step' as const,
    steps: input.steps,
    y,
    value: y,
    units: 'world-units' as const,
    provenance: FLUID_ENGINE_DEV_PROVENANCE,
  }
  if (new TextEncoder().encode(JSON.stringify(output)).byteLength > FLUID_ENGINE_DEV_BOUNDS.maximumOutputBytes) {
    throw new RangeError(`fluid-engine-dev output exceeds the ${FLUID_ENGINE_DEV_BOUNDS.maximumOutputBytes}-byte output limit`)
  }
  return output
}

function compatibilityFor(descriptor: AwesomePhysicsSimulationDescriptorV1, signal: AbortSignal): {
  adapterId: string
  compatibility: AwesomePhysicsAdapterCompatibilityV1
} {
  if (descriptor.catalogItemId !== 'awesome-fluid-engine-dev' || descriptor.title !== 'fluid-engine-dev') {
    throw new TypeError('fluid-engine-dev adapter requires the fluid-engine-dev simulation descriptor')
  }
  if (descriptor.execution !== 'wasm') throw new TypeError('fluid-engine-dev adapter requires WASM execution')
  if (descriptor.availability !== 'available' || descriptor.runnable !== true) {
    throw new TypeError('fluid-engine-dev adapter requires an available runnable descriptor')
  }
  const adapterId = descriptor.adapterId
  if (adapterId !== FLUID_ENGINE_DEV_ADAPTER_ID) throw new TypeError('fluid-engine-dev descriptor adapterId is incompatible')
  throwIfAborted(signal)
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

export const createFluidEngineDevAdapter: FluidEngineDevAdapterFactoryV1 = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    async run(input, runSignal) {
      throwIfAborted(signal)
      throwIfAborted(runSignal)
      return runFluidEngineDev(parseFluidEngineDevInput(input), runSignal ?? signal, signal)
    },
  }
}

export const createFluidEngineDevAdapterFactory = createFluidEngineDevAdapter
export const fluidEngineDevAdapterFactory = createFluidEngineDevAdapter
