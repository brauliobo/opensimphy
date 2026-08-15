<script setup lang="ts">
import { computed, ref } from 'vue'
import QuantumTooltip from './QuantumTooltip.vue'
import { evaluateProbability, type ProbabilityResult } from '../../quantum-wave/quantumWaveEngine'
import type { ReadingDepth } from '../../types/tour'

const props = defineProps<{ depth: ReadingDepth }>()

const wavelength = ref(1)
const slitSeparation = ref(1.4)
const screenDistance = ref(8)
const shots = ref(240)
const coherent = ref(true)
const error = ref('')

const result = computed<ProbabilityResult | null>(() => {
  try {
    error.value = ''
    return evaluateProbability({ wavelength: wavelength.value, slitSeparation: slitSeparation.value, screenDistance: screenDistance.value, shots: shots.value, coherent: coherent.value })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    return null
  }
})

const plotSamples = computed(() => result.value?.screen.filter((_point, index) => index % 4 === 0) ?? [])
const probabilityMaximum = computed(() => Math.max(...(result.value?.screen.map((point) => point.probability) ?? [0]), 1e-12))
const countMaximum = computed(() => Math.max(...(result.value?.screen.map((point) => point.counts) ?? [0]), 1))

function mapX(y: number): number {
  return 50 + (y + 4) / 8 * 660
}

function mapY(probability: number): number {
  return 220 - Math.min(1, probability / probabilityMaximum.value) * 180
}

function mapCountY(count: number): number {
  return 220 - count / countMaximum.value * 180
}

function format(value: number, digits = 5): string {
  if (!Number.isFinite(value)) return 'unavailable'
  if (Math.abs(value) >= 1e5 || (Math.abs(value) > 0 && Math.abs(value) < 1e-3)) return value.toExponential(digits - 1)
  return Number(value.toPrecision(digits)).toString()
}
</script>

