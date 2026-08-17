<script setup lang="ts">
import type { CaseMetric } from '../../cases/types'

withDefaults(defineProps<{
  metrics: readonly CaseMetric[]
  testId?: string
}>(), {
  testId: 'case-metrics',
})
</script>

<template lang="pug">
dl.metric-strip(:data-testid="testId")
  div(v-for="metric in metrics" :key="metric.label" :data-tone="metric.tone")
    dt {{ metric.label }}
    dd {{ metric.value }}
</template>

<style src="../../styles/cases.css"></style>
