import type { AwesomePhysicsSimulationDescriptorV1 } from '../../types/awesomePhysics'

export const AWESOME_PHYSICS_WORKER_PROTOCOL_V1 = 'awesome-physics-worker-v1' as const
export const AWESOME_PHYSICS_WORKER_MAX_ERROR_LENGTH = 2_048
export const AWESOME_PHYSICS_WORKER_MAX_ID_LENGTH = 128
export const AWESOME_PHYSICS_WORKER_MAX_JSON_DEPTH = 64

export type AwesomePhysicsJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly AwesomePhysicsJsonValue[]
  | { readonly [key: string]: AwesomePhysicsJsonValue }

export type AwesomePhysicsWorkerRequestId = string
export type AwesomePhysicsWorkerProgress = number

export interface AwesomePhysicsWorkerRunRequest<TInput = AwesomePhysicsJsonValue> {
  type: 'run'
  requestId: AwesomePhysicsWorkerRequestId
  adapterId: string
  descriptor: AwesomePhysicsSimulationDescriptorV1
  input: TInput
}

export interface AwesomePhysicsWorkerCancelRequest {
  type: 'cancel'
  requestId: AwesomePhysicsWorkerRequestId
}

export type AwesomePhysicsWorkerRequest<TInput = AwesomePhysicsJsonValue> =
  | AwesomePhysicsWorkerRunRequest<TInput>
  | AwesomePhysicsWorkerCancelRequest

export interface AwesomePhysicsWorkerResponseContext {
  requestId: AwesomePhysicsWorkerRequestId
  adapterId: string
  descriptor: AwesomePhysicsSimulationDescriptorV1 | null
}

export interface AwesomePhysicsWorkerStartedResponse extends AwesomePhysicsWorkerResponseContext {
  type: 'started'
  progress: AwesomePhysicsWorkerProgress
}

export interface AwesomePhysicsWorkerCompletedResponse<TOutput = AwesomePhysicsJsonValue>
  extends AwesomePhysicsWorkerResponseContext {
  type: 'completed'
  progress: AwesomePhysicsWorkerProgress
  result: TOutput
}

export interface AwesomePhysicsWorkerFailedResponse extends AwesomePhysicsWorkerResponseContext {
  type: 'failed'
  progress: AwesomePhysicsWorkerProgress
  error: string
}

export interface AwesomePhysicsWorkerCancelledResponse extends AwesomePhysicsWorkerResponseContext {
  type: 'cancelled'
  progress: AwesomePhysicsWorkerProgress
}

export type AwesomePhysicsWorkerResponse<TOutput = AwesomePhysicsJsonValue> =
  | AwesomePhysicsWorkerStartedResponse
  | AwesomePhysicsWorkerCompletedResponse<TOutput>
  | AwesomePhysicsWorkerFailedResponse
  | AwesomePhysicsWorkerCancelledResponse

type UnknownRecord = Record<string, unknown>

const EXECUTION_KINDS = ['browser', 'wasm', 'wasm-candidate', 'typescript', 'artifact', 'reference', 'blocked'] as const
const CAPABILITIES = ['catalog-entry', 'archive-reference'] as const
const AVAILABILITIES = ['available', 'unavailable', 'blocked'] as const
const PRIORITIES = ['P0', 'P1', 'P2', 'P3'] as const
const MODEL_ORIGINS = ['upstream-adaptation', 'educational-reimplementation', 'source-artifact', 'reference-only'] as const
const LICENSE_GATES = ['pass', 'review', 'blocked'] as const
const DESCRIPTOR_KEYS = [
  'id',
  'catalogItemId',
  'title',
  'capability',
  'execution',
  'executionOptions',
  'availability',
  'runnable',
  'priority',
  'modelOrigin',
  'adapterId',
  'numericalMethod',
  'inputSchema',
  'outputSchema',
  'sourceRevision',
  'implementationRevision',
  'licenseGate',
  'availabilityReason',
  'planDisposition',
  'limits',
  'artifactProvenance',
  'evidenceRefs',
  'compatibilityRevision',
  'modelRevision',
  'contentRevision',
  'outputRevision',
] as const
const LIMIT_KEYS = ['maxGridSize', 'maxParticles', 'maxIterations', 'maxMemoryBytes', 'maxWorkerTimeMs', 'maxOutputBytes'] as const
const ARTIFACT_PROVENANCE_KEYS = [
  'sourceRevision',
  'acquisitionDate',
  'byteSize',
  'sha256',
  'transformation',
  'datasetLicense',
  'evidenceRefs',
] as const

