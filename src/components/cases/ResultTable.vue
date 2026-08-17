<script setup lang="ts">
import type { CaseTableColumn } from '../../cases/types'

withDefaults(defineProps<{
  caption: string
  columns: readonly CaseTableColumn[]
  rows: readonly Record<string, string | number>[]
  testId?: string
}>(), {
  testId: 'case-result-table',
})
</script>

<template lang="pug">
.gray-table-scroll.result-table-scroll
  table.result-table(:data-testid="testId")
    caption {{ caption }}
    thead
      tr
        th(v-for="column in columns" :key="column.key" scope="col") {{ column.label }}
    tbody
      tr(v-for="(row, index) in rows" :key="String(row.id ?? index)")
        td(v-for="column in columns" :key="column.key") {{ row[column.key] }}
</template>

<style src="../../styles/cases.css"></style>
