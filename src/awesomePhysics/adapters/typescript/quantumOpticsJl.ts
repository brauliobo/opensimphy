import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const QUANTUM_OPTICS_JL_CATALOG_ITEM_ID = 'awesome-quantumoptics-jl' as const
export const QUANTUM_OPTICS_JL_ADAPTER_ID = 'awesome-quantumoptics-jl-typescript' as const
export const QUANTUM_OPTICS_JL_KERNEL_REVISION = 'quantumoptics-jl-jaynes-cummings-typescript-v1' as const
export const QUANTUM_OPTICS_JL_SOURCE_REVISION = '5becc8f98c2a' as const
export const QUANTUM_OPTICS_JL_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/qojulia/QuantumOptics.jl',
  license: 'QuantumOptics.jl is MIT-licensed; this independent TypeScript kernel does not embed Julia or redistribute QuantumOptics.jl.',
  data: 'No Julia runtime, QuantumOptics.jl solver, or example dataset is bundled.',
})

export const QUANTUM_OPTICS_JL_BOUNDS = Object.freeze({
  coupling: Object.freeze({ min: 0, max: 20 }),
  detuning: Object.freeze({ min: -20, max: 20 }),
  photonNumber: Object.freeze({ min: 0, max: 8 }),
  timeStep: Object.freeze({ min: 1e-5, max: 0.05 }),
  steps: Object.freeze({ min: 1, max: 4000 }),
  sampleEvery: Object.freeze({ min: 1, max: 400 }),
  maxOutputAbs: 1e12,
} as const)

export interface QuantumOpticsJlJaynesCummingsInputV1 {
  operation: 'jaynes-cummings'
  coupling: number
  detuning: number
  photonNumber: number
  timeStep: number
  steps: number
  sampleEvery: number
}

export type QuantumOpticsJlInputV1 = QuantumOpticsJlJaynesCummingsInputV1

export interface QuantumOpticsJlSampleV1 {
  step: number
  time: number
  excitedPopulation: number
  cavityPhotons: number
  inversion: number
}

export interface QuantumOpticsJlJaynesCummingsOutputV1 {
  schemaVersion: 1
  operation: 'jaynes-cummings'
  input: QuantumOpticsJlJaynesCummingsInputV1
  samples: readonly QuantumOpticsJlSampleV1[]
  vacuumRabiFrequency: number
  peakExcitedPopulation: number
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
  validatesTheory: false
  doesNotEstablish: string
}

export type QuantumOpticsJlOutputV1 = QuantumOpticsJlJaynesCummingsOutputV1
export type QuantumOpticsJlAdapter = AwesomePhysicsAdapterV1<QuantumOpticsJlInputV1, QuantumOpticsJlOutputV1>
export type QuantumOpticsJlAdapterFactory = AwesomePhysicsAdapterFactoryV1<QuantumOpticsJlInputV1, QuantumOpticsJlOutputV1>

function fail(path: string, message: string): never {
  throw new TypeError(`${path} ${message}`)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'must be a JSON object')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) fail(path, 'must be a plain JSON object')
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], path: string): void {
  const unknown = Object.keys(value).filter((key) => !required.includes(key))
  const missing = required.filter((key) => !Object.hasOwn(value, key))
  if (unknown.length > 0) fail(path, `has unknown properties: ${unknown.join(', ')}`)
  if (missing.length > 0) fail(path, `is missing properties: ${missing.join(', ')}`)
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
  return value
}

function boundedNumber(value: unknown, path: string, minimum: number, maximum: number): number {
  const result = finiteNumber(value, path)
  if (result < minimum || result > maximum) fail(path, `must be between ${minimum} and ${maximum}`)
  return result
}

function boundedInteger(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) fail(path, 'must be a safe integer')
  if (value < minimum || value > maximum) fail(path, `must be between ${minimum} and ${maximum}`)
  return value
}

function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > QUANTUM_OPTICS_JL_BOUNDS.maxOutputAbs) {
    throw new RangeError(`${path} is outside the finite output bound`)
  }
  return value === 0 ? 0 : value
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  if (signal.reason instanceof Error) throw signal.reason
  const error = new Error('The QuantumOptics.jl operation was aborted')
  error.name = 'AbortError'
  throw error
}

