import {
  isAwesomePhysicsWorkerId,
  parseAwesomePhysicsWorkerRequest,
  parseAwesomePhysicsWorkerResponse,
  type AwesomePhysicsWorkerRequest,
  type AwesomePhysicsWorkerResponse,
  type AwesomePhysicsWorkerRunRequest,
} from './protocol'
import { COOLPROP_ADAPTER_ID } from '../adapters/wasm/coolprop'

export interface AwesomePhysicsWorkerLike {
  postMessage(message: AwesomePhysicsWorkerRequest): void
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void
  terminate(): void
}

export type AwesomePhysicsWorkerFactory = () => AwesomePhysicsWorkerLike

export interface RunAwesomePhysicsInWorkerOptions {
  signal?: AbortSignal
  timeoutMs?: number
  fetch?: typeof globalThis.fetch
  basePath?: string
  createWorker?: AwesomePhysicsWorkerFactory
  workerFactory?: AwesomePhysicsWorkerFactory
  onProgress?: (progress: number) => void
}

function abortError(message: string): DOMException {
  return new DOMException(message, 'AbortError')
}

function reasonMessage(reason: unknown): string {
  try {
    return reason instanceof Error ? reason.message : String(reason)
  } catch {
    return 'Unknown Awesome Physics worker failure'
  }
}

function responseDescriptorMatches(request: AwesomePhysicsWorkerRunRequest, response: AwesomePhysicsWorkerResponse): boolean {
  if (response.descriptor === null || response.adapterId !== request.adapterId) return false
  return JSON.stringify(response.descriptor) === JSON.stringify(request.descriptor)
}

function timeoutFor(request: AwesomePhysicsWorkerRunRequest, options: RunAwesomePhysicsInWorkerOptions): number {
  const timeoutMs = options.timeoutMs ?? request.descriptor.limits.maxWorkerTimeMs
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 0) {
    throw new TypeError('Awesome Physics worker timeoutMs must be a non-negative safe integer')
  }
  return timeoutMs
}

function defaultWorkerFactory(): AwesomePhysicsWorkerLike {
  return new Worker(new URL('./awesomePhysics.worker.ts', import.meta.url), { type: 'module' })
}

