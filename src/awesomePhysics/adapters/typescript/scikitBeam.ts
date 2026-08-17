import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const SCIKIT_BEAM_CATALOG_ITEM_ID = 'awesome-scikit-beam' as const
export const SCIKIT_BEAM_ADAPTER_ID = 'awesome-scikit-beam-typescript' as const
export const SCIKIT_BEAM_KERNEL_REVISION = 'scikit-beam-sphere-form-factor-correlation-typescript-v1' as const
export const SCIKIT_BEAM_SOURCE_REVISION = 'dbe344435f6b' as const
export const SCIKIT_BEAM_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/scikit-beam/scikit-beam',
  license: 'scikit-beam is BSD-3-Clause; this independent kernel does not redistribute scikit-beam, Cython, or scientific I/O.',
  data: 'No scikit-beam Python runtime, SAXS dataset, or detector image is bundled.',
})

export const SCIKIT_BEAM_BOUNDS = Object.freeze({
  radiusNm: Object.freeze({ min: 1e-3, max: 1e3 }),
  qNmInv: Object.freeze({ min: 0, max: 50 }),
  samples: Object.freeze({ min: 3, max: 256 }),
  intensityAbs: 1e12,
  maxOutputAbs: 1e12,
  maxOutputBytes: 4 * 1024 * 1024,
} as const)

export interface ScikitBeamSphereFormFactorInputV1 {
  operation: 'sphere-form-factor'
  radiusNm: number
  qMinNmInv: number
  qMaxNmInv: number
  sampleCount: number
}

export interface ScikitBeamLagCorrelationInputV1 {
  operation: 'lag-correlation'
  intensity: readonly number[]
}

export type ScikitBeamInputV1 = ScikitBeamSphereFormFactorInputV1 | ScikitBeamLagCorrelationInputV1

export interface ScikitBeamSampleV1 {
  qNmInv: number
  formFactor: number
  intensity: number
}

export interface ScikitBeamSphereFormFactorOutputV1 {
  schemaVersion: 1
  operation: 'sphere-form-factor'
  input: ScikitBeamSphereFormFactorInputV1
  samples: readonly ScikitBeamSampleV1[]
  firstMinimumQNmInv: number | null
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
  validatesTheory: false
  doesNotEstablish: string
}

export interface ScikitBeamLagCorrelationOutputV1 {
  schemaVersion: 1
  operation: 'lag-correlation'
  input: ScikitBeamLagCorrelationInputV1
  lags: readonly number[]
  correlation: readonly number[]
  peakLag: number
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
  validatesTheory: false
  doesNotEstablish: string
}

export type ScikitBeamOutputV1 = ScikitBeamSphereFormFactorOutputV1 | ScikitBeamLagCorrelationOutputV1
export type ScikitBeamAdapter = AwesomePhysicsAdapterV1<ScikitBeamInputV1, ScikitBeamOutputV1>
export type ScikitBeamAdapterFactory = AwesomePhysicsAdapterFactoryV1<ScikitBeamInputV1, ScikitBeamOutputV1>

function fail(path: string, message: string): never {
  throw new TypeError(`${path} ${message}`)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'must be a JSON object')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) fail(path, 'must be a plain JSON object')
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], path: string): void {
  const unknown = Object.keys(value).filter((key) => !required.includes(key))
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

function boundedInteger(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) fail(path, 'must be a safe integer')
  if (value < minimum || value > maximum) fail(path, `must be between ${minimum} and ${maximum}`)
  return value
}

function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > SCIKIT_BEAM_BOUNDS.maxOutputAbs) {
    throw new RangeError(`${path} is outside the finite output bound`)
  }
  return value === 0 ? 0 : value
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  if (signal.reason instanceof Error) throw signal.reason
  const error = new Error('The scikit-beam operation was aborted')
  error.name = 'AbortError'
  throw error
}

