import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import registryJson from '../../public/data/generated/fiddles/registry.json'
import FiddleArchiveView from '../../src/views/FiddleArchiveView.vue'
import FiddleRecordView from '../../src/views/FiddleRecordView.vue'
import { resetFiddleRegistryForTests } from '../../src/registries/fiddleRegistry'
import type { FiddleRegistry } from '../../src/types/fiddle'

const registry = registryJson as FiddleRegistry

function jsonResponse(value: unknown) {
  return { ok: true, status: 200, json: async () => value }
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/labs/simulations', name: 'fiddle-archive', component: FiddleArchiveView },
      { path: '/labs/simulations/:slug', name: 'fiddle-record', component: FiddleRecordView, props: true },
    ],
  })
}

describe('Fiddle archive and detail surfaces', () => {
  beforeEach(() => {
    resetFiddleRegistryForTests()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(registry)))
  })

  afterEach(() => {
    resetFiddleRegistryForTests()
    vi.unstubAllGlobals()
  })

  it('loads the full 780-record archive with 16 actual source pages and one page of cards', async () => {
    const router = createTestRouter()
    await router.push('/labs/simulations')
    const wrapper = mount(FiddleArchiveView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.get('[data-testid="fiddle-result-count"]').text()).toContain('780 / 780')
    expect(wrapper.get('[data-testid="fiddle-source-pages"]').findAll('button')).toHaveLength(16)
    expect(wrapper.findAll('[data-testid^="fiddle-card-"]')).toHaveLength(50)
    expect(wrapper.get('.fiddle-results-header h2').text()).toBe('Records 1-50')
    expect(wrapper.get('button[aria-label="Source profile page 16, records 750-780"]').text()).toContain('750-780')
    expect(wrapper.get('.fiddle-page-footer a').attributes('href')).toBe('https://jsfiddle.net/u/Chenopdodium/fiddles/')
  })

  it('links the selected archive and record pages to their captured profile pages', async () => {
    const archiveRouter = createTestRouter()
    await archiveRouter.push('/labs/simulations')
    const archiveWrapper = mount(FiddleArchiveView, { global: { plugins: [archiveRouter] } })
    await flushPromises()

    await archiveWrapper.get('button[aria-label="Source profile page 16, records 750-780"]').trigger('click')
    await flushPromises()
    expect(archiveWrapper.get('.fiddle-page-footer a').attributes('href')).toBe('https://jsfiddle.net/u/Chenopdodium/fiddles/16/')

    const record = registry.records.find(({ page }) => page === 16)!
    const recordRouter = createTestRouter()
    await recordRouter.push(`/labs/simulations/${record.slug}`)
    const recordWrapper = mount(FiddleRecordView, { props: { slug: record.slug }, global: { plugins: [recordRouter] } })
    await flushPromises()

    const provenanceLinks = recordWrapper.findAll('.fiddle-provenance-grid article a')
    expect(provenanceLinks[0]!.attributes('href')).toBe(record.sourceUrl)
    expect(provenanceLinks[1]!.attributes('href')).toBe('https://jsfiddle.net/u/Chenopdodium/fiddles/16/')
  })

  it('owns search, visualization, and source page state in the URL and rejects an arbitrary page', async () => {
    const router = createTestRouter()
    await router.push('/labs/simulations?q=spin&viz=3D%20WebGL%2Fcanvas&page=999')
    const wrapper = mount(FiddleArchiveView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.get('[data-testid="fiddle-search"]').element).toHaveProperty('value', 'spin')
    expect(wrapper.get('[data-testid="fiddle-visualization"]').element).toHaveProperty('value', '3D WebGL/canvas')
    expect(wrapper.get('[data-testid="fiddle-query-notice"]').text()).toContain('clamped to page 16')
    expect(router.currentRoute.value.query).toEqual({ q: 'spin', viz: '3D WebGL/canvas', page: '16' })

    await wrapper.get('[data-testid="fiddle-search"]').setValue('canvas')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ q: 'canvas', viz: '3D WebGL/canvas' })
    expect(wrapper.get('[data-testid="fiddle-source-pages"] button[aria-current="page"]').text()).toContain('Page 1')
  })

  it('fails closed for an unknown record without creating a live frame', async () => {
    const router = createTestRouter()
    await router.push('/labs/simulations/not-in-the-archive')
    const wrapper = mount(FiddleRecordView, { props: { slug: 'not-in-the-archive' }, global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.get('[data-testid="fiddle-record-error"]').text()).toContain('not present')
    expect(wrapper.get('[data-testid="fiddle-record-error"] a').attributes('href')).toBe('/labs/simulations')
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('keeps the external preview opt-in and applies the narrow sandbox contract', async () => {
    const record = registry.records[0]!
    expect(record.version).toBe(0)
    expect(record.sourceUrl).toBe('https://jsfiddle.net/Chenopdodium/wqoycabp/')
    expect(record.embedUrl).toBe('https://jsfiddle.net/Chenopdodium/wqoycabp/show/')
    const router = createTestRouter()
    await router.push(`/labs/simulations/${record.slug}`)
    const wrapper = mount(FiddleRecordView, { props: { slug: record.slug }, global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="fiddle-live-iframe"]').exists()).toBe(false)
    await wrapper.get('[data-testid="fiddle-live-activate"]').trigger('click')

    const iframe = wrapper.get<HTMLIFrameElement>('[data-testid="fiddle-live-iframe"]')
    expect(iframe.attributes('src')).toBe(record.embedUrl)
    expect(iframe.attributes('sandbox')).toBe('allow-scripts')
    expect(iframe.attributes('loading')).toBe('lazy')
    expect(iframe.attributes('referrerpolicy')).toBe('no-referrer')
    expect(iframe.attributes('allow')).toBeUndefined()
    expect(iframe.attributes('allow-same-origin')).toBeUndefined()
    expect(wrapper.get('.fiddle-editor-link').attributes('href')).toBe(record.sourceUrl)
  })

  it('resets external preview activation when the record changes', async () => {
    const firstRecord = registry.records[0]!
    const secondRecord = registry.records[1]!
    const router = createTestRouter()
    await router.push(`/labs/simulations/${firstRecord.slug}`)
    const wrapper = mount(FiddleRecordView, { props: { slug: firstRecord.slug }, global: { plugins: [router] } })
    await flushPromises()

    await wrapper.get('[data-testid="fiddle-live-activate"]').trigger('click')
    expect(wrapper.get('[data-testid="fiddle-live-iframe"]').attributes('src')).toBe(firstRecord.embedUrl)

    await wrapper.setProps({ slug: secondRecord.slug })
    await flushPromises()

    expect(wrapper.find('[data-testid="fiddle-live-iframe"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="fiddle-live-activate"]').exists()).toBe(true)

    await wrapper.get('[data-testid="fiddle-live-activate"]').trigger('click')
    expect(wrapper.get('[data-testid="fiddle-live-iframe"]').attributes('src')).toBe(secondRecord.embedUrl)
  })
})
