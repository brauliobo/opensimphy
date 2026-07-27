import { readonly, shallowRef } from 'vue'
import type { TourGeneratedManifest } from '../types/tour'
import { publishRuntimeAudit, clearRuntimeAuditDomain } from './runtimeAudit'
import { setTaxonomyRegistryForTests, useTaxonomyRegistry } from './taxonomyRegistry'

const manifest = shallowRef<TourGeneratedManifest | null>(null)
const ready = shallowRef(false)
const error = shallowRef<Error | null>(null)
let initialization: Promise<void> | null = null
let controller: AbortController | null = null
let generation = 0
const taxonomyRegistry = useTaxonomyRegistry()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

export function parseTourManifest(value: unknown): TourGeneratedManifest {
  if (!isRecord(value) || value.schemaVersion !== 1) throw new TypeError('Unsupported tour manifest schema version')
  if (typeof value.contentRevision !== 'string' || value.contentRevision.length === 0) throw new TypeError('Tour manifest requires a content revision')
  if (typeof value.title !== 'string' || typeof value.thesis !== 'string') throw new TypeError('Tour manifest requires a title and thesis')
  if (!Array.isArray(value.quickStations) || value.quickStations.length === 0) throw new TypeError('Tour manifest requires quick stations')
  if (!Array.isArray(value.chapters) || value.chapters.length === 0) throw new TypeError('Tour manifest requires chapters')
  if (!isRecord(value.counts) || !['chapters', 'lessons', 'simulations', 'glossary', 'references'].every((key) => nonNegativeInteger(value.counts![key]))) {
    throw new TypeError('Tour manifest counts have an invalid shape')
  }

  const chapters = value.chapters as Array<Record<string, unknown>>
  if (!chapters.every((chapter) => isRecord(chapter)
    && chapter.schemaVersion === 1
    && typeof chapter.id === 'string'
    && chapter.id.length > 0
    && Number.isSafeInteger(chapter.order)
    && Array.isArray(chapter.lessonIds)
    && chapter.lessonIds.every((id) => typeof id === 'string'))) {
    throw new TypeError('Tour manifest chapters have an invalid shape')
  }
  const chapterIds = chapters.map(({ id }) => id as string)
  if (new Set(chapterIds).size !== chapterIds.length) throw new TypeError('Tour manifest chapter IDs must be unique')
  if (value.counts.chapters !== chapters.length) throw new TypeError(`Tour manifest chapter coverage is ${chapters.length}/${value.counts.chapters}`)

  const stations = value.quickStations as Array<Record<string, unknown>>
  if (!stations.every((station) => isRecord(station)
    && typeof station.id === 'string'
    && station.id.length > 0
    && Number.isSafeInteger(station.order)
    && typeof station.chapterId === 'string'
    && chapterIds.includes(station.chapterId)
    && (station.lessonId === null || typeof station.lessonId === 'string')
    && (station.simulationId === null || typeof station.simulationId === 'string')
    && nonNegativeInteger(station.estimatedMinutes)
    && (station.status === 'content-ready' || station.status === 'planned'))) {
    throw new TypeError('Tour manifest quick stations have an invalid shape')
  }
  const stationIds = stations.map(({ id }) => id as string)
  if (new Set(stationIds).size !== stationIds.length) throw new TypeError('Tour manifest quick-station IDs must be unique')

  const lessonIds = new Set(chapters.flatMap((chapter) => chapter.lessonIds as string[]))
  const simulationIds = new Set(stations.flatMap((station) => typeof station.simulationId === 'string' ? [station.simulationId] : []))
  if (lessonIds.size !== value.counts.lessons) throw new TypeError(`Tour manifest lesson coverage is ${lessonIds.size}/${value.counts.lessons}`)
  if (simulationIds.size !== value.counts.simulations) throw new TypeError(`Tour manifest simulation coverage is ${simulationIds.size}/${value.counts.simulations}`)
  if (stations.some((station) => typeof station.lessonId === 'string' && !lessonIds.has(station.lessonId))) throw new TypeError('Tour manifest station references an unknown lesson')
  return value as unknown as TourGeneratedManifest
}

function publishSuccess(value: TourGeneratedManifest): void {
  const taxonomy = taxonomyRegistry.taxonomy.value
  if (!taxonomy) throw new Error('Tour taxonomy is unavailable')
  publishRuntimeAudit({
    tour: {
      status: 'ready',
      manifest: {
        chapters: value.counts.chapters,
        lessons: value.counts.lessons,
        simulations: value.counts.simulations,
        quickStations: value.quickStations.length,
      },
      taxonomy: {
        total: taxonomy.total,
        topics: taxonomy.topics.map(({ id, count }) => ({ id, count })),
      },
    },
  })
}

async function initialize(): Promise<void> {
  if (initialization) return initialization
  const attempt = ++generation
  const attemptController = new AbortController()
  controller = attemptController
  let successful = false
  const pending = Promise.resolve().then(async () => {
    ready.value = false
    error.value = null
    manifest.value = null
    clearRuntimeAuditDomain('tour')
    try {
      const [response] = await Promise.all([
        fetch(`${import.meta.env.BASE_URL}data/generated/tour/manifest.json`, { signal: attemptController.signal }),
        taxonomyRegistry.initialize(),
      ])
      if (!response.ok) throw new Error(`Tour manifest failed to load (${response.status})`)
      if (taxonomyRegistry.error.value) throw taxonomyRegistry.error.value
      const next = parseTourManifest(await response.json())
      if (attempt !== generation) return
      manifest.value = next
      publishSuccess(next)
      ready.value = true
      successful = true
    } catch (reason) {
      if (attempt !== generation) return
      manifest.value = null
      if (attemptController.signal.aborted) {
        ready.value = false
        error.value = null
        clearRuntimeAuditDomain('tour')
      } else {
        error.value = reason instanceof Error ? reason : new Error(String(reason))
        publishRuntimeAudit({ tour: { status: 'error', error: error.value.message } })
        ready.value = true
      }
    } finally {
      if (attempt === generation) {
        controller = null
        if (!successful) initialization = null
      }
    }
  })
  initialization = pending
  return pending
}

export function useTourRegistry() {
  return {
    manifest: readonly(manifest),
    taxonomy: taxonomyRegistry.taxonomy,
    ready: readonly(ready),
    error: readonly(error),
    initialize,
  }
}

export function setTourRegistryForTests(value: { manifest: TourGeneratedManifest; taxonomy: Parameters<typeof setTaxonomyRegistryForTests>[0] } | null): void {
  generation += 1
  controller?.abort()
  controller = null
  initialization = null
  manifest.value = null
  ready.value = false
  error.value = null
  clearRuntimeAuditDomain('tour')
  if (!value) return
  setTaxonomyRegistryForTests(value.taxonomy)
  try {
    publishSuccess(value.manifest)
    manifest.value = value.manifest
    ready.value = true
    initialization = Promise.resolve()
  } catch (reason) {
    error.value = reason instanceof Error ? reason : new Error(String(reason))
    publishRuntimeAudit({ tour: { status: 'error', error: error.value.message } })
    ready.value = true
  }
}

export function resetTourRegistryForTests(): void {
  generation += 1
  controller?.abort()
  controller = null
  manifest.value = null
  ready.value = false
  error.value = null
  initialization = null
  clearRuntimeAuditDomain('tour')
}
