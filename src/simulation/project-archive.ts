import { canonicalizeOnelab, validateEnvelopeValues } from './onelab-db'
import { onelabLoopValues, onelabOutputs, type LoopHistoryPoint } from './loops'
import { PhysicalGroupEditor, type PhysicalGroupSidecar } from './physical-groups'
import type { ProjectDescriptor, ProjectFile } from './types'

export interface ProjectArchiveV2 {
  schema: 'opensimphy-project-archive-v2'
  project: {
    id: string
    scalarProfile: ProjectDescriptor['scalarType']
    entryFiles: { geometry: string; problem: string; referenceMesh?: string }
    descriptor: ProjectDescriptor
    onelab: { current: string; defaults: string }
    physicalGroups: PhysicalGroupSidecar
  }
  files: Array<{ path: string; bytes: number; sha256: string; base64: string }>
  history?: LoopHistoryPoint[]
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  return JSON.stringify(value)
}

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

function encode(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decode(value: string) {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('project archive contains invalid base64')
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  if (encode(bytes) !== value) throw new Error('project archive contains non-canonical base64')
  return bytes
}

function safePath(path: string) {
  if (typeof path !== 'string' || path.includes('\\') || path.includes('\0')) throw new Error(`unsafe archive path ${String(path)}`)
  const normalized = path.replace(/^\/+/, '')
  if (!normalized || normalized !== path.replace(/^\/+/, '') || normalized.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error(`unsafe archive path ${path}`)
  return normalized
}

function validateDescriptor(descriptor: ProjectDescriptor, filePaths: string[]) {
  if (!descriptor || typeof descriptor !== 'object' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(descriptor.id)) throw new Error('project archive project ID is invalid')
  if (descriptor.kind !== 'solve' || !descriptor.problem || !descriptor.resolution || !descriptor.postOperations?.length) throw new Error('project archive descriptor is not a complete solver project')
  if (descriptor.scalarType !== 'real-double' && descriptor.scalarType !== 'complex-double') throw new Error('project archive scalar profile is invalid')
  if (![1, 2, 3].includes(descriptor.dimension) || typeof descriptor.title !== 'string' || typeof descriptor.source !== 'string' || typeof descriptor.directory !== 'string') throw new Error('project archive descriptor metadata is invalid')
  const listed = descriptor.files.map(safePath)
  if (new Set(listed).size !== listed.length || JSON.stringify([...listed].sort()) !== JSON.stringify(filePaths)) throw new Error('project archive descriptor file list does not match archive files')
  const entries = [descriptor.geometry, descriptor.problem, descriptor.referenceMesh].filter((path): path is string => Boolean(path)).map(safePath)
  if (entries.some((path) => !listed.includes(path))) throw new Error('project archive entry file is not listed')
  if (!descriptor.postOperations.every((value) => typeof value === 'string' && value.length > 0)) throw new Error('project archive post-operation list is invalid')
  for (const values of [descriptor.setNumbers, descriptor.parameterNames]) if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('project archive descriptor parameters are invalid')
}

function validateHistory(history: unknown): LoopHistoryPoint[] {
  if (history === undefined) return []
  if (!Array.isArray(history)) throw new Error('project archive history is invalid')
  return history.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error(`project archive history point ${index} is invalid`)
    const point = candidate as LoopHistoryPoint
    if (point.index !== index || !point.values || !point.outputs || typeof point.database !== 'string') throw new Error(`project archive history point ${index} is inconsistent`)
    const database = canonicalizeOnelab(point.database)
    const values = onelabLoopValues(database)
    const outputs = onelabOutputs(database)
    if (canonical(point.values) !== canonical(values) || canonical(point.outputs) !== canonical(outputs)) throw new Error(`project archive history point ${index} does not match its ONELAB database`)
    if (Object.values(outputs).some((samples) => !Array.isArray(samples) || samples.some((value) => !Number.isFinite(value)))) throw new Error(`project archive history point ${index} has non-finite outputs`)
    return { index, values, database, outputs }
  })
}

function validateDatabases(currentJson: string, defaultsJson: string) {
  const current = canonicalizeOnelab(currentJson)
  const defaults = canonicalizeOnelab(defaultsJson)
  validateEnvelopeValues(defaults, current)
  return { current, defaults }
}

