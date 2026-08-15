import type {
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const THERMO_ADAPTER_ID = 'awesome-thermo-typescript'
export const THERMO_KERNEL_REVISION = 'thermo-ideal-gas-phase-typescript-v1'
export const THERMO_SOURCE_REVISION = '2bb466e98439'
export const THERMO_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/CalebBell/thermo',
  license: 'thermo is MIT-licensed; its broad property databases and descriptor license review are not included here.',
  data: 'No thermo correlation tables, chemicals dependency, Python runtime, or external dataset is bundled.',
})

const GAS_CONSTANT = 8.31446261815324
const MIN_TEMPERATURE = 1
const MAX_TEMPERATURE = 5000
const MIN_PRESSURE = 1
const MAX_PRESSURE = 1e9
const MIN_AMOUNT = 1e-12
const MAX_AMOUNT = 1e6
const MIN_MOLAR_MASS = 1e-6
const MAX_MOLAR_MASS = 1
const NORMAL_PRESSURE_MIN = 9e4
const NORMAL_PRESSURE_MAX = 1.1e5
const MAX_OUTPUT = 1e25

export interface ThermoIdealGasStateInputV1 {
  operation: 'ideal-gas-state'
  temperatureK: number
  pressurePa: number
  amountMol: number
  molarMassKgPerMol: number
}

export interface ThermoPhaseInputV1 {
  operation: 'phase'
  temperatureK: number
  pressurePa: number
  meltingTemperatureK: number
  boilingTemperatureK: number
}

export type ThermoInputV1 = ThermoIdealGasStateInputV1 | ThermoPhaseInputV1

export interface ThermoIdealGasStateOutputV1 {
  operation: 'ideal-gas-state'
  molarVolumeM3PerMol: number
  volumeM3: number
  densityKgPerM3: number
  compressibilityFactor: 1
  fugacityPa: number
  units: {
    molarVolume: 'm^3/mol'
    volume: 'm^3'
    density: 'kg/m^3'
    compressibilityFactor: '1'
    fugacity: 'Pa'
  }
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export interface ThermoPhaseOutputV1 {
  operation: 'phase'
  phase: 'solid' | 'liquid' | 'gas'
  units: 'category'
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export type ThermoOutputV1 = ThermoIdealGasStateOutputV1 | ThermoPhaseOutputV1
export type ThermoInput = ThermoInputV1
export type ThermoOutput = ThermoOutputV1

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

function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_OUTPUT) throw new RangeError(`${path} is outside the finite output bound`)
  return value
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  if (signal.reason instanceof Error) throw signal.reason
  const error = new Error('The operation was aborted')
  error.name = 'AbortError'
  throw error
}

