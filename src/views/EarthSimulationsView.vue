<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import EarthLocalNav from '../components/EarthLocalNav.vue'
import {
  loadScientificSimulationBundle,
  type ScientificSimulationBundle,
  type ScientificSimulationRecord,
} from '../earth/simulations'

const PAGE_SIZE = 36
const ATTENTION_GATE_STATES = new Set(['partial', 'pending', 'blocked', 'not-evaluated'])
const QUERY_KEYS = ['q', 'domain', 'class', 'science', 'method', 'runtime', 'gate', 'page'] as const

const route = useRoute()
const router = useRouter()
const bundle = ref<ScientificSimulationBundle | null>(null)
const error = ref('')
const query = ref('')
const domain = ref('all')
const classification = ref('all')
const scientificReadiness = ref('all')
const methodRelationship = ref('all')
const runtimeAvailability = ref('all')
const gateAttention = ref('all')
const page = ref(1)
const controller = new AbortController()

const records = computed(() => bundle.value?.registry.records ?? [])
const domains = computed(() => [...new Set(records.value.map((record) => record.prefix))].sort())
const classifications = computed(() => [...new Set(records.value.map((record) => record.classification))].sort())
const scientificStatuses = computed(() => [...new Set(records.value.map((record) => record.scientificStatus))].sort())
const methodRelationships = computed(() => [...new Set(records.value.flatMap((record) => (
  record.executionMethods.map((method) => method.relationship)
)))].sort())
const gateIds = computed(() => [...new Set(records.value.flatMap((record) => Object.keys(record.gateStates)))].sort())
const methods = computed(() => records.value.flatMap((record) => record.executionMethods))
const runnableMethods = computed(() => methods.value.filter(({ runnable }) => runnable))
const unavailableMethodCount = computed(() => methods.value.length - runnableMethods.value.length)
const sourceReproductionCount = computed(() => runnableMethods.value.filter(({ relationship }) => relationship === 'earth-source-reproduction').length)
const comparisonMethodCount = computed(() => runnableMethods.value.length - sourceReproductionCount.value)
const advancedFilterCount = computed(() => [
  scientificReadiness,
  methodRelationship,
  runtimeAvailability,
  gateAttention,
].filter((item) => item.value !== 'all').length)

const filtered = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return records.value.filter((record) => {
    const searchable = [
      record.id,
      record.title,
      record.prefix,
      record.classification,
      record.classificationSource ?? '',
      record.highLevelGoal,
      record.sourceState.text,
      ...record.minorGoals,
      ...record.outputs,
      ...record.blockers,
      ...record.executionMethods.flatMap((method) => [method.title, method.relationship, method.runtime]),
    ].join(' ').toLocaleLowerCase()
    return (!search || searchable.includes(search))
      && (domain.value === 'all' || record.prefix === domain.value)
      && (classification.value === 'all' || record.classification === classification.value)
      && (scientificReadiness.value === 'all' || record.scientificStatus === scientificReadiness.value)
      && (methodRelationship.value === 'all' || record.executionMethods.some(({ relationship }) => relationship === methodRelationship.value))
      && (runtimeAvailability.value === 'all' || recordHasRuntimeAvailability(record, runtimeAvailability.value))
      && (gateAttention.value === 'all' || recordMatchesGateAttention(record, gateAttention.value))
  }).sort((left, right) => left.prefix.localeCompare(right.prefix) || left.id.localeCompare(right.id))
})
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const currentPage = computed(() => Math.min(Math.max(page.value, 1), pages.value))
const visible = computed(() => filtered.value.slice((currentPage.value - 1) * PAGE_SIZE, currentPage.value * PAGE_SIZE))
const groupedVisible = computed(() => {
  const totals = new Map<string, number>()
  filtered.value.forEach((record) => totals.set(record.prefix, (totals.get(record.prefix) ?? 0) + 1))
  const groups: Array<{ prefix: string, total: number, records: ScientificSimulationRecord[] }> = []
  visible.value.forEach((record) => {
    let group = groups.at(-1)
    if (!group || group.prefix !== record.prefix) {
      group = { prefix: record.prefix, total: totals.get(record.prefix) ?? 0, records: [] }
      groups.push(group)
    }
    group.records.push(record)
  })
  return groups
})
const resultStart = computed(() => filtered.value.length === 0 ? 0 : (currentPage.value - 1) * PAGE_SIZE + 1)
const resultEnd = computed(() => Math.min(currentPage.value * PAGE_SIZE, filtered.value.length))

function routeString(key: typeof QUERY_KEYS[number], fallback: string): string {
  const value = route.query[key]
  return typeof value === 'string' && value !== '' ? value : fallback
}

function routePage(): number {
  const value = Number.parseInt(routeString('page', '1'), 10)
  return Number.isInteger(value) && value > 0 ? value : 1
}

function hydrateFromRoute(): void {
  query.value = routeString('q', '')
  domain.value = routeString('domain', 'all')
  classification.value = routeString('class', 'all')
  scientificReadiness.value = routeString('science', 'all')
  methodRelationship.value = routeString('method', 'all')
  runtimeAvailability.value = routeString('runtime', 'all')
  gateAttention.value = routeString('gate', 'all')
  page.value = routePage()
}

