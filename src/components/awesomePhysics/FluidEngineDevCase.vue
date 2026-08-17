<script setup lang="ts">
import { computed } from 'vue'
import MetricStrip from '../cases/MetricStrip.vue'
import AwesomePhysicsCasePlot from './AwesomePhysicsCasePlot.vue'
import { fluidEngineDevFigure } from '../../awesomePhysics/caseFigures'

const props = defineProps<{
  result: unknown
}>()

const figure = computed(() => fluidEngineDevFigure(props.result))
const origin = [
  { x: -4, y: 0 },
  { x: 4, y: 0 },
]
const circles = computed(() => {
  const y = figure.value?.y
  return typeof y === 'number' ? [{ id: 'jet', x: 0, y, r: 0.25, testId: 'awesome-case-fluid-engine-dev-jet' }] : []
})
</script>

<template lang="pug">
.awesome-case-body(v-if="figure" data-testid="awesome-case-fluid-engine-dev")
  MetricStrip(:metrics="figure.metrics" test-id="awesome-case-fluid-engine-dev-metrics")
  AwesomePhysicsCasePlot(
    v-if="figure.operation === 'step'"
    title="Jet 2D SPH step"
    description="Verified fluid-engine-dev WASM snapshot. Origin is y = 0. A finite SPH fixture is not a physical-theory validation."
    x-label="x"
    y-label="y"
    :series="[{ id: 'origin', points: origin, testId: 'awesome-case-fluid-engine-dev-origin' }]"
    :extra-circles="circles"
    equal-aspect
    test-id="awesome-case-fluid-engine-dev-plot"
  )
p.awesome-case-mismatch(v-else data-testid="awesome-case-mismatch") The worker payload does not match the fluid-engine-dev lesson figure.
</template>
