<script setup lang="ts">
import { computed } from 'vue'
import MetricStrip from '../cases/MetricStrip.vue'
import AwesomePhysicsCasePlot from './AwesomePhysicsCasePlot.vue'
import { ncollideFigure } from '../../awesomePhysics/caseFigures'

const props = defineProps<{
  result: unknown
}>()

const figure = computed(() => ncollideFigure(props.result))
const plane = [
  { x: -2, y: -0.75 },
  { x: 2, y: -0.75 },
]
const circles = computed(() => {
  const y = figure.value?.y
  return typeof y === 'number' ? [{ id: 'ball', x: 0, y, r: 0.25, testId: 'awesome-case-ncollide-ball' }] : []
})
</script>

<template lang="pug">
.awesome-case-body(v-if="figure" data-testid="awesome-case-ncollide")
  MetricStrip(:metrics="figure.metrics" test-id="awesome-case-ncollide-metrics")
  AwesomePhysicsCasePlot(
    v-if="figure.operation === 'step'"
    title="ncollide2d CCD plane settle"
    description="Verified ncollide2d WASM snapshot. Plane is y = -0.75. A finite CCD fixture is not a physical-theory validation."
    x-label="x"
    y-label="y"
    :series="[{ id: 'plane', points: plane, testId: 'awesome-case-ncollide-plane' }]"
    :extra-circles="circles"
    equal-aspect
    test-id="awesome-case-ncollide-plot"
  )
p.awesome-case-mismatch(v-else data-testid="awesome-case-mismatch") The worker payload does not match the ncollide lesson figure.
</template>
