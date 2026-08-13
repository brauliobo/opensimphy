import type { MicrostripResult, OnelabWorkerRequest, OnelabWorkerResponse, ProjectBootstrap, ProjectEnvelope, ProjectResponse, SimulationAssetManifest } from './types'
import type { SimulationScene } from './scene'
import { terminateWorker, trackWorker } from './diagnostics'

export class OnelabClient {
  private worker = this.createWorker()
  private sequence = 0
  private disposed = false
  private pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void; enteredNative?: (event: Extract<OnelabWorkerResponse, { type: 'entered-native' }>) => void }>()
  private events = new EventTarget()

  private createWorker() {
    const worker = trackWorker(new Worker(new URL('../workers/onelab.worker.ts', import.meta.url), { type: 'module' }))
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
       else if (event.data.type === 'result') pending.resolve(event.data.result)
       else if (event.data.type === 'project-opened') pending.resolve(event.data.project)
       else if (event.data.type === 'project-response') pending.resolve(event.data.response)
       else if (event.data.type === 'scene') pending.resolve(event.data.scene)
       else pending.resolve(event.data.manifest)
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

  openMicrostrip() { return this.request<ProjectBootstrap>({ type: 'open-microstrip' }).promise }

  startProject(envelope: ProjectEnvelope, enteredNative?: (event: Extract<OnelabWorkerResponse, { type: 'entered-native' }>) => void) {
    return this.request<ProjectResponse>({ type: 'project', envelope }, enteredNative)
  }

  getCubeScene() { return this.request<SimulationScene>({ type: 'get-cube-scene' }).promise }

  onEnteredNative(listener: (event: CustomEvent<Extract<OnelabWorkerResponse, { type: 'entered-native' }>>) => void) {
    this.events.addEventListener('entered-native', listener as EventListener)
    return () => this.events.removeEventListener('entered-native', listener as EventListener)
  }

  cancel(requestId: string) {
    if (!this.pending.has(requestId)) return false
    terminateWorker(this.worker)
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
    terminateWorker(this.worker)
    const error = new Error('ONELAB client disposed')
    this.pending.forEach(({ reject }) => reject(error))
    this.pending.clear()
  }
}
