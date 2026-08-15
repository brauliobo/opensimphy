<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import CoverageStrip from '../components/CoverageStrip.vue'
import { useCompletionRegistry } from '../registries/completionRegistry'

const completionRegistry = useCompletionRegistry()
void completionRegistry.initialize()

const siteSources = [
  ['Physics Monastery', 'https://www.physicsmonastery.earth/', 'Primary website; content can drift independently of preserved artifacts.'],
  ['288 overview', 'https://www.physicsmonastery.earth/288', 'Visual source for the ordered formula set.'],
  ['Constants of Nature', 'https://www.physicsmonastery.earth/constants-of-nature', 'Website presentation and symbol context.'],
  ['Number walls', 'https://www.physicsmonastery.earth/number-walls', '351 indexed source inputs and per-input JSON.'],
]

interface PdfRecord {
  id: string
  title: string
  pages: number | null
  bytes: number
  sha256: string
  sourceUrl?: string | null
  localPath?: string
  accessNote?: string
}

interface ProvenanceRegistry {
  physicsMonastery: { recoveredSitePdfs: PdfRecord[] }
  contextualPdfs: PdfRecord[]
  earthMarkdown: Array<{ id: string }>
}

const provenance = ref<ProvenanceRegistry | null>(null)
const provenanceError = ref('')
const completionReady = computed(() => completionRegistry.ready.value
  && !completionRegistry.error.value
  && completionRegistry.report.value !== null)
const completionError = computed(() => completionRegistry.error.value?.message
  ?? (completionRegistry.ready.value && !completionReady.value ? 'The generated completion report is unavailable.' : ''))
const sitePdfs = computed(() => provenance.value?.physicsMonastery.recoveredSitePdfs ?? [])
const contextualPdfs = computed(() => provenance.value?.contextualPdfs ?? [])

function bytes(value: number): string {
  return `${value.toLocaleString('en-US')} B`
}

onMounted(async () => {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/generated/provenance.json`)
    if (!response.ok) throw new Error(`Provenance registry failed to load (${response.status})`)
    provenance.value = await response.json() as ProvenanceRegistry
  } catch (reason) {
    provenanceError.value = reason instanceof Error ? reason.message : String(reason)
  }
})
</script>

<template lang="pug">
.view.sources-view
  header.view-header
    div
      p.eyebrow Instrument 04 / provenance ledger
      h1 Sources & Limits
    .header-stat
      strong STATIC
      span no live API dependency

  section.caveat-banner(data-testid="sources-caveat")
    strong REPRODUCTION ≠ VALIDATION
    p This instrument tests whether preserved inputs and implemented expressions reproduce stated values. It does not independently validate the physical interpretation, derivation, novelty, or predictive power of the source claims.

  section.source-section(:data-testid="completionReady ? 'completion-registry-ready' : undefined")
    .section-heading
      div
        p.eyebrow Generated completion audit
        h2 Aggregate generated coverage
      p This build-time report summarizes generated corpus coverage. It does not describe records evaluated in this browser session or the state of another route.
    .loading-plate(v-if="!completionRegistry.ready.value") Loading generated completion audit…
    .empty-state(v-else-if="completionError" role="alert")
      strong Generated completion audit unavailable
      p {{ completionError }}
    CoverageStrip(
      v-else-if="completionReady"
      :rows="completionRegistry.coverage.value"
      :complete="completionRegistry.complete.value"
    )

  section.source-section
    .section-heading
      div
        p.eyebrow Website records
        h2 Primary URLs
      p Accessed and preserved during the 2026 audit pass.
    .source-ledger
      a.source-row(v-for="source in siteSources" :key="source[1]" :href="source[1]" target="_blank" rel="noreferrer")
        strong {{ source[0] }}
        code {{ source[1] }}
        span {{ source[2] }}

  section.source-section.fiddle-source-link
    .section-heading
      div
        p.eyebrow Source archive / Workbench 04
        h2 JSFiddle archive
      p The captured registry exposes 780 JSFiddle metadata records across 16 source profile pages. It is a provenance index, not a local simulation or validation result.
    RouterLink.button-link(to="/labs/simulations") Browse the Fiddle source archive

  section.source-section.two-column-section
    article.audit-note
      p.eyebrow Formula provenance
      h2 288 / Transform Dictionary
      p The ordered formulas originate in the site’s 288 presentation and Transform Dictionary PDF/text extraction. The dictionary states comparison against CODATA 2018 and 2022 and reports differences in source error bars.
      p Local source artifacts include `288.pdf`, `transform_dictionary.pdf`, OCR/text extraction, `constants.yaml`, `symbols.csv`, and the published evaluation output. Generated registries are derived artifacts and must retain links back to these records.
    article.audit-note
      p.eyebrow Known data issues
      h2 Units, status, statistics
      p The preserved evaluation reports 70 exact entries with 2 failures and 218 measured entries with 1 failure. The nominally exact failures concern molar volume and Loschmidt constant reference-condition differences; the measured Sackur–Tetrode case also fails its audit threshold.
      p Source labels mix defined exact quantities, measured constants, model values, relationship symbols, and custom unit notation. A z-score is not meaningful for exact definitions, and uncertainty comparisons must account for correlated inputs and selection effects.

  section.source-section
    .section-heading
      div
        p.eyebrow Direct source artifacts
        h2 Recovered site PDFs
      p PDF bytes remain outside the public build; this ledger is generated from the retained source artifacts.
    .paper-table
      .paper-row.paper-head
        span Artifact
        span Pages
        span Bytes
        span SHA256
      .paper-row(v-for="paper in sitePdfs" :key="paper.id")
        strong {{ paper.title }}
        span {{ paper.pages ?? 'unreported' }}
        span {{ bytes(paper.bytes) }}
        code {{ paper.sha256 }}
    p.inline-error(v-if="provenanceError" role="alert") {{ provenanceError }}

  section.source-section
    .section-heading
      div
        p.eyebrow Local corpus cross-links
        h2 Contextual PDF metadata
      p {{ contextualPdfs.length }} PDF records and {{ provenance?.earthMarkdown.length ?? 0 }} EARTH Markdown records are indexed as context only. Full paths, hashes, source URLs, and failed-access notes remain in the parent corpus `INDEX.md`.
    .paper-table
      .paper-row.paper-head
        span Work
        span Pages
        span Bytes
        span Source record
      .paper-row(v-for="paper in contextualPdfs" :key="paper.id")
        strong {{ paper.title }}
        span {{ paper.pages ?? 'unreported' }}
        span {{ bytes(paper.bytes) }}
        a.text-link(v-if="paper.sourceUrl" :href="paper.sourceUrl" target="_blank" rel="noreferrer") source ↗
        code(v-else) local artifact / distinct hash

  section.source-section.notes-grid
    article
      h3 Source drift
      p Website routes and JSON may change after acquisition. The app uses generated registries and preserved static payloads; completion must be regenerated when source hashes change.
    article
      h3 Access
      p Some related papers remain inaccessible due to Akamai, Cloudflare, 403/429 responses, or timeout. No placeholder PDFs are represented as sources.
    article
      h3 License
      p The EARTH README declares CC BY-NC-SA 4.0, which the source lock records with attribution and without independently verifying rights ownership. Availability of the other websites and papers does not imply permission to redistribute them.
    article
      h3 Statistical scope
      p Formula choice, fitted constants, shared dependencies, significant-digit matching, and many simultaneous comparisons can inflate apparent agreement. Independent preregistered tests are outside this reproduction.
</template>
