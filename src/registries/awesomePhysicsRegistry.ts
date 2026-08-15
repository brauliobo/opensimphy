import { readonly, shallowRef } from 'vue'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsArtifactProvenanceV1,
  AwesomePhysicsAvailability,
  AwesomePhysicsCatalogArtifactV1,
  AwesomePhysicsCatalogItemV1,
  AwesomePhysicsCatalogSummaryV1,
  AwesomePhysicsEvidenceV1,
  AwesomePhysicsExecutionKind,
  AwesomePhysicsLicenseGate,
  AwesomePhysicsLicenseStatus,
  AwesomePhysicsLimitsV1,
  AwesomePhysicsLinkV1,
  AwesomePhysicsMaintenance,
  AwesomePhysicsModelOrigin,
  AwesomePhysicsOrganizationV1,
  AwesomePhysicsPriority,
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
  AwesomePhysicsSimulationSummaryV1,
  AwesomePhysicsSourceKind,
} from '../types/awesomePhysics'

type UnknownRecord = Record<string, unknown>
type AdapterFactory = AwesomePhysicsAdapterFactoryV1

export interface AwesomePhysicsRegistryArtifactsV1 {
  catalog: AwesomePhysicsCatalogArtifactV1
  simulations: AwesomePhysicsSimulationArtifactV1
}

export interface AwesomePhysicsRegistryFixtureV1 extends AwesomePhysicsRegistryArtifactsV1 {
  adapterFactories?: ReadonlyMap<string, AdapterFactory>
}

const CATALOG_URL = `${import.meta.env.BASE_URL}data/generated/awesomePhysics/catalog.json`
const SIMULATIONS_URL = `${import.meta.env.BASE_URL}data/generated/awesomePhysics/simulations.json`
const EXECUTION_KINDS: readonly AwesomePhysicsExecutionKind[] = [
  'browser',
  'wasm',
  'wasm-candidate',
  'typescript',
  'artifact',
  'reference',
  'blocked',
]
const SOURCE_KINDS: readonly AwesomePhysicsSourceKind[] = ['repository', 'documentation', 'archive', 'organization']
const AVAILABILITIES: readonly AwesomePhysicsAvailability[] = ['available', 'unavailable', 'blocked']
const LICENSE_STATUSES: readonly AwesomePhysicsLicenseStatus[] = ['verified', 'unclear', 'restricted', 'missing']
const LICENSE_GATES: readonly AwesomePhysicsLicenseGate[] = ['pass', 'review', 'blocked']
const MAINTENANCE_STATES: readonly AwesomePhysicsMaintenance[] = ['active', 'stale', 'archived', 'unknown']
const MODEL_ORIGINS: readonly AwesomePhysicsModelOrigin[] = [
  'upstream-adaptation',
  'educational-reimplementation',
  'source-artifact',
  'reference-only',
]
const PRIORITIES: readonly AwesomePhysicsPriority[] = ['P0', 'P1', 'P2', 'P3']
const CATALOG_SUMMARY_KEYS: readonly (keyof AwesomePhysicsCatalogSummaryV1)[] = [
  'totalEntries',
  'projectEntries',
  'archiveEntries',
  'organizationEntries',
  'clonedRepositories',
  'failedAccessEntries',
  'documentationAliases',
]
const LIMIT_KEYS: readonly (keyof AwesomePhysicsLimitsV1)[] = [
  'maxGridSize',
  'maxParticles',
  'maxIterations',
  'maxMemoryBytes',
  'maxWorkerTimeMs',
  'maxOutputBytes',
]
const SIMULATION_SUMMARY_KEYS: readonly (keyof AwesomePhysicsSimulationSummaryV1)[] = [
  'sourceCapabilities',
  'runnable',
  'available',
  'unavailable',
  'blocked',
  'adapterCount',
  'executionKinds',
]
const ADAPTER_COMPATIBILITY_KEYS: readonly (keyof AwesomePhysicsAdapterCompatibilityV1)[] = [
  'contentRevision',
  'modelRevision',
  'implementationRevision',
  'outputRevision',
]

const catalog = shallowRef<AwesomePhysicsCatalogArtifactV1 | null>(null)
const simulations = shallowRef<AwesomePhysicsSimulationArtifactV1 | null>(null)
const ready = shallowRef(false)
const error = shallowRef<Error | null>(null)
const catalogItemsById = new Map<string, AwesomePhysicsCatalogItemV1>()
const descriptorsById = new Map<string, AwesomePhysicsSimulationDescriptorV1>()
const descriptorsByCatalogItemId = new Map<string, AwesomePhysicsSimulationDescriptorV1>()
const adapterFactories = new Map<string, AdapterFactory>()
let initialization: Promise<void> | null = null
let controller: AbortController | null = null
let generation = 0

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(path: string, message: string): never {
  throw new TypeError(`${path} ${message}`)
}

function requireRecord(value: unknown, path: string): asserts value is UnknownRecord {
  if (!isRecord(value)) fail(path, 'must be an object')
}

