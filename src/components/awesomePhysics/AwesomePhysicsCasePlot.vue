<script setup lang="ts">
import { computed } from 'vue'
import { boundsOf, projectPolyline, type PlotPoint, type PlotSeries } from '../../awesomePhysics/caseFigures'

const props = withDefaults(defineProps<{
  title: string
  description: string
  xLabel: string
  yLabel: string
  series: readonly PlotSeries[]
  extraPolygons?: readonly { id: string, points: readonly PlotPoint[], testId?: string }[]
  extraCircles?: readonly { id: string, x: number, y: number, r: number, testId?: string }[]
  equalAspect?: boolean
  testId: string
}>(), {
  extraPolygons: () => [],
  extraCircles:  () => [],
  equalAspect:   false,
})

const viewport = { width: 640, height: 280, pad: 48 }

const allPoints = computed(() => [
  ...props.series.flatMap((series) => series.points),
  ...props.extraPolygons.flatMap((polygon) => polygon.points),
  ...props.extraCircles.flatMap((circle) => [
    { x: circle.x - circle.r, y: circle.y - circle.r },
    { x: circle.x + circle.r, y: circle.y + circle.r },
  ]),
])

const bounds = computed(() => boundsOf(allPoints.value, props.equalAspect))

const projectedSeries = computed(() => props.series.map((series) => ({
  ...series,
  polyline: projectPolyline(series.points, bounds.value, viewport),
})))

const projectedPolygons = computed(() => props.extraPolygons.map((polygon) => ({
  ...polygon,
  pointsAttr: projectPolyline(polygon.points, bounds.value, viewport),
})))

const projectedCircles = computed(() => {
  const spanX = bounds.value.maxX - bounds.value.minX || 1
  const spanY = bounds.value.maxY - bounds.value.minY || 1
  const innerW = viewport.width - viewport.pad * 2
  const innerH = viewport.height - viewport.pad * 2
  return props.extraCircles.map((circle) => ({
    ...circle,
    cx: viewport.pad + (circle.x - bounds.value.minX) / spanX * innerW,
    cy: viewport.height - viewport.pad - (circle.y - bounds.value.minY) / spanY * innerH,
    radius: Math.max(4, circle.r / spanX * innerW),
  }))
})

const titleId = computed(() => `${props.testId}-title`)
const descId = computed(() => `${props.testId}-desc`)
</script>

<template lang="pug">
figure.awesome-case-plot
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
      v-for="series in projectedSeries"
      :key="series.id"
      :points="series.polyline"
      :data-testid="series.testId"
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
  figcaption {{ description }}
</template>
