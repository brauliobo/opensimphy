import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../../src/App.vue'
import AppNav from '../../src/components/AppNav.vue'
import TourDepthControl from '../../src/components/tour/TourDepthControl.vue'
import {
  resetTourProgressForTests,
  setTourProgressDependenciesForTests,
  useTourProgress,
} from '../../src/registries/tourProgress'
import { router as appRouter } from '../../src/router'

const routes = [
  { path: '/', name: 'overview', component: { template: '<div />' } },
  { path: '/tour', name: 'tour', component: { template: '<div />' } },
  { path: '/tour/:chapter', name: 'tour-chapter', component: { template: '<div />' } },
  { path: '/tour/:chapter/:lesson', name: 'tour-lesson', component: { template: '<div />' } },
  { path: '/atlas', name: 'atlas', component: { template: '<div />' } },
  { path: '/labs', name: 'labs', component: { template: '<div />' } },
  { path: '/labs/authors/chenopdodium', name: 'fiddle-archive', component: { template: '<div />' } },
  { path: '/labs/authors/chenopdodium/:slug', name: 'fiddle-record', component: { template: '<div />' } },
  { path: '/labs/core', name: 'core', component: { template: '<div />' } },
  { path: '/labs/walls', name: 'walls', component: { template: '<div />' } },
  { path: '/labs/earth/:programId', name: 'earth-workbench', component: { template: '<div />' } },
  { path: '/evidence', name: 'evidence', component: { template: '<div />' } },
  { path: '/saved', name: 'saved', component: { template: '<div />' } },
  { path: '/earth', name: 'earth', component: { template: '<div />' } },
  { path: '/earth/corpus', name: 'earth-corpus', component: { template: '<div />' } },
  { path: '/earth/programs', alias: '/earth/simulations', name: 'earth-simulations', component: { template: '<div />' } },
  { path: '/earth/programs/:id', alias: '/earth/simulations/:id', name: 'earth-simulation', component: { template: '<div />' } },
  { path: '/earth/datasets', name: 'earth-datasets', component: { template: '<div />' } },
  { path: '/earth/corpus/:slug', alias: '/earth/:slug', name: 'earth-document', component: { template: '<div />' } },
  { path: '/sources', name: 'sources', component: { template: '<div />' } },
]

function createTestRouter() {
  return createRouter({ history: createMemoryHistory(), routes })
}

