import type { ResultFinding, TourRuntimeResultAttribution } from '../types/tour'
import {
  CODATA_2022_MEASURED_CONSTANTS,
  SI_EXACT_CONSTANTS,
} from './physicsConstants'

export const PARTICLE_SCALE_IDS = Object.freeze(['electron', 'muon', 'proton', 'neutron'] as const)
export const PARTICLE_MOMENTUM_MODE_IDS = Object.freeze(['mass-times-c', 'si'] as const)

export type ParticleScaleId = typeof PARTICLE_SCALE_IDS[number]
export type ParticleMomentumModeId = typeof PARTICLE_MOMENTUM_MODE_IDS[number]

export type ParticleScaleInput = {
  particle: ParticleScaleId
} & (
  | { momentumMode: 'mass-times-c'; momentumMultiplier: number; momentumSi?: never }
  | { momentumMode: 'si'; momentumSi: number; momentumMultiplier?: never }
)

export interface ParticleScaleCatalogEntry {
  id: ParticleScaleId
  label: string
  symbol: string
  massKg: number
  composition: 'elementary' | 'composite'
}

type FindingNarrative = Pick<
  ResultFinding,
  'changed' | 'cause' | 'equation' | 'assumptions' | 'establishes' | 'doesNotEstablish'
>

export type ParticleScaleFinding = FindingNarrative & TourRuntimeResultAttribution

export interface ParticleScaleResult {
  particle: ParticleScaleId
  particleLabel: string
  massKg: number
  massRatioToElectron: number
  massRatioToProton: number
  restEnergyJ: number
  restEnergyEv: number
  comptonWavelengthM: number
  reducedComptonWavelengthM: number
  momentumMode: ParticleMomentumModeId
  momentumKgMPerS: number
  momentumMultiplier: number
  deBroglieWavelengthM: number
  relativisticTotalEnergyJ: number
  relativisticTotalEnergyEv: number
  relativisticKineticEnergyJ: number
  relativisticKineticEnergyEv: number
  finding: ParticleScaleFinding
}

export interface ParticleScaleTableRow {
  quantity: string
  symbol: string
  value: number
  unit: string
  dependency: 'catalog mass' | 'mass-derived' | 'momentum state-derived'
}

const { electronMass, muonMass, neutronMass, protonMass } = CODATA_2022_MEASURED_CONSTANTS

export const PARTICLE_SCALE_CATALOG = Object.freeze([
  Object.freeze({ id: 'electron', label: 'Electron', symbol: 'e-', massKg: electronMass.value, composition: 'elementary' }),
  Object.freeze({ id: 'muon', label: 'Muon', symbol: 'mu-', massKg: muonMass.value, composition: 'elementary' }),
  Object.freeze({ id: 'proton', label: 'Proton', symbol: 'p', massKg: protonMass.value, composition: 'composite' }),
  Object.freeze({ id: 'neutron', label: 'Neutron', symbol: 'n', massKg: neutronMass.value, composition: 'composite' }),
] as const satisfies readonly ParticleScaleCatalogEntry[])

export const PARTICLE_SCALE_BOUNDS = Object.freeze({
  momentumMultiplier: Object.freeze({ min: 1e-6, max: 1e6 }),
  momentumSi: Object.freeze({ min: 1e-30, max: 1e-15, unit: 'kg m s^-1' }),
} as const)

function validateParticleScaleInput(input: ParticleScaleInput): void {
  if (!input || typeof input !== 'object') throw new Error('Particle scale input must be an object')
  if (!(PARTICLE_SCALE_IDS as readonly unknown[]).includes(input.particle)) {
    throw new Error(`Unknown particle scale particle: ${String(input.particle)}`)
  }
  if (!(PARTICLE_MOMENTUM_MODE_IDS as readonly unknown[]).includes(input.momentumMode)) {
    throw new Error(`Unknown particle scale momentum mode: ${String(input.momentumMode)}`)
  }
  const value = input.momentumMode === 'mass-times-c' ? input.momentumMultiplier : input.momentumSi
  const label = input.momentumMode === 'mass-times-c' ? 'momentumMultiplier' : 'momentumSi'
  const bounds = PARTICLE_SCALE_BOUNDS[label]
  if (!Number.isFinite(value)) throw new Error(`Particle scale ${label} must be finite`)
  if (value < bounds.min || value > bounds.max) {
    throw new Error(`Particle scale ${label} must be within [${bounds.min}, ${bounds.max}]`)
  }
}

