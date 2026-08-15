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

<template lang="pug">
article.quantum-instrument.schrodinger-assembler(data-testid="quantum-schrodinger-assembler")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 06 / equation assembly
    h3 Assemble the energy rule from three jobs
    p Toggle the pieces on and off. This is a reading aid: it shows which part of the derivation contributes time, curvature, and local potential energy. The equation is not a magic label for every wave.
  .equation-parts
    label
      input(v-model="includeTime" type="checkbox" data-testid="equation-time")
      span
        strong Total energy
        small The time derivative, with i hbar, reads the energy content.
    label
      input(v-model="includeKinetic" type="checkbox" data-testid="equation-kinetic")
      span
        strong Kinetic energy
        small Spatial curvature supplies -(hbar^2 / 2m) d2/dx2.
    label
      input(v-model="includePotential" type="checkbox" data-testid="equation-potential")
      span
        strong Potential energy
        small V multiplies the local wave amplitude.
  figure.equation-assembly-figure
    .equation-assembly(:data-complete="complete")
      code {{ assembled.left }}
      span =
      code {{ assembled.right }}
    figcaption
      | Complete model form: 
      strong
        code i hbar d psi/dt = -(hbar^2/2m) d2 psi/dx2 + V psi
      | . 
      QuantumTooltip(term="potential" plain="Energy assigned locally by the model's environment." technical="A multiplication term V(x,t) in this one-dimensional teaching form; a full Hamiltonian can contain more structure." :depth="props.depth")
  dl.quantum-readout-grid
    div
      dt Time term
      dd {{ includeTime ? 'included' : 'missing' }}
    div
      dt Curvature term
      dd {{ includeKinetic ? 'included' : 'missing' }}
    div
      dt Potential term
      dd {{ includePotential ? 'included' : 'missing' }}
    div
      dt Status
      dd {{ complete ? 'complete teaching form' : 'partial expression' }}
  table
    caption Equation role map
    thead
      tr
        th Piece
        th Symbolic role
        th Plain-language job
    tbody
      tr
        th(scope="row") Time
        td i hbar d psi/dt
        td How the state changes in time
      tr
        th(scope="row") Kinetic
        td -(hbar^2/2m) d2 psi/dx2
        td How spatial curvature contributes energy
      tr
        th(scope="row") Potential
        td V psi
        td How the declared environment contributes locally
  details.quantum-disclosure(v-if="props.depth === 'technical'")
    summary Technical reading
    p This surface deliberately uses a one-dimensional, time-dependent, nonrelativistic form. It omits spin, electromagnetic gauge coupling, many-body terms, relativistic corrections, boundary conditions, and domain questions that a real Hamiltonian must specify.
  p.quantum-boundary Assembling the standard equation reproduces notation and a model structure. It does not independently derive the physical law or validate a theory.
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
