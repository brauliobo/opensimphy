import { vi } from 'vitest'
import completionJson from '../../public/data/generated/completion.json'
import taxonomyJson from '../../public/data/generated/taxonomy.json'
import tourManifestJson from '../../public/data/generated/tour/manifest.json'
import wallsJson from '../../public/data/generated/walls.json'
import { resetCompletionRegistryForTests, setCompletionRegistryForTests, useCompletionRegistry } from '../../src/registries/completionRegistry'
import { resetCoreRegistryForTests, setCoreRegistryForTests, useCoreRegistry } from '../../src/registries/coreRegistry'
import { resetFormulaRegistryForTests, setFormulaRegistryForTests, useFormulaRegistry } from '../../src/registries/formulaRegistry'
import { resetTaxonomyRegistryForTests, setTaxonomyRegistryForTests, useTaxonomyRegistry } from '../../src/registries/taxonomyRegistry'
import { resetTourRegistryForTests, setTourRegistryForTests, useTourRegistry } from '../../src/registries/tourRegistry'
import { resetWallRegistryForTests, setWallRegistryForTests, useWallRegistry } from '../../src/registries/wallRegistry'
import type { CompletionReport, TaxonomyArtifact } from '../../src/types/engine'
import type { TourGeneratedManifest } from '../../src/types/tour'
import { coreCase, formula, wall } from './fixtures'

const generatedCompletion = completionJson as CompletionReport
const generatedTaxonomy = taxonomyJson as TaxonomyArtifact
const generatedTourManifest = tourManifestJson as TourGeneratedManifest

