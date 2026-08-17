<script setup lang="ts">
import { computed } from 'vue'
import MetricStrip from '../cases/MetricStrip.vue'
import AwesomePhysicsCasePlot from './AwesomePhysicsCasePlot.vue'
import { canteraFigure } from '../../awesomePhysics/caseFigures'

const props = defineProps<{
  result: unknown
}>()

const figure = computed(() => canteraFigure(props.result))
const circles = computed(() => {
  const marker = figure.value?.marker
  return marker ? [{ id: 'state', x: marker.x, y: marker.y, r: 8, testId: 'awesome-case-cantera-marker' }] : []
})
const title = computed(() => {
  if (figure.value?.operation === 'thermo') return 'Cantera ohmech thermo'
  if (figure.value?.operation === 'reactor') return 'Cantera zero-D reactor'
  return 'Cantera HP equilibrium'
})
</script>

<template lang="pug">
.awesome-case-body(v-if="figure" data-testid="awesome-case-cantera")
  MetricStrip(:metrics="figure.metrics" test-id="awesome-case-cantera-metrics")
  AwesomePhysicsCasePlot(
    :title="title"
    description="Verified Cantera WASM snapshot. A finite H2/O2 fixture is not a kinetics or mechanism validation."
    :x-label="figure.xLabel"
    :y-label="figure.yLabel"
    :series="[]"
    :extra-circles="circles"
    test-id="awesome-case-cantera-plot"
  )
p.awesome-case-mismatch(v-else data-testid="awesome-case-mismatch") The worker payload does not match the Cantera lesson figure.
</template>
