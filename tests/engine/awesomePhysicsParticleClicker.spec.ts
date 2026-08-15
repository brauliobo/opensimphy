import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import type { AwesomePhysicsSimulationDescriptorV1 } from '../../src/types/awesomePhysics'
import {
  createParticleClickerAdapter,
  PARTICLE_CLICKER_ADAPTER_ID,
  PARTICLE_CLICKER_BOUNDS,
  PARTICLE_CLICKER_CATALOG_ITEM_ID,
  PARTICLE_CLICKER_PROVENANCE,
  runParticleClicker,
} from '../../src/awesomePhysics/adapters/browser/particleClicker'

const simulations = simulationsJson as { items: AwesomePhysicsSimulationDescriptorV1[] }

function descriptor(): AwesomePhysicsSimulationDescriptorV1 {
  const source = simulations.items.find(({ catalogItemId }) => catalogItemId === PARTICLE_CLICKER_CATALOG_ITEM_ID)
  if (!source) throw new Error('particle-clicker descriptor fixture is missing')
  return { ...source, adapterId: PARTICLE_CLICKER_ADAPTER_ID }
}

describe('particle-clicker Awesome Physics adapter', () => {
  it('produces deterministic progression across clicks, hires, time, and upgrades', async () => {
    const input = {
      initial: { funding: 1_000 },
      actions: [
        { type: 'click', count: 3 },
        { type: 'hire-worker', workerId: 'workers-masterstudents', count: 1 },
        { type: 'advance', seconds: 2 },
        { type: 'buy-upgrade', upgradeId: 'upgrade-energy1' },
        { type: 'click', count: 1 },
      ],
    } as const

    const first = await runParticleClicker(input)
    const second = await runParticleClicker(input)

    expect(first).toEqual(second)
    expect(first.state).toMatchObject({
      particles: 7,
      funding: 760,
      clicks: 4,
      elapsedSeconds: 2,
      detectorPower: 2,
      productionRate: 1,
      workers: { 'workers-masterstudents': 1 },
      workerCosts: { 'workers-masterstudents': 60 },
      upgrades: ['upgrade-energy1'],
    })
    expect(first.totals).toEqual({
      clicks: 4,
      upgradesPurchased: 1,
      workerHires: 1,
      particlesFromClicks: 5,
      particlesFromWorkers: 2,
      fundingFromGrants: 0,
      fundingSpent: 240,
    })
    expect(first.actions.every(({ reason }) => reason === 'applied')).toBe(true)
    expect(first.provenance).toEqual(PARTICLE_CLICKER_PROVENANCE)
  })

  it('applies upgrade costs only when funding and prerequisites are available', async () => {
    const unaffordable = await runParticleClicker({
      initial: { funding: 199 },
      actions: [{ type: 'buy-upgrade', upgradeId: 'upgrade-energy1' }],
    })
    expect(unaffordable.state.funding).toBe(199)
    expect(unaffordable.state.upgrades).toEqual([])
    expect(unaffordable.actions[0]).toMatchObject({ applied: false, cost: 0, reason: 'insufficient-funding' })

    const affordable = await runParticleClicker({
      initial: { funding: 2_200 },
      actions: [
        { type: 'buy-upgrade', upgradeId: 'upgrade-energy1' },
        { type: 'buy-upgrade', upgradeId: 'upgrade-energy2' },
        { type: 'buy-upgrade', upgradeId: 'upgrade-sps' },
      ],
    })
    expect(affordable.state).toMatchObject({ funding: 0, detectorPower: 4 })
    expect(affordable.state.upgrades).toEqual(['upgrade-energy1', 'upgrade-energy2'])
    expect(affordable.actions[2]).toMatchObject({ applied: false, reason: 'requirements-not-met' })
  })

  it('keeps worker costs and production rates bounded and caps serialized output', async () => {
    const output = await runParticleClicker({
      initial: { funding: 100 },
      actions: [
        { type: 'hire-worker', workerId: 'workers-masterstudents', count: 2 },
        ...Array.from({ length: PARTICLE_CLICKER_BOUNDS.maxActions - 1 }, () => ({ type: 'advance' as const, seconds: 0 })),
      ],
    })

    expect(output.state.workers['workers-masterstudents']).toBe(2)
    expect(output.state.workerCosts['workers-masterstudents']).toBe(90)
    expect(output.state.productionRate).toBe(2)
    expect(new TextEncoder().encode(JSON.stringify(output)).byteLength).toBeLessThanOrEqual(PARTICLE_CLICKER_BOUNDS.maxOutputBytes)
    expect(output.actions).toHaveLength(PARTICLE_CLICKER_BOUNDS.maxActions)

    await expect(runParticleClicker({
      actions: [{ type: 'click', count: PARTICLE_CLICKER_BOUNDS.maxClicks + 1 }],
    })).rejects.toThrow(/count.*safe integer|clicks.*at most/i)
    await expect(runParticleClicker({
      actions: Array.from({ length: PARTICLE_CLICKER_BOUNDS.maxUpgradePurchases + 1 }, () => ({
        type: 'buy-upgrade' as const,
        upgradeId: 'upgrade-energy1' as const,
      })),
    })).rejects.toThrow(/upgrades/i)
  })

  it('rejects malformed, non-finite, and non-JSON input', async () => {
    await expect(runParticleClicker({ actions: [], unexpected: true } as never)).rejects.toThrow(/unknown properties: unexpected/)
    await expect(runParticleClicker({ actions: [{ type: 'click', count: Number.NaN }] })).rejects.toThrow(/finite numbers/)
    await expect(runParticleClicker({ initial: { particles: null }, actions: [] } as never)).rejects.toThrow(/input\.initial\.particles/)
    await expect(runParticleClicker({ actions: [{ type: 'click', count: 1, extra: true }] } as never)).rejects.toThrow(/unknown properties: extra/)

    const cyclic: Record<string, unknown> = { actions: [] }
    cyclic.cycle = cyclic
    await expect(runParticleClicker(cyclic as never)).rejects.toThrow(/cycles/)
  })

  it('honors abort cancellation before and during a bounded run', async () => {
    const before = new AbortController()
    before.abort()
    await expect(runParticleClicker({ actions: [] }, before.signal)).rejects.toMatchObject({ name: 'AbortError' })

    const during = new AbortController()
    const pending = runParticleClicker({
      actions: [{ type: 'click', count: PARTICLE_CLICKER_BOUNDS.maxClicks }],
    }, during.signal)
    during.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('returns descriptor-matching compatibility revisions without registering the descriptor', async () => {
    const supplied = descriptor()
    const adapter = createParticleClickerAdapter(supplied)

    expect(adapter.adapterId).toBe(PARTICLE_CLICKER_ADAPTER_ID)
    expect(adapter.protocol).toBe('awesome-physics-adapter-v1')
    expect(adapter.compatibility).toEqual({
      contentRevision: supplied.contentRevision,
      modelRevision: supplied.modelRevision,
      implementationRevision: supplied.implementationRevision,
      outputRevision: supplied.outputRevision,
    })
    await expect(adapter.run({ actions: [{ type: 'click', count: 1 }] })).resolves.toMatchObject({
      state: { particles: 1, clicks: 1 },
    })

    expect(() => createParticleClickerAdapter({ ...supplied, catalogItemId: 'other-catalog-item' })).toThrow(/simulation descriptor/)
    expect(() => createParticleClickerAdapter({ ...supplied, adapterId: 'other-adapter' })).not.toThrow()
  })
})
