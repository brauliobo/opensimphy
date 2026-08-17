import { fail, exactKeys, finiteNumber, boundedNumber, record, throwIfAborted, throwIfAnyAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const EM_ADAPTER_ID = 'awesome-em-typescript'
export const EM_KERNEL_REVISION = 'em-resistivity-response-typescript-v1'
export const EM_SOURCE_REVISION = '80f3c71cfa6a'
export const EM_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/geoscixyz/em',
  license: 'The educational em source is CC BY 4.0 with third-party exceptions; descriptor license and provenance review remains required before integration, and this provisional adapter does not change availability.',
  data: 'No SimPEG, NumPy, SciPy, native solver, survey data, or external earth model is bundled.',
  model: 'The response is an independent educational DC resistivity kernel derived from point-source and layered-earth assumptions, not a claim of equivalence to the source notebooks.',
})

export const EM_MAX_LAYERS = 16
export const EM_MAX_OUTPUT_BYTES = 256 * 1024

const MIN_RESISTIVITY = 1e-3
const MAX_RESISTIVITY = 1e9
const MIN_CURRENT = 1e-12
const MAX_CURRENT = 1e6
const MAX_HORIZONTAL_POSITION = 1e6
const MAX_DEPTH = 1e6
const MIN_DISTANCE = 1e-6
const MIN_THICKNESS = 1e-6
const MAX_THICKNESS = 1e6
const MAX_OUTPUT_COMPONENT = 1e25
const QUADRATURE_STEPS = 256
const MAX_TRANSFORM_ARGUMENT = 48

export const EM_BOUNDS = Object.freeze({
  resistivityOhmM: Object.freeze({ min: MIN_RESISTIVITY, max: MAX_RESISTIVITY }),
  currentA: Object.freeze({ minMagnitude: MIN_CURRENT, maxMagnitude: MAX_CURRENT }),
  horizontalPositionM: Object.freeze({ min: -MAX_HORIZONTAL_POSITION, max: MAX_HORIZONTAL_POSITION }),
  depthM: Object.freeze({ min: 0, max: MAX_DEPTH }),
  layers: Object.freeze({ min: 1, max: EM_MAX_LAYERS }),
  minimumDistanceM: MIN_DISTANCE,
  maximumOutputBytes: EM_MAX_OUTPUT_BYTES,
} as const)

export type EmPoint2V1 = readonly [number, number]

export interface EmLayerV1 {
  resistivityOhmM: number
  thicknessM: number | null
}

export interface EmPointSourceInputV1 {
  operation: 'point-source'
  resistivityOhmM: number
  currentA: number
  source: EmPoint2V1
  receiver: EmPoint2V1
}

export interface EmLayeredInputV1 {
  operation: 'layered' | 'layered-resistivity'
  currentA: number
  sourceX: number
  receiverX: number
  layers: readonly EmLayerV1[]
}

export type EmInputV1 = EmPointSourceInputV1 | EmLayeredInputV1

interface EmOutputCommonV1 {
  potentialV: number
  voltageV: number
  apparentResistivityOhmM: number
  distanceM: number
  electricFieldVPerM: EmPoint2V1
  assumptions: readonly string[]
  numericalMethod: string
  doesNotEstablish: string
  integrationStatus: 'provisional-adapter-not-registered'
  licenseCaveat: string
  provenanceCaveat: string
}

export interface EmPointSourceOutputV1 extends EmOutputCommonV1 {
  operation: 'point-source'
  resistivityOhmM: number
  currentA: number
  source: EmPoint2V1
  receiver: EmPoint2V1
}

export interface EmLayeredOutputV1 extends EmOutputCommonV1 {
  operation: 'layered' | 'layered-resistivity'
  currentA: number
  sourceX: number
  receiverX: number
  layers: readonly EmLayerV1[]
  reflectionIntegral: number
}

