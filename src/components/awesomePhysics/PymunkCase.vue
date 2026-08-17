<script setup lang="ts">
import { computed } from 'vue'
import MetricStrip from '../cases/MetricStrip.vue'
import AwesomePhysicsCasePlot from './AwesomePhysicsCasePlot.vue'
import { pymunkFigure } from '../../awesomePhysics/caseFigures'

const props = defineProps<{
  result: unknown
}>()

const figure = computed(() => pymunkFigure(props.result))
const ground = [
  { x: -1.5, y: 0 },
  { x: 1.5, y: 0 },
]
const circles = computed(() => figure.value
  ? [{ id: 'ball', x: figure.value.x, y: figure.value.y, r: 0.2, testId: 'awesome-case-pymunk-ball' }]
  : [])
</script>

<template lang="pug">
.awesome-case-body(v-if="figure" data-testid="awesome-case-pymunk")
  MetricStrip(:metrics="figure.metrics" test-id="awesome-case-pymunk-metrics")
  AwesomePhysicsCasePlot(
    title="Chipmunk headless ball"
    description="Verified pymunk WASM snapshot. Ground is y = 0. A finite fixture is not a physical-theory validation."
    x-label="x"
    y-label="y"
    :series="[{ id: 'ground', points: ground, testId: 'awesome-case-pymunk-ground' }]"
    :extra-circles="circles"
    equal-aspect
    test-id="awesome-case-pymunk-plot"
  )
p.awesome-case-mismatch(v-else data-testid="awesome-case-mismatch") The worker payload does not match the pymunk lesson figure.
</template>