function registryQuery(): LocationQueryRaw {
  return {
    ...(query.value.trim() ? { q: query.value.trim() } : {}),
    ...(domain.value === 'all' ? {} : { domain: domain.value }),
    ...(classification.value === 'all' ? {} : { class: classification.value }),
    ...(scientificReadiness.value === 'all' ? {} : { science: scientificReadiness.value }),
    ...(methodRelationship.value === 'all' ? {} : { method: methodRelationship.value }),
    ...(runtimeAvailability.value === 'all' ? {} : { runtime: runtimeAvailability.value }),
    ...(gateAttention.value === 'all' ? {} : { gate: gateAttention.value }),
    ...(page.value === 1 ? {} : { page: String(page.value) }),
  }
}

function queryMatchesRoute(next: LocationQueryRaw): boolean {
  const routeKeys = Object.keys(route.query)
  const nextKeys = Object.keys(next)
  return routeKeys.length === nextKeys.length
    && nextKeys.every((key) => route.query[key] === next[key])
}

function resetPage(): void {
  page.value = 1
}

function setPage(nextPage: number): void {
  page.value = Math.min(Math.max(nextPage, 1), pages.value)
}

function recordHasRuntimeAvailability(record: ScientificSimulationRecord, availability: string): boolean {
  return availability === 'available'
    ? record.executionMethods.some(({ runnable }) => runnable)
    : record.executionMethods.some(({ runnable }) => !runnable)
}

function attentionGates(record: ScientificSimulationRecord): string[] {
  return Object.entries(record.gateStates)
    .filter(([, state]) => ATTENTION_GATE_STATES.has(state))
    .map(([gate]) => gate)
}

function recordMatchesGateAttention(record: ScientificSimulationRecord, gate: string): boolean {
  const gates = attentionGates(record)
  if (gate === 'attention') return gates.length > 0
  if (gate === 'clear') return gates.length === 0
  return gates.includes(gate)
}

function formatToken(value: string): string {
  return value.replaceAll('-', ' ')
}

function sourceStatus(record: ScientificSimulationRecord): string {
  return record.sourceState.status === 'blocked' ? 'SOURCE MODEL BLOCKED' : 'SOURCE INPUT READY'
}

function scientificStatus(status: string): string {
  const labels: Record<string, string> = {
    'blocked-source': 'BLOCKED BY SOURCE MODEL',
    blocked:          'EXECUTION BLOCKED / NOT VALIDATED',
    exploratory:      'EXPLORATORY / NOT VALIDATED',
    unresolved:       'UNRESOLVED',
  }
  return labels[status] ?? `NOT VALIDATED / ${formatToken(status).toLocaleUpperCase()}`
}

function methodSummary(record: ScientificSimulationRecord): string {
  return [...new Set(record.executionMethods.map(({ relationship }) => formatToken(relationship)))].join(' + ')
}

function runtimeSummary(record: ScientificSimulationRecord): string {
  return [...new Set(record.executionMethods.map(({ runtime }) => formatToken(runtime)))].join(' + ')
}

function runnableMethodCount(record: ScientificSimulationRecord): number {
  return record.executionMethods.filter(({ runnable }) => runnable).length
}

function unavailableMethodCountFor(record: ScientificSimulationRecord): number {
  return record.executionMethods.filter(({ runnable }) => !runnable).length
}

watch(() => route.query, hydrateFromRoute, { immediate: true })
watch([query, domain, classification, scientificReadiness, methodRelationship, runtimeAvailability, gateAttention, page], () => {
  const next = registryQuery()
  if (!queryMatchesRoute(next)) void router.replace({ query: next })
})
watch([pages, bundle], () => {
  if (bundle.value && page.value > pages.value) page.value = pages.value
})

