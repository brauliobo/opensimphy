<script setup lang="ts">
import { computed } from 'vue'
import { useAtlasEngine } from '../composables/atlasEngine'

const atlas = useAtlasEngine()
const recipeCoverage = computed(() => atlas.coverage.value.find((row) => row.key === 'recipes'))
const wallCoverage = computed(() => atlas.coverage.value.find((row) => row.key === 'walls'))
const coreCoverage = computed(() => atlas.coverage.value.find((row) => row.key === 'core'))
</script>

<template lang="pug">
.view.overview-view
  section.hero-grid
    .hero-copy
      p.eyebrow Instrument 00 / scope
      h1 Reproduce the claim.#[br]Expose the residual.
      p.lede A browser-only atlas for auditing the equations and number-wall inputs proposed by Physics Monastery. It preserves source distinctions, executes local registries, and refuses to call missing work complete.
      .hero-actions
        RouterLink.button-link(to="/atlas") Open formula atlas
        RouterLink.text-link(to="/sources") Read source limitations →
    aside.scope-plate(aria-label="Audit scope")
      span.plate-index SCOPE / 2022—2026
      dl
        div
          dt Formula source
          dd 288 / Transform Dictionary
        div
          dt Reference basis
          dd CODATA 2018 + 2022
        div
          dt Runtime
          dd local browser only
        div
          dt Scientific status
          dd reproduction audit

  section.instrument-section
    .section-heading
      div
        p.eyebrow Exact census
        h2 Registry coverage
      p Counts come from generated completion data, not display assumptions.
    .census-grid
      article.census(v-if="recipeCoverage")
        span.census-code R/288
        strong {{ recipeCoverage.evaluated }}
        h3 evaluated recipes
        p {{ recipeCoverage.implemented }} implemented / {{ recipeCoverage.graphed }} graphed / {{ recipeCoverage.expected }} source
      article.census(v-if="coreCoverage")
        span.census-code C/REG
        strong {{ coreCoverage.graphed }}
        h3 graphed core cases
        p {{ coreCoverage.implemented }} implemented / {{ coreCoverage.expected }} registry cases
      article.census(v-if="wallCoverage")
        span.census-code W/351
        strong {{ wallCoverage.simulatable }}
        h3 simulatable inputs
        p {{ wallCoverage.implemented }} preserved / {{ wallCoverage.expected }} source

  section.instrument-section.two-column-section
    article.audit-note
      p.eyebrow Scientific caveat
      h2 Agreement is not validation
      p These calculations reproduce site-proposed claims. Numerical agreement, including agreement measured in source error bars, does not establish a derivation, physical mechanism, independent prediction, or statistical validity.
      p The source construction uses fitted or selected mathematical constants and shared dependencies. Correlated inputs, unit conventions, exact-vs-measured classification, multiple comparisons, and formula selection all require independent scrutiny.
    aside.worker-monitor(aria-label="Worker status")
      .monitor-heading
        span Worker pool
        strong.signal-ok IDLE / READY
      .monitor-track
        i(style="width: 0%")
      dl
        div
          dt Formula evaluation
          dd parallel simulation worker
        div
          dt Number walls
          dd cancellable browser worker
        div
          dt Network
          dd static assets only

  section.route-index(aria-label="Instrument index")
    RouterLink(to="/atlas")
      span 01
      strong Formula atlas
      small search / residuals / inversion sweeps
    RouterLink(to="/core")
      span 02
      strong Core lab
      small complex surfaces / roots / transforms
    RouterLink(to="/walls")
      span 03
      strong Number walls
      small exact cells / six render modes
    RouterLink(to="/sources")
      span 04
      strong Sources
      small provenance / access / drift
</template>
