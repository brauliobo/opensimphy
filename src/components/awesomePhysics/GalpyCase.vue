<script setup lang="ts">
import { computed } from 'vue'
import MetricStrip from '../cases/MetricStrip.vue'
import ResultTable from '../cases/ResultTable.vue'
import AwesomePhysicsCasePlot from './AwesomePhysicsCasePlot.vue'
import { galpyFigure } from '../../awesomePhysics/caseFigures'

const props = defineProps<{
  result: unknown
}>()

const figure = computed(() => galpyFigure(props.result))
</script>

<template lang="pug">
.awesome-case-body(v-if="figure" data-testid="awesome-case-galpy")
  MetricStrip(:metrics="figure.metrics" test-id="awesome-case-galpy-metrics")
  AwesomePhysicsCasePlot(
    v-if="figure.series.length"
    title="MWPotential2014 meridional orbit"
    description="Leapfrog samples in natural units. Energy and Lz drifts are finite-run diagnostics, not observational agreement."
    x-label="R"
    y-label="z"
    :series="figure.series"
    test-id="awesome-case-galpy-plot"
  )
  ResultTable(
    v-if="figure.table"
    :caption="figure.table.caption"
    :columns="figure.table.columns"
    :rows="figure.table.rows"
    :test-id="figure.table.testId"
  )
p.awesome-case-mismatch(v-else data-testid="awesome-case-mismatch") The worker payload does not match the galpy lesson figure.
</template>