function requireExactKeys(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): asserts value is UnknownRecord {
  requireRecord(value, path)
  const allowed = new Set([...required, ...optional])
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  const missing = required.filter((key) => !Object.hasOwn(value, key))
  if (unknown.length > 0) fail(path, `has unknown properties: ${unknown.join(', ')}`)
  if (missing.length > 0) fail(path, `is missing properties: ${missing.join(', ')}`)
}

function requireNonEmptyString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'must be a non-empty string')
}

function requireSafeId(value: unknown, path: string): asserts value is string {
  requireNonEmptyString(value, path)
  if (!/^[A-Za-z0-9_-]+$/.test(value)) fail(path, 'must be a safe ID')
}

function requireStringArray(value: unknown, path: string, nonEmpty = false): asserts value is string[] {
  if (!Array.isArray(value)) fail(path, 'must be an array')
  if (nonEmpty && value.length === 0) fail(path, 'must not be empty')
  value.forEach((entry, index) => requireNonEmptyString(entry, `${path}[${index}]`))
}

function requireUnique(values: readonly string[], path: string): void {
  if (new Set(values).size !== values.length) fail(path, 'must contain unique values')
}

function requireSafeInteger(value: unknown, path: string, minimum = 0): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    fail(path, `must be a safe integer greater than or equal to ${minimum}`)
  }
}

function requireFiniteNonNegative(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) fail(path, 'must be a finite non-negative number')
}

function requireOneOf<T extends string>(value: unknown, values: readonly T[], path: string): asserts value is T {
  if (typeof value !== 'string' || !values.includes(value as T)) fail(path, 'has an unsupported value')
}

function requireDate(value: unknown, path: string): asserts value is string {
  requireNonEmptyString(value, path)
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    fail(path, 'must be an ISO calendar date')
  }
}

function requireRevision(value: unknown, path: string, nullable = false): asserts value is string | null {
  if (nullable && value === null) return
  requireNonEmptyString(value, path)
}

function requireRelativePath(value: unknown, path: string, nullable = false): asserts value is string | null {
  if (nullable && value === null) return
  requireNonEmptyString(value, path)
  if (value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\')) {
    fail(path, 'must be repository-relative')
  }
  if (value.includes('\\') || value.split('/').includes('..')) fail(path, 'must use a safe repository-relative POSIX path')
}

function requireUrl(value: unknown, path: string): asserts value is string {
  requireNonEmptyString(value, path)
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') fail(path, 'must use HTTP or HTTPS')
  } catch (reason) {
    if (reason instanceof TypeError && reason.message.startsWith(path)) throw reason
    fail(path, 'must be a valid HTTP or HTTPS URL')
  }
}

function requireBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== 'boolean') fail(path, 'must be a boolean')
}

function parseSource(value: unknown, path: string): AwesomePhysicsCatalogArtifactV1['source'] {
  requireExactKeys(value, ['catalogPath', 'manifestPath', 'migrationPlanPath', 'acquisitionDate', 'evidenceRefs'], [], path)
  requireRelativePath(value.catalogPath, `${path}.catalogPath`)
  requireRelativePath(value.manifestPath, `${path}.manifestPath`)
  requireRelativePath(value.migrationPlanPath, `${path}.migrationPlanPath`)
  requireDate(value.acquisitionDate, `${path}.acquisitionDate`)
  requireStringArray(value.evidenceRefs, `${path}.evidenceRefs`, true)
  value.evidenceRefs.forEach((reference, index) => requireRelativePath(reference, `${path}.evidenceRefs[${index}]`))
  return value as AwesomePhysicsCatalogArtifactV1['source']
}

function parseLink(value: unknown, path: string): AwesomePhysicsLinkV1 {
  requireExactKeys(value, ['kind', 'label', 'url'], [], path)
  requireNonEmptyString(value.kind, `${path}.kind`)
  requireNonEmptyString(value.label, `${path}.label`)
  requireUrl(value.url, `${path}.url`)
  return value as AwesomePhysicsLinkV1
}

function parseLicense(value: unknown, path: string): AwesomePhysicsCatalogItemV1['license'] {
  requireExactKeys(value, ['status', 'text', 'evidenceRefs'], [], path)
  requireOneOf(value.status, LICENSE_STATUSES, `${path}.status`)
  requireNonEmptyString(value.text, `${path}.text`)
  requireStringArray(value.evidenceRefs, `${path}.evidenceRefs`, true)
  value.evidenceRefs.forEach((reference, index) => requireRelativePath(reference, `${path}.evidenceRefs[${index}]`))
  return value as AwesomePhysicsCatalogItemV1['license']
}

function parseEvidence(value: unknown, path: string): AwesomePhysicsEvidenceV1 {
  requireExactKeys(value, ['sourceRefs', 'licenseRefs', 'maintenanceRefs'], [], path)
  for (const field of ['sourceRefs', 'licenseRefs', 'maintenanceRefs'] as const) {
    requireStringArray(value[field], `${path}.${field}`, true)
    value[field].forEach((reference, index) => requireRelativePath(reference, `${path}.${field}[${index}]`))
  }
  return value as AwesomePhysicsEvidenceV1
}

