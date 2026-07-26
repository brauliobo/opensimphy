export type EarthEvidenceSourceType = 'formula' | 'code-block' | 'simulation-candidate'
export type EarthEvidenceConfidence = 'high' | 'medium' | 'low'
export type EarthEvidenceClassification = 'duplicate' | 'blocked-source-fragment' | 'non-scientific-example'

export interface EarthEvidenceCounts {
  total: number
  bySourceType: Record<EarthEvidenceSourceType, number>
  byConfidence: Record<EarthEvidenceConfidence, number>
}

export interface EarthEvidenceAssignment {
  sourceType: EarthEvidenceSourceType
  sourceId: string
  documentId: string
  confidence: EarthEvidenceConfidence
  assignmentBasis: string[]
  sourceIds: Record<string, string | string[]>
}

export interface EarthEvidenceProgramIndexRecord {
  id: string
  dataUrl: string
  counts: EarthEvidenceCounts
  linkedDocuments: number
  linkedDatasets: number
  disputedClaims: number
}

export interface EarthEvidenceDocumentIndexRecord {
  id: string
  slug: string
  dataUrl: string
  relatedCanonicalPrograms: number
  coverageAssignments: number
  simulationCandidates: number
  diagnostics: number
}

export interface EarthEvidenceManifest {
  schemaVersion: 1
  sourceRevision: string
  sourceLockSha256: string
  sourcePlan: { path: string; revision: string; sha256: string }
  datasetRegistry: { sha256: string }
  summary: {
    programs: number
    documents: number
    assignments: number
    canonicalProgramAssignments: number
    classifiedAssignments: number
    datasets: number
    disputedClaims: number
    classifications: Record<EarthEvidenceClassification, number>
  }
  programs: EarthEvidenceProgramIndexRecord[]
  documents: EarthEvidenceDocumentIndexRecord[]
}

export interface EarthProgramEvidenceShard {
  schemaVersion: 1
  sourceRevision: string
  sourcePlanSha256: string
  programId: string
  counts: EarthEvidenceCounts
  linkedDocumentIds: string[]
  linkedDatasetIds: string[]
  disputedClaimIds: string[]
  assignments: EarthEvidenceAssignment[]
}

export interface EarthDocumentEvidenceShard {
  schemaVersion: 1
  sourceRevision: string
  sourcePlanSha256: string
  document: { id: string; slug: string; title: string }
  summary: {
    coverageAssignments: number
    canonicalProgramAssignments: number
    classifiedAssignments: number
    relatedCanonicalPrograms: number
    classificationCounts: Record<EarthEvidenceClassification, number>
  }
  canonicalPrograms: Array<{ programId: string; counts: EarthEvidenceCounts }>
  classifiedRecords: Array<EarthEvidenceAssignment & { classification: EarthEvidenceClassification; duplicateOf?: string }>
}

export interface EarthEvidenceReferences {
  documentIds?: Iterable<string>
  programIds?: Iterable<string>
  datasetIds?: Iterable<string>
  disputedClaimIds?: Iterable<string>
}

const SOURCE_TYPES = ['formula', 'code-block', 'simulation-candidate'] as const
const CONFIDENCES = ['high', 'medium', 'low'] as const
const CLASSIFICATIONS = ['duplicate', 'blocked-source-fragment', 'non-scientific-example'] as const

function fail(path: string, message: string): never {
  throw new Error(`EARTH evidence integrity error at ${path}: ${message}`)
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'expected an object')
  return value as Record<string, unknown>
}

function exactKeys(object: Record<string, unknown>, expected: readonly string[], path: string): void {
  const actual = Object.keys(object).sort()
  const keys = [...expected].sort()
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) {
    fail(path, `expected exactly these fields: ${expected.join(', ')}`)
  }
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(path, 'expected a non-empty string')
  return value
}

function integerAt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) fail(path, 'expected a non-negative integer')
  return value
}

function enumAt<const T extends readonly string[]>(value: unknown, allowed: T, path: string): T[number] {
  const item = stringAt(value, path)
  if (!allowed.includes(item)) fail(path, `expected one of: ${allowed.join(', ')}`)
  return item as T[number]
}

