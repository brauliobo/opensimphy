import { fail, requireExactKeys, requireNonEmptyString, requireSafeInteger, requireBoolean } from '../simphy/contract'
import { readonly, shallowRef } from 'vue'
import type { FiddleFlags, FiddlePanelBytes, FiddleRecord, FiddleRegistry, FiddleRegistrySource, FiddleRuntimeAggregate, FiddleRuntimeRecord } from '../types/fiddle'
import { parseFiddleRuntimeLedger } from './fiddleRuntime'

const JSFIDDLE_HOST = 'jsfiddle.net'
const JSFIDDLE_AUTHOR_PATTERN = /^[A-Za-z0-9_-]+$/
const FIDDLE_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const FIDDLE_REGISTRY_PATH = `${import.meta.env.BASE_URL}data/generated/fiddles/registry.json`
const FIDDLE_RUNTIME_PATH = `${import.meta.env.BASE_URL}data/generated/fiddles/runtime-verification.json`

export function fiddleProfileUrl(author: string, page: number): string {
  return `https://${JSFIDDLE_HOST}/u/${author}/fiddles/${page === 1 ? '' : `${page}/`}`
}

function versionPath(slug: string, version: number): string {
  return `${slug}/${version > 0 ? `${version}/` : ''}`
}

const records = shallowRef<FiddleRecord[]>([])
const source = shallowRef<FiddleRegistrySource | null>(null)
const runtimeAggregate = shallowRef<FiddleRuntimeAggregate | null>(null)
const runtimeRecords = shallowRef<FiddleRuntimeRecord[]>([])
const ready = shallowRef(false)
const loading = shallowRef(false)
const error = shallowRef<Error | null>(null)
let initialization: Promise<void> | null = null
let controller: AbortController | null = null
let generation = 0

function safeToken(value: unknown, path: string): string {
  const text = requireNonEmptyString(value, path)
  if (!FIDDLE_TOKEN_PATTERN.test(text)) fail(path, 'must contain only URL-safe token characters')
  return text
}

function safeAuthor(value: unknown, path: string): string {
  const text = requireNonEmptyString(value, path)
  if (!JSFIDDLE_AUTHOR_PATTERN.test(text)) fail(path, 'must contain only URL-safe profile characters')
  return text
}

function positiveInteger(value: unknown, path: string): number {
  return requireSafeInteger(value, path, 1)
}

function stringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) fail(path, 'must be an array')
  return value.map((entry, index) => requireNonEmptyString(entry, `${path}[${index}]`))
}

function isoTimestamp(value: unknown, path: string): string {
  const text = requireNonEmptyString(value, path)
  const date = new Date(text)
  if (Number.isNaN(date.valueOf()) || date.toISOString() !== text) fail(path, 'must be an ISO timestamp')
  return text
}

function jsFiddleUrl(value: unknown, expected: string, path: string): string {
  const text = requireNonEmptyString(value, path)
  let url: URL
  try {
    url = new URL(text)
  } catch (reason) {
    fail(path, `must be a valid HTTPS ${JSFIDDLE_HOST} URL (${String(reason)})`)
  }
  if (url.protocol !== 'https:' || url.hostname !== JSFIDDLE_HOST || url.port || url.username || url.password || url.search || url.hash) {
    fail(path, `must be an HTTPS ${JSFIDDLE_HOST} URL without credentials, query, or hash`)
  }
  if (url.href !== expected) fail(path, `must be the canonical URL ${expected}`)
  return text
}

function parseSource(value: unknown, path: string): FiddleRegistrySource {
  requireExactKeys(value, ['platform', 'author', 'profileUrl', 'profilePages', 'recordCount', 'sourceRevision', 'acquiredAt'], [], path)
  if (value.platform !== 'jsfiddle') fail(`${path}.platform`, 'must be jsfiddle')
  const author = safeAuthor(value.author, `${path}.author`)
  const profilePages = positiveInteger(value.profilePages, `${path}.profilePages`)
  const recordCount = positiveInteger(value.recordCount, `${path}.recordCount`)
  jsFiddleUrl(value.profileUrl, fiddleProfileUrl(author, 1), `${path}.profileUrl`)
  const sourceRevision = requireNonEmptyString(value.sourceRevision, `${path}.sourceRevision`)
  if (!SHA256_PATTERN.test(sourceRevision)) fail(`${path}.sourceRevision`, 'must be a lowercase SHA-256 digest')
  const acquiredAt = isoTimestamp(value.acquiredAt, `${path}.acquiredAt`)
  return { platform: 'jsfiddle', author, profileUrl: value.profileUrl as string, profilePages, recordCount, sourceRevision, acquiredAt }
}

