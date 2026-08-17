export type UnknownRecord = Record<string, unknown>
export type RecordKind = 'object' | 'json' | 'plain'

export function fail(path: string, message: string): never {
  throw new TypeError(`${path} ${message}`)
}

export function isPlainRecord(value: unknown): value is UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function objectMessage(kind: RecordKind): string {
  if (kind === 'json') return 'must be a JSON object'
  if (kind === 'plain') return 'must be a plain object'
  return 'must be an object'
}

export function record(value: unknown, path: string, kind: RecordKind = 'object'): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, objectMessage(kind))
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) fail(path, 'must be a plain JSON object')
  return value as UnknownRecord
}

export function requireRecord(value: unknown, path: string, kind: RecordKind = 'object'): asserts value is UnknownRecord {
  record(value, path, kind)
}

export function jsonRecord(value: unknown, path: string): UnknownRecord {
  return record(value, path, 'json')
}

export function exactKeys(
  value: UnknownRecord,
  required: readonly string[],
  optionalOrPath: readonly string[] | string,
  path?: string,
): void {
  const optional = typeof optionalOrPath === 'string' ? [] : optionalOrPath
  const resolvedPath = typeof optionalOrPath === 'string' ? optionalOrPath : path
  if (resolvedPath === undefined) fail('exactKeys', 'is missing a path')
  const allowed = new Set([...required, ...optional])
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  const missing = required.filter((key) => !Object.hasOwn(value, key))
  if (unknown.length > 0) fail(resolvedPath, `has unknown properties: ${unknown.join(', ')}`)
  if (missing.length > 0) fail(resolvedPath, `is missing properties: ${missing.join(', ')}`)
}

export function requireExactKeys(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  path: string,
  kind: RecordKind = 'object',
): asserts value is UnknownRecord {
  exactKeys(record(value, path, kind), required, optional, path)
}

export function exactRecord(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  path: string,
  kind: RecordKind = 'object',
): UnknownRecord {
  const object = record(value, path, kind)
  exactKeys(object, required, optional, path)
  return object
}

export function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
  return value
}

export function boundedNumber(value: unknown, path: string, minimum: number, maximum: number): number {
  const result = finiteNumber(value, path)
  if (result < minimum || result > maximum) fail(path, `must be between ${minimum} and ${maximum}`)
  return result
}

export function finiteWithinAbs(value: unknown, path: string, maximumAbs: number): number {
  const result = finiteNumber(value, path)
  if (Math.abs(result) > maximumAbs) fail(path, `must be within +/-${maximumAbs}`)
  return result
}

export function requirePositiveNumber(value: unknown, path: string): number {
  const result = finiteNumber(value, path)
  if (result <= 0) fail(path, 'must be greater than zero')
  return result
}

export function requireNonNegativeNumber(value: unknown, path: string): number {
  const result = finiteNumber(value, path)
  if (result < 0) fail(path, 'must be non-negative')
  return result
}

export function requireSafeInteger(value: unknown, path: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    fail(path, `must be a safe integer greater than or equal to ${minimum}`)
  }
  return value
}

export function requireSafeIntegerBetween(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(path, `must be a safe integer between ${minimum} and ${maximum}`)
  }
  return value
}

export function requireFiniteNumber(value: unknown, path: string, minimum?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (minimum !== undefined && value < minimum)) {
    fail(path, minimum === undefined ? 'must be a finite number' : `must be a finite number greater than or equal to ${minimum}`)
  }
  return value
}

export function requireRatio(value: unknown, path: string): number {
  const result = finiteNumber(value, path)
  if (result < 0 || result > 1) fail(path, 'must be between zero and one')
  return result
}

export function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'must be a boolean')
  return value
}

export function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'must be a non-empty string')
  return value
}

export function requireNullableString(value: unknown, path: string): string | null {
  if (value === null) return null
  return requireNonEmptyString(value, path)
}

export function requireSafeId(value: unknown, path: string, maximumLength = 64): string {
  const id = requireNonEmptyString(value, path)
  if (id.length > maximumLength || !/^[A-Za-z0-9_-]+$/.test(id)) {
    fail(path, `must be a non-empty ASCII ID of at most ${maximumLength} characters`)
  }
  return id
}

export function jsonByteLength(value: unknown, path: string, maximumBytes?: number): number {
  let json: string | undefined
  try {
    json = JSON.stringify(value)
  } catch {
    fail(path, 'must be JSON serializable')
  }
  if (json === undefined) fail(path, 'must be JSON serializable')
  const byteLength = new TextEncoder().encode(json).byteLength
  if (maximumBytes !== undefined && byteLength > maximumBytes) {
    fail(path, `exceeds the ${maximumBytes}-byte input limit`)
  }
  return byteLength
}

export function throwIfAborted(signal?: AbortSignal, message = 'The operation was aborted'): void {
  if (!signal?.aborted) return
  if (signal.reason instanceof Error) throw signal.reason
  const error = new Error(message)
  error.name = 'AbortError'
  throw error
}

export function throwIfAnyAborted(
  signals: readonly (AbortSignal | undefined)[],
  message = 'The operation was aborted',
): void {
  for (const signal of signals) throwIfAborted(signal, message)
}
