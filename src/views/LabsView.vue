<script setup lang="ts">
import { computed } from 'vue'
import { useCompletionRegistry } from '../registries/completionRegistry'

const completionRegistry = useCompletionRegistry()
void completionRegistry.initialize()

const registryReady = computed(() => completionRegistry.ready.value
  && !completionRegistry.error.value
  && completionRegistry.report.value !== null)
const registryError = computed(() => completionRegistry.error.value?.message
  ?? (completionRegistry.ready.value && !registryReady.value ? 'The generated completion report is unavailable.' : ''))
const core = computed(() => completionRegistry.coverage.value.find((row) => row.key === 'core'))
const walls = computed(() => completionRegistry.coverage.value.find((row) => row.key === 'walls'))
</script>

<template lang="pug">
.view.labs-view(:data-testid="registryReady ? 'completion-registry-ready' : undefined")
  header.view-header
    div
      p.eyebrow Browser laboratories
      h1 Choose an instrument
    p.lab-intro The laboratories are separate from the constants tour. Enter only when you want to inspect transform cases or simulate preserved number-wall inputs.
  .loading-plate(v-if="!completionRegistry.ready.value") Loading generated laboratory counts…
  .empty-state(v-else-if="registryError" role="alert")
    strong Laboratory counts unavailable
    p {{ registryError }}
  .lab-choice-grid(v-else-if="registryReady")
    RouterLink(to="/labs/core")
      span 01 / TRANSFORM CASES
      strong Core lab
      p Complex surfaces, root loci, invariant checks, constructor transforms, and typed-unit cases.
      small {{ core?.graphed ?? 0 }} graph-ready cases →
    RouterLink(to="/labs/walls")
      span 02 / NUMBER WALLS
      strong Number walls
      p Exact source sequences rendered through six local simulation modes in a cancellable worker.
      small {{ walls?.simulatable ?? 0 }} simulatable inputs →
    RouterLink(to="/labs/earth/EARTH-PLAN-008")
      span 03 / EARTH METHODS
      strong EARTH method workbench
      p Run one bounded method for the representative atmospheric scale-height program without entering the evidence registry.
      small Open EARTH-PLAN-008 →
  p.lab-intro Choose another EARTH program from the full canonical #[RouterLink.text-link(to="/earth/programs") Program Registry].
  section.source-section.author-collection-section(v-if="registryReady")
    .section-heading
      div
        p.eyebrow External authors and sources
        h2 Author collections
      p Preserved external-source indexes are separated from OpenSimPhy-owned laboratories and do not imply local execution or scientific validation.
    .topic-featured-grid.author-collection-grid
      RouterLink(:to="{ name: 'fiddle-archive' }")
        span Chenopdodium / Chantal Roth
        strong Fiddle source archive
        p 780 external source records / 16 profile pages. External runtime status pending.
        small Open the author collection ->
</template>
