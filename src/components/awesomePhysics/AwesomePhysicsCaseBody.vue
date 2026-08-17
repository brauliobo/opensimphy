<script setup lang="ts">
import { computed } from 'vue'
import MetricStrip from '../cases/MetricStrip.vue'
import ResultTable from '../cases/ResultTable.vue'
import AwesomePhysicsCasePlot from './AwesomePhysicsCasePlot.vue'
import { awesomePhysicsCaseMismatchName, awesomePhysicsCaseView } from '../../awesomePhysics/caseView'

const props = defineProps<{
  catalogItemId: string
  result: unknown
}>()

const view = computed(() => awesomePhysicsCaseView(props.catalogItemId, props.result))
const mismatchName = computed(() => awesomePhysicsCaseMismatchName(props.catalogItemId))
</script>

<template lang="pug">
.awesome-case-body(v-if="view" :data-testid="view.testId")
  MetricStrip(:metrics="view.metrics" :test-id="view.metricsTestId")
  AwesomePhysicsCasePlot(
    v-if="view.plot"
    :title="view.plot.title"
    :description="view.plot.description"
    :x-label="view.plot.xLabel"
    :y-label="view.plot.yLabel"
    :series="view.plot.series"
    :extra-polygons="view.plot.extraPolygons"
    :extra-circles="view.plot.extraCircles"
    :equal-aspect="view.plot.equalAspect"
    :test-id="view.plot.testId"
  )
  ResultTable(
    v-if="view.table"
    :caption="view.table.caption"
    :columns="view.table.columns"
    :rows="view.table.rows"
    :test-id="view.table.testId"
  )
p.awesome-case-mismatch(v-else data-testid="awesome-case-mismatch") The worker payload does not match {{ mismatchName }}.
</template>
