import { fail, exactKeys, finiteNumber, boundedNumber, record, throwIfAborted, throwIfAnyAborted } from '../../../simphy/contract'
import { rk4Step } from '../../../simphy/integrate'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const PYDY_ADAPTER_ID = 'awesome-pydy-typescript'
export const PYDY_KERNEL_REVISION = 'pydy-two-link-lagrangian-typescript-v1'
export const PYDY_SOURCE_REVISION = '7ca52b722599'
export const PYDY_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/pydy/pydy',
  license: 'PyDy is recorded as BSD-style, but exact source terms still need review; descriptor license review remains a later gate.',
  data: 'No PyDy, SymPy, SciPy, NumPy, generated code, or upstream example assets are bundled.',
})

const MAX_OUTPUT = 1e12
const MAX_ANGLE = 8 * Math.PI
const MAX_INTERNAL_ANGLE = 32 * Math.PI
const MAX_ANGULAR_VELOCITY = 1000
const YIELD_INTERVAL = 32
const TWO_PI = 2 * Math.PI

export const PYDY_BOUNDS = Object.freeze({
  angleRad: Object.freeze({ min: -MAX_ANGLE, max: MAX_ANGLE }),
  angularVelocityRadPerS: Object.freeze({ min: -MAX_ANGULAR_VELOCITY, max: MAX_ANGULAR_VELOCITY }),
  lengthM: Object.freeze({ min: 0.05, max: 10 }),
  massKg: Object.freeze({ min: 0.01, max: 1000 }),
  gravityMPerS2: Object.freeze({ min: 0, max: 100 }),
  timeStepS: Object.freeze({ min: 1e-5, max: 0.02 }),
  steps: Object.freeze({ min: 1, max: 10_000 }),
  sampleCount: Object.freeze({ min: 2, max: 65 }),
  maximumTotalTimeS: 20,
})

export interface PydyInputV1 {
  operation: 'two-link-pendulum-step'
  q1Rad: number
  q2Rad: number
  u1RadPerS: number
  u2RadPerS: number
  length1M: number
  length2M: number
  mass1Kg: number
  mass2Kg: number
  gravityMPerS2: number
  timeStepS: number
  steps?: number
  sampleCount?: number
}

export interface PydyParametersV1 {
  length1M: number
  length2M: number
  mass1Kg: number
  mass2Kg: number
  gravityMPerS2: number
}

export interface PydyStateV1 {
  q1Rad: number
  q2Rad: number
  u1RadPerS: number
  u2RadPerS: number
}

export interface PydyEnergyV1 {
  kineticJ: number
  potentialJ: number
  totalJ: number
}

export interface PydySampleV1 extends PydyStateV1, PydyEnergyV1 {
  step: number
  timeS: number
  acceleration1RadPerS2: number
  acceleration2RadPerS2: number
}

export interface PydyOutputV1 {
  schemaVersion: 1
  operation: 'two-link-pendulum-step'
  model: 'two-link-planar-pendulum-lagrangian'
  integrator: 'runge-kutta-4'
  steps: number
  sampleCount: number
  timeStepS: number
  parameters: PydyParametersV1
  initial: PydySampleV1
  final: PydySampleV1
  samples: readonly PydySampleV1[]
  energy: {
    initial: PydyEnergyV1
    final: PydyEnergyV1
    absoluteDriftJ: number
  }
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export type PydyAdapterInputV1 = PydyInputV1
export type PydyAdapterOutputV1 = PydyOutputV1
export type PydyAdapter = AwesomePhysicsAdapterV1<PydyInputV1, PydyOutputV1>
export type PydyAdapterFactory = AwesomePhysicsAdapterFactoryV1<PydyInputV1, PydyOutputV1>

interface ParsedInput {
  operation: 'two-link-pendulum-step'
  state: PydyStateV1
  parameters: PydyParametersV1
  timeStepS: number
  steps: number
  sampleCount: number
}
function safeInteger(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(path, `must be a safe integer between ${minimum} and ${maximum}`)
  }
  return value
}

function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_OUTPUT) {
    throw new RangeError(`${path} is outside the finite output bound`)
  }
  return value
}
function yieldToHost(): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 0))
}

