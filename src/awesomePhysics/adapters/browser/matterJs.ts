import type {
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

const PROTOCOL = 'awesome-physics-adapter-v1' as const
const HARD_MAX_BODIES = 256
const HARD_MAX_STEPS = 10_000
const HARD_MAX_OUTPUT_BYTES = 4_194_304
const MAX_COLLISION_CHECKS = 2_000_000
const COLLISION_ITERATIONS = 2
const DEFAULT_RESTITUTION = 0.8

type UnknownRecord = Record<string, unknown>

export interface MatterJsVectorV1 {
  x: number
  y: number
}

export interface MatterJsBoundsV1 {
  width: number
  height: number
}

export interface MatterJsBodyInputV1 {
  id: string
  position: MatterJsVectorV1
  velocity?: MatterJsVectorV1
  radius: number
  mass?: number
  restitution?: number
}

export interface MatterJsAdapterInputV1 {
  bodies: readonly MatterJsBodyInputV1[]
  bounds: MatterJsBoundsV1
  gravity: MatterJsVectorV1
  steps: number
  dt: number
  sampleEvery?: number
  restitution?: number
}

export interface MatterJsBodyStateV1 {
  id: string
  position: MatterJsVectorV1
  velocity: MatterJsVectorV1
  radius: number
}

export interface MatterJsFrameV1 {
  step: number
  time: number
  bodies: MatterJsBodyStateV1[]
}

export interface MatterJsAdapterOutputV1 {
  schemaVersion: 1
  dimension: 2
  frames: MatterJsFrameV1[]
}

export type MatterJsAdapterInput = MatterJsAdapterInputV1
export type MatterJsAdapterOutput = MatterJsAdapterOutputV1
export type MatterJsAdapter = AwesomePhysicsAdapterV1<MatterJsAdapterInputV1, MatterJsAdapterOutputV1>
export type MatterJsAdapterFactory = AwesomePhysicsAdapterFactoryV1<MatterJsAdapterInputV1, MatterJsAdapterOutputV1>

interface MatterJsLimits {
  maxBodies: number
  maxSteps: number
  maxOutputBytes: number
}

interface MatterBody {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  inverseMass: number
  restitution: number
}

interface MatterInput {
  bodies: MatterBody[]
  width: number
  height: number
  gravityX: number
  gravityY: number
  steps: number
  dt: number
  sampleEvery: number
}

function fail(path: string, message: string): never {
  throw new TypeError(`${path} ${message}`)
}

function requireRecord(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'must be an object')
  return value as UnknownRecord
}

function requireExactKeys(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): UnknownRecord {
  const object = requireRecord(value, path)
  const allowed = new Set([...required, ...optional])
  const unknown = Object.keys(object).filter((key) => !allowed.has(key))
  const missing = required.filter((key) => !Object.hasOwn(object, key))
  if (unknown.length > 0) fail(path, `has unknown properties: ${unknown.join(', ')}`)
  if (missing.length > 0) fail(path, `is missing properties: ${missing.join(', ')}`)
  return object
}

function requireFiniteNumber(value: unknown, path: string, minimum?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (minimum !== undefined && value < minimum)) {
    const suffix = minimum === undefined ? 'must be a finite number' : `must be a finite number greater than or equal to ${minimum}`
    fail(path, suffix)
  }
  return value
}

function requirePositiveNumber(value: unknown, path: string): number {
  const number = requireFiniteNumber(value, path)
  if (number <= 0) fail(path, 'must be greater than zero')
  return number
}

function requireSafeInteger(value: unknown, path: string, minimum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    fail(path, `must be a safe integer greater than or equal to ${minimum}`)
  }
  return value
}

function requireRatio(value: unknown, path: string): number {
  const number = requireFiniteNumber(value, path)
  if (number < 0 || number > 1) fail(path, 'must be between zero and one')
  return number
}

function requireId(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    fail(path, 'must be a non-empty ASCII ID of at most 64 characters')
  }
  return value
}

function optionalValue(object: UnknownRecord, key: string): unknown {
  return Object.hasOwn(object, key) ? object[key] : undefined
}