function sphereFormFactor(qRadius: number): number {
  if (Math.abs(qRadius) < 1e-8) return 1
  const sincTerm = Math.sin(qRadius) - qRadius * Math.cos(qRadius)
  return 3 * sincTerm / (qRadius * qRadius * qRadius)
}

export function parseScikitBeamInput(value: unknown): ScikitBeamInputV1 {
  const input = record(value, 'scikit-beam input')
  if (input.operation === 'sphere-form-factor') {
    exactKeys(input, ['operation', 'radiusNm', 'qMinNmInv', 'qMaxNmInv', 'sampleCount'], 'scikit-beam input')
    const qMinNmInv = boundedNumber(input.qMinNmInv, 'scikit-beam input.qMinNmInv', SCIKIT_BEAM_BOUNDS.qNmInv.min, SCIKIT_BEAM_BOUNDS.qNmInv.max)
    const qMaxNmInv = boundedNumber(input.qMaxNmInv, 'scikit-beam input.qMaxNmInv', SCIKIT_BEAM_BOUNDS.qNmInv.min, SCIKIT_BEAM_BOUNDS.qNmInv.max)
    if (qMaxNmInv <= qMinNmInv) fail('scikit-beam input.qMaxNmInv', 'must be greater than qMinNmInv')
    return {
      operation: 'sphere-form-factor',
      radiusNm: boundedNumber(input.radiusNm, 'scikit-beam input.radiusNm', SCIKIT_BEAM_BOUNDS.radiusNm.min, SCIKIT_BEAM_BOUNDS.radiusNm.max),
      qMinNmInv,
      qMaxNmInv,
      sampleCount: boundedInteger(input.sampleCount, 'scikit-beam input.sampleCount', SCIKIT_BEAM_BOUNDS.samples.min, SCIKIT_BEAM_BOUNDS.samples.max),
    }
  }
  if (input.operation === 'lag-correlation') {
    exactKeys(input, ['operation', 'intensity'], 'scikit-beam input')
    if (!Array.isArray(input.intensity)) fail('scikit-beam input.intensity', 'must be an array')
    if (input.intensity.length < SCIKIT_BEAM_BOUNDS.samples.min || input.intensity.length > SCIKIT_BEAM_BOUNDS.samples.max) {
      fail('scikit-beam input.intensity', `must have between ${SCIKIT_BEAM_BOUNDS.samples.min} and ${SCIKIT_BEAM_BOUNDS.samples.max} samples`)
    }
    const intensity = input.intensity.map((entry, index) => (
      boundedNumber(entry, `scikit-beam input.intensity[${index}]`, -SCIKIT_BEAM_BOUNDS.intensityAbs, SCIKIT_BEAM_BOUNDS.intensityAbs)
    ))
    return { operation: 'lag-correlation', intensity }
  }
  fail('scikit-beam input.operation', 'must be sphere-form-factor or lag-correlation')
}

