import { fail, record, exactKeys, finiteNumber, boundedNumber, throwIfAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const POPPY_ADAPTER_ID = 'awesome-poppy-typescript'
export const POPPY_KERNEL_REVISION = 'poppy-fraunhofer-aperture-typescript-v1'
export const POPPY_SOURCE_REVISION = 'a276feb4abf4'
export const POPPY_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/mperrin/poppy',
  license: 'Poppy catalog metadata identifies BSD-3-Clause; this compact kernel is an independent reimplementation.',
  data: 'No Poppy runtime, Astropy units, FITS data, SciPy stack, or external aperture data is bundled.',
})
export const POPPY_MAX_SAMPLES = 256

const MIN_WAVELENGTH = 1e-15
const MAX_WAVELENGTH = 1e9
const MIN_DISTANCE = 1e-15
const MAX_DISTANCE = 1e9
const MAX_APERTURE_SIZE = 1e6
const MAX_POSITION = 1e6
const MAX_FRAUNHOFER_ARGUMENT = 1e6
const MAX_OUTPUT_BYTES = 1_000_000

export interface PoppyCircularApertureV1 {
  shape: 'circular'
  radius: number
}

export interface PoppyRectangularApertureV1 {
  shape: 'rectangular'
  width: number
  height: number
}

export type PoppyApertureV1 = PoppyCircularApertureV1 | PoppyRectangularApertureV1

export interface PoppyComplexV1 {
  re: number
  im: number
}

export interface PoppyInputV1 {
  wavelength: number
  propagationDistance: number
  aperture: PoppyApertureV1
  positions: readonly number[]
}

export interface PoppyOutputV1 {
  wavelength: number
  propagationDistance: number
  positions: readonly number[]
  field: readonly PoppyComplexV1[]
  intensity: readonly number[]
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export type PoppyAperture = PoppyApertureV1
export type PoppyComplex = PoppyComplexV1
export type PoppyInput = PoppyInputV1
export type PoppyOutput = PoppyOutputV1
export type PoppyAdapterInputV1 = PoppyInputV1
export type PoppyAdapterOutputV1 = PoppyOutputV1
export type PoppyAdapter = AwesomePhysicsAdapterV1<PoppyInputV1, PoppyOutputV1>
export type PoppyAdapterFactory = AwesomePhysicsAdapterFactoryV1<PoppyInputV1, PoppyOutputV1>

interface ParsedInput {
  wavelength: number
  propagationDistance: number
  aperture: PoppyApertureV1
  positions: number[]
}

function parseInput(input: unknown): ParsedInput {
  const object = record(input, 'poppy input')
  exactKeys(object, ['wavelength', 'propagationDistance', 'aperture', 'positions'], [], 'poppy input')
  const wavelength = boundedNumber(object.wavelength, 'poppy input.wavelength', MIN_WAVELENGTH, MAX_WAVELENGTH)
  const propagationDistance = boundedNumber(
    object.propagationDistance,
    'poppy input.propagationDistance',
    MIN_DISTANCE,
    MAX_DISTANCE,
  )
  const apertureObject = record(object.aperture, 'poppy input.aperture')
  let aperture: PoppyApertureV1
  if (apertureObject.shape === 'circular') {
    exactKeys(apertureObject, ['shape', 'radius'], [], 'poppy input.aperture')
    aperture = {
      shape: 'circular',
      radius: boundedNumber(apertureObject.radius, 'poppy input.aperture.radius', Number.EPSILON, MAX_APERTURE_SIZE),
    }
  } else if (apertureObject.shape === 'rectangular') {
    exactKeys(apertureObject, ['shape', 'width', 'height'], [], 'poppy input.aperture')
    aperture = {
      shape: 'rectangular',
      width: boundedNumber(apertureObject.width, 'poppy input.aperture.width', Number.EPSILON, MAX_APERTURE_SIZE),
      height: boundedNumber(apertureObject.height, 'poppy input.aperture.height', Number.EPSILON, MAX_APERTURE_SIZE),
    }
  } else {
    fail('poppy input.aperture.shape', 'must be circular or rectangular')
  }
  if (!Array.isArray(object.positions)) fail('poppy input.positions', 'must be an array')
  if (object.positions.length === 0 || object.positions.length > POPPY_MAX_SAMPLES) {
    fail('poppy input.positions', `must contain between 1 and ${POPPY_MAX_SAMPLES} samples`)
  }
  const positions = object.positions.map((value, index) => boundedNumber(
    value,
    `poppy input.positions[${index}]`,
    -MAX_POSITION,
    MAX_POSITION,
  ))
  const maximumPosition = Math.max(...positions.map((position) => Math.abs(position)))
  const denominator = wavelength * propagationDistance
  if (!Number.isFinite(denominator) || denominator <= 0) fail('poppy input', 'has an invalid wavelength-distance product')
  const scale = aperture.shape === 'circular'
    ? (2 * Math.PI * aperture.radius) / denominator
    : (Math.PI * Math.max(aperture.width, aperture.height)) / denominator
  const maximumArgument = scale * maximumPosition
  if (!Number.isFinite(maximumArgument) || maximumArgument > MAX_FRAUNHOFER_ARGUMENT) {
    fail('poppy input', 'produces an unbounded Fraunhofer argument')
  }
  return { wavelength, propagationDistance, aperture, positions }
}

function besselJ1(value: number): number {
  const absolute = Math.abs(value)
  if (absolute === 0) return 0
  if (absolute <= 24) {
    const halfSquared = (value * value) / 4
    let term = value / 2
    let sum = term
    for (let order = 1; order <= 48; order += 1) {
      term *= -halfSquared / (order * (order + 1))
      sum += term
      if (!Number.isFinite(term) || !Number.isFinite(sum)) throw new RangeError('poppy Bessel series is not finite')
      if (Math.abs(term) <= Math.abs(sum) * Number.EPSILON) break
    }
    return sum
  }
  const phase = absolute - (3 * Math.PI) / 4
  const result = Math.sqrt(2 / (Math.PI * absolute)) * Math.cos(phase)
  return value < 0 ? -result : result
}

function sinc(value: number): number {
  if (Math.abs(value) < 1e-8) {
    const squared = value * value
    return 1 - squared / 6 + (squared * squared) / 120
  }
  return Math.sin(value) / value
}

function finiteField(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > 2) throw new RangeError(`${path} is outside the finite bound`)
  return value
}

