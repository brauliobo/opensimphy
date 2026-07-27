import { vi } from 'vitest'
import completionJson from '../../public/data/generated/completion.json'
import taxonomyJson from '../../public/data/generated/taxonomy.json'
import tourChapterJson from '../../public/data/generated/tour/chapters/units.json'
import tourGlossaryJson from '../../public/data/generated/tour/glossary.json'
import tourLessonJson from '../../public/data/generated/tour/lessons/physical-quantities.json'
import tourManifestJson from '../../public/data/generated/tour/manifest.json'
import tourReferencesJson from '../../public/data/generated/tour/references.json'
import tourSimulationJson from '../../public/data/generated/tour/simulations/dimensional-equation-builder.json'
import wallsJson from '../../public/data/generated/walls.json'
import { resetCompletionRegistryForTests, setCompletionRegistryForTests, useCompletionRegistry } from '../../src/registries/completionRegistry'
import { resetCoreRegistryForTests, setCoreRegistryForTests, useCoreRegistry } from '../../src/registries/coreRegistry'
import { resetFormulaRegistryForTests, setFormulaRegistryForTests, useFormulaRegistry } from '../../src/registries/formulaRegistry'
import { resetTaxonomyRegistryForTests, setTaxonomyRegistryForTests, useTaxonomyRegistry } from '../../src/registries/taxonomyRegistry'
import { resetTourRegistryForTests, setTourRegistryForTests, useTourRegistry } from '../../src/registries/tourRegistry'
import { resetWallRegistryForTests, setWallRegistryForTests, useWallRegistry } from '../../src/registries/wallRegistry'
import type { CompletionReport, TaxonomyArtifact } from '../../src/types/engine'
import type {
  TourGeneratedChapterRecord,
  TourGeneratedLessonRecord,
  TourGeneratedManifest,
  TourGeneratedSimulation,
  TourGlossarySource,
  TourReferencesSource,
} from '../../src/types/tour'
import { coreCase, formula, wall } from './fixtures'

const generatedCompletion = completionJson as CompletionReport
const generatedTaxonomy = taxonomyJson as TaxonomyArtifact
const generatedTourManifest = tourManifestJson as TourGeneratedManifest
const generatedTourChapter = tourChapterJson as TourGeneratedChapterRecord
const generatedTourLesson = tourLessonJson as TourGeneratedLessonRecord
const generatedTourSimulation = tourSimulationJson as TourGeneratedSimulation
const generatedTourGlossary = tourGlossaryJson as TourGlossarySource
const generatedTourReferences = tourReferencesJson as TourReferencesSource

