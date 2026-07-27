import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import taxonomyJson from '../../public/data/generated/taxonomy.json'
import anchorsChapterJson from '../../public/data/generated/tour/chapters/anchors.json'
import unitsChapterJson from '../../public/data/generated/tour/chapters/units.json'
import tourManifestJson from '../../public/data/generated/tour/manifest.json'
import {
  resetTourProgressForTests,
  setTourProgressDependenciesForTests,
  useTourProgress,
} from '../../src/registries/tourProgress'
import { resetTaxonomyRegistryForTests } from '../../src/registries/taxonomyRegistry'
import { resetTourRegistryForTests, setTourRegistryForTests } from '../../src/registries/tourRegistry'
import { router as appRouter, tourScrollBehavior } from '../../src/router'
import type { TaxonomyArtifact } from '../../src/types/engine'
import type { TourGeneratedChapterRecord, TourGeneratedManifest } from '../../src/types/tour'
import EvidenceView from '../../src/views/EvidenceView.vue'
import NotFoundView from '../../src/views/NotFoundView.vue'
import SavedView from '../../src/views/SavedView.vue'
import TourChapterView from '../../src/views/TourChapterView.vue'
import TourMapView from '../../src/views/TourMapView.vue'

const taxonomy = taxonomyJson as TaxonomyArtifact
const manifest = tourManifestJson as TourGeneratedManifest
const unitsChapter = unitsChapterJson as TourGeneratedChapterRecord
const anchorsChapter = anchorsChapterJson as TourGeneratedChapterRecord

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/tour', component: TourMapView },
      { path: '/tour/:chapter', component: TourChapterView, props: true },
      { path: '/tour/:chapter/:lesson', component: { template: '<div />' }, props: true },
      { path: '/atlas', component: { template: '<div />' } },
      { path: '/labs', component: { template: '<div />' } },
      { path: '/evidence', component: EvidenceView },
      { path: '/sources', component: { template: '<div />' } },
      { path: '/earth', component: { template: '<div />' } },
      { path: '/saved', component: SavedView },
      { path: '/:pathMatch(.*)*', component: NotFoundView },
    ],
  })
}

