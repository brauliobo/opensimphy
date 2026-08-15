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

export interface CannonJsVectorV1 {
  x: number
  y: number
  z: number
}

export interface CannonJsBodyInputV1 {
  id: string
  position: CannonJsVectorV1
  velocity?: CannonJsVectorV1
  radius: number
  mass?: number
  restitution?: number
}

export interface CannonJsAdapterInputV1 {
  bodies: readonly CannonJsBodyInputV1[]
  gravity: CannonJsVectorV1
  floorY?: number
  steps: number
  dt: number
  sampleEvery?: number
  restitution?: number
}

export interface CannonJsBodyStateV1 {
  id: string
  position: CannonJsVectorV1
  velocity: CannonJsVectorV1
  radius: number
}

export interface CannonJsFrameV1 {
  step: number
  time: number
  bodies: CannonJsBodyStateV1[]
}

export interface CannonJsAdapterOutputV1 {
  schemaVersion: 1
  dimension: 3
  frames: CannonJsFrameV1[]
}

export type CannonJsAdapterInput = CannonJsAdapterInputV1
export type CannonJsAdapterOutput = CannonJsAdapterOutputV1
export type CannonJsAdapter = AwesomePhysicsAdapterV1<CannonJsAdapterInputV1, CannonJsAdapterOutputV1>
export type CannonJsAdapterFactory = AwesomePhysicsAdapterFactoryV1<CannonJsAdapterInputV1, CannonJsAdapterOutputV1>

interface CannonJsLimits {
  maxBodies: number
  maxSteps: number
  maxOutputBytes: number
}

interface CannonBody {
  id: string
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  radius: number
  inverseMass: number
  restitution: number
}

