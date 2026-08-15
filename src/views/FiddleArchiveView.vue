<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import FiddleCard from '../components/fiddles/FiddleCard.vue'
import { fiddleProfileUrl, useFiddleRegistry } from '../registries/fiddleRegistry'
import type { FiddleRecord } from '../types/fiddle'

const route = useRoute()
const router = useRouter()
const fiddleRegistry = useFiddleRegistry()
const query = ref('')
const visualization = ref('all')
const page = ref(1)
const routeNotice = ref('')
let preservingNotice = false

void fiddleRegistry.initialize()

const registryLoading = computed(() => fiddleRegistry.loading.value || !fiddleRegistry.ready.value)
const registryError = computed(() => fiddleRegistry.error.value?.message
  ?? (fiddleRegistry.ready.value && fiddleRegistry.records.value.length === 0
    ? 'The generated Fiddle source archive is empty.'
    : ''))
const archiveReady = computed(() => !registryLoading.value
  && !registryError.value
  && fiddleRegistry.source.value !== null
  && fiddleRegistry.records.value.length > 0)
const records = computed(() => fiddleRegistry.records.value)
const source = computed(() => fiddleRegistry.source.value)
const selectedProfileUrl = computed(() => source.value ? fiddleProfileUrl(source.value.author, page.value) : '')
const visualizations = computed(() => [...new Set(records.value.map((record) => record.visualization))].sort((left, right) => left.localeCompare(right)))
const sourcePages = computed(() => Array.from({ length: source.value?.profilePages ?? 0 }, (_, index) => index + 1))
const filteredRecords = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return records.value.filter((record) => {
    const searchable = [record.title, record.slug, record.visualization, record.risk].join(' ').toLocaleLowerCase()
    return (!search || searchable.includes(search))
      && (visualization.value === 'all' || record.visualization === visualization.value)
  })
})
const currentPageRecords = computed(() => records.value.filter((record) => record.page === page.value))
const visibleRecords = computed(() => filteredRecords.value.filter((record) => record.page === page.value))
const currentPageRange = computed(() => recordRange(currentPageRecords.value))
const resultStatus = computed(() => {
  if (filteredRecords.value.length === 0) return `No records match the current filters out of ${records.value.length} archived records.`
  if (visibleRecords.value.length === 0) {
    return `${filteredRecords.value.length} records match across the archive, but none are on source profile page ${page.value}.`
  }
  return `Showing ${visibleRecords.value.length} matching records on source profile page ${page.value}; ${filteredRecords.value.length} match across the archive.`
})
const archiveQuery = computed<LocationQueryRaw>(() => ({
  ...(query.value === '' ? {} : { q: query.value }),
  ...(visualization.value === 'all' ? {} : { viz: visualization.value }),
  ...(page.value === 1 ? {} : { page: String(page.value) }),
}))

watch([() => route.fullPath, () => fiddleRegistry.ready.value, visualizations], () => {
  if (!archiveReady.value) return
  hydrateFromRoute()
}, { immediate: true })

function scalarQuery(key: string): string | null {
  const value = route.query[key]
  return typeof value === 'string' ? value : null
}

function safeSearch(value: string | null): { value: string; warning: string } {
  if (value === null) return { value: '', warning: '' }
  if (value.length > 200 || /[\u0000-\u001f\u007f]/.test(value)) {
    return { value: '', warning: 'The search query was rejected because it is too long or contains control characters.' }
  }
  return { value: value.trim(), warning: '' }
}

function safePage(value: string | null, maximum: number): { value: number; warning: string } {
  if (value === null) return { value: 1, warning: '' }
  if (!/^[1-9]\d*$/.test(value)) {
    return { value: 1, warning: `The page query was rejected; showing source profile page 1 of ${maximum}.` }
  }
  const requested = Number(value)
  if (!Number.isSafeInteger(requested)) {
    return { value: 1, warning: `The page query was rejected; showing source profile page 1 of ${maximum}.` }
  }
  if (requested > maximum) {
    return { value: maximum, warning: `Source profile page ${requested} is outside 1-${maximum}; clamped to page ${maximum}.` }
  }
  return { value: requested, warning: '' }
}

function sameRouteQuery(next: LocationQueryRaw): boolean {
  const currentKeys = Object.keys(route.query).sort()
  const nextKeys = Object.keys(next).sort()
  return currentKeys.length === nextKeys.length
    && currentKeys.every((key, index) => key === nextKeys[index] && route.query[key] === next[key])
}

function hydrateFromRoute(): void {
  const search = safeSearch(scalarQuery('q'))
  const rawVisualization = scalarQuery('viz')
  const visualizationWarning = rawVisualization !== null && rawVisualization !== 'all' && !visualizations.value.includes(rawVisualization)
    ? `The visualization filter ${rawVisualization} is not in the archive; showing all visualizations.`
    : ''
  const nextVisualization = visualizationWarning ? 'all' : rawVisualization ?? 'all'
  const pageState = safePage(scalarQuery('page'), source.value?.profilePages ?? 1)
  query.value = search.value
  visualization.value = nextVisualization
  page.value = pageState.value
  const notice = [search.warning, visualizationWarning, pageState.warning].filter(Boolean).join(' ')
  if (notice || !preservingNotice) routeNotice.value = notice
  const nextQuery: LocationQueryRaw = {
    ...(query.value === '' ? {} : { q: query.value }),
    ...(visualization.value === 'all' ? {} : { viz: visualization.value }),
    ...(page.value === 1 ? {} : { page: String(page.value) }),
  }
  if (!sameRouteQuery(nextQuery)) {
    preservingNotice = true
    void router.replace({ path: '/labs/simulations', query: nextQuery }).finally(() => {
      preservingNotice = false
    })
  } else {
    preservingNotice = false
  }
}

