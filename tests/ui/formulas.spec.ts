import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import FormulaAtlasView from '../../src/views/FormulaAtlasView.vue'
import FormulaDetailView from '../../src/views/FormulaDetailView.vue'
import { resetAtlasForTests, setAtlasSnapshotForTests } from '../../src/composables/atlasEngine'
import { snapshot } from './fixtures'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/atlas', component: FormulaAtlasView },
    { path: '/atlas/:id', component: FormulaDetailView, props: true },
  ],
})

describe('formula views', () => {
  beforeEach(async () => {
    setAtlasSnapshotForTests(snapshot())
    await router.push('/atlas')
  })
  afterEach(resetAtlasForTests)

  it('filters the registry by search and audit dimensions', async () => {
    const wrapper = mount(FormulaAtlasView, { global: { plugins: [router] } })
    expect(wrapper.findAll('.formula-row')).toHaveLength(3)

    await wrapper.get('[data-testid="formula-search"]').setValue('Formula 2')
    expect(wrapper.findAll('.formula-row')).toHaveLength(1)
    expect(wrapper.get('[data-testid="formula-row-2"]').text()).toContain('F_2')

    await wrapper.get('[data-testid="formula-search"]').setValue('')
    await wrapper.get('[data-testid="formula-classification"]').setValue('exact')
    expect(wrapper.findAll('.formula-row')).toHaveLength(2)

    await wrapper.get('[data-testid="formula-classification"]').setValue('all')
    await wrapper.get('[data-testid="formula-status"]').setValue('fail')
    expect(wrapper.findAll('.formula-row')).toHaveLength(1)
    expect(wrapper.get('[data-testid="formula-row-2"]')).toBeTruthy()
  })

  it('opens topic and category filters from shareable route queries', async () => {
    await router.push('/atlas?topic=magnetism&category=moments-field-standards')
    const wrapper = mount(FormulaAtlasView, { global: { plugins: [router] } })

    expect(wrapper.get<HTMLSelectElement>('[data-testid="formula-topic"]').element.value).toBe('magnetism')
    expect(wrapper.get<HTMLSelectElement>('[data-testid="formula-category"]').element.value).toBe('moments-field-standards')
    expect(wrapper.findAll('.formula-row')).toHaveLength(1)
    expect(wrapper.get('[data-testid="formula-row-2"]').text()).toContain('Spin & magnetism')
  })

  it('renders decomposition, audit, and a real async graph panel on detail', async () => {
    const wrapper = mount(FormulaDetailView, {
      props: { id: 'formula-1' },
      global: { plugins: [router] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Expected / computed')
    expect(wrapper.text()).toContain('EG')
    expect(wrapper.get('[data-testid="formula-graph-ready"]')).toBeTruthy()
  })
})
