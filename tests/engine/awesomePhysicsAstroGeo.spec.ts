import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import type { AwesomePhysicsSimulationArtifactV1, AwesomePhysicsSimulationDescriptorV1 } from '../../src/types/awesomePhysics'
import {
  createGalaAdapter,
  evaluateGalaOrbit,
  galaAdapterFactory,
  GALA_ADAPTER_ID,
  GALA_MAX_BODIES,
  GALA_MAX_STEPS,
  GALA_SOURCE_CAVEATS,
  type GalaInputV1,
} from '../../src/awesomePhysics/adapters/typescript/gala'
import {
  createEmAdapter,
  createEMAdapter,
  emAdapterFactory,
  EM_ADAPTER_ID,
  EM_MAX_LAYERS,
  EM_SOURCE_CAVEATS,
  type EmInputV1,
} from '../../src/awesomePhysics/adapters/typescript/em'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1

function descriptorFor(catalogItemId: 'awesome-gala' | 'awesome-em'): AwesomePhysicsSimulationDescriptorV1 {
  const descriptor = simulations.items.find((item) => item.catalogItemId === catalogItemId)
  if (!descriptor) throw new Error(`Missing descriptor for ${catalogItemId}`)
  return {
    ...descriptor,
    adapterId: catalogItemId === 'awesome-gala' ? GALA_ADAPTER_ID : EM_ADAPTER_ID,
  }
}

function expectCompatibility(
  adapter: { adapterId: string; protocol: string; compatibility: Record<string, string> },
  descriptor: AwesomePhysicsSimulationDescriptorV1,
): void {
  expect(adapter.adapterId).toBe(descriptor.adapterId)
  expect(adapter.protocol).toBe('awesome-physics-adapter-v1')
  expect(adapter.compatibility).toEqual({
    contentRevision: descriptor.contentRevision,
    modelRevision: descriptor.modelRevision,
    implementationRevision: descriptor.implementationRevision,
    outputRevision: descriptor.outputRevision,
  })
}

function expectFiniteJson(value: unknown): void {
  const serialized = JSON.stringify(value)
  expect(serialized).not.toBeUndefined()
  const visit = (entry: unknown): void => {
    if (typeof entry === 'number') {
      expect(Number.isFinite(entry)).toBe(true)
      expect(Math.abs(entry)).toBeLessThanOrEqual(1e25)
      return
    }
    if (Array.isArray(entry)) {
      entry.forEach(visit)
      return
    }
    if (entry !== null && typeof entry === 'object') Object.values(entry).forEach(visit)
  }
  visit(value)
}

const circularOrbit: GalaInputV1 = {
  bodies: [
    { mass: 0.5, position: [-0.5, 0, 0], velocity: [0, -0.5, 0] },
    { mass: 0.5, position: [0.5, 0, 0], velocity: [0, 0.5, 0] },
  ],
  timeStep: 0.002,
  steps: 1_000,
  sampleEvery: 100,
}

