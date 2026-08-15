<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import QuantumTooltip from './QuantumTooltip.vue'
import { evaluateComplexWave, type ComplexWaveResult } from '../../quantum-wave/quantumWaveEngine'
import type { ReadingDepth } from '../../types/tour'

const props = defineProps<{ depth: ReadingDepth }>()

const mode = ref<'complex' | 'real'>('complex')
const time = ref(1.2)
const waveNumber = ref(1)
const growthRate = ref(0.2)
const playing = ref(false)
let animationFrame = 0
let previousTime = 0

const result = computed<ComplexWaveResult>(() => evaluateComplexWave({ mode: mode.value, time: time.value, waveNumber: waveNumber.value, growthRate: growthRate.value }))

function mapPlaneX(x: number): number {
  return 180 + x * 95
}

function mapPlaneY(y: number): number {
  return 130 - y * 95
}

function mapWaveX(x: number): number {
  return 390 + (x + 2 * Math.PI) / (4 * Math.PI) * 320
}

function mapWaveY(y: number): number {
  return 130 - Math.max(-1.5, Math.min(1.5, y)) * 62
}

function pathPoints(): string {
  return result.value.path.map((point) => `${mapPlaneX(point.x)},${mapPlaneY(point.y)}`).join(' ')
}

function realWavePoints(): string {
  return result.value.wave.map((point) => `${mapWaveX(point.x)},${mapWaveY(point.real)}`).join(' ')
}

function imaginaryWavePoints(): string {
  return result.value.wave.map((point) => `${mapWaveX(point.x)},${mapWaveY(point.imaginary)}`).join(' ')
}

function magnitudePoints(): string {
  return result.value.wave.map((point) => `${mapWaveX(point.x)},${mapWaveY(point.magnitude)}`).join(' ')
}

function format(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return 'unavailable'
  return Number(value.toPrecision(digits)).toString()
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
  time.value = (time.value + elapsed / 1000 * 1.5) % (2 * Math.PI)
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
  mode.value = 'complex'
  time.value = 1.2
  waveNumber.value = 1
  growthRate.value = 0.2
}

function setMode(value: 'complex' | 'real'): void {
  mode.value = value
  stop()
}

onBeforeUnmount(stop)
</script>