export type EmOutputV1 = EmPointSourceOutputV1 | EmLayeredOutputV1
export type EmInput = EmInputV1
export type EmOutput = EmOutputV1
export type EmPointSourceInput = EmPointSourceInputV1
export type EmLayeredInput = EmLayeredInputV1
export type EmLayer = EmLayerV1
export type EmPoint2 = EmPoint2V1
export type EmAdapterInputV1 = EmInputV1
export type EmAdapterOutputV1 = EmOutputV1
export type EmAdapter = AwesomePhysicsAdapterV1<EmInputV1, EmOutputV1>
export type EmAdapterFactory = AwesomePhysicsAdapterFactoryV1<EmInputV1, EmOutputV1>

type Point2 = [number, number]

interface ParsedPointSourceInput {
  operation: 'point-source'
  resistivityOhmM: number
  currentA: number
  source: Point2
  receiver: Point2
}

interface ParsedLayeredInput {
  operation: 'layered' | 'layered-resistivity'
  currentA: number
  sourceX: number
  receiverX: number
  layers: EmLayerV1[]
}

type ParsedInput = ParsedPointSourceInput | ParsedLayeredInput
function signedBoundedNumber(value: unknown, path: string, maximum: number): number {
  return boundedNumber(value, path, -maximum, maximum)
}

function current(value: unknown, path: string): number {
  const result = signedBoundedNumber(value, path, MAX_CURRENT)
  if (Math.abs(result) < MIN_CURRENT) fail(path, `must have magnitude at least ${MIN_CURRENT}`)
  return result
}

function point(value: unknown, path: string): Point2 {
  if (!Array.isArray(value) || value.length !== 2) fail(path, 'must be an array of exactly [horizontal position, depth]')
  return [
    signedBoundedNumber(value[0], `${path}[0]`, MAX_HORIZONTAL_POSITION),
    boundedNumber(value[1], `${path}[1]`, 0, MAX_DEPTH),
  ]
}

function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_OUTPUT_COMPONENT) {
    throw new RangeError(`em ${path} is outside the finite output bound`)
  }
  return value === 0 ? 0 : value
}

function outputPoint(value: Point2, path: string): EmPoint2V1 {
  return [
    finiteOutput(value[0], `${path}[0]`),
    finiteOutput(value[1], `${path}[1]`),
  ]
}
function distance(source: Point2, receiver: Point2): number {
  return Math.hypot(receiver[0] - source[0], receiver[1] - source[1])
}

function validateDistance(value: number, path: string): number {
  if (!Number.isFinite(value) || value < MIN_DISTANCE) fail(path, `must be at least ${MIN_DISTANCE}`)
  return value
}

function parseLayers(value: unknown, path: string): EmLayerV1[] {
  if (!Array.isArray(value)) fail(path, 'must be an array')
  if (value.length < EM_BOUNDS.layers.min || value.length > EM_MAX_LAYERS) {
    fail(path, `must contain between ${EM_BOUNDS.layers.min} and ${EM_MAX_LAYERS} layers`)
  }
  return value.map((entry, index) => {
    const layerPath = `${path}[${index}]`
    const layer = record(entry, layerPath)
    exactKeys(layer, ['resistivityOhmM', 'thicknessM'], [], layerPath)
    const resistivityOhmM = boundedNumber(layer.resistivityOhmM, `${layerPath}.resistivityOhmM`, MIN_RESISTIVITY, MAX_RESISTIVITY)
    const isBottom = index === value.length - 1
    if (isBottom) {
      if (layer.thicknessM !== null) fail(`${layerPath}.thicknessM`, 'must be null for the bottom half-space')
      return { resistivityOhmM, thicknessM: null }
    }
    const thicknessM = boundedNumber(layer.thicknessM, `${layerPath}.thicknessM`, MIN_THICKNESS, MAX_THICKNESS)
    return { resistivityOhmM, thicknessM }
  })
}

