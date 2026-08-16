/// <reference lib="webworker" />

import { awesomePhysicsAdapterFactoryMap } from '../adapterFactories'
import type { AwesomePhysicsAdapterV1 } from '../../types/awesomePhysics'
import {
  AWESOME_PHYSICS_WORKER_MAX_ERROR_LENGTH,
  isAwesomePhysicsJsonValue,
  isAwesomePhysicsWorkerId,
  parseAwesomePhysicsWorkerRequest,
  type AwesomePhysicsWorkerFailedResponse,
  type AwesomePhysicsWorkerRequest,
  type AwesomePhysicsWorkerResponse,
  type AwesomePhysicsWorkerRunRequest,
} from './protocol'

const worker = self as unknown as DedicatedWorkerGlobalScope
const activeRequests = new Map<string, AbortController>()
const cancelledBeforeStart = new Map<string, ReturnType<typeof setTimeout>>()

function errorMessage(reason: unknown): string {
  let message: string
  try {
    message = reason instanceof Error ? reason.message : String(reason)
  } catch {
    message = 'Unknown worker failure'
  }
  if (message.trim().length === 0) message = 'Unknown worker failure'
  return message.slice(0, AWESOME_PHYSICS_WORKER_MAX_ERROR_LENGTH)
}

function isAbortError(reason: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (reason instanceof Error && reason.name === 'AbortError')
}

function post(response: AwesomePhysicsWorkerResponse): void {
  worker.postMessage(response)
}

function postFailure(
  requestId: string,
  adapterId: string,
  descriptor: AwesomePhysicsWorkerFailedResponse['descriptor'],
  reason: unknown,
): void {
  const response: AwesomePhysicsWorkerFailedResponse = {
    type: 'failed',
    requestId,
    adapterId,
    descriptor,
    progress: 0,
    error: errorMessage(reason),
  }
  try {
    post(response)
  } catch {
    // A failed structured clone cannot be reported through the same channel.
  }
}

function fallbackRequestContext(value: unknown): { requestId: string; adapterId: string } {
  if (typeof value !== 'object' || value === null) return { requestId: 'invalid-request', adapterId: 'unknown' }
  const record = value as Record<string, unknown>
  return {
    requestId: isAwesomePhysicsWorkerId(record.requestId) ? record.requestId : 'invalid-request',
    adapterId: isAwesomePhysicsWorkerId(record.adapterId) ? record.adapterId : 'unknown',
  }
}

function validateAdapter(value: unknown, request: AwesomePhysicsWorkerRunRequest): AwesomePhysicsAdapterV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Adapter factory must return an object')
  }
  const adapter = value as Record<string, unknown>
  const expectedKeys = ['adapterId', 'protocol', 'compatibility', 'run']
  const unknown = Object.keys(adapter).filter((key) => !expectedKeys.includes(key))
  const missing = expectedKeys.filter((key) => !Object.hasOwn(adapter, key))
  if (unknown.length > 0) throw new TypeError(`Adapter has unknown properties: ${unknown.join(', ')}`)
  if (missing.length > 0) throw new TypeError(`Adapter is missing properties: ${missing.join(', ')}`)
  if (adapter.adapterId !== request.adapterId) throw new TypeError('Adapter adapterId must match the request adapterId')
  if (adapter.protocol !== 'awesome-physics-adapter-v1') throw new TypeError('Adapter protocol is incompatible')
  if (typeof adapter.compatibility !== 'object' || adapter.compatibility === null || Array.isArray(adapter.compatibility)) {
    throw new TypeError('Adapter compatibility must be an object')
  }
  const compatibility = adapter.compatibility as Record<string, unknown>
  const revisionKeys = ['contentRevision', 'modelRevision', 'implementationRevision', 'outputRevision'] as const
  const unknownRevision = Object.keys(compatibility).filter((key) => !revisionKeys.includes(key as typeof revisionKeys[number]))
  const missingRevision = revisionKeys.filter((key) => !Object.hasOwn(compatibility, key))
  if (unknownRevision.length > 0) throw new TypeError(`Adapter compatibility has unknown properties: ${unknownRevision.join(', ')}`)
  if (missingRevision.length > 0) throw new TypeError(`Adapter compatibility is missing properties: ${missingRevision.join(', ')}`)
  for (const key of revisionKeys) {
    if (compatibility[key] !== request.descriptor[key]) {
      throw new TypeError(`Adapter compatibility.${key} must match the descriptor revision`)
    }
  }
  if (typeof adapter.run !== 'function') throw new TypeError('Adapter run must be a function')
  return adapter as AwesomePhysicsAdapterV1
}

