import type {
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

/**
 * Provenance/reference only: awesome-physics-repos/webgl-ripples/waves.js at
 * source revision 88eab79c98e8 and its README describe the two-frame,
 * finite-difference wave model. This module is an original headless kernel;
 * it does not import or redistribute the upstream browser or shader code.
 */

export const WEBGL_RIPPLES_ADAPTER_ID = 'awesome-webgl-ripples-browser-v1'
export const WEBGL_RIPPLES_MODEL = 'webgl-ripples-finite-difference-v1'

const PROTOCOL = 'awesome-physics-adapter-v1' as const
const LOCAL_MAX_GRID_SIZE = 128
const LOCAL_MAX_ITERATIONS = 4096
const LOCAL_MAX_TAPS = 128
const LOCAL_MAX_MEMORY_BYTES = 64 * 1024 * 1024
const LOCAL_MAX_OUTPUT_BYTES = 4 * 1024 * 1024
const MAX_WAVE_SPEED = Math.sqrt(0.5)
const MAX_TAP_AMPLITUDE = 4
const YIELD_INTERVAL = 32

export interface WebglRipplesTapV1 {
  readonly x: number
  readonly y: number
  readonly amplitude: number
  readonly radius?: number
  readonly step?: number
}

export interface WebglRipplesInputV1 {
  readonly gridSize: number
  readonly steps: number
  readonly taps?: readonly WebglRipplesTapV1[]
  readonly sampleEvery?: number
  readonly damping?: number
  readonly waveSpeed?: number
}

export interface WebglRipplesHeightStatisticsV1 {
  readonly min: number
  readonly max: number
  readonly mean: number
  readonly rms: number
  readonly peakAbs: number
  readonly center: number
}

export interface WebglRipplesFrameV1 {
  readonly step: number
  readonly heights: readonly number[]
}

export interface WebglRipplesOutputV1 {
  readonly schemaVersion: 1
  readonly model: typeof WEBGL_RIPPLES_MODEL
  readonly gridSize: number
  readonly steps: number
  readonly sampleEvery: number
  readonly damping: number
  readonly waveSpeed: number
  readonly tapCount: number
  readonly statistics: readonly WebglRipplesHeightStatisticsV1[]
  readonly frames: readonly WebglRipplesFrameV1[]
  readonly finalStatistics: WebglRipplesHeightStatisticsV1
  readonly assumptions: readonly string[]
}

export type WebglRipplesAdapterInput = WebglRipplesInputV1
export type WebglRipplesAdapterOutput = WebglRipplesOutputV1
export type WebglRipplesAdapter = AwesomePhysicsAdapterV1<WebglRipplesInputV1, WebglRipplesOutputV1>
export type WebglRipplesAdapterFactory = AwesomePhysicsAdapterFactoryV1<WebglRipplesInputV1, WebglRipplesOutputV1>

interface NormalizedTap {
  readonly x: number
  readonly y: number
  readonly amplitude: number
  readonly radius: number
  readonly step: number
}

interface ParsedInput {
  readonly gridSize: number
  readonly steps: number
  readonly taps: readonly NormalizedTap[]
  readonly sampleEvery: number
  readonly damping: number
  readonly waveSpeed: number
  readonly maxOutputBytes: number
}

interface AdapterDescriptorData {
  readonly adapterId: string
  readonly contentRevision: string
  readonly modelRevision: string
  readonly implementationRevision: string
  readonly outputRevision: string
}

function fail(path: string, message: string): never {
  throw new TypeError(`${path} ${message}`)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'must be an object')
  return value as Record<string, unknown>
}

function requireAllowedKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const allowedKeys = new Set(allowed)
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key))
  if (unknown.length > 0) fail(path, `has unknown properties: ${unknown.join(', ')}`)
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be finite')
  return value
}

function boundedNumber(value: unknown, path: string, minimum: number, maximum: number): number {
  const number = finiteNumber(value, path)
  if (number < minimum || number > maximum) fail(path, `must be between ${minimum} and ${maximum}`)
  return number
}

function safeInteger(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(path, `must be a safe integer between ${minimum} and ${maximum}`)
  }
  return value
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'must be a non-empty string')
  return value
}

