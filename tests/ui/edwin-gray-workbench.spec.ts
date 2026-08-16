import { evaluateGrayFullMotor, GRAY_PRESETS } from '../../src/edwin-gray/edwinGrayEngine'
import {
  createGraySnapshot,
  compareGraySnapshots,
  exportGraySnapshot,
  GRAY_SNAPSHOT_MAX_BYTES,
  GRAY_SNAPSHOT_STORAGE_KEY,
  importGraySnapshot,
  loadGraySnapshots,
  loadGraySnapshotsWithRecovery,
  saveGraySnapshot,
} from '../../src/edwin-gray/edwinGrayPersistence'
import {
  defaultGrayWorkbenchInput,
  createGraySubmittedInput,
  freezeGrayFullMotorResult,
  grayFullMotorInput,
  parseGrayWorkbenchQuery,
  serializeGrayWorkbenchInput,
} from '../../src/edwin-gray/edwinGrayWorkbench'
import {
  resetGrayWorker,
  runGrayInWorker,
  type GrayWorkerLike,
  type GrayWorkerRequest,
  type GrayWorkerResponse,
} from '../../src/edwin-gray/edwinGrayWorkerProtocol'
import { GRAY_MACHINE_ARTIFACT } from '../../src/edwin-gray/generated/grayMachines.generated'

class MockGrayWorker implements GrayWorkerLike {
  readonly listeners = new Map<string, Set<EventListener>>()
  terminated = false
  requests: GrayWorkerRequest[] = []

  postMessage(message: GrayWorkerRequest): void {
    this.requests.push(message)
  }

  addEventListener(type: 'message' | 'error', listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: 'message' | 'error', listener: EventListener): void {
    this.listeners.get(type)?.delete(listener)
  }

  terminate(): void {
    this.terminated = true
  }

  send(message: GrayWorkerResponse): void {
    const event = new MessageEvent('message', { data: message })
    for (const listener of this.listeners.get('message') ?? []) listener(event)
  }
}

