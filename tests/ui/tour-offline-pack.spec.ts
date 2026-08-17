import taxonomyJson from '../../public/data/generated/taxonomy.json'
import claimVocabularyJson from '../../public/data/generated/tour/claim-vocabulary.json'
import anchorsChapterJson from '../../public/data/generated/tour/chapters/anchors.json'
import atomicStructureChapterJson from '../../public/data/generated/tour/chapters/atomic-structure.json'
import electricalStandardsChapterJson from '../../public/data/generated/tour/chapters/electrical-standards.json'
import heatMatterChapterJson from '../../public/data/generated/tour/chapters/heat-matter.json'
import particleScalesChapterJson from '../../public/data/generated/tour/chapters/particle-scales.json'
import spinMagnetismChapterJson from '../../public/data/generated/tour/chapters/spin-magnetism.json'
import unitBridgesChapterJson from '../../public/data/generated/tour/chapters/unit-bridges.json'
import chapterJson from '../../public/data/generated/tour/chapters/units.json'
import glossaryJson from '../../public/data/generated/tour/glossary.json'
import blackbodyLessonJson from '../../public/data/generated/tour/lessons/blackbody-radiation.json'
import clocksLessonJson from '../../public/data/generated/tour/lessons/clocks-action-light-gravity.json'
import hydrogenLessonJson from '../../public/data/generated/tour/lessons/hydrogen-spectra.json'
import particleMassLessonJson from '../../public/data/generated/tour/lessons/particle-mass-scales.json'
import particleToMoleLessonJson from '../../public/data/generated/tour/lessons/particle-to-mole.json'
import photonLessonJson from '../../public/data/generated/tour/lessons/photon-equivalent-scales.json'
import lessonJson from '../../public/data/generated/tour/lessons/physical-quantities.json'
import electricalLessonJson from '../../public/data/generated/tour/lessons/quantum-electrical-standards.json'
import spinLessonJson from '../../public/data/generated/tour/lessons/spin-precession.json'
import manifestJson from '../../public/data/generated/tour/manifest.json'
import referencesJson from '../../public/data/generated/tour/references.json'
import blackbodySimulationJson from '../../public/data/generated/tour/simulations/blackbody-spectrum.json'
import simulationJson from '../../public/data/generated/tour/simulations/dimensional-equation-builder.json'
import electricalSimulationJson from '../../public/data/generated/tour/simulations/electrical-standards-network.json'
import hydrogenSimulationJson from '../../public/data/generated/tour/simulations/hydrogen-spectrum-explorer.json'
import particleSimulationJson from '../../public/data/generated/tour/simulations/particle-scale-comparator.json'
import particleToMoleSimulationJson from '../../public/data/generated/tour/simulations/particle-to-mole-scaler.json'
import photonSimulationJson from '../../public/data/generated/tour/simulations/photon-scale-converter.json'
import scaleRulerSimulationJson from '../../public/data/generated/tour/simulations/physical-scale-ruler.json'
import spinSimulationJson from '../../public/data/generated/tour/simulations/spin-precession-visualizer.json'
import {
  resetTourOfflinePackForTests,
  setTourOfflinePackDependenciesForTests,
  useTourOfflinePack,
} from '../../src/registries/tourOfflinePack'
import { resetTaxonomyRegistryForTests, setTaxonomyRegistryForTests } from '../../src/registries/taxonomyRegistry'
import {
  resetTourRegistryForTests,
  setTourRegistryForTests,
  useTourRegistry,
  validateTourOfflinePackResources,
} from '../../src/registries/tourRegistry'
import {
  clearTourOfflinePacks,
  GUIDED_TOUR_CACHE_PREFIX,
  inspectTourOfflinePack,
  installTourOfflinePack,
  tourOfflinePackUrls,
  type TourOfflinePackEnvironment,
} from '../../src/tour/offlinePack'
import type { TaxonomyArtifact } from '../../src/types/engine'
import type { TourGeneratedManifest } from '../../src/types/tour'

