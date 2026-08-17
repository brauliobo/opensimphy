import { artifactRecordById } from '../../artifactManifest'
import type { ArtifactRecordV1 } from '../../artifactManifest'
import {
  loadVerifiedCompanionJavaScript,
  loadVerifiedWasmArtifact,
} from '../../wasmArtifactLoader'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const NPHYSICS2D_ADAPTER_ID = 'awesome-nphysics2d-wasm'
export const NPHYSICS2D_MANIFEST_ID = 'nphysics'
export const NPHYSICS2D_SOURCE_REVISION = '65aa85c5470a5da85e0c13652ce58400ae2e2201'
export const NPHYSICS2D_IMPLEMENTATION_REVISION = 'nphysics2d-wasm-bindgen-module-worker-v1'
export const NPHYSICS2D_OUTPUT_REVISION = 'nphysics2d-worker-output-v1'

export const NPHYSICS2D_ARTIFACT_INTEGRITY = Object.freeze({
  wasm: Object.freeze({
    path: 'wasm/awesomePhysics/nphysics/nphysics2d_worker_probe.wasm',
    sha256: 'ac0450e94ecf9a6f56e3b097734af646e8ba298dab77a3ad285a88f5726047e1',
    byteSize: 367036,
  }),
  javascript: Object.freeze({
    path: 'wasm/awesomePhysics/nphysics/nphysics2d_worker_probe.js',
    sha256: '364889e36d2218a7da8fcd55e1c4c97b227ceb68b4dfcf840b1d934c6b96bc26',
    byteSize: 12916,
  }),
})

export const NPHYSICS2D_BOUNDS = Object.freeze({
  maximumStepsPerCall: 600,
  maximumTotalSteps: 6000,
  maximumArtifactBytes: 4 * 1024 * 1024,
  maximumOutputBytes: 4096,
  maximumSnapshotAbsoluteValue: 1_000_000,
})

export const NPHYSICS2D_PROVENANCE = Object.freeze({
  source: 'nphysics',
  sourceRevision: NPHYSICS2D_SOURCE_REVISION,
  implementationRevision: NPHYSICS2D_IMPLEMENTATION_REVISION,
  execution: 'verified-local-wasm-bindgen-module-worker',
  license: 'Apache-2.0',
  validatesTheory: false,
  doesNotEstablish: 'A finite nphysics2d fixture result is not a validation of a physical theory, model, or experimental result.',
  artifact: NPHYSICS2D_ARTIFACT_INTEGRITY,
})

export interface Nphysics2dSnapshotInputV1 {
  operation: 'snapshot'
}

export interface Nphysics2dStepInputV1 {
  operation: 'step'
  steps: number
}

export type Nphysics2dInputV1 = Nphysics2dSnapshotInputV1 | Nphysics2dStepInputV1

export interface Nphysics2dSnapshotV1 {
  x: number
  y: number
  angle: number
  steps: number
}

export interface Nphysics2dSnapshotOutputV1 {
  schemaVersion: 1
  dimension: 2
  operation: 'snapshot'
  input: Nphysics2dSnapshotInputV1
  snapshot: Nphysics2dSnapshotV1
  provenance: typeof NPHYSICS2D_PROVENANCE
}

export interface Nphysics2dStepOutputV1 {
  schemaVersion: 1
  dimension: 2
  operation: 'step'
  input: Nphysics2dStepInputV1
  y: number
  snapshot: Nphysics2dSnapshotV1
  provenance: typeof NPHYSICS2D_PROVENANCE
}

export type Nphysics2dOutputV1 = Nphysics2dSnapshotOutputV1 | Nphysics2dStepOutputV1
export type Nphysics2dAdapterV1 = AwesomePhysicsAdapterV1<Nphysics2dInputV1, Nphysics2dOutputV1>
export type Nphysics2dAdapterFactoryV1 = AwesomePhysicsAdapterFactoryV1<Nphysics2dInputV1, Nphysics2dOutputV1>

export interface Nphysics2dWasmLoadOptions {
  fetch?: typeof globalThis.fetch
  basePath?: string
  maxBytes?: number
}

interface Nphysics2dWorld {
  snapshot: () => Float32Array
  step: (steps: number) => number
  free: () => void
}

interface Nphysics2dCompanion {
  World2d: new () => Nphysics2dWorld
  initSync: (options: { module: WebAssembly.Module }) => unknown
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
  if (value < 0 || value > NPHYSICS2D_BOUNDS.maximumStepsPerCall) {
    fail(path, `must be between 0 and ${NPHYSICS2D_BOUNDS.maximumStepsPerCall}`)
  }
  return value
}