onMounted(async () => {
  try {
    bundle.value = await loadScientificSimulationBundle(controller.signal)
  } catch (reason) {
    if (controller.signal.aborted) return
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
})

onBeforeUnmount(() => controller.abort())
</script>

<template lang="pug">
.view.earth-simulations-view
  EarthLocalNav
  header.view-header
    div
      p.eyebrow Instrument 03-C / canonical program ledger
      h1 EARTH Program Registry
    .header-stat
      strong {{ filtered.length }} / {{ records.length || 130 }}
      span matching canonical programs

  section.program-registry-statement(v-if="bundle" data-testid="program-registry-statement" aria-label="Validated program registry statement")
    p
      strong {{ records.length }} canonical programs
      span Registry records validated against the source plan.
    p
      strong {{ methods.length }} declared methods
      span {{ runnableMethods.length }} runnable: {{ sourceReproductionCount }} source reproductions / {{ comparisonMethodCount }} traditional comparisons or contract validators; {{ unavailableMethodCount }} unavailable source formulations.
    p.is-validation-caveat
      strong Scientific validation not established
      span Execution coverage does not establish agreement with nature or EARTH theory validation.

  section.filter-console.earth-simulation-filters(aria-label="Primary program filters")
    label.field.field-search
      span Search programs
      input(
        v-model="query"
        data-testid="simulation-search"
        type="search"
        placeholder="ID, title, evidence, method, or output"
        @input="resetPage"
      )
    label.field
      span Domain
      select(v-model="domain" data-testid="simulation-domain" @change="resetPage")
        option(value="all") All domains
        option(v-for="item in domains" :key="item" :value="item") {{ item }} domain
    label.field
      span Canonical class
      select(v-model="classification" data-testid="simulation-class" @change="resetPage")
        option(value="all") All canonical classes
        option(v-for="item in classifications" :key="item" :value="item") {{ formatToken(item) }}

  details.advanced-filter-panel.earth-program-facets(data-testid="simulation-advanced-filters")
    summary
      span Scientific and execution facets
      small {{ advancedFilterCount }} active {{ advancedFilterCount === 1 ? 'filter' : 'filters' }}
    .advanced-filter-grid
      label.field
        span Scientific readiness
        select(v-model="scientificReadiness" data-testid="simulation-science" @change="resetPage")
          option(value="all") All scientific statuses
          option(v-for="item in scientificStatuses" :key="item" :value="item") {{ scientificStatus(item) }}
      label.field
        span Method relationship
        select(v-model="methodRelationship" data-testid="simulation-method" @change="resetPage")
          option(value="all") All method relationships
          option(v-for="item in methodRelationships" :key="item" :value="item") {{ formatToken(item) }}
      label.field
        span Runtime availability
        select(v-model="runtimeAvailability" data-testid="simulation-runtime" @change="resetPage")
          option(value="all") All runtime availability
          option(value="available") Has a runnable method
          option(value="unavailable") Has an unavailable method
      label.field
        span Gate needing attention
        select(v-model="gateAttention" data-testid="simulation-gate" @change="resetPage")
          option(value="all") All gate records
          option(value="attention") Any gate needs attention
          option(v-for="item in gateIds" :key="item" :value="item") {{ item }} needs attention
          option(value="clear") No gates need attention

  p.inline-error(v-if="error" role="alert") {{ error }}
  p.earth-loading(v-else-if="!bundle" aria-live="polite") Loading EARTH program registry…

  p.program-result-count(v-if="bundle" data-testid="simulation-result-count" aria-live="polite" aria-atomic="true")
    | Showing {{ resultStart }}–{{ resultEnd }} of {{ filtered.length }} matching programs. Page {{ currentPage }} of {{ pages }}.

  section.earth-program-ledger(v-if="bundle" data-testid="simulation-grid" aria-label="EARTH canonical program ledger")
    section.program-domain-group(v-for="group in groupedVisible" :key="`${currentPage}-${group.prefix}`" :data-domain="group.prefix")
      header.program-domain-heading
        h2 {{ group.prefix }} domain
        span {{ group.records.length }} on this page / {{ group.total }} matching
      .program-ledger-key(aria-hidden="true")
        span Program / canonical class
        span Source / scientific status
        span Methods / runtime
        span Next blocker or evidence
      RouterLink.earth-program-row(
        v-for="record in group.records"
        :key="record.id"
        :to="`/earth/programs/${encodeURIComponent(record.id)}`"
        :data-testid="`simulation-record-${record.id}`"
      )
        .program-row-identity
          code {{ record.id }}
          strong {{ record.title }}
          span
            b Canonical class:
            |  {{ formatToken(record.classification) }}
        .program-row-science
          strong(:class="{ 'is-source-blocked': record.sourceState.status === 'blocked' }") {{ sourceStatus(record) }}
          span
            b Scientific status:
            |  {{ scientificStatus(record.scientificStatus) }}
        .program-row-methods
          strong {{ record.executionMethods.length }} declared {{ record.executionMethods.length === 1 ? 'method' : 'methods' }}
          span {{ methodSummary(record) }}
          small {{ runnableMethodCount(record) }} runnable · {{ unavailableMethodCountFor(record) }} unavailable · {{ runtimeSummary(record) }}
        .program-row-evidence
          b {{ record.blockers.length ? 'Next blocker' : 'Source evidence' }}
          span {{ record.blockers[0] ?? record.sourceState.text }}
          small(v-if="attentionGates(record).length") Attention gates: {{ attentionGates(record).join(', ') }}
    .empty-state(v-if="filtered.length === 0")
      strong No matching canonical programs
      p Adjust search or the scientific and execution facets. Registry records are not synthesized.

  nav.pagination.program-pagination(v-if="bundle && filtered.length > PAGE_SIZE" aria-label="Program registry pages")
    button(type="button" aria-label="Previous registry page" :disabled="currentPage === 1" @click="setPage(currentPage - 1)") Previous
    span Page {{ currentPage }} / {{ pages }}
    button(type="button" aria-label="Next registry page" :disabled="currentPage === pages" @click="setPage(currentPage + 1)") Next
</template>
