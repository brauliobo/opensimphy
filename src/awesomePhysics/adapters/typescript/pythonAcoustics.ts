import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const PYTHON_ACOUSTICS_ADAPTER_ID = 'awesome-python-acoustics-typescript'
export const PYTHON_ACOUSTICS_KERNEL_REVISION = 'python-acoustics-scalar-room-atmosphere-typescript-v1'
export const PYTHON_ACOUSTICS_SOURCE_REVISION = '99d79206159b'
export const PYTHON_ACOUSTICS_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/python-acoustics/python-acoustics',
  license: 'The BSD license text contains an {organization} placeholder; descriptor license review remains a later gate.',
  data: 'No python-acoustics Python runtime, SciPy signal path, NumPy arrays, WAV files, or external acoustic data is bundled.',
})

const REFERENCE_TEMPERATURE_K = 293.15
const REFERENCE_PRESSURE_KPA = 101.325
const TRIPLE_TEMPERATURE_K = 273.16
const REFERENCE_SOUND_SPEED_M_PER_S = 343.2
const MAX_OUTPUT = 1e12
const MAX_ARRAY_LENGTH = 32

export const PYTHON_ACOUSTICS_BOUNDS = Object.freeze({
  temperatureK: Object.freeze({ min: 150, max: 1000 }),
  pressureKPa: Object.freeze({ min: 1, max: 500 }),
  frequencyHz: Object.freeze({ min: 1, max: 1e6 }),
  flowResistivityPaSPerM2: Object.freeze({ min: 1, max: 1e9 }),
  relativeHumidity: Object.freeze({ min: 0, max: 1 }),
  surfaceAreaM2: Object.freeze({ min: 1e-6, max: 1e9 }),
  volumeM3: Object.freeze({ min: 1e-6, max: 1e9 }),
  speedOfSoundMPerS: Object.freeze({ min: 1, max: 2000 }),
  maximumArrayLength: MAX_ARRAY_LENGTH,
})

export interface PythonAcousticsSpeedOfSoundInputV1 {
  operation: 'speed-of-sound'
  temperatureK: number
  referenceTemperatureK?: number
}

export interface PythonAcousticsImpedanceInputV1 {
  operation: 'impedance'
  frequencyHz: number
  flowResistivityPaSPerM2: number
  model?: 'delany-bazley'
}

export interface PythonAcousticsReverberationInputV1 {
  operation: 'reverberation'
  surfaceAreasM2: readonly number[]
  absorptionCoefficients: readonly number[]
  volumeM3: number
  speedOfSoundMPerS?: number
  method?: 'sabine'
}

export interface PythonAcousticsAttenuationInputV1 {
  operation: 'attenuation'
  frequencyHz: number
  temperatureK: number
  pressureKPa: number
  relativeHumidity: number
  referenceTemperatureK?: number
  referencePressureKPa?: number
  tripleTemperatureK?: number
}

export type PythonAcousticsInputV1 =
  | PythonAcousticsSpeedOfSoundInputV1
  | PythonAcousticsImpedanceInputV1
  | PythonAcousticsReverberationInputV1
  | PythonAcousticsAttenuationInputV1

