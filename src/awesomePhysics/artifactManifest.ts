import nativeCandidatesJson from '../../scripts/awesomePhysics/native-candidates.json'
import wasmPilotsJson from '../../scripts/awesomePhysics/wasm-pilots.json'

type UnknownRecord = Record<string, unknown>

export type ArtifactManifestKind = 'wasm-pilots' | 'native-candidates'
export type ArtifactBuildFamily =
  | 'emscripten'
  | 'pyodide'
  | 'rust-cargo-wasm'
  | 'pyodide-deferred'
  | 'emscripten-headless'
  | 'rust-wasm-bindgen-headless'
export type ArtifactKind = 'wasm-module' | 'pyodide-wheel'
export type ArtifactStatus = 'planned' | 'blocked' | 'available'
export type ArtifactLicenseGateStatus = 'pass' | 'review' | 'blocked'

export interface ArtifactSourceV1 {
  path: string
  revision: string
  files: string[]
  evidenceRefs: string[]
}

export interface ArtifactBuildV1 {
  family: ArtifactBuildFamily
  command: string
  toolchain: string
  workingDirectory: string
}

export interface ArtifactOutputV1 {
  module: string
  workerBoundary: string
  artifactKind: ArtifactKind
}

export interface ArtifactRuntimeV1 {
  memoryPolicy: string
  threadPolicy: string
  maxMemoryBytes: number
  maxArtifactBytes: number
  maxWorkerTimeMs: number
  maxOutputBytes: number
}

export interface ArtifactLicenseGateV1 {
  status: ArtifactLicenseGateStatus
  license: string
  noticeRequirements: string[]
}

export interface ArtifactIntegrityV1 {
  path: string | null
  sha256: string | null
  byteSize: number | null
}

export interface ArtifactRecordV1 {
  id: string
  project: string
  optional: boolean
  source: ArtifactSourceV1
  build: ArtifactBuildV1
  output: ArtifactOutputV1
  runtime: ArtifactRuntimeV1
  licenseGate: ArtifactLicenseGateV1
  proofRequirements: string[]
  status: ArtifactStatus
  artifact: ArtifactIntegrityV1
  evidenceRefs: string[]
}

export interface ArtifactManifestV1 {
  schemaVersion: 1
  manifestKind: ArtifactManifestKind
  manifestRevision: string
  sourcePlan: {
    path: string
    revision: string
    evidenceRefs: string[]
  }
  records: ArtifactRecordV1[]
}

export type WasmPilotManifestV1 = ArtifactManifestV1 & { manifestKind: 'wasm-pilots' }
export type NativeCandidateManifestV1 = ArtifactManifestV1 & { manifestKind: 'native-candidates' }

const MANIFEST_KINDS: readonly ArtifactManifestKind[] = ['wasm-pilots', 'native-candidates']
const BUILD_FAMILIES: readonly ArtifactBuildFamily[] = [
  'emscripten',
  'pyodide',
  'rust-cargo-wasm',
  'pyodide-deferred',
  'emscripten-headless',
  'rust-wasm-bindgen-headless',
]
const ARTIFACT_KINDS: readonly ArtifactKind[] = ['wasm-module', 'pyodide-wheel']
const STATUSES: readonly ArtifactStatus[] = ['planned', 'blocked', 'available']
const LICENSE_GATE_STATUSES: readonly ArtifactLicenseGateStatus[] = ['pass', 'review', 'blocked']
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const REVISION_PATTERN = /^[a-f0-9]{7,64}$/
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
  path: string,
): asserts value is UnknownRecord {
  requireRecord(value, path)
  const allowed = new Set(required)
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  const missing = required.filter((key) => !Object.hasOwn(value, key))
  if (unknown.length > 0) fail(path, `has unknown properties: ${unknown.join(', ')}`)
  if (missing.length > 0) fail(path, `is missing properties: ${missing.join(', ')}`)
}

function requireNonEmptyString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'must be a non-empty string')
  if (value !== value.trim()) fail(path, 'must not have surrounding whitespace')
}

function requireBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== 'boolean') fail(path, 'must be a boolean')
}

function requireOneOf<T extends string>(value: unknown, values: readonly T[], path: string): asserts value is T {
  if (typeof value !== 'string' || !values.includes(value as T)) fail(path, 'has an unsupported value')
}

function requireSafeId(value: unknown, path: string): asserts value is string {
  requireNonEmptyString(value, path)
  if (!ID_PATTERN.test(value)) fail(path, 'must be a lowercase kebab-case ID')
}

function requireRevision(value: unknown, path: string): asserts value is string {
  requireNonEmptyString(value, path)
  if (!REVISION_PATTERN.test(value)) fail(path, 'must be a lowercase hexadecimal revision')
}

