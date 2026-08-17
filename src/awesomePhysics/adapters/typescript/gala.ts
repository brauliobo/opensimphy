import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const GALA_ADAPTER_ID = 'awesome-gala-typescript'
export const GALA_KERNEL_REVISION = 'gala-orbit-velocity-verlet-typescript-v1'
export const GALA_SOURCE_REVISION = '8bf0a1f574a4'
export const GALA_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/adrn/gala',
  license: 'gala is MIT-licensed; the bounded local TypeScript adapter is available here, independently of the upstream gala runtime and external galactic data, neither of which is bundled; descriptor license and provenance review remains required before any upstream integration.',
  data: 'No gala Python runtime, Astropy coupling, GSL/EXP potential, or external galactic data is bundled.',
  model: 'This is an independent normalized-unit educational orbit kernel, not a claim of numerical or scientific equivalence to gala.',
})

export const GALA_MAX_BODIES = 32
export const GALA_MAX_STEPS = 10_000
export const GALA_MAX_SAMPLES = 512
export const GALA_MAX_OUTPUT_BYTES = 4 * 1024 * 1024

const MIN_MASS = 1e-8
const MAX_MASS = 1e4
const MAX_COORDINATE = 1e4
const MAX_VELOCITY = 1e3
const MIN_TIME_STEP = 1e-8
const MAX_TIME_STEP = 0.1
const MAX_TOTAL_TIME = 100
const MIN_SEPARATION = 1e-5
const MAX_OUTPUT_COMPONENT = 1e15
const MAX_STABILITY_PHASE = 0.25

export const GALA_BOUNDS = Object.freeze({
  bodies: Object.freeze({ min: 2, max: GALA_MAX_BODIES }),
  steps: Object.freeze({ min: 0, max: GALA_MAX_STEPS }),
  timeStep: Object.freeze({ min: MIN_TIME_STEP, max: MAX_TIME_STEP }),
  sampleEvery: Object.freeze({ min: 1, max: GALA_MAX_STEPS }),
  totalTime: MAX_TOTAL_TIME,
  minimumSeparation: MIN_SEPARATION,
  maximumSamples: GALA_MAX_SAMPLES,
  maximumOutputBytes: GALA_MAX_OUTPUT_BYTES,
} as const)

export type GalaVector3V1 = readonly [number, number, number]

export interface GalaBodyV1 {
  mass: number
  position: GalaVector3V1
  velocity: GalaVector3V1
}

export interface GalaInputV1 {
  bodies: readonly GalaBodyV1[]
  timeStep: number
  steps: number
  sampleEvery?: number
}

export interface GalaInvariantV1 {
  kineticEnergy: number
  potentialEnergy: number
  totalEnergy: number
  linearMomentum: GalaVector3V1
  centerOfMass: GalaVector3V1
  angularMomentum: GalaVector3V1
}

export interface GalaStateV1 extends GalaBodyV1 {}

export interface GalaSampleV1 {
  step: number
  time: number
  bodies: readonly GalaStateV1[]
  invariants: GalaInvariantV1
}

export interface GalaOutputV1 {
  schemaVersion: 1
  model: 'gala-orbit-v1'
  integrator: 'velocity-verlet'
  unitSystem: 'normalized-GM-units'
  input: {
    bodies: readonly GalaBodyV1[]
    timeStep: number
    steps: number
    sampleEvery: number
  }
  samples: readonly GalaSampleV1[]
  initial: GalaInvariantV1
  final: GalaInvariantV1
  invariantDrift: {
    energyAbsolute: number
    energyRelative: number
    linearMomentumNorm: number
    centerOfMassDisplacement: number
    angularMomentumNorm: number
  }
  assumptions: readonly string[]
  numericalMethod: string
  doesNotEstablish: string
  integrationStatus: 'available'
  licenseCaveat: string
  provenanceCaveat: string
}

export type GalaInput = GalaInputV1
export type GalaOutput = GalaOutputV1
export type GalaAdapterInputV1 = GalaInputV1
export type GalaAdapterOutputV1 = GalaOutputV1
export type GalaAdapter = AwesomePhysicsAdapterV1<GalaInputV1, GalaOutputV1>
export type GalaAdapterFactory = AwesomePhysicsAdapterFactoryV1<GalaInputV1, GalaOutputV1>