const origin = 'https://example.test'
const baseUrl = '/physics/'
const manifest = manifestJson as TourGeneratedManifest
const taxonomy = taxonomyJson as TaxonomyArtifact
const chapterResources = new Map<string, unknown>([
  ['units', chapterJson],
  ['anchors', anchorsChapterJson],
  ['unit-bridges', unitBridgesChapterJson],
  ['electrical-standards', electricalStandardsChapterJson],
  ['atomic-structure', atomicStructureChapterJson],
  ['particle-scales', particleScalesChapterJson],
  ['spin-magnetism', spinMagnetismChapterJson],
  ['heat-matter', heatMatterChapterJson],
])
const lessonResources = new Map<string, unknown>([
  ['physical-quantities', lessonJson],
  ['clocks-action-light-gravity', clocksLessonJson],
  ['photon-equivalent-scales', photonLessonJson],
  ['quantum-electrical-standards', electricalLessonJson],
  ['hydrogen-spectra', hydrogenLessonJson],
  ['particle-mass-scales', particleMassLessonJson],
  ['spin-precession', spinLessonJson],
  ['blackbody-radiation', blackbodyLessonJson],
  ['particle-to-mole', particleToMoleLessonJson],
])
const simulationResources = new Map<string, any>([
  ['dimensional-equation-builder', simulationJson],
  ['physical-scale-ruler', scaleRulerSimulationJson],
  ['photon-scale-converter', photonSimulationJson],
  ['electrical-standards-network', electricalSimulationJson],
  ['hydrogen-spectrum-explorer', hydrogenSimulationJson],
  ['particle-scale-comparator', particleSimulationJson],
  ['spin-precession-visualizer', spinSimulationJson],
  ['blackbody-spectrum', blackbodySimulationJson],
  ['particle-to-mole-scaler', particleToMoleSimulationJson],
])

function requestUrl(input: RequestInfo | URL): string {
  if (input instanceof Request) return input.url
  return new URL(String(input), origin).href
}

class MemoryCache {
  readonly entries = new Map<string, Response>()

  async match(input: RequestInfo | URL): Promise<Response | undefined> {
    return this.entries.get(requestUrl(input))?.clone()
  }

  async put(input: RequestInfo | URL, response: Response): Promise<void> {
    this.entries.set(requestUrl(input), response.clone())
  }

  async keys(): Promise<readonly Request[]> {
    return [...this.entries.keys()].map((url) => new Request(url))
  }
}

class MemoryCacheStorage {
  readonly caches = new Map<string, MemoryCache>()
  keysBarrier: Promise<void> | null = null
  onKeys: (() => void) | null = null

  async open(cacheName: string): Promise<Cache> {
    if (!this.caches.has(cacheName)) this.caches.set(cacheName, new MemoryCache())
    return this.caches.get(cacheName)! as unknown as Cache
  }

  async keys(): Promise<string[]> {
    this.onKeys?.()
    if (this.keysBarrier) await this.keysBarrier
    return [...this.caches.keys()]
  }

  async delete(cacheName: string): Promise<boolean> {
    return this.caches.delete(cacheName)
  }
}

function dataFor(url: string, ownerManifest: TourGeneratedManifest = manifest): unknown {
  if (url.endsWith('/tour/manifest.json')) return ownerManifest
  if (url.endsWith('/taxonomy.json')) return taxonomyJson
  if (url.endsWith('/tour/claim-vocabulary.json')) return claimVocabularyJson
  if (url.endsWith('/tour/glossary.json')) return glossaryJson
  if (url.endsWith('/tour/references.json')) return referencesJson
  for (const [id, chapter] of chapterResources) {
    if (url.endsWith(`/tour/chapters/${id}.json`)) return chapter
  }
  for (const [id, lesson] of lessonResources) {
    if (url.endsWith(`/tour/lessons/${id}.json`)) return lesson
  }
  for (const [id, simulation] of simulationResources) {
    if (url.endsWith(`/tour/simulations/${id}.json`)) {
      return {
        ...simulation,
        revision: { ...simulation.revision, contentRevision: ownerManifest.contentRevision },
      }
    }
  }
  throw new Error(`Unexpected Tour pack URL: ${url}`)
}

