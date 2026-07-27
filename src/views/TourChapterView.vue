<script setup lang="ts">
import { ref, watch } from 'vue'
import TourDepthControl from '../components/tour/TourDepthControl.vue'
import { useTourProgress } from '../registries/tourProgress'
import { useTourRegistry } from '../registries/tourRegistry'
import type { TourGeneratedChapterRecord } from '../types/tour'

const props = defineProps<{ chapter: string }>()
const tour = useTourRegistry()
const progress = useTourProgress()
const record = ref<TourGeneratedChapterRecord | null>(null)
const loading = ref(true)
const error = ref('')
const notFound = ref(false)

if (!progress.hydrated.value) progress.hydrate()

watch(() => props.chapter, async (chapterId, _previous, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  record.value = null
  loading.value = true
  error.value = ''
  notFound.value = false

  try {
    await tour.initialize()
    if (controller.signal.aborted) return
    if (tour.error.value) throw tour.error.value
    if (!tour.manifest.value) throw new Error('The generated Tour manifest is unavailable.')
    const chapter = await tour.chapterById(chapterId, controller.signal)
    if (controller.signal.aborted) return
    if (!chapter) {
      notFound.value = true
      return
    }
    record.value = chapter
    if (typeof document !== 'undefined') document.title = `${chapter.title} | OpenSimPhy Atlas`
  } catch (reason) {
    if (controller.signal.aborted) return
    error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    if (!controller.signal.aborted) loading.value = false
  }
}, { immediate: true })
</script>

<template lang="pug">
.view.tour-chapter-view
  .loading-plate(v-if="loading") Loading Tour chapter...
  .empty-state(v-else-if="error" role="alert")
    h1 Chapter unavailable
    p {{ error }}
    RouterLink.text-link(to="/tour") Return to the Tour map
  .empty-state(v-else-if="notFound")
    h1 Tour chapter not found
    p No chapter in the current Tour manifest has the ID "{{ chapter }}".
    RouterLink.text-link(to="/tour") Return to the Tour map
  template(v-else-if="record")
    header.view-header
      div
        p.eyebrow Act {{ record.act }} / chapter {{ String(record.order).padStart(2, '0') }} / {{ record.status }}
        h1 {{ record.title }}
        p.lede {{ record.question }}
      TourDepthControl

    section.tour-chapter-summary
      h2 Chapter orientation
      p {{ record.summary }}

    section.tour-lesson-list(v-if="record.status === 'content-ready'" aria-labelledby="lesson-list-title")
      h2#lesson-list-title Lessons
      ol
        li(v-for="(lessonId, index) in record.lessonIds" :key="lessonId")
          RouterLink(:to="`/tour/${record.id}/${lessonId}`")
            span Lesson {{ index + 1 }}
            strong {{ lessonId === 'physical-quantities' ? 'Physical quantities' : lessonId }}
            small {{ progress.state.value.lessons[lessonId]?.complete ? 'Complete' : progress.state.value.lessons[lessonId]?.visited ? 'Visited' : 'Not started' }}

    section.tour-roadmap(v-else aria-labelledby="roadmap-title")
      p.eyebrow Planned chapter
      h2#roadmap-title This chapter is on the field-course roadmap
      p Its scientific question and scope are published, but no lesson is content-ready. Explore the existing instruments without treating them as completion of this chapter.
      .hero-actions
        RouterLink.text-link(to="/atlas") Search the Atlas
        RouterLink.text-link(to="/labs") Open the Workbench
        RouterLink.text-link(to="/evidence") Review evidence boundaries

    nav.tour-chapter-pagination(aria-label="Adjacent Tour chapters")
      RouterLink.text-link(v-if="record.previousChapterId" :to="`/tour/${record.previousChapterId}`") Previous chapter
      RouterLink.text-link(to="/tour") Full Tour map
      RouterLink.text-link(v-if="record.nextChapterId" :to="`/tour/${record.nextChapterId}`") Next chapter
</template>

<style src="../styles/tour.css"></style>