function isRecord(value: unknown): value is UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function fail(path: string, message: string): never {
  throw new TypeError(`${path} ${message}`)
}

function requireRecord(value: unknown, path: string): UnknownRecord {
  if (!isRecord(value)) fail(path, 'must be a plain object')
  return value
}

function requireExactKeys(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): UnknownRecord {
  const object = requireRecord(value, path)
  const allowed = new Set([...required, ...optional])
  const unknown = Object.keys(object).filter((key) => !allowed.has(key))
  const missing = required.filter((key) => !Object.hasOwn(object, key))
  if (unknown.length > 0) fail(path, `has unknown properties: ${unknown.join(', ')}`)
  if (missing.length > 0) fail(path, `is missing properties: ${missing.join(', ')}`)
  return object
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'must be a non-empty string')
  return value
}

function requireNullableString(value: unknown, path: string): string | null {
  if (value === null) return null
  return requireNonEmptyString(value, path)
}

function requireSafeId(value: unknown, path: string): string {
  const id = requireNonEmptyString(value, path)
  if (id.length > AWESOME_PHYSICS_WORKER_MAX_ID_LENGTH || !/^[A-Za-z0-9_-]+$/.test(id)) {
    fail(path, `must be an ASCII ID of at most ${AWESOME_PHYSICS_WORKER_MAX_ID_LENGTH} characters`)
  }
  return id
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'must be a boolean')
  return value
}

function requireFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
  return value
}

function requireSafeInteger(value: unknown, path: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    fail(path, `must be a safe integer greater than or equal to ${minimum}`)
  }
  return value
}

function requireProgress(value: unknown, path: string): AwesomePhysicsWorkerProgress {
  const progress = requireFiniteNumber(value, path)
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) fail(path, 'must be an integer between 0 and 100')
  return progress
}

function requireOneOf<T extends string>(value: unknown, values: readonly T[], path: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) fail(path, 'has an unsupported value')
  return value as T
}

function requireStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) fail(path, 'must be an array')
  return value.map((entry, index) => requireNonEmptyString(entry, `${path}[${index}]`))
}

function requireJsonValue(value: unknown, path: string): asserts value is AwesomePhysicsJsonValue {
  if (!isAwesomePhysicsJsonValue(value)) fail(path, 'must be JSON-safe')
}