function requireSafeRelativePath(value: unknown, path: string): asserts value is string {
  requireNonEmptyString(value, path)
  if (value.startsWith('/') || value.startsWith('\\') || value.includes('\\')) fail(path, 'must be a repository-relative POSIX path')
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')) fail(path, 'must not be a URL or protocol-relative path')
  const segments = value.split('/')
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    fail(path, 'must not contain empty, dot, or parent path segments')
  }
}

function requireEvidenceRef(value: unknown, path: string): asserts value is string {
  requireNonEmptyString(value, path)
  const match = /^(.+?)(?::\d+(?:-\d+)?)?$/.exec(value)
  if (!match?.[1]) fail(path, 'must identify a repository-relative evidence path')
  requireSafeRelativePath(match[1], path)
}

function requireStringArray(value: unknown, path: string, nonEmpty = false): asserts value is string[] {
  if (!Array.isArray(value)) fail(path, 'must be an array')
  if (nonEmpty && value.length === 0) fail(path, 'must not be empty')
  value.forEach((entry, index) => requireNonEmptyString(entry, `${path}[${index}]`))
}

function requirePathArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0) fail(path, 'must be a non-empty path array')
  value.forEach((entry, index) => requireSafeRelativePath(entry, `${path}[${index}]`))
  if (new Set(value).size !== value.length) fail(path, 'must contain unique paths')
}

function requireEvidenceArray(value: unknown, path: string): asserts value is string[] {
  requireStringArray(value, path, true)
  value.forEach((entry, index) => requireEvidenceRef(entry, `${path}[${index}]`))
  if (new Set(value).size !== value.length) fail(path, 'must contain unique references')
}

function requireSafeInteger(value: unknown, path: string, minimum = 1): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    fail(path, `must be a safe integer greater than or equal to ${minimum}`)
  }
}

function parseSourcePlan(value: unknown): ArtifactManifestV1['sourcePlan'] {
  requireExactKeys(value, ['path', 'revision', 'evidenceRefs'], 'manifest.sourcePlan')
  requireSafeRelativePath(value.path, 'manifest.sourcePlan.path')
  requireRevision(value.revision, 'manifest.sourcePlan.revision')
  requireEvidenceArray(value.evidenceRefs, 'manifest.sourcePlan.evidenceRefs')
  return value as ArtifactManifestV1['sourcePlan']
}

function parseSource(value: unknown, path: string): ArtifactSourceV1 {
  requireExactKeys(value, ['path', 'revision', 'files', 'evidenceRefs'], path)
  requireSafeRelativePath(value.path, `${path}.path`)
  requireRevision(value.revision, `${path}.revision`)
  requirePathArray(value.files, `${path}.files`)
  requireEvidenceArray(value.evidenceRefs, `${path}.evidenceRefs`)
  return value as ArtifactSourceV1
}

function parseBuild(value: unknown, path: string): ArtifactBuildV1 {
  requireExactKeys(value, ['family', 'command', 'toolchain', 'workingDirectory'], path)
  requireOneOf(value.family, BUILD_FAMILIES, `${path}.family`)
  requireNonEmptyString(value.command, `${path}.command`)
  requireNonEmptyString(value.toolchain, `${path}.toolchain`)
  requireSafeRelativePath(value.workingDirectory, `${path}.workingDirectory`)
  return value as ArtifactBuildV1
}

function parseOutput(value: unknown, path: string): ArtifactOutputV1 {
  requireExactKeys(value, ['module', 'workerBoundary', 'artifactKind'], path)
  requireNonEmptyString(value.module, `${path}.module`)
  requireNonEmptyString(value.workerBoundary, `${path}.workerBoundary`)
  requireOneOf(value.artifactKind, ARTIFACT_KINDS, `${path}.artifactKind`)
  return value as ArtifactOutputV1
}

function parseRuntime(value: unknown, path: string): ArtifactRuntimeV1 {
  requireExactKeys(value, [
    'memoryPolicy',
    'threadPolicy',
    'maxMemoryBytes',
    'maxArtifactBytes',
    'maxWorkerTimeMs',
    'maxOutputBytes',
  ], path)
  requireNonEmptyString(value.memoryPolicy, `${path}.memoryPolicy`)
  requireNonEmptyString(value.threadPolicy, `${path}.threadPolicy`)
  requireSafeInteger(value.maxMemoryBytes, `${path}.maxMemoryBytes`)
  requireSafeInteger(value.maxArtifactBytes, `${path}.maxArtifactBytes`)
  requireSafeInteger(value.maxWorkerTimeMs, `${path}.maxWorkerTimeMs`)
  requireSafeInteger(value.maxOutputBytes, `${path}.maxOutputBytes`)
  if (value.maxArtifactBytes > value.maxMemoryBytes) fail(`${path}.maxArtifactBytes`, 'must not exceed maxMemoryBytes')
  if (value.maxOutputBytes > value.maxMemoryBytes) fail(`${path}.maxOutputBytes`, 'must not exceed maxMemoryBytes')
  return value as ArtifactRuntimeV1
}

