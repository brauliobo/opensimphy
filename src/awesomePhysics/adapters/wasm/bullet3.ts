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

export const BULLET3_ADAPTER_ID = 'awesome-bullet3-wasm'
export const BULLET3_MANIFEST_ID = 'bullet3'
export const BULLET3_SOURCE_REVISION = '63c4d67e337017f9d8b298c900e9aabdb69296e7'
export const BULLET3_IMPLEMENTATION_REVISION = 'bullet3-headless-scalar-wasm-v1'
export const BULLET3_OUTPUT_REVISION = 'bullet3-headless-scalar-output-v1'
export const BULLET3_ARTIFACT_INTEGRITY = Object.freeze({
  path: 'wasm/awesomePhysics/bullet3/bullet3.wasm',
  sha256: '1f255bb36e7c7a4f14a03cccfb95f13a39fdf50a9c2b2259faa1048e0473b425',
  byteSize: 333983,
})

export const BULLET3_BOUNDS = Object.freeze({
  maximumInputBytes: 1024,
  maximumOutputBytes: 4096,
  maximumArtifactBytes: 1_048_576,
  maximumOutputAbsoluteValue: 1_000_000,
})

export const BULLET3_PROVENANCE = Object.freeze({
  source: 'Bullet3',
  sourceRevision: BULLET3_SOURCE_REVISION,
  implementationRevision: BULLET3_IMPLEMENTATION_REVISION,
  execution: 'verified-local-raw-wasm',
  license: 'zlib',
  validatesTheory: false,
  doesNotEstablish: 'A finite Bullet3 fixture result is not a validation of a physical theory, model, or experimental result.',
  artifact: BULLET3_ARTIFACT_INTEGRITY,
})

export interface Bullet3VersionInputV1 {
  operation: 'version'
}

export interface Bullet3StepInputV1 {
  operation: 'step'
}

export type Bullet3InputV1 = Bullet3VersionInputV1 | Bullet3StepInputV1

export interface Bullet3VersionOutputV1 {
  schemaVersion: 1
  operation: 'version'
  version: number
  value: number
  provenance: typeof BULLET3_PROVENANCE
}

export interface Bullet3StepOutputV1 {
  schemaVersion: 1
  operation: 'step'
  y: number
  value: number
  units: 'world-units'
  provenance: typeof BULLET3_PROVENANCE
}

export type Bullet3OutputV1 = Bullet3VersionOutputV1 | Bullet3StepOutputV1
export type Bullet3AdapterV1 = AwesomePhysicsAdapterV1<Bullet3InputV1, Bullet3OutputV1>
export type Bullet3AdapterFactoryV1 = AwesomePhysicsAdapterFactoryV1<Bullet3InputV1, Bullet3OutputV1>

export interface Bullet3WasmExportsV1 {
  __wasm_call_ctors: () => void
  bullet_version: () => number
  bullet_step: () => number
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
  if (byteLength > BULLET3_BOUNDS.maximumInputBytes) {
    fail(path, `exceeds the ${BULLET3_BOUNDS.maximumInputBytes}-byte input limit`)
  }
  return byteLength
}

function parseBullet3Input(value: unknown): Bullet3InputV1 {
  inputByteLength(value, 'Bullet3 input')
  const input = record(value, 'Bullet3 input')
  if (input.operation === 'version') {
    exactKeys(input, ['operation'], 'Bullet3 input')
    return { operation: 'version' }
  }
  if (input.operation === 'step') {
    exactKeys(input, ['operation'], 'Bullet3 input')
    return { operation: 'step' }
  }
  fail('Bullet3 input.operation', 'must be version or step')
}

export { parseBullet3Input }

function finiteScalar(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
  if (Math.abs(value) > BULLET3_BOUNDS.maximumOutputAbsoluteValue) {
    fail(path, `must be within +/-${BULLET3_BOUNDS.maximumOutputAbsoluteValue}`)
  }
  return value
}

