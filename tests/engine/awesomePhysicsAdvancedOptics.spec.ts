import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  createOpticspyAdapter,
  createOpticSpyAdapter,
  OPTICSPY_ADAPTER_ID,
  OPTICSPY_SOURCE_CAVEATS,
  type OpticspyInputV1,
} from '../../src/awesomePhysics/adapters/typescript/opticspy'
import {
  createPoppyAdapter,
  createPOPPYAdapter,
  POPPY_ADAPTER_ID,
  POPPY_SOURCE_CAVEATS,
  type PoppyInputV1,
} from '../../src/awesomePhysics/adapters/typescript/poppy'
import {
  createRayoptAdapter,
  createRayOptAdapter,
  RAYOPT_ADAPTER_ID,
  RAYOPT_SOURCE_CAVEATS,
  type RayoptInputV1,
} from '../../src/awesomePhysics/adapters/typescript/rayopt'
import type {
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const adapterIds: Record<string, string> = {
  'awesome-opticspy': OPTICSPY_ADAPTER_ID,
  'awesome-poppy': POPPY_ADAPTER_ID,
  'awesome-rayopt': RAYOPT_ADAPTER_ID,
}

function descriptorFor(catalogItemId: string): AwesomePhysicsSimulationDescriptorV1 {
  const descriptor = simulations.items.find((item) => item.catalogItemId === catalogItemId)
  const adapterId = adapterIds[catalogItemId]
  if (!descriptor || !adapterId) throw new Error(`Missing descriptor for ${catalogItemId}`)
  return { ...descriptor, adapterId }
}

function expectFiniteJson(value: unknown): void {
  const encoded = JSON.stringify(value)
  expect(encoded).not.toBeUndefined()
  expect(encoded).not.toMatch(/NaN|Infinity|undefined/)
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
    if (typeof entry === 'object' && entry !== null) Object.values(entry).forEach(visit)
  }
  visit(value)
}

function expectDescriptorCompatibility(
  adapter: { adapterId: string; protocol: string; compatibility: Record<string, string> },
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  provisionalAdapterId: string,
): void {
  expect(adapter.adapterId).toBe(provisionalAdapterId)
  expect(adapter.protocol).toBe('awesome-physics-adapter-v1')
  expect(adapter.compatibility).toEqual({
    contentRevision: descriptor.contentRevision,
    modelRevision: descriptor.modelRevision,
    implementationRevision: descriptor.implementationRevision,
    outputRevision: descriptor.outputRevision,
  })
}

const opticspyInput: OpticspyInputV1 = {
  elements: [
    { type: 'thinLens', focalLength: 10 },
    { type: 'space', distance: 10 },
  ],
  rays: [
    { height: 1, angle: 0 },
    { height: -1, angle: 0 },
    { height: 0, angle: 0.1 },
  ],
}

const poppyInput: PoppyInputV1 = {
  wavelength: 500e-9,
  propagationDistance: 1,
  aperture: { shape: 'circular', radius: 1e-3 },
  positions: [-1e-4, 0, 1e-4],
}

const rayoptInput: RayoptInputV1 = {
  ray: { origin: [0, -1], direction: [0, 1] },
  initialRefractiveIndex: 1,
  surfaces: [
    { radius: null, apertureRadius: 1, thickness: 1, refractiveIndex: 1.5 },
    { radius: null, apertureRadius: 1, thickness: 0, refractiveIndex: 1 },
  ],
}

