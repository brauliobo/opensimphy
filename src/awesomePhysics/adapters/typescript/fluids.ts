import { fail, jsonRecord as record, exactKeys, finiteNumber, boundedNumber, throwIfAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const FLUIDS_ADAPTER_ID = 'awesome-fluids-typescript'
export const FLUIDS_KERNEL_REVISION = 'fluids-core-typescript-v1'
export const FLUIDS_SOURCE_REVISION = '5fa218f9c15f'
export const FLUIDS_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/CalebBell/fluids',
  license: 'fluids is MIT-licensed; descriptor license integration remains required.',
  data: 'No fluids data tables, Python runtime, SciPy compatibility layer, or external dataset is bundled.',
})

const GAS_CONSTANT = 8.31446261815324
const MIN_TEMPERATURE = 1
const MAX_TEMPERATURE = 5000
const MIN_ISENTROPIC_EXPONENT = 1
const MAX_ISENTROPIC_EXPONENT = 2
const MIN_MOLAR_MASS_G_PER_MOL = 0.1
const MAX_MOLAR_MASS_G_PER_MOL = 300
const MAX_VELOCITY = 1e5
const MIN_DIAMETER = 1e-12
const MAX_DIAMETER = 1e3
const MIN_DENSITY = 1e-6
const MAX_DENSITY = 2e4
const MIN_DYNAMIC_VISCOSITY = 1e-12
const MAX_DYNAMIC_VISCOSITY = 1e3
const MIN_CONDUCTIVITY = 1e-8
const MAX_CONDUCTIVITY = 1e4
const MIN_HEAT_CAPACITY = 1
const MAX_HEAT_CAPACITY = 1e5
const MAX_OUTPUT = 1e25

export interface FluidsIdealGasSoundSpeedInputV1 {
  operation: 'ideal-gas-sound-speed'
  temperatureK: number
  isentropicExponent: number
  molarMassGPerMol: number
}

export interface FluidsReynoldsInputV1 {
  operation: 'reynolds'
  velocityMPerS: number
  diameterM: number
  densityKgPerM3: number
  dynamicViscosityPaS: number
}

export interface FluidsThermalDiffusivityInputV1 {
  operation: 'thermal-diffusivity'
  conductivityWPerMK: number
  densityKgPerM3: number
  heatCapacityJPerKgK: number
}

export type FluidsInputV1 =
  | FluidsIdealGasSoundSpeedInputV1
  | FluidsReynoldsInputV1
  | FluidsThermalDiffusivityInputV1

interface FluidsScalarOutputV1 {
  operation: FluidsInputV1['operation']
  value: number
  units: 'm/s' | '1' | 'm^2/s'
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export type FluidsOutputV1 = FluidsScalarOutputV1
export type FluidsInput = FluidsInputV1
export type FluidsOutput = FluidsOutputV1

function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_OUTPUT) throw new RangeError(`${path} is outside the finite output bound`)
  return value
}

