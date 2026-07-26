export type DatasetAccessClass = 'open-web' | 'open-api' | 'registration' | 'controlled'
export type DatasetRedistributionMode = 'raw' | 'derived-only' | 'metadata-only' | 'prohibited' | 'unknown'
export type DatasetAuthenticationStatus = 'authenticated/acquisition-ready' | 'authenticated/live-unfrozen' | 'authenticated/terms-blocked'
export type DatasetPriority = 'P0' | 'P1' | 'P2'
export type DatasetG0bState = 'pending' | 'blocked'
export type DisputedClaimStatus = 'unverified-source' | 'nonexistent-as-claimed'

interface SourcePlanIntegrity {
  path: string
  revision: string
  sha256: string
}

interface SourceRegistryIntegrity {
  path: string
  reviewDate: string
  sha256: string
}

export interface EarthDatasetRecord {
  datasetId: string
  name: string
  category: string
  sourceLine: number
  canonicalSourceEvidence: string
  sourceUrl: string
  sourceUrls: string[]
  sourceDoi: string | null
  sourceDois: string[]
  ownerReleaseEvidence: string
  responsibleOrganization: string
  releaseEvidence: string
  accessClass: DatasetAccessClass
  accessClasses: DatasetAccessClass[]
  termsUrl: string
  redistributionMode: DatasetRedistributionMode
  redistributionEvidence: string
  personalData: boolean
  personalDataEvidence: string
  requiresControlledHandling: boolean
  dataHandling: 'source-terms' | 'controlled-local-only'
  simulationIds: string[]
  metadataAuthenticated: true
  authenticationStatus: DatasetAuthenticationStatus
  authenticationStatuses: DatasetAuthenticationStatus[]
  authenticationEvidence: string
  priority: DatasetPriority
  blockerEvidence: string
  blockers: string[]
  acquisitionStatus: 'not-acquired'
  frozen: false
  retrievedAt: null
  queryOrSelection: null
  rowCount: null
  byteCount: null
  sha256: null
  g0bState: DatasetG0bState
}

export interface EarthDisputedClaim {
  claimId: string
  claim: string
  sourceLine: number
  finding: string
  registryStatus: DisputedClaimStatus
  consequence: string
  simulationIds: string[]
}

export interface EarthDatasetSummary {
  sourceRows: number
  registered: number
  disputedClaims: number
  metadataAuthenticated: number
  dataAcquired: number
  dataFrozen: number
  g0bPending: number
  g0bBlocked: number
  personalData: number
  controlledAccess: number
  controlledHandling: number
  byPriority: Record<DatasetPriority, number>
  byRedistributionMode: Record<DatasetRedistributionMode, number>
}

export interface EarthDatasetRegistry {
  schemaVersion: 1
  sourcePlan: SourcePlanIntegrity
  sourceRegistry: SourceRegistryIntegrity
  policy: {
    metadataAuthenticationDoesNotImplyAcquisition: true
    datasetBytesAcquired: false
    g0bPassed: false
  }
  summary: EarthDatasetSummary
  datasets: EarthDatasetRecord[]
  disputedClaims: EarthDisputedClaim[]
}

const REGISTRY_KEYS = ['schemaVersion', 'sourcePlan', 'sourceRegistry', 'policy', 'summary', 'datasets', 'disputedClaims'] as const
const DATASET_KEYS = [
  'datasetId', 'name', 'category', 'sourceLine', 'canonicalSourceEvidence', 'sourceUrl', 'sourceUrls', 'sourceDoi',
  'sourceDois', 'ownerReleaseEvidence', 'responsibleOrganization', 'releaseEvidence', 'accessClass', 'accessClasses',
  'termsUrl', 'redistributionMode', 'redistributionEvidence', 'personalData', 'personalDataEvidence',
  'requiresControlledHandling', 'dataHandling', 'simulationIds', 'metadataAuthenticated', 'authenticationStatus',
  'authenticationStatuses', 'authenticationEvidence', 'priority', 'blockerEvidence', 'blockers', 'acquisitionStatus',
  'frozen', 'retrievedAt', 'queryOrSelection', 'rowCount', 'byteCount', 'sha256', 'g0bState',
] as const
const DISPUTE_KEYS = ['claimId', 'claim', 'sourceLine', 'finding', 'registryStatus', 'consequence', 'simulationIds'] as const
const SUMMARY_KEYS = [
  'sourceRows', 'registered', 'disputedClaims', 'metadataAuthenticated', 'dataAcquired', 'dataFrozen', 'g0bPending',
  'g0bBlocked', 'personalData', 'controlledAccess', 'controlledHandling', 'byPriority', 'byRedistributionMode',
] as const
const ACCESS_CLASSES = ['open-web', 'open-api', 'registration', 'controlled'] as const
const REDISTRIBUTION_MODES = ['raw', 'derived-only', 'metadata-only', 'prohibited', 'unknown'] as const
const AUTHENTICATION_STATUSES = ['authenticated/acquisition-ready', 'authenticated/live-unfrozen', 'authenticated/terms-blocked'] as const
const PRIORITIES = ['P0', 'P1', 'P2'] as const
const G0B_STATES = ['pending', 'blocked'] as const
const DISPUTE_STATUSES = ['unverified-source', 'nonexistent-as-claimed'] as const

