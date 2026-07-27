import type { TourGeneratedManifest } from '../types/tour'

export const GUIDED_TOUR_CACHE_PREFIX = 'opensimphy-guided-tour-'

const METADATA_FILENAME = 'offline-pack-metadata.json'
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/
const ATTRIBUTION_KEYS = ['claimClass', 'evidenceRefs', 'sourceRevision', 'sourceLocator', 'methodRelationship', 'modelOrigin', 'resultStatus', 'validatesTheory', 'caveats'] as const
const CLAIM_CLASSES = new Set(['established-definition', 'established-model', 'observed-value', 'source-claim', 'identity', 'assumption', 'calibration', 'exploratory-hypothesis', 'prediction'])
const METHOD_RELATIONSHIPS = new Set(['not-applicable', 'literal-reproduction', 'traditional-baseline', 'contract-validator'])
const MODEL_ORIGINS = new Set(['established-physics', 'source-reproduction', 'traditional-baseline'])
const ATTRIBUTED_ROOTS = ['manifest', 'chapter', 'lesson', 'observation-stage', 'lesson-block', 'equation-step', 'checkpoint', 'simulation', 'finding', 'glossary-entry', 'claim-vocabulary-entry']
const INHERITING_RECORD_KINDS = ['quick-station', 'lesson-quick-path', 'observation-stage-item', 'lesson-block-body', 'checkpoint-choice', 'simulation-equation', 'simulation-assumption', 'control', 'control-option', 'preset', 'output-field', 'visualization', 'visualization-alternative', 'finding-field', 'finding-assumption']
const CURRENT_SUMMARY = { chapters: 20, stations: 8, lessons: 9, simulations: 9, glossary: 27, references: 10 } as const
const CURRENT_SIMULATION_IDS = [
  'dimensional-equation-builder',
  'physical-scale-ruler',
  'photon-scale-converter',
  'electrical-standards-network',
  'hydrogen-spectrum-explorer',
  'particle-scale-comparator',
  'spin-precession-visualizer',
  'blackbody-spectrum',
  'particle-to-mole-scaler',
] as const

export interface TourOfflinePackMetadata {
  schemaVersion: 1
  revision: string
  urls: string[]
  bytes: number
  installedAt: string
}

export interface TourOfflinePackEnvironment {
  cacheStorage?: CacheStorage | null
  fetch?: typeof fetch
  now?: () => string
  baseUrl?: string
  origin?: string
  installId?: () => string
  validateResources?: TourOfflinePackResourceValidator
}

export type TourOfflinePackResourceValidator = (
  resources: ReadonlyMap<string, unknown>,
  manifest: TourGeneratedManifest,
) => void

export interface InstalledTourOfflinePack {
  cacheName: string
  metadata: TourOfflinePackMetadata
}

function environmentOrigin(environment: TourOfflinePackEnvironment): string {
  return environment.origin ?? globalThis.location?.origin ?? 'http://localhost'
}

function environmentBaseUrl(environment: TourOfflinePackEnvironment): string {
  return environment.baseUrl ?? import.meta.env.BASE_URL
}

function cacheStorage(environment: TourOfflinePackEnvironment): CacheStorage {
  const storage = environment.cacheStorage === undefined ? globalThis.caches : environment.cacheStorage
  if (!storage) throw new Error('Guided tour offline storage is unavailable in this browser.')
  return storage
}

function safeId(id: string, label: string): string {
  if (!SAFE_ID.test(id)) throw new TypeError(`${label} must be a safe ID`)
  return id
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(path: string, message: string): never {
  throw new TypeError(`${path} ${message}`)
}

function exactKeys(value: unknown, required: readonly string[], optional: readonly string[], path: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) fail(path, 'must be an object')
  const allowed = new Set([...required, ...optional])
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  const missing = required.filter((key) => !Object.hasOwn(value, key))
  if (unknown.length) fail(path, `has unknown properties: ${unknown.join(', ')}`)
  if (missing.length) fail(path, `is missing properties: ${missing.join(', ')}`)
}

