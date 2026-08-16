import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  createMatterJsAdapter,
  type MatterJsAdapterInputV1,
  type MatterJsAdapterOutputV1,
} from '../../src/awesomePhysics/adapters/browser/matterJs'
import type {
  AwesomePhysicsLimitsV1,
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const sourceDescriptor = simulations.items.find(({ catalogItemId }) => catalogItemId === 'awesome-matter-js')
if (!sourceDescriptor) throw new Error('Matter.js descriptor fixture is unavailable')

function descriptorForAdapter(limits: Partial<AwesomePhysicsLimitsV1> = {}): AwesomePhysicsSimulationDescriptorV1 {
  return {
    ...sourceDescriptor,
    adapterId: 'matter-js-browser',
    limits: { ...sourceDescriptor.limits, ...limits },
  }
}

function adapter(limits: Partial<AwesomePhysicsLimitsV1> = {}) {
  return createMatterJsAdapter(descriptorForAdapter(limits))
}

function expectFiniteOutput(output: MatterJsAdapterOutputV1): void {
  for (const frame of output.frames) {
    expect(Number.isFinite(frame.step)).toBe(true)
    expect(Number.isFinite(frame.time)).toBe(true)
    for (const body of frame.bodies) {
      expect(Number.isFinite(body.radius)).toBe(true)
      expect(Number.isFinite(body.position.x)).toBe(true)
      expect(Number.isFinite(body.position.y)).toBe(true)
      expect(Number.isFinite(body.velocity.x)).toBe(true)
      expect(Number.isFinite(body.velocity.y)).toBe(true)
    }
  }
}

const floorBounceInput: MatterJsAdapterInputV1 = {
  bodies: [{
    id: 'ball',
    position: { x: 5, y: 8.5 },
    velocity: { x: 0, y: 2 },
    radius: 1,
    restitution: 1,
  }],
  bounds: { width: 10, height: 10 },
  gravity: { x: 0, y: 0 },
  restitution: 1,
  steps: 1,
  dt: 1,
  sampleEvery: 1,
}

describe('Awesome Physics Matter.js adapter', () => {
  it('returns descriptor-compatible metadata without registering itself', () => {
    const descriptor = descriptorForAdapter()
    const result = createMatterJsAdapter(descriptor)

    expect(result.adapterId).toBe(descriptor.adapterId)
    expect(result.protocol).toBe('awesome-physics-adapter-v1')
    expect(result.compatibility).toEqual({
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    })
    expect(createMatterJsAdapter(sourceDescriptor).adapterId).toBe('matter-js-browser')
    expect(() => createMatterJsAdapter({ ...descriptor, catalogItemId: 'awesome-cannon-js' })).toThrow(/matter-js/)
  })

  it('applies a fixed-boundary collision with analytic restitution', () => {
    const output = adapter().run(floorBounceInput) as MatterJsAdapterOutputV1
    const finalBody = output.frames[output.frames.length - 1]!.bodies[0]!

    expect(finalBody.position.y).toBe(9)
    expect(finalBody.velocity.y).toBe(-2)
    expect(finalBody.position.x).toBe(5)
  })

  it('exchanges velocity for a basic elastic circle collision', () => {
    const output = adapter().run({
      bodies: [
        { id: 'left', position: { x: 2, y: 5 }, velocity: { x: 1, y: 0 }, radius: 1, restitution: 1 },
        { id: 'right', position: { x: 5, y: 5 }, velocity: { x: -1, y: 0 }, radius: 1, restitution: 1 },
      ],
      bounds: { width: 10, height: 10 },
      gravity: { x: 0, y: 0 },
      steps: 1,
      dt: 1.5,
      sampleEvery: 1,
    }) as MatterJsAdapterOutputV1
    const finalBodies = output.frames[output.frames.length - 1]!.bodies

    expect(finalBodies[0]!.velocity.x).toBe(-1)
    expect(finalBodies[1]!.velocity.x).toBe(1)
    expect(finalBodies[0]!.position.x).toBeLessThan(finalBodies[1]!.position.x)
  })

  it('produces deterministic sampled JSON-safe finite frames', () => {
    const input: MatterJsAdapterInputV1 = {
      bodies: [{ id: 'falling', position: { x: 4, y: 2 }, radius: 0.5 }],
      bounds: { width: 12, height: 20 },
      gravity: { x: 0, y: 2 },
      steps: 6,
      dt: 0.25,
      sampleEvery: 2,
    }
    const first = adapter().run(input) as MatterJsAdapterOutputV1
    const second = adapter().run(input) as MatterJsAdapterOutputV1

    expect(second).toEqual(first)
    expect(first.frames.map(({ step }) => step)).toEqual([0, 2, 4, 6])
    expect(JSON.parse(JSON.stringify(first))).toEqual(first)
    expectFiniteOutput(first)
  })

  it('rejects malformed values, body/step limits, and oversized output', () => {
    const limited = adapter({ maxParticles: 1, maxIterations: 2, maxOutputBytes: 100 })
    expect(() => limited.run({
      ...floorBounceInput,
      bodies: [floorBounceInput.bodies[0]!, { id: 'second', position: { x: 7, y: 5 }, radius: 1 }],
    })).toThrow(/bodies.*descriptor limit/)
    expect(() => limited.run({ ...floorBounceInput, steps: 3 })).toThrow(/steps.*descriptor limit/)
    expect(() => adapter().run({ ...floorBounceInput, gravity: { x: Number.NaN, y: 0 } })).toThrow(/finite/)
    expect(() => limited.run({ ...floorBounceInput, steps: 0 })).toThrow(/output limit/)
    expect(() => adapter().run({
      ...floorBounceInput,
      bodies: [{ ...floorBounceInput.bodies[0]!, position: { x: 0, y: 5 } }],
    })).toThrow(/inside the fixed boundary/)
  })

  it('cancels before and during a bounded run when the signal aborts', () => {
    const controller = new AbortController()
    controller.abort()
    expect(() => adapter().run(floorBounceInput, controller.signal)).toThrow(/aborted/)

    let reads = 0
    const signal = {
      get aborted() {
        reads += 1
        return reads > 4
      },
      reason: undefined,
    } as AbortSignal
    expect(() => adapter().run({
      ...floorBounceInput,
      steps: 20,
    }, signal)).toThrow(/aborted/)
  })
})
