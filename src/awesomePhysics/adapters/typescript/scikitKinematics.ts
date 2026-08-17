import { fail, exactKeys, finiteNumber, boundedNumber, record, throwIfAborted, throwIfAnyAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const SCIKIT_KINEMATICS_ADAPTER_ID = 'awesome-scikit-kinematics-typescript'
export const SCIKIT_KINEMATICS_KERNEL_REVISION = 'scikit-kinematics-quaternion-transform-typescript-v1'
export const SCIKIT_KINEMATICS_SOURCE_REVISION = '3bb9e358fffd'
export const SCIKIT_KINEMATICS_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/thomas-haslwanter/scikit-kinematics',
  license: 'The README states BSD-2-Clause while pyproject.toml states BSD-3-Clause; descriptor license review remains a later gate.',
  data: 'No scikit-kinematics Python runtime, NumPy/SciPy stack, sensor files, or upstream code is bundled.',
})

const MAX_VECTOR_COMPONENT = 1e6
const MAX_QUATERNION_COMPONENT = 1e6
const MAX_TRANSLATION_COMPONENT = 1e6
const MAX_OUTPUT_COMPONENT = 1e9
const QUATERNION_EPSILON = 1e-15
const UNIT_VECTOR_TOLERANCE = 1e-12

export const SCIKIT_KINEMATICS_BOUNDS = Object.freeze({
  vectorComponent: MAX_VECTOR_COMPONENT,
  quaternionComponent: MAX_QUATERNION_COMPONENT,
  translationComponent: MAX_TRANSLATION_COMPONENT,
  outputComponent: MAX_OUTPUT_COMPONENT,
})

export type ScikitKinematicsVector3V1 = readonly [number, number, number]
export type ScikitKinematicsQuaternionInputV1 =
  | readonly [number, number, number]
  | readonly [number, number, number, number]
export type ScikitKinematicsQuaternionV1 = readonly [number, number, number, number]
export type ScikitKinematicsMatrix3V1 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
]
export type ScikitKinematicsMatrix4V1 = readonly [
  readonly [number, number, number, number],
  readonly [number, number, number, number],
  readonly [number, number, number, number],
  readonly [number, number, number, number],
]
export type ScikitKinematicsCoordinateFrameV1 = 'space-fixed' | 'body-fixed'

export interface ScikitKinematicsRotateVectorInputV1 {
  operation: 'rotate-vector'
  vector: ScikitKinematicsVector3V1
  quaternion: ScikitKinematicsQuaternionInputV1
  coordinateFrame?: ScikitKinematicsCoordinateFrameV1
  frame?: ScikitKinematicsCoordinateFrameV1
  coordinateSystem?: 'sf' | 'bf'
}

export interface ScikitKinematicsRigidTransformInputV1 {
  operation: 'rigid-transform'
  vector: ScikitKinematicsVector3V1
  quaternion: ScikitKinematicsQuaternionInputV1
  translation: ScikitKinematicsVector3V1
  coordinateFrame?: ScikitKinematicsCoordinateFrameV1
  frame?: ScikitKinematicsCoordinateFrameV1
  coordinateSystem?: 'sf' | 'bf'
}

export type ScikitKinematicsInputV1 =
  | ScikitKinematicsRotateVectorInputV1
  | ScikitKinematicsRigidTransformInputV1

export interface ScikitKinematicsRotateVectorOutputV1 {
  operation: 'rotate-vector'
  coordinateFrame: ScikitKinematicsCoordinateFrameV1
  quaternion: ScikitKinematicsQuaternionV1
  rotationMatrix: ScikitKinematicsMatrix3V1
  rotatedVector: ScikitKinematicsVector3V1
  units: {
    vector: 'input-units'
    quaternion: '1'
    rotationMatrix: '1'
  }
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export interface ScikitKinematicsRigidTransformOutputV1 {
  operation: 'rigid-transform'
  coordinateFrame: ScikitKinematicsCoordinateFrameV1
  quaternion: ScikitKinematicsQuaternionV1
  rotationMatrix: ScikitKinematicsMatrix3V1
  transformMatrix: ScikitKinematicsMatrix4V1
  transformedVector: ScikitKinematicsVector3V1
  units: {
    vector: 'input-units'
    translation: 'input-units'
    quaternion: '1'
    rotationMatrix: '1'
    transformMatrix: '1'
  }
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export type ScikitKinematicsOutputV1 =
  | ScikitKinematicsRotateVectorOutputV1
  | ScikitKinematicsRigidTransformOutputV1

export type ScikitKinematicsAdapterInputV1 = ScikitKinematicsInputV1
export type ScikitKinematicsAdapterOutputV1 = ScikitKinematicsOutputV1
export type ScikitKinematicsAdapter = AwesomePhysicsAdapterV1<ScikitKinematicsInputV1, ScikitKinematicsOutputV1>
export type ScikitKinematicsAdapterFactory = AwesomePhysicsAdapterFactoryV1<ScikitKinematicsInputV1, ScikitKinematicsOutputV1>

interface ParsedInputBase {
  coordinateFrame: ScikitKinematicsCoordinateFrameV1
  quaternion: ScikitKinematicsQuaternionV1
  vector: ScikitKinematicsVector3V1
}

interface ParsedRotateVectorInput extends ParsedInputBase {
  operation: 'rotate-vector'
}

interface ParsedRigidTransformInput extends ParsedInputBase {
  operation: 'rigid-transform'
  translation: ScikitKinematicsVector3V1
}

type ParsedInput = ParsedRotateVectorInput | ParsedRigidTransformInput
function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_OUTPUT_COMPONENT) {
    throw new RangeError(`${path} is outside the finite output bound`)
  }
  return value
}

