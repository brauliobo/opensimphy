import type { ResultFinding, TourRuntimeResultAttribution } from '../types/tour'
import { SI_EXACT_CONSTANTS, SI_EXACTNESS_NOTE } from './physicsConstants'

export const PHOTON_FREQUENCY_BOUNDS_HZ = Object.freeze({ minimum: 1e3, maximum: 1e25 })
export const PHOTON_SOURCE_PRESET_IDS = Object.freeze([
  'radio',
  'microwave',
  'visible-blue',
  'x-ray',
  'gamma',
] as const)

export type PhotonSourcePresetId = typeof PHOTON_SOURCE_PRESET_IDS[number]
export type PhotonBridgeInput =
  | Readonly<{ frequencyHz: number; presetId?: never }>
  | Readonly<{ presetId: PhotonSourcePresetId; frequencyHz?: never }>

type FindingNarrative = Pick<
  ResultFinding,
  'changed' | 'cause' | 'equation' | 'assumptions' | 'establishes' | 'doesNotEstablish'
>

export type PhotonBridgeFinding = FindingNarrative & TourRuntimeResultAttribution

export interface PhotonSourcePreset {
  readonly id: PhotonSourcePresetId
  readonly label: string
  readonly frequencyHz: number
  readonly bandNote: string
}

export interface PhotonBridgeEvaluation {
  readonly tier: 'immediate'
  readonly source: 'user-frequency' | 'illustrative-preset'
  readonly presetId: PhotonSourcePresetId | null
  readonly frequencyHz: number
  readonly photonEnergyJ: number
  readonly vacuumWavelengthM: number
  readonly equivalentMassKg: number
  readonly equivalentTemperatureK: number
  readonly relationStatus: 'exact-si-identity-for-stated-frequency'
  readonly definitionNotes: readonly string[]
  readonly uncertaintyNotes: readonly string[]
  readonly finding: PhotonBridgeFinding
}

export interface PhotonBridgeTableRow {
  readonly id: 'frequency' | 'photon-energy' | 'vacuum-wavelength' | 'equivalent-mass' | 'equivalent-temperature'
  readonly label: string
  readonly value: number
  readonly unit: string
  readonly equation: string
  readonly interpretation: string
}

