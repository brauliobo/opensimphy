/// <reference lib="webworker" />

import { evaluateGrayFullMotor } from '../edwin-gray/edwinGrayEngine'
import type { GrayWorkerRequest, GrayWorkerResponse } from '../edwin-gray/edwinGrayWorkerProtocol'

const scope = self as DedicatedWorkerGlobalScope

function send(message: GrayWorkerResponse): void {
  scope.postMessage(message)
}

scope.addEventListener('message', (event: MessageEvent<GrayWorkerRequest>) => {
  const request = event.data
  if (request.type === 'reset') {
    send({ type: 'reset', requestId: request.requestId })
    return
  }

  try {
    const result = evaluateGrayFullMotor(request.input, {
      onEventCompleted(completedEventCount, scheduledEventCount) {
        if (completedEventCount === scheduledEventCount) return
        send({
          type: 'progress',
          requestId: request.requestId,
          inputIdentity: request.inputIdentity,
          progress: completedEventCount / scheduledEventCount,
          completedEventCount,
          scheduledEventCount,
          stage: `completed-event-${completedEventCount}-of-${scheduledEventCount}`,
        })
      },
    })
    send({
      type: 'completed',
      requestId: request.requestId,
      inputIdentity: request.inputIdentity,
      progress: 1,
      result,
    })
  } catch (reason) {
    send({
      type: 'failed',
      requestId: request.requestId,
      inputIdentity: request.inputIdentity,
      error: reason instanceof Error ? reason.message : String(reason),
    })
  }
})
