import { vi } from 'vitest'

type Listener = (event: { message?: string; data?: unknown }) => void
interface WorkerRecord {
  listeners: Map<string, Listener>
  postMessage: ReturnType<typeof vi.fn>
  terminate: ReturnType<typeof vi.fn>
}

const workers = vi.hoisted(() => ({
  formula: [] as WorkerRecord[],
  core: [] as WorkerRecord[],
}))

vi.mock('../../src/workers/formula.worker?worker', () => ({
  default: class FormulaWorkerMock {
    private record: WorkerRecord

    constructor() {
      this.record = { listeners: new Map(), postMessage: vi.fn(), terminate: vi.fn() }
      workers.formula.push(this.record)
    }

    addEventListener(type: string, listener: Listener): void {
      this.record.listeners.set(type, listener)
    }

    postMessage(message: unknown): void {
      this.record.postMessage(message)
    }

    terminate(): void {
      this.record.terminate()
    }
  },
}))

vi.mock('../../src/workers/core.worker?worker', () => ({
  default: class CoreWorkerMock {
    private record: WorkerRecord

    constructor() {
      this.record = { listeners: new Map(), postMessage: vi.fn(), terminate: vi.fn() }
      workers.core.push(this.record)
    }

    addEventListener(type: string, listener: Listener): void {
      this.record.listeners.set(type, listener)
    }

    postMessage(message: unknown): void {
      this.record.postMessage(message)
    }

    terminate(): void {
      this.record.terminate()
    }
  },
}))

import { resetCoreRegistryForTests, useCoreRegistry } from '../../src/registries/coreRegistry'
import { resetFormulaRegistryForTests, useFormulaRegistry } from '../../src/registries/formulaRegistry'

function formulaFetch(): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    return {
      ok: true,
      status: 200,
      json: async () => url.endsWith('/recipes.json') ? Array.from({ length: 288 }, () => ({})) : [{}],
    }
  })
}

describe('worker registry lifecycle', () => {
  afterEach(() => {
    resetFormulaRegistryForTests()
    resetCoreRegistryForTests()
    workers.formula.splice(0)
    workers.core.splice(0)
    vi.unstubAllGlobals()
  })

  it('retries formula and core initialization after worker failures', async () => {
    vi.stubGlobal('fetch', formulaFetch())
    const formulaRegistry = useFormulaRegistry()
    const firstFormula = formulaRegistry.initialize()
    await vi.waitFor(() => expect(workers.formula).toHaveLength(1))
    workers.formula[0]?.listeners.get('error')?.({ message: 'formula failure' })
    await firstFormula
    expect(formulaRegistry.error.value?.message).toBe('formula failure')

    const secondFormula = formulaRegistry.initialize()
    await vi.waitFor(() => expect(workers.formula).toHaveLength(2))
    workers.formula[1]?.listeners.get('error')?.({ message: 'formula failure again' })
    await secondFormula

    const coreRegistry = useCoreRegistry()
    const firstCore = coreRegistry.initialize()
    await vi.waitFor(() => expect(workers.core).toHaveLength(1))
    workers.core[0]?.listeners.get('error')?.({ message: 'core failure' })
    await firstCore
    expect(coreRegistry.error.value?.message).toBe('core failure')

    const secondCore = coreRegistry.initialize()
    await vi.waitFor(() => expect(workers.core).toHaveLength(2))
    workers.core[1]?.listeners.get('error')?.({ message: 'core failure again' })
    await secondCore
  })

  it('keeps formula initialization alive across a same-microtask route handoff', async () => {
    vi.stubGlobal('fetch', formulaFetch())
    const registry = useFormulaRegistry()
    const firstRelease = registry.acquire()
    const pending = registry.initialize()
    await vi.waitFor(() => expect(workers.formula).toHaveLength(1))

    firstRelease()
    const secondRelease = registry.acquire()
    await Promise.resolve()
    expect(workers.formula[0]?.terminate).not.toHaveBeenCalled()

    secondRelease()
    await Promise.resolve()
    await pending
    expect(workers.formula[0]?.terminate).toHaveBeenCalledOnce()
    expect(registry.ready.value).toBe(false)
    expect(registry.error.value).toBeNull()
  })

  it('terminates core work on final release and reset cannot be repopulated by stale work', async () => {
    const registry = useCoreRegistry()
    const release = registry.acquire()
    const pending = registry.initialize()
    await vi.waitFor(() => expect(workers.core).toHaveLength(1))

    release()
    await Promise.resolve()
    await pending
    expect(workers.core[0]?.terminate).toHaveBeenCalledOnce()
    expect(registry.ready.value).toBe(false)
    expect(registry.error.value).toBeNull()

    const retry = registry.initialize()
    await vi.waitFor(() => expect(workers.core).toHaveLength(2))
    resetCoreRegistryForTests()
    workers.core[1]?.listeners.get('message')?.({
      data: { type: 'result', requestId: 'stale', result: [] },
    })
    await retry
    expect(workers.core[1]?.terminate).toHaveBeenCalledOnce()
    expect(registry.ready.value).toBe(false)
    expect(registry.coreCases.value).toEqual([])
  })
})
