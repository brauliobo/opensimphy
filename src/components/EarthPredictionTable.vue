<script setup lang="ts">
import { formatPredictionCell, type EarthPredictionDisplayRow } from '../earth/predictions'

defineProps<{
  rows: EarthPredictionDisplayRow[]
}>()
</script>

<template lang="pug">
section.earth-prediction-panel(data-testid="earth-prediction-table")
  header
    h2 EARTH | Thad | Nassim | SM
    p Failed claims stay failed. A number in the table is not confirmed physics.
  p.earth-prediction-empty(v-if="!rows.length") No predictions[] yet. Run the method to fill EARTH, Thad, Nassim, SM, and residual.
  .table-scroll(v-else)
    table.earth-prediction-table
      thead
        tr
          th Observable
          th EARTH
          th Thad
          th Nassim
          th SM
          th Residual
      tbody
        tr(
          v-for="row in rows"
          :key="row.claimId"
          :data-audit="row.auditStatus"
          :class="{ 'is-failed': row.auditStatus === 'falsified' || row.auditStatus === 'failed' }"
        )
          th
            span {{ row.observable }}
            small(v-if="row.unit") {{ row.unit }}
          td {{ formatPredictionCell(row.earth, row.unit) }}
          td {{ row.thad }}
          td {{ row.nassim }}
          td {{ formatPredictionCell(row.sm, row.unit) }}
          td
            strong {{ row.residual }}
            small {{ row.outcome }}
  p.earth-validation-stamp validatesEarthTheory: false
</template>
