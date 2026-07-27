import type { ResultFinding, TourRuntimeResultAttribution } from '../types/tour'
import {
  EXACT_DERIVED_CONSTANTS,
  SI_EXACT_CONSTANTS,
  SI_EXACTNESS_NOTE,
} from './physicsConstants'

export const ELECTRICAL_STANDARD_PRESET_IDS = Object.freeze(['single-electron', 'josephson', 'hall'] as const)
export const ELECTRICAL_CHARGE_CARRIER_BOUNDS = Object.freeze({ minimum: 1, maximum: 1_000_000 })
export const ELECTRICAL_FREQUENCY_BOUNDS_HZ = Object.freeze({ minimum: 0, maximum: 1e15 })
export const ELECTRICAL_VOLTAGE_BOUNDS_V = Object.freeze({ minimum: 0, maximum: 1e6 })

export type ElectricalStandardPresetId = typeof ELECTRICAL_STANDARD_PRESET_IDS[number]
export type ElectricalNodeStatus = 'exact-defining-si' | 'exact-derived-si' | 'computed' | 'historical-conventional-1990'
export type ElectricalNodeId =
  | 'h'
  | 'e'
  | 'KJ'
  | 'RK'
  | 'G0'
  | 'Phi0'
  | 'eV'
  | 'KJ-90'
  | 'RK-90'
  | 'carrier-charge'
  | 'carrier-energy'
  | 'josephson-frequency'
  | 'josephson-voltage'

type FindingNarrative = Pick<
  ResultFinding,
  'changed' | 'cause' | 'equation' | 'assumptions' | 'establishes' | 'doesNotEstablish'
>

export type ElectricalStandardsFinding = FindingNarrative & TourRuntimeResultAttribution

export interface ElectricalStandardsInput {
  readonly presetId: ElectricalStandardPresetId
  readonly chargeCarriers: number
  readonly frequencyHz: number
  readonly voltageV: number
}

export interface ElectricalStandardPreset {
  readonly id: ElectricalStandardPresetId
  readonly label: string
  readonly description: string
  readonly defaultInput: ElectricalStandardsInput
}

export interface ElectricalNetworkNode {
  readonly id: ElectricalNodeId
  readonly label: string
  readonly symbol: string
  readonly value: number
  readonly unit: string
  readonly status: ElectricalNodeStatus
  readonly statusLabel: string
  readonly note: string
}

export interface ElectricalNetworkEdge {
  readonly id: string
  readonly from: readonly ElectricalNodeId[]
  readonly to: ElectricalNodeId
  readonly equation: string
  readonly relationship: 'definition' | 'exact-derived-identity' | 'direct-calculation' | 'historical-comparison'
  readonly note: string
}

export interface ElectricalHistoricalComparison {
  readonly id: 'KJ-90-versus-KJ' | 'RK-90-versus-RK'
  readonly historicalNodeId: 'KJ-90' | 'RK-90'
  readonly currentNodeId: 'KJ' | 'RK'
  readonly relativeDifference: number
  readonly partsPerMillion: number
  readonly convention: '1990-conventional'
  readonly currentStatus: 'exact-derived-si'
  readonly note: string
}

export interface ElectricalStandardsEvaluation {
  readonly tier: 'immediate'
  readonly presetId: ElectricalStandardPresetId
  readonly chargeCarriers: number
  readonly totalChargeC: number
  readonly frequencyHz: number | null
  readonly voltageV: number | null
  readonly carrierEnergyJ: number | null
  readonly josephsonFrequencyFromVoltageHz: number | null
  readonly josephsonVoltageFromFrequencyV: number | null
  readonly kj90DifferencePpm: number
  readonly rk90DifferencePpm: number
  readonly networkStatus: 'exact-input-dependent-and-historical-layers-separated'
  readonly nodes: readonly ElectricalNetworkNode[]
  readonly edges: readonly ElectricalNetworkEdge[]
  readonly historicalComparisons: readonly ElectricalHistoricalComparison[]
  readonly finding: ElectricalStandardsFinding
}

