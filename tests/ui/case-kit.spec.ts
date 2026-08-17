import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import catalogJson from '../../public/data/generated/awesomePhysics/catalog.json'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import benchmarkCasesJson from '../../public/data/generated/awesomePhysics/benchmark-cases.json'
import benchmarkResultsJson from '../../public/data/generated/awesomePhysics/benchmark-results.json'
import { collectCaseRecords, GRAY_CASE } from '../../src/cases/caseRegistry'
import {
  benchmarkCaseById,
  benchmarkCaseForCatalogId,
  benchmarkResultsFor,
  resetBenchmarkRegistryForTests,
  setBenchmarkRegistryForTests,
} from '../../src/cases/benchmarkRegistry'
import { graySchematicRefs, resetGrayFrameManifestForTests, setGrayFrameManifestForTests } from '../../src/cases/grayFrames'
import CaseHeader from '../../src/components/cases/CaseHeader.vue'
import CaseNav from '../../src/components/cases/CaseNav.vue'
import CopDisplay from '../../src/components/cases/CopDisplay.vue'
import MetricStrip from '../../src/components/cases/MetricStrip.vue'
import ResultTable from '../../src/components/cases/ResultTable.vue'
import SchematicViewer from '../../src/components/cases/SchematicViewer.vue'
import { resetAwesomePhysicsAdapterRegistrationsForTests } from '../../src/awesomePhysics/registerAdapters'
import { resetAwesomePhysicsRegistryForTests, setAwesomePhysicsRegistryForTests } from '../../src/registries/awesomePhysicsRegistry'
import CaseHubView from '../../src/views/CaseHubView.vue'
import type { AwesomePhysicsCatalogArtifactV1, AwesomePhysicsSimulationArtifactV1 } from '../../src/types/awesomePhysics'

const catalog = catalogJson as AwesomePhysicsCatalogArtifactV1
const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/labs/cases', name: 'case-hub', component: CaseHubView },
      { path: '/labs/edwin-gray', name: 'edwin-gray', component: { template: '<div />' } },
      { path: '/awesome-physics', name: 'awesome-physics-catalog', component: { template: '<div />' } },
      { path: '/awesome-physics/:id', name: 'awesome-physics-detail', component: { template: '<div />' }, props: true },
    ],
  })
}

