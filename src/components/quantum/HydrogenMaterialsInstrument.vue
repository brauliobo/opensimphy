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

<template lang="pug">
article.quantum-instrument.hydrogen-materials-instrument(data-testid="quantum-hydrogen-materials-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 08 / hydrogen to materials
    h3 Follow a probability shape into an application
    p Switch between a 1s slice, a 2p slice, and a schematic band gap. An #[QuantumTooltip(term="orbital" plain="A probability-density pattern for a quantum state, not a tiny track." technical="A spatial state or density derived from a Hamiltonian and its boundary conditions." :depth="props.depth")] can organize what a model predicts without pretending that the picture is a direct photograph.
  .quantum-controls.quantum-controls--two
    label
      span Application view
      select(v-model="mode" data-testid="materials-mode")
        option(value="1s") Hydrogen-like 1s slice
        option(value="2p") Hydrogen-like 2p slice
        option(value="bands") Semiconductor band sketch
    label
      span Band gap (used in band view)
      input(v-model.number="bandGapEv" :disabled="mode !== 'bands'" type="range" min="0.1" max="3" step="0.05" data-testid="materials-band-gap")
      output {{ format(bandGapEv) }} eV

  section.quantum-result(v-if="result" data-testid="materials-result")
    figure
      svg(viewBox="0 0 760 300" role="img" aria-labelledby="materials-title materials-description")
        title#materials-title Orbital probability slice and material energy diagram
        desc#materials-description The left panel shows a 2-D probability-density slice. The right panel shows a Coulomb-like potential and, when selected, a schematic band gap.
        rect.materials-panel(x="20" y="20" width="315" height="215")
        g(v-if="mode !== 'bands'")
          circle(v-for="point in result.orbital" :key="`${point.x}-${point.y}`" :cx="orbitalX(point.x)" :cy="orbitalY(point.y)" r="3.5" :fill="mode === '1s' ? 'var(--cyan)' : 'var(--amber)'" :fill-opacity="0.08 + point.probability * 0.88")
        text.materials-label(x="42" y="52") probability density / slice
        text.materials-label(x="42" y="255") x
        text.materials-label(x="22" y="40") y
        line.materials-axis(x1="390" x2="705" y1="195" y2="195")
        line.materials-axis(x1="390" x2="390" y1="30" y2="195")
        polyline.materials-potential(:points="result.potential.map((point) => `${potentialX(point.x)},${potentialY(point.y)}`).join(' ')")
        g(v-if="mode === 'bands'")
          rect.materials-band(v-for="band in result.bands" :key="band.kind" :class="`is-${band.kind}`" x="510" :y="bandY(band.y)" width="150" :height="Math.max(8, band.height * 180)")
          text.materials-label(v-for="band in result.bands" :key="`${band.kind}-label`" x="665" :y="bandY(band.y) + 12") {{ band.label }}
        text.materials-label(x="395" y="218") Coulomb-like V(r)
        text.materials-label(x="510" y="35") schematic states
      figcaption {{ mode === 'bands' ? 'The band drawing is schematic: the gap is a control for teaching, not a measured material property.' : 'Bright regions mean larger modeled probability density in this 2-D slice; they are not paths or little clouds of charge.' }}
    dl.quantum-readout-grid
      div
        dt View
        dd {{ result.mode }}
      div
        dt Band gap
        dd {{ format(result.bandGapEv) }} eV
      div
        dt Potential
        dd V proportional to -1/r
      div
        dt Output status
        dd schematic model
    p.quantum-finding(role="status") {{ result.finding }}
    table
      caption Interpretation ledger
      thead
        tr
          th Panel
          th What the drawing means
          th What it does not mean
      tbody
        tr
          th(scope="row") Orbital slice
          td Relative probability density of a selected idealized state
          td An electron trajectory or complete 3-D solution
        tr
          th(scope="row") Potential
          td A Coulomb-like input shape
          td A full atom, screening calculation, or measured potential
        tr
          th(scope="row") Band sketch
          td Filled and available energy regions separated by a declared gap
          td A material prediction without lattice and interaction data
    details.quantum-disclosure(v-if="props.depth === 'technical'")
      summary Technical reading
      p The 1s and 2p panels are normalized 2-D slices of simplified analytic shapes. A real orbital calculation requires a Hamiltonian, boundary conditions, quantum numbers, and normalization over the declared domain. The band panel is a pedagogical abstraction rather than a density-functional or tight-binding calculation.
    p.quantum-boundary Applications inherit the assumptions of the model that produced them. A memorable picture is not the same thing as an independently measured observable.
  p.quantum-error(v-if="error" role="alert") {{ error }}
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