function abortError(): DOMException {
  return new DOMException('The simulation was aborted', 'AbortError')
}

function throwIfAborted(...signals: readonly (AbortSignal | undefined)[]): void {
  if (signals.some((signal) => signal?.aborted)) throw abortError()
}

async function yieldToHost(): Promise<void> {
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
}

function descriptorData(descriptor: AwesomePhysicsSimulationDescriptorV1): AdapterDescriptorData {
  if (descriptor.catalogItemId !== 'awesome-webgl-ripples'
    || descriptor.title !== 'webgl-ripples'
    || descriptor.execution !== 'browser') {
    fail('descriptor', 'must identify the webgl-ripples browser simulation')
  }
  const adapterId = descriptor.adapterId === undefined
    ? WEBGL_RIPPLES_ADAPTER_ID
    : nonEmptyString(descriptor.adapterId, 'descriptor.adapterId')
  if (!/^[A-Za-z0-9_-]+$/.test(adapterId)) fail('descriptor.adapterId', 'must be a safe ID')
  return {
    adapterId,
    contentRevision: nonEmptyString(descriptor.contentRevision, 'descriptor.contentRevision'),
    modelRevision: nonEmptyString(descriptor.modelRevision, 'descriptor.modelRevision'),
    implementationRevision: nonEmptyString(descriptor.implementationRevision, 'descriptor.implementationRevision'),
    outputRevision: nonEmptyString(descriptor.outputRevision, 'descriptor.outputRevision'),
  }
}

function descriptorLimit(descriptor: AwesomePhysicsSimulationDescriptorV1, key: keyof AwesomePhysicsSimulationDescriptorV1['limits']): number {
  const value = descriptor.limits?.[key]
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    fail(`descriptor.limits.${key}`, 'must be a non-negative safe integer')
  }
  return value
}

function parseTap(
  value: unknown,
  index: number,
  gridSize: number,
  steps: number,
): NormalizedTap {
  const path = `input.taps[${index}]`
  const tap = record(value, path)
  requireAllowedKeys(tap, ['x', 'y', 'amplitude', 'radius', 'step'], path)
  const x = boundedNumber(tap.x, `${path}.x`, 0, 1)
  const y = boundedNumber(tap.y, `${path}.y`, 0, 1)
  const amplitude = boundedNumber(tap.amplitude, `${path}.amplitude`, -MAX_TAP_AMPLITUDE, MAX_TAP_AMPLITUDE)
  const radius = tap.radius === undefined
    ? Math.max(0.75, gridSize * 0.05)
    : boundedNumber(tap.radius, `${path}.radius`, 0.25, gridSize)
  const step = tap.step === undefined ? 0 : safeInteger(tap.step, `${path}.step`, 0, steps)
  return { x, y, amplitude, radius, step }
}

function sampleSteps(steps: number, sampleEvery: number): number[] {
  const result = [0]
  for (let step = 1; step <= steps; step += 1) {
    if (step === steps || step % sampleEvery === 0) result.push(step)
  }
  return result
}

