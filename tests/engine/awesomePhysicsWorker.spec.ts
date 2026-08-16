import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import { awesomePhysicsAdapterFactoryMap } from '../../src/awesomePhysics/adapterFactories'
import {
  parseAwesomePhysicsWorkerRequest,
  type AwesomePhysicsWorkerRequest,
  type AwesomePhysicsWorkerResponse,
  type AwesomePhysicsWorkerRunRequest,
} from '../../src/awesomePhysics/workers/protocol'
import { runInWorker } from '../../src/awesomePhysics/workers/runInWorker'
import { QMSOLVE_DEFAULT_INPUT } from '../../src/awesomePhysics/adapters/typescript/qmsolve'
import type {
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const descriptor = simulations.items.find((item) => item.catalogItemId === 'awesome-qmsolve')
if (!descriptor || !descriptor.adapterId) throw new Error('Missing generated QMSolve descriptor')

type Listener = (event: Event) => void

class FakeWorker {
  readonly requests: AwesomePhysicsWorkerRequest[] = []
  readonly messageListeners = new Set<Listener>()
  readonly errorListeners = new Set<Listener>()
  terminated = false

  postMessage(message: AwesomePhysicsWorkerRequest): void {
    this.requests.push(message)
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== 'function') return
    if (type === 'message') this.messageListeners.add(listener as Listener)
    if (type === 'error') this.errorListeners.add(listener as Listener)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== 'function') return
    if (type === 'message') this.messageListeners.delete(listener as Listener)
    if (type === 'error') this.errorListeners.delete(listener as Listener)
  }

  terminate(): void {
    this.terminated = true
  }

  emit(response: unknown): void {
    for (const listener of this.messageListeners) listener({ data: response } as MessageEvent<unknown>)
  }

  emitError(message: string): void {
    for (const listener of this.errorListeners) listener({ message } as ErrorEvent)
  }
}

class WorkerScope {
  readonly responses: AwesomePhysicsWorkerResponse[] = []
  private listener?: (event: MessageEvent<unknown>) => void

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === 'message' && typeof listener === 'function') this.listener = listener as (event: MessageEvent<unknown>) => void
  }

  postMessage(response: AwesomePhysicsWorkerResponse): void {
    this.responses.push(response)
  }

  dispatch(request: unknown): void {
    this.listener?.({ data: request } as MessageEvent<unknown>)
  }
}

function request(overrides: Partial<AwesomePhysicsWorkerRunRequest> = {}): AwesomePhysicsWorkerRunRequest {
  return {
    type: 'run',
    requestId: 'awesome-worker-test-1',
    adapterId: descriptor.adapterId,
    descriptor,
    input: QMSOLVE_DEFAULT_INPUT,
    ...overrides,
  }
}

function validResponseContext(runRequest: AwesomePhysicsWorkerRunRequest): {
  requestId: string
  adapterId: string
  descriptor: AwesomePhysicsSimulationDescriptorV1
} {
  return {
    requestId: runRequest.requestId,
    adapterId: runRequest.adapterId,
    descriptor: runRequest.descriptor,
  }
}