function stringList(value: unknown, path: string, allowEmpty = true): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) fail(path, `expected ${allowEmpty ? 'an' : 'a non-empty'} array`)
  const items = value.map((item, index) => stringAt(item, `${path}[${index}]`))
  if (new Set(items).size !== items.length) fail(path, 'contains duplicate values')
  return items
}

function sha256At(value: unknown, path: string): string {
  const digest = stringAt(value, path)
  if (!/^[a-f0-9]{64}$/.test(digest)) fail(path, 'expected a lowercase SHA256 digest')
  return digest
}

function countsAt(value: unknown, path: string): EarthEvidenceCounts {
  const object = objectAt(value, path)
  exactKeys(object, ['total', 'bySourceType', 'byConfidence'], path)
  const bySourceType = objectAt(object.bySourceType, `${path}.bySourceType`)
  const byConfidence = objectAt(object.byConfidence, `${path}.byConfidence`)
  exactKeys(bySourceType, SOURCE_TYPES, `${path}.bySourceType`)
  exactKeys(byConfidence, CONFIDENCES, `${path}.byConfidence`)
  const parsed = {
    total: integerAt(object.total, `${path}.total`),
    bySourceType: Object.fromEntries(SOURCE_TYPES.map((key) => [key, integerAt(bySourceType[key], `${path}.bySourceType.${key}`)])) as Record<EarthEvidenceSourceType, number>,
    byConfidence: Object.fromEntries(CONFIDENCES.map((key) => [key, integerAt(byConfidence[key], `${path}.byConfidence.${key}`)])) as Record<EarthEvidenceConfidence, number>,
  }
  if (Object.values(parsed.bySourceType).reduce((total, count) => total + count, 0) !== parsed.total) fail(path, 'source-type counts do not total')
  if (Object.values(parsed.byConfidence).reduce((total, count) => total + count, 0) !== parsed.total) fail(path, 'confidence counts do not total')
  return parsed
}

function classificationCountsAt(value: unknown, path: string): Record<EarthEvidenceClassification, number> {
  const object = objectAt(value, path)
  exactKeys(object, CLASSIFICATIONS, path)
  return Object.fromEntries(CLASSIFICATIONS.map((key) => [key, integerAt(object[key], `${path}.${key}`)])) as Record<EarthEvidenceClassification, number>
}

function sourceIdsAt(value: unknown, sourceType: EarthEvidenceSourceType, documentId: string, path: string): Record<string, string | string[]> {
  const object = objectAt(value, path)
  const keys = sourceType === 'formula'
    ? ['documentId', 'formulaId']
    : sourceType === 'code-block'
      ? ['documentId', 'codeBlockId', 'simulationCandidateIds']
      : ['documentId', 'simulationCandidateId', 'codeBlockId']
  exactKeys(object, keys, path)
  const parsed = Object.fromEntries(keys.map((key) => [
    key,
    key === 'simulationCandidateIds' ? stringList(object[key], `${path}.${key}`) : stringAt(object[key], `${path}.${key}`),
  ]))
  if (parsed.documentId !== documentId) fail(`${path}.documentId`, 'does not match assignment document')
  return parsed
}

function assignmentAt(value: unknown, path: string, classified: boolean): EarthEvidenceAssignment & { classification?: EarthEvidenceClassification; duplicateOf?: string } {
  const object = objectAt(value, path)
  const hasDuplicate = Object.hasOwn(object, 'duplicateOf')
  exactKeys(object, [
    'sourceType', 'sourceId', 'documentId', 'confidence', 'assignmentBasis', 'sourceIds',
    ...(classified ? ['classification'] : []),
    ...(hasDuplicate ? ['duplicateOf'] : []),
  ], path)
  const sourceType = enumAt(object.sourceType, SOURCE_TYPES, `${path}.sourceType`)
  const documentId = stringAt(object.documentId, `${path}.documentId`)
  const assignment = {
    sourceType,
    sourceId:        stringAt(object.sourceId, `${path}.sourceId`),
    documentId,
    confidence:      enumAt(object.confidence, CONFIDENCES, `${path}.confidence`),
    assignmentBasis: stringList(object.assignmentBasis, `${path}.assignmentBasis`, false),
    sourceIds:       sourceIdsAt(object.sourceIds, sourceType, documentId, `${path}.sourceIds`),
  }
  return {
    ...assignment,
    ...(classified ? { classification: enumAt(object.classification, CLASSIFICATIONS, `${path}.classification`) } : {}),
    ...(hasDuplicate ? { duplicateOf: stringAt(object.duplicateOf, `${path}.duplicateOf`) } : {}),
  }
}

