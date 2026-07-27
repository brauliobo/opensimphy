import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import chapterJson from '../../public/data/generated/tour/chapters/units.json'
import glossaryJson from '../../public/data/generated/tour/glossary.json'
import lessonJson from '../../public/data/generated/tour/lessons/physical-quantities.json'
import manifestJson from '../../public/data/generated/tour/manifest.json'
import referencesJson from '../../public/data/generated/tour/references.json'
import simulationJson from '../../public/data/generated/tour/simulations/dimensional-equation-builder.json'
import { resetTourProgressForTests, useTourProgress } from '../../src/registries/tourProgress'
import type {
  TourGeneratedChapterRecord,
  TourGeneratedLessonRecord,
  TourGeneratedManifest,
  TourGeneratedSimulation,
  TourGlossarySource,
  TourReferencesSource,
} from '../../src/types/tour'
import TourLessonView from '../../src/views/TourLessonView.vue'

const registry = vi.hoisted(() => ({
  manifest: { value: null as TourGeneratedManifest | null },
  error: { value: null as Error | null },
  initialize: vi.fn(),
  chapterById: vi.fn(),
  lessonById: vi.fn(),
  simulationById: vi.fn(),
  loadGlossary: vi.fn(),
  loadReferences: vi.fn(),
}))

vi.mock('../../src/registries/tourRegistry', () => ({
  useTourRegistry: () => registry,
}))

const chapter = chapterJson as TourGeneratedChapterRecord
const lesson = lessonJson as TourGeneratedLessonRecord
const manifest = manifestJson as TourGeneratedManifest
const simulation = simulationJson as TourGeneratedSimulation
const glossary = glossaryJson as TourGlossarySource
const references = referencesJson as TourReferencesSource
const mountedWrappers: Array<{ unmount(): void }> = []
let intersectionCallback: IntersectionObserverCallback | null = null
let intersectionOptions: IntersectionObserverInit | undefined
const observedSections: Element[] = []
const observerDisconnect = vi.fn()

class MockIntersectionObserver {
  readonly root = null
  readonly rootMargin: string
  readonly thresholds: number[]

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    intersectionCallback = callback
    intersectionOptions = options
    this.rootMargin = options?.rootMargin ?? '0px'
    this.thresholds = typeof options?.threshold === 'number' ? [options.threshold] : [...options?.threshold ?? [0]]
  }

  observe(target: Element): void {
    observedSections.push(target)
  }

  unobserve(): void {}

  disconnect(): void {
    observerDisconnect()
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

function routerFor(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tour', component: { template: '<div />' } },
      { path: '/tour/:chapter', component: { template: '<div />' } },
      { path: '/tour/:chapter/:lesson', component: { template: '<div />' }, meta: { title: 'Tour Lesson' } },
      { path: '/atlas/:id', component: { template: '<div />' } },
      { path: '/evidence', component: { template: '<div />' } },
    ],
  })
  return router.push(path).then(() => router)
}

async function mountLesson(
  path = '/tour/units/physical-quantities',
  props = { chapter: 'units', lesson: 'physical-quantities' },
  attachTo?: Element,
) {
  const router = await routerFor(path)
  const wrapper = mount(TourLessonView, {
    props,
    global: {
      plugins: [router],
      stubs: {
        TourDepthControl: {
          template: '<div data-testid="depth-control-stub">Reading depth</div>',
        },
        DimensionBuilder: {
          props: ['simulation', 'depth', 'initialPresetId'],
          template: '<div data-testid="dimension-builder-stub" :data-depth="depth" :data-preset="initialPresetId" />',
        },
      },
    },
    ...(attachTo ? { attachTo } : {}),
  })
  mountedWrappers.push(wrapper)
  return wrapper
}

function configureRegistry(overrides: Partial<typeof registry> = {}): void {
  registry.manifest.value = manifest
  registry.error.value = null
  registry.initialize.mockReset().mockResolvedValue(undefined)
  registry.chapterById.mockReset().mockImplementation(async (id: string) => id === chapter.id ? chapter : null)
  registry.lessonById.mockReset().mockImplementation(async (id: string) => id === lesson.id ? lesson : null)
  registry.simulationById.mockReset().mockImplementation(async (id: string) => id === simulation.id ? simulation : null)
  registry.loadGlossary.mockReset().mockResolvedValue(glossary)
  registry.loadReferences.mockReset().mockResolvedValue(references)
  Object.assign(registry, overrides)
}