function parseInput(value: unknown): ParsedInput {
  const input = record(value, 'PyDy input')
  exactKeys(input, [
    'operation',
    'q1Rad',
    'q2Rad',
    'u1RadPerS',
    'u2RadPerS',
    'length1M',
    'length2M',
    'mass1Kg',
    'mass2Kg',
    'gravityMPerS2',
    'timeStepS',
  ], ['steps', 'sampleCount'], 'PyDy input')
  if (input.operation !== 'two-link-pendulum-step') fail('PyDy input.operation', 'must be two-link-pendulum-step')

  const state: PydyStateV1 = {
    q1Rad: boundedNumber(input.q1Rad, 'PyDy input.q1Rad', PYDY_BOUNDS.angleRad.min, PYDY_BOUNDS.angleRad.max),
    q2Rad: boundedNumber(input.q2Rad, 'PyDy input.q2Rad', PYDY_BOUNDS.angleRad.min, PYDY_BOUNDS.angleRad.max),
    u1RadPerS: boundedNumber(input.u1RadPerS, 'PyDy input.u1RadPerS', PYDY_BOUNDS.angularVelocityRadPerS.min, PYDY_BOUNDS.angularVelocityRadPerS.max),
    u2RadPerS: boundedNumber(input.u2RadPerS, 'PyDy input.u2RadPerS', PYDY_BOUNDS.angularVelocityRadPerS.min, PYDY_BOUNDS.angularVelocityRadPerS.max),
  }
  const parameters: PydyParametersV1 = {
    length1M: boundedNumber(input.length1M, 'PyDy input.length1M', PYDY_BOUNDS.lengthM.min, PYDY_BOUNDS.lengthM.max),
    length2M: boundedNumber(input.length2M, 'PyDy input.length2M', PYDY_BOUNDS.lengthM.min, PYDY_BOUNDS.lengthM.max),
    mass1Kg: boundedNumber(input.mass1Kg, 'PyDy input.mass1Kg', PYDY_BOUNDS.massKg.min, PYDY_BOUNDS.massKg.max),
    mass2Kg: boundedNumber(input.mass2Kg, 'PyDy input.mass2Kg', PYDY_BOUNDS.massKg.min, PYDY_BOUNDS.massKg.max),
    gravityMPerS2: boundedNumber(input.gravityMPerS2, 'PyDy input.gravityMPerS2', PYDY_BOUNDS.gravityMPerS2.min, PYDY_BOUNDS.gravityMPerS2.max),
  }
  const timeStepS = boundedNumber(input.timeStepS, 'PyDy input.timeStepS', PYDY_BOUNDS.timeStepS.min, PYDY_BOUNDS.timeStepS.max)
  const steps = Object.hasOwn(input, 'steps')
    ? safeInteger(input.steps, 'PyDy input.steps', PYDY_BOUNDS.steps.min, PYDY_BOUNDS.steps.max)
    : 1
  const sampleCount = Object.hasOwn(input, 'sampleCount')
    ? safeInteger(input.sampleCount, 'PyDy input.sampleCount', PYDY_BOUNDS.sampleCount.min, PYDY_BOUNDS.sampleCount.max)
    : Math.min(17, steps + 1)
  if (timeStepS * steps > PYDY_BOUNDS.maximumTotalTimeS) {
    fail('PyDy input', `timeStepS * steps must be no greater than ${PYDY_BOUNDS.maximumTotalTimeS}`)
  }
  return { operation: 'two-link-pendulum-step', state, parameters, timeStepS, steps, sampleCount }
}

