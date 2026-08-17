<script setup lang="ts">
import { computed } from 'vue'
import MetricStrip from '../cases/MetricStrip.vue'
import ResultTable from '../cases/ResultTable.vue'
import AwesomePhysicsCasePlot from './AwesomePhysicsCasePlot.vue'
import { quantumOpticsJlFigure } from '../../awesomePhysics/caseFigures'

const props = defineProps<{
  result: unknown
}>()

const figure = computed(() => quantumOpticsJlFigure(props.result))
</script>

<template lang="pug">
.awesome-case-body(v-if="figure" data-testid="awesome-case-quantumoptics-jl")
  MetricStrip(:metrics="figure.metrics" test-id="awesome-case-quantumoptics-jl-metrics")
  AwesomePhysicsCasePlot(
    title="Jaynes-Cummings excited population"
    description="Closed-form single-excitation vacuum Rabi oscillation. This TypeScript stand-in is not Julia or QuantumOptics.jl."
    x-label="time"
    y-label="P_e"
    :series="figure.series"
    test-id="awesome-case-quantumoptics-jl-plot"
  )
  ResultTable(
    :caption="figure.table.caption"
    :columns="figure.table.columns"
    :rows="figure.table.rows"
    :test-id="figure.table.testId"
  )
p.awesome-case-mismatch(v-else data-testid="awesome-case-mismatch") The worker payload does not match the QuantumOptics.jl lesson figure.
</template>
