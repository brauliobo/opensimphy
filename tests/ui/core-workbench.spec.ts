import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { vi } from 'vitest'
import type { CoreRecord } from '../../src/registries/coreRegistry'
import { resetCoreRegistryForTests, setCoreRegistryForTests } from '../../src/registries/coreRegistry'
import {
  resetSavedRunRegistryForTests,
  setSavedRunRegistryDependenciesForTests,
  useSavedRunRegistry,
  type SavedRunStorage,
} from '../../src/registries/savedRunRegistry'
import CoreLabView from '../../src/views/CoreLabView.vue'
import { coreCase, figure } from './fixtures'

interface WorkerRecord {
  postMessage: ReturnType<typeof vi.fn>
  terminate: ReturnType<typeof vi.fn>
}

const workers = vi.hoisted(() => [] as WorkerRecord[])

vi.mock('../../src/workers/core.worker?worker', () => ({
  default: class CoreWorkerMock {
    private readonly record = { postMessage: vi.fn(), terminate: vi.fn() }

    constructor() {
      workers.push(this.record)
    }

    addEventListener(): void {}

    postMessage(message: unknown): void {
      this.record.postMessage(message)
    }

    terminate(): void {
      this.record.terminate()
    }
  },
}))

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

const storage = new MemoryStorage()

function record(index: number): CoreRecord {
  const id = index === 0 ? coreCase.id : `core-case-${String(index + 1).padStart(2, '0')}`
  const sourceRevision = `fixture-core-source-${index + 1}`
  const implementationRevision = 'fixture-core-engine-v1'
  const outputSchemaRevision = 'fixture-core-output-v1'
  const provenance = {
    ...coreCase.provenance,
    sourceRevision,
    implementationRevision,
    contentRevision: outputSchemaRevision,
  }
  return {
    ...coreCase,
    id,
    title: `Core preset ${index + 1}`,
    family: `family-${index % 4}`,
    description: `Declared fixture preset ${index + 1}`,
    graphs: index === 3
      ? [{ id: 'sweep-2d', label: '2D parameter sweep', figure }]
      : [
          { id: 'sweep-2d', label: '2D parameter sweep', figure },
          { id: 'complex-surface-3d', label: '3D complex surface', figure },
        ],
    output: { caseId: id, value: index + 1, components: [index + 1, 0] },
    residual: index / 1e6,
    sourceIdentity: { ...coreCase.sourceIdentity },
    sourceRevision,
    implementationRevision,
    outputSchemaRevision,
    compatibilityKey: (index + 1).toString(16).padStart(64, '0'),
    provenance,
    finding: {
      ...coreCase.finding,
      changed: `Declared Core preset ${id} is selected for presentation.`,
      provenance,
    },
  }
}

const coreCases = Array.from({ length: 37 }, (_, index) => record(index))

function testRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/labs/core', component: CoreLabView }],
  })
}

async function mountCore(path = '/labs/core'): Promise<{ router: Router; wrapper: VueWrapper }> {
  const router = testRouter()
  await router.push(path)
  const wrapper = mount(CoreLabView, { global: { plugins: [router] } })
  await flushPromises()
  return { router, wrapper }
}

async function historyTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await flushPromises()
}