function parseVector(value: unknown, path: string): MatterJsVectorV1 {
  const object = requireExactKeys(value, ['x', 'y'], [], path)
  return {
    x: requireFiniteNumber(object.x, `${path}.x`),
    y: requireFiniteNumber(object.y, `${path}.y`),
  }
}

function abortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) return signal.reason
  const error = new Error('The operation was aborted')
  error.name = 'AbortError'
  return error
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError(signal)
}

function descriptorLimits(descriptor: AwesomePhysicsSimulationDescriptorV1, signal?: AbortSignal): {
  adapterId: string
  compatibility: MatterJsAdapter['compatibility']
  limits: MatterJsLimits
} {
  throwIfAborted(signal)
  const object = requireRecord(descriptor, 'Matter.js descriptor')
  if (object.catalogItemId !== 'awesome-matter-js') fail('Matter.js descriptor.catalogItemId', 'must identify matter-js')
  if (object.title !== 'matter-js') fail('Matter.js descriptor.title', 'must be matter-js')
  if (object.execution !== 'browser') fail('Matter.js descriptor.execution', 'must be browser')

  const adapterId = requireId(object.adapterId, 'Matter.js descriptor.adapterId')
  const compatibilityKeys = ['contentRevision', 'modelRevision', 'implementationRevision', 'outputRevision'] as const
  for (const key of compatibilityKeys) {
    if (typeof object[key] !== 'string' || object[key].trim().length === 0) {
      fail(`Matter.js descriptor.${key}`, 'must be a non-empty string')
    }
  }

  const limits = requireRecord(object.limits, 'Matter.js descriptor.limits')
  const maxParticles = requireSafeInteger(limits.maxParticles, 'Matter.js descriptor.limits.maxParticles', 0)
  const maxIterations = requireSafeInteger(limits.maxIterations, 'Matter.js descriptor.limits.maxIterations', 0)
  const maxOutputBytes = requireSafeInteger(limits.maxOutputBytes, 'Matter.js descriptor.limits.maxOutputBytes', 1)

  return {
    adapterId,
    compatibility: {
      contentRevision: object.contentRevision as string,
      modelRevision: object.modelRevision as string,
      implementationRevision: object.implementationRevision as string,
      outputRevision: object.outputRevision as string,
    },
    limits: {
      maxBodies: Math.min(maxParticles, HARD_MAX_BODIES),
      maxSteps: Math.min(maxIterations, HARD_MAX_STEPS),
      maxOutputBytes: Math.min(maxOutputBytes, HARD_MAX_OUTPUT_BYTES),
    },
  }
}

function parseBody(
  value: unknown,
  index: number,
  width: number,
  height: number,
  defaultRestitution: number,
): MatterBody {
  const path = `Matter.js input.bodies[${index}]`
  const object = requireExactKeys(value, ['id', 'position', 'radius'], ['velocity', 'mass', 'restitution'], path)
  const id = requireId(object.id, `${path}.id`)
  const position = parseVector(object.position, `${path}.position`)
  const radius = requirePositiveNumber(object.radius, `${path}.radius`)
  if (radius * 2 > width || radius * 2 > height) fail(`${path}.radius`, 'does not fit inside the fixed boundary')
  if (position.x < radius || position.x > width - radius || position.y < radius || position.y > height - radius) {
    fail(`${path}.position`, 'must place the body inside the fixed boundary')
  }
  const velocity = optionalValue(object, 'velocity') === undefined
    ? { x: 0, y: 0 }
    : parseVector(object.velocity, `${path}.velocity`)
  const mass = optionalValue(object, 'mass') === undefined
    ? 1
    : requirePositiveNumber(object.mass, `${path}.mass`)
  const restitution = optionalValue(object, 'restitution') === undefined
    ? defaultRestitution
    : requireRatio(object.restitution, `${path}.restitution`)
  return {
    id,
    x: position.x,
    y: position.y,
    vx: velocity.x,
    vy: velocity.y,
    radius,
    inverseMass: 1 / mass,
    restitution,
  }
}

