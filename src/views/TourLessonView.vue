<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import ConclusionBoundary from '../components/tour/ConclusionBoundary.vue'
import EquationLadder from '../components/tour/EquationLadder.vue'
import TourDepthControl from '../components/tour/TourDepthControl.vue'
import TourSimulationStage from '../components/tour/TourSimulationStage.vue'
import { useTourProgress } from '../registries/tourProgress'
import { useTourRegistry } from '../registries/tourRegistry'
import { isSafeTourAnchor } from '../tour/progress'
import type {
  Checkpoint,
  LessonBlock,
  ObservationItemRole,
  TourGeneratedChapterRecord,
  TourGeneratedLessonRecord,
  TourGeneratedSimulation,
  TourGlossaryEntry,
  TourReference,
  TourReferencesSource,
  TourSourceAttribution,
} from '../types/tour'

const props = defineProps<{ chapter: string, lesson: string }>()
const route = useRoute()
const router = useRouter()
const registry = useTourRegistry()
const progress = useTourProgress()

const chapterRecord = ref<TourGeneratedChapterRecord | null>(null)
const lessonRecord = ref<TourGeneratedLessonRecord | null>(null)
const simulation = ref<TourGeneratedSimulation | null>(null)
const glossaryEntries = ref<TourGlossaryEntry[]>([])
const referenceEntries = ref<TourReference[]>([])
const loading = ref(true)
const loadError = ref('')
const notFound = ref(false)
const completionAnnouncement = ref('')
const checkpointSelections = ref<Record<string, string>>({})
const revealedCheckpoints = ref<Set<string>>(new Set())
const lessonSections = ref<HTMLElement | null>(null)
let loadGeneration = 0
let activeController: AbortController | null = null
let sectionObserver: IntersectionObserver | null = null
let lastRecordedAnchor = ''

const isQuickPath = computed(() => route.query.path === 'quick' && Boolean(lessonRecord.value?.quickPath))
const currentStation = computed(() => {
  const chapter = chapterRecord.value
  const lesson = lessonRecord.value
  if (!chapter || !lesson || !isQuickPath.value) return null
  return registry.manifest.value?.quickStations.find((station) => station.status === 'content-ready'
    && station.chapterId === chapter.id
    && station.lessonId === lesson.id) ?? null
})
const contextLabel = computed(() => {
  const lesson = lessonRecord.value
  if (!lesson) return ''
  return isQuickPath.value
    ? `Quick station / ${lesson.quickPath!.estimatedMinutes} min`
    : `Full lesson / ${lesson.estimatedMinutes} min`
})
const visibleGuidedBlocks = computed(() => {
  const lesson = lessonRecord.value
  if (!lesson) return []
  if (!isQuickPath.value) return lesson.guidedBlocks
  const ids = new Set(lesson.quickPath!.guidedBlockIds)
  return lesson.guidedBlocks.filter(({ id }) => ids.has(id))
})
const visibleBlocks = computed<LessonBlock[]>(() => {
  const guided = visibleGuidedBlocks.value
  if (progress.depth.value !== 'technical') return guided
  return [...guided, ...(lessonRecord.value?.technicalBlocks ?? [])]
})
const explainBlocks = computed(() => visibleBlocks.value)
const equationSteps = computed(() => {
  const lesson = lessonRecord.value
  if (!lesson) return []
  if (!isQuickPath.value || progress.depth.value === 'technical') return lesson.equationSteps
  const ids = new Set(lesson.quickPath!.equationStepIds)
  return lesson.equationSteps.filter(({ id }) => ids.has(id))
})
const checkpoints = computed<Checkpoint[]>(() => {
  const lesson = lessonRecord.value
  if (!lesson) return []
  if (!isQuickPath.value) return lesson.checkpoints
  const ids = new Set(lesson.quickPath!.checkpointIds)
  return lesson.checkpoints.filter(({ id }) => ids.has(id))
})
const lessonGlossary = computed(() => {
  const ids = new Set(lessonRecord.value?.glossaryIds ?? [])
  return glossaryEntries.value.filter(({ id }) => ids.has(id))
})
const lessonReferences = computed(() => {
  const lesson = lessonRecord.value
  if (!lesson) return []
  const conclusionStatements = [
    ...lesson.seenInActivity,
    ...lesson.computedHere,
    ...lesson.reproducedFromSource,
    ...lesson.comparedWithEvidence,
    ...lesson.establishes,
    ...lesson.doesNotEstablish,
  ]
  const ids = new Set([
    ...lesson.evidenceRefs,
    ...(simulation.value?.finding.evidenceRefs ?? []),
    ...conclusionStatements.flatMap(({ attribution }) => attribution.evidenceRefs),
  ])
  return referenceEntries.value.filter(({ id }) => ids.has(id))
})
const lessonComplete = computed(() => lessonRecord.value
  ? progress.state.value.lessons[lessonRecord.value.id]?.complete === true
  : false)
