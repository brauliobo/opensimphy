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

<template>
  <div class="quantum-lab-view" data-testid="edwin-gray-lab-ready">
    <header class="quantum-lab-header">
      <div class="quantum-lab-header__index">
        <span>OpenSimPhy / Lab 05</span>
        <span>source → model → simulation</span>
      </div>
      <div class="quantum-lab-header__copy">
        <p class="eyebrow">A reconstruction of the Gray pulsed-capacitor motors</p>
        <h1>What did the purple motor actually switch?</h1>
        <p class="lede">{{ GRAY_LEARNING_PROMISE }}</p>
        <div class="quantum-lab-depth"><TourDepthControl /></div>
      </div>
      <aside class="quantum-lab-header__source">
        <p class="eyebrow">Reference media / {{ GRAY_VIDEO.duration }}</p>
        <h2>{{ GRAY_VIDEO.title }}</h2>
        <p>Uploader: {{ GRAY_VIDEO.uploader }}. Uploaded {{ GRAY_VIDEO.uploaded }}. Local notes live in {{ GRAY_VIDEO.transcript }}. Historical COP 300 remains a source-claim.</p>
        <a :href="GRAY_VIDEO.url" target="_blank" rel="noreferrer">Open the original video on YouTube</a>
      </aside>
    </header>

    <div class="quantum-lab-promise">
      <strong>Teacher's shortcut</strong>
       <p>Do not treat "cold electricity" as a second Maxwell term. Establish the patent topology, schedule the participating sectors, quench an arc, and keep the energy ledger classical.</p>
    </div>

    <div class="quantum-lab-layout">
      <main class="quantum-lab-main">
        <section class="quantum-shortcut" aria-labelledby="gray-shortcut-title">
          <div class="quantum-shortcut__heading">
            <p class="eyebrow">The route / five moves</p>
            <h2 id="gray-shortcut-title">A shorter explanation than the talk</h2>
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
              <template v-for="term in GRAY_TERMS" :key="term.term">
                <dt>{{ term.term }}</dt>
                <dd>{{ depth === 'technical' ? term.technical : term.plain }}</dd>
              </template>
            </dl>
          </details>
        </section>

        <section
          v-for="section in GRAY_GUIDE_SECTIONS"
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
               <p class="gray-evidence-label"><strong>{{ section.evidenceLabel }}</strong></p>
               <p class="gray-assumption-label"><strong>{{ section.assumptionLabel }}</strong></p>
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

         <section id="gray-source-map" class="quantum-source-map" aria-labelledby="gray-source-map-title">
          <div class="quantum-source-map__heading">
            <p class="eyebrow">Media / talk sequence</p>
            <h2 id="gray-source-map-title">The frame map behind this lab</h2>
             <p>Every card is a checkpoint from the source talk and the local transcript. The app redraws the machines in SVG instead of copying video frames.</p>
          </div>
          <div class="quantum-timeline">
            <a v-for="entry in GRAY_VIDEO_TIMELINE" :key="entry.id" :href="videoAt(entry.seconds)" target="_blank" rel="noreferrer">
              <time :datetime="`PT${entry.seconds}S`">{{ entry.timestamp }}</time>
              <strong>{{ entry.title }}</strong>
              <small>{{ entry.frame }}<br>{{ entry.lesson }}</small>
              <small>Open source timestamp ↗</small>
            </a>
          </div>
           <details class="quantum-media">
             <summary>Optional source video player</summary>
             <div v-if="!videoActivated" class="gray-video-gate">
               <p>The external player is unloaded until you explicitly activate it.</p>
               <button type="button" data-testid="gray-video-activate" @click="activateVideo">Load external video</button>
             </div>
             <div v-else class="quantum-media__frame">
               <iframe
                 :src="`https://www.youtube-nocookie.com/embed/${GRAY_VIDEO.id}?rel=0`"
                 title="Reference video: Ed Gray purple motor presentation"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
               />
             </div>
             <p role="status" aria-live="polite">{{ videoActivated ? 'External YouTube player loaded by user request.' : 'External YouTube player is not loaded.' }} Close it for an entirely local lesson; the five instruments run without a network request.</p>
           </details>
           <p class="quantum-provenance"><strong>Reproducibility note.</strong> Transcript: {{ GRAY_VIDEO.transcript }}. Downloaded media, when present: {{ GRAY_VIDEO.downloadedSource }}.</p>
         </section>

         <section class="gray-fem-card" aria-labelledby="gray-fem-title" data-testid="gray-fem-status">
           <div>
             <p class="eyebrow">Local finite-element workspace</p>
             <h2 id="gray-fem-title">FEM status: {{ GRAY_FEM_PROVENANCE.status }}</h2>
             <p>{{ GRAY_FEM_PROVENANCE.solverBoundary }} The browser instruments use the bounded classical engine, not an FEM result.</p>
           </div>
           <div class="gray-fem-card__links">
              <a :href="GRAY_FEM_PROVENANCE.workspace" target="_blank" rel="noreferrer">Open fem/edwin-gray provenance</a>
              <a :href="GRAY_FEM_PROVENANCE.sourceLedger" target="_blank" rel="noreferrer">Open source ledger</a>
           </div>
         </section>

        <section class="quantum-related" aria-labelledby="gray-related-title">
          <div class="quantum-related__heading">
            <p class="eyebrow">Keep exploring</p>
            <h2 id="gray-related-title">Connect this reconstruction to the rest of OpenSimPhy</h2>
            <p>Running the ledger is a computation, not empirical validation of Gray’s claims.</p>
          </div>
          <div class="quantum-related-grid">
            <RouterLink v-for="link in GRAY_RELATED_LINKS" :key="link.to" :to="link.to">
              <strong>{{ link.label }}</strong>
              <span>{{ link.note }} →</span>
            </RouterLink>
          </div>
        </section>

        <section class="quantum-provenance" aria-label="Scope boundary">
          <strong>Scope boundary:</strong> these are original, bounded teaching models of a pulsed-capacitor open-core machine. They do not establish over-unity, cold electricity, or a radiant force. See <RouterLink to="/evidence">Evidence</RouterLink> for claim vocabulary.
        </section>
      </main>

      <aside class="quantum-lab-rail" aria-label="Edwin Gray lab contents">
        <span class="quantum-lab-rail__label">Instrument index</span>
         <nav>
           <a href="#geometry">01 / Patent topology</a>
           <a href="#circuit">02 / Circuit</a>
           <a href="#pulse">03 / Pulse</a>
           <a href="#energy">04 / Energy</a>
           <a href="#family">05 / Colored comparisons</a>
           <a href="#gray-source-map">Media / Frame map</a>
        </nav>
        <RouterLink class="text-link" to="/labs">← Back to all laboratories</RouterLink>
      </aside>
    </div>
  </div>
</template>

<style src="../styles/quantum-wave.css"></style>
<style src="../styles/edwin-gray.css"></style>
