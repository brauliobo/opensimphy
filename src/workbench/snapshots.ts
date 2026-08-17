import { fail, record, exactKeys } from '../simphy/contract'
import type {
  JsonObject,
  JsonValue,
  WorkbenchSnapshotInputV1,
  WorkbenchSnapshotV1,
} from '../types/workbench'

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const SHA256 = /^[a-f0-9]{64}$/
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const REQUIRED_INPUT_KEYS = [
  'methodId',
  'inputs',
  'outputs',
  'finding',
  'provenance',
  'sourceRevision',
  'implementationRevision',
  'compatibilityKey',
] as const
const OPTIONAL_INPUT_KEYS = ['modelRevision', 'contentRevision', 'label'] as const

export type SnapshotPair =
  | readonly []
  | readonly [WorkbenchSnapshotV1]
  | readonly [WorkbenchSnapshotV1, WorkbenchSnapshotV1]

interface SnapshotComparisonBase {
  readonly snapshots: readonly [WorkbenchSnapshotV1, WorkbenchSnapshotV1]
  readonly findings: readonly [JsonObject, JsonObject]
}

export interface CompatibleSnapshotComparison extends SnapshotComparisonBase {
  readonly compatible: true
  readonly compatibilityKey: string
}

export interface IncompatibleSnapshotComparison extends SnapshotComparisonBase {
  readonly compatible: false
  readonly compatibilityKey: null
  readonly residual: null
}

export type SnapshotComparison = CompatibleSnapshotComparison | IncompatibleSnapshotComparison

export class WorkbenchSnapshotValidationError extends TypeError {
  constructor(path: string, message: string) {
    super(`${path} ${message}`)
    this.name = 'WorkbenchSnapshotValidationError'
  }
}

function plainRecord(value: unknown, path: string): Record<string, unknown> {
  const object = record(value, path, 'plain')
  for (const key of Reflect.ownKeys(object)) {
    if (typeof key !== 'string') fail(path, 'symbol keys are not JSON')
    const descriptor = Object.getOwnPropertyDescriptor(object, key)
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail(`${path}.${key}`, 'expected an enumerable data property')
  }
  return object
}

function safeId(value: unknown, path: string): string {
  if (typeof value !== 'string' || !SAFE_ID.test(value) || UNSAFE_KEYS.has(value)) fail(path, 'expected a safe ID')
  return value
}

function revision(value: unknown, path: string): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > 512
    || value.trim() !== value
    || /[\u0000-\u001f\u007f]/.test(value)
  ) fail(path, 'expected a safe non-empty revision')
  return value
}

function optionalText(value: unknown, path: string): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > 256
    || value.trim() !== value
    || /[\u0000-\u001f\u007f]/.test(value)
  ) fail(path, 'expected safe non-empty text')
  return value
}

export function validateWorkbenchTimestamp(value: unknown, path = 'timestamp'): string {
  if (typeof value !== 'string' || !ISO_TIMESTAMP.test(value)) fail(path, 'expected an ISO timestamp')
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) fail(path, 'expected an ISO timestamp')
  return value
}

function compatibilityKey(value: unknown, path: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) fail(path, 'expected a lowercase SHA-256 digest')
  return value
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function cloneJsonValue(value: unknown, path = 'value'): JsonValue {
  return cloneJsonValueAt(value, path, new WeakSet<object>())
}

function cloneJsonValueAt(value: unknown, path: string, ancestors: WeakSet<object>): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(path, 'expected a finite JSON number')
    return value
  }
  if (typeof value !== 'object') fail(path, `unsupported JSON value type ${typeof value}`)
  if (ancestors.has(value)) fail(path, 'cyclic values are not JSON')

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) fail(path, 'expected a plain array prototype')
      const ownKeys = Reflect.ownKeys(value)
      if (ownKeys.some((key) => typeof key !== 'string')) fail(path, 'symbol keys are not JSON')
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) fail(`${path}[${index}]`, 'sparse arrays are not accepted')
      }
      if (ownKeys.length !== value.length + 1 || !ownKeys.includes('length')) fail(path, 'arrays cannot contain extra properties')
      const clone: JsonValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail(`${path}[${index}]`, 'expected an enumerable data property')
        clone.push(cloneJsonValueAt(descriptor.value, `${path}[${index}]`, ancestors))
      }
      return Object.freeze(clone)
    }

    const object = plainRecord(value, path)
    const clone: Record<string, JsonValue> = {}
    for (const key of Object.keys(object)) {
      if (UNSAFE_KEYS.has(key)) fail(`${path}.${key}`, 'unsafe object key')
      const descriptor = Object.getOwnPropertyDescriptor(object, key)
      clone[key] = cloneJsonValueAt(descriptor?.value, `${path}.${key}`, ancestors)
    }
    return Object.freeze(clone)
  } finally {
    ancestors.delete(value)
  }
}

function jsonObject(value: unknown, path: string): JsonObject {
  const clone = cloneJsonValue(value, path)
  if (!isJsonObject(clone)) fail(path, 'expected a structured JSON object')
  return clone
}

