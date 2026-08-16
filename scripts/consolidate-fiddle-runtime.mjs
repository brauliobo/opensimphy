#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const STATUSES = ['verified', 'rendered-with-errors', 'empty', 'blocked', 'timeout', 'failed']
const EXPECTED_COUNTS = {
  verified: 710,
  'rendered-with-errors': 28,
  empty: 17,
  blocked: 0,
  timeout: 25,
  failed: 0,
  total: 780,
}

function fail(message) {
  throw new Error(message)
}

function parseArguments(argv) {
  let registryPath = 'public/data/generated/fiddles/registry.json'
  let evidenceDir = null
  const positional = []
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--registry') registryPath = argv[++index]
    else if (argv[index] === '--evidence-dir') evidenceDir = argv[++index]
    else positional.push(argv[index])
  }
  if (!registryPath || positional.length !== 5) {
    fail('Usage: consolidate-fiddle-runtime.mjs [--registry registry.json] [--evidence-dir directory] batch1.json batch2.json batch3.json batch4.json output.json')
  }
  return { registryPath, evidenceDir, batchPaths: positional.slice(0, 4), outputPath: positional[4] }
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    fail(`Unable to read JSON ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function status(value, path) {
  if (!STATUSES.includes(value)) fail(`${path} has unsupported classification ${JSON.stringify(value)}`)
  return value
}

function integer(value, path, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) fail(`${path} must be an integer >= ${minimum}`)
  return value
}

function string(value, path) {
  if (typeof value !== 'string' || value.length === 0) fail(`${path} must be a non-empty string`)
  return value
}

function isoTimestamp(value, path) {
  const text = string(value, path)
  if (new Date(text).toISOString() !== text) fail(`${path} must be an ISO timestamp`)
  return text
}

function extractSummary(batch, path) {
  const raw = batch.summaryCounts ?? batch.summary?.counts ?? batch.summary
  if (!raw || typeof raw !== 'object') fail(`${path} does not contain a summary`)
  const counts = Object.fromEntries(STATUSES.map((key) => [key, integer(raw[key], `${path}.summary.${key}`)]))
  const total = raw.total ?? batch.summary?.recordCount ?? batch.recordCount ?? batch.summary?.expectedRecords
  return { ...counts, total: integer(total, `${path}.summary.total`, 1) }
}

function parseEmbedIdentity(embedUrl, path) {
  let url
  try {
    url = new URL(embedUrl)
  } catch {
    fail(`${path} must be a URL`)
  }
  const match = url.pathname.match(/^\/Chenopdodium\/([A-Za-z0-9_-]+)\/(?:([0-9]+)\/)?show\/$/)
  if (url.protocol !== 'https:' || url.hostname !== 'jsfiddle.net' || url.search || url.hash || !match) {
    fail(`${path} must be a canonical Chenopdodium JSFiddle embed URL`)
  }
  return { slug: match[1], version: match[2] === undefined ? 0 : Number(match[2]) }
}

function diagnosticText(value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    for (const key of ['message', 'errorText', 'error', 'reason', 'url']) {
      if (typeof value[key] === 'string' && value[key]) return value[key]
    }
    return JSON.stringify(value)
  }
  return String(value)
}

function uniqueDiagnostics(values) {
  if (!Array.isArray(values)) return []
  return [...new Set(values.map(diagnosticText).filter(Boolean))]
}

function finalDiagnostics(record, finalAttempt, classification) {
  const pageErrors = uniqueDiagnostics(finalAttempt.pageErrors ?? record.pageErrors)
  const failureParts = [
    finalAttempt.error,
    record.error,
    ...uniqueDiagnostics(finalAttempt.failedRequests ?? finalAttempt.failedRuntimeRequests),
    ...uniqueDiagnostics(record.failedRuntimeRequests ?? record.failedRequests),
  ].filter(Boolean).map(diagnosticText)
  const classificationSummary = {
    'rendered-with-errors': `${pageErrors.length} uncaught page error${pageErrors.length === 1 ? '' : 's'} observed on the final attempt.`,
    empty: 'Result frame loaded without meaningful rendered content.',
    blocked: 'An HTTP status or access challenge blocked result-frame inspection.',
    timeout: 'Bounded navigation or result-frame inspection timed out.',
    failed: 'Runtime inspection failed before another classification could be assigned.',
  }[classification]
  return {
    pageErrors,
    failureSummary: failureParts.length === 0 ? classificationSummary ?? null : [...new Set(failureParts)].join('; '),
  }
}

function browserMetadata(batch) {
  return {
    engine: batch.browser?.engine ?? batch.browserName ?? 'Chromium',
    version: batch.browser?.version ?? batch.browserVersion,
    playwrightVersion: batch.browser?.playwrightVersion ?? batch.playwrightVersion ?? 'not recorded',
  }
}

function sanitizeEvidence(value, key = '') {
  if (Array.isArray(value)) return value.map((entry) => sanitizeEvidence(entry))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, sanitizeEvidence(child, childKey)]))
  }
  if (typeof value !== 'string') return value
  if (key === 'sourceRegistry') return 'public/data/generated/fiddles/registry.json'
  if (/executable(path)?|browserExecutable/i.test(key)) return 'local Chromium executable (path omitted)'
  return value
    .replace(/\/(?:home|Users)\/[^/\s]+(?:\/[^\s:),"']+)*/g, '<local-path>')
    .replace(/\/tmp\/[^\s:),"']+/g, '<temporary-path>')
}

function validateRegistry(registry) {
  if (registry?.schemaVersion !== 1 || registry?.source?.author !== 'Chenopdodium' || !Array.isArray(registry.records)) {
    fail('Registry must be the schemaVersion 1 Chenopdodium registry')
  }
  if (registry.source.recordCount !== registry.records.length || registry.records.length !== EXPECTED_COUNTS.total) {
    fail(`Registry must contain exactly ${EXPECTED_COUNTS.total} records`)
  }
  for (const [index, record] of registry.records.entries()) {
    if (record.position !== index + 1) fail(`Registry position ${index + 1} is not contiguous`)
    const identity = parseEmbedIdentity(record.embedUrl, `registry.records[${index}].embedUrl`)
    if (identity.slug !== record.slug || identity.version !== record.version) fail(`Registry identity mismatch at position ${record.position}`)
  }
}

function normalizeRecord(record, registryRecord, batchId, batchCompletedAt, path) {
  const position = integer(record.position, `${path}.position`, 1)
  if (position !== registryRecord.position) fail(`${path}.position does not match registry position ${registryRecord.position}`)
  const embedUrl = string(record.embedUrl, `${path}.embedUrl`)
  const identity = parseEmbedIdentity(embedUrl, `${path}.embedUrl`)
  if (embedUrl !== registryRecord.embedUrl || identity.slug !== registryRecord.slug || identity.version !== registryRecord.version) {
    fail(`${path} does not match registry slug/version/embed URL at position ${position}`)
  }
  if (record.slug !== undefined && record.slug !== registryRecord.slug) fail(`${path}.slug does not match the registry`)
  if (record.version !== undefined && record.version !== registryRecord.version) fail(`${path}.version does not match the registry`)
  const classification = status(record.classification, `${path}.classification`)
  if (!Array.isArray(record.attempts) || record.attempts.length < 1 || record.attempts.length > 2) fail(`${path}.attempts must contain one or two attempts`)
  record.attempts.forEach((attempt, index) => {
    if (attempt.attempt !== index + 1) fail(`${path}.attempts must be numbered contiguously from 1`)
    status(attempt.classification, `${path}.attempts[${index}].classification`)
  })
  const firstStatus = record.attempts[0].classification
  if (firstStatus === 'verified' && record.attempts.length !== 1) fail(`${path} retried a verified first attempt`)
  if (firstStatus !== 'verified' && record.attempts.length !== 2) fail(`${path} is missing the required retry after a non-verified first attempt`)
  const finalAttempt = record.attempts.at(-1)
  if (classification !== finalAttempt.classification) fail(`${path}.classification must equal its final attempt classification`)
  if (classification !== 'verified' && record.attempts.length !== 2) fail(`${path} is missing retry coverage for a non-verified record`)
  const testedAt = finalAttempt.completedAt ?? batchCompletedAt
  isoTimestamp(testedAt, `${path}.testedAt`)
  return {
    position,
    slug: registryRecord.slug,
    version: registryRecord.version,
    embedUrl: registryRecord.embedUrl,
    status: classification,
    attempts: record.attempts.length,
    testedAt,
    batch: batchId,
    ...finalDiagnostics(record, finalAttempt, classification),
  }
}

export async function consolidateFiddleRuntime({ registryPath, batchPaths, outputPath, evidenceDir = null }) {
  const registry = await readJson(registryPath)
  validateRegistry(registry)
  const batches = await Promise.all(batchPaths.map(readJson))
  const allRecords = []
  const batchMetadata = []

  for (const [batchIndex, batch] of batches.entries()) {
    const path = `batch ${batchIndex + 1}`
    if (!Array.isArray(batch.records) || batch.records.length !== 195) fail(`${path} must contain exactly 195 records`)
    const positions = batch.records.map((record) => integer(record.position, `${path}.records.position`, 1))
    const first = batchIndex * 195 + 1
    const last = first + 194
    if (positions.some((position, index) => position !== first + index)) fail(`${path} positions must be ordered and contiguous from ${first} through ${last}`)
    const declared = extractSummary(batch, path)
    const observed = Object.fromEntries(STATUSES.map((key) => [key, batch.records.filter((record) => record.classification === key).length]))
    const observedTotal = Object.values(observed).reduce((sum, count) => sum + count, 0)
    for (const key of STATUSES) if (declared[key] !== observed[key]) fail(`${path} summary ${key}=${declared[key]} but records contain ${observed[key]}`)
    if (declared.total !== observedTotal || observedTotal !== 195) fail(`${path} summary total does not equal 195 records`)
    const id = `${String(first).padStart(3, '0')}-${last}`
    const startedAt = isoTimestamp(batch.startedAt, `${path}.startedAt`)
    const completedAt = isoTimestamp(batch.completedAt, `${path}.completedAt`)
    batchMetadata.push({ id, firstPosition: first, lastPosition: last, startedAt, completedAt, ...browserMetadata(batch) })
    for (const record of batch.records) {
      allRecords.push(normalizeRecord(record, registry.records[record.position - 1], id, completedAt, `${path}.records[${record.position - first}]`))
    }
  }

  if (new Set(allRecords.map(({ position }) => position)).size !== EXPECTED_COUNTS.total) fail('Combined batches do not contain 780 unique positions')
  if (allRecords.some((record, index) => record.position !== index + 1)) fail('Combined positions must be exactly contiguous from 1 through 780')
  const aggregate = Object.fromEntries(STATUSES.map((key) => [key, allRecords.filter((record) => record.status === key).length]))
  aggregate.total = allRecords.length
  aggregate.scientificallyValidated = 0
  for (const [key, expected] of Object.entries(EXPECTED_COUNTS)) {
    if (aggregate[key] !== expected) fail(`Aggregate ${key}=${aggregate[key]}, expected ${expected}`)
  }

  const ledger = {
    schemaVersion: 1,
    registry: {
      path: 'data/generated/fiddles/registry.json',
      sourceRevision: registry.source.sourceRevision,
      recordCount: registry.source.recordCount,
    },
    methodology: {
      scope: 'Chromium runtime rendering of all 780 indexed external Chenopdodium JSFiddle records.',
      classification: 'verified means meaningful rendered content with no observed uncaught page error; rendered-with-errors is never clean-rendered.',
      retryPolicy: 'Every non-verified first attempt was retried exactly once; the final attempt determines status.',
      caveat: 'Browser runtime rendering is not scientific validation. No record was scientifically validated by this check.',
    },
    environment: { batches: batchMetadata },
    aggregate,
    records: allRecords,
  }

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(ledger, null, 2)}\n`)
  if (evidenceDir) {
    await mkdir(evidenceDir, { recursive: true })
    for (const [index, batch] of batches.entries()) {
      const { id } = batchMetadata[index]
      const evidencePath = join(evidenceDir, `chenopdodium-runtime-${id}.json`)
      await writeFile(evidencePath, `${JSON.stringify(sanitizeEvidence(batch), null, 2)}\n`)
    }
  }
  return ledger
}

const invokedPath = process.argv[1] ? fileURLToPath(new URL(`file://${process.argv[1]}`)) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  const options = parseArguments(process.argv.slice(2))
  consolidateFiddleRuntime(options)
    .then((ledger) => console.log(`Wrote ${ledger.aggregate.total} runtime records to ${basename(options.outputPath)}.`))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
}
