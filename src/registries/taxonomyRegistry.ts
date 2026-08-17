import { fail, requireExactKeys, requireNonEmptyString, requireSafeInteger } from '../simphy/contract'
import { readonly, shallowRef } from 'vue'
import type { TaxonomyArtifact, TaxonomyCount, TaxonomyTopic } from '../types/engine'
import { matchTourOfflineResponse } from '../tour/offlinePack'

const taxonomy = shallowRef<TaxonomyArtifact | null>(null)
const ready = shallowRef(false)
const error = shallowRef<Error | null>(null)
let initialization: Promise<void> | null = null
let controller: AbortController | null = null
let generation = 0

const TOPIC_KEYS = ['id', 'order', 'title', 'shortTitle', 'eyebrow', 'description', 'narrative', 'count', 'exactCount', 'measuredCount', 'categories', 'featured'] as const
const CATEGORY_KEYS = ['id', 'title', 'description', 'count'] as const
const FEATURED_KEYS = ['recipeNumber', 'id', 'name'] as const
const FACET_KEYS = ['basis', 'constructor', 'buildPass', 'sourceUnitFamily', 'representation', 'entities'] as const

function requireTaxonomyId(value: unknown, path: string): string {
  const id = requireNonEmptyString(value, path)
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) fail(path, 'must be a safe ID')
  return id
}

function parseCount(value: unknown, path: string): TaxonomyCount {
  requireExactKeys(value, ['id', 'count'], [], path)
  requireTaxonomyId(value.id, `${path}.id`)
  requireSafeInteger(value.count, `${path}.count`)
  return value as unknown as TaxonomyCount
}

function parseTopic(value: unknown, path: string): TaxonomyTopic {
  requireExactKeys(value, TOPIC_KEYS, [], path)
  requireTaxonomyId(value.id, `${path}.id`)
  requireSafeInteger(value.order, `${path}.order`, 1)
  requireNonEmptyString(value.title, `${path}.title`)
  requireNonEmptyString(value.shortTitle, `${path}.shortTitle`)
  requireNonEmptyString(value.eyebrow, `${path}.eyebrow`)
  requireNonEmptyString(value.description, `${path}.description`)
  requireNonEmptyString(value.narrative, `${path}.narrative`)
  const count = requireSafeInteger(value.count, `${path}.count`)
  const exactCount = requireSafeInteger(value.exactCount, `${path}.exactCount`)
  const measuredCount = requireSafeInteger(value.measuredCount, `${path}.measuredCount`)
  if (exactCount + measuredCount !== count) fail(`${path}.count`, 'must equal exactCount plus measuredCount')
  if (!Array.isArray(value.categories)) fail(`${path}.categories`, 'must be an array')
  value.categories.forEach((category, index) => {
    const categoryPath = `${path}.categories[${index}]`
    requireExactKeys(category, CATEGORY_KEYS, [], categoryPath)
    requireTaxonomyId(category.id, `${categoryPath}.id`)
    requireNonEmptyString(category.title, `${categoryPath}.title`)
    requireNonEmptyString(category.description, `${categoryPath}.description`)
    requireSafeInteger(category.count, `${categoryPath}.count`)
  })
  if (value.categories.reduce((sum, category) => sum + (category as TaxonomyCount).count, 0) !== count) {
    fail(`${path}.categories`, 'must sum to the topic count')
  }
  if (!Array.isArray(value.featured)) fail(`${path}.featured`, 'must be an array')
  value.featured.forEach((featured, index) => {
    const featuredPath = `${path}.featured[${index}]`
    requireExactKeys(featured, FEATURED_KEYS, [], featuredPath)
    requireSafeInteger(featured.recipeNumber, `${featuredPath}.recipeNumber`, 1)
    requireNonEmptyString(featured.id, `${featuredPath}.id`)
    requireNonEmptyString(featured.name, `${featuredPath}.name`)
  })
  return value as unknown as TaxonomyTopic
}

export function parseTaxonomyArtifact(value: unknown): TaxonomyArtifact {
  requireExactKeys(value, ['schemaVersion', 'generatedAt', 'total', 'narrativeOrder', 'topics', 'facets'], [], 'Taxonomy')
  if (value.schemaVersion !== 1) fail('Taxonomy.schemaVersion', 'must be 1')
  const generatedAt = requireNonEmptyString(value.generatedAt, 'Taxonomy.generatedAt')
  const parsedDate = new Date(`${generatedAt}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(generatedAt) || Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== generatedAt) {
    fail('Taxonomy.generatedAt', 'must be an ISO calendar date')
  }
  const total = requireSafeInteger(value.total, 'Taxonomy.total', 1)
  if (!Array.isArray(value.topics) || value.topics.length === 0) fail('Taxonomy.topics', 'must be a non-empty array')
  const topics = value.topics.map((topic, index) => parseTopic(topic, `Taxonomy.topics[${index}]`))
  const topicIds = topics.map(({ id }) => id)
  if (new Set(topicIds).size !== topicIds.length) fail('Taxonomy.topics', 'IDs must be unique')
  if (topics.some((topic, index) => topic.order !== index + 1)) fail('Taxonomy.topics', 'order must be contiguous')
  if (topics.reduce((sum, topic) => sum + topic.count, 0) !== total) fail('Taxonomy.topics', 'counts do not match total')
  if (!Array.isArray(value.narrativeOrder) || value.narrativeOrder.length !== topics.length) {
    fail('Taxonomy.narrativeOrder', 'must list each topic once')
  }
  value.narrativeOrder.forEach((id, index) => requireNonEmptyString(id, `Taxonomy.narrativeOrder[${index}]`))
  if (new Set(value.narrativeOrder).size !== topics.length || value.narrativeOrder.some((id) => !topicIds.includes(id as string))) {
    fail('Taxonomy.narrativeOrder', 'must cover each topic exactly once')
  }
  requireExactKeys(value.facets, FACET_KEYS, [], 'Taxonomy.facets')
  for (const key of FACET_KEYS) {
    const facet = value.facets[key]
    if (!Array.isArray(facet)) fail(`Taxonomy.facets.${key}`, 'must be an array')
    const entries = facet.map((entry, index) => parseCount(entry, `Taxonomy.facets.${key}[${index}]`))
    if (new Set(entries.map(({ id }) => id)).size !== entries.length) fail(`Taxonomy.facets.${key}`, 'IDs must be unique')
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
