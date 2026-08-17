import { fail, record, exactKeys, finiteNumber, boundedNumber, throwIfAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const OPTICSPY_ADAPTER_ID = 'awesome-opticspy-typescript'
export const OPTICSPY_KERNEL_REVISION = 'opticspy-paraxial-matrix-typescript-v1'
export const OPTICSPY_SOURCE_REVISION = 'c047d1a757c6'
export const OPTICSPY_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/Sterncat/opticspy',
  license: 'opticspy catalog metadata identifies MIT; glass-data provenance still requires a separate review gate.',
  data: 'No opticspy runtime, glass catalog, SciPy stack, or external optical data is bundled.',
})
export const OPTICSPY_MAX_ELEMENTS = 64
export const OPTICSPY_MAX_RAYS = 256

const MIN_FOCAL_LENGTH = 1e-9
const MAX_DISTANCE = 1e6
const MAX_COORDINATE = 1e6
const MAX_INPUT_ANGLE = 0.5
const MAX_MATRIX_COMPONENT = 1e15
const MAX_OUTPUT_COMPONENT = 1e25
const MAX_OUTPUT_BYTES = 1_000_000

export interface OpticspySpaceV1 {
  type: 'space'
  distance: number
}

export interface OpticspyThinLensV1 {
  type: 'thinLens'
  focalLength: number
}

export type OpticspyElementV1 = OpticspySpaceV1 | OpticspyThinLensV1

export interface OpticspyRayV1 {
  height: number
  angle: number
}

export type OpticspyMatrixV1 = readonly [
  readonly [number, number],
  readonly [number, number],
]

export interface OpticspyInputV1 {
  elements: readonly OpticspyElementV1[]
  rays: readonly OpticspyRayV1[]
}

