import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import generatedRegistry from '../../public/data/generated/earth/datasets.json'
import generatedCompletion from '../../public/data/generated/earth/completion.json'
import generatedManifest from '../../public/data/generated/earth/manifest.json'
import generatedSimulations from '../../public/data/generated/earth/scientific-simulations.json'
import { parseEarthDatasetRegistry } from '../../src/earth/datasets'
import EarthDatasetsView from '../../src/views/EarthDatasetsView.vue'

function response(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response
}

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/earth', name: 'earth', component: { template: '<div />' } },
      { path: '/earth/corpus', name: 'earth-corpus', component: { template: '<div />' } },
      { path: '/earth/programs', name: 'earth-simulations', component: { template: '<div />' } },
      { path: '/earth/programs/:id', name: 'earth-simulation', component: { template: '<div />' } },
      { path: '/earth/datasets', name: 'earth-datasets', component: EarthDatasetsView },
    ],
  })
}

async function mountRegistry(body: unknown = generatedRegistry, path = '/earth/datasets') {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/datasets.json')) return response(body)
    if (url.endsWith('/scientific-simulations.json')) return response(generatedSimulations)
    if (url.endsWith('/manifest.json')) return response(generatedManifest)
    if (url.endsWith('/completion.json')) return response(generatedCompletion)
    return { ok: false, status: 404, json: async () => ({}) } as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  const router = testRouter()
  await router.push(path)
  const wrapper = mount(EarthDatasetsView, { global: { plugins: [router] } })
  await flushPromises()
  return { fetchMock, router, wrapper }
}

function visibleNames(wrapper: Awaited<ReturnType<typeof mountRegistry>>['wrapper']): string[] {
  return wrapper.findAll('.dataset-record').map((row) => row.get('.dataset-identity strong').text())
}

