<script setup lang="ts">
import { computed } from 'vue'
import MetricStrip from '../cases/MetricStrip.vue'
import AwesomePhysicsCasePlot from './AwesomePhysicsCasePlot.vue'
import { raysectFigure } from '../../awesomePhysics/caseFigures'

const props = defineProps<{
  result: unknown
}>()

const figure = computed(() => raysectFigure(props.result))
const series = computed(() => figure.value ? [{ id: 'ray', points: figure.value.ray, testId: 'awesome-case-raysect-ray' }] : [])
const polygons = computed(() => figure.value ? [{ id: 'prism', points: figure.value.prism, testId: 'awesome-case-raysect-prism' }] : [])
</script>

<template lang="pug">
.awesome-case-body(v-if="figure" data-testid="awesome-case-raysect")
  MetricStrip(:metrics="figure.metrics" test-id="awesome-case-raysect-metrics")
  AwesomePhysicsCasePlot(
    title="Cauchy prism Snell trace"
    description="Four-point 2D polyline through an isosceles prism. Total internal reflection is rejected, not approximated."
    x-label="x"
    y-label="y"
    :series="series"
    :extra-polygons="polygons"
    equal-aspect
    test-id="awesome-case-raysect-plot"
  )
p.awesome-case-mismatch(v-else data-testid="awesome-case-mismatch") The worker payload does not match the raysect lesson figure.
</template>