describe('Core Iteration 7 workbench adapter', () => {
  beforeEach(() => {
    workers.splice(0)
    storage.values.clear()
    storage.failWrites = false
    resetCoreRegistryForTests()
    resetSavedRunRegistryForTests()
    setCoreRegistryForTests(coreCases)
    setSavedRunRegistryDependenciesForTests({
      storage,
      baseUrl: '/',
      now: () => '2026-07-27T10:00:00.000Z',
    })
  })

  afterEach(() => {
    resetCoreRegistryForTests()
    resetSavedRunRegistryForTests()
  })

  it('hydrates strict canonical URL state, preserves unrelated query, follows history, and resets defaults', async () => {
    const { router, wrapper } = await mountCore('/labs/core?case=missing&projection=4d&plot=missing&keep=yes')
    await historyTick()

    expect(router.currentRoute.value.query).toEqual({ keep: 'yes' })
    expect(wrapper.get('[data-testid="workbench-url-state-warning"]').text()).toContain('case, projection, plot')
    expect((wrapper.get('[data-testid="core-preset-select"]').element as HTMLSelectElement).value).toBe(coreCases[0]!.id)
    expect(wrapper.get('[data-testid="core-projection-3d"]').classes()).toContain('active')
    expect((wrapper.get('[data-testid="core-plot-select"]').element as HTMLSelectElement).value).toBe('')

    await wrapper.get(`[data-testid="core-case-${coreCases[1]!.id}"]`).trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ keep: 'yes', case: coreCases[1]!.id })

    await wrapper.get('[data-testid="core-projection-2d"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ keep: 'yes', case: coreCases[1]!.id, projection: '2d' })

    await wrapper.get('[data-testid="core-plot-sweep-2d"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ keep: 'yes', case: coreCases[1]!.id, projection: '2d', plot: 'sweep-2d' })
    expect((wrapper.get('[data-testid="core-preset-select"]').element as HTMLSelectElement).value).toBe(coreCases[1]!.id)
    expect(wrapper.get('[data-testid="core-projection-2d"]').classes()).toContain('active')

    await router.push({ query: { keep: 'yes', case: coreCases[2]!.id } })
    await historyTick()
    router.back()
    await historyTick()
    expect((wrapper.get('[data-testid="core-preset-select"]').element as HTMLSelectElement).value).toBe(coreCases[1]!.id)
    expect(router.currentRoute.value.query).toEqual({ keep: 'yes', case: coreCases[1]!.id, projection: '2d', plot: 'sweep-2d' })
    expect(wrapper.find('[data-testid="workbench-url-state-warning"]').exists()).toBe(false)

    await wrapper.get('[data-testid="workbench-reset"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ keep: 'yes' })
    expect((wrapper.get('[data-testid="core-preset-select"]').element as HTMLSelectElement).value).toBe(coreCases[0]!.id)
    expect((wrapper.get('[data-testid="core-plot-select"]').element as HTMLSelectElement).value).toBe('')
    expect(wrapper.find('[data-testid="workbench-url-state-warning"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('rejects unavailable 3D projections instead of relabeling a 2D graph', async () => {
    const twoDimensional = coreCases[3]!
    const { router, wrapper } = await mountCore(`/labs/core?case=${twoDimensional.id}&projection=3d`)
    await historyTick()

    expect(router.currentRoute.value.query).toEqual({ case: twoDimensional.id })
    expect(wrapper.get('[data-testid="workbench-url-state-warning"]').text()).toContain('projection')
    expect(wrapper.get('[data-testid="core-projection-2d"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="core-projection-3d"]').attributes()).toHaveProperty('disabled')
    expect(wrapper.get('[data-testid="plot-ready"]').attributes('aria-label')).toContain('2D parameter sweep')
  })

  it('keeps explicit plot and projection state dimensionally consistent', async () => {
    const current = coreCases[0]!
    const { router, wrapper } = await mountCore(`/labs/core?case=${current.id}&projection=3d&plot=sweep-2d`)
    await historyTick()

    expect(router.currentRoute.value.query).toMatchObject({ projection: '2d', plot: 'sweep-2d' })
    expect(wrapper.get('[data-testid="workbench-url-state-warning"]').text()).toContain('projection')
    expect(wrapper.get('[data-testid="core-projection-2d"]').attributes('aria-pressed')).toBe('true')

    await wrapper.get('[data-testid="core-plot-complex-surface-3d"]').trigger('click')
    expect(wrapper.get('[data-testid="core-projection-3d"]').attributes('aria-pressed')).toBe('true')
    await wrapper.get('[data-testid="core-plot-sweep-2d"]').trigger('click')
    expect(wrapper.get('[data-testid="core-projection-2d"]').attributes('aria-pressed')).toBe('true')
  })

  it('uses route-evaluated completion with all 37 presets and no fake Run control', async () => {
    const { wrapper } = await mountCore()

    expect(wrapper.find('[data-testid="core-registry-ready"]').exists()).toBe(true)
    expect(wrapper.get('.workbench-shell').attributes()).toMatchObject({
      'data-execution-mode': 'route-evaluated',
      'data-execution-status': 'completed',
    })
    expect(wrapper.find('[data-testid="workbench-run"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="workbench-mode-status"]').text()).toContain('evaluated all 37 declared cases on route load')
    expect(wrapper.findAll('[data-testid^="core-case-"]')).toHaveLength(37)
    expect(wrapper.get('[data-testid="core-preset-select"]').findAll('option')).toHaveLength(37)
    expect(wrapper.find('[data-testid="plot-ready"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="finding-validates-theory"]').text()).toBe('false')
    expect(wrapper.get('[data-testid="core-raw-output"]').text()).toContain('components')
    expect(wrapper.get('a[target="_blank"]').text()).toContain('opens new tab')
    wrapper.unmount()
  })

  it('saves only on the explicit action with structured result and revision metadata', async () => {
    const { wrapper } = await mountCore()
    const registry = useSavedRunRegistry()

    await wrapper.get('[data-testid="core-projection-2d"]').trigger('click')
    await wrapper.get('[data-testid="core-plot-sweep-2d"]').trigger('click')
    expect(registry.runs.value).toHaveLength(0)
    expect(storage.values.size).toBe(0)

    await wrapper.get('[data-testid="workbench-save"]').trigger('click')
    const saved = registry.runs.value[0]!
    expect(registry.runs.value).toHaveLength(1)
    expect(saved).toMatchObject({
      schemaVersion: 1,
      instrumentId: `core-${coreCases[0]!.id}`,
      methodId: 'core-route-evaluation',
      inputs: { case: coreCases[0]!.id, projection: '2d', plot: 'sweep-2d' },
      outputs: {
        result: coreCases[0]!.output,
        selectedGraphId: 'sweep-2d',
      },
      sourceRevision: coreCases[0]!.sourceRevision,
      implementationRevision: coreCases[0]!.implementationRevision,
      compatibilityKey: coreCases[0]!.compatibilityKey,
    })
    expect(wrapper.get('[data-testid="core-save-result"]').text()).toContain('Saved Core run')
    wrapper.unmount()
  })

  it('surfaces browser storage failures without discarding the in-session saved run', async () => {
    storage.failWrites = true
    const { wrapper } = await mountCore()

    await wrapper.get('[data-testid="workbench-save"]').trigger('click')

    expect(useSavedRunRegistry().runs.value).toHaveLength(1)
    expect(wrapper.get('[data-action-error="save"]').text()).toContain('browser storage could not save it')
    wrapper.unmount()
  })

  it('compares same-case presentations without inferring a scientific residual', async () => {
    const { wrapper } = await mountCore()

    await wrapper.get('[data-testid="workbench-freeze"]').trigger('click')
    await wrapper.get('[data-testid="core-projection-2d"]').trigger('click')
    await wrapper.get('[data-testid="workbench-freeze"]').trigger('click')

    expect(wrapper.get('[data-testid="workbench-compare-status"]').text()).toContain('Compatible')
    expect(wrapper.findAll('[data-testid="workbench-compare-finding"]')).toHaveLength(2)
    expect(wrapper.get('[data-testid="core-presentation-comparison"]').text()).toContain('presentation state only')
    expect(wrapper.get('[data-testid="core-presentation-comparison"]').text()).toContain('no scientific residual is inferred')
    expect(wrapper.get('[data-testid="workbench-freeze"]').attributes()).toHaveProperty('disabled')

    await wrapper.get('[data-testid="workbench-clear-compare"]').trigger('click')
    expect(wrapper.find('[data-testid="workbench-compare"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="workbench-freeze"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('keeps different-case findings parallel and renders no domain comparison', async () => {
    const { wrapper } = await mountCore()

    await wrapper.get('[data-testid="workbench-freeze"]').trigger('click')
    await wrapper.get(`[data-testid="core-case-${coreCases[1]!.id}"]`).trigger('click')
    await wrapper.get('[data-testid="workbench-freeze"]').trigger('click')

    expect(wrapper.get('[data-testid="workbench-compare-status"]').text()).toContain('Incompatible')
    expect(wrapper.findAll('[data-testid="workbench-compare-finding"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="core-presentation-comparison"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="workbench-compare"]').text()).toContain('no combined quantity is calculated')
    wrapper.unmount()
  })

  it('retains one route-owned Core worker and does not import a second execution path', async () => {
    resetCoreRegistryForTests()
    const router = testRouter()
    await router.push('/labs/core')
    const wrapper = mount(CoreLabView, { global: { plugins: [router] } })
    await flushPromises()

    expect(workers).toHaveLength(1)
    expect(workers[0]!.postMessage).toHaveBeenCalledOnce()
    expect(workers[0]!.postMessage.mock.calls[0]![0]).toMatchObject({ type: 'evaluate-core' })
    expect(wrapper.find('[data-testid="workbench-run"]').exists()).toBe(false)

    wrapper.unmount()
    await Promise.resolve()
    expect(workers[0]!.terminate).toHaveBeenCalledOnce()
  })
})
