import type { ResultFinding, TourRuntimeResultAttribution } from '../types/tour'
import { CODATA_2022_MEASURED_CONSTANTS } from './physicsConstants'

export const SPIN_PRECESSION_PARTICLE_IDS = Object.freeze(['electron', 'proton', 'muon'] as const)
export const SPIN_PRECESSION_PRESET_IDS = Object.freeze([
  'earth-ish',
  'proton-nmr-1t',
  'proton-nmr-3t',
  'electron-resonance',
] as const)

export type SpinPrecessionParticleId = typeof SPIN_PRECESSION_PARTICLE_IDS[number]
export type SpinPrecessionPresetId = typeof SPIN_PRECESSION_PRESET_IDS[number]

export interface SpinPrecessionInput {
  particle: SpinPrecessionParticleId
  magneticFieldTesla: number
  timeSeconds: number
  sampleCount?: number
}

export interface SpinPrecessionParticleCatalogEntry {
  id: SpinPrecessionParticleId
  label: string
  signedCyclicGammaHzPerTesla: number
}

export interface SpinPrecessionPreset {
  id: SpinPrecessionPresetId
  label: string
  description: string
  input: Readonly<Required<SpinPrecessionInput>>
}

export interface SpinPrecessionSample {
  timeSeconds: number
  phaseRadians: number
  x: number
  y: number
}

type FindingNarrative = Pick<
  ResultFinding,
  'changed' | 'cause' | 'equation' | 'assumptions' | 'establishes' | 'doesNotEstablish'
>

export type SpinPrecessionFinding = FindingNarrative & TourRuntimeResultAttribution

export interface SpinPrecessionResult {
  particle: SpinPrecessionParticleId
  particleLabel: string
  magneticFieldTesla: number
  timeSeconds: number
  signedCyclicGammaHzPerTesla: number
  signedCyclicFrequencyHz: number
  cyclicFrequencyMagnitudeHz: number
  angularFrequencyRadPerSecond: number
  angularFrequencyMagnitudeRadPerSecond: number
  periodSeconds: number
  phaseRadians: number
  phaseCycles: number
  rotationSense: 'counterclockwise' | 'clockwise'
  samples: SpinPrecessionSample[]
  finding: SpinPrecessionFinding
}

export interface SpinPrecessionTableRow {
  sample: number
  timeSeconds: number
  phaseRadians: number
  x: number
  y: number
}

const {
  electronGyromagneticRatioOver2Pi,
  muonGyromagneticRatioOver2Pi,
  protonGyromagneticRatioOver2Pi,
} = CODATA_2022_MEASURED_CONSTANTS

export const SPIN_PRECESSION_PARTICLES = Object.freeze([
  Object.freeze({ id: 'electron', label: 'Electron', signedCyclicGammaHzPerTesla: electronGyromagneticRatioOver2Pi.value }),
  Object.freeze({ id: 'proton', label: 'Free proton', signedCyclicGammaHzPerTesla: protonGyromagneticRatioOver2Pi.value }),
  Object.freeze({ id: 'muon', label: 'Negative muon', signedCyclicGammaHzPerTesla: muonGyromagneticRatioOver2Pi.value }),
] as const satisfies readonly SpinPrecessionParticleCatalogEntry[])

export const SPIN_PRECESSION_BOUNDS = Object.freeze({
  magneticFieldTesla: Object.freeze({ min: 1e-6, max: 20 }),
  timeSeconds: Object.freeze({ min: 0, max: 10 }),
  sampleCount: Object.freeze({ min: 2, max: 128, default: 64 }),
} as const)

function presetInput(
  particle: SpinPrecessionParticleId,
  magneticFieldTesla: number,
  timeSeconds: number,
  sampleCount = SPIN_PRECESSION_BOUNDS.sampleCount.default,
): Readonly<Required<SpinPrecessionInput>> {
  return Object.freeze({ particle, magneticFieldTesla, timeSeconds, sampleCount })
}

