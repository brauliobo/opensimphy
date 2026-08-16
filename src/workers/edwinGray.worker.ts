/// <reference lib="webworker" />

import { evaluateGrayFullMotor } from '../edwin-gray/edwinGrayEngine'
import type { GrayWorkerRequest, GrayWorkerResponse } from '../edwin-gray/edwinGrayWorkerProtocol'

const scope = self as DedicatedWorkerGlobalScope
const cancelled = new Set<string>()

function send(message: GrayWorkerResponse): void {
  scope.postMessage(message)
}

scope.addEventListener('message', (event: MessageEvent<GrayWorkerRequest>) => {
  const request = event.data
  if (request.type === 'cancel') {
    cancelled.add(request.requestId)
    send({ type: 'cancelled', requestId: request.requestId })
    return
  }
  if (request.type === 'reset') {
    cancelled.clear()
    send({ type: 'reset', requestId: request.requestId })
    return
  }

  try {
    send({ type: 'progress', requestId: request.requestId, progress: 0.1, stage: 'validating-input' })
    if (cancelled.delete(request.requestId)) return
    send({ type: 'progress', requestId: request.requestId, progress: 0.35, stage: 'evaluating-event-train' })
    const result = evaluateGrayFullMotor(request.input)
    if (cancelled.delete(request.requestId)) return
    send({ type: 'progress', requestId: request.requestId, progress: 0.9, stage: 'closing-energy-ledger' })
    send({ type: 'completed', requestId: request.requestId, progress: 1, result })
  } catch (reason) {
    send({
      type: 'failed',
      requestId: request.requestId,
      error: reason instanceof Error ? reason.message : String(reason),
    })
  }
})
