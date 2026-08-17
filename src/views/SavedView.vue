<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TourDepthControl from '../components/tour/TourDepthControl.vue'
import { useSavedRunRegistry } from '../registries/savedRunRegistry'
import { useTourOfflinePack } from '../registries/tourOfflinePack'
import { useTourProgress } from '../registries/tourProgress'
import { useTourRegistry } from '../registries/tourRegistry'
import type { TourGeneratedManifest } from '../types/tour'
import type { JsonObject, WorkbenchSnapshotV1 } from '../types/workbench'

const progress = useTourProgress()
const tour = useTourRegistry()
const offlinePack = useTourOfflinePack()
const savedRuns = useSavedRunRegistry()
const exported = ref('')
const imported = ref('')
const importResult = ref('')
const confirmClear = ref(false)
const confirmDeleteRun = ref<string | null>(null)
const confirmClearRuns = ref(false)
const savedRunResult = ref('')
const online = ref(typeof navigator === 'undefined' || navigator.onLine)
const updateOnline = () => { online.value = navigator.onLine }

if (!progress.hydrated.value) progress.hydrate()
if (!savedRuns.hydrated.value) savedRuns.hydrate()
void tour.initialize()

const visitedLessons = computed(() => Object.values(progress.state.value.lessons).filter(({ visited }) => visited).length)
const completedLessons = computed(() => Object.values(progress.state.value.lessons).filter(({ complete }) => complete).length)
const completedChapters = computed(() => Object.values(progress.state.value.chapters).filter(({ status }) => status === 'complete').length)
const savedRunPersistenceMessage = computed(() => {
  switch (savedRuns.persistenceError.value?.operation) {
    case 'hydrate':
      return 'Saved runs could not be loaded from browser storage. This session starts with an empty run list; any stored record was not changed.'
    case 'save':
      return 'A saved run is available for this session but could not be saved to browser storage. It will be lost after reload.'
    case 'delete':
      return 'The run was deleted for this session but the change could not be saved to browser storage. It may return after reload.'
    case 'clear':
      return 'Saved runs were cleared for this session but could not be removed from browser storage. They may return after reload.'
    default:
      return ''
  }
})
const offlineStatus = computed(() => {
  if (offlinePack.status.value === 'installing') return 'Downloading and validating Guided tour files...'
  if (offlinePack.status.value === 'installed') return `Ready offline / revision ${offlinePack.revision.value} / ${offlinePack.itemCount.value} files / ${formatBytes(offlinePack.bytes.value)}`
  if (offlinePack.status.value === 'error') return offlinePack.error.value?.message ?? 'Guided tour download failed.'
  return 'Not downloaded for offline use.'
})

watch(() => tour.manifest.value, (value) => {
  if (value) void offlinePack.hydrate(generatedManifest(value))
}, { immediate: true })

onMounted(() => {
  window.addEventListener('online', updateOnline)
  window.addEventListener('offline', updateOnline)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', updateOnline)
  window.removeEventListener('offline', updateOnline)
})

function generatedManifest(value: NonNullable<typeof tour.manifest.value>): TourGeneratedManifest {
  return value as TourGeneratedManifest
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  return `${(value / 1024).toFixed(value < 1024 * 10 ? 1 : 0)} KB`
}

function downloadGuidedTour(): void {
  if (tour.manifest.value) void offlinePack.download(generatedManifest(tour.manifest.value))
}

function runIdentity(run: WorkbenchSnapshotV1): string {
  return run.instrumentId ?? run.programId
}

function runIdentityLabel(run: WorkbenchSnapshotV1): string {
  return run.instrumentId ? 'Instrument ID' : 'Program ID'
}

function formatStructured(value: JsonObject): string {
  return JSON.stringify(value, null, 2)
}

function formulaRecordPath(run: WorkbenchSnapshotV1): string | null {
  if (run.methodId !== 'float64-source-reproduction' || !run.instrumentId) return null
  const match = run.instrumentId.match(/^formula-([1-9]\d{0,2})$/)
  return match ? `/atlas/${match[1]}` : null
}

