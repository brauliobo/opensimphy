import type { GrayFullMotorInput, GrayFullMotorResult } from './edwinGrayEngine'

export type GrayWorkerRequest =
  | { type: 'run'; requestId: string; input: GrayFullMotorInput }
  | { type: 'cancel'; requestId: string }
  | { type: 'reset'; requestId: string }

export type GrayWorkerResponse =
  | { type: 'progress'; requestId: string; progress: number; stage: string }
  | { type: 'completed'; requestId: string; progress: 1; result: GrayFullMotorResult }
  | { type: 'cancelled'; requestId: string }
  | { type: 'reset'; requestId: string }
  | { type: 'failed'; requestId: string; error: string }

export interface GrayWorkerLike {
  postMessage(message: GrayWorkerRequest): void
  addEventListener(type: 'message' | 'error', listener: EventListener): void
  removeEventListener(type: 'message' | 'error', listener: EventListener): void
  terminate(): void
}

export type GrayWorkerFactory = () => GrayWorkerLike

export function createGrayWorker(): GrayWorkerLike {
  return new Worker(new URL('../workers/edwinGray.worker.ts', import.meta.url), { type: 'module' })
}

export interface GrayWorkerRunOptions {
  signal?: AbortSignal
  onProgress?: (progress: number, stage: string) => void
  createWorker?: GrayWorkerFactory
}

export function runGrayInWorker(
  input: GrayFullMotorInput,
  options: GrayWorkerRunOptions = {},
): Promise<GrayFullMotorResult> {
  if (options.signal?.aborted) return Promise.reject(new DOMException('Gray run cancelled', 'AbortError'))
  const requestId = `gray-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const worker = (options.createWorker ?? createGrayWorker)()
  return new Promise((resolve, reject) => {
    let settled = false
    const cleanup = (): void => {
      options.signal?.removeEventListener('abort', onAbort)
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      worker.terminate()
    }
    const settle = (action: () => void): void => {
      if (settled) return
      settled = true
      cleanup()
      action()
    }
    const onAbort = (): void => {
      try {
        worker.postMessage({ type: 'cancel', requestId })
      } finally {
        settle(() => reject(new DOMException('Gray run cancelled', 'AbortError')))
      }
    }
    const onMessage = (event: Event): void => {
      const message = (event as MessageEvent<GrayWorkerResponse>).data
      if (!message || message.requestId !== requestId) return
      if (message.type === 'progress') {
        options.onProgress?.(message.progress, message.stage)
      } else if (message.type === 'completed') {
        settle(() => resolve(message.result))
      } else if (message.type === 'failed') {
        settle(() => reject(new Error(message.error)))
      } else if (message.type === 'cancelled') {
        settle(() => reject(new DOMException('Gray run cancelled', 'AbortError')))
      }
    }
    const onError = (event: Event): void => {
      settle(() => reject(new Error((event as ErrorEvent).message || 'Gray worker failed')))
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage({ type: 'run', requestId, input })
  })
}

export function resetGrayWorker(createWorker: GrayWorkerFactory = createGrayWorker): Promise<void> {
  const requestId = `gray-reset-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const worker = createWorker()
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      worker.terminate()
    }
    const onMessage = (event: Event): void => {
      const message = (event as MessageEvent<GrayWorkerResponse>).data
      if (message?.type !== 'reset' || message.requestId !== requestId) return
      cleanup()
      resolve()
    }
    const onError = (event: Event): void => {
      cleanup()
      reject(new Error((event as ErrorEvent).message || 'Gray worker reset failed'))
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage({ type: 'reset', requestId })
  })
}