function parseArtifactProvenance(value: unknown, path: string): AwesomePhysicsArtifactProvenanceV1 {
  requireExactKeys(value, ['sourceRevision', 'acquisitionDate', 'byteSize', 'sha256', 'transformation', 'datasetLicense', 'evidenceRefs'], [], path)
  requireRevision(value.sourceRevision, `${path}.sourceRevision`, true)
  requireDate(value.acquisitionDate, `${path}.acquisitionDate`)
  if (value.byteSize !== null) requireSafeInteger(value.byteSize, `${path}.byteSize`)
  if (value.sha256 !== null) {
    requireNonEmptyString(value.sha256, `${path}.sha256`)
    if (!/^[a-f0-9]{64}$/.test(value.sha256)) fail(`${path}.sha256`, 'must be a lowercase SHA-256 digest or null')
  }
  requireNonEmptyString(value.transformation, `${path}.transformation`)
  if (value.datasetLicense !== null) requireNonEmptyString(value.datasetLicense, `${path}.datasetLicense`)
  requireStringArray(value.evidenceRefs, `${path}.evidenceRefs`, true)
  value.evidenceRefs.forEach((reference, index) => requireRelativePath(reference, `${path}.evidenceRefs[${index}]`))
  return value as AwesomePhysicsArtifactProvenanceV1
}

function parseCatalogItem(value: unknown, index: number, catalogRevision: string): AwesomePhysicsCatalogItemV1 {
  const path = `Awesome Physics catalog.items[${index}]`
  requireExactKeys(value, [
    'id', 'canonicalName', 'aliases', 'category', 'catalogSection', 'title', 'description', 'catalogUrl', 'upstreamUrl',
    'catalogRevision', 'upstreamRevision', 'localPath', 'sourceKind', 'language', 'license', 'maintenance',
    'maintenanceSignal', 'evidence', 'links', 'catalogLine', 'manifestLine', 'planLine', 'access', 'accessFailure',
    'upstreamResolution',
  ], [], path)
  requireSafeId(value.id, `${path}.id`)
  requireNonEmptyString(value.canonicalName, `${path}.canonicalName`)
  requireStringArray(value.aliases, `${path}.aliases`)
  requireUnique(value.aliases, `${path}.aliases`)
  requireNonEmptyString(value.category, `${path}.category`)
  requireNonEmptyString(value.catalogSection, `${path}.catalogSection`)
  requireNonEmptyString(value.title, `${path}.title`)
  requireNonEmptyString(value.description, `${path}.description`)
  requireUrl(value.catalogUrl, `${path}.catalogUrl`)
  requireUrl(value.upstreamUrl, `${path}.upstreamUrl`)
  requireRevision(value.catalogRevision, `${path}.catalogRevision`)
  if (value.catalogRevision !== catalogRevision) fail(`${path}.catalogRevision`, 'must match the catalog revision')
  requireRevision(value.upstreamRevision, `${path}.upstreamRevision`, true)
  requireRelativePath(value.localPath, `${path}.localPath`, true)
  requireOneOf(value.sourceKind, SOURCE_KINDS, `${path}.sourceKind`)
  if (value.sourceKind === 'organization') fail(`${path}.sourceKind`, 'is not valid for a catalog item')
  requireStringArray(value.language, `${path}.language`)
  requireUnique(value.language, `${path}.language`)
  parseLicense(value.license, `${path}.license`)
  requireOneOf(value.maintenance, MAINTENANCE_STATES, `${path}.maintenance`)
  requireNonEmptyString(value.maintenanceSignal, `${path}.maintenanceSignal`)
  parseEvidence(value.evidence, `${path}.evidence`)
  if (!Array.isArray(value.links) || value.links.length === 0) fail(`${path}.links`, 'must be a non-empty array')
  value.links.forEach((link, linkIndex) => parseLink(link, `${path}.links[${linkIndex}]`))
  requireSafeInteger(value.catalogLine, `${path}.catalogLine`, 1)
  if (value.manifestLine !== null) requireSafeInteger(value.manifestLine, `${path}.manifestLine`, 1)
  if (value.planLine !== null) requireSafeInteger(value.planLine, `${path}.planLine`, 1)
  requireExactKeys(value.access, ['status', 'note', 'attemptedOn'], [], `${path}.access`)
  requireOneOf(value.access.status, ['cloned', 'not-cloned', 'archived'], `${path}.access.status`)
  requireNonEmptyString(value.access.note, `${path}.access.note`)
  if (value.access.attemptedOn !== null) requireDate(value.access.attemptedOn, `${path}.access.attemptedOn`)
  if (value.access.status === 'cloned') {
    if (value.localPath === null || value.upstreamRevision === null || value.manifestLine === null) {
      fail(path, 'cloned entries require localPath, upstreamRevision, and manifestLine')
    }
    if (value.access.attemptedOn !== null || value.accessFailure !== null) fail(path, 'cloned entries cannot contain an access failure')
  } else if (value.access.status === 'not-cloned') {
    if (value.localPath !== null || value.upstreamRevision !== null || value.manifestLine === null || value.accessFailure === null) {
      fail(path, 'not-cloned entries require a failed access record and no source path or revision')
    }
    if (value.access.attemptedOn === null) fail(`${path}.access.attemptedOn`, 'is required for not-cloned entries')
  } else if (value.localPath !== null || value.upstreamRevision !== null || value.accessFailure !== null) {
    fail(path, 'archived entries cannot expose a source path, revision, or access failure')
  }
  if (value.accessFailure !== null) {
    requireExactKeys(value.accessFailure, ['attemptedOn', 'observed', 'note'], [], `${path}.accessFailure`)
    requireDate(value.accessFailure.attemptedOn, `${path}.accessFailure.attemptedOn`)
    requireStringArray(value.accessFailure.observed, `${path}.accessFailure.observed`, true)
    requireNonEmptyString(value.accessFailure.note, `${path}.accessFailure.note`)
    if (value.access.attemptedOn !== value.accessFailure.attemptedOn) fail(path, 'access dates must agree')
  }
  if (value.upstreamResolution !== null) {
    requireExactKeys(value.upstreamResolution, ['kind', 'reason', 'catalogUrl', 'canonicalUpstreamUrl'], [], `${path}.upstreamResolution`)
    if (value.upstreamResolution.kind !== 'current-upstream-substitution') fail(`${path}.upstreamResolution.kind`, 'is not recognized')
    requireNonEmptyString(value.upstreamResolution.reason, `${path}.upstreamResolution.reason`)
    requireUrl(value.upstreamResolution.catalogUrl, `${path}.upstreamResolution.catalogUrl`)
    requireUrl(value.upstreamResolution.canonicalUpstreamUrl, `${path}.upstreamResolution.canonicalUpstreamUrl`)
  }
  return value
}