const stationComplete = computed(() => currentStation.value
  ? progress.state.value.stations[currentStation.value.id]?.complete === true
  : false)
const currentComplete = computed(() => isQuickPath.value ? stationComplete.value : lessonComplete.value)
const initialPresetId = computed(() => isQuickPath.value ? lessonRecord.value?.quickPath?.simulationPresetId : undefined)
const fullLessonLocation = computed(() => ({
  path: route.path,
  query: Object.fromEntries(Object.entries(route.query).filter(([key]) => key !== 'path')),
  hash: route.hash,
}))
const formulaReturnTo = computed(() => {
  const chapter = chapterRecord.value
  const lesson = lessonRecord.value
  if (!chapter || !lesson) return ''
  return router.resolve({
    name: 'tour-lesson',
    params: { chapter: chapter.id, lesson: lesson.id },
    query: route.query.path === 'quick' ? { path: 'quick' } : {},
    hash: '#interpret',
  }).fullPath
})
const previousNavigation = computed(() => navigationFor('previous'))
const nextNavigation = computed(() => navigationFor('next'))

interface TourNavigation {
  label: string
  to: string
}

function chapterNavigation(chapterId: string | null, direction: 'Previous' | 'Next'): TourNavigation | null {
  if (!chapterId) return null
  const target = registry.manifest.value?.chapters.find(({ id }) => id === chapterId)
  return target ? { label: `${direction} chapter: ${target.title}`, to: `/tour/${encodeURIComponent(target.id)}` } : null
}

function navigationFor(direction: 'previous' | 'next'): TourNavigation | null {
  const chapter = chapterRecord.value
  const lesson = lessonRecord.value
  if (!chapter || !lesson) return null
  const titleDirection = direction === 'previous' ? 'Previous' : 'Next'
  const lessonIndex = chapter.lessonIds.indexOf(lesson.id)
  const targetLessonId = lessonIndex === -1
    ? null
    : chapter.lessonIds[lessonIndex + (direction === 'previous' ? -1 : 1)]
  if (targetLessonId) {
    return {
      label: `${titleDirection} lesson`,
      to: `/tour/${encodeURIComponent(chapter.id)}/${encodeURIComponent(targetLessonId)}`,
    }
  }
  return chapterNavigation(direction === 'previous' ? chapter.previousChapterId : chapter.nextChapterId, titleDirection)
}

function formulaLocation(formulaId: string): RouteLocationRaw {
  return {
    name: 'formula',
    params: { id: formulaId },
    query: { returnTo: formulaReturnTo.value },
  }
}

function isAbortError(reason: unknown): boolean {
  return reason instanceof DOMException
    ? reason.name === 'AbortError'
    : reason instanceof Error && reason.name === 'AbortError'
}

function setActualTitle(title: string): void {
  if (typeof document !== 'undefined') document.title = `${title} | OpenSimPhy Atlas`
}

