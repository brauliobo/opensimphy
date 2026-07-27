import type { WorkbenchSnapshotInputV1 } from '../../src/types/workbench'
import {
  createSavedRunStorageKey,
  resetSavedRunRegistryForTests,
  SavedRunPersistenceError,
  setSavedRunRegistryDependenciesForTests,
  useSavedRunRegistry,
} from '../../src/registries/savedRunRegistry'
import {
  MAX_SAVED_RUN_BYTES,
  parseSavedRunsJson,
  SavedRunSizeError,
  serializedByteLength,
} from '../../src/workbench/savedRuns'

const FIRST_TIME = '2026-07-27T10:00:00.000Z'
const SECOND_TIME = '2026-07-27T11:00:00.000Z'
const COMPATIBILITY_KEY = 'a'.repeat(64)

class MemoryStorage {
  readonly values = new Map<string, string>()
  readonly removed: string[] = []
  reads = 0
  writes = 0
  failReads = false
  failWrites = false
  failRemoves = false

  getItem(key: string): string | null {
    this.reads += 1
    if (this.failReads) throw new Error('blocked read')
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.writes += 1
    if (this.failWrites) throw new DOMException('quota exceeded', 'QuotaExceededError')
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    if (this.failRemoves) throw new Error('blocked remove')
    this.removed.push(key)
    this.values.delete(key)
  }
}

function runInput(overrides: Partial<WorkbenchSnapshotInputV1> = {}): WorkbenchSnapshotInputV1 {
  return {
    programId:              'EARTH-PHYS-001',
    methodId:               'traditional-baseline',
    inputs:                 { radiusMetres: 10 },
    outputs:                { compactness: 0.1 },
    finding:                { status: 'compared', establishes: 'bounded comparison' },
    provenance:             { owner: 'earth-worker', evidenceRefs: ['source-one'] },
    sourceRevision:         'earth-source-revision-v1',
    implementationRevision: 'earth-worker-v1',
    compatibilityKey:      COMPATIBILITY_KEY,
    ...overrides,
  } as WorkbenchSnapshotInputV1
}