function assertReference(values: string[], expected: Iterable<string> | undefined, path: string): void {
  if (!expected) return
  const valid = new Set(expected)
  values.forEach((value, index) => {
    if (!valid.has(value)) fail(`${path}[${index}]`, `unknown reference ${value}`)
  })
}

function assertExactReferenceSet(actual: string[], expected: Iterable<string> | undefined, path: string): void {
  if (!expected) return
  const expectedSet = new Set(expected)
  if (actual.length !== expectedSet.size || actual.some((id) => !expectedSet.has(id))) fail(path, 'reference set does not match the owning registry')
}

export function parseEarthEvidenceManifest(value: unknown, expectedSourceRevision?: string, references: EarthEvidenceReferences = {}): EarthEvidenceManifest {
  const object = objectAt(value, 'manifest')
  exactKeys(object, ['schemaVersion', 'sourceRevision', 'sourceLockSha256', 'sourcePlan', 'datasetRegistry', 'summary', 'programs', 'documents'], 'manifest')
  if (object.schemaVersion !== 1) fail('manifest.schemaVersion', 'expected schema version 1')
  const sourceRevision = stringAt(object.sourceRevision, 'manifest.sourceRevision')
  if (!/^[a-f0-9]{40}$/.test(sourceRevision)) fail('manifest.sourceRevision', 'expected a lowercase Git revision')
  if (expectedSourceRevision && sourceRevision !== expectedSourceRevision) fail('manifest.sourceRevision', 'does not match the source registry')
  const sourcePlan = objectAt(object.sourcePlan, 'manifest.sourcePlan')
  exactKeys(sourcePlan, ['path', 'revision', 'sha256'], 'manifest.sourcePlan')
  const datasetRegistry = objectAt(object.datasetRegistry, 'manifest.datasetRegistry')
  exactKeys(datasetRegistry, ['sha256'], 'manifest.datasetRegistry')
  const summary = objectAt(object.summary, 'manifest.summary')
  exactKeys(summary, ['programs', 'documents', 'assignments', 'canonicalProgramAssignments', 'classifiedAssignments', 'datasets', 'disputedClaims', 'classifications'], 'manifest.summary')
  const parsedSummary = {
    programs:                    integerAt(summary.programs, 'manifest.summary.programs'),
    documents:                   integerAt(summary.documents, 'manifest.summary.documents'),
    assignments:                 integerAt(summary.assignments, 'manifest.summary.assignments'),
    canonicalProgramAssignments: integerAt(summary.canonicalProgramAssignments, 'manifest.summary.canonicalProgramAssignments'),
    classifiedAssignments:       integerAt(summary.classifiedAssignments, 'manifest.summary.classifiedAssignments'),
    datasets:                    integerAt(summary.datasets, 'manifest.summary.datasets'),
    disputedClaims:              integerAt(summary.disputedClaims, 'manifest.summary.disputedClaims'),
    classifications:             classificationCountsAt(summary.classifications, 'manifest.summary.classifications'),
  }
  if (JSON.stringify(parsedSummary) !== JSON.stringify({
    programs: 130, documents: 63, assignments: 2422, canonicalProgramAssignments: 1984, classifiedAssignments: 438,
    datasets: 19, disputedClaims: 4, classifications: { duplicate: 432, 'blocked-source-fragment': 1, 'non-scientific-example': 5 },
  })) fail('manifest.summary', 'does not match the exact evidence census')
  if (!Array.isArray(object.programs) || object.programs.length !== 130) fail('manifest.programs', 'expected 130 program shard records')
  if (!Array.isArray(object.documents) || object.documents.length !== 63) fail('manifest.documents', 'expected 63 document shard records')
  const programs = object.programs.map((value, index): EarthEvidenceProgramIndexRecord => {
    const path = `manifest.programs[${index}]`
    const item = objectAt(value, path)
    exactKeys(item, ['id', 'dataUrl', 'counts', 'linkedDocuments', 'linkedDatasets', 'disputedClaims'], path)
    const id = stringAt(item.id, `${path}.id`)
    const dataUrl = stringAt(item.dataUrl, `${path}.dataUrl`)
    if (dataUrl !== `/data/generated/earth/evidence/programs/${id}.json`) fail(`${path}.dataUrl`, 'does not match program ID')
    return {
      id,
      dataUrl,
      counts:          countsAt(item.counts, `${path}.counts`),
      linkedDocuments: integerAt(item.linkedDocuments, `${path}.linkedDocuments`),
      linkedDatasets:  integerAt(item.linkedDatasets, `${path}.linkedDatasets`),
      disputedClaims:  integerAt(item.disputedClaims, `${path}.disputedClaims`),
    }
  })
  const documents = object.documents.map((value, index): EarthEvidenceDocumentIndexRecord => {
    const path = `manifest.documents[${index}]`
    const item = objectAt(value, path)
    exactKeys(item, ['id', 'slug', 'dataUrl', 'relatedCanonicalPrograms', 'coverageAssignments', 'simulationCandidates', 'diagnostics'], path)
    const slug = stringAt(item.slug, `${path}.slug`)
    const dataUrl = stringAt(item.dataUrl, `${path}.dataUrl`)
    if (dataUrl !== `/data/generated/earth/evidence/documents/${slug}.json`) fail(`${path}.dataUrl`, 'does not match document slug')
    return {
      id:                       stringAt(item.id, `${path}.id`),
      slug,
      dataUrl,
      relatedCanonicalPrograms: integerAt(item.relatedCanonicalPrograms, `${path}.relatedCanonicalPrograms`),
      coverageAssignments:      integerAt(item.coverageAssignments, `${path}.coverageAssignments`),
      simulationCandidates:     integerAt(item.simulationCandidates, `${path}.simulationCandidates`),
      diagnostics:              integerAt(item.diagnostics, `${path}.diagnostics`),
    }
  })
  if (new Set(programs.map(({ id }) => id)).size !== 130) fail('manifest.programs', 'program IDs must be unique')
  if (new Set(documents.map(({ id }) => id)).size !== 63 || new Set(documents.map(({ slug }) => slug)).size !== 63) fail('manifest.documents', 'document IDs and slugs must be unique')
  assertExactReferenceSet(programs.map(({ id }) => id), references.programIds, 'manifest.programs')
  assertExactReferenceSet(documents.map(({ id }) => id), references.documentIds, 'manifest.documents')
  return {
    schemaVersion: 1,
    sourceRevision,
    sourceLockSha256: sha256At(object.sourceLockSha256, 'manifest.sourceLockSha256'),
    sourcePlan: {
      path:     stringAt(sourcePlan.path, 'manifest.sourcePlan.path'),
      revision: stringAt(sourcePlan.revision, 'manifest.sourcePlan.revision'),
      sha256:   sha256At(sourcePlan.sha256, 'manifest.sourcePlan.sha256'),
    },
    datasetRegistry: { sha256: sha256At(datasetRegistry.sha256, 'manifest.datasetRegistry.sha256') },
    summary: parsedSummary,
    programs,
    documents,
  }
}

