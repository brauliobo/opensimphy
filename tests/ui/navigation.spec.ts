import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppNav from '../../src/components/AppNav.vue'
import LabsView from '../../src/views/LabsView.vue'
import { router as applicationRouter } from '../../src/router'

describe('responsive navigation state', () => {
  it('exposes and closes the mobile menu through accessible state', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/topics/:id', component: { template: '<div />' } },
        { path: '/atlas', component: { template: '<div />' } },
        { path: '/labs', component: { template: '<div />' } },
        { path: '/sources', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    const wrapper = mount(AppNav, { global: { plugins: [router] } })
    const toggle = wrapper.get('[data-testid="nav-toggle"]')

    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    await wrapper.get('a[href="/atlas"]').trigger('click')
    await router.isReady()
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })
})

describe('disabled ONELAB profile', () => {
  it('omits ONELAB laboratory navigation', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/labs', component: { template: '<div />' } },
        { path: '/labs/core', component: { template: '<div />' } },
        { path: '/labs/walls', component: { template: '<div />' } },
      ],
    })
    await router.push('/labs')
    const wrapper = mount(LabsView, { global: { plugins: [router] } })
    expect(wrapper.find('[data-testid="onelab-nav"]').exists()).toBe(false)
    expect(wrapper.find('a[href="/labs/onelab"]').exists()).toBe(false)
  })

  it('omits the route and sends direct navigation through the catch-all', async () => {
    expect(applicationRouter.hasRoute('onelab')).toBe(false)
    await applicationRouter.push('/labs/onelab')
    expect(applicationRouter.currentRoute.value.fullPath).toBe('/')
  })
})
