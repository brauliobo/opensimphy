import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import FormulaAtlasView from '../../src/views/FormulaAtlasView.vue'
import FormulaDetailView from '../../src/views/FormulaDetailView.vue'
import { resetFormulaRegistryForTests, setFormulaRegistryForTests } from '../../src/registries/formulaRegistry'
import { resetTaxonomyRegistryForTests, setTaxonomyRegistryForTests } from '../../src/registries/taxonomyRegistry'
import { formula, taxonomy } from './fixtures'

const formulas = Array.from({ length: 288 }, (_, index) => formula(index + 1))
const compatibleTaxonomy = {
  ...taxonomy,
  total: 288,
  topics: taxonomy.topics.map((topic) => topic.id === 'foundations'
    ? { ...topic, count: 144, exactCount: 144, measuredCount: 0, categories: topic.categories.map((item) => ({ ...item, count: 144 })) }
    : { ...topic, count: 144, exactCount: 0, measuredCount: 144, categories: topic.categories.map((item) => ({ ...item, count: 144 })) }),
  facets: {
    ...taxonomy.facets,
    basis: [{ id: 'exact', count: 144 }, { id: 'measured', count: 144 }],
    constructor: [{ id: 'multiplication', count: 288 }],
    buildPass: [{ id: 'pass-1', count: 288 }],
    sourceUnitFamily: [{ id: 'spatial', count: 288 }],
    representation: [{ id: 'primary-form', count: 288 }],
  },
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/topics/:id', component: { template: '<div />' } },
    { path: '/atlas', component: FormulaAtlasView },
    { path: '/atlas/:id', component: FormulaDetailView, props: true },
  ],
})

describe('formula views', () => {
  beforeEach(async () => {
    setFormulaRegistryForTests(formulas)
    setTaxonomyRegistryForTests(compatibleTaxonomy)
    await router.push('/atlas')
  })
  afterEach(() => {
    resetFormulaRegistryForTests()
    resetTaxonomyRegistryForTests()
  })

  it('filters the registry by search and audit dimensions', async () => {
    const wrapper = mount(FormulaAtlasView, { global: { plugins: [router] } })
    expect(wrapper.findAll('.formula-row')).toHaveLength(24)
    expect(wrapper.findAll('.filter-console-primary .field')).toHaveLength(4)
    expect(wrapper.get('[data-testid="advanced-filters"]').attributes('open')).toBeUndefined()

    await wrapper.get('[data-testid="formula-search"]').setValue('Formula 288')
    expect(wrapper.findAll('.formula-row')).toHaveLength(1)
    expect(wrapper.get('[data-testid="formula-row-288"]').text()).toContain('F_288')

    await wrapper.get('[data-testid="formula-search"]').setValue('')
    await wrapper.get('[data-testid="formula-classification"]').setValue('exact')
    expect(wrapper.findAll('.formula-row')).toHaveLength(24)

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
    expect(wrapper.findAll('.formula-row')).toHaveLength(24)
    expect(wrapper.get('[data-testid="formula-row-2"]').text()).toContain('Spin & magnetism')
    expect(wrapper.get('[data-testid="formula-row-2"]').attributes('href')).toBe('/atlas/2?topic=magnetism&category=moments-field-standards')
  })

  it('fails closed when formula and taxonomy coverage are incompatible', async () => {
    setTaxonomyRegistryForTests(taxonomy)
    const wrapper = mount(FormulaAtlasView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="formula-registry-ready"]').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('Formula/taxonomy coverage is 288/3/288')
    expect(wrapper.find('.formula-row').exists()).toBe(false)
  })

  it('fails closed when a formula references an unknown taxonomy category', async () => {
    setFormulaRegistryForTests(formulas.map((item, index) => index === 0 ? { ...item, category: 'missing-category' } : item))
    const wrapper = mount(FormulaAtlasView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="formula-registry-ready"]').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('references unknown category missing-category')
  })

  it('fails closed when a featured ID and recipe number do not resolve together', async () => {
    setTaxonomyRegistryForTests({
      ...compatibleTaxonomy,
      topics: compatibleTaxonomy.topics.map((topic, index) => index === 0
        ? { ...topic, featured: [{ ...topic.featured[0]!, recipeNumber: 2 }] }
        : topic),
    })
    const wrapper = mount(FormulaAtlasView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="formula-registry-ready"]').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('does not resolve to one formula')
  })

  it('renders decomposition, audit, and a real async graph panel on detail', async () => {
    const wrapper = mount(FormulaDetailView, {
      props: { id: 'formula-1' },
      global: { plugins: [router] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Expected / computed')
    expect(wrapper.text()).toContain('EG')
    expect(wrapper.find('[data-testid="formula-graph-ready"]').exists()).toBe(false)
    const disclosure = wrapper.get('[data-testid="graph-disclosure"]')
    ;(disclosure.element as HTMLDetailsElement).open = true
    await disclosure.trigger('toggle')
    await flushPromises()
    expect(wrapper.get('[data-testid="formula-graph-ready"]')).toBeTruthy()
  })

  it('reloads formula detail when the route ID prop changes', async () => {
    const wrapper = mount(FormulaDetailView, {
      props: { id: 'formula-1' },
      global: { plugins: [router] },
    })
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('F_1')

    await wrapper.setProps({ id: 'formula-2' })
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('F_2')
  })
})
