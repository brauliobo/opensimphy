<script setup lang="ts">
import { computed } from 'vue'
import FigurePanel from '../FigurePanel.vue'
import { DEFAULT_PLOT_VIEWPORT, boundsOf, type PlotPoint } from '../../simphy/plot'
import { seriesPoints, toSvgCircles, toSvgPolygons, toSvgPolylines } from '../../render/svg'
import type { PlotFigureSeries } from '../../types/plot'

const props = withDefaults(defineProps<{
  title: string
  description: string
  xLabel: string
  yLabel: string
  series: readonly PlotFigureSeries[]
  extraPolygons?: readonly { id: string, points: readonly PlotPoint[], testId?: string }[]
  extraCircles?: readonly { id: string, x: number, y: number, r: number, testId?: string }[]
  equalAspect?: boolean
  testId: string
}>(), {
  extraPolygons: () => [],
  extraCircles:  () => [],
  equalAspect:   false,
})

const viewport = DEFAULT_PLOT_VIEWPORT

const allPoints = computed(() => [
  ...seriesPoints(props.series),
  ...props.extraPolygons.flatMap((polygon) => polygon.points),
  ...props.extraCircles.flatMap((circle) => [
    { x: circle.x - circle.r, y: circle.y - circle.r },
    { x: circle.x + circle.r, y: circle.y + circle.r },
  ]),
])

const bounds = computed(() => boundsOf(allPoints.value, props.equalAspect))
const projectedSeries = computed(() => toSvgPolylines(props.series, bounds.value, viewport))
const projectedPolygons = computed(() => toSvgPolygons(props.extraPolygons, bounds.value, viewport))
const projectedCircles = computed(() => toSvgCircles(props.extraCircles, bounds.value, viewport))
const titleId = computed(() => `${props.testId}-title`)
const descId = computed(() => `${props.testId}-desc`)
</script>

<template lang="pug">
FigurePanel.awesome-case-plot(:label="title" status="ready")
  svg(
    :viewBox="`0 0 ${viewport.width} ${viewport.height}`"
    role="img"
    :aria-labelledby="`${titleId} ${descId}`"
    :data-testid="testId"
  )
    title(:id="titleId") {{ title }}
    desc(:id="descId") {{ description }}
    polygon.awesome-case-polygon(
      v-for="polygon in projectedPolygons"
      :key="polygon.id"
      :points="polygon.pointsAttr"
      :data-testid="polygon.testId"
    )
    polyline.awesome-case-curve(
      v-for="item in projectedSeries"
      :key="item.id"
      :points="item.points"
      :data-testid="item.testId"
    )
    circle.awesome-case-marker(
      v-for="circle in projectedCircles"
      :key="circle.id"
      :cx="circle.cx"
      :cy="circle.cy"
      :r="circle.radius"
      :data-testid="circle.testId"
    )
    text.awesome-case-axis(:x="viewport.width / 2" :y="viewport.height - 12") {{ xLabel }}
    text.awesome-case-axis(:x="16" :y="viewport.height / 2" :transform="`rotate(-90 16 ${viewport.height / 2})`") {{ yLabel }}
  template(#caption)
    p.plot-caption {{ description }}
</template>