type Vector3 = [number, number, number]
const AXES = [0, 1, 2] as const

interface BodyState {
  mass: number
  position: Vector3
  velocity: Vector3
}

interface ParsedInput {
  bodies: BodyState[]
  timeStep: number
  steps: number
  sampleEvery: number
}

function fail(path: string, message: string): never {
  throw new TypeError(`${path} ${message}`)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'must be a plain JSON object')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) fail(path, 'must be a plain JSON object')
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[], path: string): void {
  const allowed = new Set([...required, ...optional])
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
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

function safeInteger(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) fail(path, 'must be a safe integer')
  if (value < minimum || value > maximum) fail(path, `must be an integer between ${minimum} and ${maximum}`)
  return value
}

function vector(value: unknown, path: string, limit: number): Vector3 {
  if (!Array.isArray(value) || value.length !== 3) fail(path, 'must be an array of exactly three finite numbers')
  return [
    boundedNumber(value[0], `${path}[0]`, -limit, limit),
    boundedNumber(value[1], `${path}[1]`, -limit, limit),
    boundedNumber(value[2], `${path}[2]`, -limit, limit),
  ]
}

function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_OUTPUT_COMPONENT) {
    throw new RangeError(`gala ${path} is outside the finite output bound`)
  }
  return value === 0 ? 0 : value
}

function finiteVector(value: Vector3, path: string): GalaVector3V1 {
  return [
    finiteOutput(value[0], `${path}[0]`),
    finiteOutput(value[1], `${path}[1]`),
    finiteOutput(value[2], `${path}[2]`),
  ]
}

function throwIfAborted(...signals: readonly (AbortSignal | undefined)[]): void {
  const signal = signals.find((candidate) => candidate?.aborted)
  if (!signal) return
  if (signal.reason instanceof Error) throw signal.reason
  const error = new Error('The gala orbit operation was aborted')
  error.name = 'AbortError'
  throw error
}

function distanceSquared(left: Vector3, right: Vector3): number {
  const x = right[0] - left[0]
  const y = right[1] - left[1]
  const z = right[2] - left[2]
  return x * x + y * y + z * z
}

function assertSeparated(bodies: readonly BodyState[]): number {
  let minimumDistance = Number.POSITIVE_INFINITY
  for (let left = 0; left < bodies.length; left += 1) {
    const first = bodies[left]
    if (!first) throw new RangeError('gala body state is missing')
    for (let right = left + 1; right < bodies.length; right += 1) {
      const second = bodies[right]
      if (!second) throw new RangeError('gala body state is missing')
      const squared = distanceSquared(first.position, second.position)
      const distance = Math.sqrt(squared)
      if (!Number.isFinite(distance) || distance < MIN_SEPARATION) {
        throw new RangeError(`gala bodies ${left} and ${right} are closer than ${MIN_SEPARATION}`)
      }
      minimumDistance = Math.min(minimumDistance, distance)
    }
  }
  return minimumDistance
}

function sampleSteps(steps: number, sampleEvery: number): number[] {
  const result = [0]
  for (let step = 1; step <= steps; step += 1) {
    if (step === steps || step % sampleEvery === 0) result.push(step)
  }
  return result
}

