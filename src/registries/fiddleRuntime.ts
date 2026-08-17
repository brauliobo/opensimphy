import { fail, requireExactKeys, requireNonEmptyString, requireSafeInteger } from '../simphy/contract'
import type {
  FiddleRegistry,
  FiddleRuntimeAggregate,
  FiddleRuntimeBatch,
  FiddleRuntimeLedger,
  FiddleRuntimeRecord,
  FiddleRuntimeStatus,
} from '../types/fiddle'

const STATUSES: readonly FiddleRuntimeStatus[] = ['verified', 'rendered-with-errors', 'empty', 'blocked', 'timeout', 'failed']
const SHA256_PATTERN = /^[a-f0-9]{64}$/
function text(value: unknown, path: string): string {
  return requireNonEmptyString(value, path)
}

function integer(value: unknown, path: string, minimum = 0): number {
  return requireSafeInteger(value, path, minimum)
}

function timestamp(value: unknown, path: string): string {
  const result = text(value, path)
  if (Number.isNaN(new Date(result).valueOf()) || new Date(result).toISOString() !== result) fail(path, 'must be an ISO timestamp')
  return result
}

function parseStatus(value: unknown, path: string): FiddleRuntimeStatus {
  if (!STATUSES.includes(value as FiddleRuntimeStatus)) fail(path, 'must be a supported runtime status')
  return value as FiddleRuntimeStatus
}

function parseBatch(value: unknown, index: number): FiddleRuntimeBatch {
  const path = `fiddle runtime.environment.batches[${index}]`
  requireExactKeys(value, ['id', 'firstPosition', 'lastPosition', 'sha256', 'startedAt', 'completedAt', 'engine', 'version', 'playwrightVersion'], [], path)
  const sha256 = text(value.sha256, `${path}.sha256`)
  if (!SHA256_PATTERN.test(sha256)) fail(`${path}.sha256`, 'must be a lowercase SHA-256 hash')
  return {
    id:                text(value.id, `${path}.id`),
    firstPosition:     integer(value.firstPosition, `${path}.firstPosition`, 1),
    lastPosition:      integer(value.lastPosition, `${path}.lastPosition`, 1),
    sha256,
    startedAt:         timestamp(value.startedAt, `${path}.startedAt`),
    completedAt:       timestamp(value.completedAt, `${path}.completedAt`),
    engine:            text(value.engine, `${path}.engine`),
    version:           text(value.version, `${path}.version`),
    playwrightVersion: text(value.playwrightVersion, `${path}.playwrightVersion`),
  }
}

function parseAggregate(value: unknown): FiddleRuntimeAggregate {
  const path = 'fiddle runtime.aggregate'
  requireExactKeys(value, [...STATUSES, 'total', 'scientificallyValidated'], [], path)
  const aggregate = Object.fromEntries(STATUSES.map((status) => [status, integer(value[status], `${path}.${status}`)])) as unknown as FiddleRuntimeAggregate
  aggregate.total = integer(value.total, `${path}.total`, 1)
  if (value.scientificallyValidated !== 0) fail(`${path}.scientificallyValidated`, 'must be 0')
  aggregate.scientificallyValidated = 0
  return aggregate
}

function parseRuntimeRecord(value: unknown, index: number): FiddleRuntimeRecord {
  const path = `fiddle runtime.records[${index}]`
  requireExactKeys(value, ['position', 'slug', 'version', 'embedUrl', 'status', 'attempts', 'testedAt', 'batch', 'pageErrors', 'failureSummary'], [], path)
  if (!Array.isArray(value.pageErrors)) fail(`${path}.pageErrors`, 'must be an array')
  const failureSummary = value.failureSummary === null ? null : text(value.failureSummary, `${path}.failureSummary`)
  const status = parseStatus(value.status, `${path}.status`)
  const attempts = integer(value.attempts, `${path}.attempts`, 1)
  if (attempts > 2 || (status !== 'verified' && attempts !== 2)) fail(`${path}.attempts`, 'must reflect the one-retry policy')
  return {
    position:       integer(value.position, `${path}.position`, 1),
    slug:           text(value.slug, `${path}.slug`),
    version:        integer(value.version, `${path}.version`),
    embedUrl:       text(value.embedUrl, `${path}.embedUrl`),
    status,
    attempts,
    testedAt:       timestamp(value.testedAt, `${path}.testedAt`),
    batch:          text(value.batch, `${path}.batch`),
    pageErrors:     value.pageErrors.map((entry, errorIndex) => text(entry, `${path}.pageErrors[${errorIndex}]`)),
    failureSummary,
  }
}

