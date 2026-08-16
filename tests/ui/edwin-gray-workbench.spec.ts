import { evaluateGrayFullMotor, GRAY_PRESETS } from '../../src/edwin-gray/edwinGrayEngine'
import {
  createGraySnapshot,
  exportGraySnapshot,
  importGraySnapshot,
  loadGraySnapshots,
  saveGraySnapshot,
} from '../../src/edwin-gray/edwinGrayPersistence'
import {
  defaultGrayWorkbenchInput,
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

  it('reports progress and resolves the worker result', async () => {
    const worker = new MockGrayWorker()
    const input = grayFullMotorInput(defaultGrayWorkbenchInput())
    const progress: number[] = []
    const promise = runGrayInWorker(input, {
      createWorker: () => worker,
      onProgress: (value) => progress.push(value),
    })
    const requestId = (worker.requests[0] as Extract<GrayWorkerRequest, { type: 'run' }>).requestId
    const output = evaluateGrayFullMotor(input)
    worker.send({ type: 'progress', requestId, progress: 0.35, stage: 'evaluating-event-train' })
    worker.send({ type: 'completed', requestId, progress: 1, result: output })

    await expect(promise).resolves.toEqual(output)
    expect(progress).toEqual([0.35])
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
    expect(worker.requests.at(-1)?.type).toBe('cancel')
    expect(worker.terminated).toBe(true)
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
    expect(importGraySnapshot(exportGraySnapshot(snapshot))).toEqual(snapshot)
    expect(snapshot.finding.validatesTheory).toBe(false)
  })
})