export function parseNphysics2dInput(value: unknown): Nphysics2dInputV1 {
  const input = record(value, 'nphysics2d input')
  if (input.operation === 'snapshot') {
    exactKeys(input, ['operation'], 'nphysics2d input')
    return { operation: 'snapshot' }
  }
  if (input.operation === 'step') {
    exactKeys(input, ['operation', 'steps'], 'nphysics2d input')
    return { operation: 'step', steps: boundedStepCount(input.steps, 'nphysics2d input.steps') }
  }
  fail('nphysics2d input.operation', 'must be snapshot or step')
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return
  const error = signal.reason instanceof Error ? signal.reason : new Error('The nphysics2d operation was aborted')
  error.name = 'AbortError'
  throw error
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
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-nphysics' || descriptor.title !== 'nphysics') {
    throw new TypeError('nphysics2d adapter requires the nphysics simulation descriptor')
  }
  if (descriptor.execution !== 'wasm') throw new TypeError('nphysics2d adapter requires WASM execution')
  if (descriptor.availability !== 'available' || descriptor.runnable !== true) {
    throw new TypeError('nphysics2d adapter requires an available runnable descriptor')
  }
  if (descriptor.sourceRevision !== NPHYSICS2D_SOURCE_REVISION) {
    throw new TypeError('nphysics2d descriptor sourceRevision is incompatible')
  }
  if (descriptor.implementationRevision !== NPHYSICS2D_IMPLEMENTATION_REVISION) {
    throw new TypeError('nphysics2d descriptor implementationRevision is incompatible')
  }
  if (descriptor.inputSchema !== 'nphysics2d-input-v1' || descriptor.outputSchema !== 'nphysics2d-output-v1') {
    throw new TypeError('nphysics2d descriptor schema revisions are incompatible')
  }
  const adapterId = descriptor.adapterId ?? NPHYSICS2D_ADAPTER_ID
  if (adapterId !== NPHYSICS2D_ADAPTER_ID) throw new TypeError('nphysics2d descriptor adapterId is incompatible')
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
  artifact: {
    path: string
    sha256: string
    byteSize: number
    companion: { path: string; sha256: string; byteSize: number }
  }
} {
  if (record.id !== NPHYSICS2D_MANIFEST_ID || record.project !== 'nphysics') {
    throw new Error('nphysics2d requires the central nphysics manifest record')
  }
  if (record.status !== 'available') throw new Error(`nphysics2d manifest record is ${record.status}, not available`)
  if (record.licenseGate.status !== 'pass') throw new Error('nphysics2d manifest license gate is not passing')
  if (record.output.artifactKind !== 'wasm-module') throw new Error('nphysics2d manifest must declare a wasm-module output')
  if (record.source.revision !== NPHYSICS2D_SOURCE_REVISION) throw new Error('nphysics2d manifest source revision is incompatible')
  if (!record.evidenceRefs.includes('public/wasm/awesomePhysics/nphysics/NOTICE.md')) {
    throw new Error('nphysics2d manifest must retain its public notice evidence')
  }
  const artifact = record.artifact
  const companion = artifact.companion
  if (
    artifact.path !== NPHYSICS2D_ARTIFACT_INTEGRITY.wasm.path
    || artifact.sha256 !== NPHYSICS2D_ARTIFACT_INTEGRITY.wasm.sha256
    || artifact.byteSize !== NPHYSICS2D_ARTIFACT_INTEGRITY.wasm.byteSize
    || companion?.path !== NPHYSICS2D_ARTIFACT_INTEGRITY.javascript.path
    || companion.sha256 !== NPHYSICS2D_ARTIFACT_INTEGRITY.javascript.sha256
    || companion.byteSize !== NPHYSICS2D_ARTIFACT_INTEGRITY.javascript.byteSize
  ) {
    throw new Error('nphysics2d manifest integrity does not match the verified 2D pair')
  }
}

function finiteSnapshotValue(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be finite')
  if (Math.abs(value) > NPHYSICS2D_BOUNDS.maximumSnapshotAbsoluteValue) {
    fail(path, `must be within +/-${NPHYSICS2D_BOUNDS.maximumSnapshotAbsoluteValue}`)
  }
  return value
}

function snapshotFromWorld(world: Nphysics2dWorld, expectedSteps: number): Nphysics2dSnapshotV1 {
  const values = world.snapshot()
  if (!(values instanceof Float32Array) || values.length !== 4) {
    throw new Error('nphysics2d WASM returned an invalid snapshot vector')
  }
  const snapshot = {
    x: finiteSnapshotValue(values[0], 'nphysics2d output.snapshot.x'),
    y: finiteSnapshotValue(values[1], 'nphysics2d output.snapshot.y'),
    angle: finiteSnapshotValue(values[2], 'nphysics2d output.snapshot.angle'),
    steps: finiteSnapshotValue(values[3], 'nphysics2d output.snapshot.steps'),
  }
  if (!Number.isInteger(snapshot.steps) || snapshot.steps !== expectedSteps) {
    throw new Error('nphysics2d WASM returned an unexpected cumulative step count')
  }
  return snapshot
}