export interface ElectricalStandardsTableRow {
  readonly id: ElectricalNodeId
  readonly label: string
  readonly symbol: string
  readonly value: number
  readonly unit: string
  readonly statusLabel: string
  readonly note: string
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

export const HISTORICAL_1990_CONVENTIONAL_CONSTANTS = deepFreeze({
  josephsonConstant: {
    value: 483_597.9e9,
    displayValue: 483_597.9,
    unit: 'Hz V^-1',
    displayUnit: 'GHz V^-1',
    status: 'historical-conventional-1990' as const,
    label: 'KJ-90',
    note: 'CIPM 1988 conventional value used from 1990; it is not the current exact SI value of KJ.',
  },
  vonKlitzingConstant: {
    value: 25_812.807,
    displayValue: 25_812.807,
    unit: 'ohm',
    displayUnit: 'ohm',
    status: 'historical-conventional-1990' as const,
    label: 'RK-90',
    note: 'CIPM 1988 conventional value used from 1990; it is not the current exact SI value of RK.',
  },
})

export const ELECTRICAL_STANDARD_PRESETS: readonly ElectricalStandardPreset[] = deepFreeze([
  {
    id: 'single-electron',
    label: 'Single electron',
    description: 'Inspect one elementary charge and its exact electron-volt energy at one volt.',
    defaultInput: { presetId: 'single-electron', chargeCarriers: 1, voltageV: 1, frequencyHz: 0 },
  },
  {
    id: 'josephson',
    label: 'Josephson relation',
    description: 'Trace fixed h and e through KJ and a frequency-voltage conversion.',
    defaultInput: { presetId: 'josephson', chargeCarriers: 2, frequencyHz: 70e9, voltageV: 1e-3 },
  },
  {
    id: 'hall',
    label: 'Quantum Hall relation',
    description: 'Trace fixed h and e through RK while keeping practical Hall realization separate.',
    defaultInput: { presetId: 'hall', chargeCarriers: 1, voltageV: 0, frequencyHz: 0 },
  },
])

export const ELECTRICAL_STANDARDS_RUNTIME = Object.freeze({
  tier: 'immediate' as const,
  maxOperations: 1 as const,
  maxDurationMs: 10,
})

const h    = SI_EXACT_CONSTANTS.planckConstant.value
const e    = SI_EXACT_CONSTANTS.elementaryCharge.value
const KJ   = EXACT_DERIVED_CONSTANTS.josephsonConstant.value
const RK   = EXACT_DERIVED_CONSTANTS.vonKlitzingConstant.value
const G0   = EXACT_DERIVED_CONSTANTS.conductanceQuantum.value
const PHI0 = EXACT_DERIVED_CONSTANTS.magneticFluxQuantum.value
const EV   = EXACT_DERIVED_CONSTANTS.electronVolt.value

const STATUS_LABELS: Readonly<Record<ElectricalNodeStatus, string>> = Object.freeze({
  'exact-defining-si': 'Exact SI defining constant',
  'exact-derived-si': 'Exact relation from fixed SI constants',
  computed: 'Computed from stated input',
  'historical-conventional-1990': 'Historical 1990 conventional value',
})

function node(
  id: ElectricalNodeId,
  label: string,
  symbol: string,
  value: number,
  unit: string,
  status: ElectricalNodeStatus,
  note: string,
): ElectricalNetworkNode {
  if (!Number.isFinite(value)) throw new Error(`Electrical node ${id} must be finite`)
  return { id, label, symbol, value, unit, status, statusLabel: STATUS_LABELS[status], note }
}

function validateBounded(value: number, label: string, minimum: number, maximum: number, unit: string): void {
  if (!Number.isFinite(value)) throw new Error(`Electrical standards ${label} must be finite`)
  if (value < minimum || value > maximum) {
    throw new Error(`Electrical standards ${label} must be within [${minimum}, ${maximum}] ${unit}`)
  }
}

function validateInput(input: ElectricalStandardsInput): void {
  if (!input || typeof input !== 'object') throw new Error('Electrical standards input must be an object')
  const keys = Object.keys(input).sort()
  const expectedKeys = ['chargeCarriers', 'frequencyHz', 'presetId', 'voltageV']
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error('Electrical standards input must provide exactly presetId, chargeCarriers, voltageV, and frequencyHz')
  }
  if (!(ELECTRICAL_STANDARD_PRESET_IDS as readonly unknown[]).includes(input.presetId)) {
    throw new Error(`Unknown electrical standards preset: ${String(input.presetId)}`)
  }
  if (!Number.isFinite(input.chargeCarriers)) throw new Error('Electrical standards chargeCarriers must be finite')
  if (!Number.isInteger(input.chargeCarriers)) throw new Error('Electrical standards chargeCarriers must be an integer')
  if (input.chargeCarriers < ELECTRICAL_CHARGE_CARRIER_BOUNDS.minimum || input.chargeCarriers > ELECTRICAL_CHARGE_CARRIER_BOUNDS.maximum) {
    throw new Error('Electrical standards chargeCarriers must be within [1, 1000000]')
  }
  validateBounded(input.frequencyHz, 'frequencyHz', ELECTRICAL_FREQUENCY_BOUNDS_HZ.minimum, ELECTRICAL_FREQUENCY_BOUNDS_HZ.maximum, 'Hz')
  validateBounded(input.voltageV, 'voltageV', ELECTRICAL_VOLTAGE_BOUNDS_V.minimum, ELECTRICAL_VOLTAGE_BOUNDS_V.maximum, 'V')
  if (input.presetId === 'josephson' && input.frequencyHz <= ELECTRICAL_FREQUENCY_BOUNDS_HZ.minimum) {
    throw new Error('Electrical standards frequencyHz must be greater than 0 Hz for the josephson preset')
  }
  if (input.presetId !== 'josephson' && input.frequencyHz !== 0) {
    throw new Error('Electrical standards frequencyHz must be 0 when the josephson calculation is inactive')
  }
}

