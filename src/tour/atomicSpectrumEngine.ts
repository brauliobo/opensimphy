import type { ResultFinding, TourRuntimeResultAttribution } from '../types/tour'
import {
  CODATA_2022_MEASURED_CONSTANTS,
  SI_EXACT_CONSTANTS,
} from './physicsConstants'

export const ATOMIC_NUCLEUS_MODEL_IDS = Object.freeze(['infinite', 'proton'] as const)
export const ATOMIC_SPECTRAL_SERIES_IDS = Object.freeze(['Lyman', 'Balmer', 'Paschen'] as const)

export type AtomicNucleusModelId = typeof ATOMIC_NUCLEUS_MODEL_IDS[number]
export type AtomicSpectralSeriesId = typeof ATOMIC_SPECTRAL_SERIES_IDS[number]
export type AtomicSpectralRegion = 'x-ray' | 'ultraviolet' | 'visible' | 'infrared'

export interface AtomicSpectrumInput {
  atomicNumber: number
  nUpper: number
  nLower: number
  nucleusModel: AtomicNucleusModelId
}

export interface AtomicSpectralSeriesCatalogEntry {
  id: AtomicSpectralSeriesId
  nLower: 1 | 2 | 3
  label: string
}

export interface AtomicSpectrumLine {
  nUpper: number
  nLower: number
  label: string
  series: AtomicSpectralSeriesId | null
  energyJ: number
  energyEv: number
  frequencyHz: number
  vacuumWavelengthM: number
  vacuumWavelengthNm: number
  visible: boolean
  spectralRegion: AtomicSpectralRegion
}

type FindingNarrative = Pick<
  ResultFinding,
  'changed' | 'cause' | 'equation' | 'assumptions' | 'establishes' | 'doesNotEstablish'
>

export type AtomicSpectrumFinding = FindingNarrative & TourRuntimeResultAttribution

export interface AtomicSpectrumResult extends AtomicSpectrumLine {
  atomicNumber: number
  nucleusModel: AtomicNucleusModelId
  reducedMassFactor: number
  effectiveRydbergMInverse: number
  lineSeriesTable: AtomicSpectrumLine[]
  finding: AtomicSpectrumFinding
}

export interface AtomicSpectrumTableRow {
  transition: string
  series: string
  energyEv: number
  frequencyHz: number
  vacuumWavelengthNm: number
  spectralRegion: AtomicSpectralRegion
  visible: boolean
}

export const ATOMIC_SPECTRAL_SERIES = Object.freeze([
  Object.freeze({ id: 'Lyman', nLower: 1, label: 'Lyman series' }),
  Object.freeze({ id: 'Balmer', nLower: 2, label: 'Balmer series' }),
  Object.freeze({ id: 'Paschen', nLower: 3, label: 'Paschen series' }),
] as const satisfies readonly AtomicSpectralSeriesCatalogEntry[])

export const ATOMIC_SPECTRUM_BOUNDS = Object.freeze({
  atomicNumber: Object.freeze({ min: 1, max: 10 }),
  nUpper: Object.freeze({ min: 2, max: 12 }),
  nLower: Object.freeze({ min: 1, max: 11 }),
  maxLineSeriesRows: 11,
} as const)

const GREEK_LINE_NAMES = Object.freeze(['alpha', 'beta', 'gamma', 'delta'] as const)

function validateAtomicSpectrumInput(input: AtomicSpectrumInput): void {
  if (!input || typeof input !== 'object') throw new Error('Atomic spectrum input must be an object')
  if (!Number.isInteger(input.atomicNumber)) throw new Error('Atomic spectrum atomicNumber must be an integer')
  if (input.atomicNumber < ATOMIC_SPECTRUM_BOUNDS.atomicNumber.min || input.atomicNumber > ATOMIC_SPECTRUM_BOUNDS.atomicNumber.max) {
    throw new Error('Atomic spectrum atomicNumber must be within [1, 10]')
  }
  if (!Number.isInteger(input.nUpper)) throw new Error('Atomic spectrum nUpper must be an integer')
  if (input.nUpper < ATOMIC_SPECTRUM_BOUNDS.nUpper.min || input.nUpper > ATOMIC_SPECTRUM_BOUNDS.nUpper.max) {
    throw new Error('Atomic spectrum nUpper must be within [2, 12]')
  }
  if (!Number.isInteger(input.nLower)) throw new Error('Atomic spectrum nLower must be an integer')
  if (input.nLower < 1 || input.nLower >= input.nUpper) {
    throw new Error('Atomic spectrum nLower must be within [1, nUpper - 1]')
  }
  if (!(ATOMIC_NUCLEUS_MODEL_IDS as readonly unknown[]).includes(input.nucleusModel)) {
    throw new Error(`Unknown atomic spectrum nucleus model: ${String(input.nucleusModel)}`)
  }
}

function seriesForLowerLevel(nLower: number): AtomicSpectralSeriesId | null {
  return ATOMIC_SPECTRAL_SERIES.find((entry) => entry.nLower === nLower)?.id ?? null
}

function lineLabel(series: AtomicSpectralSeriesId | null, nUpper: number, nLower: number): string {
  if (series === null) return `n=${nUpper} to n=${nLower}`
  const greekName = GREEK_LINE_NAMES[nUpper - nLower - 1]
  return greekName ? `${series}-${greekName}` : `${series} n=${nUpper} to n=${nLower}`
}

function spectralRegion(vacuumWavelengthM: number): AtomicSpectralRegion {
  const wavelengthNm = vacuumWavelengthM * 1e9
  if (wavelengthNm < 10) return 'x-ray'
  if (wavelengthNm < 380) return 'ultraviolet'
  if (wavelengthNm <= 750) return 'visible'
  return 'infrared'
}

