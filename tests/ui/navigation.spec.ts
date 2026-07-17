import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppNav from '../../src/components/AppNav.vue'

describe('responsive navigation state', () => {
  it('exposes and closes the mobile menu through accessible state', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/atlas', component: { template: '<div />' } },
        { path: '/core', component: { template: '<div />' } },
        { path: '/walls', component: { template: '<div />' } },
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
