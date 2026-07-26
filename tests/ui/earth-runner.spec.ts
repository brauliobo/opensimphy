import { getDefaultEarthMethodId, runEarthMethod } from '../../src/engine/earth'
import { createEarthMethodRunner, createEarthSimulationRunner } from '../../src/earth/runSimulation'
import type { EarthWorkerRequest, EarthWorkerResponse } from '../../src/types/earthWorkers'

type MessageListener = (event: MessageEvent<EarthWorkerResponse>) => void
type ErrorListener = (event: ErrorEvent) => void

class FakeWorker {
  readonly requests: EarthWorkerRequest[] = []
  terminated = false
  private readonly messageListeners = new Set<MessageListener>()
  private readonly errorListeners = new Set<ErrorListener>()

  postMessage(message: EarthWorkerRequest): void {
    this.requests.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== 'function') return
    if (type === 'message') this.messageListeners.add(listener as MessageListener)
    if (type === 'error') this.errorListeners.add(listener as ErrorListener)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== 'function') return
    if (type === 'message') this.messageListeners.delete(listener as MessageListener)
    if (type === 'error') this.errorListeners.delete(listener as ErrorListener)
  }

  emit(response: EarthWorkerResponse): void {
    for (const listener of this.messageListeners) listener({ data: response } as MessageEvent<EarthWorkerResponse>)
  }

  emitError(message: string): void {
    for (const listener of this.errorListeners) listener({ message } as ErrorEvent)
  }
}

function runRequest(worker: FakeWorker) {
  const request = worker.requests[0]
  if (!request || request.type !== 'run') throw new Error('Expected a run request')
  return request
}

