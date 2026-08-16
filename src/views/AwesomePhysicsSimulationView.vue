<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AwesomePhysicsRunPanel from '../components/awesomePhysics/AwesomePhysicsRunPanel.vue'
import { registerAwesomePhysicsAdapters } from '../awesomePhysics/registerAdapters'
import { useAwesomePhysicsRegistry } from '../registries/awesomePhysicsRegistry'
import type {
  AwesomePhysicsCatalogItemV1,
  AwesomePhysicsOrganizationV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../types/awesomePhysics'

const props = defineProps<{
  id?: string
}>()

const route = useRoute()
const registry = useAwesomePhysicsRegistry()

// Keep the detail surface aligned with the catalog's lazy adapter registration order.
registerAwesomePhysicsAdapters()

const loading = ref(true)
const loadError = ref('')
const item = ref<AwesomePhysicsCatalogItemV1 | null>(null)
const organization = ref<AwesomePhysicsOrganizationV1 | null>(null)
const descriptor = ref<AwesomePhysicsSimulationDescriptorV1 | null>(null)
let loadGeneration = 0

const resolvedId = computed(() => {
  if (typeof props.id === 'string' && props.id.length > 0) return props.id
  return typeof route.params.id === 'string' ? route.params.id : ''
})

const detailReady = computed(() => !loading.value && !loadError.value && (item.value !== null || organization.value !== null))
const isOrganization = computed(() => organization.value !== null)
const title = computed(() => item.value?.title ?? organization.value?.title ?? '')
const description = computed(() => item.value?.description ?? organization.value?.description ?? '')
const sourceKind = computed(() => item.value?.sourceKind ?? 'organization')
const aliases = computed(() => item.value?.aliases ?? [])
const canRun = computed(() => {
  const current = descriptor.value
  return Boolean(
    item.value
    && current
    && current.availability === 'available'
    && current.runnable
    && current.adapterId
    && current.capability !== 'archive-reference'
    && current.execution !== 'artifact'
    && current.execution !== 'reference'
    && !current.executionOptions.includes('wasm-candidate'),
  )
})

const evidenceGroups = computed(() => {
  if (item.value) {
    return [
      { label: 'Source and catalog', refs: item.value.evidence.sourceRefs },
      { label: 'License', refs: item.value.evidence.licenseRefs },
      { label: 'Maintenance', refs: item.value.evidence.maintenanceRefs },
      { label: 'Simulation descriptor', refs: descriptor.value?.evidenceRefs ?? [] },
      { label: 'Artifact provenance', refs: descriptor.value?.artifactProvenance.evidenceRefs ?? [] },
    ].filter(({ refs }) => refs.length > 0)
  }
  return [{ label: 'Organization source', refs: organization.value?.evidenceRefs ?? [] }]
})

const links = computed(() => item.value?.links ?? [])
const revisionRows = computed(() => {
  if (!item.value) return []
  return [
    { label: 'Catalog revision', value: item.value.catalogRevision },
    { label: 'Upstream revision', value: item.value.upstreamRevision },
    { label: 'Descriptor source revision', value: descriptor.value?.sourceRevision ?? null },
    { label: 'Implementation revision', value: descriptor.value?.implementationRevision ?? null },
    { label: 'Compatibility revision', value: descriptor.value?.compatibilityRevision ?? null },
    { label: 'Model revision', value: descriptor.value?.modelRevision ?? null },
    { label: 'Content revision', value: descriptor.value?.contentRevision ?? null },
    { label: 'Output revision', value: descriptor.value?.outputRevision ?? null },
  ]
})

const limitRows = computed(() => {
  const limits = descriptor.value?.limits
  if (!limits) return []
  return [
    { label: 'Maximum grid size', value: limits.maxGridSize },
    { label: 'Maximum particles', value: limits.maxParticles },
    { label: 'Maximum iterations', value: limits.maxIterations },
    { label: 'Maximum memory', value: formatBytes(limits.maxMemoryBytes) },
    { label: 'Maximum worker time', value: `${limits.maxWorkerTimeMs} ms` },
    { label: 'Maximum output', value: formatBytes(limits.maxOutputBytes) },
  ]
})

const provenanceStatement = computed(() => isOrganization.value
  ? 'This record establishes only that an organization was listed in the preserved Awesome Physics catalog on the recorded catalog revision.'
  : 'This record establishes only that the catalog metadata, source evidence, and bounded execution descriptor were loaded and validated by the OpenSimPhy registry.')

function recordId(): string {
  return resolvedId.value
}

function formatToken(value: string): string {
  return value.replaceAll('-', ' ')
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`
}

function displayValue(value: string | number | null | undefined): string {
  return value === null || value === undefined ? 'not recorded' : String(value)
}

watch(resolvedId, async (id) => {
  const attempt = ++loadGeneration
  loading.value = true
  loadError.value = ''
  item.value = null
  organization.value = null
  descriptor.value = null

  if (!id) {
    loadError.value = 'The Awesome Physics detail route did not provide a catalog ID.'
    loading.value = false
    return
  }

  await registry.initialize()
  if (attempt !== loadGeneration) return

  if (registry.error.value) {
    loadError.value = registry.error.value.message
    loading.value = false
    return
  }

  const catalog = registry.catalog.value
  const simulations = registry.simulations.value
  if (!catalog || !simulations) {
    loadError.value = 'The Awesome Physics catalog artifacts are incomplete.'
    loading.value = false
    return
  }

  const foundItem = catalog.items.find((candidate) => candidate.id === id) ?? null
  const foundOrganization = catalog.organizations.find((candidate) => candidate.id === id) ?? null
  if (!foundItem && !foundOrganization) {
    loadError.value = `Awesome Physics record "${id}" was not found in the catalog.`
    loading.value = false
    return
  }

  if (foundItem) {
    const foundDescriptor = simulations.items.find(({ catalogItemId }) => catalogItemId === foundItem.id) ?? null
    if (!foundDescriptor) {
      loadError.value = `Awesome Physics simulation descriptor for "${id}" is missing from the separate registry.`
      loading.value = false
      return
    }
    item.value = foundItem
    descriptor.value = foundDescriptor
  } else {
    organization.value = foundOrganization
  }
  loading.value = false
}, { immediate: true })
</script>

<style src="../styles/awesome-physics.css"></style>

<template lang="pug">
.view.awesome-physics-view.awesome-physics-detail(:data-testid="detailReady ? 'awesome-physics-detail-ready' : undefined")
  nav.awesome-detail-return(aria-label="Awesome Physics catalog navigation")
    a.text-link(href="/awesome-physics") <- Awesome Physics catalog

  .loading-plate(v-if="loading" data-testid="awesome-physics-detail-loading" aria-live="polite") Loading Awesome Physics record...
  .empty-state(v-else-if="loadError" role="alert" data-testid="awesome-physics-detail-error")
    strong Awesome Physics record unavailable
    p {{ loadError }}
    a.text-link(href="/awesome-physics") Return to catalog ->
  template(v-else-if="detailReady")
    header.awesome-detail-header
      .awesome-detail-index
        code {{ recordId() }}
        span {{ isOrganization ? 'organization record' : `${sourceKind} capability` }}
      .awesome-detail-title
        p.eyebrow {{ item?.catalogSection ?? 'Catalog organization' }} / {{ item?.category ?? 'source index' }}
        h1 {{ title }}
        p {{ description }}
      .awesome-detail-status
        strong(v-if="descriptor") {{ descriptor.availability }}
        strong(v-else) catalog-only
        span {{ item?.maintenance ?? organization?.maintenance }} maintenance
        span(v-if="descriptor") {{ formatToken(descriptor.execution) }} execution
        span(v-else) no execution declaration

    section.awesome-detail-summary(aria-labelledby="awesome-detail-summary-title")
      .section-heading
        div
          p.eyebrow 01 / Identity
          h2#awesome-detail-summary-title Catalog identity
        p The title and source labels below are preserved record fields. They are not inferred from an adapter result.
      dl.awesome-detail-ledger
        div
          dt Canonical name
          dd {{ item?.canonicalName ?? 'not applicable for organizations' }}
        div
          dt Aliases
          dd {{ aliases.length ? aliases.join(', ') : 'none recorded' }}
        div
          dt Catalog section
          dd {{ item?.catalogSection ?? 'organization source list' }}
        div
          dt Category
          dd {{ item?.category ?? 'organization' }}
        div
          dt Language
          dd {{ item?.language.join(', ') ?? 'not recorded' }}
        div
          dt Source kind
          dd {{ sourceKind }}
        div
          dt Access
          dd {{ item?.access.status ?? 'listed organization' }}
        div
          dt Maintenance signal
          dd {{ item?.maintenanceSignal ?? organization?.notes }}

    section.awesome-detail-links(aria-labelledby="awesome-detail-links-title")
      p.eyebrow 02 / Upstream and catalog links
      h2#awesome-detail-links-title Source links
      .awesome-link-grid
        template(v-if="item")
          a(:href="item.catalogUrl" target="_blank" rel="noreferrer") Catalog URL ->
          a(:href="item.upstreamUrl" target="_blank" rel="noreferrer") Upstream URL ->
          a(v-for="link in links" :key="`${link.kind}-${link.url}`" :href="link.url" target="_blank" rel="noreferrer") {{ link.label }} ->
        a(v-else-if="organization" :href="organization.url" target="_blank" rel="noreferrer") Organization URL ->
      p.awesome-upstream-note(v-if="item?.upstreamResolution")
        strong Current-upstream substitution recorded.
        |  {{ item.upstreamResolution.reason }}

    section.awesome-detail-execution(v-if="descriptor" aria-labelledby="awesome-detail-execution-title")
      p.eyebrow 03 / Declared capability
      h2#awesome-detail-execution-title Availability and execution
      dl.awesome-detail-ledger
        div
          dt Availability
          dd {{ descriptor.availability }}
        div
          dt Runnable flag
          dd {{ descriptor.runnable ? 'true' : 'false' }}
        div
          dt Adapter ID
          dd #[code {{ descriptor.adapterId ?? 'not registered' }}]
        div
          dt Execution options
          dd {{ descriptor.executionOptions.join(', ') }}
        div
          dt Numerical method
          dd {{ descriptor.numericalMethod ?? 'not declared' }}
        div
          dt Input schema
          dd #[code {{ descriptor.inputSchema ?? 'not declared' }}]
        div
          dt Output schema
          dd #[code {{ descriptor.outputSchema ?? 'not declared' }}]
      p.awesome-availability-reason {{ descriptor.availabilityReason }}
      p.awesome-plan-disposition
        strong Plan disposition
        |  {{ descriptor.planDisposition }}

    AwesomePhysicsRunPanel(v-if="canRun && descriptor" :descriptor="descriptor")
    section.awesome-no-run(v-else-if="descriptor" data-testid="awesome-physics-no-run")
      p.eyebrow Execution gate
      h2 Run is not exposed
      p {{ descriptor.availabilityReason }}
      p The catalog intentionally exposes no Run control for unavailable, blocked, artifact, reference, or wasm-candidate records. This detail page remains an evidence view.

    section.awesome-detail-evidence(aria-labelledby="awesome-detail-evidence-title")
      p.eyebrow 04 / Repository-relative evidence
      h2#awesome-detail-evidence-title Evidence ledger
      dl.awesome-detail-ledger
        div
          dt Local path
          dd #[code {{ item?.localPath ?? 'not recorded' }}]
        div
          dt Catalog line
          dd {{ item?.catalogLine ?? organization?.catalogLine }}
        div
          dt Manifest line
          dd {{ item?.manifestLine ?? 'not applicable' }}
        div
          dt Plan line
          dd {{ item?.planLine ?? 'not applicable' }}
        div
          dt Access note
          dd {{ item?.access.note ?? organization?.notes }}
      .awesome-evidence-groups
        article(v-for="group in evidenceGroups" :key="group.label")
          h3 {{ group.label }}
          ul
            li(v-for="reference in group.refs" :key="reference") #[code {{ reference }}]

    section.awesome-detail-license(aria-labelledby="awesome-detail-license-title")
      p.eyebrow 05 / License gate
      h2#awesome-detail-license-title License and redistribution boundary
      dl.awesome-detail-ledger
        div
          dt Catalog license status
          dd {{ item?.license.status ?? 'not recorded for organization' }}
        div
          dt License gate
          dd {{ descriptor?.licenseGate ?? 'not applicable' }}
        div
          dt License text
          dd {{ item?.license.text ?? 'No item license text is recorded for this organization entry.' }}
        div
          dt Dataset license
          dd {{ descriptor?.artifactProvenance.datasetLicense ?? 'not recorded' }}
      p.awesome-license-evidence(v-if="item") License evidence is shown above as repository-relative references; a catalog license status is not a blanket redistribution permission for upstream code or assets.

    section.awesome-detail-limits(v-if="descriptor" aria-labelledby="awesome-detail-limits-title")
      p.eyebrow 06 / Worker limits
      h2#awesome-detail-limits-title Declared bounds
      dl.awesome-detail-ledger
        div(v-for="limit in limitRows" :key="limit.label")
          dt {{ limit.label }}
          dd {{ limit.value }}

    section.awesome-detail-revisions(aria-labelledby="awesome-detail-revisions-title")
      p.eyebrow 07 / Revisions
      h2#awesome-detail-revisions-title Content and implementation revisions
      dl.awesome-detail-ledger
        div(v-for="revision in revisionRows" :key="revision.label")
          dt {{ revision.label }}
          dd #[code {{ displayValue(revision.value) }}]
        div(v-if="descriptor")
          dt Artifact acquisition date
          dd {{ descriptor.artifactProvenance.acquisitionDate }}
        div(v-if="descriptor")
          dt Artifact transformation
          dd {{ descriptor.artifactProvenance.transformation }}
        div(v-if="descriptor")
          dt Artifact SHA-256
          dd #[code {{ descriptor.artifactProvenance.sha256 ?? 'not recorded' }}]

    section.awesome-detail-provenance(data-testid="awesome-physics-provenance" aria-labelledby="awesome-detail-provenance-title")
      p.eyebrow 08 / Provenance boundary
      h2#awesome-detail-provenance-title Provenance / does not establish
      p {{ provenanceStatement }}
      p.awesome-does-not-establish
        strong Does not establish:
        |  upstream implementation equivalence, scientific theory validation, empirical agreement, experimental evidence, or correctness beyond the declared bounded model and its JSON result.
      p.awesome-does-not-establish(v-if="descriptor?.modelOrigin === 'educational-reimplementation'")
        strong Model origin:
        |  educational reimplementation. The adapter is not presented as the upstream package.
</template>
