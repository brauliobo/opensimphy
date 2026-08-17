import { fail, jsonRecord as record, finiteNumber, boundedNumber, exactKeys, requireSafeIntegerBetween, throwIfAborted, throwIfAnyAborted } from '../../../simphy/contract'
import { rk4Step } from '../../../simphy/integrate'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const QUANTUM_PYTHON_LECTURES_CATALOG_ITEM_ID = 'awesome-quantum-python-lectures' as const
export const QUANTUM_PYTHON_LECTURES_ADAPTER_ID = 'awesome-quantum-python-lectures-typescript' as const
export const QUANTUM_PYTHON_LECTURES_KERNEL_REVISION = 'quantum-python-lectures-rk4-lineshape-typescript-v1' as const
export const QUANTUM_PYTHON_LECTURES_SOURCE_REVISION = '4e96b144ae59' as const
export const QUANTUM_PYTHON_LECTURES_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/tommyogden/quantum-python-lectures',
  license: 'The upstream quantum-python-lectures notebooks are MIT-licensed; this independent kernel does not redistribute notebook source, SciPy, or QuTiP.',
  data: 'No Jupyter runtime, SciPy ODE solver, QuTiP, or lecture CSV is bundled.',
})

export const QUANTUM_PYTHON_LECTURES_BOUNDS = Object.freeze({
  omega: Object.freeze({ min: 0.1, max: 20 }),
  displacement: Object.freeze({ min: -20, max: 20 }),
  timeStep: Object.freeze({ min: 1e-5, max: 0.05 }),
  steps: Object.freeze({ min: 1, max: 4000 }),
  sampleEvery: Object.freeze({ min: 1, max: 400 }),
  frequency: Object.freeze({ min: -1e6, max: 1e6 }),
  width: Object.freeze({ min: 1e-9, max: 1e6 }),
  amplitude: Object.freeze({ min: 0, max: 1e6 }),
  maxSamples: 256,
  maxOutputAbs: 1e12,
} as const)

export interface QuantumPythonLecturesOscillatorInputV1 {
  operation: 'rk4-oscillator'
  omega: number
  x0: number
  v0: number
  timeStep: number
  steps: number
  sampleEvery: number
}

export interface QuantumPythonLecturesLineshapeInputV1 {
  operation: 'lineshape'
  kind: 'lorentzian' | 'gaussian'
  center: number
  width: number
  amplitude: number
  frequencies: readonly number[]
}

export type QuantumPythonLecturesInputV1 =
  | QuantumPythonLecturesOscillatorInputV1
  | QuantumPythonLecturesLineshapeInputV1

export interface QuantumPythonLecturesOscillatorSampleV1 {
  step: number
  time: number
  x: number
  v: number
  energy: number
}

export interface QuantumPythonLecturesOscillatorOutputV1 {
  schemaVersion: 1
  operation: 'rk4-oscillator'
  input: QuantumPythonLecturesOscillatorInputV1
  samples: readonly QuantumPythonLecturesOscillatorSampleV1[]
  initialEnergy: number
  finalEnergy: number
  maximumRelativeEnergyError: number
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
  validatesTheory: false
  doesNotEstablish: string
}

export interface QuantumPythonLecturesLineshapeOutputV1 {
  schemaVersion: 1
  operation: 'lineshape'
  input: QuantumPythonLecturesLineshapeInputV1
  intensities: readonly number[]
  peakIntensity: number
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
  validatesTheory: false
  doesNotEstablish: string
}

export type QuantumPythonLecturesOutputV1 =
  | QuantumPythonLecturesOscillatorOutputV1
  | QuantumPythonLecturesLineshapeOutputV1
export type QuantumPythonLecturesAdapter = AwesomePhysicsAdapterV1<
  QuantumPythonLecturesInputV1,
  QuantumPythonLecturesOutputV1
>
export type QuantumPythonLecturesAdapterFactory = AwesomePhysicsAdapterFactoryV1<
  QuantumPythonLecturesInputV1,
  QuantumPythonLecturesOutputV1
>
function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > QUANTUM_PYTHON_LECTURES_BOUNDS.maxOutputAbs) {
    throw new RangeError(`${path} is outside the finite output bound`)
  }
  return value === 0 ? 0 : value
}
function oscillatorEnergy(omega: number, x: number, v: number): number {
  return 0.5 * v * v + 0.5 * omega * omega * x * x
}