function parseInput(value: unknown, descriptor: AwesomePhysicsSimulationDescriptorV1): ParsedInput {
  const input = record(value, 'input')
  requireAllowedKeys(input, ['gridSize', 'steps', 'taps', 'sampleEvery', 'damping', 'waveSpeed'], 'input')

  const maxGridSize = Math.min(LOCAL_MAX_GRID_SIZE, descriptorLimit(descriptor, 'maxGridSize'))
  const maxIterations = Math.min(LOCAL_MAX_ITERATIONS, descriptorLimit(descriptor, 'maxIterations'))
  const maxTapCount = Math.min(LOCAL_MAX_TAPS, descriptorLimit(descriptor, 'maxParticles'))
  const maxMemoryBytes = Math.min(LOCAL_MAX_MEMORY_BYTES, descriptorLimit(descriptor, 'maxMemoryBytes'))
  const maxOutputBytes = Math.min(LOCAL_MAX_OUTPUT_BYTES, descriptorLimit(descriptor, 'maxOutputBytes'))
  const gridSize = safeInteger(input.gridSize, 'input.gridSize', 3, maxGridSize)
  const steps = safeInteger(input.steps, 'input.steps', 0, maxIterations)
  const sampleEvery = input.sampleEvery === undefined
    ? Math.max(1, Math.ceil(Math.max(1, steps) / 32))
    : safeInteger(input.sampleEvery, 'input.sampleEvery', 1, maxIterations || 1)
  const damping = input.damping === undefined ? 0.98 : boundedNumber(input.damping, 'input.damping', 0, 1)
  const waveSpeed = input.waveSpeed === undefined
    ? 0.4
    : boundedNumber(input.waveSpeed, 'input.waveSpeed', 0, MAX_WAVE_SPEED)
  const tapsValue = input.taps === undefined ? [] : input.taps
  if (!Array.isArray(tapsValue)) fail('input.taps', 'must be an array')
  if (tapsValue.length > maxTapCount) fail('input.taps', `must contain at most ${maxTapCount} entries`)
  const taps = tapsValue.map((tap, index) => parseTap(tap, index, gridSize, steps))

  const cells = gridSize * gridSize
  const frames = sampleSteps(steps, sampleEvery).length
  const stateBytes = cells * Float64Array.BYTES_PER_ELEMENT * 3
  const estimatedOutputBytes = 1024 + frames * (cells * 24 + 192)
  const estimatedMemoryBytes = stateBytes + frames * (cells * 24 + 192)
  if (stateBytes > maxMemoryBytes || estimatedMemoryBytes > maxMemoryBytes) {
    fail('input', 'exceeds descriptor maxMemoryBytes')
  }
  if (estimatedOutputBytes > maxOutputBytes) fail('input', 'exceeds descriptor maxOutputBytes')

  return { gridSize, steps, taps, sampleEvery, damping, waveSpeed, maxOutputBytes }
}

function addTap(target: Float64Array, gridSize: number, tap: NormalizedTap, scale: number): void {
  const centerX = tap.x * (gridSize - 1)
  const centerY = tap.y * (gridSize - 1)
  const minX = Math.max(0, Math.floor(centerX - tap.radius))
  const maxX = Math.min(gridSize - 1, Math.ceil(centerX + tap.radius))
  const minY = Math.max(0, Math.floor(centerY - tap.radius))
  const maxY = Math.min(gridSize - 1, Math.ceil(centerY + tap.radius))
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (x === 0 || x === gridSize - 1 || y === 0 || y === gridSize - 1) continue
      const distance = Math.hypot(x - centerX, y - centerY)
      if (distance > tap.radius) continue
      const profile = 0.5 * (1 + Math.cos(Math.PI * distance / tap.radius))
      target[y * gridSize + x] += scale * tap.amplitude * profile
    }
  }
}

function statistics(grid: Float64Array, gridSize: number): WebglRipplesHeightStatisticsV1 {
  let min = Infinity
  let max = -Infinity
  let sum = 0
  let sumSquares = 0
  let peakAbs = 0
  for (const value of grid) {
    if (!Number.isFinite(value)) throw new Error('Wave simulation produced a non-finite height')
    min = Math.min(min, value)
    max = Math.max(max, value)
    sum += value
    sumSquares += value * value
    peakAbs = Math.max(peakAbs, Math.abs(value))
  }
  const cells = grid.length
  const center = Math.floor(gridSize / 2)
  const centerValue = grid[center * gridSize + center] ?? 0
  return {
    min: min === 0 ? 0 : min,
    max: max === 0 ? 0 : max,
    mean: sum / cells,
    rms: Math.sqrt(sumSquares / cells),
    peakAbs,
    center: centerValue === 0 ? 0 : centerValue,
  }
}

function frame(grid: Float64Array, step: number): WebglRipplesFrameV1 {
  const heights = Array.from(grid, (value) => {
    if (!Number.isFinite(value)) throw new Error('Wave simulation produced a non-finite frame value')
    return value === 0 ? 0 : value
  })
  return { step, heights }
}

function assertJsonSafe(output: WebglRipplesOutputV1, maxOutputBytes: number): void {
  const serialized = JSON.stringify(output)
  if (serialized === undefined) throw new Error('Wave simulation output could not be serialized as JSON')
  if (serialized.length > maxOutputBytes) fail('output', `exceeds the output limit of ${maxOutputBytes} bytes`)
}