describe('Awesome Physics advanced optics TypeScript adapters', () => {
  it('matches descriptors without claiming generated availability and exports stable factories', () => {
    const signal = new AbortController().signal
    const opticspyDescriptor = descriptorFor('awesome-opticspy')
    const poppyDescriptor = descriptorFor('awesome-poppy')
    const rayoptDescriptor = descriptorFor('awesome-rayopt')
    const opticspy = createOpticspyAdapter(opticspyDescriptor, signal)
    const poppy = createPoppyAdapter(poppyDescriptor, signal)
    const rayopt = createRayoptAdapter(rayoptDescriptor, signal)

    expect(opticspyDescriptor.availability).toBe('unavailable')
    expect(poppyDescriptor.availability).toBe('unavailable')
    expect(rayoptDescriptor.availability).toBe('unavailable')
    expectDescriptorCompatibility(opticspy, opticspyDescriptor, OPTICSPY_ADAPTER_ID)
    expectDescriptorCompatibility(poppy, poppyDescriptor, POPPY_ADAPTER_ID)
    expectDescriptorCompatibility(rayopt, rayoptDescriptor, RAYOPT_ADAPTER_ID)
    expect(createOpticSpyAdapter).toBe(createOpticspyAdapter)
    expect(createPOPPYAdapter).toBe(createPoppyAdapter)
    expect(createRayOptAdapter).toBe(createRayoptAdapter)
    expect(OPTICSPY_SOURCE_CAVEATS.data).toContain('glass catalog')
    expect(POPPY_SOURCE_CAVEATS.data).toContain('Astropy')
    expect(RAYOPT_SOURCE_CAVEATS.license).toContain('LGPL')
  })

  it('focuses a paraxial collimated ray at one focal length and preserves ray symmetry', () => {
    const adapter = createOpticspyAdapter(descriptorFor('awesome-opticspy'), new AbortController().signal)
    const output = adapter.run(opticspyInput)

    expect(output.matrix[0][0]).toBeCloseTo(0, 12)
    expect(output.matrix[0][1]).toBeCloseTo(10, 12)
    expect(output.rays[0]?.height).toBeCloseTo(0, 12)
    expect(output.rays[1]?.height).toBeCloseTo(0, 12)
    expect(output.rays[0]?.angle).toBeCloseTo(-output.rays[1]?.angle, 12)
    expect(output.rays[2]?.height).toBeCloseTo(1, 12)
    expectFiniteJson(output)
  })

  it('returns a symmetric Airy slice with a normalized on-axis maximum', () => {
    const adapter = createPoppyAdapter(descriptorFor('awesome-poppy'), new AbortController().signal)
    const output = adapter.run(poppyInput)

    expect(output.field[1]).toEqual({ re: 1, im: 0 })
    expect(output.intensity[1]).toBeCloseTo(1, 12)
    expect(output.intensity[0]).toBeCloseTo(output.intensity[2], 12)
    expect(output.intensity[1]).toBeGreaterThan(output.intensity[0] ?? 0)
    expectFiniteJson(output)
  })

  it('traces a sequential lens stack and reports an aperture miss', () => {
    const adapter = createRayoptAdapter(descriptorFor('awesome-rayopt'), new AbortController().signal)
    const hit = adapter.run(rayoptInput)
    const miss = adapter.run({
      ...rayoptInput,
      ray: { origin: [2, -1], direction: [0, 1] },
    })

    expect(hit.hit).toBe(true)
    expect(hit.missedSurface).toBeNull()
    expect(hit.finalRay?.origin).toEqual([0, 1])
    expect(hit.finalRay?.direction).toEqual([0, 1])
    expect(hit.trace).toHaveLength(2)
    expect(miss.hit).toBe(false)
    expect(miss.missedSurface).toBe(0)
    expect(miss.trace[0]?.reason).toBe('aperture')
    expectFiniteJson(hit)
    expectFiniteJson(miss)
  })

  it('rejects malformed and out-of-domain numeric inputs', () => {
    const signal = new AbortController().signal
    const opticspy = createOpticspyAdapter(descriptorFor('awesome-opticspy'), signal)
    const poppy = createPoppyAdapter(descriptorFor('awesome-poppy'), signal)
    const rayopt = createRayoptAdapter(descriptorFor('awesome-rayopt'), signal)

    expect(() => opticspy.run({
      elements: [{ type: 'thinLens', focalLength: 0 }],
      rays: [{ height: 0, angle: 0 }],
    })).toThrow(/magnitude at least/)
    expect(() => opticspy.run({ ...opticspyInput, extra: true } as unknown as OpticspyInputV1)).toThrow(/unknown properties/)
    expect(() => poppy.run({ ...poppyInput, wavelength: Number.NaN })).toThrow(/finite number/)
    expect(() => poppy.run({ ...poppyInput, aperture: { shape: 'circular', radius: 0 } })).toThrow(/between/)
    expect(() => rayopt.run({ ...rayoptInput, ray: { origin: [0, 0], direction: [0, 0] } })).toThrow(/must not be zero/)
    expect(() => rayopt.run({
      ...rayoptInput,
      surfaces: [{ ...rayoptInput.surfaces[0]!, radius: 0 }, rayoptInput.surfaces[1]!],
    })).toThrow(/must be null or have magnitude/)
  })

  it('is deterministic for repeated bounded runs', () => {
    const signal = new AbortController().signal
    const cases = [
      [createOpticspyAdapter(descriptorFor('awesome-opticspy'), signal), opticspyInput],
      [createPoppyAdapter(descriptorFor('awesome-poppy'), signal), poppyInput],
      [createRayoptAdapter(descriptorFor('awesome-rayopt'), signal), rayoptInput],
    ] as const

    for (const [adapter, input] of cases) {
      expect(JSON.stringify(adapter.run(input))).toBe(JSON.stringify(adapter.run(input)))
    }
  })

  it('checks cancellation at factory and run boundaries', () => {
    const controller = new AbortController()
    controller.abort()
    expect(() => createOpticspyAdapter(descriptorFor('awesome-opticspy'), controller.signal)).toThrow(/aborted/i)
    expect(() => createPoppyAdapter(descriptorFor('awesome-poppy'), controller.signal)).toThrow(/aborted/i)
    expect(() => createRayoptAdapter(descriptorFor('awesome-rayopt'), controller.signal)).toThrow(/aborted/i)

    const adapter = createPoppyAdapter(descriptorFor('awesome-poppy'), new AbortController().signal)
    const runController = new AbortController()
    runController.abort()
    expect(() => adapter.run(poppyInput, runController.signal)).toThrow(/aborted/i)
  })
})