describe('Edwin Gray canonical workbench state', () => {
  it('round-trips every canonical input through URL query values', () => {
    const input = {
      ...defaultGrayWorkbenchInput('edwin-gray-gold'),
      mode: 'prescribed-diagnostic' as const,
      machineMode: 'modified-electronic-v1' as const,
      revolutions: 4,
      startRpm: 775,
      rotorInertiaKgM2: 0.04,
      loadTorqueNm: 0.2,
      sourceResistanceOhm: 23,
    }

    expect(parseGrayWorkbenchQuery(serializeGrayWorkbenchInput(input))).toEqual(input)
    const calibration = {
      ...defaultGrayWorkbenchInput('patent-3890548-illustrative'),
      magneticModel: 'limited-fem-calibration' as const,
    }
    expect(parseGrayWorkbenchQuery(serializeGrayWorkbenchInput(calibration))).toEqual(calibration)
  })

  it('requires a ready lookup before constructing FEM input and freezes completed output', () => {
    const state = { ...defaultGrayWorkbenchInput('patent-3890548-illustrative'), magneticModel: 'fem-lookup' as const }
    expect(() => grayFullMotorInput(state)).toThrow(/compatible ready FEM lookup/)

    const output = freezeGrayFullMotorResult(evaluateGrayFullMotor({
      ...GRAY_PRESETS.purple,
      revolutions: 1,
      mode: 'dynamic',
      machineMode: 'modified-electronic-v1',
    }))
    expect(Object.isFrozen(output.events)).toBe(true)
    expect(Object.isFrozen(output.ledger)).toBe(true)
  })

  it('rejects invalid and unsupported future URL revisions', () => {
    expect(() => parseGrayWorkbenchQuery({ grayRevision: 'invalid' })).toThrow(/Unsupported Gray workbench input revision/)
    expect(() => parseGrayWorkbenchQuery({ grayRevision: '2' })).toThrow(/supports revision 1/)
  })

  it('captures immutable submitted input identity before later edits', () => {
    const editable = defaultGrayWorkbenchInput()
    const submitted = createGraySubmittedInput(editable)
    editable.revolutions = 2
    expect(submitted.workbenchInput.revolutions).toBe(1)
    expect(createGraySubmittedInput(editable).identity).not.toBe(submitted.identity)
    expect(Object.isFrozen(submitted.engineInput)).toBe(true)
  })

  it('reports progress and resolves the worker result', async () => {
    const worker = new MockGrayWorker()
    const input = grayFullMotorInput(defaultGrayWorkbenchInput())
    const inputIdentity = 'submitted-input-1'
    const progress: number[] = []
    const promise = runGrayInWorker(input, {
      createWorker: () => worker,
      inputIdentity,
      onProgress: (value) => progress.push(value),
    })
    const requestId = (worker.requests[0] as Extract<GrayWorkerRequest, { type: 'run' }>).requestId
    const output = evaluateGrayFullMotor(input)
    worker.send({
      type: 'progress',
      requestId,
      inputIdentity,
      progress: 9 / 27,
      completedEventCount: 9,
      scheduledEventCount: 27,
      stage: 'completed-event-9-of-27',
    })
    worker.send({ type: 'completed', requestId, inputIdentity, progress: 1, result: output })

    await expect(promise).resolves.toEqual(output)
    expect(progress).toEqual([9 / 27])
    expect(worker.terminated).toBe(true)
  })

  it('terminates the dedicated worker on cancellation', async () => {
    const worker = new MockGrayWorker()
    const controller = new AbortController()
    const promise = runGrayInWorker(grayFullMotorInput(defaultGrayWorkbenchInput()), {
      createWorker: () => worker,
      signal: controller.signal,
    })
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(worker.requests).toHaveLength(1)
    expect(worker.requests[0]?.type).toBe('run')
    expect(worker.terminated).toBe(true)
  })

  it('rejects malformed matching responses and terminates the worker', async () => {
    const worker = new MockGrayWorker()
    const promise = runGrayInWorker(grayFullMotorInput(defaultGrayWorkbenchInput()), {
      createWorker: () => worker,
      inputIdentity: 'identity',
    })
    const requestId = (worker.requests[0] as Extract<GrayWorkerRequest, { type: 'run' }>).requestId
    worker.send({
      type: 'progress',
      requestId,
      inputIdentity: 'identity',
      progress: 0.5,
      completedEventCount: 1,
      scheduledEventCount: 27,
      stage: 'fabricated-progress',
    })
    await expect(promise).rejects.toThrow(/Malformed Gray worker response/)
    expect(worker.terminated).toBe(true)
  })

  it('rejects timed-out runs and ignores late responses after settlement', async () => {
    vi.useFakeTimers()
    const timeoutWorker = new MockGrayWorker()
    const timedOut = runGrayInWorker(grayFullMotorInput(defaultGrayWorkbenchInput()), {
      createWorker: () => timeoutWorker,
      timeoutMs: 25,
    })
    const timeoutExpectation = expect(timedOut).rejects.toThrow(/timed out after 25 ms/)
    await vi.advanceTimersByTimeAsync(25)
    await timeoutExpectation

    const lateWorker = new MockGrayWorker()
    const progress = vi.fn()
    const input = grayFullMotorInput(defaultGrayWorkbenchInput())
    const completed = runGrayInWorker(input, {
      createWorker: () => lateWorker,
      inputIdentity: 'late-safe',
      onProgress: progress,
    })
    const requestId = (lateWorker.requests[0] as Extract<GrayWorkerRequest, { type: 'run' }>).requestId
    const output = evaluateGrayFullMotor(input)
    lateWorker.send({ type: 'completed', requestId, inputIdentity: 'late-safe', progress: 1, result: output })
    await expect(completed).resolves.toEqual(output)
    lateWorker.send({
      type: 'progress',
      requestId,
      inputIdentity: 'late-safe',
      progress: 1 / 27,
      completedEventCount: 1,
      scheduledEventCount: 27,
      stage: 'late',
    })
    expect(progress).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('sends reset through a dedicated worker', async () => {
    const worker = new MockGrayWorker()
    const promise = resetGrayWorker(() => worker)
    const request = worker.requests[0] as Extract<GrayWorkerRequest, { type: 'reset' }>
    expect(request.type).toBe('reset')
    worker.send({ type: 'reset', requestId: request.requestId })

    await expect(promise).resolves.toBeUndefined()
    expect(worker.terminated).toBe(true)
  })

  it('saves, validates, imports, and exports revisioned compatible snapshots', () => {
    localStorage.clear()
    const state = defaultGrayWorkbenchInput()
    const output = freezeGrayFullMotorResult(evaluateGrayFullMotor(grayFullMotorInput(state)))
    const snapshot = createGraySnapshot(state, output, '2026-08-16T00:00:00.000Z', 'Purple test')

    saveGraySnapshot(snapshot)
    expect(loadGraySnapshots()).toEqual([snapshot])
    expect(snapshot.modelRevision).toBe('gray-full-motor-v1')
    expect(snapshot.compatibilityKey).toMatch(/^[a-f0-9]{64}$/)
    expect(snapshot.compatibilityKey).toBe(GRAY_MACHINE_ARTIFACT.metadata.modelKey)
    expect(importGraySnapshot(exportGraySnapshot(snapshot))).toEqual(snapshot)
    expect(snapshot.finding.validatesTheory).toBe(false)
  })

  it('limits a 100-revolution worker run to at most 100 intermediate progress events', async () => {
    vi.resetModules()
    let messageListener: ((event: MessageEvent<GrayWorkerRequest>) => void) | undefined
    const postMessage = vi.fn()
    vi.stubGlobal('self', {
      addEventListener(type: string, listener: (event: MessageEvent<GrayWorkerRequest>) => void) {
        if (type === 'message') messageListener = listener
      },
      postMessage,
    })
    await import('../../src/workers/edwinGray.worker')
    const input = { ...grayFullMotorInput(defaultGrayWorkbenchInput()), revolutions: 100 }
    messageListener!({ data: { type: 'run', requestId: 'benchmark', inputIdentity: 'input', input } } as MessageEvent<GrayWorkerRequest>)
    const responses = postMessage.mock.calls.map(([response]) => response as GrayWorkerResponse)
    expect(responses.filter(({ type }) => type === 'progress').length).toBeLessThanOrEqual(100)
    expect(responses.at(-1)).toMatchObject({ type: 'completed', requestId: 'benchmark', progress: 1 })
    vi.unstubAllGlobals()
  })

  it('recovers valid storage entries and reports corrupt entries', () => {
    localStorage.clear()
    const state = defaultGrayWorkbenchInput()
    const output = freezeGrayFullMotorResult(evaluateGrayFullMotor(grayFullMotorInput(state)))
    const snapshot = createGraySnapshot(state, output, '2026-08-16T00:00:00.000Z')
    localStorage.setItem(GRAY_SNAPSHOT_STORAGE_KEY, JSON.stringify([snapshot, { corrupt: true }]))
    expect(loadGraySnapshotsWithRecovery()).toMatchObject({
      snapshots: [snapshot],
      rejectedEntryCount: 1,
    })
  })

  it('surfaces import byte limits and quota failures', () => {
    const state = defaultGrayWorkbenchInput()
    const output = freezeGrayFullMotorResult(evaluateGrayFullMotor(grayFullMotorInput(state)))
    const snapshot = createGraySnapshot(state, output, '2026-08-16T00:00:00.000Z')
    expect(() => importGraySnapshot(`${exportGraySnapshot(snapshot)}${' '.repeat(GRAY_SNAPSHOT_MAX_BYTES)}`))
      .toThrow(/limit/)
    const quotaStorage = {
      getItem: () => null,
      setItem: () => { throw new DOMException('quota', 'QuotaExceededError') },
    } as unknown as Storage
    expect(() => saveGraySnapshot(snapshot, quotaStorage)).toThrow(/browser storage rejected the write/)
  })

  it('shows differences but only computes deltas for matching machine and model revisions', () => {
    const firstState = defaultGrayWorkbenchInput()
    const secondState = { ...firstState, loadTorqueNm: 0.02 }
    const first = createGraySnapshot(firstState, freezeGrayFullMotorResult(evaluateGrayFullMotor(grayFullMotorInput(firstState))), '2026-08-16T00:00:00.000Z')
    const second = createGraySnapshot(secondState, freezeGrayFullMotorResult(evaluateGrayFullMotor(grayFullMotorInput(secondState))), '2026-08-16T00:00:01.000Z')
    const compatible = compareGraySnapshots(first, second)
    expect(compatible.inputDifferences).toContainEqual(expect.objectContaining({ field: 'loadTorqueNm' }))
    expect(compatible.numericalDeltas).not.toBeNull()

    const goldState = defaultGrayWorkbenchInput('edwin-gray-gold')
    const gold = createGraySnapshot(goldState, freezeGrayFullMotorResult(evaluateGrayFullMotor(grayFullMotorInput(goldState))), '2026-08-16T00:00:02.000Z')
    const incompatible = compareGraySnapshots(first, gold)
    expect(incompatible.compatible).toBe(false)
    expect(incompatible.modelDifferences).toContainEqual(expect.objectContaining({ field: 'machineContractId' }))
    expect(incompatible.numericalDeltas).toBeNull()
  })
})
