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
        { path: '/earth/datasets', name: 'earth-datasets', component: { template: '<div />' } },
      ],
    })
    await router.push('/earth')
    const wrapper = mount(EarthOverviewView, { global: { plugins: [router] } })
    await flushPromises()

    const ledger = wrapper.get('[data-testid="earth-evidence-ledger"]')
    expect(ledger.text()).toContain('63')
    expect(ledger.text()).toContain('130')
    expect(ledger.text()).toContain('declared methods220')
    expect(ledger.text()).toContain('134 runnable')
    expect(ledger.text()).toContain('19')
    expect(ledger.text()).toContain('frozen datasets0')
    expect(ledger.text()).toContain('scientificallyValidated: false')
    expect(wrapper.text()).toContain('Source evidence → program → methods → results')
    expect(wrapper.text()).toContain('EXECUTION ≠ VALIDATION')
    expect(wrapper.findAll('a[href="/earth/corpus"]').length).toBeGreaterThan(0)
    expect(wrapper.findAll('a[href="/earth/programs"]').length).toBeGreaterThan(0)
    expect(wrapper.findAll('a[href="/earth/datasets"]').length).toBeGreaterThan(0)
  })
})