function setLessonTitle(): void {
  const lesson = lessonRecord.value
  if (!lesson) return
  setActualTitle(isQuickPath.value ? `Quick station: ${lesson.title}` : lesson.title)
}

function resetCheckpointState(): void {
  checkpointSelections.value = {}
  revealedCheckpoints.value = new Set()
}

function selectCheckpoint(checkpointId: string, choiceId: string): void {
  checkpointSelections.value = { ...checkpointSelections.value, [checkpointId]: choiceId }
}

function revealCheckpoint(checkpointId: string): void {
  if (!checkpointSelections.value[checkpointId]) return
  revealedCheckpoints.value = new Set([...revealedCheckpoints.value, checkpointId])
}

function completeCurrentLesson(): void {
  const chapter = chapterRecord.value
  const lesson = lessonRecord.value
  if (!chapter || !lesson || currentComplete.value) return
  if (isQuickPath.value) {
    const station = currentStation.value
    if (!station) return
    progress.completeStation(station.id, route.fullPath)
    completionAnnouncement.value = 'Station marked complete.'
    return
  }
  progress.completeLesson(chapter.id, lesson.id, route.fullPath)
  progress.markChapterComplete(chapter.id, chapter.lessonIds)
  completionAnnouncement.value = 'Lesson marked complete.'
}

const OBSERVATION_ROLE_LABELS: Readonly<Record<ObservationItemRole, string>> = Object.freeze({
  'fixed-definition': 'Fixed definition',
  'measured-reference': 'Measured reference',
  'derived-model-value': 'Derived model value',
  'conventional-value': 'Conventional value',
  'model-input': 'Model input',
  'illustrative-scale': 'Illustrative scale',
  'practical-realization': 'Practical realization',
})

function observationRole(role: ObservationItemRole): string {
  return OBSERVATION_ROLE_LABELS[role]
}

function attributionEvidence(attribution: TourSourceAttribution): string {
  return attribution.evidenceRefs.join(', ')
}

function referencesFrom(source: TourReferencesSource | null): TourReference[] {
  return source?.entries ?? []
}

function disconnectSectionObserver(): void {
  sectionObserver?.disconnect()
  sectionObserver = null
}

function recordAnchor(anchor: string): void {
  const lesson = lessonRecord.value
  if (!lesson || !isSafeTourAnchor(anchor)) return
  const normalizedAnchor = anchor.startsWith('#') ? anchor : `#${anchor}`
  if (lastRecordedAnchor === normalizedAnchor && progress.resume.value?.endsWith(normalizedAnchor)) return
  lastRecordedAnchor = normalizedAnchor
  progress.setLastAnchor(lesson.id, normalizedAnchor)
}

function recordEventSection(event: Event): void {
  const target = event.target
  const section = target instanceof Element ? target.closest<HTMLElement>('[data-tour-section]') : null
  if (section?.id && lessonSections.value?.contains(section)) recordAnchor(`#${section.id}`)
}

function observeLessonSections(): void {
  disconnectSectionObserver()
  const container = lessonSections.value
  if (!container || typeof IntersectionObserver === 'undefined') return
  sectionObserver = new IntersectionObserver((entries) => {
    const sectionOrder = [...container.querySelectorAll<HTMLElement>('[data-tour-section]')]
    const visible = entries
      .filter(({ isIntersecting, target }) => isIntersecting && target instanceof HTMLElement && container.contains(target))
      .sort((left, right) => sectionOrder.indexOf(left.target as HTMLElement) - sectionOrder.indexOf(right.target as HTMLElement))
    const section = visible.at(-1)?.target
    if (section instanceof HTMLElement && section.id) recordAnchor(`#${section.id}`)
  }, { rootMargin: '-20% 0px -79% 0px', threshold: 0 })
  container.querySelectorAll<HTMLElement>('[data-tour-section]').forEach((section) => sectionObserver?.observe(section))
}

