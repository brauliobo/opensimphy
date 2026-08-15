import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  createWebglRipplesAdapter,
  WEBGL_RIPPLES_ADAPTER_ID,
  type WebglRipplesInputV1,
  type WebglRipplesOutputV1,
} from '../../src/awesomePhysics/adapters/browser/webglRipples'
import type { AwesomePhysicsSimulationArtifactV1, AwesomePhysicsSimulationDescriptorV1 } from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1

function descriptor(): AwesomePhysicsSimulationDescriptorV1 {
  const source = simulations.items.find(({ catalogItemId }) => catalogItemId === 'awesome-webgl-ripples')
  if (!source) throw new Error('webgl-ripples descriptor fixture is missing')
  return { ...source, adapterId: WEBGL_RIPPLES_ADAPTER_ID }
}

function adapter() {
  return createWebglRipplesAdapter(descriptor(), new AbortController().signal)
}

function finiteJson(value: unknown): void {
  const serialized = JSON.stringify(value)
  expect(serialized).toEqual(expect.any(String))
  expect(JSON.parse(serialized)).toEqual(value)
}

describe('webgl-ripples Awesome Physics adapter', () => {
  it('returns deterministic sampled frames and statistics for identical taps', async () => {
    const input: WebglRipplesInputV1 = {
      gridSize: 9,
      steps: 20,
      sampleEvery: 4,
      damping: 0.98,
      waveSpeed: 0.4,
      taps: [{ x: 0.5, y: 0.5, amplitude: 1, radius: 1, step: 0 }],
    }
    const first = await adapter().run(input) as WebglRipplesOutputV1
    const second = await adapter().run(input) as WebglRipplesOutputV1

    expect(second).toEqual(first)
    expect(first.model).toBe('webgl-ripples-finite-difference-v1')
    expect(first.frames).toHaveLength(6)
    expect(first.statistics).toHaveLength(first.frames.length)
    expect(first.frames.every(({ heights }) => heights.length === 81)).toBe(true)
    finiteJson(first)
  })

  it('keeps zero boundaries, preserves the zero solution, and exposes finite physical statistics', async () => {
    const withTap = await adapter().run({
      gridSize: 9,
      steps: 8,
      sampleEvery: 8,
      taps: [{ x: 0.5, y: 0.5, amplitude: 1, radius: 1 }],
    }) as WebglRipplesOutputV1
    const initialFrame = withTap.frames[0]!
    const center = initialFrame.heights[40]
    expect(center).toBe(1)
    expect(initialFrame.heights[0]).toBe(0)
    expect(initialFrame.heights[8]).toBe(0)
    expect(initialFrame.heights[72]).toBe(0)
    expect(initialFrame.heights[80]).toBe(0)
    for (const sample of withTap.statistics) {
      expect(sample.min).toBeLessThanOrEqual(sample.mean)
      expect(sample.mean).toBeLessThanOrEqual(sample.max)
      expect(sample.rms).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(sample.peakAbs)).toBe(true)
    }

    const zero = await adapter().run({ gridSize: 9, steps: 20, damping: 0.98 }) as WebglRipplesOutputV1
    expect(zero.statistics.every(({ min, max, mean, rms, peakAbs, center: height }) => (
      min === 0 && max === 0 && mean === 0 && rms === 0 && peakAbs === 0 && height === 0
    ))).toBe(true)

    const killed = await adapter().run({
      gridSize: 9,
      steps: 4,
      damping: 0,
      taps: [{ x: 0.5, y: 0.5, amplitude: 1 }],
    }) as WebglRipplesOutputV1
    expect(killed.finalStatistics.peakAbs).toBe(0)
  })

  it('rejects malformed inputs and local or descriptor resource violations', async () => {
    await expect(adapter().run({ gridSize: 8, steps: 2, extra: true } as unknown as WebglRipplesInputV1))
      .rejects.toThrow(/unknown properties: extra/)
    await expect(adapter().run({ gridSize: 8, steps: Number.NaN } as unknown as WebglRipplesInputV1))
      .rejects.toThrow(/input\.steps.*safe integer/)
    await expect(adapter().run({
      gridSize: 8,
      steps: 2,
      taps: [{ x: 1.1, y: 0.5, amplitude: 1 }],
    }))
      .rejects.toThrow(/input\.taps\[0\]\.x/)
    await expect(adapter().run({ gridSize: 129, steps: 1 }))
      .rejects.toThrow(/input\.gridSize/)
  })

  it('cancels before work and while a finite run yields to the host', async () => {
    const before = new AbortController()
    before.abort()
    await expect(adapter().run({ gridSize: 8, steps: 2 }, before.signal))
      .rejects.toMatchObject({ name: 'AbortError' })

    const controller = new AbortController()
    const pending = adapter().run({ gridSize: 24, steps: 4096, sampleEvery: 4096 }, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('returns descriptor-matching protocol and compatibility fields without registry access', () => {
    const source = descriptor()
    const value = createWebglRipplesAdapter(source, new AbortController().signal)
    expect(value.adapterId).toBe(source.adapterId)
    expect(value.protocol).toBe('awesome-physics-adapter-v1')
    expect(value.compatibility).toEqual({
      contentRevision: source.contentRevision,
      modelRevision: source.modelRevision,
      implementationRevision: source.implementationRevision,
      outputRevision: source.outputRevision,
    })
  })
})