describe('Awesome Physics worker execution boundary', () => {
  describe('worker protocol harness', () => {
    const scope = new WorkerScope()

    beforeAll(async () => {
      vi.stubGlobal('self', scope)
      await import('../../src/awesomePhysics/workers/awesomePhysics.worker')
    })

    beforeEach(() => {
      scope.responses.length = 0
    })

    afterAll(() => {
      vi.unstubAllGlobals()
    })

    it('runs only the requested lazy adapter and returns complete provenance', async () => {
      const runRequest = request({ requestId: 'worker-success' })
      scope.dispatch(runRequest)

      await vi.waitFor(() => expect(scope.responses).toHaveLength(2))

      expect(scope.responses[0]).toMatchObject({
        type: 'started',
        requestId: runRequest.requestId,
        adapterId: runRequest.adapterId,
        descriptor: runRequest.descriptor,
        progress: 0,
      })
      expect(scope.responses[1]).toMatchObject({
        type: 'completed',
        requestId: runRequest.requestId,
        adapterId: runRequest.adapterId,
        descriptor: runRequest.descriptor,
        progress: 100,
      })
      expect(scope.responses[1]).toMatchObject({ result: { method: 'central-finite-difference-crank-nicolson' } })
    })

    it('fails closed for unknown adapters and malformed messages', async () => {
      scope.dispatch(request({ requestId: 'unknown-adapter', adapterId: 'not-registered', descriptor: { ...descriptor, adapterId: 'not-registered' } }))
      await vi.waitFor(() => expect(scope.responses).toHaveLength(1))
      expect(scope.responses[0]).toMatchObject({ type: 'failed', requestId: 'unknown-adapter', progress: 0 })

      scope.responses.length = 0
      scope.dispatch({ type: 'run', requestId: 'malformed', adapterId: descriptor.adapterId })
      await vi.waitFor(() => expect(scope.responses).toHaveLength(1))
      expect(scope.responses[0]).toMatchObject({ type: 'failed', requestId: 'malformed', adapterId: descriptor.adapterId })
    })

    it('cancels a request received before execution without invoking a factory', async () => {
      const runRequest = request({ requestId: 'cancel-before-run' })
      scope.dispatch({ type: 'cancel', requestId: runRequest.requestId })
      scope.dispatch(runRequest)

      await vi.waitFor(() => expect(scope.responses).toHaveLength(1))
      expect(scope.responses[0]).toMatchObject({
        type: 'cancelled',
        requestId: runRequest.requestId,
        adapterId: runRequest.adapterId,
        descriptor: runRequest.descriptor,
        progress: 0,
      })
    })
  })

  describe('main-thread runner', () => {
    function runRequestWith(worker: FakeWorker, options: Omit<Parameters<typeof runInWorker>[1], 'createWorker'> = {}) {
      return runInWorker(request(), { ...options, createWorker: () => worker as unknown as Worker })
    }

    it('resolves successful completion and removes listeners before terminating', async () => {
      const worker = new FakeWorker()
      const execution = runRequestWith(worker, { timeoutMs: 1000 })
      const runRequest = worker.requests[0]
      if (!runRequest || runRequest.type !== 'run') throw new Error('Expected a run request')
      const context = validResponseContext(runRequest)
      worker.emit({ type: 'started', ...context, progress: 0 })
      worker.emit({ type: 'completed', ...context, progress: 100, result: { value: 42 } })

      await expect(execution).resolves.toEqual({ value: 42 })
      expect(worker.terminated).toBe(true)
      expect(worker.messageListeners).toHaveLength(0)
      expect(worker.errorListeners).toHaveLength(0)
    })

    it('rejects structured worker failures and cleans up', async () => {
      const worker = new FakeWorker()
      const execution = runRequestWith(worker, { timeoutMs: 1000 })
      const runRequest = worker.requests[0]
      if (!runRequest || runRequest.type !== 'run') throw new Error('Expected a run request')
      worker.emit({
        type: 'failed',
        ...validResponseContext(runRequest),
        progress: 0,
        error: 'input exceeded the declared finite domain',
      })

      await expect(execution).rejects.toThrow('input exceeded the declared finite domain')
      expect(worker.terminated).toBe(true)
      expect(worker.messageListeners).toHaveLength(0)
      expect(worker.errorListeners).toHaveLength(0)
    })

    it('sends cancel and rejects with AbortError when the caller aborts', async () => {
      const worker = new FakeWorker()
      const controller = new AbortController()
      const execution = runRequestWith(worker, { signal: controller.signal, timeoutMs: 1000 })
      const runRequest = worker.requests[0]
      if (!runRequest || runRequest.type !== 'run') throw new Error('Expected a run request')

      controller.abort()

      await expect(execution).rejects.toMatchObject({ name: 'AbortError' })
      expect(worker.requests).toEqual([runRequest, { type: 'cancel', requestId: runRequest.requestId }])
      expect(worker.terminated).toBe(true)
      expect(worker.messageListeners).toHaveLength(0)
      expect(worker.errorListeners).toHaveLength(0)
    })

    it('sends cancel and rejects with AbortError when the bounded timeout expires', async () => {
      vi.useFakeTimers()
      try {
        const worker = new FakeWorker()
        const execution = runRequestWith(worker, { timeoutMs: 25 })
        const runRequest = worker.requests[0]
        if (!runRequest || runRequest.type !== 'run') throw new Error('Expected a run request')

        const rejection = expect(execution).rejects.toMatchObject({ name: 'AbortError' })
        await vi.advanceTimersByTimeAsync(25)

        await rejection
        expect(worker.requests).toEqual([runRequest, { type: 'cancel', requestId: runRequest.requestId }])
        expect(worker.terminated).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })

    it('rejects malformed matching responses and never leaves a pending promise', async () => {
      const worker = new FakeWorker()
      const execution = runRequestWith(worker, { timeoutMs: 1000 })
      const runRequest = worker.requests[0]
      if (!runRequest || runRequest.type !== 'run') throw new Error('Expected a run request')
      worker.emit({ type: 'completed', requestId: runRequest.requestId, adapterId: runRequest.adapterId, progress: 100, result: {} })

      await expect(execution).rejects.toThrow(/Malformed Awesome Physics worker response/)
      expect(worker.terminated).toBe(true)
      expect(worker.messageListeners).toHaveLength(0)
      expect(worker.errorListeners).toHaveLength(0)
    })

    it('does not look up or invoke an adapter on the main thread', async () => {
      const worker = new FakeWorker()
      const factoryLookup = vi.spyOn(awesomePhysicsAdapterFactoryMap, 'get')
      const execution = runRequestWith(worker, { timeoutMs: 1000 })
      const runRequest = worker.requests[0]
      if (!runRequest || runRequest.type !== 'run') throw new Error('Expected a run request')
      worker.emit({ type: 'completed', ...validResponseContext(runRequest), progress: 100, result: { worker: true } })

      await expect(execution).resolves.toEqual({ worker: true })
      expect(factoryLookup).not.toHaveBeenCalled()
      factoryLookup.mockRestore()
    })

    it('rejects malformed run requests before worker construction', async () => {
      const createWorker = vi.fn()
      await expect(runInWorker({ type: 'run', requestId: 'bad-request', adapterId: descriptor.adapterId, descriptor, input: undefined }, { createWorker })).rejects.toThrow(/JSON-safe/)
      expect(createWorker).not.toHaveBeenCalled()
      expect(() => parseAwesomePhysicsWorkerRequest({ type: 'unknown' })).toThrow(/run or cancel/)
    })
  })
})
