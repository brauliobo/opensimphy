import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  QUANTUM_PYTHON_LECTURES_ADAPTER_ID,
  QUANTUM_PYTHON_LECTURES_CATALOG_ITEM_ID,
  QUANTUM_PYTHON_LECTURES_SOURCE_CAVEATS,
  createQuantumPythonLecturesAdapter,
  parseQuantumPythonLecturesInput,
  quantumPythonLecturesAdapterFactory,
  type QuantumPythonLecturesInputV1,
} from '../../src/awesomePhysics/adapters/typescript/quantumPythonLectures'
import type {
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1

function descriptor(): AwesomePhysicsSimulationDescriptorV1 {
  const source = simulations.items.find((item) => item.catalogItemId === QUANTUM_PYTHON_LECTURES_CATALOG_ITEM_ID)
  if (!source) throw new Error('Missing quantum-python-lectures descriptor')
  return { ...source, adapterId: QUANTUM_PYTHON_LECTURES_ADAPTER_ID, availability: 'available', runnable: true }
}

function oscillatorInput(overrides: Partial<Extract<QuantumPythonLecturesInputV1, { operation: 'rk4-oscillator' }>> = {}): QuantumPythonLecturesInputV1 {
  return {
    operation: 'rk4-oscillator',
    omega: 1,
    x0: 1,
    v0: 0,
    timeStep: 0.01,
    steps: 200,
    sampleEvery: 20,
    ...overrides,
  }
}

describe('Awesome Physics quantum-python-lectures TypeScript adapter', () => {
  it('conserves harmonic-oscillator energy under bounded RK4', async () => {
    const adapter = createQuantumPythonLecturesAdapter(descriptor(), new AbortController().signal)
    const result = await adapter.run(oscillatorInput())
    if (result.operation !== 'rk4-oscillator') throw new Error('expected oscillator output')
    expect(result.samples[0]).toMatchObject({ step: 0, x: 1, v: 0, energy: 0.5 })
    expect(result.finalEnergy).toBeCloseTo(result.initialEnergy, 6)
    expect(result.maximumRelativeEnergyError).toBeLessThan(1e-6)
    expect(result.samples.every(({ x, v, energy }) => [x, v, energy].every(Number.isFinite))).toBe(true)
    expect(result.validatesTheory).toBe(false)
    expect(result.doesNotEstablish).toContain('does not establish')
    expect(result.licenseCaveat).toBe(QUANTUM_PYTHON_LECTURES_SOURCE_CAVEATS.license)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('evaluates an isolated Lorentzian peak at line center', async () => {
    const adapter = quantumPythonLecturesAdapterFactory(descriptor(), new AbortController().signal)
    const result = await adapter.run({
      operation: 'lineshape',
      kind: 'lorentzian',
      center: 0,
      width: 2,
      amplitude: 3,
      frequencies: [-2, 0, 2],
    })
    if (result.operation !== 'lineshape') throw new Error('expected lineshape output')
    expect(result.intensities[1]).toBeCloseTo(3, 12)
    expect(result.peakIntensity).toBeCloseTo(3, 12)
    expect(result.intensities[0]).toBeCloseTo(result.intensities[2], 12)
    expect(result.intensities[0]).toBeLessThan(result.peakIntensity)
  })

  it('rejects unsafe oscillator and lineshape bounds', () => {
    expect(() => parseQuantumPythonLecturesInput({ ...oscillatorInput(), steps: 4001 })).toThrow(/steps/)
    expect(() => parseQuantumPythonLecturesInput({
      operation: 'lineshape',
      kind: 'lorentzian',
      center: 0,
      width: 1,
      amplitude: 1,
      frequencies: [],
    })).toThrow(/frequencies/)
  })
})
