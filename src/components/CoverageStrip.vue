<script setup lang="ts">
import type { CoverageRow } from '../composables/atlasEngine'

defineProps<{
  rows: readonly CoverageRow[]
  complete: boolean
}>()

const fields: Array<keyof Pick<CoverageRow, 'expected' | 'implemented' | 'evaluated' | 'graphed' | 'simulatable'>> = [
  'expected',
  'implemented',
  'evaluated',
  'graphed',
  'simulatable',
]
</script>

<template lang="pug">
section.coverage-strip(
  aria-label="Global completion coverage"
  data-testid="coverage-status"
  :data-status="complete ? 'complete' : 'incomplete'"
)
  .coverage-heading
    span.eyebrow Registry integrity
    strong(:class="complete ? 'signal-ok' : 'signal-error'") {{ complete ? 'EXACT / COMPLETE' : 'FAIL CLOSED / INCOMPLETE' }}
  .coverage-table
    .coverage-labels(aria-hidden="true")
      span Domain
      span(v-for="field in fields" :key="field") {{ field }}
    .coverage-row(
      v-for="row in rows"
      :key="row.key"
      :data-testid="`coverage-${row.key}`"
    )
      strong {{ row.label }}
      span(v-for="field in fields" :key="field" :data-label="field") {{ row[field] }}
</template>