async function runWave(
  inputValue: unknown,
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  factorySignal: AbortSignal,
  runSignal?: AbortSignal,
): Promise<WebglRipplesOutputV1> {
  throwIfAborted(factorySignal, runSignal)
  const input = parseInput(inputValue, descriptor)
  throwIfAborted(factorySignal, runSignal)

  const cells = input.gridSize * input.gridSize
  let previous = new Float64Array(cells)
  let current = new Float64Array(cells)
  let next = new Float64Array(cells)
  const tapsByStep = new Map<number, NormalizedTap[]>()
  for (const tap of input.taps) {
    const taps = tapsByStep.get(tap.step)
    if (taps) taps.push(tap)
    else tapsByStep.set(tap.step, [tap])
  }
  for (const tap of tapsByStep.get(0) ?? []) {
    addTap(previous, input.gridSize, tap, 0.5)
    addTap(current, input.gridSize, tap, 1)
  }

  const statisticsSamples: WebglRipplesHeightStatisticsV1[] = []
  const frames: WebglRipplesFrameV1[] = []
  const capture = (step: number): void => {
    statisticsSamples.push(statistics(current, input.gridSize))
    frames.push(frame(current, step))
  }
  capture(0)

  const coupling = input.waveSpeed * input.waveSpeed
  for (let step = 1; step <= input.steps; step += 1) {
    throwIfAborted(factorySignal, runSignal)
    next.fill(0)
    for (let y = 1; y < input.gridSize - 1; y += 1) {
      for (let x = 1; x < input.gridSize - 1; x += 1) {
        const index = y * input.gridSize + x
        const laplacian = current[index - 1]! + current[index + 1]!
          + current[index - input.gridSize]! + current[index + input.gridSize]!
          - 4 * current[index]!
        next[index] = input.damping * (
          2 * current[index]! - previous[index]! + coupling * laplacian
        )
      }
    }
    for (const tap of tapsByStep.get(step) ?? []) addTap(next, input.gridSize, tap, 1)
    const oldPrevious = previous
    previous = current
    current = next
    next = oldPrevious
    if (step === input.steps || step % input.sampleEvery === 0) capture(step)
    if (step % YIELD_INTERVAL === 0) await yieldToHost()
    throwIfAborted(factorySignal, runSignal)
  }

  const finalStatistics = statisticsSamples[statisticsSamples.length - 1]
  if (!finalStatistics) throw new Error('Wave simulation produced no final sample')
  const output: WebglRipplesOutputV1 = {
    schemaVersion: 1,
    model: WEBGL_RIPPLES_MODEL,
    gridSize: input.gridSize,
    steps: input.steps,
    sampleEvery: input.sampleEvery,
    damping: input.damping,
    waveSpeed: input.waveSpeed,
    tapCount: input.taps.length,
    statistics: statisticsSamples,
    frames,
    finalStatistics,
    assumptions: [
      'The square grid has fixed zero-height boundary cells.',
      'The wave equation uses an explicit second-order finite-difference update with a stable Courant coefficient.',
      'Taps are deterministic raised-cosine displacement injections; no random splashes or wall-clock timing are used.',
      'This adapter returns numeric state only; rendering remains a separate concern.',
    ],
  }
  assertJsonSafe(output, input.maxOutputBytes)
  return output
}

export const createWebglRipplesAdapter: AwesomePhysicsAdapterFactoryV1<
  WebglRipplesInputV1,
  WebglRipplesOutputV1
> = (descriptor, factorySignal = new AbortController().signal): AwesomePhysicsAdapterV1<WebglRipplesInputV1, WebglRipplesOutputV1> => {
  throwIfAborted(factorySignal)
  const data = descriptorData(descriptor)
  return {
    adapterId: data.adapterId,
    protocol: PROTOCOL,
    compatibility: {
      contentRevision: data.contentRevision,
      modelRevision: data.modelRevision,
      implementationRevision: data.implementationRevision,
      outputRevision: data.outputRevision,
    },
    run: (input, signal) => runWave(input, descriptor, factorySignal, signal),
  }
}

export const webglRipplesAdapterFactory = createWebglRipplesAdapter
export const createWebglRipplesAdapterFactory: WebglRipplesAdapterFactory = createWebglRipplesAdapter
