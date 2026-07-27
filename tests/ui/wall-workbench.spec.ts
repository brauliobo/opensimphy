import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { vi } from 'vitest'
import NumberWallsView from '../../src/views/NumberWallsView.vue'
import {
  resetSavedRunRegistryForTests,
  setSavedRunRegistryDependenciesForTests,
  useSavedRunRegistry,
  type SavedRunStorage,
} from '../../src/registries/savedRunRegistry'
import { resetWallRegistryForTests, setWallRegistryForTests } from '../../src/registries/wallRegistry'
import { wall } from './fixtures'

const workerState = vi.hoisted(() => ({
  constructions: 0,
  run:           0,
  hold:          false,
  large:         false,
  releases:      [] as Array<() => void>,
  workers:       [] as Array<{ terminated: boolean }>,
}))

vi.mock('../../src/workers/numberWall.worker?worker', () => ({
  default: class NumberWallWorkerMock {
    readonly listeners = new Map<string, Array<(event: any) => void>>()
    terminated = false

    constructor() {
      workerState.constructions += 1
      workerState.workers.push(this)
    }

    addEventListener(type: string, listener: (event: any) => void): void {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
    }

    postMessage(message: Record<string, any>): void {
      workerState.run += 1
      const run = workerState.run
      const exact = workerState.large ? '9'.repeat(530_000) : String(run)
      const zeroValue = ['signed_log', 'row_signed_log', 'valuation'].includes(message.options.mode)
        ? null
        : message.options.mode === 'zero_windows' ? 1 : 0
      const emit = () => {
        const result = {
          id:    message.payload.id,
          terms: message.options.terms,
          depth: message.options.depth,
          mode:  message.options.mode,
          cells: [
            { row: -1, column: 0, value: run, sign: 1, exact, isExactZero: false },
            { row: 0, column: 1, value: zeroValue, sign: 0, exact: '0', isExactZero: true },
            { row: 0, column: 2, value: 0, sign: 1, exact: '7', isExactZero: false },
          ],
        }
        for (const listener of this.listeners.get('message') ?? []) {
          listener({ data: { type: 'result', requestId: message.requestId, result } })
        }
      }
      if (workerState.hold) workerState.releases.push(emit)
      else queueMicrotask(emit)
    }

    terminate(): void {
      this.terminated = true
    }
  },
}))

const fibonacci = {
  ...wall,
  id:          'fibonacci',
  title:       'Fibonacci Numbers',
  category:    'binary-recurrences',
  description: 'Fibonacci recurrence',
  filename:    'fibonacci.json',
}

class MemoryStorage implements SavedRunStorage {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

function sourceResponse(id: string): Response {
  return new Response(JSON.stringify({
    id,
    title: id === 'catalan' ? 'Catalan' : 'Fibonacci',
    kind: 'terms',
    sequence: ['1', '1', '2', '5'],
  }), { status: 200, headers: { 'content-type': 'application/json' } })
}

function createWallRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/labs/walls', component: NumberWallsView }],
  })
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await flushPromises()
}

async function mountWall(router: Router, path = '/labs/walls'): Promise<VueWrapper> {
  await router.push(path)
  await router.isReady()
  const wrapper = mount(NumberWallsView, { global: { plugins: [router] } })
  await settle()
  return wrapper
}

