import { vi } from 'vitest'
import { sha256 } from '../../src/workbench/sha256'
import { wall } from './fixtures'

const workerModule = vi.hoisted(() => {
  let resolveImport!: () => void
  const importReady = new Promise<void>((done) => { resolveImport = done })
  return {
    importReady,
    resolveImport,
    requested:     false,
    constructions: 0,
    autoRespond:   false,
    instances:     [] as Array<{ terminated: boolean }>,
    posted:        [] as Array<Record<string, any>>,
  }
})

vi.mock('../../src/workers/numberWall.worker?worker', async () => {
  workerModule.requested = true
  await workerModule.importReady
  return {
    default: class NumberWallWorkerMock {
      readonly listeners = new Map<string, Array<(event: any) => void>>()
      terminated = false

      constructor() {
        workerModule.constructions += 1
        workerModule.instances.push(this)
      }

      addEventListener(type: string, listener: (event: any) => void): void {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
      }

      postMessage(message: Record<string, any>): void {
        workerModule.posted.push(message)
        if (!workerModule.autoRespond) return
        queueMicrotask(() => {
          const result = {
            id:    message.payload.id,
            terms: message.options.terms,
            depth: message.options.depth,
            mode:  message.options.mode,
            cells: [
              { row: -1, column: 0, value: 1, sign: 1, exact: '1', isExactZero: false },
              { row: 0, column: 1, value: null, sign: 0, exact: '0', isExactZero: true },
            ],
          }
          for (const listener of this.listeners.get('message') ?? []) {
            listener({ data: { type: 'result', requestId: message.requestId, result } })
          }
        })
      }

      terminate(): void {
        this.terminated = true
      }
    },
  }
})

import {
  resetWallRegistryForTests,
  setWallRegistryForTests,
  useWallRegistry,
  WALL_IMPLEMENTATION_REVISION,
  WALL_OUTPUT_SCHEMA_REVISION,
  wallCompatibilityKey,
} from '../../src/registries/wallRegistry'

const SOURCE_TEXT = '{"id":"catalan","title":"Catalan","kind":"terms","sequence":["1","1","2","5"]}'

function payloadResponse(): Response {
  return new Response(SOURCE_TEXT, { status: 200, headers: { 'content-type': 'application/json' } })
}

describe('number-wall registry lifecycle', () => {
  beforeEach(() => {
    setWallRegistryForTests([wall])
    vi.stubGlobal('fetch', vi.fn(async () => payloadResponse()))
    workerModule.autoRespond = false
    workerModule.constructions = 0
    workerModule.posted.length = 0
    workerModule.instances.length = 0
  })

  afterEach(() => {
    resetWallRegistryForTests()
    vi.unstubAllGlobals()
  })

  it('settles AbortError without constructing a worker when aborted during dynamic import', async () => {
    const controller = new AbortController()
    const progress: number[] = []
    const pending = useWallRegistry().runWall(wall, {
      depth: 3,
      width: 4,
      mode: 'signed_log',
      modulus: 7,
    }, controller.signal, (value) => progress.push(value))
    await vi.waitFor(() => expect(workerModule.requested).toBe(true))

    controller.abort()
    workerModule.resolveImport()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(workerModule.constructions).toBe(0)
    expect(progress).toEqual([5, 15])
  })

  it('fetches exact text, retains immutable dispatch inputs, and declares revisions and compatibility', async () => {
    workerModule.autoRespond = true
    const mutableWall = { ...wall }
    const mutableOptions = { depth: 3, width: 4, mode: 'signed_log' as const, modulus: 7 }
    const pending = useWallRegistry().runWall(mutableWall, mutableOptions)
    mutableWall.title = 'Mutated after dispatch'
    mutableOptions.depth = 9
    mutableOptions.modulus = 11

    const result = await pending
    const sourceRevision = sha256(SOURCE_TEXT)

    expect(fetch).toHaveBeenCalledWith('/data/number-walls/catalan.json', { signal: undefined })
    expect(result.input.title).toBe('Catalan Numbers')
    expect(result.options).toEqual({ depth: 3, width: 4, mode: 'signed_log', modulus: 7 })
    expect(result.payload).toMatchObject({ id: 'catalan', sequence: ['1', '1', '2', '5'] })
    expect(result.sourceRevision).toBe(sourceRevision)
    expect(result.sourceProvenance).toEqual({
      url:      '/data/number-walls/catalan.json',
      filename: 'catalan.json',
      sha256:   sourceRevision,
    })
    expect(result.implementationRevision).toBe(WALL_IMPLEMENTATION_REVISION)
    expect(result.outputSchemaRevision).toBe(WALL_OUTPUT_SCHEMA_REVISION)
    expect(result.compatibilityKey).toBe(wallCompatibilityKey('catalan', sourceRevision, {
      mode: 'signed_log',
      width: 4,
      depth: 3,
      modulus: 7,
    }))
    expect(result.values[0]?.[0]).toBe('1')
    expect(result.values[1]?.[1]).toBe('0')
    expect(workerModule.posted[0]?.options).toMatchObject({ terms: 4, depth: 3, mode: 'signed_log', modulus: 7 })
  })

  it('binds modular and valuation bases while omitting unused display parameters', () => {
    const revision = 'a'.repeat(64)
    const baseline = wallCompatibilityKey('catalan', revision, { mode: 'mod', width: 32, depth: 16, modulus: 7 })

    expect(baseline).not.toBe(wallCompatibilityKey('catalan', revision, { mode: 'mod', width: 32, depth: 16, modulus: 11 }))
    expect(baseline).not.toBe(wallCompatibilityKey('fibonacci', revision, { mode: 'mod', width: 32, depth: 16, modulus: 7 }))
    expect(baseline).not.toBe(wallCompatibilityKey('catalan', 'b'.repeat(64), { mode: 'mod', width: 32, depth: 16, modulus: 7 }))
    expect(baseline).not.toBe(wallCompatibilityKey('catalan', revision, { mode: 'signed_log', width: 32, depth: 16, modulus: 7 }))
    expect(baseline).not.toBe(wallCompatibilityKey('catalan', revision, { mode: 'mod', width: 16, depth: 16, modulus: 7 }))
    expect(baseline).not.toBe(wallCompatibilityKey('catalan', revision, { mode: 'mod', width: 32, depth: 8, modulus: 7 }))
    expect(wallCompatibilityKey('catalan', revision, { mode: 'signed_log', width: 32, depth: 16, modulus: 7 }))
      .toBe(wallCompatibilityKey('catalan', revision, { mode: 'signed_log', width: 32, depth: 16, modulus: 11 }))
  })

  it('terminates each fresh worker when an active run is cancelled', async () => {
    const controller = new AbortController()
    const pending = useWallRegistry().runWall(wall, {
      depth: 3,
      width: 4,
      mode: 'signed_log',
      modulus: 7,
    }, controller.signal)
    await vi.waitFor(() => expect(workerModule.constructions).toBe(1))

    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(workerModule.instances[0]?.terminated).toBe(true)
  })
})
