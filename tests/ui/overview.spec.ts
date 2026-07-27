import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import taxonomyJson from '../../public/data/generated/taxonomy.json'
import tourManifestJson from '../../public/data/generated/tour/manifest.json'
import {
  resetTourProgressForTests,
  setTourProgressDependenciesForTests,
  useTourProgress,
} from '../../src/registries/tourProgress'
import { resetTaxonomyRegistryForTests } from '../../src/registries/taxonomyRegistry'
import { resetTourRegistryForTests, setTourRegistryForTests } from '../../src/registries/tourRegistry'
import type { TaxonomyArtifact } from '../../src/types/engine'
import type { TourGeneratedManifest } from '../../src/types/tour'
import OverviewView from '../../src/views/OverviewView.vue'

const taxonomy = taxonomyJson as TaxonomyArtifact
const manifest = tourManifestJson as TourGeneratedManifest

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: OverviewView },
      { path: '/tour', component: { template: '<div />' } },
      { path: '/tour/:chapter', component: { template: '<div />' } },
      { path: '/tour/:chapter/:lesson', component: { template: '<div />' } },
      { path: '/atlas', component: { template: '<div />' } },
      { path: '/evidence', component: { template: '<div />' } },
      { path: '/saved', component: { template: '<div />' } },
    ],
  })
}

describe('Tour orientation', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetTourProgressForTests()
    setTourRegistryForTests({ manifest, taxonomy })
  })

  afterEach(() => {
    resetTourProgressForTests()
    resetTourRegistryForTests()
    resetTaxonomyRegistryForTests()
    vi.unstubAllGlobals()
  })

  it('renders one ordered eight-station spine with honest availability', async () => {
    const router = createTestRouter()
    await router.push('/')
    const wrapper = mount(OverviewView, { global: { plugins: [router] } })

    expect(wrapper.attributes('data-testid')).toBe('tour-ready')
    expect(wrapper.findAll('.tour-station')).toHaveLength(8)
    expect(wrapper.findAll('.tour-station-spine .tour-station-link')).toHaveLength(1)
    expect(wrapper.get('[data-testid="station-anchors-scales"] a').attributes('href')).toBe('/tour/units/physical-quantities?path=quick')
    expect(wrapper.get('[data-testid="station-unit-bridges"]').find('a').exists()).toBe(false)
    expect(wrapper.get('[data-testid="station-unit-bridges"]').text()).toContain('Planned')
    expect(wrapper.get('[data-testid="begin-tour"]').attributes('href')).toBe('/tour/units/physical-quantities?path=quick')
    expect(wrapper.find('a[href="/tour"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Registry coverage')
    expect(wrapper.find('.topic-door').exists()).toBe(false)
  })

  it('shows a resume action and current chapter preview only when progress exists', async () => {
    const router = createTestRouter()
    const progress = useTourProgress()
    progress.visitLesson('units', 'physical-quantities', '/tour/units/physical-quantities#dimensions')
    await router.push('/')
    const wrapper = mount(OverviewView, { global: { plugins: [router] } })

    expect(wrapper.get('[data-testid="overview-resume"]').attributes('href')).toBe('/tour/units/physical-quantities#dimensions')
    expect(wrapper.get('.tour-current-preview').text()).toContain('Units, Dimensions, and Physical Quantities')
    expect(wrapper.text()).toContain('local browser storage only')
    expect(wrapper.text()).toContain('Reproduction is not validation')
  })

  it('displays quick-station completion independently from lesson completion', async () => {
    const router = createTestRouter()
    const progress = useTourProgress()
    progress.visitStation('anchors-scales', '/tour/units/physical-quantities?path=quick')
    progress.completeStation('anchors-scales')
    await router.push('/')
    const wrapper = mount(OverviewView, { global: { plugins: [router] } })

    expect(wrapper.get('[data-testid="station-anchors-scales"]').attributes('data-progress')).toBe('complete')
    expect(wrapper.get('[data-testid="station-progress-anchors-scales"]').text()).toBe('Quick station: complete')
    expect(progress.state.value.lessons['physical-quantities']).toBeUndefined()
    expect(progress.state.value.chapters.units).toBeUndefined()
  })

  it('loads only the Tour manifest and taxonomy during initial orientation', async () => {
    resetTourRegistryForTests()
    resetTaxonomyRegistryForTests()
    setTourProgressDependenciesForTests({ storage: window.localStorage })
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('data/generated/tour/manifest.json')) return { ok: true, status: 200, json: async () => manifest }
      if (url.endsWith('data/generated/taxonomy.json')) return { ok: true, status: 200, json: async () => taxonomy }
      throw new Error(`Unexpected orientation fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const router = createTestRouter()
    await router.push('/')
    const wrapper = mount(OverviewView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.attributes('data-testid')).toBe('tour-ready')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(expect.arrayContaining([
      expect.stringContaining('data/generated/tour/manifest.json'),
      expect.stringContaining('data/generated/taxonomy.json'),
    ]))
  })
})
