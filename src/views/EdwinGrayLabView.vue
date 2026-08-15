<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useTourProgress } from '../registries/tourProgress'
import TourDepthControl from '../components/tour/TourDepthControl.vue'
import GeometryInstrument from '../components/edwin-gray/GeometryInstrument.vue'
import CircuitInstrument from '../components/edwin-gray/CircuitInstrument.vue'
import PulseCycleInstrument from '../components/edwin-gray/PulseCycleInstrument.vue'
import EnergyLedgerInstrument from '../components/edwin-gray/EnergyLedgerInstrument.vue'
import FamilyInstrument from '../components/edwin-gray/FamilyInstrument.vue'
import {
  GRAY_FEM_PROVENANCE,
  GRAY_GUIDE_SECTIONS,
  GRAY_LEARNING_PROMISE,
  GRAY_RELATED_LINKS,
  GRAY_TERMS,
  GRAY_VIDEO,
  GRAY_VIDEO_TIMELINE,
} from '../edwin-gray/edwinGrayGuide'
import type { ReadingDepth } from '../types/tour'

const progress = useTourProgress()
if (!progress.hydrated.value) progress.hydrate()

const depth = computed<ReadingDepth>(() => progress.depth.value)
const videoActivated = ref(false)
const instrumentComponents = {
  geometry: GeometryInstrument,
  circuit: CircuitInstrument,
  pulse: PulseCycleInstrument,
  energy: EnergyLedgerInstrument,
  family: FamilyInstrument,
} as const

const shortcutSteps = Object.freeze([
  Object.freeze({ label: 'Name', title: 'Topology', body: 'Start with the patent-described 9 stator / 3 rotor station layout.' }),
  Object.freeze({ label: 'Switch', title: 'Schedule', body: 'Charge, pulse-charge, then follow the 27-event sector schedule.' }),
  Object.freeze({ label: 'Break', title: 'Arc', body: 'Use the presenter-reported 500 rpm reference without treating it as universal.' }),
  Object.freeze({ label: 'Count', title: 'Ledger', body: 'Put capacitor energy into R, spark, torque, and recovery.' }),
  Object.freeze({ label: 'Compare', title: 'Prototypes', body: 'Compare later colored evidence claims without rewriting the patent topology.' }),
])

function videoAt(seconds: number): string {
  return `${GRAY_VIDEO.url}&t=${seconds}s`
}

function activateVideo(): void {
  videoActivated.value = true
}

onMounted(() => {
  document.title = 'Edwin Gray Motor Lab | OpenSimPhy Atlas'
})
</script>