describe('Tour and support navigation', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    window.localStorage.clear()
    resetTourProgressForTests()
    setTourProgressDependenciesForTests({ storage: window.localStorage, now: () => '2026-07-26T10:00:00.000Z' })
    setTourRegistryForTests({
      manifest,
      taxonomy,
      chapters: [unitsChapter, anchorsChapter],
    })
  })

  afterEach(() => {
    resetTourProgressForTests()
    resetTourRegistryForTests()
    resetTaxonomyRegistryForTests()
  })

  it('declares orientation, Tour, support, legacy, and URL-preserving not-found routes', async () => {
    expect(appRouter.resolve('/').name).toBe('overview')
    expect(appRouter.resolve('/tour').name).toBe('tour')
    expect(appRouter.resolve('/tour/units').name).toBe('tour-chapter')
    expect(appRouter.resolve('/tour/units/physical-quantities').name).toBe('tour-lesson')
    expect(appRouter.resolve('/evidence').name).toBe('evidence')
    expect(appRouter.resolve('/saved').name).toBe('saved')
    expect(appRouter.resolve('/not-found').name).toBe('not-found')
    expect(appRouter.resolve('/missing/deep/path').name).toBe('catch-all')

    await appRouter.push('/missing/deep/path?mode=test')
    expect(appRouter.currentRoute.value.fullPath).toBe('/missing/deep/path?mode=test')
    expect(document.title).toBe('Page Not Found | OpenSimPhy Atlas')

    await appRouter.push('/tour/unknown-chapter')
    expect(document.title).toBe('Not Found | OpenSimPhy Atlas')
    await appRouter.push('/tour/unknown-chapter/unknown-lesson')
    expect(document.title).toBe('Not Found | OpenSimPhy Atlas')
  })

  it('restores browser positions before safe hashes and otherwise starts at the top', async () => {
    const from = appRouter.resolve('/tour')
    const hashed = appRouter.resolve('/tour/units/physical-quantities#interpret')
    const unsafe = appRouter.resolve('/tour/units/physical-quantities#bad%20selector')
    const savedPosition = { left: 12, top: 34 }

    expect(await tourScrollBehavior(hashed, from, savedPosition)).toEqual(savedPosition)
    expect(await tourScrollBehavior(hashed, from, null)).toEqual({ el: '#interpret' })
    expect(await tourScrollBehavior(unsafe, from, null)).toEqual({ top: 0 })
    expect(await tourScrollBehavior(from, hashed, null)).toEqual({ top: 0 })
  })

  it.each([
    ['foundations', 'anchors'],
    ['metrology', 'unit-bridges'],
    ['electromagnetism', 'electrical-standards'],
    ['atomic', 'atomic-structure'],
    ['particles', 'particle-scales'],
    ['magnetism', 'spin-magnetism'],
    ['thermal', 'heat-matter'],
    ['molar-matter', 'heat-matter'],
  ])('redirects legacy topic %s to chapter %s', async (topic, chapter) => {
    await appRouter.push(`/topics/${topic}`)
    expect(appRouter.currentRoute.value.path).toBe(`/tour/${chapter}`)
  })

  it('sends unknown legacy topics to not-found with the requested path available', async () => {
    await appRouter.push('/topics/unknown-taxonomy')
    expect(appRouter.currentRoute.value.name).toBe('not-found')
    expect(appRouter.currentRoute.value.query.from).toBe('/topics/unknown-taxonomy')
  })

  it('renders all 20 chapters in four ordered acts without false completion', async () => {
    const router = createTestRouter()
    await router.push('/tour')
    const wrapper = mount(TourMapView, { global: { plugins: [router] } })

    expect(wrapper.attributes('data-testid')).toBe('tour-map-ready')
    expect(wrapper.findAll('.tour-act')).toHaveLength(4)
    expect(wrapper.findAll('.tour-chapter-spine li')).toHaveLength(20)
    expect(wrapper.findAll('[data-progress="complete"]')).toHaveLength(0)
    expect(wrapper.get('a[href="/tour/units"]').text()).toContain('Available')
    expect(wrapper.get('a[href="/tour/anchors"]').text()).toContain('Planned overview')
  })

  it('renders an available chapter with its lesson and actual document title', async () => {
    const router = createTestRouter()
    await router.push('/tour/units')
    const wrapper = mount(TourChapterView, {
      props: { chapter: 'units' },
      global: { plugins: [router] },
    })
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Units, Dimensions, and Physical Quantities')
    expect(wrapper.get('a[href="/tour/units/physical-quantities"]').text()).toContain('Physical quantities')
    expect(document.title).toBe('Units, Dimensions, and Physical Quantities | OpenSimPhy Atlas')
  })

  it('renders planned roadmap links and an explicit unknown-chapter state', async () => {
    const router = createTestRouter()
    await router.push('/tour/anchors')
    const planned = mount(TourChapterView, {
      props: { chapter: 'anchors' },
      global: { plugins: [router] },
    })
    await flushPromises()

    expect(planned.text()).toContain('Planned chapter')
    expect(planned.find('a[href="/atlas"]').exists()).toBe(true)
    expect(planned.find('a[href="/labs"]').exists()).toBe(true)
    expect(planned.find('a[href="/evidence"]').exists()).toBe(true)

    await planned.setProps({ chapter: 'unknown-chapter' })
    await flushPromises()
    expect(planned.get('h1').text()).toBe('Tour chapter not found')
  })

  it('exports, validates imports, and requires explicit confirmation before clear', async () => {
    const progress = useTourProgress()
    progress.visitLesson('units', 'physical-quantities', '/tour/units/physical-quantities')
    const router = createTestRouter()
    await router.push('/saved')
    const wrapper = mount(SavedView, { global: { plugins: [router] } })

    expect(wrapper.get('[data-testid="saved-resume"]').attributes('href')).toBe('/tour/units/physical-quantities')
    await wrapper.get('[data-testid="export-progress"]').trigger('click')
    expect(wrapper.get('[data-testid="export-output"]').text()).toContain('"physical-quantities"')

    await wrapper.get('[data-testid="import-progress"]').setValue('{"version":1,"readingDepth":"technical","chapters":{},"lessons":{}}')
    await wrapper.get('[data-testid="submit-import"]').trigger('click')
    expect(wrapper.get('[data-testid="import-result"]').text()).toContain('Import complete')
    expect(progress.depth.value).toBe('technical')

    expect(wrapper.find('[data-testid="confirm-clear"]').exists()).toBe(false)
    await wrapper.get('[data-testid="request-clear"]').trigger('click')
    expect(wrapper.find('[data-testid="confirm-clear"]').exists()).toBe(true)
    await wrapper.get('[data-testid="confirm-clear"]').trigger('click')
    expect(progress.state.value.lessons).toEqual({})
  })

  it('announces session-only import and clear outcomes when browser storage fails', async () => {
    const unavailable = {
      getItem: () => null,
      setItem: () => { throw new Error('blocked write') },
      removeItem: () => { throw new Error('blocked remove') },
    }
    resetTourProgressForTests()
    setTourProgressDependenciesForTests({ storage: unavailable, now: () => '2026-07-26T10:00:00.000Z' })
    const progress = useTourProgress()
    const router = createTestRouter()
    await router.push('/saved')
    const wrapper = mount(SavedView, { global: { plugins: [router] } })

    await wrapper.get('[data-testid="import-progress"]').setValue('{"version":1,"readingDepth":"technical","chapters":{},"lessons":{},"stations":{}}')
    await wrapper.get('[data-testid="submit-import"]').trigger('click')
    expect(wrapper.get('[data-testid="import-result"]').text()).toContain('imported for this session but could not save')
    expect(progress.depth.value).toBe('technical')

    await wrapper.get('[data-testid="request-clear"]').trigger('click')
    await wrapper.get('[data-testid="confirm-clear"]').trigger('click')
    expect(wrapper.get('[data-testid="import-result"]').text()).toContain('cleared for this session')
    expect(wrapper.get('[data-testid="import-result"]').text()).toContain('may return after reload')
    expect(progress.state.value).toEqual({
      version: 1,
      readingDepth: 'guided',
      chapters: {},
      lessons: {},
      stations: {},
    })
  })

  it('links the evidence distinctions to Sources and the EARTH dossier', () => {
    const router = createTestRouter()
    const wrapper = mount(EvidenceView, { global: { plugins: [router] } })

    expect(wrapper.text()).toContain('Definition')
    expect(wrapper.text()).toContain('Reproduction')
    expect(wrapper.text()).toContain('Comparison')
    expect(wrapper.text()).toContain('Validation')
    expect(wrapper.find('a[href="/sources"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/earth"]').exists()).toBe(true)
  })

  it('shows the requested unknown URL and all recovery links without redirecting', async () => {
    const router = createTestRouter()
    await router.push('/unknown/route?from=field')
    const wrapper = mount(NotFoundView, { global: { plugins: [router] } })

    expect(wrapper.get('h1').text()).toBe('Page not found')
    expect(wrapper.get('[data-testid="requested-path"]').text()).toBe('/unknown/route?from=field')
    expect(wrapper.find('a[href="/tour"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/atlas"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/labs"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/evidence"]').exists()).toBe(true)
  })
})