describe('Number Walls Iteration 7 workbench adapter', () => {
  beforeEach(() => {
    resetSavedRunRegistryForTests()
    setSavedRunRegistryDependenciesForTests({
      storage: new MemoryStorage(),
      now:     () => '2026-07-27T10:00:00.000Z',
    })
    setWallRegistryForTests([wall, fibonacci])
    workerState.constructions = 0
    workerState.run = 0
    workerState.hold = false
    workerState.large = false
    workerState.releases.length = 0
    workerState.workers.length = 0
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => (
      sourceResponse(String(input).includes('fibonacci') ? 'fibonacci' : 'catalan')
    )))
  })

  afterEach(() => {
    resetWallRegistryForTests()
    resetSavedRunRegistryForTests()
    vi.unstubAllGlobals()
  })

  it('hydrates strict bounded URL state, canonicalizes repeats, supports presets/back, and resets owned keys', async () => {
    const router = createWallRouter()
    const wrapper = await mountWall(
      router,
      '/labs/walls?wall=fibonacci&depth=2&depth=3&width=100&mode=mod&modulus=997&q=Fib&category=binary-recurrences&foreign=keep',
    )

    expect(wrapper.get('[data-testid="wall-source"]').element).toHaveProperty('value', 'fibonacci')
    expect(wrapper.get('[data-testid="workbench-url-state-warning"]').text()).toContain('depth')
    expect(wrapper.get('[data-testid="wall-depth"]').element).toHaveProperty('value', '16')
    expect(wrapper.get('[data-testid="wall-width"]').element).toHaveProperty('value', '100')
    expect(wrapper.get('[data-testid="wall-mode"]').element).toHaveProperty('value', 'mod')
    expect(router.currentRoute.value.query).toEqual({
      category: 'binary-recurrences',
      foreign:  'keep',
      mode:     'mod',
      modulus:  '997',
      q:        'Fib',
      wall:     'fibonacci',
      width:    '100',
    })

    await wrapper.get('[data-testid="wall-preset"]').setValue('compact')
    await settle()
    expect(router.currentRoute.value.query).toMatchObject({ depth: '8', width: '16', foreign: 'keep' })
    expect(workerState.constructions).toBe(0)

    await wrapper.get('[data-testid="wall-preset"]').setValue('modular-seven')
    await settle()
    expect(router.currentRoute.value.query).toMatchObject({ mode: 'mod', foreign: 'keep' })
    await router.back()
    await settle()
    expect(wrapper.get('[data-testid="wall-preset"]').element).toHaveProperty('value', 'compact')
    expect(wrapper.get('[data-testid="wall-depth"]').element).toHaveProperty('value', '8')

    await wrapper.get('[data-testid="workbench-reset"]').trigger('click')
    await settle()
    expect(router.currentRoute.value.query).toEqual({ foreign: 'keep' })
    expect(wrapper.get('[data-testid="wall-source"]').element).toHaveProperty('value', 'catalan')
    expect(wrapper.get('[data-testid="wall-depth"]').element).toHaveProperty('value', '16')
    expect(wrapper.get('[data-testid="wall-width"]').element).toHaveProperty('value', '32')
    expect(wrapper.get('[data-testid="wall-mode"]').element).toHaveProperty('value', 'signed_log')
    expect(wrapper.get('[data-testid="wall-modulus"]').element).toHaveProperty('value', '7')
    expect(wrapper.find('[data-testid="workbench-url-state-warning"]').exists()).toBe(false)
  })

  it('defers payload and worker work until Run and keeps saves tied to immutable dispatched inputs', async () => {
    const wrapper = await mountWall(createWallRouter())

    expect(fetch).not.toHaveBeenCalled()
    expect(workerState.constructions).toBe(0)
    expect(useSavedRunRegistry().runs.value).toHaveLength(0)

    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await settle()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(workerState.constructions).toBe(1)
    expect(wrapper.get('[data-testid="wall-simulation-ready"]').exists()).toBe(true)
    expect(useSavedRunRegistry().runs.value).toHaveLength(0)

    await wrapper.get('[data-testid="wall-depth"]').setValue(8)
    await settle()
    expect(wrapper.get('[data-testid="wall-result-stale"]').text()).toContain('stale')
    expect(wrapper.get('[data-testid="workbench-finding"]').text()).toContain('display minimum 0 and display maximum 1, with 1 exact zero cells')
    expect(wrapper.get('[data-testid="finding-cause"]').text()).toContain('depth 16')
    expect(wrapper.get('[data-testid="finding-establishes"]').text()).toContain('local bounded matrix transform')
    expect(wrapper.get('[data-testid="finding-does-not-establish"]').text()).toContain('Physical evidence, pattern significance, a null model')
    expect(wrapper.get('[data-testid="finding-validates-theory"]').text()).toBe('false')

    await wrapper.get('[data-testid="workbench-save"]').trigger('click')
    const saved = useSavedRunRegistry().runs.value[0]
    expect(saved).toBeDefined()
    expect(saved?.inputs).toMatchObject({ options: { depth: 16, width: 32, mode: 'signed_log', modulus: 7 } })
    expect(saved?.outputs).toMatchObject({ matrix: expect.any(Array), min: 0, max: 1, zeroCount: 1 })
    expect(JSON.stringify(saved?.provenance)).toContain('/data/number-walls/catalan.json')

    workerState.large = true
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await settle()
    await wrapper.get('[data-testid="workbench-save"]').trigger('click')
    expect(wrapper.get('[data-action-error="save"]').text()).toMatch(/limit is 524288 bytes/)
    expect(useSavedRunRegistry().runs.value).toHaveLength(1)
  })

  it('rejects composite valuation bases in URLs and direct controls', async () => {
    const router = createWallRouter()
    const wrapper = await mountWall(router, '/labs/walls?mode=valuation&modulus=9')

    expect(wrapper.get('[data-testid="workbench-url-state-warning"]').text()).toContain('modulus')
    expect(wrapper.get('[data-testid="wall-mode"]').element).toHaveProperty('value', 'valuation')
    expect(wrapper.get('[data-testid="wall-modulus"]').element).toHaveProperty('value', '7')

    await wrapper.get('[data-testid="workbench-reset"]').trigger('click')
    expect(wrapper.find('[data-testid="workbench-url-state-warning"]').exists()).toBe(false)

    await wrapper.get('[data-testid="wall-mode"]').setValue('valuation')
    await wrapper.get('[data-testid="wall-modulus"]').setValue(15)
    expect(wrapper.get('[data-testid="wall-modulus"]').element).toHaveProperty('value', '7')
    expect(router.currentRoute.value.query.modulus).toBeUndefined()
  })

  it('compares summary deltas only for the declared compatible wall contract', async () => {
    const wrapper = await mountWall(createWallRouter())
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await settle()
    await wrapper.get('[data-testid="workbench-freeze"]').trigger('click')

    await wrapper.get('[data-testid="wall-modulus"]').setValue(11)
    await settle()
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await settle()
    await wrapper.get('[data-testid="workbench-freeze"]').trigger('click')

    expect(wrapper.get('[data-testid="workbench-compare-status"]').text()).toContain('Compatible')
    expect(wrapper.get('[data-testid="wall-compatible-deltas"]').text()).toContain('Display-maximum delta1')
    expect(wrapper.text().toLowerCase()).not.toContain('residual')

    await wrapper.get('[data-testid="workbench-clear-compare"]').trigger('click')
    await wrapper.get('[data-testid="workbench-freeze"]').trigger('click')
    await wrapper.get('[data-testid="wall-mode"]').setValue('mod')
    await settle()
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await settle()
    await wrapper.get('[data-testid="workbench-freeze"]').trigger('click')

    expect(wrapper.get('[data-testid="workbench-compare-status"]').text()).toContain('Incompatible')
    expect(wrapper.find('[data-testid="wall-compatible-deltas"]').exists()).toBe(false)
    expect(wrapper.text().toLowerCase()).not.toContain('residual')
  })

  it('inspects display cells with arrow, Home, and End keys', async () => {
    const wrapper = await mountWall(createWallRouter())
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await settle()

    const canvas = wrapper.get('[data-testid="wall-canvas"]')
    expect(canvas.attributes('aria-keyshortcuts')).toContain('ArrowDown')
    await canvas.trigger('keydown', { key: 'ArrowDown' })
    await canvas.trigger('keydown', { key: 'End' })
    expect(wrapper.get('.cell-readout').text()).toContain('Cell [1, 3]')
    await canvas.trigger('keydown', { key: 'Home' })
    expect(wrapper.get('.cell-readout').text()).toContain('Cell [1, 0]')
  })

  it('cancels a fresh active worker and reset ignores its late result', async () => {
    const router = createWallRouter()
    const wrapper = await mountWall(router, '/labs/walls?depth=8&foreign=keep')
    workerState.hold = true
    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await settle()
    expect(workerState.workers[0]?.terminated).toBe(false)

    await wrapper.get('[data-testid="workbench-reset"]').trigger('click')
    await settle()
    expect(workerState.workers[0]?.terminated).toBe(true)
    expect(router.currentRoute.value.query).toEqual({ foreign: 'keep' })
    workerState.releases[0]?.()
    await settle()

    expect(wrapper.find('[data-testid="wall-simulation-ready"]').exists()).toBe(false)
    expect(wrapper.attributes('data-execution-status')).not.toBe('completed')
  })
})