function checkOutputSize(output: PoppyOutputV1): PoppyOutputV1 {
  const serialized = JSON.stringify(output)
  if (serialized === undefined) throw new RangeError('poppy output is not JSON serializable')
  const bytes = new TextEncoder().encode(serialized).byteLength
  if (bytes > MAX_OUTPUT_BYTES) throw new RangeError('poppy output exceeds the bounded output size')
  return output
}

function solve(input: ParsedInput, signal?: AbortSignal): PoppyOutputV1 {
  throwIfAborted(signal)
  const field: PoppyComplexV1[] = []
  const intensity: number[] = []
  const denominator = input.wavelength * input.propagationDistance
  for (const position of input.positions) {
    throwIfAborted(signal)
    let amplitude: number
    if (input.aperture.shape === 'circular') {
      const argument = (2 * Math.PI * input.aperture.radius * position) / denominator
      amplitude = Math.abs(argument) < Number.EPSILON ? 1 : (2 * besselJ1(argument)) / argument
    } else {
      const horizontalArgument = (Math.PI * input.aperture.width * position) / denominator
      amplitude = sinc(horizontalArgument)
    }
    const real = finiteField(amplitude, 'poppy field')
    const sampleIntensity = finiteField(real * real, 'poppy intensity')
    field.push({ re: real, im: 0 })
    intensity.push(sampleIntensity)
  }
  return checkOutputSize({
    wavelength: input.wavelength,
    propagationDistance: input.propagationDistance,
    positions: [...input.positions],
    field,
    intensity,
    assumptions: [
      'The aperture is centered and uniformly illuminated with a scalar monochromatic field.',
      'The returned values are a normalized real field and intensity along the image-plane x axis.',
      'The common propagation phase and absolute Fraunhofer prefactor are omitted; intensity is relative to the on-axis value.',
    ],
    numericalMethod: 'Analytic normalized Airy amplitude for a circular aperture or sinc amplitude for a rectangular aperture.',
    licenseCaveat: POPPY_SOURCE_CAVEATS.license,
  })
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-poppy' || descriptor.title !== 'poppy') {
    throw new TypeError('poppy adapter requires the poppy simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('poppy adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.length === 0)) {
    throw new TypeError('poppy descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string'
    || descriptor.adapterId.trim().length === 0 || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('poppy descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? POPPY_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createPoppyAdapter: PoppyAdapterFactory = (descriptor, signal) => {
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

export const poppyAdapterFactory = createPoppyAdapter
export const createPOPPYAdapter = createPoppyAdapter