function parseOrganization(value: unknown, index: number): AwesomePhysicsOrganizationV1 {
  const path = `Awesome Physics catalog.organizations[${index}]`
  requireExactKeys(value, ['id', 'title', 'description', 'url', 'sourceKind', 'maintenance', 'status', 'notes', 'evidenceRefs', 'catalogLine'], [], path)
  requireSafeId(value.id, `${path}.id`)
  requireNonEmptyString(value.title, `${path}.title`)
  requireNonEmptyString(value.description, `${path}.description`)
  requireUrl(value.url, `${path}.url`)
  if (value.sourceKind !== 'organization') fail(`${path}.sourceKind`, 'must be organization')
  requireOneOf(value.maintenance, MAINTENANCE_STATES, `${path}.maintenance`)
  requireOneOf(value.status, ['listed', 'review', 'moved', 'official-source-note'], `${path}.status`)
  requireNonEmptyString(value.notes, `${path}.notes`)
  requireStringArray(value.evidenceRefs, `${path}.evidenceRefs`, true)
  value.evidenceRefs.forEach((reference, referenceIndex) => requireRelativePath(reference, `${path}.evidenceRefs[${referenceIndex}]`))
  requireSafeInteger(value.catalogLine, `${path}.catalogLine`, 1)
  return value
}

function parseCatalogSummary(value: unknown, path: string): AwesomePhysicsCatalogSummaryV1 {
  requireExactKeys(value, CATALOG_SUMMARY_KEYS, [], path)
  for (const key of CATALOG_SUMMARY_KEYS) requireSafeInteger(value[key], `${path}.${key}`)
  return value as AwesomePhysicsCatalogSummaryV1
}

function parseCatalog(value: unknown): AwesomePhysicsCatalogArtifactV1 {
  const path = 'Awesome Physics catalog'
  requireExactKeys(value, ['schemaVersion', 'generatedAt', 'catalogRevision', 'source', 'summary', 'items', 'organizations'], [], path)
  if (value.schemaVersion !== 1) fail(`${path}.schemaVersion`, 'must be 1')
  requireDate(value.generatedAt, `${path}.generatedAt`)
  requireNonEmptyString(value.catalogRevision, `${path}.catalogRevision`)
  if (!/^[a-f0-9]{40}$/.test(value.catalogRevision)) fail(`${path}.catalogRevision`, 'must be a lowercase 40-character revision')
  const source = parseSource(value.source, `${path}.source`)
  const summary = parseCatalogSummary(value.summary, `${path}.summary`)
  if (!Array.isArray(value.items) || value.items.length === 0) fail(`${path}.items`, 'must be a non-empty array')
  if (!Array.isArray(value.organizations)) fail(`${path}.organizations`, 'must be an array')
  const items = value.items.map((item, index) => parseCatalogItem(item, index, value.catalogRevision))
  const organizations = value.organizations.map((organization, index) => parseOrganization(organization, index))
  const itemIds = items.map(({ id }) => id)
  const canonicalNames = items.map(({ canonicalName }) => canonicalName)
  const organizationIds = organizations.map(({ id }) => id)
  requireUnique(itemIds, `${path}.items IDs`)
  requireUnique(canonicalNames, `${path}.items canonicalName values`)
  requireUnique(organizationIds, `${path}.organizations IDs`)
  if (new Set([...itemIds, ...organizationIds]).size !== itemIds.length + organizationIds.length) fail(path, 'item and organization IDs must be disjoint')
  const expectedSummary = {
    totalEntries: items.length + organizations.length,
    projectEntries: items.filter(({ sourceKind }) => sourceKind !== 'archive').length,
    archiveEntries: items.filter(({ sourceKind }) => sourceKind === 'archive').length,
    organizationEntries: organizations.length,
    clonedRepositories: items.filter(({ access }) => access.status === 'cloned').length,
    failedAccessEntries: items.filter(({ access }) => access.status === 'not-cloned').length,
    documentationAliases: items.filter(({ sourceKind }) => sourceKind === 'documentation').length,
  }
  for (const key of CATALOG_SUMMARY_KEYS) {
    if (summary[key] !== expectedSummary[key]) fail(`${path}.summary.${key}`, 'does not match the catalog entries')
  }
  if (source.acquisitionDate !== value.generatedAt) fail(`${path}.source.acquisitionDate`, 'must match generatedAt')
  return { schemaVersion: 1, generatedAt: value.generatedAt, catalogRevision: value.catalogRevision, source, summary, items, organizations }
}

