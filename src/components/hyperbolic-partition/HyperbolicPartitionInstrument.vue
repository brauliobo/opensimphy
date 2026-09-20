<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  A_COMPACT,
  BRANCH_POINTS,
  SPECIAL_A,
  describeRoots,
  formatAngle,
  formatComplex,
  mobiusCharts,
  monodromyAround,
  realLocusCached,
  sliderFromA,
  uniqueLambdas,
  vietaSums,
  type PartitionRoot,
} from '../../hyperbolic-partition/partitionEngine'
import {
  drawExplorer,
  type MainTab,
  type RiemannSub,
  type RootsSub,
} from '../../hyperbolic-partition/partitionDraw'
import type { ReadingDepth } from '../../types/tour'

defineProps<{ depth?: ReadingDepth }>()

const MAIN_TABS = Object.freeze([
  Object.freeze({ id: 'roots' as const, label: 'Roots' }),
  Object.freeze({ id: 'mobius' as const, label: 'Möbius transform' }),
  Object.freeze({ id: 'cross-ratio' as const, label: 'Cross-ratio' }),
  Object.freeze({ id: 'monodromy' as const, label: 'Monodromy' }),
  Object.freeze({ id: 'riemann' as const, label: 'Riemann surface' }),
])

const ROOT_SUBS = Object.freeze([
  Object.freeze({ id: 'roots' as const, label: 'Roots' }),
  Object.freeze({ id: 'angles' as const, label: 'Root angles' }),
  Object.freeze({ id: 'magnitudes' as const, label: 'Root magnitudes' }),
])

const RIEMANN_SUBS = Object.freeze([
  Object.freeze({ id: 'surface' as const, label: 'Surface' }),
  Object.freeze({ id: 'planar' as const, label: 'Planar map' }),
  Object.freeze({ id: 'root-paths' as const, label: 'Root paths' }),
  Object.freeze({ id: 'real-locus' as const, label: 'Real locus' }),
  Object.freeze({ id: 'imaginary-locus' as const, label: 'Imaginary locus' }),
  Object.freeze({ id: 'sheet-cuts' as const, label: 'Sheet cuts' }),
])

const SPECIAL_BUTTONS = Object.freeze([
  Object.freeze({ label: '−∞', a: Number.NEGATIVE_INFINITY, title: 'a = −∞' }),
  Object.freeze({ label: '−a₁', a: -SPECIAL_A.branch, title: 'a = −a₁ (real branch)' }),
  Object.freeze({ label: '−a₂', a: -SPECIAL_A.harmonic, title: 'a = −a_h (harmonic)' }),
  Object.freeze({ label: '−a₃', a: -SPECIAL_A.unitCircle, title: 'a = −(1 − 1/(2π))' }),
  Object.freeze({ label: '0', a: 0, title: 'a = 0' }),
  Object.freeze({ label: '+a₃', a: SPECIAL_A.unitCircle, title: 'a = 1 − 1/(2π)' }),
  Object.freeze({ label: '+a₂', a: SPECIAL_A.harmonic, title: 'a = +a_h (harmonic)' }),
  Object.freeze({ label: '+a₁', a: SPECIAL_A.branch, title: 'a = +a₁ (real branch)' }),
  Object.freeze({ label: 'physical', a: SPECIAL_A.physical, title: 'a = exp(π²/4) − m_p' }),
  Object.freeze({ label: '+∞', a: Number.POSITIVE_INFINITY, title: 'a = +∞' }),
])

const a = ref(SPECIAL_A.physical)
const slider = ref(sliderFromA(SPECIAL_A.physical))
const tab = ref<MainTab>('roots')
const rootsSub = ref<RootsSub>('roots')
const riemannSub = ref<RiemannSub>('surface')
const chartIndex = ref(0)
const branchIndex = ref(0)
const canvas = ref<HTMLCanvasElement>()
let frame = 0

const roots = computed<PartitionRoot[]>(() => describeRoots(a.value))
const invariants = computed(() => vietaSums(roots.value.map((root) => root.value)))
const charts = computed(() => mobiusCharts(roots.value.map((root) => root.value)))
const unique = computed(() => uniqueLambdas(charts.value))
const selectedChart = computed(() => charts.value[chartIndex.value] ?? charts.value[0])
const selectedBranch = computed(() => BRANCH_POINTS[branchIndex.value] ?? BRANCH_POINTS[0])
const monodromy = computed(() => monodromyAround(selectedBranch.value!.a))

function paint(): void {
  const el = canvas.value
  if (!el) return
  const ctx = el.getContext('2d')
  if (!ctx) return
  const ratio = window.devicePixelRatio || 1
  const width = el.clientWidth
  const height = el.clientHeight
  if (el.width !== Math.floor(width * ratio) || el.height !== Math.floor(height * ratio)) {
    el.width = Math.floor(width * ratio)
    el.height = Math.floor(height * ratio)
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  drawExplorer(ctx, width, height, {
    tab: tab.value,
    rootsSub: rootsSub.value,
    riemannSub: riemannSub.value,
    a: a.value,
    roots: roots.value,
    charts: charts.value,
    unique: unique.value,
    chartIndex: chartIndex.value,
    monodromy: monodromy.value,
    locus: realLocusCached(),
  })
}

function setA(value: number): void {
  a.value = value
  slider.value = sliderFromA(value)
}

function onSlider(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  slider.value = value
  a.value = Math.sinh(A_COMPACT * value)
}

function onChart(event: Event): void {
  chartIndex.value = Number((event.target as HTMLInputElement).value)
}

function onAInput(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(value)) setA(value)
}

