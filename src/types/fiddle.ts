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