describe('route-owned registries', () => {
  afterEach(() => {
    resetTourRegistryForTests()
    resetFormulaRegistryForTests()
    resetCoreRegistryForTests()
    resetWallRegistryForTests()
    resetCompletionRegistryForTests()
    resetTaxonomyRegistryForTests()
    vi.unstubAllGlobals()
  })

  it('keeps the tour fixture independent of formula, core, and wall registries', () => {
    setFormulaRegistryForTests([formula(1)])
    setCoreRegistryForTests([coreCase])
    setWallRegistryForTests([wall])

    setTourRegistryForTests({ manifest: generatedTourManifest, taxonomy: generatedTaxonomy })

    expect(useTourRegistry().manifest.value).toEqual(generatedTourManifest)
    expect(useFormulaRegistry().formulas.value).toEqual([formula(1)])
    expect(useCoreRegistry().coreCases.value).toEqual([coreCase])
    expect(useWallRegistry().walls.value).toEqual([wall])

    resetTourRegistryForTests()

    expect(useFormulaRegistry().formulas.value).toEqual([formula(1)])
    expect(useCoreRegistry().coreCases.value).toEqual([coreCase])
    expect(useWallRegistry().walls.value).toEqual([wall])
  })

  it('does not mutate taxonomy when formula fixtures are set or reset', () => {
    setTaxonomyRegistryForTests(generatedTaxonomy)

    setFormulaRegistryForTests([formula(1)])
    resetFormulaRegistryForTests()

    const taxonomyRegistry = useTaxonomyRegistry()
    expect(taxonomyRegistry.ready.value).toBe(true)
    expect(taxonomyRegistry.taxonomy.value).toEqual(generatedTaxonomy)
  })

  it('reports coverage from the generated completion fixture', () => {
    setCompletionRegistryForTests(generatedCompletion)

    const completionRegistry = useCompletionRegistry()
    expect(completionRegistry.complete.value).toBe(true)
    expect(completionRegistry.coverage.value).toEqual([
      { key: 'recipes', label: 'Formula recipes', expected: 288, implemented: 288, evaluated: 288, graphed: 288, simulatable: 0 },
      { key: 'core', label: 'Core cases', expected: 37, implemented: 37, evaluated: 37, graphed: 37, simulatable: 37 },
      { key: 'walls', label: 'Number-wall inputs', expected: 351, implemented: 351, evaluated: 0, graphed: 0, simulatable: 351 },
    ])
  })

  it.each([
    ['recipe count drift', { recipes: { ...generatedCompletion.recipes, graphed: 287 } }, /recipes\.graphed/],
    ['core section drift', { core: { ...generatedCompletion.core, simulatable: 36 } }, /core\.simulatable/],
    ['wall parse drift', { walls: { ...generatedCompletion.walls, parseable: 350 } }, /walls\.parseable/],
    ['unexpected wall graphs', { walls: { ...generatedCompletion.walls, graphed: 1 } }, /walls\.graphed/],
    ['wrong hard source count', { recipes: { ...generatedCompletion.recipes, source: 289, implemented: 289, evaluated: 289, graphed: 289, parseable: 289 } }, /recipes\.source must equal 288/],
  ])('rejects an inconsistent completion report: %s', (_name, section, message) => {
    setCompletionRegistryForTests({ ...generatedCompletion, ...section } as CompletionReport)

    const registry = useCompletionRegistry()
    expect(registry.complete.value).toBe(false)
    expect(registry.report.value).toBeNull()
    expect(registry.error.value?.message).toMatch(message)
  })

  it('requires the report flag and empty issue ledgers even with exact counts', () => {
    setCompletionRegistryForTests({ ...generatedCompletion, complete: false })
    expect(useCompletionRegistry().complete.value).toBe(false)

    setCompletionRegistryForTests({ ...generatedCompletion, errors: ['engine failure'] })
    expect(useCompletionRegistry().complete.value).toBe(false)

    setCompletionRegistryForTests({ ...generatedCompletion, unresolved: ['recipe 9'] })
    expect(useCompletionRegistry().complete.value).toBe(false)
  })

  it('represents loading and errors through a route registry hook', async () => {
    const completionRegistry = useCompletionRegistry()
    expect(completionRegistry.ready.value).toBe(false)
    expect(completionRegistry.error.value).toBeNull()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await completionRegistry.initialize()

    expect(completionRegistry.ready.value).toBe(true)
    expect(completionRegistry.error.value?.message).toBe('Completion report failed to load (503)')
    expect(completionRegistry.report.value).toBeNull()
  })

  it('retries a failed completion load and becomes successful', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => generatedCompletion }))
    const registry = useCompletionRegistry()

    await registry.initialize()
    expect(registry.error.value?.message).toContain('(503)')
    await registry.initialize()

    expect(registry.error.value).toBeNull()
    expect(registry.complete.value).toBe(true)
  })

  it('invalidates and aborts an in-flight completion load on reset', async () => {
    let resolveJson!: (value: CompletionReport) => void
    const json = new Promise<CompletionReport>((resolve) => { resolveJson = resolve })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => json })
    vi.stubGlobal('fetch', fetchMock)
    const registry = useCompletionRegistry()
    const pending = registry.initialize()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())

    resetCompletionRegistryForTests()
    const signal = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.signal
    expect(signal?.aborted).toBe(true)
    resolveJson(generatedCompletion)
    await pending

    expect(registry.ready.value).toBe(false)
    expect(registry.report.value).toBeNull()
    expect(registry.error.value).toBeNull()
  })

  it('retries failed taxonomy, wall, and tour fetch initializers', async () => {
    const taxonomyRegistry = useTaxonomyRegistry()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => generatedTaxonomy }))
    await taxonomyRegistry.initialize()
    await taxonomyRegistry.initialize()
    expect(taxonomyRegistry.taxonomy.value).toEqual(generatedTaxonomy)

    resetTaxonomyRegistryForTests()
    const wallRegistry = useWallRegistry()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => wallsJson }))
    await wallRegistry.initialize()
    await wallRegistry.initialize()
    expect(wallRegistry.walls.value).toHaveLength(351)

    setTaxonomyRegistryForTests(generatedTaxonomy)
    const tourRegistry = useTourRegistry()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => generatedTourManifest }))
    await tourRegistry.initialize()
    await tourRegistry.initialize()
    expect(tourRegistry.manifest.value).toEqual(generatedTourManifest)
  })

  it('starts every registry unloaded after reset', () => {
    resetTourRegistryForTests()
    resetFormulaRegistryForTests()
    resetCoreRegistryForTests()
    resetWallRegistryForTests()
    resetCompletionRegistryForTests()

    expect(useTourRegistry().ready.value).toBe(false)
    expect(useFormulaRegistry().ready.value).toBe(false)
    expect(useCoreRegistry().ready.value).toBe(false)
    expect(useWallRegistry().ready.value).toBe(false)
    expect(useCompletionRegistry().ready.value).toBe(false)
    expect(useTaxonomyRegistry().ready.value).toBe(false)
  })
})
