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

<template>
  <div class="quantum-lab-view" data-testid="quantum-wave-lab-ready">
    <header class="quantum-lab-header">
      <div class="quantum-lab-header__index">
        <span>OpenSimPhy / Lab 04</span>
        <span>source → model → simulation</span>
      </div>
      <div class="quantum-lab-header__copy">
        <p class="eyebrow">A teacher's reconstruction of a quantum-wave story</p>
        <h1>Why does physics need i?</h1>
        <p class="lede">{{ QUANTUM_LEARNING_PROMISE }} Start with a spectrum, build a wave, read its curvature, rotate its phase, and finish with a probability distribution.</p>
        <div class="quantum-lab-depth"><TourDepthControl /></div>
      </div>
      <aside class="quantum-lab-header__source">
        <p class="eyebrow">Reference media / {{ QUANTUM_VIDEO.duration }}</p>
        <h2>{{ QUANTUM_VIDEO.title }}</h2>
        <p>{{ QUANTUM_VIDEO.channel }}. The source explains the time-dependent Schrodinger equation through spectra, Fourier analysis, complex rotation, and the Born rule.</p>
        <a :href="QUANTUM_VIDEO.url" target="_blank" rel="noreferrer">Open the original video on YouTube</a>
      </aside>
    </header>

    <div class="quantum-lab-promise">
      <strong>Teacher's shortcut</strong>
      <p>Do not memorize "imaginary numbers are mysterious." Remember: a wave needs a phase, operators need predictable derivatives, and complex magnitude gives a stable probability.</p>
    </div>

    <div class="quantum-lab-layout">
      <main class="quantum-lab-main">
        <section class="quantum-shortcut" aria-labelledby="quantum-shortcut-title">
          <div class="quantum-shortcut__heading">
            <p class="eyebrow">The route / five moves</p>
            <h2 id="quantum-shortcut-title">A shorter explanation than the video</h2>
            <p>Use the numbered instruments below in order. Each one answers one question and leaves its assumptions visible.</p>
          </div>
          <div class="quantum-shortcut__steps">
            <article v-for="step in shortcutSteps" :key="step.label">
              <span>{{ step.label }}</span>
              <h3>{{ step.title }}</h3>
              <p>{{ step.body }}</p>
            </article>
          </div>
          <details class="quantum-disclosure quantum-vocabulary">
            <summary>Open the essential vocabulary</summary>
            <dl>
              <template v-for="term in QUANTUM_TERMS" :key="term.term">
                <dt>{{ term.term }}</dt>
                <dd>{{ depth === 'technical' ? term.technical : term.plain }}</dd>
              </template>
            </dl>
          </details>
        </section>

        <section
          v-for="section in QUANTUM_GUIDE_SECTIONS"
          :id="section.moduleId ?? section.id"
          :key="section.id"
          class="quantum-lab-section"
          :aria-labelledby="`${section.id}-heading`"
        >
          <div class="quantum-lab-section__heading">
            <span>{{ section.number }} / {{ section.id }}</span>
            <div>
              <h2 :id="`${section.id}-heading`">{{ section.title }}</h2>
              <p><strong>Question:</strong> {{ section.question }}</p>
              <div class="quantum-lab-section__answer">
                <strong>Short answer</strong>
                <p>{{ section.answer }}</p>
              </div>
              <div class="quantum-lab-section__teacher-note">
                <strong>Teacher note</strong>
                <p>{{ section.teacherNote }}</p>
              </div>
              <p class="quantum-lab-section__equation"><code>{{ section.equation }}</code></p>
            </div>
          </div>
          <component
            :is="section.moduleId ? instrumentComponents[section.moduleId as keyof typeof instrumentComponents] : undefined"
            v-if="section.moduleId"
            :depth="depth"
          />
        </section>

        <section class="quantum-source-map" aria-labelledby="quantum-source-map-title">
          <div class="quantum-source-map__heading">
            <p class="eyebrow">Media / extracted visual sequence</p>
            <h2 id="quantum-source-map-title">The frame map behind this lab</h2>
            <p>Every card is a semantic checkpoint from the local frame inventory. Open a timestamp to compare the original narration with the original diagrams here. The app deliberately redraws the ideas in its own accessible SVG language.</p>
          </div>
          <div class="quantum-timeline">
            <a v-for="entry in QUANTUM_VIDEO_TIMELINE" :key="entry.id" :href="videoAt(entry.seconds)" target="_blank" rel="noreferrer">
              <time :datetime="`PT${entry.seconds}S`">{{ entry.timestamp }}</time>
              <strong>{{ entry.title }}</strong>
              <small>{{ entry.frame }}<br>{{ entry.lesson }}</small>
              <small>Open source timestamp ↗</small>
            </a>
          </div>
          <details class="quantum-media">
            <summary>Optional source video player</summary>
            <div class="quantum-media__frame">
              <iframe
                :src="`https://www.youtube-nocookie.com/embed/${QUANTUM_VIDEO.id}?rel=0`"
                title="Reference video: why the universe needs imaginary numbers"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
              />
            </div>
            <p>This is an external YouTube embed, not an app-owned copy. Close it for an entirely local lesson; all eight instruments above run in the browser without a network request.</p>
          </details>
          <p class="quantum-provenance"><strong>Reproducibility note.</strong> {{ openSourceReport() }} Whisper was run locally with whisper.cpp large-v3. The raw transcript remains unchanged; the research report documents repeated hallucinated spans and recognition corrections.</p>
        </section>

        <section class="quantum-related" aria-labelledby="quantum-related-title">
          <div class="quantum-related__heading">
            <p class="eyebrow">Keep exploring</p>
            <h2 id="quantum-related-title">Connect this story to the rest of OpenSimPhy</h2>
            <p>
              Use the related pages to move from the teacher's reconstruction into the project's existing instruments.
              <QuantumTooltip term="validation" plain="A stronger claim than successfully running a calculation." technical="An independent comparison protocol with calibrated inputs, held-out observables, uncertainty treatment, and acceptance criteria." :depth="depth" />
              is intentionally kept separate from every result on this page.
            </p>
          </div>
          <div class="quantum-related-grid">
            <RouterLink v-for="link in QUANTUM_RELATED_LINKS" :key="link.to" :to="link.to">
              <strong>{{ link.label }}</strong>
              <span>{{ link.note }} →</span>
            </RouterLink>
          </div>
        </section>

        <section class="quantum-provenance" aria-label="Scope boundary">
          <strong>Scope boundary:</strong> these are original, bounded teaching models inspired by the reference video's sequence. They do not copy its frames, claim to reproduce its production, or establish that a quantum interpretation is empirically complete. See <RouterLink to="/evidence">Evidence</RouterLink> for the project's claim vocabulary and <RouterLink to="/tour">Tour</RouterLink> for the established-physics path.
        </section>
      </main>

      <aside class="quantum-lab-rail" aria-label="Quantum wave lab contents">
        <span class="quantum-lab-rail__label">Instrument index</span>
        <nav>
          <a href="#spectral-lines">01 / Spectra</a>
          <a href="#standing-wave">02 / Standing wave</a>
          <a href="#operator-lab">03 / Operators</a>
          <a href="#fourier-composer">04 / Fourier</a>
          <a href="#complex-plane">05 / Complex plane</a>
          <a href="#schrodinger-equation">06 / Equation</a>
          <a href="#probability-wave">07 / Probability</a>
          <a href="#hydrogen-materials">08 / Applications</a>
          <a href="#quantum-source-map">Media / Frame map</a>
        </nav>
        <RouterLink class="text-link" to="/labs">← Back to all laboratories</RouterLink>
      </aside>
    </div>
  </div>
</template>

<style src="../styles/quantum-wave.css"></style>
