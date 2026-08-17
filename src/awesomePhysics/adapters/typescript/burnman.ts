import { fail, jsonRecord as record, exactKeys, finiteNumber, boundedNumber, throwIfAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const BURNMAN_ADAPTER_ID = 'awesome-burnman-typescript'
export const BURNMAN_KERNEL_REVISION = 'burnman-thermoelastic-proxy-typescript-v1'
export const BURNMAN_SOURCE_REVISION = 'f743a077292b'
export const BURNMAN_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/geodynamics/burnman',
  license: 'BurnMan is GPL-2-or-later; descriptor license review is required before any integration.',
  data: 'No BurnMan mineral library, SciPy/Numba runtime, seismic table, or external dataset is bundled.',
})

const MIN_TEMPERATURE = 1
const MAX_TEMPERATURE = 5000
const MAX_PRESSURE = 1e12
const MIN_DENSITY = 100
const MAX_DENSITY = 2e4
const MIN_BULK_MODULUS = 1e8
const MAX_BULK_MODULUS = 1e14
const MAX_THERMAL_EXPANSIVITY = 1e-3
const MAX_VOLUME_RATIO = 3
const MIN_VOLUME_RATIO = 1e-3
const MIN_SHEAR_MODULUS = 0
const MAX_OUTPUT = 1e6

export interface BurnmanDensityInputV1 {
  operation: 'density'
  pressurePa: number
  temperatureK: number
  referenceTemperatureK: number
  referenceDensityKgPerM3: number
  bulkModulusPa: number
  thermalExpansivityPerK: number
}

export interface BurnmanThermalExpansionInputV1 {
  operation: 'thermal-expansion'
  temperatureK: number
  referenceTemperatureK: number
  thermalExpansivityPerK: number
}

export interface BurnmanSeismicProxyInputV1 {
  operation: 'seismic-proxy'
  densityKgPerM3: number
  bulkModulusPa: number
  shearModulusPa: number
}

export type BurnmanInputV1 = BurnmanDensityInputV1 | BurnmanThermalExpansionInputV1 | BurnmanSeismicProxyInputV1

