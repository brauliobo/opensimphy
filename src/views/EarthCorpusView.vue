<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import EarthLocalNav from '../components/EarthLocalNav.vue'
import { loadEarthManifest, type EarthManifest } from '../earth/corpus'
import { loadEarthEvidenceManifest, type EarthEvidenceManifest } from '../earth/evidence'

const route = useRoute()
const router = useRouter()
const manifest = ref<EarthManifest | null>(null)
const evidence = ref<EarthEvidenceManifest | null>(null)
const error = ref('')
const query = ref('')
const collection = ref('all')
const series = ref('all')
const evidenceFilter = ref('all')

const evidenceByDocument = computed(() => new Map((evidence.value?.documents ?? []).map((document) => [document.id, document])))

const seriesOptions = computed(() => [...new Set((manifest.value?.documents ?? [])
  .map((document) => document.classification.series)
  .filter((value): value is string => Boolean(value)))].sort())
const visible = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return (manifest.value?.documents ?? []).filter((document) => {
    const matchesSearch = !search || `${document.title} ${document.source.path}`.toLocaleLowerCase().includes(search)
    const links = evidenceByDocument.value.get(document.id)
    const matchesEvidence = evidenceFilter.value === 'all'
      || (evidenceFilter.value === 'programs' && Boolean(links?.relatedCanonicalPrograms))
      || (evidenceFilter.value === 'simulations' && Boolean(links?.simulationCandidates))
      || (evidenceFilter.value === 'diagnostics' && Boolean(links?.diagnostics))
    return matchesSearch
      && (collection.value === 'all' || document.classification.collection === collection.value)
      && (series.value === 'all' || document.classification.series === series.value)
      && matchesEvidence
  })
})
const hasActiveFilters = computed(() => Boolean(query.value.trim())
  || collection.value !== 'all'
  || series.value !== 'all'
  || evidenceFilter.value !== 'all')

function routeString(key: string, fallback: string): string {
  const value = route.query[key]
  return typeof value === 'string' && value !== '' ? value : fallback
}

function hydrateFromRoute(): void {
  query.value = routeString('q', '')
  collection.value = routeString('collection', 'all')
  series.value = routeString('series', 'all')
  evidenceFilter.value = routeString('evidence', 'all')
}

function corpusQuery(): LocationQueryRaw {
  return {
    ...(query.value.trim() ? { q: query.value.trim() } : {}),
    ...(collection.value === 'all' ? {} : { collection: collection.value }),
    ...(series.value === 'all' ? {} : { series: series.value }),
    ...(evidenceFilter.value === 'all' ? {} : { evidence: evidenceFilter.value }),
  }
}

function queryMatchesRoute(next: LocationQueryRaw): boolean {
  const routeKeys = Object.keys(route.query)
  const nextKeys = Object.keys(next)
  return routeKeys.length === nextKeys.length && nextKeys.every((key) => route.query[key] === next[key])
}

function clearFilters(): void {
  query.value = ''
  collection.value = 'all'
  series.value = 'all'
  evidenceFilter.value = 'all'
}

function formatBytes(value: number): string {
  return `${(value / 1024).toFixed(1)} KiB`
}

watch(() => route.query, hydrateFromRoute, { immediate: true })
watch([query, collection, series, evidenceFilter], () => {
  const next = corpusQuery()
  if (!queryMatchesRoute(next)) void router.replace({ query: next })
})

onMounted(async () => {
  try {
    const loadedManifest = await loadEarthManifest()
    const loadedEvidence = await loadEarthEvidenceManifest(loadedManifest.sourceRevision, {
      documentIds: loadedManifest.documents.map(({ id }) => id),
    })
    manifest.value = loadedManifest
    evidence.value = loadedEvidence
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
})
</script>

<template lang="pug">
.view.earth-corpus-view
  EarthLocalNav
  header.view-header
    div
      p.eyebrow Instrument 03/B / locked research corpus
      h1 EARTH Source Index
    .header-stat
      strong {{ visible.length }} / {{ manifest?.summary.documents ?? 63 }}
      span locked Markdown records

  section.caveat-banner(data-testid="earth-caveat")
    strong SOURCE CLAIMS ≠ VALIDATED RESULTS
    p This reader preserves what the EARTH corpus states. Formula and simulation candidates are structural discovery records, not endorsements, successful reproductions, or executable code.

  section.earth-lock(v-if="manifest")
    code rev {{ manifest.sourceRevision.slice(0, 12) }}
    span {{ manifest.license.identifier }}
    span {{ manifest.license.attribution }}
    span Code execution: {{ manifest.policy.codeExecution }}

  section.filter-console.earth-filters(aria-label="EARTH document filters")
    label.field
      span Search locked corpus
      input(v-model="query" data-testid="earth-search" type="search" placeholder="title or source path")
    label.field
      span Collection
      select(v-model="collection" data-testid="earth-collection")
        option(value="all") all collections
        option(value="root") root
        option(value="safe-paper") safe papers
        option(value="theorem") theorems
    label.field
      span Series
      select(v-model="series" data-testid="earth-series")
        option(value="all") all series
        option(v-for="item in seriesOptions" :key="item" :value="item") {{ item }}
    label.field
      span Evidence relation
      select(v-model="evidenceFilter" data-testid="earth-evidence-filter")
        option(value="all") all evidence states
        option(value="programs") with canonical programs
        option(value="simulations") with simulation candidates
        option(value="diagnostics") with source diagnostics
    button.earth-clear-filters(type="button" data-testid="earth-clear-filters" :disabled="!hasActiveFilters" @click="clearFilters") Clear filters

  p.inline-error(v-if="error" role="alert") {{ error }}
  p.earth-loading(v-else-if="!manifest" aria-live="polite") Loading locked corpus manifest…

  template(v-else)
    .earth-result-summary
      p(data-testid="earth-result-count" aria-live="polite" aria-atomic="true")
        strong {{ visible.length }} of {{ manifest.documents.length }} locked records
        span match the current filters
      p Program relations are coverage assignments. Source simulation candidates are structural discoveries; neither implies one-to-one equivalence, execution, or validation.
    section.earth-document-grid(data-testid="earth-document-grid" aria-label="Filtered EARTH source records")
      RouterLink.earth-document-card(
        v-for="document in visible"
        :key="document.id"
        :to="{ name: 'earth-document', params: { slug: document.slug }, query: { view: 'reading' } }"
      )
        .earth-card-index
          span {{ document.classification.series ? `${document.classification.series}-${document.classification.ordinal}` : document.classification.collection }}
          small {{ formatBytes(document.source.bytes) }} / {{ document.source.lineCount }} lines
        h2 {{ document.title }}
        p {{ document.source.path }}
        .earth-card-counts
          span.is-program-relation Program relations · {{ evidenceByDocument.get(document.id)?.relatedCanonicalPrograms ?? 0 }} canonical coverage assignments
          span.is-source-candidate Source candidates · {{ document.counts.formulas }} formulas / {{ document.counts.simulations }} simulations
          span Inert source · {{ document.counts.codeBlocks }} code blocks
          span(v-if="document.counts.diagnostics") Diagnostics · {{ document.counts.diagnostics }} source record
      .empty-state(v-if="visible.length === 0")
        strong No matching source records
        p Adjust the search or clear the corpus filters.
</template>
