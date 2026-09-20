<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useTourProgress } from '../registries/tourProgress'
import TourDepthControl from '../components/tour/TourDepthControl.vue'
import QuantumTooltip from '../components/quantum/QuantumTooltip.vue'
import CliffordSpaceInstrument from '../components/clifford-space/CliffordSpaceInstrument.vue'
import {
  CLIFFORD_GUIDE_SECTIONS,
  CLIFFORD_LEARNING_PROMISE,
  CLIFFORD_RELATED_LINKS,
  CLIFFORD_SOURCE,
  CLIFFORD_TERMS,
} from '../clifford-space/cliffordSpaceGuide'
import type { ReadingDepth } from '../types/tour'

const progress = useTourProgress()
if (!progress.hydrated.value) progress.hydrate()

const depth = computed<ReadingDepth>(() => progress.depth.value)

const shortcutSteps = Object.freeze([
  Object.freeze({ label: 'Read', title: 'Field', body: 'Eight trigonometric blades on R³. Their Euclidean norm is 1 at every point.' }),
  Object.freeze({ label: 'Build', title: 'Cell', body: 'Integer cube corners carry the Cl(3) basis. Height-1/2 pyramids make a rhombic dodecahedron.' }),
  Object.freeze({ label: 'Tile', title: 'Honeycomb', body: 'Even-sum cubes and FCC half-points fill space. Apparent two-blade readouts are not surplus energy.' }),
])

onMounted(() => {
  document.title = 'Clifford Space Lab | OpenSimPhy Atlas'
})
</script>

<template lang="pug">
.quantum-lab-view.clifford-lab-view(data-testid="clifford-space-lab-ready")
  header.quantum-lab-header
    .quantum-lab-header__index
      span OpenSimPhy / Lab 00e
      span cube → dodecahedron → Cl(3) field
    .quantum-lab-header__copy
      p.eyebrow A geometric-algebra space tiling
      h1 What fills space around the unit cube?
      p.lede {{ CLIFFORD_LEARNING_PROMISE }}
      .quantum-lab-depth
        TourDepthControl
    aside.quantum-lab-header__source
      p.eyebrow modelled / computed
      h2 Cl(3) × rhombic dodecahedron
      p {{ CLIFFORD_SOURCE.note }}
      p Computation is not validation. validatesTheory: {{ CLIFFORD_SOURCE.validatesTheory }}

  .quantum-lab-promise
    strong Teacher's shortcut
    p Eight blades, one unit norm. The honeycomb is a cube-plus-pyramid tiling, not a source of extra energy.

  .quantum-lab-layout
    main.quantum-lab-main
      section.quantum-shortcut(aria-labelledby="clifford-shortcut-title")
        .quantum-shortcut__heading
          p.eyebrow The route / three moves
          h2#clifford-shortcut-title What this lab can actually compute
          p Use the 3D instrument once. The numbered notes name the geometry; they do not validate a field theory.
        .quantum-shortcut__steps
          article(v-for="step in shortcutSteps" :key="step.label")
            span {{ step.label }}
            h3 {{ step.title }}
            p {{ step.body }}
        details.quantum-disclosure.quantum-vocabulary
          summary Open the essential vocabulary
          dl
            template(v-for="term in CLIFFORD_TERMS" :key="term.term")
              dt {{ term.term }}
              dd {{ depth === 'technical' ? term.technical : term.plain }}

      section.quantum-lab-section(
        v-for="section in CLIFFORD_GUIDE_SECTIONS"
        :id="section.id"
        :key="section.id"
        :aria-labelledby="`${section.id}-heading`"
      )
        .quantum-lab-section__heading
          span {{ section.number }} / {{ section.id }}
          div
            h2(:id="`${section.id}-heading`") {{ section.title }}
            p
              strong Question:
              |  {{ section.question }}
            .quantum-lab-section__answer
              strong Short answer
              p {{ section.answer }}
            .quantum-lab-section__teacher-note
              strong Teacher note
              p {{ section.teacherNote }}
            p.quantum-lab-section__equation
              code {{ section.equation }}

      section#space-view.quantum-lab-section(aria-labelledby="space-view-heading")
        .quantum-lab-section__heading
          span 00e / space-view
          div
            h2#space-view-heading The unit cube and the honeycomb around it
            p Move the probe. The bars are the Cl(3) field at that point.
        CliffordSpaceInstrument(:depth="depth")

      section.quantum-related(aria-labelledby="clifford-related-title")
        .quantum-related__heading
          p.eyebrow Keep exploring
          h2#clifford-related-title Connect this tiling to the rest of OpenSimPhy
          p
            | Successful execution is not
            |
            QuantumTooltip(
              term="validation"
              plain="A stronger claim than successfully running a calculation."
              technical="An independent comparison protocol with calibrated inputs, held-out observables, uncertainty treatment, and acceptance criteria."
              :depth="depth"
            )
            | .
        .quantum-related-grid
          RouterLink(v-for="link in CLIFFORD_RELATED_LINKS" :key="link.to" :to="link.to")
            strong {{ link.label }}
            span {{ link.note }} →

      section.quantum-provenance(aria-label="Scope boundary")
        strong Scope boundary:
        |  {{ CLIFFORD_SOURCE.note }} The eight-component Euclidean norm stays 1. See
        |
        RouterLink(to="/evidence") Evidence
        |  and the
        |
        RouterLink(to="/labs") laboratories index
        |  for the project's claim vocabulary.

    aside.quantum-lab-rail(aria-label="Clifford space lab contents")
      span.quantum-lab-rail__label Instrument index
      nav
        a(href="#field") 01 / Field
        a(href="#cell") 02 / Cell
        a(href="#tiling") 03 / Tiling
        a(href="#space-view") 00e / Space view
      RouterLink.text-link(to="/labs") ← Back to all laboratories
</template>

<style src="../styles/quantum-wave.css"></style>
<style src="../styles/clifford-space.css"></style>