function vector3(value: unknown, path: string, limit: number): ScikitKinematicsVector3V1 {
  if (!Array.isArray(value) || value.length !== 3) fail(path, 'must be an array of three finite numbers')
  return [
    boundedNumber(value[0], `${path}[0]`, -limit, limit),
    boundedNumber(value[1], `${path}[1]`, -limit, limit),
    boundedNumber(value[2], `${path}[2]`, -limit, limit),
  ]
}

function quaternion(value: unknown, path: string): ScikitKinematicsQuaternionV1 {
  if (!Array.isArray(value) || (value.length !== 3 && value.length !== 4)) {
    fail(path, 'must be a three-component vector part or four-component quaternion')
  }
  const components = value.map((component, index) => boundedNumber(
    component,
    `${path}[${index}]`,
    -MAX_QUATERNION_COMPONENT,
    MAX_QUATERNION_COMPONENT,
  ))
  let full: [number, number, number, number]
  if (components.length === 3) {
    const vectorLengthSquared = components[0]! ** 2 + components[1]! ** 2 + components[2]! ** 2
    if (!Number.isFinite(vectorLengthSquared) || vectorLengthSquared > 1 + UNIT_VECTOR_TOLERANCE) {
      fail(path, 'vector part must have length no greater than one')
    }
    full = [Math.sqrt(Math.max(0, 1 - vectorLengthSquared)), components[0]!, components[1]!, components[2]!]
  } else {
    full = [components[0]!, components[1]!, components[2]!, components[3]!]
  }
  const length = Math.hypot(full[0], full[1], full[2], full[3])
  if (!Number.isFinite(length) || length <= QUATERNION_EPSILON) fail(path, 'must not be the zero quaternion')
  const normalized: ScikitKinematicsQuaternionV1 = [
    full[0] / length,
    full[1] / length,
    full[2] / length,
    full[3] / length,
  ]
  normalized.forEach((component, index) => finiteOutput(component, `${path}[${index}]`))
  return normalized
}

function coordinateFrame(value: Record<string, unknown>, path: string): ScikitKinematicsCoordinateFrameV1 {
  const supplied = ['coordinateFrame', 'frame', 'coordinateSystem'].filter((key) => Object.hasOwn(value, key))
  if (supplied.length > 1) fail(path, `must use only one coordinate-frame property, found ${supplied.join(', ')}`)
  if (supplied.length === 0) return 'space-fixed'
  const selected = value[supplied[0]!]
  if (selected === 'space-fixed' || selected === 'sf') return 'space-fixed'
  if (selected === 'body-fixed' || selected === 'bf') return 'body-fixed'
  fail(`${path}.${supplied[0]!}`, 'must be space-fixed/body-fixed or sf/bf')
}

