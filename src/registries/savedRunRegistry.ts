import { computed, readonly, shallowRef } from 'vue'
import type { WorkbenchSnapshotInputV1, WorkbenchSnapshotV1 } from '../types/workbench'
import { createWorkbenchSnapshot, validateWorkbenchTimestamp } from '../workbench/snapshots'
import { parseSavedRunsJson, serializeSavedRuns, validateSavedRunSize } from '../workbench/savedRuns'

export interface SavedRunStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface SavedRunRegistryTestDependencies {
  storage?: SavedRunStorage | null
  now?: () => string
  baseUrl?: string
}

type SavedRunPersistenceOperation = 'hydrate' | 'save' | 'delete' | 'clear'

export class SavedRunPersistenceError extends Error {
  readonly operation: SavedRunPersistenceOperation

  constructor(operation: SavedRunPersistenceOperation, cause: unknown) {
    super(`Saved runs could not ${operation}`, { cause })
    this.name = 'SavedRunPersistenceError'
    this.operation = operation
  }
}

const EMPTY_RUNS = Object.freeze([]) as readonly WorkbenchSnapshotV1[]
const runs = shallowRef<readonly WorkbenchSnapshotV1[]>(EMPTY_RUNS)
const persistenceError = shallowRef<SavedRunPersistenceError | null>(null)
const hydrated = shallowRef(false)
let testDependencies: SavedRunRegistryTestDependencies = {}

export function createSavedRunStorageKey(baseUrl: string): string {
  return `opensimphy:${encodeURIComponent(baseUrl || '/')}:saved-runs:v1`
}

function storageKey(): string {
  return createSavedRunStorageKey(testDependencies.baseUrl ?? import.meta.env.BASE_URL)
}

function storage(): SavedRunStorage {
  if (testDependencies.storage === null) throw new Error('Local storage is unavailable')
  if (testDependencies.storage) return testDependencies.storage
  if (typeof window === 'undefined') throw new Error('Local storage is unavailable')
  return window.localStorage
}

function now(): string {
  return testDependencies.now?.() ?? new Date().toISOString()
}

function persist(next: readonly WorkbenchSnapshotV1[], operation: 'save' | 'delete'): boolean {
  runs.value = Object.freeze([...next])
  try {
    storage().setItem(storageKey(), serializeSavedRuns(runs.value))
    persistenceError.value = null
    return true
  } catch (cause) {
    persistenceError.value = new SavedRunPersistenceError(operation, cause)
    return false
  }
}

function hydrate(): void {
  if (hydrated.value) return
  try {
    const stored = storage().getItem(storageKey())
    runs.value = stored === null ? EMPTY_RUNS : parseSavedRunsJson(stored).runs
    persistenceError.value = null
  } catch (cause) {
    persistenceError.value = new SavedRunPersistenceError('hydrate', cause)
  } finally {
    hydrated.value = true
  }
}

function save(input: WorkbenchSnapshotInputV1): WorkbenchSnapshotV1 {
  const run = validateSavedRunSize(createWorkbenchSnapshot(input, now()))
  if (runs.value.some(({ timestamp }) => timestamp === run.timestamp)) {
    throw new TypeError(`A saved run already exists at ${run.timestamp}`)
  }
  persist([...runs.value, run], 'save')
  return run
}

function deleteRun(timestamp: string): boolean {
  const validatedTimestamp = validateWorkbenchTimestamp(timestamp)
  const next = runs.value.filter((run) => run.timestamp !== validatedTimestamp)
  if (next.length === runs.value.length) return false
  return persist(next, 'delete')
}

function clear(): boolean {
  runs.value = EMPTY_RUNS
  try {
    storage().removeItem(storageKey())
    persistenceError.value = null
    return true
  } catch (cause) {
    persistenceError.value = new SavedRunPersistenceError('clear', cause)
    return false
  }
}

const currentStorageKey = computed(storageKey)

export function useSavedRunRegistry() {
  return {
    runs:             readonly(runs),
    hydrated:         readonly(hydrated),
    persistenceError: readonly(persistenceError),
    storageKey:       readonly(currentStorageKey),
    hydrate,
    save,
    deleteRun,
    clear,
  }
}

export function setSavedRunRegistryDependenciesForTests(dependencies: SavedRunRegistryTestDependencies): void {
  testDependencies = { ...dependencies }
}

export function resetSavedRunRegistryForTests(): void {
  runs.value = EMPTY_RUNS
  persistenceError.value = null
  hydrated.value = false
  testDependencies = {}
}
