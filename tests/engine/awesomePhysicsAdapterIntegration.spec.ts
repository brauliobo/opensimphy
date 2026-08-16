import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import catalogJson from '../../public/data/generated/awesomePhysics/catalog.json'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  registerAwesomePhysicsAdapters,
  resetAwesomePhysicsAdapterRegistrationsForTests,
} from '../../src/awesomePhysics/registerAdapters'
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
const expectedAdapters = new Map([
  ['matter-js', 'matter-js-browser'],
  ['cannon.js', 'cannon-js-browser'],
  ['myphysicslab', 'awesome-myphysicslab-browser-v1'],
  ['webgl-ripples', 'awesome-webgl-ripples-browser-v1'],
  ['particle-clicker', 'awesome-particle-clicker-browser-v1'],
  ['qmsolve', 'awesome-qmsolve-typescript'],
  ['EMpy', 'awesome-empy-typescript'],
  ['pyRT', 'awesome-pyrt-typescript'],
  ['scikit-rf', 'awesome-scikit-rf-typescript'],
  ['fluids', 'awesome-fluids-typescript'],
  ['gala', 'awesome-gala-typescript'],
  ['shut-up-and-calculate', 'awesome-shut-up-and-calculate-typescript'],
  ['poppy', 'awesome-poppy-typescript'],
])

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
    expect(factorySource.match(/await import\(/g)).toHaveLength(expectedAdapters.size)

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
