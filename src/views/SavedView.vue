<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TourDepthControl from '../components/tour/TourDepthControl.vue'
import { useTourOfflinePack } from '../registries/tourOfflinePack'
import { useTourProgress } from '../registries/tourProgress'
import { useTourRegistry } from '../registries/tourRegistry'

const progress = useTourProgress()
const tour = useTourRegistry()
const offlinePack = useTourOfflinePack()
const exported = ref('')
const imported = ref('')
const importResult = ref('')
const confirmClear = ref(false)
const online = ref(typeof navigator === 'undefined' || navigator.onLine)
const updateOnline = () => { online.value = navigator.onLine }

if (!progress.hydrated.value) progress.hydrate()
void tour.initialize()

const visitedLessons = computed(() => Object.values(progress.state.value.lessons).filter(({ visited }) => visited).length)
const completedLessons = computed(() => Object.values(progress.state.value.lessons).filter(({ complete }) => complete).length)
const completedChapters = computed(() => Object.values(progress.state.value.chapters).filter(({ status }) => status === 'complete').length)
const offlineStatus = computed(() => {
  if (offlinePack.status.value === 'installing') return 'Downloading and validating Guided tour files...'
  if (offlinePack.status.value === 'installed') return `Ready offline / revision ${offlinePack.revision.value} / ${offlinePack.itemCount.value} files / ${formatBytes(offlinePack.bytes.value)}`
  if (offlinePack.status.value === 'error') return offlinePack.error.value?.message ?? 'Guided tour download failed.'
  return 'Not downloaded for offline use.'
})

watch(() => tour.manifest.value, (value) => {
  if (value) void offlinePack.hydrate(value)
}, { immediate: true })

onMounted(() => {
  window.addEventListener('online', updateOnline)
  window.addEventListener('offline', updateOnline)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', updateOnline)
  window.removeEventListener('offline', updateOnline)
})

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  return `${(value / 1024).toFixed(value < 1024 * 10 ? 1 : 0)} KB`
}

function downloadGuidedTour(): void {
  if (tour.manifest.value) void offlinePack.download(tour.manifest.value)
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
      h1 Saved Tour Progress
      p.lede Reading depth and Tour progress are stored locally. There is no account, cloud sync, telemetry, or saved-run service.
    TourDepthControl

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
    p Clearing removes the namespaced Tour progress record from this browser only.
    button.text-link(v-if="!confirmClear" type="button" data-testid="request-clear" @click="confirmClear = true") Request clear
    template(v-else)
      p Are you sure? This cannot be recovered unless you exported the JSON.
      button.button-link(type="button" data-testid="confirm-clear" @click="clearProgress") Confirm clear local progress
      button.text-link(type="button" @click="confirmClear = false") Cancel
</template>

<style src="../styles/tour.css"></style>
