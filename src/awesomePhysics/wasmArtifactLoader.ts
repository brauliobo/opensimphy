import { artifactRecordById } from './artifactManifest'
import type { ArtifactRecordV1 } from './artifactManifest'

export interface WasmArtifactLoadOptions {
  fetch?: typeof globalThis.fetch
  basePath?: string
  maxBytes?: number
  signal?: AbortSignal
}

function rejectArtifact(message: string): never {
  throw new Error(`WASM artifact rejected: ${message}`)
}

function assertLocalRelativeArtifactPath(path: string): void {
  if (
    path.length === 0
    || path.startsWith('/')
    || path.startsWith('\\')
    || path.includes('\\')
    || path.split('/').some((segment) => segment.length === 0 || segment === '.' || segment === '..')
    || /^[a-z][a-z\d+.-]*:/i.test(path)
    || path.startsWith('//')
  ) {
    rejectArtifact('artifact path must be a local repository-relative POSIX path')
  }
}

function assertAvailableWasmRecord(record: ArtifactRecordV1): asserts record is ArtifactRecordV1 & {
  status: 'available'
  artifact: { path: string; sha256: string; byteSize: number }
} {
  if (record.status !== 'available') rejectArtifact(`${record.id} is ${record.status}, not available`)
  if (record.output.artifactKind !== 'wasm-module') {
    rejectArtifact(`${record.id} does not declare a raw wasm-module output`)
  }
  if (record.artifact.path === null || record.artifact.sha256 === null || record.artifact.byteSize === null) {
    rejectArtifact(`${record.id} has no complete verified artifact metadata`)
  }
  assertLocalRelativeArtifactPath(record.artifact.path)
  if (!/^[a-f0-9]{64}$/.test(record.artifact.sha256)) rejectArtifact(`${record.id} has an invalid SHA-256 digest`)
  if (!Number.isSafeInteger(record.artifact.byteSize) || record.artifact.byteSize < 1) {
    rejectArtifact(`${record.id} has an invalid artifact byte size`)
  }
}

function localArtifactUrl(path: string, basePath: string): string {
  assertLocalRelativeArtifactPath(path)
  if (
    /^[a-z][a-z\d+.-]*:/i.test(basePath)
    || basePath.startsWith('//')
    || basePath.includes('\\')
  ) {
    rejectArtifact('artifact base path must be local')
  }
  if (basePath.length === 0) return path
  return `${basePath.endsWith('/') ? basePath : `${basePath}/`}${path}`
}

function declaredContentLength(response: Response): number | null {
  const header = response.headers.get('content-length')
  if (header === null) return null
  if (!/^\d+$/.test(header.trim())) rejectArtifact('response content-length is invalid')
  const length = Number(header)
  if (!Number.isSafeInteger(length)) rejectArtifact('response content-length is not a safe integer')
  return length
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (response.body === null) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > maxBytes) rejectArtifact(`response exceeds the ${maxBytes}-byte limit`)
    return bytes
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const result = await reader.read()
    if (result.done) break
    if (result.value === undefined) continue
    const chunk = new Uint8Array(result.value)
    total += chunk.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      rejectArtifact(`response exceeds the ${maxBytes}-byte limit`)
    }
    chunks.push(chunk)
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (subtle === undefined) rejectArtifact('Web Crypto SHA-256 is unavailable')
  const digest = await subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function loadVerifiedWasmArtifact(
  record: ArtifactRecordV1,
  options: WasmArtifactLoadOptions = {},
): Promise<WebAssembly.Module> {
  assertAvailableWasmRecord(record)
  const maxBytes = options.maxBytes ?? record.runtime.maxArtifactBytes
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) rejectArtifact('maxBytes must be a positive safe integer')
  if (record.artifact.byteSize > maxBytes) {
    rejectArtifact(`declared artifact is ${record.artifact.byteSize} bytes, over the ${maxBytes}-byte limit`)
  }

  const fetcher = options.fetch ?? globalThis.fetch
  if (typeof fetcher !== 'function') rejectArtifact('local fetch is unavailable')
  const url = localArtifactUrl(record.artifact.path, options.basePath ?? import.meta.env.BASE_URL)
  const response = await fetcher(url, { signal: options.signal })
  if (!response.ok) rejectArtifact(`local fetch returned HTTP ${response.status}`)
  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/wasm') rejectArtifact('response content-type must be application/wasm')
  const length = declaredContentLength(response)
  if (length !== null && length > maxBytes) rejectArtifact(`response exceeds the ${maxBytes}-byte limit`)
  if (length !== null && length !== record.artifact.byteSize) {
    rejectArtifact(`response content-length ${length} does not match the declared ${record.artifact.byteSize} bytes`)
  }

  const bytes = await readBoundedBody(response, maxBytes)
  if (bytes.byteLength !== record.artifact.byteSize) {
    rejectArtifact(`response byte size ${bytes.byteLength} does not match the declared ${record.artifact.byteSize} bytes`)
  }
  const digest = await sha256Hex(bytes)
  if (digest !== record.artifact.sha256) rejectArtifact('response SHA-256 does not match the manifest')

  try {
    return await WebAssembly.compile(bytes)
  } catch (reason) {
    rejectArtifact(`verified bytes are not a compilable WebAssembly module: ${reason instanceof Error ? reason.message : String(reason)}`)
  }
}

export async function loadVerifiedWasmArtifactById(
  id: string,
  options: WasmArtifactLoadOptions = {},
): Promise<WebAssembly.Module> {
  const record = artifactRecordById(id)
  if (record === null) rejectArtifact(`no manifest record exists for ${id}`)
  return loadVerifiedWasmArtifact(record, options)
}