<template lang="pug">
.quantum-lab-view(data-testid="edwin-gray-lab-ready")
  header.quantum-lab-header
    .quantum-lab-header__index
      span OpenSimPhy / Lab 05
      span source → model → simulation
    .quantum-lab-header__copy
      p.eyebrow A reconstruction of the Gray pulsed-capacitor motors
      h1 What did the purple motor actually switch?
      p.lede {{ GRAY_LEARNING_PROMISE }}
      .quantum-lab-depth
        TourDepthControl
    aside.quantum-lab-header__source
      p.eyebrow Reference media / {{ GRAY_VIDEO.duration }}
      h2 {{ GRAY_VIDEO.title }}
      p Uploader: {{ GRAY_VIDEO.uploader }}. Uploaded {{ GRAY_VIDEO.uploaded }}. Local notes live in {{ GRAY_VIDEO.transcript }}. Historical COP 300 remains a source-claim.
      a(:href="GRAY_VIDEO.url" target="_blank" rel="noreferrer") Open the original video on YouTube

  .quantum-lab-promise
    strong Teacher's shortcut
    p Do not treat "cold electricity" as a second Maxwell term. Establish the patent topology, schedule the participating sectors, quench an arc, and keep the energy ledger classical.

  .quantum-lab-layout
    main.quantum-lab-main
      section.quantum-shortcut(aria-labelledby="gray-shortcut-title")
        .quantum-shortcut__heading
          p.eyebrow The route / five moves
          h2#gray-shortcut-title A shorter explanation than the talk
          p Use the numbered instruments below in order. Each one answers one question and leaves its assumptions visible.
        .quantum-shortcut__steps
          article(v-for="step in shortcutSteps" :key="step.label")
            span {{ step.label }}
            h3 {{ step.title }}
            p {{ step.body }}
        details.quantum-disclosure.quantum-vocabulary
          summary Open the essential vocabulary
          dl
            template(v-for="term in GRAY_TERMS" :key="term.term")
              dt {{ term.term }}
              dd {{ depth === 'technical' ? term.technical : term.plain }}

      section.quantum-lab-section(
        v-for="section in GRAY_GUIDE_SECTIONS"
        :id="section.moduleId ?? section.id"
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
            p.gray-evidence-label
              strong {{ section.evidenceLabel }}
            p.gray-assumption-label
              strong {{ section.assumptionLabel }}
            .quantum-lab-section__answer
              strong Short answer
              p {{ section.answer }}
            .quantum-lab-section__teacher-note
              strong Teacher note
              p {{ section.teacherNote }}
            p.quantum-lab-section__equation
              code {{ section.equation }}
        component(
          :is="section.moduleId ? instrumentComponents[section.moduleId as keyof typeof instrumentComponents] : undefined"
          v-if="section.moduleId"
          :depth="depth"
        )

      section#gray-source-map.quantum-source-map(aria-labelledby="gray-source-map-title")
        .quantum-source-map__heading
          p.eyebrow Media / talk sequence
          h2#gray-source-map-title The frame map behind this lab
          p Every card is a checkpoint from the source talk and the local transcript. The app redraws the machines in SVG instead of copying video frames.
        .quantum-timeline
          a(v-for="entry in GRAY_VIDEO_TIMELINE" :key="entry.id" :href="videoAt(entry.seconds)" target="_blank" rel="noreferrer")
            time(:datetime="`PT${entry.seconds}S`") {{ entry.timestamp }}
            strong {{ entry.title }}
            small
              | {{ entry.frame }}
              br
              | {{ entry.lesson }}
            small Open source timestamp ↗
        details.quantum-media
          summary Optional source video player
          .gray-video-gate(v-if="!videoActivated")
            p The external player is unloaded until you explicitly activate it.
            button(type="button" data-testid="gray-video-activate" @click="activateVideo") Load external video
          .quantum-media__frame(v-else)
            iframe(
              :src="`https://www.youtube-nocookie.com/embed/${GRAY_VIDEO.id}?rel=0`"
              title="Reference video: Ed Gray purple motor presentation"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            )
          p(role="status" aria-live="polite") {{ videoActivated ? 'External YouTube player loaded by user request.' : 'External YouTube player is not loaded.' }} Close it for an entirely local lesson; the five instruments run without a network request.
        p.quantum-provenance
          strong Reproducibility note.
          |  Transcript: {{ GRAY_VIDEO.transcript }}. Downloaded media, when present: {{ GRAY_VIDEO.downloadedSource }}.

      section.gray-fem-card(aria-labelledby="gray-fem-title" data-testid="gray-fem-status")
        div
          p.eyebrow Local finite-element workspace
          h2#gray-fem-title FEM status: {{ GRAY_FEM_PROVENANCE.status }}
          p {{ GRAY_FEM_PROVENANCE.solverBoundary }} The browser instruments use the bounded classical engine, not an FEM result.
        .gray-fem-card__links
          a(:href="GRAY_FEM_PROVENANCE.workspace" target="_blank" rel="noreferrer") Open fem/edwin-gray provenance
          a(:href="GRAY_FEM_PROVENANCE.sourceLedger" target="_blank" rel="noreferrer") Open source ledger

      section.quantum-related(aria-labelledby="gray-related-title")
        .quantum-related__heading
          p.eyebrow Keep exploring
          h2#gray-related-title Connect this reconstruction to the rest of OpenSimPhy
          p Running the ledger is a computation, not empirical validation of Gray’s claims.
        .quantum-related-grid
          RouterLink(v-for="link in GRAY_RELATED_LINKS" :key="link.to" :to="link.to")
            strong {{ link.label }}
            span {{ link.note }} →

      section.quantum-provenance(aria-label="Scope boundary")
        strong Scope boundary:
        |  these are original, bounded teaching models of a pulsed-capacitor open-core machine. They do not establish over-unity, cold electricity, or a radiant force. See 
        RouterLink(to="/evidence") Evidence
        |  for claim vocabulary.

    aside.quantum-lab-rail(aria-label="Edwin Gray lab contents")
      span.quantum-lab-rail__label Instrument index
      nav
        a(href="#geometry") 01 / Patent topology
        a(href="#circuit") 02 / Circuit
        a(href="#pulse") 03 / Pulse
        a(href="#energy") 04 / Energy
        a(href="#family") 05 / Colored comparisons
        a(href="#gray-source-map") Media / Frame map
      RouterLink.text-link(to="/labs") ← Back to all laboratories
</template>

<style src="../styles/quantum-wave.css"></style>
<style src="../styles/edwin-gray.css"></style>
