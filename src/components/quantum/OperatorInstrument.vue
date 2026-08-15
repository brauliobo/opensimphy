<script setup lang="ts">
import { computed, ref } from 'vue'
import QuantumTooltip from './QuantumTooltip.vue'
import { evaluateOperator, type OperatorResult, type OperatorWaveKind } from '../../quantum-wave/quantumWaveEngine'
import type { ReadingDepth } from '../../types/tour'

const props = defineProps<{ depth: ReadingDepth }>()

const kind = ref<OperatorWaveKind>('pure')
const wavelength = ref(4)
const packetWidth = ref(1.5)
const error = ref('')

const result = computed<OperatorResult | null>(() => {
  try {
    error.value = ''
    return evaluateOperator({ kind: kind.value, wavelength: wavelength.value, packetWidth: packetWidth.value })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    return null
  }
})

function mapX(x: number): number {
  return 52 + (x + 8) / 16 * 650
}

function normalized(values: readonly number[], value: number): number {
  const scale = Math.max(...values.map((candidate) => Math.abs(candidate)), 1e-12)
  return value / scale
}

function wavePoints(): string {
  const rows = result.value?.points ?? []
  return rows.map((point) => `${mapX(point.x)},${180 - point.wave * 70}`).join(' ')
}

function curvaturePoints(): string {
  const rows = result.value?.points ?? []
  const values = rows.map(({ curvature }) => curvature)
  return rows.map((point) => `${mapX(point.x)},${180 - normalized(values, point.curvature) * 70}`).join(' ')
}

function kineticPoints(): string {
  const rows = result.value?.points ?? []
  const values = rows.map(({ kineticOperatorActionJ }) => kineticOperatorActionJ)
  return rows.map((point) => `${mapX(point.x)},${180 - normalized(values, point.kineticOperatorActionJ) * 70}`).join(' ')
}

function format(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return 'unavailable'
  if (Math.abs(value) >= 1e5 || (Math.abs(value) > 0 && Math.abs(value) < 1e-3)) return value.toExponential(digits - 1)
  return Number(value.toPrecision(digits)).toString()
}
</script>

<template lang="pug">
article.quantum-instrument.operator-instrument(data-testid="quantum-operator-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 03 / operator lab
    h3 Let curvature read the momentum content
    p Compare a single pure wave with a localized wave packet. An #[QuantumTooltip(term="operator" plain="A rule that transforms a wave so a quantity can be read from it." technical="This activity uses bounded differential operators, not a full Hilbert-space domain analysis." :depth="props.depth")] is useful because it can act on a shape rather than asking us to label every point by hand.

  .quantum-controls.quantum-controls--three
    label
      span Wave shape
      select(v-model="kind" data-testid="operator-kind")
        option(value="pure") Pure sine component
        option(value="packet") Localized wave packet
    label
      span Wavelength
      input(v-model.number="wavelength" type="range" min="1.5" max="8" step="0.25" data-testid="operator-wavelength")
      output {{ format(wavelength) }}
    label
      span Packet width
      input(v-model.number="packetWidth" type="range" min="0.6" max="3" step="0.1" data-testid="operator-width")
      output {{ format(packetWidth) }}

  section.quantum-result(v-if="result" data-testid="operator-result")
    figure
      svg(viewBox="0 0 760 270" role="img" aria-labelledby="operator-title operator-description")
        title#operator-title Wave and its derivative-derived traces
        desc#operator-description Cyan is the wave, amber is normalized curvature, and red is normalized kinetic-energy output.
        line.operator-axis(x1="52" x2="702" y1="180" y2="180")
        polyline.operator-wave(:points="wavePoints()")
        polyline.operator-curvature(:points="curvaturePoints()")
        polyline.operator-kinetic(:points="kineticPoints()")
        text.operator-label(x="52" y="24") +1
        text.operator-label(x="52" y="252") -1
        text.operator-label(x="690" y="24" text-anchor="end") x
        g.operator-legend
          text(x="74" y="22") wave
          text(x="146" y="22") curvature
          text(x="250" y="22") kinetic output
      figcaption The curves are normalized only for legibility. The second derivative's sign and shape are retained; the physical kinetic-energy scale is reported below.
    dl.quantum-readout-grid
      div
        dt Spatial frequency k
        dd {{ format(result.waveNumber) }}
      div
        dt |p| = hbar k
        dd {{ format(result.momentumMagnitude, 5) }} kg m/s
      div
        dt Pure-wave K
        dd {{ format(result.pureWaveKineticEigenvalueJ, 5) }} J
      div
        dt Shape
        dd {{ result.kind }}
    p.quantum-finding(role="status") {{ result.finding }}
    table
      caption Selected derivative rows; values are direct finite-difference diagnostics on the displayed grid
      thead
        tr
          th x
          th psi
          th d psi / dx
          th d2 psi / dx2
          th K psi (J)
      tbody
        tr(v-for="point in result.table" :key="point.x")
          th(scope="row") {{ format(point.x, 3) }}
          td {{ format(point.wave, 5) }}
          td {{ format(point.firstDerivative, 5) }}
          td {{ format(point.curvature, 5) }}
          td {{ format(point.kineticOperatorActionJ, 5) }}
    details.quantum-disclosure(v-if="props.depth === 'technical'")
      summary Technical reading
      p The engine uses a centered finite difference with step 0.04 over x in [-8, 8]. The pure-wave reference value is hbar^2 k^2 / (2m_e); the packet has no single kinetic eigenvalue across the whole displayed shape.
    p.quantum-boundary A successful operator calculation establishes an output of this numerical model. It does not establish a unique physical state or measurement.
  p.quantum-error(v-if="error" role="alert") {{ error }}
</template>

<style scoped>
.operator-instrument svg { display: block; width: 100%; height: auto; margin-top: 1.5rem; border: 1px solid var(--rule-bright); background: var(--ink-0); }
.operator-axis { stroke: var(--rule-bright); stroke-width: 1.5; }
.operator-wave, .operator-curvature, .operator-kinetic { fill: none; stroke-width: 2.5; }
.operator-wave { stroke: var(--cyan); }
.operator-curvature { stroke: var(--amber); }
.operator-kinetic { stroke: var(--red); }
.operator-label, .operator-legend text { fill: var(--paper-dim); font-family: var(--mono); font-size: 11px; }
.operator-legend text:first-child { fill: var(--cyan); }
.operator-legend text:nth-child(2) { fill: var(--amber); }
.operator-legend text:nth-child(3) { fill: var(--red); }
</style>
