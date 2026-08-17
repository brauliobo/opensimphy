<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import EarthLocalNav from '../components/EarthLocalNav.vue'
import EarthModelCard from '../components/EarthModelCard.vue'
import { loadEarthManifest, type EarthManifest } from '../earth/corpus'
import { loadEarthDatasetRegistry, type EarthDatasetRegistry } from '../earth/datasets'
import {
  EARTH_BLOCKED_SOURCE_MODELS,
  EARTH_PARTICLE_CAMPAIGN_CARDS,
} from '../earth/particleCampaign'
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
      p.lede One path: open a model card, read what it claims, compare EARTH | Thad | Nassim | SM, then run. Execution is not validation.
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
          p.eyebrow Reading order
          h2 Model → what it claims → EARTH | Thad | Nassim | SM → run
        p Thad is a constants constructor, not a field theory. Nassim’s only clean particle prediction is r_p=4λ_p. EARTH printed α/Bohr/ħ/φ⁶ fail literal arithmetic. Failed rows stay failed.
      ol.earth-path
        li Open the model card
        li Read what it is and what it is not
        li Compare EARTH | Thad | Nassim | SM
        li Run. A result is not confirmation.

    section.earth-campaign-models(data-testid="earth-campaign-models" aria-label="Particle and quantum models")
      header.section-heading
        div
          p.eyebrow Particle / quantum models
          h2 Ten runnable cards
        p Same programs as the campaign slugs. No extra dashboard.
      .earth-campaign-grid
        RouterLink.earth-campaign-link(
          v-for="card in EARTH_PARTICLE_CAMPAIGN_CARDS"
          :key="card.slug"
          :to="`/earth/programs/${card.programId}`"
        )
          EarthModelCard(:card="card")
      header.section-heading
        div
          p.eyebrow Blocked source models
          h2 Stay blocked
        p Missing operators stay missing. Do not treat a gap as a result.
      .earth-campaign-grid.is-blocked
        EarthModelCard(v-for="card in EARTH_BLOCKED_SOURCE_MODELS" :key="card.slug" :card="card")

    section.earth-execution-note
      strong EXECUTION ≠ VALIDATION
      div
        h2 What a run can show
        p A method can print finite numbers and fill the prediction table. That is reproduction, not agreement with nature.
      div
        h2 What stays unproven
        p Registries keep #[code scientificallyValidated: false]. Falsified arithmetic is failed, not confirmed physics.

    nav.earth-section-index(aria-label="EARTH dossier sections")
      RouterLink(to="/earth/corpus")
        span 03/B
        strong Corpus · {{ manifest.summary.documents }}
        small Locked source index
      RouterLink(to="/earth/programs")
        span 03/C
        strong Programs · {{ programCount }}
        small All 130 program records
      RouterLink(to="/earth/datasets")
        span 03/D
        strong Data · {{ datasets.summary.metadataAuthenticated }}
        small Metadata only
</template>
