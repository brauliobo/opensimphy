import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import generatedCompletion from '../../public/data/generated/earth/completion.json'
import generatedManifest from '../../public/data/generated/earth/manifest.json'
import generatedRegistry from '../../public/data/generated/earth/scientific-simulations.json'
import {
  buildEarthWorkbenchFinding,
  EARTH_OUTPUT_SCHEMA_REVISION,
  EARTH_WORKER_ADAPTER_REVISION,
  earthCompatibilityKey,
  earthModelRevision,
  validateEarthWorkbenchInputs,
} from '../../src/earth/workbench'
import { runEarthMethodInWorker } from '../../src/earth/runSimulation'
import {
  resetSavedRunRegistryForTests,
  setSavedRunRegistryDependenciesForTests,
  useSavedRunRegistry,
} from '../../src/registries/savedRunRegistry'
import { DEFAULT_EARTH_METHOD_INPUTS } from '../../src/engine/earth'
import { decodeWorkbenchInputEnvelope, encodeWorkbenchInputEnvelope } from '../../src/workbench/urlState'
import EarthSimulationDetailView from '../../src/views/EarthSimulationDetailView.vue'

vi.mock('../../src/earth/runSimulation', () => ({ runEarthMethodInWorker: vi.fn() }))

const runnerMock = vi.mocked(runEarthMethodInWorker)
const PROGRAM_ID = 'EARTH-PLAN-008'
const TRADITIONAL_METHOD = 'traditional-analytic-baseline-v1'
const SOURCE_METHOD = 'earth-source-reproduction-v1'

function response(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response
}

function mockGeneratedFetch(): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/scientific-simulations.json')) return response(generatedRegistry)
    if (url.endsWith('/manifest.json')) return response(generatedManifest)
    if (url.endsWith('/completion.json')) return response(generatedCompletion)
    return { ok: false, status: 404, json: async () => ({}) } as Response
  }))
}

function testRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/earth', component: { template: '<div />' } },
      { path: '/labs', component: { template: '<div />' } },
      { path: '/earth/corpus', component: { template: '<div />' } },
      { path: '/earth/programs/:id', component: EarthSimulationDetailView, props: true },
      { path: '/labs/earth/:id', component: EarthSimulationDetailView, props: (route) => ({ id: route.params.id, surface: 'workbench' }) },
      { path: '/earth/programs', component: { template: '<div />' } },
      { path: '/earth/corpus/:slug', component: { template: '<div />' } },
      { path: '/earth/datasets', component: { template: '<div />' } },
    ],
  })
}