function parseInput(value: unknown): ParsedInput {
  const input = record(value, 'scikit-kinematics input')
  if (input.operation === 'rotate-vector') {
    exactKeys(input, ['operation', 'vector', 'quaternion'], ['coordinateFrame', 'frame', 'coordinateSystem'], 'scikit-kinematics input')
    return {
      operation: 'rotate-vector',
      coordinateFrame: coordinateFrame(input, 'scikit-kinematics input'),
      vector: vector3(input.vector, 'scikit-kinematics input.vector', MAX_VECTOR_COMPONENT),
      quaternion: quaternion(input.quaternion, 'scikit-kinematics input.quaternion'),
    }
  }
  if (input.operation === 'rigid-transform') {
    exactKeys(input, ['operation', 'vector', 'quaternion', 'translation'], ['coordinateFrame', 'frame', 'coordinateSystem'], 'scikit-kinematics input')
    return {
      operation: 'rigid-transform',
      coordinateFrame: coordinateFrame(input, 'scikit-kinematics input'),
      vector: vector3(input.vector, 'scikit-kinematics input.vector', MAX_VECTOR_COMPONENT),
      quaternion: quaternion(input.quaternion, 'scikit-kinematics input.quaternion'),
      translation: vector3(input.translation, 'scikit-kinematics input.translation', MAX_TRANSLATION_COMPONENT),
    }
  }
  fail('scikit-kinematics input.operation', 'must be rotate-vector or rigid-transform')
}

function rotationMatrixFromQuaternion(quaternionValue: ScikitKinematicsQuaternionV1): ScikitKinematicsMatrix3V1 {
  const [w, x, y, z] = quaternionValue
  return [
    [
      finiteOutput(w * w + x * x - y * y - z * z, 'rotation matrix'),
      finiteOutput(2 * (x * y - w * z), 'rotation matrix'),
      finiteOutput(2 * (x * z + w * y), 'rotation matrix'),
    ],
    [
      finiteOutput(2 * (x * y + w * z), 'rotation matrix'),
      finiteOutput(w * w - x * x + y * y - z * z, 'rotation matrix'),
      finiteOutput(2 * (y * z - w * x), 'rotation matrix'),
    ],
    [
      finiteOutput(2 * (x * z - w * y), 'rotation matrix'),
      finiteOutput(2 * (y * z + w * x), 'rotation matrix'),
      finiteOutput(w * w - x * x - y * y + z * z, 'rotation matrix'),
    ],
  ]
}

function effectiveRotationMatrix(
  quaternionValue: ScikitKinematicsQuaternionV1,
  frame: ScikitKinematicsCoordinateFrameV1,
): ScikitKinematicsMatrix3V1 {
  const matrix = rotationMatrixFromQuaternion(quaternionValue)
  if (frame === 'space-fixed') return matrix
  return [
    [matrix[0][0], matrix[1][0], matrix[2][0]],
    [matrix[0][1], matrix[1][1], matrix[2][1]],
    [matrix[0][2], matrix[1][2], matrix[2][2]],
  ]
}

function multiplyMatrixVector(matrix: ScikitKinematicsMatrix3V1, vector: ScikitKinematicsVector3V1): ScikitKinematicsVector3V1 {
  return [
    finiteOutput(matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2], 'rotated vector'),
    finiteOutput(matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2], 'rotated vector'),
    finiteOutput(matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2], 'rotated vector'),
  ]
}

function transformMatrix(
  matrix: ScikitKinematicsMatrix3V1,
  translation: ScikitKinematicsVector3V1,
): ScikitKinematicsMatrix4V1 {
  return [
    [matrix[0][0], matrix[0][1], matrix[0][2], translation[0]],
    [matrix[1][0], matrix[1][1], matrix[1][2], translation[1]],
    [matrix[2][0], matrix[2][1], matrix[2][2], translation[2]],
    [0, 0, 0, 1],
  ]
}
function finiteJson<T>(value: T): T {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new Error('scikit-kinematics output could not be serialized as JSON')
  return value
}

export function rotateScikitKinematicsVector(
  vectorValue: ScikitKinematicsVector3V1,
  quaternionValue: ScikitKinematicsQuaternionInputV1,
  frame: ScikitKinematicsCoordinateFrameV1 = 'space-fixed',
): ScikitKinematicsVector3V1 {
  const vector = vector3(vectorValue, 'vector', MAX_VECTOR_COMPONENT)
  const quaternionValueNormalized = quaternion(quaternionValue, 'quaternion')
  if (frame !== 'space-fixed' && frame !== 'body-fixed') fail('coordinateFrame', 'must be space-fixed or body-fixed')
  return multiplyMatrixVector(effectiveRotationMatrix(quaternionValueNormalized, frame), vector)
}

export function applyScikitKinematicsRigidTransform(
  vectorValue: ScikitKinematicsVector3V1,
  quaternionValue: ScikitKinematicsQuaternionInputV1,
  translationValue: ScikitKinematicsVector3V1,
  frame: ScikitKinematicsCoordinateFrameV1 = 'space-fixed',
): ScikitKinematicsVector3V1 {
  const rotated = rotateScikitKinematicsVector(vectorValue, quaternionValue, frame)
  const translation = vector3(translationValue, 'translation', MAX_TRANSLATION_COMPONENT)
  return [
    finiteOutput(rotated[0] + translation[0], 'transformed vector'),
    finiteOutput(rotated[1] + translation[1], 'transformed vector'),
    finiteOutput(rotated[2] + translation[2], 'transformed vector'),
  ]
}

