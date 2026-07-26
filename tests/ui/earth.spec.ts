import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import manifestJson from '../../public/data/generated/earth/manifest.json'
import evidenceManifestJson from '../../public/data/generated/earth/evidence/manifest.json'
import readmeEvidenceJson from '../../public/data/generated/earth/evidence/documents/readme--b33563055168.json'
import type { EarthDocumentShard, EarthManifest } from '../../src/earth/corpus'
import EarthCorpusView from '../../src/views/EarthCorpusView.vue'
import EarthDocumentView from '../../src/views/EarthDocumentView.vue'

const manifest = manifestJson as EarthManifest

function response(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response
}

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/earth', name: 'earth', component: { template: '<div />' } },
      { path: '/earth/corpus', name: 'earth-corpus', component: EarthCorpusView },
      { path: '/earth/programs', name: 'earth-simulations', component: { template: '<div />' } },
      { path: '/earth/programs/:id', name: 'earth-simulation', component: { template: '<div />' } },
      { path: '/earth/datasets', name: 'earth-datasets', component: { template: '<div />' } },
      { path: '/earth/corpus/:slug', name: 'earth-document', component: EarthDocumentView, props: true },
    ],
  })
}

describe('EARTH source reader', () => {
  it('loads only compact manifests for the index and filters locked records by evidence state', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => response(String(input).includes('/evidence/') ? evidenceManifestJson : manifest))
    vi.stubGlobal('fetch', fetchMock)
    const router = testRouter()
    await router.push('/earth/corpus?q=Universal&collection=theorem&series=BIO&evidence=simulations')
    const wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [router] } })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/data/generated/earth/manifest.json')
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('scientific-coverage.json'))).toBe(false)
    expect(wrapper.get('[data-testid="earth-search"]').element).toHaveProperty('value', 'Universal')
    expect(wrapper.get('[data-testid="earth-collection"]').element).toHaveProperty('value', 'theorem')
    expect(wrapper.get('[data-testid="earth-series"]').element).toHaveProperty('value', 'BIO')
    expect(wrapper.get('[data-testid="earth-evidence-filter"]').element).toHaveProperty('value', 'simulations')
    expect(wrapper.findAll('.earth-document-card').length).toBeGreaterThan(0)
    expect(wrapper.get('[data-testid="earth-caveat"]').text()).toContain('SOURCE CLAIMS ≠ VALIDATED RESULTS')
    expect(wrapper.get('[data-testid="earth-result-count"]').attributes('aria-live')).toBe('polite')
    expect(wrapper.get('[data-testid="earth-document-grid"]').attributes('aria-live')).toBeUndefined()
    expect(wrapper.get('.earth-result-summary').text()).toContain('neither implies one-to-one equivalence')
    expect(wrapper.get('.earth-document-card').text()).toContain('Program relations')
    expect(wrapper.get('.earth-document-card').text()).toContain('Source candidates')

    await wrapper.get('[data-testid="earth-clear-filters"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/earth/corpus')
    expect(wrapper.findAll('.earth-document-card')).toHaveLength(63)
    await wrapper.get('[data-testid="earth-series"]').setValue('BIO')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/earth/corpus?series=BIO')
    expect(wrapper.findAll('.earth-document-card')).toHaveLength(5)
    await router.push('/earth')
    await router.back()
    await flushPromises()
    expect(wrapper.get('[data-testid="earth-series"]').element).toHaveProperty('value', 'BIO')
    expect(wrapper.findAll('.earth-document-card')).toHaveLength(5)
  })

  it('renders safe structural reading blocks and preserves anchors in exact source mode', async () => {
    const record = manifest.documents.find(({ source }) => source.path === 'README.md')!
    const shard: EarthDocumentShard = {
      schemaVersion: 1,
      parserVersion: 1,
      sourceRevision: manifest.sourceRevision,
      document: {
        id: record.id,
        slug: record.slug,
        title: record.title,
        classification: record.classification,
        source: record.source,
        structure: {
          headings: [
            { id: `${record.id}-heading-1`, level: 1, text: 'EARTH source', line: 1 },
            { id: `${record.id}-heading-2`, level: 2, text: 'Method', line: 12 },
          ],
          codeBlocks: [{
            id: `${record.id}-code-1`,
            language: 'python',
            section: 'Method',
            startLine: 14,
            endLine: 16,
            execution: 'disabled',
          }],
        },
        diagnostics: [],
        sanitizedMarkdown: [
          '# EARTH source',
          '',
          '<script>alert("inert")</script> &lt;img src="https://example.test/remote.png"&gt;',
          '',
          '- first source item',
          '- second source item',
          '',
          '$$',
          'E = mc^2',
          '$$',
          '',
          '## Method',
          '',
          '```python',
          'print("inert")',
          '```',
        ].join('\n'),
      },
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/earth/manifest.json')) return response(manifest)
      if (url.endsWith('/evidence/manifest.json')) return response(evidenceManifestJson)
      if (url.includes('/evidence/documents/')) return response(readmeEvidenceJson)
      return response(shard)
    })
    vi.stubGlobal('fetch', fetchMock)
    const router = testRouter()
    await router.push(`/earth/corpus/${record.slug}`)
    const wrapper = mount(EarthDocumentView, { props: { slug: record.slug }, global: { plugins: [router] } })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes(`/documents/${record.slug}.json`))).toBe(true)
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes(`/evidence/documents/${record.slug}.json`))).toBe(true)
    expect(router.currentRoute.value.query.view).toBe('reading')
    expect(wrapper.get('[data-testid="earth-reading-mode"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="earth-document-reading"]').text()).toContain('print("inert")')
    expect(wrapper.get('[data-testid="earth-document-reading"]').text()).toContain('E = mc^2')
    expect(wrapper.get('[data-testid="earth-document-reading"]').text()).toContain('L8–L10')
    expect(wrapper.find('[data-testid="earth-document-reading"] img').exists()).toBe(false)
    expect(wrapper.find('[data-testid="earth-document-reading"] script').exists()).toBe(false)
    expect(wrapper.find('[data-testid="earth-document-reading"] a').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('v-html')
    expect(wrapper.text()).toContain('TEXT-ONLY / NO EXECUTION')
    expect(wrapper.get('[data-testid="earth-document-caveat"]').text()).toContain('Exact source is authoritative')
    expect(wrapper.get('[data-testid="earth-document-caveat"]').text()).toContain('locked original Markdown')
    expect(wrapper.get('[data-testid="document-evidence-ledger"]').text()).toContain('candidate source record is not an executable method')
    expect(wrapper.get('[data-testid="document-evidence-ledger"]').findAll('a[href^="/earth/programs/"]').length).toBeGreaterThan(0)
    expect(wrapper.get('.earth-outline a').attributes('href')).toBe(`#source-${shard.document.structure.headings[0]?.id}`)

    await wrapper.findAll('.earth-outline a')[1]!.trigger('click')
    await flushPromises()
    const secondAnchor = `source-${shard.document.structure.headings[1]?.id}`
    expect(router.currentRoute.value.hash).toBe(`#${secondAnchor}`)
    expect(wrapper.get(`#${secondAnchor}`).text()).toContain('L12')

    await wrapper.get('[data-testid="earth-source-mode"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.view).toBe('source')
    expect(router.currentRoute.value.hash).toBe(`#${secondAnchor}`)
    expect(wrapper.get('[data-testid="earth-document-source"]').text()).toContain('```python')
    expect(wrapper.get('[data-testid="earth-document-source"]').attributes('data-source-sha256')).toBe(record.source.sha256)
    expect(wrapper.find('.earth-source-panel img').exists()).toBe(false)
    expect(wrapper.find('.earth-source-panel script').exists()).toBe(false)
    expect(wrapper.get(`#${secondAnchor}`).text()).toContain('## Method')
  })
})
