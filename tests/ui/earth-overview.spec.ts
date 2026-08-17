import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import datasetsJson from '../../public/data/generated/earth/datasets.json'
import completionJson from '../../public/data/generated/earth/completion.json'
import manifestJson from '../../public/data/generated/earth/manifest.json'
import programsJson from '../../public/data/generated/earth/scientific-simulations.json'
import EarthOverviewView from '../../src/views/EarthOverviewView.vue'

function response(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response
}

describe('EARTH dossier overview', () => {
  it('builds its evidence ledger from the validated loaders and links every section', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/manifest.json')) return response(manifestJson)
      if (url.endsWith('/scientific-simulations.json')) return response(programsJson)
      if (url.endsWith('/completion.json')) return response(completionJson)
      if (url.endsWith('/datasets.json')) return response(datasetsJson)
      return { ok: false, status: 404, json: async () => ({}) } as Response
    }))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/earth', name: 'earth', component: EarthOverviewView },
        { path: '/earth/corpus', name: 'earth-corpus', component: { template: '<div />' } },
        { path: '/earth/programs', name: 'earth-simulations', component: { template: '<div />' } },
        { path: '/earth/programs/:id', name: 'earth-simulation', component: { template: '<div />' } },
        { path: '/earth/datasets', name: 'earth-datasets', component: { template: '<div />' } },
      ],
    })
    await router.push('/earth')
    const wrapper = mount(EarthOverviewView, { global: { plugins: [router] } })
    await flushPromises()

    const ledger = wrapper.get('[data-testid="earth-evidence-ledger"]')
    expect(ledger.text()).toContain('63')
    expect(ledger.text()).toContain('130')
    expect(ledger.text()).toContain('declared methods222')
    expect(ledger.text()).toContain('136 runnable')
    expect(ledger.text()).toContain('19')
    expect(ledger.text()).toContain('frozen datasets0')
    expect(ledger.text()).toContain('scientificallyValidated: false')
    expect(wrapper.text()).toContain('Model → what it claims → EARTH | Thad | Nassim | SM → run')
    expect(wrapper.text()).toContain('EXECUTION ≠ VALIDATION')
    expect(wrapper.text()).toContain('Proton radius is four competing numbers, not one')
    expect(wrapper.text()).toContain('SM 0.84075 fm')
    expect(wrapper.text()).toContain('Nassim 0.84124 fm')
    expect(wrapper.text()).toContain('Thad 0.84343 fm')
    expect(wrapper.text()).toContain('EARTH ξ₀ routes fail')
    expect(wrapper.text()).toContain('Thad is a constants constructor')
    expect(wrapper.text()).toContain('r_p=4λ_p')
    expect(wrapper.text()).toContain('EARTH printed α/Bohr/ħ/φ⁶ fail literal arithmetic')
    expect(wrapper.get('[data-testid="earth-model-card-SIM-FLD"]').text()).toContain('Thad and Nassim columns show none')
    expect(wrapper.get('[data-testid="earth-model-card-SIM-QM-DECOHERENCE"]').text()).toContain('Thad and Nassim columns show none')
    expect(wrapper.get('[data-testid="earth-model-card-SIM-CHEM-SPECTRA"]').text()).toContain('Thad and Nassim columns show none')
    expect(wrapper.get('[data-testid="earth-model-card-SIM-NUC-PROTON"]').text()).toContain('validatesEarthTheory: false')
    expect(wrapper.findAll('a[href="/earth/corpus"]').length).toBeGreaterThan(0)
    expect(wrapper.findAll('a[href="/earth/programs"]').length).toBeGreaterThan(0)
    expect(wrapper.findAll('a[href="/earth/datasets"]').length).toBeGreaterThan(0)
    expect(wrapper.get('a[href="/earth/programs/EARTH-NUC-004"]').exists()).toBe(true)
  })
})