function parsePanelBytes(value: unknown, path: string): FiddlePanelBytes {
  requireExactKeys(value, ['html', 'js', 'css'], [], path)
  return {
    html: requireSafeInteger(value.html, `${path}.html`, 0),
    js:   requireSafeInteger(value.js, `${path}.js`, 0),
    css:  requireSafeInteger(value.css, `${path}.css`, 0),
  }
}

function parseFlags(value: unknown, path: string): FiddleFlags {
  requireExactKeys(value, ['can', 'svg', 'three', 'webgl', 'raf', 'tim', 'aud', 'net', 'anim', 'math', 'd3', 'plot', 'p5'], [], path)
  return {
    can:   requireSafeInteger(value.can, `${path}.can`, 0),
    svg:   requireSafeInteger(value.svg, `${path}.svg`, 0),
    three: requireBoolean(value.three, `${path}.three`),
    webgl: requireBoolean(value.webgl, `${path}.webgl`),
    raf:   requireBoolean(value.raf, `${path}.raf`),
    tim:   requireBoolean(value.tim, `${path}.tim`),
    aud:   requireBoolean(value.aud, `${path}.aud`),
    net:   requireBoolean(value.net, `${path}.net`),
    anim:  requireBoolean(value.anim, `${path}.anim`),
    math:  requireBoolean(value.math, `${path}.math`),
    d3:    requireBoolean(value.d3, `${path}.d3`),
    plot:  requireBoolean(value.plot, `${path}.plot`),
    p5:    requireBoolean(value.p5, `${path}.p5`),
  }
}

function parseRecord(value: unknown, index: number, source: FiddleRegistrySource): FiddleRecord {
  const path = `fiddle registry.records[${index}]`
  requireExactKeys(value, [
    'position', 'page', 'pastieId', 'slug', 'version', 'title', 'sourceUrl', 'embedUrl', 'panelBytes',
    'library', 'documentType', 'assets', 'controls', 'visualization', 'risk', 'flags',
  ], [], path)
  const position = positiveInteger(value.position, `${path}.position`)
  const page = positiveInteger(value.page, `${path}.page`)
  if (page > source.profilePages) fail(`${path}.page`, `must not exceed ${source.profilePages}`)
  const pastieId = safeToken(value.pastieId, `${path}.pastieId`)
  const slug = safeToken(value.slug, `${path}.slug`)
  const version = requireSafeInteger(value.version, `${path}.version`, 0)
  const fiddlePath = versionPath(slug, version)
  const sourceUrl = `https://${JSFIDDLE_HOST}/${source.author}/${fiddlePath}`
  const embedUrl = `https://${JSFIDDLE_HOST}/${source.author}/${fiddlePath}show/`
  return {
    position,
    page,
    pastieId,
    slug,
    version,
    title:        requireNonEmptyString(value.title, `${path}.title`),
    sourceUrl:    jsFiddleUrl(value.sourceUrl, sourceUrl, `${path}.sourceUrl`),
    embedUrl:     jsFiddleUrl(value.embedUrl, embedUrl, `${path}.embedUrl`),
    panelBytes:   parsePanelBytes(value.panelBytes, `${path}.panelBytes`),
    library:      requireNonEmptyString(value.library, `${path}.library`),
    documentType: requireNonEmptyString(value.documentType, `${path}.documentType`),
    assets:       stringArray(value.assets, `${path}.assets`),
    controls:     stringArray(value.controls, `${path}.controls`),
    visualization: requireNonEmptyString(value.visualization, `${path}.visualization`),
    risk:          requireNonEmptyString(value.risk, `${path}.risk`),
    flags:         parseFlags(value.flags, `${path}.flags`),
  }
}