function deleteSavedRun(timestamp: string): void {
  const deletedPermanently = savedRuns.deleteRun(timestamp)
  confirmDeleteRun.value = null
  savedRunResult.value = deletedPermanently
    ? 'Saved run deleted from this browser.'
    : 'Saved run deleted for this session but the change could not be saved to browser storage. It may return after reload.'
}

function clearSavedRuns(): void {
  const clearedPermanently = savedRuns.clear()
  confirmClearRuns.value = false
  confirmDeleteRun.value = null
  savedRunResult.value = clearedPermanently
    ? 'All saved runs cleared from this browser.'
    : 'Saved runs cleared for this session but could not be removed from browser storage. They may return after reload.'
}

function exportProgress(): void {
  exported.value = progress.exportProgress()
}

function importProgress(): void {
  const valid = progress.importProgress(imported.value)
  if (!valid) {
    importResult.value = 'Import failed. Enter a valid version 1 Tour progress JSON document.'
  } else if (progress.persistenceError.value) {
    importResult.value = 'Progress imported for this session but could not save to browser storage.'
  } else {
    importResult.value = 'Import complete. Local Tour progress now matches the validated JSON.'
  }
}

function clearProgress(): void {
  const clearedPermanently = progress.clear()
  confirmClear.value = false
  exported.value = ''
  imported.value = ''
  importResult.value = clearedPermanently
    ? 'Local Tour progress cleared.'
    : 'Progress cleared for this session but could not be removed from browser storage. It may return after reload.'
}
</script>

