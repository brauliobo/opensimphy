<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TourDepthControl from '../components/tour/TourDepthControl.vue'
import { useTourOfflinePack } from '../registries/tourOfflinePack'
import { useTourProgress } from '../registries/tourProgress'
import { useTourRegistry } from '../registries/tourRegistry'
import type { TourGeneratedManifest } from '../types/tour'

const tour = useTourRegistry()
const progress = useTourProgress()
const offlinePack = useTourOfflinePack()
const online = ref(typeof navigator === 'undefined' || navigator.onLine)
const updateOnline = () => { online.value = navigator.onLine }

void tour.initialize()
if (!progress.hydrated.value) progress.hydrate()

const tourReady = computed(() => tour.ready.value
  && !tour.error.value
  && tour.manifest.value !== null
  && tour.taxonomy.value !== null)
const tourError = computed(() => tour.error.value?.message
  ?? (tour.ready.value && !tourReady.value ? 'The generated Tour manifest or taxonomy is unavailable.' : ''))
const stations = computed(() => [...(tour.manifest.value?.quickStations ?? [])].sort((left, right) => left.order - right.order))
const firstStationRoute = computed(() => {
  const station = stations.value.find(({ status, lessonId }) => status === 'content-ready' && lessonId)
  return station ? `/tour/${station.chapterId}/${station.lessonId}?path=quick` : '/tour'
})
const currentChapter = computed(() => {
  const route = progress.resume.value
  if (!route) return null
  const chapterId = route.split(/[/?#]/).filter(Boolean)[1]
  return tour.manifest.value?.chapters.find(({ id }) => id === chapterId) ?? null
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

function stationProgress(stationId: string): 'not-started' | 'visited' | 'complete' {
  const station = progress.state.value.stations[stationId]
  return station?.complete ? 'complete' : station?.visited ? 'visited' : 'not-started'
}
</script>

<template lang="pug">
.view.overview-view(:data-testid="tourReady ? 'tour-ready' : undefined")
  .loading-plate(v-if="!tour.ready.value") Loading Tour orientation...
  .empty-state(v-else-if="tourError" role="alert")
    h1 Tour unavailable
    p {{ tourError }}
  template(v-else-if="tourReady")
    section.home-hero
      p.eyebrow Orientation / field course
      h1 How does physics move from observation to a justified conclusion?
      p.lede {{ tour.manifest?.thesis }}
      .hero-actions
        RouterLink.button-link(:to="firstStationRoute" data-testid="begin-tour") Begin station one
        RouterLink.text-link(v-if="progress.resume.value" :to="progress.resume.value" data-testid="overview-resume") Resume where you left off
        RouterLink.text-link(to="/tour") Open the full Tour map
      TourDepthControl

    section.tour-offline-pack(aria-labelledby="overview-offline-title")
      div
        p.eyebrow Offline / Guided tour only
        h2#overview-offline-title Take the Guided route offline
        p Download the published Guided lessons and their activities to this browser. This happens only when you choose the control below.
      .tour-offline-pack-status
        p(data-testid="guided-pack-network") {{ online ? 'Online' : 'Offline' }}
        p(:data-state="offlinePack.status.value" data-testid="guided-pack-status" role="status") {{ offlineStatus }}
        button.button-link(
          type="button"
          data-testid="guided-pack-download"
          :disabled="offlinePack.status.value === 'installing' || !online"
          @click="downloadGuidedTour"
        ) {{ offlinePack.status.value === 'installed' ? 'Refresh Guided tour' : 'Download Guided tour' }}

    section.tour-orientation-spine(aria-labelledby="station-spine-title")
      .section-heading
        div
          p.eyebrow Quick path / eight stations
          h2#station-spine-title One continuous route through the field course
        p Follow the stations in order. Content-ready stations open a short lesson; planned stations show the published roadmap without pretending the activity is available.
      ol.tour-station-spine
        li.tour-station(
          v-for="station in stations"
          :key="station.id"
          :data-testid="`station-${station.id}`"
          :class="`is-${station.status}`"
          :data-progress="stationProgress(station.id)"
        )
          span.tour-station-tick {{ String(station.order).padStart(2, '0') }}
          RouterLink.tour-station-link(
            v-if="station.status === 'content-ready' && station.lessonId"
            :to="`/tour/${station.chapterId}/${station.lessonId}?path=quick`"
          )
            strong {{ station.title }}
            span {{ station.question }}
            small {{ station.estimatedMinutes }} min / content-ready
            small(:data-testid="`station-progress-${station.id}`") Quick station: {{ stationProgress(station.id) }}
          .tour-station-planned(v-else)
            strong {{ station.title }}
            span {{ station.question }}
            small Planned / {{ station.estimatedMinutes }} min outline

    section.tour-current-preview(aria-labelledby="current-preview-title")
      p.eyebrow Current position
      h2#current-preview-title {{ currentChapter ? currentChapter.title : 'Station one is ready' }}
      p(v-if="progress.resume.value") Your last visited lesson is stored in this browser. Resume to continue without marking anything complete automatically.
      p(v-else) No Tour lesson has been visited in this browser. Start with physical quantities or inspect the complete map.
      RouterLink.text-link(v-if="progress.resume.value" :to="progress.resume.value") Continue current lesson
      RouterLink.text-link(v-else :to="firstStationRoute") Preview station one

    section.tour-local-disclosure(aria-labelledby="local-progress-title")
      p.eyebrow Local notebook
      h2#local-progress-title Progress stays on this device
      p Reading depth, quick-station progress, visited lessons, completion choices, and the resume route use local browser storage only. There is no account, sync service, or telemetry.
      RouterLink.text-link(to="/saved") Inspect or export local progress

    aside.tour-scope-plate(aria-labelledby="scope-title")
      p.eyebrow Scientific scope
      h2#scope-title Reproduction is not validation
      p Running a recorded calculation can reproduce an output under stated inputs. It does not by itself establish an independent prediction, physical mechanism, empirical agreement, or theory validity.
      RouterLink.text-link(to="/evidence") Read the evidence distinctions
</template>

<style src="../styles/tour.css"></style>
