import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const THERMOPY_ADAPTER_ID = 'awesome-thermopy-typescript'
export const THERMOPY_KERNEL_REVISION = 'thermopy-nasa9-ideal-gas-typescript-v1'
export const THERMOPY_SOURCE_REVISION = '0ec59dfe00cd'
export const THERMOPY_GAS_CONSTANT_J_PER_MOL_K = 8.31446261815324
export const THERMOPY_STANDARD_STATE_PRESSURE_PA = 100_000
export const THERMOPY_MAX_INTERVALS = 16
export const THERMOPY_MAX_OUTPUT_BYTES = 16 * 1024

const NASA9_COEFFICIENT_COUNT = 9
const MIN_TEMPERATURE_K = 1
const MAX_TEMPERATURE_K = 6000
const MAX_ABSOLUTE_COEFFICIENT = 1e12
const MAX_OUTPUT_MAGNITUDE = 1e25

export const THERMOPY_BOUNDS = Object.freeze({
  temperatureK: Object.freeze({ min: MIN_TEMPERATURE_K, max: MAX_TEMPERATURE_K }),
  intervalCount: Object.freeze({ min: 1, max: THERMOPY_MAX_INTERVALS }),
  coefficientAbsoluteValue: MAX_ABSOLUTE_COEFFICIENT,
  coefficientsPerInterval: NASA9_COEFFICIENT_COUNT,
  maximumOutputMagnitude: MAX_OUTPUT_MAGNITUDE,
  maximumOutputBytes: THERMOPY_MAX_OUTPUT_BYTES,
} as const)

export const THERMOPY_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/guillemborrell/thermopy',
  license: 'thermopy is GPL-3-or-later from v0.5; this educational adapter remains unavailable pending license compatibility review and a separate data-license review.',
  data: 'No thermopy XML, NASA/Burcat/IAPWS data, species database, Python runtime, or NumPy is bundled; coefficients and temperature intervals are caller-supplied.',
  model: 'This is an independent TypeScript NASA9-style ideal-gas evaluator, not a port of thermopy data or its Python runtime.',
})

export type ThermopyNasa9CoefficientsV1 = readonly number[]

export interface ThermopyNasa9IntervalV1 {
  lowerTemperatureK: number
  upperTemperatureK: number
  coefficients: ThermopyNasa9CoefficientsV1
}

export interface ThermopyNasa9InputV1 {
  operation: 'nasa9-ideal-gas'
  temperatureK: number
  intervals: readonly ThermopyNasa9IntervalV1[]
}

export interface ThermopyNasa9PropertyValuesV1 {
  temperatureK: number
  interval: {
    lowerTemperatureK: number
    upperTemperatureK: number
  }
  cpJPerMolK: number
  enthalpyJPerMol: number
  entropyJPerMolK: number
  cpOverR: number
  enthalpyOverRT: number
  entropyOverR: number
  standardStatePressurePa: number
}

export interface ThermopyNasa9OutputV1 extends ThermopyNasa9PropertyValuesV1 {
  operation: 'nasa9-ideal-gas'
  units: {
    temperature: 'K'
    cp: 'J/(mol*K)'
    enthalpy: 'J/mol'
    entropy: 'J/(mol*K)'
    cpOverR: '1'
    enthalpyOverRT: '1'
    entropyOverR: '1'
    standardStatePressure: 'Pa'
  }
  assumptions: readonly string[]
  numericalMethod: string
  doesNotEstablish: string
  availability: 'unavailable'
  integrationStatus: 'provisional-adapter-not-registered'
  licenseGate: 'review'
  licenseCaveat: string
}

export type ThermopyInputV1 = ThermopyNasa9InputV1
export type ThermopyOutputV1 = ThermopyNasa9OutputV1
export type ThermopyAdapterV1 = AwesomePhysicsAdapterV1<ThermopyInputV1, ThermopyOutputV1>
export type ThermopyAdapterFactoryV1 = AwesomePhysicsAdapterFactoryV1<ThermopyInputV1, ThermopyOutputV1>

