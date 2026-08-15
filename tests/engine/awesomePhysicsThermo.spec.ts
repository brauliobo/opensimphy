import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  BURNMAN_ADAPTER_ID,
  BURNMAN_SOURCE_CAVEATS,
  calculateBurnmanDensityKgPerM3,
  calculateBurnmanSeismicProxy,
  calculateBurnmanThermalExpansion,
  createBurnmanAdapter,
} from '../../src/awesomePhysics/adapters/typescript/burnman'
import {
  calculateDebyeLengthM,
  calculateExbDriftMPerS,
  calculateGyrofrequencyRadPerS,
  createPlasmaPyAdapter,
  PLASMAPY_ADAPTER_ID,
  PLASMAPY_SOURCE_CAVEATS,
} from '../../src/awesomePhysics/adapters/typescript/plasmaPy'
import {
  calculateFluidsIdealGasSoundSpeedMPerS,
  calculateFluidsReynolds,
  calculateFluidsThermalDiffusivityM2PerS,
  createFluidsAdapter,
  FLUIDS_ADAPTER_ID,
  FLUIDS_SOURCE_CAVEATS,
} from '../../src/awesomePhysics/adapters/typescript/fluids'
import {
  calculateThermoIdealGasState,
  createThermoAdapter,
  identifyThermoPhase,
  THERMO_ADAPTER_ID,
  THERMO_SOURCE_CAVEATS,
} from '../../src/awesomePhysics/adapters/typescript/thermo'
import type {
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1

function descriptorFor(catalogItemId: string, title: string, adapterId: string): AwesomePhysicsSimulationDescriptorV1 {
  const source = simulations.items.find((item) => item.catalogItemId === catalogItemId)
  if (!source) throw new Error(`Missing descriptor for ${catalogItemId}`)
  return {
    ...source,
    adapterId,
    availability: 'available',
    runnable: true,
    title,
  }
}

function expectFiniteJson(value: unknown): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value)).toBe(true)
    expect(Math.abs(value)).toBeLessThanOrEqual(1e25)
    return
  }
  if (Array.isArray(value)) {
    value.forEach(expectFiniteJson)
    return
  }
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(expectFiniteJson)
  }
  const serialized = JSON.stringify(value)
  expect(serialized).not.toBeUndefined()
}

function expectCompatibility(adapter: { adapterId: string; protocol: string; compatibility: Record<string, string> }, descriptor: AwesomePhysicsSimulationDescriptorV1): void {
  expect(adapter.protocol).toBe('awesome-physics-adapter-v1')
  expect(adapter.adapterId).toBe(descriptor.adapterId)
  expect(adapter.compatibility).toEqual({
    contentRevision: descriptor.contentRevision,
    modelRevision: descriptor.modelRevision,
    implementationRevision: descriptor.implementationRevision,
    outputRevision: descriptor.outputRevision,
  })
}