<template>
  <article class="quantum-instrument complex-plane-instrument" data-testid="quantum-complex-plane-instrument">
    <header class="quantum-instrument__header">
      <p class="quantum-kicker">Instrument 05 / complex plane</p>
      <h3>Turn the exponential instead of letting it run away</h3>
      <p>
        Choose the real or complex version. In the complex plane, the vector rotates with fixed radius because
        <QuantumTooltip term="i" plain="A number whose square is -1; here it supplies a quarter-turn." technical="Multiplication by i maps (a,b) to (-b,a), a 90-degree rotation in the Argand plane." :depth="props.depth" />
        makes the derivative perpendicular to the position.
      </p>
    </header>
    <div class="quantum-mode-switch" role="group" aria-label="Wave type">
       <button type="button" :class="{ 'is-selected': mode === 'real' }" :aria-pressed="mode === 'real'" data-testid="complex-real-mode" @click="setMode('real')">Real exponential</button>
       <button type="button" :class="{ 'is-selected': mode === 'complex' }" :aria-pressed="mode === 'complex'" data-testid="complex-mode" @click="setMode('complex')">Complex rotation</button>
    </div>
    <div class="quantum-controls quantum-controls--three">
      <label>
        <span>Time / phase</span>
        <input v-model.number="time" type="range" min="0" :max="2 * Math.PI" step="0.01" data-testid="complex-time">
        <output>{{ format(time) }}</output>
      </label>
      <label>
        <span>Angular pace</span>
        <input v-model.number="waveNumber" type="range" min="0.4" max="2" step="0.05" data-testid="complex-wave-number">
        <output>{{ format(waveNumber) }}</output>
      </label>
      <label>
        <span>Real growth rate</span>
        <input v-model.number="growthRate" type="range" min="-0.35" max="0.35" step="0.01" data-testid="complex-growth-rate">
        <output>{{ format(growthRate) }}</output>
      </label>
    </div>
    <div class="quantum-actions">
      <button type="button" data-testid="complex-play" @click="togglePlaying">{{ playing ? 'Pause rotation' : 'Play rotation' }}</button>
      <button type="button" data-testid="complex-reset" @click="reset">Reset</button>
    </div>

    <section class="quantum-result" data-testid="complex-result">
      <figure>
        <svg viewBox="0 0 760 300" role="img" aria-labelledby="complex-title complex-description">
          <title id="complex-title">Real axis versus complex-plane motion</title>
          <desc id="complex-description">The left plot shows a vector path in the Argand plane. The right plot shows real and imaginary wave traces.</desc>
          <line class="complex-axis" x1="50" x2="310" y1="130" y2="130" />
          <line class="complex-axis" x1="180" x2="180" y1="20" y2="240" />
          <polyline class="complex-path" :points="pathPoints()" />
          <line class="complex-vector" x1="180" y1="130" :x2="mapPlaneX(result.vector.real)" :y2="mapPlaneY(result.vector.imaginary)" />
          <circle class="complex-dot" :cx="mapPlaneX(result.vector.real)" :cy="mapPlaneY(result.vector.imaginary)" r="5" />
          <text class="complex-label" x="180" y="264" text-anchor="middle">real</text>
          <text class="complex-label" x="20" y="30">imaginary</text>
          <line class="complex-axis" x1="390" x2="710" y1="130" y2="130" />
          <polyline class="complex-real-wave" :points="realWavePoints()" />
          <polyline v-if="mode === 'complex'" class="complex-imaginary-wave" :points="imaginaryWavePoints()" />
          <polyline class="complex-magnitude-wave" :points="magnitudePoints()" />
          <text class="complex-label" x="390" y="270">space</text>
          <text class="complex-label" x="710" y="270" text-anchor="end">wave snapshot</text>
        </svg>
        <figcaption>
          Vector magnitude: <strong>{{ format(result.vector.magnitude) }}</strong>. Angle: <strong>{{ format(result.vector.angle) }}</strong> radians.
          Cyan is the real component; violet is the imaginary component; amber is magnitude.
        </figcaption>
      </figure>
      <dl class="quantum-readout-grid">
        <div><dt>Mode</dt><dd>{{ result.mode }}</dd></div>
        <div><dt>Vector magnitude</dt><dd>{{ format(result.vector.magnitude) }}</dd></div>
        <div><dt>Wave magnitude range</dt><dd>{{ format(result.magnitudeRange.minimum) }} to {{ format(result.magnitudeRange.maximum) }}</dd></div>
        <div><dt>Squared magnitude</dt><dd>{{ format(result.vector.magnitude ** 2) }}</dd></div>
      </dl>
      <p class="quantum-finding" role="status">{{ result.finding }}</p>
      <table>
        <caption>Complex-plane checkpoint values</caption>
        <thead><tr><th>Quantity</th><th>Real part</th><th>Imaginary part</th><th>Magnitude</th></tr></thead>
        <tbody>
          <tr><th scope="row">Current vector</th><td>{{ format(result.vector.real) }}</td><td>{{ format(result.vector.imaginary) }}</td><td>{{ format(result.vector.magnitude) }}</td></tr>
          <tr><th scope="row">Squared magnitude</th><td colspan="2">phase-independent in complex mode</td><td>{{ format(result.vector.magnitude ** 2) }}</td></tr>
        </tbody>
      </table>
      <details v-if="props.depth === 'technical'" class="quantum-disclosure">
        <summary>Technical reading</summary>
         <p>Complex mode uses exp(-i k t), so the vector is (cos(k t), -sin(k t)). Real mode uses exp(gamma t) on the real axis. The two choices share an exponential-looking derivative but have different geometry and magnitude behavior.</p>
      </details>
      <p class="quantum-boundary">The complex plane is a mathematical representation. Its usefulness here comes from the model's transformation and its probability interpretation, not from calling imaginary coordinates directly observable.</p>
    </section>
  </article>
</template>

<style scoped>
.quantum-mode-switch { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.quantum-mode-switch button { min-height: 44px; padding: 0.7rem 0.9rem; color: var(--paper); font-family: var(--mono); border: 1px solid var(--rule-bright); background: transparent; cursor: pointer; }
.quantum-mode-switch button.is-selected { color: var(--ink-0); border-color: var(--cyan); background: var(--cyan); }
.complex-plane-instrument svg { display: block; width: 100%; height: auto; margin-top: 1.5rem; border: 1px solid var(--rule-bright); background: var(--ink-0); }
.complex-axis { stroke: var(--rule-bright); stroke-width: 1.2; }
.complex-path { fill: none; stroke: var(--amber-dark); stroke-width: 2; stroke-dasharray: 5 4; }
.complex-vector { stroke: var(--cyan); stroke-width: 3; }
.complex-dot { fill: var(--cyan); }
.complex-real-wave, .complex-imaginary-wave, .complex-magnitude-wave { fill: none; stroke-width: 2; }
.complex-real-wave { stroke: var(--cyan); }
.complex-imaginary-wave { stroke: #bca5ff; }
.complex-magnitude-wave { stroke: var(--amber); stroke-dasharray: 5 4; }
.complex-label { fill: var(--paper-dim); font-family: var(--mono); font-size: 11px; }
</style>