export const SPIN_PRECESSION_PRESETS = Object.freeze([
  Object.freeze({
    id: 'earth-ish',
    label: 'Earth-ish field',
    description: 'Free-proton model in a representative 50 microtesla field; not a local geomagnetic measurement.',
    input: presetInput('proton', 50e-6, 1e-3),
  }),
  Object.freeze({
    id: 'proton-nmr-1t',
    label: 'Free-proton NMR at 1 T',
    description: 'Unshielded free-proton reference at 1 tesla; not a material-specific NMR line.',
    input: presetInput('proton', 1, 1e-6),
  }),
  Object.freeze({
    id: 'proton-nmr-3t',
    label: 'Free-proton NMR at 3 T',
    description: 'Unshielded free-proton reference at 3 tesla; not a material-specific NMR line.',
    input: presetInput('proton', 3, 1e-6),
  }),
  Object.freeze({
    id: 'electron-resonance',
    label: 'Electron resonance reference',
    description: 'Free-electron model at 0.34 tesla, near a conventional X-band frequency; no material g-tensor.',
    input: presetInput('electron', 0.34, 1e-9),
  }),
] as const satisfies readonly SpinPrecessionPreset[])

function validateSpinPrecessionInput(input: SpinPrecessionInput): number {
  if (!input || typeof input !== 'object') throw new Error('Spin precession input must be an object')
  if (!(SPIN_PRECESSION_PARTICLE_IDS as readonly unknown[]).includes(input.particle)) {
    throw new Error(`Unknown spin precession particle: ${String(input.particle)}`)
  }
  if (!Number.isFinite(input.magneticFieldTesla)) throw new Error('Spin precession magneticFieldTesla must be finite')
  if (input.magneticFieldTesla < SPIN_PRECESSION_BOUNDS.magneticFieldTesla.min || input.magneticFieldTesla > SPIN_PRECESSION_BOUNDS.magneticFieldTesla.max) {
    throw new Error('Spin precession magneticFieldTesla must be within [0.000001, 20]')
  }
  if (!Number.isFinite(input.timeSeconds)) throw new Error('Spin precession timeSeconds must be finite')
  if (input.timeSeconds < SPIN_PRECESSION_BOUNDS.timeSeconds.min || input.timeSeconds > SPIN_PRECESSION_BOUNDS.timeSeconds.max) {
    throw new Error('Spin precession timeSeconds must be within [0, 10]')
  }
  const sampleCount = input.sampleCount ?? SPIN_PRECESSION_BOUNDS.sampleCount.default
  if (!Number.isInteger(sampleCount)) throw new Error('Spin precession sampleCount must be an integer')
  if (sampleCount < SPIN_PRECESSION_BOUNDS.sampleCount.min || sampleCount > SPIN_PRECESSION_BOUNDS.sampleCount.max) {
    throw new Error('Spin precession sampleCount must be within [2, 128]')
  }
  return sampleCount
}