export function parseEarthProgramEvidence(value: unknown, entry: EarthEvidenceProgramIndexRecord, manifest: EarthEvidenceManifest, references: EarthEvidenceReferences = {}): EarthProgramEvidenceShard {
  const object = objectAt(value, 'program evidence')
  exactKeys(object, ['schemaVersion', 'sourceRevision', 'sourcePlanSha256', 'programId', 'counts', 'linkedDocumentIds', 'linkedDatasetIds', 'disputedClaimIds', 'assignments'], 'program evidence')
  if (object.schemaVersion !== 1) fail('program evidence.schemaVersion', 'expected schema version 1')
  if (object.sourceRevision !== manifest.sourceRevision) fail('program evidence.sourceRevision', 'does not match evidence manifest')
  if (object.sourcePlanSha256 !== manifest.sourcePlan.sha256) fail('program evidence.sourcePlanSha256', 'does not match evidence manifest')
  const programId = stringAt(object.programId, 'program evidence.programId')
  if (programId !== entry.id) fail('program evidence.programId', 'does not match requested program')
  const counts = countsAt(object.counts, 'program evidence.counts')
  const linkedDocumentIds = stringList(object.linkedDocumentIds, 'program evidence.linkedDocumentIds')
  const linkedDatasetIds = stringList(object.linkedDatasetIds, 'program evidence.linkedDatasetIds')
  const disputedClaimIds = stringList(object.disputedClaimIds, 'program evidence.disputedClaimIds')
  if (!Array.isArray(object.assignments)) fail('program evidence.assignments', 'expected an array')
  const assignments = object.assignments.map((assignment, index) => assignmentAt(assignment, `program evidence.assignments[${index}]`, false)) as EarthEvidenceAssignment[]
  if (new Set(assignments.map(({ sourceId }) => sourceId)).size !== assignments.length) fail('program evidence.assignments', 'source IDs must be unique')
  const computedCounts = {
    total: assignments.length,
    bySourceType: Object.fromEntries(SOURCE_TYPES.map((key) => [key, assignments.filter(({ sourceType }) => sourceType === key).length])),
    byConfidence: Object.fromEntries(CONFIDENCES.map((key) => [key, assignments.filter(({ confidence }) => confidence === key).length])),
  }
  if (JSON.stringify(counts) !== JSON.stringify(computedCounts) || JSON.stringify(counts) !== JSON.stringify(entry.counts)) fail('program evidence.counts', 'does not match assignments and manifest')
  if (linkedDocumentIds.length !== entry.linkedDocuments || linkedDatasetIds.length !== entry.linkedDatasets || disputedClaimIds.length !== entry.disputedClaims) fail('program evidence', 'linked reference counts do not match manifest')
  const documentIds = references.documentIds ? [...references.documentIds] : manifest.documents.map(({ id }) => id)
  assertReference(linkedDocumentIds, documentIds, 'program evidence.linkedDocumentIds')
  assertReference(assignments.map(({ documentId }) => documentId), documentIds, 'program evidence.assignments.documentId')
  assertReference(linkedDatasetIds, references.datasetIds, 'program evidence.linkedDatasetIds')
  assertReference(disputedClaimIds, references.disputedClaimIds, 'program evidence.disputedClaimIds')
  return { schemaVersion: 1, sourceRevision: manifest.sourceRevision, sourcePlanSha256: manifest.sourcePlan.sha256, programId, counts, linkedDocumentIds, linkedDatasetIds, disputedClaimIds, assignments }
}