function boundedOutput<T extends Nphysics2dOutputV1>(output: T): T {
  const json = JSON.stringify(output)
  if (json === undefined || new TextEncoder().encode(json).byteLength > NPHYSICS2D_BOUNDS.maximumOutputBytes) {
    throw new Error(`nphysics2d output exceeds the ${NPHYSICS2D_BOUNDS.maximumOutputBytes}-byte limit`)
  }
  return output
}

async function importVerifiedCompanion(
  bytes: Uint8Array,
  module: WebAssembly.Module,
): Promise<Nphysics2dCompanion> {
  if (typeof Blob !== 'function' || typeof globalThis.URL?.createObjectURL !== 'function') {
    throw new Error('nphysics2d companion Blob URL loading is unavailable')
  }
  const url = globalThis.URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'text/javascript' }))
  try {
    const imported = await import(/* @vite-ignore */ url) as Partial<Nphysics2dCompanion>
    if (typeof imported.World2d !== 'function' || typeof imported.initSync !== 'function') {
      throw new Error('nphysics2d companion does not expose the verified module ABI')
    }
    imported.initSync({ module })
    return imported as Nphysics2dCompanion
  } finally {
    globalThis.URL.revokeObjectURL(url)
  }
}

async function initializeWorld(
  artifactRecord: ArtifactRecordV1,
  options: Nphysics2dWasmLoadOptions,
  signal: AbortSignal | undefined,
): Promise<Nphysics2dWorld> {
  const loaderOptions = {
    fetch: options.fetch,
    basePath: options.basePath,
    maxBytes: Math.min(options.maxBytes ?? NPHYSICS2D_BOUNDS.maximumArtifactBytes, NPHYSICS2D_BOUNDS.maximumArtifactBytes),
    signal,
  }
  const companionBytes = await loadVerifiedCompanionJavaScript(artifactRecord, loaderOptions)
  throwIfAborted(signal)
  const module = await loadVerifiedWasmArtifact(artifactRecord, loaderOptions)
  throwIfAborted(signal)
  const companion = await importVerifiedCompanion(companionBytes, module)
  throwIfAborted(signal)
  return new companion.World2d()
}

export function createNphysics2dAdapterFromRecord(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
  artifactRecord: ArtifactRecordV1,
  options: Nphysics2dWasmLoadOptions = {},
): Nphysics2dAdapterV1 {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  assertArtifactRecord(artifactRecord)

  let worldPromise: Promise<Nphysics2dWorld> | undefined
  let totalSteps = 0
  const world = (operationSignal: AbortSignal | undefined): Promise<Nphysics2dWorld> => {
    if (worldPromise === undefined) worldPromise = initializeWorld(artifactRecord, options, operationSignal)
    return worldPromise
  }

  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    async run(value, runSignal) {
      throwIfAborted(signal)
      throwIfAborted(runSignal)
      const input = parseNphysics2dInput(value)
      const linked = linkedSignals(signal, runSignal)
      try {
        const instance = await world(linked.signal)
        throwIfAborted(linked.signal)
        if (input.operation === 'snapshot') {
          return boundedOutput({
            schemaVersion: 1,
            dimension: 2,
            operation: 'snapshot',
            input,
            snapshot: snapshotFromWorld(instance, totalSteps),
            provenance: NPHYSICS2D_PROVENANCE,
          })
        }
        if (totalSteps + input.steps > NPHYSICS2D_BOUNDS.maximumTotalSteps) {
          throw new RangeError(`nphysics2d total steps exceeds ${NPHYSICS2D_BOUNDS.maximumTotalSteps}`)
        }
        const y = instance.step(input.steps)
        totalSteps += input.steps
        const finiteY = finiteSnapshotValue(y, 'nphysics2d output.y')
        return boundedOutput({
          schemaVersion: 1,
          dimension: 2,
          operation: 'step',
          input,
          y: finiteY,
          snapshot: snapshotFromWorld(instance, totalSteps),
          provenance: NPHYSICS2D_PROVENANCE,
        })
      } finally {
        linked.dispose()
      }
    },
  }
}

export const createNphysics2dAdapterFactory: Nphysics2dAdapterFactoryV1 = (descriptor, signal) => {
  const artifactRecord = artifactRecordById(NPHYSICS2D_MANIFEST_ID)
  if (artifactRecord === null) throw new Error('nphysics2d has no central manifest record')
  return createNphysics2dAdapterFromRecord(descriptor, signal, artifactRecord)
}

export const nphysics2dAdapterFactory = createNphysics2dAdapterFactory
