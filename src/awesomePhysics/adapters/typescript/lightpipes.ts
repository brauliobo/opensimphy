import { fail, record, exactKeys, finiteNumber, boundedNumber, throwIfAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const LIGHTPIPES_ADAPTER_ID = 'awesome-lightpipes-typescript'
export const LIGHTPIPES_KERNEL_REVISION = 'lightpipes-young-fresnel-typescript-v1'
export const LIGHTPIPES_SOURCE_REVISION = 'cd965c9469bb'
export const LIGHTPIPES_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/opticspy/lightpipes',
  license: 'The lightpipes source has a BSD license file but conflicting MIT classifier metadata; descriptor license review remains required.',
  data: 'No LightPipes Python runtime, SciPy FFT stack, or external optical data is bundled.',
})
export const LIGHTPIPES_MAX_SAMPLES = 256

const MIN_WAVELENGTH = 1e-15
const MAX_WAVELENGTH = 1e9
const MAX_DISTANCE = 1e9
const MAX_POSITION = 1e9
const MAX_PHASE = 1e6

export interface LightpipesComplexV1 {
  re: number
  im: number
}

export interface LightpipesInputV1 {
  wavelength: number
  propagationDistance: number
  slitSeparation: number
  positions: readonly number[]
  phaseDifference?: number
}

export interface LightpipesOutputV1 {
  positions: readonly number[]
  field: readonly LightpipesComplexV1[]
  intensity: readonly number[]
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export type LightpipesInput = LightpipesInputV1
export type LightpipesOutput = LightpipesOutputV1
export type LightpipesComplex = LightpipesComplexV1
export type LightpipesAdapterInputV1 = LightpipesInputV1
export type LightpipesAdapterOutputV1 = LightpipesOutputV1
export type LightpipesAdapter = AwesomePhysicsAdapterV1<LightpipesInputV1, LightpipesOutputV1>
export type LightpipesAdapterFactory = AwesomePhysicsAdapterFactoryV1<LightpipesInputV1, LightpipesOutputV1>

function parseInput(input: unknown): {
  wavelength: number
  propagationDistance: number
  slitSeparation: number
  positions: number[]
  phaseDifference: number
} {
  const object = record(input, 'lightpipes input')
  exactKeys(object, ['wavelength', 'propagationDistance', 'slitSeparation', 'positions'], ['phaseDifference'], 'lightpipes input')
  const wavelength = boundedNumber(object.wavelength, 'lightpipes input.wavelength', MIN_WAVELENGTH, MAX_WAVELENGTH)
  const propagationDistance = boundedNumber(object.propagationDistance, 'lightpipes input.propagationDistance', MIN_WAVELENGTH, MAX_DISTANCE)
  const slitSeparation = boundedNumber(object.slitSeparation, 'lightpipes input.slitSeparation', 0, MAX_POSITION)
  const phaseDifference = !Object.hasOwn(object, 'phaseDifference')
    ? 0
    : boundedNumber(object.phaseDifference, 'lightpipes input.phaseDifference', -MAX_PHASE, MAX_PHASE)
  if (!Array.isArray(object.positions)) fail('lightpipes input.positions', 'must be an array')
  if (object.positions.length === 0 || object.positions.length > LIGHTPIPES_MAX_SAMPLES) {
    fail('lightpipes input.positions', `must contain between 1 and ${LIGHTPIPES_MAX_SAMPLES} samples`)
  }
  const positions = object.positions.map((value, index) => boundedNumber(value, `lightpipes input.positions[${index}]`, -MAX_POSITION, MAX_POSITION))
  const phaseScale = (Math.PI * slitSeparation * Math.max(...positions.map((position) => Math.abs(position))))
    / (wavelength * propagationDistance)
  if (!Number.isFinite(phaseScale) || phaseScale > MAX_PHASE) fail('lightpipes input', 'produces an unbounded Fresnel phase')
  return { wavelength, propagationDistance, slitSeparation, positions, phaseDifference }
}

function solve(input: ReturnType<typeof parseInput>, signal?: AbortSignal): LightpipesOutputV1 {
  throwIfAborted(signal)
  const waveNumber = (2 * Math.PI) / input.wavelength
  const field: LightpipesComplexV1[] = []
  const intensity: number[] = []
  for (let index = 0; index < input.positions.length; index += 1) {
    throwIfAborted(signal)
    const position = input.positions[index]
    if (position === undefined) throw new RangeError('lightpipes position is missing')
    const leftOffset = position + input.slitSeparation / 2
    const rightOffset = position - input.slitSeparation / 2
    const leftPhase = (waveNumber * leftOffset * leftOffset) / (2 * input.propagationDistance)
    const rightPhase = (waveNumber * rightOffset * rightOffset) / (2 * input.propagationDistance) + input.phaseDifference
    if (!Number.isFinite(leftPhase) || !Number.isFinite(rightPhase)
      || Math.abs(leftPhase) > MAX_PHASE || Math.abs(rightPhase) > MAX_PHASE) {
      throw new RangeError('lightpipes Fresnel phase is outside the finite bound')
    }
    const value = {
      re: Math.cos(leftPhase) + Math.cos(rightPhase),
      im: Math.sin(leftPhase) + Math.sin(rightPhase),
    }
    const sampleIntensity = value.re * value.re + value.im * value.im
    if (!Number.isFinite(value.re) || !Number.isFinite(value.im) || !Number.isFinite(sampleIntensity)) {
      throw new RangeError('lightpipes output is not finite')
    }
    field.push(value)
    intensity.push(sampleIntensity)
  }
  return {
    positions: [...input.positions],
    field,
    intensity,
    assumptions: [
      'Two equal-amplitude point sources are placed at x = -slitSeparation/2 and +slitSeparation/2.',
      'The returned field uses the paraxial 1D Fresnel phase and omits the common propagation prefactor.',
      'Intensity is dimensionless and proportional to the squared field magnitude.',
    ],
    numericalMethod: 'Direct bounded evaluation of the two-source Fresnel phase at each requested position.',
    licenseCaveat: LIGHTPIPES_SOURCE_CAVEATS.license,
  }
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-lightpipes' || descriptor.title !== 'lightpipes') {
    throw new TypeError('lightpipes adapter requires the lightpipes simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('lightpipes adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.length === 0)) {
    throw new TypeError('lightpipes descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string'
    || descriptor.adapterId.trim().length === 0 || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('lightpipes descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? LIGHTPIPES_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createLightpipesAdapter: LightpipesAdapterFactory = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      throwIfAborted(signal)
      throwIfAborted(runSignal)
      const output = solve(parseInput(input), runSignal ?? signal)
      throwIfAborted(runSignal)
      return output
    },
  }
}

export const lightpipesAdapterFactory = createLightpipesAdapter
export const createLightPipesAdapter = createLightpipesAdapter
