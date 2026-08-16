import catalogJson from '../../public/data/generated/awesomePhysics/catalog.json'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  parseAwesomePhysicsRegistryArtifacts,
  resetAwesomePhysicsRegistryForTests,
  setAwesomePhysicsRegistryForTests,
  useAwesomePhysicsRegistry,
} from '../../src/registries/awesomePhysicsRegistry'
import type {
  AwesomePhysicsCatalogArtifactV1,
  AwesomePhysicsSimulationArtifactV1,
} from '../../src/types/awesomePhysics'
import { vi } from 'vitest'

const catalog = catalogJson as AwesomePhysicsCatalogArtifactV1
const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
}

function fetchArtifacts(
  nextCatalog: unknown = catalog,
  nextSimulations: unknown = simulations,
): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith('/catalog.json')) return response(nextCatalog)
    if (url.endsWith('/simulations.json')) return response(nextSimulations)
    throw new Error(`Unexpected Awesome Physics URL ${url}`)
  })
}

describe('Awesome Physics runtime registry', () => {
  afterEach(() => {
    resetAwesomePhysicsRegistryForTests()
    vi.unstubAllGlobals()
  })

  it('rejects malformed manifests and cross-artifact drift', () => {
    expect(() => parseAwesomePhysicsRegistryArtifacts(
      { ...catalog, unexpected: true },
      simulations,
    )).toThrow(/unknown properties: unexpected/)
    expect(() => parseAwesomePhysicsRegistryArtifacts(
      catalog,
      { ...simulations, catalogRevision: '0'.repeat(40) },
    )).toThrow(/catalogRevision.*match the catalog revision/)
    expect(() => parseAwesomePhysicsRegistryArtifacts(
      catalog,
      {
        ...simulations,
        items: simulations.items.map((item, index) => index === 0 ? { ...item, catalogItemId: 'missing-catalog-item' } : item),
      },
    )).toThrow(/catalogItemId.*does not resolve/)
    expect(() => parseAwesomePhysicsRegistryArtifacts(
      catalog,
      {
        ...simulations,
        items: simulations.items.map((item, index) => index === 0 ? { ...item, limits: { ...item.limits, maxGridSize: Number.NaN } } : item),
      },
    )).toThrow(/maxGridSize.*finite/)
  })

  it('loads both generated artifacts lazily and resolves catalog and descriptor IDs', async () => {
    const fetch = fetchArtifacts()
    vi.stubGlobal('fetch', fetch)
    const registry = useAwesomePhysicsRegistry()

    expect(fetch).not.toHaveBeenCalled()
    expect(registry.ready.value).toBe(false)
    await registry.initialize()

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(registry.ready.value).toBe(true)
    expect(registry.error.value).toBeNull()
    expect(await registry.catalogItemById('awesome-matter-js')).toMatchObject({ canonicalName: 'matter-js' })
    expect(await registry.descriptorById('awesome-matter-js-capability')).toMatchObject({
      catalogItemId: 'awesome-matter-js',
      runnable: true,
      availability: 'available',
      adapterId: 'matter-js-browser',
    })
    expect(await registry.descriptorByCatalogItemId('awesome-matter-js')).toMatchObject({ id: 'awesome-matter-js-capability' })
    expect(await registry.catalogItemById('not-a-catalog-item')).toBeNull()
    expect(await registry.descriptorById('not-a-descriptor')).toBeNull()
  })

  it('cancels a pending load and prevents stale data from repopulating after reset', async () => {
    let resolveCatalog: ((value: Response) => void) | undefined
    const fetch = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/catalog.json')) {
        return new Promise<Response>((resolve) => {
          resolveCatalog = resolve
          init?.signal?.addEventListener('abort', () => undefined, { once: true })
        })
      }
      return Promise.resolve(response(simulations))
    })
    vi.stubGlobal('fetch', fetch)
    const registry = useAwesomePhysicsRegistry()
    const pending = registry.initialize()
    await vi.waitFor(() => expect(resolveCatalog).toBeDefined())

    resetAwesomePhysicsRegistryForTests()
    resolveCatalog?.(response(catalog))
    await pending
    expect(registry.ready.value).toBe(false)
    expect(registry.catalog.value).toBeNull()
    expect(registry.simulations.value).toBeNull()
  })

  it('loads a validated fixture without fetching and rejects adapter gates before factory execution', async () => {
    const factory = vi.fn(async () => ({
      adapterId: 'future-adapter',
      protocol: 'awesome-physics-adapter-v1' as const,
      compatibility: {
        contentRevision: 'wrong',
        modelRevision: 'wrong',
        implementationRevision: 'wrong',
        outputRevision: 'wrong',
      },
      run: vi.fn(),
    }))
    setAwesomePhysicsRegistryForTests({
      catalog,
      simulations,
      adapterFactories: new Map([['future-adapter', factory]]),
    })
    const registry = useAwesomePhysicsRegistry()

    await registry.initialize()
    expect(registry.ready.value).toBe(true)
    expect(await registry.descriptorById('awesome-bullet3-capability')).toMatchObject({ runnable: false })
    await expect(registry.loadAdapter('awesome-bullet3-capability')).rejects.toThrow(/not runnable/)
    expect(factory).not.toHaveBeenCalled()
    expect(await registry.loadAdapter('missing-descriptor')).toBeNull()
  })

  it('rejects future adapters whose compatibility omits or mismatches a descriptor revision', async () => {
    const availableDescriptor = simulations.items.find(({ availability }) => availability === 'available')
    expect(availableDescriptor).toBeDefined()
    const runnableDescriptor = {
      ...availableDescriptor!,
      adapterId: 'future-adapter',
    }
    const fixtureSimulations = {
      ...simulations,
      items: simulations.items.map((item) => item.id === runnableDescriptor.id ? runnableDescriptor : item),
    }
    const factory = vi.fn(async () => ({
      adapterId: 'future-adapter',
      protocol: 'awesome-physics-adapter-v1' as const,
      compatibility: {
        contentRevision: runnableDescriptor.contentRevision,
        modelRevision: runnableDescriptor.modelRevision,
        implementationRevision: runnableDescriptor.implementationRevision,
        outputRevision: 'wrong-output-revision',
      },
      run: vi.fn(),
    }))

    setAwesomePhysicsRegistryForTests({
      catalog,
      simulations: fixtureSimulations,
      adapterFactories: new Map([['future-adapter', factory]]),
    })
    const registry = useAwesomePhysicsRegistry()

    await expect(registry.loadAdapter(runnableDescriptor.id)).rejects.toThrow(/outputRevision.*match the descriptor revision/)
    expect(factory).toHaveBeenCalledOnce()
  })
})