function parseLicenseGate(value: unknown, path: string): ArtifactLicenseGateV1 {
  requireExactKeys(value, ['status', 'license', 'noticeRequirements'], path)
  requireOneOf(value.status, LICENSE_GATE_STATUSES, `${path}.status`)
  requireNonEmptyString(value.license, `${path}.license`)
  requireStringArray(value.noticeRequirements, `${path}.noticeRequirements`, true)
  return value as ArtifactLicenseGateV1
}

function parseArtifact(value: unknown, status: ArtifactStatus, path: string): ArtifactIntegrityV1 {
  requireExactKeys(value, ['path', 'sha256', 'byteSize'], path)
  if (value.path !== null) requireSafeRelativePath(value.path, `${path}.path`)
  if (value.sha256 !== null) {
    requireNonEmptyString(value.sha256, `${path}.sha256`)
    if (!SHA256_PATTERN.test(value.sha256)) fail(`${path}.sha256`, 'must be a lowercase SHA-256 digest or null')
  }
  if (value.byteSize !== null) requireSafeInteger(value.byteSize, `${path}.byteSize`)

  if (status === 'available') {
    if (value.path === null || value.sha256 === null || value.byteSize === null) {
      fail(path, 'available artifacts require path, sha256, and byteSize')
    }
  } else if (value.path !== null || value.sha256 !== null || value.byteSize !== null) {
    fail(path, `${status} records must not claim an artifact`)
  }
  return value as ArtifactIntegrityV1
}

function parseRecord(value: unknown, index: number): ArtifactRecordV1 {
  const path = `manifest.records[${index}]`
  requireExactKeys(value, [
    'id',
    'project',
    'optional',
    'source',
    'build',
    'output',
    'runtime',
    'licenseGate',
    'proofRequirements',
    'status',
    'artifact',
    'evidenceRefs',
  ], path)
  requireSafeId(value.id, `${path}.id`)
  requireNonEmptyString(value.project, `${path}.project`)
  requireBoolean(value.optional, `${path}.optional`)
  parseSource(value.source, `${path}.source`)
  parseBuild(value.build, `${path}.build`)
  parseOutput(value.output, `${path}.output`)
  parseRuntime(value.runtime, `${path}.runtime`)
  parseLicenseGate(value.licenseGate, `${path}.licenseGate`)
  requireStringArray(value.proofRequirements, `${path}.proofRequirements`, true)
  requireOneOf(value.status, STATUSES, `${path}.status`)
  parseArtifact(value.artifact, value.status, `${path}.artifact`)
  requireEvidenceArray(value.evidenceRefs, `${path}.evidenceRefs`)
  return value as ArtifactRecordV1
}

export function parseArtifactManifest(value: unknown, expectedKind?: ArtifactManifestKind): ArtifactManifestV1 {
  requireExactKeys(value, ['schemaVersion', 'manifestKind', 'manifestRevision', 'sourcePlan', 'records'], 'manifest')
  if (value.schemaVersion !== 1) fail('manifest.schemaVersion', 'must be 1')
  requireOneOf(value.manifestKind, MANIFEST_KINDS, 'manifest.manifestKind')
  if (expectedKind !== undefined && value.manifestKind !== expectedKind) {
    fail('manifest.manifestKind', `must be ${expectedKind}`)
  }
  requireSafeId(value.manifestRevision, 'manifest.manifestRevision')
  parseSourcePlan(value.sourcePlan)
  if (!Array.isArray(value.records) || value.records.length === 0) fail('manifest.records', 'must be a non-empty array')
  const records = value.records.map((record, index) => parseRecord(record, index))
  if (new Set(records.map(({ id }) => id)).size !== records.length) fail('manifest.records', 'must contain unique IDs')
  if (new Set(records.map(({ project }) => project)).size !== records.length) fail('manifest.records', 'must contain unique project names')
  return value as ArtifactManifestV1
}

export function parseWasmPilotManifest(value: unknown): WasmPilotManifestV1 {
  return parseArtifactManifest(value, 'wasm-pilots') as WasmPilotManifestV1
}

export function parseNativeCandidateManifest(value: unknown): NativeCandidateManifestV1 {
  return parseArtifactManifest(value, 'native-candidates') as NativeCandidateManifestV1
}

export const WASM_PILOT_MANIFEST = parseWasmPilotManifest(wasmPilotsJson)
export const NATIVE_CANDIDATE_MANIFEST = parseNativeCandidateManifest(nativeCandidatesJson)
export const WASM_PILOTS = WASM_PILOT_MANIFEST.records
export const NATIVE_CANDIDATES = NATIVE_CANDIDATE_MANIFEST.records

export function artifactRecordById(id: string): ArtifactRecordV1 | null {
  return [...WASM_PILOTS, ...NATIVE_CANDIDATES].find((record) => record.id === id) ?? null
}
