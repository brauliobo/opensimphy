import type { MicrostripResult, OnelabWorkerRequest, OnelabWorkerResponse, SimulationAssetManifest } from './types'

export class OnelabClient {
  private worker = this.createWorker()
  private sequence = 0
  private disposed = false
  private pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void; enteredNative?: (event: Extract<OnelabWorkerResponse, { type: 'entered-native' }>) => void }>()
  private events = new EventTarget()

  private createWorker() {
    const worker = new Worker(new URL('../workers/onelab.worker.ts', import.meta.url), { type: 'module' })
    worker.addEventListener('message', (event: MessageEvent<OnelabWorkerResponse>) => {
      const pending = this.pending.get(event.data.requestId)
      if (!pending) return
      if (event.data.type === 'entered-native') {
        pending.enteredNative?.(event.data)
        this.events.dispatchEvent(new CustomEvent('entered-native', { detail: event.data }))
        return
      }
      this.pending.delete(event.data.requestId)
      if (event.data.type === 'error') pending.reject(new Error(event.data.error))
      else pending.resolve(event.data.type === 'result' ? event.data.result : event.data.manifest)
    })
    worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'ONELAB worker failed')
      this.pending.forEach(({ reject }) => reject(error))
      this.pending.clear()
    })
    return worker
  }

  private request<T>(message: Omit<OnelabWorkerRequest, 'requestId'>, enteredNative?: (event: Extract<OnelabWorkerResponse, { type: 'entered-native' }>) => void) {
    const requestId = String(++this.sequence)
    if (this.disposed) return { requestId, promise: Promise.reject<T>(new Error('ONELAB client is disposed')) }
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject, enteredNative })
      this.worker.postMessage({ ...message, requestId })
    })
    return { requestId, promise }
  }

  warm() { return this.request<SimulationAssetManifest>({ type: 'warm' }).promise }

  startMicrostrip(enteredNative?: (event: Extract<OnelabWorkerResponse, { type: 'entered-native' }>) => void) {
    return this.request<MicrostripResult>({ type: 'run-microstrip' }, enteredNative)
  }

  onEnteredNative(listener: (event: CustomEvent<Extract<OnelabWorkerResponse, { type: 'entered-native' }>>) => void) {
    this.events.addEventListener('entered-native', listener as EventListener)
    return () => this.events.removeEventListener('entered-native', listener as EventListener)
  }

  cancel(requestId: string) {
    if (!this.pending.has(requestId)) return false
    this.worker.terminate()
    this.pending.forEach(({ reject }, pendingRequestId) => {
      const message = pendingRequestId === requestId
        ? `Simulation request ${requestId} cancelled by worker termination`
        : `Simulation request ${pendingRequestId} failed because the ONELAB worker restarted`
      reject(new Error(message))
    })
    this.pending.clear()
    this.worker = this.createWorker()
    return true
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.worker.terminate()
    const error = new Error('ONELAB client disposed')
    this.pending.forEach(({ reject }) => reject(error))
    this.pending.clear()
  }
}