function parseDescriptor(value: unknown, path: string): AwesomePhysicsSimulationDescriptorV1 {
  const descriptor = requireExactKeys(value, DESCRIPTOR_KEYS.filter((key) => key !== 'adapterId'), ['adapterId'], path)
  requireSafeId(descriptor.id, `${path}.id`)
  requireSafeId(descriptor.catalogItemId, `${path}.catalogItemId`)
  requireNonEmptyString(descriptor.title, `${path}.title`)
  requireOneOf(descriptor.capability, CAPABILITIES, `${path}.capability`)
  requireOneOf(descriptor.execution, EXECUTION_KINDS, `${path}.execution`)
  if (!Array.isArray(descriptor.executionOptions) || descriptor.executionOptions.length === 0) {
    fail(`${path}.executionOptions`, 'must be a non-empty array')
  }
  descriptor.executionOptions.forEach((entry, index) => requireOneOf(entry, EXECUTION_KINDS, `${path}.executionOptions[${index}]`))
  requireOneOf(descriptor.availability, AVAILABILITIES, `${path}.availability`)
  requireBoolean(descriptor.runnable, `${path}.runnable`)
  requireOneOf(descriptor.priority, PRIORITIES, `${path}.priority`)
  requireOneOf(descriptor.modelOrigin, MODEL_ORIGINS, `${path}.modelOrigin`)
  if (Object.hasOwn(descriptor, 'adapterId')) requireSafeId(descriptor.adapterId, `${path}.adapterId`)
  requireNullableString(descriptor.numericalMethod, `${path}.numericalMethod`)
  requireNullableString(descriptor.inputSchema, `${path}.inputSchema`)
  requireNullableString(descriptor.outputSchema, `${path}.outputSchema`)
  requireNullableString(descriptor.sourceRevision, `${path}.sourceRevision`)
  requireNonEmptyString(descriptor.implementationRevision, `${path}.implementationRevision`)
  requireOneOf(descriptor.licenseGate, LICENSE_GATES, `${path}.licenseGate`)
  requireNonEmptyString(descriptor.availabilityReason, `${path}.availabilityReason`)
  requireNonEmptyString(descriptor.planDisposition, `${path}.planDisposition`)

  const limits = requireExactKeys(descriptor.limits, LIMIT_KEYS, [], `${path}.limits`)
  LIMIT_KEYS.forEach((key) => requireSafeInteger(limits[key], `${path}.limits.${key}`))

  const provenance = requireExactKeys(descriptor.artifactProvenance, ARTIFACT_PROVENANCE_KEYS, [], `${path}.artifactProvenance`)
  requireNullableString(provenance.sourceRevision, `${path}.artifactProvenance.sourceRevision`)
  requireNonEmptyString(provenance.acquisitionDate, `${path}.artifactProvenance.acquisitionDate`)
  if (provenance.byteSize !== null) requireSafeInteger(provenance.byteSize, `${path}.artifactProvenance.byteSize`)
  requireNullableString(provenance.sha256, `${path}.artifactProvenance.sha256`)
  requireNonEmptyString(provenance.transformation, `${path}.artifactProvenance.transformation`)
  requireNullableString(provenance.datasetLicense, `${path}.artifactProvenance.datasetLicense`)
  requireStringArray(provenance.evidenceRefs, `${path}.artifactProvenance.evidenceRefs`)
  requireStringArray(descriptor.evidenceRefs, `${path}.evidenceRefs`)
  requireNonEmptyString(descriptor.compatibilityRevision, `${path}.compatibilityRevision`)
  requireNonEmptyString(descriptor.modelRevision, `${path}.modelRevision`)
  requireNonEmptyString(descriptor.contentRevision, `${path}.contentRevision`)
  requireNonEmptyString(descriptor.outputRevision, `${path}.outputRevision`)
  requireJsonValue(descriptor, path)
  return descriptor as AwesomePhysicsSimulationDescriptorV1
}

function parseResponseDescriptor(value: unknown, path: string): AwesomePhysicsSimulationDescriptorV1 | null {
  return value === null ? null : parseDescriptor(value, path)
}

function parseResponseContext(value: UnknownRecord, path: string): AwesomePhysicsWorkerResponseContext {
  return {
    requestId: requireSafeId(value.requestId, `${path}.requestId`),
    adapterId: requireSafeId(value.adapterId, `${path}.adapterId`),
    descriptor: parseResponseDescriptor(value.descriptor, `${path}.descriptor`),
  }
}

function requireResponseDescriptorMatch(
  context: AwesomePhysicsWorkerResponseContext,
  path: string,
): void {
  if (context.descriptor !== null && context.descriptor.adapterId !== undefined
    && context.descriptor.adapterId !== context.adapterId) {
    fail(`${path}.descriptor.adapterId`, 'must match adapterId')
  }
}

export function isAwesomePhysicsWorkerId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= AWESOME_PHYSICS_WORKER_MAX_ID_LENGTH
    && /^[A-Za-z0-9_-]+$/.test(value)
}

export function isAwesomePhysicsJsonValue(value: unknown, depth = 0, seen = new WeakSet<object>()): value is AwesomePhysicsJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object' || depth > AWESOME_PHYSICS_WORKER_MAX_JSON_DEPTH) return false
  if (seen.has(value)) return false
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) return false

  seen.add(value)
  let valid = true
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index) || !isAwesomePhysicsJsonValue(value[index], depth + 1, seen)) {
        valid = false
        break
      }
    }
  } else {
    for (const [key, entry] of Object.entries(value)) {
      if (typeof key !== 'string' || !isAwesomePhysicsJsonValue(entry, depth + 1, seen)) {
        valid = false
        break
      }
    }
  }
  seen.delete(value)
  return valid
}

