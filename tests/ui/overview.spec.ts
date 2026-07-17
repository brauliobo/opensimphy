import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import taxonomyJson from '../../public/data/generated/taxonomy.json'
import { resetAtlasForTests, setAtlasSnapshotForTests } from '../../src/composables/atlasEngine'
import type { TaxonomyArtifact } from '../../src/types/engine'
import OverviewView from '../../src/views/OverviewView.vue'
import TopicView from '../../src/views/TopicView.vue'
import { snapshot } from './fixtures'

describe('constant tour overview', () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: OverviewView },
      { path: '/topics/:id', component: TopicView, props: true },
      { path: '/atlas', component: { template: '<div />' } },
      { path: '/atlas/:id', component: { template: '<div />' } },
    ],
  })

  beforeEach(() => {
    setAtlasSnapshotForTests({ ...snapshot(), taxonomy: taxonomyJson as TaxonomyArtifact })
  })
  afterEach(resetAtlasForTests)

  it('keeps the homepage to eight quiet topic entry points', async () => {
    await router.push('/')
    const wrapper = mount(OverviewView, { global: { plugins: [router] } })

    expect(wrapper.findAll('.topic-door')).toHaveLength(8)
    expect(wrapper.findAll('.topic-category-card')).toHaveLength(0)
    expect(wrapper.get('[data-testid="topic-magnetism"]').text()).toContain('81 constants / 5 families')
    expect(wrapper.find('a[href="/topics/magnetism"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Registry coverage')
  })

  it('isolates categories and examples inside a single topic journey', async () => {
    await router.push('/topics/thermal')
    const wrapper = mount(TopicView, { props: { id: 'thermal' }, global: { plugins: [router] } })

    expect(wrapper.get('h1').text()).toBe('Thermal physics, standard states & radiation')
    expect(wrapper.findAll('.topic-category-card')).toHaveLength(3)
    expect(wrapper.findAll('.topic-featured-grid a')).toHaveLength(4)
    expect(wrapper.find('a[href="/atlas?topic=thermal&category=thermal-radiation"]').exists()).toBe(true)
  })
})
