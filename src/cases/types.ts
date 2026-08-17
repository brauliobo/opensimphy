export type CaseKind = 'gray-motor' | 'awesome-physics' | 'hub'

export interface CaseLink {
  id: string
  title: string
  to: string
}

export interface CaseRecord extends CaseLink {
  kind: CaseKind
  eyebrow: string
  description: string
  execution: string
  availability: string
  runnable: boolean
  copRelevant: boolean
  mount: CaseMount
}

export type CaseMount =
  | { kind: 'hub' }
  | { kind: 'gray-motor'; api: 'runGrayInWorker'; worker: 'edwinGray.worker' }
  | {
    kind: 'awesome-physics'
    api: 'runAwesomePhysicsInWorker'
    wasm: 'loadVerifiedWasmArtifactById'
    adapterId: string | null
    execution: string
  }

export interface CaseMetric {
  label: string
  value: string
  tone?: 'ok' | 'warn' | 'claim'
}

export interface CaseTableColumn {
  key: string
  label: string
}

export interface SchematicRef {
  id: string
  title: string
  caption: string
  href?: string
  src?: string | null
  subtitle?: string | null
  timestamp?: string
}

export interface CopClaimRow {
  label: string
  value: string
  status: string
}
