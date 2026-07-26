import { getDefaultEarthMethodId } from '../../src/engine/earth'
import type { EarthWorkerRequest, EarthWorkerResponse } from '../../src/types/earthWorkers'

class FakeWorkerScope {
  readonly responses: EarthWorkerResponse[] = []
  private listener?: (event: MessageEvent<EarthWorkerRequest>) => void

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === 'message' && typeof listener === 'function') {
      this.listener = listener as (event: MessageEvent<EarthWorkerRequest>) => void
    }
  }

  postMessage(response: EarthWorkerResponse): void {
    this.responses.push(response)
  }

  dispatch(request: EarthWorkerRequest): void {
    this.listener?.({ data: request } as MessageEvent<EarthWorkerRequest>)
  }
}

describe('EARTH simulation worker', () => {
  const scope = new FakeWorkerScope()

  beforeAll(async () => {
    vi.stubGlobal('self', scope)
    await import('../../src/workers/earthSimulation.worker')
  })

  beforeEach(() => {
    scope.responses.length = 0
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('dispatches a method-addressed run and returns its identity', async () => {
    const programId = 'EARTH-FND-003'
    const methodId = getDefaultEarthMethodId(programId)
    scope.dispatch({ type: 'run', requestId: 'success', programId, methodId, inputs: {} })

    await vi.waitFor(() => expect(scope.responses).toHaveLength(2))

    expect(scope.responses[0]).toEqual({ type: 'progress', requestId: 'success', programId, methodId, progress: 20 })
    expect(scope.responses[1]).toMatchObject({
      type: 'completed',
      requestId: 'success',
      programId,
      methodId,
      result: { programId, methodId, status: 'completed' },
    })
  })

  it('returns method-addressed failures for unsupported methods', async () => {
    const programId = 'EARTH-FND-003'
    const methodId = 'traditional-analytic-baseline-v1'
    scope.dispatch({ type: 'run', requestId: 'unsupported', programId, methodId, inputs: {} })

    await vi.waitFor(() => expect(scope.responses).toHaveLength(2))

    expect(scope.responses[1]).toEqual({
      type: 'failed',
      requestId: 'unsupported',
      programId,
      methodId,
      error: `Unsupported EARTH method ID ${methodId} for program ${programId}`,
    })
  })

  it('retains method identity when cancellation arrives before execution', async () => {
    const programId = 'EARTH-FLD-005'
    const methodId = getDefaultEarthMethodId(programId)
    scope.dispatch({ type: 'cancel', requestId: 'cancelled' })
    scope.dispatch({ type: 'run', requestId: 'cancelled', programId, methodId, inputs: {} })

    await vi.waitFor(() => expect(scope.responses).toHaveLength(1))

    expect(scope.responses[0]).toEqual({ type: 'cancelled', requestId: 'cancelled', programId, methodId })
  })
})
