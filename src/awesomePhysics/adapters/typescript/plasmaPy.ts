import { fail, jsonRecord as record, exactKeys, finiteNumber, boundedNumber, throwIfAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const PLASMAPY_ADAPTER_ID = 'awesome-plasmapy-typescript'
export const PLASMAPY_KERNEL_REVISION = 'plasmapy-formulary-typescript-v1'
export const PLASMAPY_SOURCE_REVISION = 'b15501f0ad6e'
export const PLASMAPY_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/PlasmaPy/PlasmaPy',
  license: 'PlasmaPy is BSD-3-Clause with a patent notice; descriptor license review remains required.',
  data: 'No PlasmaPy Python runtime, Astropy dependency, particle table, or external dataset is bundled.',
})

const EPSILON_0 = 8.8541878128e-12
const BOLTZMANN = 1.380649e-23
const ELEMENTARY_CHARGE = 1.602176634e-19
const MIN_TEMPERATURE = 1e-9
const MAX_TEMPERATURE = 1e9
const MIN_DENSITY = 1
const MAX_DENSITY = 1e30
const MAX_MAGNETIC_FIELD = 1e4
const MIN_NONZERO_MAGNETIC_FIELD = 1e-12
const MAX_ELECTRIC_FIELD = 1e12
const MIN_CHARGE = 1e-30
const MAX_CHARGE = 1e-15
const MIN_MASS = 1e-35
const MAX_MASS = 1e-20
const MAX_OUTPUT = 1e25

export type PlasmaPyVector3V1 = readonly [number, number, number]

export interface PlasmaPyDebyeLengthInputV1 {
  operation: 'debye-length'
  electronTemperatureK: number
  electronDensityPerM3: number
}

export interface PlasmaPyGyrofrequencyInputV1 {
  operation: 'gyrofrequency'
  magneticFieldT: number
  chargeC: number
  massKg: number
  signed?: boolean
}

export interface PlasmaPyExbDriftInputV1 {
  operation: 'exb-drift'
  electricFieldVPerM: PlasmaPyVector3V1
  magneticFieldT: PlasmaPyVector3V1
}

export type PlasmaPyInputV1 =
  | PlasmaPyDebyeLengthInputV1
  | PlasmaPyGyrofrequencyInputV1
  | PlasmaPyExbDriftInputV1

interface PlasmaPyScalarOutputV1 {
  operation: 'debye-length' | 'gyrofrequency'
  value: number
  units: 'm' | 'rad/s'
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

interface PlasmaPyVectorOutputV1 {
  operation: 'exb-drift'
  value: PlasmaPyVector3V1
  units: 'm/s'
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export type PlasmaPyOutputV1 = PlasmaPyScalarOutputV1 | PlasmaPyVectorOutputV1
export type PlasmaPyInput = PlasmaPyInputV1
export type PlasmaPyOutput = PlasmaPyOutputV1

function nonzeroMagnitude(value: unknown, path: string, minimum: number, maximum: number): number {
  const result = boundedNumber(value, path, -maximum, maximum)
  if (Math.abs(result) < minimum) fail(path, `must have magnitude at least ${minimum}`)
  return result
}

function signedVector3(value: unknown, path: string, maximum: number): PlasmaPyVector3V1 {
  if (!Array.isArray(value) || value.length !== 3) fail(path, 'must be a three-component array')
  return [
    boundedNumber(value[0], `${path}[0]`, -maximum, maximum),
    boundedNumber(value[1], `${path}[1]`, -maximum, maximum),
    boundedNumber(value[2], `${path}[2]`, -maximum, maximum),
  ]
}

function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_OUTPUT) throw new RangeError(`${path} is outside the finite output bound`)
  return value
}

function finiteOutputVector(value: PlasmaPyVector3V1, path: string): PlasmaPyVector3V1 {
  return [
    finiteOutput(value[0], `${path}[0]`),
    finiteOutput(value[1], `${path}[1]`),
    finiteOutput(value[2], `${path}[2]`),
  ]
}

