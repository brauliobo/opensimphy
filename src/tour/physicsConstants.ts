export type PhysicsConstantStatus = 'exact' | 'measured' | 'derived-from-measured'
export type PhysicsConstantSourceRef = 'bipm-si-brochure-9' | 'codata-2022'

export interface PhysicsConstant {
  readonly value: number
  readonly unit: string
  readonly status: PhysicsConstantStatus
  readonly sourceRef: PhysicsConstantSourceRef
  readonly scope: string
  readonly standardUncertainty?: number
}

export const SI_EXACTNESS_NOTE = 'An exact SI value fixes the defining numerical value or follows exactly from fixed values; it does not make a practical realization or a finite floating-point representation uncertainty-free.'

function finiteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`)
  return value
}

function constant<const T extends PhysicsConstant>(record: T): Readonly<T> {
  finiteNumber(record.value, 'Physics constant value')
  if (record.standardUncertainty !== undefined) {
    finiteNumber(record.standardUncertainty, 'Physics constant standard uncertainty')
    if (record.standardUncertainty < 0) throw new Error('Physics constant standard uncertainty must be non-negative')
  }
  return Object.freeze(record)
}

export const SI_EXACT_CONSTANTS = Object.freeze({
  deltaNuCs: constant({
    value: 9_192_631_770,
    unit: 'Hz',
    status: 'exact',
    sourceRef: 'bipm-si-brochure-9',
    scope: 'Fixed Cs-133 ground-state hyperfine transition frequency used to define the second.',
  }),
  speedOfLight: constant({
    value: 299_792_458,
    unit: 'm s^-1',
    status: 'exact',
    sourceRef: 'bipm-si-brochure-9',
    scope: 'Fixed vacuum speed of light used to define the metre.',
  }),
  planckConstant: constant({
    value: 6.626_070_15e-34,
    unit: 'J s',
    status: 'exact',
    sourceRef: 'bipm-si-brochure-9',
    scope: 'Fixed Planck constant used in the SI definition of the kilogram.',
  }),
  reducedPlanckConstant: constant({
    value: 6.626_070_15e-34 / (2 * Math.PI),
    unit: 'J s',
    status: 'exact',
    sourceRef: 'bipm-si-brochure-9',
    scope: 'Exact relation hbar = h/(2 pi); not an independent SI defining constant.',
  }),
  elementaryCharge: constant({
    value: 1.602_176_634e-19,
    unit: 'C',
    status: 'exact',
    sourceRef: 'bipm-si-brochure-9',
    scope: 'Fixed elementary charge used in the SI definition of the ampere.',
  }),
  boltzmannConstant: constant({
    value: 1.380_649e-23,
    unit: 'J K^-1',
    status: 'exact',
    sourceRef: 'bipm-si-brochure-9',
    scope: 'Fixed Boltzmann constant used in the SI definition of the kelvin.',
  }),
  avogadroConstant: constant({
    value: 6.022_140_76e23,
    unit: 'mol^-1',
    status: 'exact',
    sourceRef: 'bipm-si-brochure-9',
    scope: 'Fixed Avogadro constant used in the SI definition of the mole.',
  }),
  luminousEfficacy: constant({
    value: 683,
    unit: 'lm W^-1',
    status: 'exact',
    sourceRef: 'bipm-si-brochure-9',
    scope: 'Fixed Kcd for monochromatic radiation of frequency 540 THz; photopic scope only.',
  }),
} as const)

export const CODATA_2022_MEASURED_CONSTANTS = Object.freeze({
  gravitationalConstant: constant({
    value: 6.674_30e-11,
    unit: 'm^3 kg^-1 s^-2',
    status: 'measured',
    sourceRef: 'codata-2022',
    scope: 'CODATA 2022 adjusted Newtonian constant; comparatively large relative uncertainty.',
    standardUncertainty: 0.000_15e-11,
  }),
  fineStructureConstant: constant({
    value: 7.297_352_564_3e-3,
    unit: '1',
    status: 'measured',
    sourceRef: 'codata-2022',
    scope: 'CODATA 2022 adjusted dimensionless electromagnetic coupling.',
    standardUncertainty: 0.000_000_001_1e-3,
  }),
  rydbergConstant: constant({
    value: 10_973_731.568_157,
    unit: 'm^-1',
    status: 'measured',
    sourceRef: 'codata-2022',
    scope: 'CODATA 2022 adjusted infinite-nuclear-mass Rydberg constant R_inf.',
    standardUncertainty: 0.000_012,
  }),
  electronMass: constant({
    value: 9.109_383_713_9e-31,
    unit: 'kg',
    status: 'measured',
    sourceRef: 'codata-2022',
    scope: 'CODATA 2022 adjusted electron rest mass.',
    standardUncertainty: 0.000_000_002_8e-31,
  }),
  protonMass: constant({
    value: 1.672_621_925_95e-27,
    unit: 'kg',
    status: 'measured',
    sourceRef: 'codata-2022',
    scope: 'CODATA 2022 adjusted proton rest mass.',
    standardUncertainty: 0.000_000_000_52e-27,
  }),
  neutronMass: constant({
    value: 1.674_927_500_56e-27,
    unit: 'kg',
    status: 'measured',
    sourceRef: 'codata-2022',
    scope: 'CODATA 2022 adjusted neutron rest mass.',
    standardUncertainty: 0.000_000_000_85e-27,
  }),
  muonMass: constant({
    value: 1.883_531_627e-28,
    unit: 'kg',
    status: 'measured',
    sourceRef: 'codata-2022',
    scope: 'CODATA 2022 adjusted muon rest mass.',
    standardUncertainty: 0.000_000_042e-28,
  }),
  electronGyromagneticRatioOver2Pi: constant({
    value: -28_024.951_386_1e6,
    unit: 'Hz T^-1',
    status: 'measured',
    sourceRef: 'codata-2022',
    scope: 'Signed cyclic ratio gamma_e/(2 pi); negative for the electron, not an angular-frequency value.',
    standardUncertainty: 0.000_008_7e6,
  }),
  protonGyromagneticRatioOver2Pi: constant({
    value: 42.577_478_461e6,
    unit: 'Hz T^-1',
    status: 'measured',
    sourceRef: 'codata-2022',
    scope: 'Signed cyclic ratio gamma_p/(2 pi) for a free proton; not a shielded or angular-frequency value.',
    standardUncertainty: 0.000_000_018e6,
  }),
  muonGyromagneticRatioOver2Pi: constant({
    value: 2 * -4.490_448_30e-26 / 6.626_070_15e-34,
    unit: 'Hz T^-1',
    status: 'derived-from-measured',
    sourceRef: 'codata-2022',
    scope: 'Signed cyclic ratio gamma_mu/(2 pi) for the negative muon, derived from its adjusted magnetic moment; not angular frequency.',
    standardUncertainty: 2 * 0.000_000_10e-26 / 6.626_070_15e-34,
  }),
} as const)

const { avogadroConstant, boltzmannConstant, elementaryCharge, planckConstant, reducedPlanckConstant, speedOfLight } = SI_EXACT_CONSTANTS
const { gravitationalConstant } = CODATA_2022_MEASURED_CONSTANTS

export const EXACT_DERIVED_CONSTANTS = Object.freeze({
  electronVolt: constant({
    value: elementaryCharge.value,
    unit: 'J',
    status: 'exact',
    sourceRef: 'bipm-si-brochure-9',
    scope: 'Exact joule value of one electron volt from the fixed elementary charge.',
  }),
  molarGasConstant: constant({
    value: avogadroConstant.value * boltzmannConstant.value,
    unit: 'J mol^-1 K^-1',
    status: 'exact',
    sourceRef: 'bipm-si-brochure-9',
    scope: 'Exact derived identity R = NA kB.',
  }),
  wienWavelengthDisplacementConstant: constant({
    value: planckConstant.value * speedOfLight.value / (boltzmannConstant.value * 4.965_114_231_744_276),
    unit: 'm K',
    status: 'exact',
    sourceRef: 'codata-2022',
    scope: 'Exact within ideal Planck blackbody theory; the decimal uses a numerical root of 5(1-exp(-x)) = x.',
  }),
  stefanBoltzmannConstant: constant({
    value: 2 * Math.PI ** 5 * boltzmannConstant.value ** 4 / (15 * planckConstant.value ** 3 * speedOfLight.value ** 2),
    unit: 'W m^-2 K^-4',
    status: 'exact',
    sourceRef: 'codata-2022',
    scope: 'Exact SI-constant expression within ideal Planck blackbody theory; real emitters require emissivity.',
  }),
  faradayConstant: constant({
    value: avogadroConstant.value * elementaryCharge.value,
    unit: 'C mol^-1',
    status: 'exact',
    sourceRef: 'bipm-si-brochure-9',
    scope: 'Exact derived identity F = NA e.',
  }),
  vonKlitzingConstant: constant({
    value: planckConstant.value / elementaryCharge.value ** 2,
    unit: 'ohm',
    status: 'exact',
    sourceRef: 'bipm-si-brochure-9',
    scope: 'Exact derived identity RK = h/e^2.',
  }),
  josephsonConstant: constant({
    value: 2 * elementaryCharge.value / planckConstant.value,
    unit: 'Hz V^-1',
    status: 'exact',
    sourceRef: 'bipm-si-brochure-9',
    scope: 'Exact derived identity KJ = 2e/h.',
  }),
  conductanceQuantum: constant({
    value: 2 * elementaryCharge.value ** 2 / planckConstant.value,
    unit: 'S',
    status: 'exact',
    sourceRef: 'bipm-si-brochure-9',
    scope: 'Exact derived identity G0 = 2e^2/h, including spin degeneracy.',
  }),
  magneticFluxQuantum: constant({
    value: planckConstant.value / (2 * elementaryCharge.value),
    unit: 'Wb',
    status: 'exact',
    sourceRef: 'bipm-si-brochure-9',
    scope: 'Exact superconducting flux quantum Phi0 = h/(2e).',
  }),
} as const)

export const CONVENTIONAL_CONSTANTS = Object.freeze({
  standardAtmosphere: constant({
    value: 101_325,
    unit: 'Pa',
    status: 'exact',
    sourceRef: 'codata-2022',
    scope: 'Exact conventional standard atmosphere; not a measured ambient pressure.',
  }),
} as const)

export const PLANCK_SCALE_CONSTANTS = Object.freeze({
  planckLength: constant({
    value: Math.sqrt(reducedPlanckConstant.value * gravitationalConstant.value / speedOfLight.value ** 3),
    unit: 'm',
    status: 'derived-from-measured',
    sourceRef: 'codata-2022',
    scope: 'lP = sqrt(hbar G/c^3); uncertainty is inherited from measured G.',
  }),
  planckTime: constant({
    value: Math.sqrt(reducedPlanckConstant.value * gravitationalConstant.value / speedOfLight.value ** 5),
    unit: 's',
    status: 'derived-from-measured',
    sourceRef: 'codata-2022',
    scope: 'tP = sqrt(hbar G/c^5); uncertainty is inherited from measured G.',
  }),
  planckMass: constant({
    value: Math.sqrt(reducedPlanckConstant.value * speedOfLight.value / gravitationalConstant.value),
    unit: 'kg',
    status: 'derived-from-measured',
    sourceRef: 'codata-2022',
    scope: 'mP = sqrt(hbar c/G); uncertainty is inherited from measured G.',
  }),
  planckTemperature: constant({
    value: Math.sqrt(reducedPlanckConstant.value * speedOfLight.value ** 5 / gravitationalConstant.value) / boltzmannConstant.value,
    unit: 'K',
    status: 'derived-from-measured',
    sourceRef: 'codata-2022',
    scope: 'TP = sqrt(hbar c^5/G)/kB; uncertainty is inherited from measured G.',
  }),
} as const)

export const PHYSICS_CONSTANTS = Object.freeze({
  ...SI_EXACT_CONSTANTS,
  ...CODATA_2022_MEASURED_CONSTANTS,
  ...EXACT_DERIVED_CONSTANTS,
  ...CONVENTIONAL_CONSTANTS,
  ...PLANCK_SCALE_CONSTANTS,
} as const)
