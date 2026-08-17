import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import generatedCompletion from '../../public/data/generated/earth/completion.json'
import generatedDatasets from '../../public/data/generated/earth/datasets.json'
import generatedEvidenceManifest from '../../public/data/generated/earth/evidence/manifest.json'
import prt001Evidence from '../../public/data/generated/earth/evidence/programs/EARTH-PRT-001.json'
import generatedManifest from '../../public/data/generated/earth/manifest.json'
import generatedRegistry from '../../public/data/generated/earth/scientific-simulations.json'
import { runEarthMethodInWorker } from '../../src/earth/runSimulation'
import {
  hasSimulationRunControl,
  isSimulationBlocked,
  loadScientificSimulationBundle,
  type ScientificSimulationRecord,
} from '../../src/earth/simulations'
import {
  DEFAULT_EARTH_METHOD_INPUTS,
  DEFAULT_EARTH_SIMULATION_INPUTS,
  SUPPORTED_EARTH_SIMULATION_IDS,
} from '../../src/engine/earth'
import { extractPredictions, predictionOutcomeLabel } from '../../src/earth/predictions'
import EarthSimulationDetailView from '../../src/views/EarthSimulationDetailView.vue'
import EarthSimulationsView from '../../src/views/EarthSimulationsView.vue'

vi.mock('../../src/earth/runSimulation', () => ({ runEarthMethodInWorker: vi.fn() }))

const runnerMock = vi.mocked(runEarthMethodInWorker)

const sourceDocument = {
  id: 'earth-source-1',
  slug: 'source-record--abc123',
  title: 'Resolved EARTH Source',
}

function simulation(index: number) {
  return {
    id:                `sim-${String(index).padStart(3, '0')}`,
    title:             index === 7 ? 'Target Nebula Program' : `Scientific Program ${index}`,
    prefix:            index % 2 === 0 ? 'COS' : 'BIO',
    classification:    index % 3 === 0 ? 'field' : 'particle',
    executionTier:     index % 2 === 0 ? 2 : 1,
    executionMode:     index === 1 ? 'blocked' : index === 2 ? 'browser-worker' : 'external',
    highLevelGoal:     `Test scientific goal ${index}`,
    minorGoals:        [`Minor goal ${index}`],
    method:            { equations: [`x_${index} = ${index}`], procedure: [`Evaluate case ${index}`] },
    outputs:           [`Observable ${index}`],
    currentState:      index === 1 ? 'blocked' : index % 4 === 0 ? 'ready' : 'planned',
    sourceDocumentIds: [sourceDocument.id],
    dependencies:      index === 2 ? ['sim-003'] : [],
    gateStates:        { inputs: 'pass', method: index === 1 ? 'blocked' : 'pass' },
    blockers:          index === 1 ? ['Required calibration is unavailable'] : [],
  }
}

function normalizedSimulation(index: number): ScientificSimulationRecord {
  const legacy = simulation(index)
  const runnable = legacy.executionMode !== 'blocked'
  const defaultMethodId = 'legacy-requested-method'
  return {
    ...legacy,
    classificationSource: null,
    executionTiers: [String(legacy.executionTier)],
    tierSource: null,
    inferredTypeMetadata: true,
    runnable,
    scientificStatus: runnable ? 'unresolved' : 'blocked',
    defaultMethodId,
    executionMethods: [{
      id: defaultMethodId,
      title: 'Legacy requested execution method',
      relationship: 'source-contract-validator',
      modelOrigin: 'engine-audit',
      runtime: runnable ? 'browser-worker' : 'unavailable',
      runnable,
      earthDerived: false,
      validatesEarthTheory: false,
    }],
    sourceState: { text: legacy.currentState, status: legacy.currentState },
  }
}

const registry = {
  records: Array.from({ length: 130 }, (_, index) => simulation(index + 1)),
  summary: { total: 130 },
}
const manifest = { documents: [sourceDocument] }
const completion = { generatedAt: '2026-07-17', complete: true, errors: [], unresolved: [] }

function response(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response
}

function mockRegistryFetch(registryBody: unknown = registry): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/scientific-simulations.json')) return response(registryBody)
    if (url.endsWith('/manifest.json')) return response(manifest)
    if (url.endsWith('/completion.json')) return response(completion)
    return { ok: false, status: 404, json: async () => ({}) } as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function mockGeneratedRegistryFetch(registryBody: unknown = generatedRegistry): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/scientific-simulations.json')) return response(registryBody)
    if (url.endsWith('/manifest.json')) return response(generatedManifest)
    if (url.endsWith('/completion.json')) return response(generatedCompletion)
    return { ok: false, status: 404, json: async () => ({}) } as Response
  }))
}

function mockGeneratedEvidenceFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/scientific-simulations.json')) return response(generatedRegistry)
    if (url.endsWith('/earth/manifest.json')) return response(generatedManifest)
    if (url.endsWith('/completion.json')) return response(generatedCompletion)
    if (url.endsWith('/datasets.json')) return response(generatedDatasets)
    if (url.endsWith('/evidence/manifest.json')) return response(generatedEvidenceManifest)
    if (url.endsWith('/evidence/programs/EARTH-PRT-001.json')) return response(prt001Evidence)
    return { ok: false, status: 404, json: async () => ({}) } as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/earth', name: 'earth', component: { template: '<div />' } },
      { path: '/earth/corpus', name: 'earth-corpus', component: { template: '<div />' } },
      { path: '/earth/programs', name: 'earth-simulations', component: EarthSimulationsView },
      { path: '/earth/programs/:id', name: 'earth-simulation', component: EarthSimulationDetailView, props: true },
      { path: '/earth/datasets', name: 'earth-datasets', component: { template: '<div />' } },
      { path: '/earth/corpus/:slug', name: 'earth-document', component: { template: '<div />' } },
    ],
  })
}

async function mountDetail(id: string) {
  const router = testRouter()
  await router.push(`/earth/programs/${id}`)
  const wrapper = mount(EarthSimulationDetailView, {
    props: { id },
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

describe('EARTH scientific simulation registry', () => {
  beforeEach(() => {
    runnerMock.mockReset()
  })

  it('normalizes the canonical generated artifact after validating its audit metadata', async () => {
    mockGeneratedRegistryFetch()
    const router = testRouter()
    await router.push('/earth/programs')
    const wrapper = mount(EarthSimulationsView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.findAll('.earth-program-row')).toHaveLength(36)
    expect(wrapper.text()).toContain('Canonical constants and dimensions')
    expect(wrapper.get('[data-testid="program-registry-statement"]').text()).toContain('130 canonical programs')
    expect(wrapper.get('[data-testid="program-registry-statement"]').text()).toContain('220 declared methods')
    expect(wrapper.get('[data-testid="program-registry-statement"]').text()).toContain('134 runnable: 37 source reproductions / 97 traditional comparisons or contract validators; 86 unavailable source formulations')
    expect(wrapper.get('[data-testid="program-registry-statement"]').text()).toContain('Scientific validation not established')
    expect(wrapper.findAll('.program-domain-group').length).toBeGreaterThan(1)
    expect(wrapper.findAll('.program-domain-group').map((group) => group.attributes('data-domain'))).toEqual(
      [...wrapper.findAll('.program-domain-group').map((group) => group.attributes('data-domain'))].sort(),
    )
    expect(wrapper.get('[data-testid="earth-campaign-strip"]').text()).toContain('SIM-NUC-PROTON')
    expect(wrapper.get('[data-testid="earth-campaign-strip"]').text()).toContain('SIM-FLD')
    expect(wrapper.get('a[href="/earth/programs/EARTH-NUC-004"]').exists()).toBe(true)
  })

  it('retains schema v2 source and method metadata in the owning UI record contract', async () => {
    mockGeneratedRegistryFetch()
    const bundle = await loadScientificSimulationBundle()
    const sourceBlocked = bundle.registry.records.find(({ id }) => id === 'EARTH-FLD-005')

    expect(bundle.registry.summary).toMatchObject({ totalMethods: 221, runnableMethods: 135 })
    expect(bundle.registry.records.flatMap(({ executionMethods }) => executionMethods)).toHaveLength(221)
    expect(sourceBlocked).toMatchObject({
      runnable: true,
      scientificStatus: 'blocked-source',
      sourceState: { status: 'blocked' },
      currentState: 'blocked',
      classificationSource: 'Numerical simulation',
      executionTiers: ['T1', 'T2'],
      tierSource: 'T1/T2',
    })
    expect(sourceBlocked?.sourceState.text).toContain('EARTH physical model BX')
  })

  it('fails closed when generated method metadata drifts from the engine registry', async () => {
    const drifted = structuredClone(generatedRegistry)
    drifted.items[0].defaultMethodId = 'traditional-analytic-baseline-v1'
    drifted.items[0].executionMethods[0].id = 'traditional-analytic-baseline-v1'
    mockGeneratedRegistryFetch(drifted)

    await expect(loadScientificSimulationBundle()).rejects.toThrow('does not match the EARTH engine default')
  })

  it('requires exact engine parity for runnable methods and strict unavailable schemas', async () => {
    const runnableDrift = structuredClone(generatedRegistry)
    runnableDrift.items[0].executionMethods[0].title = 'Drifted runnable title'
    mockGeneratedRegistryFetch(runnableDrift)
    await expect(loadScientificSimulationBundle()).rejects.toThrow('does not match the EARTH engine method definition')

    const unavailableDrift = structuredClone(generatedRegistry)
    const blockedSource = unavailableDrift.items.find(({ scientificStatus }) => scientificStatus === 'blocked-source')!
    const unavailable = blockedSource.executionMethods.find(({ runnable }) => !runnable)!
    unavailable.runtime = 'browser-worker'
    mockGeneratedRegistryFetch(unavailableDrift)
    await expect(loadScientificSimulationBundle()).rejects.toThrow('non-runnable methods must have unavailable runtime')
  })

  it('fails closed when the registry does not contain exactly 130 records', async () => {
    mockRegistryFetch({ ...registry, records: registry.records.slice(0, 129) })
    const router = testRouter()
    await router.push('/earth/programs')
    const wrapper = mount(EarthSimulationsView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('expected 130 records, received 129')
    expect(wrapper.findAll('.earth-program-row')).toHaveLength(0)
  })

  it('uses canonical links and URL-backed scientific and execution filters', async () => {
    const fetchMock = mockRegistryFetch()
    const router = testRouter()
    await router.push('/earth/programs')
    const wrapper = mount(EarthSimulationsView, { global: { plugins: [router] } })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(wrapper.findAll('.earth-program-row')).toHaveLength(36)
    expect(wrapper.findAll('.earth-program-row').every((link) => link.attributes('href')?.startsWith('/earth/programs/sim-'))).toBe(true)
    expect(wrapper.get('[data-testid="simulation-result-count"]').text()).toContain('Showing 1–36 of 130 matching programs')

    await wrapper.get('[data-testid="simulation-search"]').setValue('Target Nebula')
    await flushPromises()
    expect(wrapper.findAll('.earth-program-row')).toHaveLength(1)
    expect(router.currentRoute.value.query).toEqual({ q: 'Target Nebula' })
    await wrapper.get('[data-testid="simulation-search"]').setValue('')

    await wrapper.get('[data-testid="simulation-domain"]').setValue('COS')
    await flushPromises()
    expect(wrapper.findAll('.earth-program-row')).toHaveLength(36)
    expect(router.currentRoute.value.query).toEqual({ domain: 'COS' })
    await wrapper.get('[data-testid="simulation-domain"]').setValue('all')

    await wrapper.get('[data-testid="simulation-class"]').setValue('field')
    await flushPromises()
    expect(wrapper.get('[data-testid="simulation-result-count"]').text()).toContain('of 43 matching programs')
    await wrapper.get('[data-testid="simulation-class"]').setValue('all')

    await wrapper.get('[data-testid="simulation-method"]').setValue('source-contract-validator')
    await flushPromises()
    expect(wrapper.get('[data-testid="simulation-result-count"]').text()).toContain('of 129 matching programs')
    expect(router.currentRoute.value.query).toEqual({ method: 'source-contract-validator' })
    await wrapper.get('[data-testid="simulation-method"]').setValue('all')

    await wrapper.get('[data-testid="simulation-science"]').setValue('blocked')
    await flushPromises()
    expect(wrapper.findAll('.earth-program-row')).toHaveLength(1)
    expect(wrapper.get('.program-row-science').text()).toContain('EXECUTION BLOCKED / NOT VALIDATED')
    expect(router.currentRoute.value.query).toEqual({ science: 'blocked' })
    await wrapper.get('[data-testid="simulation-science"]').setValue('all')

    await wrapper.get('[data-testid="simulation-runtime"]').setValue('unavailable')
    await flushPromises()
    expect(wrapper.findAll('.earth-program-row')).toHaveLength(1)
    expect(wrapper.get('.program-row-methods').text()).toContain('0 runnable · 1 unavailable')
    await wrapper.get('[data-testid="simulation-runtime"]').setValue('all')

    await wrapper.get('[data-testid="simulation-gate"]').setValue('method')
    await flushPromises()
    expect(wrapper.findAll('.earth-program-row')).toHaveLength(1)
    expect(router.currentRoute.value.query).toEqual({ gate: 'method' })
    expect(wrapper.get('[data-testid="simulation-advanced-filters"] summary').text()).toContain('1 active filter')
  })

  it('restores URL filters and page while rendering deterministic batches', async () => {
    mockRegistryFetch()
    const router = testRouter()
    await router.push('/earth/programs?domain=COS&page=2')
    const wrapper = mount(EarthSimulationsView, { global: { plugins: [router] } })
    await flushPromises()

    expect((wrapper.get('[data-testid="simulation-domain"]').element as HTMLSelectElement).value).toBe('COS')
    expect(wrapper.findAll('.earth-program-row')).toHaveLength(29)
    expect(wrapper.get('[data-testid="simulation-result-count"]').text()).toContain('Showing 37–65 of 65 matching programs. Page 2 of 2.')

    await wrapper.get('[aria-label="Previous registry page"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ domain: 'COS' })
    expect(wrapper.findAll('.earth-program-row')).toHaveLength(36)

    await wrapper.get('[aria-label="Next registry page"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ domain: 'COS', page: '2' })
  })

  it('keeps canonical class, source status, scientific status, methods, and runtime as separate axes', async () => {
    mockGeneratedRegistryFetch()
    const router = testRouter()
    await router.push('/earth/programs?q=EARTH-FND-006')
    const wrapper = mount(EarthSimulationsView, { global: { plugins: [router] } })
    await flushPromises()

    const blockedRow = wrapper.get('[data-testid="simulation-record-EARTH-FND-006"]')
    expect(blockedRow.get('.program-row-identity').text()).toContain('Canonical class: numerical simulation')
    expect(blockedRow.get('.program-row-science').text()).toContain('SOURCE MODEL BLOCKED')
    expect(blockedRow.get('.program-row-science').text()).toContain('Scientific status: BLOCKED BY SOURCE MODEL')
    expect(blockedRow.get('.program-row-methods').text()).toContain('2 declared methods')
    expect(blockedRow.get('.program-row-methods').text()).toContain('source contract validator')
    expect(blockedRow.get('.program-row-methods').text()).toContain('earth source model')
    expect(blockedRow.get('.program-row-methods').text()).toContain('1 runnable · 1 unavailable · browser worker + unavailable')
    expect(blockedRow.get('.program-row-evidence').text()).toContain('Next blocker')
    expect(blockedRow.find('.status-chip').exists()).toBe(false)

    await wrapper.get('[data-testid="simulation-runtime"]').setValue('unavailable')
    await flushPromises()
    expect(wrapper.find(`[data-testid="simulation-record-EARTH-FND-006"]`).exists()).toBe(true)
    await wrapper.get('[data-testid="simulation-runtime"]').setValue('available')
    await flushPromises()
    expect(wrapper.find(`[data-testid="simulation-record-EARTH-FND-006"]`).exists()).toBe(true)
    await wrapper.get('[data-testid="simulation-runtime"]').setValue('all')

    const multipleMethods = generatedRegistry.items.find((item) => item.executionMethods.length > 1)!
    await wrapper.get('[data-testid="simulation-search"]').setValue(multipleMethods.id)
    await flushPromises()
    expect(wrapper.get(`[data-testid="simulation-record-${multipleMethods.id}"] .program-row-methods`).text()).toContain(
      `${multipleMethods.executionMethods.length} declared methods`,
    )
  })

  it('shows a plain-language proton card and an empty four-column table before run', async () => {
    mockGeneratedRegistryFetch()
    const wrapper = await mountDetail('EARTH-NUC-004')

    expect(wrapper.get('[data-testid="earth-model-path"]').text()).toContain('Model → claim → table → run')
    expect(wrapper.get('[data-testid="earth-model-card-SIM-NUC-PROTON"]').text()).toContain('SM 0.84075 fm')
    expect(wrapper.get('[data-testid="earth-model-card-SIM-NUC-PROTON"]').text()).toContain('Nassim 0.84124 fm')
    expect(wrapper.get('[data-testid="earth-model-card-SIM-NUC-PROTON"]').text()).toContain('Thad 0.84343 fm')
    expect(wrapper.get('[data-testid="earth-model-card-SIM-NUC-PROTON"]').text()).toContain('EARTH ξ₀ routes fail')
    expect(wrapper.get('[data-testid="earth-model-card-SIM-NUC-PROTON"]').text()).toContain('validatesEarthTheory: false')
    expect(wrapper.get('[data-testid="earth-prediction-table"]').text()).toContain('EARTH | Thad | Nassim | SM')
    expect(wrapper.get('[data-testid="earth-prediction-table"]').text()).toContain('No predictions[] yet')
    expect(wrapper.get('[data-testid="earth-prediction-table"]').text()).toContain('validatesEarthTheory: false')
  })

  it('says Thad and Nassim have none on the field and decoherence cards', async () => {
    mockGeneratedRegistryFetch()
    const field = await mountDetail('EARTH-FLD-001')
    expect(field.get('[data-testid="earth-model-card-SIM-FLD"]').text()).toContain('Thad and Nassim columns show none')
    field.unmount()
    const decoherence = await mountDetail('EARTH-FLD-005')
    expect(decoherence.get('[data-testid="earth-model-card-SIM-QM-DECOHERENCE"]').text()).toContain('Thad and Nassim columns show none')
  })

  it('renders predictions[] as EARTH | Thad | Nassim | SM | residual and keeps falsified rows failed', async () => {
    mockGeneratedRegistryFetch()
    runnerMock.mockResolvedValue({
      schemaVersion: 2,
      programId: 'EARTH-NUC-004',
      methodId: 'earth-source-reproduction-v1',
      executionStatus: 'completed',
      id: 'EARTH-NUC-004',
      status: 'completed',
      method: 'source method',
      diagnostics: { finite: true },
      output: { residualMetres: 1 },
      relationship: 'earth-source-reproduction',
      modelOrigin: 'earth-corpus',
      earthDerived: true,
      validatesEarthTheory: false,
      predictions: [{
        claimId: 'NUC-004-RP',
        observable: 'proton radius',
        unit: 'fm',
        earth: { printed: 0.15, evaluated: 0.15, formula: 'ξ₀' },
        thad: { value: 0.84343, formula: 'Catalan' },
        nassim: { value: 0.84124, formula: '4λ_p' },
        sm: { value: 0.84075, uncertainty: 0.00039, source: 'CODATA', release: '2022' },
        residual: { earthEvalVsSm: -0.69075 },
        auditStatus: 'falsified',
      }],
      provenance: {
        kind: 'reproduction',
        precision: 'float64',
        model: 'source model',
        relationship: 'earth-source-reproduction',
        modelOrigin: 'earth-corpus',
        earthDerived: true,
        validatesEarthTheory: false,
      },
    } as never)
    const wrapper = await mountDetail('EARTH-NUC-004')
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await flushPromises()

    const table = wrapper.get('[data-testid="earth-prediction-table"]')
    expect(table.text()).toContain('proton radius')
    expect(table.text()).toContain('0.15')
    expect(table.text()).toContain('0.84343')
    expect(table.text()).toContain('0.84124')
    expect(table.text()).toContain('0.84075')
    expect(table.text()).toContain('Failed')
    expect(table.get('tr[data-audit="falsified"]').classes()).toContain('is-failed')
    expect(table.get('tr.is-failed').text()).not.toMatch(/Confirmed|validated/i)
    expect(wrapper.text()).toContain('validatesEarthTheory: false')
  })

  it('does not expose a Run control for a blocked record', async () => {
    mockRegistryFetch()
    const wrapper = await mountDetail('sim-001')

    expect(wrapper.text()).toContain('Required calibration is unavailable')
    expect(wrapper.find('[data-testid="workbench-run"]').exists()).toBe(false)
    expect(wrapper.find('.simulation-run-section').exists()).toBe(false)
  })

  it('permits generated Run controls for all 130 engine-supported IDs', () => {
    const supported = new Set<string>(SUPPORTED_EARTH_SIMULATION_IDS)
    expect(supported.size).toBe(130)
    for (const [index, item] of generatedRegistry.items.entries()) {
      const record: ScientificSimulationRecord = {
        ...normalizedSimulation(index + 1),
        id:            item.id,
        executionMode: item.execution,
        runnable:      item.runnable,
        sourceState:   item.sourceState,
        currentState:  item.sourceState.status,
        scientificStatus: item.scientificStatus,
        defaultMethodId: item.defaultMethodId,
        executionMethods: item.executionMethods,
        gateStates:    item.gateStates,
        blockers:      item.blockers,
      }
      expect(supported.has(item.id)).toBe(true)
      expect(hasSimulationRunControl(record)).toBe(true)
    }
  })

  it('keeps scientific blockers visible without blocking an implemented comparison', async () => {
    mockGeneratedRegistryFetch()
    const wrapper = await mountDetail('EARTH-FLD-005')

    expect(wrapper.text()).toContain('EARTH physical model BX')
    expect(wrapper.find('[data-testid="workbench-run"]').exists()).toBe(true)
    const comparison = generatedRegistry.items.find(({ id }) => id === 'EARTH-FLD-005')!
    const record = {
      ...normalizedSimulation(2),
      executionMode: comparison.execution,
      runnable: comparison.runnable,
      sourceState: comparison.sourceState,
      currentState: comparison.sourceState.status,
      scientificStatus: comparison.scientificStatus,
      defaultMethodId: comparison.defaultMethodId,
      executionMethods: comparison.executionMethods,
      gateStates: comparison.gateStates,
      blockers: comparison.blockers,
    }
    expect(isSimulationBlocked(record)).toBe(false)
    expect(hasSimulationRunControl(record)).toBe(true)
  })

  it('selects an unavailable source formulation by query without exposing execution controls', async () => {
    mockGeneratedRegistryFetch()
    const router = testRouter()
    await router.push('/earth/programs/EARTH-FND-006?method=earth-source-model-v1')
    const wrapper = mount(EarthSimulationDetailView, {
      props: { id: 'EARTH-FND-006' },
      global: { plugins: [router] },
    })
    await flushPromises()

    const sourceState = generatedRegistry.items.find(({ id }) => id === 'EARTH-FND-006')!.sourceState.text
    expect(router.currentRoute.value.query.method).toBe('earth-source-model-v1')
    expect((wrapper.get('[data-testid="simulation-method-select"]').element as HTMLSelectElement).value).toBe('earth-source-model-v1')
    expect(wrapper.get('[data-testid="selected-method-sheet"]').text()).toContain(sourceState)
    expect(wrapper.get('[data-testid="simulation-method-unavailable"]').text()).toContain('governing EARTH source contract is incomplete')
    expect(wrapper.find('[data-testid="workbench-run"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="simulation-inputs"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="simulation-progress"]').exists()).toBe(false)
    expect(runnerMock).not.toHaveBeenCalled()
  })

  it('resolves source document IDs into existing EARTH record links', async () => {
    mockRegistryFetch()
    const wrapper = await mountDetail('sim-001')
    const sourceLink = wrapper.get('[data-testid="simulation-source-links"] a')

    expect(sourceLink.text()).toBe('Resolved EARTH Source')
    expect(sourceLink.attributes('href')).toBe('/earth/corpus/source-record--abc123')
  })

  it('lazy-loads one exact evidence shard with dataset links and progressive source IDs', async () => {
    const fetchMock = mockGeneratedEvidenceFetch()
    const wrapper = await mountDetail('EARTH-PRT-001')

    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/evidence/programs/EARTH-PRT-001.json'))).toBe(true)
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/evidence/programs/'))).toHaveLength(1)
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('scientific-coverage.json'))).toBe(false)
    expect(wrapper.get('[data-testid="program-evidence-summary"]').text()).toContain('Formula records30')
    expect(wrapper.get('[data-testid="program-evidence-records"]').findAll('article')).toHaveLength(18)
    expect(wrapper.get('[data-testid="program-evidence-records"]').text()).toContain(prt001Evidence.assignments[0]!.sourceId)
    expect(wrapper.get('[data-testid="program-dataset-requirements"]').text()).toContain('Dataset-to-method assignment is not frozen')
    expect(wrapper.get('[data-testid="program-dataset-requirements"] a').attributes('href')).toContain('/earth/datasets?dataset=earth-dataset-codata-recommended-values&program=EARTH-PRT-001')

    await wrapper.get('[data-testid="program-evidence-more"]').trigger('click')
    expect(wrapper.get('[data-testid="program-evidence-records"]').findAll('article')).toHaveLength(30)
  })

  it('fails closed when a registry-runnable ID is not supported by the execution engine', async () => {
    mockRegistryFetch()
    const wrapper = await mountDetail('sim-002')

    expect(wrapper.get('[data-testid="simulation-integrity-error"]').text()).toContain('sim-002 is not supported')
    expect(wrapper.find('[data-testid="workbench-run"]').exists()).toBe(false)
    expect(runnerMock).not.toHaveBeenCalled()
  })

  it('uses the default method, validates query selection, and switches method-specific controls and provenance', async () => {
    mockGeneratedRegistryFetch()
    const router = testRouter()
    await router.push('/earth/programs/EARTH-PLAN-008?method=not-a-method')
    const wrapper = mount(EarthSimulationDetailView, {
      props: { id: 'EARTH-PLAN-008' },
      global: { plugins: [router] },
    })
    await flushPromises()

    expect(router.currentRoute.value.query.method).toBeUndefined()
    expect((wrapper.get('[data-testid="simulation-method-select"]').element as HTMLSelectElement).value).toBe('traditional-analytic-baseline-v1')
    expect(JSON.parse((wrapper.get('[data-testid="simulation-inputs"]').element as HTMLTextAreaElement).value)).toEqual(
      DEFAULT_EARTH_METHOD_INPUTS['EARTH-PLAN-008']['traditional-analytic-baseline-v1'],
    )
    expect(wrapper.get('[data-testid="simulation-input-temperatureKelvin"]').attributes('type')).toBe('number')
    expect(wrapper.get('[data-testid="method-provenance"]').text()).toContain('traditional analytic baseline')
    expect(wrapper.get('[data-testid="method-provenance"]').text()).toContain('standard physics')
    expect(wrapper.get('[data-testid="method-provenance"]').text()).toContain('Actual adapter runtimebrowser worker')

    await wrapper.get('[data-testid="simulation-method-select"]').setValue('earth-source-reproduction-v1')
    await flushPromises()

    expect(router.currentRoute.value.query.method).toBe('earth-source-reproduction-v1')
    expect(JSON.parse((wrapper.get('[data-testid="simulation-inputs"]').element as HTMLTextAreaElement).value)).toEqual(
      DEFAULT_EARTH_METHOD_INPUTS['EARTH-PLAN-008']['earth-source-reproduction-v1'],
    )
    expect(wrapper.find('[data-testid="simulation-input-surfaceMassDensityKgPerCubicMetre"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="method-provenance"]').text()).toContain('earth corpus')
    expect(wrapper.get('[data-testid="method-provenance"]').text()).toContain('EARTH-derivedtrue')
  })

  it('renders schema controls, staged dispatch state, human results, and raw JSON disclosure for a legacy one-method program', async () => {
    mockGeneratedRegistryFetch()
    runnerMock.mockImplementation(async (id, methodId, inputs, options) => {
      options?.onProgress?.(5)
      options?.onProgress?.(20)
      return {
        schemaVersion: 2,
        programId: id,
        methodId,
        executionStatus: 'completed',
        id,
        status: 'completed',
        method: 'mocked worker boundary',
        diagnostics: { finite: true },
        output: { residualMetres: 1.25, receivedInputs: inputs, series: [{ sample: 1, value: 2 }] },
        relationship: 'earth-source-reproduction',
        modelOrigin: 'earth-corpus',
        earthDerived: true,
        validatesEarthTheory: false,
        provenance: {
          kind: 'reproduction',
          precision: 'float64',
          model: 'test model',
          relationship: 'earth-source-reproduction',
          modelOrigin: 'earth-corpus',
          earthDerived: true,
          validatesEarthTheory: false,
        },
      } as never
    })
    const wrapper = await mountDetail('EARTH-FND-003')
    const inputs = wrapper.get('[data-testid="simulation-inputs"]')

    expect(JSON.parse((inputs.element as HTMLTextAreaElement).value)).toEqual(DEFAULT_EARTH_SIMULATION_INPUTS['EARTH-FND-003'])
    await inputs.setValue('{}')
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await flushPromises()

    expect(runnerMock).toHaveBeenCalledWith(
      'EARTH-FND-003',
      'earth-source-reproduction-v1',
      {},
      expect.objectContaining({ signal: expect.any(AbortSignal), onProgress: expect.any(Function) }),
    )
    expect(wrapper.get('[data-testid="simulation-status"]').text()).toContain('completed')
    expect(wrapper.get('[data-testid="simulation-progress"]').attributes('aria-valuenow')).toBe('100')
    expect(wrapper.get('[data-testid="simulation-progress"]').text()).toContain('Dispatch checkpoint 100 / 100')
    expect(wrapper.get('[data-testid="simulation-result"]').text()).toContain('Source reproduction / audit only')
    expect(wrapper.get('.simulation-scalar-outputs dt').text()).toBe('Residual Metres')
    expect(wrapper.get('.simulation-scalar-outputs dd').text()).toBe('1.25 m')
    expect(wrapper.get('[data-testid="simulation-result"]').text()).toContain('Structured outputs')
    expect(wrapper.get('[data-testid="simulation-result"]').text()).toContain('Received Inputs')
    expect(wrapper.get('[data-testid="simulation-raw-result"] h4').text()).toBe('Raw JSON result')
    expect(wrapper.get('[data-testid="simulation-raw-result"]').text()).toContain('"status": "completed"')
    expect(wrapper.get('[data-testid="simulation-result"]').find('script').exists()).toBe(false)
  })

  it('rejects non-object JSON before execution and exposes worker failures', async () => {
    mockGeneratedRegistryFetch()
    const wrapper = await mountDetail('EARTH-FND-003')
    const inputs = wrapper.get('[data-testid="simulation-inputs"]')

    await inputs.setValue('[]')
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    expect(wrapper.get('[data-testid="simulation-input-error"]').text()).toBe('Advanced input JSON must be an object.')
    expect(runnerMock).not.toHaveBeenCalled()

    runnerMock.mockResolvedValue({ id: 'EARTH-FND-003', status: 'failed', error: 'kernel rejected inputs' } as never)
    await inputs.setValue('{}')
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="simulation-status"]').text()).toContain('failed')
    expect(wrapper.get('[data-testid="simulation-execution-error"]').text()).toBe('kernel rejected inputs')
    expect(wrapper.find('[data-testid="simulation-result"]').exists()).toBe(false)
  })

  it('identifies invalid fields, synchronizes field JSON, and preserves worker bounds errors', async () => {
    mockGeneratedRegistryFetch()
    const wrapper = await mountDetail('EARTH-PLAN-008')
    const temperature = wrapper.get('[data-testid="simulation-input-temperatureKelvin"]')

    await temperature.setValue('')
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    expect(temperature.attributes('aria-invalid')).toBe('true')
    expect(wrapper.get(`#${temperature.attributes('id')}-error`).text()).toBe('Temperature Kelvin must be a finite number.')
    expect(runnerMock).not.toHaveBeenCalled()

    runnerMock.mockResolvedValue({
      schemaVersion: 2,
      programId: 'EARTH-PLAN-008',
      methodId: 'traditional-analytic-baseline-v1',
      executionStatus: 'failed',
      id: 'EARTH-PLAN-008',
      status: 'failed',
      error: 'temperatureKelvin must be from 1 to 1000000000',
    } as never)
    await temperature.setValue('0')
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="simulation-execution-error"]').text()).toBe('temperatureKelvin must be from 1 to 1000000000')

    await wrapper.setProps({ id: 'EARTH-FND-002' })
    await flushPromises()
    const exponents = wrapper.get('[data-testid="simulation-input-exponents"]')
    await exponents.setValue('[1, 2, 3]')
    await exponents.trigger('blur')
    expect(JSON.parse((wrapper.get('[data-testid="simulation-inputs"]').element as HTMLTextAreaElement).value)).toEqual({ exponents: [1, 2, 3] })
    await wrapper.get('[data-testid="simulation-inputs"]').setValue('{"exponents":[4,5]}')
    expect(JSON.parse((exponents.element as HTMLTextAreaElement).value)).toEqual([4, 5])
  })

  it('retains completed pilot results in a provenance ledger without changing scientific status', async () => {
    mockGeneratedRegistryFetch()
    runnerMock.mockImplementation(async (programId, methodId, _inputs, options) => {
      options?.onProgress?.(5)
      options?.onProgress?.(20)
      const source = methodId === 'earth-source-reproduction-v1'
      const relationship = source ? 'earth-source-reproduction' : 'traditional-analytic-baseline'
      const modelOrigin = source ? 'earth-corpus' : 'standard-physics'
      return {
        schemaVersion: 2,
        programId,
        methodId,
        executionStatus: 'completed',
        id: programId,
        status: 'completed',
        method: source ? 'source method' : 'baseline method',
        diagnostics: { finite: true },
        output: source ? { coherenceMetres: 0.125, series: [{ density: 1 }] } : { scaleHeightMetres: 8_434.2 },
        relationship,
        modelOrigin,
        earthDerived: source,
        validatesEarthTheory: false,
        provenance: {
          kind: source ? 'reproduction' : 'comparison',
          precision: 'float64',
          model: source ? 'source model' : 'baseline model',
          relationship,
          modelOrigin,
          earthDerived: source,
          validatesEarthTheory: false,
        },
      } as never
    })
    const wrapper = await mountDetail('EARTH-PLAN-008')
    const scientificStatus = wrapper.get('.earth-readiness-stack span').text()

    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="simulation-result"]').text()).toContain('Independent traditional baseline')

    await wrapper.get('[data-testid="simulation-method-select"]').setValue('earth-source-reproduction-v1')
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await flushPromises()

    const ledger = wrapper.get('[data-testid="simulation-run-ledger"]')
    expect(ledger.findAll('.simulation-run-ledger-row')).toHaveLength(2)
    expect(ledger.text()).toContain('Scale Height Metres: 8,434.2 m')
    expect(ledger.text()).toContain('Coherence Metres: 0.125 m')
    expect(ledger.text()).not.toContain('Residual:')
    expect(wrapper.get('[data-testid="simulation-result"]').text()).toContain('Source reproduction / audit only')
    expect(wrapper.get('.earth-readiness-stack span').text()).toBe(scientificStatus)

    await wrapper.get('[data-testid="simulation-method-select"]').setValue('traditional-analytic-baseline-v1')
    expect(wrapper.get('[data-testid="simulation-result"]').text()).toContain('Independent traditional baseline')
  })

  it('aborts active execution on method changes, cancel, route changes, and unmount', async () => {
    mockGeneratedRegistryFetch()
    const signals: AbortSignal[] = []
    runnerMock.mockImplementation((id, methodId, _inputs, options) => {
      if (options?.signal) signals.push(options.signal)
      options?.onProgress?.(5)
      return new Promise((resolve) => {
        options?.signal?.addEventListener('abort', () => resolve({ id, methodId, status: 'cancelled' } as never), { once: true })
      }) as never
    })
    const wrapper = await mountDetail('EARTH-PLAN-008')

    void wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-testid="simulation-method-select"]').setValue('earth-source-reproduction-v1')
    expect(signals[0]?.aborted).toBe(true)

    void wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-testid="workbench-cancel"]').trigger('click')
    await flushPromises()
    expect(signals[1]?.aborted).toBe(true)
    expect(wrapper.get('[data-testid="simulation-status"]').text()).toContain('cancelled')

    void wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.setProps({ id: 'EARTH-FND-002' })
    await flushPromises()
    expect(signals[2]?.aborted).toBe(true)

    void wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await wrapper.vm.$nextTick()
    wrapper.unmount()
    await flushPromises()
    expect(signals[3]?.aborted).toBe(true)
  })
})

describe('earth-prediction/v1 display', () => {
  it('maps falsified and missing columns without calling them confirmed', () => {
    const rows = extractPredictions({
      schemaVersion: 2,
      validatesEarthTheory: false,
      predictions: [{
        claimId: 'FLD-001-HOPF',
        observable: 'Hopf sector',
        unit: '',
        earth: { evaluated: 0, formula: 'π₃(S¹)' },
        thad: { status: 'missing' },
        nassim: null,
        sm: { value: 0, source: 'Derrick' },
        residual: { earthEvalVsSm: 0 },
        auditStatus: 'falsified',
      }],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ earth: '0', thad: 'none', nassim: 'none', outcome: 'Failed' })
    expect(predictionOutcomeLabel('falsified')).toBe('Failed')
    expect(predictionOutcomeLabel('missing')).toBe('None')
    expect(predictionOutcomeLabel('testable')).toBe('Testable, not confirmed')
  })
})
