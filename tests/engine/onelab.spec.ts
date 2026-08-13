import { summarizeView, withinTolerance } from '../../src/simulation/reference'
import { OnelabClient } from '../../src/simulation/client'
import { OnelabWorkerScheduler } from '../../src/simulation/worker-scheduler'

describe('ONELAB numerical comparison helpers', () => {
  it('summarizes scalar and vector data without reducing vectors component-wise', () => {
    expect(summarizeView({
      name: 'v', dataType: 'scalar', numElements: 1, components: 1,
      values: new Float64Array([0, 1, 2]),
    })).toEqual({ min: 0, max: 2, mean: 1, samples: 3 })
    expect(summarizeView({
      name: 'e', dataType: 'vector', numElements: 1, components: 3,
      values: new Float64Array([3, 4, 0, 0, 0, 2]),
    })).toEqual({ min: 2, max: 5, mean: 3.5, samples: 2 })
  })

  it('uses combined absolute and relative tolerance', () => {
    expect(withinTolerance(1.000001, 1, 1e-8, 1e-5)).toBe(true)
    expect(withinTolerance(1.001, 1, 1e-8, 1e-5)).toBe(false)
  })
})

describe('ONELAB request cancellation', () => {
  it('cancels only the targeted request and reports collateral requests as worker-restarted', async () => {
    class WorkerStub extends EventTarget {
      static instances: WorkerStub[] = []
      postMessage = vi.fn()
      terminate = vi.fn()
      constructor() { super(); WorkerStub.instances.push(this) }
    }
    vi.stubGlobal('Worker', WorkerStub)
    const client = new OnelabClient()
    const targeted = client.startMicrostrip()
    const collateral = client.startMicrostrip()

    expect(client.cancel('missing')).toBe(false)
    expect(WorkerStub.instances[0]?.terminate).not.toHaveBeenCalled()
    expect(client.cancel(targeted.requestId)).toBe(true)
    await expect(targeted.promise).rejects.toThrow(`request ${targeted.requestId} cancelled`)
    await expect(collateral.promise).rejects.toThrow(`request ${collateral.requestId} failed because the ONELAB worker restarted`)
    expect(WorkerStub.instances).toHaveLength(2)
    client.dispose()
    vi.unstubAllGlobals()
  })

  it('rejects pending and subsequent requests when disposed', async () => {
    class WorkerStub extends EventTarget {
      postMessage = vi.fn()
      terminate = vi.fn()
    }
    vi.stubGlobal('Worker', WorkerStub)
    const client = new OnelabClient()
    const pending = client.startMicrostrip()
    client.dispose()
    await expect(pending.promise).rejects.toThrow('ONELAB client disposed')
    await expect(client.startMicrostrip().promise).rejects.toThrow('ONELAB client is disposed')
    vi.unstubAllGlobals()
  })
})

describe('ONELAB worker scheduling', () => {
  it('serializes concurrent runs behind one shared initialization', async () => {
    const scheduler = new OnelabWorkerScheduler()
    const events: string[] = []
    let initializations = 0
    let active = 0
    let maximumActive = 0
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })
    const initialize = async () => { initializations++; events.push('initialize') }
    const run = (id: string, gate?: Promise<void>) => scheduler.enqueue(async () => {
      await scheduler.initialize(initialize)
      active++
      maximumActive = Math.max(maximumActive, active)
      events.push(`start-${id}`)
      await gate
      events.push(`end-${id}`)
      active--
      return id
    })

    const first = run('1', firstGate)
    const second = run('2')
    await vi.waitFor(() => expect(events).toEqual(['initialize', 'start-1']))
    expect(initializations).toBe(1)
    releaseFirst()
    await expect(Promise.all([first, second])).resolves.toEqual(['1', '2'])
    expect(events).toEqual(['initialize', 'start-1', 'end-1', 'start-2', 'end-2'])
    expect(maximumActive).toBe(1)
    expect(initializations).toBe(1)
  })
})