function parseInput(value: unknown, limits: MatterJsLimits): MatterInput {
  const object = requireExactKeys(value, ['bodies', 'bounds', 'gravity', 'steps', 'dt'], ['sampleEvery', 'restitution'], 'Matter.js input')
  const bounds = requireExactKeys(object.bounds, ['width', 'height'], [], 'Matter.js input.bounds')
  const width = requirePositiveNumber(bounds.width, 'Matter.js input.bounds.width')
  const height = requirePositiveNumber(bounds.height, 'Matter.js input.bounds.height')
  const gravity = parseVector(object.gravity, 'Matter.js input.gravity')
  const steps = requireSafeInteger(object.steps, 'Matter.js input.steps', 0)
  if (steps > limits.maxSteps) fail('Matter.js input.steps', `exceeds the descriptor limit of ${limits.maxSteps}`)
  const dt = requirePositiveNumber(object.dt, 'Matter.js input.dt')
  const sampleEvery = optionalValue(object, 'sampleEvery') === undefined
    ? 1
    : requireSafeInteger(object.sampleEvery, 'Matter.js input.sampleEvery', 1)
  const defaultRestitution = optionalValue(object, 'restitution') === undefined
    ? DEFAULT_RESTITUTION
    : requireRatio(object.restitution, 'Matter.js input.restitution')

  if (!Array.isArray(object.bodies)) fail('Matter.js input.bodies', 'must be an array')
  if (object.bodies.length > limits.maxBodies) {
    fail('Matter.js input.bodies', `exceeds the descriptor limit of ${limits.maxBodies}`)
  }
  const bodies = object.bodies.map((body, index) => parseBody(body, index, width, height, defaultRestitution))
  if (new Set(bodies.map(({ id }) => id)).size !== bodies.length) fail('Matter.js input.bodies', 'must contain unique IDs')

  const collisionChecksPerStep = bodies.length * Math.max(0, bodies.length - 1) / 2
  if (collisionChecksPerStep > 0 && steps > Math.floor(MAX_COLLISION_CHECKS / collisionChecksPerStep)) {
    fail('Matter.js input', 'exceeds the bounded collision-work limit')
  }

  const frameCount = steps === 0 ? 1 : Math.floor(steps / sampleEvery) + 1 + (steps % sampleEvery === 0 ? 0 : 1)
  const estimatedBodyBytes = bodies.reduce((total, body) => total + body.id.length + 160, 0)
  const estimatedOutputBytes = 64 + frameCount * (estimatedBodyBytes + 48)
  if (!Number.isSafeInteger(estimatedOutputBytes) || estimatedOutputBytes > limits.maxOutputBytes) {
    fail('Matter.js input', `would exceed the descriptor output limit of ${limits.maxOutputBytes} bytes`)
  }

  return {
    bodies,
    width,
    height,
    gravityX: gravity.x,
    gravityY: gravity.y,
    steps,
    dt,
    sampleEvery,
  }
}

function assertFiniteBody(body: MatterBody): void {
  if (![body.x, body.y, body.vx, body.vy].every(Number.isFinite)) {
    fail(`Matter.js body ${body.id}`, 'produced a non-finite state')
  }
}

function resolveBoundary(body: MatterBody, width: number, height: number): void {
  if (body.x < body.radius) {
    body.x = body.radius
    if (body.vx < 0) body.vx = -body.vx * body.restitution
  } else if (body.x > width - body.radius) {
    body.x = width - body.radius
    if (body.vx > 0) body.vx = -body.vx * body.restitution
  }
  if (body.y < body.radius) {
    body.y = body.radius
    if (body.vy < 0) body.vy = -body.vy * body.restitution
  } else if (body.y > height - body.radius) {
    body.y = height - body.radius
    if (body.vy > 0) body.vy = -body.vy * body.restitution
  }
}

function resolvePair(first: MatterBody, second: MatterBody): void {
  const dx = second.x - first.x
  const dy = second.y - first.y
  const minimumDistance = first.radius + second.radius
  const distanceSquared = dx * dx + dy * dy
  if (distanceSquared >= minimumDistance * minimumDistance) return

  const distance = Math.sqrt(distanceSquared)
  const normalX = distance === 0 ? 1 : dx / distance
  const normalY = distance === 0 ? 0 : dy / distance
  const inverseMassTotal = first.inverseMass + second.inverseMass
  const penetration = minimumDistance - distance
  first.x -= normalX * penetration * first.inverseMass / inverseMassTotal
  first.y -= normalY * penetration * first.inverseMass / inverseMassTotal
  second.x += normalX * penetration * second.inverseMass / inverseMassTotal
  second.y += normalY * penetration * second.inverseMass / inverseMassTotal

  const relativeVelocity = (second.vx - first.vx) * normalX + (second.vy - first.vy) * normalY
  if (relativeVelocity >= 0) return
  const restitution = Math.max(first.restitution, second.restitution)
  const impulse = -(1 + restitution) * relativeVelocity / inverseMassTotal
  first.vx -= impulse * normalX * first.inverseMass
  first.vy -= impulse * normalY * first.inverseMass
  second.vx += impulse * normalX * second.inverseMass
  second.vy += impulse * normalY * second.inverseMass
}