function restoreHashTarget(): void {
  if (typeof document === 'undefined' || !route.hash || !isSafeTourAnchor(route.hash)) return
  const target = document.getElementById(route.hash.slice(1))
  if (!target || !lessonSections.value?.contains(target)) return
  target.scrollIntoView?.()
  target.focus({ preventScroll: true })
}

function routeMatchesLoadedLesson(): boolean {
  return route.params.chapter === chapterRecord.value?.id && route.params.lesson === lessonRecord.value?.id
}

async function syncRouteContext(): Promise<void> {
  const chapter = chapterRecord.value
  const lesson = lessonRecord.value
  if (!chapter || !lesson || !routeMatchesLoadedLesson()) return
  progress.visitLesson(chapter.id, lesson.id, route.fullPath)
  if (isQuickPath.value && currentStation.value) progress.visitStation(currentStation.value.id, route.fullPath)
  setLessonTitle()
  await nextTick()
  if (!routeMatchesLoadedLesson()) return
  observeLessonSections()
  restoreHashTarget()
}

watch(isQuickPath, () => {
  resetCheckpointState()
  completionAnnouncement.value = ''
})

watch(() => route.fullPath, () => {
  if (!routeMatchesLoadedLesson()) return
  void syncRouteContext()
})

watch(() => [props.chapter, props.lesson] as const, async ([chapterId, lessonId], _previous, onCleanup) => {
  const attempt = ++loadGeneration
  const controller = new AbortController()
  activeController?.abort()
  activeController = controller
  onCleanup(() => {
    controller.abort()
    if (activeController === controller) activeController = null
  })

  loading.value = true
  loadError.value = ''
  notFound.value = false
  chapterRecord.value = null
  lessonRecord.value = null
  simulation.value = null
  glossaryEntries.value = []
  referenceEntries.value = []
  completionAnnouncement.value = ''
  disconnectSectionObserver()
  lastRecordedAnchor = ''
  resetCheckpointState()
  if (!progress.hydrated.value) progress.hydrate()

  try {
    await registry.initialize()
    if (controller.signal.aborted || attempt !== loadGeneration) return
    if (registry.error.value) throw registry.error.value

    const [loadedChapter, loadedLesson, glossary, references] = await Promise.all([
      registry.chapterById(chapterId, controller.signal),
      registry.lessonById(lessonId, controller.signal),
      registry.loadGlossary(controller.signal),
      registry.loadReferences(controller.signal),
    ])
    if (controller.signal.aborted || attempt !== loadGeneration) return
    if (!loadedChapter || !loadedLesson || loadedLesson.chapterId !== chapterId) {
      notFound.value = true
      setActualTitle('Not Found')
      return
    }

    const loadedSimulation = loadedLesson.simulationId
      ? await registry.simulationById(loadedLesson.simulationId, controller.signal)
      : null
    if (controller.signal.aborted || attempt !== loadGeneration) return
    if (loadedLesson.simulationId && !loadedSimulation) {
      throw new Error(`Tour simulation ${loadedLesson.simulationId} is unavailable.`)
    }

    chapterRecord.value = loadedChapter
    lessonRecord.value = loadedLesson
    simulation.value = loadedSimulation
    glossaryEntries.value = glossary?.entries ?? []
    referenceEntries.value = referencesFrom(references)
    lastRecordedAnchor = progress.state.value.lessons[loadedLesson.id]?.lastAnchor ?? ''
    loading.value = false
    setLessonTitle()
    await syncRouteContext()
  } catch (reason) {
    if (!controller.signal.aborted && attempt === loadGeneration && !isAbortError(reason)) {
      loadError.value = reason instanceof Error ? reason.message : String(reason)
    }
  } finally {
    if (!controller.signal.aborted && attempt === loadGeneration) loading.value = false
  }
}, { immediate: true })

onUnmounted(() => {
  loadGeneration += 1
  activeController?.abort()
  activeController = null
  disconnectSectionObserver()
})
</script>

