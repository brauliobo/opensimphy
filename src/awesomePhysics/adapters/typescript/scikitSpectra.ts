import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

/**
 * Independent bounded spectrum utilities inspired by scikit-spectra's
 * spectral-axis workflow. No upstream source, pandas, NumPy, SciPy, or
 * Matplotlib code is imported or redistributed.
 */

export const SCIKIT_SPECTRA_CATALOG_ITEM_ID = 'awesome-scikit-spectra' as const
export const SCIKIT_SPECTRA_ADAPTER_ID = 'awesome-scikit-spectra-typescript' as const
export const SCIKIT_SPECTRA_KERNEL_REVISION = 'scikit-spectra-resample-peak-typescript-v1' as const
export const SCIKIT_SPECTRA_SOURCE_REVISION = 'c451be6d5408' as const
export const SCIKIT_SPECTRA_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/hugadams/scikit-spectra',
  license: 'The scikit-spectra README and LICENSE.txt use discrepant license wording; the descriptor license gate remains review and this adapter does not claim runtime availability.',
  data: 'No scikit-spectra Python runtime, pandas, NumPy, SciPy, Matplotlib, or external spectra are bundled.',
})

export const SCIKIT_SPECTRA_BOUNDS = Object.freeze({
  inputSamples: Object.freeze({ min: 2, max: 256 }),
  outputSamples: Object.freeze({ min: 3, max: 256 }),
  axisAbs: 1e12,
  intensityAbs: 1e12,
  maxOutputAbs: 2e12,
  maxOutputBytes: 4 * 1024 * 1024,
} as const)

export type ScikitSpectraAxisUnitV1 = 'nm' | 'um' | 'eV' | 'cm^-1'
export type ScikitSpectraIntensityUnitV1 = 'a.u.' | 'counts' | 'absorbance'

export interface ScikitSpectraInputV1 {
  readonly axis: readonly number[]
  readonly intensity: readonly number[]
  readonly axisUnit: ScikitSpectraAxisUnitV1
  readonly intensityUnit: ScikitSpectraIntensityUnitV1
  readonly sampleCount: number
}

export interface ScikitSpectraPeakV1 {
  readonly index: number
  readonly axis: number
  readonly intensity: number
  readonly baseline: number
  readonly prominence: number
  readonly halfMaximum: number
  readonly leftHalfMaximumAxis: number | null
  readonly rightHalfMaximumAxis: number | null
  readonly fwhm: number | null
}

export interface ScikitSpectraOutputV1 {
  readonly schemaVersion: 1
  readonly model: 'spectrum-resample-peak-fwhm-v1'
  readonly parameters: {
    readonly axisUnit: ScikitSpectraAxisUnitV1
    readonly intensityUnit: ScikitSpectraIntensityUnitV1
    readonly sampleCount: number
  }
  readonly units: {
    readonly axis: ScikitSpectraAxisUnitV1
    readonly intensity: ScikitSpectraIntensityUnitV1
    readonly fwhm: ScikitSpectraAxisUnitV1
  }
  readonly resampledAxis: readonly number[]
  readonly resampledIntensity: readonly number[]
  readonly peak: ScikitSpectraPeakV1 | null
  readonly fwhm: number | null
  readonly assumptions: readonly string[]
  readonly numericalMethod: string
  readonly licenseCaveat: string
}

export type ScikitSpectraInput = ScikitSpectraInputV1
export type ScikitSpectraOutput = ScikitSpectraOutputV1
export type ScikitSpectraAdapter = AwesomePhysicsAdapterV1<ScikitSpectraInputV1, ScikitSpectraOutputV1>
export type ScikitSpectraAdapterFactory = AwesomePhysicsAdapterFactoryV1<ScikitSpectraInputV1, ScikitSpectraOutputV1>

interface ValidatedSeries {
  readonly axis: number[]
  readonly intensity: number[]
  readonly descending: boolean
}

interface ResampledSpectrum {
  readonly axis: number[]
  readonly intensity: number[]
}

function fail(path: string, message: string): never {
  throw new TypeError(`${path} ${message}`)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'must be a JSON object')
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
  if (result < minimum || result > maximum) throw new RangeError(`${path} must be between ${minimum} and ${maximum}`)
  return result
}