function parseInput(value: unknown): ParsedInput {
  const object = record(value, 'gala input')
  exactKeys(object, ['bodies', 'timeStep', 'steps'], ['sampleEvery'], 'gala input')
  if (!Array.isArray(object.bodies)) fail('gala input.bodies', 'must be an array')
  if (object.bodies.length < GALA_BOUNDS.bodies.min || object.bodies.length > GALA_MAX_BODIES) {
    fail('gala input.bodies', `must contain between ${GALA_BOUNDS.bodies.min} and ${GALA_MAX_BODIES} bodies`)
  }

  const bodies = object.bodies.map((value, index): BodyState => {
    const path = `gala input.bodies[${index}]`
    const body = record(value, path)
    exactKeys(body, ['mass', 'position', 'velocity'], [], path)
    return {
      mass: boundedNumber(body.mass, `${path}.mass`, MIN_MASS, MAX_MASS),
      position: vector(body.position, `${path}.position`, MAX_COORDINATE),
      velocity: vector(body.velocity, `${path}.velocity`, MAX_VELOCITY),
    }
  })

  const timeStep = boundedNumber(object.timeStep, 'gala input.timeStep', MIN_TIME_STEP, MAX_TIME_STEP)
  const steps = safeInteger(object.steps, 'gala input.steps', GALA_BOUNDS.steps.min, GALA_BOUNDS.steps.max)
  const sampleEvery = Object.hasOwn(object, 'sampleEvery')
    ? safeInteger(object.sampleEvery, 'gala input.sampleEvery', GALA_BOUNDS.sampleEvery.min, Math.max(1, steps))
    : Math.max(1, Math.ceil(Math.max(1, steps) / 128))
  if (timeStep * steps > MAX_TOTAL_TIME) fail('gala input', `timeStep * steps must be no greater than ${MAX_TOTAL_TIME}`)

  const sampleCount = sampleSteps(steps, sampleEvery).length
  if (sampleCount > GALA_MAX_SAMPLES) {
    fail('gala input', `sampling requests ${sampleCount} samples; the maximum is ${GALA_MAX_SAMPLES}`)
  }
  const estimatedOutputBytes = 1_024 + sampleCount * (1_200 + bodies.length * 300)
  if (estimatedOutputBytes > GALA_MAX_OUTPUT_BYTES) {
    fail('gala input', `estimated output exceeds ${GALA_MAX_OUTPUT_BYTES} bytes`)
  }

  const totalMass = bodies.reduce((sum, body) => sum + body.mass, 0)
  if (!Number.isFinite(totalMass) || totalMass <= 0) fail('gala input.bodies', 'must have a positive finite total mass')
  const minimumDistance = assertSeparated(bodies)
  const phaseAdvance = timeStep * Math.sqrt(totalMass / minimumDistance ** 3)
  if (!Number.isFinite(phaseAdvance) || phaseAdvance > MAX_STABILITY_PHASE) {
    fail('gala input', 'timeStep is too large for the closest-body orbital timescale')
  }
  return { bodies, timeStep, steps, sampleEvery }
}

function accelerations(bodies: readonly BodyState[]): Vector3[] {
  const result = bodies.map((): Vector3 => [0, 0, 0])
  for (let left = 0; left < bodies.length; left += 1) {
    const first = bodies[left]
    const firstAcceleration = result[left]
    if (!first || !firstAcceleration) throw new RangeError('gala body state is missing')
    for (let right = left + 1; right < bodies.length; right += 1) {
      const second = bodies[right]
      const secondAcceleration = result[right]
      if (!second || !secondAcceleration) throw new RangeError('gala body state is missing')
      const dx = second.position[0] - first.position[0]
      const dy = second.position[1] - first.position[1]
      const dz = second.position[2] - first.position[2]
      const squared = dx * dx + dy * dy + dz * dz
      const distance = Math.sqrt(squared)
      if (!Number.isFinite(distance) || distance < MIN_SEPARATION) {
        throw new RangeError(`gala bodies ${left} and ${right} reached a singular separation`)
      }
      const scale = 1 / (squared * distance)
      const leftScale = second.mass * scale
      const rightScale = first.mass * scale
      firstAcceleration[0] += dx * leftScale
      firstAcceleration[1] += dy * leftScale
      firstAcceleration[2] += dz * leftScale
      secondAcceleration[0] -= dx * rightScale
      secondAcceleration[1] -= dy * rightScale
      secondAcceleration[2] -= dz * rightScale
    }
  }
  for (const acceleration of result) {
    acceleration[0] = finiteOutput(acceleration[0], 'acceleration')
    acceleration[1] = finiteOutput(acceleration[1], 'acceleration')
    acceleration[2] = finiteOutput(acceleration[2], 'acceleration')
  }
  return result
}

