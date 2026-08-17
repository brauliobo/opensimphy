import { artifactRecordById } from '../../artifactManifest'
import type { ArtifactRecordV1 } from '../../artifactManifest'
import { loadVerifiedWasmArtifact } from '../../wasmArtifactLoader'
import { fail, jsonRecord as record, exactKeys, throwIfAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const PHYSX_ADAPTER_ID = 'awesome-physx-3-4-wasm'
export const PHYSX_MANIFEST_ID = 'physx-3-4'
export const PHYSX_SOURCE_REVISION = '5e42a5f112351a223c19c17bb331e6c55037b8eb'
export const PHYSX_IMPLEMENTATION_REVISION = 'physx-3-4-headless-scalar-wasm-v1'
export const PHYSX_OUTPUT_REVISION = 'physx-3-4-headless-scalar-output-v1'
export const PHYSX_ARTIFACT_INTEGRITY = Object.freeze({
  path: 'wasm/awesomePhysics/physx/physx-3-4.wasm',
  sha256: '1741e6d6e3030fe3ffd3d1160bc2f1d3ce5d52a503ad216788bf9a07322acdfc',
  byteSize: 1833037,
})

export const PHYSX_BOUNDS = Object.freeze({
  maximumInputBytes: 1024,
  maximumOutputBytes: 4096,
  maximumArtifactBytes: 4_194_304,
  maximumOutputAbsoluteValue: 1_000_000,
})

export const PHYSX_PROVENANCE = Object.freeze({
  source: 'PhysX-3.4',
  sourceRevision: PHYSX_SOURCE_REVISION,
  implementationRevision: PHYSX_IMPLEMENTATION_REVISION,
  execution: 'verified-local-raw-wasm',
  license: 'NVIDIA BSD-style',
  validatesTheory: false,
  doesNotEstablish: 'A finite PhysX fixture result is not a validation of a physical theory, model, or experimental result.',
  artifact: PHYSX_ARTIFACT_INTEGRITY,
})

export interface PhysxVersionInputV1 {
  operation: 'version'
}

export interface PhysxStepInputV1 {
  operation: 'step'
}

export type PhysxInputV1 = PhysxVersionInputV1 | PhysxStepInputV1

export interface PhysxVersionOutputV1 {
  schemaVersion: 1
  operation: 'version'
  version: number
  value: number
  provenance: typeof PHYSX_PROVENANCE
}

export interface PhysxStepOutputV1 {
  schemaVersion: 1
  operation: 'step'
  y: number
  value: number
  units: 'world-units'
  provenance: typeof PHYSX_PROVENANCE
}

export type PhysxOutputV1 = PhysxVersionOutputV1 | PhysxStepOutputV1
export type PhysxAdapterV1 = AwesomePhysicsAdapterV1<PhysxInputV1, PhysxOutputV1>
export type PhysxAdapterFactoryV1 = AwesomePhysicsAdapterFactoryV1<PhysxInputV1, PhysxOutputV1>

export interface PhysxWasmExportsV1 {
  __wasm_call_ctors: () => void
  physx_version: () => number
  physx_step: () => number
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
  if (byteLength > PHYSX_BOUNDS.maximumInputBytes) {
    fail(path, `exceeds the ${PHYSX_BOUNDS.maximumInputBytes}-byte input limit`)
  }
  return byteLength
}

function parsePhysxInput(value: unknown): PhysxInputV1 {
  inputByteLength(value, 'PhysX input')
  const input = record(value, 'PhysX input')
  if (input.operation === 'version') {
    exactKeys(input, ['operation'], 'PhysX input')
    return { operation: 'version' }
  }
  if (input.operation === 'step') {
    exactKeys(input, ['operation'], 'PhysX input')
    return { operation: 'step' }
  }
  fail('PhysX input.operation', 'must be version or step')
}

export { parsePhysxInput }

function finiteScalar(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
  if (Math.abs(value) > PHYSX_BOUNDS.maximumOutputAbsoluteValue) {
    fail(path, `must be within +/-${PHYSX_BOUNDS.maximumOutputAbsoluteValue}`)
  }
  return value
}

function boundedOutput<T extends PhysxOutputV1>(value: T): T {
  const byteLength = new TextEncoder().encode(JSON.stringify(value)).byteLength
  if (byteLength > PHYSX_BOUNDS.maximumOutputBytes) {
    throw new RangeError(`PhysX output exceeds the ${PHYSX_BOUNDS.maximumOutputBytes}-byte output limit`)
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
  throwIfAborted(signal, 'The PhysX operation was aborted')
  if (descriptor.catalogItemId !== 'awesome-physx-3-4' || descriptor.title !== 'PhysX') {
    throw new TypeError('PhysX adapter requires the PhysX-3.4 simulation descriptor')
  }
  if (descriptor.execution !== 'wasm') throw new TypeError('PhysX adapter requires WASM execution')
  if (descriptor.availability !== 'available' || descriptor.runnable !== true) {
    throw new TypeError('PhysX adapter requires an available runnable descriptor')
  }
  const adapterId = descriptor.adapterId ?? PHYSX_ADAPTER_ID
  if (adapterId !== PHYSX_ADAPTER_ID) throw new TypeError('PhysX descriptor adapterId is incompatible')
  return {
    adapterId,
    compatibility: {
      contentRevision: safeRevision(descriptor.contentRevision, 'PhysX descriptor.contentRevision'),
      modelRevision: safeRevision(descriptor.modelRevision, 'PhysX descriptor.modelRevision'),
      implementationRevision: safeRevision(descriptor.implementationRevision, 'PhysX descriptor.implementationRevision'),
      outputRevision: safeRevision(descriptor.outputRevision, 'PhysX descriptor.outputRevision'),
    },
  }
}

function verifiedArtifactRecord(): ArtifactRecordV1 {
  const record = artifactRecordById(PHYSX_MANIFEST_ID)
  if (record === null) throw new Error('The PhysX WASM artifact manifest record is missing')
  if (record.status !== 'available') {
    throw new Error(`The PhysX WASM artifact manifest record is ${record.status}, not available`)
  }
  if (
    record.source.revision !== PHYSX_SOURCE_REVISION
    || record.artifact.path !== PHYSX_ARTIFACT_INTEGRITY.path
    || record.artifact.sha256 !== PHYSX_ARTIFACT_INTEGRITY.sha256
    || record.artifact.byteSize !== PHYSX_ARTIFACT_INTEGRITY.byteSize
  ) {
    throw new Error('The PhysX WASM artifact manifest record does not match the verified artifact')
  }
  return record
}

function createWasmImports() {
  return {
    env: {
      _abort_js() {
        throw new Error('PhysX WASM aborted')
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
        throw new Error(`PhysX WASM exit ${status}`)
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

function requireWasmExports(value: WebAssembly.Exports): PhysxWasmExportsV1 {
  const exports = value as unknown as Partial<PhysxWasmExportsV1>
  if (
    typeof exports.__wasm_call_ctors !== 'function'
    || typeof exports.physx_version !== 'function'
    || typeof exports.physx_step !== 'function'
  ) {
    throw new Error('The PhysX WASM module does not expose the verified scalar ABI')
  }
  return exports as PhysxWasmExportsV1
}

export async function instantiatePhysxModule(module: WebAssembly.Module): Promise<PhysxWasmExportsV1> {
  const instance = await WebAssembly.instantiate(module, createWasmImports())
  const exports = requireWasmExports(instance.exports)
  exports.__wasm_call_ctors()
  return exports
}

async function runPhysx(input: PhysxInputV1, signal: AbortSignal, descriptorSignal: AbortSignal): Promise<PhysxOutputV1> {
  throwIfAborted(descriptorSignal, 'The PhysX operation was aborted')
  throwIfAborted(signal, 'The PhysX operation was aborted')
  const record = verifiedArtifactRecord()
  throwIfAborted(signal, 'The PhysX operation was aborted')
  const module = await loadVerifiedWasmArtifact(record, {
    maxBytes: Math.min(record.runtime.maxArtifactBytes, PHYSX_BOUNDS.maximumArtifactBytes),
    signal,
  })
  throwIfAborted(signal, 'The PhysX operation was aborted')
  const exports = await instantiatePhysxModule(module)
  throwIfAborted(signal, 'The PhysX operation was aborted')

  if (input.operation === 'version') {
    const version = finiteScalar(exports.physx_version(), 'PhysX output.version')
    if (!Number.isSafeInteger(version)) throw new Error('PhysX output.version must be a safe integer')
    return boundedOutput({
      schemaVersion: 1,
      operation: input.operation,
      version,
      value: version,
      provenance: PHYSX_PROVENANCE,
    })
  }

  const y = finiteScalar(exports.physx_step(), 'PhysX output.y')
  return boundedOutput({
    schemaVersion: 1,
    operation: input.operation,
    y,
    value: y,
    units: 'world-units',
    provenance: PHYSX_PROVENANCE,
  })
}

export const createPhysxAdapter: PhysxAdapterFactoryV1 = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    async run(input, runSignal) {
      throwIfAborted(signal, 'The PhysX operation was aborted')
      throwIfAborted(runSignal, 'The PhysX operation was aborted')
      const parsedInput = parsePhysxInput(input)
      return runPhysx(parsedInput, runSignal ?? signal, signal)
    },
  }
}

export const createPhysxAdapterFactory = createPhysxAdapter
export const physxAdapterFactory = createPhysxAdapter
