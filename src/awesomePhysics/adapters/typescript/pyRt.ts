import { fail, record, exactKeys, finiteNumber, boundedNumber, throwIfAborted } from '../../../simphy/contract'
import { addScaled3, dot3, scale3, sub3 } from '../../../simphy/vec'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const PYRT_ADAPTER_ID = 'awesome-pyrt-typescript'
export const PYRT_KERNEL_REVISION = 'pyrt-ray-sphere-typescript-v1'
export const PYRT_SOURCE_REVISION = '6fc0ccbc6fb'
export const PYRT_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/martinchristen/pyRT',
  license: 'pyRT is MIT-licensed and upstream is WIP/pre-alpha; descriptor license integration remains a separate review step.',
  data: 'No pyRT renderer, Python runtime, or scene assets are bundled.',
})

const MAX_COORDINATE = 1e9
const MAX_DIRECTION_COMPONENT = 1e6
const MAX_RADIUS = 1e9
const MAX_RAY_PARAMETER = 1e9
const DIRECTION_EPSILON = 1e-12

export type PyRtVector3V1 = readonly [number, number, number]

export interface PyRtRayV1 {
  origin: PyRtVector3V1
  direction: PyRtVector3V1
}

export interface PyRtSphereV1 {
  center: PyRtVector3V1
  radius: number
}

export interface PyRtInputV1 {
  ray: PyRtRayV1
  sphere: PyRtSphereV1
  tMax: number
  tMin?: number
}