export function parseFiddleRuntimeLedger(value: unknown, registry: FiddleRegistry): FiddleRuntimeLedger {
  requireExactKeys(value, ['schemaVersion', 'registry', 'methodology', 'environment', 'aggregate', 'records'], [], 'fiddle runtime')
  if (value.schemaVersion !== 1) fail('fiddle runtime.schemaVersion', 'must be 1')

  requireExactKeys(value.registry, ['path', 'sourceRevision', 'recordCount'], [], 'fiddle runtime.registry')
  if (value.registry.path !== 'data/generated/fiddles/registry.json') fail('fiddle runtime.registry.path', 'must identify the Fiddle registry')
  const sourceRevision = text(value.registry.sourceRevision, 'fiddle runtime.registry.sourceRevision')
  if (!SHA256_PATTERN.test(sourceRevision) || sourceRevision !== registry.source.sourceRevision) {
    fail('fiddle runtime.registry.sourceRevision', 'must match the loaded Fiddle registry')
  }
  const recordCount = integer(value.registry.recordCount, 'fiddle runtime.registry.recordCount', 1)
  if (recordCount !== registry.records.length) fail('fiddle runtime.registry.recordCount', 'must match the loaded Fiddle registry')

  requireExactKeys(value.methodology, ['scope', 'classification', 'retryPolicy', 'caveat'], [], 'fiddle runtime.methodology')
  const methodology = {
    scope:          text(value.methodology.scope, 'fiddle runtime.methodology.scope'),
    classification: text(value.methodology.classification, 'fiddle runtime.methodology.classification'),
    retryPolicy:    text(value.methodology.retryPolicy, 'fiddle runtime.methodology.retryPolicy'),
    caveat:         text(value.methodology.caveat, 'fiddle runtime.methodology.caveat'),
  }
  requireExactKeys(value.environment, ['batches'], [], 'fiddle runtime.environment')
  if (!Array.isArray(value.environment.batches) || value.environment.batches.length !== 4) fail('fiddle runtime.environment.batches', 'must contain four batches')
  const batches = value.environment.batches.map(parseBatch)
  if (batches.some((batch, index) => batch.firstPosition !== index * 195 + 1 || batch.lastPosition !== (index + 1) * 195)) {
    fail('fiddle runtime.environment.batches', 'must cover contiguous 195-record ranges')
  }

  const aggregate = parseAggregate(value.aggregate)
  if (!Array.isArray(value.records)) fail('fiddle runtime.records', 'must be an array')
  const records = value.records.map(parseRuntimeRecord)
  if (records.length !== recordCount || aggregate.total !== recordCount) fail('fiddle runtime.aggregate.total', 'must equal the associated record count')
  const observed = Object.fromEntries(STATUSES.map((status) => [status, records.filter((record) => record.status === status).length]))
  for (const status of STATUSES) if (aggregate[status] !== observed[status]) fail(`fiddle runtime.aggregate.${status}`, 'does not match record statuses')
  for (const [index, runtimeRecord] of records.entries()) {
    const registryRecord = registry.records[index]
    if (!registryRecord || runtimeRecord.position !== index + 1 || runtimeRecord.position !== registryRecord.position
      || runtimeRecord.slug !== registryRecord.slug || runtimeRecord.version !== registryRecord.version || runtimeRecord.embedUrl !== registryRecord.embedUrl) {
      fail(`fiddle runtime.records[${index}]`, 'does not match the associated registry record')
    }
    if (!batches.some((batch) => batch.id === runtimeRecord.batch && runtimeRecord.position >= batch.firstPosition && runtimeRecord.position <= batch.lastPosition)) {
      fail(`fiddle runtime.records[${index}].batch`, 'does not cover this record position')
    }
  }

  return {
    schemaVersion: 1,
    registry: { path: value.registry.path, sourceRevision, recordCount },
    methodology,
    environment: { batches },
    aggregate,
    records,
  }
}
