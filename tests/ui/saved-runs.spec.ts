import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import taxonomyJson from '../../public/data/generated/taxonomy.json'
import tourManifestJson from '../../public/data/generated/tour/manifest.json'
import {
  createSavedRunStorageKey,
  resetSavedRunRegistryForTests,
  setSavedRunRegistryDependenciesForTests,
  useSavedRunRegistry,
} from '../../src/registries/savedRunRegistry'
import {
  resetTourOfflinePackForTests,
  setTourOfflinePackDependenciesForTests,
  useTourOfflinePack,
} from '../../src/registries/tourOfflinePack'
import {
  resetTourProgressForTests,
  setTourProgressDependenciesForTests,
  useTourProgress,
} from '../../src/registries/tourProgress'
import { resetTaxonomyRegistryForTests } from '../../src/registries/taxonomyRegistry'
import { resetTourRegistryForTests, setTourRegistryForTests } from '../../src/registries/tourRegistry'
import type { TaxonomyArtifact } from '../../src/types/engine'
import type { TourGeneratedManifest } from '../../src/types/tour'
import type { WorkbenchSnapshotInputV1 } from '../../src/types/workbench'
import SavedView from '../../src/views/SavedView.vue'

const FIRST_TIME = '2026-07-27T10:00:00.000Z'
const SECOND_TIME = '2026-07-27T11:00:00.000Z'
const THIRD_TIME = '2026-07-27T12:00:00.000Z'
const COMPATIBILITY_KEY = 'a'.repeat(64)
const manifest = tourManifestJson as TourGeneratedManifest
const taxonomy = taxonomyJson as TaxonomyArtifact

class MemoryStorage {
  readonly values = new Map<string, string>()
  reads = 0
  failReads = false
  failWrites = false
  failRemoves = false

  getItem(key: string): string | null {
    this.reads += 1
    if (this.failReads) throw new Error('blocked read')
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('blocked write')
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    if (this.failRemoves) throw new Error('blocked remove')
    this.values.delete(key)
  }
}

function formulaRun(overrides: Partial<WorkbenchSnapshotInputV1> = {}): WorkbenchSnapshotInputV1 {
  return {
    instrumentId:          'formula-17',
    methodId:              'float64-source-reproduction',
    inputs:                { value: 2 },
    outputs:               { result: 4 },
    finding:               { status: 'computed', note: '<img src=x onerror="alert(1)">' },
    provenance:            { source: '</pre><script>alert(2)</script>', evidenceRefs: ['source-one'] },
    sourceRevision:        'source-pdf-sha256-v1',
    implementationRevision: 'formula-worker-v6',
    modelRevision:         'source-model-v2',
    contentRevision:       'atlas-content-v7',
    compatibilityKey:      COMPATIBILITY_KEY,
    label:                 'Formula benchmark <script>inert</script>',
    ...overrides,
  } as WorkbenchSnapshotInputV1
}

function programRun(overrides: Partial<WorkbenchSnapshotInputV1> = {}): WorkbenchSnapshotInputV1 {
  return {
    programId:              'EARTH-PHYS-001',
    methodId:               'traditional-baseline',
    inputs:                 { radiusMetres: 10 },
    outputs:                { compactness: 0.1 },
    finding:               { status: 'compared' },
    provenance:            { owner: 'earth-worker' },
    sourceRevision:        'earth-source-v1',
    implementationRevision: 'earth-worker-v1',
    compatibilityKey:      'b'.repeat(64),
    ...overrides,
  } as WorkbenchSnapshotInputV1
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/saved', component: SavedView },
      { path: '/tour', component: { template: '<div />' } },
      { path: '/tour/:chapter/:lesson', component: { template: '<div />' } },
      { path: '/atlas/:id', component: { template: '<div />' } },
    ],
  })
}