export interface PythonAcousticsSpeedOfSoundOutputV1 {
  operation: 'speed-of-sound'
  valueMPerS: number
  units: 'm/s'
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export interface PythonAcousticsImpedanceOutputV1 {
  operation: 'impedance'
  model: 'delany-bazley'
  impedance: {
    re: number
    im: number
  }
  magnitude: number
  units: 'normalized-specific-acoustic-impedance'
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export interface PythonAcousticsReverberationOutputV1 {
  operation: 'reverberation'
  method: 'sabine'
  reverberationTimeS: number
  equivalentAbsorptionAreaM2: number
  totalSurfaceAreaM2: number
  speedOfSoundMPerS: number
  units: {
    reverberationTime: 's'
    equivalentAbsorptionArea: 'm^2'
    totalSurfaceArea: 'm^2'
    speedOfSound: 'm/s'
  }
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export interface PythonAcousticsAttenuationOutputV1 {
  operation: 'attenuation'
  attenuationDbPerM: number
  speedOfSoundMPerS: number
  relaxationFrequencyNitrogenHz: number
  relaxationFrequencyOxygenHz: number
  units: {
    attenuation: 'dB/m'
    speedOfSound: 'm/s'
    relaxationFrequency: 'Hz'
  }
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export type PythonAcousticsOutputV1 =
  | PythonAcousticsSpeedOfSoundOutputV1
  | PythonAcousticsImpedanceOutputV1
  | PythonAcousticsReverberationOutputV1
  | PythonAcousticsAttenuationOutputV1

export type PythonAcousticsAdapterInputV1 = PythonAcousticsInputV1
export type PythonAcousticsAdapterOutputV1 = PythonAcousticsOutputV1
export type PythonAcousticsAdapter = AwesomePhysicsAdapterV1<PythonAcousticsInputV1, PythonAcousticsOutputV1>
export type PythonAcousticsAdapterFactory = AwesomePhysicsAdapterFactoryV1<PythonAcousticsInputV1, PythonAcousticsOutputV1>

interface ComplexValue {
  re: number
  im: number
}

interface ParsedSpeedOfSoundInput {
  operation: 'speed-of-sound'
  temperatureK: number
  referenceTemperatureK: number
}

interface ParsedImpedanceInput {
  operation: 'impedance'
  frequencyHz: number
  flowResistivityPaSPerM2: number
}

interface ParsedReverberationInput {
  operation: 'reverberation'
  surfaceAreasM2: number[]
  absorptionCoefficients: number[]
  volumeM3: number
  speedOfSoundMPerS: number
}

interface ParsedAttenuationInput {
  operation: 'attenuation'
  frequencyHz: number
  temperatureK: number
  pressureKPa: number
  relativeHumidity: number
  referenceTemperatureK: number
  referencePressureKPa: number
  tripleTemperatureK: number
}

type ParsedInput =
  | ParsedSpeedOfSoundInput
  | ParsedImpedanceInput
  | ParsedReverberationInput
  | ParsedAttenuationInput

function fail(path: string, message: string): never {
  throw new TypeError(`${path} ${message}`)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'must be a plain JSON object')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) fail(path, 'must be a plain JSON object')
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[], path: string): void {
  const allowed = new Set([...required, ...optional])
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  const missing = required.filter((key) => !Object.hasOwn(value, key))
  if (unknown.length > 0) fail(path, `has unknown properties: ${unknown.join(', ')}`)
  if (missing.length > 0) fail(path, `is missing properties: ${missing.join(', ')}`)
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
  return value
}

function boundedNumber(value: unknown, path: string, minimum: number, maximum: number): number {
  const result = finiteNumber(value, path)
  if (result < minimum || result > maximum) fail(path, `must be between ${minimum} and ${maximum}`)
  return result
}

function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_OUTPUT) {
    throw new RangeError(`${path} is outside the finite output bound`)
  }
  return value
}

function finiteComplex(value: ComplexValue, path: string): ComplexValue {
  return {
    re: finiteOutput(value.re, `${path}.re`),
    im: finiteOutput(value.im, `${path}.im`),
  }
}

function finiteJson<T>(value: T): T {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new Error('python-acoustics output could not be serialized as JSON')
  return value
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  if (signal.reason instanceof Error) throw signal.reason
  const error = new Error('The python-acoustics operation was aborted')
  error.name = 'AbortError'
  throw error
}

function optionalNumber(
  input: Record<string, unknown>,
  key: string,
  path: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  return Object.hasOwn(input, key) ? boundedNumber(input[key], `${path}.${key}`, minimum, maximum) : defaultValue
}

function boundedArray(value: unknown, path: string, minimum: number, maximum: number): number[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ARRAY_LENGTH) {
    fail(path, `must contain between 1 and ${MAX_ARRAY_LENGTH} finite numbers`)
  }
  return value.map((entry, index) => boundedNumber(entry, `${path}[${index}]`, minimum, maximum))
}