<template lang="pug">
.view.tour-lesson-view(:data-testid="!loading && lessonRecord ? 'tour-lesson-ready' : undefined")
  p.tour-loading(v-if="loading" role="status") Loading Tour lesson...

  .empty-state(v-else-if="loadError" role="alert" data-testid="tour-lesson-error")
    h1 Lesson unavailable
    p {{ loadError }}
    RouterLink(to="/tour") Return to the Tour

  .empty-state(v-else-if="notFound" data-testid="tour-lesson-not-found")
    h1 Lesson not found
    p The requested chapter and lesson are not declared together.
    RouterLink(to="/tour") Return to the Tour

  template(v-else-if="lessonRecord && chapterRecord")
    header.tour-lesson-header
      div
        RouterLink(:to="`/tour/${encodeURIComponent(chapterRecord.id)}`") {{ chapterRecord.title }}
        p.eyebrow {{ contextLabel }}
        p(v-if="isQuickPath && progress.depth.value === 'technical'" data-testid="quick-technical-estimate") The time shown is the Guided quick estimate; Technical depth adds extension material.
      .tour-lesson-title
        h1 {{ lessonRecord.title }}
        p {{ lessonRecord.answerPreview }}
      .tour-lesson-controls
        TourDepthControl
        RouterLink(v-if="isQuickPath" :to="fullLessonLocation" data-testid="full-lesson-link") Open full lesson
        span.status-chip(v-if="currentComplete" data-testid="lesson-completed-state") {{ isQuickPath ? 'Station completed' : 'Lesson completed' }}
      details.tour-metadata.lesson-attribution
        summary Lesson attribution
        dl
          dt Claim class
          dd {{ lessonRecord.attribution.claimClass }}
          dt Evidence
          dd {{ attributionEvidence(lessonRecord.attribution) }}
          dt Source revision
          dd {{ lessonRecord.attribution.sourceRevision }}
          dt Source locator
          dd {{ lessonRecord.attribution.sourceLocator }}

    .tour-lesson-sections(ref="lessonSections" @click="recordEventSection" @focusin="recordEventSection")
      section#question(tabindex="-1" data-tour-section="question" aria-labelledby="question-heading")
        p.eyebrow 01 / Question
        h2#question-heading Question
        p.tour-question {{ lessonRecord.question }}

      section#observe(tabindex="-1" data-tour-section="observe" aria-labelledby="observe-heading")
        p.eyebrow 02 / Observe
        h2#observe-heading Observe
        article.tour-block(data-testid="observation-stage")
          h3 {{ lessonRecord.observationStage.title }}
          p {{ lessonRecord.observationStage.question }}
          ol
            li(
              v-for="item in lessonRecord.observationStage.items"
              :key="item.id"
              :data-observation-id="item.id"
            )
              strong {{ item.label }}
              p {{ item.value }} {{ item.unit }}
              p Role: {{ observationRole(item.role) }}
              p {{ item.explanation }}
              p Evidence: {{ item.evidenceRefs.join(', ') }}
          p #[strong Observation conclusion:] {{ lessonRecord.observationStage.conclusion }}
          details.tour-metadata
            summary Observation attribution
            dl
              dt Claim class
              dd {{ lessonRecord.observationStage.attribution.claimClass }}
              dt Method relationship
              dd {{ lessonRecord.observationStage.attribution.methodRelationship }}
              dt Source revision
              dd {{ lessonRecord.observationStage.attribution.sourceRevision }}
              dt Source locator
              dd {{ lessonRecord.observationStage.attribution.sourceLocator }}
              dt Evidence
              dd {{ attributionEvidence(lessonRecord.observationStage.attribution) }}
            ul(v-if="lessonRecord.observationStage.attribution.caveats.length")
              li(v-for="caveat in lessonRecord.observationStage.attribution.caveats" :key="caveat") {{ caveat }}

      section#explain(tabindex="-1" data-tour-section="explain" aria-labelledby="explain-heading")
        p.eyebrow 03 / Explain
        h2#explain-heading Explain
        article.tour-block(v-for="block in explainBlocks" :key="block.id" :data-block-id="block.id")
          p.tour-block-kind {{ block.kind }}
          h3 {{ block.title }}
          p(v-for="line in block.body" :key="line") {{ line }}
          details.tour-metadata
            summary Source and caveats
            dl
              dt Claim class
              dd {{ block.claimClass }}
              dt Method relationship
              dd {{ block.methodRelationship }}
              dt Source revision
              dd {{ block.sourceRevision }}
              dt Source locator
              dd {{ block.sourceLocator }}
              dt Evidence
              dd {{ attributionEvidence(block) }}
            ul(v-if="block.caveats.length")
              li(v-for="caveat in block.caveats" :key="caveat") {{ caveat }}

      section#equation-ladder(tabindex="-1" data-tour-section="equation-ladder" aria-labelledby="equation-ladder-heading")
        p.eyebrow 04 / Equation ladder
        h2#equation-ladder-heading Equation ladder
        EquationLadder(:steps="equationSteps")

      section#try(tabindex="-1" data-tour-section="try" aria-labelledby="try-heading")
        p.eyebrow 05 / Try
        h2#try-heading Try
        TourSimulationStage(
          v-if="simulation"
          :simulation="simulation"
          :depth="progress.depth.value"
          :initial-preset-id="initialPresetId"
        )

        .tour-checkpoints(data-testid="tour-checkpoints")
          article(v-for="checkpoint in checkpoints" :key="checkpoint.id" :data-checkpoint-id="checkpoint.id")
            fieldset
              legend {{ checkpoint.prompt }}
              label(v-for="choice in checkpoint.choices" :key="choice.id")
                input(
                  type="radio"
                  :name="`checkpoint-${checkpoint.id}`"
                  :value="choice.id"
                  :checked="checkpointSelections[checkpoint.id] === choice.id"
                  @change="selectCheckpoint(checkpoint.id, choice.id)"
                )
                span {{ choice.label }}
            button(
              type="button"
              :disabled="!checkpointSelections[checkpoint.id]"
              :data-testid="`checkpoint-reveal-${checkpoint.id}`"
              @click="revealCheckpoint(checkpoint.id)"
            ) Reveal explanation
            .checkpoint-explanation(
              v-if="revealedCheckpoints.has(checkpoint.id)"
              :data-testid="`checkpoint-explanation-${checkpoint.id}`"
            )
              p {{ checkpoint.explanation }}
              details.tour-metadata
                summary Explanation attribution
                p {{ checkpoint.attribution.sourceRevision }}
                p {{ checkpoint.attribution.sourceLocator }}
                p {{ attributionEvidence(checkpoint.attribution) }}

      section#interpret(tabindex="-1" data-tour-section="interpret" aria-labelledby="interpret-heading")
        p.eyebrow 06 / Interpret
        h2#interpret-heading Interpret
        p.tour-summary {{ lessonRecord.summary }}
        ConclusionBoundary(
          :seen-in-activity="lessonRecord.seenInActivity"
          :computed-here="lessonRecord.computedHere"
          :reproduced-from-source="lessonRecord.reproducedFromSource"
          :compared-with-evidence="lessonRecord.comparedWithEvidence"
          :establishes="lessonRecord.establishes"
          :does-not-establish="lessonRecord.doesNotEstablish"
        )

        details.tour-resource-disclosure(v-if="lessonGlossary.length")
          summary Glossary
          dl
            template(v-for="entry in lessonGlossary" :key="entry.id")
              dt {{ entry.term }}
              dd
                p {{ entry.guidedDefinition }}
                p(v-if="progress.depth.value === 'technical'") {{ entry.technicalDefinition }}

        .tour-resource-links
          RouterLink(
            v-for="formulaId in lessonRecord.formulaIds"
            :key="formulaId"
            :to="formulaLocation(formulaId)"
            :aria-label="`Formula ${formulaId}, opens Formula record`"
          ) {{ formulaId }}
          RouterLink(to="/evidence") Evidence

        details.tour-resource-disclosure
          summary Source references
          ul
            li(v-for="reference in lessonReferences" :id="`reference-${reference.id}`" :key="reference.id")
              a(
                :href="reference.url"
                target="_blank"
                rel="noreferrer"
                :aria-label="`${reference.title} (opens in new tab)`"
              ) {{ reference.title }} (opens in new tab)
              span {{ reference.revision }} / {{ reference.sourceLocator }}

        .tour-completion
          button(
            type="button"
            :disabled="currentComplete"
            data-testid="mark-lesson-complete"
            @click="completeCurrentLesson"
          ) {{ currentComplete ? (isQuickPath ? 'Station complete' : 'Lesson complete') : 'Mark complete' }}
          p(aria-live="polite" data-testid="completion-announcement") {{ completionAnnouncement }}

    nav.tour-lesson-navigation(aria-label="Tour lesson navigation")
      RouterLink(v-if="previousNavigation" :to="previousNavigation.to") {{ previousNavigation.label }}
      RouterLink(:to="`/tour/${encodeURIComponent(chapterRecord.id)}`") Chapter overview
      RouterLink(v-if="nextNavigation" :to="nextNavigation.to") {{ nextNavigation.label }}
