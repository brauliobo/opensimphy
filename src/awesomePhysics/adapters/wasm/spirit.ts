import { artifactRecordById } from '../../artifactManifest'
import type { ArtifactRecordV1 } from '../../artifactManifest'
import { loadVerifiedWasmArtifact } from '../../wasmArtifactLoader'
import { fail, jsonRecord as record, exactKeys, boundedNumber, requireSafeIntegerBetween, throwIfAborted, throwIfAnyAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const SPIRIT_ADAPTER_ID = 'awesome-spirit-wasm'
export const SPIRIT_MANIFEST_ID = 'spirit-headless'
export const SPIRIT_SOURCE_REVISION = 'e82250d3b14411c2c2fa292d143f13e3e111ad8c'
export const SPIRIT_IMPLEMENTATION_REVISION = 'spirit-llg-heun-headless-v1'
export const SPIRIT_OUTPUT_REVISION = 'spirit-llg-heun-output-v1'

export const SPIRIT_ARTIFACT_INTEGRITY = Object.freeze({
  path: 'wasm/awesomePhysics/spirit/spirit-llg-heun.wasm',
  sha256: '34a942b98bfed0d3cc1d27b731662b0315f23d2df1ed904133faa1038bdcd6a4',
  byteSize: 3821,
})

export const SPIRIT_BOUNDS = Object.freeze({
  spinCount: Object.freeze({ min: 1, max: 32 }),
  damping: Object.freeze({ min: 0, max: 1 }),
  timeStep: Object.freeze({ min: 1e-5, max: 0.05 }),
  steps: Object.freeze({ min: 1, max: 4000 }),
  field: Object.freeze({ min: -100, max: 100 }),
  exchange: Object.freeze({ min: -100, max: 100 }),
  spin: Object.freeze({ min: -1, max: 1 }),
  maximumArtifactBytes: 4 * 1024 * 1024,
  maximumOutputBytes: 4096,
  maximumOutputAbsoluteValue: 1_000_000,
})

export const SPIRIT_PROVENANCE = Object.freeze({
  source: 'spirit',
  sourceRevision: SPIRIT_SOURCE_REVISION,
  implementationRevision: SPIRIT_IMPLEMENTATION_REVISION,
  execution: 'verified-local-raw-wasm',
  license: 'MIT',
  validatesTheory: false,
  doesNotEstablish: 'A finite Heun LLG fixture result is not a validation of a physical theory, model, or experimental result.',
  artifact: SPIRIT_ARTIFACT_INTEGRITY,
})

export interface SpiritLlgHeunInputV1 {
  operation: 'llg-heun'
  spinCount: number
  damping: number
  timeStep: number
  steps: number
  field: { x: number; y: number; z: number }
  exchange: number
  initialSpin: { x: number; y: number; z: number }
}

export interface SpiritLlgHeunOutputV1 {
  schemaVersion: 1
  operation: 'llg-heun'
  input: SpiritLlgHeunInputV1
  status: 0 | 1
  solved: boolean
  magnetization: { x: number; y: number; z: number }
  energy: number
  simulatedTime: number
  spinNorm: number
  provenance: typeof SPIRIT_PROVENANCE
}

export type SpiritInputV1 = SpiritLlgHeunInputV1
export type SpiritOutputV1 = SpiritLlgHeunOutputV1
export type SpiritAdapterV1 = AwesomePhysicsAdapterV1<SpiritInputV1, SpiritOutputV1>
export type SpiritAdapterFactoryV1 = AwesomePhysicsAdapterFactoryV1<SpiritInputV1, SpiritOutputV1>

export interface SpiritWasmLoadOptions {
  fetch?: typeof globalThis.fetch
  basePath?: string
  maxBytes?: number
}

type SpiritWasmArguments = [number, number, number, number, number, number, number, number, number, number, number]

interface SpiritWasmExports {
  spirit_llg_status: (...args: SpiritWasmArguments) => number
  spirit_llg_mx: (...args: SpiritWasmArguments) => number
  spirit_llg_my: (...args: SpiritWasmArguments) => number
  spirit_llg_mz: (...args: SpiritWasmArguments) => number
  spirit_llg_energy: (...args: SpiritWasmArguments) => number
  spirit_llg_time: (...args: SpiritWasmArguments) => number
  spirit_llg_norm: (...args: SpiritWasmArguments) => number
}
function vec3(value: unknown, path: string, bounds: { min: number; max: number }): { x: number; y: number; z: number } {
  const vector = record(value, path)
  exactKeys(vector, ['x', 'y', 'z'], path)
  return {
    x: boundedNumber(vector.x, `${path}.x`, bounds.min, bounds.max),
    y: boundedNumber(vector.y, `${path}.y`, bounds.min, bounds.max),
    z: boundedNumber(vector.z, `${path}.z`, bounds.min, bounds.max),
  }
}

export function parseSpiritInput(value: unknown): SpiritInputV1 {
  const input = record(value, 'Spirit input')
  exactKeys(input, ['operation', 'spinCount', 'damping', 'timeStep', 'steps', 'field', 'exchange', 'initialSpin'], 'Spirit input')
  if (input.operation !== 'llg-heun') fail('Spirit input.operation', 'must be llg-heun')
  return {
    operation: 'llg-heun',
    spinCount: requireSafeIntegerBetween(input.spinCount, 'Spirit input.spinCount', SPIRIT_BOUNDS.spinCount.min, SPIRIT_BOUNDS.spinCount.max),
    damping: boundedNumber(input.damping, 'Spirit input.damping', SPIRIT_BOUNDS.damping.min, SPIRIT_BOUNDS.damping.max),
    timeStep: boundedNumber(input.timeStep, 'Spirit input.timeStep', SPIRIT_BOUNDS.timeStep.min, SPIRIT_BOUNDS.timeStep.max),
    steps: requireSafeIntegerBetween(input.steps, 'Spirit input.steps', SPIRIT_BOUNDS.steps.min, SPIRIT_BOUNDS.steps.max),
    field: vec3(input.field, 'Spirit input.field', SPIRIT_BOUNDS.field),
    exchange: boundedNumber(input.exchange, 'Spirit input.exchange', SPIRIT_BOUNDS.exchange.min, SPIRIT_BOUNDS.exchange.max),
    initialSpin: vec3(input.initialSpin, 'Spirit input.initialSpin', SPIRIT_BOUNDS.spin),
  }
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

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal, 'The Spirit operation was aborted')
  if (descriptor.catalogItemId !== 'awesome-spirit' || descriptor.title !== 'spirit') {
    throw new TypeError('Spirit adapter requires the spirit simulation descriptor')
  }
  if (descriptor.execution !== 'wasm' && descriptor.execution !== 'wasm-candidate') {
    throw new TypeError('Spirit adapter requires WASM execution')
  }
  const adapterId = descriptor.adapterId ?? SPIRIT_ADAPTER_ID
  if (adapterId !== SPIRIT_ADAPTER_ID) throw new TypeError('Spirit descriptor adapterId is incompatible')
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
  if (record.id !== SPIRIT_MANIFEST_ID) {
    throw new Error(`Spirit requires the ${SPIRIT_MANIFEST_ID} manifest record`)
  }
  if (record.status !== 'available') {
    throw new Error(`Spirit requires an available manifest record; ${record.id} is ${record.status}`)
  }
  if (record.output.artifactKind !== 'wasm-module') {
    throw new Error('Spirit manifest record must declare a raw wasm-module output')
  }
  if (
    record.artifact.path !== SPIRIT_ARTIFACT_INTEGRITY.path
    || record.artifact.sha256 !== SPIRIT_ARTIFACT_INTEGRITY.sha256
    || record.artifact.byteSize !== SPIRIT_ARTIFACT_INTEGRITY.byteSize
  ) {
    throw new Error('Spirit manifest integrity does not match the verified artifact')
  }
}