type NormalizedCoefficients = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

interface NormalizedInterval {
  lowerTemperatureK: number
  upperTemperatureK: number
  coefficients: NormalizedCoefficients
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

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
  return value
}

function boundedNumber(value: unknown, path: string, minimum: number, maximum: number): number {
  const result = finiteNumber(value, path)
  if (result < minimum || result > maximum) fail(path, `must be between ${minimum} and ${maximum}`)
  return result
}

function coefficient(value: unknown, path: string): number {
  return boundedNumber(value, path, -MAX_ABSOLUTE_COEFFICIENT, MAX_ABSOLUTE_COEFFICIENT)
}

function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_OUTPUT_MAGNITUDE) {
    throw new RangeError(`${path} is outside the finite output bound`)
  }
  return value === 0 ? 0 : value
}

function throwIfAborted(...signals: readonly (AbortSignal | undefined)[]): void {
  for (const signal of signals) {
    if (!signal?.aborted) continue
    if (signal.reason instanceof Error) throw signal.reason
    const error = new Error('The thermopy operation was aborted')
    error.name = 'AbortError'
    throw error
  }
}

function normalizeIntervals(
  value: unknown,
  path: string,
  ...signals: readonly (AbortSignal | undefined)[]
): NormalizedInterval[] {
  throwIfAborted(...signals)
  if (!Array.isArray(value) || value.length < 1 || value.length > THERMOPY_MAX_INTERVALS) {
    fail(path, `must contain between 1 and ${THERMOPY_MAX_INTERVALS} intervals`)
  }

  const intervals: NormalizedInterval[] = []
  let previousUpperTemperatureK: number | undefined
  for (let intervalIndex = 0; intervalIndex < value.length; intervalIndex += 1) {
    throwIfAborted(...signals)
    const interval = record(value[intervalIndex], `${path}[${intervalIndex}]`)
    exactKeys(interval, ['lowerTemperatureK', 'upperTemperatureK', 'coefficients'], `${path}[${intervalIndex}]`)
    const lowerTemperatureK = boundedNumber(
      interval.lowerTemperatureK,
      `${path}[${intervalIndex}].lowerTemperatureK`,
      MIN_TEMPERATURE_K,
      MAX_TEMPERATURE_K,
    )
    const upperTemperatureK = boundedNumber(
      interval.upperTemperatureK,
      `${path}[${intervalIndex}].upperTemperatureK`,
      MIN_TEMPERATURE_K,
      MAX_TEMPERATURE_K,
    )
    if (lowerTemperatureK >= upperTemperatureK) {
      fail(`${path}[${intervalIndex}]`, 'lowerTemperatureK must be below upperTemperatureK')
    }
    if (previousUpperTemperatureK !== undefined && lowerTemperatureK < previousUpperTemperatureK) {
      fail(path, 'intervals must be sorted by lowerTemperatureK and must not overlap')
    }

    if (!Array.isArray(interval.coefficients) || interval.coefficients.length !== NASA9_COEFFICIENT_COUNT) {
      fail(`${path}[${intervalIndex}].coefficients`, `must contain exactly ${NASA9_COEFFICIENT_COUNT} coefficients`)
    }
    const coefficients: number[] = []
    for (let coefficientIndex = 0; coefficientIndex < interval.coefficients.length; coefficientIndex += 1) {
      throwIfAborted(...signals)
      coefficients.push(coefficient(interval.coefficients[coefficientIndex], `${path}[${intervalIndex}].coefficients[${coefficientIndex}]`))
    }

    intervals.push({
      lowerTemperatureK,
      upperTemperatureK,
      coefficients: coefficients as NormalizedCoefficients,
    })
    previousUpperTemperatureK = upperTemperatureK
  }
  return intervals
}

function selectInterval(temperatureK: number, intervals: readonly NormalizedInterval[], ...signals: readonly (AbortSignal | undefined)[]): NormalizedInterval {
  for (const interval of intervals) {
    throwIfAborted(...signals)
    if (temperatureK >= interval.lowerTemperatureK && temperatureK <= interval.upperTemperatureK) return interval
  }
  throw new RangeError('temperatureK is outside all supplied NASA9 temperature intervals')
}