export function parseEarthDocumentEvidence(value: unknown, entry: EarthEvidenceDocumentIndexRecord, manifest: EarthEvidenceManifest): EarthDocumentEvidenceShard {
  const object = objectAt(value, 'document evidence')
  exactKeys(object, ['schemaVersion', 'sourceRevision', 'sourcePlanSha256', 'document', 'summary', 'canonicalPrograms', 'classifiedRecords'], 'document evidence')
  if (object.schemaVersion !== 1) fail('document evidence.schemaVersion', 'expected schema version 1')
  if (object.sourceRevision !== manifest.sourceRevision) fail('document evidence.sourceRevision', 'does not match evidence manifest')
  if (object.sourcePlanSha256 !== manifest.sourcePlan.sha256) fail('document evidence.sourcePlanSha256', 'does not match evidence manifest')
  const document = objectAt(object.document, 'document evidence.document')
  exactKeys(document, ['id', 'slug', 'title'], 'document evidence.document')
  const parsedDocument = {
    id:    stringAt(document.id, 'document evidence.document.id'),
    slug:  stringAt(document.slug, 'document evidence.document.slug'),
    title: stringAt(document.title, 'document evidence.document.title'),
  }
  if (parsedDocument.id !== entry.id || parsedDocument.slug !== entry.slug) fail('document evidence.document', 'does not match requested document')
  if (!Array.isArray(object.canonicalPrograms)) fail('document evidence.canonicalPrograms', 'expected an array')
  const programIds = new Set(manifest.programs.map(({ id }) => id))
  const canonicalPrograms = object.canonicalPrograms.map((value, index) => {
    const path = `document evidence.canonicalPrograms[${index}]`
    const item = objectAt(value, path)
    exactKeys(item, ['programId', 'counts'], path)
    const programId = stringAt(item.programId, `${path}.programId`)
    if (!programIds.has(programId)) fail(`${path}.programId`, `unknown reference ${programId}`)
    return { programId, counts: countsAt(item.counts, `${path}.counts`) }
  })
  if (new Set(canonicalPrograms.map(({ programId }) => programId)).size !== canonicalPrograms.length) fail('document evidence.canonicalPrograms', 'program IDs must be unique')
  if (!Array.isArray(object.classifiedRecords)) fail('document evidence.classifiedRecords', 'expected an array')
  const classifiedRecords = object.classifiedRecords.map((value, index) => assignmentAt(value, `document evidence.classifiedRecords[${index}]`, true)) as EarthDocumentEvidenceShard['classifiedRecords']
  if (classifiedRecords.some(({ documentId }) => documentId !== entry.id)) fail('document evidence.classifiedRecords', 'contains a record from another document')
  if (new Set(classifiedRecords.map(({ sourceId }) => sourceId)).size !== classifiedRecords.length) fail('document evidence.classifiedRecords', 'source IDs must be unique')
  const summary = objectAt(object.summary, 'document evidence.summary')
  exactKeys(summary, ['coverageAssignments', 'canonicalProgramAssignments', 'classifiedAssignments', 'relatedCanonicalPrograms', 'classificationCounts'], 'document evidence.summary')
  const parsedSummary = {
    coverageAssignments:         integerAt(summary.coverageAssignments, 'document evidence.summary.coverageAssignments'),
    canonicalProgramAssignments: integerAt(summary.canonicalProgramAssignments, 'document evidence.summary.canonicalProgramAssignments'),
    classifiedAssignments:       integerAt(summary.classifiedAssignments, 'document evidence.summary.classifiedAssignments'),
    relatedCanonicalPrograms:    integerAt(summary.relatedCanonicalPrograms, 'document evidence.summary.relatedCanonicalPrograms'),
    classificationCounts:        classificationCountsAt(summary.classificationCounts, 'document evidence.summary.classificationCounts'),
  }
  const canonicalAssignmentCount = canonicalPrograms.reduce((total, program) => total + program.counts.total, 0)
  const classificationCounts = Object.fromEntries(CLASSIFICATIONS.map((key) => [key, classifiedRecords.filter(({ classification }) => classification === key).length]))
  if (parsedSummary.canonicalProgramAssignments !== canonicalAssignmentCount
    || parsedSummary.classifiedAssignments !== classifiedRecords.length
    || parsedSummary.coverageAssignments !== canonicalAssignmentCount + classifiedRecords.length
    || parsedSummary.relatedCanonicalPrograms !== canonicalPrograms.length
    || JSON.stringify(parsedSummary.classificationCounts) !== JSON.stringify(classificationCounts)) fail('document evidence.summary', 'does not match shard records')
  if (parsedSummary.coverageAssignments !== entry.coverageAssignments || parsedSummary.relatedCanonicalPrograms !== entry.relatedCanonicalPrograms) fail('document evidence.summary', 'does not match evidence manifest')
  return { schemaVersion: 1, sourceRevision: manifest.sourceRevision, sourcePlanSha256: manifest.sourcePlan.sha256, document: parsedDocument, summary: parsedSummary, canonicalPrograms, classifiedRecords }
}

function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}

async function readJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(dataUrl(path), { signal })
  if (!response.ok) throw new Error(`EARTH evidence failed to load (${response.status})`)
  return response.json() as Promise<unknown>
}

export async function loadEarthEvidenceManifest(expectedSourceRevision?: string, references: EarthEvidenceReferences = {}, signal?: AbortSignal): Promise<EarthEvidenceManifest> {
  return parseEarthEvidenceManifest(await readJson('/data/generated/earth/evidence/manifest.json', signal), expectedSourceRevision, references)
}

export async function loadEarthProgramEvidence(entry: EarthEvidenceProgramIndexRecord, manifest: EarthEvidenceManifest, references: EarthEvidenceReferences = {}, signal?: AbortSignal): Promise<EarthProgramEvidenceShard> {
  return parseEarthProgramEvidence(await readJson(entry.dataUrl, signal), entry, manifest, references)
}

export async function loadEarthDocumentEvidence(entry: EarthEvidenceDocumentIndexRecord, manifest: EarthEvidenceManifest, signal?: AbortSignal): Promise<EarthDocumentEvidenceShard> {
  return parseEarthDocumentEvidence(await readJson(entry.dataUrl, signal), entry, manifest)
}
