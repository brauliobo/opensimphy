<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import { useFormulaRegistry, validateFormulaTaxonomyCompatibility, type FormulaRecord } from '../registries/formulaRegistry'
import { useTaxonomyRegistry } from '../registries/taxonomyRegistry'

type BasisFilter = 'all' | 'exact' | 'measured'
type SourceCriterionFilter = 'all' | 'met' | 'not-met'
type DimensionAuditFilter = 'all' | 'matches' | 'conflict'

const formulaRegistry = useFormulaRegistry()
const taxonomyRegistry = useTaxonomyRegistry()
const releaseFormulaRegistry = formulaRegistry.acquire()
void taxonomyRegistry.initialize()

const route = useRoute()
const router = useRouter()
const query = ref('')
const topic = ref('all')
const category = ref('all')
const column = ref('all')
const island = ref('all')
const basis = ref<BasisFilter>('all')
const sourceCriterion = ref<SourceCriterionFilter>('all')
const dimensionAudit = ref<DimensionAuditFilter>('all')
const constructor = ref('all')
const representation = ref('all')
const page = ref(1)
const announcedResultCount = ref('')
const pageSize = 24
let resultAnnouncementTimer: ReturnType<typeof setTimeout> | null = null

const registryLoading = computed(() => !formulaRegistry.ready.value || !taxonomyRegistry.ready.value)
const compatibilityError = computed(() => {
  if (registryLoading.value || formulaRegistry.error.value || taxonomyRegistry.error.value) return ''
  const taxonomy = taxonomyRegistry.taxonomy.value
  if (!taxonomy) return 'The generated formula taxonomy is unavailable.'
  try {
    validateFormulaTaxonomyCompatibility(formulaRegistry.formulas.value, taxonomy)
    return ''
  } catch (reason) {
    return reason instanceof Error ? reason.message : String(reason)
  }
})
const registryReady = computed(() => !registryLoading.value
  && !formulaRegistry.error.value
  && !taxonomyRegistry.error.value
  && compatibilityError.value === ''
  && formulaRegistry.formulas.value.length > 0
  && taxonomyRegistry.taxonomy.value !== null)
const registryError = computed(() => {
  if (formulaRegistry.error.value) return formulaRegistry.error.value.message
  if (taxonomyRegistry.error.value) return taxonomyRegistry.error.value.message
  if (compatibilityError.value) return compatibilityError.value
  return !registryLoading.value && !registryReady.value ? 'The generated formula registry or taxonomy is unavailable.' : ''
})
const topics = computed(() => taxonomyRegistry.taxonomy.value?.topics ?? [])
const selectedTopic = computed(() => topics.value.find((item) => item.id === topic.value) ?? null)
const categories = computed(() => topic.value === 'all' ? [] : topics.value.find((item) => item.id === topic.value)?.categories ?? [])
const selectedCategory = computed(() => categories.value.find((item) => item.id === category.value) ?? null)
const columns = computed(() => [...new Set(formulaRegistry.formulas.value.map((item) => item.column))].sort())
const islands = computed(() => [...new Set(formulaRegistry.formulas.value.map((item) => item.island))].sort())
const constructors = computed(() => taxonomyRegistry.taxonomy.value?.facets.constructor ?? [])
const representations = computed(() => taxonomyRegistry.taxonomy.value?.facets.representation ?? [])
const sourceCriterionOptions: SourceCriterionFilter[] = ['met', 'not-met']
const dimensionConflictCount = computed(() => formulaRegistry.formulas.value.filter((item) => !item.dimensionAudit.matches).length)
const dependencyDriftCount = computed(() => formulaRegistry.formulas.value.filter((item) => !item.dependencyAgreement.matches).length)
const advancedFilterCount = computed(() => [column, island, sourceCriterion, dimensionAudit, constructor, representation]
  .filter((item) => item.value !== 'all').length)