function fail(path: string, message: string): never {
  throw new Error(`EARTH dataset registry integrity error at ${path}: ${message}`)
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'expected an object')
  return value as Record<string, unknown>
}

function exactKeys(object: Record<string, unknown>, expected: readonly string[], path: string): void {
  const keys = Object.keys(object).sort()
  const expectedKeys = [...expected].sort()
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    fail(path, `expected exactly these fields: ${expected.join(', ')}`)
  }
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(path, 'expected a non-empty string')
  return value
}

function positiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) fail(path, 'expected a positive integer')
  return value
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) fail(path, 'expected a non-negative integer')
  return value
}

function literal<T>(value: unknown, expected: T, path: string): T {
  if (value !== expected) fail(path, `expected ${String(expected)}`)
  return expected
}

function enumAt<const T extends readonly string[]>(value: unknown, allowed: T, path: string): T[number] {
  const item = nonEmptyString(value, path)
  if (!allowed.includes(item)) fail(path, `expected one of: ${allowed.join(', ')}`)
  return item as T[number]
}

function uniqueList<T>(value: unknown, path: string, itemAt: (item: unknown, path: string) => T, allowEmpty = false): T[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) fail(path, `expected ${allowEmpty ? 'an' : 'a non-empty'} array`)
  const items = value.map((item, index) => itemAt(item, `${path}[${index}]`))
  if (new Set(items).size !== items.length) fail(path, 'contains duplicate values')
  return items
}

function httpsUrl(value: unknown, path: string): string {
  const url = nonEmptyString(value, path)
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error()
  } catch {
    fail(path, 'expected an absolute HTTPS URL without credentials')
  }
  return url
}

function sha256(value: unknown, path: string): string {
  const digest = nonEmptyString(value, path)
  if (!/^[a-f0-9]{64}$/.test(digest)) fail(path, 'expected a lowercase SHA256 digest')
  return digest
}

function isoDate(value: unknown, path: string): string {
  const date = nonEmptyString(value, path)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(path, 'expected an ISO date')
  return date
}

function simulationId(value: unknown, path: string): string {
  const id = nonEmptyString(value, path)
  if (!/^EARTH-[A-Z]+-\d{3}$/.test(id)) fail(path, 'expected an EARTH simulation ID')
  return id
}

function sourceIntegrityAt(value: unknown, path: string, registry: boolean): SourcePlanIntegrity | SourceRegistryIntegrity {
  const object = objectAt(value, path)
  exactKeys(object, registry ? ['path', 'reviewDate', 'sha256'] : ['path', 'revision', 'sha256'], path)
  const base = {
    path:   nonEmptyString(object.path, `${path}.path`),
    sha256: sha256(object.sha256, `${path}.sha256`),
  }
  return registry
    ? { ...base, reviewDate: isoDate(object.reviewDate, `${path}.reviewDate`) }
    : { ...base, revision: isoDate(object.revision, `${path}.revision`) }
}