function relativeDifference(historical: number, current: number): number {
  return (historical - current) / current
}

function historicalComparisons(): ElectricalHistoricalComparison[] {
  const kjDifference = relativeDifference(HISTORICAL_1990_CONVENTIONAL_CONSTANTS.josephsonConstant.value, KJ)
  const rkDifference = relativeDifference(HISTORICAL_1990_CONVENTIONAL_CONSTANTS.vonKlitzingConstant.value, RK)
  return [
    {
      id: 'KJ-90-versus-KJ',
      historicalNodeId: 'KJ-90',
      currentNodeId: 'KJ',
      relativeDifference: kjDifference,
      partsPerMillion: kjDifference * 1e6,
      convention: '1990-conventional',
      currentStatus: 'exact-derived-si',
      note: 'Positive means KJ-90 is larger than the current exact SI KJ value.',
    },
    {
      id: 'RK-90-versus-RK',
      historicalNodeId: 'RK-90',
      currentNodeId: 'RK',
      relativeDifference: rkDifference,
      partsPerMillion: rkDifference * 1e6,
      convention: '1990-conventional',
      currentStatus: 'exact-derived-si',
      note: 'Negative means RK-90 is smaller than the current exact SI RK value.',
    },
  ]
}

function buildFinding(input: ElectricalStandardsInput, comparisons: readonly ElectricalHistoricalComparison[]): ElectricalStandardsFinding {
  const preset = ELECTRICAL_STANDARD_PRESETS.find(({ id }) => id === input.presetId)!
  return {
    changed: `Traced ${input.chargeCarriers} integer charge carrier${input.chargeCarriers === 1 ? '' : 's'} through the ${preset.label} standards view.`,
    cause: 'Fixed exact SI values of h and e determine KJ, RK, G0, Phi0, and the joule value of eV through exact algebraic relationships.',
    equation: 'KJ = 2e/h; RK = h/e^2; G0 = 2e^2/h = 2/RK; Phi0 = h/(2e); 1 eV = e J',
    assumptions: [
      'chargeCarriers is a count used only to compute total charge and voltage-dependent carrier energy.',
      'frequencyHz is positive in the Josephson view and the inactive zero placeholder in the other complete preset inputs.',
      'The ideal Josephson and quantum Hall relationships are separated from practical device realization.',
      'KJ-90 and RK-90 are retained only as historical conventional comparison values.',
    ],
    establishes: `The exact identity network and both signed historical relative differences were evaluated for the ${preset.label} view.`,
    doesNotEstablish: 'The calculation does not establish device accuracy, quantized-plateau realization, a Hall filling factor, a conductance-channel count, uncertainty-free laboratory values, or empirical validation.',
    claimClass: 'identity',
    evidenceRefs: ['bipm-si-brochure-9', 'codata-2022', 'cipm-1988-electrical-conventional-values'],
    sourceRevision: 'BIPM SI Brochure 9; CODATA 2022; CIPM 1988 conventional values effective 1990',
    sourceLocator: 'Fixed h and e; quantum electrical exact relationships; CIPM 1988 KJ-90 and RK-90 conventional values',
    methodRelationship: 'not-applicable',
    modelOrigin: 'established-physics',
    resultStatus: 'computed',
    validatesTheory: false,
    caveats: [
      HISTORICAL_1990_CONVENTIONAL_CONSTANTS.josephsonConstant.note,
      HISTORICAL_1990_CONVENTIONAL_CONSTANTS.vonKlitzingConstant.note,
      `Historical relative differences use (conventional - current exact SI) / current exact SI; KJ-90 difference is ${comparisons[0]!.partsPerMillion.toExponential(6)} ppm.`,
      SI_EXACTNESS_NOTE,
    ],
  }
}

