import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import FormulaAtlasView from '../../src/views/FormulaAtlasView.vue'
import FormulaDetailView from '../../src/views/FormulaDetailView.vue'
import { resetFormulaRegistryForTests, setFormulaRegistryForTests } from '../../src/registries/formulaRegistry'
import {
  resetSavedRunRegistryForTests,
  setSavedRunRegistryDependenciesForTests,
  useSavedRunRegistry,
  type SavedRunStorage,
} from '../../src/registries/savedRunRegistry'
import { resetTaxonomyRegistryForTests, setTaxonomyRegistryForTests } from '../../src/registries/taxonomyRegistry'
import { resetTourProgressForTests } from '../../src/registries/tourProgress'
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
    { path: '/tour/:chapter/:lesson', component: { template: '<div />' }, meta: { title: 'Tour Lesson' } },
    { path: '/atlas', component: FormulaAtlasView, meta: { title: 'Formula Atlas' } },
    { path: '/atlas/:id', component: FormulaDetailView, props: true, meta: { title: 'Formula Record' } },
  ],
})

class MemoryStorage implements SavedRunStorage {
  readonly values = new Map<string, string>()
  failWrites = false

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new DOMException('quota exceeded', 'QuotaExceededError')
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

async function mountDetail(id = 'formula-1'): Promise<VueWrapper> {
  const wrapper = mount(FormulaDetailView, {
    props: { id },
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

async function historyTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await flushPromises()
}

describe('formula iteration 6 views', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    resetSavedRunRegistryForTests()
    resetTourProgressForTests()
    setSavedRunRegistryDependenciesForTests({ storage: new MemoryStorage(), now: () => '2026-07-27T10:00:00.000Z' })
    setFormulaRegistryForTests(formulas)
    setTaxonomyRegistryForTests(compatibleTaxonomy)
    await router.push('/atlas')
  })

  afterEach(() => {
    resetFormulaRegistryForTests()
    resetTaxonomyRegistryForTests()
    resetSavedRunRegistryForTests()
    resetTourProgressForTests()
    window.localStorage.clear()
    document.title = ''
  })

  it('filters explicit source criteria separately from the visible 68 dimension conflicts', async () => {
    const wrapper = mount(FormulaAtlasView, { global: { plugins: [router] } })

    expect(wrapper.findAll('.formula-row')).toHaveLength(24)
    expect(wrapper.get('[data-testid="dimension-conflict-count"]').text()).toBe('68 dimension conflicts')
    expect(wrapper.get('[data-testid="dependency-drift-count"]').text()).toBe('26 direct dependency differences')
    expect(wrapper.get('[data-testid="formula-list"]').attributes('aria-live')).toBeUndefined()
    expect(wrapper.get('[data-testid="formula-result-count"]').attributes()).toMatchObject({ role: 'status', 'aria-live': 'polite' })
    await new Promise((resolve) => setTimeout(resolve, 275))
    expect(wrapper.get('[data-testid="formula-result-count"]').text()).toContain('Showing 1–24 of 288 matching formulas')
    expect(wrapper.get('[data-testid="advanced-filters"]').text()).toContain('not scientific validation')
    expect(wrapper.get('[data-testid="advanced-filters"]').text()).not.toMatch(/\b(pass|fail|pending)\b/i)

    await wrapper.get('[data-testid="formula-source-criterion"]').setValue('not-met')
    await flushPromises()
    expect(wrapper.findAll('.formula-row')).toHaveLength(2)
    expect(wrapper.get('[data-testid="formula-result-count"]').text()).toContain('288 matching formulas')
    await new Promise((resolve) => setTimeout(resolve, 275))
    expect(wrapper.get('[data-testid="formula-result-count"]').text()).toContain('2 matching formulas')
    expect(wrapper.get('[data-testid="formula-row-2"]').text()).toContain('source 5.2 sigma criterion not met')
    expect(wrapper.get('[data-testid="formula-row-3"]').text()).toContain('source digit criterion not met')

    await wrapper.get('[data-testid="formula-source-criterion"]').setValue('all')
    await wrapper.get('[data-testid="formula-dimension-audit"]').setValue('conflict')
    await flushPromises()
    expect(wrapper.findAll('.formula-row')).toHaveLength(24)
    expect(wrapper.get('.pagination').text()).toContain('Page 1 / 3')
    expect(wrapper.findAll('.dimension-audit-indicator').every((item) => item.text() === 'dimension audit conflict')).toBe(true)
    wrapper.unmount()
  })

  it('searches preserved source and current runtime dependency ledgers without flattening them', async () => {
    const wrapper = mount(FormulaAtlasView, { global: { plugins: [router] } })

    await wrapper.get('[data-testid="formula-search"]').setValue('source-parent-288')
    await flushPromises()
    expect(wrapper.findAll('.formula-row')).toHaveLength(1)
    expect(wrapper.get('[data-testid="formula-row-288"]')).toBeTruthy()

    await wrapper.get('[data-testid="formula-search"]').setValue('runtime-parent-26')
    await flushPromises()
    expect(wrapper.findAll('.formula-row')).toHaveLength(1)
    expect(wrapper.get('[data-testid="formula-row-26"]')).toBeTruthy()
    expect(wrapper.get('[data-testid="formula-basis"]').text()).toContain('source-labelled exact')
    expect(wrapper.get('[data-testid="formula-basis"]').text()).toContain('source-labelled measured')
    expect(wrapper.get('[data-testid="formula-basis"]').text()).not.toContain('exact definition')
    wrapper.unmount()
  })

  it('strictly canonicalizes every Atlas state and preserves it through detail and browser history', async () => {
    const atlasState = {
      q: 'Formula',
      topic: 'foundations',
      category: 'si-observational-anchors',
      basis: 'exact',
      column: 'alpha',
      island: 'one',
      sourceCriterion: 'met',
      dimensionAudit: 'conflict',
      constructor: 'multiplication',
      representation: 'primary-form',
      page: '2',
    }
    await router.push({ path: '/atlas', query: atlasState })
    const atlas = mount(FormulaAtlasView, { global: { plugins: [router] } })
    await flushPromises()

    expect((atlas.get('[data-testid="formula-search"]').element as HTMLInputElement).value).toBe('Formula')
    expect((atlas.get('[data-testid="formula-basis"]').element as HTMLSelectElement).value).toBe('exact')
    expect((atlas.get('[data-testid="formula-dimension-audit"]').element as HTMLSelectElement).value).toBe('conflict')
    expect(atlas.get('.pagination').text()).toContain('Page 2 / 2')
    expect(router.currentRoute.value.query).toEqual(atlasState)

    const row = atlas.get('.formula-row')
    for (const [key, value] of Object.entries(atlasState)) {
      expect(row.attributes('href')).toContain(`${key}=${value}`)
    }
    await row.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toMatch(/^\/atlas\/\d+$/)
    expect(router.currentRoute.value.query).toEqual(atlasState)

    const detail = await mountDetail(`formula-${String(router.currentRoute.value.params.id)}`)
    const backHref = detail.get('[data-testid="atlas-return"]').attributes('href')
    for (const [key, value] of Object.entries(atlasState)) expect(backHref).toContain(`${key}=${value}`)
    await detail.get('[data-testid="atlas-return"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/atlas')
    expect(router.currentRoute.value.query).toEqual(atlasState)

    await router.push('/atlas?basis=measured')
    await flushPromises()
    expect((atlas.get('[data-testid="formula-basis"]').element as HTMLSelectElement).value).toBe('measured')
    router.back()
    await historyTick()
    expect((atlas.get('[data-testid="formula-basis"]').element as HTMLSelectElement).value).toBe('exact')
    expect((atlas.get('[data-testid="formula-dimension-audit"]').element as HTMLSelectElement).value).toBe('conflict')
    detail.unmount()
    atlas.unmount()
  })

  it('drops unknown, non-finite, default, and stale status query values with canonical replace', async () => {
    await router.push('/atlas?topic=unknown&basis=bogus&sourceCriterion=fail&dimensionAudit=68&page=999&status=pass')
    const wrapper = mount(FormulaAtlasView, { global: { plugins: [router] } })
    await historyTick()

    expect(router.currentRoute.value.fullPath).toBe('/atlas')
    expect((wrapper.get('[data-testid="formula-topic"]').element as HTMLSelectElement).value).toBe('all')
    expect((wrapper.get('[data-testid="formula-source-criterion"]').element as HTMLSelectElement).value).toBe('all')
    expect(wrapper.text()).not.toMatch(/\b(pass|fail|pending)\b/i)
    wrapper.unmount()
  })

  it('renders actual identity and meaning before residuals, equations, and raw constructor anatomy', async () => {
    await router.push('/atlas/1')
    const wrapper = await mountDetail()
    const identity = wrapper.get('[data-testid="formula-record-identity"]').element
    const meaning = wrapper.get('[data-testid="formula-meaning"]').element
    const residuals = wrapper.get('[data-testid="residual-scales"]').element
    const ladder = wrapper.get('[data-testid="equation-ladder"]').element
    const raw = wrapper.get('[data-testid="raw-anatomy"]').element

    expect(identity.compareDocumentPosition(meaning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(meaning.compareDocumentPosition(residuals) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(residuals.compareDocumentPosition(ladder) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(ladder.compareDocumentPosition(raw) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(wrapper.get('[data-testid="formula-meaning"]').text()).toContain('Named target: Fixture quantity 1')
    expect(wrapper.get('[data-testid="formula-meaning"]').text()).toContain('physical quantity named "Formula 1"')
    expect(wrapper.get('[data-testid="formula-meaning"]').text()).toContain('source-labelled exact reference')
    expect(wrapper.get('[data-testid="formula-meaning"]').text()).toContain('Fundamental anchors & natural scales / SI anchors')
    expect(wrapper.get('[data-testid="meaning-caveats"]').text()).toContain('preserved wording, not an authoritative physical definition')
    expect(wrapper.get('[data-testid="formula-meaning"]').text()).toContain('does not independently validate')
    expect(wrapper.get('[data-testid="residual-scales"]').text()).toContain('Signed absolute residual')
    expect(wrapper.get('[data-testid="residual-scales"]').text()).toContain('Relative residual')
    expect(wrapper.find('[data-testid="standardized-residual"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('z-score')
    expect(wrapper.get('[data-testid="constructor-token-key"]').text()).toContain('External geometry')
    expect(wrapper.get('[data-testid="constructor-token-key"]').text()).toContain('Inversion-boundary scale')
    wrapper.unmount()
  })

  it('renders the preserved V_m_1 pressure-label correction before residuals', async () => {
    await router.push('/atlas/120')
    const wrapper = await mountDetail('formula-120')
    const caveats = wrapper.get('[data-testid="meaning-caveats"]')
    const residuals = wrapper.get('[data-testid="residual-scales"]')

    expect(caveats.text()).toContain('source label says 100 kPa')
    expect(caveats.text()).toContain('101325.003754773 Pa')
    expect(caveats.text()).toContain('about 101.325 kPa')
    expect(caveats.element.compareDocumentPosition(residuals.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    wrapper.unmount()
  })

  it('accepts only decoded local Tour lesson returns without loading Tour content', async () => {
    await router.push({
      path: '/atlas/1',
      query: { returnTo: '/tour/anchors/lesson-one?path=quick#interpret' },
    })
    const valid = await mountDetail()
    expect(valid.get('[data-testid="tour-return"]').text()).toBe('Return to Tour lesson')
    expect(valid.get('[data-testid="tour-return"]').attributes('href')).toBe('/tour/anchors/lesson-one?path=quick#interpret')
    valid.unmount()

    for (const returnTo of ['https://evil.test/tour/a/b', '//evil.test/tour/a/b', '/tour/a/b?path=other', '/tour/a//b', '/tour/a/b\ncontrol']) {
      await router.push({ path: '/atlas/1', query: { returnTo } })
      const invalid = await mountDetail()
      expect(invalid.find('[data-testid="tour-return"]').exists()).toBe(false)
      invalid.unmount()
    }
  })

  it('keeps Guided meaning and source verdict while Technical adds separate source/runtime graphs, parents, literals, dimensions, and provenance', async () => {
    await router.push('/atlas/1')
    const wrapper = await mountDetail()
    const guidedVerdict = wrapper.get('[data-testid="source-criterion-finding"]').text()

    expect(wrapper.findAll('[data-testid="equation-ladder"] li')).toHaveLength(1)
    expect(wrapper.find('[data-testid="technical-audit"]').exists()).toBe(false)
    await wrapper.get('[data-testid="reading-depth-technical"]').setValue(true)
    await flushPromises()

    expect(wrapper.get('[data-testid="source-criterion-finding"]').text()).toBe(guidedVerdict)
    expect(wrapper.get('[data-testid="evaluation-ledger"]').text()).toContain('Preserved source evaluation')
    expect(wrapper.get('[data-testid="evaluation-ledger"]').text()).toContain('Current runtime evaluation')
    expect(wrapper.get('[data-testid="evaluation-ledger"]').text()).toContain('Computed dimension: m')
    expect(wrapper.get('[data-testid="technical-audit"]').text()).toContain('T^0 L^2')
    expect(wrapper.get('[data-testid="dimension-finding"]').text()).toContain('not repaired')
    expect(wrapper.get('[data-testid="dimension-basis-note"]').text()).toContain('historical five-axis basis')
    expect(wrapper.get('[data-testid="dimension-basis-note"]').text()).toContain('treats mol as dimensionless')
    expect(wrapper.get('[data-testid="dimension-basis-note"]').text()).toContain('cannot audit amount-of-substance semantics')
    expect(wrapper.get('[data-testid="source-dependency-trace"]').text()).toContain('source-parent-1')
    expect(wrapper.get('[data-testid="source-dependency-trace"]').text()).toContain('parent source-direct-1')
    expect(wrapper.get('[data-testid="runtime-dependency-trace"]').text()).toContain('runtime-parent-1')
    expect(wrapper.get('[data-testid="runtime-dependency-trace"]').text()).toContain('parent runtime-direct-1')
    expect(wrapper.get('[data-testid="dependency-agreement"]').text()).toContain('one of the v7 registry\'s 26 qualified direct-trace differences')
    expect(wrapper.get('[data-testid="dependency-agreement"]').findAll('dd').map((item) => item.text())).toEqual(['source-direct-1', 'runtime-direct-1'])
    expect(wrapper.get('[data-testid="constructor-literals"]').text()).toContain('not dependency nodes')
    expect(wrapper.get('[data-testid="constructor-literals"]').text()).toContain('6')
    expect(wrapper.get('[data-testid="technical-audit"]').text()).toContain('constants-yaml / sources/constants.yaml')
    expect(wrapper.get('[data-testid="technical-audit"]').text()).toContain('published-output / sources/latest-output.txt')
    expect(wrapper.get('[data-testid="technical-audit"]').text()).toContain('fixture-recipes-sha256-v1')
    expect(wrapper.get('[data-testid="technical-audit"]').text()).toContain('fixture-symbols-sha256-v1')
    expect(wrapper.get('[data-testid="technical-audit"]').text()).toContain('fixture-composite-source-v1')
    expect(wrapper.get('[data-testid="technical-audit"]').text()).toContain('formula-record-v7')
    expect(wrapper.get('[data-testid="technical-audit"]').text()).not.toContain('Complete dependency trace')

    await wrapper.get('[data-testid="reveal-all-equation-steps"]').trigger('click')
    expect(wrapper.findAll('[data-testid="equation-ladder"] li')).toHaveLength(5)
    wrapper.unmount()
  })

  it('keeps the textual synthetic finding and accessible complete table available before the lazy plot', async () => {
    await router.push('/atlas/1')
    const wrapper = await mountDetail()

    expect(wrapper.get('[data-testid="sweep-finding"]').text()).toContain('float64 reproduction')
    expect(wrapper.get('[data-testid="sweep-finding"]').attributes()).toMatchObject({ role: 'status', 'aria-live': 'polite' })
    expect(wrapper.get('[data-testid="formula-sweep"]').text()).toContain('not uncertainty propagation')
    expect(wrapper.get('[data-testid="formula-sweep"]').text()).toContain('not scientific validation')
    expect(wrapper.get('[data-testid="sweep-table"]').find('caption').text()).toContain('All synthetic inversion-boundary sensitivity points')
    expect(wrapper.get('[data-testid="sweep-table"]').findAll('thead th').map((item) => item.text())).toEqual([
      'Scale', 'Real', 'Imaginary', 'Magnitude', 'Sign', 'Finite',
    ])
    expect(wrapper.get('[data-testid="sweep-table"]').findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.find('[data-testid="formula-graph-ready"]').exists()).toBe(false)

    const disclosure = wrapper.get('[data-testid="graph-disclosure"]')
    ;(disclosure.element as HTMLDetailsElement).open = true
    await disclosure.trigger('toggle')
    await flushPromises()
    expect(wrapper.get('[data-testid="formula-graph-ready"]')).toBeTruthy()
    expect(wrapper.get('[data-testid="sweep-finding"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('saves only on explicit action with the selected scale, raw outputs, structured finding, provenance, and record revisions', async () => {
    const storage = new MemoryStorage()
    setSavedRunRegistryDependenciesForTests({ storage, now: () => '2026-07-27T10:00:00.000Z' })
    await router.push('/atlas/1')
    const wrapper = await mountDetail()
    const registry = useSavedRunRegistry()

    expect(registry.runs.value).toHaveLength(0)
    await wrapper.get('[data-testid="sweep-scale"]').setValue('1.5')
    await wrapper.get('[data-testid="save-label"]').setValue('High scale')
    expect(registry.runs.value).toHaveLength(0)
    await wrapper.get('[data-testid="save-formula-run"]').trigger('click')

    expect(registry.runs.value).toHaveLength(1)
    const saved = registry.runs.value[0]!
    expect(saved).toMatchObject({
      instrumentId: 'formula-1',
      methodId: 'float64-source-reproduction',
      inputs: { selectedScale: 1.5 },
      outputs: {
        selectedSweepPoint: { scale: 1.5, real: 1.25, imaginary: -0.02, magnitude: 1.25016, sign: 1, finite: true },
        nominalScaleOneReproduction: {
          expected: '1.000000000',
          expectedNumeric: 1,
          computed: 1,
          signedResidual: 0,
          unit: 'm',
        },
      },
      sourceRevision: 'fixture-composite-source-v1',
      implementationRevision: 'fixture-formula-evaluator-v1',
      contentRevision: 'formula-record-v7',
      compatibilityKey: '1'.padStart(64, '0'),
      label: 'High scale',
    })
    expect(saved.finding).toMatchObject({
      kind: 'synthetic-inversion-boundary-sensitivity',
      selectedOutput: { scope: 'synthetic-selected-scale-output', scale: 1.5 },
      nominalScaleOneSourceComparison: { scope: 'nominal-scale-one-source-comparison', scientificValidation: false },
    })
    expect(saved.provenance).toMatchObject({ formulaId: 'formula-1', formulaOrdinal: 1, outputSchemaRevision: 'formula-record-v7' })
    expect(Object.hasOwn(saved.outputs as object, 'residual')).toBe(false)
    expect(Object.keys(saved.outputs as object)).toEqual(['selectedSweepPoint', 'nominalScaleOneReproduction'])
    expect(Object.isFrozen(saved)).toBe(true)
    expect(wrapper.find('[data-testid="formula-storage-error"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows browser storage errors instead of implying that an explicit save persisted', async () => {
    setSavedRunRegistryDependenciesForTests({ storage: null, now: () => '2026-07-27T10:00:00.000Z' })
    await router.push('/atlas/1')
    const wrapper = await mountDetail()
    await wrapper.get('[data-testid="save-formula-run"]').trigger('click')

    expect(wrapper.get('[data-testid="formula-storage-error"]').text()).toContain('browser storage could not save it')
    wrapper.unmount()
  })

  it('freezes at most two compatible scale snapshots and reports the selected-real delta', async () => {
    await router.push('/atlas/1')
    const wrapper = await mountDetail()
    const scale = wrapper.get('[data-testid="sweep-scale"]')
    const freeze = wrapper.get('[data-testid="freeze-comparison"]')

    await scale.setValue('0.5')
    await freeze.trigger('click')
    await scale.setValue('1.5')
    await freeze.trigger('click')

    expect(wrapper.get('[data-testid="comparison-tray"]').text()).toContain('2 of 2 states')
    expect(wrapper.get('[data-testid="compatible-comparison"]').text()).toContain('Domain-specific residual / selected-real delta')
    expect(wrapper.get('[data-testid="compatible-comparison"]').text()).toContain('0.450000000 m')
    expect(wrapper.get<HTMLButtonElement>('[data-testid="freeze-comparison"]').element.disabled).toBe(true)

    await wrapper.get('[data-testid="remove-comparison-0"]').trigger('click')
    expect(wrapper.get('[data-testid="comparison-tray"]').text()).toContain('1 of 2 states')
    expect(wrapper.get<HTMLButtonElement>('[data-testid="freeze-comparison"]').element.disabled).toBe(false)
    await wrapper.get('[data-testid="reset-comparison"]').trigger('click')
    expect(wrapper.get('[data-testid="comparison-tray"]').text()).toContain('0 of 2 states')
    wrapper.unmount()
  })

  it('uses the actual record title, updates it on ID changes, and safely restores the route title on unmount', async () => {
    await router.push('/atlas/1')
    const wrapper = await mountDetail()
    expect(document.title).toBe('F_1: Formula 1 | OpenSimPhy Atlas')

    await wrapper.setProps({ id: 'formula-2' })
    await flushPromises()
    expect(document.title).toBe('F_2: Formula 2 | OpenSimPhy Atlas')
    wrapper.unmount()
    expect(document.title).toBe('Formula Record | OpenSimPhy Atlas')
  })

  it('fails closed when formula and taxonomy coverage are incompatible', async () => {
    setTaxonomyRegistryForTests(taxonomy)
    const wrapper = mount(FormulaAtlasView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="formula-registry-ready"]').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('Formula/taxonomy coverage is 288/3/288')
    expect(wrapper.find('.formula-row').exists()).toBe(false)
    wrapper.unmount()
  })
})
