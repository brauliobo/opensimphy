import { artifactRecordById } from '../../artifactManifest'
import type { ArtifactRecordV1 } from '../../artifactManifest'
import { instantiateVerifiedWasm } from '../../wasm/runtime'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const CANTERA_ADAPTER_ID = 'awesome-cantera-wasm'
export const CANTERA_MANIFEST_ID = 'cantera'
export const CANTERA_SOURCE_REVISION = '11a2381011cb6d42e61cc4c195e0f920864bf8d3'
export const CANTERA_IMPLEMENTATION_REVISION = 'cantera-h2o2-zerod-wasm-v1'
export const CANTERA_OUTPUT_REVISION = 'cantera-h2o2-zerod-output-v1'

export const CANTERA_ARTIFACT_INTEGRITY = Object.freeze({
  wasm: Object.freeze({
    path: 'wasm/awesomePhysics/cantera/cantera.wasm',
    sha256: 'f09ed0cdef7892938820208ca94a4940d58d2466ecf1e4b428b046ed4c2ac2e9',
    byteSize: 3220251,
  }),
  javascript: Object.freeze({
    path: 'wasm/awesomePhysics/cantera/cantera.js',
    sha256: 'd4aa7a5ded8cfb70abc178de1f30e3c12a2c75998a8afbef97d48c6d68de0a61',
    byteSize: 380,
  }),
})

export const CANTERA_BOUNDS = Object.freeze({
  minimumTemperatureK: 200,
  maximumTemperatureK: 3000,
  minimumPressurePa: 1_000,
  maximumPressurePa: 10_000_000,
  minimumTimeS: 0,
  maximumTimeS: 0.01,
  maximumInputBytes: 1024,
  maximumOutputBytes: 4096,
  maximumArtifactBytes: 64 * 1024 * 1024,
  maximumOutputAbsoluteValue: 1e12,
})

export const CANTERA_PROVENANCE = Object.freeze({
  source: 'cantera',
  sourceRevision: CANTERA_SOURCE_REVISION,
  implementationRevision: CANTERA_IMPLEMENTATION_REVISION,
  execution: 'verified-local-standalone-wasm',
  license: 'BSD-3-Clause with government notices',
  validatesTheory: false,
  doesNotEstablish: 'A finite Cantera fixture result is not a validation of a physical theory, model, or experimental result.',
  artifact: CANTERA_ARTIFACT_INTEGRITY,
})

export interface CanteraThermoInputV1 {
  operation: 'thermo'
  temperatureK: number
  pressurePa: number
}

export interface CanteraEquilibrateInputV1 {
  operation: 'equilibrate-hp'
  temperatureK: number
  pressurePa: number
}

export interface CanteraReactorInputV1 {
  operation: 'reactor'
  temperatureK: number
  pressurePa: number
  timeS: number
}

export type CanteraInputV1 = CanteraThermoInputV1 | CanteraEquilibrateInputV1 | CanteraReactorInputV1

export interface CanteraThermoOutputV1 {
  schemaVersion: 1
  operation: 'thermo'
  input: CanteraThermoInputV1
  enthalpyMass: number
  cpMass: number
  density: number
  temperatureK: number
  pressurePa: number
  units: { enthalpyMass: 'J/kg'; cpMass: 'J/kg/K'; density: 'kg/m^3'; temperatureK: 'K'; pressurePa: 'Pa' }
  provenance: typeof CANTERA_PROVENANCE
}

export interface CanteraEquilibrateOutputV1 {
  schemaVersion: 1
  operation: 'equilibrate-hp'
  input: CanteraEquilibrateInputV1
  temperatureK: number
  enthalpyMass: number
  density: number
  pressurePa: number
  units: { temperatureK: 'K'; enthalpyMass: 'J/kg'; density: 'kg/m^3'; pressurePa: 'Pa' }
  provenance: typeof CANTERA_PROVENANCE
}