function parseInput(value: unknown): ParsedInput {
  const input = record(value, 'python-acoustics input')
  switch (input.operation) {
    case 'speed-of-sound':
      exactKeys(input, ['operation', 'temperatureK'], ['referenceTemperatureK'], 'python-acoustics input')
      return {
        operation: 'speed-of-sound',
        temperatureK: boundedNumber(input.temperatureK, 'python-acoustics input.temperatureK', PYTHON_ACOUSTICS_BOUNDS.temperatureK.min, PYTHON_ACOUSTICS_BOUNDS.temperatureK.max),
        referenceTemperatureK: optionalNumber(input, 'referenceTemperatureK', 'python-acoustics input', REFERENCE_TEMPERATURE_K, PYTHON_ACOUSTICS_BOUNDS.temperatureK.min, PYTHON_ACOUSTICS_BOUNDS.temperatureK.max),
      }
    case 'impedance':
      exactKeys(input, ['operation', 'frequencyHz', 'flowResistivityPaSPerM2'], ['model'], 'python-acoustics input')
      if (Object.hasOwn(input, 'model') && input.model !== 'delany-bazley') fail('python-acoustics input.model', 'must be delany-bazley')
      return {
        operation: 'impedance',
        frequencyHz: boundedNumber(input.frequencyHz, 'python-acoustics input.frequencyHz', PYTHON_ACOUSTICS_BOUNDS.frequencyHz.min, PYTHON_ACOUSTICS_BOUNDS.frequencyHz.max),
        flowResistivityPaSPerM2: boundedNumber(input.flowResistivityPaSPerM2, 'python-acoustics input.flowResistivityPaSPerM2', PYTHON_ACOUSTICS_BOUNDS.flowResistivityPaSPerM2.min, PYTHON_ACOUSTICS_BOUNDS.flowResistivityPaSPerM2.max),
      }
    case 'reverberation': {
      exactKeys(input, ['operation', 'surfaceAreasM2', 'absorptionCoefficients', 'volumeM3'], ['speedOfSoundMPerS', 'method'], 'python-acoustics input')
      if (Object.hasOwn(input, 'method') && input.method !== 'sabine') fail('python-acoustics input.method', 'must be sabine')
      const surfaceAreasM2 = boundedArray(input.surfaceAreasM2, 'python-acoustics input.surfaceAreasM2', PYTHON_ACOUSTICS_BOUNDS.surfaceAreaM2.min, PYTHON_ACOUSTICS_BOUNDS.surfaceAreaM2.max)
      const absorptionCoefficients = boundedArray(input.absorptionCoefficients, 'python-acoustics input.absorptionCoefficients', 0, 0.999999)
      if (surfaceAreasM2.length !== absorptionCoefficients.length) fail('python-acoustics input', 'surfaceAreasM2 and absorptionCoefficients must have equal lengths')
      return {
        operation: 'reverberation',
        surfaceAreasM2,
        absorptionCoefficients,
        volumeM3: boundedNumber(input.volumeM3, 'python-acoustics input.volumeM3', PYTHON_ACOUSTICS_BOUNDS.volumeM3.min, PYTHON_ACOUSTICS_BOUNDS.volumeM3.max),
        speedOfSoundMPerS: optionalNumber(input, 'speedOfSoundMPerS', 'python-acoustics input', REFERENCE_SOUND_SPEED_M_PER_S, PYTHON_ACOUSTICS_BOUNDS.speedOfSoundMPerS.min, PYTHON_ACOUSTICS_BOUNDS.speedOfSoundMPerS.max),
      }
    }
    case 'attenuation':
      exactKeys(input, ['operation', 'frequencyHz', 'temperatureK', 'pressureKPa', 'relativeHumidity'], ['referenceTemperatureK', 'referencePressureKPa', 'tripleTemperatureK'], 'python-acoustics input')
      return {
        operation: 'attenuation',
        frequencyHz: boundedNumber(input.frequencyHz, 'python-acoustics input.frequencyHz', PYTHON_ACOUSTICS_BOUNDS.frequencyHz.min, PYTHON_ACOUSTICS_BOUNDS.frequencyHz.max),
        temperatureK: boundedNumber(input.temperatureK, 'python-acoustics input.temperatureK', PYTHON_ACOUSTICS_BOUNDS.temperatureK.min, PYTHON_ACOUSTICS_BOUNDS.temperatureK.max),
        pressureKPa: boundedNumber(input.pressureKPa, 'python-acoustics input.pressureKPa', PYTHON_ACOUSTICS_BOUNDS.pressureKPa.min, PYTHON_ACOUSTICS_BOUNDS.pressureKPa.max),
        relativeHumidity: boundedNumber(input.relativeHumidity, 'python-acoustics input.relativeHumidity', PYTHON_ACOUSTICS_BOUNDS.relativeHumidity.min, PYTHON_ACOUSTICS_BOUNDS.relativeHumidity.max),
        referenceTemperatureK: optionalNumber(input, 'referenceTemperatureK', 'python-acoustics input', REFERENCE_TEMPERATURE_K, PYTHON_ACOUSTICS_BOUNDS.temperatureK.min, PYTHON_ACOUSTICS_BOUNDS.temperatureK.max),
        referencePressureKPa: optionalNumber(input, 'referencePressureKPa', 'python-acoustics input', REFERENCE_PRESSURE_KPA, PYTHON_ACOUSTICS_BOUNDS.pressureKPa.min, PYTHON_ACOUSTICS_BOUNDS.pressureKPa.max),
        tripleTemperatureK: optionalNumber(input, 'tripleTemperatureK', 'python-acoustics input', TRIPLE_TEMPERATURE_K, PYTHON_ACOUSTICS_BOUNDS.temperatureK.min, PYTHON_ACOUSTICS_BOUNDS.temperatureK.max),
      }
    default:
      fail('python-acoustics input.operation', 'must be speed-of-sound, impedance, reverberation, or attenuation')
  }
}

