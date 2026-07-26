import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import EarthLocalNav from '../../src/components/EarthLocalNav.vue'

const routes = [
  { path: '/earth', name: 'earth', component: { template: '<div />' } },
  { path: '/earth/corpus', name: 'earth-corpus', component: { template: '<div />' } },
  { path: '/earth/programs', alias: '/earth/simulations', name: 'earth-simulations', component: { template: '<div />' } },
  { path: '/earth/programs/:id', alias: '/earth/simulations/:id', name: 'earth-simulation', component: { template: '<div />' } },
  { path: '/earth/datasets', name: 'earth-datasets', component: { template: '<div />' } },
  { path: '/earth/corpus/:slug', alias: '/earth/:slug', name: 'earth-document', component: { template: '<div />' } },
]

describe('EARTH local navigation', () => {
  it.each([
    ['/earth', '/earth'],
    ['/earth/corpus', '/earth/corpus'],
    ['/earth/corpus/source-record', '/earth/corpus'],
    ['/earth/programs', '/earth/programs'],
    ['/earth/programs/EARTH-FND-001', '/earth/programs'],
    ['/earth/simulations/EARTH-FND-001', '/earth/programs'],
    ['/earth/datasets', '/earth/datasets'],
  ])('marks the owning section current on %s', async (path, currentHref) => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push(path)
    const wrapper = mount(EarthLocalNav, { global: { plugins: [router] } })
    const current = wrapper.get('a[aria-current="page"]')

    expect(wrapper.get('nav').attributes('aria-label')).toBe('EARTH dossier navigation')
    expect(current.attributes('href')).toBe(currentHref)
    expect(wrapper.findAll('a[aria-current="page"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('03/AOverview')
    expect(wrapper.text()).toContain('03/BCorpus · 63')
    expect(wrapper.text()).toContain('03/CPrograms · 130')
    expect(wrapper.text()).toContain('03/DData · 19')
  })
})