export function calculateFluidsIdealGasSoundSpeedMPerS(
  temperatureK: number,
  isentropicExponent: number,
  molarMassGPerMol: number,
): number {
  const temperature = boundedNumber(temperatureK, 'temperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE)
  const exponent = boundedNumber(isentropicExponent, 'isentropicExponent', MIN_ISENTROPIC_EXPONENT, MAX_ISENTROPIC_EXPONENT)
  const molarMass = boundedNumber(molarMassGPerMol, 'molarMassGPerMol', MIN_MOLAR_MASS_G_PER_MOL, MAX_MOLAR_MASS_G_PER_MOL)
  const specificGasConstant = (GAS_CONSTANT * 1000) / molarMass
  return finiteOutput(Math.sqrt(exponent * specificGasConstant * temperature), 'ideal-gas sound speed')
}

export function calculateFluidsReynolds(
  velocityMPerS: number,
  diameterM: number,
  densityKgPerM3: number,
  dynamicViscosityPaS: number,
): number {
  const velocity = boundedNumber(velocityMPerS, 'velocityMPerS', 0, MAX_VELOCITY)
  const diameter = boundedNumber(diameterM, 'diameterM', MIN_DIAMETER, MAX_DIAMETER)
  const density = boundedNumber(densityKgPerM3, 'densityKgPerM3', MIN_DENSITY, MAX_DENSITY)
  const viscosity = boundedNumber(dynamicViscosityPaS, 'dynamicViscosityPaS', MIN_DYNAMIC_VISCOSITY, MAX_DYNAMIC_VISCOSITY)
  return finiteOutput((density * velocity * diameter) / viscosity, 'Reynolds number')
}

export function calculateFluidsThermalDiffusivityM2PerS(
  conductivityWPerMK: number,
  densityKgPerM3: number,
  heatCapacityJPerKgK: number,
): number {
  const conductivity = boundedNumber(conductivityWPerMK, 'conductivityWPerMK', MIN_CONDUCTIVITY, MAX_CONDUCTIVITY)
  const density = boundedNumber(densityKgPerM3, 'densityKgPerM3', MIN_DENSITY, MAX_DENSITY)
  const heatCapacity = boundedNumber(heatCapacityJPerKgK, 'heatCapacityJPerKgK', MIN_HEAT_CAPACITY, MAX_HEAT_CAPACITY)
  return finiteOutput(conductivity / (density * heatCapacity), 'thermal diffusivity')
}

function parseInput(input: unknown): FluidsInputV1 {
  const object = record(input, 'fluids input')
  if (typeof object.operation !== 'string') fail('fluids input.operation', 'must be a supported operation')
  switch (object.operation) {
    case 'ideal-gas-sound-speed':
      exactKeys(object, ['operation', 'temperatureK', 'isentropicExponent', 'molarMassGPerMol'], 'fluids input')
      return {
        operation: 'ideal-gas-sound-speed',
        temperatureK: boundedNumber(object.temperatureK, 'fluids input.temperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE),
        isentropicExponent: boundedNumber(object.isentropicExponent, 'fluids input.isentropicExponent', MIN_ISENTROPIC_EXPONENT, MAX_ISENTROPIC_EXPONENT),
        molarMassGPerMol: boundedNumber(object.molarMassGPerMol, 'fluids input.molarMassGPerMol', MIN_MOLAR_MASS_G_PER_MOL, MAX_MOLAR_MASS_G_PER_MOL),
      }
    case 'reynolds':
      exactKeys(object, ['operation', 'velocityMPerS', 'diameterM', 'densityKgPerM3', 'dynamicViscosityPaS'], 'fluids input')
      return {
        operation: 'reynolds',
        velocityMPerS: boundedNumber(object.velocityMPerS, 'fluids input.velocityMPerS', 0, MAX_VELOCITY),
        diameterM: boundedNumber(object.diameterM, 'fluids input.diameterM', MIN_DIAMETER, MAX_DIAMETER),
        densityKgPerM3: boundedNumber(object.densityKgPerM3, 'fluids input.densityKgPerM3', MIN_DENSITY, MAX_DENSITY),
        dynamicViscosityPaS: boundedNumber(object.dynamicViscosityPaS, 'fluids input.dynamicViscosityPaS', MIN_DYNAMIC_VISCOSITY, MAX_DYNAMIC_VISCOSITY),
      }
    case 'thermal-diffusivity':
      exactKeys(object, ['operation', 'conductivityWPerMK', 'densityKgPerM3', 'heatCapacityJPerKgK'], 'fluids input')
      return {
        operation: 'thermal-diffusivity',
        conductivityWPerMK: boundedNumber(object.conductivityWPerMK, 'fluids input.conductivityWPerMK', MIN_CONDUCTIVITY, MAX_CONDUCTIVITY),
        densityKgPerM3: boundedNumber(object.densityKgPerM3, 'fluids input.densityKgPerM3', MIN_DENSITY, MAX_DENSITY),
        heatCapacityJPerKgK: boundedNumber(object.heatCapacityJPerKgK, 'fluids input.heatCapacityJPerKgK', MIN_HEAT_CAPACITY, MAX_HEAT_CAPACITY),
      }
    default:
      fail('fluids input.operation', 'must be ideal-gas-sound-speed, reynolds, or thermal-diffusivity')
  }
}

function solve(input: FluidsInputV1, signal?: AbortSignal): FluidsOutputV1 {
  throwIfAborted(signal)
  if (input.operation === 'ideal-gas-sound-speed') {
    return {
      operation: input.operation,
      value: calculateFluidsIdealGasSoundSpeedMPerS(input.temperatureK, input.isentropicExponent, input.molarMassGPerMol),
      units: 'm/s',
      assumptions: [
        'The fluid is an ideal gas with constant isentropic exponent.',
        'Molar mass is supplied in grams per mole and converted to the SI specific gas constant.',
      ],
      numericalMethod: 'Direct SI evaluation of sqrt(k R_specific T).',
      licenseCaveat: FLUIDS_SOURCE_CAVEATS.license,
    }
  }
  if (input.operation === 'reynolds') {
    return {
      operation: input.operation,
      value: calculateFluidsReynolds(input.velocityMPerS, input.diameterM, input.densityKgPerM3, input.dynamicViscosityPaS),
      units: '1',
      assumptions: [
        'Velocity and diameter describe a single characteristic flow scale.',
        'Dynamic viscosity is supplied in pascal seconds; the result is the rho V D / mu form.',
      ],
      numericalMethod: 'Direct dimensionless Reynolds-number evaluation.',
      licenseCaveat: FLUIDS_SOURCE_CAVEATS.license,
    }
  }
  return {
    operation: input.operation,
    value: calculateFluidsThermalDiffusivityM2PerS(input.conductivityWPerMK, input.densityKgPerM3, input.heatCapacityJPerKgK),
    units: 'm^2/s',
    assumptions: [
      'Thermal conductivity, density, and heat capacity are constant over the evaluated state.',
      'The property is the scalar alpha = k / (rho C_p) expression.',
    ],
    numericalMethod: 'Direct SI evaluation of k / (rho C_p).',
    licenseCaveat: FLUIDS_SOURCE_CAVEATS.license,
  }
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-fluids' || descriptor.title !== 'fluids') {
    throw new TypeError('fluids adapter requires the fluids simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('fluids adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.length === 0)) {
    throw new TypeError('fluids descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('fluids descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? FLUIDS_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createFluidsAdapter: AwesomePhysicsAdapterFactoryV1<FluidsInputV1, FluidsOutputV1> = (descriptor, signal) => {
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

export const fluidsAdapterFactory = createFluidsAdapter