function parseInput(value: unknown): ParsedInput {
  const object = record(value, 'em input')
  if (typeof object.operation !== 'string') fail('em input.operation', 'must be point-source, layered, or layered-resistivity')
  if (object.operation === 'point-source') {
    exactKeys(object, ['operation', 'resistivityOhmM', 'currentA', 'source', 'receiver'], [], 'em input')
    const source = point(object.source, 'em input.source')
    const receiver = point(object.receiver, 'em input.receiver')
    validateDistance(distance(source, receiver), 'em input.source/receiver distance')
    return {
      operation: 'point-source',
      resistivityOhmM: boundedNumber(object.resistivityOhmM, 'em input.resistivityOhmM', MIN_RESISTIVITY, MAX_RESISTIVITY),
      currentA: current(object.currentA, 'em input.currentA'),
      source,
      receiver,
    }
  }
  if (object.operation !== 'layered' && object.operation !== 'layered-resistivity') {
    fail('em input.operation', 'must be point-source, layered, or layered-resistivity')
  }
  exactKeys(object, ['operation', 'currentA', 'sourceX', 'receiverX', 'layers'], [], 'em input')
  const sourceX = signedBoundedNumber(object.sourceX, 'em input.sourceX', MAX_HORIZONTAL_POSITION)
  const receiverX = signedBoundedNumber(object.receiverX, 'em input.receiverX', MAX_HORIZONTAL_POSITION)
  validateDistance(Math.abs(receiverX - sourceX), 'em input.sourceX/receiverX distance')
  return {
    operation: object.operation,
    currentA: current(object.currentA, 'em input.currentA'),
    sourceX,
    receiverX,
    layers: parseLayers(object.layers, 'em input.layers'),
  }
}

function besselJ0(value: number): number {
  const absolute = Math.abs(value)
  if (absolute < 8) {
    const y = value * value
    const numerator = 57568490574 + y * (-13362590354 + y * (651619640.7 + y * (-11214424.18 + y * (77392.33017 + y * -184.9052456))))
    const denominator = 57568490411 + y * (1029532985 + y * (9494680.718 + y * (59272.64853 + y * (267.8532712 + y))))
    return numerator / denominator
  }
  const z = 8 / absolute
  const y = z * z
  const phase = absolute - 0.785398164
  const factor = Math.sqrt(0.636619772 / absolute)
  const first = 1 + y * (-0.001098628627 + y * (0.00002734510407 + y * (-0.000002073370639 + y * 0.0000002093887211)))
  const second = -0.01562499995 + y * (0.0001430488765 + y * (-0.000006911147651 + y * (0.0000007621095161 - y * 0.0000000934945152)))
  return factor * (Math.cos(phase) * first - z * Math.sin(phase) * second)
}

function reflectionAtWavenumber(wavenumber: number, layers: readonly EmLayerV1[]): number {
  let reflection = 0
  for (let index = layers.length - 2; index >= 0; index -= 1) {
    const layer = layers[index]
    const next = layers[index + 1]
    if (!layer || !next || layer.thicknessM === null) throw new RangeError('em internal layers are malformed')
    const contrast = (next.resistivityOhmM - layer.resistivityOhmM) / (next.resistivityOhmM + layer.resistivityOhmM)
    const attenuation = Math.exp(-2 * wavenumber * layer.thicknessM)
    const denominator = 1 + contrast * reflection
    if (!Number.isFinite(denominator) || denominator === 0) throw new RangeError('em layered reflection recursion is singular')
    reflection = attenuation * (contrast + reflection) / denominator
  }
  return reflection
}

function layeredPotential(
  currentA: number,
  sourceX: number,
  receiverX: number,
  layers: readonly EmLayerV1[],
  ...signals: readonly (AbortSignal | undefined)[]
): { potentialV: number; reflectionIntegral: number } {
  throwIfAnyAborted(signals, 'The em resistivity operation was aborted')
  const separation = validateDistance(Math.abs(receiverX - sourceX), 'em layered separation')
  const top = layers[0]
  if (!top) throw new RangeError('em layered response requires a top layer')
  if (layers.length === 1) {
    const potentialV = (currentA * top.resistivityOhmM) / (2 * Math.PI * separation)
    return { potentialV: finiteOutput(potentialV, 'layered potential'), reflectionIntegral: 0 }
  }

  let reflectionIntegral = 0
  const increment = MAX_TRANSFORM_ARGUMENT / QUADRATURE_STEPS
  for (let index = 0; index < QUADRATURE_STEPS; index += 1) {
    throwIfAnyAborted(signals, 'The em resistivity operation was aborted')
    const transformArgument = (index + 0.5) * increment
    const reflection = reflectionAtWavenumber(transformArgument / separation, layers)
    reflectionIntegral += 2 * reflection * besselJ0(transformArgument)
  }
  reflectionIntegral *= increment
  const homogeneousScale = (currentA * top.resistivityOhmM) / (2 * Math.PI * separation)
  const potentialV = homogeneousScale * (1 + reflectionIntegral)
  return {
    potentialV: finiteOutput(potentialV, 'layered potential'),
    reflectionIntegral: finiteOutput(reflectionIntegral, 'layered reflection integral'),
  }
}