export function calculatePythonAcousticsSpeedOfSoundMPerS(
  temperatureK: number,
  referenceTemperatureK = REFERENCE_TEMPERATURE_K,
): number {
  const temperature = boundedNumber(temperatureK, 'temperatureK', PYTHON_ACOUSTICS_BOUNDS.temperatureK.min, PYTHON_ACOUSTICS_BOUNDS.temperatureK.max)
  const referenceTemperature = boundedNumber(referenceTemperatureK, 'referenceTemperatureK', PYTHON_ACOUSTICS_BOUNDS.temperatureK.min, PYTHON_ACOUSTICS_BOUNDS.temperatureK.max)
  return finiteOutput(REFERENCE_SOUND_SPEED_M_PER_S * Math.sqrt(temperature / referenceTemperature), 'speed of sound')
}

export function calculatePythonAcousticsImpedance(
  frequencyHz: number,
  flowResistivityPaSPerM2: number,
): { impedance: { re: number; im: number }; magnitude: number } {
  const frequency = boundedNumber(frequencyHz, 'frequencyHz', PYTHON_ACOUSTICS_BOUNDS.frequencyHz.min, PYTHON_ACOUSTICS_BOUNDS.frequencyHz.max)
  const flowResistivity = boundedNumber(flowResistivityPaSPerM2, 'flowResistivityPaSPerM2', PYTHON_ACOUSTICS_BOUNDS.flowResistivityPaSPerM2.min, PYTHON_ACOUSTICS_BOUNDS.flowResistivityPaSPerM2.max)
  const ratio = (1000 * frequency) / flowResistivity
  if (!Number.isFinite(ratio) || ratio <= 0) throw new RangeError('impedance frequency/resistivity ratio is outside the finite domain')
  const impedance = finiteComplex({
    re: 1 + 9.08 * ratio ** -0.75,
    im: -11.9 * ratio ** -0.73,
  }, 'impedance')
  return {
    impedance,
    magnitude: finiteOutput(Math.hypot(impedance.re, impedance.im), 'impedance magnitude'),
  }
}

export function calculatePythonAcousticsSabineReverberationS(
  surfaceAreasM2: readonly number[],
  absorptionCoefficients: readonly number[],
  volumeM3: number,
  speedOfSoundMPerS = REFERENCE_SOUND_SPEED_M_PER_S,
): { reverberationTimeS: number; equivalentAbsorptionAreaM2: number; totalSurfaceAreaM2: number } {
  const surfaceAreas = boundedArray(surfaceAreasM2, 'surfaceAreasM2', PYTHON_ACOUSTICS_BOUNDS.surfaceAreaM2.min, PYTHON_ACOUSTICS_BOUNDS.surfaceAreaM2.max)
  const absorption = boundedArray(absorptionCoefficients, 'absorptionCoefficients', 0, 0.999999)
  if (surfaceAreas.length !== absorption.length) fail('reverberation', 'surfaceAreasM2 and absorptionCoefficients must have equal lengths')
  const volume = boundedNumber(volumeM3, 'volumeM3', PYTHON_ACOUSTICS_BOUNDS.volumeM3.min, PYTHON_ACOUSTICS_BOUNDS.volumeM3.max)
  const speed = boundedNumber(speedOfSoundMPerS, 'speedOfSoundMPerS', PYTHON_ACOUSTICS_BOUNDS.speedOfSoundMPerS.min, PYTHON_ACOUSTICS_BOUNDS.speedOfSoundMPerS.max)
  const totalSurfaceAreaM2 = surfaceAreas.reduce((sum, area) => sum + area, 0)
  const equivalentAbsorptionAreaM2 = surfaceAreas.reduce((sum, area, index) => sum + area * absorption[index]!, 0)
  if (!Number.isFinite(totalSurfaceAreaM2) || !Number.isFinite(equivalentAbsorptionAreaM2) || equivalentAbsorptionAreaM2 <= 0) {
    throw new RangeError('Sabine reverberation requires a positive finite equivalent absorption area')
  }
  return {
    reverberationTimeS: finiteOutput(24 * Math.log(10) * volume / (speed * equivalentAbsorptionAreaM2), 'reverberation time'),
    equivalentAbsorptionAreaM2: finiteOutput(equivalentAbsorptionAreaM2, 'equivalent absorption area'),
    totalSurfaceAreaM2: finiteOutput(totalSurfaceAreaM2, 'total surface area'),
  }
}