function boundedInteger(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new RangeError(`${path} must be a safe integer`)
  if (value < minimum || value > maximum) throw new RangeError(`${path} must be between ${minimum} and ${maximum}`)
  return value
}

function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > SCIKIT_SPECTRA_BOUNDS.maxOutputAbs) {
    throw new RangeError(`${path} is outside the finite output bound`)
  }
  return value === 0 ? 0 : value
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  if (signal.reason instanceof Error) throw signal.reason
  const error = new Error('The scikit-spectra operation was aborted')
  error.name = 'AbortError'
  throw error
}

function validateSeries(axisValue: unknown, intensityValue: unknown, path: string, signal?: AbortSignal): ValidatedSeries {
  throwIfAborted(signal)
  if (!Array.isArray(axisValue)) fail(`${path}.axis`, 'must be an array')
  if (!Array.isArray(intensityValue)) fail(`${path}.intensity`, 'must be an array')
  if (axisValue.length < SCIKIT_SPECTRA_BOUNDS.inputSamples.min
    || axisValue.length > SCIKIT_SPECTRA_BOUNDS.inputSamples.max) {
    fail(`${path}.axis`, `must contain between ${SCIKIT_SPECTRA_BOUNDS.inputSamples.min} and ${SCIKIT_SPECTRA_BOUNDS.inputSamples.max} samples`)
  }
  if (axisValue.length !== intensityValue.length) fail(path, 'axis and intensity must have equal lengths')
  for (let index = 0; index < axisValue.length; index += 1) {
    if (!Object.hasOwn(axisValue, index)) fail(`${path}.axis[${index}]`, 'must not be sparse')
    if (!Object.hasOwn(intensityValue, index)) fail(`${path}.intensity[${index}]`, 'must not be sparse')
  }

  const axis = axisValue.map((value, index) => boundedNumber(value, `${path}.axis[${index}]`, -SCIKIT_SPECTRA_BOUNDS.axisAbs, SCIKIT_SPECTRA_BOUNDS.axisAbs))
  const intensity = intensityValue.map((value, index) => boundedNumber(value, `${path}.intensity[${index}]`, -SCIKIT_SPECTRA_BOUNDS.intensityAbs, SCIKIT_SPECTRA_BOUNDS.intensityAbs))
  const firstStep = axis[1]! - axis[0]!
  if (firstStep === 0) fail(`${path}.axis`, 'must be strictly monotonic')
  const descending = firstStep < 0
  for (let index = 1; index < axis.length; index += 1) {
    throwIfAborted(signal)
    const previous = axis[index - 1]!
    const current = axis[index]!
    if ((descending && current >= previous) || (!descending && current <= previous)) {
      fail(`${path}.axis`, 'must be strictly monotonic')
    }
  }
  return { axis, intensity, descending }
}

function ascendingSeries(series: ValidatedSeries): { axis: number[]; intensity: number[] } {
  return series.descending
    ? { axis: [...series.axis].reverse(), intensity: [...series.intensity].reverse() }
    : { axis: [...series.axis], intensity: [...series.intensity] }
}

function interpolate(
  axis: readonly number[],
  intensity: readonly number[],
  value: number,
  upper: number,
): number {
  if (value <= axis[0]!) return intensity[0]!
  if (value >= axis[axis.length - 1]!) return intensity[intensity.length - 1]!
  const lower = upper - 1
  const span = axis[upper]! - axis[lower]!
  const fraction = (value - axis[lower]!) / span
  return intensity[lower]! + fraction * (intensity[upper]! - intensity[lower]!)
}

function resampleAscending(
  axis: readonly number[],
  intensity: readonly number[],
  sampleCount: number,
  signal?: AbortSignal,
): ResampledSpectrum {
  const outputAxis: number[] = []
  const outputIntensity: number[] = []
  let upper = 1
  const start = axis[0]!
  const stop = axis[axis.length - 1]!
  for (let index = 0; index < sampleCount; index += 1) {
    throwIfAborted(signal)
    const value = start + ((stop - start) * index) / (sampleCount - 1)
    while (upper < axis.length - 1 && axis[upper]! < value) upper += 1
    outputAxis.push(finiteOutput(value, `resampledAxis[${index}]`))
    outputIntensity.push(finiteOutput(interpolate(axis, intensity, value, upper), `resampledIntensity[${index}]`))
  }
  return { axis: outputAxis, intensity: outputIntensity }
}