function pointSourceOutput(
  input: ParsedPointSourceInput,
  ...signals: readonly (AbortSignal | undefined)[]
): EmPointSourceOutputV1 {
  throwIfAnyAborted(signals, 'The em resistivity operation was aborted')
  const directX = input.receiver[0] - input.source[0]
  const directZ = input.receiver[1] - input.source[1]
  const imageZ = input.receiver[1] + input.source[1]
  const directDistance = validateDistance(Math.hypot(directX, directZ), 'em point-source distance')
  const imageDistance = validateDistance(Math.hypot(directX, imageZ), 'em point-source image distance')
  const scale = input.currentA * input.resistivityOhmM / (4 * Math.PI)
  const potentialV = scale * (1 / directDistance + 1 / imageDistance)
  const field: Point2 = [
    scale * directX * (1 / directDistance ** 3 + 1 / imageDistance ** 3),
    scale * (directZ / directDistance ** 3 + imageZ / imageDistance ** 3),
  ]
  const apparentResistivityOhmM = (2 * Math.PI * directDistance * potentialV) / input.currentA
  return {
    operation: input.operation,
    resistivityOhmM: input.resistivityOhmM,
    currentA: input.currentA,
    source: outputPoint(input.source, 'source'),
    receiver: outputPoint(input.receiver, 'receiver'),
    potentialV: finiteOutput(potentialV, 'point-source potential'),
    voltageV: finiteOutput(potentialV, 'point-source voltage'),
    apparentResistivityOhmM: finiteOutput(apparentResistivityOhmM, 'point-source apparent resistivity'),
    distanceM: finiteOutput(directDistance, 'point-source distance'),
    electricFieldVPerM: outputPoint(field, 'point-source electric field'),
    assumptions: [
      'The earth is a homogeneous, isotropic, quasi-static half-space with scalar resistivity in ohm metres.',
      'The source is a point current electrode and the surface is represented by an equal-sign image source; source and receiver depths are non-negative.',
      'The two-dimensional display coordinates describe a vertical profile of the three-dimensional point-source response.',
    ],
    numericalMethod: 'Direct image-source evaluation of V = I rho (1/r_direct + 1/r_image) / (4 pi).',
    doesNotEstablish: 'This educational point-source response does not establish a recovered subsurface model, survey fit, or equivalence to the em source.',
    integrationStatus: 'provisional-adapter-not-registered',
    licenseCaveat: EM_SOURCE_CAVEATS.license,
    provenanceCaveat: EM_SOURCE_CAVEATS.model,
  }
}

