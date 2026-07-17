<script setup lang="ts">
import type { CoverageRow } from '../composables/atlasEngine'

defineProps<{
  rows: readonly CoverageRow[]
  complete: boolean
  compact?: boolean
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
  :class="{ 'coverage-strip-compact': compact }"
  aria-label="Global completion coverage"
  data-testid="coverage-status"
  :data-status="complete ? 'complete' : 'incomplete'"
)
  template(v-if="compact")
    .compact-coverage-copy
      strong(:class="complete ? 'signal-ok' : 'signal-error'") {{ complete ? 'AUDIT COMPLETE' : 'AUDIT INCOMPLETE' }}
      span {{ rows.find((row) => row.key === 'recipes')?.evaluated ?? 0 }} formulas evaluated locally
    RouterLink.text-link(to="/sources") View audit scope
  template(v-else)
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
