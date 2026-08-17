import { boundedNumber, requireInteger } from '../simphy/numbers'
import type { ResultFinding, TourRuntimeResultAttribution } from '../types/tour'
import {
  CODATA_2022_MEASURED_CONSTANTS,
  CONVENTIONAL_CONSTANTS,
  EXACT_DERIVED_CONSTANTS,
  SI_EXACT_CONSTANTS,
} from './physicsConstants'

export const MOLAR_SUBSTANCE_PRESET_IDS = Object.freeze([
  'electron',
  'proton',
  'carbon-12',
  'generic-particle',
] as const)

export const MOLAR_MATTER_PRESET_IDS = Object.freeze([
  'one-mole',
  'micromole',
  'standard-ideal-gas',
  'electrolysis',
] as const)

export const GAS_MODEL_IDS = Object.freeze(['none', 'ideal'] as const)

export type MolarSubstancePresetId = typeof MOLAR_SUBSTANCE_PRESET_IDS[number]
export type MolarMatterPresetId = typeof MOLAR_MATTER_PRESET_IDS[number]
export type GasModelId = typeof GAS_MODEL_IDS[number]

export interface MolarMatterInput {
  substancePreset: MolarSubstancePresetId
  amountMol: number
  temperatureKelvin: number
  pressurePascal: number
  gasModel: GasModelId
  chargeNumber: number
  genericParticleMassKg?: number
  molarMassKgPerMol?: number
  perParticleEnergyJoule?: number
}

export interface MolarSubstanceCatalogEntry {
  id: MolarSubstancePresetId
  label: string
  massBasis: 'particle-mass' | 'molar-mass' | 'user-supplied'
  particleMassKg: number | null
  molarMassKgPerMol: number | null
  massStatus: 'measured' | 'derived-from-measured' | 'user-supplied'
  wording: string
}

export interface MolarMatterPreset {
  id: MolarMatterPresetId
  label: string
  description: string
  input: Readonly<MolarMatterInput>
}

export interface MolarMatterTableRow {
  quantity: 'amount-of-substance' | 'entity-count' | 'bulk-mass' | 'ideal-gas-volume' | 'faraday-charge' | 'molar-energy' | 'sample-energy'
  label: string
  value: number
  unit: string
}

type FindingNarrative = Pick<
  ResultFinding,
  'changed' | 'cause' | 'equation' | 'assumptions' | 'establishes' | 'doesNotEstablish'
>

export type MolarMatterFinding = FindingNarrative & TourRuntimeResultAttribution

export interface MolarMatterEvaluation {
  substance: MolarSubstanceCatalogEntry
  amountOfSubstanceMol: number
  entityCount: number
  molarMassKgPerMol: number
  bulkMassKg: number
  idealGasVolumeCubicMetres: number | null
  faradayChargeCoulombs: number
  perParticleEnergyJoule: number | null
  molarEnergyJoulePerMol: number | null
  sampleEnergyJoule: number | null
  standardAtmospherePascal: number
  table: MolarMatterTableRow[]
  finding: MolarMatterFinding
}

const CARBON_12_MOLAR_MASS_KG_PER_MOL = 12.000_000_012_6e-3
const MINIMUM_MASS_KG_PER_MOL = 1e-12
const MAXIMUM_MASS_KG_PER_MOL = 1e3
const MINIMUM_PARTICLE_MASS_KG = MINIMUM_MASS_KG_PER_MOL / SI_EXACT_CONSTANTS.avogadroConstant.value
const MAXIMUM_PARTICLE_MASS_KG = MAXIMUM_MASS_KG_PER_MOL / SI_EXACT_CONSTANTS.avogadroConstant.value

function catalogEntry(entry: MolarSubstanceCatalogEntry): Readonly<MolarSubstanceCatalogEntry> {
  return Object.freeze(entry)
}