function layeredOutput(
  input: ParsedLayeredInput,
  ...signals: readonly (AbortSignal | undefined)[]
): EmLayeredOutputV1 {
  throwIfAnyAborted(signals, 'The em resistivity operation was aborted')
  const base = layeredPotential(input.currentA, input.sourceX, input.receiverX, input.layers, ...signals)
  const separation = Math.abs(input.receiverX - input.sourceX)
  const differenceStep = Math.min(separation * 0.25, Math.max(separation * 1e-5, MIN_DISTANCE * 0.1))
  const plus = layeredPotential(input.currentA, input.sourceX, input.sourceX + separation + differenceStep, input.layers, ...signals).potentialV
  const minus = layeredPotential(input.currentA, input.sourceX, input.sourceX + Math.max(MIN_DISTANCE, separation - differenceStep), input.layers, ...signals).potentialV
  const derivative = (plus - minus) / (2 * differenceStep)
  const direction = input.receiverX >= input.sourceX ? 1 : -1
  const field: Point2 = [-direction * derivative, 0]
  const apparentResistivityOhmM = (2 * Math.PI * separation * base.potentialV) / input.currentA
  return {
    operation: input.operation,
    currentA: input.currentA,
    sourceX: input.sourceX,
    receiverX: input.receiverX,
    layers: input.layers.map((layer) => ({ ...layer })),
    potentialV: finiteOutput(base.potentialV, 'layered potential'),
    voltageV: finiteOutput(base.potentialV, 'layered voltage'),
    apparentResistivityOhmM: finiteOutput(apparentResistivityOhmM, 'layered apparent resistivity'),
    distanceM: finiteOutput(separation, 'layered distance'),
    electricFieldVPerM: outputPoint(field, 'layered electric field'),
    reflectionIntegral: finiteOutput(base.reflectionIntegral, 'layered reflection integral'),
    assumptions: [
      'The earth is a horizontally layered, isotropic, quasi-static half-space with positive scalar resistivities.',
      'The source and receiver lie at the surface; the final layer is a semi-infinite half-space and all preceding thicknesses are finite.',
      'The layered response uses a bounded cylindrical-transform reflection expansion with a fixed midpoint quadrature and a direct J0 approximation.',
      'The apparent resistivity is the homogeneous half-space inversion 2 pi r V / I and is not a unique inversion of the layers.',
    ],
    numericalMethod: 'Bounded 256-step midpoint integration of the layered reflection response in transform coordinate lambda r.',
    doesNotEstablish: 'This educational layered response does not establish a full FDEM/TDEM solution, a fitted earth model, or equivalence to SimPEG or the em notebooks.',
    integrationStatus: 'provisional-adapter-not-registered',
    licenseCaveat: EM_SOURCE_CAVEATS.license,
    provenanceCaveat: EM_SOURCE_CAVEATS.model,
  }
}

function solve(input: ParsedInput, ...signals: readonly (AbortSignal | undefined)[]): EmOutputV1 {
  throwIfAnyAborted(signals, 'The em resistivity operation was aborted')
  const output = input.operation === 'point-source'
    ? pointSourceOutput(input, ...signals)
    : layeredOutput(input, ...signals)
  throwIfAnyAborted(signals, 'The em resistivity operation was aborted')
  const serialized = JSON.stringify(output)
  if (serialized === undefined) throw new Error('em output could not be serialized as JSON')
  if (serialized.length > EM_MAX_OUTPUT_BYTES) throw new RangeError(`em output exceeds ${EM_MAX_OUTPUT_BYTES} bytes`)
  return output
}

export function evaluateEmResponse(value: EmInputV1, signal?: AbortSignal): EmOutputV1 {
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
  throwIfAborted(signal, 'The em resistivity operation was aborted')
  if (descriptor.catalogItemId !== 'awesome-em' || descriptor.title !== 'em') {
    throw new TypeError('em adapter requires the em simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('em adapter requires TypeScript execution')
  const adapterId = descriptor.adapterId === undefined ? EM_ADAPTER_ID : descriptorString(descriptor.adapterId, 'em descriptor.adapterId')
  if (!/^[A-Za-z0-9_-]+$/.test(adapterId)) fail('em descriptor.adapterId', 'must be a safe ID')
  return {
    adapterId,
    compatibility: {
      contentRevision: descriptorString(descriptor.contentRevision, 'em descriptor.contentRevision'),
      modelRevision: descriptorString(descriptor.modelRevision, 'em descriptor.modelRevision'),
      implementationRevision: descriptorString(descriptor.implementationRevision, 'em descriptor.implementationRevision'),
      outputRevision: descriptorString(descriptor.outputRevision, 'em descriptor.outputRevision'),
    },
  }
}

export const createEmAdapter: EmAdapterFactory = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      throwIfAnyAborted([signal, runSignal], 'The em resistivity operation was aborted')
      const output = solve(parseInput(input), signal, runSignal)
      throwIfAnyAborted([signal, runSignal], 'The em resistivity operation was aborted')
      return output
    },
  }
}

export const emAdapterFactory = createEmAdapter
export const createEMAdapter = createEmAdapter
