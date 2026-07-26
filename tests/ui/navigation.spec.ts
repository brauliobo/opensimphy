import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppNav from '../../src/components/AppNav.vue'
import { router as appRouter } from '../../src/router'

const routes = [
  { path: '/', name: 'overview', component: { template: '<div />' } },
  { path: '/topics/:id', name: 'topic', component: { template: '<div />' } },
  { path: '/atlas', name: 'atlas', component: { template: '<div />' } },
  { path: '/labs', name: 'labs', component: { template: '<div />' } },
  { path: '/earth', name: 'earth', component: { template: '<div />' } },
  { path: '/earth/corpus', name: 'earth-corpus', component: { template: '<div />' } },
  { path: '/earth/programs', alias: '/earth/simulations', name: 'earth-simulations', component: { template: '<div />' } },
  { path: '/earth/programs/:id', alias: '/earth/simulations/:id', name: 'earth-simulation', component: { template: '<div />' } },
  { path: '/earth/datasets', name: 'earth-datasets', component: { template: '<div />' } },
  { path: '/earth/corpus/:slug', alias: '/earth/:slug', name: 'earth-document', component: { template: '<div />' } },
  { path: '/sources', name: 'sources', component: { template: '<div />' } },
]

describe('responsive navigation state', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('exposes and closes the mobile menu through accessible state', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    })
    await router.push('/')
    const wrapper = mount(AppNav, { global: { plugins: [router] } })
    const toggle = wrapper.get('[data-testid="nav-toggle"]')

    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(toggle.attributes('aria-controls')).toBe('primary-navigation')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    await wrapper.get('a[href="/atlas"]').trigger('click')
    await router.isReady()
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })

  it('moves focus into the open menu and returns it to the toggle on Escape', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/earth')
    const wrapper = mount(AppNav, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    const toggle = wrapper.get<HTMLButtonElement>('[data-testid="nav-toggle"]')
    const firstLink = wrapper.get<HTMLAnchorElement>('#primary-navigation a')

    await toggle.trigger('click')
    expect(document.activeElement).toBe(firstLink.element)
    expect(toggle.attributes('aria-label')).toBe('Close primary navigation')

    await firstLink.trigger('keydown', { key: 'Escape' })
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(toggle.attributes('aria-label')).toBe('Open primary navigation')
    expect(document.activeElement).toBe(toggle.element)

    wrapper.unmount()
  })

  it.each([
    '/earth',
    '/earth/corpus',
    '/earth/corpus/source-record',
    '/earth/source-record',
    '/earth/programs',
    '/earth/programs/EARTH-FND-001',
    '/earth/simulations',
    '/earth/simulations/EARTH-FND-001',
    '/earth/datasets',
  ])('keeps EARTH active on %s', async (path) => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push(path)
    const wrapper = mount(AppNav, { global: { plugins: [router] } })

    const earth = wrapper.get('a[href="/earth"]')
    expect(earth.classes()).toContain('router-link-active')
    expect(earth.attributes('aria-current')).toBe(path === '/earth' ? 'page' : 'location')
  })

  it('resolves canonical and legacy EARTH routes without shadowing static sections', () => {
    expect(appRouter.resolve('/earth').name).toBe('earth')
    expect(appRouter.resolve('/earth/corpus').name).toBe('earth-corpus')
    expect(appRouter.resolve('/earth/corpus/source-record').name).toBe('earth-document')
    expect(appRouter.resolve('/earth/programs').name).toBe('earth-simulations')
    expect(appRouter.resolve('/earth/programs/EARTH-FND-001').name).toBe('earth-simulation')
    expect(appRouter.resolve('/earth/datasets').name).toBe('earth-datasets')

    expect(appRouter.resolve('/earth/simulations').name).toBe('earth-simulations')
    expect(appRouter.resolve('/earth/simulations/EARTH-FND-001').name).toBe('earth-simulation')
    expect(appRouter.resolve('/earth/source-record').name).toBe('earth-document')
  })

  it('updates the document title from route metadata', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    await appRouter.push('/earth/programs')
    await appRouter.isReady()

    expect(document.title).toBe('EARTH Program Registry | OpenSimPhy Atlas')
  })
})
