<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AwesomePhysicsCatalogCard from '../components/awesomePhysics/AwesomePhysicsCatalogCard.vue'
import { registerAwesomePhysicsAdapters } from '../awesomePhysics/registerAdapters'
import { useAwesomePhysicsRegistry } from '../registries/awesomePhysicsRegistry'
import type {
  AwesomePhysicsAvailability,
  AwesomePhysicsCatalogItemV1,
  AwesomePhysicsExecutionKind,
  AwesomePhysicsLicenseStatus,
  AwesomePhysicsMaintenance,
  AwesomePhysicsOrganizationV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../types/awesomePhysics'

type CatalogRecordType = 'all' | 'project' | 'archive' | 'organization'
type AvailabilityFilter = 'all' | AwesomePhysicsAvailability

interface CatalogEntry {
  id: string
  catalogLine: number
  kind: 'item' | 'organization'
  item: AwesomePhysicsCatalogItemV1 | null
  organization: AwesomePhysicsOrganizationV1 | null
  descriptor: AwesomePhysicsSimulationDescriptorV1 | null
}

const router = useRouter()
const registry = useAwesomePhysicsRegistry()

// Register only lazy factory functions before the separate catalog artifacts load.
registerAwesomePhysicsAdapters()
void registry.initialize()

const query = ref('')
const recordType = ref<CatalogRecordType>('all')
const availability = ref<AvailabilityFilter>('all')
const execution = ref<'all' | AwesomePhysicsExecutionKind>('all')
const maintenance = ref<'all' | AwesomePhysicsMaintenance>('all')
const license = ref<'all' | AwesomePhysicsLicenseStatus>('all')
const category = ref('all')

const loading = computed(() => !registry.ready.value && registry.error.value === null)
const catalog = computed(() => registry.catalog.value)
const simulations = computed(() => registry.simulations.value)
const registryError = computed(() => {
  if (registry.error.value) return registry.error.value.message
  if (!loading.value && (!catalog.value || !simulations.value)) return 'The Awesome Physics catalog artifacts are incomplete.'
  return ''
})
const ready = computed(() => !loading.value && !registryError.value && catalog.value !== null && simulations.value !== null)

const descriptorsByCatalogItemId = computed(() => {
  const descriptors = new Map<string, AwesomePhysicsSimulationDescriptorV1>()
  for (const descriptor of simulations.value?.items ?? []) descriptors.set(descriptor.catalogItemId, descriptor)
  return descriptors
})

const allEntries = computed<CatalogEntry[]>(() => {
  if (!catalog.value) return []
  const items: CatalogEntry[] = catalog.value.items.map((item) => ({
    id: item.id,
    catalogLine: item.catalogLine,
    kind: 'item',
    item,
    organization: null,
    descriptor: descriptorsByCatalogItemId.value.get(item.id) ?? null,
  }))
  const organizations: CatalogEntry[] = catalog.value.organizations.map((organization) => ({
    id: organization.id,
    catalogLine: organization.catalogLine,
    kind: 'organization',
    item: null,
    organization,
    descriptor: null,
  }))
  return [...items, ...organizations].sort((left, right) => left.catalogLine - right.catalogLine || left.id.localeCompare(right.id))
})

const categories = computed(() => [...new Set(catalog.value?.items.map(({ category: value }) => value) ?? [])].sort())
const executionKinds = computed(() => [...new Set(simulations.value?.items.map(({ execution: value }) => value) ?? [])].sort())
const maintenanceStates = computed(() => [...new Set([
  ...(catalog.value?.items.map(({ maintenance: value }) => value) ?? []),
  ...(catalog.value?.organizations.map(({ maintenance: value }) => value) ?? []),
])].sort())
const licenseStates = computed(() => [...new Set(catalog.value?.items.map(({ license: value }) => value.status) ?? [])].sort())

function entrySearchText(entry: CatalogEntry): string {
  if (entry.item) {
    const item = entry.item
    const descriptor = entry.descriptor
    return [
      item.id,
      item.canonicalName,
      ...item.aliases,
      item.category,
      item.catalogSection,
      item.title,
      item.description,
      item.catalogUrl,
      item.upstreamUrl,
      item.sourceKind,
      ...item.language,
      item.license.status,
      item.license.text,
      item.maintenance,
      item.maintenanceSignal,
      item.access.status,
      item.access.note,
      ...item.evidence.sourceRefs,
      ...item.evidence.licenseRefs,
      ...item.evidence.maintenanceRefs,
      ...(descriptor ? [
        descriptor.id,
        descriptor.execution,
        descriptor.availability,
        descriptor.availabilityReason,
        descriptor.planDisposition,
        descriptor.modelOrigin,
        descriptor.implementationRevision,
        descriptor.adapterId ?? '',
      ] : []),
    ].join(' ').toLocaleLowerCase()
  }
  const organization = entry.organization
  return [
    organization?.id ?? '',
    organization?.title ?? '',
    organization?.description ?? '',
    organization?.url ?? '',
    organization?.maintenance ?? '',
    organization?.status ?? '',
    organization?.notes ?? '',
    ...(organization?.evidenceRefs ?? []),
  ].join(' ').toLocaleLowerCase()
}

function matchesType(entry: CatalogEntry): boolean {
  if (recordType.value === 'all') return true
  if (entry.kind === 'organization') return recordType.value === 'organization'
  return recordType.value === (entry.item?.sourceKind === 'archive' ? 'archive' : 'project')
}

function matchesFacets(entry: CatalogEntry): boolean {
  const item = entry.item
  const descriptor = entry.descriptor
  if (availability.value !== 'all' && descriptor?.availability !== availability.value) return false
  if (execution.value !== 'all' && descriptor?.execution !== execution.value) return false
  if (maintenance.value !== 'all' && (item?.maintenance ?? entry.organization?.maintenance) !== maintenance.value) return false
  if (license.value !== 'all' && item?.license.status !== license.value) return false
  if (category.value !== 'all' && item?.category !== category.value) return false
  return true
}

const filteredEntries = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return allEntries.value.filter((entry) => matchesType(entry)
    && matchesFacets(entry)
    && (!search || entrySearchText(entry).includes(search)))
})

