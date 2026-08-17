import { fail, record, exactKeys, finiteNumber, boundedNumber, throwIfAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const RAYOPT_ADAPTER_ID = 'awesome-rayopt-typescript'
export const RAYOPT_KERNEL_REVISION = 'rayopt-sequential-snell-typescript-v1'
export const RAYOPT_SOURCE_REVISION = 'a51f1dbd7c11'
export const RAYOPT_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/jordens/rayopt',
  license: 'rayopt catalog metadata identifies LGPL-3+; this independent kernel remains subject to a separate availability and license gate.',
  data: 'No rayopt runtime, SciPy optimizer, Cython extension, glass catalog, or external lens data is bundled.',
})
export const RAYOPT_MAX_SURFACES = 32

const MIN_REFRACTIVE_INDEX = 1e-6
const MAX_REFRACTIVE_INDEX = 20
const MIN_RADIUS = 1e-9
const MAX_RADIUS = 1e7
const MAX_APERTURE_RADIUS = 1e6
const MAX_THICKNESS = 1e6
const MAX_TOTAL_THICKNESS = 1e7
const MAX_COORDINATE = 1e7
const MAX_DIRECTION_COMPONENT = 1e6
const DIRECTION_EPSILON = 1e-12
const INTERSECTION_EPSILON = 1e-10
const MAX_OUTPUT_BYTES = 1_000_000

export type RayoptPointV1 = readonly [number, number]

export interface RayoptRayV1 {
  origin: RayoptPointV1
  direction: RayoptPointV1
}

export interface RayoptSurfaceV1 {
  radius: number | null
  apertureRadius: number
  thickness: number
  refractiveIndex: number
}

export interface RayoptInputV1 {
  ray: RayoptRayV1
  initialRefractiveIndex: number
  surfaces: readonly RayoptSurfaceV1[]
}

export type RayoptMissReasonV1 =
  | 'no-forward-intersection'
  | 'aperture'
  | 'total-internal-reflection'
  | 'invalid-incidence'
  | 'backward-refraction'

export interface RayoptTraceEntryV1 {
  surfaceIndex: number
  vertexZ: number
  hit: boolean
  point: RayoptPointV1 | null
  normal: RayoptPointV1 | null
  direction: RayoptPointV1 | null
  reason: RayoptMissReasonV1 | null
}