export function parseQuantumPythonLecturesInput(value: unknown): QuantumPythonLecturesInputV1 {
  const input = record(value, 'quantum-python-lectures input')
  if (input.operation === 'rk4-oscillator') {
    exactKeys(input, ['operation', 'omega', 'x0', 'v0', 'timeStep', 'steps', 'sampleEvery'], 'quantum-python-lectures input')
    const steps = requireSafeIntegerBetween(input.steps, 'quantum-python-lectures input.steps', QUANTUM_PYTHON_LECTURES_BOUNDS.steps.min, QUANTUM_PYTHON_LECTURES_BOUNDS.steps.max)
    const sampleEvery = requireSafeIntegerBetween(input.sampleEvery, 'quantum-python-lectures input.sampleEvery', QUANTUM_PYTHON_LECTURES_BOUNDS.sampleEvery.min, QUANTUM_PYTHON_LECTURES_BOUNDS.sampleEvery.max)
    if (sampleEvery > steps) fail('quantum-python-lectures input.sampleEvery', 'must be at most steps')
    return {
      operation: 'rk4-oscillator',
      omega: boundedNumber(input.omega, 'quantum-python-lectures input.omega', QUANTUM_PYTHON_LECTURES_BOUNDS.omega.min, QUANTUM_PYTHON_LECTURES_BOUNDS.omega.max),
      x0: boundedNumber(input.x0, 'quantum-python-lectures input.x0', QUANTUM_PYTHON_LECTURES_BOUNDS.displacement.min, QUANTUM_PYTHON_LECTURES_BOUNDS.displacement.max),
      v0: boundedNumber(input.v0, 'quantum-python-lectures input.v0', QUANTUM_PYTHON_LECTURES_BOUNDS.displacement.min, QUANTUM_PYTHON_LECTURES_BOUNDS.displacement.max),
      timeStep: boundedNumber(input.timeStep, 'quantum-python-lectures input.timeStep', QUANTUM_PYTHON_LECTURES_BOUNDS.timeStep.min, QUANTUM_PYTHON_LECTURES_BOUNDS.timeStep.max),
      steps,
      sampleEvery,
    }
  }
  if (input.operation === 'lineshape') {
    exactKeys(input, ['operation', 'kind', 'center', 'width', 'amplitude', 'frequencies'], 'quantum-python-lectures input')
    if (input.kind !== 'lorentzian' && input.kind !== 'gaussian') fail('quantum-python-lectures input.kind', 'must be lorentzian or gaussian')
    if (!Array.isArray(input.frequencies)) fail('quantum-python-lectures input.frequencies', 'must be an array')
    if (input.frequencies.length === 0 || input.frequencies.length > QUANTUM_PYTHON_LECTURES_BOUNDS.maxSamples) {
      fail('quantum-python-lectures input.frequencies', `must contain between 1 and ${QUANTUM_PYTHON_LECTURES_BOUNDS.maxSamples} samples`)
    }
    return {
      operation: 'lineshape',
      kind: input.kind,
      center: boundedNumber(input.center, 'quantum-python-lectures input.center', QUANTUM_PYTHON_LECTURES_BOUNDS.frequency.min, QUANTUM_PYTHON_LECTURES_BOUNDS.frequency.max),
      width: boundedNumber(input.width, 'quantum-python-lectures input.width', QUANTUM_PYTHON_LECTURES_BOUNDS.width.min, QUANTUM_PYTHON_LECTURES_BOUNDS.width.max),
      amplitude: boundedNumber(input.amplitude, 'quantum-python-lectures input.amplitude', QUANTUM_PYTHON_LECTURES_BOUNDS.amplitude.min, QUANTUM_PYTHON_LECTURES_BOUNDS.amplitude.max),
      frequencies: input.frequencies.map((frequency, index) => boundedNumber(
        frequency,
        `quantum-python-lectures input.frequencies[${index}]`,
        QUANTUM_PYTHON_LECTURES_BOUNDS.frequency.min,
        QUANTUM_PYTHON_LECTURES_BOUNDS.frequency.max,
      )),
    }
  }
  fail('quantum-python-lectures input.operation', 'must be rk4-oscillator or lineshape')
}

function lineshapeIntensity(kind: 'lorentzian' | 'gaussian', center: number, width: number, amplitude: number, frequency: number): number {
  const offset = frequency - center
  if (kind === 'lorentzian') {
    const halfWidth = width / 2
    return amplitude * (halfWidth * halfWidth) / (offset * offset + halfWidth * halfWidth)
  }
  const sigma = width / (2 * Math.sqrt(2 * Math.log(2)))
  return amplitude * Math.exp(-(offset * offset) / (2 * sigma * sigma))
}

