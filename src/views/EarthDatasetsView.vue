<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import EarthLocalNav from '../components/EarthLocalNav.vue'
import {
  loadEarthDatasetRegistry,
  type DatasetAuthenticationStatus,
  type EarthDatasetRecord,
  type EarthDatasetRegistry,
  type EarthDisputedClaim,
} from '../earth/datasets'
import { loadScientificSimulationBundle, type ScientificSimulationBundle, type ScientificSimulationRecord } from '../earth/simulations'

const SORT_ORDERS = ['queue', 'name', 'owner', 'source-line'] as const
type SortOrder = typeof SORT_ORDERS[number]

const route = useRoute()
const router = useRouter()
const registry = ref<EarthDatasetRegistry | null>(null)
const simulationBundle = ref<ScientificSimulationBundle | null>(null)
const error = ref('')
const contextError = ref('')
const query = ref('')
const datasetId = ref('all')
const program = ref('all')
const category = ref('all')
const priority = ref('all')
const authentication = ref('all')
const redistribution = ref('all')
const g0b = ref('all')
const sortOrder = ref<SortOrder>('queue')
const controller = new AbortController()

const datasets = computed(() => registry.value?.datasets ?? [])
const categories = computed(() => [...new Set(datasets.value.map(({ category: value }) => value))].sort())
const authenticationStates = computed(() => [...new Set(datasets.value.flatMap(({ authenticationStatuses }) => authenticationStatuses))].sort())
const programs = computed(() => [...new Set(datasets.value.flatMap(({ simulationIds }) => simulationIds))].sort())
const statement = computed(() => {
  const pending = datasets.value.filter(({ g0bState }) => g0bState === 'pending').length
  const blocked = datasets.value.filter(({ g0bState }) => g0bState === 'blocked').length
  return {
    metadataAuthenticated: datasets.value.filter(({ metadataAuthenticated }) => metadataAuthenticated).length,
    acquired:              datasets.value.length - datasets.value.filter(({ acquisitionStatus }) => acquisitionStatus === 'not-acquired').length,
    frozen:                datasets.value.filter(({ frozen }) => frozen).length,
    g0bPassed:             datasets.value.length - pending - blocked,
    pending,
    blocked,
    controlledHandling:    datasets.value.filter(({ requiresControlledHandling }) => requiresControlledHandling).length,
  }
})
const filtered = computed(() => datasets.value.filter((dataset) => {
  const search = query.value.trim().toLocaleLowerCase()
  return (!search || datasetSearchText(dataset).includes(search))
    && (datasetId.value === 'all' || dataset.datasetId === datasetId.value)
    && (program.value === 'all' || dataset.simulationIds.includes(program.value))
    && (category.value === 'all' || dataset.category === category.value)
    && (priority.value === 'all' || dataset.priority === priority.value)
    && (authentication.value === 'all' || dataset.authenticationStatuses.includes(authentication.value as DatasetAuthenticationStatus))
    && (redistribution.value === 'all' || dataset.redistributionMode === redistribution.value)
    && (g0b.value === 'all' || dataset.g0bState === g0b.value)
}))
const visible = computed(() => [...filtered.value].sort(compareDatasets))
const hasActiveFilters = computed(() => Boolean(query.value.trim()) || [
  datasetId,
  program,
  category,
  priority,
  authentication,
  redistribution,
  g0b,
].some(({ value }) => value !== 'all') || sortOrder.value !== 'queue')

function datasetSearchText(dataset: EarthDatasetRecord): string {
  return [
    dataset.datasetId,
    dataset.name,
    dataset.category,
    dataset.responsibleOrganization,
    dataset.releaseEvidence,
    dataset.canonicalSourceEvidence,
    dataset.ownerReleaseEvidence,
    dataset.redistributionEvidence,
    dataset.authenticationEvidence,
    dataset.blockerEvidence,
    dataset.redistributionMode,
    dataset.priority,
    dataset.g0bState,
    ...dataset.sourceUrls,
    ...dataset.sourceDois,
    ...dataset.simulationIds,
    ...dataset.blockers,
  ].join(' ').toLocaleLowerCase()
}

