import type { GrayFullMotorResult } from './edwinGrayEngine'
import {
  GRAY_WORKBENCH_COMPATIBILITY_KEY,
  GRAY_WORKBENCH_IMPLEMENTATION_REVISION,
  GRAY_WORKBENCH_MODEL_REVISION,
  GRAY_WORKBENCH_SOURCE_REVISION,
  type GrayWorkbenchInputState,
} from './edwinGrayWorkbench'
import type { JsonObject, WorkbenchSnapshotInputV1, WorkbenchSnapshotV1 } from '../types/workbench'
import {
  createWorkbenchSnapshot,
  parseWorkbenchSnapshot,
  parseWorkbenchSnapshotJson,
  serializeWorkbenchSnapshot,
} from '../workbench/snapshots'

export const GRAY_SNAPSHOT_STORAGE_KEY = 'opensimphy:edwin-gray:snapshots:v1'
export const GRAY_SNAPSHOT_LIMIT = 12

export function graySnapshotInput(
  input: GrayWorkbenchInputState,
  result: Readonly<GrayFullMotorResult>,
  label?: string,
): WorkbenchSnapshotInputV1 {
  const finding = {
    schemaVersion: 1,
    changed: `${result.completedEventCount} of ${result.scheduledEventCount} events completed`,
    cause: result.stalled ? 'The dynamic mechanical state reached zero speed.' : 'The canonical event train reached its target angle.',
    equation: 'COP = load work / (initial stored electrical + initial kinetic + external recharge + prescribed drive)',
    assumptions: result.findings.map(({ statement }) => statement),
    establishes: 'A bounded classical event, circuit, mechanical, and energy accounting result for the selected inputs.',
    doesNotEstablish: 'Historical machine performance, over-unity, cold electricity, or a non-classical force.',
    validatesTheory: false,
  } satisfies JsonObject
  return {
    instrumentId: 'edwin-gray-workbench',
    methodId: result.numericalMethod,
    inputs: input as unknown as JsonObject,
    outputs: result as unknown as JsonObject,
    finding,
    provenance: result.provenance as unknown as JsonObject,
    sourceRevision: GRAY_WORKBENCH_SOURCE_REVISION,
    implementationRevision: GRAY_WORKBENCH_IMPLEMENTATION_REVISION,
    modelRevision: GRAY_WORKBENCH_MODEL_REVISION,
    compatibilityKey: GRAY_WORKBENCH_COMPATIBILITY_KEY,
    ...(label ? { label } : {}),
  }
}

export function createGraySnapshot(
  input: GrayWorkbenchInputState,
  result: Readonly<GrayFullMotorResult>,
  timestamp = new Date().toISOString(),
  label?: string,
): WorkbenchSnapshotV1 {
  return createWorkbenchSnapshot(graySnapshotInput(input, result, label), timestamp)
}

export function loadGraySnapshots(storage: Storage = localStorage): readonly WorkbenchSnapshotV1[] {
  const raw = storage.getItem(GRAY_SNAPSHOT_STORAGE_KEY)
  if (!raw) return Object.freeze([])
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) throw new TypeError('Saved Gray snapshots must be an array')
  return Object.freeze(parsed.map(parseWorkbenchSnapshot))
}

export function saveGraySnapshot(
  snapshot: WorkbenchSnapshotV1,
  storage: Storage = localStorage,
): readonly WorkbenchSnapshotV1[] {
  const current = loadGraySnapshots(storage)
  const next = Object.freeze([parseWorkbenchSnapshot(snapshot), ...current].slice(0, GRAY_SNAPSHOT_LIMIT))
  storage.setItem(GRAY_SNAPSHOT_STORAGE_KEY, JSON.stringify(next))
  return next
}

export function importGraySnapshot(json: string): WorkbenchSnapshotV1 {
  const snapshot = parseWorkbenchSnapshotJson(json)
  if (snapshot.instrumentId !== 'edwin-gray-workbench') {
    throw new TypeError('Imported snapshot does not belong to the Edwin Gray workbench')
  }
  return snapshot
}

export function exportGraySnapshot(snapshot: WorkbenchSnapshotV1): string {
  if (snapshot.instrumentId !== 'edwin-gray-workbench') {
    throw new TypeError('Only Edwin Gray workbench snapshots can be exported here')
  }
  return serializeWorkbenchSnapshot(snapshot)
}