describe('Awesome Physics astronomy and geophysics TypeScript adapters', () => {
  it('matches generated availability gates and stable factories', () => {
    const galaDescriptor = descriptorFor('awesome-gala')
    const emDescriptor = descriptorFor('awesome-em')
    const gala = createGalaAdapter(galaDescriptor, new AbortController().signal)
    const em = createEmAdapter(emDescriptor, new AbortController().signal)

    expectCompatibility(gala, galaDescriptor)
    expectCompatibility(em, emDescriptor)
    expect(galaDescriptor.availability).toBe('available')
    expect(galaDescriptor.runnable).toBe(true)
    expect(galaDescriptor.adapterId).toBe(GALA_ADAPTER_ID)
    expect(emDescriptor.availability).toBe('unavailable')
    expect(emDescriptor.runnable).toBe(false)
    expect(galaAdapterFactory).toBe(createGalaAdapter)
    expect(emAdapterFactory).toBe(createEmAdapter)
    expect(createEMAdapter).toBe(createEmAdapter)
    expect(GALA_SOURCE_CAVEATS.license).toContain('does not change availability')
    expect(EM_SOURCE_CAVEATS.license).toContain('third-party exceptions')
  })

  it('keeps a normalized two-body orbit finite while conserving its invariants', () => {
    const result = evaluateGalaOrbit(circularOrbit)
    const initial = result.samples[0]!
    const final = result.samples.at(-1)!

    expect(result.model).toBe('gala-orbit-v1')
    expect(result.integrator).toBe('velocity-verlet')
    expect(result.samples).toHaveLength(11)
    expect(final.bodies).toHaveLength(2)
    expect(final.invariants.centerOfMass).toEqual([0, 0, 0])
    expect(final.invariants.linearMomentum).toEqual([0, 0, 0])
    expect(final.invariants.totalEnergy).toBeCloseTo(initial.invariants.totalEnergy, 10)
    expect(Math.hypot(final.bodies[0]!.position[0], final.bodies[0]!.position[1])).toBeCloseTo(0.5, 5)
    expect(Math.hypot(final.bodies[1]!.position[0], final.bodies[1]!.position[1])).toBeCloseTo(0.5, 5)
    expect(result.invariantDrift.energyRelative).toBeLessThan(1e-8)
    expect(result.invariantDrift.centerOfMassDisplacement).toBe(0)
    expectFiniteJson(result)
  })

  it('steps a bounded three-body state and preserves deterministic serialization', () => {
    const input: GalaInputV1 = {
      bodies: [
        { mass: 1, position: [0, 0, 0], velocity: [0, 0.2, 0] },
        { mass: 1, position: [2, 0, 0], velocity: [0, -0.1, 0] },
        { mass: 0.5, position: [0, 2, 0], velocity: [-0.1, 0, 0] },
      ],
      timeStep: 0.001,
      steps: 120,
      sampleEvery: 20,
    }
    const first = evaluateGalaOrbit(input)
    const second = evaluateGalaOrbit(JSON.parse(JSON.stringify(input)) as GalaInputV1)

    expect(second).toEqual(first)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
    expect(first.samples.every((sample) => sample.bodies.length === 3)).toBe(true)
    expectFiniteJson(first)
  })

  it('computes symmetric point-source and layered resistivity responses', () => {
    const em = createEmAdapter(descriptorFor('awesome-em'), new AbortController().signal)
    const pointInput: EmInputV1 = {
      operation: 'point-source',
      resistivityOhmM: 100,
      currentA: 2,
      source: [-1, 0],
      receiver: [1, 0],
    }
    const point = em.run(pointInput)
    const swapped = em.run({ ...pointInput, source: pointInput.receiver, receiver: pointInput.source })
    expect(point.potentialV).toBeCloseTo(50 / Math.PI, 12)
    expect(point.apparentResistivityOhmM).toBeCloseTo(100, 12)
    expect(swapped.potentialV).toBe(point.potentialV)
    expect(swapped.apparentResistivityOhmM).toBe(point.apparentResistivityOhmM)

    const layeredInput: EmInputV1 = {
      operation: 'layered',
      currentA: 1,
      sourceX: -20,
      receiverX: 20,
      layers: [
        { resistivityOhmM: 100, thicknessM: 10 },
        { resistivityOhmM: 20, thicknessM: null },
      ],
    }
    const layered = em.run(layeredInput)
    const mirrored = em.run({ ...layeredInput, sourceX: 20, receiverX: -20 })
    expect(layered.potentialV).toBe(mirrored.potentialV)
    expect(layered.apparentResistivityOhmM).toBe(mirrored.apparentResistivityOhmM)
    expect(layered.distanceM).toBe(40)
    expect(layered.assumptions.join(' ')).toContain('layered')
    expectFiniteJson(point)
    expectFiniteJson(layered)
  })

  it('matches the homogeneous layered limit and remains deterministic', () => {
    const em = createEmAdapter(descriptorFor('awesome-em'), new AbortController().signal)
    const input: EmInputV1 = {
      operation: 'layered-resistivity',
      currentA: 3,
      sourceX: 0,
      receiverX: 12,
      layers: [{ resistivityOhmM: 75, thicknessM: null }],
    }
    const first = em.run(input)
    const second = em.run(input)
    expect(second).toEqual(first)
    expect(first.potentialV).toBeCloseTo(3 * 75 / (2 * Math.PI * 12), 12)
    expect(first.apparentResistivityOhmM).toBeCloseTo(75, 12)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })

  it('rejects malformed, singular, unstable, and over-bounded inputs', () => {
    const gala = createGalaAdapter(descriptorFor('awesome-gala'), new AbortController().signal)
    const em = createEmAdapter(descriptorFor('awesome-em'), new AbortController().signal)

    expect(() => gala.run({ ...circularOrbit, steps: GALA_MAX_STEPS + 1 })).toThrow(/steps/)
    expect(() => gala.run({ ...circularOrbit, bodies: [] })).toThrow(/bodies/)
    expect(() => gala.run({ ...circularOrbit, timeStep: 1, steps: 1 })).toThrow(/timeStep/)
    expect(() => gala.run({ ...circularOrbit, sampleEvery: 1 })).toThrow(/samples|output/)
    expect(() => gala.run({ ...circularOrbit, bodies: Array.from({ length: GALA_MAX_BODIES + 1 }, (_, index) => ({
      mass: 1,
      position: [index * 2, 0, 0] as [number, number, number],
      velocity: [0, 0, 0] as [number, number, number],
    })) })).toThrow(/bodies/)
    expect(() => gala.run({ ...circularOrbit, unexpected: true } as GalaInputV1 & { unexpected: boolean })).toThrow(/unknown properties/)
    expect(() => gala.run({ ...circularOrbit, bodies: [
      { mass: 1, position: [0, 0, 0], velocity: [0, 0, 0] },
      { mass: 1, position: [0, 0, 0], velocity: [0, 0, 0] },
    ] })).toThrow(/closer|separation/)

    expect(() => em.run({ ...({ operation: 'point-source', resistivityOhmM: 100, currentA: 1, source: [0, 0], receiver: [1, 0], extra: true } as never) })).toThrow(/unknown properties/)
    expect(() => em.run({ operation: 'point-source', resistivityOhmM: 0, currentA: 1, source: [0, 0], receiver: [1, 0] })).toThrow(/resistivity/)
    expect(() => em.run({ operation: 'point-source', resistivityOhmM: 100, currentA: 0, source: [0, 0], receiver: [1, 0] })).toThrow(/magnitude/)
    expect(() => em.run({ operation: 'point-source', resistivityOhmM: 100, currentA: 1, source: [0, 0], receiver: [0, 0] })).toThrow(/distance/)
    expect(() => em.run({ operation: 'layered', currentA: 1, sourceX: 0, receiverX: 1, layers: [{ resistivityOhmM: 100, thicknessM: 1 }] })).toThrow(/bottom/)
    expect(() => em.run({ operation: 'layered', currentA: 1, sourceX: 0, receiverX: 1, layers: Array.from({ length: EM_MAX_LAYERS + 1 }, () => ({ resistivityOhmM: 100, thicknessM: null })) })).toThrow(/layers/)
    expect(() => em.run({ operation: 'layered', currentA: 1, sourceX: 0, receiverX: 0, layers: [{ resistivityOhmM: 100, thicknessM: null }] })).toThrow(/distance/)
    expect(() => em.run({ operation: 'invalid', currentA: 1 } as never)).toThrow(/operation/)
  })

  it('checks factory and run cancellation for both kernels', () => {
    const factoryController = new AbortController()
    factoryController.abort()
    expect(() => createGalaAdapter(descriptorFor('awesome-gala'), factoryController.signal)).toThrow(/aborted/i)
    expect(() => createEmAdapter(descriptorFor('awesome-em'), factoryController.signal)).toThrow(/aborted/i)

    const gala = createGalaAdapter(descriptorFor('awesome-gala'), new AbortController().signal)
    const em = createEmAdapter(descriptorFor('awesome-em'), new AbortController().signal)
    const runController = new AbortController()
    runController.abort()
    expect(() => gala.run(circularOrbit, runController.signal)).toThrow(/aborted/i)
    expect(() => em.run({
      operation: 'point-source',
      resistivityOhmM: 100,
      currentA: 1,
      source: [0, 0],
      receiver: [1, 0],
    }, runController.signal)).toThrow(/aborted/i)
  })
})