const availableAdapterCount = computed(() => simulations.value?.summary.available ?? 0)
const resultSummary = computed(() => `Showing ${filteredEntries.value.length} of ${allEntries.value.length} catalog records.`)

function clearFilters(): void {
  query.value = ''
  recordType.value = 'all'
  availability.value = 'all'
  execution.value = 'all'
  maintenance.value = 'all'
  license.value = 'all'
  category.value = 'all'
}

function openDetail(id: string): void {
  void router.push({ path: `/awesome-physics/${encodeURIComponent(id)}` })
}
</script>

<style src="../styles/awesome-physics.css"></style>

<template lang="pug">
.view.awesome-physics-view.awesome-physics-catalog(:data-testid="ready ? 'awesome-physics-catalog-ready' : undefined")
  header.awesome-catalog-header
    .awesome-catalog-heading
      p.eyebrow Catalog instrument / source ledger
      h1 Awesome Physics
      p.awesome-catalog-lede A deterministic index of the Awesome Physics source list, preserved clone evidence, and explicitly declared local execution capabilities.
    dl.awesome-catalog-counts(data-testid="awesome-catalog-counts")
      div
        dt Catalog records
        dd {{ catalog?.summary.totalEntries }}
      div
        dt Projects + archive
        dd {{ catalog?.items.length }}
      div
        dt Organizations
        dd {{ catalog?.organizations.length }}
      div
        dt Available adapters
        dd {{ availableAdapterCount }}

  section.awesome-catalog-boundary(data-testid="awesome-catalog-boundary" aria-label="Catalog boundary")
    strong Source index, not a validation claim
    p The list records upstream identity, access attempts, licenses, maintenance signals, and bounded adapter declarations. A local run can reproduce an implemented model; it does not establish the upstream implementation, a physical theory, or empirical agreement.

  .loading-plate(v-if="loading" data-testid="awesome-physics-catalog-loading" aria-live="polite") Loading Awesome Physics catalog artifacts...
  .empty-state(v-else-if="registryError" role="alert" data-testid="awesome-physics-catalog-error")
    strong Awesome Physics catalog unavailable
    p {{ registryError }}
  template(v-else-if="ready")
    section.awesome-catalog-filters(aria-label="Awesome Physics catalog filters")
      label.field.awesome-filter-search
        span Search all catalog records
        input(
          v-model="query"
          type="search"
          maxlength="200"
          autocomplete="off"
          data-testid="awesome-physics-search"
          placeholder="name, alias, source, evidence, or plan"
        )
      label.field
        span Record type
        select(v-model="recordType" data-testid="awesome-physics-record-type")
          option(value="all") All records
          option(value="project") Projects
          option(value="archive") Archive entries
          option(value="organization") Organizations
      label.field
        span Availability
        select(v-model="availability" data-testid="awesome-physics-availability")
          option(value="all") All availability
          option(value="available") Available
          option(value="unavailable") Unavailable
          option(value="blocked") Blocked
      label.field
        span Execution kind
        select(v-model="execution" data-testid="awesome-physics-execution")
          option(value="all") All execution kinds
          option(v-for="kind in executionKinds" :key="kind" :value="kind") {{ kind }}
      label.field
        span Maintenance
        select(v-model="maintenance" data-testid="awesome-physics-maintenance")
          option(value="all") All maintenance states
          option(v-for="state in maintenanceStates" :key="state" :value="state") {{ state }}
      label.field
        span License status
        select(v-model="license" data-testid="awesome-physics-license")
          option(value="all") All license states
          option(v-for="state in licenseStates" :key="state" :value="state") {{ state }}
      label.field
        span Category
        select(v-model="category" data-testid="awesome-physics-category")
          option(value="all") All categories
          option(v-for="value in categories" :key="value" :value="value") {{ value }}
      button.awesome-secondary-action.awesome-filter-reset(type="button" data-testid="awesome-physics-clear" @click="clearFilters") Clear filters

    p.awesome-catalog-result-count(role="status" aria-live="polite" aria-atomic="true" data-testid="awesome-physics-result-count")
      strong {{ filteredEntries.length }} matching
      |  / {{ allEntries.length }} total · {{ resultSummary }}

    section.awesome-catalog-grid(v-if="filteredEntries.length" aria-label="Awesome Physics catalog records")
      AwesomePhysicsCatalogCard(
        v-for="entry in filteredEntries"
        :key="entry.id"
        :item="entry.item"
        :organization="entry.organization"
        :descriptor="entry.descriptor"
        @run="openDetail"
      )
    .empty-state.awesome-catalog-empty(v-else data-testid="awesome-physics-no-results")
      strong No catalog records match
      p Adjust the search or clear one of the deterministic record facets. No records are synthesized for an empty filter result.
</template>