function wasmExports(instance: WebAssembly.Instance): SpiritWasmExports {
  const exports = instance.exports as unknown as Record<string, unknown>
  const names = [
    'spirit_llg_status',
    'spirit_llg_mx',
    'spirit_llg_my',
    'spirit_llg_mz',
    'spirit_llg_energy',
    'spirit_llg_time',
    'spirit_llg_norm',
  ] as const
  for (const name of names) {
    if (typeof exports[name] !== 'function') throw new Error(`Spirit WASM export ${name} is unavailable`)
  }
  return exports as unknown as SpiritWasmExports
}

function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > SPIRIT_BOUNDS.maximumOutputAbsoluteValue) {
    throw new Error(`${path} is not a bounded finite result`)
  }
  return value
}

function wasmArguments(input: SpiritInputV1): SpiritWasmArguments {
  return [
    input.spinCount,
    input.damping,
    input.timeStep,
    input.steps,
    input.field.x,
    input.field.y,
    input.field.z,
    input.exchange,
    input.initialSpin.x,
    input.initialSpin.y,
    input.initialSpin.z,
  ]
}

export function createSpiritAdapterFromRecord(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
  artifactRecord: ArtifactRecordV1,
  options: SpiritWasmLoadOptions = {},
): SpiritAdapterV1 {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  assertArtifactRecord(artifactRecord)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    async run(value, runSignal) {
      throwIfAborted(signal, 'The Spirit operation was aborted')
      throwIfAborted(runSignal, 'The Spirit operation was aborted')
      const input = parseSpiritInput(value)
      const linked = linkedSignals(signal, runSignal)
      try {
        const module = await loadVerifiedWasmArtifact(artifactRecord, {
          fetch: options.fetch,
          basePath: options.basePath,
          maxBytes: options.maxBytes ?? SPIRIT_BOUNDS.maximumArtifactBytes,
          signal: linked.signal,
        })
        throwIfAborted(linked.signal, 'The Spirit operation was aborted')
        const instance = await WebAssembly.instantiate(module, {})
        throwIfAborted(linked.signal, 'The Spirit operation was aborted')
        const exports = wasmExports(instance)
        const args = wasmArguments(input)
        const status = exports.spirit_llg_status(...args)
        if ((status !== 0 && status !== 1) || !Number.isInteger(status)) {
          throw new Error('Spirit WASM returned an invalid status')
        }
        const magnetization = {
          x: finiteOutput(exports.spirit_llg_mx(...args), 'Spirit output.magnetization.x'),
          y: finiteOutput(exports.spirit_llg_my(...args), 'Spirit output.magnetization.y'),
          z: finiteOutput(exports.spirit_llg_mz(...args), 'Spirit output.magnetization.z'),
        }
        const energy = finiteOutput(exports.spirit_llg_energy(...args), 'Spirit output.energy')
        const simulatedTime = finiteOutput(exports.spirit_llg_time(...args), 'Spirit output.simulatedTime')
        const spinNorm = finiteOutput(exports.spirit_llg_norm(...args), 'Spirit output.spinNorm')
        const output: SpiritOutputV1 = {
          schemaVersion: 1,
          operation: 'llg-heun',
          input,
          status: status as 0 | 1,
          solved: status === 1,
          magnetization,
          energy,
          simulatedTime,
          spinNorm,
          provenance: SPIRIT_PROVENANCE,
        }
        const byteLength = new TextEncoder().encode(JSON.stringify(output)).byteLength
        if (byteLength > SPIRIT_BOUNDS.maximumOutputBytes) {
          throw new RangeError(`Spirit output exceeds the ${SPIRIT_BOUNDS.maximumOutputBytes}-byte output limit`)
        }
        return output
      } finally {
        linked.dispose()
      }
    },
  }
}

export const createSpiritAdapter: SpiritAdapterFactoryV1 = (descriptor, signal) => {
  const artifactRecord = artifactRecordById(SPIRIT_MANIFEST_ID)
  if (artifactRecord === null) {
    throw new Error('Spirit has no central manifest record; adapter registration is deferred')
  }
  return createSpiritAdapterFromRecord(descriptor, signal, artifactRecord)
}

export const createSpiritAdapterFactory = createSpiritAdapter
export const spiritAdapterFactory = createSpiritAdapter
