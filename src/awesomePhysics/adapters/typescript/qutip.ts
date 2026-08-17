import { fail, jsonRecord as record, finiteNumber, boundedNumber, exactKeys, requireSafeIntegerBetween, throwIfAborted, throwIfAnyAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const QUTIP_CATALOG_ITEM_ID = 'awesome-qutip' as const
export const QUTIP_ADAPTER_ID = 'awesome-qutip-typescript' as const
export const QUTIP_KERNEL_REVISION = 'qutip-two-level-rabi-lindblad-typescript-v1' as const
export const QUTIP_SOURCE_REVISION = 'fbfb1f8bf302' as const
export const QUTIP_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/qutip/qutip',
  license: 'QuTiP is BSD-3-Clause; this independent kernel does not redistribute QuTiP, Cython, or SciPy.',
  data: 'No QuTiP solver, operator algebra, or example dataset is bundled.',
})

export const QUTIP_BOUNDS = Object.freeze({
  frequency: Object.freeze({ min: -20, max: 20 }),
  decayRate: Object.freeze({ min: 0, max: 20 }),
  timeStep: Object.freeze({ min: 1e-5, max: 0.05 }),
  steps: Object.freeze({ min: 1, max: 4000 }),
  sampleEvery: Object.freeze({ min: 1, max: 400 }),
  maxOutputAbs: 1e12,
} as const)

export interface QutipRabiInputV1 {
  operation: 'rabi-population'
  rabiFrequency: number
  detuning: number
  timeStep: number
  steps: number
  sampleEvery: number
}

export interface QutipLindbladInputV1 {
  operation: 'lindblad-bloch'
  rabiFrequency: number
  detuning: number
  decayRate: number
  timeStep: number
  steps: number
  sampleEvery: number
}

export type QutipInputV1 = QutipRabiInputV1 | QutipLindbladInputV1

export interface QutipSampleV1 {
  step: number
  time: number
  excitedPopulation: number
  groundPopulation: number
  inversion: number
}

export interface QutipRabiOutputV1 {
  schemaVersion: 1
  operation: 'rabi-population'
  input: QutipRabiInputV1
  samples: readonly QutipSampleV1[]
  peakExcitedPopulation: number
  effectiveRabiFrequency: number
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
  validatesTheory: false
  doesNotEstablish: string
}

export interface QutipLindbladOutputV1 {
  schemaVersion: 1
  operation: 'lindblad-bloch'
  input: QutipLindbladInputV1
  samples: readonly QutipSampleV1[]
  finalExcitedPopulation: number
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
  validatesTheory: false
  doesNotEstablish: string
}

export type QutipOutputV1 = QutipRabiOutputV1 | QutipLindbladOutputV1
export type QutipAdapter = AwesomePhysicsAdapterV1<QutipInputV1, QutipOutputV1>
export type QutipAdapterFactory = AwesomePhysicsAdapterFactoryV1<QutipInputV1, QutipOutputV1>
function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > QUTIP_BOUNDS.maxOutputAbs) {
    throw new RangeError(`${path} is outside the finite output bound`)
  }
  return value === 0 ? 0 : value
}
function parseSharedDrive(input: Record<string, unknown>, path: string): {
  rabiFrequency: number
  detuning: number
  timeStep: number
  steps: number
  sampleEvery: number
} {
  const steps = requireSafeIntegerBetween(input.steps, `${path}.steps`, QUTIP_BOUNDS.steps.min, QUTIP_BOUNDS.steps.max)
  const sampleEvery = requireSafeIntegerBetween(input.sampleEvery, `${path}.sampleEvery`, QUTIP_BOUNDS.sampleEvery.min, QUTIP_BOUNDS.sampleEvery.max)
  if (sampleEvery > steps) fail(`${path}.sampleEvery`, 'must be at most steps')
  return {
    rabiFrequency: boundedNumber(input.rabiFrequency, `${path}.rabiFrequency`, QUTIP_BOUNDS.frequency.min, QUTIP_BOUNDS.frequency.max),
    detuning: boundedNumber(input.detuning, `${path}.detuning`, QUTIP_BOUNDS.frequency.min, QUTIP_BOUNDS.frequency.max),
    timeStep: boundedNumber(input.timeStep, `${path}.timeStep`, QUTIP_BOUNDS.timeStep.min, QUTIP_BOUNDS.timeStep.max),
    steps,
    sampleEvery,
  }
}

