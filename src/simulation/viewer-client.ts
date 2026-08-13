import type { SimulationScene } from './scene'
import { terminateWorker, trackWorker } from './diagnostics'

export class MeshstepClient {
  private worker = trackWorker(new Worker(new URL('../workers/meshstep.worker.ts', import.meta.url), { type: 'module' }))
  private sequence = 0
  private disposed = false
  private pending = new Map<string, { resolve: (scene: SimulationScene) => void; reject: (error: Error) => void }>()

  constructor() {
    this.worker.addEventListener('message', (event: MessageEvent<{ type: 'result' | 'error'; requestId: string; scene?: SimulationScene; error?: string }>) => {
      const pending = this.pending.get(event.data.requestId)
      if (!pending) return
      this.pending.delete(event.data.requestId)
      if (event.data.type === 'result' && event.data.scene) pending.resolve(event.data.scene)
      else pending.reject(new Error(event.data.error ?? 'meshStep conversion failed'))
    })
    this.worker.addEventListener('error', (event) => this.fail(new Error(event.message || 'meshStep worker failed')))
    this.worker.addEventListener('messageerror', () => this.fail(new Error('meshStep worker response could not be decoded')))
  }

  convertCube() {
    if (this.disposed) return Promise.reject<SimulationScene>(new Error('meshStep client is disposed'))
    const requestId = String(++this.sequence)
    return new Promise<SimulationScene>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.worker.postMessage({ type: 'convert-cube', requestId })
    })
  }

  private rejectPending(error: Error) {
    this.pending.forEach(({ reject }) => reject(error))
    this.pending.clear()
  }

  private fail(error: Error) {
    this.disposed = true
    this.rejectPending(error)
    terminateWorker(this.worker)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.rejectPending(new Error('meshStep client disposed during conversion'))
    terminateWorker(this.worker)
  }
}