interface CannonInput {
  bodies: CannonBody[]
  gravityX: number
  gravityY: number
  gravityZ: number
  floorY: number
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

function requireFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
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

function parseVector(value: unknown, path: string): CannonJsVectorV1 {
  const object = requireExactKeys(value, ['x', 'y', 'z'], [], path)
  return {
    x: requireFiniteNumber(object.x, `${path}.x`),
    y: requireFiniteNumber(object.y, `${path}.y`),
    z: requireFiniteNumber(object.z, `${path}.z`),
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
  compatibility: CannonJsAdapter['compatibility']
  limits: CannonJsLimits
} {
  throwIfAborted(signal)
  const object = requireRecord(descriptor, 'Cannon.js descriptor')
  if (object.catalogItemId !== 'awesome-cannon-js') fail('Cannon.js descriptor.catalogItemId', 'must identify cannon.js')
  if (object.title !== 'cannon.js') fail('Cannon.js descriptor.title', 'must be cannon.js')
  if (object.execution !== 'browser') fail('Cannon.js descriptor.execution', 'must be browser')

  const adapterId = requireId(object.adapterId, 'Cannon.js descriptor.adapterId')
  const compatibilityKeys = ['contentRevision', 'modelRevision', 'implementationRevision', 'outputRevision'] as const
  for (const key of compatibilityKeys) {
    if (typeof object[key] !== 'string' || object[key].trim().length === 0) {
      fail(`Cannon.js descriptor.${key}`, 'must be a non-empty string')
    }
  }

  const limits = requireRecord(object.limits, 'Cannon.js descriptor.limits')
  const maxParticles = requireSafeInteger(limits.maxParticles, 'Cannon.js descriptor.limits.maxParticles', 0)
  const maxIterations = requireSafeInteger(limits.maxIterations, 'Cannon.js descriptor.limits.maxIterations', 0)
  const maxOutputBytes = requireSafeInteger(limits.maxOutputBytes, 'Cannon.js descriptor.limits.maxOutputBytes', 1)

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

function parseBody(value: unknown, index: number, floorY: number, defaultRestitution: number): CannonBody {
  const path = `Cannon.js input.bodies[${index}]`
  const object = requireExactKeys(value, ['id', 'position', 'radius'], ['velocity', 'mass', 'restitution'], path)
  const id = requireId(object.id, `${path}.id`)
  const position = parseVector(object.position, `${path}.position`)
  const radius = requirePositiveNumber(object.radius, `${path}.radius`)
  if (position.y < floorY + radius) fail(`${path}.position`, 'must place the sphere above the fixed floor')
  const velocity = optionalValue(object, 'velocity') === undefined
    ? { x: 0, y: 0, z: 0 }
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
    z: position.z,
    vx: velocity.x,
    vy: velocity.y,
    vz: velocity.z,
    radius,
    inverseMass: 1 / mass,
    restitution,
  }
}

function parseInput(value: unknown, limits: CannonJsLimits): CannonInput {
  const object = requireExactKeys(value, ['bodies', 'gravity', 'steps', 'dt'], ['floorY', 'sampleEvery', 'restitution'], 'Cannon.js input')
  const gravity = parseVector(object.gravity, 'Cannon.js input.gravity')
  const floorY = optionalValue(object, 'floorY') === undefined
    ? 0
    : requireFiniteNumber(object.floorY, 'Cannon.js input.floorY')
  const steps = requireSafeInteger(object.steps, 'Cannon.js input.steps', 0)
  if (steps > limits.maxSteps) fail('Cannon.js input.steps', `exceeds the descriptor limit of ${limits.maxSteps}`)
  const dt = requirePositiveNumber(object.dt, 'Cannon.js input.dt')
  const sampleEvery = optionalValue(object, 'sampleEvery') === undefined
    ? 1
    : requireSafeInteger(object.sampleEvery, 'Cannon.js input.sampleEvery', 1)
  const defaultRestitution = optionalValue(object, 'restitution') === undefined
    ? DEFAULT_RESTITUTION
    : requireRatio(object.restitution, 'Cannon.js input.restitution')

  if (!Array.isArray(object.bodies)) fail('Cannon.js input.bodies', 'must be an array')
  if (object.bodies.length > limits.maxBodies) {
    fail('Cannon.js input.bodies', `exceeds the descriptor limit of ${limits.maxBodies}`)
  }
  const bodies = object.bodies.map((body, index) => parseBody(body, index, floorY, defaultRestitution))
  if (new Set(bodies.map(({ id }) => id)).size !== bodies.length) fail('Cannon.js input.bodies', 'must contain unique IDs')

  const collisionChecksPerStep = bodies.length * Math.max(0, bodies.length - 1) / 2
  if (collisionChecksPerStep > 0 && steps > Math.floor(MAX_COLLISION_CHECKS / collisionChecksPerStep)) {
    fail('Cannon.js input', 'exceeds the bounded collision-work limit')
  }

  const frameCount = steps === 0 ? 1 : Math.floor(steps / sampleEvery) + 1 + (steps % sampleEvery === 0 ? 0 : 1)
  const estimatedBodyBytes = bodies.reduce((total, body) => total + body.id.length + 200, 0)
  const estimatedOutputBytes = 64 + frameCount * (estimatedBodyBytes + 48)
  if (!Number.isSafeInteger(estimatedOutputBytes) || estimatedOutputBytes > limits.maxOutputBytes) {
    fail('Cannon.js input', `would exceed the descriptor output limit of ${limits.maxOutputBytes} bytes`)
  }

  return {
    bodies,
    gravityX: gravity.x,
    gravityY: gravity.y,
    gravityZ: gravity.z,
    floorY,
    steps,
    dt,
    sampleEvery,
  }
}

function assertFiniteBody(body: CannonBody): void {
  if (![body.x, body.y, body.z, body.vx, body.vy, body.vz].every(Number.isFinite)) {
    fail(`Cannon.js body ${body.id}`, 'produced a non-finite state')
  }
}

function resolveFloor(body: CannonBody, floorY: number): void {
  if (body.y < floorY + body.radius) {
    body.y = floorY + body.radius
    if (body.vy < 0) body.vy = -body.vy * body.restitution
  }
}

function resolvePair(first: CannonBody, second: CannonBody): void {
  const dx = second.x - first.x
  const dy = second.y - first.y
  const dz = second.z - first.z
  const minimumDistance = first.radius + second.radius
  const distanceSquared = dx * dx + dy * dy + dz * dz
  if (distanceSquared >= minimumDistance * minimumDistance) return

  const distance = Math.sqrt(distanceSquared)
  const normalX = distance === 0 ? 1 : dx / distance
  const normalY = distance === 0 ? 0 : dy / distance
  const normalZ = distance === 0 ? 0 : dz / distance
  const inverseMassTotal = first.inverseMass + second.inverseMass
  const penetration = minimumDistance - distance
  first.x -= normalX * penetration * first.inverseMass / inverseMassTotal
  first.y -= normalY * penetration * first.inverseMass / inverseMassTotal
  first.z -= normalZ * penetration * first.inverseMass / inverseMassTotal
  second.x += normalX * penetration * second.inverseMass / inverseMassTotal
  second.y += normalY * penetration * second.inverseMass / inverseMassTotal
  second.z += normalZ * penetration * second.inverseMass / inverseMassTotal

  const relativeVelocity = (second.vx - first.vx) * normalX
    + (second.vy - first.vy) * normalY
    + (second.vz - first.vz) * normalZ
  if (relativeVelocity >= 0) return
  const restitution = Math.max(first.restitution, second.restitution)
  const impulse = -(1 + restitution) * relativeVelocity / inverseMassTotal
  first.vx -= impulse * normalX * first.inverseMass
  first.vy -= impulse * normalY * first.inverseMass
  first.vz -= impulse * normalZ * first.inverseMass
  second.vx += impulse * normalX * second.inverseMass
  second.vy += impulse * normalY * second.inverseMass
  second.vz += impulse * normalZ * second.inverseMass
}

function snapshot(step: number, dt: number, bodies: readonly CannonBody[]): CannonJsFrameV1 {
  const time = step * dt
  if (!Number.isFinite(time)) fail('Cannon.js output', 'contains a non-finite frame time')
  return {
    step,
    time,
    bodies: bodies.map((body) => {
      assertFiniteBody(body)
      return {
        id: body.id,
        position: { x: body.x, y: body.y, z: body.z },
        velocity: { x: body.vx, y: body.vy, z: body.vz },
        radius: body.radius,
      }
    }),
  }
}

function assertOutputSize(output: CannonJsAdapterOutputV1, maxOutputBytes: number): void {
  const serialized = JSON.stringify(output)
  if (serialized.length > maxOutputBytes) {
    fail('Cannon.js output', `exceeds the descriptor output limit of ${maxOutputBytes} bytes`)
  }
}

function runCannonJs(inputValue: CannonJsAdapterInputV1, signal: AbortSignal | undefined, limits: CannonJsLimits): CannonJsAdapterOutputV1 {
  throwIfAborted(signal)
  const input = parseInput(inputValue, limits)
  const gravityDeltaX = input.gravityX * input.dt
  const gravityDeltaY = input.gravityY * input.dt
  const gravityDeltaZ = input.gravityZ * input.dt
  const gravityDisplacementX = 0.5 * input.gravityX * input.dt * input.dt
  const gravityDisplacementY = 0.5 * input.gravityY * input.dt * input.dt
  const gravityDisplacementZ = 0.5 * input.gravityZ * input.dt * input.dt
  if (![gravityDeltaX, gravityDeltaY, gravityDeltaZ, gravityDisplacementX, gravityDisplacementY, gravityDisplacementZ].every(Number.isFinite)) {
    fail('Cannon.js input', 'produces non-finite integration coefficients')
  }

  const frames: CannonJsFrameV1[] = [snapshot(0, input.dt, input.bodies)]
  for (let step = 1; step <= input.steps; step += 1) {
    throwIfAborted(signal)
    for (const body of input.bodies) {
      throwIfAborted(signal)
      body.x += body.vx * input.dt + gravityDisplacementX
      body.y += body.vy * input.dt + gravityDisplacementY
      body.z += body.vz * input.dt + gravityDisplacementZ
      body.vx += gravityDeltaX
      body.vy += gravityDeltaY
      body.vz += gravityDeltaZ
      assertFiniteBody(body)
    }

    for (let iteration = 0; iteration < COLLISION_ITERATIONS; iteration += 1) {
      throwIfAborted(signal)
      for (const body of input.bodies) {
        resolveFloor(body, input.floorY)
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

  const output: CannonJsAdapterOutputV1 = { schemaVersion: 1, dimension: 3, frames }
  assertOutputSize(output, limits.maxOutputBytes)
  return output
}

export function createCannonJsAdapter(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal?: AbortSignal,
): CannonJsAdapter {
  const validated = descriptorLimits(descriptor, signal)
  return {
    adapterId: validated.adapterId,
    protocol: PROTOCOL,
    compatibility: validated.compatibility,
    run: (input, runSignal) => runCannonJs(input, runSignal, validated.limits),
  }
}

export const createCannonJsAdapterFactory: CannonJsAdapterFactory = createCannonJsAdapter