function invariantValues(bodies: readonly BodyState[]): GalaInvariantV1 {
  const momentum: Vector3 = [0, 0, 0]
  const centerNumerator: Vector3 = [0, 0, 0]
  const angularMomentum: Vector3 = [0, 0, 0]
  let totalMass = 0
  let kineticEnergy = 0
  let potentialEnergy = 0

  for (const body of bodies) {
    const speedSquared = body.velocity[0] ** 2 + body.velocity[1] ** 2 + body.velocity[2] ** 2
    kineticEnergy += 0.5 * body.mass * speedSquared
    totalMass += body.mass
    for (const axis of AXES) {
      momentum[axis] += body.mass * body.velocity[axis]
      centerNumerator[axis] += body.mass * body.position[axis]
    }
    angularMomentum[0] += body.mass * (body.position[1] * body.velocity[2] - body.position[2] * body.velocity[1])
    angularMomentum[1] += body.mass * (body.position[2] * body.velocity[0] - body.position[0] * body.velocity[2])
    angularMomentum[2] += body.mass * (body.position[0] * body.velocity[1] - body.position[1] * body.velocity[0])
  }
  for (let left = 0; left < bodies.length; left += 1) {
    const first = bodies[left]
    if (!first) throw new RangeError('gala body state is missing')
    for (let right = left + 1; right < bodies.length; right += 1) {
      const second = bodies[right]
      if (!second) throw new RangeError('gala body state is missing')
      potentialEnergy -= first.mass * second.mass / Math.sqrt(distanceSquared(first.position, second.position))
    }
  }
  if (!Number.isFinite(totalMass) || totalMass <= 0) throw new RangeError('gala total mass is not finite')
  const centerOfMass: Vector3 = [
    centerNumerator[0] / totalMass,
    centerNumerator[1] / totalMass,
    centerNumerator[2] / totalMass,
  ]
  const totalEnergy = kineticEnergy + potentialEnergy
  return {
    kineticEnergy: finiteOutput(kineticEnergy, 'kinetic energy'),
    potentialEnergy: finiteOutput(potentialEnergy, 'potential energy'),
    totalEnergy: finiteOutput(totalEnergy, 'total energy'),
    linearMomentum: finiteVector(momentum, 'linear momentum'),
    centerOfMass: finiteVector(centerOfMass, 'center of mass'),
    angularMomentum: finiteVector(angularMomentum, 'angular momentum'),
  }
}

function copyBodies(bodies: readonly BodyState[]): GalaStateV1[] {
  return bodies.map((body) => ({
    mass: finiteOutput(body.mass, 'body mass'),
    position: finiteVector(body.position, 'position'),
    velocity: finiteVector(body.velocity, 'velocity'),
  }))
}

function makeSample(step: number, input: ParsedInput, bodies: readonly BodyState[]): GalaSampleV1 {
  return {
    step,
    time: finiteOutput(step * input.timeStep, 'time'),
    bodies: copyBodies(bodies),
    invariants: invariantValues(bodies),
  }
}

function advance(bodies: BodyState[], timeStep: number, currentAccelerations: readonly Vector3[]): Vector3[] {
  const halfTimeStepSquared = 0.5 * timeStep * timeStep
  for (let index = 0; index < bodies.length; index += 1) {
    const body = bodies[index]
    const acceleration = currentAccelerations[index]
    if (!body || !acceleration) throw new RangeError('gala body state is missing')
    for (const axis of AXES) {
      body.position[axis] = finiteOutput(
        body.position[axis] + body.velocity[axis] * timeStep + acceleration[axis] * halfTimeStepSquared,
        'position',
      )
    }
  }
  assertSeparated(bodies)
  const nextAccelerations = accelerations(bodies)
  const halfTimeStep = 0.5 * timeStep
  for (let index = 0; index < bodies.length; index += 1) {
    const body = bodies[index]
    const previous = currentAccelerations[index]
    const next = nextAccelerations[index]
    if (!body || !previous || !next) throw new RangeError('gala body state is missing')
    for (const axis of AXES) {
      body.velocity[axis] = finiteOutput(body.velocity[axis] + (previous[axis] + next[axis]) * halfTimeStep, 'velocity')
    }
  }
  return nextAccelerations
}

function vectorDifference(left: GalaVector3V1, right: GalaVector3V1): Vector3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]]
}

function norm(value: GalaVector3V1): number {
  return Math.hypot(value[0], value[1], value[2])
}