export function runParsedInWorker<TInput = unknown, TOutput = unknown>(
  request: AwesomePhysicsWorkerRunRequest<TInput>,
  options: RunAwesomePhysicsInWorkerOptions = {},
  fallbackWorkerFactory: AwesomePhysicsWorkerFactory = defaultWorkerFactory,
): Promise<TOutput> {
  const parsedRequest = request as AwesomePhysicsWorkerRunRequest
  let timeoutMs: number
  try {
    timeoutMs = timeoutFor(parsedRequest, options)
  } catch (reason) {
    return Promise.reject(reason instanceof Error ? reason : new TypeError(reasonMessage(reason)))
  }

  if (options.signal?.aborted) return Promise.reject(abortError('The Awesome Physics worker run was aborted'))

  let worker: AwesomePhysicsWorkerLike
  try {
    worker = (options.createWorker ?? options.workerFactory ?? fallbackWorkerFactory)()
  } catch (reason) {
    return Promise.reject(reason instanceof Error ? reason : new Error(reasonMessage(reason)))
  }

  return new Promise<TOutput>((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const onMessage = (event: Event): void => {
      if (settled) return
      const rawMessage = (event as MessageEvent<unknown>).data
      if (typeof rawMessage === 'object' && rawMessage !== null
        && Object.hasOwn(rawMessage, 'requestId')
        && isAwesomePhysicsWorkerId((rawMessage as Record<string, unknown>).requestId)
        && (rawMessage as Record<string, unknown>).requestId !== parsedRequest.requestId) {
        return
      }
      let response: AwesomePhysicsWorkerResponse
      try {
        response = parseAwesomePhysicsWorkerResponse(rawMessage)
        if (response.requestId !== parsedRequest.requestId) return
        if (!responseDescriptorMatches(parsedRequest, response)) {
          throw new TypeError('Response identity or descriptor provenance does not match the request')
        }
      } catch (reason) {
        finishFailure(new TypeError(`Malformed Awesome Physics worker response: ${reasonMessage(reason)}`))
        return
      }

      if (response.type === 'started') {
        try {
          options.onProgress?.(response.progress)
        } catch (reason) {
          finishFailure(reason instanceof Error ? reason : new Error(reasonMessage(reason)))
        }
        return
      }
      if (response.type === 'completed') {
        try {
          options.onProgress?.(response.progress)
        } catch (reason) {
          finishFailure(reason instanceof Error ? reason : new Error(reasonMessage(reason)))
          return
        }
        finishSuccess(response.result as TOutput)
        return
      }
      if (response.type === 'cancelled') {
        finishAbort('The Awesome Physics worker run was cancelled')
        return
      }
      finishFailure(new Error(response.error))
    }

    const onError = (event: Event): void => {
      const message = (event as ErrorEvent).message || 'Awesome Physics worker failed'
      finishFailure(new Error(message))
    }

    const cleanup = (): void => {
      if (timer !== undefined) clearTimeout(timer)
      try {
        options.signal?.removeEventListener('abort', onAbort)
      } catch {
        // Listener cleanup must not prevent worker termination.
      }
      try {
        worker.removeEventListener('message', onMessage)
      } catch {
        // Listener cleanup must not prevent worker termination.
      }
      try {
        worker.removeEventListener('error', onError)
      } catch {
        // Listener cleanup must not prevent worker termination.
      }
      try {
        worker.terminate()
      } catch {
        // Termination is best effort after the promise has been settled.
      }
    }

    const finishSuccess = (result: TOutput): void => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }

    const finishFailure = (reason: unknown): void => {
      if (settled) return
      settled = true
      cleanup()
      reject(reason instanceof Error ? reason : new Error(reasonMessage(reason)))
    }

    const finishAbort = (message: string): void => {
      if (settled) return
      settled = true
      try {
        worker.postMessage({ type: 'cancel', requestId: parsedRequest.requestId })
      } catch {
        // The worker is still terminated below, so cancellation cannot strand it.
      }
      cleanup()
      reject(abortError(message))
    }

    const onAbort = (): void => finishAbort('The Awesome Physics worker run was aborted')
    const onTimeout = (): void => finishAbort('The Awesome Physics worker run timed out')

    try {
      options.signal?.addEventListener('abort', onAbort, { once: true })
      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
      timer = setTimeout(onTimeout, timeoutMs)
      if (options.signal?.aborted) {
        onAbort()
        return
      }
      worker.postMessage(parsedRequest)
    } catch (reason) {
      finishFailure(reason instanceof Error ? reason : new Error(reasonMessage(reason)))
    }
  })
}

export function runInWorker<TInput = unknown, TOutput = unknown>(
  request: AwesomePhysicsWorkerRunRequest<TInput>,
  options: RunAwesomePhysicsInWorkerOptions = {},
): Promise<TOutput> {
  let parsedRequest: AwesomePhysicsWorkerRunRequest
  try {
    const parsed = parseAwesomePhysicsWorkerRequest(request)
    if (parsed.type !== 'run') throw new TypeError('Awesome Physics worker runner requires a run request')
    parsedRequest = parsed
  } catch (reason) {
    return Promise.reject(reason instanceof Error ? reason : new TypeError(reasonMessage(reason)))
  }

  if (parsedRequest.adapterId === COOLPROP_ADAPTER_ID) {
    return import('../wasm/coolpropWorker').then(({ runCoolPropInWorker }) =>
      runCoolPropInWorker(parsedRequest, options) as Promise<TOutput>)
  }
  return runParsedInWorker(parsedRequest, options)
}

export const runAwesomePhysicsInWorker = runInWorker
export const runAwesomePhysicsAdapterInWorker = runInWorker
