import type { ResultFinding, TourRuntimeResultAttribution } from '../types/tour'
import { EXACT_DERIVED_CONSTANTS, SI_EXACT_CONSTANTS } from './physicsConstants'

export const BLACKBODY_PRESET_IDS = Object.freeze([
  'room',
  'human-ish',
  'incandescent',
  'sun-photosphere',
  'hot-star',
] as const)

export type BlackbodyPresetId = typeof BLACKBODY_PRESET_IDS[number]

export interface BlackbodyInput {
  temperatureKelvin: number
  wavelengthMinimumMetres?: number
  wavelengthMaximumMetres?: number
  sampleCount?: number
  wavelengthGridMetres?: readonly number[]
}

export interface BlackbodyPreset {
  id: BlackbodyPresetId
  label: string
  description: string
  input: Readonly<BlackbodyInput>
}

export interface BlackbodySpectrumPoint {
  wavelengthMetres: number
  spectralRadianceWattsPerSteradianCubicMetre: number
}

export interface BlackbodyNormalizedPoint {
  x: number
  y: number
  wavelengthMetres: number
  normalizedRadiance: number
}

export interface BlackbodyTableRow {
  wavelengthNanometres: number
  spectralRadianceWattsPerSteradianCubicMetre: number
  normalizedRadiance: number
}

type FindingNarrative = Pick<
  ResultFinding,
  'changed' | 'cause' | 'equation' | 'assumptions' | 'establishes' | 'doesNotEstablish'
>

export type BlackbodyFinding = FindingNarrative & TourRuntimeResultAttribution

export interface BlackbodyEvaluation {
  temperatureKelvin: number
  wienPeakWavelengthMetres: number
  stefanBoltzmannExitanceWattsPerSquareMetre: number
  spectrum: BlackbodySpectrumPoint[]
  normalizedSeries: BlackbodyNormalizedPoint[]
  table: BlackbodyTableRow[]
  finding: BlackbodyFinding
}

const DEFAULT_WAVELENGTH_MINIMUM_METRES = 1e-7
const DEFAULT_WAVELENGTH_MAXIMUM_METRES = 1e-4
const DEFAULT_SAMPLE_COUNT = 129
const MINIMUM_WAVELENGTH_METRES = 1e-9
const MAXIMUM_WAVELENGTH_METRES = 1e-2
const MAXIMUM_SAMPLE_COUNT = 256
const TABLE_ROW_COUNT = 11

function preset(id: BlackbodyPresetId, label: string, description: string, temperatureKelvin: number): Readonly<BlackbodyPreset> {
  return Object.freeze({
    id,
    label,
    description,
    input: Object.freeze({ temperatureKelvin }),
  })
}

export const BLACKBODY_PRESETS = Object.freeze([
  preset('room', 'Room', 'A room-temperature ideal black body.', 293.15),
  preset('human-ish', 'Human-ish', 'A body-temperature ideal black-body comparison, not a human emissivity model.', 310),
  preset('incandescent', 'Incandescent', 'A representative hot-filament ideal black-body temperature.', 2_700),
  preset('sun-photosphere', 'Sun photosphere', 'A conventional effective-temperature black-body comparison for the Sun.', 5_772),
  preset('hot-star', 'Hot star', 'A generic hot-star ideal black-body comparison.', 10_000),
] as const satisfies readonly Readonly<BlackbodyPreset>[])

function boundedNumber(value: number, name: string, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) throw new Error(`Black-body ${name} must be finite`)
  if (value < minimum || value > maximum) {
    throw new RangeError(`Black-body ${name} must be within [${minimum}, ${maximum}]`)
  }
  return value
}

function checkedSampleCount(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Black-body sampleCount must be finite')
  if (!Number.isInteger(value)) throw new RangeError('Black-body sampleCount must be an integer')
  if (value < 2 || value > MAXIMUM_SAMPLE_COUNT) {
    throw new RangeError(`Black-body sampleCount must be within [2, ${MAXIMUM_SAMPLE_COUNT}]`)
  }
  return value
}

function logarithmicGrid(minimum: number, maximum: number, count: number, peak: number): number[] {
  const logMinimum = Math.log(minimum)
  const logSpan = Math.log(maximum) - logMinimum
  const grid = Array.from({ length: count }, (_, index) => (
    Math.exp(logMinimum + logSpan * index / (count - 1))
  ))

  if (peak > minimum && peak < maximum && count > 2) {
    let nearestIndex = 1
    let nearestDistance = Number.POSITIVE_INFINITY
    for (let index = 1; index < count - 1; index += 1) {
      const distance = Math.abs(Math.log(grid[index]!) - Math.log(peak))
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    }
    grid[nearestIndex] = peak
  }

  return grid
}

