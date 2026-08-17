import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  SCIKIT_BEAM_ADAPTER_ID,
  SCIKIT_BEAM_CATALOG_ITEM_ID,
  SCIKIT_BEAM_SOURCE_CAVEATS,
  createScikitBeamAdapter,
  parseScikitBeamInput,
  scikitBeamAdapterFactory,
  type ScikitBeamInputV1,
} from '../../src/awesomePhysics/adapters/typescript/scikitBeam'
import type {
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1

function descriptor(): AwesomePhysicsSimulationDescriptorV1 {
  const source = simulations.items.find((item) => item.catalogItemId === SCIKIT_BEAM_CATALOG_ITEM_ID)
  if (!source) throw new Error('Missing scikit-beam descriptor')
  return { ...source, adapterId: SCIKIT_BEAM_ADAPTER_ID, availability: 'available', runnable: true }
}

function sphereInput(overrides: Partial<Extract<ScikitBeamInputV1, { operation: 'sphere-form-factor' }>> = {}): ScikitBeamInputV1 {
  return {
    operation: 'sphere-form-factor',
    radiusNm: 5,
    qMinNmInv: 0,
    qMaxNmInv: 1.5,
    sampleCount: 33,
    ...overrides,
  }
}

describe('Awesome Physics scikit-beam TypeScript adapter', () => {
  it('recovers F(0)=1 and the first spherical form-factor minimum', async () => {
    const adapter = createScikitBeamAdapter(descriptor(), new AbortController().signal)
    const result = await adapter.run(sphereInput({ qMaxNmInv: 1.2, sampleCount: 121 }))
    if (result.operation !== 'sphere-form-factor') throw new Error('expected sphere output')
    expect(result.samples[0]).toMatchObject({ qNmInv: 0, formFactor: 1, intensity: 1 })
    expect(result.firstMinimumQNmInv).not.toBeNull()
    expect(result.firstMinimumQNmInv).toBeCloseTo(4.493409457909 / 5, 2)
    const mid = result.samples.find((sample) => sample.qNmInv === 0.6)
    expect(mid?.formFactor).toBeCloseTo(3 * (Math.sin(3) - 3 * Math.cos(3)) / 27, 12)
    expect(result.validatesTheory).toBe(false)
    expect(result.doesNotEstablish).toContain('does not establish')
    expect(result.licenseCaveat).toBe(SCIKIT_BEAM_SOURCE_CAVEATS.license)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('normalizes a 1D lag correlation so C(0)=1', async () => {
    const adapter = scikitBeamAdapterFactory(descriptor(), new AbortController().signal)
    const result = await adapter.run({
      operation: 'lag-correlation',
      intensity: [1, 0, 1, 0, 1, 0],
    })
    if (result.operation !== 'lag-correlation') throw new Error('expected correlation output')
    expect(result.correlation[0]).toBe(1)
    expect(result.peakLag).toBe(0)
    expect(result.correlation[1]).toBe(0)
    expect(result.correlation[2]).toBeCloseTo(2 / 3, 12)
  })

  it('rejects unsafe sphere and correlation bounds', () => {
    const adapter = createScikitBeamAdapter(descriptor(), new AbortController().signal)
    expect(() => parseScikitBeamInput({ ...sphereInput(), sampleCount: 257 })).toThrow(/sampleCount/)
    expect(() => adapter.run({ operation: 'lag-correlation', intensity: [0, 0, 0] })).toThrow(/identically zero/)
  })
})