function jsonResponse(value: unknown) {
  return { ok: true, status: 200, json: async () => value }
}

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

  it('initializes from only the tour manifest and taxonomy before lazily loading one chapter shard', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/data/generated/tour/manifest.json')) return jsonResponse(generatedTourManifest)
      if (url.endsWith('/data/generated/taxonomy.json')) return jsonResponse(generatedTaxonomy)
      if (url.endsWith('/data/generated/tour/chapters/units.json')) return jsonResponse(generatedTourChapter)
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const registry = useTourRegistry()

    await registry.initialize()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(expect.arrayContaining([
      expect.stringContaining('/data/generated/tour/manifest.json'),
      expect.stringContaining('/data/generated/taxonomy.json'),
    ]))

    await expect(registry.chapterById('units')).resolves.toEqual(generatedTourChapter)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it.each([
    ['unknown root key', (candidate: TourGeneratedManifest) => { (candidate as TourGeneratedManifest & { extra?: boolean }).extra = true }, /unknown properties/],
    ['station order', (candidate: TourGeneratedManifest) => { candidate.quickStations[0]!.order = 2 }, /order must be 1/],
    ['non-positive station minutes', (candidate: TourGeneratedManifest) => { candidate.quickStations[0]!.estimatedMinutes = 0 }, /positive integer/],
    ['duplicate station glossary ID', (candidate: TourGeneratedManifest) => { candidate.quickStations[0]!.glossaryIds!.push(candidate.quickStations[0]!.glossaryIds![0]!) }, /unique values/],
    ['current count summary drift', (candidate: TourGeneratedManifest) => { candidate.counts.lessons = 2 }, /current content summary/],
    ['current revision drift', (candidate: TourGeneratedManifest) => { candidate.contentRevision = '2026-07-28' }, /must be 2026-07-27/],
    ['content-ready ownership drift', (candidate: TourGeneratedManifest) => { candidate.quickStations[0]!.lessonId = 'unknown-lesson' }, /content-ready chapter/],
    ['chapter coverage drift', (candidate: TourGeneratedManifest) => { candidate.chapters.pop() }, /20 chapters/],
    ['station coverage drift', (candidate: TourGeneratedManifest) => { candidate.quickStations.pop() }, /8 stations/],
    ['duplicate station ID', (candidate: TourGeneratedManifest) => { candidate.quickStations[1]!.id = candidate.quickStations[0]!.id }, /unique values/],
    ['attribution inheritance drift', (candidate: TourGeneratedManifest) => { candidate.attributionPolicy.inheritance = 'other' as never }, /nearest-attributed-ancestor/],
  ])('rejects eager Tour manifest %s', (_name, mutate, expected) => {
    const candidate = structuredClone(generatedTourManifest)
    mutate(candidate)

    setTourRegistryForTests({ manifest: candidate, taxonomy: generatedTaxonomy })

    expect(useTourRegistry().manifest.value).toBeNull()
    expect(useTourRegistry().error.value?.message).toMatch(expected)
  })

  it('deduplicates in-flight tour shards and caches successful records', async () => {
    setTourRegistryForTests({ manifest: generatedTourManifest, taxonomy: generatedTaxonomy })
    let resolveJson!: (value: TourGeneratedChapterRecord) => void
    const json = new Promise<TourGeneratedChapterRecord>((resolve) => { resolveJson = resolve })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => json })
    vi.stubGlobal('fetch', fetchMock)
    const registry = useTourRegistry()

    const first = registry.chapterById('units')
    const second = registry.chapterById('units')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    resolveJson(generatedTourChapter)

    await expect(Promise.all([first, second])).resolves.toEqual([generatedTourChapter, generatedTourChapter])
    await expect(registry.chapterById('units')).resolves.toEqual(generatedTourChapter)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('returns null without fetching for unknown or path-traversal tour IDs', async () => {
    setTourRegistryForTests({ manifest: generatedTourManifest, taxonomy: generatedTaxonomy })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const registry = useTourRegistry()

    await expect(registry.chapterById('../units')).resolves.toBeNull()
    await expect(registry.lessonById('unknown-lesson')).resolves.toBeNull()
    await expect(registry.simulationById('unknown/simulation')).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects mismatched IDs and lesson ownership without caching corrupt shards', async () => {
    setTourRegistryForTests({ manifest: generatedTourManifest, taxonomy: generatedTaxonomy })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ...generatedTourChapter, id: 'measurement' }))
      .mockResolvedValueOnce(jsonResponse({ ...generatedTourLesson, chapterId: 'measurement' }))
    vi.stubGlobal('fetch', fetchMock)
    const registry = useTourRegistry()

    await expect(registry.chapterById('units')).rejects.toThrow(/requested ID/)
    await expect(registry.lessonById('physical-quantities')).rejects.toThrow(/chapter ownership/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects a current manifest that removes one content-ready station simulation declaration', async () => {
    const manifestWithoutStationSimulation = {
      ...generatedTourManifest,
      quickStations: generatedTourManifest.quickStations.map((station) => station.id === 'anchors-scales'
        ? { ...station, status: 'planned' as const, lessonId: null, simulationId: null }
        : station),
    }
    setTourRegistryForTests({ manifest: manifestWithoutStationSimulation, taxonomy: generatedTaxonomy })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(useTourRegistry().manifest.value).toBeNull()
    expect(useTourRegistry().error.value?.message).toContain('simulation coverage')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loads and caches glossary and reference collections independently', async () => {
    setTourRegistryForTests({ manifest: generatedTourManifest, taxonomy: generatedTaxonomy })
    const fetchMock = vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/glossary.json')) return jsonResponse(generatedTourGlossary)
      if (url.endsWith('/references.json')) return jsonResponse(generatedTourReferences)
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const registry = useTourRegistry()

    await expect(Promise.all([registry.loadGlossary(), registry.loadReferences()])).resolves.toEqual([
      generatedTourGlossary,
      generatedTourReferences,
    ])
    await registry.loadGlossary()
    await registry.loadReferences()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('isolates consumer cancellation while a deduplicated shard succeeds and populates cache', async () => {
    setTourRegistryForTests({ manifest: generatedTourManifest, taxonomy: generatedTaxonomy })
    let resolveJson!: (value: TourGeneratedChapterRecord) => void
    const json = new Promise<TourGeneratedChapterRecord>((resolve) => { resolveJson = resolve })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => json })
    vi.stubGlobal('fetch', fetchMock)
    const registry = useTourRegistry()
    const abortController = new AbortController()

    const cancelled = registry.chapterById('units', abortController.signal)
    const shared = registry.chapterById('units')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    abortController.abort()
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
    const fetchSignal = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.signal
    expect(fetchSignal?.aborted).toBe(false)
    resolveJson(generatedTourChapter)

    await expect(shared).resolves.toEqual(generatedTourChapter)
    await expect(registry.chapterById('units')).resolves.toEqual(generatedTourChapter)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('evicts an underlying shard failure so a later call retries', async () => {
    setTourRegistryForTests({ manifest: generatedTourManifest, taxonomy: generatedTaxonomy })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(jsonResponse(generatedTourChapter))
    vi.stubGlobal('fetch', fetchMock)
    const registry = useTourRegistry()

    await expect(registry.chapterById('units')).rejects.toThrow('(503)')
    await expect(registry.chapterById('units')).resolves.toEqual(generatedTourChapter)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('invalidates a stale lazy completion on reset and does not cache it', async () => {
    setTourRegistryForTests({ manifest: generatedTourManifest, taxonomy: generatedTaxonomy })
    let resolveJson!: (value: TourGeneratedChapterRecord) => void
    const json = new Promise<TourGeneratedChapterRecord>((resolve) => { resolveJson = resolve })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => json })
      .mockResolvedValueOnce(jsonResponse(generatedTourChapter))
    vi.stubGlobal('fetch', fetchMock)
    const registry = useTourRegistry()

    const pending = registry.chapterById('units')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    resetTourRegistryForTests()
    const signal = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.signal
    expect(signal?.aborted).toBe(true)
    resolveJson(generatedTourChapter)
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })

    setTourRegistryForTests({ manifest: generatedTourManifest, taxonomy: generatedTaxonomy })
    await expect(registry.chapterById('units')).resolves.toEqual(generatedTourChapter)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('preloads optional tour fixture shards and clears them on reset', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    setTourRegistryForTests({
      manifest: generatedTourManifest,
      taxonomy: generatedTaxonomy,
      chapters: [generatedTourChapter],
      lessons: [generatedTourLesson],
      simulations: [generatedTourSimulation],
      glossary: generatedTourGlossary,
      references: generatedTourReferences,
    })
    const registry = useTourRegistry()

    await expect(registry.chapterById('units')).resolves.toEqual(generatedTourChapter)
    await expect(registry.lessonById('physical-quantities')).resolves.toEqual(generatedTourLesson)
    await expect(registry.simulationById('dimensional-equation-builder')).resolves.toEqual(generatedTourSimulation)
    await expect(registry.loadGlossary()).resolves.toEqual(generatedTourGlossary)
    await expect(registry.loadReferences()).resolves.toEqual(generatedTourReferences)
    expect(fetchMock).not.toHaveBeenCalled()

    resetTourRegistryForTests()
    await expect(registry.chapterById('units')).resolves.toBeNull()
    await expect(registry.loadGlossary()).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['block body', (lesson: TourGeneratedLessonRecord) => { (lesson.guidedBlocks[0] as unknown as { body: unknown[] }).body = [7] }, /guidedBlocks\[0\]\.body\[0\]/],
    ['checkpoint choice', (lesson: TourGeneratedLessonRecord) => { lesson.checkpoints[0]!.choices[0]!.label = '' }, /checkpoints\[0\]\.choices\[0\]\.label/],
    ['conclusion attribution', (lesson: TourGeneratedLessonRecord) => { delete (lesson.establishes[0]!.attribution as unknown as { sourceLocator?: string }).sourceLocator }, /establishes\[0\]\.attribution.*sourceLocator/],
    ['observation item', (lesson: TourGeneratedLessonRecord) => { (lesson.observationStage.items[0] as unknown as { value: unknown }).value = 'exact' }, /observationStage\.items\[0\]\.value/],
    ['observation role', (lesson: TourGeneratedLessonRecord) => { lesson.observationStage.items[0]!.role = 'reference' as never }, /observationStage\.items\[0\]\.role/],
  ])('rejects a malformed nested lesson %s at the lazy boundary', async (_name, mutate, expected) => {
    setTourRegistryForTests({ manifest: generatedTourManifest, taxonomy: generatedTaxonomy })
    const candidate = structuredClone(generatedTourLesson)
    mutate(candidate)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(candidate)))

    await expect(useTourRegistry().lessonById('physical-quantities')).rejects.toThrow(expected)
  })

  it.each([
    'fixed-definition',
    'measured-reference',
    'derived-model-value',
    'conventional-value',
    'model-input',
    'illustrative-scale',
    'practical-realization',
  ] as const)('accepts observation item role %s at the lazy boundary', async (role) => {
    setTourRegistryForTests({ manifest: generatedTourManifest, taxonomy: generatedTaxonomy })
    const candidate = structuredClone(generatedTourLesson)
    candidate.observationStage.items[0]!.role = role
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(candidate)))

    await expect(useTourRegistry().lessonById('physical-quantities')).resolves.toEqual(candidate)
  })

  it.each([
    ['select option', (simulation: TourGeneratedSimulation) => { (simulation.controls[0] as Extract<TourGeneratedSimulation['controls'][number], { type: 'select' }>).options[0]!.label = '' }, /controls\[0\]\.options\[0\]\.label/],
    ['preset input', (simulation: TourGeneratedSimulation) => { delete simulation.presets[0]!.inputs.target }, /presets\[0\]\.inputs.*target/],
    ['output field', (simulation: TourGeneratedSimulation) => { (simulation.outputSchema[0] as unknown as { nullable: unknown }).nullable = 'false' }, /outputSchema\[0\]\.nullable/],
    ['visualization alternative', (simulation: TourGeneratedSimulation) => { simulation.visualization.alternatives[0]!.description = '' }, /visualization\.alternatives\[0\]\.description/],
    ['runtime operations', (simulation: TourGeneratedSimulation) => { if (simulation.limits.tier === 'immediate') simulation.limits.maxOperations = 0 }, /limits\.maxOperations/],
    ['runtime limits', (simulation: TourGeneratedSimulation) => { (simulation.limits as unknown as { maxDurationMs: number }).maxDurationMs = 0 }, /limits\.maxDurationMs/],
    ['compatibility key', (simulation: TourGeneratedSimulation) => { simulation.comparison.compatibilityKey = 'not-a-hash' }, /comparison\.compatibilityKey/],
    ['implementation revision', (simulation: TourGeneratedSimulation) => { simulation.revision.implementationRevision = 'other-engine' }, /revision\.implementationRevision/],
  ])('rejects a malformed nested simulation %s at the lazy boundary', async (_name, mutate, expected) => {
    setTourRegistryForTests({ manifest: generatedTourManifest, taxonomy: generatedTaxonomy })
    const candidate = structuredClone(generatedTourSimulation)
    mutate(candidate)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(candidate)))

    await expect(useTourRegistry().simulationById('dimensional-equation-builder')).rejects.toThrow(expected)
  })

  it('rejects malformed glossary and reference entry fields at their lazy boundaries', async () => {
    setTourRegistryForTests({ manifest: generatedTourManifest, taxonomy: generatedTaxonomy })
    const malformedGlossary = structuredClone(generatedTourGlossary)
    malformedGlossary.entries[0]!.guidedDefinition = ''
    const malformedReferences = structuredClone(generatedTourReferences)
    malformedReferences.entries[0]!.accessStatus = 'not-a-status' as never
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(malformedGlossary))
      .mockResolvedValueOnce(jsonResponse(malformedReferences))
    vi.stubGlobal('fetch', fetchMock)
    const registry = useTourRegistry()

    await expect(registry.loadGlossary()).rejects.toThrow(/entries\[0\]\.guidedDefinition/)
    await expect(registry.loadReferences()).rejects.toThrow(/entries\[0\]\.accessStatus/)
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
