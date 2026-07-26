export interface EarthDocumentRecord {
  id: string
  slug: string
  title: string
  classification: {
    collection: 'root' | 'safe-paper' | 'theorem'
    series: string | null
    ordinal: number | null
  }
  source: {
    path: string
    sha256: string
    bytes: number
    lineCount: number
    encoding: 'utf-8'
    finalNewline: boolean
  }
  counts: {
    headings: number
    formulas: number
    claims: number
    codeBlocks: number
    simulations: number
    diagnostics: number
  }
  dataUrl: string
}

export interface EarthManifest {
  schemaVersion: number
  parserVersion: number
  sourceRevision: string
  sourceLockSha256: string
  license: {
    identifier: string
    attribution: string
    note: string
  }
  policy: {
    sourceClaimsAreValidated: false
    codeExecution: 'disabled'
    rawHtml: 'escaped'
    remoteImages: 'omitted'
    candidateRule: string
  }
  summary: {
    documents: number
    sourceBytes: number
    sourceLines: number
    headings: number
    formulas: number
    delimitedFormulas: number
    plainFormulaCandidates: number
    claimCandidates: number
    codeBlocks: number
    simulationCandidates: number
    diagnostics: number
  }
  documents: EarthDocumentRecord[]
}

export interface EarthDocumentShard {
  schemaVersion: number
  parserVersion: number
  sourceRevision: string
  document: {
    id: string
    slug: string
    title: string
    classification: EarthDocumentRecord['classification']
    source: EarthDocumentRecord['source']
    structure: {
      headings: Array<{ id: string; level: number; text: string; line: number }>
      codeBlocks: Array<{
        id: string
        language: string | null
        section: string | null
        startLine: number
        endLine: number
        execution: 'disabled'
      }>
    }
    diagnostics: Array<{ code: string; line: number; column: number }>
    sanitizedMarkdown: string
  }
}

function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}

async function readJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(dataUrl(path), { signal })
  if (!response.ok) throw new Error(`EARTH registry failed to load (${response.status})`)
  return response.json() as Promise<T>
}

export function loadEarthManifest(signal?: AbortSignal): Promise<EarthManifest> {
  return readJson<EarthManifest>('/data/generated/earth/manifest.json', signal)
}

export async function loadEarthDocument(record: EarthDocumentRecord, signal?: AbortSignal): Promise<EarthDocumentShard> {
  const shard = await readJson<EarthDocumentShard>(record.dataUrl, signal)
  if (shard.document.id !== record.id
    || shard.document.slug !== record.slug
    || shard.document.source.sha256 !== record.source.sha256) {
    throw new Error(`EARTH document integrity mismatch for ${record.slug}`)
  }
  return shard
}
