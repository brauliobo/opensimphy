<script setup lang="ts">
import { computed, ref } from 'vue'
import QuantumTooltip from './QuantumTooltip.vue'
import { evaluateFourier, type FourierResult } from '../../quantum-wave/quantumWaveEngine'
import type { ReadingDepth } from '../../types/tour'

const props = defineProps<{ depth: ReadingDepth }>()
const componentCount = ref(3)
const error = ref('')

const result = computed<FourierResult | null>(() => {
  try {
    error.value = ''
    return evaluateFourier({ componentCount: componentCount.value })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    return null
  }
})

function mapX(x: number): number {
  return 52 + (x + Math.PI) / (2 * Math.PI) * 650
}

function mapY(y: number): number {
  return 150 - y * 75
}

function curvePoints(rows: readonly { x: number; y: number }[]): string {
  return rows.map((point) => `${mapX(point.x)},${mapY(point.y)}`).join(' ')
}

function format(value: number): string {
  return Number(value.toPrecision(5)).toString()
}
</script>

<template lang="pug">
article.quantum-instrument.fourier-instrument(data-testid="quantum-fourier-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 04 / Fourier composer
    h3 Build a square wave one sine component at a time
    p Increase the number of odd harmonics and watch the approximation sharpen. This is the practical meaning of a #[QuantumTooltip(term="Fourier sum" plain="A weighted pile-up of simple repeating waves." technical="A finite truncation of a Fourier series; convergence and edge behavior depend on the target and basis." :depth="props.depth")].
  .quantum-controls.quantum-controls--one
    label
      span Number of sine components
      input(v-model.number="componentCount" type="range" min="1" max="9" step="1" data-testid="fourier-components")
      output {{ componentCount }} components / highest harmonic {{ result?.highestHarmonic }}

  section.quantum-result(v-if="result" data-testid="fourier-result")
    figure
      svg(viewBox="0 0 760 300" role="img" aria-labelledby="fourier-title fourier-description")
        title#fourier-title Fourier sum approaching a square wave
        desc#fourier-description The amber trace is the square-wave target, the cyan trace is the finite sine sum, and thin lines show component waves.
        line.fourier-axis(x1="52" x2="702" y1="150" y2="150")
        polyline.fourier-component(v-for="(component, index) in result.components" :key="component.harmonic" :style="{ opacity: Math.max(0.12, 0.5 - index * 0.035) }" :points="curvePoints(component.points)")
        polyline.fourier-target(:points="curvePoints(result.points.map(({ x, target }) => ({ x, y: target })))")
        polyline.fourier-sum(:points="curvePoints(result.points.map(({ x, sum }) => ({ x, y: sum })))" data-testid="fourier-sum-curve")
        text.fourier-label(x="52" y="26") +1 target
        text.fourier-label(x="52" y="282") -1 target
        text.fourier-label(x="702" y="26" text-anchor="end") x
        text.fourier-label(x="702" y="294" text-anchor="end") finite sum
      figcaption The edge overshoot is a finite-series feature. More components improve the interior and sharpen the transition, but the model is still a bounded approximation.
    dl.quantum-readout-grid
      div
        dt Components
        dd {{ result.componentCount }}
      div
        dt Highest harmonic
        dd {{ result.highestHarmonic }}
      div
        dt Grid RMSE
        dd {{ format(result.rmse) }}
      div
        dt Basis
        dd odd sine harmonics
    p.quantum-finding(role="status") {{ result.finding }}
    table
      caption Component ledger
      thead
        tr
          th Component
          th Harmonic
          th Coefficient
          th Operation note
      tbody
        tr(v-for="(component, index) in result.components" :key="component.harmonic")
          th(scope="row") {{ index + 1 }}
          td {{ component.harmonic }}
          td {{ format(component.coefficient) }}
          td Differentiate this component, then add the result
    details.quantum-disclosure(v-if="props.depth === 'technical'")
      summary Technical reading
      p The target is sign(sin x). The finite approximation is 4/pi times the sum of sin((2j-1)x)/(2j-1). The plotted RMSE samples x uniformly from -pi through pi and is not an uncertainty estimate.
    p.quantum-boundary A visual convergence pattern is not evidence that a physical system has this basis. The basis is a mathematical choice that becomes physical only inside a derived model.
  p.quantum-error(v-if="error" role="alert") {{ error }}
</template>

<style scoped>
.fourier-instrument svg { display: block; width: 100%; height: auto; margin-top: 1.5rem; border: 1px solid var(--rule-bright); background: var(--ink-0); }
.fourier-axis { stroke: var(--rule-bright); stroke-width: 1.5; }
.fourier-component, .fourier-target, .fourier-sum { fill: none; stroke-width: 1.5; }
.fourier-component { stroke: var(--paper-dim); }
.fourier-target { stroke: var(--amber); stroke-width: 2.5; stroke-dasharray: 5 4; }
.fourier-sum { stroke: var(--cyan); stroke-width: 3; }
.fourier-label { fill: var(--paper-dim); font-family: var(--mono); font-size: 11px; }
</style>
