import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import catalogJson from '../../public/data/generated/awesomePhysics/catalog.json'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  registerAwesomePhysicsAdapters,
  resetAwesomePhysicsAdapterRegistrationsForTests,
} from '../../src/awesomePhysics/registerAdapters'
import { awesomePhysicsDefaultInput } from '../../src/awesomePhysics/defaultInputs'
import { awesomePhysicsAdapterFactoryMap } from '../../src/awesomePhysics/adapterFactories'
import {
  resetAwesomePhysicsRegistryForTests,
  setAwesomePhysicsRegistryForTests,
  useAwesomePhysicsRegistry,
} from '../../src/registries/awesomePhysicsRegistry'
import type {
  AwesomePhysicsCatalogArtifactV1,
  AwesomePhysicsSimulationArtifactV1,
} from '../../src/types/awesomePhysics'

const catalog = catalogJson as AwesomePhysicsCatalogArtifactV1
const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const expectedAdapters = new Map(
  simulations.items.flatMap((item) => {
    if (!item.runnable || item.adapterId === undefined) return []
    const catalogItem = catalog.items.find((entry) => entry.id === item.catalogItemId)
    if (catalogItem === undefined) throw new Error(`Missing catalog item for ${item.catalogItemId}`)
    return [[catalogItem.canonicalName, item.adapterId]]
  }),
)

function installGeneratedFixture(): void {
  setAwesomePhysicsRegistryForTests({ catalog, simulations })
}

describe('Awesome Physics adapter integration', () => {
  afterEach(() => {
    resetAwesomePhysicsAdapterRegistrationsForTests()
    resetAwesomePhysicsRegistryForTests()
  })

  it('keeps registration lazy and maps every selected catalog item to one adapter', () => {
    const factorySource = readFileSync(resolve(process.cwd(), 'src/awesomePhysics/adapterFactories.ts'), 'utf8')
    expect(factorySource).not.toMatch(/^import .*adapters\//m)
    expect(expectedAdapters.size).toBe(simulations.summary.runnable)
    expect(expectedAdapters.has('scikit-beam')).toBe(true)
    expect(expectedAdapters.has('raysect')).toBe(true)
    expect(expectedAdapters.has('QuantumOptics.jl')).toBe(true)
    expect(expectedAdapters.has('astropy')).toBe(true)
    expect(expectedAdapters.has('galpy')).toBe(true)
    expect(expectedAdapters.has('cantera')).toBe(true)
    expect(factorySource.match(/await import\(/g)).toHaveLength(awesomePhysicsAdapterFactoryMap.size)

    expect(simulations.summary).toMatchObject({
      sourceCapabilities: catalog.items.length,
      runnable: expectedAdapters.size,
      available: expectedAdapters.size,
      adapterCount: expectedAdapters.size,
      unavailable: catalog.items.length - expectedAdapters.size - simulations.summary.blocked,
    })
    expect(simulations.items).toHaveLength(catalog.items.length)

    for (const [canonicalName, adapterId] of expectedAdapters) {
      const catalogItem = catalog.items.find((item) => item.canonicalName === canonicalName)
      const descriptor = simulations.items.find((item) => item.catalogItemId === catalogItem?.id)
      expect(descriptor).toMatchObject({
        availability: 'available',
        runnable: true,
        adapterId,
        licenseGate: 'pass',
      })
      expect(descriptor?.implementationRevision).not.toBe('phase-0-no-adapters')
    }

    for (const descriptor of simulations.items.filter(({ availability }) => availability !== 'available')) {
      expect(descriptor.runnable).toBe(false)
      expect('adapterId' in descriptor).toBe(false)
    }
  })

  it('registers factories explicitly and validates every loaded adapter compatibility revision', async () => {
    installGeneratedFixture()
    const registry = useAwesomePhysicsRegistry()
    const firstCleanup = registerAwesomePhysicsAdapters()
    expect(registerAwesomePhysicsAdapters()).toBe(firstCleanup)

    for (const descriptor of simulations.items.filter(({ availability }) => availability === 'available')) {
      const adapter = await registry.loadAdapter(descriptor.id)
      expect(adapter).toMatchObject({
        adapterId: descriptor.adapterId,
        protocol: 'awesome-physics-adapter-v1',
        compatibility: {
          contentRevision: descriptor.contentRevision,
          modelRevision: descriptor.modelRevision,
          implementationRevision: descriptor.implementationRevision,
          outputRevision: descriptor.outputRevision,
        },
      })
      expect(typeof adapter?.run).toBe('function')
    }

    firstCleanup()
    await expect(registry.loadAdapter('awesome-matter-js-capability')).rejects.toThrow(/not registered/)
  })

  it('runs every available non-WASM default to a finite JSON-safe result', async () => {
    installGeneratedFixture()
    const cleanup = registerAwesomePhysicsAdapters()
    const registry = useAwesomePhysicsRegistry()
    const available = simulations.items.filter(({ availability, execution }) => availability === 'available' && execution !== 'wasm')
    expect(available.length).toBeGreaterThan(0)

    for (const descriptor of available) {
      const adapter = await registry.loadAdapter(descriptor.id)
      const input = awesomePhysicsDefaultInput(descriptor.adapterId ?? '')
      expect(input).not.toBeNull()
      const output = await adapter?.run(input)
      const encoded = JSON.stringify(output)
      expect(encoded).not.toBeUndefined()
      expect(JSON.parse(encoded ?? '')).toEqual(output)
      const visit = (value: unknown): void => {
        if (typeof value === 'number') {
          expect(Number.isFinite(value)).toBe(true)
          return
        }
        if (Array.isArray(value)) {
          value.forEach(visit)
          return
        }
        if (value !== null && typeof value === 'object') Object.values(value).forEach(visit)
      }
      visit(output)
    }

    cleanup()
  })

  it('does not register unavailable or blocked descriptors', async () => {
    installGeneratedFixture()
    const registry = useAwesomePhysicsRegistry()
    const cleanup = registerAwesomePhysicsAdapters()

    for (const descriptor of simulations.items.filter(({ availability }) => availability !== 'available')) {
      await expect(registry.loadAdapter(descriptor.id)).rejects.toThrow(/not runnable/)
    }

    cleanup()
  })
})
