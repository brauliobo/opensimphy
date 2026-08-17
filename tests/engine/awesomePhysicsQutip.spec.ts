import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  QUTIP_ADAPTER_ID,
  QUTIP_CATALOG_ITEM_ID,
  QUTIP_SOURCE_CAVEATS,
  createQutipAdapter,
  parseQutipInput,
  qutipAdapterFactory,
  type QutipInputV1,
} from '../../src/awesomePhysics/adapters/typescript/qutip'
import type {
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1

function descriptor(): AwesomePhysicsSimulationDescriptorV1 {
  const source = simulations.items.find((item) => item.catalogItemId === QUTIP_CATALOG_ITEM_ID)
  if (!source) throw new Error('Missing qutip descriptor')
  return { ...source, adapterId: QUTIP_ADAPTER_ID, availability: 'available', runnable: true }
}

function rabiInput(overrides: Partial<Extract<QutipInputV1, { operation: 'rabi-population' }>> = {}): QutipInputV1 {
  return {
    operation: 'rabi-population',
    rabiFrequency: 1,
    detuning: 0,
    timeStep: 0.01,
    steps: 314,
    sampleEvery: 314,
    ...overrides,
  }
}

describe('Awesome Physics qutip TypeScript adapter', () => {
  it('reaches a resonant pi-pulse inversion from the ground state', async () => {
    const adapter = createQutipAdapter(descriptor(), new AbortController().signal)
    const result = await adapter.run(rabiInput())
    if (result.operation !== 'rabi-population') throw new Error('expected rabi output')
    expect(result.samples[0]).toMatchObject({ step: 0, excitedPopulation: 0, groundPopulation: 1, inversion: -1 })
    expect(result.effectiveRabiFrequency).toBe(1)
    expect(result.samples.at(-1)?.time).toBeCloseTo(Math.PI, 2)
    expect(result.samples.at(-1)?.excitedPopulation).toBeCloseTo(1, 3)
    expect(result.peakExcitedPopulation).toBeCloseTo(1, 3)
    expect(result.samples.every(({ excitedPopulation, groundPopulation }) => Math.abs(excitedPopulation + groundPopulation - 1) < 1e-12)).toBe(true)
    expect(result.validatesTheory).toBe(false)
    expect(result.doesNotEstablish).toContain('does not establish')
    expect(result.licenseCaveat).toBe(QUTIP_SOURCE_CAVEATS.license)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('reduces peak inversion when the drive is detuned', async () => {
    const adapter = qutipAdapterFactory(descriptor(), new AbortController().signal)
    const result = await adapter.run(rabiInput({ detuning: 1, steps: 223, sampleEvery: 223 }))
    if (result.operation !== 'rabi-population') throw new Error('expected rabi output')
    expect(result.effectiveRabiFrequency).toBeCloseTo(Math.SQRT2, 12)
    expect(result.peakExcitedPopulation).toBeCloseTo(0.5, 3)
  })

  it('damps Rabi flopping under radiative Lindblad decay', async () => {
    const adapter = createQutipAdapter(descriptor(), new AbortController().signal)
    const result = await adapter.run({
      operation: 'lindblad-bloch',
      rabiFrequency: 1,
      detuning: 0,
      decayRate: 0.4,
      timeStep: 0.01,
      steps: 400,
      sampleEvery: 40,
    })
    if (result.operation !== 'lindblad-bloch') throw new Error('expected lindblad output')
    expect(result.samples[0].excitedPopulation).toBe(0)
    expect(result.finalExcitedPopulation).toBeGreaterThan(0)
    expect(result.finalExcitedPopulation).toBeLessThan(0.7)
    expect(result.samples.every(({ excitedPopulation, groundPopulation }) => (
      excitedPopulation >= -1e-9 && groundPopulation >= -1e-9 && Math.abs(excitedPopulation + groundPopulation - 1) < 1e-9
    ))).toBe(true)
  })

  it('rejects unsafe Rabi and Lindblad bounds', () => {
    expect(() => parseQutipInput({ ...rabiInput(), steps: 4001 })).toThrow(/steps/)
    expect(() => parseQutipInput({
      operation: 'lindblad-bloch',
      rabiFrequency: 1,
      detuning: 0,
      decayRate: -0.1,
      timeStep: 0.01,
      steps: 10,
      sampleEvery: 1,
    })).toThrow(/decayRate/)
  })
})