function expectedKeys(object: Record<string, unknown>, includeEnvelope: boolean, path: string): string[] {
  const hasInstrument = Object.hasOwn(object, 'instrumentId')
  const hasProgram = Object.hasOwn(object, 'programId')
  if (hasInstrument === hasProgram) fail(path, 'expected exactly one of instrumentId or programId')
  return [
    ...(includeEnvelope ? ['schemaVersion', 'timestamp'] : []),
    hasInstrument ? 'instrumentId' : 'programId',
    ...REQUIRED_INPUT_KEYS,
    ...OPTIONAL_INPUT_KEYS.filter((key) => Object.hasOwn(object, key)),
  ]
}

function snapshotAt(value: unknown, timestamp: unknown, includeEnvelope: boolean): WorkbenchSnapshotV1 {
  const object = plainRecord(value, 'snapshot')
  exactKeys(object, expectedKeys(object, includeEnvelope, 'snapshot'), 'snapshot')
  if (includeEnvelope && object.schemaVersion !== 1) fail('snapshot.schemaVersion', 'expected schema version 1')

  const identity = Object.hasOwn(object, 'instrumentId')
    ? { instrumentId: safeId(object.instrumentId, 'snapshot.instrumentId') }
    : { programId: safeId(object.programId, 'snapshot.programId') }
  const snapshot = {
    schemaVersion:          1,
    ...identity,
    methodId:               safeId(object.methodId, 'snapshot.methodId'),
    inputs:                 cloneJsonValue(object.inputs, 'snapshot.inputs'),
    outputs:                cloneJsonValue(object.outputs, 'snapshot.outputs'),
    finding:                jsonObject(object.finding, 'snapshot.finding'),
    provenance:             jsonObject(object.provenance, 'snapshot.provenance'),
    sourceRevision:         revision(object.sourceRevision, 'snapshot.sourceRevision'),
    implementationRevision: revision(object.implementationRevision, 'snapshot.implementationRevision'),
    ...(Object.hasOwn(object, 'modelRevision')
      ? { modelRevision: revision(object.modelRevision, 'snapshot.modelRevision') }
      : {}),
    ...(Object.hasOwn(object, 'contentRevision')
      ? { contentRevision: revision(object.contentRevision, 'snapshot.contentRevision') }
      : {}),
    compatibilityKey:      compatibilityKey(object.compatibilityKey, 'snapshot.compatibilityKey'),
    timestamp:             validateWorkbenchTimestamp(timestamp, 'snapshot.timestamp'),
    ...(Object.hasOwn(object, 'label') ? { label: optionalText(object.label, 'snapshot.label') } : {}),
  } satisfies WorkbenchSnapshotV1
  return Object.freeze(snapshot)
}

export function createWorkbenchSnapshot(input: WorkbenchSnapshotInputV1, timestamp: string): WorkbenchSnapshotV1 {
  return snapshotAt(input, timestamp, false)
}

export function parseWorkbenchSnapshot(value: unknown): WorkbenchSnapshotV1 {
  const object = plainRecord(value, 'snapshot')
  return snapshotAt(object, object.timestamp, true)
}

export function parseWorkbenchSnapshotJson(json: string): WorkbenchSnapshotV1 {
  return parseWorkbenchSnapshot(JSON.parse(json) as unknown)
}

export function serializeWorkbenchSnapshot(value: unknown): string {
  return JSON.stringify(parseWorkbenchSnapshot(value))
}

export function createSnapshotPair(values: readonly unknown[] = []): SnapshotPair {
  if (values.length > 2) throw new RangeError('A snapshot pair contains at most two snapshots')
  return Object.freeze(values.map(parseWorkbenchSnapshot)) as SnapshotPair
}

export function addSnapshot(pair: SnapshotPair, value: unknown): SnapshotPair {
  if (pair.length === 2) throw new RangeError('A snapshot pair is full; remove a snapshot before adding another')
  return createSnapshotPair([...pair, value])
}

export function removeSnapshot(pair: SnapshotPair, index: 0 | 1): SnapshotPair {
  if (index >= pair.length) throw new RangeError('Snapshot index is not present in the pair')
  return createSnapshotPair(pair.filter((_, current) => current !== index))
}

export function compareSnapshots(leftValue: unknown, rightValue: unknown): SnapshotComparison {
  const left = parseWorkbenchSnapshot(leftValue)
  const right = parseWorkbenchSnapshot(rightValue)
  const snapshots = Object.freeze([left, right]) as readonly [WorkbenchSnapshotV1, WorkbenchSnapshotV1]
  const findings = Object.freeze([left.finding, right.finding]) as readonly [JsonObject, JsonObject]
  if (left.compatibilityKey === right.compatibilityKey) {
    return Object.freeze({ compatible: true, compatibilityKey: left.compatibilityKey, snapshots, findings })
  }
  return Object.freeze({ compatible: false, compatibilityKey: null, snapshots, findings, residual: null })
}

export function compareSnapshotPair(pair: SnapshotPair): SnapshotComparison {
  if (pair.length !== 2) throw new RangeError('Comparison requires exactly two snapshots')
  return compareSnapshots(pair[0], pair[1])
}