function compareDatasets(left: EarthDatasetRecord, right: EarthDatasetRecord): number {
  if (sortOrder.value === 'name') return left.name.localeCompare(right.name)
  if (sortOrder.value === 'owner') {
    return left.responsibleOrganization.localeCompare(right.responsibleOrganization) || left.name.localeCompare(right.name)
  }
  if (sortOrder.value === 'source-line') return left.sourceLine - right.sourceLine || left.name.localeCompare(right.name)
  const priorityDifference = Number(left.priority.slice(1)) - Number(right.priority.slice(1))
  const readinessDifference = Number(!left.authenticationStatuses.includes('authenticated/acquisition-ready'))
    - Number(!right.authenticationStatuses.includes('authenticated/acquisition-ready'))
  return priorityDifference || readinessDifference || left.name.localeCompare(right.name)
}

function routeString(key: string, fallback: string): string {
  const value = route.query[key]
  return typeof value === 'string' && value !== '' ? value : fallback
}

function hydrateFromRoute(): void {
  const requestedSort = routeString('sort', 'queue')
  query.value = routeString('q', '')
  datasetId.value = routeString('dataset', 'all')
  program.value = routeString('program', 'all')
  category.value = routeString('category', 'all')
  priority.value = routeString('priority', 'all')
  authentication.value = routeString('authentication', 'all')
  redistribution.value = routeString('redistribution', 'all')
  g0b.value = routeString('g0b', 'all')
  sortOrder.value = SORT_ORDERS.includes(requestedSort as SortOrder) ? requestedSort as SortOrder : 'queue'
}

function ledgerQuery(): LocationQueryRaw {
  return {
    ...(query.value.trim() ? { q: query.value.trim() } : {}),
    ...(datasetId.value === 'all' ? {} : { dataset: datasetId.value }),
    ...(program.value === 'all' ? {} : { program: program.value }),
    ...(category.value === 'all' ? {} : { category: category.value }),
    ...(priority.value === 'all' ? {} : { priority: priority.value }),
    ...(authentication.value === 'all' ? {} : { authentication: authentication.value }),
    ...(redistribution.value === 'all' ? {} : { redistribution: redistribution.value }),
    ...(g0b.value === 'all' ? {} : { g0b: g0b.value }),
    ...(sortOrder.value === 'queue' ? {} : { sort: sortOrder.value }),
  }
}

function queryMatchesRoute(next: LocationQueryRaw): boolean {
  const routeKeys = Object.keys(route.query)
  const nextKeys = Object.keys(next)
  return routeKeys.length === nextKeys.length && nextKeys.every((key) => route.query[key] === next[key])
}

function clearFilters(): void {
  query.value = ''
  datasetId.value = 'all'
  program.value = 'all'
  category.value = 'all'
  priority.value = 'all'
  authentication.value = 'all'
  redistribution.value = 'all'
  g0b.value = 'all'
  sortOrder.value = 'queue'
}

function claimStatus(value: string): string {
  return value === 'nonexistent-as-claimed' ? 'NONEXISTENT AS CLAIMED' : 'UNVERIFIED SOURCE'
}

function authenticationLabel(value: DatasetAuthenticationStatus): string {
  const labels: Record<DatasetAuthenticationStatus, string> = {
    'authenticated/acquisition-ready': 'Metadata authenticated / acquisition ready',
    'authenticated/live-unfrozen':     'Metadata authenticated / live source, not frozen',
    'authenticated/terms-blocked':     'Metadata authenticated / terms blocked',
  }
  return labels[value]
}

function redistributionLabel(value: string): string {
  return `${value.replaceAll('-', ' ')} redistribution`
}

function externalDestination(url: string): string {
  const parsed = new URL(url)
  return `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`
}

function programRecord(id: string): ScientificSimulationRecord | null {
  return simulationBundle.value?.registry.records.find((record) => record.id === id) ?? null
}

function runnableMethodCount(record: ScientificSimulationRecord | null): number {
  return record?.executionMethods.filter(({ runnable }) => runnable).length ?? 0
}

function unavailableMethodCount(record: ScientificSimulationRecord | null): number {
  return record?.executionMethods.filter(({ runnable }) => !runnable).length ?? 0
}

function unavailableMethodSummary(record: ScientificSimulationRecord | null): string {
  const count = unavailableMethodCount(record)
  return `${count} unavailable source formulation${count === 1 ? '' : 's'}`
}

