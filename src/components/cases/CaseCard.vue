<script setup lang="ts">
import type { CaseRecord } from '../../cases/types'

defineProps<{
  record: CaseRecord
}>()
</script>

<template lang="pug">
RouterLink.case-card(
  :to="record.to"
  :class="{ 'is-runnable': record.runnable }"
  :data-testid="`case-card-${record.id}`"
)
  span {{ record.eyebrow }}
  strong {{ record.title }}
  p {{ record.description }}
  small {{ record.availability }} / {{ record.execution }}{{ record.runnable ? ' / runnable' : '' }}{{ record.copRelevant ? ' / COP' : '' }}
</template>

<style src="../../styles/cases.css"></style>
