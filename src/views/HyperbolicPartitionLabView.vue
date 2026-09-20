<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useTourProgress } from '../registries/tourProgress'
import TourDepthControl from '../components/tour/TourDepthControl.vue'
import ComputePrompt from '../components/compute/ComputePrompt.vue'
import { labeledComputeContext } from '../compute/context'
import QuantumTooltip from '../components/quantum/QuantumTooltip.vue'
import HyperbolicPartitionInstrument from '../components/hyperbolic-partition/HyperbolicPartitionInstrument.vue'
import {
  PARTITION_GUIDE_SECTIONS,
  PARTITION_LEARNING_PROMISE,
  PARTITION_RELATED_LINKS,
  PARTITION_SOURCE,
  PARTITION_TERMS,
} from '../hyperbolic-partition/partitionGuide'
import type { ReadingDepth } from '../types/tour'

const progress = useTourProgress()
if (!progress.hydrated.value) progress.hydrate()

const depth = computed<ReadingDepth>(() => progress.depth.value)
const computeContext = labeledComputeContext(
  'hyperbolic-partition',
  'Hyperbolic partition lab',
  'Prompt evaluations are local SI/Planck calculations beside the quartic explorer.',
)

const shortcutSteps = Object.freeze([
  Object.freeze({ label: 'Solve', title: 'Roots', body: 'Four sheets of T_a(x)=0. Vieta keeps the ledger closed for every a.' }),
  Object.freeze({ label: 'Normalize', title: 'Möbius', body: 'Send three roots to ∞, 0, 1. The fourth point is the cross-ratio λ.' }),
  Object.freeze({ label: 'Loop', title: 'Monodromy', body: 'Walk around ±a₁ or ±b₁ and two sheets swap. That is ramification, not extra energy.' }),
])

onMounted(() => {
  document.title = 'Hyperbolic Partition Lab | OpenSimPhy Atlas'
})
</script>

<template lang="pug">
.quantum-lab-view.partition-lab-view(data-testid="hyperbolic-partition-lab-ready")
  header.quantum-lab-header
    .quantum-lab-header__index
      span OpenSimPhy / Lab 00f
      span quartic → Möbius → tetrahedron
    .quantum-lab-header__copy
      p.eyebrow A four-root cover of the a-sphere
      h1 How do four roots of T_a become an ideal tetrahedron?
      p.lede {{ PARTITION_LEARNING_PROMISE }}
      .quantum-lab-depth
        TourDepthControl
    aside.quantum-lab-header__source
      p.eyebrow modelled / computed
      h2 Quartic → ideal tetrahedron
      p {{ PARTITION_SOURCE.note }}
      p Computation is not validation. validatesTheory: {{ PARTITION_SOURCE.validatesTheory }}

  .quantum-lab-promise
    strong Teacher's shortcut
    p Four roots, one Vieta ledger. 24 Möbius charts, six λ. Apparent single-root displays are not a source of extra energy.

  .quantum-lab-layout
    main.quantum-lab-main
      section.quantum-shortcut(aria-labelledby="partition-shortcut-title")
        .quantum-shortcut__heading
          p.eyebrow The route / three moves
          h2#partition-shortcut-title What this lab can actually compute
          p Use the explorer once. The numbered notes name the cover; they do not validate a mass-gap theory.
        .quantum-shortcut__steps
          article(v-for="step in shortcutSteps" :key="step.label")
            span {{ step.label }}
            h3 {{ step.title }}
            p {{ step.body }}
        details.quantum-disclosure.quantum-vocabulary
          summary Open the essential vocabulary
          dl
            template(v-for="term in PARTITION_TERMS" :key="term.term")
              dt {{ term.term }}
              dd {{ depth === 'technical' ? term.technical : term.plain }}

      section.quantum-lab-section(
        v-for="section in PARTITION_GUIDE_SECTIONS"
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

      section#explorer.quantum-lab-section(aria-labelledby="explorer-heading")
        .quantum-lab-section__heading
          span 00f / explorer
          div
            h2#explorer-heading Quartic to ideal tetrahedron
            p Move a. The four roots, the 24 Möbius charts, and the branch loops are the same polynomial.
        HyperbolicPartitionInstrument(:depth="depth")

      ComputePrompt(:context="computeContext")

      section.quantum-related(aria-labelledby="partition-related-title")
        .quantum-related__heading
          p.eyebrow Keep exploring
          h2#partition-related-title Connect this cover to the rest of OpenSimPhy
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
          RouterLink(v-for="link in PARTITION_RELATED_LINKS" :key="link.to" :to="link.to")
            strong {{ link.label }}
            span {{ link.note }} →

      section.quantum-provenance(aria-label="Scope boundary")
        strong Scope boundary:
        |  {{ PARTITION_SOURCE.note }} Vieta stays closed. See
        |
        RouterLink(to="/evidence") Evidence
        |  and the
        |
        RouterLink(to="/labs") laboratories index
        |  for the project's claim vocabulary.

    aside.quantum-lab-rail(aria-label="Hyperbolic partition lab contents")
      span.quantum-lab-rail__label Instrument index
      nav
        a(href="#quartic") 01 / Quartic
        a(href="#mobius") 02 / Möbius
        a(href="#monodromy") 03 / Monodromy
        a(href="#explorer") 00f / Explorer
      RouterLink.text-link(to="/labs") ← Back to all laboratories
</template>

<style src="../styles/quantum-wave.css"></style>
<style src="../styles/hyperbolic-partition.css"></style>
