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
export const GRAY_SNAPSHOT_MAX_BYTES = 512 * 1024
export const GRAY_SNAPSHOT_STORAGE_MAX_BYTES = GRAY_SNAPSHOT_LIMIT * GRAY_SNAPSHOT_MAX_BYTES

export class GraySnapshotStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'GraySnapshotStorageError'
  }
}

export interface GraySnapshotLoadResult {
  snapshots: readonly WorkbenchSnapshotV1[]
  rejectedEntryCount: number
}

export interface GraySnapshotDifference {
  field: string
  left: unknown
  right: unknown
}

export interface GraySnapshotNumericalDelta {
  metric: string
  left: number
  right: number
  delta: number
}

export interface GraySnapshotComparison {
  compatible: boolean
  reason: string
  inputDifferences: readonly GraySnapshotDifference[]
  modelDifferences: readonly GraySnapshotDifference[]
  numericalDeltas: readonly GraySnapshotNumericalDelta[] | null
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function requireSnapshotSize(serialized: string): void {
  const bytes = byteLength(serialized)
  if (bytes > GRAY_SNAPSHOT_MAX_BYTES) {
    throw new RangeError(`Gray snapshot is ${bytes} bytes; the limit is ${GRAY_SNAPSHOT_MAX_BYTES} bytes`)
  }
}

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

export function loadGraySnapshotsWithRecovery(storage: Storage = localStorage): GraySnapshotLoadResult {
  const raw = storage.getItem(GRAY_SNAPSHOT_STORAGE_KEY)
  if (!raw) return { snapshots: Object.freeze([]), rejectedEntryCount: 0 }
  if (byteLength(raw) > GRAY_SNAPSHOT_STORAGE_MAX_BYTES) {
    throw new GraySnapshotStorageError(`Saved Gray snapshot storage exceeds ${GRAY_SNAPSHOT_STORAGE_MAX_BYTES} bytes`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch (cause) {
    throw new GraySnapshotStorageError('Saved Gray snapshot storage is not valid JSON and could not be recovered', { cause })
  }
  if (!Array.isArray(parsed)) throw new GraySnapshotStorageError('Saved Gray snapshots must be an array')
  const snapshots: WorkbenchSnapshotV1[] = []
  let rejectedEntryCount = 0
  for (const entry of parsed) {
    try {
      const snapshot = parseWorkbenchSnapshot(entry)
      requireSnapshotSize(JSON.stringify(snapshot))
      snapshots.push(snapshot)
    } catch {
      rejectedEntryCount += 1
    }
  }
  return { snapshots: Object.freeze(snapshots), rejectedEntryCount }
}

export function loadGraySnapshots(storage: Storage = localStorage): readonly WorkbenchSnapshotV1[] {
  return loadGraySnapshotsWithRecovery(storage).snapshots
}

export function saveGraySnapshot(
  snapshot: WorkbenchSnapshotV1,
  storage: Storage = localStorage,
): readonly WorkbenchSnapshotV1[] {
  const current = loadGraySnapshots(storage)
  const validated = parseWorkbenchSnapshot(snapshot)
  requireSnapshotSize(JSON.stringify(validated))
  const next = Object.freeze([validated, ...current].slice(0, GRAY_SNAPSHOT_LIMIT))
  const serialized = JSON.stringify(next)
  if (byteLength(serialized) > GRAY_SNAPSHOT_STORAGE_MAX_BYTES) {
    throw new GraySnapshotStorageError(`Gray snapshot storage would exceed ${GRAY_SNAPSHOT_STORAGE_MAX_BYTES} bytes`)
  }
  try {
    storage.setItem(GRAY_SNAPSHOT_STORAGE_KEY, serialized)
  } catch (cause) {
    throw new GraySnapshotStorageError('Gray snapshot could not be saved because browser storage rejected the write', { cause })
  }
  return next
}

export function importGraySnapshot(json: string): WorkbenchSnapshotV1 {
  requireSnapshotSize(json)
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
  const serialized = serializeWorkbenchSnapshot(snapshot)
  requireSnapshotSize(serialized)
  return serialized
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function differences(left: Record<string, unknown>, right: Record<string, unknown>): GraySnapshotDifference[] {
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((field) => JSON.stringify(left[field]) !== JSON.stringify(right[field]))
    .map((field) => ({ field, left: left[field], right: right[field] }))
}

export function compareGraySnapshots(
  leftValue: WorkbenchSnapshotV1,
  rightValue: WorkbenchSnapshotV1,
): GraySnapshotComparison {
  const left = parseWorkbenchSnapshot(leftValue)
  const right = parseWorkbenchSnapshot(rightValue)
  const leftInputs = record(left.inputs)
  const rightInputs = record(right.inputs)
  const leftOutputs = record(left.outputs)
  const rightOutputs = record(right.outputs)
  const leftProfile = record(leftOutputs.engineProfile)
  const rightProfile = record(rightOutputs.engineProfile)
  const inputDifferences = Object.freeze(differences(leftInputs, rightInputs))
  const modelFields = {
    machineContractId: [leftInputs.machineContractId, rightInputs.machineContractId],
    machineRevision: [leftProfile.machineRevision, rightProfile.machineRevision],
    modelRevision: [leftProfile.modelRevision, rightProfile.modelRevision],
    workbenchModelRevision: [left.modelRevision, right.modelRevision],
    numericalMethod: [left.methodId, right.methodId],
    generatedModelKey: [left.compatibilityKey, right.compatibilityKey],
  } as const
  const modelDifferences = Object.freeze(Object.entries(modelFields)
    .filter(([, values]) => values[0] !== values[1])
    .map(([field, values]) => ({ field, left: values[0], right: values[1] })))
  const compatible = leftInputs.machineContractId === rightInputs.machineContractId
    && leftProfile.machineRevision === rightProfile.machineRevision
    && leftProfile.modelRevision === rightProfile.modelRevision
    && left.modelRevision === right.modelRevision
    && left.methodId === right.methodId
    && left.compatibilityKey === right.compatibilityKey
    && typeof leftProfile.machineRevision === 'number'
    && typeof leftProfile.modelRevision === 'number'
  if (!compatible) {
    return Object.freeze({
      compatible: false,
      reason: 'Numerical deltas require the same generated model key, machine contract, revisions, and numerical method.',
      inputDifferences,
      modelDifferences,
      numericalDeltas: null,
    })
  }
  const leftLedger = record(leftOutputs.ledger)
  const rightLedger = record(rightOutputs.ledger)
  const metrics: Array<[string, unknown, unknown]> = [
    ['completedEventCount', leftOutputs.completedEventCount, rightOutputs.completedEventCount],
    ['finalRpm', leftOutputs.finalRpm, rightOutputs.finalRpm],
    ['loadWorkJ', leftLedger.loadWorkJ, rightLedger.loadWorkJ],
    ['totalLossesJ', leftLedger.totalLossesJ, rightLedger.totalLossesJ],
    ['wholeSystemCop', leftLedger.wholeSystemCop, rightLedger.wholeSystemCop],
  ]
  const numericalDeltas = Object.freeze(metrics
    .filter((entry): entry is [string, number, number] => typeof entry[1] === 'number' && typeof entry[2] === 'number')
    .map(([metric, leftNumber, rightNumber]) => ({
      metric,
      left: leftNumber,
      right: rightNumber,
      delta: rightNumber - leftNumber,
    })))
  return Object.freeze({
    compatible: true,
    reason: 'Generated model key, machine, and model revisions match; numerical deltas are comparable.',
    inputDifferences,
    modelDifferences,
    numericalDeltas,
  })
}