export interface BurnmanDensityOutputV1 {
  operation: 'density'
  densityKgPerM3: number
  volumeRatio: number
  units: {
    density: 'kg/m^3'
    volumeRatio: '1'
  }
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export interface BurnmanThermalExpansionOutputV1 {
  operation: 'thermal-expansion'
  volumeRatio: number
  volumetricStrain: number
  units: {
    volumeRatio: '1'
    volumetricStrain: '1'
  }
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export interface BurnmanSeismicProxyOutputV1 {
  operation: 'seismic-proxy'
  pWaveVelocityMPerS: number
  sWaveVelocityMPerS: number
  bulkSoundVelocityMPerS: number
  units: {
    pWaveVelocity: 'm/s'
    sWaveVelocity: 'm/s'
    bulkSoundVelocity: 'm/s'
  }
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export type BurnmanOutputV1 = BurnmanDensityOutputV1 | BurnmanThermalExpansionOutputV1 | BurnmanSeismicProxyOutputV1
export type BurnmanInput = BurnmanInputV1
export type BurnmanOutput = BurnmanOutputV1

function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_OUTPUT) throw new RangeError(`${path} is outside the finite output bound`)
  return value
}

function volumeRatio(pressurePa: number, temperatureK: number, referenceTemperatureK: number, bulkModulusPa: number, thermalExpansivityPerK: number): number {
  const pressure = boundedNumber(pressurePa, 'pressurePa', 0, MAX_PRESSURE)
  const temperature = boundedNumber(temperatureK, 'temperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE)
  const referenceTemperature = boundedNumber(referenceTemperatureK, 'referenceTemperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE)
  const bulkModulus = boundedNumber(bulkModulusPa, 'bulkModulusPa', MIN_BULK_MODULUS, MAX_BULK_MODULUS)
  const alpha = boundedNumber(thermalExpansivityPerK, 'thermalExpansivityPerK', 0, MAX_THERMAL_EXPANSIVITY)
  const result = (1 - pressure / bulkModulus) * (1 + alpha * (temperature - referenceTemperature))
  if (!Number.isFinite(result) || result < MIN_VOLUME_RATIO || result > MAX_VOLUME_RATIO) {
    throw new RangeError('BurnMan volume ratio is outside the bounded linearized state domain')
  }
  return result
}

export function calculateBurnmanDensityKgPerM3(
  pressurePa: number,
  temperatureK: number,
  referenceTemperatureK: number,
  referenceDensityKgPerM3: number,
  bulkModulusPa: number,
  thermalExpansivityPerK: number,
): { densityKgPerM3: number; volumeRatio: number } {
  const referenceDensity = boundedNumber(referenceDensityKgPerM3, 'referenceDensityKgPerM3', MIN_DENSITY, MAX_DENSITY)
  const ratio = volumeRatio(pressurePa, temperatureK, referenceTemperatureK, bulkModulusPa, thermalExpansivityPerK)
  return {
    densityKgPerM3: finiteOutput(referenceDensity / ratio, 'density'),
    volumeRatio: ratio,
  }
}

export function calculateBurnmanThermalExpansion(
  temperatureK: number,
  referenceTemperatureK: number,
  thermalExpansivityPerK: number,
): { volumeRatio: number; volumetricStrain: number } {
  const ratio = volumeRatio(0, temperatureK, referenceTemperatureK, MIN_BULK_MODULUS, thermalExpansivityPerK)
  return {
    volumeRatio: ratio,
    volumetricStrain: finiteOutput(ratio - 1, 'volumetric strain'),
  }
}

export function calculateBurnmanSeismicProxy(
  densityKgPerM3: number,
  bulkModulusPa: number,
  shearModulusPa: number,
): { pWaveVelocityMPerS: number; sWaveVelocityMPerS: number; bulkSoundVelocityMPerS: number } {
  const density = boundedNumber(densityKgPerM3, 'densityKgPerM3', MIN_DENSITY, MAX_DENSITY)
  const bulkModulus = boundedNumber(bulkModulusPa, 'bulkModulusPa', MIN_BULK_MODULUS, MAX_BULK_MODULUS)
  const shearModulus = boundedNumber(shearModulusPa, 'shearModulusPa', MIN_SHEAR_MODULUS, MAX_BULK_MODULUS)
  return {
    pWaveVelocityMPerS: finiteOutput(Math.sqrt((bulkModulus + (4 / 3) * shearModulus) / density), 'P-wave velocity'),
    sWaveVelocityMPerS: finiteOutput(Math.sqrt(shearModulus / density), 'S-wave velocity'),
    bulkSoundVelocityMPerS: finiteOutput(Math.sqrt(bulkModulus / density), 'bulk sound velocity'),
  }
}

function parseInput(input: unknown): BurnmanInputV1 {
  const object = record(input, 'burnman input')
  if (typeof object.operation !== 'string') fail('burnman input.operation', 'must be a supported operation')
  switch (object.operation) {
    case 'density':
      exactKeys(object, ['operation', 'pressurePa', 'temperatureK', 'referenceTemperatureK', 'referenceDensityKgPerM3', 'bulkModulusPa', 'thermalExpansivityPerK'], 'burnman input')
      return {
        operation: 'density',
        pressurePa: boundedNumber(object.pressurePa, 'burnman input.pressurePa', 0, MAX_PRESSURE),
        temperatureK: boundedNumber(object.temperatureK, 'burnman input.temperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE),
        referenceTemperatureK: boundedNumber(object.referenceTemperatureK, 'burnman input.referenceTemperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE),
        referenceDensityKgPerM3: boundedNumber(object.referenceDensityKgPerM3, 'burnman input.referenceDensityKgPerM3', MIN_DENSITY, MAX_DENSITY),
        bulkModulusPa: boundedNumber(object.bulkModulusPa, 'burnman input.bulkModulusPa', MIN_BULK_MODULUS, MAX_BULK_MODULUS),
        thermalExpansivityPerK: boundedNumber(object.thermalExpansivityPerK, 'burnman input.thermalExpansivityPerK', 0, MAX_THERMAL_EXPANSIVITY),
      }
    case 'thermal-expansion':
      exactKeys(object, ['operation', 'temperatureK', 'referenceTemperatureK', 'thermalExpansivityPerK'], 'burnman input')
      return {
        operation: 'thermal-expansion',
        temperatureK: boundedNumber(object.temperatureK, 'burnman input.temperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE),
        referenceTemperatureK: boundedNumber(object.referenceTemperatureK, 'burnman input.referenceTemperatureK', MIN_TEMPERATURE, MAX_TEMPERATURE),
        thermalExpansivityPerK: boundedNumber(object.thermalExpansivityPerK, 'burnman input.thermalExpansivityPerK', 0, MAX_THERMAL_EXPANSIVITY),
      }
    case 'seismic-proxy':
      exactKeys(object, ['operation', 'densityKgPerM3', 'bulkModulusPa', 'shearModulusPa'], 'burnman input')
      return {
        operation: 'seismic-proxy',
        densityKgPerM3: boundedNumber(object.densityKgPerM3, 'burnman input.densityKgPerM3', MIN_DENSITY, MAX_DENSITY),
        bulkModulusPa: boundedNumber(object.bulkModulusPa, 'burnman input.bulkModulusPa', MIN_BULK_MODULUS, MAX_BULK_MODULUS),
        shearModulusPa: boundedNumber(object.shearModulusPa, 'burnman input.shearModulusPa', MIN_SHEAR_MODULUS, MAX_BULK_MODULUS),
      }
    default:
      fail('burnman input.operation', 'must be density, thermal-expansion, or seismic-proxy')
  }
}

function solve(input: BurnmanInputV1, signal?: AbortSignal): BurnmanOutputV1 {
  throwIfAborted(signal)
  if (input.operation === 'density') {
    const result = calculateBurnmanDensityKgPerM3(
      input.pressurePa,
      input.temperatureK,
      input.referenceTemperatureK,
      input.referenceDensityKgPerM3,
      input.bulkModulusPa,
      input.thermalExpansivityPerK,
    )
    return {
      operation: input.operation,
      ...result,
      units: { density: 'kg/m^3', volumeRatio: '1' },
      assumptions: [
        'Reference density is converted through a linearized volumetric strain: (1 - P/K_0)(1 + alpha DeltaT).',
        'Bulk modulus and thermal expansivity are constant; no mineral-specific equation of state is selected.',
      ],
      numericalMethod: 'Direct bounded density proxy rho = rho_0 / volumeRatio.',
      licenseCaveat: BURNMAN_SOURCE_CAVEATS.license,
    }
  }
  if (input.operation === 'thermal-expansion') {
    const result = calculateBurnmanThermalExpansion(input.temperatureK, input.referenceTemperatureK, input.thermalExpansivityPerK)
    return {
      operation: input.operation,
      ...result,
      units: { volumeRatio: '1', volumetricStrain: '1' },
      assumptions: [
        'The supplied expansivity is a constant volumetric coefficient in inverse kelvin.',
        'Pressure is held at the reference state; phase transitions and anisotropy are excluded.',
      ],
      numericalMethod: 'Direct bounded evaluation of V/V_0 = 1 + alpha DeltaT.',
      licenseCaveat: BURNMAN_SOURCE_CAVEATS.license,
    }
  }
  const result = calculateBurnmanSeismicProxy(input.densityKgPerM3, input.bulkModulusPa, input.shearModulusPa)
  return {
    operation: input.operation,
    ...result,
    units: { pWaveVelocity: 'm/s', sWaveVelocity: 'm/s', bulkSoundVelocity: 'm/s' },
    assumptions: [
      'Bulk and shear moduli are treated as positive isotropic elastic moduli in SI units.',
      'The proxy uses v_p = sqrt((K + 4G/3)/rho), v_s = sqrt(G/rho), and v_phi = sqrt(K/rho).',
    ],
    numericalMethod: 'Direct elastic-wave velocity evaluation without a seismic table or ray tracer.',
    licenseCaveat: BURNMAN_SOURCE_CAVEATS.license,
  }
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-burnman' || descriptor.title !== 'burnman') {
    throw new TypeError('burnman adapter requires the burnman simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('burnman adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.length === 0)) {
    throw new TypeError('burnman descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('burnman descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? BURNMAN_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createBurnmanAdapter: AwesomePhysicsAdapterFactoryV1<BurnmanInputV1, BurnmanOutputV1> = (descriptor, signal) => {
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

export const burnmanAdapterFactory = createBurnmanAdapter