describe('Tour lesson vertical slice', () => {
  beforeEach(() => {
    resetTourProgressForTests()
    window.localStorage.clear()
    configureRegistry()
    intersectionCallback = null
    intersectionOptions = undefined
    observedSections.splice(0)
    observerDisconnect.mockReset()
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    resetTourProgressForTests()
    window.localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('lazy-loads every lesson dependency, exposes the ready marker, and records a visit without completion', async () => {
    let resolveLesson!: (value: TourGeneratedLessonRecord) => void
    registry.lessonById.mockImplementationOnce((_id: string, signal?: AbortSignal) => new Promise((resolve, reject) => {
      resolveLesson = resolve
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
    }))
    const wrapper = await mountLesson()

    expect(wrapper.get('[role="status"]').text()).toContain('Loading Tour lesson')
    resolveLesson(lesson)
    await flushPromises()

    expect(wrapper.attributes('data-testid')).toBe('tour-lesson-ready')
    expect(registry.initialize).toHaveBeenCalledOnce()
    expect(registry.chapterById).toHaveBeenCalledWith('units', expect.any(AbortSignal))
    expect(registry.lessonById).toHaveBeenCalledWith('physical-quantities', expect.any(AbortSignal))
    expect(registry.simulationById).toHaveBeenCalledWith('dimensional-equation-builder', expect.any(AbortSignal))
    expect(registry.loadGlossary).toHaveBeenCalledWith(expect.any(AbortSignal))
    expect(registry.loadReferences).toHaveBeenCalledWith(expect.any(AbortSignal))
    expect(useTourProgress().state.value.lessons['physical-quantities']).toEqual({ visited: true, complete: false })
    expect(useTourProgress().resume.value).toBe('/tour/units/physical-quantities')
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.findAll('main')).toHaveLength(0)
    expect(wrapper.findAll('[data-tour-section]')).toHaveLength(6)
  })

  it('completes only from the explicit control and restores completed state after hydration', async () => {
    const first = await mountLesson()
    await flushPromises()
    expect(useTourProgress().state.value.chapters.units?.status).toBe('visited')

    await first.get('[data-testid="mark-lesson-complete"]').trigger('click')
    expect(useTourProgress().state.value.lessons['physical-quantities']?.complete).toBe(true)
    expect(useTourProgress().state.value.chapters.units?.status).toBe('complete')
    expect(first.get('[data-testid="completion-announcement"]').text()).toBe('Lesson marked complete.')
    first.unmount()

    resetTourProgressForTests()
    const reloaded = await mountLesson()
    await flushPromises()
    expect(reloaded.get('[data-testid="lesson-completed-state"]').text()).toBe('Lesson completed')
    expect(reloaded.get('[data-testid="mark-lesson-complete"]').attributes('disabled')).toBeDefined()
    expect(reloaded.get('[data-testid="completion-announcement"]').text()).toBe('')
  })

  it('adds technical blocks and glossary definitions without removing guided material or changing conclusions', async () => {
    const wrapper = await mountLesson()
    await flushPromises()
    const guidedTitle = lesson.guidedBlocks[0]!.title
    const technicalTitle = lesson.technicalBlocks[0]!.title
    const guidedConclusion = wrapper.get('[data-testid="conclusion-boundary"]').text()

    expect(wrapper.text()).toContain(guidedTitle)
    expect(wrapper.text()).not.toContain(technicalTitle)
    useTourProgress().setDepth('technical')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain(guidedTitle)
    expect(wrapper.text()).toContain(technicalTitle)
    expect(wrapper.text()).toContain(glossary.entries[0]!.technicalDefinition)
    expect(wrapper.get('[data-testid="dimension-builder-stub"]').attributes('data-depth')).toBe('technical')
    expect(wrapper.get('[data-testid="conclusion-boundary"]').text()).toBe(guidedConclusion)
  })

  it('filters quick-path blocks, equations, checkpoints, and preset while linking to the full lesson', async () => {
    const wrapper = await mountLesson('/tour/units/physical-quantities?path=quick')
    await flushPromises()

    expect(wrapper.text()).toContain('Quick station / 4 min')
    expect(wrapper.find('[data-block-id="quantity-value-number-reference"]').exists()).toBe(false)
    expect(wrapper.find('[data-block-id="si-defining-anchors"]').exists()).toBe(true)
    expect(wrapper.find('[data-block-id="dimensions-and-kinds"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-equation-id]')).toHaveLength(1)
    expect(wrapper.find('[data-equation-id="fixed-si-anchors"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-checkpoint-id]')).toHaveLength(1)
    expect(wrapper.find('[data-checkpoint-id="centimetre-prediction"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="dimension-builder-stub"]').attributes('data-preset')).toBe('average-speed-from-path')
    expect(wrapper.get('[data-testid="full-lesson-link"]').attributes('href')).toBe('/tour/units/physical-quantities')
  })

  it('keeps quick completion separate, then completes the lesson and chapter only on the full path', async () => {
    const wrapper = await mountLesson('/tour/units/physical-quantities?path=quick')
    await flushPromises()
    const progress = useTourProgress()

    expect(progress.state.value.stations['anchors-scales']?.visited).toBe(true)
    expect(progress.state.value.stations['anchors-scales']?.complete).toBe(false)
    await wrapper.get('[data-testid="mark-lesson-complete"]').trigger('click')

    expect(progress.state.value.stations['anchors-scales']?.complete).toBe(true)
    expect(progress.state.value.lessons['physical-quantities']?.complete).toBe(false)
    expect(progress.state.value.chapters.units?.status).toBe('visited')
    expect(wrapper.get('[data-testid="completion-announcement"]').text()).toBe('Station marked complete.')

    await wrapper.vm.$router.push('/tour/units/physical-quantities')
    await flushPromises()
    expect(wrapper.get('[data-testid="completion-announcement"]').text()).toBe('')
    await wrapper.get('[data-testid="mark-lesson-complete"]').trigger('click')

    expect(progress.state.value.lessons['physical-quantities']?.complete).toBe(true)
    expect(progress.state.value.chapters.units?.status).toBe('complete')
    expect(wrapper.get('[data-testid="completion-announcement"]').text()).toBe('Lesson marked complete.')
  })

  it('reacts to query-only mode changes and browser back with mode-specific title, content, resume, and preset', async () => {
    const wrapper = await mountLesson()
    await flushPromises()
    const router = wrapper.vm.$router

    expect(document.title).toBe(`${lesson.title} | OpenSimPhy Atlas`)
    expect(wrapper.get('[data-testid="dimension-builder-stub"]').attributes('data-preset')).toBeUndefined()
    await router.push('/tour/units/physical-quantities?path=quick')
    await flushPromises()

    expect(wrapper.text()).toContain('Quick station / 4 min')
    expect(document.title).toBe(`Quick station: ${lesson.title} | OpenSimPhy Atlas`)
    expect(useTourProgress().resume.value).toBe('/tour/units/physical-quantities?path=quick')
    expect(wrapper.get('[data-testid="dimension-builder-stub"]').attributes('data-preset')).toBe('average-speed-from-path')

    const guidedConclusion = wrapper.get('[data-testid="conclusion-boundary"]').text()
    useTourProgress().setDepth('technical')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="quick-technical-estimate"]').text()).toContain('Guided quick estimate')
    expect(wrapper.text()).toContain(lesson.guidedBlocks.find(({ id }) => id === lesson.quickPath!.guidedBlockIds[0])!.title)
    expect(wrapper.text()).toContain(lesson.technicalBlocks[0]!.title)
    await wrapper.get('[data-testid="equation-reveal-all"]').trigger('click')
    expect(wrapper.findAll('[data-equation-id]')).toHaveLength(lesson.equationSteps.length)
    expect(wrapper.get('[data-testid="conclusion-boundary"]').text()).toBe(guidedConclusion)

    await router.push('/tour/units/physical-quantities')
    await flushPromises()
    await router.back()
    await flushPromises()

    expect(wrapper.text()).toContain('Quick station / 4 min')
    expect(wrapper.get('[data-testid="dimension-builder-stub"]').attributes('data-preset')).toBe('average-speed-from-path')
    expect(document.title).toBe(`Quick station: ${lesson.title} | OpenSimPhy Atlas`)
  })

  it('renders the generated Observe stage as text with three anchors, roles, conclusion, attribution, and expanded links', async () => {
    const wrapper = await mountLesson()
    await flushPromises()
    const observe = wrapper.get('[data-testid="observation-stage"]')

    expect(observe.findAll('[data-observation-id]')).toHaveLength(3)
    expect(observe.text()).toContain(lesson.observationStage.question)
    expect(observe.text()).toContain('Role: Fixed definition')
    expect(observe.text()).toContain(lesson.observationStage.conclusion)
    expect(observe.text()).toContain(lesson.observationStage.attribution.sourceLocator)
    expect(observe.find('img').exists()).toBe(false)
    const externalLink = wrapper.get('a[target="_blank"]')
    expect(externalLink.text()).toContain('(opens in new tab)')
    expect(externalLink.attributes('aria-label')).toContain('(opens in new tab)')
  })

  it('records every tall section at the reading line in deterministic order and restores a hash target', async () => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    const scrollIntoView = vi.fn()
    const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')

    try {
      const wrapper = await mountLesson(
        '/tour/units/physical-quantities?path=quick#interpret',
        { chapter: 'units', lesson: 'physical-quantities' },
        document.body,
      )
      await flushPromises()

      expect(observedSections.map(({ id }) => id)).toEqual(['question', 'observe', 'explain', 'equation-ladder', 'try', 'interpret'])
      expect(intersectionOptions).toEqual({ rootMargin: '-20% 0px -79% 0px', threshold: 0 })
      expect(scrollIntoView).toHaveBeenCalledOnce()
      expect(focus).toHaveBeenCalledWith({ preventScroll: true })

      for (const section of observedSections) {
        intersectionCallback?.([{
          boundingClientRect: { top: 180, bottom: 2180, height: 2000 } as DOMRectReadOnly,
          intersectionRatio: 0.001,
          isIntersecting: true,
          target: section,
        } as IntersectionObserverEntry], {} as IntersectionObserver)
        await wrapper.vm.$nextTick()
        expect(useTourProgress().state.value.lessons['physical-quantities']?.lastAnchor).toBe(`#${section.id}`)
        expect(useTourProgress().resume.value).toBe(`/tour/units/physical-quantities?path=quick#${section.id}`)
      }

      const explain = wrapper.get('#explain').element
      const trySection = wrapper.get('#try').element
      intersectionCallback?.([
        { isIntersecting: true, target: trySection } as IntersectionObserverEntry,
        { isIntersecting: true, target: explain } as IntersectionObserverEntry,
      ], {} as IntersectionObserver)
      await wrapper.vm.$nextTick()

      expect(useTourProgress().state.value.lessons['physical-quantities']?.lastAnchor).toBe('#try')
      expect(useTourProgress().resume.value).toBe('/tour/units/physical-quantities?path=quick#try')
      wrapper.unmount()
      expect(observerDisconnect).toHaveBeenCalled()
    } finally {
      if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView)
      else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
    }
  })

  it('reveals equation steps progressively and can reveal all or reset', async () => {
    const wrapper = await mountLesson()
    await flushPromises()
    expect(wrapper.findAll('[data-equation-id]')).toHaveLength(1)

    await wrapper.get('[data-testid="equation-reveal-next"]').trigger('click')
    expect(wrapper.findAll('[data-equation-id]')).toHaveLength(2)
    await wrapper.get('[data-testid="equation-reveal-all"]').trigger('click')
    expect(wrapper.findAll('[data-equation-id]')).toHaveLength(lesson.equationSteps.length)
    await wrapper.get('[data-testid="equation-reset"]').trigger('click')
    expect(wrapper.findAll('[data-equation-id]')).toHaveLength(1)
  })

  it('captures a checkpoint choice and reveals its explanation without scoring or gating completion', async () => {
    const wrapper = await mountLesson()
    await flushPromises()
    const checkpoint = lesson.checkpoints[0]!
    const choice = checkpoint.choices[0]!

    await wrapper.get(`[data-checkpoint-id="${checkpoint.id}"] input[value="${choice.id}"]`).trigger('change')
    await wrapper.get(`[data-testid="checkpoint-reveal-${checkpoint.id}"]`).trigger('click')

    expect(wrapper.get(`[data-testid="checkpoint-explanation-${checkpoint.id}"]`).text()).toContain(checkpoint.explanation)
    expect(wrapper.get(`[data-checkpoint-id="${checkpoint.id}"]`).text()).not.toMatch(/correct|incorrect|score/i)
    expect(wrapper.get('[data-testid="mark-lesson-complete"]').attributes('disabled')).toBeUndefined()
  })

  it('renders all six conclusion boundaries with their declared scope and source text', async () => {
    const wrapper = await mountLesson()
    await flushPromises()
    const boundary = wrapper.get('[data-testid="conclusion-boundary"]')

    expect(boundary.findAll('.conclusion-group')).toHaveLength(6)
    expect(boundary.findAll('h3').map((heading) => heading.text())).toEqual([
      'Seen in this activity',
      'Computed here',
      'Reproduced from source',
      'Compared with evidence',
      'Establishes',
      'Does not establish',
    ])
    expect(boundary.text()).toContain(lesson.comparedWithEvidence[0]!.text)
    expect(boundary.text()).toContain(lesson.doesNotEstablish[0]!.text)
    const links = boundary.findAll('[data-testid="conclusion-evidence-refs"] a')
    for (const link of links) {
      expect(wrapper.find(link.attributes('href')).exists()).toBe(true)
    }
  })

  it('distinguishes load errors from unknown chapter and lesson combinations', async () => {
    registry.lessonById.mockRejectedValueOnce(new Error('lesson shard failed'))
    const errored = await mountLesson()
    await flushPromises()
    expect(errored.get('[data-testid="tour-lesson-error"]').text()).toContain('lesson shard failed')
    expect(errored.find('[data-testid="tour-lesson-not-found"]').exists()).toBe(false)

    configureRegistry()
    registry.chapterById.mockResolvedValueOnce(null)
    const missing = await mountLesson()
    await flushPromises()
    expect(missing.get('[data-testid="tour-lesson-not-found"]').text()).toContain('Lesson not found')
    expect(missing.find('[data-testid="tour-lesson-error"]').exists()).toBe(false)
    expect(document.title).toBe('Not Found | OpenSimPhy Atlas')
  })

  it('aborts a stale load and prevents it from replacing the newer lesson', async () => {
    const newerChapter = {
      ...chapter,
      id: 'measurement',
      title: 'Measurement chapter',
      lessonIds: ['measurement-basics'],
      previousChapterId: null,
      nextChapterId: null,
    }
    const newerLesson = {
      ...lesson,
      id: 'measurement-basics',
      chapterId: 'measurement',
      title: 'Measurement without stale content',
      simulationId: null,
      previousLessonId: null,
      nextLessonId: null,
    }
    let staleSignal: AbortSignal | undefined
    let resolveStale!: (value: TourGeneratedChapterRecord) => void
    registry.chapterById.mockImplementation((id: string, signal?: AbortSignal) => {
      if (id === 'measurement') return Promise.resolve(newerChapter)
      staleSignal = signal
      return new Promise((resolve) => {
        resolveStale = resolve
        signal?.addEventListener('abort', () => resolve(chapter), { once: true })
      })
    })
    registry.lessonById.mockImplementation(async (id: string) => id === newerLesson.id ? newerLesson : lesson)
    const wrapper = await mountLesson()
    await vi.waitFor(() => expect(registry.chapterById).toHaveBeenCalledWith('units', expect.any(AbortSignal)))
    await wrapper.setProps({ chapter: 'measurement', lesson: 'measurement-basics' })
    await flushPromises()
    resolveStale(chapter)
    await flushPromises()

    expect(staleSignal?.aborted).toBe(true)
    expect(wrapper.get('h1').text()).toBe(newerLesson.title)
    expect(wrapper.text()).not.toContain(lesson.title)
  })

  it('sets the loaded lesson title and renders generated markup-shaped strings only as text', async () => {
    const unsafe = '<img src=x onerror=alert(1)>'
    const unsafeLesson = {
      ...lesson,
      title: `${lesson.title} ${unsafe}`,
      guidedBlocks: lesson.guidedBlocks.map((block, index) => index === 0
        ? { ...block, body: [unsafe, ...block.body] }
        : block),
    }
    registry.lessonById.mockResolvedValueOnce(unsafeLesson)
    const wrapper = await mountLesson()
    await flushPromises()

    expect(document.title).toBe(`${unsafeLesson.title} | OpenSimPhy Atlas`)
    expect(wrapper.get('h1').text()).toContain(unsafe)
    expect(wrapper.text()).toContain(unsafe)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('onerror="alert(1)"')
  })
})