async function mountDetail(router: Router, url = `/earth/programs/${PROGRAM_ID}`) {
  await router.push(url)
  const wrapper = mount(EarthSimulationDetailView, {
    props: {
      id: String(router.currentRoute.value.params.id),
      surface: router.currentRoute.value.path.startsWith('/labs/') ? 'workbench' : 'evidence',
    },
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

function completedExecution(programId: string, methodId: string, inputs: Record<string, unknown>, output?: unknown) {
  const source = methodId === SOURCE_METHOD
  const relationship = source ? 'earth-source-reproduction' : 'traditional-analytic-baseline'
  const modelOrigin = source ? 'earth-corpus' : 'standard-physics'
  const firstNumber = typeof inputs.temperatureKelvin === 'number'
    ? inputs.temperatureKelvin
    : Object.values(inputs).find((value): value is number => typeof value === 'number') ?? 0
  return {
    schemaVersion: 2,
    programId,
    methodId,
    executionStatus: 'completed',
    id: programId,
    status: 'completed',
    method: source ? 'source method' : 'traditional method',
    diagnostics: { finite: true },
    output: output ?? { parallelMetres: firstNumber },
    relationship,
    modelOrigin,
    earthDerived: source,
    validatesEarthTheory: false,
    provenance: {
      kind: source ? 'reproduction' : 'comparison',
      precision: 'float64',
      model: source ? 'source model' : 'traditional model',
      relationship,
      modelOrigin,
      earthDerived: source,
      validatesEarthTheory: false,
    },
  } as never
}

function mockCompletedRuns(output?: unknown): void {
  runnerMock.mockImplementation(async (programId, methodId, inputs, options) => {
    options?.onProgress?.(20)
    return completedExecution(programId, methodId, inputs as Record<string, unknown>, output)
  })
}

describe('EARTH Iteration 7 workbench adapter', () => {
  beforeEach(() => {
    runnerMock.mockReset()
    resetSavedRunRegistryForTests()
    mockGeneratedFetch()
  })

  it('canonicalizes defaults, encodes valid edits, preserves unrelated query, and keeps invalid text local', async () => {
    const defaults = DEFAULT_EARTH_METHOD_INPUTS[PROGRAM_ID][TRADITIONAL_METHOD]!
    const router = testRouter()
    const wrapper = await mountDetail(
      router,
      `/earth/programs/${PROGRAM_ID}?method=${TRADITIONAL_METHOD}&inputs=${encodeWorkbenchInputEnvelope(defaults)}&returnTo=ledger`,
    )

    expect(router.currentRoute.value.query).toEqual({ returnTo: 'ledger' })
    const temperature = wrapper.get('[data-testid="simulation-input-temperatureKelvin"]')
    await temperature.setValue('300')
    await flushPromises()

    expect(typeof router.currentRoute.value.query.inputs).toBe('string')
    expect(decodeWorkbenchInputEnvelope(router.currentRoute.value.query.inputs)).toEqual({ ...defaults, temperatureKelvin: 300 })
    expect(router.currentRoute.value.query.returnTo).toBe('ledger')
    const validUrl = router.currentRoute.value.fullPath

    await temperature.setValue('')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe(validUrl)
    expect((temperature.element as HTMLInputElement).value).toBe('')
  })

  it('rejects malformed and type-mismatched envelopes and restores method inputs on back and forward', async () => {
    const defaults = DEFAULT_EARTH_METHOD_INPUTS[PROGRAM_ID][TRADITIONAL_METHOD]!
    const router = testRouter()
    const wrapper = await mountDetail(router, `/earth/programs/${PROGRAM_ID}?inputs=not+base64`)

    expect(router.currentRoute.value.query.inputs).toBeUndefined()
    expect(wrapper.get('[data-testid="workbench-url-state-warning"]').text()).toContain('inputs')
    expect(JSON.parse((wrapper.get('[data-testid="simulation-inputs"]').element as HTMLTextAreaElement).value)).toEqual(defaults)

    const typeMismatch = encodeWorkbenchInputEnvelope({ ...defaults, temperatureKelvin: '300' })
    await router.push({ query: { inputs: typeMismatch } })
    await flushPromises()
    expect(router.currentRoute.value.query.inputs).toBeUndefined()
    expect(wrapper.get('[data-testid="workbench-url-state-warning"]').text()).toContain('expected number')

    const first = encodeWorkbenchInputEnvelope({ ...defaults, temperatureKelvin: 300 })
    const second = encodeWorkbenchInputEnvelope({ ...defaults, temperatureKelvin: 310 })
    await router.push({ query: { inputs: first } })
    await flushPromises()
    expect(wrapper.find('[data-testid="workbench-url-state-warning"]').exists()).toBe(false)
    await router.push({ query: { inputs: second } })
    await flushPromises()
    expect((wrapper.get('[data-testid="simulation-input-temperatureKelvin"]').element as HTMLInputElement).value).toBe('310')

    router.back()
    await flushPromises()
    expect((wrapper.get('[data-testid="simulation-input-temperatureKelvin"]').element as HTMLInputElement).value).toBe('300')
    router.forward()
    await flushPromises()
    expect((wrapper.get('[data-testid="simulation-input-temperatureKelvin"]').element as HTMLInputElement).value).toBe('310')
  })

  it('keeps the Workbench route distinct and does not fetch or render dossier evidence', async () => {
    const router = testRouter()
    const wrapper = await mountDetail(router, `/labs/earth/${PROGRAM_ID}`)
    const requestedUrls = vi.mocked(fetch).mock.calls.map(([input]) => String(input))

    expect(wrapper.attributes('data-surface')).toBe('workbench')
    expect(wrapper.get('[data-testid="earth-workbench-header"]').exists()).toBe(true)
    expect(wrapper.get('.workbench-instrument-title').element.tagName).toBe('H3')
    expect(wrapper.findAll('.workbench-section-title').every((heading) => heading.element.tagName === 'H4')).toBe(true)
    expect(wrapper.find('.earth-local-nav').exists()).toBe(false)
    expect(wrapper.find('.simulation-goal-section').exists()).toBe(false)
    expect(wrapper.find('.simulation-source-section').exists()).toBe(false)
    expect(wrapper.find('.simulation-evidence-section').exists()).toBe(false)
    expect(wrapper.get('a[href="/earth/programs/EARTH-PLAN-008"]').text()).toContain('canonical Evidence record')
    expect(requestedUrls.some((url) => url.includes('/earth/datasets.json') || url.includes('/earth/evidence/'))).toBe(false)
  })

  it('uses manual mode only for runnable workers and exposes no shell or legacy Run for unavailable methods', async () => {
    const router = testRouter()
    const wrapper = await mountDetail(router, '/earth/programs/EARTH-FND-006?method=earth-source-model-v1')

    expect(wrapper.get('.workbench-shell').attributes('data-execution-mode')).toBe('unavailable')
    expect(wrapper.find('[data-testid="workbench-run"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="workbench-run"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="simulation-method-unavailable"]').text()).toContain('Source formulation unavailable')
  })

  it('aborts and clears only the selected method result on reset while restoring canonical defaults', async () => {
    let signal: AbortSignal | undefined
    runnerMock.mockImplementation((programId, methodId, _inputs, options) => {
      signal = options?.signal
      return new Promise((resolve) => options?.signal?.addEventListener(
        'abort',
        () => resolve({ programId, methodId, status: 'cancelled' } as never),
        { once: true },
      )) as never
    })
    const router = testRouter()
    const wrapper = await mountDetail(router)
    await wrapper.get('[data-testid="simulation-input-temperatureKelvin"]').setValue('300')
    await flushPromises()
    void wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-testid="workbench-reset"]').trigger('click')
    await flushPromises()

    expect(signal?.aborted).toBe(true)
    expect(JSON.parse((wrapper.get('[data-testid="simulation-inputs"]').element as HTMLTextAreaElement).value)).toEqual(
      DEFAULT_EARTH_METHOD_INPUTS[PROGRAM_ID][TRADITIONAL_METHOD],
    )
    expect(router.currentRoute.value.query).toEqual({})
    expect(wrapper.find('[data-testid="simulation-result"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="workbench-compare-pending"]').text()).toContain('0 of 2')
  })

  it('freezes dispatched inputs with a result, marks later controls stale, and saves only explicitly', async () => {
    const storage = new Map<string, string>()
    setSavedRunRegistryDependenciesForTests({
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => { storage.set(key, value) },
        removeItem: (key) => { storage.delete(key) },
      },
      now: () => '2026-07-27T12:00:00.000Z',
      baseUrl: '/',
    })
    mockCompletedRuns()
    const router = testRouter()
    const wrapper = await mountDetail(router)
    const temperature = wrapper.get('[data-testid="simulation-input-temperatureKelvin"]')
    await temperature.setValue('300')
    await flushPromises()
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('.workbench-shell').findAll('h3')).toHaveLength(1)
    expect(wrapper.get('[data-testid="workbench-finding"]').findAll('h5').length).toBeGreaterThan(0)

    const savedRuns = useSavedRunRegistry()
    expect(savedRuns.runs.value).toHaveLength(0)
    await temperature.setValue('310')
    expect(wrapper.get('[data-testid="simulation-result-stale"]').text()).toContain('controls differ')
    await wrapper.get('[data-testid="workbench-save"]').trigger('click')

    expect(savedRuns.runs.value).toHaveLength(1)
    expect(wrapper.get('[data-testid="earth-save-result"]').text()).toContain('Saved EARTH run')
    expect(savedRuns.runs.value[0]?.inputs).toMatchObject({ temperatureKelvin: 300 })
    expect(savedRuns.runs.value[0]?.outputs).toHaveProperty('diagnostics')
    expect(savedRuns.runs.value[0]?.finding.validatesTheory).toBe(false)
    expect(savedRuns.runs.value[0]?.sourceRevision).toContain(`${PROGRAM_ID}:${TRADITIONAL_METHOD}`)
    expect(savedRuns.runs.value[0]?.finding.provenance).toMatchObject({
      evidenceRefs: [expect.stringContaining('src/engine/earth/index.ts#getEarthMethodDefinition')],
      sourceLocator: expect.stringContaining('src/engine/earth/index.ts#getEarthMethodDefinition'),
      methodRelationship: 'traditional-analytic-baseline',
      modelOrigin: 'standard-physics',
    })
  })

  it('creates exact source, traditional, and validator finding axes with no validation claim', () => {
    const contexts = [
      { id: SOURCE_METHOD, relationship: 'earth-source-reproduction', modelOrigin: 'earth-corpus' },
      { id: TRADITIONAL_METHOD, relationship: 'traditional-analytic-baseline', modelOrigin: 'standard-physics' },
      { id: 'source-contract-validator-v1', relationship: 'source-contract-validator', modelOrigin: 'engine-audit' },
    ]
    const findings = contexts.map((method) => buildEarthWorkbenchFinding({
      programId: 'EARTH-FND-001',
      method: { ...method, model: `${method.relationship} model` },
      sourceRevision: 'source-revision-one',
      sourceLocator: `fixture/${method.id}`,
      resultStatus: 'completed',
      output: { scalarMetres: 1 },
      evidenceRefs: ['source-one'],
    }))

    expect(findings.map(({ provenance }) => provenance.claimClass)).toEqual([
      'bounded-source-audit',
      'independent-traditional-comparator',
      'bounded-contract-audit',
    ])
    expect(findings[0]?.changed).toContain('Source reproduction / audit only')
    expect(findings[1]?.changed).toContain('Independent traditional baseline')
    expect(findings[2]?.changed).toContain('Source-contract audit only')
    expect(findings.every(({ validatesTheory, provenance }) => validatesTheory === false
      && provenance.methodRelationship !== ''
      && provenance.caveats.some((value) => value.includes('not established')))).toBe(true)
  })

  it('derives revisions and compatibility from the exact program and method contract', () => {
    const sourceRevision = 'source-revision-one'
    const method = { id: TRADITIONAL_METHOD, relationship: 'traditional-analytic-baseline', modelOrigin: 'standard-physics' }
    const same = earthCompatibilityKey(PROGRAM_ID, method, sourceRevision)
    const differentMethod = earthCompatibilityKey(PROGRAM_ID, { ...method, id: SOURCE_METHOD }, sourceRevision)

    expect(EARTH_WORKER_ADAPTER_REVISION).toBe('earth-browser-worker-adapter-v1')
    expect(EARTH_OUTPUT_SCHEMA_REVISION).toBe('earth-worker-result-schema-v2')
    expect(earthModelRevision(PROGRAM_ID, TRADITIONAL_METHOD)).toContain(`${PROGRAM_ID}:${TRADITIONAL_METHOD}`)
    expect(same).toMatch(/^[a-f0-9]{64}$/)
    expect(earthCompatibilityKey(PROGRAM_ID, method, sourceRevision)).toBe(same)
    expect(differentMethod).not.toBe(same)
  })

  it('caps comparison at two, computes only compatible parallel scalar deltas, and never merges incompatible residuals', async () => {
    mockCompletedRuns()
    const router = testRouter()
    const wrapper = await mountDetail(router)
    const temperature = wrapper.get('[data-testid="simulation-input-temperatureKelvin"]')

    await temperature.setValue('300')
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="workbench-freeze"]').trigger('click')
    await temperature.setValue('310')
    await flushPromises()
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="workbench-freeze"]').trigger('click')

    expect(runnerMock.mock.calls.slice(0, 2).map(([, , inputs]) => (inputs as { temperatureKelvin?: number }).temperatureKelvin)).toEqual([300, 310])
    expect(wrapper.get('[data-testid="workbench-freeze"]').attributes()).toHaveProperty('disabled')
    expect(wrapper.get('[data-testid="workbench-compare-status"]').text()).toContain('Compatible snapshots')
    expect(wrapper.get('[data-testid="workbench-compare"]').element.closest('.workbench-region-findings')).not.toBeNull()
    expect(wrapper.get('[data-testid="earth-parallel-scalar-deltas"]').text()).toContain('10 m')

    await wrapper.get('[data-testid="workbench-clear-compare"]').trigger('click')
    await wrapper.get('[data-testid="workbench-freeze"]').trigger('click')
    await wrapper.get('[data-testid="simulation-method-select"]').setValue(SOURCE_METHOD)
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="workbench-freeze"]').trigger('click')

    expect(wrapper.get('[data-testid="workbench-compare-status"]').text()).toContain('Incompatible snapshots')
    expect(wrapper.find('[data-testid="earth-parallel-scalar-deltas"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="workbench-compare"]').text()).not.toContain('Residual:')
  })

  it('rejects unsupported result JSON through the shared snapshot parser and surfaces storage failure', async () => {
    setSavedRunRegistryDependenciesForTests({ storage: null, now: () => '2026-07-27T12:01:00.000Z' })
    mockCompletedRuns({ unsupported: undefined })
    const router = testRouter()
    const wrapper = await mountDetail(router)
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="workbench-save"]').trigger('click')

    expect(wrapper.get('[data-action-error="save"]').text()).toContain('unsupported JSON value type undefined')

    runnerMock.mockReset()
    mockCompletedRuns()
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="workbench-save"]').trigger('click')
    expect(wrapper.get('[data-action-error="save"]').text()).toContain('browser storage could not save')
  })

  it('validates exact default keys, matching top-level types, and finite JSON numbers', () => {
    const defaults = { count: 1, enabled: true, label: 'one', values: [1], metadata: { unit: 'm' } }
    expect(validateEarthWorkbenchInputs({ ...defaults }, defaults)).toEqual(defaults)
    expect(() => validateEarthWorkbenchInputs({ ...defaults, extra: 1 }, defaults)).toThrow(/exactly these fields/)
    expect(() => validateEarthWorkbenchInputs({ ...defaults, count: '1' }, defaults)).toThrow(/expected number/)
    expect(() => validateEarthWorkbenchInputs({ ...defaults, count: Number.NaN }, defaults)).toThrow(/finite JSON number/)
  })
})