const electronMolarMass = CODATA_2022_MEASURED_CONSTANTS.electronMass.value * SI_EXACT_CONSTANTS.avogadroConstant.value
const protonMolarMass = CODATA_2022_MEASURED_CONSTANTS.protonMass.value * SI_EXACT_CONSTANTS.avogadroConstant.value

export const MOLAR_SUBSTANCES = Object.freeze([
  catalogEntry({
    id: 'electron',
    label: 'Electron',
    massBasis: 'particle-mass',
    particleMassKg: CODATA_2022_MEASURED_CONSTANTS.electronMass.value,
    molarMassKgPerMol: electronMolarMass,
    massStatus: 'derived-from-measured',
    wording: 'The electron molar mass is derived from the measured CODATA 2022 electron mass and exact Avogadro constant.',
  }),
  catalogEntry({
    id: 'proton',
    label: 'Proton',
    massBasis: 'particle-mass',
    particleMassKg: CODATA_2022_MEASURED_CONSTANTS.protonMass.value,
    molarMassKgPerMol: protonMolarMass,
    massStatus: 'derived-from-measured',
    wording: 'The proton molar mass is derived from the measured CODATA 2022 proton mass and exact Avogadro constant.',
  }),
  catalogEntry({
    id: 'carbon-12',
    label: 'Carbon-12',
    massBasis: 'molar-mass',
    particleMassKg: CARBON_12_MOLAR_MASS_KG_PER_MOL / SI_EXACT_CONSTANTS.avogadroConstant.value,
    molarMassKgPerMol: CARBON_12_MOLAR_MASS_KG_PER_MOL,
    massStatus: 'measured',
    wording: 'In the current SI, 0.012 kg mol^-1 for carbon-12 is an extremely close conventional reference, not an exact molar mass; this engine uses the CODATA 2022 molar-mass-constant value.',
  }),
  catalogEntry({
    id: 'generic-particle',
    label: 'Generic particle',
    massBasis: 'user-supplied',
    particleMassKg: null,
    molarMassKgPerMol: null,
    massStatus: 'user-supplied',
    wording: 'Supply either one particle mass or one molar mass; the exact Avogadro constant converts between them.',
  }),
] as const satisfies readonly Readonly<MolarSubstanceCatalogEntry>[])

function matterPreset(
  id: MolarMatterPresetId,
  label: string,
  description: string,
  input: MolarMatterInput,
): Readonly<MolarMatterPreset> {
  return Object.freeze({ id, label, description, input: Object.freeze(input) })
}

export const MOLAR_MATTER_PRESETS = Object.freeze([
  matterPreset('one-mole', 'One mole', 'One mole of carbon-12 entities without a gas-volume interpretation.', {
    substancePreset: 'carbon-12',
    amountMol: 1,
    temperatureKelvin: 298.15,
    pressurePascal: CONVENTIONAL_CONSTANTS.standardAtmosphere.value,
    gasModel: 'none',
    chargeNumber: 0,
  }),
  matterPreset('micromole', 'Micromole', 'One micromole of electrons.', {
    substancePreset: 'electron',
    amountMol: 1e-6,
    temperatureKelvin: 298.15,
    pressurePascal: CONVENTIONAL_CONSTANTS.standardAtmosphere.value,
    gasModel: 'none',
    chargeNumber: -1,
  }),
  matterPreset('standard-ideal-gas', 'Standard ideal gas', 'One mole at 273.15 K and one conventional standard atmosphere.', {
    substancePreset: 'generic-particle',
    amountMol: 1,
    temperatureKelvin: 273.15,
    pressurePascal: CONVENTIONAL_CONSTANTS.standardAtmosphere.value,
    gasModel: 'ideal',
    chargeNumber: 0,
    molarMassKgPerMol: 28.97e-3,
  }),
  matterPreset('electrolysis', 'Electrolysis', 'One mole of singly charged positive entities for the Faraday identity.', {
    substancePreset: 'proton',
    amountMol: 1,
    temperatureKelvin: 298.15,
    pressurePascal: CONVENTIONAL_CONSTANTS.standardAtmosphere.value,
    gasModel: 'none',
    chargeNumber: 1,
  }),
] as const satisfies readonly Readonly<MolarMatterPreset>[])

