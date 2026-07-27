import { readonly, shallowRef } from 'vue'
import { parseWallPayload } from '../engine/numberWall'
import type { WallMode, WallPayload } from '../types/engine'
import type { WallWorkerResponse } from '../types/workers'
import { sha256 } from '../workbench/sha256'
import { clearRuntimeAuditDomain, publishRuntimeAudit } from './runtimeAudit'

export type { WallMode } from '../types/engine'

export const EXPECTED_WALLS = 351
export const WALL_IMPLEMENTATION_REVISION = 'number-wall-bareiss-worker-v2'
export const WALL_OUTPUT_SCHEMA_REVISION = 'number-wall-matrix-v2'

export interface WallInput {
  id: string
  title: string
  category: string
  kind: string
  description: string
  filename: string
  dimension?: string
}

export interface WallRunOptions {
  depth: number
  width: number
  mode: WallMode
  modulus: number
}

export interface WallSourceProvenance {
  url: string
  filename: string
  sha256: string
}

export interface WallResult {
  id: string
  width: number
  depth: number
  mode: WallMode
  values: Array<Array<string | number | null>>
  exactZeroMask: Array<Array<boolean | null>>
  min: number | null
  max: number | null
  zeroCount: number
  graphReady: boolean
  input: WallInput
  options: WallRunOptions
  payload: WallPayload
  sourceRevision: string
  implementationRevision: string
  outputSchemaRevision: string
  compatibilityKey: string
  sourceProvenance: WallSourceProvenance
}

type UnknownRecord = Record<string, unknown>

const walls = shallowRef<WallInput[]>([])
const ready = shallowRef(false)
const error = shallowRef<Error | null>(null)
let initialization: Promise<void> | null = null
let controller: AbortController | null = null
let generation = 0

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(record: UnknownRecord, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null && value !== '') return String(value)
  }
  return fallback
}

function wallFrom(record: UnknownRecord): WallInput {
  const id = text(record, ['id', 'slug'])
  const filename = text(record, ['filename'], `${id}.json`)
  if (!id || !text(record, ['title', 'name']) || !filename) throw new TypeError('Number-wall registry entry requires an ID, title, and filename')
  return {
    id,
    title: text(record, ['title', 'name']),
    category: text(record, ['category'], 'unclassified'),
    kind: text(record, ['kind'], 'terms'),
    description: text(record, ['description']),
    filename,
    dimension: text(record, ['dimension']),
  }
}

export function parseWallIndex(value: unknown): WallInput[] {
  if (!Array.isArray(value)) throw new TypeError('Number-wall registry is not an array')
  const items = value.map((entry) => {
    if (!isRecord(entry)) throw new TypeError('Number-wall registry contains a non-object entry')
    return wallFrom(entry)
  })
  if (items.length !== EXPECTED_WALLS) throw new Error(`Number-wall registry contains ${items.length}/${EXPECTED_WALLS} entries`)
  if (new Set(items.map(({ id }) => id)).size !== items.length) throw new Error('Number-wall registry IDs must be unique')
  if (new Set(items.map(({ filename }) => filename)).size !== items.length) throw new Error('Number-wall registry filenames must be unique')
  return items
}