export interface PhotonBridgeSeriesPoint {
  readonly id: PhotonBridgeTableRow['id']
  readonly label: string
  readonly value: number
  readonly log10Value: number
  readonly unit: string
  readonly accessibleLabel: string
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

const c  = SI_EXACT_CONSTANTS.speedOfLight.value
const h  = SI_EXACT_CONSTANTS.planckConstant.value
const kB = SI_EXACT_CONSTANTS.boltzmannConstant.value

export const PHOTON_SOURCE_PRESETS: readonly PhotonSourcePreset[] = deepFreeze([
  { id: 'radio', label: 'Radio', frequencyHz: 1e8, bandNote: 'Illustrative 100 MHz radio frequency.' },
  { id: 'microwave', label: 'Microwave', frequencyHz: 1e10, bandNote: 'Illustrative 10 GHz microwave frequency.' },
  { id: 'visible-blue', label: 'Visible blue', frequencyHz: c / 450e-9, bandNote: 'Illustrative 450 nm vacuum wavelength.' },
  { id: 'x-ray', label: 'X-ray', frequencyHz: c / 1e-10, bandNote: 'Illustrative 0.1 nm vacuum wavelength.' },
  { id: 'gamma', label: 'Gamma ray', frequencyHz: 1e20, bandNote: 'Illustrative high-energy gamma-ray frequency; spectral-band boundaries vary by convention.' },
])

export const PHOTON_BRIDGE_RUNTIME = Object.freeze({
  tier: 'immediate' as const,
  maxOperations: 1 as const,
  maxDurationMs: 10,
})

function frequencyFromInput(input: PhotonBridgeInput): {
  frequencyHz: number
  preset: PhotonSourcePreset | null
} {
  if (!input || typeof input !== 'object') throw new Error('Photon bridge input must be an object')
  const hasFrequency = Object.hasOwn(input, 'frequencyHz')
  const hasPreset = Object.hasOwn(input, 'presetId')
  if (hasFrequency === hasPreset) throw new Error('Photon bridge input must provide exactly one of frequencyHz or presetId')

  if (hasPreset) {
    if (!(PHOTON_SOURCE_PRESET_IDS as readonly unknown[]).includes(input.presetId)) {
      throw new Error(`Unknown photon source preset: ${String(input.presetId)}`)
    }
    const preset = PHOTON_SOURCE_PRESETS.find(({ id }) => id === input.presetId)!
    return { frequencyHz: preset.frequencyHz, preset }
  }

  const frequencyHz = input.frequencyHz as number
  if (!Number.isFinite(frequencyHz)) throw new Error('Photon bridge frequencyHz must be finite')
  if (frequencyHz < PHOTON_FREQUENCY_BOUNDS_HZ.minimum || frequencyHz > PHOTON_FREQUENCY_BOUNDS_HZ.maximum) {
    throw new Error('Photon bridge frequencyHz must be within [1e3, 1e25] Hz')
  }
  return { frequencyHz, preset: null }
}

function buildFinding(frequencyHz: number, preset: PhotonSourcePreset | null): PhotonBridgeFinding {
  const sourceLabel = preset ? `${preset.label} preset` : 'supplied frequency'
  return {
    changed: `Evaluated the ${sourceLabel} at ${frequencyHz.toExponential(6)} Hz across four linked representations.`,
    cause: 'Exact SI values of h, c, and kB transform the stated frequency through photon and vacuum identities.',
    equation: 'E_gamma = h nu; lambda_vac = c/nu; m_equiv = E_gamma/c^2; T_equiv = E_gamma/kB',
    assumptions: [
      'The radiation is represented by a photon of the stated frequency.',
      'The wavelength is a vacuum wavelength.',
      'No uncertainty for the input frequency is supplied or propagated.',
    ],
    establishes: 'For the stated frequency, the output values satisfy the displayed exact SI identities to finite floating-point precision.',
    doesNotEstablish: 'The equivalent mass is not photon rest mass, the equivalent temperature is not a thermodynamic state, and this identity calculation is not an empirical validation.',
    claimClass: 'identity',
    evidenceRefs: ['bipm-si-brochure-9', 'codata-2022'],
    sourceRevision: 'BIPM SI Brochure 9; CODATA 2022',
    sourceLocator: 'Fixed h, c, and kB values and photon-vacuum relationships',
    methodRelationship: 'not-applicable',
    modelOrigin: 'established-physics',
    resultStatus: 'computed',
    validatesTheory: false,
    caveats: [
      'Equivalent mass E/c^2 is an energy-equivalent scale, explicitly not photon rest mass.',
      'Equivalent temperature E/kB is an energy-equivalent scale, not a claim about a thermodynamic state.',
      SI_EXACTNESS_NOTE,
    ],
  }
}

export function evaluatePhotonBridge(input: PhotonBridgeInput): PhotonBridgeEvaluation {
  const { frequencyHz, preset } = frequencyFromInput(input)
  const photonEnergyJ = h * frequencyHz
  const vacuumWavelengthM = c / frequencyHz
  const equivalentMassKg = photonEnergyJ / c ** 2
  const equivalentTemperatureK = photonEnergyJ / kB

  return deepFreeze({
    tier: 'immediate',
    source: preset ? 'illustrative-preset' : 'user-frequency',
    presetId: preset?.id ?? null,
    frequencyHz,
    photonEnergyJ,
    vacuumWavelengthM,
    equivalentMassKg,
    equivalentTemperatureK,
    relationStatus: 'exact-si-identity-for-stated-frequency',
    definitionNotes: [
      'h, c, and kB have fixed exact SI numerical values.',
      'Preset frequencies are illustrative source choices, not exact definitions of spectral bands.',
    ],
    uncertaintyNotes: [
      'No input-frequency uncertainty is represented, so no output uncertainty is reported.',
      'Exact defining constants do not make a measured source frequency or practical realization uncertainty-free.',
    ],
    finding: buildFinding(frequencyHz, preset),
  })
}

export function projectPhotonBridgeTable(output: PhotonBridgeEvaluation): readonly PhotonBridgeTableRow[] {
  return deepFreeze([
    { id: 'frequency', label: 'Frequency', value: output.frequencyHz, unit: 'Hz', equation: 'input nu', interpretation: 'Stated photon frequency.' },
    { id: 'photon-energy', label: 'Photon energy', value: output.photonEnergyJ, unit: 'J', equation: 'E_gamma = h nu', interpretation: 'Energy of one photon at the stated frequency.' },
    { id: 'vacuum-wavelength', label: 'Vacuum wavelength', value: output.vacuumWavelengthM, unit: 'm', equation: 'lambda_vac = c/nu', interpretation: 'Wavelength for propagation in vacuum.' },
    { id: 'equivalent-mass', label: 'Equivalent mass scale', value: output.equivalentMassKg, unit: 'kg', equation: 'm_equiv = E_gamma/c^2', interpretation: 'Energy-equivalent mass, not photon rest mass.' },
    { id: 'equivalent-temperature', label: 'Equivalent temperature scale', value: output.equivalentTemperatureK, unit: 'K', equation: 'T_equiv = E_gamma/kB', interpretation: 'Energy-equivalent temperature, not a thermodynamic state.' },
  ])
}

export function projectPhotonBridgeSeries(output: PhotonBridgeEvaluation): readonly PhotonBridgeSeriesPoint[] {
  return deepFreeze(projectPhotonBridgeTable(output).map(({ id, label, value, unit }) => ({
    id,
    label,
    value,
    log10Value: Math.log10(value),
    unit,
    accessibleLabel: `${label}: ${value.toExponential(6)} ${unit}`,
  })))
}