export function parseQutipInput(value: unknown): QutipInputV1 {
  const input = record(value, 'qutip input')
  if (input.operation === 'rabi-population') {
    exactKeys(input, ['operation', 'rabiFrequency', 'detuning', 'timeStep', 'steps', 'sampleEvery'], 'qutip input')
    return { operation: 'rabi-population', ...parseSharedDrive(input, 'qutip input') }
  }
  if (input.operation === 'lindblad-bloch') {
    exactKeys(input, ['operation', 'rabiFrequency', 'detuning', 'decayRate', 'timeStep', 'steps', 'sampleEvery'], 'qutip input')
    return {
      operation: 'lindblad-bloch',
      ...parseSharedDrive(input, 'qutip input'),
      decayRate: boundedNumber(input.decayRate, 'qutip input.decayRate', QUTIP_BOUNDS.decayRate.min, QUTIP_BOUNDS.decayRate.max),
    }
  }
  fail('qutip input.operation', 'must be rabi-population or lindblad-bloch')
}

function excitedFromClosedRabi(rabiFrequency: number, detuning: number, time: number): number {
  const omegaEff = Math.hypot(rabiFrequency, detuning)
  if (omegaEff === 0) return 0
  const amplitude = (rabiFrequency * rabiFrequency) / (omegaEff * omegaEff)
  const halfAngle = 0.5 * omegaEff * time
  return amplitude * Math.sin(halfAngle) * Math.sin(halfAngle)
}

function sampleFromExcited(step: number, time: number, excited: number, path: string): QutipSampleV1 {
  const excitedPopulation = finiteOutput(excited, `${path}.excitedPopulation`)
  const groundPopulation = finiteOutput(1 - excitedPopulation, `${path}.groundPopulation`)
  return {
    step,
    time: finiteOutput(time, `${path}.time`),
    excitedPopulation,
    groundPopulation,
    inversion: finiteOutput(excitedPopulation - groundPopulation, `${path}.inversion`),
  }
}

function solveRabi(input: QutipRabiInputV1, signal?: AbortSignal): QutipRabiOutputV1 {
  throwIfAborted(signal, 'The qutip operation was aborted')
  const samples: QutipSampleV1[] = [sampleFromExcited(0, 0, 0, 'samples[0]')]
  let peakExcitedPopulation = 0
  for (let step = 1; step <= input.steps; step += 1) {
    throwIfAborted(signal, 'The qutip operation was aborted')
    const time = step * input.timeStep
    const excited = excitedFromClosedRabi(input.rabiFrequency, input.detuning, time)
    peakExcitedPopulation = Math.max(peakExcitedPopulation, excited)
    if (step % input.sampleEvery === 0 || step === input.steps) {
      samples.push(sampleFromExcited(step, time, excited, `samples[${samples.length}]`))
    }
  }
  return {
    schemaVersion: 1,
    operation: 'rabi-population',
    input,
    samples,
    peakExcitedPopulation: finiteOutput(peakExcitedPopulation, 'peakExcitedPopulation'),
    effectiveRabiFrequency: finiteOutput(Math.hypot(input.rabiFrequency, input.detuning), 'effectiveRabiFrequency'),
    assumptions: [
      'The model is a closed two-level atom starting in the ground state under a constant drive.',
      'Excited population is (Ω² / Ω_eff²) sin²(Ω_eff t / 2) with Ω_eff = hypot(Ω, Δ).',
      'QuTiP mesolve, QuTiP operators, and any example dataset are not used.',
    ],
    numericalMethod: 'Closed-form two-level Rabi population for a constant detuned drive.',
    licenseCaveat: QUTIP_SOURCE_CAVEATS.license,
    validatesTheory: false,
    doesNotEstablish: 'A finite two-level Rabi or Bloch sample does not establish experimental agreement or scientific validation of QuTiP.',
  }
}

