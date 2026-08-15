import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import type {
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'
import {
  createEMpyAdapter,
  createEmpyAdapter,
  EMPY_ADAPTER_ID,
  EMPY_SOURCE_CAVEATS,
  type EmpyInputV1,
} from '../../src/awesomePhysics/adapters/typescript/empy'
import {
  createLightPipesAdapter,
  createLightpipesAdapter,
  LIGHTPIPES_ADAPTER_ID,
  LIGHTPIPES_SOURCE_CAVEATS,
  type LightpipesInputV1,
} from '../../src/awesomePhysics/adapters/typescript/lightpipes'
import {
  createPYRTAdapter,
  createPyRtAdapter,
  PYRT_ADAPTER_ID,
  PYRT_SOURCE_CAVEATS,
  type PyRtInputV1,
} from '../../src/awesomePhysics/adapters/typescript/pyRt'
import {
  createScikitRFAdapter,
  createScikitRfAdapter,
  SCIKIT_RF_ADAPTER_ID,
  SCIKIT_RF_SOURCE_CAVEATS,
  type ScikitRfInputV1,
} from '../../src/awesomePhysics/adapters/typescript/scikitRf'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const adapterIds: Record<string, string> = {
  'awesome-empy': EMPY_ADAPTER_ID,
  'awesome-lightpipes': LIGHTPIPES_ADAPTER_ID,
  'awesome-pyrt': PYRT_ADAPTER_ID,
  'awesome-scikit-rf': SCIKIT_RF_ADAPTER_ID,
}

function descriptorFor(catalogItemId: string): AwesomePhysicsSimulationDescriptorV1 {
  const descriptor = simulations.items.find((item) => item.catalogItemId === catalogItemId)
  const adapterId = adapterIds[catalogItemId]
  if (!descriptor || !adapterId) throw new Error(`Missing descriptor for ${catalogItemId}`)
  return { ...descriptor, adapterId, availability: 'available', runnable: true }
}

function expectFiniteJson(value: unknown): void {
  const encoded = JSON.stringify(value)
  expect(encoded).not.toBeUndefined()
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
    if (typeof entry === 'object' && entry !== null) {
      Object.values(entry).forEach(visit)
    }
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

describe('Awesome Physics TypeScript optics adapters', () => {
  it('exports descriptor-compatible factories and stable provisional IDs', () => {
    const signal = new AbortController().signal
    const empyDescriptor = descriptorFor('awesome-empy')
    const lightpipesDescriptor = descriptorFor('awesome-lightpipes')
    const pyRtDescriptor = descriptorFor('awesome-pyrt')
    const scikitRfDescriptor = descriptorFor('awesome-scikit-rf')

    const empy = createEmpyAdapter(empyDescriptor, signal)
    const lightpipes = createLightpipesAdapter(lightpipesDescriptor, signal)
    const pyRt = createPyRtAdapter(pyRtDescriptor, signal)
    const scikitRf = createScikitRfAdapter(scikitRfDescriptor, signal)

    expectDescriptorCompatibility(empy, empyDescriptor, EMPY_ADAPTER_ID)
    expectDescriptorCompatibility(lightpipes, lightpipesDescriptor, LIGHTPIPES_ADAPTER_ID)
    expectDescriptorCompatibility(pyRt, pyRtDescriptor, PYRT_ADAPTER_ID)
    expectDescriptorCompatibility(scikitRf, scikitRfDescriptor, SCIKIT_RF_ADAPTER_ID)
    expect(createEMpyAdapter).toBe(createEmpyAdapter)
    expect(createLightPipesAdapter).toBe(createLightpipesAdapter)
    expect(createPYRTAdapter).toBe(createPyRtAdapter)
    expect(createScikitRFAdapter).toBe(createScikitRfAdapter)
    expect(EMPY_SOURCE_CAVEATS.data).toContain('No EMpy')
    expect(LIGHTPIPES_SOURCE_CAVEATS.data).toContain('No LightPipes')
    expect(PYRT_SOURCE_CAVEATS.data).toContain('No pyRT')
    expect(SCIKIT_RF_SOURCE_CAVEATS.data).toContain('No scikit-rf')
  })

  it('matches the normal-incidence Fresnel reflection for a bare interface', () => {
    const descriptor = descriptorFor('awesome-empy')
    const adapter = createEmpyAdapter(descriptor, new AbortController().signal)
    const input: EmpyInputV1 = {
      wavelength: 600e-9,
      layers: [
        { refractiveIndex: 1, thickness: null },
        { refractiveIndex: 1.5, thickness: null },
      ],
    }
    const output = adapter.run(input)

    expect(output.reflection.re).toBeCloseTo(-0.2, 12)
    expect(output.reflection.im).toBeCloseTo(0, 12)
    expect(output.reflectance).toBeCloseTo(0.04, 12)
    expect(output.transmission.re).toBeCloseTo(0.8, 12)
    expect(output.transmittance).toBeCloseTo(0.96, 12)
    expectFiniteJson(output)
  })

  it('computes a symmetric Young interference pattern with a central maximum', () => {
    const descriptor = descriptorFor('awesome-lightpipes')
    const adapter = createLightpipesAdapter(descriptor, new AbortController().signal)
    const input: LightpipesInputV1 = {
      wavelength: 500e-9,
      propagationDistance: 0.5,
      slitSeparation: 1e-3,
      positions: [-2e-4, 0, 2e-4],
    }
    const output = adapter.run(input)

    expect(output.intensity[0]).toBeCloseTo(output.intensity[2], 12)
    expect(output.intensity[1]).toBeCloseTo(4, 12)
    expect(output.field[1] && output.field[1].re ** 2 + output.field[1].im ** 2).toBeCloseTo(4, 12)
    expectFiniteJson(output)
  })

  it('returns the nearest bounded pyRT sphere hit and rejects a miss', () => {
    const descriptor = descriptorFor('awesome-pyrt')
    const adapter = createPyRtAdapter(descriptor, new AbortController().signal)
    const hitInput: PyRtInputV1 = {
      ray: { origin: [0, 0, -3], direction: [0, 0, 1] },
      sphere: { center: [0, 0, 0], radius: 1 },
      tMax: 10,
    }
    const hit = adapter.run(hitInput)
    expect(hit.hit).toBe(true)
    expect(hit.t).toBeCloseTo(2, 12)
    expect(hit.point).toEqual([0, 0, -1])
    expect(hit.normal).toEqual([0, 0, -1])

    const miss = adapter.run({
      ray: { origin: [0, 0, -3], direction: [0, 1, 0] },
      sphere: { center: [0, 0, 0], radius: 1 },
      tMax: 10,
    })
    expect(miss.hit).toBe(false)
    expect(miss.t).toBeNull()
    expectFiniteJson(hit)
    expectFiniteJson(miss)
  })

  it('converts a complex impedance to scikit-rf reflection and voltage transmission', () => {
    const descriptor = descriptorFor('awesome-scikit-rf')
    const adapter = createScikitRfAdapter(descriptor, new AbortController().signal)
    const input: ScikitRfInputV1 = {
      impedance: { re: 100, im: 50 },
      referenceImpedance: 50,
    }
    const output = adapter.run(input)

    expect(output.reflection.re).toBeCloseTo(0.4, 12)
    expect(output.reflection.im).toBeCloseTo(0.2, 12)
    expect(output.transmission.re).toBeCloseTo(1.4, 12)
    expect(output.transmission.im).toBeCloseTo(0.2, 12)
    expect(output.reflectionMagnitude).toBeCloseTo(Math.sqrt(0.2), 12)
    expectFiniteJson(output)
  })

  it('is deterministic for repeated bounded runs', () => {
    const signal = new AbortController().signal
    const cases = [
      {
        adapter: createEmpyAdapter(descriptorFor('awesome-empy'), signal),
        input: {
          wavelength: 1,
          layers: [
            { refractiveIndex: 1, thickness: null },
            { refractiveIndex: 1.4, thickness: 0.2 },
            { refractiveIndex: 1.2, thickness: null },
          ],
        } satisfies EmpyInputV1,
      },
      {
        adapter: createLightpipesAdapter(descriptorFor('awesome-lightpipes'), signal),
        input: {
          wavelength: 1,
          propagationDistance: 10,
          slitSeparation: 2,
          positions: [-1, 0, 1],
        } satisfies LightpipesInputV1,
      },
      {
        adapter: createPyRtAdapter(descriptorFor('awesome-pyrt'), signal),
        input: {
          ray: { origin: [0, 0, -3], direction: [0, 0, 1] },
          sphere: { center: [0, 0, 0], radius: 1 },
          tMax: 10,
        } satisfies PyRtInputV1,
      },
      {
        adapter: createScikitRfAdapter(descriptorFor('awesome-scikit-rf'), signal),
        input: { z: { re: 100, im: 20 }, z0: 50 } satisfies ScikitRfInputV1,
      },
    ]
    for (const { adapter, input } of cases) expect(adapter.run(input)).toEqual(adapter.run(input))
  })

  it('rejects malformed inputs and preserves finite bounds', () => {
    const signal = new AbortController().signal
    const empy = createEmpyAdapter(descriptorFor('awesome-empy'), signal)
    const lightpipes = createLightpipesAdapter(descriptorFor('awesome-lightpipes'), signal)
    const pyRt = createPyRtAdapter(descriptorFor('awesome-pyrt'), signal)
    const scikitRf = createScikitRfAdapter(descriptorFor('awesome-scikit-rf'), signal)

    expect(() => empy.run({ wavelength: 1, layers: [], extra: true } as unknown as EmpyInputV1)).toThrow(/unknown properties|between 2/)
    expect(() => lightpipes.run({
      wavelength: 1,
      propagationDistance: 1,
      slitSeparation: 1,
      positions: [Number.NaN],
    })).toThrow(/finite number|unbounded/)
    expect(() => pyRt.run({
      ray: { origin: [0, 0, 0], direction: [0, 0, 1] },
      sphere: { center: [0, 0, 0], radius: 1 },
      tMax: Number.POSITIVE_INFINITY,
    })).toThrow(/finite number|between/)
    expect(() => scikitRf.run({
      impedance: 100,
      referenceImpedance: 50,
      unexpected: true,
    } as unknown as ScikitRfInputV1)).toThrow(/unknown properties/)
  })

  it('checks cancellation at factory and run boundaries', () => {
    const controller = new AbortController()
    controller.abort()
    expect(() => createEmpyAdapter(descriptorFor('awesome-empy'), controller.signal)).toThrow(/aborted/i)
    expect(() => createLightpipesAdapter(descriptorFor('awesome-lightpipes'), controller.signal)).toThrow(/aborted/i)
    expect(() => createPyRtAdapter(descriptorFor('awesome-pyrt'), controller.signal)).toThrow(/aborted/i)
    expect(() => createScikitRfAdapter(descriptorFor('awesome-scikit-rf'), controller.signal)).toThrow(/aborted/i)

    const adapter = createPyRtAdapter(descriptorFor('awesome-pyrt'), new AbortController().signal)
    const runController = new AbortController()
    runController.abort()
    expect(() => adapter.run({
      ray: { origin: [0, 0, -3], direction: [0, 0, 1] },
      sphere: { center: [0, 0, 0], radius: 1 },
      tMax: 10,
    }, runController.signal)).toThrow(/aborted/i)
  })
})