describe('saved-run storage', () => {
  afterEach(() => {
    resetSavedRunRegistryForTests()
    window.localStorage.clear()
  })

  it('does not read, write, or hydrate until explicitly requested', () => {
    const storage = new MemoryStorage()
    setSavedRunRegistryDependenciesForTests({ storage, now: () => FIRST_TIME })
    const registry = useSavedRunRegistry()

    expect(storage.reads).toBe(0)
    expect(storage.writes).toBe(0)
    expect(registry.hydrated.value).toBe(false)
    expect(registry.runs.value).toEqual([])

    registry.hydrate()
    registry.hydrate()

    expect(storage.reads).toBe(1)
    expect(storage.writes).toBe(0)
    expect(registry.hydrated.value).toBe(true)
  })

  it('saves only on explicit action and stamps the injected clock', () => {
    const storage = new MemoryStorage()
    const key = createSavedRunStorageKey('/physics/')
    const mutable = runInput() as WorkbenchSnapshotInputV1 & { inputs: { radiusMetres: number } }
    setSavedRunRegistryDependenciesForTests({ storage, now: () => FIRST_TIME, baseUrl: '/physics/' })
    const registry = useSavedRunRegistry()

    expect(storage.values.has(key)).toBe(false)
    const saved = registry.save(mutable)
    mutable.inputs.radiusMetres = 99

    expect(saved.timestamp).toBe(FIRST_TIME)
    expect(saved.inputs).toEqual({ radiusMetres: 10 })
    expect(registry.runs.value).toEqual([saved])
    expect(Object.isFrozen(saved)).toBe(true)
    expect(Object.isFrozen(registry.runs.value)).toBe(true)
    expect(parseSavedRunsJson(storage.values.get(key)!)).toEqual({ schemaVersion: 1, runs: [saved] })
    expect(registry.persistenceError.value).toBeNull()
  })

  it('hydrates an exact versioned document without rewriting it', () => {
    const storage = new MemoryStorage()
    const key = createSavedRunStorageKey('/')
    setSavedRunRegistryDependenciesForTests({ storage, now: () => FIRST_TIME })
    const firstRegistry = useSavedRunRegistry()
    const saved = firstRegistry.save(runInput())
    const stored = storage.values.get(key)!

    resetSavedRunRegistryForTests()
    storage.writes = 0
    setSavedRunRegistryDependenciesForTests({ storage })
    const registry = useSavedRunRegistry()
    registry.hydrate()

    expect(registry.runs.value).toEqual([saved])
    expect(storage.values.get(key)).toBe(stored)
    expect(storage.writes).toBe(0)
  })

  it('fails closed on malformed, unknown-version, and non-exact storage documents', () => {
    const malformed = [
      '{not json',
      '{"schemaVersion":2,"runs":[]}',
      '{"schemaVersion":1,"runs":[],"extra":true}',
      '{"schemaVersion":1,"runs":{}}',
    ]
    for (const stored of malformed) {
      const storage = new MemoryStorage()
      storage.values.set(createSavedRunStorageKey('/'), stored)
      setSavedRunRegistryDependenciesForTests({ storage })
      const registry = useSavedRunRegistry()

      registry.hydrate()

      expect(registry.runs.value).toEqual([])
      expect(registry.persistenceError.value).toBeInstanceOf(SavedRunPersistenceError)
      expect(registry.persistenceError.value?.operation).toBe('hydrate')
      resetSavedRunRegistryForTests()
    }
  })

  it('surfaces quota failure while retaining the validated in-memory run', () => {
    const storage = new MemoryStorage()
    storage.failWrites = true
    setSavedRunRegistryDependenciesForTests({ storage, now: () => FIRST_TIME })
    const registry = useSavedRunRegistry()

    const saved = registry.save(runInput())

    expect(registry.runs.value).toEqual([saved])
    expect(registry.persistenceError.value).toBeInstanceOf(SavedRunPersistenceError)
    expect(registry.persistenceError.value?.operation).toBe('save')
    expect(registry.persistenceError.value?.cause).toBeInstanceOf(DOMException)
    expect(storage.values.size).toBe(0)
  })

  it('rejects oversized runs before changing memory or touching storage', () => {
    const storage = new MemoryStorage()
    setSavedRunRegistryDependenciesForTests({ storage, now: () => FIRST_TIME })
    const registry = useSavedRunRegistry()
    const oversized = 'x'.repeat(MAX_SAVED_RUN_BYTES)

    expect(() => registry.save(runInput({ outputs: { artifact: oversized } }))).toThrow(SavedRunSizeError)
    expect(registry.runs.value).toEqual([])
    expect(storage.writes).toBe(0)
    expect(registry.persistenceError.value).toBeNull()
    expect(serializedByteLength('\u00e9')).toBe(2)
  })

  it('deletes explicitly and rejects duplicate clock timestamps', () => {
    const storage = new MemoryStorage()
    let currentTime = FIRST_TIME
    setSavedRunRegistryDependenciesForTests({ storage, now: () => currentTime })
    const registry = useSavedRunRegistry()
    const first = registry.save(runInput())

    expect(() => registry.save(runInput({ methodId: 'second-method' }))).toThrow(/already exists/)
    currentTime = SECOND_TIME
    const second = registry.save(runInput({ methodId: 'second-method' }))

    expect(registry.deleteRun(first.timestamp)).toBe(true)
    expect(registry.runs.value).toEqual([second])
    expect(registry.deleteRun(first.timestamp)).toBe(false)
    expect(() => registry.deleteRun('not-a-time')).toThrow(/ISO timestamp/)
  })

  it('keeps deletion in memory when persistence fails', () => {
    const storage = new MemoryStorage()
    setSavedRunRegistryDependenciesForTests({ storage, now: () => FIRST_TIME })
    const registry = useSavedRunRegistry()
    const saved = registry.save(runInput())
    storage.failWrites = true

    expect(registry.deleteRun(saved.timestamp)).toBe(false)
    expect(registry.runs.value).toEqual([])
    expect(registry.persistenceError.value?.operation).toBe('delete')
  })

  it('clears only its BASE_URL-namespaced saved-run key', () => {
    const storage = new MemoryStorage()
    const key = createSavedRunStorageKey('/physics/')
    const otherBaseKey = createSavedRunStorageKey('/other/')
    const progressKey = 'opensimphy:%2Fphysics%2F:tour-progress:v1'
    storage.values.set(otherBaseKey, 'other saved runs')
    storage.values.set(progressKey, 'tour progress')
    storage.values.set('unrelated', 'keep')
    setSavedRunRegistryDependenciesForTests({ storage, now: () => FIRST_TIME, baseUrl: '/physics/' })
    const registry = useSavedRunRegistry()
    registry.save(runInput())

    expect(registry.clear()).toBe(true)

    expect(registry.runs.value).toEqual([])
    expect(storage.removed).toEqual([key])
    expect(storage.values.get(otherBaseKey)).toBe('other saved runs')
    expect(storage.values.get(progressKey)).toBe('tour progress')
    expect(storage.values.get('unrelated')).toBe('keep')
  })

  it('surfaces read and clear failures while memory remains usable', () => {
    const storage = new MemoryStorage()
    storage.failReads = true
    setSavedRunRegistryDependenciesForTests({ storage, now: () => FIRST_TIME })
    const registry = useSavedRunRegistry()

    registry.hydrate()
    expect(registry.persistenceError.value?.operation).toBe('hydrate')
    storage.failReads = false
    registry.save(runInput())
    expect(registry.runs.value).toHaveLength(1)

    storage.failRemoves = true
    expect(registry.clear()).toBe(false)
    expect(registry.runs.value).toEqual([])
    expect(registry.persistenceError.value?.operation).toBe('clear')
  })

  it('uses independent versioned keys for distinct BASE_URL values', () => {
    const root = createSavedRunStorageKey('/')
    const nested = createSavedRunStorageKey('/physics/')

    expect(root).toContain('saved-runs:v1')
    expect(root).not.toBe(nested)
  })

  it('rejects invalid injected clock values before persistence', () => {
    const storage = new MemoryStorage()
    setSavedRunRegistryDependenciesForTests({ storage, now: () => 'tomorrow' })
    const registry = useSavedRunRegistry()

    expect(() => registry.save(runInput())).toThrow(/ISO timestamp/)
    expect(registry.runs.value).toEqual([])
    expect(storage.writes).toBe(0)
  })
})