function normalizeAngle(value: number): number {
  const wrapped = ((value + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI
  return finiteOutput(wrapped, 'angle')
}

function stateVector(state: PydyStateV1): [number, number, number, number] {
  return [state.q1Rad, state.q2Rad, state.u1RadPerS, state.u2RadPerS]
}

function vectorState(value: readonly number[]): PydyStateV1 {
  if (value.length !== 4) throw new RangeError('PyDy state must have four components')
  const state: PydyStateV1 = {
    q1Rad: normalizeAngle(value[0]!),
    q2Rad: normalizeAngle(value[1]!),
    u1RadPerS: finiteOutput(value[2]!, 'angular velocity 1'),
    u2RadPerS: finiteOutput(value[3]!, 'angular velocity 2'),
  }
  if (Math.abs(state.u1RadPerS) > MAX_ANGULAR_VELOCITY || Math.abs(state.u2RadPerS) > MAX_ANGULAR_VELOCITY) {
    throw new RangeError('PyDy angular velocity exceeded the finite state bound')
  }
  return state
}

export function calculatePydyLagrangianAcceleration(
  state: PydyStateV1,
  parameters: PydyParametersV1,
): readonly [number, number] {
  const q1 = boundedNumber(state.q1Rad, 'state.q1Rad', -MAX_INTERNAL_ANGLE, MAX_INTERNAL_ANGLE)
  const q2 = boundedNumber(state.q2Rad, 'state.q2Rad', -MAX_INTERNAL_ANGLE, MAX_INTERNAL_ANGLE)
  const u1 = boundedNumber(state.u1RadPerS, 'state.u1RadPerS', -MAX_ANGULAR_VELOCITY, MAX_ANGULAR_VELOCITY)
  const u2 = boundedNumber(state.u2RadPerS, 'state.u2RadPerS', -MAX_ANGULAR_VELOCITY, MAX_ANGULAR_VELOCITY)
  const l1 = boundedNumber(parameters.length1M, 'parameters.length1M', PYDY_BOUNDS.lengthM.min, PYDY_BOUNDS.lengthM.max)
  const l2 = boundedNumber(parameters.length2M, 'parameters.length2M', PYDY_BOUNDS.lengthM.min, PYDY_BOUNDS.lengthM.max)
  const m1 = boundedNumber(parameters.mass1Kg, 'parameters.mass1Kg', PYDY_BOUNDS.massKg.min, PYDY_BOUNDS.massKg.max)
  const m2 = boundedNumber(parameters.mass2Kg, 'parameters.mass2Kg', PYDY_BOUNDS.massKg.min, PYDY_BOUNDS.massKg.max)
  const gravity = boundedNumber(parameters.gravityMPerS2, 'parameters.gravityMPerS2', PYDY_BOUNDS.gravityMPerS2.min, PYDY_BOUNDS.gravityMPerS2.max)
  const difference = q1 - q2
  const cosine = Math.cos(difference)
  const sine = Math.sin(difference)
  const mass11 = (m1 + m2) * l1 * l1
  const mass22 = m2 * l2 * l2
  const mass12 = m2 * l1 * l2 * cosine
  const coupling = m2 * l1 * l2
  const right1 = -coupling * sine * u2 * u2 - (m1 + m2) * gravity * l1 * Math.sin(q1)
  const right2 = m2 * l1 * l2 * sine * u1 * u1 - m2 * gravity * l2 * Math.sin(q2)
  const determinant = mass11 * mass22 - mass12 * mass12
  if (!Number.isFinite(determinant) || determinant <= Number.EPSILON) {
    throw new RangeError('PyDy Lagrangian mass matrix is singular')
  }
  const acceleration1 = (right1 * mass22 - mass12 * right2) / determinant
  const acceleration2 = (mass11 * right2 - mass12 * right1) / determinant
  return [finiteOutput(acceleration1, 'angular acceleration 1'), finiteOutput(acceleration2, 'angular acceleration 2')]
}

export function calculatePydyEnergy(state: PydyStateV1, parameters: PydyParametersV1): PydyEnergyV1 {
  const q1 = boundedNumber(state.q1Rad, 'state.q1Rad', -MAX_INTERNAL_ANGLE, MAX_INTERNAL_ANGLE)
  const q2 = boundedNumber(state.q2Rad, 'state.q2Rad', -MAX_INTERNAL_ANGLE, MAX_INTERNAL_ANGLE)
  const u1 = boundedNumber(state.u1RadPerS, 'state.u1RadPerS', -MAX_ANGULAR_VELOCITY, MAX_ANGULAR_VELOCITY)
  const u2 = boundedNumber(state.u2RadPerS, 'state.u2RadPerS', -MAX_ANGULAR_VELOCITY, MAX_ANGULAR_VELOCITY)
  const l1 = boundedNumber(parameters.length1M, 'parameters.length1M', PYDY_BOUNDS.lengthM.min, PYDY_BOUNDS.lengthM.max)
  const l2 = boundedNumber(parameters.length2M, 'parameters.length2M', PYDY_BOUNDS.lengthM.min, PYDY_BOUNDS.lengthM.max)
  const m1 = boundedNumber(parameters.mass1Kg, 'parameters.mass1Kg', PYDY_BOUNDS.massKg.min, PYDY_BOUNDS.massKg.max)
  const m2 = boundedNumber(parameters.mass2Kg, 'parameters.mass2Kg', PYDY_BOUNDS.massKg.min, PYDY_BOUNDS.massKg.max)
  const gravity = boundedNumber(parameters.gravityMPerS2, 'parameters.gravityMPerS2', PYDY_BOUNDS.gravityMPerS2.min, PYDY_BOUNDS.gravityMPerS2.max)
  const kinetic = 0.5 * (m1 + m2) * l1 * l1 * u1 * u1
    + 0.5 * m2 * l2 * l2 * u2 * u2
    + m2 * l1 * l2 * u1 * u2 * Math.cos(q1 - q2)
  const potential = -(m1 + m2) * gravity * l1 * Math.cos(q1) - m2 * gravity * l2 * Math.cos(q2)
  return {
    kineticJ: finiteOutput(kinetic, 'kinetic energy'),
    potentialJ: finiteOutput(potential, 'potential energy'),
    totalJ: finiteOutput(kinetic + potential, 'total energy'),
  }
}

function derivative(value: readonly number[], parameters: PydyParametersV1): [number, number, number, number] {
  const state: PydyStateV1 = {
    q1Rad: finiteNumber(value[0], 'derivative.q1Rad'),
    q2Rad: finiteNumber(value[1], 'derivative.q2Rad'),
    u1RadPerS: finiteNumber(value[2], 'derivative.u1RadPerS'),
    u2RadPerS: finiteNumber(value[3], 'derivative.u2RadPerS'),
  }
  if (Math.abs(state.q1Rad) > MAX_INTERNAL_ANGLE || Math.abs(state.q2Rad) > MAX_INTERNAL_ANGLE) {
    throw new RangeError('PyDy intermediate angle exceeded the finite state bound')
  }
  const [acceleration1, acceleration2] = calculatePydyLagrangianAcceleration(state, parameters)
  return [state.u1RadPerS, state.u2RadPerS, acceleration1, acceleration2]
}

function integrateState(value: readonly number[], timeStepS: number, parameters: PydyParametersV1): [number, number, number, number] {
  const next = rk4Step(value, timeStepS, (state) => derivative(state, parameters))
  return [next[0] ?? 0, next[1] ?? 0, next[2] ?? 0, next[3] ?? 0]
}

function sampleSteps(steps: number, sampleCount: number): number[] {
  return [...new Set(Array.from({ length: sampleCount }, (_, index) => Math.round(index * steps / (sampleCount - 1))))]
}

function sampleState(step: number, state: PydyStateV1, timeStepS: number, parameters: PydyParametersV1): PydySampleV1 {
  const [acceleration1RadPerS2, acceleration2RadPerS2] = calculatePydyLagrangianAcceleration(state, parameters)
  const energy = calculatePydyEnergy(state, parameters)
  return {
    step,
    timeS: finiteOutput(step * timeStepS, 'sample time'),
    ...state,
    acceleration1RadPerS2,
    acceleration2RadPerS2,
    ...energy,
  }
}

function finiteJson<T>(value: T): T {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new Error('PyDy output could not be serialized as JSON')
  return value
}

export async function evaluatePydy(value: PydyInputV1, signal?: AbortSignal): Promise<PydyOutputV1> {
  const input = parseInput(value)
  throwIfAborted(signal, 'The PyDy operation was aborted')
  const requestedSteps = sampleSteps(input.steps, input.sampleCount)
  const requestedStepSet = new Set(requestedSteps)
  const samples = new Map<number, PydySampleV1>()
  let stateVectorValue = stateVector(input.state)
  if (requestedStepSet.has(0)) samples.set(0, sampleState(0, vectorState(stateVectorValue), input.timeStepS, input.parameters))

  for (let step = 1; step <= input.steps; step += 1) {
    throwIfAborted(signal, 'The PyDy operation was aborted')
    stateVectorValue = integrateState(stateVectorValue, input.timeStepS, input.parameters)
    const nextState = vectorState(stateVectorValue)
    stateVectorValue = stateVector(nextState)
    if (requestedStepSet.has(step)) samples.set(step, sampleState(step, nextState, input.timeStepS, input.parameters))
    if (step % YIELD_INTERVAL === 0) {
      await yieldToHost()
      throwIfAborted(signal, 'The PyDy operation was aborted')
    }
  }

  const initial = samples.get(0) ?? sampleState(0, input.state, input.timeStepS, input.parameters)
  const final = samples.get(input.steps) ?? sampleState(input.steps, vectorState(stateVectorValue), input.timeStepS, input.parameters)
  const orderedSamples = requestedSteps.map((step) => {
    const sample = samples.get(step)
    if (!sample) throw new Error(`PyDy did not produce sample ${step}`)
    return sample
  })
  const output: PydyOutputV1 = {
    schemaVersion: 1,
    operation: input.operation,
    model: 'two-link-planar-pendulum-lagrangian',
    integrator: 'runge-kutta-4',
    steps: input.steps,
    sampleCount: orderedSamples.length,
    timeStepS: input.timeStepS,
    parameters: input.parameters,
    initial,
    final,
    samples: orderedSamples,
    energy: {
      initial: {
        kineticJ: initial.kineticJ,
        potentialJ: initial.potentialJ,
        totalJ: initial.totalJ,
      },
      final: {
        kineticJ: final.kineticJ,
        potentialJ: final.potentialJ,
        totalJ: final.totalJ,
      },
      absoluteDriftJ: finiteOutput(Math.abs(final.totalJ - initial.totalJ), 'energy drift'),
    },
    assumptions: [
      'Two massless rods connect point masses in a planar double pendulum; q1 and q2 are measured from the downward vertical.',
      'The Lagrangian uses T = 0.5 (m1 + m2) l1^2 u1^2 + 0.5 m2 l2^2 u2^2 + m2 l1 l2 u1 u2 cos(q1 - q2) and gravitational potential energy.',
      'No damping, drive, constraint stabilization, symbolic code generation, or external force is modeled.',
    ],
    numericalMethod: 'Direct 2x2 Lagrangian mass-matrix solve advanced with bounded fixed-step classical RK4.',
    licenseCaveat: PYDY_SOURCE_CAVEATS.license,
  }
  throwIfAborted(signal, 'The PyDy operation was aborted')
  return finiteJson(output)
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'must be a non-empty string')
  return value
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal, 'The PyDy operation was aborted')
  if (descriptor.catalogItemId !== 'awesome-pydy' || descriptor.title !== 'pydy') {
    throw new TypeError('PyDy adapter requires the pydy simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('PyDy adapter requires TypeScript execution')
  const adapterId = descriptor.adapterId === undefined ? PYDY_ADAPTER_ID : nonEmptyString(descriptor.adapterId, 'descriptor.adapterId')
  if (!/^[A-Za-z0-9_-]+$/.test(adapterId)) fail('descriptor.adapterId', 'must be a safe ID')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.trim().length === 0)) {
    throw new TypeError('PyDy descriptor revisions must be non-empty strings')
  }
  return {
    adapterId,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createPydyAdapter: PydyAdapterFactory = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      throwIfAborted(signal, 'The PyDy operation was aborted')
      throwIfAborted(runSignal, 'The PyDy operation was aborted')
      return evaluatePydy(input, runSignal ?? signal).then((output) => {
        throwIfAnyAborted([signal, runSignal], 'The PyDy operation was aborted')
        return output
      })
    },
  }
}

export const pydyAdapterFactory = createPydyAdapter
export const createPyDyAdapter = createPydyAdapter