export function resampleSpectrum(
  axisValue: readonly number[],
  intensityValue: readonly number[],
  sampleCount: number,
  signal?: AbortSignal,
): { axis: number[]; intensity: number[] } {
  const series = validateSeries(axisValue, intensityValue, 'spectrum', signal)
  const count = boundedInteger(sampleCount, 'sampleCount', SCIKIT_SPECTRA_BOUNDS.outputSamples.min, SCIKIT_SPECTRA_BOUNDS.outputSamples.max)
  const ascending = ascendingSeries(series)
  const result = resampleAscending(ascending.axis, ascending.intensity, count, signal)
  return series.descending
    ? { axis: result.axis.reverse(), intensity: result.intensity.reverse() }
    : result
}

function crossing(axisA: number, intensityA: number, axisB: number, intensityB: number, level: number): number {
  if (intensityA === level) return axisA
  if (intensityB === level) return axisB
  const denominator = intensityB - intensityA
  if (denominator === 0) throw new RangeError('spectrum half-maximum crossing has zero slope')
  return finiteOutput(axisA + ((level - intensityA) * (axisB - axisA)) / denominator, 'half-maximum crossing')
}

function measureAscending(axis: readonly number[], intensity: readonly number[], signal?: AbortSignal): ScikitSpectraPeakV1 | null {
  let peakIndex = 0
  let minimum = intensity[0]!
  for (let index = 0; index < intensity.length; index += 1) {
    throwIfAborted(signal)
    if (intensity[index]! < minimum) minimum = intensity[index]!
    if (intensity[index]! > intensity[peakIndex]!) peakIndex = index
  }
  const peakIntensity = intensity[peakIndex]!
  const prominence = peakIntensity - minimum
  if (!(prominence > 0)) return null
  const halfMaximum = minimum + prominence / 2
  let leftHalfMaximumAxis: number | null = null
  for (let index = peakIndex; index > 0; index -= 1) {
    throwIfAborted(signal)
    const lowerIntensity = intensity[index - 1]!
    const upperIntensity = intensity[index]!
    if (lowerIntensity <= halfMaximum && upperIntensity >= halfMaximum) {
      leftHalfMaximumAxis = crossing(axis[index - 1]!, lowerIntensity, axis[index]!, upperIntensity, halfMaximum)
      break
    }
  }
  let rightHalfMaximumAxis: number | null = null
  for (let index = peakIndex; index < intensity.length - 1; index += 1) {
    throwIfAborted(signal)
    const lowerIntensity = intensity[index]!
    const upperIntensity = intensity[index + 1]!
    if (lowerIntensity >= halfMaximum && upperIntensity <= halfMaximum) {
      rightHalfMaximumAxis = crossing(axis[index]!, lowerIntensity, axis[index + 1]!, upperIntensity, halfMaximum)
      break
    }
  }
  const fwhm = leftHalfMaximumAxis !== null && rightHalfMaximumAxis !== null
    ? finiteOutput(rightHalfMaximumAxis - leftHalfMaximumAxis, 'fwhm')
    : null
  return {
    index: peakIndex,
    axis: finiteOutput(axis[peakIndex]!, 'peak axis'),
    intensity: finiteOutput(peakIntensity, 'peak intensity'),
    baseline: finiteOutput(minimum, 'peak baseline'),
    prominence: finiteOutput(prominence, 'peak prominence'),
    halfMaximum: finiteOutput(halfMaximum, 'half maximum'),
    leftHalfMaximumAxis,
    rightHalfMaximumAxis,
    fwhm,
  }
}

export function calculateSpectrumPeakFwhm(
  axisValue: readonly number[],
  intensityValue: readonly number[],
  signal?: AbortSignal,
): ScikitSpectraPeakV1 | null {
  const series = validateSeries(axisValue, intensityValue, 'spectrum', signal)
  const ascending = ascendingSeries(series)
  const result = measureAscending(ascending.axis, ascending.intensity, signal)
  if (!result || !series.descending) return result
  return { ...result, index: series.axis.length - 1 - result.index }
}

