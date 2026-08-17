<script setup lang="ts">
import { computed } from 'vue'
import { AWESOME_PHYSICS_DETAIL_ROUTE_NAME } from '../../awesomePhysics/routes'
import type {
  AwesomePhysicsCatalogItemV1,
  AwesomePhysicsExecutionKind,
  AwesomePhysicsLicenseStatus,
  AwesomePhysicsMaintenance,
  AwesomePhysicsOrganizationV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../types/awesomePhysics'

const props = withDefaults(defineProps<{
  item: AwesomePhysicsCatalogItemV1 | null
  organization?: AwesomePhysicsOrganizationV1 | null
  descriptor?: AwesomePhysicsSimulationDescriptorV1 | null
}>(), {
  organization: null,
  descriptor: null,
})

const emit = defineEmits<{
  run: [id: string]
}>()

const isOrganization = computed(() => props.organization !== null)
const recordId = computed(() => props.item?.id ?? props.organization?.id ?? '')
const recordTitle = computed(() => props.item?.title ?? props.organization?.title ?? '')
const detailTo = computed(() => ({ name: AWESOME_PHYSICS_DETAIL_ROUTE_NAME, params: { id: recordId.value } }))
const canRun = computed(() => {
  const descriptor = props.descriptor
  return Boolean(
    props.item
    && descriptor
    && descriptor.availability === 'available'
    && descriptor.runnable
    && descriptor.adapterId
    && descriptor.capability !== 'archive-reference'
    && descriptor.execution !== 'artifact'
    && descriptor.execution !== 'reference'
    && !descriptor.executionOptions.includes('wasm-candidate'),
  )
})

const itemExecution = computed<AwesomePhysicsExecutionKind | 'not declared'>(() => props.descriptor?.execution ?? 'not declared')
const itemLicense = computed<AwesomePhysicsLicenseStatus | 'not recorded'>(() => props.item?.license.status ?? 'not recorded')
const itemMaintenance = computed<AwesomePhysicsMaintenance>(() => props.item?.maintenance ?? 'unknown')
const sourceEvidence = computed(() => props.item?.evidence.sourceRefs ?? props.organization?.evidenceRefs ?? [])

function formatToken(value: string): string {
  return value.replaceAll('-', ' ')
}

function availabilityLabel(): string {
  return props.descriptor?.availability ?? 'catalog-only'
}

function executionLabel(): string {
  return itemExecution.value === 'not declared' ? itemExecution.value : formatToken(itemExecution.value)
}

function emitRun(): void {
  if (canRun.value) emit('run', recordId.value)
}
</script>

<template lang="pug">
article.awesome-catalog-card(
  :class="{ 'is-organization': isOrganization, 'is-available': canRun }"
  :data-testid="`awesome-catalog-card-${recordId}`"
)
  header.awesome-card-heading
    .awesome-card-index
      code {{ recordId }}
      span(v-if="item") {{ item.catalogSection }}
      span(v-else) Organization record
    span.status-chip(:class="canRun ? 'is-pass' : 'is-pending'") {{ isOrganization ? organization?.status : availabilityLabel() }}

  .awesome-card-main
    p.awesome-card-kind {{ isOrganization ? 'Organization / source index' : `${item?.sourceKind} / ${item?.category}` }}
    h2
      RouterLink(:to="detailTo") {{ recordTitle }}
    p.awesome-card-description {{ item?.description ?? organization?.description }}
    p.awesome-card-aliases(v-if="item?.aliases.length")
      strong Aliases
      |  {{ item.aliases.join(', ') }}

  dl.awesome-card-ledger
    div
      dt Availability
      dd {{ isOrganization ? 'catalog-only' : availabilityLabel() }}
    div
      dt Execution
      dd {{ isOrganization ? 'not applicable' : executionLabel() }}
    div
      dt License
      dd {{ isOrganization ? 'not recorded' : itemLicense }}
    div
      dt Maintenance
      dd {{ isOrganization ? organization?.maintenance : itemMaintenance }}
    div
      dt Source access
      dd(v-if="item") {{ item.access.status }}
      dd(v-else) listed by source catalog

  section.awesome-card-evidence(aria-label="Source evidence")
    strong Source evidence
    ul
      li(v-for="reference in sourceEvidence" :key="reference")
        code {{ reference }}
    p(v-if="item?.localPath") Repository-relative checkout: #[code {{ item.localPath }}]
    p(v-else-if="item") No local checkout is claimed for this record.
    p(v-else) Evidence is retained as repository-relative source references.

  p.awesome-card-reason(v-if="descriptor") {{ descriptor.availabilityReason }}
  p.awesome-card-reason(v-else-if="organization") {{ organization.notes }}

  footer.awesome-card-actions
    RouterLink.text-link(:to="detailTo") Open detail ->
    a.text-link(v-if="item" :href="item.catalogUrl" target="_blank" rel="noreferrer") Catalog source ->
    a.text-link(v-if="organization" :href="organization.url" target="_blank" rel="noreferrer") Organization source ->
    button.awesome-run-button(
      v-if="canRun"
      type="button"
      data-testid="awesome-catalog-run"
      :aria-label="`Run ${recordTitle} bounded adapter`"
      @click="emitRun"
    ) Run
</template>