function methodContext(record: ScientificSimulationRecord | null): string {
  return record?.executionMethods.map((method) => (
    `${method.title} [${method.runnable ? `runnable via ${method.runtime}` : 'unavailable source formulation'}]`
  )).join(' / ') ?? ''
}

function relatedDisputes(dataset: EarthDatasetRecord): EarthDisputedClaim[] {
  return registry.value?.disputedClaims.filter((claim) => (
    claim.simulationIds.some((id) => dataset.simulationIds.includes(id))
  )) ?? []
}

watch(() => route.query, hydrateFromRoute, { immediate: true })
watch([
  query,
  datasetId,
  program,
  category,
  priority,
  authentication,
  redistribution,
  g0b,
  sortOrder,
], () => {
  const next = ledgerQuery()
  if (!queryMatchesRoute(next)) void router.replace({ query: next })
})

onMounted(async () => {
  try {
    registry.value = await loadEarthDatasetRegistry(controller.signal)
    try {
      simulationBundle.value = await loadScientificSimulationBundle(controller.signal)
    } catch (reason) {
      if (!controller.signal.aborted) contextError.value = reason instanceof Error ? reason.message : String(reason)
    }
  } catch (reason) {
    if (controller.signal.aborted) return
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
})

onBeforeUnmount(() => controller.abort())
</script>

<template lang="pug">
.view.earth-datasets-view
  EarthLocalNav
  header.view-header
    div
      p.eyebrow Instrument 03/D / authenticated acquisition ledger
      h1 EARTH Dataset Ledger
    .header-stat
      strong {{ visible.length }} / {{ datasets.length }}
      span matching metadata records

  section.dataset-authentication-note(data-testid="dataset-authentication-note")
    strong METADATA AUTHENTICATION ≠ SCIENTIFIC VALIDATION
    p Metadata authentication records source identity, release evidence, and terms. It does not imply dataset acquisition, frozen bytes, reproduced results, or scientific validation.

  section.dataset-method-policy(data-testid="dataset-method-policy")
    strong DATASET-TO-METHOD ASSIGNMENT IS NOT FROZEN
    p Program and method labels below are validated registry context. Declared methods include both runnable methods and unavailable source formulations; dataset records do not assign either kind to an acquisition.

  section.dataset-registry-statement(v-if="registry" data-testid="dataset-summary" aria-label="Derived dataset registry statement")
    p
      strong {{ statement.metadataAuthenticated }} metadata-authenticated records
      span Source identity and terms recorded; scientific validation remains separate.
    p
      strong {{ statement.acquired }} acquired / {{ statement.frozen }} frozen
      span No acquisition manifest has frozen source bytes.
    p.is-gate-statement
      strong G0b {{ statement.g0bPassed }}/{{ datasets.length }} passed
      span {{ statement.pending }} pending / {{ statement.blocked }} blocked.
    p
      strong {{ statement.controlledHandling }} controlled-handling record{{ statement.controlledHandling === 1 ? '' : 's' }}
      span Handling follows source terms and personal-data controls.

  section.filter-console.dataset-filters(aria-label="Dataset registry filters")
    label.field.field-search
      span Search evidence ledger
      input(v-model="query" data-testid="dataset-search" type="search" placeholder="dataset, owner, evidence, DOI, or program")
    label.field
      span Specific dataset
      select(v-model="datasetId" data-testid="dataset-id")
        option(value="all") all datasets
        option(v-for="dataset in datasets" :key="dataset.datasetId" :value="dataset.datasetId") {{ dataset.name }}
    label.field
      span Canonical program
      select(v-model="program" data-testid="dataset-program")
        option(value="all") all programs
        option(v-for="id in programs" :key="id" :value="id") {{ id }}
    label.field
      span Category
      select(v-model="category" data-testid="dataset-category")
        option(value="all") all categories
        option(v-for="item in categories" :key="item" :value="item") {{ item }}
    label.field
      span Priority
      select(v-model="priority" data-testid="dataset-priority")
        option(value="all") all priorities
        option(value="P0") priority P0
        option(value="P1") priority P1
        option(value="P2") priority P2
    label.field
      span Authentication
      select(v-model="authentication" data-testid="dataset-authentication")
        option(value="all") all authentication states
        option(v-for="item in authenticationStates" :key="item" :value="item") {{ authenticationLabel(item) }}
    label.field
      span Redistribution
      select(v-model="redistribution" data-testid="dataset-redistribution")
        option(value="all") all redistribution modes
        option(value="raw") raw
        option(value="derived-only") derived only
        option(value="metadata-only") metadata only
        option(value="prohibited") prohibited
        option(value="unknown") unknown
    label.field
      span G0b state
      select(v-model="g0b" data-testid="dataset-g0b")
        option(value="all") all G0b states
        option(value="pending") G0b pending
        option(value="blocked") G0b blocked
    label.field
      span Sort ledger
      select(v-model="sortOrder" data-testid="dataset-sort")
        option(value="queue") work queue: priority, readiness, name
        option(value="name") dataset name
        option(value="owner") responsible organization
        option(value="source-line") source registry line
    button.dataset-clear-filters(type="button" data-testid="dataset-clear-filters" :disabled="!hasActiveFilters" @click="clearFilters") Clear filters

  p.inline-error(v-if="error" role="alert") {{ error }}
  p.inline-error(v-else-if="contextError" role="status") Program method context unavailable: {{ contextError }}
  p.earth-loading(v-else-if="!registry" aria-live="polite") Loading authenticated dataset metadata…

  template(v-else)
    p.dataset-result-count(data-testid="dataset-result-count" aria-live="polite" aria-atomic="true")
      strong {{ visible.length }} of {{ datasets.length }} records
      span No pagination · sorted by {{ sortOrder === 'queue' ? 'priority, acquisition readiness, then name' : sortOrder.replaceAll('-', ' ') }}

    section.dataset-registry-ledger(data-testid="dataset-grid" aria-label="Dataset acquisition ledger")
      .dataset-ledger-key(aria-hidden="true")
        span Record
        span Owner / release
        span Priority
        span Authentication
        span G0b
        span Acquisition
        span Redistribution / programs
      details.dataset-record(v-for="dataset in visible" :key="dataset.datasetId" :data-testid="`dataset-${dataset.datasetId}`")
        summary.dataset-ledger-row
          .dataset-cell.dataset-identity(data-label="Record")
            code {{ dataset.datasetId }}
            strong {{ dataset.name }}
            small {{ dataset.category }}
            span.dataset-ledger-action
              span.is-closed Evidence +
              span.is-open Evidence −
          .dataset-cell(data-label="Owner / release")
            strong {{ dataset.responsibleOrganization }}
            span {{ dataset.releaseEvidence }}
          .dataset-cell(data-label="Priority")
            strong {{ `Priority ${dataset.priority}` }}
          .dataset-cell(data-label="Authentication")
            strong {{ dataset.authenticationStatuses.map(authenticationLabel).join('; ') }}
          .dataset-cell(data-label="G0b")
            strong {{ `G0b ${dataset.g0bState}` }}
          .dataset-cell(data-label="Acquisition")
            strong Not acquired
            span Not frozen
          .dataset-cell(data-label="Redistribution / programs")
            strong {{ redistributionLabel(dataset.redistributionMode) }}
            span {{ dataset.simulationIds.length }} linked program{{ dataset.simulationIds.length === 1 ? '' : 's' }}

        .dataset-evidence
          section
            h3 Source identity and ownership
            dl.dataset-evidence-list
              div
                dt Source registry line
                dd {{ dataset.sourceLine }}
              div
                dt Canonical source evidence
                dd {{ dataset.canonicalSourceEvidence }}
              div
                dt Owner / release evidence
                dd {{ dataset.ownerReleaseEvidence }}
            h4 All source URLs
            ul.dataset-external-links
              li(v-for="(url, index) in dataset.sourceUrls" :key="url")
                a(:href="url" target="_blank" rel="noreferrer" :aria-label="`Open source ${index + 1} for ${dataset.name} at ${externalDestination(url)} in a new tab`") Source {{ index + 1 }} · {{ externalDestination(url) }} ↗
            template(v-if="dataset.sourceDois.length")
              h4 All source DOIs
              ul.dataset-external-links
                li(v-for="doi in dataset.sourceDois" :key="doi")
                  a(:href="`https://doi.org/${doi}`" target="_blank" rel="noreferrer" :aria-label="`Open DOI ${doi} for ${dataset.name} in a new tab`") DOI {{ doi }} ↗

          section
            h3 Authentication, terms, and handling
            dl.dataset-evidence-list
              div
                dt Authentication status
                dd {{ dataset.authenticationStatuses.map(authenticationLabel).join('; ') }}. Metadata authentication is not scientific validation.
              div
                dt Authentication evidence
                dd {{ dataset.authenticationEvidence }}
              div
                dt Access classes
                dd {{ dataset.accessClasses.join(' / ') }}
              div
                dt Redistribution evidence
                dd {{ dataset.redistributionEvidence }}
              div
                dt Handling evidence
                dd {{ dataset.personalDataEvidence }} · {{ dataset.dataHandling }} · {{ dataset.requiresControlledHandling ? 'controlled handling required' : 'source-terms handling' }}
            a.dataset-terms-link(:href="dataset.termsUrl" target="_blank" rel="noreferrer" :aria-label="`Open terms for ${dataset.name} at ${externalDestination(dataset.termsUrl)} in a new tab`") Terms · {{ externalDestination(dataset.termsUrl) }} ↗

          section
            h3 Acquisition manifest
            dl.dataset-evidence-list.dataset-acquisition
              div
                dt Acquisition status
                dd {{ dataset.acquisitionStatus }}
              div
                dt Retrieved at
                dd {{ dataset.retrievedAt ?? 'not recorded' }}
              div
                dt Query / selection
                dd {{ dataset.queryOrSelection ?? 'not recorded' }}
              div
                dt Row count
                dd {{ dataset.rowCount ?? 'not recorded' }}
              div
                dt Byte count
                dd {{ dataset.byteCount ?? 'not recorded' }}
              div
                dt Frozen
                dd {{ dataset.frozen ? 'yes' : 'no' }}
              div
                dt SHA256
                dd {{ dataset.sha256 ?? 'not recorded' }}
            .dataset-blockers
              h4 Acquisition and G0b blocker evidence
              p {{ dataset.blockerEvidence }}
              ul
                li(v-for="blocker in dataset.blockers" :key="blocker") {{ blocker }}

          section.dataset-simulation-links(:aria-label="`Program and method context for ${dataset.name}`")
            h3 Program and method context
            p.dataset-assignment-warning Assignment not frozen: these are linked canonical programs, not dataset-to-execution-method assignments.
            .dataset-program-context
              RouterLink(v-for="id in dataset.simulationIds" :key="id" :to="`/earth/programs/${encodeURIComponent(id)}`")
                code {{ id }}
                template(v-if="programRecord(id)")
                  b {{ programRecord(id)?.title }}
                  small {{ programRecord(id)?.executionMethods.length }} declared methods · {{ runnableMethodCount(programRecord(id)) }} runnable · {{ unavailableMethodSummary(programRecord(id)) }}
                  small {{ methodContext(programRecord(id)) }}
                small(v-else) Program registry context unavailable; no method availability claim made.
            .dataset-related-warnings(v-if="relatedDisputes(dataset).length")
              h4 Related disputed source claims
              article(v-for="claim in relatedDisputes(dataset)" :key="claim.claimId")
                strong {{ claimStatus(claim.registryStatus) }} · {{ claim.claim }}
                p {{ claim.finding }} {{ claim.consequence }}

      .empty-state(v-if="visible.length === 0")
        strong No matching datasets
        p Clear or adjust the evidence-ledger filters.

  section.disputed-claims-section(v-if="registry" data-testid="disputed-claims")
    header.section-heading
      div
        p.eyebrow Source integrity exceptions
        h2 Disputed source claims
      p These four claims are preserved as audit findings, not registered datasets or available data sources.
    .disputed-claims-grid
      article.disputed-claim(v-for="claim in registry.disputedClaims" :key="claim.claimId")
        header
          code {{ claim.claimId }} · source line {{ claim.sourceLine }}
          strong {{ claimStatus(claim.registryStatus) }}
        h3 {{ claim.claim }}
        p {{ claim.finding }}
        p
          strong Consequence:
          |  {{ claim.consequence }}
        div(v-if="claim.simulationIds.length")
          RouterLink(v-for="id in claim.simulationIds" :key="id" :to="`/earth/programs/${encodeURIComponent(id)}`") {{ id }}
</template>
