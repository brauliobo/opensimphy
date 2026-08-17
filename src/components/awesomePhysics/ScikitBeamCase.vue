<script setup lang="ts">
import { computed } from 'vue'
import MetricStrip from '../cases/MetricStrip.vue'
import ResultTable from '../cases/ResultTable.vue'
import AwesomePhysicsCasePlot from './AwesomePhysicsCasePlot.vue'
import { scikitBeamFigure } from '../../awesomePhysics/caseFigures'

const props = defineProps<{
  result: unknown
}>()

const figure = computed(() => scikitBeamFigure(props.result))
const title = computed(() => figure.value?.operation === 'lag-correlation' ? 'Lag correlation' : 'Sphere form factor I(q)')
</script>

<template lang="pug">
.awesome-case-body(v-if="figure" data-testid="awesome-case-scikit-beam")
  MetricStrip(:metrics="figure.metrics" test-id="awesome-case-scikit-beam-metrics")
  AwesomePhysicsCasePlot(
    :title="title"
    :description="figure.operation === 'lag-correlation' ? 'Normalized linear lag correlation C(k) with C(0) = 1.' : 'Rayleigh-Gans sphere intensity I(q) = |F(q)|² on the declared q grid.'"
    :x-label="figure.xLabel"
    :y-label="figure.yLabel"
    :series="figure.series"
    test-id="awesome-case-scikit-beam-plot"
  )
  ResultTable(
    :caption="figure.table.caption"
    :columns="figure.table.columns"
    :rows="figure.table.rows"
    :test-id="figure.table.testId"
  )
p.awesome-case-mismatch(v-else data-testid="awesome-case-mismatch") The worker payload does not match the scikit-beam lesson figure.
</template>