export function parseFiddleRegistry(value: unknown): FiddleRegistry {
  requireExactKeys(value, ['schemaVersion', 'source', 'records'], [], 'fiddle registry')
  if (value.schemaVersion !== 1) fail('fiddle registry.schemaVersion', 'must be 1')
  const source = parseSource(value.source, 'fiddle registry.source')
  if (!Array.isArray(value.records)) fail('fiddle registry.records', 'must be an array')
  const parsedRecords = value.records.map((record, index) => parseRecord(record, index, source))
  if (source.recordCount !== parsedRecords.length) {
    fail('fiddle registry.source.recordCount', `must equal the ${parsedRecords.length} records present`)
  }
  if (parsedRecords.some((record, index) => record.position !== index + 1)) {
    fail('fiddle registry.records.position', 'must be contiguous and ordered from 1')
  }
  if (new Set(parsedRecords.map(({ pastieId }) => pastieId)).size !== parsedRecords.length) {
    fail('fiddle registry.records.pastieId', 'values must be unique')
  }
  if (new Set(parsedRecords.map(({ slug }) => slug)).size !== parsedRecords.length) {
    fail('fiddle registry.records.slug', 'values must be unique')
  }
  const pages = new Set(parsedRecords.map(({ page }) => page))
  if (pages.size !== source.profilePages || [...Array(source.profilePages)].some((_, index) => !pages.has(index + 1))) {
    fail('fiddle registry.source.profilePages', 'must match the contiguous pages represented by records')
  }
  return { schemaVersion: 1, source, records: parsedRecords }
}

async function initialize(): Promise<void> {
  if (initialization) return initialization
  const attempt = ++generation
  const attemptController = new AbortController()
  controller = attemptController
  loading.value = true
  ready.value = false
  error.value = null
  records.value = []
  runtimeAggregate.value = null
  runtimeRecords.value = []
  let successful = false
  const pending = Promise.resolve().then(async () => {
    try {
      const [registryResponse, runtimeResponse] = await Promise.all([
        fetch(FIDDLE_REGISTRY_PATH, { signal: attemptController.signal }),
        fetch(FIDDLE_RUNTIME_PATH, { signal: attemptController.signal }),
      ])
      if (!registryResponse.ok) throw new Error(`Fiddle registry failed to load (${registryResponse.status})`)
      if (!runtimeResponse.ok) throw new Error(`Fiddle runtime ledger failed to load (${runtimeResponse.status})`)
      const next = parseFiddleRegistry(await registryResponse.json())
      const runtime = parseFiddleRuntimeLedger(await runtimeResponse.json(), next)
      if (attempt !== generation) return
      records.value = next.records
      source.value = next.source
      runtimeAggregate.value = runtime.aggregate
      runtimeRecords.value = runtime.records
      ready.value = true
      successful = true
    } catch (reason) {
      if (attempt !== generation) return
      records.value = []
      source.value = null
      runtimeAggregate.value = null
      runtimeRecords.value = []
      if (attemptController.signal.aborted || (reason instanceof Error && reason.name === 'AbortError')) {
        ready.value = false
        error.value = null
      } else {
        error.value = reason instanceof Error ? reason : new Error(String(reason))
        ready.value = true
      }
    } finally {
      if (attempt === generation) {
        loading.value = false
        controller = null
        if (!successful) initialization = null
      }
    }
  })
  initialization = pending
  return pending
}

function getBySlug(slug: string): FiddleRecord | null {
  return records.value.find((record) => record.slug === slug) ?? null
}

function getRuntimeBySlug(slug: string): FiddleRuntimeRecord | null {
  return runtimeRecords.value.find((record) => record.slug === slug) ?? null
}

export function useFiddleRegistry() {
  return {
    records: readonly(records),
    source:  readonly(source),
    runtimeAggregate: readonly(runtimeAggregate),
    runtimeRecords:   readonly(runtimeRecords),
    ready:   readonly(ready),
    loading: readonly(loading),
    error:   readonly(error),
    initialize,
    getBySlug,
    getRuntimeBySlug,
  }
}

export function resetFiddleRegistryForTests(): void {
  generation += 1
  controller?.abort()
  controller = null
  initialization = null
  records.value = []
  source.value = null
  runtimeAggregate.value = null
  runtimeRecords.value = []
  ready.value = false
  loading.value = false
  error.value = null
}
