import { artifactRecordById } from '../../artifactManifest'
import type { ArtifactRecordV1 } from '../../artifactManifest'
import { instantiateVerifiedWasm } from '../../wasm/runtime'
import { fail, jsonRecord as record, exactKeys, finiteNumber, boundedNumber, throwIfAborted, throwIfAnyAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const GALPY_ADAPTER_ID = 'awesome-galpy-wasm'
export const GALPY_MANIFEST_ID = 'galpy'
export const GALPY_SOURCE_REVISION = '3762e73ef84578f4a911325d283e652eb1886625'
export const GALPY_IMPLEMENTATION_REVISION = 'galpy-mwpotential2014-leapfrog-wasm-v1'
export const GALPY_OUTPUT_REVISION = 'galpy-orbit-output-v1'

export const GALPY_ARTIFACT_INTEGRITY = Object.freeze({
  wasm: Object.freeze({
    path: 'wasm/awesomePhysics/galpy/galpy.wasm',
    sha256: '0e053c12eaa70b3bf771697505acaa049269c481c7d1f9ac363e8f5cf08f7720',
    byteSize: 19591,
  }),
  javascript: Object.freeze({
    path: 'wasm/awesomePhysics/galpy/galpy.js',
    sha256: 'becd50f707575c4e8ad3fb45c67e9e5ffcdfed57401a08c33b4169daad427696',
    byteSize: 594,
  }),
})

export const GALPY_BOUNDS = Object.freeze({
  maximumCoordinate: 100,
  minimumRadius: 1e-8,
  maximumSteps: 10_000,
  maximumSamples: 512,
  minimumTimeStep: 1e-8,
  maximumTimeStep: 0.1,
  maximumArtifactBytes: 67_108_864,
  maximumOutputBytes: 4_194_304,
  maximumEnergyDrift: 1e-3,
})

export const GALPY_PROVENANCE = Object.freeze({
  source: 'galpy',
  sourceRevision: GALPY_SOURCE_REVISION,
  implementationRevision: GALPY_IMPLEMENTATION_REVISION,
  execution: 'verified-local-standalone-wasm',
  license: 'BSD-3-Clause',
  validatesTheory: false,
  doesNotEstablish: 'A finite MWPotential2014 orbit is not a validation of a galactic mass model or observational result.',
  artifact: GALPY_ARTIFACT_INTEGRITY,
})

export interface GalpyIntegrateOrbitInputV1 {
  operation: 'integrate-orbit'
  R: number
  z: number
  phi: number
  vR: number
  vT: number
  vz: number
  timeStep: number
  steps: number
  sampleEvery: number
}

export interface GalpyCircularVelocityInputV1 {
  operation: 'circular-velocity'
  R: number
}

export type GalpyInputV1 = GalpyIntegrateOrbitInputV1 | GalpyCircularVelocityInputV1

export interface GalpyOrbitSampleV1 {
  step: number
  time: number
  R: number
  z: number
  phi: number
  vR: number
  vT: number
  vz: number
  energy: number
  Lz: number
}

export interface GalpyOrbitOutputV1 {
  schemaVersion: 1
  operation: 'integrate-orbit'
  model: 'mwpotential2014-orbit-v1'
  input: GalpyIntegrateOrbitInputV1
  samples: readonly GalpyOrbitSampleV1[]
  invariants: {
    energyStart: number
    energyEnd: number
    energyRelativeDrift: number
    LzStart: number
    LzEnd: number
    LzRelativeDrift: number
  }
  circularVelocityAtR0: number
  provenance: typeof GALPY_PROVENANCE
}

export interface GalpyCircularVelocityOutputV1 {
  schemaVersion: 1
  operation: 'circular-velocity'
  input: GalpyCircularVelocityInputV1
  value: number
  units: 'natural'
  provenance: typeof GALPY_PROVENANCE
}

export type GalpyOutputV1 = GalpyOrbitOutputV1 | GalpyCircularVelocityOutputV1
export type GalpyAdapterV1 = AwesomePhysicsAdapterV1<GalpyInputV1, GalpyOutputV1>
export type GalpyAdapterFactoryV1 = AwesomePhysicsAdapterFactoryV1<GalpyInputV1, GalpyOutputV1>

export interface GalpyWasmLoadOptions {
  fetch?: typeof globalThis.fetch
  basePath?: string
  maxBytes?: number
}

interface GalpyWasmExports {
  galpy_orbit_init: (R: number, z: number, phi: number, vR: number, vT: number, vz: number) => number
  galpy_orbit_step: (dt: number) => number
  galpy_orbit_R: () => number
  galpy_orbit_z: () => number
  galpy_orbit_phi: () => number
  galpy_orbit_vR: () => number
  galpy_orbit_vT: () => number
  galpy_orbit_vz: () => number
  galpy_orbit_energy: () => number
  galpy_orbit_Lz: () => number
  galpy_circular_velocity: (R: number) => number
}
function integerNumber(value: unknown, path: string, minimum: number, maximum: number): number {
  const number = boundedNumber(value, path, minimum, maximum)
  if (!Number.isInteger(number)) fail(path, 'must be an integer')
  return number
}

export function parseGalpyInput(value: unknown): GalpyInputV1 {
  const input = record(value, 'galpy input')
  if (input.operation === 'circular-velocity') {
    exactKeys(input, ['operation', 'R'], 'galpy input')
    return {
      operation: 'circular-velocity',
      R: boundedNumber(input.R, 'galpy input.R', GALPY_BOUNDS.minimumRadius, GALPY_BOUNDS.maximumCoordinate),
    }
  }
  if (input.operation === 'integrate-orbit') {
    exactKeys(input, ['operation', 'R', 'z', 'phi', 'vR', 'vT', 'vz', 'timeStep', 'steps', 'sampleEvery'], 'galpy input')
    const steps = integerNumber(input.steps, 'galpy input.steps', 1, GALPY_BOUNDS.maximumSteps)
    const sampleEvery = integerNumber(input.sampleEvery, 'galpy input.sampleEvery', 1, steps)
    const sampleCount = Math.floor(steps / sampleEvery) + 1
    if (sampleCount > GALPY_BOUNDS.maximumSamples) fail('galpy input.sampleEvery', `must keep samples at or below ${GALPY_BOUNDS.maximumSamples}`)
    return {
      operation: 'integrate-orbit',
      R: boundedNumber(input.R, 'galpy input.R', GALPY_BOUNDS.minimumRadius, GALPY_BOUNDS.maximumCoordinate),
      z: boundedNumber(input.z, 'galpy input.z', -GALPY_BOUNDS.maximumCoordinate, GALPY_BOUNDS.maximumCoordinate),
      phi: boundedNumber(input.phi, 'galpy input.phi', -GALPY_BOUNDS.maximumCoordinate, GALPY_BOUNDS.maximumCoordinate),
      vR: boundedNumber(input.vR, 'galpy input.vR', -GALPY_BOUNDS.maximumCoordinate, GALPY_BOUNDS.maximumCoordinate),
      vT: boundedNumber(input.vT, 'galpy input.vT', -GALPY_BOUNDS.maximumCoordinate, GALPY_BOUNDS.maximumCoordinate),
      vz: boundedNumber(input.vz, 'galpy input.vz', -GALPY_BOUNDS.maximumCoordinate, GALPY_BOUNDS.maximumCoordinate),
      timeStep: boundedNumber(input.timeStep, 'galpy input.timeStep', GALPY_BOUNDS.minimumTimeStep, GALPY_BOUNDS.maximumTimeStep),
      steps,
      sampleEvery,
    }
  }
  fail('galpy input.operation', 'must be integrate-orbit or circular-velocity')
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
  throwIfAborted(signal, 'The galpy operation was aborted')
  if (descriptor.catalogItemId !== 'awesome-galpy' || descriptor.title !== 'galpy') {
    throw new TypeError('galpy adapter requires the galpy simulation descriptor')
  }
  if (descriptor.execution !== 'wasm') throw new TypeError('galpy adapter requires WASM execution')
  const adapterId = descriptor.adapterId ?? GALPY_ADAPTER_ID
  if (adapterId !== GALPY_ADAPTER_ID) throw new TypeError('galpy descriptor adapterId is incompatible')
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
  if (record.id !== GALPY_MANIFEST_ID || record.project !== 'galpy') {
    throw new Error('galpy requires the central galpy manifest record')
  }
  if (record.status !== 'available') throw new Error(`galpy manifest record is ${record.status}, not available`)
  if (record.licenseGate.status !== 'pass') throw new Error('galpy manifest license gate is not passing')
  if (record.output.artifactKind !== 'wasm-module') throw new Error('galpy manifest must declare a wasm-module output')
  if (record.source.revision !== GALPY_SOURCE_REVISION) throw new Error('galpy manifest source revision is incompatible')
  const artifact = record.artifact
  const companion = artifact.companion
  if (
    artifact.path !== GALPY_ARTIFACT_INTEGRITY.wasm.path
    || artifact.sha256 !== GALPY_ARTIFACT_INTEGRITY.wasm.sha256
    || artifact.byteSize !== GALPY_ARTIFACT_INTEGRITY.wasm.byteSize
    || companion?.path !== GALPY_ARTIFACT_INTEGRITY.javascript.path
    || companion.sha256 !== GALPY_ARTIFACT_INTEGRITY.javascript.sha256
    || companion.byteSize !== GALPY_ARTIFACT_INTEGRITY.javascript.byteSize
  ) {
    throw new Error('galpy manifest integrity does not match the verified pair')
  }
}

function wasmExports(instance: WebAssembly.Instance): GalpyWasmExports {
  const exports = instance.exports as unknown as Record<string, unknown>
  const names = [
    'galpy_orbit_init',
    'galpy_orbit_step',
    'galpy_orbit_R',
    'galpy_orbit_z',
    'galpy_orbit_phi',
    'galpy_orbit_vR',
    'galpy_orbit_vT',
    'galpy_orbit_vz',
    'galpy_orbit_energy',
    'galpy_orbit_Lz',
    'galpy_circular_velocity',
  ] as const
  for (const name of names) {
    if (typeof exports[name] !== 'function') throw new Error(`galpy WASM export ${name} is unavailable`)
  }
  return exports as unknown as GalpyWasmExports
}

function finiteScalar(value: number, path: string): number {
  const result = finiteNumber(value, path)
  if (Math.abs(result) > GALPY_BOUNDS.maximumCoordinate * 10) fail(path, 'is outside the bounded galpy output range')
  return result
}

function snapshot(exports: GalpyWasmExports, step: number, time: number): GalpyOrbitSampleV1 {
  return {
    step,
    time,
    R: finiteScalar(exports.galpy_orbit_R(), 'galpy output.R'),
    z: finiteScalar(exports.galpy_orbit_z(), 'galpy output.z'),
    phi: finiteScalar(exports.galpy_orbit_phi(), 'galpy output.phi'),
    vR: finiteScalar(exports.galpy_orbit_vR(), 'galpy output.vR'),
    vT: finiteScalar(exports.galpy_orbit_vT(), 'galpy output.vT'),
    vz: finiteScalar(exports.galpy_orbit_vz(), 'galpy output.vz'),
    energy: finiteScalar(exports.galpy_orbit_energy(), 'galpy output.energy'),
    Lz: finiteScalar(exports.galpy_orbit_Lz(), 'galpy output.Lz'),
  }
}

function boundedOutput<T extends GalpyOutputV1>(output: T): T {
  const json = JSON.stringify(output)
  if (json === undefined || new TextEncoder().encode(json).byteLength > GALPY_BOUNDS.maximumOutputBytes) {
    throw new Error(`galpy output exceeds the ${GALPY_BOUNDS.maximumOutputBytes}-byte limit`)
  }
  return output
}

export function createGalpyAdapterFromRecord(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
  artifactRecord: ArtifactRecordV1,
  options: GalpyWasmLoadOptions = {},
): GalpyAdapterV1 {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  assertArtifactRecord(artifactRecord)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    async run(value, runSignal) {
      throwIfAborted(signal, 'The galpy operation was aborted')
      throwIfAborted(runSignal, 'The galpy operation was aborted')
      const input = parseGalpyInput(value)
      const linked = linkedSignals(signal, runSignal)
      try {
        const loaded = await instantiateVerifiedWasm(artifactRecord, {
          fetch: options.fetch,
          basePath: options.basePath,
          maxBytes: options.maxBytes ?? GALPY_BOUNDS.maximumArtifactBytes,
          signal: linked.signal,
        })
        throwIfAborted(linked.signal, 'The galpy operation was aborted')
        if (loaded.companionBytes === null) throw new Error('galpy companion JavaScript was not verified')
        const exports = wasmExports(loaded.instance)
        if (input.operation === 'circular-velocity') {
          return boundedOutput({
            schemaVersion: 1,
            operation: 'circular-velocity',
            input,
            value: finiteScalar(exports.galpy_circular_velocity(input.R), 'galpy output.value'),
            units: 'natural',
            provenance: GALPY_PROVENANCE,
          })
        }

        if (exports.galpy_orbit_init(input.R, input.z, input.phi, input.vR, input.vT, input.vz) !== 1) {
          throw new Error('galpy WASM rejected the bounded orbit initial condition')
        }
        const samples: GalpyOrbitSampleV1[] = [snapshot(exports, 0, 0)]
        for (let step = 1; step <= input.steps; step += 1) {
          throwIfAborted(linked.signal, 'The galpy operation was aborted')
          if (exports.galpy_orbit_step(input.timeStep) !== 1) {
            throw new Error(`galpy WASM rejected orbit step ${step}`)
          }
          if (step % input.sampleEvery === 0 || step === input.steps) {
            samples.push(snapshot(exports, step, step * input.timeStep))
          }
        }
        const first = samples[0]!
        const last = samples[samples.length - 1]!
        const energyScale = Math.max(1, Math.abs(first.energy))
        const lzScale = Math.max(1, Math.abs(first.Lz))
        const energyRelativeDrift = Math.abs(last.energy - first.energy) / energyScale
        const lzRelativeDrift = Math.abs(last.Lz - first.Lz) / lzScale
        if (energyRelativeDrift > GALPY_BOUNDS.maximumEnergyDrift) {
          throw new Error('galpy orbit energy drift exceeds the bounded educational tolerance')
        }
        return boundedOutput({
          schemaVersion: 1,
          operation: 'integrate-orbit',
          model: 'mwpotential2014-orbit-v1',
          input,
          samples,
          invariants: {
            energyStart: first.energy,
            energyEnd: last.energy,
            energyRelativeDrift,
            LzStart: first.Lz,
            LzEnd: last.Lz,
            LzRelativeDrift: lzRelativeDrift,
          },
          circularVelocityAtR0: finiteScalar(exports.galpy_circular_velocity(1), 'galpy output.circularVelocityAtR0'),
          provenance: GALPY_PROVENANCE,
        })
      } finally {
        linked.dispose()
      }
    },
  }
}

export const createGalpyAdapterFactory: GalpyAdapterFactoryV1 = (descriptor, signal) => {
  const artifactRecord = artifactRecordById(GALPY_MANIFEST_ID)
  if (artifactRecord === null) throw new Error('galpy has no central manifest record')
  return createGalpyAdapterFromRecord(descriptor, signal, artifactRecord)
}

export const galpyAdapterFactory = createGalpyAdapterFactory