function datasetAt(value: unknown, index: number): EarthDatasetRecord {
  const path = `datasets[${index}]`
  const object = objectAt(value, path)
  exactKeys(object, DATASET_KEYS, path)
  const datasetId = nonEmptyString(object.datasetId, `${path}.datasetId`)
  if (!/^earth-dataset-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(datasetId)) fail(`${path}.datasetId`, 'expected a canonical dataset ID')
  const sourceUrls = uniqueList(object.sourceUrls, `${path}.sourceUrls`, httpsUrl)
  const sourceUrl = httpsUrl(object.sourceUrl, `${path}.sourceUrl`)
  if (!sourceUrls.includes(sourceUrl)) fail(`${path}.sourceUrl`, 'must occur in sourceUrls')
  const sourceDois = uniqueList(object.sourceDois, `${path}.sourceDois`, nonEmptyString, true)
  const sourceDoi = object.sourceDoi === null ? null : nonEmptyString(object.sourceDoi, `${path}.sourceDoi`)
  if ((sourceDoi === null) !== (sourceDois.length === 0) || (sourceDoi && sourceDois[0] !== sourceDoi)) {
    fail(`${path}.sourceDoi`, 'must be the first source DOI, or null when no DOI exists')
  }
  sourceDois.forEach((doi) => {
    if (!sourceUrls.includes(`https://doi.org/${doi}`)) fail(`${path}.sourceDois`, `DOI ${doi} has no source URL`)
  })
  const accessClasses = uniqueList(object.accessClasses, `${path}.accessClasses`, (item, itemPath) => enumAt(item, ACCESS_CLASSES, itemPath))
  const accessClass = enumAt(object.accessClass, ACCESS_CLASSES, `${path}.accessClass`)
  if (accessClasses[0] !== accessClass) fail(`${path}.accessClass`, 'must be the first access class')
  const authenticationStatuses = uniqueList(object.authenticationStatuses, `${path}.authenticationStatuses`, (item, itemPath) => enumAt(item, AUTHENTICATION_STATUSES, itemPath))
  const authenticationStatus = enumAt(object.authenticationStatus, AUTHENTICATION_STATUSES, `${path}.authenticationStatus`)
  if (authenticationStatuses[0] !== authenticationStatus) fail(`${path}.authenticationStatus`, 'must be the first authentication status')
  const personalData = literal(object.personalData, object.personalData === true, `${path}.personalData`)
  const requiresControlledHandling = literal(object.requiresControlledHandling, personalData, `${path}.requiresControlledHandling`)
  const dataHandling = enumAt(object.dataHandling, ['source-terms', 'controlled-local-only'] as const, `${path}.dataHandling`)
  if ((dataHandling === 'controlled-local-only') !== requiresControlledHandling) fail(`${path}.dataHandling`, 'does not agree with controlled handling')
  const g0bState = enumAt(object.g0bState, G0B_STATES, `${path}.g0bState`)
  const expectedG0bState = authenticationStatuses.includes('authenticated/terms-blocked') ? 'blocked' : 'pending'
  if (g0bState !== expectedG0bState) fail(`${path}.g0bState`, 'does not agree with authentication statuses')

  return {
    datasetId,
    name:                       nonEmptyString(object.name, `${path}.name`),
    category:                   nonEmptyString(object.category, `${path}.category`),
    sourceLine:                 positiveInteger(object.sourceLine, `${path}.sourceLine`),
    canonicalSourceEvidence:    nonEmptyString(object.canonicalSourceEvidence, `${path}.canonicalSourceEvidence`),
    sourceUrl,
    sourceUrls,
    sourceDoi,
    sourceDois,
    ownerReleaseEvidence:       nonEmptyString(object.ownerReleaseEvidence, `${path}.ownerReleaseEvidence`),
    responsibleOrganization:    nonEmptyString(object.responsibleOrganization, `${path}.responsibleOrganization`),
    releaseEvidence:            nonEmptyString(object.releaseEvidence, `${path}.releaseEvidence`),
    accessClass,
    accessClasses,
    termsUrl:                   httpsUrl(object.termsUrl, `${path}.termsUrl`),
    redistributionMode:         enumAt(object.redistributionMode, REDISTRIBUTION_MODES, `${path}.redistributionMode`),
    redistributionEvidence:     nonEmptyString(object.redistributionEvidence, `${path}.redistributionEvidence`),
    personalData,
    personalDataEvidence:       nonEmptyString(object.personalDataEvidence, `${path}.personalDataEvidence`),
    requiresControlledHandling,
    dataHandling,
    simulationIds:              uniqueList(object.simulationIds, `${path}.simulationIds`, simulationId),
    metadataAuthenticated:      literal(object.metadataAuthenticated, true, `${path}.metadataAuthenticated`),
    authenticationStatus,
    authenticationStatuses,
    authenticationEvidence:     nonEmptyString(object.authenticationEvidence, `${path}.authenticationEvidence`),
    priority:                   enumAt(object.priority, PRIORITIES, `${path}.priority`),
    blockerEvidence:            nonEmptyString(object.blockerEvidence, `${path}.blockerEvidence`),
    blockers:                   uniqueList(object.blockers, `${path}.blockers`, nonEmptyString),
    acquisitionStatus:          literal(object.acquisitionStatus, 'not-acquired', `${path}.acquisitionStatus`),
    frozen:                     literal(object.frozen, false, `${path}.frozen`),
    retrievedAt:                literal(object.retrievedAt, null, `${path}.retrievedAt`),
    queryOrSelection:           literal(object.queryOrSelection, null, `${path}.queryOrSelection`),
    rowCount:                   literal(object.rowCount, null, `${path}.rowCount`),
    byteCount:                  literal(object.byteCount, null, `${path}.byteCount`),
    sha256:                     literal(object.sha256, null, `${path}.sha256`),
    g0bState,
  }
}

