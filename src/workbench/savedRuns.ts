import type { WorkbenchSnapshotV1 } from '../types/workbench'
import { parseWorkbenchSnapshot } from './snapshots'

/** Maximum UTF-8 size of one serialized saved run: 512 KiB. Larger artifacts need another explicit storage design. */
export const MAX_SAVED_RUN_BYTES = 512 * 1024

export interface SavedRunsDocumentV1 {
  readonly schemaVersion: 1
  readonly runs: readonly WorkbenchSnapshotV1[]
}

export class SavedRunSizeError extends RangeError {
  readonly byteLength: number

  constructor(byteLength: number) {
    super(`Saved run is ${byteLength} bytes; the limit is ${MAX_SAVED_RUN_BYTES} bytes`)
    this.name = 'SavedRunSizeError'
    this.byteLength = byteLength
  }
}

export function serializedByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

export function validateSavedRunSize(value: unknown): WorkbenchSnapshotV1 {
  const run = parseWorkbenchSnapshot(value)
  const byteLength = serializedByteLength(JSON.stringify(run))
  if (byteLength > MAX_SAVED_RUN_BYTES) throw new SavedRunSizeError(byteLength)
  return run
}

function parseDocument(value: unknown): SavedRunsDocumentV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('Saved runs document must be a plain object')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Saved runs document must have a plain object prototype')
  const object = value as Record<string, unknown>
  const keys = Object.keys(object).sort()
  if (keys.length !== 2 || keys[0] !== 'runs' || keys[1] !== 'schemaVersion') {
    throw new TypeError('Saved runs document must contain exactly schemaVersion and runs')
  }
  if (object.schemaVersion !== 1) throw new TypeError('Saved runs document must use schema version 1')
  if (!Array.isArray(object.runs) || Object.getPrototypeOf(object.runs) !== Array.prototype) {
    throw new TypeError('Saved runs document runs must be a plain array')
  }
  const runs = Object.freeze(object.runs.map(validateSavedRunSize))
  const timestamps = new Set(runs.map(({ timestamp }) => timestamp))
  if (timestamps.size !== runs.length) throw new TypeError('Saved run timestamps must be unique')
  return Object.freeze({ schemaVersion: 1, runs })
}

export function parseSavedRunsJson(json: string): SavedRunsDocumentV1 {
  return parseDocument(JSON.parse(json) as unknown)
}

export function serializeSavedRuns(runs: readonly unknown[]): string {
  const validated = runs.map(validateSavedRunSize)
  const timestamps = new Set(validated.map(({ timestamp }) => timestamp))
  if (timestamps.size !== validated.length) throw new TypeError('Saved run timestamps must be unique')
  return JSON.stringify({ schemaVersion: 1, runs: validated })
}