function parseLimits(value: unknown, path: string): AwesomePhysicsLimitsV1 {
  requireExactKeys(value, LIMIT_KEYS, [], path)
  for (const key of LIMIT_KEYS) {
    requireFiniteNonNegative(value[key], `${path}.${key}`)
    requireSafeInteger(value[key], `${path}.${key}`)
  }
  return value as AwesomePhysicsLimitsV1
}

function parseSimulationSummary(value: unknown, path: string): AwesomePhysicsSimulationSummaryV1 {
  requireExactKeys(value, SIMULATION_SUMMARY_KEYS, [], path)
  for (const key of SIMULATION_SUMMARY_KEYS.slice(0, -1)) requireSafeInteger(value[key], `${path}.${key}`)
  requireExactKeys(value.executionKinds, EXECUTION_KINDS, [], `${path}.executionKinds`)
  for (const kind of EXECUTION_KINDS) requireSafeInteger(value.executionKinds[kind], `${path}.executionKinds.${kind}`)
  return value as AwesomePhysicsSimulationSummaryV1
}

function parseDescriptor(
  value: unknown,
  index: number,
  catalogItemsById: ReadonlyMap<string, AwesomePhysicsCatalogItemV1>,
  catalogRevision: string,
  acquisitionDate: string,
): AwesomePhysicsSimulationDescriptorV1 {
  const path = `Awesome Physics simulations.items[${index}]`
  requireExactKeys(value, [
    'id', 'catalogItemId', 'title', 'capability', 'execution', 'executionOptions', 'availability', 'runnable', 'priority',
    'modelOrigin', 'numericalMethod', 'inputSchema', 'outputSchema', 'sourceRevision', 'implementationRevision', 'licenseGate',
    'availabilityReason', 'planDisposition', 'limits', 'artifactProvenance', 'evidenceRefs', 'compatibilityRevision',
    'modelRevision', 'contentRevision', 'outputRevision',
  ], ['adapterId'], path)
  requireSafeId(value.id, `${path}.id`)
  requireSafeId(value.catalogItemId, `${path}.catalogItemId`)
  const catalogItem = catalogItemsById.get(value.catalogItemId)
  if (!catalogItem) fail(`${path}.catalogItemId`, 'does not resolve to a catalog item')
  requireNonEmptyString(value.title, `${path}.title`)
  if (value.title !== catalogItem.title) fail(`${path}.title`, 'must match the catalog item title')
  if (value.capability !== (catalogItem.sourceKind === 'archive' ? 'archive-reference' : 'catalog-entry')) {
    fail(`${path}.capability`, 'does not match the catalog item source kind')
  }
  requireOneOf(value.execution, EXECUTION_KINDS, `${path}.execution`)
  if (!Array.isArray(value.executionOptions) || value.executionOptions.length === 0) fail(`${path}.executionOptions`, 'must be a non-empty array')
  value.executionOptions.forEach((execution, executionIndex) => requireOneOf(execution, EXECUTION_KINDS, `${path}.executionOptions[${executionIndex}]`))
  requireUnique(value.executionOptions, `${path}.executionOptions`)
  if (value.executionOptions[0] !== value.execution) fail(`${path}.executionOptions`, 'must start with execution')
  requireOneOf(value.availability, AVAILABILITIES, `${path}.availability`)
  requireBoolean(value.runnable, `${path}.runnable`)
  requireOneOf(value.priority, PRIORITIES, `${path}.priority`)
  requireOneOf(value.modelOrigin, MODEL_ORIGINS, `${path}.modelOrigin`)
  if (Object.hasOwn(value, 'adapterId')) {
    requireSafeId(value.adapterId, `${path}.adapterId`)
  }
  for (const field of ['numericalMethod', 'inputSchema', 'outputSchema'] as const) {
    if (value[field] !== null) requireNonEmptyString(value[field], `${path}.${field}`)
  }
  requireRevision(value.sourceRevision, `${path}.sourceRevision`, true)
  if (value.sourceRevision !== catalogItem.upstreamRevision) fail(`${path}.sourceRevision`, 'must match the catalog item upstreamRevision')
  requireNonEmptyString(value.implementationRevision, `${path}.implementationRevision`)
  requireOneOf(value.licenseGate, LICENSE_GATES, `${path}.licenseGate`)
  requireNonEmptyString(value.availabilityReason, `${path}.availabilityReason`)
  requireNonEmptyString(value.planDisposition, `${path}.planDisposition`)
  parseLimits(value.limits, `${path}.limits`)
  const artifactProvenance = parseArtifactProvenance(value.artifactProvenance, `${path}.artifactProvenance`)
  if (artifactProvenance.sourceRevision !== value.sourceRevision) fail(`${path}.artifactProvenance.sourceRevision`, 'must match sourceRevision')
  if (artifactProvenance.acquisitionDate !== acquisitionDate) fail(`${path}.artifactProvenance.acquisitionDate`, 'must match the artifact acquisition date')
  requireStringArray(value.evidenceRefs, `${path}.evidenceRefs`, true)
  value.evidenceRefs.forEach((reference, referenceIndex) => requireRelativePath(reference, `${path}.evidenceRefs[${referenceIndex}]`))
  requireRevision(value.compatibilityRevision, `${path}.compatibilityRevision`)
  requireRevision(value.modelRevision, `${path}.modelRevision`)
  requireRevision(value.contentRevision, `${path}.contentRevision`)
  requireRevision(value.outputRevision, `${path}.outputRevision`)
  if (value.availability === 'available') {
    if (!value.runnable || value.adapterId === undefined) fail(path, 'available descriptors require runnable true and adapterId')
  } else if (value.runnable || value.adapterId !== undefined) {
    fail(path, 'unavailable or blocked descriptors cannot expose a runnable adapter')
  }
  if (value.execution === 'blocked' && value.availability !== 'blocked') fail(`${path}.availability`, 'must be blocked for blocked execution')
  if ((value.capability === 'archive-reference' || value.execution === 'artifact' || value.execution === 'reference')
    && (value.availability === 'available' || value.runnable || value.adapterId !== undefined)) {
    fail(path, 'artifact and reference entries cannot expose Run')
  }
  if (value.executionOptions.includes('wasm-candidate') && (value.availability === 'available' || value.runnable || value.adapterId !== undefined)) {
    fail(path, 'wasm-candidate remains unavailable until its build gate passes')
  }
  if (value.licenseGate === 'blocked' && value.availability !== 'blocked') fail(`${path}.availability`, 'must be blocked when the license gate is blocked')
  return value
}