<template lang="pug">
.view.saved-view
  header.view-header
    div
      p.eyebrow Local notebook / this browser only
      h1 Local Notebook
      p.lede Reading depth, Tour progress, and explicitly saved runs stay local to this browser. There is no account, cloud sync, or telemetry.
    TourDepthControl

  section.saved-runs(aria-labelledby="saved-runs-title")
    .saved-runs-heading
      div
        p.eyebrow Explicit saves / run ledger
        h2#saved-runs-title Saved runs
        p Runs appear only after an explicit save in a workbench. Formula links return to the current record without loading old inputs or claiming reproducibility.
      p.saved-run-count(data-testid="saved-run-count") {{ savedRuns.runs.value.length }} {{ savedRuns.runs.value.length === 1 ? 'run' : 'runs' }}
    p.saved-run-status(
      v-if="savedRunResult || savedRunPersistenceMessage"
      role="status"
      data-testid="saved-run-status"
    ) {{ savedRunResult || savedRunPersistenceMessage }}
    p.saved-runs-empty(v-if="savedRuns.runs.value.length === 0" data-testid="saved-runs-empty") No runs have been explicitly saved in this browser.
    ol.saved-run-list(v-else)
      li(v-for="run in savedRuns.runs.value" :key="run.timestamp")
        article.saved-run(data-testid="saved-run")
          header.saved-run-header
            div
              p.eyebrow Saved artifact / schema v{{ run.schemaVersion }}
              h3 {{ run.label ?? runIdentity(run) }}
            time(:datetime="run.timestamp") {{ run.timestamp }}
          dl.saved-run-metadata
            div
              dt {{ runIdentityLabel(run) }}
              dd {{ runIdentity(run) }}
            div
              dt Method
              dd {{ run.methodId }}
            div
              dt Source revision
              dd {{ run.sourceRevision }}
            div
              dt Implementation revision
              dd {{ run.implementationRevision }}
            div(v-if="run.modelRevision")
              dt Model revision
              dd {{ run.modelRevision }}
            div(v-if="run.contentRevision")
              dt Content revision
              dd {{ run.contentRevision }}
          .saved-run-structured
            details
              summary Finding
              pre(data-testid="saved-run-finding") {{ formatStructured(run.finding) }}
            details
              summary Provenance
              pre(data-testid="saved-run-provenance") {{ formatStructured(run.provenance) }}
          .saved-run-actions
            RouterLink.button-link(
              v-if="formulaRecordPath(run)"
              :to="formulaRecordPath(run) || '/saved'"
              data-testid="saved-run-formula-link"
            ) Open formula record
            button.text-link(
              v-if="confirmDeleteRun !== run.timestamp"
              type="button"
              data-testid="request-delete-saved-run"
              @click="confirmDeleteRun = run.timestamp"
            ) Delete saved run
            template(v-else)
              span Delete this saved run? This does not affect Tour progress or the Guided download.
              button.button-link(
                type="button"
                data-testid="confirm-delete-saved-run"
                @click="deleteSavedRun(run.timestamp)"
              ) Confirm delete
              button.text-link(type="button" @click="confirmDeleteRun = null") Cancel
    .saved-runs-clear(v-if="savedRuns.runs.value.length > 0")
      button.text-link(
        v-if="!confirmClearRuns"
        type="button"
        data-testid="request-clear-saved-runs"
        @click="confirmClearRuns = true"
      ) Clear all saved runs
      template(v-else)
        p Clear every explicitly saved run? Tour progress and the Guided download remain unchanged.
        button.button-link(type="button" data-testid="confirm-clear-saved-runs" @click="clearSavedRuns") Confirm clear saved runs
        button.text-link(type="button" @click="confirmClearRuns = false") Cancel

  section.saved-progress-summary(aria-labelledby="progress-summary-title")
    h2#progress-summary-title Progress summary
    dl
      div
        dt Visited lessons
        dd {{ visitedLessons }}
      div
        dt Completed lessons
        dd {{ completedLessons }}
      div
        dt Completed chapters
        dd {{ completedChapters }}
    p(v-if="visitedLessons === 0") No Tour lessons have been visited in this browser.
    RouterLink.button-link(v-if="progress.resume.value" :to="progress.resume.value" data-testid="saved-resume") Resume Tour
    RouterLink.text-link(v-else to="/tour") Choose a Tour chapter

  section.tour-offline-pack.saved-offline-pack(aria-labelledby="saved-offline-title")
    div
      p.eyebrow Offline / Guided tour only
      h2#saved-offline-title Guided tour download
      p Store the published Guided lessons and their activities in this browser. Downloading starts only from this control.
    .tour-offline-pack-status
      p(data-testid="guided-pack-network") {{ online ? 'Online' : 'Offline' }}
      p(:data-state="offlinePack.status.value" data-testid="guided-pack-status" role="status") {{ offlineStatus }}
      button.button-link(
        type="button"
        data-testid="guided-pack-download"
        :disabled="offlinePack.status.value === 'installing' || !online || !tour.manifest.value"
        @click="downloadGuidedTour"
      ) {{ offlinePack.status.value === 'installed' ? 'Refresh Guided tour' : 'Download Guided tour' }}
      button.text-link(
        v-if="offlinePack.status.value === 'installed'"
        type="button"
        data-testid="guided-pack-clear"
        @click="offlinePack.clear"
      ) Clear Guided tour download

  section.saved-transfer(aria-labelledby="export-title")
    h2#export-title Export progress JSON
    p Exported text contains only the local Tour progress schema shown on this page.
    button.button-link(type="button" data-testid="export-progress" @click="exportProgress") Show export JSON
    pre.saved-export(v-if="exported" data-testid="export-output") {{ exported }}

  section.saved-transfer(aria-labelledby="import-title")
    h2#import-title Import progress JSON
    label(for="progress-import") Version 1 Tour progress JSON
    textarea#progress-import(v-model="imported" rows="10" data-testid="import-progress")
    button.button-link(type="button" data-testid="submit-import" @click="importProgress") Validate and import
    p(v-if="importResult" role="status" data-testid="import-result") {{ importResult }}

  section.saved-clear(aria-labelledby="clear-title")
    h2#clear-title Clear local progress
    p Clearing removes only the namespaced Tour progress record from this browser. Saved runs and the Guided download remain unchanged.
    button.text-link(v-if="!confirmClear" type="button" data-testid="request-clear" @click="confirmClear = true") Request clear
    template(v-else)
      p Are you sure? This cannot be recovered unless you exported the JSON.
      button.button-link(type="button" data-testid="confirm-clear" @click="clearProgress") Confirm clear local progress
      button.text-link(type="button" @click="confirmClear = false") Cancel
</template>

<style src="../styles/tour.css"></style>