function outputByteLength(value: unknown): number {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new Error('thermopy output could not be serialized as JSON')
  return new TextEncoder().encode(serialized).byteLength
}

function assertOutputSize(output: ThermopyNasa9OutputV1): void {
  const byteLength = outputByteLength(output)
  if (byteLength > THERMOPY_MAX_OUTPUT_BYTES) {
    throw new RangeError(`thermopy output exceeds ${THERMOPY_MAX_OUTPUT_BYTES} bytes`)
  }
}

function parseInput(input: unknown, ...signals: readonly (AbortSignal | undefined)[]): ThermopyNasa9InputV1 {
  throwIfAborted(...signals)
  const object = record(input, 'thermopy input')
  if (object.operation !== 'nasa9-ideal-gas') {
    fail('thermopy input.operation', 'must be nasa9-ideal-gas')
  }
  exactKeys(object, ['operation', 'temperatureK', 'intervals'], 'thermopy input')
  const temperatureK = boundedNumber(object.temperatureK, 'thermopy input.temperatureK', MIN_TEMPERATURE_K, MAX_TEMPERATURE_K)
  return {
    operation: 'nasa9-ideal-gas',
    temperatureK,
    intervals: normalizeIntervals(object.intervals, 'thermopy input.intervals', ...signals),
  }
}

export function calculateThermopyNasa9Properties(
  temperatureK: number,
  intervals: readonly ThermopyNasa9IntervalV1[],
  ...signals: readonly (AbortSignal | undefined)[]
): ThermopyNasa9PropertyValuesV1 {
  throwIfAborted(...signals)
  const temperature = boundedNumber(temperatureK, 'temperatureK', MIN_TEMPERATURE_K, MAX_TEMPERATURE_K)
  const normalizedIntervals = normalizeIntervals(intervals, 'intervals', ...signals)
  const interval = selectInterval(temperature, normalizedIntervals, ...signals)
  const [a1, a2, a3, a4, a5, a6, a7, a8, a9] = interval.coefficients
  const inverseTemperature = 1 / temperature
  const inverseTemperatureSquared = inverseTemperature * inverseTemperature
  const temperatureSquared = temperature * temperature
  const temperatureCubed = temperatureSquared * temperature
  const temperatureFourth = temperatureCubed * temperature
  const logTemperature = Math.log(temperature)

  const cpOverR = a1 * inverseTemperatureSquared
    + a2 * inverseTemperature
    + a3
    + a4 * temperature
    + a5 * temperatureSquared
    + a6 * temperatureCubed
    + a7 * temperatureFourth
  const enthalpyOverRT = -a1 * inverseTemperatureSquared
    + a2 * logTemperature * inverseTemperature
    + a3
    + (a4 * temperature) / 2
    + (a5 * temperatureSquared) / 3
    + (a6 * temperatureCubed) / 4
    + (a7 * temperatureFourth) / 5
    + a8 * inverseTemperature
  const entropyOverR = -(a1 * inverseTemperatureSquared) / 2
    - a2 * inverseTemperature
    + a3 * logTemperature
    + a4 * temperature
    + (a5 * temperatureSquared) / 2
    + (a6 * temperatureCubed) / 3
    + (a7 * temperatureFourth) / 4
    + a9

  const boundedCpOverR = finiteOutput(cpOverR, 'Cp/R')
  const boundedEnthalpyOverRT = finiteOutput(enthalpyOverRT, 'H/(R T)')
  const boundedEntropyOverR = finiteOutput(entropyOverR, 'S/R')
  throwIfAborted(...signals)
  return {
    temperatureK: temperature,
    interval: {
      lowerTemperatureK: interval.lowerTemperatureK,
      upperTemperatureK: interval.upperTemperatureK,
    },
    cpJPerMolK: finiteOutput(THERMOPY_GAS_CONSTANT_J_PER_MOL_K * boundedCpOverR, 'Cp'),
    enthalpyJPerMol: finiteOutput(THERMOPY_GAS_CONSTANT_J_PER_MOL_K * temperature * boundedEnthalpyOverRT, 'enthalpy'),
    entropyJPerMolK: finiteOutput(THERMOPY_GAS_CONSTANT_J_PER_MOL_K * boundedEntropyOverR, 'entropy'),
    cpOverR: boundedCpOverR,
    enthalpyOverRT: boundedEnthalpyOverRT,
    entropyOverR: boundedEntropyOverR,
    standardStatePressurePa: THERMOPY_STANDARD_STATE_PRESSURE_PA,
  }
}