function calculateLine(
  atomicNumber: number,
  nUpper: number,
  nLower: number,
  effectiveRydbergMInverse: number,
): AtomicSpectrumLine {
  const { elementaryCharge, planckConstant, speedOfLight } = SI_EXACT_CONSTANTS
  const wavenumber = effectiveRydbergMInverse * atomicNumber ** 2 * (1 / nLower ** 2 - 1 / nUpper ** 2)
  const vacuumWavelengthM = 1 / wavenumber
  const frequencyHz = speedOfLight.value * wavenumber
  const energyJ = planckConstant.value * frequencyHz
  const series = seriesForLowerLevel(nLower)
  const region = spectralRegion(vacuumWavelengthM)

  return {
    nUpper,
    nLower,
    label: lineLabel(series, nUpper, nLower),
    series,
    energyJ,
    energyEv: energyJ / elementaryCharge.value,
    frequencyHz,
    vacuumWavelengthM,
    vacuumWavelengthNm: vacuumWavelengthM * 1e9,
    visible: region === 'visible',
    spectralRegion: region,
  }
}

function buildFinding(
  input: AtomicSpectrumInput,
  line: AtomicSpectrumLine,
  reducedMassFactor: number,
): AtomicSpectrumFinding {
  const finiteMassAssumption = input.nucleusModel === 'proton'
    ? 'The finite nucleus is assigned the CODATA proton mass; for Z greater than 1 this is an illustrative mass choice, not a realistic isotope mass.'
    : 'The nucleus is treated as infinitely massive, so nuclear recoil and reduced-mass corrections are omitted.'

  return {
    changed: `The n=${input.nUpper} to n=${input.nLower} hydrogen-like transition for Z=${input.atomicNumber} gives ${line.vacuumWavelengthNm} nm in vacuum.`,
    cause: `The selected nuclear model multiplies R_inf by the electron-nucleus reduced-mass factor ${reducedMassFactor}.`,
    equation: '1/lambda = R_inf (mu/m_e) Z^2 (1/n_lower^2 - 1/n_upper^2); E = h nu = h c/lambda',
    assumptions: [
      'The system is a one-electron, point-Coulomb hydrogen-like ion in the nonrelativistic Bohr/Rydberg model.',
      finiteMassAssumption,
      'The reported wavelength is a vacuum wavelength and the visible interval is conventionally classified as 380-750 nm.',
    ],
    establishes: 'Within the declared model, the result links the selected level-energy difference to photon energy, cyclic frequency, and vacuum wavelength.',
    doesNotEstablish: 'It does not establish that the transition is allowed or observed, identify a unique atom from a line, empirically validate the model, or replace a bound-state Hamiltonian with dimensional analysis.',
    claimClass: 'established-model',
    evidenceRefs: ['openstax-university-physics-v3', 'codata-2022'],
    sourceRevision: 'OpenStax University Physics Volume 3, 2016 web edition; CODATA 2022 adjustment',
    sourceLocator: 'OpenStax sections 8.1 and 8.5; CODATA R_inf, electron mass, and proton mass',
    methodRelationship: 'not-applicable',
    modelOrigin: 'established-physics',
    resultStatus: 'computed',
    validatesTheory: false,
    caveats: [
      'Principal quantum numbers alone do not encode orbital and spin selection rules; a listed line is a model energy difference, not a claim of nonzero transition strength.',
      'Fine structure, hyperfine structure, Lamb shifts, recoil beyond the selected reduced mass, finite nuclear size, external fields, line broadening, and medium response are omitted.',
      'No empirical spectrum, calibration, uncertainty propagation, line intensity, or competing-model comparison is included.',
      'Dimensional consistency can check units but cannot derive or replace the Hamiltonian and quantum-state structure used by the model.',
    ],
  }
}

export function evaluateAtomicSpectrum(input: AtomicSpectrumInput): AtomicSpectrumResult {
  validateAtomicSpectrumInput(input)
  const { electronMass, protonMass, rydbergConstant } = CODATA_2022_MEASURED_CONSTANTS
  const reducedMassFactor = input.nucleusModel === 'infinite'
    ? 1
    : protonMass.value / (protonMass.value + electronMass.value)
  const effectiveRydbergMInverse = rydbergConstant.value * reducedMassFactor
  const line = calculateLine(input.atomicNumber, input.nUpper, input.nLower, effectiveRydbergMInverse)
  const lineSeriesTable = Array.from(
    { length: ATOMIC_SPECTRUM_BOUNDS.nUpper.max - input.nLower },
    (_, index) => calculateLine(input.atomicNumber, input.nLower + index + 1, input.nLower, effectiveRydbergMInverse),
  )

  return {
    ...line,
    atomicNumber: input.atomicNumber,
    nucleusModel: input.nucleusModel,
    reducedMassFactor,
    effectiveRydbergMInverse,
    lineSeriesTable,
    finding: buildFinding(input, line, reducedMassFactor),
  }
}

export function projectAtomicSpectrumTable(
  result: Pick<AtomicSpectrumResult, 'lineSeriesTable'>,
): AtomicSpectrumTableRow[] {
  return result.lineSeriesTable.map((line) => ({
    transition: `${line.nUpper} -> ${line.nLower}`,
    series: line.series ?? 'Higher series',
    energyEv: line.energyEv,
    frequencyHz: line.frequencyHz,
    vacuumWavelengthNm: line.vacuumWavelengthNm,
    spectralRegion: line.spectralRegion,
    visible: line.visible,
  }))
}
