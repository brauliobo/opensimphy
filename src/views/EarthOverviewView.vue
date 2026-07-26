<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import EarthLocalNav from '../components/EarthLocalNav.vue'
import { loadEarthManifest, type EarthManifest } from '../earth/corpus'
import { loadEarthDatasetRegistry, type EarthDatasetRegistry } from '../earth/datasets'
import { loadScientificSimulationBundle, type ScientificSimulationBundle } from '../earth/simulations'

const manifest = ref<EarthManifest | null>(null)
const programs = ref<ScientificSimulationBundle | null>(null)
const datasets = ref<EarthDatasetRegistry | null>(null)
const error = ref('')
const controller = new AbortController()

const programCount = computed(() => programs.value?.registry.records.length ?? 0)
const methodCount = computed(() => programs.value?.registry.records.reduce(
  (total, record) => total + record.executionMethods.length,
  0,
) ?? 0)
const runnableMethodCount = computed(() => programs.value?.registry.records.reduce(
  (total, record) => total + record.executionMethods.filter((method) => method.runnable).length,
  0,
) ?? 0)
const scientificallyValidated = computed(() => programs.value?.registry.records.some((record) => (
  record.executionMethods.some((method) => method.validatesEarthTheory)
)) ?? false)

onMounted(async () => {
  try {
    [manifest.value, programs.value, datasets.value] = await Promise.all([
      loadEarthManifest(controller.signal),
      loadScientificSimulationBundle(controller.signal),
      loadEarthDatasetRegistry(controller.signal),
    ])
  } catch (reason) {
    if (controller.signal.aborted) return
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
})

onBeforeUnmount(() => controller.abort())
</script>

<template lang="pug">
.view.earth-overview-view
  EarthLocalNav

  header.earth-dossier-header
    .earth-dossier-title
      p.eyebrow Instrument 03/A / evidence dossier
      h1 EARTH Evidence Dossier
      p.lede A read-only map from preserved source claims to reproducible browser programs, their declared methods, and result records. The dossier reports what is present and executable without promoting execution to scientific validation.
    aside.earth-dossier-stamp
      span.plate-index DOSSIER / 03-A
      dl
        div
          dt Source revision
          dd {{ manifest?.sourceRevision.slice(0, 12) ?? 'loading' }}
        div
          dt Program audit
          dd {{ programs?.completionGeneratedAt ?? 'loading' }}
        div
          dt Dataset review
          dd {{ datasets?.sourceRegistry.reviewDate ?? 'loading' }}

  p.inline-error(v-if="error" role="alert") {{ error }}
  p.earth-loading(v-else-if="!manifest || !programs || !datasets" aria-live="polite") Loading validated EARTH registries…

  template(v-else)
    section.earth-evidence-ledger(data-testid="earth-evidence-ledger" aria-label="Validated EARTH registry evidence")
      article
        span 03/B · source evidence
        strong {{ manifest.summary.documents }}
        small documents in the locked corpus manifest
      article
        span 03/C · program records
        strong {{ programCount }}
        small source-linked programs in the scientific bundle
      article
        span 03/C · declared methods
        strong {{ methodCount }}
        small {{ runnableMethodCount }} runnable; remaining source formulations are registry-only
      article
        span 03/D · authenticated metadata
        strong {{ datasets.summary.metadataAuthenticated }}
        small dataset records; metadata evidence only
      article
        span 03/D · frozen datasets
        strong {{ datasets.summary.dataFrozen }}
        small acquired byte sets with a frozen digest
      article.earth-validation-record
        span Completion claim
        strong scientificallyValidated: {{ scientificallyValidated }}
        small execution coverage is exact; scientific validation is not claimed

    section.earth-chain-section
      header.section-heading
        div
          p.eyebrow Evidence chain / reading order
          h2 Source evidence → program → methods → results
        p Each layer preserves a different claim. Follow the chain forward to inspect provenance, then backward to audit what a result actually depends on.
      .earth-chain
        RouterLink(to="/earth/corpus")
          span 01 / SOURCE EVIDENCE
          strong Preserved claims and hashes
          p The corpus records the submitted Markdown and structural candidates. It is evidence of what the source says, not evidence that the source is correct.
          small Open 03/B Corpus →
        RouterLink(to="/earth/programs")
          span 02 / PROGRAM
          strong Registered scientific task
          p A program binds source records, goals, dependencies, gate states, and execution status into an auditable work item.
          small Open 03/C Programs →
        RouterLink(to="/earth/programs")
          span 03 / METHODS
          strong Declared comparison paths
          p The registry identifies {{ methodCount }} declared methods, of which {{ runnableMethodCount }} have an integrity-matched browser adapter. Unavailable source formulations remain metadata only.
          small Inspect method records →
        RouterLink(to="/earth/datasets")
          span 04 / RESULTS
          strong Outputs require provenance
          p Worker output is a reproduction record. Dataset metadata and gate ledgers show why no empirical validation result is currently asserted.
          small Open 03/D Data →

    section.earth-execution-note
      strong EXECUTION ≠ VALIDATION
      div
        h2 What the browser can establish
        p Successful execution establishes that a registered method can produce finite, inspectable output under its recorded inputs and runtime. It supports reproduction and implementation audit.
      div
        h2 What remains unproven
        p Execution alone does not establish source-model closure, agreement with nature, acquired or frozen data, independent replication, or scientific truth. The validated registries therefore retain #[code scientificallyValidated: false].

    section.earth-section-index(aria-label="EARTH dossier sections")
      RouterLink(to="/earth/corpus")
        span 03/B
        strong Corpus · {{ manifest.summary.documents }}
        small Locked source index
      RouterLink(to="/earth/programs")
        span 03/C
        strong Programs · {{ programCount }}
        small Program and method registry
      RouterLink(to="/earth/datasets")
        span 03/D
        strong Data · {{ datasets.summary.metadataAuthenticated }}
        small Metadata-authenticated ledger
</template>
