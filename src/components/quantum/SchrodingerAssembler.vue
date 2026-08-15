<script setup lang="ts">
import { computed, ref } from 'vue'
import QuantumTooltip from './QuantumTooltip.vue'
import type { ReadingDepth } from '../../types/tour'

const props = defineProps<{ depth: ReadingDepth }>()

const includeTime = ref(true)
const includeKinetic = ref(true)
const includePotential = ref(true)

const assembled = computed(() => {
  const left = includeTime.value ? 'i hbar d psi / dt' : '...'
  const terms: string[] = []
  if (includeKinetic.value) terms.push('-(hbar^2 / 2m) d2 psi / dx2')
  if (includePotential.value) terms.push('V psi')
  return { left, right: terms.length ? terms.join(' + ') : '...' }
})

const complete = computed(() => includeTime.value && includeKinetic.value && includePotential.value)
</script>

<template>
  <article class="quantum-instrument schrodinger-assembler" data-testid="quantum-schrodinger-assembler">
    <header class="quantum-instrument__header">
       <p class="quantum-kicker">Instrument 06 / equation assembly</p>
      <h3>Assemble the energy rule from three jobs</h3>
      <p>
        Toggle the pieces on and off. This is a reading aid: it shows which part of the derivation contributes time,
        curvature, and local potential energy. The equation is not a magic label for every wave.
      </p>
    </header>
    <div class="equation-parts">
      <label><input v-model="includeTime" type="checkbox" data-testid="equation-time"><span><strong>Total energy</strong><small>The time derivative, with i hbar, reads the energy content.</small></span></label>
      <label><input v-model="includeKinetic" type="checkbox" data-testid="equation-kinetic"><span><strong>Kinetic energy</strong><small>Spatial curvature supplies -(hbar^2 / 2m) d2/dx2.</small></span></label>
      <label><input v-model="includePotential" type="checkbox" data-testid="equation-potential"><span><strong>Potential energy</strong><small>V multiplies the local wave amplitude.</small></span></label>
    </div>
    <figure class="equation-assembly-figure">
      <div class="equation-assembly" :data-complete="complete">
        <code>{{ assembled.left }}</code>
        <span>=</span>
        <code>{{ assembled.right }}</code>
      </div>
      <figcaption>
        Complete model form:
        <strong><code>i hbar d psi/dt = -(hbar^2/2m) d2 psi/dx2 + V psi</code></strong>.
        <QuantumTooltip term="potential" plain="Energy assigned locally by the model's environment." technical="A multiplication term V(x,t) in this one-dimensional teaching form; a full Hamiltonian can contain more structure." :depth="props.depth" />
      </figcaption>
    </figure>
    <dl class="quantum-readout-grid">
      <div><dt>Time term</dt><dd>{{ includeTime ? 'included' : 'missing' }}</dd></div>
      <div><dt>Curvature term</dt><dd>{{ includeKinetic ? 'included' : 'missing' }}</dd></div>
      <div><dt>Potential term</dt><dd>{{ includePotential ? 'included' : 'missing' }}</dd></div>
      <div><dt>Status</dt><dd>{{ complete ? 'complete teaching form' : 'partial expression' }}</dd></div>
    </dl>
    <table>
      <caption>Equation role map</caption>
      <thead><tr><th>Piece</th><th>Symbolic role</th><th>Plain-language job</th></tr></thead>
      <tbody>
        <tr><th scope="row">Time</th><td>i hbar d psi/dt</td><td>How the state changes in time</td></tr>
        <tr><th scope="row">Kinetic</th><td>-(hbar^2/2m) d2 psi/dx2</td><td>How spatial curvature contributes energy</td></tr>
        <tr><th scope="row">Potential</th><td>V psi</td><td>How the declared environment contributes locally</td></tr>
      </tbody>
    </table>
    <details v-if="props.depth === 'technical'" class="quantum-disclosure">
      <summary>Technical reading</summary>
      <p>This surface deliberately uses a one-dimensional, time-dependent, nonrelativistic form. It omits spin, electromagnetic gauge coupling, many-body terms, relativistic corrections, boundary conditions, and domain questions that a real Hamiltonian must specify.</p>
    </details>
    <p class="quantum-boundary">Assembling the standard equation reproduces notation and a model structure. It does not independently derive the physical law or validate a theory.</p>
  </article>
</template>

<style scoped>
.equation-parts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 1.25rem; gap: 1px; background: var(--rule); }
.equation-parts label { display: grid; min-height: 120px; padding: 0.9rem; grid-template-columns: 1.2rem minmax(0, 1fr); gap: 0.7rem; align-items: start; background: var(--ink-0); cursor: pointer; }
.equation-parts input { width: 1.15rem; height: 1.15rem; accent-color: var(--cyan); }
.equation-parts strong, .equation-parts small { display: block; }
.equation-parts strong { color: var(--amber); font-family: var(--mono); font-size: 0.76rem; text-transform: uppercase; }
.equation-parts small { margin-top: 0.55rem; color: var(--paper-dim); font-family: var(--serif); font-size: 0.9rem; line-height: 1.45; }
.equation-assembly-figure { margin: 1.5rem 0 0; }
.equation-assembly { display: grid; min-height: 150px; padding: 1.5rem; grid-template-columns: minmax(0, 0.8fr) auto minmax(0, 1.6fr); gap: 1rem; align-items: center; color: var(--ink-0); border: 1px solid #a89a7e; background: var(--paper); }
.equation-assembly code { overflow-wrap: anywhere; font-family: var(--serif); font-size: clamp(1.1rem, 2.6vw, 2.2rem); line-height: 1.3; }
.equation-assembly span { font-family: var(--mono); font-size: 1.4rem; }
.equation-assembly[data-complete='true'] { box-shadow: inset 0 -4px var(--green); }
.equation-assembly-figure figcaption { padding: 0.8rem 0; color: var(--paper-dim); font-family: var(--serif); line-height: 1.55; }
.equation-assembly-figure figcaption code { color: var(--cyan); }
@media (max-width: 700px) { .equation-parts { grid-template-columns: 1fr; } .equation-assembly { grid-template-columns: 1fr; gap: 0.4rem; } }
</style>