describe('responsive navigation state', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetTourProgressForTests()
    setTourProgressDependenciesForTests({ storage: window.localStorage })
  })

  afterEach(() => {
    document.body.innerHTML = ''
    resetTourProgressForTests()
  })

  it('uses the four field-course primary labels and Tour utilities', async () => {
    const router = createTestRouter()
    await router.push('/')
    const wrapper = mount(AppNav, { global: { plugins: [router] } })

    expect(wrapper.findAll('.nav-link').map((link) => link.text().replace(/^\d+/, ''))).toEqual(['Tour', 'Atlas', 'Workbench', 'Evidence'])
    expect(wrapper.findComponent(TourDepthControl).exists()).toBe(true)
    await wrapper.get('[data-testid="reading-depth-technical"]').trigger('change')
    expect(useTourProgress().depth.value).toBe('technical')
    expect(wrapper.find('[data-testid="nav-resume"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('OpenSimPhy Field Course')
    expect(wrapper.find('a[href="/earth"]').exists()).toBe(false)
  })

  it('hydrates and shows Resume only when a local resume route exists', async () => {
    const progress = useTourProgress()
    progress.visitLesson('units', 'physical-quantities', '/tour/units/physical-quantities#dimensions')
    const router = createTestRouter()
    await router.push('/tour')
    const wrapper = mount(AppNav, { global: { plugins: [router] } })

    expect(progress.hydrated.value).toBe(true)
    expect(wrapper.get('[data-testid="nav-resume"]').attributes('href')).toBe('/tour/units/physical-quantities#dimensions')
  })

  it('exposes and closes the mobile menu through accessible state', async () => {
    const router = createTestRouter()
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
    const router = createTestRouter()
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

  it('isolates app content while open and blocks outside activation', async () => {
    const router = createTestRouter()
    await router.push('/')
    const wrapper = mount(App, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    await flushPromises()
    const toggle = wrapper.get<HTMLButtonElement>('[data-testid="nav-toggle"]')
    const main = wrapper.get<HTMLElement>('#main-content')
    const footer = wrapper.get<HTMLElement>('.app-footer')
    let backgroundActivations = 0
    main.element.addEventListener('click', () => { backgroundActivations += 1 })

    await toggle.trigger('click')
    expect(main.attributes('inert')).toBe('')
    expect(main.attributes('aria-hidden')).toBe('true')
    expect(footer.attributes('inert')).toBe('')
    expect(footer.attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('.app-header').attributes('inert')).toBeUndefined()
    expect(wrapper.get('.app-header').attributes('aria-hidden')).toBeUndefined()

    main.element.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }))
    main.element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(backgroundActivations).toBe(0)
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle.element)
    expect(main.attributes('inert')).toBeUndefined()
    expect(main.attributes('aria-hidden')).toBeUndefined()
    expect(footer.attributes('inert')).toBeUndefined()
    expect(footer.attributes('aria-hidden')).toBeUndefined()
    wrapper.unmount()
  })

  it('traps document-level focus and keeps the selected depth radio in the Tab loop', async () => {
    const router = createTestRouter()
    await router.push('/')
    const wrapper = mount(App, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    await flushPromises()
    const toggle = wrapper.get<HTMLButtonElement>('[data-testid="nav-toggle"]')
    const firstLink = wrapper.get<HTMLAnchorElement>('#primary-navigation a')
    const technical = wrapper.get<HTMLInputElement>('[data-testid="reading-depth-technical"]')
    const skipLink = wrapper.get<HTMLAnchorElement>('.skip-link')

    await toggle.trigger('click')
    skipLink.element.focus()
    skipLink.element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(document.activeElement).toBe(firstLink.element)

    await technical.trigger('change')
    technical.element.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(toggle.element)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(technical.element)
    wrapper.unmount()
  })

  it('clears app isolation and document listeners on route close', async () => {
    const router = createTestRouter()
    await router.push('/')
    const wrapper = mount(App, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    await flushPromises()
    const toggle = wrapper.get('[data-testid="nav-toggle"]')
    const main = wrapper.get<HTMLElement>('#main-content')

    await toggle.trigger('click')
    await router.push('/atlas')
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(main.attributes('inert')).toBeUndefined()
    expect(main.attributes('aria-hidden')).toBeUndefined()

    main.element.setAttribute('tabindex', '-1')
    main.element.focus()
    expect(document.activeElement).toBe(main.element)
    wrapper.unmount()
  })

  it('clears shell isolation and focus listeners when the navigation unmounts open', async () => {
    const router = createTestRouter()
    await router.push('/')
    const showNavigation = ref(true)
    const NavigationShell = defineComponent({
      components: { AppNav },
      setup() {
        return { menuOpen: ref(false), showNavigation }
      },
      template: `
        <div>
          <AppNav v-if="showNavigation" @menu-state-change="menuOpen = $event" />
          <main data-testid="shell-main" :inert="menuOpen ? '' : undefined" :aria-hidden="menuOpen ? 'true' : undefined">
            <button data-testid="shell-control">Background control</button>
          </main>
          <footer data-testid="shell-footer" :inert="menuOpen ? '' : undefined" :aria-hidden="menuOpen ? 'true' : undefined" />
        </div>
      `,
    })
    const wrapper = mount(NavigationShell, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    const main = wrapper.get('[data-testid="shell-main"]')
    const control = wrapper.get<HTMLButtonElement>('[data-testid="shell-control"]')

    await wrapper.get('[data-testid="nav-toggle"]').trigger('click')
    expect(main.attributes('inert')).toBe('')
    showNavigation.value = false
    await nextTick()
    expect(main.attributes('inert')).toBeUndefined()
    expect(main.attributes('aria-hidden')).toBeUndefined()
    expect(wrapper.get('[data-testid="shell-footer"]').attributes('inert')).toBeUndefined()

    control.element.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(control.element)
    wrapper.unmount()
  })

  it.each([
    '/evidence',
    '/sources',
    '/earth',
    '/earth/corpus',
    '/earth/corpus/source-record',
    '/earth/source-record',
    '/earth/programs',
    '/earth/programs/EARTH-FND-001',
    '/earth/simulations',
    '/earth/simulations/EARTH-FND-001',
    '/earth/datasets',
  ])('keeps Evidence active on %s', async (path) => {
    const router = createTestRouter()
    await router.push(path)
    const wrapper = mount(AppNav, { global: { plugins: [router] } })

    const evidence = wrapper.get('a[href="/evidence"]')
    expect(evidence.classes()).toContain('router-link-active')
    expect(evidence.attributes('aria-current')).toBe(path === '/evidence' ? 'page' : 'location')
  })

  it.each([
    '/labs',
    '/labs/authors/chenopdodium',
    '/labs/authors/chenopdodium/source-record',
    '/labs/core',
    '/labs/walls',
    '/labs/earth/EARTH-PLAN-008',
  ])('keeps Workbench active on %s', async (path) => {
    const router = createTestRouter()
    await router.push(path)
    const wrapper = mount(AppNav, { global: { plugins: [router] } })

    const workbench = wrapper.get('a[href="/labs"]')
    const evidence = wrapper.get('a[href="/evidence"]')
    expect(workbench.classes()).toContain('router-link-active')
    expect(workbench.attributes('aria-current')).toBe(path === '/labs' ? 'page' : 'location')
    expect(evidence.classes()).not.toContain('router-link-active')
    expect(evidence.attributes('aria-current')).toBeUndefined()
  })

  it('preserves canonical and legacy EARTH aliases', () => {
    expect(appRouter.resolve('/earth').name).toBe('earth')
    expect(appRouter.resolve('/earth/corpus').name).toBe('earth-corpus')
    expect(appRouter.resolve('/earth/corpus/source-record').name).toBe('earth-document')
    expect(appRouter.resolve('/earth/programs').name).toBe('earth-simulations')
    expect(appRouter.resolve('/earth/programs/EARTH-FND-001').name).toBe('earth-simulation')
    expect(appRouter.resolve('/earth/datasets').name).toBe('earth-datasets')
    expect(appRouter.resolve('/earth/simulations').name).toBe('earth-simulations')
    expect(appRouter.resolve('/earth/simulations/EARTH-FND-001').name).toBe('earth-simulation')
    expect(appRouter.resolve('/earth/source-record').name).toBe('earth-document')
    expect(appRouter.resolve('/core').name).toBe('core')
    expect(appRouter.resolve('/walls').name).toBe('walls')
    expect(appRouter.resolve('/labs/earth/EARTH-PLAN-008').name).toBe('earth-workbench')
    expect(appRouter.resolve('/labs/earth/EARTH-PLAN-008').params.programId).toBe('EARTH-PLAN-008')
    expect(appRouter.resolve('/labs/authors/chenopdodium').name).toBe('fiddle-archive')
    expect(appRouter.resolve('/labs/authors/chenopdodium/source-record').name).toBe('fiddle-record')
    expect(appRouter.resolve('/labs/simulations').name).toBe('legacy-fiddle-archive')
    expect(appRouter.resolve('/labs/simulations/source-record').name).toBe('legacy-fiddle-record')
  })

  it('redirects legacy Fiddle URLs to the author collection with slug and query intact', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    await appRouter.push('/labs/simulations/source-record?q=spin&page=3')
    await appRouter.isReady()

    expect(appRouter.currentRoute.value.name).toBe('fiddle-record')
    expect(appRouter.currentRoute.value.fullPath).toBe('/labs/authors/chenopdodium/source-record?q=spin&page=3')
  })

  it('updates the document title from route metadata', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    await appRouter.push('/evidence')
    await appRouter.isReady()

    expect(document.title).toBe('Evidence Guide | OpenSimPhy Atlas')
  })
})