export async function exportProjectArchive(descriptor: ProjectDescriptor, files: ProjectFile[], current: string, defaults: string, physicalGroups: PhysicalGroupSidecar, history?: LoopHistoryPoint[]) {
  const entries = await Promise.all(files.map(async ({ path, bytes }) => ({ path: safePath(path), bytes: bytes.byteLength, sha256: await sha256(bytes), base64: encode(bytes) })))
  entries.sort((left, right) => left.path.localeCompare(right.path))
  if (new Set(entries.map(({ path }) => path)).size !== entries.length) throw new Error('project archive contains duplicate paths')
  validateDescriptor(descriptor, entries.map(({ path }) => path))
  const groups = PhysicalGroupEditor.load(JSON.stringify(physicalGroups), descriptor.id).sidecar()
  const validatedHistory = validateHistory(history)
  const archive: ProjectArchiveV2 = {
    schema: 'opensimphy-project-archive-v2',
    project: {
      id: descriptor.id,
      scalarProfile: descriptor.scalarType,
      entryFiles: { geometry: safePath(descriptor.geometry), problem: safePath(descriptor.problem!), ...(descriptor.referenceMesh ? { referenceMesh: safePath(descriptor.referenceMesh) } : {}) },
      descriptor,
      onelab: validateDatabases(current, defaults),
      physicalGroups: groups,
    },
    files: entries,
    ...(history ? { history: validatedHistory } : {}),
  }
  return new TextEncoder().encode(`${canonical(archive)}\n`)
}

export async function importProjectArchive(bytes: Uint8Array) {
  if (!bytes?.byteLength) throw new Error('project archive is empty')
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  const archive = JSON.parse(source) as ProjectArchiveV2
  if (archive.schema !== 'opensimphy-project-archive-v2' || !archive.project?.descriptor || !Array.isArray(archive.files)) throw new Error('unsupported project archive')
  if (canonical(archive) + '\n' !== source) throw new Error('project archive is not canonical')
  const files: ProjectFile[] = []
  let previous = ''
  for (const entry of archive.files) {
    if (!entry || typeof entry !== 'object' || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !/^[0-9a-f]{64}$/.test(entry.sha256)) throw new Error('project archive file metadata is invalid')
    const path = safePath(entry.path)
    if (path <= previous) throw new Error('project archive files are not uniquely sorted')
    previous = path
    const decoded = decode(entry.base64)
    if (decoded.byteLength !== entry.bytes || await sha256(decoded) !== entry.sha256) throw new Error(`project archive hash mismatch for ${path}`)
    files.push({ path, bytes: decoded })
  }
  const paths = files.map(({ path }) => path)
  validateDescriptor(archive.project.descriptor, paths)
  const descriptor = archive.project.descriptor
  const expectedEntries = { geometry: safePath(descriptor.geometry), problem: safePath(descriptor.problem!), ...(descriptor.referenceMesh ? { referenceMesh: safePath(descriptor.referenceMesh) } : {}) }
  if (archive.project.id !== descriptor.id || archive.project.scalarProfile !== descriptor.scalarType || canonical(archive.project.entryFiles) !== canonical(expectedEntries)) throw new Error('project archive descriptor identity is inconsistent')
  if (!archive.project.onelab || typeof archive.project.onelab !== 'object') throw new Error('project archive ONELAB databases are invalid')
  const onelab = validateDatabases(archive.project.onelab.current, archive.project.onelab.defaults)
  const physicalGroups = PhysicalGroupEditor.load(JSON.stringify(archive.project.physicalGroups), descriptor.id).sidecar()
  const history = validateHistory(archive.history)
  return { descriptor, files, current: onelab.current, defaults: onelab.defaults, physicalGroups, history }
}

export function projectPersistenceStatus(): 'available' | 'unsupported' {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function' ? 'available' : 'unsupported'
}

async function projectDirectory() {
  if (projectPersistenceStatus() === 'unsupported') throw new Error('OPFS project persistence is unsupported')
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle('opensimphy-projects', { create: true })
}

export async function persistProjectArchive(projectId: string, bytes: Uint8Array) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectId)) throw new Error('OPFS project ID is invalid')
  await importProjectArchive(bytes)
  const handle = await (await projectDirectory()).getFileHandle(`${projectId}.json`, { create: true })
  const writable = await handle.createWritable()
  await writable.write(bytes)
  await writable.close()
  const stored = new Uint8Array(await (await handle.getFile()).arrayBuffer())
  if (stored.byteLength !== bytes.byteLength || await sha256(stored) !== await sha256(bytes)) throw new Error('OPFS project archive verification failed')
}

export async function loadPersistedProjectArchive(projectId: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectId)) throw new Error('OPFS project ID is invalid')
  const handle = await (await projectDirectory()).getFileHandle(`${projectId}.json`)
  const bytes = new Uint8Array(await (await handle.getFile()).arrayBuffer())
  return { bytes, project: await importProjectArchive(bytes) }
}
