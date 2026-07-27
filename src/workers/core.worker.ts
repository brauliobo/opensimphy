/// <reference lib="webworker" />

import { evaluateCoreRegistry } from '../engine/core.js'
import type { CoreWorkerMessage, CoreWorkerResponse, WorkerRequestId } from '../types/workers.js'

const worker = self as unknown as DedicatedWorkerGlobalScope
const cancelled = new Set<WorkerRequestId>()

worker.addEventListener('message', (event: MessageEvent<CoreWorkerMessage>) => {
  const message = event.data
  if (message.type === 'cancel') {
    cancelled.add(message.requestId)
    return
  }
  const { requestId } = message
  setTimeout(() => {
    try {
      if (cancelled.delete(requestId)) {
        worker.postMessage({ type: 'cancelled', requestId } satisfies CoreWorkerResponse)
        return
      }
      const result = evaluateCoreRegistry(message.cases)
      if (cancelled.delete(requestId)) worker.postMessage({ type: 'cancelled', requestId } satisfies CoreWorkerResponse)
      else worker.postMessage({ type: 'result', requestId, result } satisfies CoreWorkerResponse)
    } catch (error) {
      cancelled.delete(requestId)
      worker.postMessage({ type: 'error', requestId, error: error instanceof Error ? error.message : String(error) } satisfies CoreWorkerResponse)
    }
  }, 0)
})
