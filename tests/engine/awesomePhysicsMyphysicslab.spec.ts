import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  createMyphysicslabAdapter,
  MYPHYSICSLAB_ADAPTER_ID,
  type MyphysicslabInputV1,
  type MyphysicslabOutputV1,
} from '../../src/awesomePhysics/adapters/browser/myphysicslab'
import type { AwesomePhysicsSimulationArtifactV1, AwesomePhysicsSimulationDescriptorV1 } from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1

function descriptor(): AwesomePhysicsSimulationDescriptorV1 {
  const source = simulations.items.find(({ catalogItemId }) => catalogItemId === 'awesome-myphysicslab')
  if (!source) throw new Error('myphysicslab descriptor fixture is missing')
  return { ...source, adapterId: MYPHYSICSLAB_ADAPTER_ID }
}

function adapter() {
  return createMyphysicslabAdapter(descriptor(), new AbortController().signal)
}

function finiteJson(value: unknown): void {
  const serialized = JSON.stringify(value)
  expect(serialized).toEqual(expect.any(String))
  expect(JSON.parse(serialized)).toEqual(value)
}

describe('myphysicslab Awesome Physics adapter', () => {
  it('returns deterministic sampled spring positions and energies', async () => {
    const input: MyphysicslabInputV1 = {
      steps: 120,
      sampleEvery: 20,
      timeStep: 0.01,
      mass: 1,
      stiffness: 4,
      damping: 0.05,
      restLength: 1,
      initialPosition: 1.25,
      initialVelocity: 0,
    }
    const first = await adapter().run(input) as MyphysicslabOutputV1
    const second = await adapter().run(input) as MyphysicslabOutputV1

    expect(second).toEqual(first)
    expect(first.model).toBe('myphysicslab-single-spring-v1')
    expect(first.integrator).toBe('runge-kutta-4')
    expect(first.samples).toHaveLength(7)
    expect(first.samples[0]).toMatchObject({ step: 0, position: 1.25, velocity: 0 })
    expect(first.final.step).toBe(120)
    expect(first.samples.every((sample) => (
      Number.isFinite(sample.position)
      && Number.isFinite(sample.velocity)
      && Number.isFinite(sample.totalEnergy)
    ))).toBe(true)
    finiteJson(first)
  })

  it('keeps equilibrium stationary and bounds undriven spring energy', async () => {
    const equilibrium = await adapter().run({
      steps: 200,
      sampleEvery: 25,
      damping: 0,
      restLength: 1,
      initialPosition: 1,
      initialVelocity: 0,
    }) as MyphysicslabOutputV1
    expect(equilibrium.samples.every(({ position, velocity, totalEnergy }) => (
      position === 1 && velocity === 0 && totalEnergy === 0
    ))).toBe(true)

    const undamped = await adapter().run({
      steps: 400,
      sampleEvery: 20,
      timeStep: 0.01,
      mass: 1,
      stiffness: 4,
      damping: 0,
      restLength: 1,
      initialPosition: 1.5,
      initialVelocity: 0,
    }) as MyphysicslabOutputV1
    const initialEnergy = undamped.samples[0]!.totalEnergy
    expect(undamped.samples.every(({ totalEnergy }) => totalEnergy <= initialEnergy * 1.01)).toBe(true)
    expect(undamped.final.totalEnergy).toBeGreaterThan(0)

    const damped = await adapter().run({
      steps: 400,
      sampleEvery: 20,
      damping: 0.2,
      initialPosition: 1.5,
    }) as MyphysicslabOutputV1
    expect(damped.final.totalEnergy).toBeLessThan(damped.samples[0]!.totalEnergy)
  })

  it('rejects malformed inputs, unstable parameters, and resource violations', async () => {
    await expect(adapter().run({ steps: 2, unexpected: true } as unknown as MyphysicslabInputV1))
      .rejects.toThrow(/unknown properties: unexpected/)
    await expect(adapter().run({ steps: 2.5 }))
      .rejects.toThrow(/input\.steps.*safe integer/)
    await expect(adapter().run({ steps: 2, timeStep: Number.POSITIVE_INFINITY }))
      .rejects.toThrow(/input\.timeStep.*finite/)
    await expect(adapter().run({
      steps: 2,
      timeStep: 0.05,
      mass: 0.01,
      stiffness: 100,
    }))
      .rejects.toThrow(/stable integrator bound/)
    await expect(adapter().run({ steps: 4097 }))
      .rejects.toThrow(/input\.steps/)
  })

  it('cancels before work and while a finite spring run yields to the host', async () => {
    const before = new AbortController()
    before.abort()
    await expect(adapter().run({ steps: 2 }, before.signal))
      .rejects.toMatchObject({ name: 'AbortError' })

    const controller = new AbortController()
    const pending = adapter().run({ steps: 4096, sampleEvery: 4096 }, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('returns descriptor-matching protocol and compatibility fields without registry access', () => {
    const source = descriptor()
    const value = createMyphysicslabAdapter(source, new AbortController().signal)
    expect(value.adapterId).toBe(source.adapterId)
    expect(value.protocol).toBe('awesome-physics-adapter-v1')
    expect(value.compatibility).toEqual({
      contentRevision: source.contentRevision,
      modelRevision: source.modelRevision,
      implementationRevision: source.implementationRevision,
      outputRevision: source.outputRevision,
    })
  })
})