const filtered = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return formulaRegistry.formulas.value.filter((item) => {
    const dependencySearch = [
      ...item.sourceDependencies.direct,
      ...item.sourceDependencies.graph.flatMap((node) => [node.token, ...node.parents]),
      ...item.runtimeDependencies.direct,
      ...item.runtimeDependencies.graph.flatMap((node) => [node.token, ...node.parents]),
      ...item.constructorLiterals,
    ].join(' ')
    const matchesSearch = !search || [item.ordinal, item.symbol, item.name, item.equation, dependencySearch].join(' ').toLocaleLowerCase().includes(search)
    return matchesSearch
      && (column.value === 'all' || item.column === column.value)
      && (island.value === 'all' || item.island === island.value)
      && (topic.value === 'all' || item.topic === topic.value)
      && (category.value === 'all' || item.category === category.value)
      && (basis.value === 'all' || item.classification === basis.value)
      && matchesSourceCriterion(item, sourceCriterion.value)
      && (dimensionAudit.value === 'all' || (dimensionAudit.value === 'matches' ? item.dimensionAudit.matches : !item.dimensionAudit.matches))
      && (constructor.value === 'all' || item.facets.constructor === constructor.value)
      && (representation.value === 'all' || item.facets.representation === representation.value)
  })
})
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const visible = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const resultCountText = computed(() => {
  if (filtered.value.length === 0) return `No matching formulas out of ${formulaRegistry.formulas.value.length}.`
  const first = (page.value - 1) * pageSize + 1
  const last = first + visible.value.length - 1
  return `Showing ${first}–${last} of ${filtered.value.length} matching formulas. Page ${page.value} of ${pages.value}.`
})
const stateQuery = computed<LocationQueryRaw>(() => ({
  ...(query.value === '' ? {} : { q: query.value }),
  ...(topic.value === 'all' ? {} : { topic: topic.value }),
  ...(category.value === 'all' ? {} : { category: category.value }),
  ...(basis.value === 'all' ? {} : { basis: basis.value }),
  ...(column.value === 'all' ? {} : { column: column.value }),
  ...(island.value === 'all' ? {} : { island: island.value }),
  ...(sourceCriterion.value === 'all' ? {} : { sourceCriterion: sourceCriterion.value }),
  ...(dimensionAudit.value === 'all' ? {} : { dimensionAudit: dimensionAudit.value }),
  ...(constructor.value === 'all' ? {} : { constructor: constructor.value }),
  ...(representation.value === 'all' ? {} : { representation: representation.value }),
  ...(page.value === 1 ? {} : { page: String(page.value) }),
}))
const detailQuery = computed(() => stateQuery.value)

watch([registryReady, () => route.fullPath], () => {
  if (registryReady.value && route.path === '/atlas') applyRouteQuery()
}, { immediate: true })
watch(resultCountText, (value) => {
  if (resultAnnouncementTimer) clearTimeout(resultAnnouncementTimer)
  resultAnnouncementTimer = setTimeout(() => {
    announcedResultCount.value = value
    resultAnnouncementTimer = null
  }, 250)
}, { immediate: true })

onUnmounted(() => {
  if (resultAnnouncementTimer) clearTimeout(resultAnnouncementTimer)
  releaseFormulaRegistry()
})

function scalarQuery(key: string): string | null {
  const value = route.query[key]
  return typeof value === 'string' ? value : null
}

function finiteOption(value: string | null, options: readonly string[]): string {
  return value !== null && options.includes(value) ? value : 'all'
}

function searchQuery(value: string | null): string {
  return value !== null && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value) ? value : ''
}

function applyRouteQuery(): void {
  query.value = searchQuery(scalarQuery('q'))
  topic.value = finiteOption(scalarQuery('topic'), topics.value.map(({ id }) => id))
  category.value = topic.value === 'all'
    ? 'all'
    : finiteOption(scalarQuery('category'), categories.value.map(({ id }) => id))
  basis.value = finiteOption(scalarQuery('basis'), ['exact', 'measured']) as BasisFilter
  column.value = finiteOption(scalarQuery('column'), columns.value)
  island.value = finiteOption(scalarQuery('island'), islands.value)
  sourceCriterion.value = finiteOption(scalarQuery('sourceCriterion'), sourceCriterionOptions) as SourceCriterionFilter
  dimensionAudit.value = finiteOption(scalarQuery('dimensionAudit'), ['matches', 'conflict']) as DimensionAuditFilter
  constructor.value = finiteOption(scalarQuery('constructor'), constructors.value.map(({ id }) => id))
  representation.value = finiteOption(scalarQuery('representation'), representations.value.map(({ id }) => id))
  const requestedPage = scalarQuery('page')
  page.value = requestedPage && /^[1-9]\d*$/.test(requestedPage) && Number(requestedPage) <= pages.value
    ? Number(requestedPage)
    : 1
  canonicalReplace()
}

