export interface SceneDiagnostics {
  hosts: number
  workers: number
  frames: number
  observers: number
  canvases: number
  overlays: number
  contexts: number
  geometries: number
  materials: number
}

declare global {
  interface Window { __sceneDiagnostics?: SceneDiagnostics }
}

export function diagnostics() {
  if (typeof window === 'undefined') return { hosts: 0, workers: 0, frames: 0, observers: 0, canvases: 0, overlays: 0, contexts: 0, geometries: 0, materials: 0 }
  return window.__sceneDiagnostics ??= { hosts: 0, workers: 0, frames: 0, observers: 0, canvases: 0, overlays: 0, contexts: 0, geometries: 0, materials: 0 }
}

export function trackWorker<T extends Worker>(worker: T): T {
  diagnostics().workers++
  return worker
}

const terminatedWorkers = new WeakSet<Worker>()

export function terminateWorker(worker: Worker) {
  if (!terminatedWorkers.has(worker)) {
    terminatedWorkers.add(worker)
    diagnostics().workers--
    worker.terminate()
  }
}