export function calculateDebyeLengthM(temperatureK: number, electronDensityPerM3: number): number {
  const temperature = boundedNumber(temperatureK, 'electronTemperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE)
  const density = boundedNumber(electronDensityPerM3, 'electronDensityPerM3', MIN_DENSITY, MAX_DENSITY)
  return finiteOutput(Math.sqrt((EPSILON_0 * BOLTZMANN * temperature) / (density * ELEMENTARY_CHARGE ** 2)), 'Debye length')
}

export function calculateGyrofrequencyRadPerS(
  magneticFieldT: number,
  chargeC: number,
  massKg: number,
  signed = false,
): number {
  const magneticField = boundedNumber(magneticFieldT, 'magneticFieldT', 0, MAX_MAGNETIC_FIELD)
  const charge = nonzeroMagnitude(chargeC, 'chargeC', MIN_CHARGE, MAX_CHARGE)
  const mass = boundedNumber(massKg, 'massKg', MIN_MASS, MAX_MASS)
  const effectiveCharge = signed ? charge : Math.abs(charge)
  return finiteOutput((effectiveCharge * magneticField) / mass, 'gyrofrequency')
}

export function calculateExbDriftMPerS(
  electricFieldVPerM: PlasmaPyVector3V1,
  magneticFieldT: PlasmaPyVector3V1,
): PlasmaPyVector3V1 {
  const electric = signedVector3(electricFieldVPerM, 'electricFieldVPerM', MAX_ELECTRIC_FIELD)
  const magnetic = signedVector3(magneticFieldT, 'magneticFieldT', MAX_MAGNETIC_FIELD)
  const magneticMagnitudeSquared = magnetic[0] ** 2 + magnetic[1] ** 2 + magnetic[2] ** 2
  if (!Number.isFinite(magneticMagnitudeSquared) || Math.sqrt(magneticMagnitudeSquared) < MIN_NONZERO_MAGNETIC_FIELD) {
    fail('magneticFieldT', `must have magnitude at least ${MIN_NONZERO_MAGNETIC_FIELD}`)
  }
  const cross: PlasmaPyVector3V1 = [
    electric[1] * magnetic[2] - electric[2] * magnetic[1],
    electric[2] * magnetic[0] - electric[0] * magnetic[2],
    electric[0] * magnetic[1] - electric[1] * magnetic[0],
  ]
  return finiteOutputVector([
    cross[0] / magneticMagnitudeSquared,
    cross[1] / magneticMagnitudeSquared,
    cross[2] / magneticMagnitudeSquared,
  ], 'E-cross-B drift')
}

function parseInput(input: unknown): PlasmaPyInputV1 {
  const object = record(input, 'PlasmaPy input')
  if (typeof object.operation !== 'string') fail('PlasmaPy input.operation', 'must be a supported operation')

  switch (object.operation) {
    case 'debye-length':
      exactKeys(object, ['operation', 'electronTemperatureK', 'electronDensityPerM3'], [], 'PlasmaPy input')
      return {
        operation: 'debye-length',
        electronTemperatureK: boundedNumber(object.electronTemperatureK, 'PlasmaPy input.electronTemperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE),
        electronDensityPerM3: boundedNumber(object.electronDensityPerM3, 'PlasmaPy input.electronDensityPerM3', MIN_DENSITY, MAX_DENSITY),
      }
    case 'gyrofrequency': {
      exactKeys(object, ['operation', 'magneticFieldT', 'chargeC', 'massKg'], ['signed'], 'PlasmaPy input')
      const signed = Object.hasOwn(object, 'signed') ? object.signed : false
      if (typeof signed !== 'boolean') fail('PlasmaPy input.signed', 'must be a boolean')
      return {
        operation: 'gyrofrequency',
        magneticFieldT: boundedNumber(object.magneticFieldT, 'PlasmaPy input.magneticFieldT', 0, MAX_MAGNETIC_FIELD),
        chargeC: nonzeroMagnitude(object.chargeC, 'PlasmaPy input.chargeC', MIN_CHARGE, MAX_CHARGE),
        massKg: boundedNumber(object.massKg, 'PlasmaPy input.massKg', MIN_MASS, MAX_MASS),
        signed,
      }
    }
    case 'exb-drift':
      exactKeys(object, ['operation', 'electricFieldVPerM', 'magneticFieldT'], [], 'PlasmaPy input')
      return {
        operation: 'exb-drift',
        electricFieldVPerM: signedVector3(object.electricFieldVPerM, 'PlasmaPy input.electricFieldVPerM', MAX_ELECTRIC_FIELD),
        magneticFieldT: signedVector3(object.magneticFieldT, 'PlasmaPy input.magneticFieldT', MAX_MAGNETIC_FIELD),
      }
    default:
      fail('PlasmaPy input.operation', 'must be debye-length, gyrofrequency, or exb-drift')
  }
}

function solve(input: PlasmaPyInputV1, signal?: AbortSignal): PlasmaPyOutputV1 {
  throwIfAborted(signal)
  if (input.operation === 'debye-length') {
    return {
      operation: input.operation,
      value: calculateDebyeLengthM(input.electronTemperatureK, input.electronDensityPerM3),
      units: 'm',
      assumptions: [
        'Electron temperature is supplied in kelvin and electron density in inverse cubic metres.',
        'Ions are stationary and screening uses the scalar electron Debye-length expression.',
      ],
      numericalMethod: 'Direct SI evaluation of sqrt(epsilon_0 k_B T_e / (n_e e^2)).',
      licenseCaveat: PLASMAPY_SOURCE_CAVEATS.license,
    }
  }
  if (input.operation === 'gyrofrequency') {
    return {
      operation: input.operation,
      value: calculateGyrofrequencyRadPerS(input.magneticFieldT, input.chargeC, input.massKg, input.signed),
      units: 'rad/s',
      assumptions: [
        'Magnetic field is a scalar magnitude in tesla; mass and charge are supplied directly in SI units.',
        'The unsigned form uses |q| and the signed form preserves the sign of q.',
      ],
      numericalMethod: 'Direct SI evaluation of omega_c = q B / m.',
      licenseCaveat: PLASMAPY_SOURCE_CAVEATS.license,
    }
  }
  return {
    operation: input.operation,
    value: calculateExbDriftMPerS(input.electricFieldVPerM, input.magneticFieldT),
    units: 'm/s',
    assumptions: [
      'Electric and magnetic fields are three-component Cartesian vectors in SI units.',
      'The drift is the electrostatic E cross B expression and is independent of particle charge.',
    ],
    numericalMethod: 'Direct vector evaluation of (E cross B) / |B|^2.',
    licenseCaveat: PLASMAPY_SOURCE_CAVEATS.license,
  }
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-plasmapy' || descriptor.title !== 'PlasmaPy') {
    throw new TypeError('PlasmaPy adapter requires the PlasmaPy simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('PlasmaPy adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.length === 0)) {
    throw new TypeError('PlasmaPy descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('PlasmaPy descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? PLASMAPY_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createPlasmaPyAdapter: AwesomePhysicsAdapterFactoryV1<PlasmaPyInputV1, PlasmaPyOutputV1> = (descriptor, signal) => {
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

export const plasmaPyAdapterFactory = createPlasmaPyAdapter