function matchesSourceCriterion(item: FormulaRecord, filter: SourceCriterionFilter): boolean {
  if (filter === 'all') return true
  return filter === 'met' ? item.sourceAudit.met : !item.sourceAudit.met
}

function sourceCriterionLabel(item: FormulaRecord): string {
  const name = item.sourceAudit.basis === 'exact' ? 'source digit criterion' : 'source 5.2 sigma criterion'
  const state = item.sourceAudit.met ? 'met' : 'not met'
  return `${name} ${state}`
}

function sourceCriterionClass(item: FormulaRecord): string {
  return item.sourceAudit.met ? 'is-met' : 'is-not-met'
}

function sameRouteQuery(next: LocationQueryRaw): boolean {
  const currentKeys = Object.keys(route.query).sort()
  const nextKeys = Object.keys(next).sort()
  return currentKeys.length === nextKeys.length
    && currentKeys.every((key, index) => key === nextKeys[index] && route.query[key] === next[key])
}

function canonicalReplace(): void {
  if (!sameRouteQuery(stateQuery.value)) void router.replace({ path: '/atlas', query: stateQuery.value })
}

function commitFilters(): void {
  page.value = 1
  canonicalReplace()
}

function changeTopic(): void {
  category.value = 'all'
  commitFilters()
}

function clearContext(): void {
  topic.value = 'all'
  category.value = 'all'
  commitFilters()
}

function changePage(next: number): void {
  page.value = Math.min(Math.max(next, 1), pages.value)
  canonicalReplace()
}

function topicTitle(id: string): string {
  return topics.value.find((item) => item.id === id)?.shortTitle ?? id
}

function categoryTitle(topicId: string, categoryId: string): string {
  return topics.value.find((item) => item.id === topicId)?.categories.find((item) => item.id === categoryId)?.title ?? categoryId
}
</script>

