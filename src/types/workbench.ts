export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonArray

export interface JsonObject {
  readonly [key: string]: JsonValue
}

export interface JsonArray extends ReadonlyArray<JsonValue> {}

export type WorkbenchExecutionMode = 'manual' | 'route-evaluated' | 'unavailable'
export type WorkbenchExecutionStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'unavailable'
export type WorkbenchProgress = number
export type WorkbenchSnapshotCount = 0 | 1 | 2
export type WorkbenchAction = 'run' | 'cancel' | 'reset' | 'save' | 'freeze' | 'clear-compare'

export interface WorkbenchCapabilities {
  readonly save: boolean
  readonly compare: boolean
}

export type WorkbenchActionLabels = Readonly<Record<WorkbenchAction, string>>
export type WorkbenchActionErrors = Readonly<Partial<Record<WorkbenchAction, string>>>

export interface WorkbenchProvenanceSummary {
  readonly claimClass: string
  readonly evidenceRefs: readonly string[]
  readonly sourceRevision: string
  readonly sourceLocator: string
  readonly methodRelationship: string
  readonly modelOrigin: string
  readonly resultStatus: string
  readonly caveats: readonly string[]
  readonly implementationRevision?: string
  readonly modelRevision?: string
  readonly contentRevision?: string
  readonly outputSchemaRevision?: string
}

export interface WorkbenchFindingV1 {
  readonly schemaVersion: 1
  readonly changed: string
  readonly cause: string
  readonly equation: string
  readonly assumptions: readonly string[]
  readonly establishes: string
  readonly doesNotEstablish: string
  readonly provenance: WorkbenchProvenanceSummary
  readonly validatesTheory: false
}

interface WorkbenchRevisionFields {
  readonly sourceRevision: string
  readonly implementationRevision: string
  readonly modelRevision?: string
  readonly contentRevision?: string
}

interface WorkbenchSnapshotFields extends WorkbenchRevisionFields {
  readonly methodId: string
  readonly inputs: JsonValue
  readonly outputs: JsonValue
  readonly finding: JsonObject
  readonly provenance: JsonObject
  readonly compatibilityKey: string
  readonly label?: string
}

export type WorkbenchIdentity =
  | { readonly instrumentId: string; readonly programId?: never }
  | { readonly instrumentId?: never; readonly programId: string }

export type WorkbenchSnapshotInputV1 = WorkbenchSnapshotFields & WorkbenchIdentity

export type WorkbenchSnapshotV1 = WorkbenchSnapshotInputV1 & {
  readonly schemaVersion: 1
  readonly timestamp: string
}

export type WorkbenchRunV1 = WorkbenchSnapshotV1
export type SavedRunV1 = WorkbenchSnapshotV1
