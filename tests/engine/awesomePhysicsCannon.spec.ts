import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  createCannonJsAdapter,
  type CannonJsAdapterInputV1,
  type CannonJsAdapterOutputV1,
} from '../../src/awesomePhysics/adapters/browser/cannonJs'
import type {
  AwesomePhysicsLimitsV1,
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const sourceDescriptor = simulations.items.find(({ catalogItemId }) => catalogItemId === 'awesome-cannon-js')
if (!sourceDescriptor) throw new Error('Cannon.js descriptor fixture is unavailable')

function descriptorForAdapter(limits: Partial<AwesomePhysicsLimitsV1> = {}): AwesomePhysicsSimulationDescriptorV1 {
  return {
    ...sourceDescriptor,
    adapterId: 'cannon-js-browser',
    limits: { ...sourceDescriptor.limits, ...limits },
  }
}

function adapter(limits: Partial<AwesomePhysicsLimitsV1> = {}) {
  return createCannonJsAdapter(descriptorForAdapter(limits))
}

function expectFiniteOutput(output: CannonJsAdapterOutputV1): void {
  for (const frame of output.frames) {
    expect(Number.isFinite(frame.step)).toBe(true)
    expect(Number.isFinite(frame.time)).toBe(true)
    for (const body of frame.bodies) {
      expect(Number.isFinite(body.radius)).toBe(true)
      expect(Number.isFinite(body.position.x)).toBe(true)
      expect(Number.isFinite(body.position.y)).toBe(true)
      expect(Number.isFinite(body.position.z)).toBe(true)
      expect(Number.isFinite(body.velocity.x)).toBe(true)
      expect(Number.isFinite(body.velocity.y)).toBe(true)
      expect(Number.isFinite(body.velocity.z)).toBe(true)
    }
  }
}

const floorBounceInput: CannonJsAdapterInputV1 = {
  bodies: [{
    id: 'sphere',
    position: { x: 0, y: 1.5, z: 0 },
    velocity: { x: 0, y: -2, z: 0 },
    radius: 1,
    restitution: 1,
  }],
  gravity: { x: 0, y: 0, z: 0 },
  floorY: 0,
  restitution: 1,
  steps: 1,
  dt: 1,
  sampleEvery: 1,
}

describe('Awesome Physics Cannon.js adapter', () => {
  it('returns descriptor-compatible metadata without registering itself', () => {
    const descriptor = descriptorForAdapter()
    const result = createCannonJsAdapter(descriptor)

    expect(result.adapterId).toBe(descriptor.adapterId)
    expect(result.protocol).toBe('awesome-physics-adapter-v1')
    expect(result.compatibility).toEqual({
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    })
    expect(createCannonJsAdapter(sourceDescriptor).adapterId).toBe('cannon-js-browser')
    expect(() => createCannonJsAdapter({ ...descriptor, catalogItemId: 'awesome-matter-js' })).toThrow(/cannon.js/)
  })

  it('applies a floor collision with analytic restitution', () => {
    const output = adapter().run(floorBounceInput) as CannonJsAdapterOutputV1
    const finalBody = output.frames[output.frames.length - 1]!.bodies[0]!

    expect(finalBody.position.y).toBe(1)
    expect(finalBody.velocity.y).toBe(2)
    expect(finalBody.position.x).toBe(0)
  })

  it('exchanges velocity for a basic elastic sphere collision', () => {
    const output = adapter().run({
      bodies: [
        { id: 'left', position: { x: -2, y: 5, z: 0 }, velocity: { x: 1, y: 0, z: 0 }, radius: 1, restitution: 1 },
        { id: 'right', position: { x: 2, y: 5, z: 0 }, velocity: { x: -1, y: 0, z: 0 }, radius: 1, restitution: 1 },
      ],
      gravity: { x: 0, y: 0, z: 0 },
      steps: 1,
      dt: 1.5,
      sampleEvery: 1,
    }) as CannonJsAdapterOutputV1
    const finalBodies = output.frames[output.frames.length - 1]!.bodies

    expect(finalBodies[0]!.velocity.x).toBe(-1)
    expect(finalBodies[1]!.velocity.x).toBe(1)
    expect(finalBodies[0]!.position.x).toBeLessThan(finalBodies[1]!.position.x)
  })

  it('produces deterministic sampled JSON-safe finite frames', () => {
    const input: CannonJsAdapterInputV1 = {
      bodies: [{ id: 'falling', position: { x: 1, y: 4, z: -2 }, radius: 0.5 }],
      gravity: { x: 0, y: -2, z: 0 },
      floorY: 0,
      steps: 6,
      dt: 0.25,
      sampleEvery: 2,
    }
    const first = adapter().run(input) as CannonJsAdapterOutputV1
    const second = adapter().run(input) as CannonJsAdapterOutputV1

    expect(second).toEqual(first)
    expect(first.frames.map(({ step }) => step)).toEqual([0, 2, 4, 6])
    expect(JSON.parse(JSON.stringify(first))).toEqual(first)
    expectFiniteOutput(first)
  })

  it('rejects malformed values, body/step limits, and oversized output', () => {
    const limited = adapter({ maxParticles: 1, maxIterations: 2, maxOutputBytes: 300 })
    expect(() => limited.run({
      ...floorBounceInput,
      bodies: [floorBounceInput.bodies[0]!, { id: 'second', position: { x: 3, y: 2, z: 0 }, radius: 1 }],
    })).toThrow(/bodies.*descriptor limit/)
    expect(() => limited.run({ ...floorBounceInput, steps: 3 })).toThrow(/steps.*descriptor limit/)
    expect(() => adapter().run({ ...floorBounceInput, gravity: { x: 0, y: Number.NaN, z: 0 } })).toThrow(/finite/)
    expect(() => limited.run({ ...floorBounceInput, steps: 0 })).toThrow(/output limit/)
    expect(() => adapter().run({
      ...floorBounceInput,
      bodies: [{ ...floorBounceInput.bodies[0]!, position: { x: 0, y: -1, z: 0 } }],
    })).toThrow(/above the fixed floor/)
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