function checkedChargeNumber(value: number): number {
  return boundedNumber(requireInteger(value, 'chargeNumber'), 'chargeNumber', -100, 100)
}

function resolveSubstance(input: MolarMatterInput): MolarSubstanceCatalogEntry {
  if (!(MOLAR_SUBSTANCE_PRESET_IDS as readonly unknown[]).includes(input.substancePreset)) {
    throw new Error(`Unknown molar-matter substance preset: ${String(input.substancePreset)}`)
  }
  const catalog = MOLAR_SUBSTANCES.find(({ id }) => id === input.substancePreset)!

  if (input.substancePreset !== 'generic-particle') {
    if (input.genericParticleMassKg !== undefined || input.molarMassKgPerMol !== undefined) {
      throw new Error('Molar-matter custom mass is only valid for the generic-particle preset')
    }
    return { ...catalog }
  }

  const suppliedParticleMass = input.genericParticleMassKg !== undefined
  const suppliedMolarMass = input.molarMassKgPerMol !== undefined
  if (suppliedParticleMass === suppliedMolarMass) {
    throw new Error('Molar-matter generic-particle requires exactly one of genericParticleMassKg or molarMassKgPerMol')
  }

  const avogadro = SI_EXACT_CONSTANTS.avogadroConstant.value
  const particleMassKg = suppliedParticleMass
    ? boundedNumber(input.genericParticleMassKg!, 'genericParticleMassKg', MINIMUM_PARTICLE_MASS_KG, MAXIMUM_PARTICLE_MASS_KG)
    : boundedNumber(input.molarMassKgPerMol!, 'molarMassKgPerMol', MINIMUM_MASS_KG_PER_MOL, MAXIMUM_MASS_KG_PER_MOL) / avogadro
  const molarMassKgPerMol = suppliedMolarMass
    ? input.molarMassKgPerMol!
    : particleMassKg * avogadro

  return {
    ...catalog,
    particleMassKg,
    molarMassKgPerMol,
    wording: suppliedParticleMass
      ? 'The user-supplied per-particle mass is converted to molar mass with the exact Avogadro constant.'
      : 'The user-supplied molar mass is converted to per-particle mass with the exact Avogadro constant.',
  }
}

function buildFinding(
  input: MolarMatterInput,
  substance: MolarSubstanceCatalogEntry,
  entityCount: number,
  bulkMass: number,
  gasVolume: number | null,
): MolarMatterFinding {
  return {
    changed: `${input.amountMol} mol of ${substance.label} corresponds to ${entityCount} entities and ${bulkMass} kg${gasVolume === null ? '.' : `, with ideal-gas volume ${gasVolume} m^3.`}`,
    cause: 'Amount of substance scales entity count, molar mass, ideal-gas volume, charge, and optional particle energy through their conventional molar identities.',
    equation: 'N = n N_A; m = n M; V = n R T/P (ideal gas only); Q = z n F; E_m = N_A E_particle',
    assumptions: [
      'Amount of substance n is expressed explicitly in moles and is not interchangeable with entity count.',
      'Gas volume is computed only when the ideal-gas model is selected.',
      'Charge number z is the signed integer elementary-charge count per entity.',
    ],
    establishes: 'The result establishes deterministic scaling identities from the selected amount of substance and supplied model inputs.',
    doesNotEstablish: 'The calculation is not empirical validation and does not establish real-gas behavior, chemical identity, reaction yield, material purity, or measured mass.',
    claimClass: 'identity',
    evidenceRefs: ['iupac-green-book-3', 'bipm-si-brochure-9', 'codata-2022'],
    sourceRevision: 'IUPAC Green Book, 3rd edition, corrected 2nd printing; SI Brochure 9th edition; CODATA 2022',
    sourceLocator: 'IUPAC sections 2.10-2.11 and 4.3; fixed N_A, e, and k_B; R = N_A k_B; F = N_A e; conventional standard atmosphere',
    methodRelationship: 'not-applicable',
    modelOrigin: 'established-physics',
    resultStatus: 'computed',
    validatesTheory: false,
    caveats: [
      'One standard atmosphere is the exact convention 101325 Pa, not a measured ambient pressure.',
      'The ideal-gas law neglects interactions, finite particle size, phase changes, and non-ideal compressibility.',
      substance.wording,
      'No empirical dataset or validation comparison is used.',
    ],
  }
}