export function evaluateElectricalStandards(input: ElectricalStandardsInput): ElectricalStandardsEvaluation {
  validateInput(input)
  const totalChargeC = input.chargeCarriers * e
  const carrierEnergyJ = totalChargeC * input.voltageV
  const josephsonFrequencyFromVoltageHz = input.presetId === 'josephson'
    ? KJ * input.voltageV
    : null
  const josephsonVoltageFromFrequencyV = input.presetId === 'josephson'
    ? input.frequencyHz / KJ
    : null

  const nodes: ElectricalNetworkNode[] = [
    node('h', 'Planck constant', 'h', h, 'J s', 'exact-defining-si', 'Fixed exact SI defining constant.'),
    node('e', 'Elementary charge', 'e', e, 'C', 'exact-defining-si', 'Fixed exact SI defining constant.'),
    node('KJ', 'Josephson constant', 'KJ', KJ, 'Hz V^-1', 'exact-derived-si', 'Exact current SI relation KJ = 2e/h.'),
    node('RK', 'von Klitzing constant', 'RK', RK, 'ohm', 'exact-derived-si', 'Exact current SI relation RK = h/e^2.'),
    node('G0', 'Conductance quantum', 'G0', G0, 'S', 'exact-derived-si', 'Exact relation G0 = 2e^2/h including spin degeneracy.'),
    node('Phi0', 'Magnetic flux quantum', 'Phi0', PHI0, 'Wb', 'exact-derived-si', 'Exact superconducting flux quantum Phi0 = h/(2e).'),
    node('eV', 'Electron volt', 'eV', EV, 'J', 'exact-derived-si', 'Exact joule value of one electron volt.'),
    node('KJ-90', '1990 conventional Josephson constant', 'KJ-90', HISTORICAL_1990_CONVENTIONAL_CONSTANTS.josephsonConstant.value, 'Hz V^-1', 'historical-conventional-1990', HISTORICAL_1990_CONVENTIONAL_CONSTANTS.josephsonConstant.note),
    node('RK-90', '1990 conventional von Klitzing constant', 'RK-90', HISTORICAL_1990_CONVENTIONAL_CONSTANTS.vonKlitzingConstant.value, 'ohm', 'historical-conventional-1990', HISTORICAL_1990_CONVENTIONAL_CONSTANTS.vonKlitzingConstant.note),
    node('carrier-charge', 'Total carrier charge magnitude', 'q', totalChargeC, 'C', 'computed', 'Magnitude q = N e for the input integer count.'),
  ]

  if (carrierEnergyJ !== null) {
    nodes.push(node('carrier-energy', 'Carrier energy at voltage', 'E', carrierEnergyJ, 'J', 'computed', 'Computed magnitude E = N e V; sign and device dynamics are outside this calculator.'))
  }
  if (josephsonFrequencyFromVoltageHz !== null) {
    nodes.push(node('josephson-frequency', 'Josephson frequency from voltage', 'fJ', josephsonFrequencyFromVoltageHz, 'Hz', 'computed', 'Ideal relation f = KJ V.'))
  }
  if (josephsonVoltageFromFrequencyV !== null) {
    nodes.push(node('josephson-voltage', 'Josephson voltage from frequency', 'VJ', josephsonVoltageFromFrequencyV, 'V', 'computed', 'Ideal relation V = f/KJ.'))
  }

  const edges: ElectricalNetworkEdge[] = [
    { id: 'h-e-to-kj', from: ['h', 'e'], to: 'KJ', equation: 'KJ = 2e/h', relationship: 'exact-derived-identity', note: 'Current exact SI relationship.' },
    { id: 'h-e-to-rk', from: ['h', 'e'], to: 'RK', equation: 'RK = h/e^2', relationship: 'exact-derived-identity', note: 'Current exact SI relationship.' },
    { id: 'h-e-to-g0', from: ['h', 'e'], to: 'G0', equation: 'G0 = 2e^2/h = 2/RK', relationship: 'exact-derived-identity', note: 'Includes spin degeneracy.' },
    { id: 'h-e-to-phi0', from: ['h', 'e'], to: 'Phi0', equation: 'Phi0 = h/(2e)', relationship: 'exact-derived-identity', note: 'Superconducting magnetic flux quantum.' },
    { id: 'e-to-ev', from: ['e'], to: 'eV', equation: '1 eV = e J', relationship: 'definition', note: 'Exact joule conversion at one volt.' },
    { id: 'e-to-carrier-charge', from: ['e'], to: 'carrier-charge', equation: 'q = N e', relationship: 'direct-calculation', note: 'N is the input integer charge-carrier count.' },
    { id: 'kj90-comparison', from: ['KJ-90'], to: 'KJ', equation: '(KJ-90 - KJ)/KJ', relationship: 'historical-comparison', note: 'Historical conventional value compared with, not substituted for, current exact SI.' },
    { id: 'rk90-comparison', from: ['RK-90'], to: 'RK', equation: '(RK-90 - RK)/RK', relationship: 'historical-comparison', note: 'Historical conventional value compared with, not substituted for, current exact SI.' },
  ]

  if (carrierEnergyJ !== null) {
    edges.push({ id: 'charge-voltage-to-energy', from: ['carrier-charge'], to: 'carrier-energy', equation: 'E = q V = N e V', relationship: 'direct-calculation', note: 'Energy magnitude for the supplied voltage.' })
  }
  if (josephsonFrequencyFromVoltageHz !== null) {
    edges.push({ id: 'kj-voltage-to-frequency', from: ['KJ'], to: 'josephson-frequency', equation: 'f = KJ V', relationship: 'direct-calculation', note: 'Ideal Josephson conversion; practical realization has uncertainty and device conditions.' })
  }
  if (josephsonVoltageFromFrequencyV !== null) {
    edges.push({ id: 'kj-frequency-to-voltage', from: ['KJ'], to: 'josephson-voltage', equation: 'V = f/KJ', relationship: 'direct-calculation', note: 'Ideal Josephson conversion; practical realization has uncertainty and device conditions.' })
  }

  const comparisons = historicalComparisons()
  return deepFreeze({
    tier: 'immediate',
    presetId: input.presetId,
    chargeCarriers: input.chargeCarriers,
    totalChargeC,
    frequencyHz: input.frequencyHz,
    voltageV: input.voltageV,
    carrierEnergyJ,
    josephsonFrequencyFromVoltageHz,
    josephsonVoltageFromFrequencyV,
    kj90DifferencePpm: comparisons[0]!.partsPerMillion,
    rk90DifferencePpm: comparisons[1]!.partsPerMillion,
    networkStatus: 'exact-input-dependent-and-historical-layers-separated',
    nodes,
    edges,
    historicalComparisons: comparisons,
    finding: buildFinding(input, comparisons),
  })
}

export function projectElectricalStandardsTable(output: ElectricalStandardsEvaluation): readonly ElectricalStandardsTableRow[] {
  return deepFreeze(output.nodes.map(({ id, label, symbol, value, unit, statusLabel, note }) => ({
    id,
    label,
    symbol,
    value,
    unit,
    statusLabel,
    note,
  })))
}

export function projectElectricalStandardsSeries(output: ElectricalStandardsEvaluation): readonly Readonly<{
  id: ElectricalNodeId
  label: string
  log10AbsoluteValue: number
  value: number
  unit: string
  accessibleLabel: string
}>[] {
  return deepFreeze(output.nodes.filter(({ value }) => value !== 0).map(({ id, label, value, unit }) => ({
    id,
    label,
    log10AbsoluteValue: Math.log10(Math.abs(value)),
    value,
    unit,
    accessibleLabel: `${label}: ${value.toExponential(6)} ${unit}`,
  })))
}
