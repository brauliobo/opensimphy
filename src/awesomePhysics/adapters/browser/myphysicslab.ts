import {
  fail,
  record,
  finiteNumber,
  boundedNumber,
  requireSafeIntegerBetween,
  requireNonEmptyString,
  throwIfAnyAborted,
} from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

/**
 * Provenance/reference only: awesome-physics-repos/myphysicslab at source
 * revision 4b0bb8e1fa3b, especially lab/model/Spring.ts, the pendulum ODE, and
 * RungeKutta.ts. This is an original headless one-dimensional spring lesson;
 * it does not import the upstream application, view, or build output.
 */

export const MYPHYSICSLAB_ADAPTER_ID = 'awesome-myphysicslab-browser-v1'
export const MYPHYSICSLAB_MODEL = 'myphysicslab-single-spring-v1'

const PROTOCOL = 'awesome-physics-adapter-v1' as const
const INTEGRATOR = 'runge-kutta-4' as const
const LOCAL_MAX_ITERATIONS = 4096
const LOCAL_MAX_MEMORY_BYTES = 64 * 1024 * 1024
const LOCAL_MAX_OUTPUT_BYTES = 4 * 1024 * 1024
const YIELD_INTERVAL = 32

export interface MyphysicslabInputV1 {
  readonly steps: number
  readonly sampleEvery?: number
  readonly timeStep?: number
  readonly mass?: number
  readonly stiffness?: number
  readonly damping?: number
  readonly restLength?: number
  readonly initialPosition?: number
  readonly initialVelocity?: number
}

export interface MyphysicslabSpringSampleV1 {
  readonly step: number
  readonly time: number
  readonly position: number
  readonly velocity: number
  readonly acceleration: number
  readonly kineticEnergy: number
  readonly potentialEnergy: number
  readonly totalEnergy: number
}

export interface MyphysicslabOutputV1 {
  readonly schemaVersion: 1
  readonly model: typeof MYPHYSICSLAB_MODEL
  readonly integrator: typeof INTEGRATOR
  readonly steps: number
  readonly sampleEvery: number
  readonly timeStep: number
  readonly parameters: {
    readonly mass: number
    readonly stiffness: number
    readonly damping: number
    readonly restLength: number
  }
  readonly initial: {
    readonly position: number
    readonly velocity: number
  }
  readonly samples: readonly MyphysicslabSpringSampleV1[]
  readonly final: MyphysicslabSpringSampleV1
  readonly assumptions: readonly string[]
}

export type MyphysicslabAdapterInput = MyphysicslabInputV1
export type MyphysicslabAdapterOutput = MyphysicslabOutputV1
export type MyphysicslabAdapter = AwesomePhysicsAdapterV1<MyphysicslabInputV1, MyphysicslabOutputV1>
export type MyphysicslabAdapterFactory = AwesomePhysicsAdapterFactoryV1<MyphysicslabInputV1, MyphysicslabOutputV1>

interface ParsedInput {
  readonly steps: number
  readonly sampleEvery: number
  readonly timeStep: number
  readonly mass: number
  readonly stiffness: number
  readonly damping: number
  readonly restLength: number
  readonly initialPosition: number
  readonly initialVelocity: number
  readonly maxOutputBytes: number
}

interface AdapterDescriptorData {
  readonly adapterId: string
  readonly contentRevision: string
  readonly modelRevision: string
  readonly implementationRevision: string
  readonly outputRevision: string
}
function requireAllowedKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const allowedKeys = new Set(allowed)
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key))
  if (unknown.length > 0) fail(path, `has unknown properties: ${unknown.join(', ')}`)
}

function throwIfAborted(...signals: readonly (AbortSignal | undefined)[]): void {
  throwIfAnyAborted(signals, 'The simulation was aborted')
}

async function yieldToHost(): Promise<void> {
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
}

function descriptorData(descriptor: AwesomePhysicsSimulationDescriptorV1): AdapterDescriptorData {
  if (descriptor.catalogItemId !== 'awesome-myphysicslab'
    || descriptor.title !== 'myphysicslab'
    || descriptor.execution !== 'browser') {
    fail('descriptor', 'must identify the myphysicslab browser simulation')
  }
  const adapterId = descriptor.adapterId === undefined
    ? MYPHYSICSLAB_ADAPTER_ID
    : requireNonEmptyString(descriptor.adapterId, 'descriptor.adapterId')
  if (!/^[A-Za-z0-9_-]+$/.test(adapterId)) fail('descriptor.adapterId', 'must be a safe ID')
  return {
    adapterId,
    contentRevision: requireNonEmptyString(descriptor.contentRevision, 'descriptor.contentRevision'),
    modelRevision: requireNonEmptyString(descriptor.modelRevision, 'descriptor.modelRevision'),
    implementationRevision: requireNonEmptyString(descriptor.implementationRevision, 'descriptor.implementationRevision'),
    outputRevision: requireNonEmptyString(descriptor.outputRevision, 'descriptor.outputRevision'),
  }
}

