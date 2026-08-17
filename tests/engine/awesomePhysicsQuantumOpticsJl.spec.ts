import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  QUANTUM_OPTICS_JL_ADAPTER_ID,
  QUANTUM_OPTICS_JL_CATALOG_ITEM_ID,
  QUANTUM_OPTICS_JL_SOURCE_CAVEATS,
  createQuantumOpticsJlAdapter,
  parseQuantumOpticsJlInput,
  quantumOpticsJlAdapterFactory,
  type QuantumOpticsJlInputV1,
} from '../../src/awesomePhysics/adapters/typescript/quantumOpticsJl'
import type {
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1

function descriptor(): AwesomePhysicsSimulationDescriptorV1 {
  const source = simulations.items.find((item) => item.catalogItemId === QUANTUM_OPTICS_JL_CATALOG_ITEM_ID)
  if (!source) throw new Error('Missing QuantumOptics.jl descriptor')
  return { ...source, adapterId: QUANTUM_OPTICS_JL_ADAPTER_ID, availability: 'available', runnable: true }
}

function jcInput(overrides: Partial<QuantumOpticsJlInputV1> = {}): QuantumOpticsJlInputV1 {
  return {
    operation: 'jaynes-cummings',
    coupling: 1,
    detuning: 0,
    photonNumber: 0,
    timeStep: 0.01,
    steps: 157,
    sampleEvery: 157,
    ...overrides,
  }
}

describe('Awesome Physics QuantumOptics.jl TypeScript adapter', () => {
  it('transfers the vacuum Rabi excitation at gt = pi/2', async () => {
    const adapter = createQuantumOpticsJlAdapter(descriptor(), new AbortController().signal)
    const result = await adapter.run(jcInput())
    expect(result.samples[0]).toMatchObject({ step: 0, excitedPopulation: 1, cavityPhotons: 0, inversion: 1 })
    expect(result.vacuumRabiFrequency).toBe(2)
    expect(result.samples.at(-1)?.time).toBeCloseTo(Math.PI / 2, 2)
    expect(result.samples.at(-1)?.excitedPopulation).toBeCloseTo(0, 2)
    expect(result.samples.at(-1)?.cavityPhotons).toBeCloseTo(1, 2)
    expect(result.samples.every(({ excitedPopulation, cavityPhotons }) => (
      Math.abs(excitedPopulation + cavityPhotons - 1) < 1e-12
    ))).toBe(true)
    expect(result.validatesTheory).toBe(false)
    expect(result.doesNotEstablish).toContain('does not establish')
    expect(result.licenseCaveat).toBe(QUANTUM_OPTICS_JL_SOURCE_CAVEATS.license)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('reduces the oscillation amplitude when the cavity is detuned', async () => {
    const adapter = quantumOpticsJlAdapterFactory(descriptor(), new AbortController().signal)
    const result = await adapter.run(jcInput({ detuning: 2, steps: 200, sampleEvery: 1 }))
    expect(result.vacuumRabiFrequency).toBeCloseTo(Math.hypot(2, 2), 12)
    const minimumExcited = Math.min(...result.samples.map((sample) => sample.excitedPopulation))
    expect(minimumExcited).toBeCloseTo(0.5, 3)
  })

  it('rejects unsafe Jaynes-Cummings bounds', () => {
    expect(() => parseQuantumOpticsJlInput({ ...jcInput(), steps: 4001 })).toThrow(/steps/)
    expect(() => parseQuantumOpticsJlInput({ ...jcInput(), photonNumber: -1 })).toThrow(/photonNumber/)
  })
})