function successfulFetch(bodies = new Map<string, string>(), ownerManifest: TourGeneratedManifest = manifest): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const body = JSON.stringify(dataFor(url, ownerManifest))
    bodies.set(url, body)
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
}

function environment(storage: MemoryCacheStorage, fetcher = successfulFetch()): TourOfflinePackEnvironment {
  return {
    cacheStorage: storage as unknown as CacheStorage,
    fetch: fetcher,
    now: () => '2026-07-27T12:00:00.000Z',
    installId: () => 'test-install',
    baseUrl,
    origin,
    validateResources: validateTourOfflinePackResources,
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('Guided Tour offline pack', () => {
  afterEach(() => {
    resetTourOfflinePackForTests()
    resetTourRegistryForTests()
    resetTaxonomyRegistryForTests()
    vi.unstubAllGlobals()
  })

  it('derives only content-ready Guided resources under the application base path', () => {
    expect(tourOfflinePackUrls(manifest, { baseUrl, origin })).toEqual([
      '/physics/data/generated/tour/manifest.json',
      '/physics/data/generated/taxonomy.json',
      '/physics/data/generated/tour/claim-vocabulary.json',
      '/physics/data/generated/tour/glossary.json',
      '/physics/data/generated/tour/references.json',
      '/physics/data/generated/tour/chapters/units.json',
      '/physics/data/generated/tour/chapters/anchors.json',
      '/physics/data/generated/tour/chapters/unit-bridges.json',
      '/physics/data/generated/tour/chapters/electrical-standards.json',
      '/physics/data/generated/tour/chapters/atomic-structure.json',
      '/physics/data/generated/tour/chapters/particle-scales.json',
      '/physics/data/generated/tour/chapters/spin-magnetism.json',
      '/physics/data/generated/tour/chapters/heat-matter.json',
      '/physics/data/generated/tour/lessons/physical-quantities.json',
      '/physics/data/generated/tour/lessons/clocks-action-light-gravity.json',
      '/physics/data/generated/tour/lessons/photon-equivalent-scales.json',
      '/physics/data/generated/tour/lessons/quantum-electrical-standards.json',
      '/physics/data/generated/tour/lessons/hydrogen-spectra.json',
      '/physics/data/generated/tour/lessons/particle-mass-scales.json',
      '/physics/data/generated/tour/lessons/spin-precession.json',
      '/physics/data/generated/tour/lessons/blackbody-radiation.json',
      '/physics/data/generated/tour/lessons/particle-to-mole.json',
      '/physics/data/generated/tour/simulations/dimensional-equation-builder.json',
      '/physics/data/generated/tour/simulations/physical-scale-ruler.json',
      '/physics/data/generated/tour/simulations/photon-scale-converter.json',
      '/physics/data/generated/tour/simulations/electrical-standards-network.json',
      '/physics/data/generated/tour/simulations/hydrogen-spectrum-explorer.json',
      '/physics/data/generated/tour/simulations/particle-scale-comparator.json',
      '/physics/data/generated/tour/simulations/spin-precession-visualizer.json',
      '/physics/data/generated/tour/simulations/blackbody-spectrum.json',
      '/physics/data/generated/tour/simulations/particle-to-mole-scaler.json',
    ])

    const unsafe = structuredClone(manifest)
    unsafe.quickStations.find(({ status }) => status === 'content-ready')!.simulationId = '../simulation'
    expect(() => tourOfflinePackUrls(unsafe, { baseUrl, origin })).toThrow('safe ID')
    expect(() => tourOfflinePackUrls(manifest, { baseUrl: 'https://other.test/app/', origin })).toThrow('same-origin')
  })

  it('installs validated JSON transactionally and records exact response bytes', async () => {
    const storage = new MemoryCacheStorage()
    storage.caches.set(`${GUIDED_TOUR_CACHE_PREFIX}older-pack`, new MemoryCache())
    storage.caches.set('unrelated-cache', new MemoryCache())
    const bodies = new Map<string, string>()
    const installed = await installTourOfflinePack(manifest, environment(storage, successfulFetch(bodies)))

    expect(installed.cacheName).toBe(`${GUIDED_TOUR_CACHE_PREFIX}2026-07-27-test-install`)
    expect(installed.metadata.urls).toHaveLength(31)
    expect(installed.metadata.bytes).toBe([...bodies.values()].reduce((sum, body) => sum + new TextEncoder().encode(body).byteLength, 0))
    expect(installed.metadata.installedAt).toBe('2026-07-27T12:00:00.000Z')
    expect(await inspectTourOfflinePack(manifest.contentRevision, environment(storage))).toEqual(installed)
    expect(await storage.keys()).toEqual(expect.arrayContaining([
      expect.stringContaining(`${GUIDED_TOUR_CACHE_PREFIX}2026-07-27`),
      'unrelated-cache',
    ]))
  })

  it('deletes a partial failed transaction and preserves the previous complete pack', async () => {
    const storage = new MemoryCacheStorage()
    const oldManifest = { ...manifest, contentRevision: '2026-07-25' }
    const oldEnvironment = { ...environment(storage, successfulFetch(new Map(), oldManifest)), installId: () => 'old', validateResources: () => {} }
    await installTourOfflinePack(oldManifest, oldEnvironment)

    let request = 0
    const failingFetch = vi.fn(async (input: RequestInfo | URL) => {
      request += 1
      if (request === 4) return new Response('{"error":true}', { status: 503 })
      return new Response(JSON.stringify(dataFor(String(input))), { status: 200 })
    }) as typeof fetch
    await expect(installTourOfflinePack(manifest, { ...environment(storage, failingFetch), installId: () => 'failed' })).rejects.toThrow('(503)')

    expect(await inspectTourOfflinePack('2026-07-25', environment(storage))).not.toBeNull()
    expect(await inspectTourOfflinePack(manifest.contentRevision, environment(storage))).toBeNull()
    expect((await storage.keys()).filter((name) => name.startsWith(GUIDED_TOUR_CACHE_PREFIX))).toHaveLength(1)
  })

  it('rejects invalid JSON without replacing an installed pack', async () => {
    const storage = new MemoryCacheStorage()
    const oldManifest = { ...manifest, contentRevision: '2026-07-25' }
    await installTourOfflinePack(oldManifest, { ...environment(storage, successfulFetch(new Map(), oldManifest)), installId: () => 'old', validateResources: () => {} })
    const invalidJsonFetch = vi.fn(async () => new Response('not json', { status: 200 })) as typeof fetch

    await expect(installTourOfflinePack(manifest, { ...environment(storage, invalidJsonFetch), installId: () => 'invalid' })).rejects.toThrow('invalid JSON')
    expect(await inspectTourOfflinePack('2026-07-25', environment(storage))).not.toBeNull()
  })

  it('rejects valid JSON with a corrupt nested schema before replacing an installed pack', async () => {
    const storage = new MemoryCacheStorage()
    const oldManifest = { ...manifest, contentRevision: '2026-07-25' }
    await installTourOfflinePack(oldManifest, { ...environment(storage, successfulFetch(new Map(), oldManifest)), installId: () => 'old', validateResources: () => {} })
    const corruptLesson = structuredClone(lessonJson)
    ;(corruptLesson.observationStage.items[0] as unknown as { value: unknown }).value = 'not-a-number'
    const corruptFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const value = url.endsWith('/tour/lessons/physical-quantities.json') ? corruptLesson : dataFor(url)
      return new Response(JSON.stringify(value), { status: 200 })
    }) as typeof fetch

    await expect(installTourOfflinePack(manifest, { ...environment(storage, corruptFetch), installId: () => 'corrupt' })).rejects.toThrow('observationStage.items[0].value')
    expect(await inspectTourOfflinePack('2026-07-25', environment(storage))).not.toBeNull()
    expect(await inspectTourOfflinePack(manifest.contentRevision, environment(storage))).toBeNull()
  })

  it('hydrates and clears singleton state while leaving unrelated caches untouched', async () => {
    const storage = new MemoryCacheStorage()
    storage.caches.set('unrelated-cache', new MemoryCache())
    const dependencies = environment(storage)
    setTourOfflinePackDependenciesForTests(dependencies)
    const pack = useTourOfflinePack()

    await pack.download(manifest)
    expect(pack.status.value).toBe('installed')
    expect(pack.revision.value).toBe(manifest.contentRevision)
    expect(pack.itemCount.value).toBe(31)
    expect(pack.bytes.value).toBeGreaterThan(0)

    resetTourOfflinePackForTests()
    setTourOfflinePackDependenciesForTests(dependencies)
    await pack.hydrate(manifest)
    expect(pack.status.value).toBe('installed')

    await pack.clear()
    expect(pack.status.value).toBe('idle')
    expect(await storage.keys()).toEqual(['unrelated-cache'])
  })

  it('surfaces unsupported Cache Storage as a nonfatal singleton error', async () => {
    setTourOfflinePackDependenciesForTests({ cacheStorage: null, baseUrl, origin })
    const pack = useTourOfflinePack()

    await expect(pack.hydrate(manifest)).resolves.toBeUndefined()
    expect(pack.status.value).toBe('error')
    expect(pack.error.value?.message).toContain('offline storage is unavailable')
    await expect(pack.clear()).resolves.toBeUndefined()
    expect(pack.status.value).toBe('error')
    expect(pack.error.value?.message).toContain('offline storage is unavailable')
    await expect(clearTourOfflinePacks({ cacheStorage: null })).rejects.toThrow('offline storage is unavailable')
  })

  it('ignores a stale hydrate when a newer clear is queued', async () => {
    const storage = new MemoryCacheStorage()
    await installTourOfflinePack(manifest, environment(storage))
    resetTourOfflinePackForTests()
    setTourOfflinePackDependenciesForTests(environment(storage))
    const keysStarted = deferred<void>()
    const releaseKeys = deferred<void>()
    storage.onKeys = () => keysStarted.resolve()
    storage.keysBarrier = releaseKeys.promise
    const pack = useTourOfflinePack()

    const hydration = pack.hydrate(manifest)
    await keysStarted.promise
    const clearing = pack.clear()
    expect(pack.status.value).toBe('idle')
    releaseKeys.resolve()
    await Promise.all([hydration, clearing])

    expect(pack.status.value).toBe('idle')
    expect(pack.revision.value).toBeNull()
    expect((await storage.keys()).filter((name) => name.startsWith(GUIDED_TOUR_CACHE_PREFIX))).toEqual([])
  })

  it('aborts and cleans an active download before a newer clear completes', async () => {
    const storage = new MemoryCacheStorage()
    const fetchStarted = deferred<void>()
    const blockedFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      fetchStarted.resolve()
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
      })
    }) as typeof fetch
    setTourOfflinePackDependenciesForTests(environment(storage, blockedFetch))
    const pack = useTourOfflinePack()

    const download = pack.download(manifest)
    await fetchStarted.promise
    const clearing = pack.clear()
    expect(pack.status.value).toBe('installing')
    await Promise.all([download, clearing])

    expect(pack.status.value).toBe('idle')
    expect(pack.error.value).toBeNull()
    expect((await storage.keys()).filter((name) => name.startsWith(GUIDED_TOUR_CACHE_PREFIX))).toEqual([])
  })

  it('falls back for matching-revision network failures and 5xx responses', async () => {
    const storage = new MemoryCacheStorage()
    const dependencies = { ...environment(storage), baseUrl: '/' }
    await installTourOfflinePack(manifest, dependencies)
    vi.stubGlobal('caches', storage as unknown as CacheStorage)
    setTourRegistryForTests({ manifest, taxonomy })
    const registry = useTourRegistry()

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(registry.chapterById('units')).resolves.toEqual(chapterJson)

    resetTourRegistryForTests()
    setTourRegistryForTests({ manifest, taxonomy })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(useTourRegistry().lessonById('physical-quantities')).resolves.toEqual(lessonJson)
  })

  it('does not fall back for a mismatched revision, 404, or schema error', async () => {
    const storage = new MemoryCacheStorage()
    await installTourOfflinePack(manifest, { ...environment(storage), baseUrl: '/' })
    vi.stubGlobal('caches', storage as unknown as CacheStorage)

    setTourRegistryForTests({ manifest: { ...manifest, contentRevision: '2026-07-28' }, taxonomy })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    expect(useTourRegistry().error.value?.message).toContain('must be 2026-07-27')
    await expect(useTourRegistry().chapterById('units')).resolves.toBeNull()

    resetTourRegistryForTests()
    setTourRegistryForTests({ manifest, taxonomy })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(useTourRegistry().chapterById('units')).rejects.toThrow('(404)')

    resetTourRegistryForTests()
    setTourRegistryForTests({ manifest, taxonomy })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...chapterJson, id: 'wrong-id' }), { status: 200 })))
    await expect(useTourRegistry().chapterById('units')).rejects.toThrow('requested ID')
  })

  it('initializes the manifest from an installed matching pack after a 5xx response', async () => {
    const storage = new MemoryCacheStorage()
    await installTourOfflinePack(manifest, { ...environment(storage), baseUrl: '/' })
    vi.stubGlobal('caches', storage as unknown as CacheStorage)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    const registry = useTourRegistry()
    setTaxonomyRegistryForTests(taxonomy)

    await registry.initialize()
    expect(registry.manifest.value).toEqual(manifest)
    expect(registry.error.value).toBeNull()
  })

  it('initializes taxonomy from the matching explicit pack after its network request fails', async () => {
    const storage = new MemoryCacheStorage()
    await installTourOfflinePack(manifest, { ...environment(storage), baseUrl: '/' })
    vi.stubGlobal('caches', storage as unknown as CacheStorage)
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/tour/manifest.json')) return new Response(JSON.stringify(manifest), { status: 200 })
      if (url.endsWith('/taxonomy.json')) throw new TypeError('offline')
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const registry = useTourRegistry()

    await registry.initialize()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(registry.manifest.value).toEqual(manifest)
    expect(registry.taxonomy.value).toEqual(taxonomy)
    expect(registry.error.value).toBeNull()
  })

  it.each([
    ['mismatched revision', { ...manifest, contentRevision: '2026-07-28' }, { ok: false, status: 503 }, /Tour manifest.contentRevision/],
    ['taxonomy 404', manifest, { ok: false, status: 404 }, /Constant taxonomy failed to load \(404\)/],
    ['taxonomy schema error', manifest, new Response(JSON.stringify({ ...taxonomy, schemaVersion: 2 }), { status: 200 }), /Taxonomy.schemaVersion must be 1/],
  ])('does not use the explicit taxonomy fallback for %s', async (_name, networkManifest, taxonomyResponse, expected) => {
    const storage = new MemoryCacheStorage()
    await installTourOfflinePack(manifest, { ...environment(storage), baseUrl: '/' })
    vi.stubGlobal('caches', storage as unknown as CacheStorage)
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/tour/manifest.json')
      ? new Response(JSON.stringify(networkManifest), { status: 200 })
      : taxonomyResponse))
    const registry = useTourRegistry()

    await registry.initialize()

    expect(registry.manifest.value).toBeNull()
    expect(registry.error.value?.message).toMatch(expected)
  })
})