<style scoped>
.saved-runs {
  width: min(100%, 1100px);
  padding: clamp(2.5rem, 5vw, 5rem) 0;
  border-bottom: 1px solid var(--rule-bright);
}

.saved-runs-heading,
.saved-run-header,
.saved-run-actions {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.saved-runs-heading > div,
.saved-run-header > div {
  min-width: 0;
}

.saved-runs-heading p:not(.eyebrow),
.saved-runs-empty {
  max-width: 68ch;
  color: var(--paper-dim);
  font-family: var(--serif);
  line-height: 1.65;
}

.saved-run-count,
.saved-run-status {
  padding: 0.75rem 1rem;
  overflow-wrap: anywhere;
  font-family: var(--mono);
  font-size: 0.875rem;
  border: 1px solid var(--rule-bright);
}

.saved-run-status {
  margin: 1.5rem 0 0;
  color: var(--amber);
}

.saved-run-list {
  padding: 0;
  margin: 2rem 0 0;
  list-style: none;
}

.saved-run-list > li + li {
  margin-top: 1.5rem;
}

.saved-run {
  min-width: 0;
  padding: clamp(1.25rem, 3vw, 2rem);
  border: 1px solid var(--rule-bright);
  background: var(--ink-0);
}

.saved-run-header time {
  flex: 0 1 auto;
  overflow-wrap: anywhere;
  color: var(--paper-dim);
  font-family: var(--mono);
  font-size: 0.8125rem;
}

.saved-run-metadata {
  display: grid;
  margin: 1.5rem 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid var(--rule-bright);
  border-left: 1px solid var(--rule-bright);
}

.saved-run-metadata div {
  min-width: 0;
  padding: 0.8rem;
  border-right: 1px solid var(--rule-bright);
  border-bottom: 1px solid var(--rule-bright);
}

.saved-run-metadata dt,
.saved-run-metadata dd {
  overflow-wrap: anywhere;
  font-family: var(--mono);
}

.saved-run-metadata dt {
  color: var(--paper-dim);
  font-size: 0.75rem;
  text-transform: uppercase;
}

.saved-run-metadata dd {
  margin: 0.35rem 0 0;
  color: var(--cyan);
  font-size: 0.875rem;
}

.saved-run-structured {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.saved-run-structured details {
  min-width: 0;
  border: 1px solid var(--rule-bright);
}

.saved-run-structured summary {
  display: flex;
  min-height: 44px;
  padding: 0.7rem 0.9rem;
  align-items: center;
  color: var(--amber);
  font-family: var(--mono);
  font-size: 0.875rem;
  cursor: pointer;
}

.saved-run-structured pre {
  max-width: 100%;
  padding: 1rem;
  margin: 0;
  overflow: auto;
  color: var(--paper-dim);
  font-family: var(--mono);
  font-size: 0.8125rem;
  line-height: 1.55;
  border-top: 1px solid var(--rule-bright);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.saved-run-actions {
  margin-top: 1.25rem;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
}

.saved-run-actions span,
.saved-runs-clear p {
  max-width: 60ch;
  color: var(--paper-dim);
  font-family: var(--serif);
}

.saved-run-actions :is(a, button),
.saved-runs-clear button {
  min-height: 44px;
}

.saved-run-actions .text-link,
.saved-runs-clear .text-link {
  padding: 0.6rem 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.saved-runs-clear {
  padding-top: 1.5rem;
  margin-top: 2rem;
  border-top: 1px solid var(--rule-bright);
}

.saved-runs-clear :is(.button-link, .text-link) + .text-link {
  margin-left: 1rem;
}

@media (max-width: 700px) {
  .saved-runs-heading,
  .saved-run-header {
    flex-direction: column;
  }

  .saved-run-count {
    align-self: stretch;
  }

  .saved-run-metadata,
  .saved-run-structured {
    grid-template-columns: 1fr;
  }

  .saved-run-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .saved-run-actions :is(a, button),
  .saved-runs-clear button {
    width: 100%;
  }

  .saved-runs-clear :is(.button-link, .text-link) + .text-link {
    margin: 0.75rem 0 0;
  }
}
</style>
