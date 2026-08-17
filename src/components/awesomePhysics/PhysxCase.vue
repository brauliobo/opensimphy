<script setup lang="ts">
import { computed } from 'vue'
import MetricStrip from '../cases/MetricStrip.vue'
import AwesomePhysicsCasePlot from './AwesomePhysicsCasePlot.vue'
import { physxFigure } from '../../awesomePhysics/caseFigures'

const props = defineProps<{
  result: unknown
}>()

const figure = computed(() => physxFigure(props.result))
const ground = [
  { x: -4, y: 0 },
  { x: 4, y: 0 },
]
const circles = computed(() => {
  const y = figure.value?.y
  return typeof y === 'number' ? [{ id: 'sphere', x: 0, y, r: 1, testId: 'awesome-case-physx-sphere' }] : []
})
</script>

<template lang="pug">
.awesome-case-body(v-if="figure" data-testid="awesome-case-physx")
  MetricStrip(:metrics="figure.metrics" test-id="awesome-case-physx-metrics")
  AwesomePhysicsCasePlot(
    v-if="figure.operation === 'step'"
    title="PhysX 3.4 headless sphere"
    description="Verified PhysX 3.4 WASM snapshot. Ground is the y = 0 plane. A finite fixture is not a physical-theory validation."
    x-label="x"
    y-label="y"
    :series="[{ id: 'ground', points: ground, testId: 'awesome-case-physx-ground' }]"
    :extra-circles="circles"
    equal-aspect
    test-id="awesome-case-physx-plot"
  )
p.awesome-case-mismatch(v-else data-testid="awesome-case-mismatch") The worker payload does not match the PhysX lesson figure.
</template>