function parseSimulations(
  value: unknown,
  catalogValue: AwesomePhysicsCatalogArtifactV1,
): AwesomePhysicsSimulationArtifactV1 {
  const path = 'Awesome Physics simulations'
  requireExactKeys(value, ['schemaVersion', 'generatedAt', 'catalogRevision', 'source', 'summary', 'items'], [], path)
  if (value.schemaVersion !== 1) fail(`${path}.schemaVersion`, 'must be 1')
  requireDate(value.generatedAt, `${path}.generatedAt`)
  requireNonEmptyString(value.catalogRevision, `${path}.catalogRevision`)
  if (value.catalogRevision !== catalogValue.catalogRevision) fail(`${path}.catalogRevision`, 'must match the catalog revision')
  const source = parseSource(value.source, `${path}.source`)
  if (source.acquisitionDate !== catalogValue.source.acquisitionDate
    || source.catalogPath !== catalogValue.source.catalogPath
    || source.manifestPath !== catalogValue.source.manifestPath
    || source.migrationPlanPath !== catalogValue.source.migrationPlanPath) {
    fail(`${path}.source`, 'must match the catalog source provenance')
  }
  if (value.generatedAt !== catalogValue.generatedAt) fail(`${path}.generatedAt`, 'must match the catalog generatedAt')
  const summary = parseSimulationSummary(value.summary, `${path}.summary`)
  if (!Array.isArray(value.items) || value.items.length === 0) fail(`${path}.items`, 'must be a non-empty array')
  const catalogItemsById = new Map(catalogValue.items.map((item) => [item.id, item]))
  const items = value.items.map((item, index) => parseDescriptor(item, index, catalogItemsById, catalogValue.catalogRevision, source.acquisitionDate))
  const descriptorIds = items.map(({ id }) => id)
  requireUnique(descriptorIds, `${path}.items IDs`)
  const descriptorCounts = {
    sourceCapabilities: items.length,
    runnable: items.filter(({ runnable }) => runnable).length,
    available: items.filter(({ availability }) => availability === 'available').length,
    unavailable: items.filter(({ availability }) => availability === 'unavailable').length,
    blocked: items.filter(({ availability }) => availability === 'blocked').length,
    adapterCount: items.filter(({ adapterId }) => adapterId !== undefined).length,
  }
  for (const key of ['sourceCapabilities', 'runnable', 'available', 'unavailable', 'blocked', 'adapterCount'] as const) {
    if (summary[key] !== descriptorCounts[key]) fail(`${path}.summary.${key}`, 'does not match the descriptors')
  }
  for (const kind of EXECUTION_KINDS) {
    const count = items.filter(({ execution }) => execution === kind).length
    if (summary.executionKinds[kind] !== count) fail(`${path}.summary.executionKinds.${kind}`, 'does not match the descriptors')
  }
  if (items.length !== catalogValue.items.length) fail(`${path}.items`, 'must provide exactly one descriptor for every catalog item')
  const descriptorsByCatalogItem = new Map<string, number>()
  for (const item of items) descriptorsByCatalogItem.set(item.catalogItemId, (descriptorsByCatalogItem.get(item.catalogItemId) ?? 0) + 1)
  for (const catalogItem of catalogValue.items) {
    if (descriptorsByCatalogItem.get(catalogItem.id) !== 1) fail(`${path}.items`, `must contain exactly one descriptor for ${catalogItem.id}`)
  }
  return { schemaVersion: 1, generatedAt: value.generatedAt, catalogRevision: value.catalogRevision, source, summary, items }
}