async function mountSavedView() {
  const router = createTestRouter()
  await router.push('/saved')
  const wrapper = mount(SavedView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('saved-run notebook surface', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetSavedRunRegistryForTests()
    resetTourProgressForTests()
    resetTourOfflinePackForTests()
    setTourProgressDependenciesForTests({ storage: window.localStorage, now: () => FIRST_TIME })
    setTourOfflinePackDependenciesForTests({
      cacheStorage: { keys: async () => [] } as unknown as CacheStorage,
    })
    setTourRegistryForTests({ manifest, taxonomy })
  })

  afterEach(() => {
    resetSavedRunRegistryForTests()
    resetTourProgressForTests()
    resetTourOfflinePackForTests()
    resetTourRegistryForTests()
    resetTaxonomyRegistryForTests()
    window.localStorage.clear()
  })

  it('hydrates only on view entry and renders exact saved metadata as inert text', async () => {
    const storage = new MemoryStorage()
    let currentTime = FIRST_TIME
    setSavedRunRegistryDependenciesForTests({ storage, now: () => currentTime })
    const seedRegistry = useSavedRunRegistry()
    seedRegistry.save(formulaRun())
    currentTime = SECOND_TIME
    seedRegistry.save(programRun())

    resetSavedRunRegistryForTests()
    storage.reads = 0
    setSavedRunRegistryDependenciesForTests({ storage, now: () => THIRD_TIME })
    expect(storage.reads).toBe(0)
    expect(useSavedRunRegistry().hydrated.value).toBe(false)

    const wrapper = await mountSavedView()

    expect(storage.reads).toBe(1)
    expect(useSavedRunRegistry().hydrated.value).toBe(true)
    expect(wrapper.get('h1').text()).toBe('Local Notebook')
    expect(wrapper.text()).toContain('There is no account, cloud sync, or telemetry.')
    expect(wrapper.get('[data-testid="saved-run-count"]').text()).toBe('2 runs')
    expect(wrapper.findAll('[data-testid="saved-run"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Formula benchmark <script>inert</script>')
    expect(wrapper.text()).toContain('EARTH-PHYS-001')
    expect(wrapper.text()).toContain('Instrument ID')
    expect(wrapper.text()).toContain('Program ID')
    expect(wrapper.text()).toContain('float64-source-reproduction')
    expect(wrapper.text()).toContain('traditional-baseline')
    expect(wrapper.text()).toContain(FIRST_TIME)
    expect(wrapper.text()).toContain(SECOND_TIME)
    expect(wrapper.text()).toContain('source-pdf-sha256-v1')
    expect(wrapper.text()).toContain('formula-worker-v6')
    expect(wrapper.text()).toContain('source-model-v2')
    expect(wrapper.text()).toContain('atlas-content-v7')
    expect(wrapper.get('[data-testid="saved-run-formula-link"]').attributes('href')).toBe('/atlas/17')
    expect(wrapper.findAll('[data-testid="saved-run-formula-link"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="saved-run-finding"]').text()).toContain('<img src=x onerror=\\"alert(1)\\">')
    expect(wrapper.get('[data-testid="saved-run-provenance"]').text()).toContain('</pre><script>alert(2)</script>')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('<script>alert(2)</script>')

    wrapper.unmount()
  })

  it('keeps per-run deletion, clear-all, Tour progress, and Guided-pack state independent', async () => {
    const storage = new MemoryStorage()
    let currentTime = FIRST_TIME
    setSavedRunRegistryDependenciesForTests({ storage, now: () => currentTime })
    const registry = useSavedRunRegistry()
    registry.save(formulaRun())
    currentTime = SECOND_TIME
    registry.save(programRun())
    const progress = useTourProgress()
    progress.visitLesson('units', 'physical-quantities', '/tour/units/physical-quantities')
    const wrapper = await mountSavedView()
    const packStatus = useTourOfflinePack().status.value

    await wrapper.findAll('[data-testid="request-delete-saved-run"]')[0]!.trigger('click')
    expect(registry.runs.value).toHaveLength(2)
    expect(wrapper.find('[data-testid="confirm-delete-saved-run"]').exists()).toBe(true)
    await wrapper.get('[data-testid="confirm-delete-saved-run"]').trigger('click')
    expect(registry.runs.value).toHaveLength(1)
    expect(progress.state.value.lessons['physical-quantities']?.visited).toBe(true)
    expect(useTourOfflinePack().status.value).toBe(packStatus)

    await wrapper.get('[data-testid="request-clear-saved-runs"]').trigger('click')
    expect(registry.runs.value).toHaveLength(1)
    await wrapper.get('[data-testid="confirm-clear-saved-runs"]').trigger('click')
    expect(registry.runs.value).toEqual([])
    expect(progress.state.value.lessons['physical-quantities']?.visited).toBe(true)
    expect(useTourOfflinePack().status.value).toBe(packStatus)

    currentTime = THIRD_TIME
    registry.save(programRun({ methodId: 'comparison-v2' }))
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-testid="request-clear"]').trigger('click')
    await wrapper.get('[data-testid="confirm-clear"]').trigger('click')
    expect(progress.state.value.lessons).toEqual({})
    expect(registry.runs.value).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="saved-run"]')).toHaveLength(1)
    expect(useTourOfflinePack().status.value).toBe(packStatus)

    wrapper.unmount()
  })

  it('announces session-only deletion when browser persistence fails', async () => {
    const storage = new MemoryStorage()
    setSavedRunRegistryDependenciesForTests({ storage, now: () => FIRST_TIME })
    useSavedRunRegistry().save(formulaRun())
    const stored = storage.values.get(createSavedRunStorageKey('/'))
    resetSavedRunRegistryForTests()
    setSavedRunRegistryDependenciesForTests({ storage, now: () => SECOND_TIME })
    const progress = useTourProgress()
    progress.visitLesson('units', 'physical-quantities', '/tour/units/physical-quantities')
    const wrapper = await mountSavedView()
    storage.failWrites = true

    await wrapper.get('[data-testid="request-delete-saved-run"]').trigger('click')
    await wrapper.get('[data-testid="confirm-delete-saved-run"]').trigger('click')

    expect(useSavedRunRegistry().runs.value).toEqual([])
    expect(useSavedRunRegistry().persistenceError.value?.operation).toBe('delete')
    expect(storage.values.get(createSavedRunStorageKey('/'))).toBe(stored)
    expect(wrapper.get('[data-testid="saved-run-status"]').text()).toContain('deleted for this session')
    expect(wrapper.get('[data-testid="saved-run-status"]').text()).toContain('may return after reload')
    expect(progress.state.value.lessons['physical-quantities']?.visited).toBe(true)

    wrapper.unmount()
  })
})
