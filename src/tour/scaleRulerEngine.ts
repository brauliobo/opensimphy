import type { ResultFinding, TourRuntimeResultAttribution } from '../types/tour'
import {
  CODATA_2022_MEASURED_CONSTANTS,
  PLANCK_SCALE_CONSTANTS,
  SI_EXACT_CONSTANTS,
} from './physicsConstants'

export const SCALE_QUANTITY_FAMILY_IDS = Object.freeze(['length', 'time', 'mass'] as const)
export const SCALE_RULER_PRESET_IDS = Object.freeze([
  'planck-length',
  'proton-radius',
  'atom-radius',
  'human-height',
  'earth-radius',
  'astronomical-unit',
  'light-year',
  'parsec',
  'observable-universe-radius',
  'planck-time',
  'proton-light-crossing-time',
  'caesium-period',
  'human-heartbeat',
  'day',
  'julian-year',
  'earth-age',
  'universe-age',
  'electron-mass',
  'proton-mass',
  'atomic-mass-unit',
  'human-mass',
  'planck-mass',
  'earth-mass',
  'solar-mass',
  'milky-way-mass',
] as const)

export type ScaleQuantityFamilyId = typeof SCALE_QUANTITY_FAMILY_IDS[number]
export type ScaleRulerPresetId = typeof SCALE_RULER_PRESET_IDS[number]
export type ScaleEntryStatus = 'exact-defined' | 'exact-derived' | 'measured' | 'derived-from-measured' | 'illustrative'
export type ScaleSourceId =
  | 'bipm-si-brochure-9'
  | 'codata-2022'
  | 'iau-2012-resolution-b2'
  | 'iau-resolution-b3-2015'
  | 'opensimphy-scientific-scope'

type FindingNarrative = Pick<
  ResultFinding,
  'changed' | 'cause' | 'equation' | 'assumptions' | 'establishes' | 'doesNotEstablish'
>

export type ScaleRulerFinding = FindingNarrative & TourRuntimeResultAttribution

export interface ScaleRulerInput {
  readonly quantityFamily: ScaleQuantityFamilyId
  readonly presetId: ScaleRulerPresetId
}

export interface ScaleCatalogEntry {
  readonly id: ScaleRulerPresetId
  readonly family: ScaleQuantityFamilyId
  readonly label: string
  readonly valueSi: number
  readonly unit: 'm' | 's' | 'kg'
  readonly status: ScaleEntryStatus
  readonly statusLabel: string
  readonly sourceId: ScaleSourceId
  readonly sourceLabel: string
  readonly note: string
  readonly evidenceRefs: readonly ScaleSourceId[]
}

export interface ScaleRulerEvaluation {
  readonly quantityFamily: ScaleQuantityFamilyId
  readonly unit: 'm' | 's' | 'kg'
  readonly axis: Readonly<{
    scale: 'log10'
    minimumExponent: number
    maximumExponent: number
    label: string
  }>
  readonly selected: ScaleCatalogEntry
  readonly selectedLog10: number
  readonly selectedSiDisplay: string
  readonly entries: readonly ScaleCatalogEntry[]
  readonly finding: ScaleRulerFinding
}

export interface ScaleRulerTableRow {
  readonly id: ScaleRulerPresetId
  readonly label: string
  readonly siValue: number
  readonly siDisplay: string
  readonly log10Si: number
  readonly status: ScaleEntryStatus
  readonly statusLabel: string
  readonly sourceLabel: string
  readonly evidenceRefs: readonly ScaleSourceId[]
  readonly selected: boolean
}