function parseInput(input: unknown): ScikitSpectraInputV1 {
  const object = record(input, 'scikit-spectra input')
  exactKeys(object, ['axis', 'intensity', 'axisUnit', 'intensityUnit', 'sampleCount'], [], 'scikit-spectra input')
  if (object.axisUnit !== 'nm' && object.axisUnit !== 'um' && object.axisUnit !== 'eV' && object.axisUnit !== 'cm^-1') {
    fail('scikit-spectra input.axisUnit', 'must be nm, um, eV, or cm^-1')
  }
  if (object.intensityUnit !== 'a.u.' && object.intensityUnit !== 'counts' && object.intensityUnit !== 'absorbance') {
    fail('scikit-spectra input.intensityUnit', 'must be a.u., counts, or absorbance')
  }
  const sampleCount = boundedInteger(
    object.sampleCount,
    'scikit-spectra input.sampleCount',
    SCIKIT_SPECTRA_BOUNDS.outputSamples.min,
    SCIKIT_SPECTRA_BOUNDS.outputSamples.max,
  )
  validateSeries(object.axis, object.intensity, 'scikit-spectra input')
  return {
    axis: object.axis as number[],
    intensity: object.intensity as number[],
    axisUnit: object.axisUnit,
    intensityUnit: object.intensityUnit,
    sampleCount,
  }
}

function solve(input: ScikitSpectraInputV1, signal?: AbortSignal): ScikitSpectraOutputV1 {
  throwIfAborted(signal)
  const resampled = resampleSpectrum(input.axis, input.intensity, input.sampleCount, signal)
  const peak = calculateSpectrumPeakFwhm(resampled.axis, resampled.intensity, signal)
  const output: ScikitSpectraOutputV1 = {
    schemaVersion: 1,
    model: 'spectrum-resample-peak-fwhm-v1',
    parameters: {
      axisUnit: input.axisUnit,
      intensityUnit: input.intensityUnit,
      sampleCount: input.sampleCount,
    },
    units: {
      axis: input.axisUnit,
      intensity: input.intensityUnit,
      fwhm: input.axisUnit,
    },
    resampledAxis: resampled.axis,
    resampledIntensity: resampled.intensity,
    peak,
    fwhm: peak?.fwhm ?? null,
    assumptions: [
      'The supplied spectral axis is finite and strictly monotonic; its direction is preserved in the resampled output.',
      'Resampling uses linear interpolation onto a uniform axis between the supplied endpoints without unit conversion.',
      'The reported peak is the global maximum of the resampled intensity and the baseline is the minimum sampled intensity.',
      'FWHM uses half of the peak prominence above that baseline and linearly interpolated crossings; missing crossings produce null.',
      'No smoothing, baseline model, deconvolution, uncertainty propagation, or physical line-shape fit is applied.',
    ],
    numericalMethod: 'Deterministic bounded piecewise-linear resampling followed by global-maximum and half-prominence crossing search.',
    licenseCaveat: SCIKIT_SPECTRA_SOURCE_CAVEATS.license,
  }
  const serialized = JSON.stringify(output)
  if (serialized === undefined) throw new Error('scikit-spectra output could not be serialized as JSON')
  if (new TextEncoder().encode(serialized).byteLength > SCIKIT_SPECTRA_BOUNDS.maxOutputBytes) {
    throw new RangeError('scikit-spectra output exceeds the finite byte bound')
  }
  throwIfAborted(signal)
  return output
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== SCIKIT_SPECTRA_CATALOG_ITEM_ID || descriptor.title !== 'scikit-spectra') {
    throw new TypeError('scikit-spectra adapter requires the scikit-spectra simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('scikit-spectra adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.trim().length === 0)) {
    throw new TypeError('scikit-spectra descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined
    && (typeof descriptor.adapterId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('scikit-spectra descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? SCIKIT_SPECTRA_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createScikitSpectraAdapter: ScikitSpectraAdapterFactory = (descriptor, signal) => {
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

export const scikitSpectraAdapterFactory = createScikitSpectraAdapter