function publishSuccess(items: WallInput[]): void {
  publishRuntimeAudit({ walls: { status: 'ready', registered: items.length } })
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
    walls.value = []
    clearRuntimeAuditDomain('walls')
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/generated/walls.json`, { signal: attemptController.signal })
      if (!response.ok) throw new Error(`Number-wall registry failed to load (${response.status})`)
      const next = parseWallIndex(await response.json())
      if (attempt !== generation) return
      walls.value = next
      publishSuccess(next)
      ready.value = true
      successful = true
    } catch (reason) {
      if (attempt !== generation) return
      walls.value = []
      if (attemptController.signal.aborted) {
        ready.value = false
        error.value = null
        clearRuntimeAuditDomain('walls')
      } else {
        error.value = reason instanceof Error ? reason : new Error(String(reason))
        publishRuntimeAudit({ walls: { status: 'error', error: error.value.message } })
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

async function wallById(id: string): Promise<WallInput | null> {
  await initialize()
  return walls.value.find((wall) => wall.id === id) ?? null
}

function cloneWallInput(input: WallInput): WallInput {
  return {
    id:          input.id,
    title:       input.title,
    category:    input.category,
    kind:        input.kind,
    description: input.description,
    filename:    input.filename,
    ...(input.dimension === undefined ? {} : { dimension: input.dimension }),
  }
}

function cloneWallOptions(options: WallRunOptions): WallRunOptions {
  return {
    depth:   options.depth,
    width:   options.width,
    mode:    options.mode,
    modulus: options.modulus,
  }
}

function wallPayloadUrl(filename: string): string {
  if (!filename.endsWith('.json') || filename.includes('/') || filename.includes('\\')) throw new Error('Unsafe wall filename')
  return `${import.meta.env.BASE_URL}data/number-walls/${encodeURIComponent(filename)}`
}

export function wallCompatibilityKey(
  wallId: string,
  sourceRevision: string,
  options: Pick<WallRunOptions, 'mode' | 'width' | 'depth' | 'modulus'>,
): string {
  return sha256(JSON.stringify({
    wallId,
    sourceRevision,
    mode:                   options.mode,
    modulus:                options.mode === 'mod' || options.mode === 'valuation' ? options.modulus : null,
    width:                  options.width,
    depth:                  options.depth,
    implementationRevision: WALL_IMPLEMENTATION_REVISION,
    outputSchemaRevision:   WALL_OUTPUT_SCHEMA_REVISION,
  }))
}

async function runWall(input: WallInput, options: WallRunOptions, signal?: AbortSignal, onProgress?: (value: number) => void): Promise<WallResult> {
  const cancelled = () => new DOMException('Simulation cancelled', 'AbortError')
  const dispatchedInput = cloneWallInput(input)
  const dispatchedOptions = cloneWallOptions(options)
  if (signal?.aborted) throw cancelled()
  await initialize()
  if (signal?.aborted) throw cancelled()
  if (error.value) throw error.value
  onProgress?.(5)
  const sourceUrl = wallPayloadUrl(dispatchedInput.filename)
  let sourceText: string
  try {
    const response = await fetch(sourceUrl, { signal })
    if (!response.ok) throw new Error(`Failed to load wall payload ${dispatchedInput.filename}: ${response.status}`)
    sourceText = await response.text()
  } catch (reason) {
    if (signal?.aborted) throw cancelled()
    throw reason
  }
  if (signal?.aborted) throw cancelled()
  const payload = parseWallPayload(JSON.parse(sourceText) as unknown)
  if (payload.id !== dispatchedInput.id) {
    throw new Error(`Wall payload ID ${payload.id} does not match registry ID ${dispatchedInput.id}`)
  }
  const sourceRevision = sha256(sourceText)
  const compatibilityKey = wallCompatibilityKey(dispatchedInput.id, sourceRevision, dispatchedOptions)
  onProgress?.(15)
  let NumberWallWorker: typeof import('../workers/numberWall.worker?worker')['default']
  try {
    const workerModule = await import('../workers/numberWall.worker?worker')
    NumberWallWorker = workerModule.default
  } catch (reason) {
    if (signal?.aborted) throw cancelled()
    throw reason
  }
  if (signal?.aborted) throw cancelled()
  const worker = new NumberWallWorker()
  const requestId = `${dispatchedInput.id}-${Date.now()}`
  return new Promise<WallResult>((resolve, reject) => {
    let settled = false
    const stop = () => {
      worker.terminate()
      signal?.removeEventListener('abort', abort)
    }
    const abort = () => {
      if (settled) return
      settled = true
      stop()
      reject(cancelled())
    }
    signal?.addEventListener('abort', abort, { once: true })
    worker.addEventListener('error', (event) => {
      if (settled) return
      settled = true
      stop()
      reject(new Error(event.message || 'Number-wall worker failed'))
    }, { once: true })
    worker.addEventListener('message', (event: MessageEvent<WallWorkerResponse>) => {
      if (settled) return
      if (signal?.aborted) {
        abort()
        return
      }
      const response = event.data
      if (response.requestId !== requestId) return
      if (response.type === 'error') {
        settled = true
        stop()
        reject(new Error(response.error))
        return
      }
      if (response.type === 'cancelled') {
        abort()
        return
      }
      const simulation = response.result
      const rows = Array.from({ length: simulation.depth + 2 }, () => Array<string | number | null>(simulation.terms).fill(null))
      const exactZeroMask = Array.from({ length: simulation.depth + 2 }, () => Array<boolean | null>(simulation.terms).fill(null))
      let min = Number.POSITIVE_INFINITY
      let max = Number.NEGATIVE_INFINITY
      let zeroCount = 0
      for (const cell of simulation.cells) {
        const row = rows[cell.row + 1]
        if (!row || cell.column < 0 || cell.column >= row.length) continue
        const signedValue = (simulation.mode === 'signed_log' || simulation.mode === 'row_signed_log') && typeof cell.value === 'number'
          ? cell.value * (cell.sign ?? 0)
          : cell.value
        row[cell.column] = cell.exact ?? signedValue
        exactZeroMask[cell.row + 1]![cell.column] = cell.isExactZero
        if (signedValue !== null) {
          const numeric = typeof signedValue === 'number' ? signedValue : Number(signedValue)
          if (Number.isFinite(numeric)) {
            min = Math.min(min, numeric)
            max = Math.max(max, numeric)
          }
        }
        if (cell.isExactZero) zeroCount += 1
      }
      settled = true
      stop()
      onProgress?.(100)
      resolve({
        id: simulation.id,
        width: simulation.terms,
        depth: simulation.depth + 2,
        mode: simulation.mode,
        values: rows,
        exactZeroMask,
        min: Number.isFinite(min) ? min : null,
        max: Number.isFinite(max) ? max : null,
        zeroCount,
        graphReady: simulation.cells.length > 0,
        input: dispatchedInput,
        options: dispatchedOptions,
        payload,
        sourceRevision,
        implementationRevision: WALL_IMPLEMENTATION_REVISION,
        outputSchemaRevision: WALL_OUTPUT_SCHEMA_REVISION,
        compatibilityKey,
        sourceProvenance: {
          url: sourceUrl,
          filename: dispatchedInput.filename,
          sha256: sourceRevision,
        },
      })
    })
    if (signal?.aborted) {
      abort()
      return
    }
    onProgress?.(25)
    worker.postMessage({
      type: 'simulate-wall',
      requestId,
      payload,
      options: {
        terms: Math.min(dispatchedOptions.width, payload.sequence.length),
        depth: dispatchedOptions.depth,
        mode: dispatchedOptions.mode,
        modulus: dispatchedOptions.modulus,
        valuationPrime: dispatchedOptions.modulus,
      },
    })
  })
}

export function useWallRegistry() {
  return {
    walls: readonly(walls),
    ready: readonly(ready),
    error: readonly(error),
    initialize,
    wallById,
    runWall,
  }
}

export function setWallRegistryForTests(value: WallInput[] | null): void {
  generation += 1
  controller?.abort()
  controller = null
  initialization = null
  walls.value = []
  ready.value = false
  error.value = null
  clearRuntimeAuditDomain('walls')
  if (!value) return
  walls.value = value
  publishSuccess(value)
  ready.value = true
  initialization = Promise.resolve()
}

export function resetWallRegistryForTests(): void {
  generation += 1
  controller?.abort()
  controller = null
  walls.value = []
  ready.value = false
  error.value = null
  initialization = null
  clearRuntimeAuditDomain('walls')
}