function disputeAt(value: unknown, index: number): EarthDisputedClaim {
  const path = `disputedClaims[${index}]`
  const object = objectAt(value, path)
  exactKeys(object, DISPUTE_KEYS, path)
  const claimId = nonEmptyString(object.claimId, `${path}.claimId`)
  if (!/^earth-dispute-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(claimId)) fail(`${path}.claimId`, 'expected a canonical dispute ID')
  return {
    claimId,
    claim:          nonEmptyString(object.claim, `${path}.claim`),
    sourceLine:     positiveInteger(object.sourceLine, `${path}.sourceLine`),
    finding:        nonEmptyString(object.finding, `${path}.finding`),
    registryStatus: enumAt(object.registryStatus, DISPUTE_STATUSES, `${path}.registryStatus`),
    consequence:    nonEmptyString(object.consequence, `${path}.consequence`),
    simulationIds:  uniqueList(object.simulationIds, `${path}.simulationIds`, simulationId, true),
  }
}

function countBy<T extends string>(values: T[], keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, values.filter((value) => value === key).length])) as Record<T, number>
}

function summaryAt(value: unknown): EarthDatasetSummary {
  const object = objectAt(value, 'summary')
  exactKeys(object, SUMMARY_KEYS, 'summary')
  const priority = objectAt(object.byPriority, 'summary.byPriority')
  const redistribution = objectAt(object.byRedistributionMode, 'summary.byRedistributionMode')
  exactKeys(priority, PRIORITIES, 'summary.byPriority')
  exactKeys(redistribution, REDISTRIBUTION_MODES, 'summary.byRedistributionMode')
  return {
    sourceRows:          nonNegativeInteger(object.sourceRows, 'summary.sourceRows'),
    registered:          nonNegativeInteger(object.registered, 'summary.registered'),
    disputedClaims:      nonNegativeInteger(object.disputedClaims, 'summary.disputedClaims'),
    metadataAuthenticated: nonNegativeInteger(object.metadataAuthenticated, 'summary.metadataAuthenticated'),
    dataAcquired:        nonNegativeInteger(object.dataAcquired, 'summary.dataAcquired'),
    dataFrozen:          nonNegativeInteger(object.dataFrozen, 'summary.dataFrozen'),
    g0bPending:          nonNegativeInteger(object.g0bPending, 'summary.g0bPending'),
    g0bBlocked:          nonNegativeInteger(object.g0bBlocked, 'summary.g0bBlocked'),
    personalData:        nonNegativeInteger(object.personalData, 'summary.personalData'),
    controlledAccess:    nonNegativeInteger(object.controlledAccess, 'summary.controlledAccess'),
    controlledHandling:  nonNegativeInteger(object.controlledHandling, 'summary.controlledHandling'),
    byPriority:          Object.fromEntries(PRIORITIES.map((key) => [key, nonNegativeInteger(priority[key], `summary.byPriority.${key}`)])) as Record<DatasetPriority, number>,
    byRedistributionMode: Object.fromEntries(REDISTRIBUTION_MODES.map((key) => [key, nonNegativeInteger(redistribution[key], `summary.byRedistributionMode.${key}`)])) as Record<DatasetRedistributionMode, number>,
  }
}