export interface RayoptOutputV1 {
  hit: boolean
  missedSurface: number | null
  finalRay: RayoptRayV1 | null
  trace: readonly RayoptTraceEntryV1[]
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export type RayoptPoint = RayoptPointV1
export type RayoptRay = RayoptRayV1
export type RayoptSurface = RayoptSurfaceV1
export type RayoptInput = RayoptInputV1
export type RayoptOutput = RayoptOutputV1
export type RayoptAdapterInputV1 = RayoptInputV1
export type RayoptAdapterOutputV1 = RayoptOutputV1
export type RayoptAdapter = AwesomePhysicsAdapterV1<RayoptInputV1, RayoptOutputV1>
export type RayoptAdapterFactory = AwesomePhysicsAdapterFactoryV1<RayoptInputV1, RayoptOutputV1>

interface ParsedInput {
  ray: RayoptRayV1
  initialRefractiveIndex: number
  surfaces: RayoptSurfaceV1[]
}

interface SurfaceHit {
  hit: true
  point: RayoptPointV1
  normal: RayoptPointV1
}

interface SurfaceMiss {
  hit: false
  point: RayoptPointV1 | null
  normal: RayoptPointV1 | null
  reason: RayoptMissReasonV1
}

type SurfaceIntersection = SurfaceHit | SurfaceMiss

function vector(value: unknown, path: string, limit: number): RayoptPointV1 {
  if (!Array.isArray(value) || value.length !== 2) fail(path, 'must be an array of exactly two finite numbers')
  return [
    boundedNumber(value[0], `${path}[0]`, -limit, limit),
    boundedNumber(value[1], `${path}[1]`, -limit, limit),
  ]
}

function normalize(value: RayoptPointV1, path: string): RayoptPointV1 {
  const magnitude = Math.hypot(value[0], value[1])
  if (!Number.isFinite(magnitude) || magnitude <= DIRECTION_EPSILON) fail(path, 'must not be zero')
  const result: RayoptPointV1 = [value[0] / magnitude, value[1] / magnitude]
  if (!result.every(Number.isFinite)) throw new RangeError(`${path} normalization is not finite`)
  return result
}

function parseInput(input: unknown): ParsedInput {
  const object = record(input, 'rayopt input')
  exactKeys(object, ['ray', 'initialRefractiveIndex', 'surfaces'], [], 'rayopt input')
  const rayObject = record(object.ray, 'rayopt input.ray')
  exactKeys(rayObject, ['origin', 'direction'], [], 'rayopt input.ray')
  const origin = vector(rayObject.origin, 'rayopt input.ray.origin', MAX_COORDINATE)
  const direction = normalize(
    vector(rayObject.direction, 'rayopt input.ray.direction', MAX_DIRECTION_COMPONENT),
    'rayopt input.ray.direction',
  )
  if (direction[1] <= DIRECTION_EPSILON) fail('rayopt input.ray.direction', 'must point forward along positive z')
  const initialRefractiveIndex = boundedNumber(
    object.initialRefractiveIndex,
    'rayopt input.initialRefractiveIndex',
    MIN_REFRACTIVE_INDEX,
    MAX_REFRACTIVE_INDEX,
  )
  if (!Array.isArray(object.surfaces)) fail('rayopt input.surfaces', 'must be an array')
  if (object.surfaces.length === 0 || object.surfaces.length > RAYOPT_MAX_SURFACES) {
    fail('rayopt input.surfaces', `must contain between 1 and ${RAYOPT_MAX_SURFACES} surfaces`)
  }
  let totalThickness = 0
  const surfaces = object.surfaces.map((value, index) => {
    const path = `rayopt input.surfaces[${index}]`
    const surfaceObject = record(value, path)
    exactKeys(surfaceObject, ['radius', 'apertureRadius', 'thickness', 'refractiveIndex'], [], path)
    let radius: number | null
    if (surfaceObject.radius === null) {
      radius = null
    } else {
      radius = boundedNumber(surfaceObject.radius, `${path}.radius`, -MAX_RADIUS, MAX_RADIUS)
      if (Math.abs(radius) < MIN_RADIUS) fail(`${path}.radius`, `must be null or have magnitude at least ${MIN_RADIUS}`)
    }
    const apertureRadius = boundedNumber(
      surfaceObject.apertureRadius,
      `${path}.apertureRadius`,
      Number.EPSILON,
      MAX_APERTURE_RADIUS,
    )
    const thickness = boundedNumber(surfaceObject.thickness, `${path}.thickness`, 0, MAX_THICKNESS)
    totalThickness += thickness
    if (!Number.isFinite(totalThickness) || totalThickness > MAX_TOTAL_THICKNESS) {
      fail('rayopt input.surfaces', 'total thickness exceeds the finite bound')
    }
    const refractiveIndex = boundedNumber(
      surfaceObject.refractiveIndex,
      `${path}.refractiveIndex`,
      MIN_REFRACTIVE_INDEX,
      MAX_REFRACTIVE_INDEX,
    )
    return { radius, apertureRadius, thickness, refractiveIndex }
  })
  return { ray: { origin, direction }, initialRefractiveIndex, surfaces }
}

function surfaceNormal(surface: RayoptSurfaceV1, vertexZ: number, point: RayoptPointV1): RayoptPointV1 {
  if (surface.radius === null) return [0, -1]
  const centerZ = vertexZ + surface.radius
  const magnitude = Math.abs(surface.radius)
  let normal: RayoptPointV1 = [point[0] / magnitude, (point[1] - centerZ) / magnitude]
  if (normal[1] > 0) normal = [-normal[0], -normal[1]]
  return normal
}

function intersection(surface: RayoptSurfaceV1, vertexZ: number, ray: RayoptRayV1): SurfaceIntersection {
  const direction = ray.direction
  let parameter: number | null = null
  if (surface.radius === null) {
    if (Math.abs(direction[1]) <= DIRECTION_EPSILON) {
      return { hit: false, point: null, normal: null, reason: 'no-forward-intersection' }
    }
    const candidate = (vertexZ - ray.origin[1]) / direction[1]
    if (Number.isFinite(candidate) && candidate >= -INTERSECTION_EPSILON) parameter = Math.max(0, candidate)
  } else {
    const centerZ = vertexZ + surface.radius
    const offset: RayoptPointV1 = [ray.origin[0], ray.origin[1] - centerZ]
    const b = 2 * (offset[0] * direction[0] + offset[1] * direction[1])
    const c = offset[0] * offset[0] + offset[1] * offset[1] - surface.radius * surface.radius
    const discriminant = b * b - 4 * c
    if (!Number.isFinite(discriminant)) throw new RangeError('rayopt intersection discriminant is not finite')
    if (discriminant >= -INTERSECTION_EPSILON) {
      const root = Math.sqrt(Math.max(0, discriminant))
      const candidates = [(-b - root) / 2, (-b + root) / 2]
      for (const candidate of candidates) {
        if (Number.isFinite(candidate) && candidate >= -INTERSECTION_EPSILON) {
          parameter = Math.max(0, candidate)
          break
        }
      }
    }
  }
  if (parameter === null || parameter > MAX_COORDINATE) {
    return { hit: false, point: null, normal: null, reason: 'no-forward-intersection' }
  }
  const point: RayoptPointV1 = [
    ray.origin[0] + parameter * direction[0],
    ray.origin[1] + parameter * direction[1],
  ]
  if (!point.every(Number.isFinite)) throw new RangeError('rayopt intersection point is not finite')
  const normal = surfaceNormal(surface, vertexZ, point)
  if (Math.abs(point[0]) > surface.apertureRadius + INTERSECTION_EPSILON) {
    return { hit: false, point, normal, reason: 'aperture' }
  }
  return { hit: true, point, normal }
}

function refract(
  direction: RayoptPointV1,
  normal: RayoptPointV1,
  incidentIndex: number,
  transmittedIndex: number,
): { direction: RayoptPointV1 } | { reason: RayoptMissReasonV1 } {
  const cosine = -(direction[0] * normal[0] + direction[1] * normal[1])
  if (!Number.isFinite(cosine) || cosine <= DIRECTION_EPSILON) return { reason: 'invalid-incidence' }
  const ratio = incidentIndex / transmittedIndex
  const transverse = 1 - cosine * cosine
  const squaredCosine = 1 - ratio * ratio * transverse
  if (!Number.isFinite(squaredCosine)) throw new RangeError('rayopt refraction calculation is not finite')
  if (squaredCosine < -INTERSECTION_EPSILON) return { reason: 'total-internal-reflection' }
  const transmittedCosine = Math.sqrt(Math.max(0, squaredCosine))
  const next: RayoptPointV1 = [
    ratio * direction[0] + (ratio * cosine - transmittedCosine) * normal[0],
    ratio * direction[1] + (ratio * cosine - transmittedCosine) * normal[1],
  ]
  const nextDirection = normalize(next, 'rayopt refracted direction')
  if (nextDirection[1] <= DIRECTION_EPSILON) return { reason: 'backward-refraction' }
  return { direction: nextDirection }
}

function checkOutputSize(output: RayoptOutputV1): RayoptOutputV1 {
  const serialized = JSON.stringify(output)
  if (serialized === undefined) throw new RangeError('rayopt output is not JSON serializable')
  const bytes = new TextEncoder().encode(serialized).byteLength
  if (bytes > MAX_OUTPUT_BYTES) throw new RangeError('rayopt output exceeds the bounded output size')
  return output
}

function solve(input: ParsedInput, signal?: AbortSignal): RayoptOutputV1 {
  throwIfAborted(signal)
  let origin = input.ray.origin
  let direction = input.ray.direction
  let incidentIndex = input.initialRefractiveIndex
  let vertexZ = 0
  const trace: RayoptTraceEntryV1[] = []

  for (let surfaceIndex = 0; surfaceIndex < input.surfaces.length; surfaceIndex += 1) {
    throwIfAborted(signal)
    const surface = input.surfaces[surfaceIndex]
    if (!surface) throw new RangeError('rayopt surface is missing')
    const currentRay: RayoptRayV1 = { origin, direction }
    const result = intersection(surface, vertexZ, currentRay)
    if (!result.hit) {
      trace.push({
        surfaceIndex,
        vertexZ,
        hit: false,
        point: result.point,
        normal: result.normal,
        direction,
        reason: result.reason,
      })
      return checkOutputSize({
        hit: false,
        missedSurface: surfaceIndex,
        finalRay: null,
        trace,
        assumptions: [
          'The ray is a forward-propagating two-dimensional meridional ray with coordinates [height, z].',
          'Each surface is spherical with signed radius or planar when radius is null; apertureRadius clips the surface.',
          'Each refractiveIndex is the medium after that surface, and all geometry uses one consistent length unit.',
        ],
        numericalMethod: 'Bounded sequential sphere/plane intersection followed by scalar Snell refraction at each surface.',
        licenseCaveat: RAYOPT_SOURCE_CAVEATS.license,
      })
    }
    const next = refract(direction, result.normal, incidentIndex, surface.refractiveIndex)
    if (!('direction' in next)) {
      trace.push({
        surfaceIndex,
        vertexZ,
        hit: false,
        point: result.point,
        normal: result.normal,
        direction,
        reason: next.reason,
      })
      return checkOutputSize({
        hit: false,
        missedSurface: surfaceIndex,
        finalRay: null,
        trace,
        assumptions: [
          'The ray is a forward-propagating two-dimensional meridional ray with coordinates [height, z].',
          'Each surface is spherical with signed radius or planar when radius is null; apertureRadius clips the surface.',
          'Each refractiveIndex is the medium after that surface, and all geometry uses one consistent length unit.',
        ],
        numericalMethod: 'Bounded sequential sphere/plane intersection followed by scalar Snell refraction at each surface.',
        licenseCaveat: RAYOPT_SOURCE_CAVEATS.license,
      })
    }
    direction = next.direction
    origin = result.point
    incidentIndex = surface.refractiveIndex
    trace.push({
      surfaceIndex,
      vertexZ,
      hit: true,
      point: result.point,
      normal: result.normal,
      direction,
      reason: null,
    })
    vertexZ += surface.thickness
  }

  return checkOutputSize({
    hit: true,
    missedSurface: null,
    finalRay: { origin: [...origin], direction: [...direction] },
    trace,
    assumptions: [
      'The ray is a forward-propagating two-dimensional meridional ray with coordinates [height, z].',
      'Each surface is spherical with signed radius or planar when radius is null; apertureRadius clips the surface.',
      'Each refractiveIndex is the medium after that surface, and all geometry uses one consistent length unit.',
    ],
    numericalMethod: 'Bounded sequential sphere/plane intersection followed by scalar Snell refraction at each surface.',
    licenseCaveat: RAYOPT_SOURCE_CAVEATS.license,
  })
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-rayopt' || descriptor.title !== 'rayopt') {
    throw new TypeError('rayopt adapter requires the rayopt simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('rayopt adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.length === 0)) {
    throw new TypeError('rayopt descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string'
    || descriptor.adapterId.trim().length === 0 || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('rayopt descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? RAYOPT_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createRayoptAdapter: RayoptAdapterFactory = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      throwIfAborted(signal)
      throwIfAborted(runSignal)
      const output = solve(parseInput(input), runSignal ?? signal)
      throwIfAborted(runSignal)
      return output
    },
  }
}

export const rayoptAdapterFactory = createRayoptAdapter
export const createRayOptAdapter = createRayoptAdapter
export const createRAYOPTAdapter = createRayoptAdapter