export interface ScaleRulerSeriesPoint {
  readonly id: ScaleRulerPresetId
  readonly label: string
  readonly xLog10Si: number
  readonly siValue: number
  readonly unit: 'm' | 's' | 'kg'
  readonly evidenceRefs: readonly ScaleSourceId[]
  readonly selected: boolean
  readonly accessibleLabel: string
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

const STATUS_LABELS: Readonly<Record<ScaleEntryStatus, string>> = Object.freeze({
  'exact-defined': 'Exact defined reference',
  'exact-derived': 'Exact derived value',
  measured: 'Measured or adjusted value',
  'derived-from-measured': 'Derived from measured value',
  illustrative: 'Illustrative scale',
})

const SOURCE_LABELS: Readonly<Record<ScaleSourceId, string>> = Object.freeze({
  'bipm-si-brochure-9': 'BIPM SI Brochure, 9th edition',
  'codata-2022': 'CODATA 2022 recommended values',
  'iau-2012-resolution-b2': 'IAU 2012 Resolution B2 astronomical-unit definition',
  'iau-resolution-b3-2015': 'IAU 2015 Resolution B3 nominal conversion constants',
  'opensimphy-scientific-scope': 'OpenSimPhy internal illustrative scope',
})

const SOURCE_REVISIONS: Readonly<Record<ScaleSourceId, string>> = Object.freeze({
  'bipm-si-brochure-9': 'BIPM SI Brochure, 9th edition, 2026 update',
  'codata-2022': 'CODATA 2022 adjustment',
  'iau-2012-resolution-b2': 'IAU 2012 Resolution B2',
  'iau-resolution-b3-2015': 'IAU 2015 Resolution B3',
  'opensimphy-scientific-scope': 'OpenSimPhy bounded illustrative catalog, 2026-07-27',
})

function entry(
  id: ScaleRulerPresetId,
  family: ScaleQuantityFamilyId,
  label: string,
  valueSi: number,
  unit: ScaleCatalogEntry['unit'],
  status: ScaleEntryStatus,
  sourceId: ScaleSourceId,
  note: string,
  evidenceRefs: readonly [ScaleSourceId, ...ScaleSourceId[]] = [sourceId],
): ScaleCatalogEntry {
  if (!Number.isFinite(valueSi) || valueSi <= 0) throw new Error(`Scale catalog value for ${id} must be finite and positive`)
  return deepFreeze({
    id,
    family,
    label,
    valueSi,
    unit,
    status,
    statusLabel: STATUS_LABELS[status],
    sourceId,
    sourceLabel: SOURCE_LABELS[sourceId],
    note,
    evidenceRefs,
  })
}

const c = SI_EXACT_CONSTANTS.speedOfLight.value
const JULIAN_YEAR_SECONDS = 365.25 * 86_400
const ASTRONOMICAL_UNIT_METRES = 149_597_870_700
const NOMINAL_SOLAR_MASS_PARAMETER = 1.327_124_4e20

export const SCALE_RULER_CATALOG: readonly ScaleCatalogEntry[] = deepFreeze([
  entry('planck-length', 'length', 'Planck length', PLANCK_SCALE_CONSTANTS.planckLength.value, 'm', 'derived-from-measured', 'codata-2022', 'Derived as sqrt(hbar G/c^3); uncertainty is inherited from measured G.'),
  entry('proton-radius', 'length', 'Proton charge-radius scale', 8.4075e-16, 'm', 'measured', 'codata-2022', 'Representative CODATA proton rms charge radius; not a hard proton boundary.'),
  entry('atom-radius', 'length', 'Atomic radius scale', 1e-10, 'm', 'illustrative', 'opensimphy-scientific-scope', 'Representative atomic extent; atoms do not share one universal radius.'),
  entry('human-height', 'length', 'Human height scale', 1.7, 'm', 'illustrative', 'opensimphy-scientific-scope', 'Illustrative human-scale length, not a population estimate.'),
  entry('earth-radius', 'length', 'Earth mean-radius scale', 6.371e6, 'm', 'illustrative', 'opensimphy-scientific-scope', 'Rounded illustrative terrestrial scale; Earth is not a perfect sphere and no measurement reference is asserted.'),
  entry('astronomical-unit', 'length', 'Astronomical unit', ASTRONOMICAL_UNIT_METRES, 'm', 'exact-defined', 'iau-2012-resolution-b2', 'The astronomical unit is defined exactly in metres.'),
  entry('light-year', 'length', 'Light-year', c * JULIAN_YEAR_SECONDS, 'm', 'exact-derived', 'bipm-si-brochure-9', 'Exact product of c and the conventional Julian year.'),
  entry('parsec', 'length', 'Parsec', 648_000 * ASTRONOMICAL_UNIT_METRES / Math.PI, 'm', 'exact-derived', 'bipm-si-brochure-9', 'Exact geometrical value 648000/pi astronomical units.'),
  entry('observable-universe-radius', 'length', 'Observable-universe radius scale', 4.4e26, 'm', 'illustrative', 'opensimphy-scientific-scope', 'Model-dependent present comoving-radius scale; not a fixed boundary measurement.'),

  entry('planck-time', 'time', 'Planck time', PLANCK_SCALE_CONSTANTS.planckTime.value, 's', 'derived-from-measured', 'codata-2022', 'Derived as sqrt(hbar G/c^5); uncertainty is inherited from measured G.'),
  entry('proton-light-crossing-time', 'time', 'Proton light-crossing scale', 8.4075e-16 / c, 's', 'derived-from-measured', 'codata-2022', 'Proton charge-radius scale divided by exact c; uncertainty is inherited from the measured radius.', ['codata-2022', 'bipm-si-brochure-9']),
  entry('caesium-period', 'time', 'Cs-133 defining-transition period', 1 / SI_EXACT_CONSTANTS.deltaNuCs.value, 's', 'exact-derived', 'bipm-si-brochure-9', 'Exact reciprocal of the fixed caesium defining frequency.'),
  entry('human-heartbeat', 'time', 'Human heartbeat scale', 1, 's', 'illustrative', 'opensimphy-scientific-scope', 'Illustrative biological timescale, not a clinical reference interval.'),
  entry('day', 'time', 'Day', 86_400, 's', 'exact-defined', 'bipm-si-brochure-9', 'Conventional day equal to exactly 86,400 seconds.'),
  entry('julian-year', 'time', 'Julian year', JULIAN_YEAR_SECONDS, 's', 'exact-defined', 'bipm-si-brochure-9', 'Conventional Julian year equal to exactly 365.25 days.'),
  entry('earth-age', 'time', 'Earth age scale', 4.54e9 * JULIAN_YEAR_SECONDS, 's', 'illustrative', 'opensimphy-scientific-scope', 'Rounded geochronological scale with no measurement reference or uncertainty asserted.'),
  entry('universe-age', 'time', 'Universe age scale', 13.8e9 * JULIAN_YEAR_SECONDS, 's', 'illustrative', 'opensimphy-scientific-scope', 'Rounded cosmological-model age scale, not a direct clock reading.'),

  entry('electron-mass', 'mass', 'Electron rest mass', CODATA_2022_MEASURED_CONSTANTS.electronMass.value, 'kg', 'measured', 'codata-2022', 'CODATA 2022 adjusted electron rest mass.'),
  entry('proton-mass', 'mass', 'Proton rest mass', CODATA_2022_MEASURED_CONSTANTS.protonMass.value, 'kg', 'measured', 'codata-2022', 'CODATA 2022 adjusted proton rest mass.'),
  entry('atomic-mass-unit', 'mass', 'Unified atomic mass unit', 1.660_539_068_92e-27, 'kg', 'measured', 'codata-2022', 'CODATA 2022 adjusted atomic mass constant.'),
  entry('human-mass', 'mass', 'Human mass scale', 70, 'kg', 'illustrative', 'opensimphy-scientific-scope', 'Illustrative human-scale mass, not a population estimate.'),
  entry('planck-mass', 'mass', 'Planck mass', PLANCK_SCALE_CONSTANTS.planckMass.value, 'kg', 'derived-from-measured', 'codata-2022', 'Derived as sqrt(hbar c/G); uncertainty is inherited from measured G.'),
  entry('earth-mass', 'mass', 'Earth mass scale', 5.9722e24, 'kg', 'illustrative', 'opensimphy-scientific-scope', 'Rounded illustrative terrestrial mass scale with no measurement reference or uncertainty asserted.'),
  entry('solar-mass', 'mass', 'Nominal solar mass equivalent', NOMINAL_SOLAR_MASS_PARAMETER / CODATA_2022_MEASURED_CONSTANTS.gravitationalConstant.value, 'kg', 'derived-from-measured', 'iau-resolution-b3-2015', 'Exact nominal solar mass parameter divided by measured G; this kilogram value is not an exact solar mass.', ['iau-resolution-b3-2015', 'codata-2022']),
  entry('milky-way-mass', 'mass', 'Milky Way mass scale', 2e42, 'kg', 'illustrative', 'opensimphy-scientific-scope', 'Model-dependent total galactic mass scale.'),
])

export const SCALE_RULER_DEFAULT_PRESETS: Readonly<Record<ScaleQuantityFamilyId, ScaleRulerPresetId>> = deepFreeze({
  length: 'human-height',
  time: 'human-heartbeat',
  mass: 'human-mass',
})

function formatSi(value: number, unit: ScaleCatalogEntry['unit']): string {
  return `${value.toExponential(6)} ${unit}`
}

function validateInput(input: ScaleRulerInput): void {
  if (!input || typeof input !== 'object') throw new Error('Scale ruler input must be an object')
  if (!(SCALE_QUANTITY_FAMILY_IDS as readonly unknown[]).includes(input.quantityFamily)) {
    throw new Error(`Unknown scale ruler quantity family: ${String(input.quantityFamily)}`)
  }
  if (!(SCALE_RULER_PRESET_IDS as readonly unknown[]).includes(input.presetId)) {
    throw new Error(`Unknown scale ruler preset: ${String(input.presetId)}`)
  }
  const preset = SCALE_RULER_CATALOG.find(({ id }) => id === input.presetId)!
  if (preset.family !== input.quantityFamily) {
    throw new Error(`Scale ruler preset ${input.presetId} does not belong to ${input.quantityFamily}`)
  }
}

function buildFinding(selected: ScaleCatalogEntry, entries: readonly ScaleCatalogEntry[]): ScaleRulerFinding {
  const evidenceRefs = Array.from(new Set(entries.flatMap((entry) => entry.evidenceRefs)))
  return {
    changed: `Selected ${selected.label} on the ${selected.family} ruler at log10(SI value) = ${Math.log10(selected.valueSi).toFixed(6)}.`,
    cause: 'The bounded catalog projects positive SI quantity values onto a base-10 logarithmic coordinate.',
    equation: `x = log10(Q / 1 ${selected.unit})`,
    assumptions: [
      'Each catalog value is interpreted only within its labeled quantity family and SI unit.',
      'Representative entries are pedagogical scales rather than universal or exact object properties.',
      'The logarithmic coordinate depends on the stated SI reference unit.',
    ],
    establishes: `The catalog spans ${entries.length} labeled ${selected.family} scales and locates ${selected.label} on their SI log10 axis.`,
    doesNotEstablish: 'The logarithmic position, any reference normalization, and catalog proximity do not predict a new scale, validate a theory, or imply a physical relationship between entries.',
    claimClass: 'identity',
    evidenceRefs: [evidenceRefs[0]!, ...evidenceRefs.slice(1)],
    sourceRevision: evidenceRefs.map((reference) => SOURCE_REVISIONS[reference]).join('; '),
    sourceLocator: 'Per-entry evidence references and labeled catalog notes for the selected quantity family',
    methodRelationship: 'not-applicable',
    modelOrigin: 'established-physics',
    resultStatus: 'computed',
    validatesTheory: false,
    caveats: [
      selected.note,
      'Exact-defined, exact-derived, measured, derived-from-measured, and illustrative statuses are not interchangeable.',
      'No catalog normalization is interpreted as a prediction.',
    ],
  }
}

export function evaluateScaleRuler(input: ScaleRulerInput): ScaleRulerEvaluation {
  validateInput(input)
  const entries = SCALE_RULER_CATALOG.filter(({ family }) => family === input.quantityFamily)
  const selected = entries.find(({ id }) => id === input.presetId)!
  const exponents = entries.map(({ valueSi }) => Math.log10(valueSi))
  const unit = selected.unit

  return deepFreeze({
    quantityFamily: input.quantityFamily,
    unit,
    axis: {
      scale: 'log10',
      minimumExponent: Math.floor(Math.min(...exponents)),
      maximumExponent: Math.ceil(Math.max(...exponents)),
      label: `log10(${input.quantityFamily} / 1 ${unit})`,
    },
    selected,
    selectedLog10: Math.log10(selected.valueSi),
    selectedSiDisplay: formatSi(selected.valueSi, unit),
    entries,
    finding: buildFinding(selected, entries),
  })
}

export function projectScaleRulerTable(output: ScaleRulerEvaluation): readonly ScaleRulerTableRow[] {
  return deepFreeze(output.entries.map((catalogEntry) => ({
    id: catalogEntry.id,
    label: catalogEntry.label,
    siValue: catalogEntry.valueSi,
    siDisplay: formatSi(catalogEntry.valueSi, catalogEntry.unit),
    log10Si: Math.log10(catalogEntry.valueSi),
    status: catalogEntry.status,
    statusLabel: catalogEntry.statusLabel,
    sourceLabel: catalogEntry.sourceLabel,
    evidenceRefs: catalogEntry.evidenceRefs,
    selected: catalogEntry.id === output.selected.id,
  })))
}

export function projectScaleRulerSeries(output: ScaleRulerEvaluation): readonly ScaleRulerSeriesPoint[] {
  return deepFreeze(output.entries.map((catalogEntry) => ({
    id: catalogEntry.id,
    label: catalogEntry.label,
    xLog10Si: Math.log10(catalogEntry.valueSi),
    siValue: catalogEntry.valueSi,
    unit: catalogEntry.unit,
    evidenceRefs: catalogEntry.evidenceRefs,
    selected: catalogEntry.id === output.selected.id,
    accessibleLabel: `${catalogEntry.label}: ${formatSi(catalogEntry.valueSi, catalogEntry.unit)}, ${catalogEntry.statusLabel}; evidence ${catalogEntry.evidenceRefs.join(', ')}`,
  })))
}