function attenuationDetails(input: ParsedAttenuationInput): {
  attenuationDbPerM: number
  speedOfSoundMPerS: number
  relaxationFrequencyNitrogenHz: number
  relaxationFrequencyOxygenHz: number
} {
  const speedOfSoundMPerS = calculatePythonAcousticsSpeedOfSoundMPerS(input.temperatureK, input.referenceTemperatureK)
  const saturationPressureKPa = input.referencePressureKPa * 10 ** (
    -6.8346 * (input.tripleTemperatureK / input.temperatureK) ** 1.261 + 4.6151
  )
  const waterVapourMolarConcentration = input.relativeHumidity * saturationPressureKPa / input.pressureKPa
  const relaxationFrequencyOxygenHz = (input.pressureKPa / input.referencePressureKPa) * (
    24 + 4.04e4 * waterVapourMolarConcentration * (0.02 + waterVapourMolarConcentration) / (0.391 + waterVapourMolarConcentration)
  )
  const temperatureRatio = input.temperatureK / input.referenceTemperatureK
  const relaxationFrequencyNitrogenHz = (input.pressureKPa / input.referencePressureKPa) * temperatureRatio ** -0.5 * (
    9 + 280 * waterVapourMolarConcentration * Math.exp(-4.170 * (temperatureRatio ** (-1 / 3) - 1))
  )
  if (!Number.isFinite(relaxationFrequencyNitrogenHz) || !Number.isFinite(relaxationFrequencyOxygenHz)
    || relaxationFrequencyNitrogenHz <= 0 || relaxationFrequencyOxygenHz <= 0) {
    throw new RangeError('atmospheric relaxation frequencies are outside the finite domain')
  }
  const frequencySquared = input.frequencyHz ** 2
  const classical = 1.84e-11 * (input.referencePressureKPa / input.pressureKPa) * Math.sqrt(temperatureRatio)
  const oxygen = 0.01275 * Math.exp(-2239.1 / input.temperatureK) * (
    relaxationFrequencyOxygenHz + frequencySquared / relaxationFrequencyOxygenHz
  ) ** -1
  const nitrogen = 0.1068 * Math.exp(-3352 / input.temperatureK) * (
    relaxationFrequencyNitrogenHz + frequencySquared / relaxationFrequencyNitrogenHz
  ) ** -1
  const attenuationDbPerM = 8.686 * frequencySquared * (classical + temperatureRatio ** -2.5 * (oxygen + nitrogen))
  return {
    attenuationDbPerM: finiteOutput(attenuationDbPerM, 'attenuation coefficient'),
    speedOfSoundMPerS,
    relaxationFrequencyNitrogenHz: finiteOutput(relaxationFrequencyNitrogenHz, 'nitrogen relaxation frequency'),
    relaxationFrequencyOxygenHz: finiteOutput(relaxationFrequencyOxygenHz, 'oxygen relaxation frequency'),
  }
}