describe('Awesome Physics TypeScript plasma and thermo adapters', () => {
  it('evaluates PlasmaPy formulas with SI units and reference values', () => {
    const descriptor = descriptorFor('awesome-plasmapy', 'PlasmaPy', PLASMAPY_ADAPTER_ID)
    const adapter = createPlasmaPyAdapter(descriptor, new AbortController().signal)
    expectCompatibility(adapter, descriptor)

    const debye = adapter.run({
      operation: 'debye-length',
      electronTemperatureK: 5e6,
      electronDensityPerM3: 5e15,
    })
    expect(debye).toMatchObject({ operation: 'debye-length', units: 'm' })
    expect(debye.value).toBeCloseTo(0.0021822555794732247, 15)
    expect(calculateDebyeLengthM(5e6, 5e15)).toBe(debye.value)

    const gyrofrequency = adapter.run({
      operation: 'gyrofrequency',
      magneticFieldT: 0.1,
      chargeC: -1.602176634e-19,
      massKg: 9.1093837015e-31,
    })
    expect(gyrofrequency).toMatchObject({ operation: 'gyrofrequency', units: 'rad/s' })
    expect(gyrofrequency.value).toBeCloseTo(1.758820010772163e10, 4)
    expect(calculateGyrofrequencyRadPerS(0.1, -1.602176634e-19, 9.1093837015e-31)).toBe(gyrofrequency.value)

    const drift = adapter.run({
      operation: 'exb-drift',
      electricFieldVPerM: [1, 0, 0],
      magneticFieldT: [0, 1, 0],
    })
    expect(drift).toMatchObject({ operation: 'exb-drift', units: 'm/s', value: [0, 0, 1] })
    expect(calculateExbDriftMPerS([1, 0, 0], [0, 1, 0])).toEqual(drift.value)
    expect(drift.assumptions.join(' ')).toContain('charge')
    expect(drift.licenseCaveat).toContain('BSD-3-Clause')
  })

  it('evaluates fluids formulas with explicit units', () => {
    const descriptor = descriptorFor('awesome-fluids', 'fluids', FLUIDS_ADAPTER_ID)
    const adapter = createFluidsAdapter(descriptor, new AbortController().signal)
    expectCompatibility(adapter, descriptor)

    const soundSpeed = adapter.run({
      operation: 'ideal-gas-sound-speed',
      temperatureK: 303,
      isentropicExponent: 1.4,
      molarMassGPerMol: 28.96,
    })
    expect(soundSpeed).toMatchObject({ operation: 'ideal-gas-sound-speed', units: 'm/s' })
    expect(soundSpeed.value).toBeCloseTo(348.9820953185441, 12)
    expect(calculateFluidsIdealGasSoundSpeedMPerS(303, 1.4, 28.96)).toBe(soundSpeed.value)

    const reynolds = adapter.run({
      operation: 'reynolds',
      velocityMPerS: 2.5,
      diameterM: 0.25,
      densityKgPerM3: 1.1613,
      dynamicViscosityPaS: 1.9e-5,
    })
    expect(reynolds).toMatchObject({ operation: 'reynolds', units: '1' })
    expect(reynolds.value).toBeCloseTo(38200.65789473684, 10)
    expect(calculateFluidsReynolds(2.5, 0.25, 1.1613, 1.9e-5)).toBe(reynolds.value)

    const diffusivity = adapter.run({
      operation: 'thermal-diffusivity',
      conductivityWPerMK: 0.02,
      densityKgPerM3: 1,
      heatCapacityJPerKgK: 1000,
    })
    expect(diffusivity).toMatchObject({ operation: 'thermal-diffusivity', units: 'm^2/s', value: 2e-5 })
    expect(calculateFluidsThermalDiffusivityM2PerS(0.02, 1, 1000)).toBe(diffusivity.value)
    expect(diffusivity.licenseCaveat).toContain('MIT')
  })

  it('evaluates thermo ideal-gas properties and its declared phase rule', () => {
    const descriptor = descriptorFor('awesome-thermo', 'thermo', THERMO_ADAPTER_ID)
    const adapter = createThermoAdapter(descriptor, new AbortController().signal)
    expectCompatibility(adapter, descriptor)

    const state = adapter.run({
      operation: 'ideal-gas-state',
      temperatureK: 300,
      pressurePa: 1e5,
      amountMol: 2,
      molarMassKgPerMol: 0.028,
    })
    expect(state.units).toEqual({
      molarVolume: 'm^3/mol',
      volume: 'm^3',
      density: 'kg/m^3',
      compressibilityFactor: '1',
      fugacity: 'Pa',
    })
    expect(state.molarVolumeM3PerMol).toBeCloseTo(0.02494338785446072, 14)
    expect(state.volumeM3).toBeCloseTo(0.04988677570892144, 14)
    expect(state.densityKgPerM3).toBeCloseTo(1.1225419803987764, 14)
    expect(state.compressibilityFactor).toBe(1)
    expect(state.fugacityPa).toBe(1e5)
    expect(calculateThermoIdealGasState(300, 1e5, 2, 0.028)).toEqual({
      molarVolumeM3PerMol: state.molarVolumeM3PerMol,
      volumeM3: state.volumeM3,
      densityKgPerM3: state.densityKgPerM3,
      compressibilityFactor: 1,
      fugacityPa: 1e5,
    })

    expect(adapter.run({
      operation: 'phase',
      temperatureK: 250,
      pressurePa: 101325,
      meltingTemperatureK: 273.15,
      boilingTemperatureK: 373.15,
    }).phase).toBe('solid')
    expect(adapter.run({
      operation: 'phase',
      temperatureK: 280,
      pressurePa: 101325,
      meltingTemperatureK: 273.15,
      boilingTemperatureK: 373.15,
    }).phase).toBe('liquid')
    expect(adapter.run({
      operation: 'phase',
      temperatureK: 400,
      pressurePa: 101325,
      meltingTemperatureK: 273.15,
      boilingTemperatureK: 373.15,
    }).phase).toBe('gas')
    expect(identifyThermoPhase(280, 101325, 273.15, 373.15)).toBe('liquid')
    expect(state.licenseCaveat).toContain('MIT')
  })

  it('evaluates BurnMan-style density, thermal, and seismic proxies', () => {
    const descriptor = descriptorFor('awesome-burnman', 'burnman', BURNMAN_ADAPTER_ID)
    const adapter = createBurnmanAdapter(descriptor, new AbortController().signal)
    expectCompatibility(adapter, descriptor)

    const density = adapter.run({
      operation: 'density',
      pressurePa: 1.6e9,
      temperatureK: 300,
      referenceTemperatureK: 300,
      referenceDensityKgPerM3: 3300,
      bulkModulusPa: 160e9,
      thermalExpansivityPerK: 3e-5,
    })
    expect(density.units).toEqual({ density: 'kg/m^3', volumeRatio: '1' })
    expect(density.volumeRatio).toBeCloseTo(0.99, 14)
    expect(density.densityKgPerM3).toBeCloseTo(3333.3333333333335, 10)
    expect(calculateBurnmanDensityKgPerM3(1.6e9, 300, 300, 3300, 160e9, 3e-5)).toEqual({
      densityKgPerM3: density.densityKgPerM3,
      volumeRatio: density.volumeRatio,
    })

    const thermal = adapter.run({
      operation: 'thermal-expansion',
      temperatureK: 400,
      referenceTemperatureK: 300,
      thermalExpansivityPerK: 3e-5,
    })
    expect(thermal.volumeRatio).toBeCloseTo(1.003, 14)
    expect(thermal.volumetricStrain).toBeCloseTo(0.003, 14)
    expect(calculateBurnmanThermalExpansion(400, 300, 3e-5)).toEqual({
      volumeRatio: thermal.volumeRatio,
      volumetricStrain: thermal.volumetricStrain,
    })

    const seismic = adapter.run({
      operation: 'seismic-proxy',
      densityKgPerM3: 3300,
      bulkModulusPa: 250e9,
      shearModulusPa: 150e9,
    })
    expect(seismic.units).toEqual({ pWaveVelocity: 'm/s', sWaveVelocity: 'm/s', bulkSoundVelocity: 'm/s' })
    expect(seismic.pWaveVelocityMPerS).toBeCloseTo(11677.484162422845, 10)
    expect(seismic.sWaveVelocityMPerS).toBeCloseTo(6741.998624632421, 10)
    expect(seismic.bulkSoundVelocityMPerS).toBeCloseTo(8703.882797784892, 10)
    expect(calculateBurnmanSeismicProxy(3300, 250e9, 150e9)).toEqual({
      pWaveVelocityMPerS: seismic.pWaveVelocityMPerS,
      sWaveVelocityMPerS: seismic.sWaveVelocityMPerS,
      bulkSoundVelocityMPerS: seismic.bulkSoundVelocityMPerS,
    })
    expect(seismic.licenseCaveat).toContain('GPL-2-or-later')
  })

  it('rejects invalid domains and non-JSON-safe input instead of falling back', () => {
    const plasma = createPlasmaPyAdapter(descriptorFor('awesome-plasmapy', 'PlasmaPy', PLASMAPY_ADAPTER_ID), new AbortController().signal)
    const fluids = createFluidsAdapter(descriptorFor('awesome-fluids', 'fluids', FLUIDS_ADAPTER_ID), new AbortController().signal)
    const thermo = createThermoAdapter(descriptorFor('awesome-thermo', 'thermo', THERMO_ADAPTER_ID), new AbortController().signal)
    const burnman = createBurnmanAdapter(descriptorFor('awesome-burnman', 'burnman', BURNMAN_ADAPTER_ID), new AbortController().signal)

    expect(() => plasma.run({ operation: 'debye-length', electronTemperatureK: 0, electronDensityPerM3: 1e15 })).toThrow()
    expect(() => plasma.run({ operation: 'gyrofrequency', magneticFieldT: 1, chargeC: 0, massKg: 9.1e-31 })).toThrow()
    expect(() => plasma.run({ operation: 'exb-drift', electricFieldVPerM: [1, 0, 0], magneticFieldT: [0, 0, 0] })).toThrow()
    expect(() => plasma.run({ operation: 'debye-length', electronTemperatureK: 1e4, electronDensityPerM3: 1e15, extra: true } as never)).toThrow(/unknown properties/)
    expect(() => fluids.run({ operation: 'ideal-gas-sound-speed', temperatureK: Number.NaN, isentropicExponent: 1.4, molarMassGPerMol: 28.96 })).toThrow(/finite/)
    expect(() => fluids.run({ operation: 'reynolds', velocityMPerS: 1, diameterM: 0, densityKgPerM3: 1, dynamicViscosityPaS: 1e-5 })).toThrow()
    expect(() => thermo.run({ operation: 'ideal-gas-state', temperatureK: 300, pressurePa: 0, amountMol: 1, molarMassKgPerMol: 0.028 })).toThrow()
    expect(() => thermo.run({ operation: 'phase', temperatureK: 300, pressurePa: 2e5, meltingTemperatureK: 273, boilingTemperatureK: 373 })).toThrow()
    expect(() => burnman.run({ operation: 'density', pressurePa: -1, temperatureK: 300, referenceTemperatureK: 300, referenceDensityKgPerM3: 3300, bulkModulusPa: 160e9, thermalExpansivityPerK: 3e-5 })).toThrow()
    expect(() => burnman.run({ operation: 'seismic-proxy', densityKgPerM3: 3300, bulkModulusPa: 250e9, shearModulusPa: Number.POSITIVE_INFINITY })).toThrow(/finite/)
  })

  it('is deterministic, bounded, cancellable, and keeps source caveats visible', () => {
    const plasmaDescriptor = descriptorFor('awesome-plasmapy', 'PlasmaPy', PLASMAPY_ADAPTER_ID)
    const plasma = createPlasmaPyAdapter(plasmaDescriptor, new AbortController().signal)
    const input = { operation: 'gyrofrequency' as const, magneticFieldT: 1, chargeC: 1.602176634e-19, massKg: 1.67262192369e-27 }
    const first = plasma.run(input)
    const second = plasma.run(JSON.parse(JSON.stringify(input)))
    expect(first).toEqual(second)
    expectFiniteJson(first)
    expect(JSON.parse(JSON.stringify(first))).toEqual(first)
    expect(PLASMAPY_SOURCE_CAVEATS.data).toContain('No PlasmaPy')
    expect(FLUIDS_SOURCE_CAVEATS.data).toContain('No fluids')
    expect(THERMO_SOURCE_CAVEATS.data).toContain('No thermo')
    expect(BURNMAN_SOURCE_CAVEATS.data).toContain('No BurnMan')

    const controller = new AbortController()
    controller.abort()
    expect(() => createPlasmaPyAdapter(plasmaDescriptor, controller.signal)).toThrow(/aborted/i)

    const runController = new AbortController()
    runController.abort()
    expect(() => plasma.run(input, runController.signal)).toThrow(/aborted/i)
  })
})