function commitFilters(): void {
  page.value = 1
  void router.replace({ path: '/labs/simulations', query: archiveQuery.value })
}

function changePage(nextPage: number): void {
  const maximum = source.value?.profilePages ?? 1
  page.value = Math.min(Math.max(nextPage, 1), maximum)
  routeNotice.value = ''
  void router.replace({ path: '/labs/simulations', query: archiveQuery.value })
}

function recordRange(pageRecords: readonly FiddleRecord[]): { first: number; last: number; count: number } {
  const first = pageRecords[0]?.position ?? 0
  const last = pageRecords.at(-1)?.position ?? 0
  return { first, last, count: pageRecords.length }
}

function pageSummary(pageNumber: number): { first: number; last: number; count: number; matches: number } {
  const pageRecords = records.value.filter((record) => record.page === pageNumber)
  const range = recordRange(pageRecords)
  return { ...range, matches: filteredRecords.value.filter((record) => record.page === pageNumber).length }
}

function archiveQueryForCard(): LocationQueryRaw {
  return archiveQuery.value
}

function sourcePageLabel(pageNumber: number): string {
  const summary = pageSummary(pageNumber)
  return `Source profile page ${pageNumber}, records ${summary.first}-${summary.last}`
}

</script>

<template lang="pug">
.view.fiddle-archive-view(:data-testid="archiveReady ? 'fiddle-archive-ready' : undefined")
  header.view-header
    div
      p.eyebrow Workbench 04 / source archive
      h1 Fiddle source archive
      p Archive metadata for a preserved JSFiddle profile. It is a source index, not a local simulation catalogue.
    .header-stat(v-if="archiveReady")
      strong {{ source?.recordCount }}
      span archived records
      strong {{ source?.profilePages }}
      span source profile pages

  section.caveat-banner(data-testid="fiddle-source-boundary")
    strong ARCHIVED METADATA / EXTERNAL EXECUTION
    p This page reads only the checked-in source archive. An external live preview is optional third-party network execution; reproduction is not validation and no Fiddle source runs in the OpenSimPhy origin.

  .loading-plate(v-if="registryLoading" data-testid="fiddle-archive-loading" aria-live="polite") Loading Fiddle source archive metadata...
  .empty-state(v-else-if="registryError" role="alert" data-testid="fiddle-archive-error")
    strong Fiddle source archive unavailable
    p {{ registryError }}
  template(v-else-if="archiveReady")
    section.fiddle-filter-section
      .section-heading
        div
          p.eyebrow Search the preserved index
          h2 Find a source record
        p Search is limited to archived title, slug, visualization, and risk metadata. Results never execute or interpret source panels.
      .fiddle-filter-console
        label.field.field-search
          span Search title, slug, visualization, or risk
          input(
            v-model="query"
            type="search"
            maxlength="200"
            autocomplete="off"
            data-testid="fiddle-search"
            placeholder="e.g. canvas, spin, CLDR"
            @input="commitFilters"
          )
        label.field
          span Visualization
          select(v-model="visualization" data-testid="fiddle-visualization" @change="commitFilters")
            option(value="all") All visualizations
            option(v-for="option in visualizations" :key="option" :value="option") {{ option }}
        .fiddle-filter-summary
          strong(data-testid="fiddle-result-count") {{ filteredRecords.length }} / {{ records.length }}
          span matching archived records
          small {{ resultStatus }}
      p.fiddle-query-notice(v-if="routeNotice" role="status" data-testid="fiddle-query-notice") {{ routeNotice }}

    section.fiddle-pages-section
      .section-heading
        div
          p.eyebrow Preserved source pagination
          h2 One profile page at a time
        p Each button maps to the actual JSFiddle profile page and record range captured in the registry. All {{ source?.recordCount }} records remain reachable through these {{ source?.profilePages }} pages.
      nav.fiddle-source-pages(aria-label="JSFiddle source profile pages" data-testid="fiddle-source-pages")
        button(
          v-for="pageNumber in sourcePages"
          :key="pageNumber"
          type="button"
          :class="{ 'is-selected': pageNumber === page }"
          :aria-current="pageNumber === page ? 'page' : undefined"
          :aria-label="sourcePageLabel(pageNumber)"
          @click="changePage(pageNumber)"
        )
          strong Page {{ pageNumber }}
          span {{ pageSummary(pageNumber).first }}-{{ pageSummary(pageNumber).last }}
          small(v-if="pageSummary(pageNumber).matches !== pageSummary(pageNumber).count") {{ pageSummary(pageNumber).matches }} matches

    section.fiddle-results-section
      header.fiddle-results-header
        div
          p.eyebrow Source page {{ page }} / {{ source?.profilePages }}
          h2 Records {{ currentPageRange.first }}-{{ currentPageRange.last }}
        p(data-testid="fiddle-result-status") {{ resultStatus }}
      .fiddle-card-grid(v-if="visibleRecords.length")
        FiddleCard(
          v-for="record in visibleRecords"
          :key="record.slug"
          :record="record"
          :archive-query="archiveQueryForCard()"
        )
      .empty-state.fiddle-page-empty(v-else)
        strong No matching records on this source page
        p Use another source-page button or clear a filter. The archive is not executing the Fiddle source.
      footer.fiddle-page-footer
        span Profile page {{ page }} contains records {{ currentPageRange.first }}-{{ currentPageRange.last }} of {{ source?.recordCount }}.
        a.text-link(:href="selectedProfileUrl" target="_blank" rel="noreferrer") Open captured JSFiddle profile ->
</template>