<template>
  <article class="quantum-instrument probability-instrument" data-testid="quantum-probability-instrument">
    <header class="quantum-instrument__header">
       <p class="quantum-kicker">Instrument 07 / probability wave</p>
      <h3>Let two amplitudes meet at a screen</h3>
      <p>
        Send the same idealized wave through two slits. The important order is amplitude first, then probability:
        <QuantumTooltip term="Born rule" plain="Square the magnitude of the amplitude to get a probability density." technical="P(x) is proportional to psi*(x) psi(x); the complex conjugate makes the result real and nonnegative." :depth="props.depth" />
        . The bars are a deterministic display of repeated shots, not a random detector simulation.
      </p>
    </header>

    <div class="quantum-controls quantum-controls--four">
      <label><span>Wavelength</span><input v-model.number="wavelength" type="range" min="0.4" max="2" step="0.05" data-testid="probability-wavelength"><output>{{ format(wavelength) }}</output></label>
      <label><span>Slit separation</span><input v-model.number="slitSeparation" type="range" min="0.5" max="2.5" step="0.05" data-testid="probability-separation"><output>{{ format(slitSeparation) }}</output></label>
      <label><span>Screen distance</span><input v-model.number="screenDistance" type="range" min="4" max="12" step="0.5" data-testid="probability-distance"><output>{{ format(screenDistance) }}</output></label>
      <label><span>Detector shots</span><input v-model.number="shots" type="range" min="50" max="500" step="10" data-testid="probability-shots"><output>{{ shots }}</output></label>
    </div>
    <label class="quantum-toggle"><input v-model="coherent" type="checkbox" data-testid="probability-coherent"><span>Keep the two paths coherent so the cross-term can interfere.</span></label>

    <section v-if="result" class="quantum-result" data-testid="probability-result">
      <figure>
        <svg viewBox="0 0 760 300" role="img" aria-labelledby="probability-title probability-description">
          <title id="probability-title">Double-slit probability pattern</title>
          <desc id="probability-description">A screen coordinate plot with deterministic event bars. Coherent amplitudes create alternating bright and dark regions.</desc>
          <line class="probability-axis" x1="50" x2="710" y1="220" y2="220" />
          <line class="probability-axis" x1="50" x2="50" y1="34" y2="220" />
           <rect v-for="point in plotSamples" :key="point.y" class="probability-bar" :x="mapX(point.y) - 2" :y="mapCountY(point.counts)" width="4" :height="220 - mapCountY(point.counts)" />
          <polyline class="probability-curve" :points="result.screen.map((point) => `${mapX(point.y)},${mapY(point.probability)}`).join(' ')" />
           <text class="probability-label" x="50" y="26">probability curve / deterministic counts</text>
          <text class="probability-label" x="50" y="250">screen y = -4</text>
          <text class="probability-label" x="710" y="250" text-anchor="end">screen y = +4</text>
        </svg>
        <figcaption>
          Coherent: <strong>{{ result.coherent ? 'yes' : 'no' }}</strong>. The normalized probability total is
          <strong>{{ format(result.totalProbability) }}</strong>. Bright regions are more likely landing positions, not brighter individual particles.
        </figcaption>
      </figure>
      <dl class="quantum-readout-grid">
        <div><dt>Wavelength</dt><dd>{{ format(result.wavelength) }}</dd></div>
        <div><dt>Slit separation</dt><dd>{{ format(result.slitSeparation) }}</dd></div>
        <div><dt>Shots</dt><dd>{{ result.shots }}</dd></div>
        <div><dt>Complex total</dt><dd>{{ format(result.totalProbability) }}</dd></div>
      </dl>
      <p class="quantum-finding" role="status">{{ result.finding }}</p>
      <table>
        <caption>Accessible screen sample and predicted deterministic counts</caption>
        <thead><tr><th>Screen y</th><th>Real amplitude</th><th>Imaginary amplitude</th><th>Probability</th><th>Counts</th></tr></thead>
        <tbody>
          <tr v-for="point in result.table" :key="point.y"><th scope="row">{{ format(point.y, 3) }}</th><td>{{ format(point.amplitudeReal) }}</td><td>{{ format(point.amplitudeImaginary) }}</td><td>{{ format(point.probability) }}</td><td>{{ point.counts }}</td></tr>
        </tbody>
      </table>
      <details v-if="props.depth === 'technical'" class="quantum-disclosure">
        <summary>Technical reading</summary>
        <p>The two slit phases are +/- pi d y / (lambda L). Coherent intensity includes the cross-term. The engine normalizes a finite screen interval; it does not model a full transverse wavefunction, finite slit width, detector noise, or random sampling.</p>
        <p>For comparison, a real-axis-only amplitude has a phase-dependent total range of {{ format(result.realAxisTotalRange.minimum) }} to {{ format(result.realAxisTotalRange.maximum) }} on the same bounded grid. This illustrates why normalization and complex magnitude matter, but is not a proof about all possible real formulations.</p>
      </details>
      <p class="quantum-boundary">This activity computes a simplified interference model. It does not reproduce a laboratory apparatus, infer an electron's path, or validate an interpretation by itself.</p>
    </section>
    <p v-if="error" class="quantum-error" role="alert">{{ error }}</p>
  </article>
</template>

<style scoped>
.quantum-toggle { display: flex; min-height: 44px; align-items: center; gap: 0.65rem; color: var(--paper-dim); font-family: var(--mono); font-size: 0.8rem; }
.quantum-toggle input { width: 1.2rem; height: 1.2rem; accent-color: var(--cyan); }
.probability-instrument svg { display: block; width: 100%; height: auto; margin-top: 1.5rem; border: 1px solid var(--rule-bright); background: var(--ink-0); }
.probability-axis { stroke: var(--rule-bright); stroke-width: 1.5; }
.probability-bar { fill: var(--amber); opacity: 0.6; }
.probability-curve { fill: none; stroke: var(--cyan); stroke-width: 2.5; }
.probability-label { fill: var(--paper-dim); font-family: var(--mono); font-size: 11px; }
</style>