function solveSphere(input: ScikitBeamSphereFormFactorInputV1, signal?: AbortSignal): ScikitBeamSphereFormFactorOutputV1 {
  throwIfAborted(signal)
  const span = input.qMaxNmInv - input.qMinNmInv
  const samples: ScikitBeamSampleV1[] = []
  let firstMinimumQNmInv: number | null = null
  let previousIntensity: number | null = null
  for (let index = 0; index < input.sampleCount; index += 1) {
    throwIfAborted(signal)
    const qNmInv = input.qMinNmInv + span * (index / (input.sampleCount - 1))
    const formFactor = finiteOutput(sphereFormFactor(qNmInv * input.radiusNm), `samples[${index}].formFactor`)
    const intensity = finiteOutput(formFactor * formFactor, `samples[${index}].intensity`)
    if (firstMinimumQNmInv === null && previousIntensity !== null && intensity > previousIntensity && index >= 2) {
      firstMinimumQNmInv = finiteOutput(input.qMinNmInv + span * ((index - 1) / (input.sampleCount - 1)), 'firstMinimumQNmInv')
    }
    previousIntensity = intensity
    samples.push({ qNmInv: finiteOutput(qNmInv, `samples[${index}].qNmInv`), formFactor, intensity })
  }
  const encoded = JSON.stringify(samples)
  if (encoded.length > SCIKIT_BEAM_BOUNDS.maxOutputBytes) throw new RangeError('scikit-beam output exceeds the byte bound')
  return {
    schemaVersion: 1,
    operation: 'sphere-form-factor',
    input,
    samples,
    firstMinimumQNmInv,
    assumptions: [
      'The scatterer is a uniform sphere of radius R in the Rayleigh-Gans approximation.',
      'F(q) = 3 (sin(qR) - qR cos(qR)) / (qR)³ with I(q) = |F(q)|² and F(0) = 1.',
      'scikit-beam Cython kernels, detector images, and any example dataset are not used.',
    ],
    numericalMethod: 'Closed-form spherical Bessel form factor on a uniform q grid.',
    licenseCaveat: SCIKIT_BEAM_SOURCE_CAVEATS.license,
    validatesTheory: false,
    doesNotEstablish: 'A finite spherical form-factor sample does not establish experimental SAXS agreement or scientific validation of scikit-beam.',
  }
}

function solveCorrelation(input: ScikitBeamLagCorrelationInputV1, signal?: AbortSignal): ScikitBeamLagCorrelationOutputV1 {
  throwIfAborted(signal)
  const values = input.intensity
  const zeroLag = values.reduce((sum, value) => sum + value * value, 0)
  if (zeroLag === 0) fail('scikit-beam input.intensity', 'must not be identically zero')
  const lags: number[] = []
  const correlation: number[] = []
  let peakLag = 0
  let peakValue = -Infinity
  for (let lag = 0; lag < values.length; lag += 1) {
    throwIfAborted(signal)
    let sum = 0
    for (let index = 0; index + lag < values.length; index += 1) {
      const left = values[index]
      const right = values[index + lag]
      if (left === undefined || right === undefined) throw new RangeError('scikit-beam intensity sample is missing')
      sum += left * right
    }
    const value = finiteOutput(sum / zeroLag, `correlation[${lag}]`)
    lags.push(lag)
    correlation.push(value)
    if (value > peakValue) {
      peakValue = value
      peakLag = lag
    }
  }
  return {
    schemaVersion: 1,
    operation: 'lag-correlation',
    input,
    lags,
    correlation,
    peakLag,
    assumptions: [
      'The intensity array is a static 1D sample with no detector geometry.',
      'C(k) is the linear lag product normalized so C(0) = 1.',
      'scikit-beam Cython correlation kernels are not used.',
    ],
    numericalMethod: 'Bounded linear lag correlation of a static intensity array.',
    licenseCaveat: SCIKIT_BEAM_SOURCE_CAVEATS.license,
    validatesTheory: false,
    doesNotEstablish: 'A finite spherical form-factor sample does not establish experimental SAXS agreement or scientific validation of scikit-beam.',
  }
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== SCIKIT_BEAM_CATALOG_ITEM_ID || descriptor.title !== 'scikit-beam') {
    throw new TypeError('scikit-beam adapter requires the scikit-beam simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('scikit-beam adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.trim().length === 0)) {
    throw new TypeError('scikit-beam descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('scikit-beam descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? SCIKIT_BEAM_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createScikitBeamAdapter: ScikitBeamAdapterFactory = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      throwIfAborted(signal)
      throwIfAborted(runSignal)
      const parsed = parseScikitBeamInput(input)
      const output = parsed.operation === 'sphere-form-factor'
        ? solveSphere(parsed, runSignal ?? signal)
        : solveCorrelation(parsed, runSignal ?? signal)
      throwIfAborted(runSignal)
      return output
    },
  }
}

export const scikitBeamAdapterFactory = createScikitBeamAdapter
