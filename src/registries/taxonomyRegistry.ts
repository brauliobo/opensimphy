import { readonly, shallowRef } from 'vue'
import type { TaxonomyArtifact, TaxonomyCount, TaxonomyTopic } from '../types/engine'
import { matchTourOfflineResponse } from '../tour/offlinePack'

const taxonomy = shallowRef<TaxonomyArtifact | null>(null)
const ready = shallowRef(false)
const error = shallowRef<Error | null>(null)
let initialization: Promise<void> | null = null
let controller: AbortController | null = null
let generation = 0

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

function isCount(value: unknown): value is TaxonomyCount {
  return isRecord(value)
    && typeof value.id === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value.id)
    && Number.isSafeInteger(value.count)
    && Number(value.count) >= 0
}

function validateTopic(value: unknown): value is TaxonomyTopic {
  if (!isCount(value) || !isRecord(value)) return false
  if (!hasExactKeys(value, ['id', 'order', 'title', 'shortTitle', 'eyebrow', 'description', 'narrative', 'count', 'exactCount', 'measuredCount', 'categories', 'featured'])) return false
  if (!Number.isSafeInteger(value.order) || Number(value.order) < 1) return false
  if (typeof value.title !== 'string' || !value.title || typeof value.shortTitle !== 'string' || !value.shortTitle || typeof value.eyebrow !== 'string' || !value.eyebrow) return false
  if (typeof value.description !== 'string' || !value.description || typeof value.narrative !== 'string' || !value.narrative) return false
  if (!Number.isSafeInteger(value.exactCount) || !Number.isSafeInteger(value.measuredCount)) return false
  if (Number(value.exactCount) + Number(value.measuredCount) !== Number(value.count)) return false
  if (!Array.isArray(value.categories) || !value.categories.every((category) => {
    return isRecord(category)
      && hasExactKeys(category, ['id', 'title', 'description', 'count'])
      && typeof category.id === 'string'
      && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(category.id)
      && Number.isSafeInteger(category.count)
      && Number(category.count) >= 0
      && typeof category.title === 'string'
      && typeof category.description === 'string'
  })) return false
  if (value.categories.reduce((sum, category) => sum + category.count, 0) !== value.count) return false
  return Array.isArray(value.featured) && value.featured.every((featured) => {
    return isRecord(featured)
      && hasExactKeys(featured, ['recipeNumber', 'id', 'name'])
      && Number.isSafeInteger(featured.recipeNumber)
      && Number(featured.recipeNumber) > 0
      && typeof featured.id === 'string'
      && featured.id.length > 0
      && typeof featured.name === 'string'
      && featured.name.length > 0
  })
}