function snapshot(step: number, dt: number, bodies: readonly MatterBody[]): MatterJsFrameV1 {
  const time = step * dt
  if (!Number.isFinite(time)) fail('Matter.js output', 'contains a non-finite frame time')
  return {
    step,
    time,
    bodies: bodies.map((body) => {
      assertFiniteBody(body)
      return {
        id: body.id,
        position: { x: body.x, y: body.y },
        velocity: { x: body.vx, y: body.vy },
        radius: body.radius,
      }
    }),
  }
}

function assertOutputSize(output: MatterJsAdapterOutputV1, maxOutputBytes: number): void {
  const serialized = JSON.stringify(output)
  if (serialized.length > maxOutputBytes) {
    fail('Matter.js output', `exceeds the descriptor output limit of ${maxOutputBytes} bytes`)
  }
}

function runMatterJs(inputValue: MatterJsAdapterInputV1, signal: AbortSignal | undefined, limits: MatterJsLimits): MatterJsAdapterOutputV1 {
  throwIfAborted(signal)
  const input = parseInput(inputValue, limits)
  const gravityDeltaX = input.gravityX * input.dt
  const gravityDeltaY = input.gravityY * input.dt
  const gravityDisplacementX = 0.5 * input.gravityX * input.dt * input.dt
  const gravityDisplacementY = 0.5 * input.gravityY * input.dt * input.dt
  if (![gravityDeltaX, gravityDeltaY, gravityDisplacementX, gravityDisplacementY].every(Number.isFinite)) {
    fail('Matter.js input', 'produces non-finite integration coefficients')
  }

  const frames: MatterJsFrameV1[] = [snapshot(0, input.dt, input.bodies)]
  for (let step = 1; step <= input.steps; step += 1) {
    throwIfAborted(signal)
    for (const body of input.bodies) {
      throwIfAborted(signal)
      body.x += body.vx * input.dt + gravityDisplacementX
      body.y += body.vy * input.dt + gravityDisplacementY
      body.vx += gravityDeltaX
      body.vy += gravityDeltaY
      assertFiniteBody(body)
    }

    for (let iteration = 0; iteration < COLLISION_ITERATIONS; iteration += 1) {
      throwIfAborted(signal)
      for (const body of input.bodies) {
        resolveBoundary(body, input.width, input.height)
        assertFiniteBody(body)
      }
      for (let firstIndex = 0; firstIndex < input.bodies.length; firstIndex += 1) {
        throwIfAborted(signal)
        const first = input.bodies[firstIndex]!
        for (let secondIndex = firstIndex + 1; secondIndex < input.bodies.length; secondIndex += 1) {
          throwIfAborted(signal)
          resolvePair(first, input.bodies[secondIndex]!)
        }
      }
    }

    if (step % input.sampleEvery === 0 || step === input.steps) {
      frames.push(snapshot(step, input.dt, input.bodies))
    }
  }

  const output: MatterJsAdapterOutputV1 = { schemaVersion: 1, dimension: 2, frames }
  assertOutputSize(output, limits.maxOutputBytes)
  return output
}

export function createMatterJsAdapter(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal?: AbortSignal,
): MatterJsAdapter {
  const validated = descriptorLimits(descriptor, signal)
  return {
    adapterId: validated.adapterId,
    protocol: PROTOCOL,
    compatibility: validated.compatibility,
    run: (input, runSignal) => runMatterJs(input, runSignal, validated.limits),
  }
}

export const createMatterJsAdapterFactory: MatterJsAdapterFactory = createMatterJsAdapter