function resolveWavelengthGrid(input: BlackbodyInput, peak: number): number[] {
  if (input.wavelengthGridMetres !== undefined) {
    if (!Array.isArray(input.wavelengthGridMetres)) {
      throw new TypeError('Black-body wavelengthGridMetres must be an array')
    }
    if (input.wavelengthGridMetres.length < 2 || input.wavelengthGridMetres.length > MAXIMUM_SAMPLE_COUNT) {
      throw new RangeError(`Black-body wavelengthGridMetres must contain 2 to ${MAXIMUM_SAMPLE_COUNT} points`)
    }
    if (
      input.wavelengthMinimumMetres !== undefined
      || input.wavelengthMaximumMetres !== undefined
      || input.sampleCount !== undefined
    ) {
      throw new Error('Black-body wavelengthGridMetres cannot be combined with logarithmic-grid controls')
    }

    return input.wavelengthGridMetres.map((wavelength, index) => {
      const checked = boundedNumber(
        wavelength,
        `wavelengthGridMetres[${index}]`,
        MINIMUM_WAVELENGTH_METRES,
        MAXIMUM_WAVELENGTH_METRES,
      )
      if (index > 0 && checked <= input.wavelengthGridMetres![index - 1]!) {
        throw new RangeError('Black-body wavelengthGridMetres must be strictly increasing')
      }
      return checked
    })
  }

  const minimum = boundedNumber(
    input.wavelengthMinimumMetres ?? DEFAULT_WAVELENGTH_MINIMUM_METRES,
    'wavelengthMinimumMetres',
    MINIMUM_WAVELENGTH_METRES,
    MAXIMUM_WAVELENGTH_METRES,
  )
  const maximum = boundedNumber(
    input.wavelengthMaximumMetres ?? DEFAULT_WAVELENGTH_MAXIMUM_METRES,
    'wavelengthMaximumMetres',
    MINIMUM_WAVELENGTH_METRES,
    MAXIMUM_WAVELENGTH_METRES,
  )
  if (minimum >= maximum) {
    throw new RangeError('Black-body wavelengthMinimumMetres must be less than wavelengthMaximumMetres')
  }
  const count = checkedSampleCount(input.sampleCount ?? DEFAULT_SAMPLE_COUNT)
  return logarithmicGrid(minimum, maximum, count, peak)
}

export function planckSpectralRadiance(wavelengthMetres: number, temperatureKelvin: number): number {
  const wavelength = boundedNumber(
    wavelengthMetres,
    'wavelengthMetres',
    MINIMUM_WAVELENGTH_METRES,
    MAXIMUM_WAVELENGTH_METRES,
  )
  const temperature = boundedNumber(temperatureKelvin, 'temperatureKelvin', 100, 20_000)
  const h = SI_EXACT_CONSTANTS.planckConstant.value
  const c = SI_EXACT_CONSTANTS.speedOfLight.value
  const k = SI_EXACT_CONSTANTS.boltzmannConstant.value
  const exponent = h * c / (wavelength * k * temperature)

  // Keep expm1 accuracy until exp(x) would overflow, then evaluate the full radiance in log space.
  if (exponent <= Math.log(Number.MAX_VALUE)) {
    return 2 * h * c ** 2 / (wavelength ** 5 * Math.expm1(exponent))
  }
  const logRadiance = Math.log(2 * h) + 2 * Math.log(c) - 5 * Math.log(wavelength) - exponent
  return logRadiance < Math.log(Number.MIN_VALUE) ? 0 : Math.exp(logRadiance)
}

function tableIndices(length: number, preferredIndex: number): number[] {
  const rows = Math.min(TABLE_ROW_COUNT, length)
  const indices = Array.from(new Set(Array.from({ length: rows }, (_, index) => (
    Math.round(index * (length - 1) / (rows - 1))
  ))))
  if (!indices.includes(preferredIndex)) {
    let replacement = 1
    for (let index = 2; index < indices.length - 1; index += 1) {
      if (Math.abs(indices[index]! - preferredIndex) < Math.abs(indices[replacement]! - preferredIndex)) {
        replacement = index
      }
    }
    indices[replacement] = preferredIndex
    indices.sort((left, right) => left - right)
  }
  return indices
}