export function parseTaxonomyArtifact(value: unknown): TaxonomyArtifact {
  if (!isRecord(value) || value.schemaVersion !== 1) throw new TypeError('Unsupported taxonomy schema version')
  if (!hasExactKeys(value, ['schemaVersion', 'generatedAt', 'total', 'narrativeOrder', 'topics', 'facets'])) throw new TypeError('Taxonomy has unknown or missing properties')
  if (typeof value.generatedAt !== 'string' || value.generatedAt.length === 0) throw new TypeError('Taxonomy requires a generation date')
  const generatedAt = new Date(`${value.generatedAt}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.generatedAt) || Number.isNaN(generatedAt.valueOf()) || generatedAt.toISOString().slice(0, 10) !== value.generatedAt) throw new TypeError('Taxonomy generation date must be an ISO calendar date')
  if (!Number.isSafeInteger(value.total) || Number(value.total) < 1) throw new TypeError('Taxonomy total must be a positive integer')
  if (!Array.isArray(value.topics) || value.topics.length === 0 || !value.topics.every(validateTopic)) throw new TypeError('Taxonomy topics have an invalid shape')
  const topics = value.topics as TaxonomyTopic[]
  const topicIds = topics.map(({ id }) => id)
  if (new Set(topicIds).size !== topicIds.length) throw new TypeError('Taxonomy topic IDs must be unique')
  if (topics.some((topic, index) => topic.order !== index + 1)) throw new TypeError('Taxonomy topic order must be contiguous')
  if (topics.reduce((sum, topic) => sum + topic.count, 0) !== value.total) throw new TypeError('Taxonomy topic counts do not match its total')
  if (!Array.isArray(value.narrativeOrder) || value.narrativeOrder.length !== topics.length || !value.narrativeOrder.every((id) => typeof id === 'string')) {
    throw new TypeError('Taxonomy narrative order has an invalid shape')
  }
  if (new Set(value.narrativeOrder).size !== topics.length || value.narrativeOrder.some((id) => !topicIds.includes(id as string))) {
    throw new TypeError('Taxonomy narrative order does not cover each topic exactly once')
  }
  const facetKeys = ['basis', 'constructor', 'buildPass', 'sourceUnitFamily', 'representation', 'entities'] as const
  if (!isRecord(value.facets) || !hasExactKeys(value.facets, facetKeys)) throw new TypeError('Taxonomy facets must be an exact object')
  for (const key of facetKeys) {
    const facet = value.facets[key]
    if (!Array.isArray(facet) || !facet.every((entry) => isRecord(entry) && hasExactKeys(entry, ['id', 'count']) && isCount(entry))) throw new TypeError(`Taxonomy facet ${key} has an invalid shape`)
    if (new Set(facet.map(({ id }) => id)).size !== facet.length) throw new TypeError(`Taxonomy facet ${key} IDs must be unique`)
  }
  return value as unknown as TaxonomyArtifact
}

async function fetchTaxonomy(expectedRevision: string | undefined, signal: AbortSignal): Promise<unknown> {
  const url = `${import.meta.env.BASE_URL}data/generated/taxonomy.json`
  let response: Response
  let networkFailure: Error
  try {
    response = await fetch(url, { signal, cache: 'no-store' })
  } catch (reason) {
    if (signal.aborted) throw signal.reason ?? new DOMException('The operation was aborted', 'AbortError')
    networkFailure = reason instanceof Error ? reason : new Error(String(reason))
    if (expectedRevision) {
      try {
        const offline = await matchTourOfflineResponse(url, expectedRevision)
        if (offline) return await offline.response.json()
      } catch {
        // Preserve the owning network error when the optional explicit cache cannot be read.
      }
    }
    throw networkFailure
  }
  if (!response.ok) {
    networkFailure = new Error(`Constant taxonomy failed to load (${response.status})`)
    if (response.status >= 500 && expectedRevision) {
      try {
        const offline = await matchTourOfflineResponse(url, expectedRevision)
        if (offline) return await offline.response.json()
      } catch {
        // Preserve the owning HTTP error when the optional explicit cache cannot be read.
      }
    }
    throw networkFailure
  }
  return response.json()
}

async function initialize(expectedRevision?: string): Promise<void> {
  if (initialization) return initialization
  const attempt = ++generation
  const attemptController = new AbortController()
  controller = attemptController
  let successful = false
  const pending = Promise.resolve().then(async () => {
    ready.value = false
    error.value = null
    taxonomy.value = null
    try {
      const next = parseTaxonomyArtifact(await fetchTaxonomy(expectedRevision, attemptController.signal))
      if (attempt !== generation) return
      taxonomy.value = next
      ready.value = true
      successful = true
    } catch (reason) {
      if (attempt !== generation) return
      taxonomy.value = null
      if (attemptController.signal.aborted) {
        ready.value = false
        error.value = null
      } else {
        error.value = reason instanceof Error ? reason : new Error(String(reason))
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

export function useTaxonomyRegistry() {
  return {
    taxonomy: readonly(taxonomy),
    ready: readonly(ready),
    error: readonly(error),
    initialize,
  }
}

export function setTaxonomyRegistryForTests(value: TaxonomyArtifact | null): void {
  generation += 1
  controller?.abort()
  controller = null
  initialization = null
  taxonomy.value = null
  ready.value = false
  error.value = null
  if (!value) return
  try {
    taxonomy.value = parseTaxonomyArtifact(value)
    ready.value = true
    initialization = Promise.resolve()
  } catch (reason) {
    error.value = reason instanceof Error ? reason : new Error(String(reason))
    ready.value = true
  }
}

export function resetTaxonomyRegistryForTests(): void {
  generation += 1
  controller?.abort()
  controller = null
  taxonomy.value = null
  ready.value = false
  error.value = null
  initialization = null
}
