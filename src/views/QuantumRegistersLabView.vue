<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useTourProgress } from '../registries/tourProgress'
import TourDepthControl from '../components/tour/TourDepthControl.vue'
import ComputeEmbed from '../components/compute/ComputeEmbed.vue'
import QuantumTooltip from '../components/quantum/QuantumTooltip.vue'
import MajorityPhaseInstrument from '../components/quantum-registers/MajorityPhaseInstrument.vue'
import BitRegisterInstrument from '../components/quantum-registers/BitRegisterInstrument.vue'
import HierarchyInstrument from '../components/quantum-registers/HierarchyInstrument.vue'
import HandshakeInstrument from '../components/quantum-registers/HandshakeInstrument.vue'
import HilbertBoundInstrument from '../components/quantum-registers/HilbertBoundInstrument.vue'
import UniverseTickInstrument from '../components/quantum-registers/UniverseTickInstrument.vue'
import {
  REGISTER_GUIDE_SECTIONS,
  REGISTER_HYPOTHESIS,
  REGISTER_LEARNING_PROMISE,
  REGISTER_RELATED_LINKS,
  REGISTER_TERMS,
} from '../quantum-registers/quantumRegisterGuide'
import type { ReadingDepth } from '../types/tour'

const progress = useTourProgress()
if (!progress.hydrated.value) progress.hydrate()

const depth = computed<ReadingDepth>(() => progress.depth.value)
const instrumentComponents = {
  'majority-phase': MajorityPhaseInstrument,
  'bit-register':   BitRegisterInstrument,
  hierarchy:        HierarchyInstrument,
  handshake:        HandshakeInstrument,
  'hilbert-bound':  HilbertBoundInstrument,
  'universe-tick':  UniverseTickInstrument,
} as const

function instrumentFor(moduleId: string) {
  return instrumentComponents[moduleId as keyof typeof instrumentComponents]
}

const shortcutSteps = Object.freeze([
  Object.freeze({ label: 'Flip', title: '137 coins', body: 'Odd width cannot tie. Majority phase is the next step.' }),
  Object.freeze({ label: 'Align', title: 'Match', body: 'A second 137-bit phase commits the step if ≥69 bits agree.' }),
  Object.freeze({ label: 'Store', title: 'Word', body: 'Operate on ≤137 bits. Do not allocate 2^137 amplitudes.' }),
  Object.freeze({ label: 'Count', title: '3+7+127', body: '137 is also a combinatorial sum. 1/137 is a label, not QED.' }),
  Object.freeze({ label: 'Refuse', title: 'Hilbert', body: 'n ≤ 8 may show a toy vector. n = 137 is refused.' }),
])

onMounted(() => {
  document.title = 'Quantum Register Lab | OpenSimPhy Atlas'
})
</script>

<template lang="pug">
.quantum-lab-view(data-testid="quantum-registers-lab-ready")
  header.quantum-lab-header
    .quantum-lab-header__index
      span OpenSimPhy / Lab 00a
      span hypothesis → majority vote → next step
    .quantum-lab-header__copy
      p.eyebrow An unpublished register-interaction hypothesis
      h1 Why 137 coins?
      p.lede {{ REGISTER_LEARNING_PROMISE }}
      .quantum-lab-depth
        TourDepthControl
    aside.quantum-lab-header__source
      p.eyebrow {{ REGISTER_HYPOTHESIS.status }}
      h2 {{ REGISTER_HYPOTHESIS.author }}
      p {{ REGISTER_HYPOTHESIS.talk }}. Public essay analog: offer/confirm selection. Combinatorial 137 is a published counting comparison, not that essay.
      a(:href="REGISTER_HYPOTHESIS.publicEssay" target="_blank" rel="noreferrer") {{ REGISTER_HYPOTHESIS.publicEssayTitle }}

  .quantum-lab-promise
    strong Hypothesis shortcut
    p Flip 137 coins. The majority phase is the next step. Alignment of two 137-bit phases commits that step when at least 69 bits match. Fair coins remain a random walk.

  .quantum-lab-layout
    main.quantum-lab-main
      section.quantum-shortcut(aria-labelledby="register-shortcut-title")
        .quantum-shortcut__heading
          p.eyebrow The route / five moves
          h2#register-shortcut-title What this lab can actually compute
          p Each instrument names a method. None of them validates the talk.
        .quantum-shortcut__steps
          article(v-for="step in shortcutSteps" :key="step.label")
            span {{ step.label }}
            h3 {{ step.title }}
            p {{ step.body }}
        details.quantum-disclosure.quantum-vocabulary
          summary Open the essential vocabulary
          dl
            template(v-for="term in REGISTER_TERMS" :key="term.term")
              dt {{ term.term }}
              dd {{ depth === 'technical' ? term.technical : term.plain }}

      section.quantum-lab-section(
        v-for="section in REGISTER_GUIDE_SECTIONS"
        :id="section.moduleId"
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
        component(:is="instrumentFor(section.moduleId)" :depth="depth")

      ComputeEmbed(source-id="quantum-registers" source-label="Quantum register lab" beside="the register instruments")

      section.quantum-related(aria-labelledby="register-related-title")
        .quantum-related__heading
          p.eyebrow Keep exploring
          h2#register-related-title Connect this hypothesis to established instruments
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
          RouterLink(v-for="link in REGISTER_RELATED_LINKS" :key="link.to" :to="link.to")
            strong {{ link.label }}
            span {{ link.note }} →

      section.quantum-provenance(aria-label="Scope boundary")
        strong Scope boundary:
        |  Moog has not published this register construction. The lead method is 137 coin flips whose majority phase is the next step. Other instruments are named comparison methods. This page does not claim that physics laws appear at 137 bits. See
        |
        RouterLink(to="/evidence") Evidence
        |  and the
        |
        RouterLink(to="/labs/quantum-wave") quantum wave lab
        |  for the established teaching path.

    aside.quantum-lab-rail(aria-label="Quantum register lab contents")
      span.quantum-lab-rail__label Instrument index
      nav
        a(href="#majority-phase") 01 / Majority
        a(href="#bit-register") 02 / Registers
        a(href="#hierarchy") 03 / Hierarchy
        a(href="#handshake") 04 / Handshake
        a(href="#hilbert-bound") 05 / Hilbert bound
        a(href="#universe-tick") 06 / Universe ticks
      RouterLink.text-link(to="/labs") ← Back to all laboratories
</template>

<style src="../styles/quantum-wave.css"></style>
<style src="../styles/quantum-registers.css"></style>