export const evaluateThermopyNasa9 = calculateThermopyNasa9Properties

function solve(input: ThermopyNasa9InputV1, ...signals: readonly (AbortSignal | undefined)[]): ThermopyNasa9OutputV1 {
  throwIfAborted(...signals)
  const properties = calculateThermopyNasa9Properties(input.temperatureK, input.intervals, ...signals)
  const output: ThermopyNasa9OutputV1 = {
    operation: input.operation,
    ...properties,
    units: {
      temperature: 'K',
      cp: 'J/(mol*K)',
      enthalpy: 'J/mol',
      entropy: 'J/(mol*K)',
      cpOverR: '1',
      enthalpyOverRT: '1',
      entropyOverR: '1',
      standardStatePressure: 'Pa',
    },
    assumptions: [
      'The supplied nine coefficients use the NASA9 convention with temperature in kelvin and molar properties in SI units.',
      'Enthalpy and entropy are ideal-gas standard-state molar quantities; entropy uses a fixed standard pressure of 100000 Pa and no pressure correction.',
      'The caller supplies all coefficient arrays and temperature intervals; no species identity, composition, phase behavior, or property data is inferred.',
      'The selected interval includes both endpoints; supplied intervals must be sorted and non-overlapping.',
    ],
    numericalMethod: 'Direct bounded NASA9 polynomial evaluation with deterministic IEEE-754 arithmetic; no lookup table or external runtime is used.',
    doesNotEstablish: 'This educational evaluator does not establish equivalence to thermopy, correctness of caller-supplied coefficients, phase or mixture behavior, pressure-dependent properties, or experimental validation.',
    availability: 'unavailable',
    integrationStatus: 'provisional-adapter-not-registered',
    licenseGate: 'review',
    licenseCaveat: THERMOPY_SOURCE_CAVEATS.license,
  }
  throwIfAborted(...signals)
  assertOutputSize(output)
  return output
}

function descriptorString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'must be a non-empty string')
  return value
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-thermopy' || descriptor.title !== 'thermopy') {
    throw new TypeError('thermopy adapter requires the thermopy simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('thermopy adapter requires TypeScript execution')
  const adapterId = descriptor.adapterId === undefined ? THERMOPY_ADAPTER_ID : descriptorString(descriptor.adapterId, 'thermopy descriptor.adapterId')
  if (!/^[A-Za-z0-9_-]+$/.test(adapterId)) fail('thermopy descriptor.adapterId', 'must be a safe ID')
  return {
    adapterId,
    compatibility: {
      contentRevision: descriptorString(descriptor.contentRevision, 'thermopy descriptor.contentRevision'),
      modelRevision: descriptorString(descriptor.modelRevision, 'thermopy descriptor.modelRevision'),
      implementationRevision: descriptorString(descriptor.implementationRevision, 'thermopy descriptor.implementationRevision'),
      outputRevision: descriptorString(descriptor.outputRevision, 'thermopy descriptor.outputRevision'),
    },
  }
}

export const createThermopyAdapter: ThermopyAdapterFactoryV1 = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  const adapter: ThermopyAdapterV1 = {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      throwIfAborted(signal, runSignal)
      const output = solve(parseInput(input, signal, runSignal), signal, runSignal)
      throwIfAborted(signal, runSignal)
      return output
    },
  }
  return adapter
}

export const thermopyAdapterFactory = createThermopyAdapter