<template lang="pug">
.view.formula-atlas(:data-testid="registryReady ? 'formula-registry-ready' : undefined")
  header.view-header
    div
      p.eyebrow Instrument 01 / formula registry
      h1 Formula Atlas
      p Source reproduction records. Source criteria are not scientific validation.
    .header-stat(v-if="registryReady")
      strong {{ filtered.length }} / {{ formulaRegistry.formulas.value.length }}
      span visible recipes
      strong.dimension-conflict-count(data-testid="dimension-conflict-count") {{ dimensionConflictCount }} dimension conflicts
      span dimension audit, never repaired
      strong.dependency-drift-count(data-testid="dependency-drift-count") {{ dependencyDriftCount }} direct dependency differences
      span preserved source versus current runtime

  .loading-plate(v-if="registryLoading") Loading formula registry…
  .empty-state(v-else-if="registryError" role="alert")
    strong Formula registry unavailable
    p {{ registryError }}

  section.atlas-context(v-if="registryReady && selectedTopic" data-testid="atlas-context")
    RouterLink(:to="`/topics/${selectedTopic.id}`") ← {{ selectedTopic.shortTitle }} guide
    span
      strong {{ selectedTopic.title }}
      small {{ selectedCategory?.title ?? 'All categories in this topic' }}
    button.context-clear(type="button" @click="clearContext") Clear context

  section.filter-console.filter-console-primary(v-if="registryReady" aria-label="Primary formula filters")
    label.field.field-search
      span Search registry
      input(v-model="query" data-testid="formula-search" type="search" placeholder="symbol, equation, dependency…" @input="commitFilters")
    label.field
      span Topic
      select(v-model="topic" data-testid="formula-topic" @change="changeTopic")
        option(value="all") all topics
        option(v-for="item in topics" :key="item.id" :value="item.id") {{ item.shortTitle }} ({{ item.count }})
    label.field
      span Category
      select(v-model="category" data-testid="formula-category" :disabled="topic === 'all'" @change="commitFilters")
        option(value="all") all categories
        option(v-for="item in categories" :key="item.id" :value="item.id") {{ item.title }} ({{ item.count }})
    label.field
      span Reference basis
      select(v-model="basis" data-testid="formula-basis" @change="commitFilters")
        option(value="all") exact + measured
        option(value="exact") source-labelled exact
        option(value="measured") source-labelled measured

  details.advanced-filter-panel(v-if="registryReady" data-testid="advanced-filters")
    summary
      span Advanced source and dimension filters
      small(v-if="advancedFilterCount") {{ advancedFilterCount }} active
      small(v-else) source topology, source criterion, dimension audit, and recipe form
    .advanced-filter-grid
      label.field
        span Source column
        select(v-model="column" data-testid="formula-column" @change="commitFilters")
          option(value="all") all columns
          option(v-for="item in columns" :key="item" :value="item") {{ item }}
      label.field
        span Source island
        select(v-model="island" data-testid="formula-island" @change="commitFilters")
          option(value="all") all islands
          option(v-for="item in islands" :key="item" :value="item") {{ item }}
      label.field
        span Source criterion / not scientific validation
        select(v-model="sourceCriterion" data-testid="formula-source-criterion" @change="commitFilters")
          option(value="all") all source criteria
          option(value="met") criterion met
          option(value="not-met") criterion not met
      label.field
        span Dimension audit
        select(v-model="dimensionAudit" data-testid="formula-dimension-audit" @change="commitFilters")
          option(value="all") matches + conflicts
          option(value="matches") declared/computed match
          option(value="conflict") declared/computed conflict
      label.field
        span Constructor
        select(v-model="constructor" data-testid="formula-constructor" @change="commitFilters")
          option(value="all") all constructors
          option(v-for="item in constructors" :key="item.id" :value="item.id") {{ item.id }} ({{ item.count }})
      label.field
        span Representation
        select(v-model="representation" data-testid="formula-representation" @change="commitFilters")
          option(value="all") all representations
          option(v-for="item in representations" :key="item.id" :value="item.id") {{ item.id.replaceAll('-', ' ') }} ({{ item.count }})

  .atlas-key(v-if="registryReady" aria-label="Table key")
    span # / symbol
    span equation / name
    span topic / category
    span expected → computed
    span source + dimension audits

  p.atlas-result-count(
    v-if="registryReady"
    data-testid="formula-result-count"
    role="status"
    aria-live="polite"
  ) {{ announcedResultCount }}

  section.formula-list(v-if="registryReady" data-testid="formula-list")
    RouterLink.formula-row(
      v-for="formula in visible"
      :key="formula.id"
      :to="{ path: `/atlas/${formula.ordinal}`, query: detailQuery }"
      :data-testid="`formula-row-${formula.ordinal}`"
    )
      .formula-identity
        span {{ String(formula.ordinal).padStart(3, '0') }}
        strong {{ formula.symbol }}
      .formula-expression
        code {{ formula.equation }}
        small {{ formula.name }}
      .formula-location
        span {{ topicTitle(formula.topic) }}
        small {{ categoryTitle(formula.topic, formula.category) }}
        small col {{ formula.column }} / island {{ formula.island }}
      .formula-values
        span {{ formula.expected }}
        small → {{ formula.computed }} {{ formula.meaning.unit }}
        small signed residual {{ formula.residualScale.signedAbsolute.value }} {{ formula.residualScale.signedAbsolute.unit }}
      .formula-audit
        span.criterion-chip(:class="sourceCriterionClass(formula)") {{ sourceCriterionLabel(formula) }}
        small not scientific validation
        small.dimension-audit-indicator(:class="formula.dimensionAudit.matches ? 'is-match' : 'is-conflict'") dimension audit {{ formula.dimensionAudit.matches ? 'match' : 'conflict' }}
        small.dependency-agreement-indicator(:class="formula.dependencyAgreement.matches ? 'is-match' : 'is-drift'") source/runtime direct dependencies {{ formula.dependencyAgreement.matches ? 'agree' : 'differ' }}
    .empty-state(v-if="visible.length === 0")
      strong No matching registry entries
      p Adjust the query or filters. Missing engine entries are not synthesized.

  nav.pagination(v-if="registryReady && filtered.length > pageSize" aria-label="Formula pages")
    button(type="button" :disabled="page === 1" @click="changePage(page - 1)") Previous
    span Page {{ page }} / {{ pages }}
    button(type="button" :disabled="page === pages" @click="changePage(page + 1)") Next
</template>