export interface PyRtOutputV1 {
  hit: boolean
  t: number | null
  point: PyRtVector3V1 | null
  normal: PyRtVector3V1 | null
  tMin: number
  tMax: number
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export type PyRtVector3 = PyRtVector3V1
export type PyRtRay = PyRtRayV1
export type PyRtSphere = PyRtSphereV1
export type PyRtInput = PyRtInputV1
export type PyRtOutput = PyRtOutputV1
export type PyRtAdapterInputV1 = PyRtInputV1
export type PyRtAdapterOutputV1 = PyRtOutputV1
export type PyRtAdapter = AwesomePhysicsAdapterV1<PyRtInputV1, PyRtOutputV1>
export type PyRtAdapterFactory = AwesomePhysicsAdapterFactoryV1<PyRtInputV1, PyRtOutputV1>

function vector(value: unknown, path: string, componentLimit: number): PyRtVector3V1 {
  if (!Array.isArray(value) || value.length !== 3) fail(path, 'must be an array of exactly three finite numbers')
  return [
    boundedNumber(value[0], `${path}[0]`, -componentLimit, componentLimit),
    boundedNumber(value[1], `${path}[1]`, -componentLimit, componentLimit),
    boundedNumber(value[2], `${path}[2]`, -componentLimit, componentLimit),
  ]
}

function parseInput(input: unknown): {
  ray: PyRtRayV1
  sphere: PyRtSphereV1
  tMin: number
  tMax: number
} {
  const object = record(input, 'pyRT input')
  exactKeys(object, ['ray', 'sphere', 'tMax'], ['tMin'], 'pyRT input')
  const rayObject = record(object.ray, 'pyRT input.ray')
  exactKeys(rayObject, ['origin', 'direction'], [], 'pyRT input.ray')
  const sphereObject = record(object.sphere, 'pyRT input.sphere')
  exactKeys(sphereObject, ['center', 'radius'], [], 'pyRT input.sphere')
  const ray = {
    origin: vector(rayObject.origin, 'pyRT input.ray.origin', MAX_COORDINATE),
    direction: vector(rayObject.direction, 'pyRT input.ray.direction', MAX_DIRECTION_COMPONENT),
  }
  const sphere = {
    center: vector(sphereObject.center, 'pyRT input.sphere.center', MAX_COORDINATE),
    radius: boundedNumber(sphereObject.radius, 'pyRT input.sphere.radius', Number.EPSILON, MAX_RADIUS),
  }
  const tMax = boundedNumber(object.tMax, 'pyRT input.tMax', 0, MAX_RAY_PARAMETER)
  const tMin = !Object.hasOwn(object, 'tMin')
    ? 0
    : boundedNumber(object.tMin, 'pyRT input.tMin', 0, tMax)
  if (Math.hypot(...ray.direction) <= DIRECTION_EPSILON) fail('pyRT input.ray.direction', 'must not be zero')
  return { ray, sphere, tMin, tMax }
}

function solve(input: ReturnType<typeof parseInput>, signal?: AbortSignal): PyRtOutputV1 {
  throwIfAborted(signal)
  const offset = sub3(input.ray.origin, input.sphere.center)
  const a = dot3(input.ray.direction, input.ray.direction)
  const b = 2 * dot3(offset, input.ray.direction)
  const c = dot3(offset, offset) - input.sphere.radius * input.sphere.radius
  const discriminant = b * b - 4 * a * c
  if (!Number.isFinite(discriminant)) throw new RangeError('pyRT intersection discriminant is not finite')
  if (discriminant < 0) {
    return {
      hit: false,
      t: null,
      point: null,
      normal: null,
      tMin: input.tMin,
      tMax: input.tMax,
      assumptions: [
        'The ray is parameterized as origin + t * direction.',
        'The sphere is static, closed, and uses a geometric outward normal.',
        'Only the nearest intersection inside the inclusive [tMin, tMax] bound is returned.',
      ],
      numericalMethod: 'Bounded quadratic ray/sphere intersection using the smaller valid root.',
      licenseCaveat: PYRT_SOURCE_CAVEATS.license,
    }
  }
  const root = Math.sqrt(discriminant)
  const near = (-b - root) / (2 * a)
  const far = (-b + root) / (2 * a)
  const t = [near, far].filter((candidate) => candidate >= input.tMin && candidate <= input.tMax)[0]
  if (t === undefined || !Number.isFinite(t)) {
    return {
      hit: false,
      t: null,
      point: null,
      normal: null,
      tMin: input.tMin,
      tMax: input.tMax,
      assumptions: [
        'The ray is parameterized as origin + t * direction.',
        'The sphere is static, closed, and uses a geometric outward normal.',
        'Only the nearest intersection inside the inclusive [tMin, tMax] bound is returned.',
      ],
      numericalMethod: 'Bounded quadratic ray/sphere intersection using the smaller valid root.',
      licenseCaveat: PYRT_SOURCE_CAVEATS.license,
    }
  }
  const point = addScaled3(input.ray.origin, input.ray.direction, t)
  const normal = scale3(sub3(point, input.sphere.center), 1 / input.sphere.radius)
  const outputValues = [...point, ...normal, t]
  if (outputValues.some((value) => !Number.isFinite(value))) throw new RangeError('pyRT intersection output is not finite')
  return {
    hit: true,
    t,
    point,
    normal,
    tMin: input.tMin,
    tMax: input.tMax,
    assumptions: [
      'The ray is parameterized as origin + t * direction.',
      'The sphere is static, closed, and uses a geometric outward normal.',
      'Only the nearest intersection inside the inclusive [tMin, tMax] bound is returned.',
    ],
    numericalMethod: 'Bounded quadratic ray/sphere intersection using the smaller valid root.',
    licenseCaveat: PYRT_SOURCE_CAVEATS.license,
  }
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-pyrt' || descriptor.title !== 'pyRT') {
    throw new TypeError('pyRT adapter requires the pyRT simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('pyRT adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.length === 0)) {
    throw new TypeError('pyRT descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string'
    || descriptor.adapterId.trim().length === 0 || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('pyRT descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? PYRT_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createPyRtAdapter: PyRtAdapterFactory = (descriptor, signal) => {
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

export const pyRtAdapterFactory = createPyRtAdapter
export const createPYRTAdapter = createPyRtAdapter
