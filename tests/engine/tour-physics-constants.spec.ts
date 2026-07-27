import {
  CODATA_2022_MEASURED_CONSTANTS,
  CONVENTIONAL_CONSTANTS,
  EXACT_DERIVED_CONSTANTS,
  PHYSICS_CONSTANTS,
  PLANCK_SCALE_CONSTANTS,
  SI_EXACT_CONSTANTS,
  SI_EXACTNESS_NOTE,
  type PhysicsConstant,
} from '../../src/tour/physicsConstants'

function relativeError(actual: number, expected: number): number {
  return Math.abs((actual - expected) / expected)
}

describe('Tour conventional-physics constants', () => {
  it('publishes the fixed SI values with exact status and unambiguous units', () => {
    expect(SI_EXACT_CONSTANTS).toMatchObject({
      deltaNuCs: { value: 9_192_631_770, unit: 'Hz', status: 'exact' },
      speedOfLight: { value: 299_792_458, unit: 'm s^-1', status: 'exact' },
      planckConstant: { value: 6.626_070_15e-34, unit: 'J s', status: 'exact' },
      elementaryCharge: { value: 1.602_176_634e-19, unit: 'C', status: 'exact' },
      boltzmannConstant: { value: 1.380_649e-23, unit: 'J K^-1', status: 'exact' },
      avogadroConstant: { value: 6.022_140_76e23, unit: 'mol^-1', status: 'exact' },
      luminousEfficacy: { value: 683, unit: 'lm W^-1', status: 'exact' },
    })
    expect(SI_EXACT_CONSTANTS.reducedPlanckConstant.value).toBe(SI_EXACT_CONSTANTS.planckConstant.value / (2 * Math.PI))
    expect(SI_EXACT_CONSTANTS.reducedPlanckConstant.unit).toBe('J s')
    expect(SI_EXACT_CONSTANTS.reducedPlanckConstant.scope).toContain('not an independent SI defining constant')
    expect(SI_EXACTNESS_NOTE).toContain('practical realization')
    expect(SI_EXACTNESS_NOTE).toContain('floating-point')
  })

  it('keeps adjusted CODATA quantities measured and labels the derived muon cyclic ratio', () => {
    expect(CODATA_2022_MEASURED_CONSTANTS.gravitationalConstant).toMatchObject({
      value: 6.674_30e-11,
      unit: 'm^3 kg^-1 s^-2',
      status: 'measured',
    })
    expect(CODATA_2022_MEASURED_CONSTANTS.fineStructureConstant.value).toBe(7.297_352_564_3e-3)
    expect(CODATA_2022_MEASURED_CONSTANTS.rydbergConstant).toMatchObject({ value: 10_973_731.568_157, unit: 'm^-1' })
    expect(CODATA_2022_MEASURED_CONSTANTS.electronMass.value).toBe(9.109_383_713_9e-31)
    expect(CODATA_2022_MEASURED_CONSTANTS.protonMass.value).toBe(1.672_621_925_95e-27)
    expect(CODATA_2022_MEASURED_CONSTANTS.neutronMass.value).toBe(1.674_927_500_56e-27)
    expect(CODATA_2022_MEASURED_CONSTANTS.muonMass.value).toBe(1.883_531_627e-28)

    const cyclicRatios = [
      CODATA_2022_MEASURED_CONSTANTS.electronGyromagneticRatioOver2Pi,
      CODATA_2022_MEASURED_CONSTANTS.protonGyromagneticRatioOver2Pi,
      CODATA_2022_MEASURED_CONSTANTS.muonGyromagneticRatioOver2Pi,
    ]
    expect(cyclicRatios.map(({ unit }) => unit)).toEqual(['Hz T^-1', 'Hz T^-1', 'Hz T^-1'])
    expect(cyclicRatios.map(({ value }) => Math.sign(value))).toEqual([-1, 1, -1])
    expect(cyclicRatios.every(({ scope }) => scope.includes('gamma_') && scope.includes('(2 pi)'))).toBe(true)
    expect(CODATA_2022_MEASURED_CONSTANTS.muonGyromagneticRatioOver2Pi.status).toBe('derived-from-measured')
    expect(Object.entries(CODATA_2022_MEASURED_CONSTANTS).every(([id, { status }]) => (
      id === 'muonGyromagneticRatioOver2Pi' ? status === 'derived-from-measured' : status === 'measured'
    ))).toBe(true)
  })

  it('satisfies the exact derived identities to floating-point tolerance', () => {
    const { avogadroConstant: na, boltzmannConstant: kb, elementaryCharge: e, planckConstant: h } = SI_EXACT_CONSTANTS

    expect(EXACT_DERIVED_CONSTANTS.electronVolt.value).toBe(e.value)
    expect(EXACT_DERIVED_CONSTANTS.molarGasConstant.value).toBe(na.value * kb.value)
    expect(EXACT_DERIVED_CONSTANTS.faradayConstant.value).toBe(na.value * e.value)
    expect(EXACT_DERIVED_CONSTANTS.vonKlitzingConstant.value).toBe(h.value / e.value ** 2)
    expect(EXACT_DERIVED_CONSTANTS.josephsonConstant.value).toBe(2 * e.value / h.value)
    expect(EXACT_DERIVED_CONSTANTS.conductanceQuantum.value).toBe(2 * e.value ** 2 / h.value)
    expect(EXACT_DERIVED_CONSTANTS.magneticFluxQuantum.value).toBe(h.value / (2 * e.value))
    expect(EXACT_DERIVED_CONSTANTS.molarGasConstant.unit).toBe('J mol^-1 K^-1')
    expect(EXACT_DERIVED_CONSTANTS.stefanBoltzmannConstant.unit).toBe('W m^-2 K^-4')
    expect(relativeError(EXACT_DERIVED_CONSTANTS.wienWavelengthDisplacementConstant.value, 2.897_771_955e-3)).toBeLessThan(2e-10)
    expect(relativeError(EXACT_DERIVED_CONSTANTS.stefanBoltzmannConstant.value, 5.670_374_419e-8)).toBeLessThan(2e-10)
    expect(EXACT_DERIVED_CONSTANTS.wienWavelengthDisplacementConstant.scope).toContain('blackbody theory')
    expect(EXACT_DERIVED_CONSTANTS.stefanBoltzmannConstant.scope).toContain('blackbody theory')
  })

  it('derives finite plausible Planck scales while retaining measured-G provenance', () => {
    const { planckLength, planckMass, planckTemperature, planckTime } = PLANCK_SCALE_CONSTANTS

    expect(relativeError(planckLength.value, 1.616_255e-35)).toBeLessThan(1e-6)
    expect(relativeError(planckTime.value, 5.391_247e-44)).toBeLessThan(1e-6)
    expect(relativeError(planckMass.value, 2.176_434e-8)).toBeLessThan(1e-6)
    expect(relativeError(planckTemperature.value, 1.416_784e32)).toBeLessThan(1e-6)
    expect(Object.values(PLANCK_SCALE_CONSTANTS).every(({ value }) => Number.isFinite(value) && value > 0)).toBe(true)
    expect(Object.values(PLANCK_SCALE_CONSTANTS).every(({ status }) => status === 'derived-from-measured')).toBe(true)
    expect(Object.values(PLANCK_SCALE_CONSTANTS).every(({ scope }) => scope.includes('measured G'))).toBe(true)
  })

  it('records the exact conventional atmosphere without treating it as ambient data', () => {
    expect(CONVENTIONAL_CONSTANTS.standardAtmosphere).toEqual({
      value: 101_325,
      unit: 'Pa',
      status: 'exact',
      sourceRef: 'codata-2022',
      scope: 'Exact conventional standard atmosphere; not a measured ambient pressure.',
    })
  })

  it('deep-freezes every exported catalog record', () => {
    const catalogs = [
      SI_EXACT_CONSTANTS,
      CODATA_2022_MEASURED_CONSTANTS,
      EXACT_DERIVED_CONSTANTS,
      CONVENTIONAL_CONSTANTS,
      PLANCK_SCALE_CONSTANTS,
      PHYSICS_CONSTANTS,
    ]

    expect(catalogs.every(Object.isFrozen)).toBe(true)
    expect(Object.values(PHYSICS_CONSTANTS).every(Object.isFrozen)).toBe(true)
    expect(() => {
      (PHYSICS_CONSTANTS.planckLength as unknown as { value: number }).value = 0
    }).toThrow(TypeError)
    expect(PHYSICS_CONSTANTS.planckLength.value).not.toBe(0)
  })

  it('sets only resolvable source IDs on all finite values and never marks measured data exact', () => {
    const sourceIds = new Set(['bipm-si-brochure-9', 'codata-2022'])
    const constants = Object.values(PHYSICS_CONSTANTS)
    const measuredConstants = Object.values(CODATA_2022_MEASURED_CONSTANTS) as readonly PhysicsConstant[]

    expect(constants.every(({ value }) => Number.isFinite(value))).toBe(true)
    expect(constants.every(({ sourceRef }) => sourceIds.has(sourceRef))).toBe(true)
    expect(constants.every(({ sourceRef }) => sourceRef.length > 0)).toBe(true)
    expect(measuredConstants.filter(({ status }) => status === 'exact')).toEqual([])
  })
})