export function parseAwesomePhysicsCatalogArtifact(value: unknown): AwesomePhysicsCatalogArtifactV1 {
  return parseCatalog(value)
}

export function parseAwesomePhysicsSimulationArtifact(
  value: unknown,
  catalogValue: AwesomePhysicsCatalogArtifactV1,
): AwesomePhysicsSimulationArtifactV1 {
  return parseSimulations(value, catalogValue)
}

export function parseAwesomePhysicsRegistryArtifacts(
  catalogValue: unknown,
  simulationsValue: unknown,
): AwesomePhysicsRegistryArtifactsV1 {
  const parsedCatalog = parseCatalog(catalogValue)
  const parsedSimulations = parseSimulations(simulationsValue, parsedCatalog)
  return { catalog: parsedCatalog, simulations: parsedSimulations }
}

function abortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) return signal.reason
  return new DOMException('The operation was aborted', 'AbortError')
}

async function fetchJson(url: string, label: string, signal: AbortSignal): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, { signal, cache: 'no-store' })
  } catch (reason) {
    if (signal.aborted) throw abortError(signal)
    throw reason instanceof Error ? reason : new Error(String(reason))
  }
  if (!response.ok) throw new Error(`${label} failed to load (${response.status})`)
  if (signal.aborted) throw abortError(signal)
  try {
    const value = await response.json() as unknown
    if (signal.aborted) throw abortError(signal)
    return value
  } catch (reason) {
    if (signal.aborted) throw abortError(signal)
    throw new TypeError(`${label} is not valid JSON`, { cause: reason })
  }
}

async function loadArtifacts(signal: AbortSignal): Promise<AwesomePhysicsRegistryArtifactsV1> {
  const [catalogValue, simulationsValue] = await Promise.all([
    fetchJson(CATALOG_URL, 'Awesome Physics catalog', signal),
    fetchJson(SIMULATIONS_URL, 'Awesome Physics simulations', signal),
  ])
  if (signal.aborted) throw abortError(signal)
  return parseAwesomePhysicsRegistryArtifacts(catalogValue, simulationsValue)
}

function clearLoadedArtifacts(): void {
  catalog.value = null
  simulations.value = null
  catalogItemsById.clear()
  descriptorsById.clear()
  descriptorsByCatalogItemId.clear()
}

function commitArtifacts(value: AwesomePhysicsRegistryArtifactsV1): void {
  catalog.value = value.catalog
  simulations.value = value.simulations
  catalogItemsById.clear()
  descriptorsById.clear()
  descriptorsByCatalogItemId.clear()
  for (const item of value.catalog.items) catalogItemsById.set(item.id, item)
  for (const descriptor of value.simulations.items) {
    descriptorsById.set(descriptor.id, descriptor)
    descriptorsByCatalogItemId.set(descriptor.catalogItemId, descriptor)
  }
}

async function initialize(): Promise<void> {
  if (initialization) return initialization
  const attempt = ++generation
  const attemptController = new AbortController()
  controller = attemptController
  let successful = false
  const pending = Promise.resolve().then(async () => {
    ready.value = false
    error.value = null
    clearLoadedArtifacts()
    try {
      const next = await loadArtifacts(attemptController.signal)
      if (attempt !== generation) return
      commitArtifacts(next)
      ready.value = true
      successful = true
    } catch (reason) {
      if (attempt !== generation) return
      clearLoadedArtifacts()
      if (attemptController.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) {
        ready.value = false
        error.value = null
      } else {
        error.value = reason instanceof Error ? reason : new Error(String(reason))
        ready.value = true
      }
    } finally {
      if (attempt === generation) {
        controller = null
        if (!successful) initialization = null
      }
    }
  })
  initialization = pending
  return pending
}