function schedule(): void {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(paint)
}

watch([a, tab, rootsSub, riemannSub, chartIndex, branchIndex], schedule, { flush: 'post' })
onMounted(() => {
  schedule()
  window.addEventListener('resize', schedule)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  window.removeEventListener('resize', schedule)
})
</script>

<template lang="pug">
article.quantum-instrument.partition-instrument(data-testid="hyperbolic-partition-instrument")
  header.partition-toolbar
    .partition-tabs(role="tablist" aria-label="Explorer views" data-testid="explorer-tabs")
      button(
        v-for="item in MAIN_TABS"
        :key="item.id"
        type="button"
        role="tab"
        :aria-selected="tab === item.id ? 'true' : 'false'"
        :data-testid="`tab-${item.id}`"
        @click="tab = item.id"
      ) {{ item.label }}
    .partition-subs(v-if="tab === 'roots'" role="tablist" aria-label="Root displays")
      button(
        v-for="item in ROOT_SUBS"
        :key="item.id"
        type="button"
        role="tab"
        :aria-selected="rootsSub === item.id ? 'true' : 'false'"
        :data-testid="`roots-sub-${item.id}`"
        @click="rootsSub = item.id"
      ) {{ item.label }}
    .partition-subs(v-else-if="tab === 'riemann'" role="tablist" aria-label="Riemann displays")
      button(
        v-for="item in RIEMANN_SUBS"
        :key="item.id"
        type="button"
        role="tab"
        :aria-selected="riemannSub === item.id ? 'true' : 'false'"
        :data-testid="`riemann-sub-${item.id}`"
        @click="riemannSub = item.id"
      ) {{ item.label }}

  .partition-stage
    canvas.partition-canvas(ref="canvas" data-testid="partition-canvas")
    aside.partition-readout
      p.eyebrow T_a(x) = x⁴ + 2π x² − 2π a x + 2π
      label.partition-field
        span a
        input(
          type="number"
          step="0.01"
          :value="Number.isFinite(a) ? a : ''"
          data-testid="a-input"
          @change="onAInput"
        )
      p(data-testid="a-readout") a = {{ Number.isFinite(a) ? a.toFixed(8) : (a < 0 ? '−∞' : '+∞') }}
      p(data-testid="vieta-sum") ∑ zhe = {{ formatComplex(invariants.sum) }}
      p(data-testid="vieta-sumsq") ∑ zhe² = {{ formatComplex(invariants.sumSquares) }}
      p(data-testid="vieta-product") ∏ zhe = {{ formatComplex(invariants.product) }}
      .partition-roots
        div(v-for="root in roots" :key="root.label" :data-testid="`root-${root.label}`")
          strong {{ root.label }}
          span {{ formatComplex(root.value) }}
          small r={{ root.radius.toFixed(4) }} · {{ formatAngle(root.angle) }} · |T|={{ root.residual.toExponential(1) }}
      template(v-if="tab === 'mobius' && selectedChart")
        label.partition-field
          span chart 1–24
          input(type="range" min="0" max="23" :value="chartIndex" data-testid="mobius-chart" @input="onChart")
        p(data-testid="mobius-lambda") λ = {{ formatComplex(selectedChart.lambda) }}
        p(data-testid="mobius-unique") {{ unique.length }} distinct λ from {{ charts.length }} labeled charts
      template(v-if="tab === 'cross-ratio'")
        p(data-testid="cross-ratio-count") Anharmonic orbit: {{ unique.length }} values
        p(v-for="(value, index) in unique" :key="index") λ{{ index + 1 }} = {{ formatComplex(value) }}
      template(v-if="tab === 'monodromy'")
        .partition-branches(data-testid="monodromy-branches")
          button(
            v-for="(point, index) in BRANCH_POINTS"
            :key="point.id"
            type="button"
            :aria-pressed="branchIndex === index ? 'true' : 'false'"
            @click="branchIndex = index"
          ) {{ point.label }}
        p(data-testid="monodromy-cycle") Loop around {{ selectedBranch?.label }} → {{ monodromy.cycleType }}
        p Finite simple ramification. ∞ has index 3; 0 is unramified over ∞.

  .partition-slider
    input.partition-range(
      type="range"
      min="-1"
      max="1"
      step="0.001"
      :value="slider"
      data-testid="a-slider"
      aria-label="Compactified a slider"
      @input="onSlider"
    )
    .partition-specials
      button(
        v-for="item in SPECIAL_BUTTONS"
        :key="item.label"
        type="button"
        :title="item.title"
        :data-testid="`special-${item.label}`"
        @click="setA(item.a)"
      ) {{ item.label }}
</template>