function buildFinding(temperature: number, peak: number, exitance: number): BlackbodyFinding {
  return {
    changed: `At ${temperature} K, the ideal wavelength-domain spectrum peaks at ${peak} m and has total exitance ${exitance} W m^-2.`,
    cause: 'Planck spectral radiance shifts and increases with thermodynamic temperature.',
    equation: 'B_lambda = (2 h c^2/lambda^5)/expm1(h c/(lambda k_B T)); lambda_max = b/T; M = sigma T^4',
    assumptions: [
      'The source is an ideal black body with wavelength-independent emissivity 1.',
      'The spectrum is represented as wavelength-domain spectral radiance B_lambda in vacuum.',
      'The Stefan-Boltzmann result is hemispherical radiant exitance from the ideal surface.',
    ],
    establishes: 'The result establishes the conventional ideal-Planck spectrum, Wien wavelength peak, and Stefan-Boltzmann exitance for the bounded temperature.',
    doesNotEstablish: 'The calculation is not a measured spectrum, an empirical validation, a material-emissivity model, or an inference of perceived or display color.',
    claimClass: 'established-model',
    evidenceRefs: ['openstax-university-physics-v3', 'bipm-si-brochure-9', 'codata-2022'],
    sourceRevision: 'OpenStax University Physics Volume 3, 2016 web edition; SI Brochure 9th edition; CODATA 2022',
    sourceLocator: 'OpenStax section 6.1; fixed h, c, and k_B; ideal Planck, Wien-displacement, and Stefan-Boltzmann relations',
    methodRelationship: 'not-applicable',
    modelOrigin: 'established-physics',
    resultStatus: 'computed',
    validatesTheory: false,
    caveats: [
      'Real sources generally have emissivity below or varying around unity and may depart from a Planck spectrum.',
      'B_lambda and frequency-domain B_nu have different peak coordinates; this engine reports only the wavelength representation.',
      'No measured spectrum, atmosphere, detector response, color-matching function, or color inference is used.',
    ],
  }
}

export function evaluateBlackbody(input: BlackbodyInput): BlackbodyEvaluation {
  if (!input || typeof input !== 'object') throw new TypeError('Black-body input must be an object')
  const temperature = boundedNumber(input.temperatureKelvin, 'temperatureKelvin', 100, 20_000)
  const peak = EXACT_DERIVED_CONSTANTS.wienWavelengthDisplacementConstant.value / temperature
  const exitance = EXACT_DERIVED_CONSTANTS.stefanBoltzmannConstant.value * temperature ** 4
  const wavelengths = resolveWavelengthGrid(input, peak)
  const spectrum = wavelengths.map((wavelengthMetres) => ({
    wavelengthMetres,
    spectralRadianceWattsPerSteradianCubicMetre: planckSpectralRadiance(wavelengthMetres, temperature),
  }))
  const maximumRadiance = Math.max(...spectrum.map(({ spectralRadianceWattsPerSteradianCubicMetre }) => (
    spectralRadianceWattsPerSteradianCubicMetre
  )))
  const normalizedSeries = spectrum.map(({ wavelengthMetres, spectralRadianceWattsPerSteradianCubicMetre }) => {
    const normalizedRadiance = maximumRadiance === 0
      ? 0
      : spectralRadianceWattsPerSteradianCubicMetre / maximumRadiance
    return { x: wavelengthMetres, y: normalizedRadiance, wavelengthMetres, normalizedRadiance }
  })
  const maximumIndex = spectrum.findIndex(({ spectralRadianceWattsPerSteradianCubicMetre }) => (
    spectralRadianceWattsPerSteradianCubicMetre === maximumRadiance
  ))
  const table = tableIndices(spectrum.length, maximumIndex).map((index) => ({
    wavelengthNanometres: spectrum[index]!.wavelengthMetres * 1e9,
    spectralRadianceWattsPerSteradianCubicMetre: spectrum[index]!.spectralRadianceWattsPerSteradianCubicMetre,
    normalizedRadiance: normalizedSeries[index]!.normalizedRadiance,
  }))

  return {
    temperatureKelvin: temperature,
    wienPeakWavelengthMetres: peak,
    stefanBoltzmannExitanceWattsPerSquareMetre: exitance,
    spectrum,
    normalizedSeries,
    table,
    finding: buildFinding(temperature, peak, exitance),
  }
}