function buildFinding(
  particle: ParticleScaleCatalogEntry,
  momentumKgMPerS: number,
  momentumMultiplier: number,
): ParticleScaleFinding {
  return {
    changed: `The ${particle.label} momentum state p=${momentumKgMPerS} kg m s^-1 is ${momentumMultiplier} times m c.`,
    cause: 'Rest energy and Compton scales follow from invariant mass, while the de Broglie wavelength and relativistic total energy additionally depend on the selected momentum state.',
    equation: 'E_0 = m c^2; lambda_C = h/(m c); reduced lambda_C = hbar/(m c); lambda_dB = h/p; E = sqrt((p c)^2 + (m c^2)^2)',
    assumptions: [
      'The catalog mass is the CODATA 2022 invariant rest mass for a free particle.',
      'The momentum is a positive SI magnitude in an inertial frame; direction and wave-packet spread are not represented.',
      'The relativistic energy uses the free-particle dispersion relation in vacuum.',
    ],
    establishes: 'Within the free-particle model, the result computes linked mass-derived scales and momentum-state-derived representations with explicit dependencies.',
    doesNotEstablish: 'It does not make the Compton and de Broglie wavelengths independent measurements, infer momentum from mass alone, characterize a localized wave packet, or empirically validate the particle model.',
    claimClass: 'established-model',
    evidenceRefs: ['openstax-university-physics-v3', 'codata-2022'],
    sourceRevision: 'OpenStax University Physics Volume 3, 2016 web edition; CODATA 2022 adjustment',
    sourceLocator: 'OpenStax sections 5.8-5.9 and 6.4-6.5; CODATA electron, muon, proton, and neutron masses',
    methodRelationship: 'not-applicable',
    modelOrigin: 'established-physics',
    resultStatus: 'computed',
    validatesTheory: false,
    caveats: [
      'Compton wavelength is a mass-derived characteristic scale; de Broglie wavelength is state-dependent through the explicitly selected momentum.',
      'Joule/electron-volt energies and Compton/reduced-Compton wavelengths are dependent representations of the same selected mass, not additional observations.',
      'Interactions, binding, medium response, finite lifetime, particle width, spin, and uncertainty propagation are omitted.',
      'No empirical dataset or validation protocol is evaluated.',
    ],
  }
}

export function evaluateParticleScale(input: ParticleScaleInput): ParticleScaleResult {
  validateParticleScaleInput(input)
  const particle = PARTICLE_SCALE_CATALOG.find(({ id }) => id === input.particle)!
  const { elementaryCharge, planckConstant, reducedPlanckConstant, speedOfLight } = SI_EXACT_CONSTANTS
  const massKg = particle.massKg
  const restEnergyJ = massKg * speedOfLight.value ** 2
  const momentumKgMPerS = input.momentumMode === 'mass-times-c'
    ? input.momentumMultiplier * massKg * speedOfLight.value
    : input.momentumSi
  const momentumMultiplier = momentumKgMPerS / (massKg * speedOfLight.value)
  const momentumEnergyJ = momentumKgMPerS * speedOfLight.value
  const relativisticTotalEnergyJ = Math.hypot(momentumEnergyJ, restEnergyJ)
  const relativisticKineticEnergyJ = momentumEnergyJ ** 2 / (relativisticTotalEnergyJ + restEnergyJ)

  return {
    particle: particle.id,
    particleLabel: particle.label,
    massKg,
    massRatioToElectron: massKg / electronMass.value,
    massRatioToProton: massKg / protonMass.value,
    restEnergyJ,
    restEnergyEv: restEnergyJ / elementaryCharge.value,
    comptonWavelengthM: planckConstant.value / (massKg * speedOfLight.value),
    reducedComptonWavelengthM: reducedPlanckConstant.value / (massKg * speedOfLight.value),
    momentumMode: input.momentumMode,
    momentumKgMPerS,
    momentumMultiplier,
    deBroglieWavelengthM: planckConstant.value / momentumKgMPerS,
    relativisticTotalEnergyJ,
    relativisticTotalEnergyEv: relativisticTotalEnergyJ / elementaryCharge.value,
    relativisticKineticEnergyJ,
    relativisticKineticEnergyEv: relativisticKineticEnergyJ / elementaryCharge.value,
    finding: buildFinding(particle, momentumKgMPerS, momentumMultiplier),
  }
}

export function projectParticleScaleTable(result: ParticleScaleResult): ParticleScaleTableRow[] {
  return [
    { quantity: 'Invariant mass', symbol: 'm', value: result.massKg, unit: 'kg', dependency: 'catalog mass' },
    { quantity: 'Rest energy', symbol: 'E_0', value: result.restEnergyJ, unit: 'J', dependency: 'mass-derived' },
    { quantity: 'Compton wavelength', symbol: 'lambda_C', value: result.comptonWavelengthM, unit: 'm', dependency: 'mass-derived' },
    { quantity: 'Reduced Compton wavelength', symbol: 'reduced lambda_C', value: result.reducedComptonWavelengthM, unit: 'm', dependency: 'mass-derived' },
    { quantity: 'Momentum', symbol: 'p', value: result.momentumKgMPerS, unit: 'kg m s^-1', dependency: 'momentum state-derived' },
    { quantity: 'de Broglie wavelength', symbol: 'lambda_dB', value: result.deBroglieWavelengthM, unit: 'm', dependency: 'momentum state-derived' },
    { quantity: 'Relativistic total energy', symbol: 'E', value: result.relativisticTotalEnergyJ, unit: 'J', dependency: 'momentum state-derived' },
  ]
}