export interface CanteraReactorOutputV1 {
  schemaVersion: 1
  operation: 'reactor'
  input: CanteraReactorInputV1
  temperatureK: number
  enthalpyMass: number
  moleFractionOH: number
  timeS: number
  units: { temperatureK: 'K'; enthalpyMass: 'J/kg'; moleFractionOH: '1'; timeS: 's' }
  provenance: typeof CANTERA_PROVENANCE
}

export type CanteraOutputV1 = CanteraThermoOutputV1 | CanteraEquilibrateOutputV1 | CanteraReactorOutputV1
export type CanteraAdapterV1 = AwesomePhysicsAdapterV1<CanteraInputV1, CanteraOutputV1>
export type CanteraAdapterFactoryV1 = AwesomePhysicsAdapterFactoryV1<CanteraInputV1, CanteraOutputV1>

export interface CanteraWasmExportsV1 {
  _initialize?: () => void
  __wasm_call_ctors?: () => void
  cantera_run: (op: number, temperature: number, pressure: number, time: number) => number
  cantera_out: (index: number) => number
  cantera_status: () => number
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

function finiteNumber(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
  if (value < minimum || value > maximum) fail(path, `must be between ${minimum} and ${maximum}`)
  return value
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
  if (byteLength > CANTERA_BOUNDS.maximumInputBytes) {
    fail(path, `exceeds the ${CANTERA_BOUNDS.maximumInputBytes}-byte input limit`)
  }
  return byteLength
}

function parseTemperaturePressure(input: Record<string, unknown>, extra: readonly string[]): {
  temperatureK: number
  pressurePa: number
} {
  exactKeys(input, ['operation', 'temperatureK', 'pressurePa', ...extra], 'Cantera input')
  return {
    temperatureK: finiteNumber(input.temperatureK, 'Cantera input.temperatureK', CANTERA_BOUNDS.minimumTemperatureK, CANTERA_BOUNDS.maximumTemperatureK),
    pressurePa: finiteNumber(input.pressurePa, 'Cantera input.pressurePa', CANTERA_BOUNDS.minimumPressurePa, CANTERA_BOUNDS.maximumPressurePa),
  }
}

export function parseCanteraInput(value: unknown): CanteraInputV1 {
  inputByteLength(value, 'Cantera input')
  const input = record(value, 'Cantera input')
  if (input.operation === 'thermo') {
    return { operation: 'thermo', ...parseTemperaturePressure(input, []) }
  }
  if (input.operation === 'equilibrate-hp') {
    return { operation: 'equilibrate-hp', ...parseTemperaturePressure(input, []) }
  }
  if (input.operation === 'reactor') {
    const state = parseTemperaturePressure(input, ['timeS'])
    return {
      operation: 'reactor',
      ...state,
      timeS: finiteNumber(input.timeS, 'Cantera input.timeS', CANTERA_BOUNDS.minimumTimeS, CANTERA_BOUNDS.maximumTimeS),
    }
  }
  fail('Cantera input.operation', 'must be thermo, equilibrate-hp, or reactor')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  const error = signal.reason instanceof Error ? signal.reason : new Error('The Cantera operation was aborted')
  error.name = 'AbortError'
  throw error
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-cantera' || descriptor.title !== 'cantera') {
    throw new TypeError('Cantera adapter requires the cantera simulation descriptor')
  }
  if (descriptor.execution !== 'wasm') throw new TypeError('Cantera adapter requires WASM execution')
  const adapterId = descriptor.adapterId ?? CANTERA_ADAPTER_ID
  if (adapterId !== CANTERA_ADAPTER_ID) throw new TypeError('Cantera descriptor adapterId is incompatible')
  if (descriptor.sourceRevision !== CANTERA_SOURCE_REVISION) {
    throw new TypeError('Cantera descriptor sourceRevision is incompatible')
  }
  if (descriptor.implementationRevision !== CANTERA_IMPLEMENTATION_REVISION) {
    throw new TypeError('Cantera descriptor implementationRevision is incompatible')
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

function verifiedArtifactRecord(): ArtifactRecordV1 {
  const record = artifactRecordById(CANTERA_MANIFEST_ID)
  if (record === null) throw new Error('Cantera has no central manifest record')
  if (record.status !== 'available') {
    throw new Error(`Cantera requires an available manifest record; ${record.id} is ${record.status}`)
  }
  if (record.licenseGate.status !== 'pass') throw new Error('Cantera manifest license gate is not passing')
  if (record.output.artifactKind !== 'wasm-module') throw new Error('Cantera manifest must declare a wasm-module output')
  if (record.source.revision !== CANTERA_SOURCE_REVISION) throw new Error('Cantera manifest source revision is incompatible')
  const artifact = record.artifact
  const companion = artifact.companion
  if (
    CANTERA_ARTIFACT_INTEGRITY.wasm.byteSize < 1
    || artifact.path !== CANTERA_ARTIFACT_INTEGRITY.wasm.path
    || artifact.sha256 !== CANTERA_ARTIFACT_INTEGRITY.wasm.sha256
    || artifact.byteSize !== CANTERA_ARTIFACT_INTEGRITY.wasm.byteSize
    || companion?.path !== CANTERA_ARTIFACT_INTEGRITY.javascript.path
    || companion.sha256 !== CANTERA_ARTIFACT_INTEGRITY.javascript.sha256
    || companion.byteSize !== CANTERA_ARTIFACT_INTEGRITY.javascript.byteSize
  ) {
    throw new Error('Cantera manifest integrity does not match the verified pair')
  }
  return record
}

function finiteScalar(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be finite')
  if (Math.abs(value) > CANTERA_BOUNDS.maximumOutputAbsoluteValue) {
    fail(path, `must be within +/-${CANTERA_BOUNDS.maximumOutputAbsoluteValue}`)
  }
  return value
}

function boundedOutput<T extends CanteraOutputV1>(output: T): T {
  const json = JSON.stringify(output)
  if (json === undefined || new TextEncoder().encode(json).byteLength > CANTERA_BOUNDS.maximumOutputBytes) {
    throw new Error(`Cantera output exceeds the ${CANTERA_BOUNDS.maximumOutputBytes}-byte limit`)
  }
  return output
}

function createWasmImports(): WebAssembly.Imports {
  const nop = () => 0
  return {
    env: {
      emscripten_notify_memory_growth: nop,
      emscripten_resize_heap() {
        return 0
      },
      _abort_js() {
        throw new Error('Cantera WASM aborted')
      },
    },
    wasi_snapshot_preview1: {
      fd_close: nop,
      fd_seek: nop,
      fd_write: nop,
      fd_read: nop,
      fd_fdstat_get: nop,
      environ_get: nop,
      environ_sizes_get: nop,
      clock_time_get: nop,
      random_get: nop,
      proc_exit() {
        throw new Error('Cantera WASM proc_exit')
      },
    },
  }
}

function requireWasmExports(value: WebAssembly.Exports): CanteraWasmExportsV1 {
  const exports = value as unknown as Partial<CanteraWasmExportsV1>
  if (typeof exports.cantera_run !== 'function' || typeof exports.cantera_out !== 'function' || typeof exports.cantera_status !== 'function') {
    throw new Error('The Cantera WASM module does not expose the verified scalar ABI')
  }
  return exports as CanteraWasmExportsV1
}

export async function instantiateCanteraModule(module: WebAssembly.Module): Promise<CanteraWasmExportsV1> {
  const declared = createWasmImports()
  const imports: WebAssembly.Imports = {}
  for (const entry of WebAssembly.Module.imports(module)) {
    const moduleImports: WebAssembly.ModuleImports = imports[entry.module] ?? {}
    const table = declared[entry.module] as Record<string, WebAssembly.ImportValue> | undefined
    imports[entry.module] = moduleImports
    moduleImports[entry.name] = table?.[entry.name] ?? (() => 0)
  }
  const instance = await WebAssembly.instantiate(module, imports)
  const exports = requireWasmExports(instance.exports)
  exports._initialize?.()
  exports.__wasm_call_ctors?.()
  return exports
}

async function runCantera(input: CanteraInputV1, signal: AbortSignal, descriptorSignal: AbortSignal): Promise<CanteraOutputV1> {
  throwIfAborted(descriptorSignal)
  throwIfAborted(signal)
  const record = verifiedArtifactRecord()
  throwIfAborted(signal)
  const loaded = await instantiateVerifiedWasm(record, {
    maxBytes: Math.min(record.runtime.maxArtifactBytes, CANTERA_BOUNDS.maximumArtifactBytes),
    signal,
    runtimeKind: 'emscripten',
    imports: createWasmImports(),
  })
  throwIfAborted(signal)
  if (loaded.companionBytes === null) throw new Error('Cantera companion JavaScript was not verified')
  const exports = requireWasmExports(loaded.instance.exports)
  exports._initialize?.()
  exports.__wasm_call_ctors?.()
  throwIfAborted(signal)

  const opcode = input.operation === 'thermo' ? 0 : input.operation === 'equilibrate-hp' ? 1 : 2
  const time = input.operation === 'reactor' ? input.timeS : 0
  const ok = exports.cantera_run(opcode, input.temperatureK, input.pressurePa, time)
  if (ok !== 1) throw new Error(`Cantera WASM rejected the ${input.operation} request`)

  if (input.operation === 'thermo') {
    return boundedOutput({
      schemaVersion: 1,
      operation: 'thermo',
      input,
      enthalpyMass: finiteScalar(exports.cantera_out(0), 'Cantera output.enthalpyMass'),
      cpMass: finiteScalar(exports.cantera_out(1), 'Cantera output.cpMass'),
      density: finiteScalar(exports.cantera_out(2), 'Cantera output.density'),
      temperatureK: finiteScalar(exports.cantera_out(3), 'Cantera output.temperatureK'),
      pressurePa: finiteScalar(exports.cantera_out(4), 'Cantera output.pressurePa'),
      units: { enthalpyMass: 'J/kg', cpMass: 'J/kg/K', density: 'kg/m^3', temperatureK: 'K', pressurePa: 'Pa' },
      provenance: CANTERA_PROVENANCE,
    })
  }
  if (input.operation === 'equilibrate-hp') {
    const temperatureK = finiteScalar(exports.cantera_out(0), 'Cantera output.temperatureK')
    if (temperatureK <= input.temperatureK) throw new Error('Cantera HP equilibrium temperature must increase for this mixture')
    return boundedOutput({
      schemaVersion: 1,
      operation: 'equilibrate-hp',
      input,
      temperatureK,
      enthalpyMass: finiteScalar(exports.cantera_out(1), 'Cantera output.enthalpyMass'),
      density: finiteScalar(exports.cantera_out(2), 'Cantera output.density'),
      pressurePa: finiteScalar(exports.cantera_out(3), 'Cantera output.pressurePa'),
      units: { temperatureK: 'K', enthalpyMass: 'J/kg', density: 'kg/m^3', pressurePa: 'Pa' },
      provenance: CANTERA_PROVENANCE,
    })
  }
  return boundedOutput({
    schemaVersion: 1,
    operation: 'reactor',
    input,
    temperatureK: finiteScalar(exports.cantera_out(0), 'Cantera output.temperatureK'),
    enthalpyMass: finiteScalar(exports.cantera_out(1), 'Cantera output.enthalpyMass'),
    moleFractionOH: finiteScalar(exports.cantera_out(2), 'Cantera output.moleFractionOH'),
    timeS: finiteScalar(exports.cantera_out(3), 'Cantera output.timeS'),
    units: { temperatureK: 'K', enthalpyMass: 'J/kg', moleFractionOH: '1', timeS: 's' },
    provenance: CANTERA_PROVENANCE,
  })
}

export const createCanteraAdapter: CanteraAdapterFactoryV1 = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    async run(input, runSignal) {
      throwIfAborted(signal)
      throwIfAborted(runSignal)
      const parsedInput = parseCanteraInput(input)
      return runCantera(parsedInput, runSignal ?? signal, signal)
    },
  }
}

export const createCanteraAdapterFactory = createCanteraAdapter
export const canteraAdapterFactory = createCanteraAdapter
