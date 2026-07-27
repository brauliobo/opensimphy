import type { JsonObject, JsonValue } from '../types/workbench'
import { cloneJsonValue } from './snapshots'

export const MAX_WORKBENCH_URL_INPUT_BYTES = 4096

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const INTEGER = /^-?(?:0|[1-9]\d*)$/
const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/
const BASE64URL = /^[A-Za-z0-9_-]+$/
const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const MAX_BASE64URL_INPUT_LENGTH = Math.ceil(MAX_WORKBENCH_URL_INPUT_BYTES * 4 / 3)

export interface QueryNumberBounds {
  readonly min: number
  readonly max: number
  readonly step?: number
}

export type WorkbenchQueryValue = string | readonly string[] | null | undefined
export type WorkbenchQuery = Readonly<Record<string, WorkbenchQueryValue>>
export type OwnedQueryValue = string | number | boolean | null | undefined

export class WorkbenchUrlStateError extends TypeError {
  constructor(message: string) {
    super(`Invalid workbench URL state: ${message}`)
    this.name = 'WorkbenchUrlStateError'
  }
}

export function parseQueryScalar(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function parseSafeIdQuery(value: unknown): string | null {
  const scalar = parseQueryScalar(value)
  if (scalar === null || !SAFE_ID.test(scalar) || UNSAFE_KEYS.has(scalar)) return null
  return scalar
}

function validBounds(bounds: QueryNumberBounds): boolean {
  return Number.isFinite(bounds.min)
    && Number.isFinite(bounds.max)
    && bounds.min <= bounds.max
    && (bounds.step === undefined || (Number.isFinite(bounds.step) && bounds.step > 0))
}

function stepAligned(value: number, bounds: QueryNumberBounds): boolean {
  if (bounds.step === undefined) return true
  const steps = (value - bounds.min) / bounds.step
  const tolerance = Number.EPSILON * 16 * Math.max(1, Math.abs(steps))
  return Math.abs(steps - Math.round(steps)) <= tolerance
}

export function parseIntegerQuery(value: unknown, bounds: QueryNumberBounds): number | null {
  const scalar = parseQueryScalar(value)
  if (scalar === null || !validBounds(bounds) || !INTEGER.test(scalar)) return null
  const parsed = Number(scalar)
  if (!Number.isSafeInteger(parsed) || parsed < bounds.min || parsed > bounds.max) return null
  return stepAligned(parsed, bounds) ? parsed : null
}

export function parseNumberQuery(value: unknown, bounds: QueryNumberBounds): number | null {
  const scalar = parseQueryScalar(value)
  if (scalar === null || !validBounds(bounds) || !NUMBER.test(scalar)) return null
  const parsed = Number(scalar)
  if (!Number.isFinite(parsed) || parsed < bounds.min || parsed > bounds.max) return null
  return stepAligned(parsed, bounds) ? parsed : null
}

export function parseEnumQuery<const T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const scalar = parseQueryScalar(value)
  return scalar !== null && allowed.includes(scalar as T) ? scalar as T : null
}

export function parseBooleanQuery(value: unknown): boolean | null {
  const scalar = parseQueryScalar(value)
  if (scalar === 'true') return true
  if (scalar === 'false') return false
  return null
}

function serializeOwnedValue(value: OwnedQueryValue): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    throw new WorkbenchUrlStateError('owned query values must be scalar')
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new WorkbenchUrlStateError('owned query values must be finite')
  }
  return String(value)
}

function assignQueryValue(target: Record<string, WorkbenchQueryValue>, key: string, value: WorkbenchQueryValue): void {
  Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true })
}

export function mergeOwnedQuery(
  current: WorkbenchQuery,
  ownedKeys: readonly string[],
  values: Readonly<Record<string, OwnedQueryValue>>,
  defaults: Readonly<Record<string, OwnedQueryValue>> = {},
): WorkbenchQuery {
  const owned = new Set(ownedKeys)
  if (owned.size !== ownedKeys.length || ownedKeys.some((key) => !SAFE_ID.test(key) || UNSAFE_KEYS.has(key))) {
    throw new WorkbenchUrlStateError('owned query keys must be unique safe IDs')
  }
  if (Object.keys(values).some((key) => !owned.has(key)) || Object.keys(defaults).some((key) => !owned.has(key))) {
    throw new WorkbenchUrlStateError('query values and defaults may contain only declared owned keys')
  }

  const entries: Array<readonly [string, WorkbenchQueryValue]> = []
  for (const key of Object.keys(current)) {
    if (owned.has(key)) continue
    const value = current[key]
    if (
      value === null
      || value === undefined
      || typeof value === 'string'
      || (Array.isArray(value) && value.every((item) => typeof item === 'string'))
    ) entries.push([key, Array.isArray(value) ? Object.freeze([...value]) : value])
  }
  for (const key of ownedKeys) {
    const value = serializeOwnedValue(values[key])
    if (value === null || value === serializeOwnedValue(defaults[key])) continue
    entries.push([key, value])
  }
  entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)

  const merged: Record<string, WorkbenchQueryValue> = {}
  for (const [key, value] of entries) assignQueryValue(merged, key, value)
  return Object.freeze(merged)
}

function canonicalJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalJsonValue)
  if (value === null || typeof value !== 'object') return value

  const sorted: Record<string, JsonValue> = {}
  for (const key of Object.keys(value).sort()) sorted[key] = canonicalJsonValue(value[key]!)
  return sorted
}

function objectInputs(value: unknown): JsonObject {
  const cloned = cloneJsonValue(value, 'url.inputs')
  if (cloned === null || typeof cloned !== 'object' || Array.isArray(cloned)) {
    throw new WorkbenchUrlStateError('inputs must be an object')
  }
  return cloned
}

function encodeBase64Url(bytes: Uint8Array): string {
  let encoded = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    encoded += BASE64URL_ALPHABET[first >> 2]
    encoded += BASE64URL_ALPHABET[((first & 3) << 4) | ((second ?? 0) >> 4)]
    if (second !== undefined) encoded += BASE64URL_ALPHABET[((second & 15) << 2) | ((third ?? 0) >> 6)]
    if (third !== undefined) encoded += BASE64URL_ALPHABET[third & 63]
  }
  return encoded
}

function decodeBase64Url(encoded: string): Uint8Array {
  if (encoded.length > MAX_BASE64URL_INPUT_LENGTH) {
    throw new WorkbenchUrlStateError(`input envelope exceeds ${MAX_WORKBENCH_URL_INPUT_BYTES} decoded bytes`)
  }
  if (!BASE64URL.test(encoded) || encoded.length % 4 === 1) {
    throw new WorkbenchUrlStateError('input envelope is not canonical base64url')
  }
  const bytes: number[] = []
  for (let index = 0; index < encoded.length; index += 4) {
    const first = BASE64URL_ALPHABET.indexOf(encoded[index]!)
    const second = BASE64URL_ALPHABET.indexOf(encoded[index + 1]!)
    const third = index + 2 < encoded.length ? BASE64URL_ALPHABET.indexOf(encoded[index + 2]!) : -1
    const fourth = index + 3 < encoded.length ? BASE64URL_ALPHABET.indexOf(encoded[index + 3]!) : -1
    bytes.push((first << 2) | (second >> 4))
    if (third >= 0) bytes.push(((second & 15) << 4) | (third >> 2))
    if (fourth >= 0) bytes.push(((third & 3) << 6) | fourth)
  }
  const decoded = Uint8Array.from(bytes)
  if (encodeBase64Url(decoded) !== encoded) {
    throw new WorkbenchUrlStateError('input envelope is not canonical base64url')
  }
  return decoded
}

function enforceSize(bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_WORKBENCH_URL_INPUT_BYTES) {
    throw new WorkbenchUrlStateError(`input envelope exceeds ${MAX_WORKBENCH_URL_INPUT_BYTES} decoded bytes`)
  }
}

export function encodeWorkbenchInputEnvelope(inputs: unknown): string {
  const envelope = canonicalJsonValue({ version: 1, inputs: objectInputs(inputs) })
  const bytes = new TextEncoder().encode(JSON.stringify(envelope))
  enforceSize(bytes)
  return encodeBase64Url(bytes)
}

export function decodeWorkbenchInputEnvelope(encoded: unknown): JsonObject {
  if (typeof encoded !== 'string') throw new WorkbenchUrlStateError('input envelope must be a string')
  const bytes = decodeBase64Url(encoded)
  enforceSize(bytes)

  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
  } catch (cause) {
    throw new WorkbenchUrlStateError(`input envelope is not valid UTF-8 JSON${cause instanceof Error ? `: ${cause.message}` : ''}`)
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new WorkbenchUrlStateError('input envelope must be an object')
  }
  const object = parsed as Record<string, unknown>
  const keys = Object.keys(object).sort()
  if (keys.length !== 2 || keys[0] !== 'inputs' || keys[1] !== 'version') {
    throw new WorkbenchUrlStateError('input envelope must contain exactly version and inputs')
  }
  if (object.version !== 1) throw new WorkbenchUrlStateError('input envelope version must be 1')
  const inputs = objectInputs(object.inputs)
  if (encodeWorkbenchInputEnvelope(inputs) !== encoded) {
    throw new WorkbenchUrlStateError('input envelope JSON is not canonical')
  }
  return inputs
}