function blochDerivative(u: number, v: number, w: number, omega: number, detuning: number, decay: number): readonly [number, number, number] {
  return [
    -detuning * v - 0.5 * decay * u,
    detuning * u + omega * w - 0.5 * decay * v,
    -omega * v - decay * (w + 1),
  ]
}

function solveLindblad(input: QutipLindbladInputV1, signal?: AbortSignal): QutipLindbladOutputV1 {
  throwIfAborted(signal, 'The qutip operation was aborted')
  let u = 0
  let v = 0
  let w = -1
  const samples: QutipSampleV1[] = [sampleFromExcited(0, 0, 0, 'samples[0]')]
  for (let step = 1; step <= input.steps; step += 1) {
    throwIfAborted(signal, 'The qutip operation was aborted')
    const k1 = blochDerivative(u, v, w, input.rabiFrequency, input.detuning, input.decayRate)
    const k2 = blochDerivative(u + 0.5 * input.timeStep * k1[0], v + 0.5 * input.timeStep * k1[1], w + 0.5 * input.timeStep * k1[2], input.rabiFrequency, input.detuning, input.decayRate)
    const k3 = blochDerivative(u + 0.5 * input.timeStep * k2[0], v + 0.5 * input.timeStep * k2[1], w + 0.5 * input.timeStep * k2[2], input.rabiFrequency, input.detuning, input.decayRate)
    const k4 = blochDerivative(u + input.timeStep * k3[0], v + input.timeStep * k3[1], w + input.timeStep * k3[2], input.rabiFrequency, input.detuning, input.decayRate)
    u += (input.timeStep / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0])
    v += (input.timeStep / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])
    w += (input.timeStep / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2])
    if (step % input.sampleEvery === 0 || step === input.steps) {
      samples.push(sampleFromExcited(step, step * input.timeStep, 0.5 * (w + 1), `samples[${samples.length}]`))
    }
  }
  const lastSample = samples[samples.length - 1]
  if (!lastSample) throw new RangeError('qutip samples are empty')
  return {
    schemaVersion: 1,
    operation: 'lindblad-bloch',
    input,
    samples,
    finalExcitedPopulation: lastSample.excitedPopulation,
    assumptions: [
      'Optical Bloch equations use H = (Δ/2)σ_z + (Ω/2)σ_x and a radiative Lindblad jump σ_- with rate γ.',
      'T1 = 1/γ and T2 = 2/γ; the equilibrium inversion is -1. The integrator is classical RK4.',
      'QuTiP mesolve and any QuTiP operator algebra are not used.',
    ],
    numericalMethod: 'Bounded classical RK4 integration of two-level optical Bloch equations with radiative decay.',
    licenseCaveat: QUTIP_SOURCE_CAVEATS.license,
    validatesTheory: false,
    doesNotEstablish: 'A finite two-level Rabi or Bloch sample does not establish experimental agreement or scientific validation of QuTiP.',
  }
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal, 'The qutip operation was aborted')
  if (descriptor.catalogItemId !== QUTIP_CATALOG_ITEM_ID || descriptor.title !== 'qutip') {
    throw new TypeError('qutip adapter requires the qutip simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('qutip adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.trim().length === 0)) {
    throw new TypeError('qutip descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('qutip descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? QUTIP_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createQutipAdapter: QutipAdapterFactory = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      throwIfAborted(signal, 'The qutip operation was aborted')
      throwIfAborted(runSignal, 'The qutip operation was aborted')
      const parsed = parseQutipInput(input)
      const output = parsed.operation === 'rabi-population'
        ? solveRabi(parsed, runSignal ?? signal)
        : solveLindblad(parsed, runSignal ?? signal)
      throwIfAborted(runSignal, 'The qutip operation was aborted')
      return output
    },
  }
}

export const qutipAdapterFactory = createQutipAdapter