function solve(input: ParsedInput, signal?: AbortSignal): PythonAcousticsOutputV1 {
  throwIfAborted(signal)
  if (input.operation === 'speed-of-sound') {
    return finiteJson({
      operation: input.operation,
      valueMPerS: calculatePythonAcousticsSpeedOfSoundMPerS(input.temperatureK, input.referenceTemperatureK),
      units: 'm/s',
      assumptions: [
        'The sound speed follows the ISO 9613-1 temperature-ratio expression with a fixed reference speed.',
        'Temperature and reference temperature are supplied in kelvin; humidity and pressure corrections are omitted.',
      ],
      numericalMethod: 'Direct evaluation of c = 343.2 sqrt(T / T_reference).',
      licenseCaveat: PYTHON_ACOUSTICS_SOURCE_CAVEATS.license,
    })
  }
  if (input.operation === 'impedance') {
    const result = calculatePythonAcousticsImpedance(input.frequencyHz, input.flowResistivityPaSPerM2)
    return finiteJson({
      operation: input.operation,
      model: 'delany-bazley',
      ...result,
      units: 'normalized-specific-acoustic-impedance',
      assumptions: [
        'The material is represented by the normalized one-parameter Delany-Bazley model.',
        'Frequency is in hertz and flow resistivity is in pascal seconds per square metre.',
      ],
      numericalMethod: 'Direct complex evaluation of Z = 1 + 9.08 X^-0.75 - j 11.9 X^-0.73 with X = 1000 f / sigma.',
      licenseCaveat: PYTHON_ACOUSTICS_SOURCE_CAVEATS.license,
    })
  }
  if (input.operation === 'reverberation') {
    const result = calculatePythonAcousticsSabineReverberationS(
      input.surfaceAreasM2,
      input.absorptionCoefficients,
      input.volumeM3,
      input.speedOfSoundMPerS,
    )
    return finiteJson({
      operation: input.operation,
      method: 'sabine',
      ...result,
      speedOfSoundMPerS: input.speedOfSoundMPerS,
      units: {
        reverberationTime: 's',
        equivalentAbsorptionArea: 'm^2',
        totalSurfaceArea: 'm^2',
        speedOfSound: 'm/s',
      },
      assumptions: [
        'Surface areas and absorption coefficients are paired one-to-one and use a diffuse-field Sabine approximation.',
        'The equivalent absorption area is the sum of surface area times absorption coefficient; air absorption and scattering are omitted.',
      ],
      numericalMethod: 'Direct bounded evaluation of T60 = 24 ln(10) V / (c A).',
      licenseCaveat: PYTHON_ACOUSTICS_SOURCE_CAVEATS.license,
    })
  }
  const result = attenuationDetails(input)
  return finiteJson({
    operation: input.operation,
    ...result,
    units: {
      attenuation: 'dB/m',
      speedOfSound: 'm/s',
      relaxationFrequency: 'Hz',
    },
    assumptions: [
      'Atmospheric absorption follows the scalar ISO 9613-1 relaxation-frequency expression.',
      'Pressure is in kilopascals, relative humidity is in [0, 1], and the atmosphere is homogeneous along the path.',
      'The result is a coefficient in dB/m; geometric spreading and source directivity are not modeled.',
    ],
    numericalMethod: 'Direct bounded evaluation of classical, oxygen-relaxation, and nitrogen-relaxation attenuation terms.',
    licenseCaveat: PYTHON_ACOUSTICS_SOURCE_CAVEATS.license,
  })
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'must be a non-empty string')
  return value
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-python-acoustics' || descriptor.title !== 'python-acoustics') {
    throw new TypeError('python-acoustics adapter requires the python-acoustics simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('python-acoustics adapter requires TypeScript execution')
  const adapterId = descriptor.adapterId === undefined
    ? PYTHON_ACOUSTICS_ADAPTER_ID
    : nonEmptyString(descriptor.adapterId, 'descriptor.adapterId')
  if (!/^[A-Za-z0-9_-]+$/.test(adapterId)) fail('descriptor.adapterId', 'must be a safe ID')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.trim().length === 0)) {
    throw new TypeError('python-acoustics descriptor revisions must be non-empty strings')
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

export function evaluatePythonAcoustics(input: PythonAcousticsInputV1, signal?: AbortSignal): PythonAcousticsOutputV1 {
  throwIfAborted(signal)
  const output = solve(parseInput(input), signal)
  throwIfAborted(signal)
  return output
}

export const createPythonAcousticsAdapter: PythonAcousticsAdapterFactory = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      throwIfAborted(signal, runSignal)
      const output = evaluatePythonAcoustics(input, runSignal ?? signal)
      throwIfAborted(signal, runSignal)
      return output
    },
  }
}

export const pythonAcousticsAdapterFactory = createPythonAcousticsAdapter
export const createPythonAcousticsAdapterV1 = createPythonAcousticsAdapter
