export interface FiddlePanelBytes {
  html: number
  js: number
  css: number
}

export interface FiddleFlags {
  can: number
  svg: number
  three: boolean
  webgl: boolean
  raf: boolean
  tim: boolean
  aud: boolean
  net: boolean
  anim: boolean
  math: boolean
  d3: boolean
  plot: boolean
  p5: boolean
}

export interface FiddleRecord {
  position: number
  page: number
  pastieId: string
  slug: string
  version: number
  title: string
  sourceUrl: string
  embedUrl: string
  panelBytes: FiddlePanelBytes
  library: string
  documentType: string
  assets: string[]
  controls: string[]
  visualization: string
  risk: string
  flags: FiddleFlags
}

export interface FiddleRegistrySource {
  platform: 'jsfiddle'
  author: string
  profileUrl: string
  profilePages: number
  recordCount: number
  sourceRevision: string
  acquiredAt: string
}

export interface FiddleRegistry {
  schemaVersion: 1
  source: FiddleRegistrySource
  records: FiddleRecord[]
}

export type FiddleRuntimeStatus = 'verified' | 'rendered-with-errors' | 'empty' | 'blocked' | 'timeout' | 'failed'

export interface FiddleRuntimeRecord {
  position: number
  slug: string
  version: number
  embedUrl: string
  status: FiddleRuntimeStatus
  attempts: number
  testedAt: string
  batch: string
  pageErrors: string[]
  failureSummary: string | null
}

export interface FiddleRuntimeAggregate {
  verified: number
  'rendered-with-errors': number
  empty: number
  blocked: number
  timeout: number
  failed: number
  total: number
  scientificallyValidated: 0
}

export interface FiddleRuntimeBatch {
  id: string
  firstPosition: number
  lastPosition: number
  startedAt: string
  completedAt: string
  engine: string
  version: string
  playwrightVersion: string
}

export interface FiddleRuntimeLedger {
  schemaVersion: 1
  registry: {
    path: string
    sourceRevision: string
    recordCount: number
  }
  methodology: {
    scope: string
    classification: string
    retryPolicy: string
    caveat: string
  }
  environment: { batches: FiddleRuntimeBatch[] }
  aggregate: FiddleRuntimeAggregate
  records: FiddleRuntimeRecord[]
}
