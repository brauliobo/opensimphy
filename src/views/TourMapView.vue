<script setup lang="ts">
import { computed } from 'vue'
import TourDepthControl from '../components/tour/TourDepthControl.vue'
import { useTourProgress } from '../registries/tourProgress'
import { useTourRegistry } from '../registries/tourRegistry'

const actTitles: Record<number, string> = {
  1: 'Act I / Reading physical claims',
  2: 'Act II / Scales and matter',
  3: 'Act III / Mathematical structure',
  4: 'Act IV / Models facing evidence',
}

const tour = useTourRegistry()
const progress = useTourProgress()

void tour.initialize()
if (!progress.hydrated.value) progress.hydrate()

const tourReady = computed(() => tour.ready.value && !tour.error.value && tour.manifest.value !== null)
const tourError = computed(() => tour.error.value?.message
  ?? (tour.ready.value && !tour.manifest.value ? 'The generated Tour manifest is unavailable.' : ''))
const acts = computed(() => [1, 2, 3, 4].map((act) => ({
  act,
  title: actTitles[act],
  chapters: [...(tour.manifest.value?.chapters ?? [])]
    .filter((chapter) => chapter.act === act)
    .sort((left, right) => left.order - right.order),
})))
const currentChapterId = computed(() => {
  const route = progress.resume.value
  return route?.split(/[/?#]/).filter(Boolean)[1]
})

function progressStatus(chapterId: string): string {
  return progress.state.value.chapters[chapterId]?.status ?? 'not-started'
}
</script>

<template lang="pug">
.view.tour-map-view(:data-testid="tourReady ? 'tour-map-ready' : undefined")
  .loading-plate(v-if="!tour.ready.value") Loading Tour map...
  .empty-state(v-else-if="tourError" role="alert")
    h1 Tour map unavailable
    p {{ tourError }}
  template(v-else-if="tourReady")
    header.view-header
      div
        p.eyebrow Full field course / 20 chapters
        h1 Tour Map
        p.lede {{ tour.manifest?.thesis }}
      TourDepthControl

    .tour-map-layout
      nav.tour-chapter-spine(aria-label="Tour chapters")
        section.tour-act(v-for="act in acts" :key="act.act" :data-testid="`tour-act-${act.act}`")
          h2 {{ act.title }}
          ol
            li(
              v-for="chapter in act.chapters"
              :key="chapter.id"
              :class="{ 'is-current': currentChapterId === chapter.id }"
              :data-progress="progressStatus(chapter.id)"
            )
              span.tour-chapter-tick {{ String(chapter.order).padStart(2, '0') }}
              RouterLink(:to="`/tour/${chapter.id}`")
                strong {{ chapter.title }}
                span {{ chapter.question }}
                small {{ chapter.status === 'content-ready' ? 'Available' : 'Planned overview' }} / {{ progressStatus(chapter.id) }}
      aside.tour-map-preview(aria-labelledby="map-preview-title")
        p.eyebrow Current position
        h2#map-preview-title {{ currentChapterId ? 'Continue the Tour' : 'Choose a chapter' }}
        p Planned overview links describe the roadmap. They do not imply available lessons or completion.
        RouterLink.text-link(v-if="progress.resume.value" :to="progress.resume.value") Resume current lesson
        RouterLink.text-link(v-else to="/tour/units/physical-quantities?path=quick") Begin the available lesson
</template>

<style src="../styles/tour.css"></style>
