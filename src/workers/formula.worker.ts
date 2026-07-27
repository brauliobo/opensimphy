/// <reference lib="webworker" />

import { evaluateRecipes } from '../engine/recipes.js'
import type { FormulaWorkerMessage, FormulaWorkerResponse, WorkerRequestId } from '../types/workers.js'

const worker = self as unknown as DedicatedWorkerGlobalScope
const cancelled = new Set<WorkerRequestId>()

worker.addEventListener('message', (event: MessageEvent<FormulaWorkerMessage>) => {
  const message = event.data
  if (message.type === 'cancel') {
    cancelled.add(message.requestId)
    return
  }
  const { requestId } = message
  setTimeout(() => {
    try {
      if (cancelled.delete(requestId)) {
        worker.postMessage({ type: 'cancelled', requestId } satisfies FormulaWorkerResponse)
        return
      }
      const result = evaluateRecipes(message.recipes, message.symbols)
      if (cancelled.delete(requestId)) worker.postMessage({ type: 'cancelled', requestId } satisfies FormulaWorkerResponse)
      else worker.postMessage({ type: 'result', requestId, result } satisfies FormulaWorkerResponse)
    } catch (error) {
      cancelled.delete(requestId)
      worker.postMessage({ type: 'error', requestId, error: error instanceof Error ? error.message : String(error) } satisfies FormulaWorkerResponse)
    }
  }, 0)
})