</template>

<style src="../styles/tour.css"></style>

<style scoped>
.tour-lesson-view {
  max-width: 1120px;
  margin: 0 auto;
}

.tour-lesson-header {
  display: grid;
  grid-template-columns: minmax(10rem, 0.55fr) minmax(0, 1.6fr) minmax(12rem, 0.7fr);
  gap: 1.5rem;
  align-items: start;
  padding-block: 2rem;
  border-bottom: 1px solid var(--line, #494949);
}

.tour-lesson-title h1 {
  margin-top: 0;
}

.tour-lesson-controls,
.tour-resource-links,
.tour-lesson-navigation {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.lesson-attribution {
  grid-column: 2 / -1;
}

.tour-lesson-sections > section {
  padding-block: 2.25rem;
  border-bottom: 1px solid var(--line, #494949);
}

.tour-question {
  max-width: 50rem;
  font-size: clamp(1.35rem, 3vw, 2.35rem);
  line-height: 1.2;
}

.tour-block {
  max-width: 56rem;
  margin-block: 1rem;
}

.tour-block-kind {
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
}

.tour-metadata,
.tour-resource-disclosure {
  margin-top: 1rem;
  font-size: 0.84rem;
}

.tour-metadata dl,
.tour-resource-disclosure dl {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 0.35rem 0.8rem;
}

.tour-metadata dd,
.tour-resource-disclosure dd {
  margin: 0;
}

.tour-checkpoints {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}

.tour-checkpoints article {
  padding: 1rem;
  border: 1px solid var(--line, #494949);
}

.tour-checkpoints label {
  display: flex;
  gap: 0.5rem;
  margin-block: 0.55rem;
}

.checkpoint-explanation {
  margin-top: 1rem;
}

.tour-resource-links {
  margin-block: 1.5rem;
}

.tour-resource-disclosure li {
  margin-block: 0.6rem;
}

.tour-resource-disclosure li span {
  display: block;
  opacity: 0.72;
}

.tour-completion {
  display: grid;
  justify-items: start;
  margin-top: 2rem;
}

.tour-completion p {
  min-height: 1.4em;
}

.tour-lesson-navigation {
  justify-content: space-between;
  padding-block: 2rem;
}

@media (max-width: 760px) {
  .tour-lesson-header,
  .tour-checkpoints {
    grid-template-columns: 1fr;
  }

  .lesson-attribution {
    grid-column: auto;
  }

  .tour-metadata dl,
  .tour-resource-disclosure dl {
    grid-template-columns: 1fr;
  }
}
</style>