async function execute(request: AwesomePhysicsWorkerRunRequest, controller: AbortController): Promise<void> {
  const descriptor = request.descriptor
  try {
    if (controller.signal.aborted) throw new DOMException('The operation was aborted', 'AbortError')
    const factory = awesomePhysicsAdapterFactoryMap.get(request.adapterId)
    if (!factory) throw new Error(`Unknown Awesome Physics adapter ${request.adapterId}`)
    post({
      type: 'started',
      requestId: request.requestId,
      adapterId: request.adapterId,
      descriptor,
      progress: 0,
    })

    const adapter = validateAdapter(await factory(descriptor, controller.signal), request)
    if (controller.signal.aborted) throw new DOMException('The operation was aborted', 'AbortError')
    const result = await adapter.run(request.input, controller.signal)
    if (controller.signal.aborted) throw new DOMException('The operation was aborted', 'AbortError')

    if (!isAwesomePhysicsJsonValue(result)) throw new TypeError('Adapter result must be JSON-safe')
    post({
      type: 'completed',
      requestId: request.requestId,
      adapterId: request.adapterId,
      descriptor,
      progress: 100,
      result,
    })
  } catch (reason) {
    if (isAbortError(reason, controller.signal)) {
      post({
        type: 'cancelled',
        requestId: request.requestId,
        adapterId: request.adapterId,
        descriptor,
        progress: 0,
      })
    } else {
      postFailure(request.requestId, request.adapterId, descriptor, reason)
    }
  } finally {
    activeRequests.delete(request.requestId)
  }
}

function handleCancel(requestId: string): void {
  const controller = activeRequests.get(requestId)
  if (controller) {
    controller.abort()
    return
  }
  const previous = cancelledBeforeStart.get(requestId)
  if (previous !== undefined) clearTimeout(previous)
  const expiry = setTimeout(() => {
    if (cancelledBeforeStart.get(requestId) === expiry) cancelledBeforeStart.delete(requestId)
  }, 0)
  cancelledBeforeStart.set(requestId, expiry)
}

function handleMessage(value: unknown): void {
  let request: AwesomePhysicsWorkerRequest
  try {
    request = parseAwesomePhysicsWorkerRequest(value)
  } catch (reason) {
    const context = fallbackRequestContext(value)
    postFailure(context.requestId, context.adapterId, null, reason)
    return
  }

  if (request.type === 'cancel') {
    handleCancel(request.requestId)
    return
  }
  if (activeRequests.has(request.requestId)) {
    postFailure(request.requestId, request.adapterId, request.descriptor, new Error('Request ID is already active'))
    return
  }
  const pendingCancellation = cancelledBeforeStart.get(request.requestId)
  if (pendingCancellation !== undefined) {
    clearTimeout(pendingCancellation)
    cancelledBeforeStart.delete(request.requestId)
    post({
      type: 'cancelled',
      requestId: request.requestId,
      adapterId: request.adapterId,
      descriptor: request.descriptor,
      progress: 0,
    })
    return
  }

  const controller = new AbortController()
  activeRequests.set(request.requestId, controller)
  void execute(request, controller)
}

worker.addEventListener('message', (event: MessageEvent<unknown>) => {
  handleMessage(event.data)
})
