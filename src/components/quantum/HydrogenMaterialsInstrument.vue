<script setup lang="ts">
import { computed, ref } from 'vue'
import QuantumTooltip from './QuantumTooltip.vue'
import { evaluateHydrogenMaterials, type HydrogenMaterialsResult, type OrbitalMode } from '../../quantum-wave/quantumWaveEngine'
import type { ReadingDepth } from '../../types/tour'

const props = defineProps<{ depth: ReadingDepth }>()

const mode = ref<OrbitalMode>('1s')
const bandGapEv = ref(1.1)
const error = ref('')

const result = computed<HydrogenMaterialsResult | null>(() => {
  try {
    error.value = ''
    return evaluateHydrogenMaterials({ mode: mode.value, bandGapEv: bandGapEv.value })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    return null
  }
})

function orbitalX(x: number): number { return 42 + (x + 2) / 4 * 270 }
function orbitalY(y: number): number { return 180 - (y + 2) / 4 * 170 }
function potentialX(x: number): number { return 390 + (x + 3) / 6 * 315 }
function potentialY(y: number): number { return 195 - Math.max(-4, Math.min(0, y)) / -4 * 150 }
function bandY(y: number): number { return 230 - y * 180 }
function format(value: number, digits = 4): string { return Number(value.toPrecision(digits)).toString() }
</script>

<template>
  <article class="quantum-instrument hydrogen-materials-instrument" data-testid="quantum-hydrogen-materials-instrument">
    <header class="quantum-instrument__header">
       <p class="quantum-kicker">Instrument 08 / hydrogen to materials</p>
      <h3>Follow a probability shape into an application</h3>
      <p>
        Switch between a 1s slice, a 2p slice, and a schematic band gap. An
        <QuantumTooltip term="orbital" plain="A probability-density pattern for a quantum state, not a tiny track." technical="A spatial state or density derived from a Hamiltonian and its boundary conditions." :depth="props.depth" />
        can organize what a model predicts without pretending that the picture is a direct photograph.
      </p>
    </header>
    <div class="quantum-controls quantum-controls--two">
      <label>
        <span>Application view</span>
        <select v-model="mode" data-testid="materials-mode">
          <option value="1s">Hydrogen-like 1s slice</option>
          <option value="2p">Hydrogen-like 2p slice</option>
          <option value="bands">Semiconductor band sketch</option>
        </select>
      </label>
      <label>
        <span>Band gap (used in band view)</span>
         <input v-model.number="bandGapEv" :disabled="mode !== 'bands'" type="range" min="0.1" max="3" step="0.05" data-testid="materials-band-gap">
        <output>{{ format(bandGapEv) }} eV</output>
      </label>
    </div>

    <section v-if="result" class="quantum-result" data-testid="materials-result">
      <figure>
        <svg viewBox="0 0 760 300" role="img" aria-labelledby="materials-title materials-description">
          <title id="materials-title">Orbital probability slice and material energy diagram</title>
          <desc id="materials-description">The left panel shows a 2-D probability-density slice. The right panel shows a Coulomb-like potential and, when selected, a schematic band gap.</desc>
          <rect class="materials-panel" x="20" y="20" width="315" height="215" />
          <g v-if="mode !== 'bands'">
            <circle v-for="point in result.orbital" :key="`${point.x}-${point.y}`" :cx="orbitalX(point.x)" :cy="orbitalY(point.y)" r="3.5" :fill="mode === '1s' ? 'var(--cyan)' : 'var(--amber)'" :fill-opacity="0.08 + point.probability * 0.88" />
          </g>
          <text class="materials-label" x="42" y="52">probability density / slice</text>
          <text class="materials-label" x="42" y="255">x</text>
          <text class="materials-label" x="22" y="40">y</text>
          <line class="materials-axis" x1="390" x2="705" y1="195" y2="195" />
          <line class="materials-axis" x1="390" x2="390" y1="30" y2="195" />
          <polyline class="materials-potential" :points="result.potential.map((point) => `${potentialX(point.x)},${potentialY(point.y)}`).join(' ')" />
          <g v-if="mode === 'bands'">
            <rect v-for="band in result.bands" :key="band.kind" class="materials-band" :class="`is-${band.kind}`" x="510" :y="bandY(band.y)" width="150" :height="Math.max(8, band.height * 180)" />
            <text v-for="band in result.bands" :key="`${band.kind}-label`" class="materials-label" x="665" :y="bandY(band.y) + 12">{{ band.label }}</text>
          </g>
          <text class="materials-label" x="395" y="218">Coulomb-like V(r)</text>
          <text class="materials-label" x="510" y="35">schematic states</text>
        </svg>
        <figcaption>
          {{ mode === 'bands' ? 'The band drawing is schematic: the gap is a control for teaching, not a measured material property.' : 'Bright regions mean larger modeled probability density in this 2-D slice; they are not paths or little clouds of charge.' }}
        </figcaption>
      </figure>
      <dl class="quantum-readout-grid">
        <div><dt>View</dt><dd>{{ result.mode }}</dd></div>
        <div><dt>Band gap</dt><dd>{{ format(result.bandGapEv) }} eV</dd></div>
        <div><dt>Potential</dt><dd>V proportional to -1/r</dd></div>
        <div><dt>Output status</dt><dd>schematic model</dd></div>
      </dl>
      <p class="quantum-finding" role="status">{{ result.finding }}</p>
      <table>
        <caption>Interpretation ledger</caption>
        <thead><tr><th>Panel</th><th>What the drawing means</th><th>What it does not mean</th></tr></thead>
        <tbody>
          <tr><th scope="row">Orbital slice</th><td>Relative probability density of a selected idealized state</td><td>An electron trajectory or complete 3-D solution</td></tr>
          <tr><th scope="row">Potential</th><td>A Coulomb-like input shape</td><td>A full atom, screening calculation, or measured potential</td></tr>
          <tr><th scope="row">Band sketch</th><td>Filled and available energy regions separated by a declared gap</td><td>A material prediction without lattice and interaction data</td></tr>
        </tbody>
      </table>
      <details v-if="props.depth === 'technical'" class="quantum-disclosure">
        <summary>Technical reading</summary>
        <p>The 1s and 2p panels are normalized 2-D slices of simplified analytic shapes. A real orbital calculation requires a Hamiltonian, boundary conditions, quantum numbers, and normalization over the declared domain. The band panel is a pedagogical abstraction rather than a density-functional or tight-binding calculation.</p>
      </details>
      <p class="quantum-boundary">Applications inherit the assumptions of the model that produced them. A memorable picture is not the same thing as an independently measured observable.</p>
    </section>
    <p v-if="error" class="quantum-error" role="alert">{{ error }}</p>
  </article>
</template>

<style scoped>
.hydrogen-materials-instrument svg { display: block; width: 100%; height: auto; margin-top: 1.5rem; border: 1px solid var(--rule-bright); background: var(--ink-0); }
.materials-panel { fill: var(--ink-1); stroke: var(--rule-bright); }
.materials-axis { stroke: var(--rule-bright); stroke-width: 1.5; }
.materials-potential { fill: none; stroke: var(--cyan); stroke-width: 2.5; }
.materials-band { stroke: var(--paper); stroke-width: 1; }
.materials-band.is-valence { fill: var(--cyan); }
.materials-band.is-gap { fill: var(--amber-dark); }
.materials-band.is-conduction { fill: var(--amber); }
.materials-label { fill: var(--paper-dim); font-family: var(--mono); font-size: 10px; }
</style>