async function catalogItemById(id: string): Promise<AwesomePhysicsCatalogItemV1 | null> {
  await initialize()
  return catalogItemsById.get(id) ?? null
}

async function descriptorById(id: string): Promise<AwesomePhysicsSimulationDescriptorV1 | null> {
  await initialize()
  return descriptorsById.get(id) ?? null
}

async function descriptorByCatalogItemId(catalogItemId: string): Promise<AwesomePhysicsSimulationDescriptorV1 | null> {
  await initialize()
  return descriptorsByCatalogItemId.get(catalogItemId) ?? null
}

function validateAdapterCompatibility(
  value: unknown,
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  path: string,
): AwesomePhysicsAdapterV1 {
  requireExactKeys(value, ['adapterId', 'protocol', 'compatibility', 'run'], [], path)
  requireSafeId(value.adapterId, `${path}.adapterId`)
  if (value.adapterId !== descriptor.adapterId) fail(`${path}.adapterId`, 'must match the descriptor adapterId')
  if (value.protocol !== 'awesome-physics-adapter-v1') fail(`${path}.protocol`, 'must be awesome-physics-adapter-v1')
  requireExactKeys(value.compatibility, ADAPTER_COMPATIBILITY_KEYS, [], `${path}.compatibility`)
  for (const key of ADAPTER_COMPATIBILITY_KEYS) {
    requireNonEmptyString(value.compatibility[key], `${path}.compatibility.${key}`)
    if (value.compatibility[key] !== descriptor[key]) fail(`${path}.compatibility.${key}`, 'must match the descriptor revision')
  }
  if (typeof value.run !== 'function') fail(`${path}.run`, 'must be a function')
  return value as AwesomePhysicsAdapterV1
}

async function loadAdapter(descriptorId: string, signal?: AbortSignal): Promise<AwesomePhysicsAdapterV1 | null> {
  if (signal?.aborted) throw abortError(signal)
  await initialize()
  if (signal?.aborted) throw abortError(signal)
  const descriptor = descriptorsById.get(descriptorId)
  if (!descriptor) return null
  if (!descriptor.runnable || descriptor.availability !== 'available' || descriptor.adapterId === undefined) {
    throw new Error(`Awesome Physics descriptor ${descriptor.id} is not runnable: ${descriptor.availabilityReason}`)
  }
  if (descriptor.execution === 'artifact' || descriptor.execution === 'reference') {
    throw new Error(`Awesome Physics descriptor ${descriptor.id} cannot expose Run for ${descriptor.execution} execution`)
  }
  if (descriptor.executionOptions.includes('wasm-candidate')) {
    throw new Error(`Awesome Physics descriptor ${descriptor.id} is gated until the wasm-candidate build gate passes`)
  }
  const factory = adapterFactories.get(descriptor.adapterId)
  if (!factory) throw new Error(`Awesome Physics adapter ${descriptor.adapterId} is not registered`)
  const adapter = await factory(descriptor, signal ?? new AbortController().signal)
  if (signal?.aborted) throw abortError(signal)
  return validateAdapterCompatibility(adapter, descriptor, `Awesome Physics adapter ${descriptor.adapterId}`)
}

export function registerAwesomePhysicsAdapterFactory(adapterId: string, factory: AdapterFactory): () => void {
  requireSafeId(adapterId, 'Awesome Physics adapterId')
  if (typeof factory !== 'function') fail('Awesome Physics adapter factory', 'must be a function')
  adapterFactories.set(adapterId, factory)
  return () => {
    if (adapterFactories.get(adapterId) === factory) adapterFactories.delete(adapterId)
  }
}

export function useAwesomePhysicsRegistry() {
  return {
    catalog: readonly(catalog),
    simulations: readonly(simulations),
    ready: readonly(ready),
    error: readonly(error),
    initialize,
    catalogItemById,
    descriptorById,
    descriptorByCatalogItemId,
    simulationById: descriptorById,
    simulationByCatalogItemId: descriptorByCatalogItemId,
    loadAdapter,
    adapterByDescriptorId: loadAdapter,
  }
}

function clearRegistryState(): void {
  generation += 1
  controller?.abort()
  controller = null
  initialization = null
  clearLoadedArtifacts()
  adapterFactories.clear()
  ready.value = false
  error.value = null
}

export function setAwesomePhysicsRegistryForTests(value: AwesomePhysicsRegistryFixtureV1 | null): void {
  clearRegistryState()
  if (!value) return
  try {
    const next = parseAwesomePhysicsRegistryArtifacts(value.catalog, value.simulations)
    commitArtifacts(next)
    value.adapterFactories?.forEach((factory, adapterId) => {
      registerAwesomePhysicsAdapterFactory(adapterId, factory)
    })
    ready.value = true
    initialization = Promise.resolve()
  } catch (reason) {
    error.value = reason instanceof Error ? reason : new Error(String(reason))
    ready.value = true
  }
}

export function resetAwesomePhysicsRegistryForTests(): void {
  clearRegistryState()
}
