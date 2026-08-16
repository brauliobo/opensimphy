import type { GrayFullMotorInput, GrayFullMotorResult } from './edwinGrayEngine'

export type GrayWorkerRequest =
  | { type: 'run'; requestId: string; inputIdentity: string; input: GrayFullMotorInput }
  | { type: 'reset'; requestId: string }

export type GrayWorkerResponse =
  | { type: 'progress'; requestId: string; inputIdentity: string; progress: number; completedEventCount: number; scheduledEventCount: number; stage: string }
  | { type: 'completed'; requestId: string; inputIdentity: string; progress: 1; result: GrayFullMotorResult }
  | { type: 'reset'; requestId: string }
  | { type: 'failed'; requestId: string; inputIdentity: string; error: string }

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
  inputIdentity?: string
  timeoutMs?: number
}

export const GRAY_WORKER_TIMEOUT_MS = 30_000

function malformed(message: string): Error {
  return new TypeError(`Malformed Gray worker response: ${message}`)
}

function resultMatchesSubmittedInput(result: GrayFullMotorResult, input: GrayFullMotorInput): boolean {
  return result.input.motorId === input.motorId
    && result.input.machineContractId === (input.machineContractId ?? `edwin-gray-${input.motorId}`)
    && result.input.revolutions === input.revolutions
    && result.input.turns === input.turns
    && result.input.mode === input.mode
    && result.input.machineMode === input.machineMode
    && Array.isArray(result.events)
    && result.events.length === result.completedEventCount
    && result.completedEventCount <= result.scheduledEventCount
}

export function runGrayInWorker(
  input: GrayFullMotorInput,
  options: GrayWorkerRunOptions = {},
): Promise<GrayFullMotorResult> {
  if (options.signal?.aborted) return Promise.reject(new DOMException('Gray run cancelled', 'AbortError'))
  const requestId = `gray-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const inputIdentity = options.inputIdentity ?? JSON.stringify(input)
  const timeoutMs = options.timeoutMs ?? GRAY_WORKER_TIMEOUT_MS
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return Promise.reject(new RangeError('Gray worker timeout must be positive'))
  const worker = (options.createWorker ?? createGrayWorker)()
  return new Promise((resolve, reject) => {
    let settled = false
    let lastProgress = 0
    const timeout = setTimeout(() => {
      settle(() => reject(new Error(`Gray worker timed out after ${timeoutMs} ms`)))
    }, timeoutMs)
    const cleanup = (): void => {
      clearTimeout(timeout)
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
      settle(() => reject(new DOMException('Gray run cancelled', 'AbortError')))
    }
    const onMessage = (event: Event): void => {
      const message = (event as MessageEvent<GrayWorkerResponse>).data
      if (!message || typeof message !== 'object') return
      if (message.requestId !== requestId) return
      if (message.type === 'progress') {
        if (message.inputIdentity !== inputIdentity
          || !Number.isInteger(message.completedEventCount)
          || !Number.isInteger(message.scheduledEventCount)
          || message.completedEventCount < 1
          || message.completedEventCount > message.scheduledEventCount
          || message.progress !== message.completedEventCount / message.scheduledEventCount
          || message.progress <= lastProgress
          || message.progress >= 1
          || typeof message.stage !== 'string') {
          settle(() => reject(malformed('invalid event progress')))
          return
        }
        lastProgress = message.progress
        options.onProgress?.(message.progress, message.stage)
      } else if (message.type === 'completed') {
        if (message.inputIdentity !== inputIdentity || message.progress !== 1
          || !message.result || typeof message.result !== 'object'
          || !Number.isInteger(message.result.completedEventCount)
          || !Number.isInteger(message.result.scheduledEventCount)
          || !resultMatchesSubmittedInput(message.result, input)) {
          settle(() => reject(malformed('invalid completed result')))
          return
        }
        settle(() => resolve(message.result))
      } else if (message.type === 'failed') {
        if (message.inputIdentity !== inputIdentity || typeof message.error !== 'string') {
          settle(() => reject(malformed('invalid failure')))
          return
        }
        settle(() => reject(new Error(message.error)))
      } else {
        settle(() => reject(malformed('unexpected response type')))
      }
    }
    const onError = (event: Event): void => {
      settle(() => reject(new Error((event as ErrorEvent).message || 'Gray worker failed')))
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage({ type: 'run', requestId, inputIdentity, input })
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
