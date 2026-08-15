<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import QuantumTooltip from './QuantumTooltip.vue'
import { evaluateStandingWave, type StandingWaveResult } from '../../quantum-wave/quantumWaveEngine'
import type { ReadingDepth } from '../../types/tour'

const props = defineProps<{ depth: ReadingDepth }>()

const amplitude = ref(1)
const modeNumber = ref(2)
const period = ref(2)
const time = ref(0)
const playing = ref(false)
const error = ref('')
let animationFrame = 0
let previousTime = 0

const result = computed<StandingWaveResult | null>(() => {
  try {
    error.value = ''
    return evaluateStandingWave({ amplitude: amplitude.value, modeNumber: modeNumber.value, period: period.value, time: time.value })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    return null
  }
})

const points = computed(() => result.value ? result.value.points.map((point) => `${mapX(point.x)},${mapY(point.y)}`).join(' ') : '')
const envelope = computed(() => result.value ? result.value.envelope.map((point) => `${mapX(point.x)},${mapY(point.y)}`).join(' ') : '')

function mapX(x: number): number {
  return 52 + x / (result.value?.domainLength ?? 8) * 650
}

function mapY(y: number): number {
  return 145 - y / 1.5 * 105
}

function format(value: number): string {
  return value.toFixed(2)
}

function stop(): void {
  playing.value = false
  if (animationFrame) cancelAnimationFrame(animationFrame)
  animationFrame = 0
}

function tick(now: number): void {
  if (!playing.value) return
  if (!previousTime) previousTime = now
  const elapsed = Math.min(80, now - previousTime)
  previousTime = now
  time.value = (time.value + elapsed / 1000 * 0.8) % 4
  animationFrame = requestAnimationFrame(tick)
}

function togglePlaying(): void {
  playing.value = !playing.value
  if (playing.value) {
    previousTime = 0
    animationFrame = requestAnimationFrame(tick)
  } else stop()
}

function reset(): void {
  stop()
  amplitude.value = 1
  modeNumber.value = 2
  period.value = 2
  time.value = 0
}

watch(period, () => { time.value = Math.min(time.value, 4) })
onBeforeUnmount(stop)
</script>

<template lang="pug">
article.quantum-instrument.standing-wave-instrument(data-testid="quantum-standing-wave-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 02 / standing wave
    h3 Make a matter-wave shape that fits fixed ends
    p Choose the number of half-waves in a fixed eight-unit box. Nodes are the quiet points; antinodes are the largest excursions. The animation shows a changing phase, not a particle orbit.

  .quantum-controls.quantum-controls--three
    label
      span Amplitude A
      input(v-model.number="amplitude" type="range" min="0.2" max="1.5" step="0.1" data-testid="standing-amplitude")
      output {{ format(amplitude) }}
    label
      span Boundary mode n
      input(v-model.number="modeNumber" type="range" min="1" max="5" step="1" data-testid="standing-mode")
      output {{ modeNumber }} half-waves
    label
      span Period T
      input(v-model.number="period" type="range" min="0.5" max="4" step="0.1" data-testid="standing-period")
      output {{ format(period) }} time units
  .quantum-actions
    button(type="button" data-testid="standing-play" @click="togglePlaying") {{ playing ? 'Pause motion' : 'Play motion' }}
    button(type="button" data-testid="standing-reset" @click="reset") Reset
    span.quantum-readout t = {{ format(time) }}
  p.quantum-error(v-if="error" role="alert") {{ error }}

  section.quantum-result(v-if="result" data-testid="standing-result")
    figure
      svg(viewBox="0 0 760 300" role="img" aria-labelledby="standing-title standing-description")
        title#standing-title Animated standing wave with nodes and antinodes
        desc#standing-description A sine-shaped wave changes height over time. Dashed vertical lines mark nodes and amber circles mark antinodes.
        line.wave-axis(x1="52" x2="702" y1="145" y2="145")
        polyline.wave-envelope(:points="envelope")
        polyline.wave-curve(:points="points" data-testid="standing-wave-curve")
        g(v-for="node in result.nodes" :key="`node-${node}`")
          line.wave-node(:x1="mapX(node)" :x2="mapX(node)" y1="32" y2="258")
          text.wave-label(:x="mapX(node)" y="278" text-anchor="middle") node
        circle.wave-antinode(v-for="antinode in result.antinodes" :key="`antinode-${antinode}`" :cx="mapX(antinode)" :cy="mapY(result.amplitude * Math.sin(result.waveNumber * antinode) * Math.cos(result.angularFrequency * result.time))" r="5")
        text.wave-label(x="52" y="22") +A
        text.wave-label(x="52" y="270") -A
        text.wave-label(x="702" y="22" text-anchor="end") x
      figcaption #[strong Watch for:] the nodes stay put while the antinodes change sign. The spatial scale is set by #[QuantumTooltip(term="wavelength" plain="The distance between repeating points of a wave." technical="lambda = 2 pi / k, the reciprocal coordinate of spatial angular frequency." :depth="props.depth")].
    dl.quantum-readout-grid
      div
        dt Boundary mode n
        dd {{ result.modeNumber }}
      div
        dt Wave number k
        dd {{ format(result.waveNumber) }}
      div
        dt Wavelength lambda
        dd {{ format(result.wavelength) }} length units
      div
        dt Angular frequency omega
        dd {{ format(result.angularFrequency) }}
      div
        dt Nodes shown
        dd {{ result.nodes.length }}
      div
        dt Antinodes shown
        dd {{ result.antinodes.length }}
    table
      caption Named points in the standing-wave construction
      thead
        tr
          th Point
          th Position
          th Role
      tbody
        tr(v-for="(node, index) in result.nodes" :key="`row-${node}`")
          th(scope="row") Node {{ index + 1 }}
          td {{ format(node) }}
          td Amplitude is zero for this shape
    p.quantum-boundary This is a visual wave model. It does not claim that a bound electron traces the curve or that boundary conditions for a particular atom have been solved.
</template>

<style scoped>
.standing-wave-instrument svg { display: block; width: 100%; height: auto; margin-top: 1.5rem; border: 1px solid var(--rule-bright); background: var(--ink-0); }
.wave-axis { stroke: var(--rule-bright); stroke-width: 1.5; }
.wave-envelope { fill: none; stroke: var(--amber-dark); stroke-width: 1.5; stroke-dasharray: 6 5; }
.wave-curve { fill: none; stroke: var(--cyan); stroke-width: 3; }
.wave-node { stroke: var(--rule-bright); stroke-width: 1; stroke-dasharray: 4 4; }
.wave-antinode { fill: var(--amber); }
.wave-label { fill: var(--paper-dim); font-family: var(--mono); font-size: 11px; }
</style>
