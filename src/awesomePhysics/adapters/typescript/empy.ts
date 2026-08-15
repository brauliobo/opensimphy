import type {
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const EMPY_ADAPTER_ID = 'awesome-empy-typescript'
export const EMPY_KERNEL_REVISION = 'empy-thin-film-typescript-v1'
export const EMPY_SOURCE_REVISION = '3ff20d88bd86'
export const EMPY_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/lbolla/EMpy',
  license: 'EMpy is MIT-licensed; descriptor license integration remains a separate review step.',
  data: 'No EMpy material database, NumPy/SciPy runtime, or external data is bundled.',
})
export const EMPY_MAX_LAYERS = 32

const MIN_WAVELENGTH = 1e-15
const MAX_WAVELENGTH = 1e9
const MAX_THICKNESS = 1e9
const MAX_REFRACTIVE_INDEX_COMPONENT = 100
const MAX_REAL_PHASE = 1e6
const MAX_IMAGINARY_PHASE = 20
const MAX_OUTPUT_COMPONENT = 1e12
const MAX_OUTPUT_VALUE = 1e25

export interface EmpyComplexV1 {
  re: number
  im: number
}

export type EmpyRefractiveIndexV1 = number | EmpyComplexV1

export interface EmpyLayerV1 {
  refractiveIndex: EmpyRefractiveIndexV1
  thickness: number | null
}

export interface EmpyInputV1 {
  wavelength: number
  layers: readonly EmpyLayerV1[]
}

export interface EmpyOutputV1 {
  wavelength: number
  reflection: EmpyComplexV1
  reflectance: number
  transmission: EmpyComplexV1
  transmittance: number
  powerSum: number
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export type EmpyInput = EmpyInputV1
export type EmpyOutput = EmpyOutputV1
export type EmpyLayer = EmpyLayerV1
export type EmpyComplex = EmpyComplexV1
export type EmpyAdapterInputV1 = EmpyInputV1
export type EmpyAdapterOutputV1 = EmpyOutputV1
export type EmpyAdapter = AwesomePhysicsAdapterV1<EmpyInputV1, EmpyOutputV1>
export type EmpyAdapterFactory = AwesomePhysicsAdapterFactoryV1<EmpyInputV1, EmpyOutputV1>

interface Complex extends EmpyComplexV1 {}

type Matrix2 = readonly [
  readonly [Complex, Complex],
  readonly [Complex, Complex],
]

function fail(path: string, message: string): never {
  throw new TypeError(`${path} ${message}`)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'must be an object')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) fail(path, 'must be a plain JSON object')
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], path: string): void {
  const allowed = new Set(required)
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

function complex(value: unknown, path: string): Complex {
  if (typeof value === 'number') {
    const re = boundedNumber(value, path, 0.000001, MAX_REFRACTIVE_INDEX_COMPONENT)
    return { re, im: 0 }
  }
  const object = record(value, path)
  exactKeys(object, ['re', 'im'], path)
  const re = boundedNumber(object.re, `${path}.re`, 0.000001, MAX_REFRACTIVE_INDEX_COMPONENT)
  const im = boundedNumber(object.im, `${path}.im`, -MAX_REFRACTIVE_INDEX_COMPONENT, MAX_REFRACTIVE_INDEX_COMPONENT)
  return { re, im }
}

function add(left: Complex, right: Complex): Complex {
  return { re: left.re + right.re, im: left.im + right.im }
}

function subtract(left: Complex, right: Complex): Complex {
  return { re: left.re - right.re, im: left.im - right.im }
}

function multiply(left: Complex, right: Complex): Complex {
  return {
    re: left.re * right.re - left.im * right.im,
    im: left.re * right.im + left.im * right.re,
  }
}

function divide(left: Complex, right: Complex, path: string): Complex {
  const denominator = right.re * right.re + right.im * right.im
  if (!Number.isFinite(denominator) || denominator <= Number.EPSILON) fail(path, 'must not divide by zero')
  return {
    re: (left.re * right.re + left.im * right.im) / denominator,
    im: (left.im * right.re - left.re * right.im) / denominator,
  }
}

function sine(value: Complex): Complex {
  return {
    re: Math.sin(value.re) * Math.cosh(value.im),
    im: Math.cos(value.re) * Math.sinh(value.im),
  }
}

function cosine(value: Complex): Complex {
  return {
    re: Math.cos(value.re) * Math.cosh(value.im),
    im: -Math.sin(value.re) * Math.sinh(value.im),
  }
}

function scale(value: Complex, factor: number): Complex {
  return { re: value.re * factor, im: value.im * factor }
}

function magnitudeSquared(value: Complex): number {
  const result = value.re * value.re + value.im * value.im
  if (!Number.isFinite(result)) throw new RangeError('EMpy output magnitude is not finite')
  return result
}

function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_OUTPUT_VALUE) throw new RangeError(`${path} is outside the finite output bound`)
  return value
}

function matrixMultiply(left: Matrix2, right: Matrix2): Matrix2 {
  return [
    [
      add(multiply(left[0][0], right[0][0]), multiply(left[0][1], right[1][0])),
      add(multiply(left[0][0], right[0][1]), multiply(left[0][1], right[1][1])),
    ],
    [
      add(multiply(left[1][0], right[0][0]), multiply(left[1][1], right[1][0])),
      add(multiply(left[1][0], right[0][1]), multiply(left[1][1], right[1][1])),
    ],
  ]
}

function identityMatrix(): Matrix2 {
  return [
    [{ re: 1, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: 1, im: 0 }],
  ]
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  if (signal.reason instanceof Error) throw signal.reason
  const error = new Error('The operation was aborted')
  error.name = 'AbortError'
  throw error
}