function descriptorLimit(descriptor: AwesomePhysicsSimulationDescriptorV1, key: keyof AwesomePhysicsSimulationDescriptorV1['limits']): number {
  const value = descriptor.limits?.[key]
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    fail(`descriptor.limits.${key}`, 'must be a non-negative safe integer')
  }
  return value
}

function sampleSteps(steps: number, sampleEvery: number): number[] {
  const result = [0]
  for (let step = 1; step <= steps; step += 1) {
    if (step === steps || step % sampleEvery === 0) result.push(step)
  }
  return result
}

function parseInput(value: unknown, descriptor: AwesomePhysicsSimulationDescriptorV1): ParsedInput {
  const input = record(value, 'input')
  requireAllowedKeys(input, [
    'steps', 'sampleEvery', 'timeStep', 'mass', 'stiffness', 'damping', 'restLength', 'initialPosition', 'initialVelocity',
  ], 'input')

  const maxIterations = Math.min(LOCAL_MAX_ITERATIONS, descriptorLimit(descriptor, 'maxIterations'))
  const maxMemoryBytes = Math.min(LOCAL_MAX_MEMORY_BYTES, descriptorLimit(descriptor, 'maxMemoryBytes'))
  const maxOutputBytes = Math.min(LOCAL_MAX_OUTPUT_BYTES, descriptorLimit(descriptor, 'maxOutputBytes'))
  const steps = requireSafeIntegerBetween(input.steps, 'input.steps', 0, maxIterations)
  const sampleEvery = input.sampleEvery === undefined
    ? Math.max(1, Math.ceil(Math.max(1, steps) / 32))
    : requireSafeIntegerBetween(input.sampleEvery, 'input.sampleEvery', 1, maxIterations || 1)
  const timeStep = input.timeStep === undefined ? 0.01 : boundedNumber(input.timeStep, 'input.timeStep', 0.0001, 0.05)
  const mass = input.mass === undefined ? 1 : boundedNumber(input.mass, 'input.mass', 0.01, 100)
  const stiffness = input.stiffness === undefined ? 4 : boundedNumber(input.stiffness, 'input.stiffness', 0, 100)
  const damping = input.damping === undefined ? 0.05 : boundedNumber(input.damping, 'input.damping', 0, 10)
  const restLength = input.restLength === undefined ? 1 : boundedNumber(input.restLength, 'input.restLength', 0.1, 10)
  const initialPosition = input.initialPosition === undefined
    ? restLength + 0.25
    : boundedNumber(input.initialPosition, 'input.initialPosition', -20, 20)
  const initialVelocity = input.initialVelocity === undefined
    ? 0
    : boundedNumber(input.initialVelocity, 'input.initialVelocity', -20, 20)

  const normalizedStiffness = timeStep * timeStep * stiffness / mass
  if (normalizedStiffness > 1) fail('input', 'timeStep, mass, and stiffness exceed the stable integrator bound')
  if (timeStep * damping / mass > 1) fail('input', 'timeStep, mass, and damping exceed the stable integrator bound')

  const samples = sampleSteps(steps, sampleEvery).length
  const estimatedOutputBytes = 1024 + samples * 256
  if (1024 + samples * 8 > maxMemoryBytes) fail('input', 'exceeds descriptor maxMemoryBytes')
  if (estimatedOutputBytes > maxOutputBytes) fail('input', 'exceeds descriptor maxOutputBytes')

  return {
    steps,
    sampleEvery,
    timeStep,
    mass,
    stiffness,
    damping,
    restLength,
    initialPosition,
    initialVelocity,
    maxOutputBytes,
  }
}

function finiteOutputNumber(value: number, path: string): number {
  if (!Number.isFinite(value)) throw new Error(`Spring simulation produced a non-finite ${path}`)
  return value === 0 ? 0 : value
}

function accelerationAt(position: number, velocity: number, input: ParsedInput): number {
  return -((input.stiffness / input.mass) * (position - input.restLength))
    - (input.damping / input.mass) * velocity
}

function advanceSpring(
  position: number,
  velocity: number,
  input: ParsedInput,
): { readonly position: number; readonly velocity: number } {
  const halfStep = input.timeStep / 2
  const k1Position = velocity
  const k1Velocity = accelerationAt(position, velocity, input)
  const k2Position = velocity + halfStep * k1Velocity
  const k2Velocity = accelerationAt(position + halfStep * k1Position, velocity + halfStep * k1Velocity, input)
  const k3Position = velocity + halfStep * k2Velocity
  const k3Velocity = accelerationAt(position + halfStep * k2Position, velocity + halfStep * k2Velocity, input)
  const k4Position = velocity + input.timeStep * k3Velocity
  const k4Velocity = accelerationAt(position + input.timeStep * k3Position, velocity + input.timeStep * k3Velocity, input)
  return {
    position: position + input.timeStep * (k1Position + 2 * k2Position + 2 * k3Position + k4Position) / 6,
    velocity: velocity + input.timeStep * (k1Velocity + 2 * k2Velocity + 2 * k3Velocity + k4Velocity) / 6,
  }
}

