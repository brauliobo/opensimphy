<script setup lang="ts">
import { computed } from 'vue'
import MetricStrip from '../cases/MetricStrip.vue'
import AwesomePhysicsCasePlot from './AwesomePhysicsCasePlot.vue'
import { newtonFigure } from '../../awesomePhysics/caseFigures'

const props = defineProps<{
  result: unknown
}>()

const figure = computed(() => newtonFigure(props.result))
const origin = [
  { x: -4, y: 0 },
  { x: 4, y: 0 },
]
const circles = computed(() => {
  const y = figure.value?.y
  return typeof y === 'number' ? [{ id: 'sphere', x: 0, y, r: 1, testId: 'awesome-case-newton-sphere' }] : []
})
</script>

<template lang="pug">
.awesome-case-body(v-if="figure" data-testid="awesome-case-newton")
  MetricStrip(:metrics="figure.metrics" test-id="awesome-case-newton-metrics")
  AwesomePhysicsCasePlot(
    v-if="figure.operation === 'step'"
    title="Newton Dynamics headless sphere"
    description="Verified Newton Dynamics WASM snapshot. Origin is y = 0. A finite fixture is not a physical-theory validation."
    x-label="x"
    y-label="y"
    :series="[{ id: 'origin', points: origin, testId: 'awesome-case-newton-origin' }]"
    :extra-circles="circles"
    equal-aspect
    test-id="awesome-case-newton-plot"
  )
p.awesome-case-mismatch(v-else data-testid="awesome-case-mismatch") The worker payload does not match the Newton Dynamics lesson figure.
</template>