export interface OpticspyOutputV1 {
  matrix: OpticspyMatrixV1
  rays: readonly OpticspyRayV1[]
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export type OpticspyInput = OpticspyInputV1
export type OpticspyOutput = OpticspyOutputV1
export type OpticspyElement = OpticspyElementV1
export type OpticspyRay = OpticspyRayV1
export type OpticspyMatrix = OpticspyMatrixV1
export type OpticspyAdapterInputV1 = OpticspyInputV1
export type OpticspyAdapterOutputV1 = OpticspyOutputV1
export type OpticspyAdapter = AwesomePhysicsAdapterV1<OpticspyInputV1, OpticspyOutputV1>
export type OpticspyAdapterFactory = AwesomePhysicsAdapterFactoryV1<OpticspyInputV1, OpticspyOutputV1>

interface ParsedInput {
  elements: OpticspyElementV1[]
  rays: OpticspyRayV1[]
}

type MutableMatrix = [[number, number], [number, number]]

function focalLength(value: unknown, path: string): number {
  const result = boundedNumber(value, path, -MAX_DISTANCE, MAX_DISTANCE)
  if (Math.abs(result) < MIN_FOCAL_LENGTH) fail(path, `must have magnitude at least ${MIN_FOCAL_LENGTH}`)
  return result
}

function parseInput(input: unknown): ParsedInput {
  const object = record(input, 'opticspy input')
  exactKeys(object, ['elements', 'rays'], [], 'opticspy input')
  if (!Array.isArray(object.elements)) fail('opticspy input.elements', 'must be an array')
  if (object.elements.length === 0 || object.elements.length > OPTICSPY_MAX_ELEMENTS) {
    fail('opticspy input.elements', `must contain between 1 and ${OPTICSPY_MAX_ELEMENTS} elements`)
  }
  if (!Array.isArray(object.rays)) fail('opticspy input.rays', 'must be an array')
  if (object.rays.length === 0 || object.rays.length > OPTICSPY_MAX_RAYS) {
    fail('opticspy input.rays', `must contain between 1 and ${OPTICSPY_MAX_RAYS} rays`)
  }

  const elements = object.elements.map((value, index) => {
    const path = `opticspy input.elements[${index}]`
    const element = record(value, path)
    if (element.type === 'space') {
      exactKeys(element, ['type', 'distance'], [], path)
      return { type: 'space' as const, distance: boundedNumber(element.distance, `${path}.distance`, 0, MAX_DISTANCE) }
    }
    if (element.type === 'thinLens') {
      exactKeys(element, ['type', 'focalLength'], [], path)
      return { type: 'thinLens' as const, focalLength: focalLength(element.focalLength, `${path}.focalLength`) }
    }
    fail(`${path}.type`, 'must be space or thinLens')
  })

  const rays = object.rays.map((value, index) => {
    const path = `opticspy input.rays[${index}]`
    const ray = record(value, path)
    exactKeys(ray, ['height', 'angle'], [], path)
    return {
      height: boundedNumber(ray.height, `${path}.height`, -MAX_COORDINATE, MAX_COORDINATE),
      angle: boundedNumber(ray.angle, `${path}.angle`, -MAX_INPUT_ANGLE, MAX_INPUT_ANGLE),
    }
  })
  return { elements, rays }
}

function assertMatrix(matrix: MutableMatrix): void {
  for (const value of matrix.flat()) {
    if (!Number.isFinite(value) || Math.abs(value) > MAX_MATRIX_COMPONENT) {
      throw new RangeError('opticspy matrix component is outside the finite bound')
    }
  }
}

function multiply(left: MutableMatrix, right: MutableMatrix): MutableMatrix {
  const result: MutableMatrix = [
    [
      left[0][0] * right[0][0] + left[0][1] * right[1][0],
      left[0][0] * right[0][1] + left[0][1] * right[1][1],
    ],
    [
      left[1][0] * right[0][0] + left[1][1] * right[1][0],
      left[1][0] * right[0][1] + left[1][1] * right[1][1],
    ],
  ]
  assertMatrix(result)
  return result
}

function elementMatrix(element: OpticspyElementV1): MutableMatrix {
  if (element.type === 'space') return [[1, element.distance], [0, 1]]
  return [[1, 0], [-1 / element.focalLength, 1]]
}

function apply(matrix: MutableMatrix, ray: OpticspyRayV1): OpticspyRayV1 {
  const height = matrix[0][0] * ray.height + matrix[0][1] * ray.angle
  const angle = matrix[1][0] * ray.height + matrix[1][1] * ray.angle
  if (!Number.isFinite(height) || !Number.isFinite(angle)
    || Math.abs(height) > MAX_OUTPUT_COMPONENT || Math.abs(angle) > MAX_OUTPUT_COMPONENT) {
    throw new RangeError('opticspy ray output is outside the finite bound')
  }
  return { height, angle }
}

function checkOutputSize(output: OpticspyOutputV1): OpticspyOutputV1 {
  const serialized = JSON.stringify(output)
  if (serialized === undefined) throw new RangeError('opticspy output is not JSON serializable')
  const bytes = new TextEncoder().encode(serialized).byteLength
  if (bytes > MAX_OUTPUT_BYTES) throw new RangeError('opticspy output exceeds the bounded output size')
  return output
}

function solve(input: ParsedInput, signal?: AbortSignal): OpticspyOutputV1 {
  throwIfAborted(signal)
  let matrix: MutableMatrix = [[1, 0], [0, 1]]
  for (const element of input.elements) {
    throwIfAborted(signal)
    matrix = multiply(elementMatrix(element), matrix)
  }

  const rays: OpticspyRayV1[] = []
  for (const ray of input.rays) {
    throwIfAborted(signal)
    let traced = { ...ray }
    for (const element of input.elements) {
      throwIfAborted(signal)
      traced = apply(elementMatrix(element), traced)
    }
    rays.push(traced)
  }

  return checkOutputSize({
    matrix: [
      [matrix[0][0], matrix[0][1]],
      [matrix[1][0], matrix[1][1]],
    ],
    rays,
    assumptions: [
      'Rays use the paraxial state vector [height, angle] with angle in radians.',
      'A space is a translation matrix and each thinLens is an ideal thin lens in one consistent length unit.',
      'No glass catalog, chromatic dispersion, aperture clipping, or aberration model is inferred.',
    ],
    numericalMethod: 'Sequential multiplication of bounded 2x2 ABCD matrices followed by direct ray-state propagation.',
    licenseCaveat: OPTICSPY_SOURCE_CAVEATS.license,
  })
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-opticspy' || descriptor.title !== 'opticspy') {
    throw new TypeError('opticspy adapter requires the opticspy simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('opticspy adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.length === 0)) {
    throw new TypeError('opticspy descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string'
    || descriptor.adapterId.trim().length === 0 || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('opticspy descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? OPTICSPY_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createOpticspyAdapter: OpticspyAdapterFactory = (descriptor, signal) => {
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

export const opticspyAdapterFactory = createOpticspyAdapter
export const createOpticSpyAdapter = createOpticspyAdapter
