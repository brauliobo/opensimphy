import type { AwesomePhysicsSimulationDescriptorV1 } from '../../src/types/awesomePhysics'
import {
  QMSOLVE_ADAPTER_ID,
  QMSOLVE_BOUNDS,
  QMSOLVE_DEFAULT_INPUT,
  createQmsolveAdapter,
  evaluateQmsolve,
  qmsolveAdapterFactory,
  type QmsolveInput,
} from '../../src/awesomePhysics/adapters/typescript/qmsolve'

function input(overrides: Partial<QmsolveInput> = {}): QmsolveInput {
  return { ...QMSOLVE_DEFAULT_INPUT, ...overrides }
}

function descriptor(overrides: Partial<AwesomePhysicsSimulationDescriptorV1> = {}): AwesomePhysicsSimulationDescriptorV1 {
  return {
    id: 'awesome-qmsolve-capability',
    catalogItemId: 'awesome-qmsolve',
    title: 'QMsolve',
    capability: 'catalog-entry',
    execution: 'typescript',
    executionOptions: ['typescript'],
    availability: 'available',
    runnable: true,
    priority: 'P0',
    modelOrigin: 'educational-reimplementation',
    adapterId: QMSOLVE_ADAPTER_ID,
    numericalMethod: 'bounded 1D central finite difference',
    inputSchema: 'qmsolve-input-v1',
    outputSchema: 'qmsolve-output-v1',
    sourceRevision: 'c69277da03bb',
    implementationRevision: 'qmsolve-typescript-finite-difference-v1',
    licenseGate: 'pass',
    availabilityReason: 'Test fixture',
    planDisposition: 'Test fixture',
    limits: {
      maxGridSize: 256,
      maxParticles: 1,
      maxIterations: 10_000,
      maxMemoryBytes: 67_108_864,
      maxWorkerTimeMs: 5_000,
      maxOutputBytes: 4_194_304,
    },
    artifactProvenance: {
      sourceRevision: 'c69277da03bb',
      acquisitionDate: '2026-08-15',
      byteSize: null,
      sha256: null,
      transformation: 'test fixture',
      datasetLicense: 'BSD-3-Clause',
      evidenceRefs: ['test/fixture'],
    },
    evidenceRefs: ['test/fixture'],
    compatibilityRevision: 'awesome-physics-compatibility-v1',
    modelRevision: 'qmsolve-model-v1',
    contentRevision: 'qmsolve-content-v1',
    outputRevision: 'qmsolve-output-v1',
    ...overrides,
  }
}

describe('Awesome Physics qmsolve TypeScript adapter', () => {
  it('normalizes a deterministic Gaussian state and emits finite JSON-safe samples', async () => {
    const result = await evaluateQmsolve(input({ steps: 48, sampleCount: 7 }))

    expect(result.normalization.initial).toBeCloseTo(1, 12)
    expect(result.normalization.final).toBeCloseTo(1, 12)
    expect(result.probability).toHaveLength(result.grid.size)
    expect(result.energy).toHaveLength(7)
    expect(result.probability.every(({ x, potential, probability }) => [x, potential, probability].every(Number.isFinite))).toBe(true)
    expect(result.energy.every(({ step, time, kinetic, potential, total }) => [step, time, kinetic, potential, total].every(Number.isFinite))).toBe(true)
    expect(result.probability.reduce((sum, point) => sum + point.probability, 0) * result.grid.spacing).toBeCloseTo(1, 10)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
    expect(result.assumptions.join(' ')).toContain('SciPy sparse')
    expect(result.doesNotEstablish).toContain('does not establish')
    expect(result.validatesTheory).toBe(false)
  })

  it('preserves harmonic symmetry and keeps finite-difference energy bounded', async () => {
    const result = await evaluateQmsolve(input({ steps: 96, sampleCount: 9, packetMomentum: 0 }))
    const pairedDifferences = result.probability.map((point, index) => Math.abs(point.probability - result.probability[result.probability.length - index - 1]!.probability))
    const energies = result.energy.map(({ total }) => total)

    expect(Math.max(...pairedDifferences)).toBeLessThan(1e-11)
    expect(Math.max(...energies) - Math.min(...energies)).toBeLessThan(1e-10)
    expect(result.energy.at(-1)!.total).toBeGreaterThan(0)
  })

  it('returns byte-for-byte equivalent results for repeated deterministic runs', async () => {
    const first = await evaluateQmsolve(input({ packetCenter: 1, packetMomentum: 0.75, steps: 40 }))
    const second = await evaluateQmsolve(input({ packetCenter: 1, packetMomentum: 0.75, steps: 40 }))

    expect(second).toEqual(first)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })

  it('rejects out-of-domain, malformed, and unstable inputs without fallback', async () => {
    await expect(evaluateQmsolve(input({ gridSize: QMSOLVE_BOUNDS.gridSize.min - 1 }))).rejects.toThrow(/gridSize/)
    await expect(evaluateQmsolve(input({ packetCenter: 7, packetWidth: 2 }))).rejects.toThrow(/outside the finite domain/)
    await expect(evaluateQmsolve(input({ timeStep: 0.05 }))).rejects.toThrow(/unstable or under-resolved/)
    await expect(evaluateQmsolve({ ...input(), timeStep: Number.NaN })).rejects.toThrow(/timeStep must be a finite number/)
    await expect(evaluateQmsolve({ ...input(), steps: 1.5 })).rejects.toThrow(/steps must be a safe integer/)
    await expect(evaluateQmsolve({ ...input(), unexpected: true } as QmsolveInput & { unexpected: boolean })).rejects.toThrow(/unknown properties/)
    await expect(evaluateQmsolve({ ...input(), potential: 'arbitrary' } as unknown as QmsolveInput)).rejects.toThrow(/only the harmonic-oscillator/)
  })

  it('observes AbortSignal cancellation during a long iteration', async () => {
    const controller = new AbortController()
    const pending = evaluateQmsolve(input({ gridSize: 65, timeStep: 0.001, steps: 10_000, sampleCount: 2 }), controller.signal)
    setTimeout(() => controller.abort(), 0)

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('returns an adapter with revisions copied from the descriptor', async () => {
    const currentDescriptor = descriptor()
    const adapter = createQmsolveAdapter(currentDescriptor, new AbortController().signal)
    const factoryAdapter = await qmsolveAdapterFactory(currentDescriptor, new AbortController().signal)

    expect(adapter.adapterId).toBe(QMSOLVE_ADAPTER_ID)
    expect(adapter.protocol).toBe('awesome-physics-adapter-v1')
    expect(adapter.compatibility).toEqual({
      contentRevision: currentDescriptor.contentRevision,
      modelRevision: currentDescriptor.modelRevision,
      implementationRevision: currentDescriptor.implementationRevision,
      outputRevision: currentDescriptor.outputRevision,
    })
    expect(factoryAdapter.compatibility).toEqual(adapter.compatibility)
    await expect(adapter.run(input({ steps: 2 }))).resolves.toMatchObject({ schemaVersion: 1, method: 'central-finite-difference-crank-nicolson' })
  })
})