function solve(input: ParsedInput, signal?: AbortSignal): ScikitKinematicsOutputV1 {
  throwIfAborted(signal, 'The scikit-kinematics operation was aborted')
  const matrix = effectiveRotationMatrix(input.quaternion, input.coordinateFrame)
  const rotatedVector = multiplyMatrixVector(matrix, input.vector)
  if (input.operation === 'rotate-vector') {
    return finiteJson({
      operation: input.operation,
      coordinateFrame: input.coordinateFrame,
      quaternion: input.quaternion,
      rotationMatrix: matrix,
      rotatedVector,
      units: { vector: 'input-units', quaternion: '1', rotationMatrix: '1' },
      assumptions: [
        'The quaternion is normalized before conversion to an active right-handed rotation matrix.',
        'Space-fixed applies q x v x q^-1; body-fixed applies the inverse rotation.',
        'Vector components are dimensionless coordinates unless the caller supplies a physical unit convention.',
      ],
      numericalMethod: 'Direct quaternion-to-matrix conversion followed by a bounded 3x3 matrix-vector product.',
      licenseCaveat: SCIKIT_KINEMATICS_SOURCE_CAVEATS.license,
    })
  }
  const transformedVector = [
    finiteOutput(rotatedVector[0] + input.translation[0], 'transformed vector'),
    finiteOutput(rotatedVector[1] + input.translation[1], 'transformed vector'),
    finiteOutput(rotatedVector[2] + input.translation[2], 'transformed vector'),
  ] as ScikitKinematicsVector3V1
  return finiteJson({
    operation: input.operation,
    coordinateFrame: input.coordinateFrame,
    quaternion: input.quaternion,
    rotationMatrix: matrix,
    transformMatrix: transformMatrix(matrix, input.translation),
    transformedVector,
    units: {
      vector: 'input-units',
      translation: 'input-units',
      quaternion: '1',
      rotationMatrix: '1',
      transformMatrix: '1',
    },
    assumptions: [
      'The rigid transform is p_out = R p_in + t with a static translation.',
      'The quaternion is normalized before conversion; body-fixed uses the transpose of the active rotation.',
      'The homogeneous matrix uses row-major display order and a final [0, 0, 0, 1] row.',
    ],
    numericalMethod: 'Direct bounded homogeneous rigid-transform evaluation from a quaternion and translation.',
    licenseCaveat: SCIKIT_KINEMATICS_SOURCE_CAVEATS.license,
  })
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'must be a non-empty string')
  return value
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal, 'The scikit-kinematics operation was aborted')
  if (descriptor.catalogItemId !== 'awesome-scikit-kinematics' || descriptor.title !== 'scikit-kinematics') {
    throw new TypeError('scikit-kinematics adapter requires the scikit-kinematics simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('scikit-kinematics adapter requires TypeScript execution')
  const adapterId = descriptor.adapterId === undefined
    ? SCIKIT_KINEMATICS_ADAPTER_ID
    : nonEmptyString(descriptor.adapterId, 'descriptor.adapterId')
  if (!/^[A-Za-z0-9_-]+$/.test(adapterId)) fail('descriptor.adapterId', 'must be a safe ID')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.trim().length === 0)) {
    throw new TypeError('scikit-kinematics descriptor revisions must be non-empty strings')
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

export function evaluateScikitKinematics(input: ScikitKinematicsInputV1, signal?: AbortSignal): ScikitKinematicsOutputV1 {
  throwIfAborted(signal, 'The scikit-kinematics operation was aborted')
  const output = solve(parseInput(input), signal)
  throwIfAborted(signal, 'The scikit-kinematics operation was aborted')
  return output
}

export const createScikitKinematicsAdapter: ScikitKinematicsAdapterFactory = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      throwIfAnyAborted([signal, runSignal], 'The scikit-kinematics operation was aborted')
      const output = evaluateScikitKinematics(input, runSignal ?? signal)
      throwIfAnyAborted([signal, runSignal], 'The scikit-kinematics operation was aborted')
      return output
    },
  }
}

export const scikitKinematicsAdapterFactory = createScikitKinematicsAdapter
export const createScikitKinematicsAdapterV1 = createScikitKinematicsAdapter
