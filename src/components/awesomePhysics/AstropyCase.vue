<script setup lang="ts">
import { computed } from 'vue'
import MetricStrip from '../cases/MetricStrip.vue'
import AwesomePhysicsCasePlot from './AwesomePhysicsCasePlot.vue'
import { astropyFigure } from '../../awesomePhysics/caseFigures'

const props = defineProps<{
  result: unknown
}>()

const figure = computed(() => astropyFigure(props.result))
const circles = computed(() => {
  const marker = figure.value?.marker
  return marker ? [{ id: 'galactic', x: marker.x, y: marker.y, r: 8, testId: 'awesome-case-astropy-marker' }] : []
})
const frame = [
  { x: 0, y: -90 },
  { x: 360, y: -90 },
  { x: 360, y: 90 },
  { x: 0, y: 90 },
]
</script>

<template lang="pug">
.awesome-case-body(v-if="figure" data-testid="awesome-case-astropy")
  MetricStrip(:metrics="figure.metrics" test-id="awesome-case-astropy-metrics")
  AwesomePhysicsCasePlot(
    v-if="figure.marker"
    title="ICRS to Galactic"
    description="Reid and Brunthaler NGP rotation. No precession, proper motion, or observer location is applied."
    x-label="l (deg)"
    y-label="b (deg)"
    :series="[]"
    :extra-polygons="[{ id: 'frame', points: frame }]"
    :extra-circles="circles"
    test-id="awesome-case-astropy-plot"
  )
p.awesome-case-mismatch(v-else data-testid="awesome-case-mismatch") The worker payload does not match the astropy lesson figure.
</template>