function parseInput(input: unknown): { wavelength: number; layers: Array<{ refractiveIndex: Complex; thickness: number | null }> } {
  const object = record(input, 'EMpy input')
  exactKeys(object, ['wavelength', 'layers'], 'EMpy input')
  const wavelength = boundedNumber(object.wavelength, 'EMpy input.wavelength', MIN_WAVELENGTH, MAX_WAVELENGTH)
  if (!Array.isArray(object.layers)) fail('EMpy input.layers', 'must be an array')
  if (object.layers.length < 2 || object.layers.length > EMPY_MAX_LAYERS) {
    fail('EMpy input.layers', `must contain between 2 and ${EMPY_MAX_LAYERS} layers`)
  }

  const layers = object.layers.map((value, index) => {
    const path = `EMpy input.layers[${index}]`
    const layer = record(value, path)
    exactKeys(layer, ['refractiveIndex', 'thickness'], path)
    const refractiveIndex = complex(layer.refractiveIndex, `${path}.refractiveIndex`)
    const isBoundary = index === 0 || index === object.layers.length - 1
    if (isBoundary) {
      if (layer.thickness !== null && layer.thickness !== 0) fail(`${path}.thickness`, 'must be null or zero for a boundary medium')
      return { refractiveIndex, thickness: null }
    }
    const thickness = boundedNumber(layer.thickness, `${path}.thickness`, 0, MAX_THICKNESS)
    const phaseScale = (2 * Math.PI * thickness) / wavelength
    const phase = multiply(refractiveIndex, { re: phaseScale, im: 0 })
    if (Math.abs(phase.re) > MAX_REAL_PHASE || Math.abs(phase.im) > MAX_IMAGINARY_PHASE) {
      fail(`${path}.thickness`, 'produces an unbounded optical phase')
    }
    return { refractiveIndex, thickness }
  })
  return { wavelength, layers }
}

function solve(input: { wavelength: number; layers: Array<{ refractiveIndex: Complex; thickness: number | null }> }, signal?: AbortSignal): EmpyOutputV1 {
  throwIfAborted(signal)
  const [first, ...remaining] = input.layers
  const last = remaining[remaining.length - 1]
  if (!first || !last) throw new RangeError('EMpy requires incident and substrate media')

  let matrix = identityMatrix()
  for (let index = 1; index < input.layers.length - 1; index += 1) {
    throwIfAborted(signal)
    const layer = input.layers[index]
    if (!layer || layer.thickness === null) throw new RangeError('EMpy internal layers require finite thickness')
    const phaseScale = (2 * Math.PI * layer.thickness) / input.wavelength
    const phase = multiply(layer.refractiveIndex, { re: phaseScale, im: 0 })
    const sin = sine(phase)
    const cos = cosine(phase)
    const q = layer.refractiveIndex
    const imaginary = { re: 0, im: 1 }
    matrix = matrixMultiply(matrix, [
      [cos, multiply(divide(imaginary, q, 'EMpy layer admittance'), sin)],
      [multiply(multiply(imaginary, q), sin), cos],
    ])
  }

  const q0 = first.refractiveIndex
  const qs = last.refractiveIndex
  const load = add(matrix[1][0], multiply(matrix[1][1], qs))
  const numerator = subtract(multiply(q0, add(matrix[0][0], multiply(matrix[0][1], qs))), load)
  const denominator = add(multiply(q0, add(matrix[0][0], multiply(matrix[0][1], qs))), load)
  const reflection = divide(numerator, denominator, 'EMpy transfer matrix denominator')
  const transmission = divide(scale(q0, 2), denominator, 'EMpy transfer matrix denominator')
  for (const [path, value] of [['reflection', reflection], ['transmission', transmission]] as const) {
    if (!Number.isFinite(value.re) || !Number.isFinite(value.im)
      || Math.abs(value.re) > MAX_OUTPUT_COMPONENT || Math.abs(value.im) > MAX_OUTPUT_COMPONENT) {
      throw new RangeError(`EMpy ${path} output is outside the finite bound`)
    }
  }
  const reflectance = finiteOutput(magnitudeSquared(reflection), 'EMpy reflectance')
  const transmittanceFactor = divide(qs, q0, 'EMpy incident index')
  const transmittance = finiteOutput(transmittanceFactor.re * magnitudeSquared(transmission), 'EMpy transmittance')
  const powerSum = finiteOutput(reflectance + transmittance, 'EMpy power sum')
  return {
    wavelength: input.wavelength,
    reflection,
    reflectance,
    transmission,
    transmittance,
    powerSum,
    assumptions: [
      'Normal incidence on isotropic, planar media.',
      'The first and last layers are semi-infinite media; internal layers use the supplied thickness.',
      'All values use one consistent length unit and complex refractive indices use the exp(i k z) convention.',
    ],
    numericalMethod: 'Independent 2x2 characteristic-matrix multiplication for each finite film.',
    licenseCaveat: EMPY_SOURCE_CAVEATS.license,
  }
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-empy' || descriptor.title !== 'EMpy') {
    throw new TypeError('EMpy adapter requires the EMpy simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('EMpy adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.length === 0)) {
    throw new TypeError('EMpy descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string'
    || descriptor.adapterId.trim().length === 0 || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('EMpy descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? EMPY_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createEmpyAdapter: EmpyAdapterFactory = (descriptor, signal) => {
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

export const empyAdapterFactory = createEmpyAdapter
export const createEMpyAdapter = createEmpyAdapter