function solve(input: ParsedInput, ...signals: readonly (AbortSignal | undefined)[]): GalaOutputV1 {
  throwIfAborted(...signals)
  const bodies = input.bodies.map((body) => ({
    mass: body.mass,
    position: [...body.position] as Vector3,
    velocity: [...body.velocity] as Vector3,
  }))
  let currentAccelerations = accelerations(bodies)
  const initial = invariantValues(bodies)
  const samples: GalaSampleV1[] = [makeSample(0, input, bodies)]

  for (let step = 1; step <= input.steps; step += 1) {
    throwIfAborted(...signals)
    currentAccelerations = advance(bodies, input.timeStep, currentAccelerations)
    if (step === input.steps || step % input.sampleEvery === 0) samples.push(makeSample(step, input, bodies))
  }

  const final = invariantValues(bodies)
  const energyAbsolute = Math.abs(final.totalEnergy - initial.totalEnergy)
  const energyRelative = energyAbsolute / Math.max(1, Math.abs(initial.totalEnergy))
  const momentumDifference = vectorDifference(final.linearMomentum, initial.linearMomentum)
  const centerDifference = vectorDifference(final.centerOfMass, initial.centerOfMass)
  const angularDifference = vectorDifference(final.angularMomentum, initial.angularMomentum)
  const output: GalaOutputV1 = {
    schemaVersion: 1,
    model: 'gala-orbit-v1',
    integrator: 'velocity-verlet',
    unitSystem: 'normalized-GM-units',
    input: {
      bodies: copyBodies(input.bodies),
      timeStep: input.timeStep,
      steps: input.steps,
      sampleEvery: input.sampleEvery,
    },
    samples,
    initial,
    final,
    invariantDrift: {
      energyAbsolute: finiteOutput(energyAbsolute, 'energy drift'),
      energyRelative: finiteOutput(energyRelative, 'relative energy drift'),
      linearMomentumNorm: finiteOutput(norm(momentumDifference), 'linear momentum drift'),
      centerOfMassDisplacement: finiteOutput(norm(centerDifference), 'center-of-mass drift'),
      angularMomentumNorm: finiteOutput(norm(angularDifference), 'angular momentum drift'),
    },
    assumptions: [
      'G = 1 and all positions, velocities, masses, and times use a self-consistent normalized unit system.',
      'Bodies are point masses with pairwise Newtonian gravity; collisions, finite radii, external potentials, and relativistic effects are excluded.',
      'The velocity-Verlet step is accepted only when its closest-body phase advance is within the bounded educational stability domain.',
      'The returned samples are state snapshots and diagnostics, not a fitted galactic potential or an observational catalogue.',
    ],
    numericalMethod: 'Direct pairwise Newtonian acceleration with bounded velocity-Verlet stepping.',
    doesNotEstablish: 'This provisional normalized N-body calculation does not establish equivalence to gala, a galactic model, or an observational validation claim.',
    integrationStatus: 'available',
    licenseCaveat: GALA_SOURCE_CAVEATS.license,
    provenanceCaveat: GALA_SOURCE_CAVEATS.model,
  }
  const serialized = JSON.stringify(output)
  if (serialized === undefined) throw new Error('gala output could not be serialized as JSON')
  if (serialized.length > GALA_MAX_OUTPUT_BYTES) throw new RangeError(`gala output exceeds ${GALA_MAX_OUTPUT_BYTES} bytes`)
  return output
}

export function evaluateGalaOrbit(value: GalaInputV1, signal?: AbortSignal): GalaOutputV1 {
  return solve(parseInput(value), signal)
}

function descriptorString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'must be a non-empty string')
  return value
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-gala' || descriptor.title !== 'gala') {
    throw new TypeError('gala adapter requires the gala simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('gala adapter requires TypeScript execution')
  const adapterId = descriptor.adapterId === undefined ? GALA_ADAPTER_ID : descriptorString(descriptor.adapterId, 'gala descriptor.adapterId')
  if (!/^[A-Za-z0-9_-]+$/.test(adapterId)) fail('gala descriptor.adapterId', 'must be a safe ID')
  return {
    adapterId,
    compatibility: {
      contentRevision: descriptorString(descriptor.contentRevision, 'gala descriptor.contentRevision'),
      modelRevision: descriptorString(descriptor.modelRevision, 'gala descriptor.modelRevision'),
      implementationRevision: descriptorString(descriptor.implementationRevision, 'gala descriptor.implementationRevision'),
      outputRevision: descriptorString(descriptor.outputRevision, 'gala descriptor.outputRevision'),
    },
  }
}

export const createGalaAdapter: GalaAdapterFactory = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      throwIfAborted(signal, runSignal)
      const output = solve(parseInput(input), signal, runSignal)
      throwIfAborted(signal, runSignal)
      return output
    },
  }
}

export const galaAdapterFactory = createGalaAdapter
export const createGalaAdapterFactory = createGalaAdapter
export const createGALAAdapter = createGalaAdapter
