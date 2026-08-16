<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useTourProgress } from '../registries/tourProgress'
import TourDepthControl from '../components/tour/TourDepthControl.vue'
import QuantumTooltip from '../components/quantum/QuantumTooltip.vue'
import SpectrumInstrument from '../components/quantum/SpectrumInstrument.vue'
import StandingWaveInstrument from '../components/quantum/StandingWaveInstrument.vue'
import OperatorInstrument from '../components/quantum/OperatorInstrument.vue'
import FourierInstrument from '../components/quantum/FourierInstrument.vue'
import ComplexPlaneInstrument from '../components/quantum/ComplexPlaneInstrument.vue'
import SchrodingerAssembler from '../components/quantum/SchrodingerAssembler.vue'
import ProbabilityInstrument from '../components/quantum/ProbabilityInstrument.vue'
import HydrogenMaterialsInstrument from '../components/quantum/HydrogenMaterialsInstrument.vue'
import {
  QUANTUM_GUIDE_SECTIONS,
  QUANTUM_LEARNING_PROMISE,
  QUANTUM_RELATED_LINKS,
  QUANTUM_TERMS,
  QUANTUM_VIDEO,
  QUANTUM_VIDEO_TIMELINE,
} from '../quantum-wave/quantumWaveGuide'
import type { ReadingDepth } from '../types/tour'

const progress = useTourProgress()
if (!progress.hydrated.value) progress.hydrate()

const depth = computed<ReadingDepth>(() => progress.depth.value)
const instrumentComponents = {
  'spectral-lines': SpectrumInstrument,
  'standing-wave': StandingWaveInstrument,
  'operator-lab': OperatorInstrument,
  'fourier-composer': FourierInstrument,
  'complex-plane': ComplexPlaneInstrument,
  'schrodinger-equation': SchrodingerAssembler,
  'probability-wave': ProbabilityInstrument,
  'hydrogen-materials': HydrogenMaterialsInstrument,
} as const

function instrumentFor(moduleId: string | undefined) {
  return moduleId ? instrumentComponents[moduleId as keyof typeof instrumentComponents] : undefined
}

const shortcutSteps = Object.freeze([
  Object.freeze({ label: 'Observe', title: 'Lines', body: 'Start with what a spectrometer records.' }),
  Object.freeze({ label: 'Construct', title: 'Waves', body: 'Use standing waves to make allowed shapes visible.' }),
  Object.freeze({ label: 'Read', title: 'Operators', body: 'Use curvature to extract a momentum-squared factor.' }),
  Object.freeze({ label: 'Rotate', title: 'i', body: 'Keep the exponential periodic by turning in a second direction.' }),
  Object.freeze({ label: 'Interpret', title: 'Probability', body: 'Square the complex magnitude and compare with counts.' }),
])

function videoAt(seconds: number): string {
  return `${QUANTUM_VIDEO.url}&t=${seconds}s`
}

function openSourceReport(): string {
  return `The downloaded source, raw Whisper output, extracted frames, hashes, and tool commands are preserved under ${QUANTUM_VIDEO.analysisReport.replace('/analysis/report.md', '')}. The app ships original diagrams instead of copied frames.`
}

onMounted(() => {
  document.title = 'Imaginary Numbers / Quantum Wave Lab | OpenSimPhy Atlas'
})
</script>

