<script setup lang="ts">
import { computed, ref } from 'vue'
import CaseCard from '../components/cases/CaseCard.vue'
import CaseHeader from '../components/cases/CaseHeader.vue'
import MetricStrip from '../components/cases/MetricStrip.vue'
import { collectCaseRecords, GRAY_CASE } from '../cases/caseRegistry'
import { useBenchmarkRegistry } from '../cases/benchmarkRegistry'
import { registerAwesomePhysicsAdapters } from '../awesomePhysics/registerAdapters'
import { useAwesomePhysicsRegistry } from '../registries/awesomePhysicsRegistry'

const registry = useAwesomePhysicsRegistry()
const benchmark = useBenchmarkRegistry()
registerAwesomePhysicsAdapters()
void registry.initialize()
void benchmark.initialize()

const filter = ref<'all' | 'runnable' | 'gray' | 'awesome'>('all')

const records = computed(() => {
  const catalog = registry.catalog.value
  const simulations = registry.simulations.value
  if (!catalog || !simulations) return [GRAY_CASE]
  return collectCaseRecords(catalog.items, catalog.organizations, simulations.items)
})

const visible = computed(() => records.value.filter((record) => {
  if (filter.value === 'runnable') return record.runnable
  if (filter.value === 'gray') return record.kind === 'gray-motor'
  if (filter.value === 'awesome') return record.kind === 'awesome-physics'
  return true
}))

const metrics = computed(() => {
  const summary = benchmark.report.value?.summary
  return [
    { label: 'Published cases', value: String(records.value.length) },
    { label: 'Harness runnable', value: String(summary?.runnable ?? records.value.filter((record) => record.runnable).length), tone: 'ok' as const },
    { label: 'Harness passed', value: String(summary?.passed ?? 'not loaded'), tone: 'ok' as const },
    { label: 'Gray motor', value: benchmark.cases.value.some((entry) => entry.caseId === 'gray-motor') ? 'slot mounted' : '1', tone: 'claim' as const },
  ]
})

const ready = computed(() => registry.ready.value && !registry.error.value)
</script>

<template lang="pug">
.view.case-hub(:data-testid="ready ? 'case-hub-ready' : undefined")
  CaseHeader(
    eyebrow="Workbench / shared case pages"
    title="Simulation cases"
    description="Every Gray motor contract and Awesome Physics catalog record has a page. Runnable adapters mount the shared worker harness; unavailable and blocked records stay evidence pages."
    identity="case-hub"
    status="Vue + Pug"
  )
  MetricStrip(:metrics="metrics")
  .loading-plate(v-if="!registry.ready.value") Loading case registry…
  .empty-state(v-else-if="registry.error.value" role="alert")
    strong Case registry unavailable
    p {{ registry.error.value.message }}
  template(v-else)
    label.field
      span Show
      select(v-model="filter" data-testid="case-hub-filter")
        option(value="all") All cases
        option(value="runnable") Runnable only
        option(value="gray") Gray motor
        option(value="awesome") Awesome Physics
    p(data-testid="case-hub-count") {{ visible.length }} shown / {{ records.length }} published
    .case-hub-grid
      CaseCard(v-for="record in visible" :key="record.id" :record="record")
</template>

<style src="../styles/cases.css"></style>