function makeSample(
  step: number,
  position: number,
  velocity: number,
  input: ParsedInput,
): MyphysicslabSpringSampleV1 {
  const acceleration = accelerationAt(position, velocity, input)
  const displacement = position - input.restLength
  const kineticEnergy = 0.5 * input.mass * velocity * velocity
  const potentialEnergy = 0.5 * input.stiffness * displacement * displacement
  const totalEnergy = kineticEnergy + potentialEnergy
  return {
    step,
    time: finiteOutputNumber(step * input.timeStep, 'time'),
    position: finiteOutputNumber(position, 'position'),
    velocity: finiteOutputNumber(velocity, 'velocity'),
    acceleration: finiteOutputNumber(acceleration, 'acceleration'),
    kineticEnergy: finiteOutputNumber(kineticEnergy, 'kineticEnergy'),
    potentialEnergy: finiteOutputNumber(potentialEnergy, 'potentialEnergy'),
    totalEnergy: finiteOutputNumber(totalEnergy, 'totalEnergy'),
  }
}

function assertJsonSafe(output: MyphysicslabOutputV1, maxOutputBytes: number): void {
  const serialized = JSON.stringify(output)
  if (serialized === undefined) throw new Error('Spring simulation output could not be serialized as JSON')
  if (serialized.length > maxOutputBytes) fail('output', `exceeds the output limit of ${maxOutputBytes} bytes`)
}

async function runSpring(
  inputValue: unknown,
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  factorySignal: AbortSignal,
  runSignal?: AbortSignal,
): Promise<MyphysicslabOutputV1> {
  throwIfAborted(factorySignal, runSignal)
  const input = parseInput(inputValue, descriptor)
  throwIfAborted(factorySignal, runSignal)

  let position = input.initialPosition
  let velocity = input.initialVelocity
  const samples: MyphysicslabSpringSampleV1[] = []
  const capture = (step: number): void => {
    samples.push(makeSample(step, position, velocity, input))
  }
  capture(0)

  for (let step = 1; step <= input.steps; step += 1) {
    throwIfAborted(factorySignal, runSignal)
    const advanced = advanceSpring(position, velocity, input)
    position = advanced.position
    velocity = advanced.velocity
    if (step === input.steps || step % input.sampleEvery === 0) capture(step)
    if (step % YIELD_INTERVAL === 0) await yieldToHost()
    throwIfAborted(factorySignal, runSignal)
  }

  const final = samples[samples.length - 1]
  if (!final) throw new Error('Spring simulation produced no final sample')
  const output: MyphysicslabOutputV1 = {
    schemaVersion: 1,
    model: MYPHYSICSLAB_MODEL,
    integrator: INTEGRATOR,
    steps: input.steps,
    sampleEvery: input.sampleEvery,
    timeStep: input.timeStep,
    parameters: {
      mass: input.mass,
      stiffness: input.stiffness,
      damping: input.damping,
      restLength: input.restLength,
    },
    initial: {
      position: input.initialPosition,
      velocity: input.initialVelocity,
    },
    samples,
    final,
    assumptions: [
      'The lesson is a one-dimensional point mass attached to a fixed linear spring.',
      'Position is measured from the fixed anchor and potential energy is zero at restLength.',
      'Damping is a linear force proportional to velocity; there is no gravity, collision, or external drive.',
      'Classical fourth-order Runge-Kutta is used with a validated small-step stability bound.',
      'This adapter returns model state only; rendering and myphysicslab application classes remain separate.',
    ],
  }
  assertJsonSafe(output, input.maxOutputBytes)
  return output
}

export const createMyphysicslabAdapter: AwesomePhysicsAdapterFactoryV1<
  MyphysicslabInputV1,
  MyphysicslabOutputV1
> = (descriptor, factorySignal = new AbortController().signal): AwesomePhysicsAdapterV1<MyphysicslabInputV1, MyphysicslabOutputV1> => {
  throwIfAborted(factorySignal)
  const data = descriptorData(descriptor)
  return {
    adapterId: data.adapterId,
    protocol: PROTOCOL,
    compatibility: {
      contentRevision: data.contentRevision,
      modelRevision: data.modelRevision,
      implementationRevision: data.implementationRevision,
      outputRevision: data.outputRevision,
    },
    run: (input, signal) => runSpring(input, descriptor, factorySignal, signal),
  }
}

export const myphysicslabAdapterFactory = createMyphysicslabAdapter
export const createMyphysicslabAdapterFactory: MyphysicslabAdapterFactory = createMyphysicslabAdapter