<template lang="pug">
.quantum-lab-view(data-testid="quantum-wave-lab-ready")
  header.quantum-lab-header
    .quantum-lab-header__index
      span OpenSimPhy / Lab 04
      span source → model → simulation
    .quantum-lab-header__copy
      p.eyebrow A teacher's reconstruction of a quantum-wave story
      h1 Why does physics need i?
      p.lede {{ QUANTUM_LEARNING_PROMISE }} Start with a spectrum, build a wave, read its curvature, rotate its phase, and finish with a probability distribution.
      .quantum-lab-depth
        TourDepthControl
    aside.quantum-lab-header__source
      p.eyebrow Reference media / {{ QUANTUM_VIDEO.duration }}
      h2 {{ QUANTUM_VIDEO.title }}
      p {{ QUANTUM_VIDEO.channel }}. The source explains the time-dependent Schrodinger equation through spectra, Fourier analysis, complex rotation, and the Born rule.
      a(:href="QUANTUM_VIDEO.url" target="_blank" rel="noreferrer") Open the original video on YouTube

  .quantum-lab-promise
    strong Teacher's shortcut
    p Do not memorize "imaginary numbers are mysterious." Remember: a wave needs a phase, operators need predictable derivatives, and complex magnitude gives a stable probability.

  .quantum-lab-layout
    main.quantum-lab-main
      section.quantum-shortcut(aria-labelledby="quantum-shortcut-title")
        .quantum-shortcut__heading
          p.eyebrow The route / five moves
          h2#quantum-shortcut-title A shorter explanation than the video
          p Use the numbered instruments below in order. Each one answers one question and leaves its assumptions visible.
        .quantum-shortcut__steps
          article(v-for="step in shortcutSteps" :key="step.label")
            span {{ step.label }}
            h3 {{ step.title }}
            p {{ step.body }}
        details.quantum-disclosure.quantum-vocabulary
          summary Open the essential vocabulary
          dl
            template(v-for="term in QUANTUM_TERMS" :key="term.term")
              dt {{ term.term }}
              dd {{ depth === 'technical' ? term.technical : term.plain }}

      section.quantum-lab-section(
        v-for="section in QUANTUM_GUIDE_SECTIONS"
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
            .quantum-lab-section__answer
              strong Short answer
              p {{ section.answer }}
            .quantum-lab-section__teacher-note
              strong Teacher note
              p {{ section.teacherNote }}
            p.quantum-lab-section__equation
              code {{ section.equation }}
        component(
          v-if="section.moduleId"
          :is="instrumentFor(section.moduleId)"
          :depth="depth"
        )

      section.quantum-source-map(aria-labelledby="quantum-source-map-title")
        .quantum-source-map__heading
          p.eyebrow Media / extracted visual sequence
          h2#quantum-source-map-title The frame map behind this lab
          p Every card is a semantic checkpoint from the local frame inventory. Open a timestamp to compare the original narration with the original diagrams here. The app deliberately redraws the ideas in its own accessible SVG language.
        .quantum-timeline
          a(v-for="entry in QUANTUM_VIDEO_TIMELINE" :key="entry.id" :href="videoAt(entry.seconds)" target="_blank" rel="noreferrer")
            time(:datetime="`PT${entry.seconds}S`") {{ entry.timestamp }}
            strong {{ entry.title }}
            small
              | {{ entry.frame }}
              br
              | {{ entry.lesson }}
            small Open source timestamp ↗
        details.quantum-media
          summary Optional source video player
          .quantum-media__frame
            iframe(
              :src="`https://www.youtube-nocookie.com/embed/${QUANTUM_VIDEO.id}?rel=0`"
              title="Reference video: why the universe needs imaginary numbers"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            )
          p This is an external YouTube embed, not an app-owned copy. Close it for an entirely local lesson; all eight instruments above run in the browser without a network request.
        p.quantum-provenance
          strong Reproducibility note.
          |  {{ openSourceReport() }} Whisper was run locally with whisper.cpp large-v3. The raw transcript remains unchanged; the research report documents repeated hallucinated spans and recognition corrections.

      section.quantum-related(aria-labelledby="quantum-related-title")
        .quantum-related__heading
          p.eyebrow Keep exploring
          h2#quantum-related-title Connect this story to the rest of OpenSimPhy
          p
            | Use the related pages to move from the teacher's reconstruction into the project's existing instruments. 
            QuantumTooltip(term="validation" plain="A stronger claim than successfully running a calculation." technical="An independent comparison protocol with calibrated inputs, held-out observables, uncertainty treatment, and acceptance criteria." :depth="depth")
            |  is intentionally kept separate from every result on this page.
        .quantum-related-grid
          RouterLink(v-for="link in QUANTUM_RELATED_LINKS" :key="link.to" :to="link.to")
            strong {{ link.label }}
            span {{ link.note }} →

      section.quantum-provenance(aria-label="Scope boundary")
        strong Scope boundary:
        |  these are original, bounded teaching models inspired by the reference video's sequence. They do not copy its frames, claim to reproduce its production, or establish that a quantum interpretation is empirically complete. See 
        RouterLink(to="/evidence") Evidence
        |  for the project's claim vocabulary and 
        RouterLink(to="/tour") Tour
        |  for the established-physics path.

    aside.quantum-lab-rail(aria-label="Quantum wave lab contents")
      span.quantum-lab-rail__label Instrument index
      nav
        a(href="#spectral-lines") 01 / Spectra
        a(href="#standing-wave") 02 / Standing wave
        a(href="#operator-lab") 03 / Operators
        a(href="#fourier-composer") 04 / Fourier
        a(href="#complex-plane") 05 / Complex plane
        a(href="#schrodinger-equation") 06 / Equation
        a(href="#probability-wave") 07 / Probability
        a(href="#hydrogen-materials") 08 / Applications
        a(href="#quantum-source-map") Media / Frame map
      RouterLink.text-link(to="/labs") ← Back to all laboratories
</template>

<style src="../styles/quantum-wave.css"></style>