export function parseQuantumOpticsJlInput(value: unknown): QuantumOpticsJlInputV1 {
  const input = record(value, 'quantumoptics-jl input')
  if (input.operation !== 'jaynes-cummings') fail('quantumoptics-jl input.operation', 'must be jaynes-cummings')
  exactKeys(input, ['operation', 'coupling', 'detuning', 'photonNumber', 'timeStep', 'steps', 'sampleEvery'], 'quantumoptics-jl input')
  const steps = boundedInteger(input.steps, 'quantumoptics-jl input.steps', QUANTUM_OPTICS_JL_BOUNDS.steps.min, QUANTUM_OPTICS_JL_BOUNDS.steps.max)
  const sampleEvery = boundedInteger(input.sampleEvery, 'quantumoptics-jl input.sampleEvery', QUANTUM_OPTICS_JL_BOUNDS.sampleEvery.min, QUANTUM_OPTICS_JL_BOUNDS.sampleEvery.max)
  if (sampleEvery > steps) fail('quantumoptics-jl input.sampleEvery', 'must be at most steps')
  return {
    operation: 'jaynes-cummings',
    coupling: boundedNumber(input.coupling, 'quantumoptics-jl input.coupling', QUANTUM_OPTICS_JL_BOUNDS.coupling.min, QUANTUM_OPTICS_JL_BOUNDS.coupling.max),
    detuning: boundedNumber(input.detuning, 'quantumoptics-jl input.detuning', QUANTUM_OPTICS_JL_BOUNDS.detuning.min, QUANTUM_OPTICS_JL_BOUNDS.detuning.max),
    photonNumber: boundedInteger(input.photonNumber, 'quantumoptics-jl input.photonNumber', QUANTUM_OPTICS_JL_BOUNDS.photonNumber.min, QUANTUM_OPTICS_JL_BOUNDS.photonNumber.max),
    timeStep: boundedNumber(input.timeStep, 'quantumoptics-jl input.timeStep', QUANTUM_OPTICS_JL_BOUNDS.timeStep.min, QUANTUM_OPTICS_JL_BOUNDS.timeStep.max),
    steps,
    sampleEvery,
  }
}

function excitedPopulation(coupling: number, detuning: number, photonNumber: number, time: number): number {
  const vacuumRabi = Math.hypot(2 * coupling * Math.sqrt(photonNumber + 1), detuning)
  if (vacuumRabi === 0) return 1
  const amplitude = (4 * coupling * coupling * (photonNumber + 1)) / (vacuumRabi * vacuumRabi)
  const halfAngle = 0.5 * vacuumRabi * time
  return 1 - amplitude * Math.sin(halfAngle) * Math.sin(halfAngle)
}

function sampleAt(step: number, time: number, excited: number, photonNumber: number, path: string): QuantumOpticsJlSampleV1 {
  const excitedPopulationValue = finiteOutput(excited, `${path}.excitedPopulation`)
  const transferred = 1 - excitedPopulationValue
  return {
    step,
    time: finiteOutput(time, `${path}.time`),
    excitedPopulation: excitedPopulationValue,
    cavityPhotons: finiteOutput(photonNumber + transferred, `${path}.cavityPhotons`),
    inversion: finiteOutput(2 * excitedPopulationValue - 1, `${path}.inversion`),
  }
}

function solveJaynesCummings(input: QuantumOpticsJlJaynesCummingsInputV1, signal?: AbortSignal): QuantumOpticsJlJaynesCummingsOutputV1 {
  throwIfAborted(signal)
  const vacuumRabiFrequency = finiteOutput(
    Math.hypot(2 * input.coupling * Math.sqrt(input.photonNumber + 1), input.detuning),
    'vacuumRabiFrequency',
  )
  const samples: QuantumOpticsJlSampleV1[] = [sampleAt(0, 0, 1, input.photonNumber, 'samples[0]')]
  let peakExcitedPopulation = 1
  for (let step = 1; step <= input.steps; step += 1) {
    throwIfAborted(signal)
    const time = step * input.timeStep
    const excited = excitedPopulation(input.coupling, input.detuning, input.photonNumber, time)
    peakExcitedPopulation = Math.max(peakExcitedPopulation, excited)
    if (step % input.sampleEvery === 0 || step === input.steps) {
      samples.push(sampleAt(step, time, excited, input.photonNumber, `samples[${samples.length}]`))
    }
  }
  return {
    schemaVersion: 1,
    operation: 'jaynes-cummings',
    input,
    samples,
    vacuumRabiFrequency,
    peakExcitedPopulation: finiteOutput(peakExcitedPopulation, 'peakExcitedPopulation'),
    assumptions: [
      'The model is the single-excitation Jaynes-Cummings manifold starting in |e, n⟩.',
      'P_e(t) = 1 - [4g²(n+1)/Ω²] sin²(Ω t / 2) with Ω = hypot(2g√(n+1), Δ).',
      'Julia, QuantumOptics.jl, and any example dataset are not used.',
    ],
    numericalMethod: 'Closed-form Jaynes-Cummings vacuum Rabi oscillation on the single-excitation manifold.',
    licenseCaveat: QUANTUM_OPTICS_JL_SOURCE_CAVEATS.license,
    validatesTheory: false,
    doesNotEstablish: 'A finite Jaynes-Cummings sample does not establish experimental agreement or scientific validation of QuantumOptics.jl.',
  }
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== QUANTUM_OPTICS_JL_CATALOG_ITEM_ID || descriptor.title !== 'QuantumOptics.jl') {
    throw new TypeError('QuantumOptics.jl adapter requires the QuantumOptics.jl simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('QuantumOptics.jl adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.trim().length === 0)) {
    throw new TypeError('QuantumOptics.jl descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('QuantumOptics.jl descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? QUANTUM_OPTICS_JL_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createQuantumOpticsJlAdapter: QuantumOpticsJlAdapterFactory = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      throwIfAborted(signal)
      throwIfAborted(runSignal)
      const output = solveJaynesCummings(parseQuantumOpticsJlInput(input), runSignal ?? signal)
      throwIfAborted(runSignal)
      return output
    },
  }
}

export const quantumOpticsJlAdapterFactory = createQuantumOpticsJlAdapter
