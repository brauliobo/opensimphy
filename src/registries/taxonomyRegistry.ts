import { readonly, shallowRef } from 'vue'
import type { TaxonomyArtifact, TaxonomyCount, TaxonomyTopic } from '../types/engine'

const taxonomy = shallowRef<TaxonomyArtifact | null>(null)
const ready = shallowRef(false)
const error = shallowRef<Error | null>(null)
let initialization: Promise<void> | null = null
let controller: AbortController | null = null
let generation = 0

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCount(value: unknown): value is TaxonomyCount {
  return isRecord(value)
    && typeof value.id === 'string'
    && value.id.length > 0
    && Number.isSafeInteger(value.count)
    && Number(value.count) >= 0
}

function validateTopic(value: unknown): value is TaxonomyTopic {
  if (!isCount(value) || !isRecord(value)) return false
  if (!Number.isSafeInteger(value.order) || Number(value.order) < 1) return false
  if (typeof value.title !== 'string' || typeof value.shortTitle !== 'string' || typeof value.eyebrow !== 'string') return false
  if (typeof value.description !== 'string' || typeof value.narrative !== 'string') return false
  if (!Number.isSafeInteger(value.exactCount) || !Number.isSafeInteger(value.measuredCount)) return false
  if (Number(value.exactCount) + Number(value.measuredCount) !== Number(value.count)) return false
  if (!Array.isArray(value.categories) || !value.categories.every((category) => {
    return isCount(category)
      && isRecord(category)
      && typeof category.title === 'string'
      && typeof category.description === 'string'
  })) return false
  if (value.categories.reduce((sum, category) => sum + category.count, 0) !== value.count) return false
  return Array.isArray(value.featured) && value.featured.every((featured) => {
    return isRecord(featured)
      && Number.isSafeInteger(featured.recipeNumber)
      && typeof featured.id === 'string'
      && typeof featured.name === 'string'
  })
}

export function parseTaxonomyArtifact(value: unknown): TaxonomyArtifact {
  if (!isRecord(value) || value.schemaVersion !== 1) throw new TypeError('Unsupported taxonomy schema version')
  if (typeof value.generatedAt !== 'string' || value.generatedAt.length === 0) throw new TypeError('Taxonomy requires a generation date')
  if (!Number.isSafeInteger(value.total) || Number(value.total) < 1) throw new TypeError('Taxonomy total must be a positive integer')
  if (!Array.isArray(value.topics) || value.topics.length === 0 || !value.topics.every(validateTopic)) throw new TypeError('Taxonomy topics have an invalid shape')
  const topics = value.topics as TaxonomyTopic[]
  const topicIds = topics.map(({ id }) => id)
  if (new Set(topicIds).size !== topicIds.length) throw new TypeError('Taxonomy topic IDs must be unique')
  if (topics.reduce((sum, topic) => sum + topic.count, 0) !== value.total) throw new TypeError('Taxonomy topic counts do not match its total')
  if (!Array.isArray(value.narrativeOrder) || value.narrativeOrder.length !== topics.length || !value.narrativeOrder.every((id) => typeof id === 'string')) {
    throw new TypeError('Taxonomy narrative order has an invalid shape')
  }
  if (new Set(value.narrativeOrder).size !== topics.length || value.narrativeOrder.some((id) => !topicIds.includes(id as string))) {
    throw new TypeError('Taxonomy narrative order does not cover each topic exactly once')
  }
  if (!isRecord(value.facets)) throw new TypeError('Taxonomy facets must be an object')
  for (const key of ['basis', 'constructor', 'buildPass', 'sourceUnitFamily', 'representation', 'entities']) {
    const facet = value.facets[key]
    if (!Array.isArray(facet) || !facet.every(isCount)) throw new TypeError(`Taxonomy facet ${key} has an invalid shape`)
  }
  return value as unknown as TaxonomyArtifact
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
    taxonomy.value = null
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/generated/taxonomy.json`, { signal: attemptController.signal })
      if (!response.ok) throw new Error(`Constant taxonomy failed to load (${response.status})`)
      const next = parseTaxonomyArtifact(await response.json())
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