function boundedOutput<T extends Bullet3OutputV1>(value: T): T {
  const byteLength = new TextEncoder().encode(JSON.stringify(value)).byteLength
  if (byteLength > BULLET3_BOUNDS.maximumOutputBytes) {
    throw new RangeError(`Bullet3 output exceeds the ${BULLET3_BOUNDS.maximumOutputBytes}-byte output limit`)
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
  throwIfAborted(signal, 'The Bullet3 operation was aborted')
  if (descriptor.catalogItemId !== 'awesome-bullet3' || descriptor.title !== 'bullet3') {
    throw new TypeError('Bullet3 adapter requires the Bullet3 simulation descriptor')
  }
  if (descriptor.execution !== 'wasm') throw new TypeError('Bullet3 adapter requires WASM execution')
  if (descriptor.availability !== 'available' || descriptor.runnable !== true) {
    throw new TypeError('Bullet3 adapter requires an available runnable descriptor')
  }
  const adapterId = descriptor.adapterId ?? BULLET3_ADAPTER_ID
  if (adapterId !== BULLET3_ADAPTER_ID) throw new TypeError('Bullet3 descriptor adapterId is incompatible')
  return {
    adapterId,
    compatibility: {
      contentRevision: safeRevision(descriptor.contentRevision, 'Bullet3 descriptor.contentRevision'),
      modelRevision: safeRevision(descriptor.modelRevision, 'Bullet3 descriptor.modelRevision'),
      implementationRevision: safeRevision(descriptor.implementationRevision, 'Bullet3 descriptor.implementationRevision'),
      outputRevision: safeRevision(descriptor.outputRevision, 'Bullet3 descriptor.outputRevision'),
    },
  }
}

function verifiedArtifactRecord(): ArtifactRecordV1 {
  const record = artifactRecordById(BULLET3_MANIFEST_ID)
  if (record === null) throw new Error('The Bullet3 WASM artifact manifest record is missing')
  if (record.status !== 'available') {
    throw new Error(`The Bullet3 WASM artifact manifest record is ${record.status}, not available`)
  }
  if (
    record.source.revision !== BULLET3_SOURCE_REVISION
    || record.artifact.path !== BULLET3_ARTIFACT_INTEGRITY.path
    || record.artifact.sha256 !== BULLET3_ARTIFACT_INTEGRITY.sha256
    || record.artifact.byteSize !== BULLET3_ARTIFACT_INTEGRITY.byteSize
  ) {
    throw new Error('The Bullet3 WASM artifact manifest record does not match the verified artifact')
  }
  return record
}

function createWasmImports() {
  return {
    env: {
      _abort_js() {
        throw new Error('Bullet3 WASM aborted')
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

function requireWasmExports(value: WebAssembly.Exports): Bullet3WasmExportsV1 {
  const exports = value as unknown as Partial<Bullet3WasmExportsV1>
  if (
    typeof exports.__wasm_call_ctors !== 'function'
    || typeof exports.bullet_version !== 'function'
    || typeof exports.bullet_step !== 'function'
  ) {
    throw new Error('The Bullet3 WASM module does not expose the verified scalar ABI')
  }
  return exports as Bullet3WasmExportsV1
}

export async function instantiateBullet3Module(module: WebAssembly.Module): Promise<Bullet3WasmExportsV1> {
  const instance = await WebAssembly.instantiate(module, createWasmImports())
  const exports = requireWasmExports(instance.exports)
  exports.__wasm_call_ctors()
  return exports
}

async function runBullet3(input: Bullet3InputV1, signal: AbortSignal, descriptorSignal: AbortSignal): Promise<Bullet3OutputV1> {
  throwIfAborted(descriptorSignal, 'The Bullet3 operation was aborted')
  throwIfAborted(signal, 'The Bullet3 operation was aborted')
  const record = verifiedArtifactRecord()
  throwIfAborted(signal, 'The Bullet3 operation was aborted')
  const module = await loadVerifiedWasmArtifact(record, {
    maxBytes: Math.min(record.runtime.maxArtifactBytes, BULLET3_BOUNDS.maximumArtifactBytes),
    signal,
  })
  throwIfAborted(signal, 'The Bullet3 operation was aborted')
  const exports = await instantiateBullet3Module(module)
  throwIfAborted(signal, 'The Bullet3 operation was aborted')

  if (input.operation === 'version') {
    const version = finiteScalar(exports.bullet_version(), 'Bullet3 output.version')
    if (!Number.isSafeInteger(version)) throw new Error('Bullet3 output.version must be a safe integer')
    return boundedOutput({
      schemaVersion: 1,
      operation: input.operation,
      version,
      value: version,
      provenance: BULLET3_PROVENANCE,
    })
  }

  const y = finiteScalar(exports.bullet_step(), 'Bullet3 output.y')
  return boundedOutput({
    schemaVersion: 1,
    operation: input.operation,
    y,
    value: y,
    units: 'world-units',
    provenance: BULLET3_PROVENANCE,
  })
}

export const createBullet3Adapter: Bullet3AdapterFactoryV1 = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    async run(input, runSignal) {
      throwIfAborted(signal, 'The Bullet3 operation was aborted')
      throwIfAborted(runSignal, 'The Bullet3 operation was aborted')
      const parsedInput = parseBullet3Input(input)
      return runBullet3(parsedInput, runSignal ?? signal, signal)
    },
  }
}

export const createBullet3AdapterFactory = createBullet3Adapter
export const bullet3AdapterFactory = createBullet3Adapter