describe('EARTH authenticated dataset registry', () => {
  it('strictly validates the real generated artifact and its integrity totals', () => {
    const registry = parseEarthDatasetRegistry(generatedRegistry)

    expect(registry.datasets).toHaveLength(19)
    expect(registry.disputedClaims).toHaveLength(4)
    expect(registry.summary).toMatchObject({
      metadataAuthenticated: 19,
      dataAcquired: 0,
      dataFrozen: 0,
      g0bPending: 10,
      g0bBlocked: 9,
    })
    expect(registry.policy).toEqual({
      metadataAuthenticationDoesNotImplyAcquisition: true,
      datasetBytesAcquired: false,
      g0bPassed: false,
    })
  })

  it('renders a derived ruled statement and a compact, closed evidence ledger', async () => {
    const { fetchMock, wrapper } = await mountRegistry()

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/data/generated/earth/datasets.json')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.findAll('details.dataset-record')).toHaveLength(19)
    expect(wrapper.findAll('details.dataset-record[open]')).toHaveLength(0)
    expect(wrapper.findAll('.disputed-claim')).toHaveLength(4)
    expect(wrapper.get('[data-testid="dataset-summary"]').text()).toContain('19 metadata-authenticated records')
    expect(wrapper.get('[data-testid="dataset-summary"]').text()).toContain('0 acquired / 0 frozen')
    expect(wrapper.get('[data-testid="dataset-summary"]').text()).toContain('G0b 0/19 passed')
    expect(wrapper.get('[data-testid="dataset-summary"]').text()).toContain('10 pending / 9 blocked')
    expect(wrapper.get('[data-testid="dataset-summary"]').text()).toContain('1 controlled-handling record')
    expect(wrapper.get('[data-testid="dataset-authentication-note"]').text()).toContain('METADATA AUTHENTICATION ≠ SCIENTIFIC VALIDATION')
    expect(wrapper.get('[data-testid="dataset-method-policy"]').text()).toContain('Declared methods include both runnable methods and unavailable source formulations')
    expect(wrapper.get('[data-testid="dataset-grid"]').attributes('aria-live')).toBeUndefined()
    expect(wrapper.get('[data-testid="dataset-result-count"]').attributes('aria-live')).toBe('polite')
  })

  it('sorts the default work queue by priority, readiness, and name', async () => {
    const { router, wrapper } = await mountRegistry()

    expect(visibleNames(wrapper).slice(0, 4)).toEqual([
      'JARVIS-DFT 3D',
      'Protein Data Bank archive',
      'Review of Particle Physics / PDG API',
      'AME2020 and NUBASE2020',
    ])

    await wrapper.get('[data-testid="dataset-sort"]').setValue('name')
    await flushPromises()
    expect(visibleNames(wrapper).slice(0, 3)).toEqual([
      'AME2020 and NUBASE2020',
      'CODATA recommended values',
      'Crystallography Open Database (COD)',
    ])
    expect(router.currentRoute.value.query).toEqual({ sort: 'name' })
  })

  it('filters by category, priority, authentication, redistribution, and G0b', async () => {
    const { wrapper } = await mountRegistry()

    await wrapper.get('[data-testid="dataset-category"]').setValue('Spectroscopy')
    expect(wrapper.findAll('.dataset-record')).toHaveLength(2)
    await wrapper.get('[data-testid="dataset-category"]').setValue('all')

    await wrapper.get('[data-testid="dataset-priority"]').setValue('P0')
    expect(wrapper.findAll('.dataset-record')).toHaveLength(10)
    await wrapper.get('[data-testid="dataset-priority"]').setValue('all')

    await wrapper.get('[data-testid="dataset-authentication"]').setValue('authenticated/acquisition-ready')
    expect(wrapper.findAll('.dataset-record')).toHaveLength(7)
    await wrapper.get('[data-testid="dataset-authentication"]').setValue('all')

    await wrapper.get('[data-testid="dataset-redistribution"]').setValue('raw')
    expect(wrapper.findAll('.dataset-record')).toHaveLength(8)
    await wrapper.get('[data-testid="dataset-redistribution"]').setValue('all')

    await wrapper.get('[data-testid="dataset-g0b"]').setValue('pending')
    expect(wrapper.findAll('.dataset-record')).toHaveLength(10)
  })

  it('expands complete evidence with explicit declared and runnable method counts', async () => {
    const datasetId = 'earth-dataset-eeg-motor-movement-imagery-dataset'
    const { wrapper } = await mountRegistry(generatedRegistry, `/earth/datasets?dataset=${datasetId}`)
    const eeg = wrapper.get(`[data-testid="dataset-${datasetId}"]`)

    await eeg.get('summary').trigger('click')
    expect(eeg.attributes()).toHaveProperty('open')
    expect(eeg.text()).toContain('Source registry line114')
    expect(eeg.text()).toContain('[PhysioNet dataset](https://physionet.org/content/eegmmidb/1.0.0/)')
    expect(eeg.text()).toContain('Owner / release evidencePhysioNet; version 1.0.0')
    expect(eeg.text()).toContain('derived-only for this project; yes, de-identified EEG from 109 volunteers')
    expect(eeg.text()).toContain('authenticated/acquisition-ready for local analysis')
    expect(eeg.text()).toContain('keep subject-level data offline')
    expect(eeg.text()).toContain('Acquisition statusnot-acquired')
    expect(eeg.text()).toContain('Retrieved atnot recorded')
    expect(eeg.text()).toContain('SHA256not recorded')
    expect(eeg.text()).toContain('Assignment not frozen')
    expect(eeg.text()).toContain('2 declared methods · 1 runnable · 1 unavailable source formulation')
    expect(eeg.text()).toContain('EARTH source formulation (unavailable) [unavailable source formulation]')
    expect(eeg.text()).not.toContain('available method contexts')
    expect(eeg.find('a[href="/earth/programs/EARTH-NEURO-002"]').exists()).toBe(true)

    const sourceLinks = eeg.findAll('.dataset-external-links a')
    expect(sourceLinks.map((link) => link.attributes('href'))).toContain('https://physionet.org/content/eegmmidb/1.0.0/')
    expect(sourceLinks.map((link) => link.attributes('href'))).toContain('https://doi.org/10.13026/C28G6P')
    sourceLinks.forEach((link) => {
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('aria-label')).toContain('in a new tab')
    })
    const terms = eeg.get('a[href="https://physionet.org/content/eegmmidb/view-license/1.0.0/"]')
    expect(terms.attributes('aria-label')).toContain('Open terms for EEG Motor Movement/Imagery Dataset')
    expect(terms.attributes('aria-label')).toContain('in a new tab')
  })

  it('URL-backs every filter and restores state after navigation and back', async () => {
    const params = new URLSearchParams({
      q:              'PhysioNet',
      dataset:        'earth-dataset-eeg-motor-movement-imagery-dataset',
      program:        'EARTH-NEURO-002',
      category:       'Neuroscience',
      priority:       'P2',
      authentication: 'authenticated/acquisition-ready',
      redistribution: 'derived-only',
      g0b:             'pending',
      sort:            'name',
    })
    const path = `/earth/datasets?${params.toString()}`
    const { router, wrapper } = await mountRegistry(generatedRegistry, path)

    expect(wrapper.get('[data-testid="dataset-search"]').element).toHaveProperty('value', 'PhysioNet')
    expect(wrapper.get('[data-testid="dataset-id"]').element).toHaveProperty('value', 'earth-dataset-eeg-motor-movement-imagery-dataset')
    expect(wrapper.get('[data-testid="dataset-program"]').element).toHaveProperty('value', 'EARTH-NEURO-002')
    expect(wrapper.get('[data-testid="dataset-category"]').element).toHaveProperty('value', 'Neuroscience')
    expect(wrapper.get('[data-testid="dataset-priority"]').element).toHaveProperty('value', 'P2')
    expect(wrapper.get('[data-testid="dataset-authentication"]').element).toHaveProperty('value', 'authenticated/acquisition-ready')
    expect(wrapper.get('[data-testid="dataset-redistribution"]').element).toHaveProperty('value', 'derived-only')
    expect(wrapper.get('[data-testid="dataset-g0b"]').element).toHaveProperty('value', 'pending')
    expect(wrapper.get('[data-testid="dataset-sort"]').element).toHaveProperty('value', 'name')
    expect(wrapper.findAll('.dataset-record')).toHaveLength(1)

    await router.push('/earth')
    await flushPromises()
    await router.back()
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe(path)
    expect(wrapper.get('[data-testid="dataset-search"]').element).toHaveProperty('value', 'PhysioNet')
    expect(wrapper.get('[data-testid="dataset-program"]').element).toHaveProperty('value', 'EARTH-NEURO-002')
    expect(wrapper.findAll('.dataset-record')).toHaveLength(1)
  })

  it('clears every URL-backed filter and restores the queue', async () => {
    const { router, wrapper } = await mountRegistry(generatedRegistry, '/earth/datasets?q=PhysioNet&priority=P2&sort=name')
    expect(wrapper.findAll('.dataset-record')).toHaveLength(1)

    await wrapper.get('[data-testid="dataset-clear-filters"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})
    expect(wrapper.get('[data-testid="dataset-search"]').element).toHaveProperty('value', '')
    expect(wrapper.get('[data-testid="dataset-priority"]').element).toHaveProperty('value', 'all')
    expect(wrapper.get('[data-testid="dataset-sort"]').element).toHaveProperty('value', 'queue')
    expect(wrapper.findAll('.dataset-record')).toHaveLength(19)
    expect(visibleNames(wrapper)[0]).toBe('JARVIS-DFT 3D')
    expect(wrapper.get('[data-testid="dataset-clear-filters"]').attributes()).toHaveProperty('disabled')
  })

  it('marks disputed claims as nonexistent or unverified rather than datasets', async () => {
    const { wrapper } = await mountRegistry()
    const disputes = wrapper.get('[data-testid="disputed-claims"]')

    expect(disputes.text()).toContain('"Gaia DR4 2025"')
    expect(disputes.text()).toContain('NONEXISTENT AS CLAIMED')
    expect(disputes.text()).toContain('Exact 1,842-galaxy pitch-angle catalogue')
    expect(disputes.text()).toContain('UNVERIFIED SOURCE')
    expect(visibleNames(wrapper).some((name) => name.includes('Gaia DR4 2025'))).toBe(false)
  })

  it('fails closed on an extra field or a count that disagrees with records', async () => {
    const extraField = structuredClone(generatedRegistry) as unknown as Record<string, unknown>
    extraField.unexpected = true
    expect(() => parseEarthDatasetRegistry(extraField)).toThrow(/unknown properties/)

    const wrongSummary = structuredClone(generatedRegistry)
    wrongSummary.summary.metadataAuthenticated = 18
    const { wrapper } = await mountRegistry(wrongSummary)
    expect(wrapper.get('[role="alert"]').text()).toContain('summary does not match the validated records')
    expect(wrapper.findAll('.dataset-record')).toHaveLength(0)
  })
})