function nonEmptyString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'must be a non-empty string')
}

function safeIdValue(value: unknown, path: string): asserts value is string {
  nonEmptyString(value, path)
  if (!SAFE_ID.test(value)) fail(path, 'must be a safe ID')
}

function idArray(value: unknown, path: string, nonEmpty = false): asserts value is string[] {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0)) fail(path, `must be ${nonEmpty ? 'a non-empty' : 'an'} array`)
  value.forEach((id, index) => safeIdValue(id, `${path}[${index}]`))
  if (new Set(value).size !== value.length) fail(path, 'must contain unique values')
}

function exactValues(value: unknown, expected: readonly string[], path: string): void {
  if (!Array.isArray(value) || value.length !== expected.length || !value.every((entry, index) => entry === expected[index])) {
    fail(path, `must equal [${expected.join(', ')}]`)
  }
}

function attribution(value: unknown, path: string): void {
  exactKeys(value, ATTRIBUTION_KEYS, [], path)
  if (!CLAIM_CLASSES.has(value.claimClass as string)) fail(`${path}.claimClass`, 'is not recognized')
  idArray(value.evidenceRefs, `${path}.evidenceRefs`, true)
  nonEmptyString(value.sourceRevision, `${path}.sourceRevision`)
  nonEmptyString(value.sourceLocator, `${path}.sourceLocator`)
  if (!METHOD_RELATIONSHIPS.has(value.methodRelationship as string)) fail(`${path}.methodRelationship`, 'is not recognized')
  if (!MODEL_ORIGINS.has(value.modelOrigin as string)) fail(`${path}.modelOrigin`, 'is not recognized')
  if (value.resultStatus !== 'not-evaluated') fail(`${path}.resultStatus`, 'must be not-evaluated')
  if (value.validatesTheory !== false) fail(`${path}.validatesTheory`, 'must be false')
  if (!Array.isArray(value.caveats) || !value.caveats.every((entry) => typeof entry === 'string')) fail(`${path}.caveats`, 'must be a string array')
}

function nullableSafeId(value: unknown, path: string): void {
  if (value !== null) safeIdValue(value, path)
}

