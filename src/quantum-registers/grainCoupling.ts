import { boundedInteger } from '../simphy/numbers'
import {
  BOLTZMANN_CONSTANT_J_PER_K,
  CODATA_2022_GRAVITATIONAL_CONSTANT_M3_PER_KG_S2,
  ELEMENTARY_CHARGE_C,
  REDUCED_PLANCK_CONSTANT_J_S,
  SPEED_OF_LIGHT_M_PER_S,
  VACUUM_MAGNETIC_PERMEABILITY_H_PER_M,
} from '../simphy/constants'
import { CODATA_2022_MEASURED_CONSTANTS } from '../tour/physicsConstants'

export interface GrainCouplingResult {
  grainM: number
  coupling: number
  inverseCoupling: number
  majorityThreshold: number
  reciprocalThreshold: number
  codataAlpha: number
  inverseAlpha: number
  chargeRatio: number
  chargeRatioSquared: number
  nearestGrainToAlpha: number
  couplingAt137: number
  siExponentSum: number
  cgsExponentSum: number
  absLogSum: number
  siExponents: number[]
  finding: string
}

function scientificAbsExponent(value: number): number {
  return Math.abs(Math.floor(Math.log10(Math.abs(value))))
}

function planckSi(): { t: number, l: number, q: number, T: number, m: number } {
  const hbar = REDUCED_PLANCK_CONSTANT_J_S
  const G    = CODATA_2022_GRAVITATIONAL_CONSTANT_M3_PER_KG_S2
  const c    = SPEED_OF_LIGHT_M_PER_S
  const k    = BOLTZMANN_CONSTANT_J_PER_K
  const mu0  = VACUUM_MAGNETIC_PERMEABILITY_H_PER_M
  const eps0 = 1 / (mu0 * c * c)
  return {
    t: Math.sqrt(hbar * G / c ** 5),
    l: Math.sqrt(hbar * G / c ** 3),
    q: Math.sqrt(4 * Math.PI * eps0 * hbar * c),
    T: Math.sqrt(hbar * c ** 5 / G) / k,
    m: Math.sqrt(hbar * c / G),
  }
}

export function grainMajorityThreshold(grainM: number): number {
  return Math.floor(boundedInteger(grainM, 'grainM', 2, 10_000) / 2) + 1
}

export function grainCoupling(grainM: number): number {
  const m = boundedInteger(grainM, 'grainM', 2, 10_000)
  return (2 * m - 1) / (m * m)
}

export function nearestGrainToAlpha(alpha: number): number {
  let best = 2
  let bestErr = Infinity
  for (let m = 2; m <= 10_000; m++) {
    const err = Math.abs(grainCoupling(m) - alpha)
    if (err < bestErr) {
      best = m
      bestErr = err
    }
  }
  return best
}

export function evaluateGrainCoupling(grainM = 137): GrainCouplingResult {
  const m     = boundedInteger(grainM, 'grainM', 2, 10_000)
  const alpha = CODATA_2022_MEASURED_CONSTANTS.fineStructureConstant.value
  const charge = ELEMENTARY_CHARGE_C
  const units  = planckSi()
  const siExponents = [units.t, units.l, units.q, units.T, units.m].map(scientificAbsExponent)
  const cgsExponents = [
    units.t,
    units.l * 100,
    units.q * 10 * SPEED_OF_LIGHT_M_PER_S,
    units.T,
    units.m * 1000,
  ].map(scientificAbsExponent)
  const absLogSum = [units.t, units.l, units.q, units.T, units.m]
    .reduce((sum, value) => sum + Math.abs(Math.log10(value)), 0)
  const coupling = grainCoupling(m)
  const nearest  = nearestGrainToAlpha(alpha)
  return {
    grainM: m,
    coupling,
    inverseCoupling: 1 / coupling,
    majorityThreshold: grainMajorityThreshold(m),
    reciprocalThreshold: 1 / grainMajorityThreshold(m),
    codataAlpha: alpha,
    inverseAlpha: 1 / alpha,
    chargeRatio: units.q / charge,
    chargeRatioSquared: (charge / units.q) ** 2,
    nearestGrainToAlpha: nearest,
    couplingAt137: grainCoupling(137),
    siExponentSum: siExponents.reduce((sum, value) => sum + value, 0),
    cgsExponentSum: cgsExponents.reduce((sum, value) => sum + value, 0),
    absLogSum,
    siExponents,
    finding: `SI Planck-exponent floors sum to ${siExponents.reduce((sum, value) => sum + value, 0)}; CGS cm·g sum to ${cgsExponents.reduce((sum, value) => sum + value, 0)}; |log10| sum is ${absLogSum.toFixed(1)}. That 137 is a unit artifact. α = (e/q_P)² is unit-free. Completeness of K₀=diag((M−1)/M,1) forces the flip-jump rate (2M−1)/M²; at M=${m} that is ${coupling.toExponential(4)}, nearest integer grain to CODATA α is M=${nearest}, not 137.`,
  }
}