describe('shared case kit', () => {
  beforeEach(() => {
    resetGrayFrameManifestForTests()
    resetAwesomePhysicsAdapterRegistrationsForTests()
    resetAwesomePhysicsRegistryForTests()
    resetBenchmarkRegistryForTests()
    setAwesomePhysicsRegistryForTests({ catalog, simulations })
    setBenchmarkRegistryForTests({
      cases:  benchmarkCasesJson as never,
      report: benchmarkResultsJson as never,
    })
  })

  afterEach(() => {
    resetGrayFrameManifestForTests()
    resetAwesomePhysicsAdapterRegistrationsForTests()
    resetAwesomePhysicsRegistryForTests()
    resetBenchmarkRegistryForTests()
  })

  it('publishes Gray plus every catalog record as a case page', () => {
    const records = collectCaseRecords(catalog.items, catalog.organizations, simulations.items)
    expect(records[0]).toEqual(GRAY_CASE)
    expect(records).toHaveLength(1 + catalog.items.length + catalog.organizations.length)
    expect(records.filter((record) => record.runnable)).toHaveLength(1 + simulations.summary.runnable)
    expect(records.every((record) => record.to.startsWith('/') && record.id.length > 0)).toBe(true)
    expect(benchmarkCaseById('gray-motor')?.runnable).toBe(true)
    expect(benchmarkCaseById('gray-motor')?.family).toBe('gray-motor')
    expect(benchmarkResultsFor('awesome-bullet3-capability').some((row) => row.status === 'pass')).toBe(true)
    expect(benchmarkCaseForCatalogId('awesome-matter-js')?.runnable).toBe(true)
  })

  it('renders header, metrics, COP, table, and schematics from shared components', () => {
    const header = mount(CaseHeader, {
      props: { eyebrow: 'Workbench', title: 'Gray motor', description: 'Classical ledger.', identity: 'edwin-gray', status: 'available' },
    })
    expect(header.get('[data-testid="case-header"]').text()).toContain('Gray motor')
    header.unmount()

    const metrics = mount(MetricStrip, {
      props: { metrics: [{ label: 'Runnable', value: '18', tone: 'ok' }] },
    })
    expect(metrics.get('[data-testid="case-metrics"]').text()).toContain('18')
    metrics.unmount()

    const cop = mount(CopDisplay, {
      props: {
        observed: 0.42,
        scope:    'whole-system',
        note:     'Source claims stay separate.',
        claims:   [{ label: 'COP 300', value: 'source-claim', status: 'not validated' }],
      },
    })
    expect(cop.get('[data-testid="case-cop-observed"]').text()).toBe('0.420000')
    expect(cop.text()).toContain('COP 300')
    cop.unmount()

    const table = mount(ResultTable, {
      props: {
        caption: 'Machines',
        columns: [{ key: 'id', label: 'ID' }, { key: 'label', label: 'Label' }],
        rows:    [{ id: 'edwin-gray-purple', label: 'Purple 1979' }],
        testId:  'gray-published-machines',
      },
    })
    expect(table.get('[data-testid="gray-published-machines"]').text()).toContain('Purple 1979')
    table.unmount()
  })

  it('mounts staged research-pack frames and caption-only timeline cards', () => {
    setGrayFrameManifestForTests(
      [{ id: 'ema', src: 'data/generated/edwin-gray/frames/genealogy-004.jpg' }],
      [{ id: 'ema', text: 'fifth generation' }],
    )
    const entries = graySchematicRefs()
    const ema = entries.find((entry) => entry.id === 'ema')
    const intro = entries.find((entry) => entry.id === 'intro')
    expect(ema?.src).toBe('data/generated/edwin-gray/frames/genealogy-004.jpg')
    expect(ema?.subtitle).toContain('fifth generation')
    expect(intro?.src).toBeNull()

    const wrapper = mount(SchematicViewer, { props: { entries } })
    expect(wrapper.get('[data-testid="case-schematic-ema"]').find('img').attributes('src')).toContain('genealogy-004.jpg')
    expect(wrapper.get('[data-testid="case-schematic-intro"]').find('img').exists()).toBe(false)
    wrapper.unmount()
  })

  it('navigates previous and next case pages', async () => {
    const router = testRouter()
    await router.push('/labs/edwin-gray')
    const wrapper = mount(CaseNav, {
      props: {
        currentId: 'edwin-gray',
        cases:     [
          { id: 'case-hub', title: 'Simulation cases', to: '/labs/cases' },
          { id: 'edwin-gray', title: 'Edwin Gray motor lab', to: '/labs/edwin-gray' },
          { id: 'awesome-matter-js', title: 'matter-js', to: '/awesome-physics/awesome-matter-js' },
        ],
      },
      global: { plugins: [router] },
    })
    expect(wrapper.get('[data-testid="case-nav-prev"]').attributes('href')).toBe('/labs/cases')
    expect(wrapper.get('[data-testid="case-nav-next"]').attributes('href')).toBe('/awesome-physics/awesome-matter-js')
    wrapper.unmount()
  })

  it('lists Gray and every runnable Awesome Physics case on the hub', async () => {
    const router = testRouter()
    await router.push('/labs/cases')
    const wrapper = mount(CaseHubView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="case-hub-ready"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="case-card-edwin-gray"]').attributes('href')).toBe('/labs/edwin-gray')
    expect(wrapper.findAll('.case-card.is-runnable')).toHaveLength(1 + simulations.summary.runnable)
    await wrapper.get('[data-testid="case-hub-filter"]').setValue('runnable')
    expect(wrapper.get('[data-testid="case-hub-count"]').text()).toContain(`${1 + simulations.summary.runnable} shown`)
    wrapper.unmount()
  })
})