export function parseEarthDatasetRegistry(value: unknown): EarthDatasetRegistry {
  const object = objectAt(value, 'registry')
  exactKeys(object, REGISTRY_KEYS, 'registry')
  literal(object.schemaVersion, 1, 'registry.schemaVersion')
  if (!Array.isArray(object.datasets) || object.datasets.length !== 19) {
    fail('datasets', `expected 19 records, received ${Array.isArray(object.datasets) ? object.datasets.length : 'non-array'}`)
  }
  if (!Array.isArray(object.disputedClaims) || object.disputedClaims.length !== 4) {
    fail('disputedClaims', `expected 4 claims, received ${Array.isArray(object.disputedClaims) ? object.disputedClaims.length : 'non-array'}`)
  }
  const datasets = object.datasets.map(datasetAt)
  const disputedClaims = object.disputedClaims.map(disputeAt)
  if (new Set(datasets.map(({ datasetId }) => datasetId)).size !== datasets.length) fail('datasets', 'dataset IDs must be unique')
  if (new Set(disputedClaims.map(({ claimId }) => claimId)).size !== disputedClaims.length) fail('disputedClaims', 'claim IDs must be unique')
  const summary = summaryAt(object.summary)
  const computedSummary: EarthDatasetSummary = {
    sourceRows:            19,
    registered:            datasets.length,
    disputedClaims:        disputedClaims.length,
    metadataAuthenticated: datasets.filter(({ metadataAuthenticated }) => metadataAuthenticated).length,
    dataAcquired:          0,
    dataFrozen:            datasets.filter(({ frozen }) => frozen).length,
    g0bPending:            datasets.filter(({ g0bState }) => g0bState === 'pending').length,
    g0bBlocked:            datasets.filter(({ g0bState }) => g0bState === 'blocked').length,
    personalData:          datasets.filter(({ personalData }) => personalData).length,
    controlledAccess:      datasets.filter(({ accessClasses }) => accessClasses.includes('controlled')).length,
    controlledHandling:    datasets.filter(({ requiresControlledHandling }) => requiresControlledHandling).length,
    byPriority:            countBy(datasets.map(({ priority }) => priority), PRIORITIES),
    byRedistributionMode:  countBy(datasets.map(({ redistributionMode }) => redistributionMode), REDISTRIBUTION_MODES),
  }
  if (JSON.stringify(summary) !== JSON.stringify(computedSummary)) fail('summary', 'does not match the validated records')
  const policy = objectAt(object.policy, 'policy')
  exactKeys(policy, ['metadataAuthenticationDoesNotImplyAcquisition', 'datasetBytesAcquired', 'g0bPassed'], 'policy')
  const parsedPolicy = {
    metadataAuthenticationDoesNotImplyAcquisition: literal(policy.metadataAuthenticationDoesNotImplyAcquisition, true, 'policy.metadataAuthenticationDoesNotImplyAcquisition'),
    datasetBytesAcquired:                         literal(policy.datasetBytesAcquired, false, 'policy.datasetBytesAcquired'),
    g0bPassed:                                    literal(policy.g0bPassed, false, 'policy.g0bPassed'),
  } as const
  return {
    schemaVersion: 1,
    sourcePlan:     sourceIntegrityAt(object.sourcePlan, 'sourcePlan', false) as SourcePlanIntegrity,
    sourceRegistry: sourceIntegrityAt(object.sourceRegistry, 'sourceRegistry', true) as SourceRegistryIntegrity,
    policy:         parsedPolicy,
    summary,
    datasets,
    disputedClaims,
  }
}

function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}

export async function loadEarthDatasetRegistry(signal?: AbortSignal): Promise<EarthDatasetRegistry> {
  const response = await fetch(dataUrl('/data/generated/earth/datasets.json'), { signal })
  if (!response.ok) throw new Error(`EARTH dataset registry failed to load (${response.status})`)
  return parseEarthDatasetRegistry(await response.json())
}