export function parseAwesomePhysicsWorkerRequest(value: unknown): AwesomePhysicsWorkerRequest {
  const message = requireRecord(value, 'request')
  if (message.type === 'cancel') {
    const cancel = requireExactKeys(message, ['type', 'requestId'], [], 'request')
    return {
      type: 'cancel',
      requestId: requireSafeId(cancel.requestId, 'request.requestId'),
    }
  }
  if (message.type !== 'run') fail('request.type', 'must be run or cancel')

  const run = requireExactKeys(message, ['type', 'requestId', 'adapterId', 'descriptor', 'input'], [], 'request')
  const requestId = requireSafeId(run.requestId, 'request.requestId')
  const adapterId = requireSafeId(run.adapterId, 'request.adapterId')
  const descriptor = parseDescriptor(run.descriptor, 'request.descriptor')
  if (descriptor.adapterId !== adapterId) fail('request.adapterId', 'must match request.descriptor.adapterId')
  if (!descriptor.runnable || descriptor.availability !== 'available') {
    fail('request.descriptor', 'must identify an available runnable adapter')
  }
  if (descriptor.execution === 'artifact' || descriptor.execution === 'reference') {
    fail('request.descriptor.execution', 'cannot execute an artifact or reference descriptor')
  }
  if (descriptor.executionOptions.includes('wasm-candidate')) {
    fail('request.descriptor.executionOptions', 'cannot include wasm-candidate')
  }
  requireJsonValue(run.input, 'request.input')
  return { type: 'run', requestId, adapterId, descriptor, input: run.input }
}

export function parseAwesomePhysicsWorkerResponse(value: unknown): AwesomePhysicsWorkerResponse {
  const message = requireRecord(value, 'response')
  if (message.type === 'started') {
    const started = requireExactKeys(message, ['type', 'requestId', 'adapterId', 'descriptor', 'progress'], [], 'response')
    const context = parseResponseContext(started, 'response')
    const progress = requireProgress(started.progress, 'response.progress')
    if (progress !== 0) fail('response.progress', 'must be zero for started')
    requireResponseDescriptorMatch(context, 'response')
    return { ...context, type: 'started', progress }
  }
  if (message.type === 'completed') {
    const completed = requireExactKeys(message, ['type', 'requestId', 'adapterId', 'descriptor', 'progress', 'result'], [], 'response')
    const context = parseResponseContext(completed, 'response')
    const progress = requireProgress(completed.progress, 'response.progress')
    if (progress !== 100) fail('response.progress', 'must be 100 for completed')
    requireResponseDescriptorMatch(context, 'response')
    requireJsonValue(completed.result, 'response.result')
    return { ...context, type: 'completed', progress, result: completed.result }
  }
  if (message.type === 'failed') {
    const failed = requireExactKeys(message, ['type', 'requestId', 'adapterId', 'descriptor', 'progress', 'error'], [], 'response')
    const context = parseResponseContext(failed, 'response')
    const progress = requireProgress(failed.progress, 'response.progress')
    const error = requireNonEmptyString(failed.error, 'response.error')
    if (error.length > AWESOME_PHYSICS_WORKER_MAX_ERROR_LENGTH) {
      fail('response.error', `must be at most ${AWESOME_PHYSICS_WORKER_MAX_ERROR_LENGTH} characters`)
    }
    requireResponseDescriptorMatch(context, 'response')
    return { ...context, type: 'failed', progress, error }
  }
  if (message.type === 'cancelled') {
    const cancelled = requireExactKeys(message, ['type', 'requestId', 'adapterId', 'descriptor', 'progress'], [], 'response')
    const context = parseResponseContext(cancelled, 'response')
    const progress = requireProgress(cancelled.progress, 'response.progress')
    requireResponseDescriptorMatch(context, 'response')
    return { ...context, type: 'cancelled', progress }
  }
  fail('response.type', 'must be started, completed, failed, or cancelled')
}