function buildFinding(
  particle: SpinPrecessionParticleCatalogEntry,
  magneticFieldTesla: number,
  signedCyclicFrequencyHz: number,
): SpinPrecessionFinding {
  return {
    changed: `The ${particle.label} model at B=${magneticFieldTesla} T gives signed cyclic frequency ${signedCyclicFrequencyHz} Hz.`,
    cause: 'The signed CODATA cyclic gyromagnetic ratio is multiplied by the positive field magnitude; angular frequency then includes the explicit factor 2 pi.',
    equation: 'mu = gamma S; H = -mu dot B; f = (gamma/(2 pi)) B; omega = 2 pi f; phi(t) = -omega t; (x, y) = (cos phi, sin phi)',
    assumptions: [
      'A static uniform magnetic field points along the positive z axis and B is entered as its positive magnitude.',
      'The reported transverse unit-circle coordinates use x=cos(phi), y=sin(phi) with phase rate dphi/dt=-omega.',
      'The particle uses the free-particle signed gyromagnetic ratio in the catalog and begins at phase zero.',
    ],
    establishes: 'Within the declared moment-field phase model, the result computes signed cyclic frequency, signed angular frequency, period, phase, and bounded transverse samples.',
    doesNotEstablish: 'It does not report an observed resonance, validate a magnetic-moment theory, or model relaxation, shielding, material response, field gradients, interactions, or detector signals.',
    claimClass: 'established-model',
    evidenceRefs: ['openstax-university-physics-v3', 'codata-2022'],
    sourceRevision: 'OpenStax University Physics Volume 3, 2016 web edition; CODATA 2022 adjustment',
    sourceLocator: 'OpenStax sections 8.2-8.3; CODATA gamma/(2 pi) for electron, free proton, and negative muon',
    methodRelationship: 'not-applicable',
    modelOrigin: 'established-physics',
    resultStatus: 'computed',
    validatesTheory: false,
    caveats: [
      'For B along positive z and viewing from positive z, positive gamma gives clockwise phase motion while negative gamma gives counterclockwise motion.',
      'Signed cyclic and angular frequencies retain gamma B and 2 pi f; the coordinate phase has the opposite sign because phi(t) = -omega t.',
      'The period is 1/|f| and is therefore positive even when gamma and the signed frequencies are negative.',
      'No T1/T2 relaxation, chemical or diamagnetic shielding, anisotropic g-tensor, composite correction, material response, or environmental coupling is included.',
      'Preset fields are conventional model inputs, not empirical field measurements or validation data.',
    ],
  }
}

export function evaluateSpinPrecession(input: SpinPrecessionInput): SpinPrecessionResult {
  const sampleCount = validateSpinPrecessionInput(input)
  const particle = SPIN_PRECESSION_PARTICLES.find(({ id }) => id === input.particle)!
  const signedCyclicFrequencyHz = particle.signedCyclicGammaHzPerTesla * input.magneticFieldTesla
  const angularFrequencyRadPerSecond = 2 * Math.PI * signedCyclicFrequencyHz
  const phaseRadians = input.timeSeconds === 0 ? 0 : -angularFrequencyRadPerSecond * input.timeSeconds
  const samples = Array.from({ length: sampleCount }, (_, index) => {
    const timeSeconds = input.timeSeconds * index / (sampleCount - 1)
    const samplePhaseRadians = timeSeconds === 0 ? 0 : -angularFrequencyRadPerSecond * timeSeconds
    return {
      timeSeconds,
      phaseRadians: samplePhaseRadians,
      x: Math.cos(samplePhaseRadians),
      y: Math.sin(samplePhaseRadians),
    }
  })

  return {
    particle: particle.id,
    particleLabel: particle.label,
    magneticFieldTesla: input.magneticFieldTesla,
    timeSeconds: input.timeSeconds,
    signedCyclicGammaHzPerTesla: particle.signedCyclicGammaHzPerTesla,
    signedCyclicFrequencyHz,
    cyclicFrequencyMagnitudeHz: Math.abs(signedCyclicFrequencyHz),
    angularFrequencyRadPerSecond,
    angularFrequencyMagnitudeRadPerSecond: Math.abs(angularFrequencyRadPerSecond),
    periodSeconds: 1 / Math.abs(signedCyclicFrequencyHz),
    phaseRadians,
    phaseCycles: -signedCyclicFrequencyHz * input.timeSeconds,
    rotationSense: angularFrequencyRadPerSecond > 0 ? 'clockwise' : 'counterclockwise',
    samples,
    finding: buildFinding(particle, input.magneticFieldTesla, signedCyclicFrequencyHz),
  }
}

export function projectSpinPrecessionTable(
  result: Pick<SpinPrecessionResult, 'samples'>,
): SpinPrecessionTableRow[] {
  return result.samples.map((sample, index) => ({ sample: index, ...sample }))
}