export function evaluateMolarMatter(input: MolarMatterInput): MolarMatterEvaluation {
  if (!input || typeof input !== 'object') throw new TypeError('Molar-matter input must be an object')
  if (!(GAS_MODEL_IDS as readonly unknown[]).includes(input.gasModel)) {
    throw new Error(`Unknown molar-matter gas model: ${String(input.gasModel)}`)
  }

  const amount = boundedNumber(input.amountMol, 'amountMol', 1e-12, 1e3)
  const temperature = boundedNumber(input.temperatureKelvin, 'temperatureKelvin', 1, 5_000)
  const pressure = boundedNumber(input.pressurePascal, 'pressurePascal', 1, 1e8)
  const chargeNumber = checkedChargeNumber(input.chargeNumber)
  const substance = resolveSubstance(input)
  const molarMass = substance.molarMassKgPerMol!
  const avogadro = SI_EXACT_CONSTANTS.avogadroConstant.value
  const entityCount = amount * avogadro
  const bulkMass = amount * molarMass
  const gasVolume = input.gasModel === 'ideal'
    ? amount * EXACT_DERIVED_CONSTANTS.molarGasConstant.value * temperature / pressure
    : null
  const faradayCharge = chargeNumber * amount * EXACT_DERIVED_CONSTANTS.faradayConstant.value
  const perParticleEnergy = input.perParticleEnergyJoule === undefined
    ? null
    : boundedNumber(input.perParticleEnergyJoule, 'perParticleEnergyJoule', -1e3, 1e3)
  const molarEnergy = perParticleEnergy === null ? null : perParticleEnergy * avogadro
  const sampleEnergy = molarEnergy === null ? null : molarEnergy * amount
  const table: MolarMatterTableRow[] = [
    { quantity: 'amount-of-substance', label: 'Amount of substance', value: amount, unit: 'mol' },
    { quantity: 'entity-count', label: 'Entity count', value: entityCount, unit: '1' },
    { quantity: 'bulk-mass', label: 'Bulk mass', value: bulkMass, unit: 'kg' },
    { quantity: 'faraday-charge', label: 'Faraday charge', value: faradayCharge, unit: 'C' },
  ]
  if (gasVolume !== null) {
    table.push({ quantity: 'ideal-gas-volume', label: 'Ideal-gas volume', value: gasVolume, unit: 'm^3' })
  }
  if (molarEnergy !== null && sampleEnergy !== null) {
    table.push({ quantity: 'molar-energy', label: 'Energy per mole', value: molarEnergy, unit: 'J mol^-1' })
    table.push({ quantity: 'sample-energy', label: 'Energy for selected amount', value: sampleEnergy, unit: 'J' })
  }

  return {
    substance,
    amountOfSubstanceMol: amount,
    entityCount,
    molarMassKgPerMol: molarMass,
    bulkMassKg: bulkMass,
    idealGasVolumeCubicMetres: gasVolume,
    faradayChargeCoulombs: faradayCharge,
    perParticleEnergyJoule: perParticleEnergy,
    molarEnergyJoulePerMol: molarEnergy,
    sampleEnergyJoule: sampleEnergy,
    standardAtmospherePascal: CONVENTIONAL_CONSTANTS.standardAtmosphere.value,
    table,
    finding: buildFinding(input, substance, entityCount, bulkMass, gasVolume),
  }
}