export function parseTourOfflineManifest(value: unknown): TourGeneratedManifest {
  const manifestKeys = ['schemaVersion', 'contentRevision', 'title', 'thesis', 'attribution', 'readingDepths', 'depthComposition', 'attributionPolicy', 'contentStatusPolicy', 'quickStations', 'chapters', 'counts']
  exactKeys(value, manifestKeys, [], 'Tour manifest')
  if (value.schemaVersion !== 1) fail('Tour manifest.schemaVersion', 'must be 1')
  nonEmptyString(value.contentRevision, 'Tour manifest.contentRevision')
  const revisionDate = new Date(`${value.contentRevision}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.contentRevision) || Number.isNaN(revisionDate.valueOf()) || revisionDate.toISOString().slice(0, 10) !== value.contentRevision) {
    fail('Tour manifest.contentRevision', 'must be an ISO calendar date')
  }
  nonEmptyString(value.title, 'Tour manifest.title')
  nonEmptyString(value.thesis, 'Tour manifest.thesis')
  attribution(value.attribution, 'Tour manifest.attribution')
  exactValues(value.readingDepths, ['guided', 'technical'], 'Tour manifest.readingDepths')
  if (value.depthComposition !== 'technical-includes-guided') fail('Tour manifest.depthComposition', 'must be technical-includes-guided')

  exactKeys(value.attributionPolicy, ['inheritance', 'rule', 'attributedRoots', 'inheritingRecordKinds', 'attribution'], [], 'Tour manifest.attributionPolicy')
  if (value.attributionPolicy.inheritance !== 'nearest-attributed-ancestor') fail('Tour manifest.attributionPolicy.inheritance', 'must be nearest-attributed-ancestor')
  nonEmptyString(value.attributionPolicy.rule, 'Tour manifest.attributionPolicy.rule')
  exactValues(value.attributionPolicy.attributedRoots, ATTRIBUTED_ROOTS, 'Tour manifest.attributionPolicy.attributedRoots')
  exactValues(value.attributionPolicy.inheritingRecordKinds, INHERITING_RECORD_KINDS, 'Tour manifest.attributionPolicy.inheritingRecordKinds')
  attribution(value.attributionPolicy.attribution, 'Tour manifest.attributionPolicy.attribution')

  exactKeys(value.contentStatusPolicy, ['contentReady', 'planned', 'attribution'], [], 'Tour manifest.contentStatusPolicy')
  nonEmptyString(value.contentStatusPolicy.contentReady, 'Tour manifest.contentStatusPolicy.contentReady')
  nonEmptyString(value.contentStatusPolicy.planned, 'Tour manifest.contentStatusPolicy.planned')
  attribution(value.contentStatusPolicy.attribution, 'Tour manifest.contentStatusPolicy.attribution')

  exactKeys(value.counts, ['chapters', 'lessons', 'simulations', 'glossary', 'references'], [], 'Tour manifest.counts')
  const expectedCounts = {
    chapters: CURRENT_SUMMARY.chapters,
    lessons: CURRENT_SUMMARY.lessons,
    simulations: CURRENT_SUMMARY.simulations,
    glossary: CURRENT_SUMMARY.glossary,
    references: CURRENT_SUMMARY.references,
  }
  for (const [key, expected] of Object.entries(expectedCounts)) {
    if (value.counts[key] !== expected) fail(`Tour manifest.counts.${key}`, `must be ${expected} for the current content summary`)
  }

  if (!Array.isArray(value.chapters) || value.chapters.length !== CURRENT_SUMMARY.chapters) {
    fail('Tour manifest.chapters', `must contain ${CURRENT_SUMMARY.chapters} chapters`)
  }
  const chapters = value.chapters as Array<Record<string, unknown>>
  const chapterIds: string[] = []
  for (const [index, chapter] of [...chapters].sort((left, right) => Number(left.order) - Number(right.order)).entries()) {
    const path = `Tour manifest.chapters[${index}]`
    exactKeys(chapter, ['schemaVersion', 'id', 'order', 'act', 'title', 'question', 'summary', 'status', 'quickStationIds', 'lessonIds', 'attribution', 'previousChapterId', 'nextChapterId'], [], path)
    if (chapter.schemaVersion !== 1) fail(`${path}.schemaVersion`, 'must be 1')
    safeIdValue(chapter.id, `${path}.id`)
    chapterIds.push(chapter.id)
    if (chapter.order !== index) fail(`${path}.order`, `must be ${index}`)
    if (!Number.isInteger(chapter.act) || Number(chapter.act) < 1 || Number(chapter.act) > 4) fail(`${path}.act`, 'must be an integer from 1 through 4')
    for (const field of ['title', 'question', 'summary']) nonEmptyString(chapter[field], `${path}.${field}`)
    if (chapter.status !== 'content-ready' && chapter.status !== 'planned') fail(`${path}.status`, 'is not recognized')
    idArray(chapter.quickStationIds, `${path}.quickStationIds`)
    idArray(chapter.lessonIds, `${path}.lessonIds`)
    if (chapter.status === 'content-ready' && chapter.lessonIds.length === 0) fail(`${path}.lessonIds`, 'must not be empty for a content-ready chapter')
    if (chapter.status === 'planned' && chapter.lessonIds.length !== 0) fail(`${path}.lessonIds`, 'must be empty for a planned chapter')
    attribution(chapter.attribution, `${path}.attribution`)
    nullableSafeId(chapter.previousChapterId, `${path}.previousChapterId`)
    nullableSafeId(chapter.nextChapterId, `${path}.nextChapterId`)
    if (chapter.previousChapterId !== (chapters.find((entry) => entry.order === index - 1)?.id ?? null)
      || chapter.nextChapterId !== (chapters.find((entry) => entry.order === index + 1)?.id ?? null)) {
      fail(path, 'navigation is invalid')
    }
  }
  if (new Set(chapterIds).size !== chapterIds.length) fail('Tour manifest chapter IDs', 'must contain unique values')

  if (!Array.isArray(value.quickStations) || value.quickStations.length !== CURRENT_SUMMARY.stations) {
    fail('Tour manifest.quickStations', `must contain ${CURRENT_SUMMARY.stations} stations`)
  }
  const stations = value.quickStations as Array<Record<string, unknown>>
  const stationIds: string[] = []
  let totalMinutes = 0
  for (const [index, station] of stations.entries()) {
    const path = `Tour manifest.quickStations[${index}]`
    exactKeys(station, ['id', 'order', 'title', 'question', 'interaction', 'chapterId', 'lessonId', 'simulationId', 'estimatedMinutes', 'status'], ['glossaryIds'], path)
    safeIdValue(station.id, `${path}.id`)
    stationIds.push(station.id)
    if (station.order !== index + 1) fail(`${path}.order`, `must be ${index + 1}`)
    for (const field of ['title', 'question', 'interaction']) nonEmptyString(station[field], `${path}.${field}`)
    safeIdValue(station.chapterId, `${path}.chapterId`)
    if (!chapterIds.includes(station.chapterId)) fail(`${path}.chapterId`, 'does not resolve to a chapter')
    nullableSafeId(station.lessonId, `${path}.lessonId`)
    nullableSafeId(station.simulationId, `${path}.simulationId`)
    if (station.glossaryIds !== undefined) idArray(station.glossaryIds, `${path}.glossaryIds`, true)
    if (!Number.isSafeInteger(station.estimatedMinutes) || Number(station.estimatedMinutes) <= 0) fail(`${path}.estimatedMinutes`, 'must be a positive integer')
    totalMinutes += Number(station.estimatedMinutes)
    if (station.status !== 'content-ready' && station.status !== 'planned') fail(`${path}.status`, 'is not recognized')
    const owner = chapters.find((chapter) => chapter.id === station.chapterId)!
    if (station.status === 'content-ready') {
      if (owner.status !== 'content-ready') fail(path, 'requires a content-ready chapter')
      if (typeof station.lessonId !== 'string' || !owner.lessonIds.includes(station.lessonId)) fail(`${path}.lessonId`, 'must resolve to its content-ready chapter')
      if (typeof station.simulationId !== 'string') fail(`${path}.simulationId`, 'is required for a content-ready station')
      if (!Array.isArray(station.glossaryIds)) fail(`${path}.glossaryIds`, 'is required for a content-ready station')
    } else if (station.lessonId !== null || station.simulationId !== null) {
      fail(path, 'planned stations cannot declare lesson or simulation IDs')
    }
  }
  if (new Set(stationIds).size !== stationIds.length) fail('Tour manifest quick-station IDs', 'must contain unique values')
  if (totalMinutes < 20 || totalMinutes > 30) fail('Tour manifest quick-station minutes', `must total from 20 through 30, found ${totalMinutes}`)

  for (const chapter of chapters) {
    const owned = stations.filter((station) => station.chapterId === chapter.id).map((station) => station.id)
    if (chapter.quickStationIds.length !== owned.length || !chapter.quickStationIds.every((id, index) => id === owned[index])) {
      fail(`Tour manifest chapter ${String(chapter.id)}`, 'quick-station ownership is invalid')
    }
  }
  const lessonIds = chapters.flatMap((chapter) => chapter.lessonIds as string[])
  if (new Set(lessonIds).size !== lessonIds.length || lessonIds.length !== CURRENT_SUMMARY.lessons) fail('Tour manifest lesson coverage', `must contain ${CURRENT_SUMMARY.lessons} unique lesson`)
  const simulationIds = stations.filter((station) => station.status === 'content-ready').map((station) => station.simulationId as string)
  if (new Set(simulationIds).size !== simulationIds.length || simulationIds.length !== CURRENT_SUMMARY.stations) fail('Tour manifest station simulation coverage', `must contain ${CURRENT_SUMMARY.stations} unique simulations`)
  if (!simulationIds.every((id) => CURRENT_SIMULATION_IDS.includes(id as typeof CURRENT_SIMULATION_IDS[number]))) fail('Tour manifest station simulation coverage', 'contains an unknown current simulation')
  return value as unknown as TourGeneratedManifest
}

function resolvedBase(environment: TourOfflinePackEnvironment): URL {
  const origin = new URL(environmentOrigin(environment))
  const base = new URL(environmentBaseUrl(environment), origin)
  if (base.origin !== origin.origin) throw new TypeError('Guided tour base URL must be same-origin')
  if (base.search || base.hash) throw new TypeError('Guided tour base URL cannot contain a query or fragment')
  if (!base.pathname.endsWith('/')) base.pathname += '/'
  return base
}

function resourceUrl(path: string, environment: TourOfflinePackEnvironment): string {
  const base = resolvedBase(environment)
  const url = new URL(path, base)
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
    throw new TypeError('Guided tour resource URL must stay within the application base path')
  }
  return `${url.pathname}${url.search}`
}

function metadataUrl(environment: TourOfflinePackEnvironment): string {
  return resourceUrl(`data/generated/tour/${METADATA_FILENAME}`, environment)
}

function safeRevision(revision: string): string {
  const safe = revision.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
  if (!safe) throw new TypeError('Tour content revision must contain a cache-safe character')
  return safe
}

function isMetadata(value: unknown): value is TourOfflinePackMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<TourOfflinePackMetadata>
  return candidate.schemaVersion === 1
    && typeof candidate.revision === 'string'
    && candidate.revision.length > 0
    && Array.isArray(candidate.urls)
    && candidate.urls.length > 0
    && candidate.urls.every((url) => typeof url === 'string')
    && Number.isSafeInteger(candidate.bytes)
    && Number(candidate.bytes) >= 0
    && typeof candidate.installedAt === 'string'
    && !Number.isNaN(Date.parse(candidate.installedAt))
}

export function tourOfflinePackUrls(
  manifest: TourGeneratedManifest,
  environment: Pick<TourOfflinePackEnvironment, 'baseUrl' | 'origin'> = {},
): string[] {
  const validatedManifest = parseTourOfflineManifest(manifest)

  const contentReadyChapters = validatedManifest.chapters.filter(({ status }) => status === 'content-ready')
  const paths = [
    'data/generated/tour/manifest.json',
    'data/generated/taxonomy.json',
    'data/generated/tour/claim-vocabulary.json',
    'data/generated/tour/glossary.json',
    'data/generated/tour/references.json',
    ...contentReadyChapters.map(({ id }) => `data/generated/tour/chapters/${safeId(id, 'Tour chapter ID')}.json`),
    ...contentReadyChapters.flatMap(({ lessonIds }) => lessonIds.map((id) => `data/generated/tour/lessons/${safeId(id, 'Tour lesson ID')}.json`)),
    ...CURRENT_SIMULATION_IDS.map((id) => `data/generated/tour/simulations/${safeId(id, 'Tour simulation ID')}.json`),
  ]

  return [...new Set(paths.map((path) => resourceUrl(path, environment)))]
}

async function readMetadata(cache: Cache): Promise<TourOfflinePackMetadata | null> {
  const keys = await cache.keys()
  const request = keys.find(({ url }) => new URL(url).pathname.endsWith(`/${METADATA_FILENAME}`))
  if (!request) return null
  const response = await cache.match(request)
  if (!response?.ok) return null
  try {
    const value: unknown = await response.json()
    return isMetadata(value) ? value : null
  } catch {
    return null
  }
}

async function completeInstallation(cache: Cache, metadata: TourOfflinePackMetadata): Promise<boolean> {
  for (const url of metadata.urls) {
    if (!await cache.match(url)) return false
  }
  return true
}

export async function inspectTourOfflinePack(
  revision?: string,
  environment: TourOfflinePackEnvironment = {},
): Promise<InstalledTourOfflinePack | null> {
  const storage = cacheStorage(environment)
  const installed: InstalledTourOfflinePack[] = []
  for (const cacheName of await storage.keys()) {
    if (!cacheName.startsWith(GUIDED_TOUR_CACHE_PREFIX)) continue
    const cache = await storage.open(cacheName)
    const metadata = await readMetadata(cache)
    if (!metadata || (revision !== undefined && metadata.revision !== revision)) continue
    if (await completeInstallation(cache, metadata)) installed.push({ cacheName, metadata })
  }
  installed.sort((left, right) => right.metadata.installedAt.localeCompare(left.metadata.installedAt))
  return installed[0] ?? null
}

export async function installTourOfflinePack(
  manifest: TourGeneratedManifest,
  environment: TourOfflinePackEnvironment = {},
  signal?: AbortSignal,
): Promise<InstalledTourOfflinePack> {
  const storage = cacheStorage(environment)
  const fetchResource = environment.fetch ?? globalThis.fetch
  if (!fetchResource) throw new Error('Guided tour download is unavailable in this browser.')

  const validatedManifest = parseTourOfflineManifest(manifest)
  const validateResources = environment.validateResources
  if (!validateResources) throw new Error('Guided tour resource validation is unavailable.')
  const urls = tourOfflinePackUrls(validatedManifest, environment)
  const installedAt = (environment.now ?? (() => new Date().toISOString()))()
  const installId = (environment.installId ?? (() => crypto.randomUUID()))().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48)
  if (!installId) throw new Error('Guided tour installation ID is unavailable.')
  const cacheName = `${GUIDED_TOUR_CACHE_PREFIX}${safeRevision(validatedManifest.contentRevision)}-${installId}`
  const cache = await storage.open(cacheName)

  try {
    let bytes = 0
    const resources = new Map<string, unknown>()
    for (const url of urls) {
      if (signal?.aborted) throw signal.reason ?? new DOMException('The operation was aborted', 'AbortError')
      const response = await fetchResource(url, { cache: 'no-store', signal })
      if (!response.ok) throw new Error(`Guided tour download failed for ${url} (${response.status})`)
      let json: unknown
      try {
        json = await response.clone().json()
      } catch (reason) {
        throw new Error(`Guided tour download returned invalid JSON for ${url}`, { cause: reason })
      }
      resources.set(url, json)
      bytes += (await response.clone().arrayBuffer()).byteLength
      await cache.put(url, response.clone())
    }
    if (signal?.aborted) throw signal.reason ?? new DOMException('The operation was aborted', 'AbortError')
    validateResources(resources, validatedManifest)

    const metadata: TourOfflinePackMetadata = {
      schemaVersion: 1,
      revision: validatedManifest.contentRevision,
      urls,
      bytes,
      installedAt,
    }
    await cache.put(metadataUrl(environment), new Response(JSON.stringify(metadata), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    for (const oldCacheName of await storage.keys()) {
      if (oldCacheName.startsWith(GUIDED_TOUR_CACHE_PREFIX) && oldCacheName !== cacheName) {
        await storage.delete(oldCacheName)
      }
    }
    return { cacheName, metadata }
  } catch (reason) {
    await storage.delete(cacheName)
    throw reason
  }
}

export async function clearTourOfflinePacks(environment: TourOfflinePackEnvironment = {}): Promise<void> {
  const storage = cacheStorage(environment)
  await Promise.all((await storage.keys())
    .filter((cacheName) => cacheName.startsWith(GUIDED_TOUR_CACHE_PREFIX))
    .map((cacheName) => storage.delete(cacheName)))
}

export async function matchTourOfflineResponse(
  url: string,
  revision: string | undefined,
  environment: TourOfflinePackEnvironment = {},
): Promise<{ response: Response; metadata: TourOfflinePackMetadata } | null> {
  const installation = await inspectTourOfflinePack(revision, environment)
  if (!installation || !installation.metadata.urls.includes(url)) return null
  const cache = await cacheStorage(environment).open(installation.cacheName)
  const response = await cache.match(url)
  return response ? { response, metadata: installation.metadata } : null
}