export function calculateThermoIdealGasState(
  temperatureK: number,
  pressurePa: number,
  amountMol: number,
  molarMassKgPerMol: number,
): Pick<ThermoIdealGasStateOutputV1, 'molarVolumeM3PerMol' | 'volumeM3' | 'densityKgPerM3' | 'compressibilityFactor' | 'fugacityPa'> {
  const temperature = boundedNumber(temperatureK, 'temperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE)
  const pressure = boundedNumber(pressurePa, 'pressurePa', MIN_PRESSURE, MAX_PRESSURE)
  const amount = boundedNumber(amountMol, 'amountMol', MIN_AMOUNT, MAX_AMOUNT)
  const molarMass = boundedNumber(molarMassKgPerMol, 'molarMassKgPerMol', MIN_MOLAR_MASS, MAX_MOLAR_MASS)
  const molarVolume = finiteOutput((GAS_CONSTANT * temperature) / pressure, 'molar volume')
  const volume = finiteOutput(amount * molarVolume, 'volume')
  const density = finiteOutput(molarMass / molarVolume, 'mass density')
  return {
    molarVolumeM3PerMol: molarVolume,
    volumeM3: volume,
    densityKgPerM3: density,
    compressibilityFactor: 1,
    fugacityPa: pressure,
  }
}

export function identifyThermoPhase(
  temperatureK: number,
  pressurePa: number,
  meltingTemperatureK: number,
  boilingTemperatureK: number,
): ThermoPhaseOutputV1['phase'] {
  const temperature = boundedNumber(temperatureK, 'temperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE)
  const pressure = boundedNumber(pressurePa, 'pressurePa', NORMAL_PRESSURE_MIN, NORMAL_PRESSURE_MAX)
  const melting = boundedNumber(meltingTemperatureK, 'meltingTemperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE)
  const boiling = boundedNumber(boilingTemperatureK, 'boilingTemperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE)
  if (pressure <= NORMAL_PRESSURE_MIN || pressure >= NORMAL_PRESSURE_MAX) fail('pressurePa', 'must be strictly inside the normal-pressure phase-rule interval')
  if (melting >= boiling) fail('phase temperatures', 'meltingTemperatureK must be below boilingTemperatureK')
  if (temperature <= melting) return 'solid'
  if (temperature < boiling) return 'liquid'
  void pressure
  return 'gas'
}

function parseInput(input: unknown): ThermoInputV1 {
  const object = record(input, 'thermo input')
  if (typeof object.operation !== 'string') fail('thermo input.operation', 'must be a supported operation')
  switch (object.operation) {
    case 'ideal-gas-state':
      exactKeys(object, ['operation', 'temperatureK', 'pressurePa', 'amountMol', 'molarMassKgPerMol'], 'thermo input')
      return {
        operation: 'ideal-gas-state',
        temperatureK: boundedNumber(object.temperatureK, 'thermo input.temperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE),
        pressurePa: boundedNumber(object.pressurePa, 'thermo input.pressurePa', MIN_PRESSURE, MAX_PRESSURE),
        amountMol: boundedNumber(object.amountMol, 'thermo input.amountMol', MIN_AMOUNT, MAX_AMOUNT),
        molarMassKgPerMol: boundedNumber(object.molarMassKgPerMol, 'thermo input.molarMassKgPerMol', MIN_MOLAR_MASS, MAX_MOLAR_MASS),
      }
    case 'phase':
      exactKeys(object, ['operation', 'temperatureK', 'pressurePa', 'meltingTemperatureK', 'boilingTemperatureK'], 'thermo input')
      return {
        operation: 'phase',
        temperatureK: boundedNumber(object.temperatureK, 'thermo input.temperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE),
        pressurePa: boundedNumber(object.pressurePa, 'thermo input.pressurePa', NORMAL_PRESSURE_MIN, NORMAL_PRESSURE_MAX),
        meltingTemperatureK: boundedNumber(object.meltingTemperatureK, 'thermo input.meltingTemperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE),
        boilingTemperatureK: boundedNumber(object.boilingTemperatureK, 'thermo input.boilingTemperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE),
      }
    default:
      fail('thermo input.operation', 'must be ideal-gas-state or phase')
  }
}

function solve(input: ThermoInputV1, signal?: AbortSignal): ThermoOutputV1 {
  throwIfAborted(signal)
  if (input.operation === 'ideal-gas-state') {
    const state = calculateThermoIdealGasState(input.temperatureK, input.pressurePa, input.amountMol, input.molarMassKgPerMol)
    return {
      operation: input.operation,
      ...state,
      units: {
        molarVolume: 'm^3/mol',
        volume: 'm^3',
        density: 'kg/m^3',
        compressibilityFactor: '1',
        fugacity: 'Pa',
      },
      assumptions: [
        'The phase is a single-component ideal gas with P V_m = R T and fugacity coefficient one.',
        'Molar mass is supplied in kilograms per mole; no composition or non-ideal correction is applied.',
      ],
      numericalMethod: 'Direct SI evaluation of V_m = R T / P and f = P.',
      licenseCaveat: THERMO_SOURCE_CAVEATS.license,
    }
  }
  return {
    operation: input.operation,
    phase: identifyThermoPhase(input.temperatureK, input.pressurePa, input.meltingTemperatureK, input.boilingTemperatureK),
    units: 'category',
    assumptions: [
      'Melting and boiling temperatures are treated as fixed thresholds at approximately normal pressure.',
      'No pressure shift, critical point, two-phase interval, or vapor-pressure correlation is modeled.',
    ],
    numericalMethod: 'Deterministic threshold classification: T <= Tm solid, T < Tb liquid, otherwise gas.',
    licenseCaveat: THERMO_SOURCE_CAVEATS.license,
  }
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-thermo' || descriptor.title !== 'thermo') {
    throw new TypeError('thermo adapter requires the thermo simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('thermo adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.length === 0)) {
    throw new TypeError('thermo descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('thermo descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? THERMO_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createThermoAdapter: AwesomePhysicsAdapterFactoryV1<ThermoInputV1, ThermoOutputV1> = (descriptor, signal) => {
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

export const thermoAdapterFactory = createThermoAdapter