describe('EARTH worker runner', () => {
  it('uses method protocol identity, reports truthful progress, and terminates after completion', async () => {
    const worker = new FakeWorker()
    const progress: number[] = []
    const programId = 'EARTH-FND-003'
    const methodId = getDefaultEarthMethodId(programId)
    const inputs = { codataAlpha: 0.007_297_352_564_3 }
    const runner = createEarthMethodRunner({ createWorker: () => worker as unknown as Worker })
    const execution = runner(programId, methodId, inputs, { onProgress: (value) => progress.push(value) })
    const request = runRequest(worker)
    const result = runEarthMethod(programId, methodId, inputs)

    expect(request).toMatchObject({ type: 'run', programId, methodId, inputs })
    worker.emit({ type: 'progress', requestId: request.requestId, programId, methodId, progress: 20 })
    worker.emit({ type: 'completed', requestId: request.requestId, programId, methodId, result })

    await expect(execution).resolves.toEqual(result)
    expect(progress).toEqual([5, 20, 100])
    expect(worker.terminated).toBe(true)
  })

  it('keeps the simulation runner as a default-method compatibility wrapper', async () => {
    const worker = new FakeWorker()
    const programId = 'EARTH-FND-002'
    const methodId = getDefaultEarthMethodId(programId)
    const runner = createEarthSimulationRunner({ createWorker: () => worker as unknown as Worker })
    const execution = runner(programId, { exponents: [1] })
    const request = runRequest(worker)
    const result = runEarthMethod(programId, methodId, { exponents: [1] })

    expect(request).toMatchObject({ programId, methodId })
    worker.emit({ type: 'completed', requestId: request.requestId, programId, methodId, result })

    await expect(execution).resolves.toEqual(result)
    expect(worker.terminated).toBe(true)
  })

  it('sends cancellation for the active request and returns method identity', async () => {
    const worker = new FakeWorker()
    const controller = new AbortController()
    const programId = 'EARTH-FLD-005'
    const methodId = getDefaultEarthMethodId(programId)
    const runner = createEarthMethodRunner({ createWorker: () => worker as unknown as Worker })
    const execution = runner(programId, methodId, {}, { signal: controller.signal })
    const request = runRequest(worker)

    controller.abort()

    await expect(execution).resolves.toEqual({
      schemaVersion: 2,
      programId,
      methodId,
      executionStatus: 'cancelled',
      id: programId,
      status: 'cancelled',
    })
    expect(worker.requests).toEqual([
      request,
      { type: 'cancel', requestId: request.requestId },
    ])
    expect(worker.terminated).toBe(true)
  })

  it('does not create a worker for an already-aborted run', async () => {
    const controller = new AbortController()
    const createWorker = vi.fn()
    const programId = 'EARTH-FND-003'
    const methodId = getDefaultEarthMethodId(programId)
    controller.abort()

    const execution = await createEarthMethodRunner({ createWorker })(
      programId,
      methodId,
      {},
      { signal: controller.signal },
    )

    expect(execution).toEqual({
      schemaVersion: 2,
      programId,
      methodId,
      executionStatus: 'cancelled',
      id: programId,
      status: 'cancelled',
    })
    expect(createWorker).not.toHaveBeenCalled()
  })

  it('retains method identity and failure messages returned by the worker', async () => {
    const worker = new FakeWorker()
    const programId = 'EARTH-FND-002'
    const methodId = getDefaultEarthMethodId(programId)
    const runner = createEarthMethodRunner({ createWorker: () => worker as unknown as Worker })
    const execution = runner(programId, methodId, { exponents: [] })
    const request = runRequest(worker)

    worker.emit({
      type: 'failed',
      requestId: request.requestId,
      programId,
      methodId,
      error: 'exponents must contain 1 to 256 entries',
    })

    await expect(execution).resolves.toEqual({
      schemaVersion: 2,
      programId,
      methodId,
      executionStatus: 'failed',
      id: programId,
      status: 'failed',
      error: 'exponents must contain 1 to 256 entries',
    })
    expect(worker.terminated).toBe(true)
  })

  it('returns method-addressed browser, construction, postMessage, and callback failures', async () => {
    const programId = 'EARTH-FND-003'
    const methodId = getDefaultEarthMethodId(programId)
    const expectedIdentity = {
      schemaVersion: 2,
      programId,
      methodId,
      executionStatus: 'failed',
      id: programId,
      status: 'failed',
    }

    const browserWorker = new FakeWorker()
    const browserExecution = createEarthMethodRunner({ createWorker: () => browserWorker as unknown as Worker })(
      programId,
      methodId,
      {},
    )
    browserWorker.emitError('worker module failed to load')
    await expect(browserExecution).resolves.toEqual({ ...expectedIdentity, error: 'worker module failed to load' })
    expect(browserWorker.terminated).toBe(true)

    const constructionExecution = createEarthMethodRunner({
      createWorker: () => { throw new Error('worker construction failed') },
    })(programId, methodId, {})
    await expect(constructionExecution).resolves.toEqual({ ...expectedIdentity, error: 'worker construction failed' })

    const postWorker = new FakeWorker()
    vi.spyOn(postWorker, 'postMessage').mockImplementation(() => { throw new Error('clone failed') })
    const postExecution = createEarthMethodRunner({ createWorker: () => postWorker as unknown as Worker })(
      programId,
      methodId,
      {},
    )
    await expect(postExecution).resolves.toEqual({ ...expectedIdentity, error: 'clone failed' })
    expect(postWorker.terminated).toBe(true)

    const callbackWorker = new FakeWorker()
    const callbackExecution = createEarthMethodRunner({ createWorker: () => callbackWorker as unknown as Worker })(
      programId,
      methodId,
      {},
      { onProgress: () => { throw new Error('progress callback failed') } },
    )
    await expect(callbackExecution).resolves.toEqual({ ...expectedIdentity, error: 'progress callback failed' })
    expect(callbackWorker.terminated).toBe(true)
  })

  it('ignores responses for a different request ID', async () => {
    const worker = new FakeWorker()
    const programId = 'EARTH-FND-003'
    const methodId = getDefaultEarthMethodId(programId)
    const runner = createEarthMethodRunner({ createWorker: () => worker as unknown as Worker })
    const execution = runner(programId, methodId, {})
    const request = runRequest(worker)
    const result = runEarthMethod(programId, methodId, {})

    worker.emit({ type: 'completed', requestId: 'stale-request', programId, methodId, result })
    expect(worker.terminated).toBe(false)
    worker.emit({ type: 'completed', requestId: request.requestId, programId, methodId, result })

    await expect(execution).resolves.toEqual(result)
  })

  it('generates distinct request IDs and workers for concurrent runs', async () => {
    const firstWorker = new FakeWorker()
    const secondWorker = new FakeWorker()
    const availableWorkers = [firstWorker, secondWorker]
    const runner = createEarthMethodRunner({
      createWorker: () => availableWorkers.shift() as unknown as Worker,
    })
    const programId = 'EARTH-FND-003'
    const methodId = getDefaultEarthMethodId(programId)
    const firstController = new AbortController()
    const secondController = new AbortController()
    const first = runner(programId, methodId, {}, { signal: firstController.signal })
    const second = runner(programId, methodId, {}, { signal: secondController.signal })

    expect(runRequest(firstWorker).requestId).not.toBe(runRequest(secondWorker).requestId)
    firstController.abort()
    secondController.abort()
    await Promise.all([first, second])
    expect(firstWorker.terminated).toBe(true)
    expect(secondWorker.terminated).toBe(true)
  })
})
