export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonArray

export interface JsonObject {
  readonly [key: string]: JsonValue
}

export interface JsonArray extends ReadonlyArray<JsonValue> {}

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