function solveOscillator(input: QuantumPythonLecturesOscillatorInputV1, signal?: AbortSignal): QuantumPythonLecturesOscillatorOutputV1 {
  throwIfAborted(signal, 'The quantum-python-lectures operation was aborted')
  let x = input.x0
  let v = input.v0
  const initialSample: QuantumPythonLecturesOscillatorSampleV1 = {
    step: 0,
    time: 0,
    x: finiteOutput(x, 'samples[0].x'),
    v: finiteOutput(v, 'samples[0].v'),
    energy: finiteOutput(oscillatorEnergy(input.omega, x, v), 'samples[0].energy'),
  }
  const samples: QuantumPythonLecturesOscillatorSampleV1[] = [initialSample]
  let maximumRelativeEnergyError = 0
  const initialEnergy = initialSample.energy
  for (let step = 1; step <= input.steps; step += 1) {
    throwIfAborted(signal, 'The quantum-python-lectures operation was aborted')
    const next = rk4Step([x, v], input.timeStep, ([position, velocity]) => [
      velocity ?? 0,
      -input.omega * input.omega * (position ?? 0),
    ])
    x = next[0] ?? 0
    v = next[1] ?? 0
    const energy = oscillatorEnergy(input.omega, x, v)
    if (initialEnergy > 0) maximumRelativeEnergyError = Math.max(maximumRelativeEnergyError, Math.abs(energy - initialEnergy) / initialEnergy)
    if (step % input.sampleEvery === 0 || step === input.steps) {
      samples.push({
        step,
        time: finiteOutput(step * input.timeStep, `samples[${samples.length}].time`),
        x: finiteOutput(x, `samples[${samples.length}].x`),
        v: finiteOutput(v, `samples[${samples.length}].v`),
        energy: finiteOutput(energy, `samples[${samples.length}].energy`),
      })
    }
  }
  const lastSample = samples[samples.length - 1]
  if (!lastSample) throw new RangeError('oscillator samples are empty')
  return {
    schemaVersion: 1,
    operation: 'rk4-oscillator',
    input,
    samples,
    initialEnergy: finiteOutput(initialEnergy, 'initialEnergy'),
    finalEnergy: lastSample.energy,
    maximumRelativeEnergyError: finiteOutput(maximumRelativeEnergyError, 'maximumRelativeEnergyError'),
    assumptions: [
      'The model is a unit-mass harmonic oscillator x\'\' = -omega^2 x in dimensionless lecture units.',
      'The integrator is classical fourth-order Runge-Kutta with a fixed step; SciPy odeint and QuTiP are not used.',
      'Displayed energy is 0.5 v^2 + 0.5 omega^2 x^2 on the sampled nodes.',
    ],
    numericalMethod: 'Bounded classical RK4 integration of a one-dimensional harmonic oscillator.',
    licenseCaveat: QUANTUM_PYTHON_LECTURES_SOURCE_CAVEATS.license,
    validatesTheory: false,
    doesNotEstablish: 'A finite RK4 oscillator or lineshape sample does not establish experimental agreement or scientific validation of a quantum theory.',
  }
}

function solveLineshape(input: QuantumPythonLecturesLineshapeInputV1, signal?: AbortSignal): QuantumPythonLecturesLineshapeOutputV1 {
  throwIfAborted(signal, 'The quantum-python-lectures operation was aborted')
  const intensities = input.frequencies.map((frequency, index) => {
    throwIfAborted(signal, 'The quantum-python-lectures operation was aborted')
    return finiteOutput(lineshapeIntensity(input.kind, input.center, input.width, input.amplitude, frequency), `intensities[${index}]`)
  })
  return {
    schemaVersion: 1,
    operation: 'lineshape',
    input,
    intensities,
    peakIntensity: finiteOutput(Math.max(...intensities), 'peakIntensity'),
    assumptions: [
      'Lorentzian width is FWHM; Gaussian width is FWHM converted with sigma = FWHM / (2 sqrt(2 ln 2)).',
      'The kernel evaluates a single isolated line; no optical-depth, Doppler-broadening stack, or lecture CSV is used.',
    ],
    numericalMethod: 'Direct evaluation of a normalized Lorentzian or Gaussian isolated-line profile.',
    licenseCaveat: QUANTUM_PYTHON_LECTURES_SOURCE_CAVEATS.license,
    validatesTheory: false,
    doesNotEstablish: 'A finite RK4 oscillator or lineshape sample does not establish experimental agreement or scientific validation of a quantum theory.',
  }
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal, 'The quantum-python-lectures operation was aborted')
  if (descriptor.catalogItemId !== QUANTUM_PYTHON_LECTURES_CATALOG_ITEM_ID || descriptor.title !== 'quantum-python-lectures') {
    throw new TypeError('quantum-python-lectures adapter requires the quantum-python-lectures simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('quantum-python-lectures adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.trim().length === 0)) {
    throw new TypeError('quantum-python-lectures descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('quantum-python-lectures descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? QUANTUM_PYTHON_LECTURES_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createQuantumPythonLecturesAdapter: QuantumPythonLecturesAdapterFactory = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      throwIfAborted(signal, 'The quantum-python-lectures operation was aborted')
      throwIfAborted(runSignal, 'The quantum-python-lectures operation was aborted')
      const parsed = parseQuantumPythonLecturesInput(input)
      const output = parsed.operation === 'rk4-oscillator'
        ? solveOscillator(parsed, runSignal ?? signal)
        : solveLineshape(parsed, runSignal ?? signal)
      throwIfAborted(runSignal, 'The quantum-python-lectures operation was aborted')
      return output
    },
  }
}

export const quantumPythonLecturesAdapterFactory = createQuantumPythonLecturesAdapter
