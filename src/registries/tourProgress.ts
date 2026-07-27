import { computed, readonly, shallowRef } from 'vue'
import {
  completeLesson as completeTourLesson,
  completeStation as completeTourStation,
  createTourProgress,
  exportTourProgressJson,
  markChapterComplete as completeTourChapter,
  parseTourProgressJson,
  parseTourProgressJsonResult,
  setDepth as setTourDepth,
  setLastAnchor as setTourLastAnchor,
  visitLesson as visitTourLesson,
  visitStation as visitTourStation,
} from '../tour/progress'
import type { ReadingDepth, TourProgress } from '../types/tour'

export interface TourProgressStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface TourProgressTestDependencies {
  storage?: TourProgressStorage | null
  now?: () => string
  baseUrl?: string
}

export class TourProgressPersistenceError extends Error {
  constructor(operation: 'hydrate' | 'persist' | 'clear', cause: unknown) {
    super(`Tour progress could not ${operation}`, { cause })
    this.name = 'TourProgressPersistenceError'
  }
}

const state = shallowRef<TourProgress>(createTourProgress())
const persistenceError = shallowRef<TourProgressPersistenceError | null>(null)
const hydrated = shallowRef(false)
let testDependencies: TourProgressTestDependencies = {}

export function createTourProgressStorageKey(baseUrl: string): string {
  return `opensimphy:${encodeURIComponent(baseUrl || '/')}:tour-progress:v1`
}

function storageKey(): string {
  return createTourProgressStorageKey(testDependencies.baseUrl ?? import.meta.env.BASE_URL)
}

function storage(): TourProgressStorage {
  if (testDependencies.storage === null) throw new Error('Local storage is unavailable')
  if (testDependencies.storage) return testDependencies.storage
  if (typeof window === 'undefined') throw new Error('Local storage is unavailable')
  return window.localStorage
}

function updatedAt(): string {
  return testDependencies.now?.() ?? new Date().toISOString()
}

function persist(next: TourProgress): boolean {
  state.value = next
  try {
    storage().setItem(storageKey(), exportTourProgressJson(next))
    persistenceError.value = null
    return true
  } catch (cause) {
    persistenceError.value = new TourProgressPersistenceError('persist', cause)
    return false
  }
}

function hydrate(): void {
  if (hydrated.value) return
  try {
    const stored = storage().getItem(storageKey())
    state.value = stored === null ? createTourProgress() : parseTourProgressJson(stored)
    persistenceError.value = null
  } catch (cause) {
    persistenceError.value = new TourProgressPersistenceError('hydrate', cause)
  } finally {
    hydrated.value = true
  }
}

function setDepth(readingDepth: ReadingDepth): boolean {
  return persist(setTourDepth(state.value, readingDepth))
}

function visitLesson(chapterId: string, lessonId: string, route: string): boolean {
  return persist(visitTourLesson(state.value, chapterId, lessonId, route, updatedAt()))
}

function completeLesson(chapterId: string, lessonId: string, route?: string): boolean {
  return persist(completeTourLesson(state.value, chapterId, lessonId, updatedAt(), route))
}

function visitStation(stationId: string, route: string): boolean {
  return persist(visitTourStation(state.value, stationId, route, updatedAt()))
}

function completeStation(stationId: string, route?: string): boolean {
  return persist(completeTourStation(state.value, stationId, updatedAt(), route))
}

function setLastAnchor(lessonId: string, anchor: string): boolean {
  return persist(setTourLastAnchor(state.value, lessonId, anchor))
}

function markChapterComplete(chapterId: string, requiredLessonIds?: readonly string[]): boolean {
  const next = completeTourChapter(state.value, chapterId, updatedAt(), requiredLessonIds)
  persist(next)
  return next.chapters[chapterId]?.status === 'complete'
}

function exportProgress(): string {
  return exportTourProgressJson(state.value)
}

function importProgress(json: string): boolean {
  const parsed = parseTourProgressJsonResult(json)
  if (!parsed.valid) return false
  persist(parsed.progress)
  return true
}

const exportJson = exportProgress
const importJson = importProgress

function clear(): boolean {
  state.value = createTourProgress()
  try {
    storage().removeItem(storageKey())
    persistenceError.value = null
    return true
  } catch (cause) {
    persistenceError.value = new TourProgressPersistenceError('clear', cause)
    return false
  }
}

const depth = computed(() => state.value.readingDepth)
const resume = computed(() => state.value.resumeRoute)
const currentStorageKey = computed(storageKey)

export function useTourProgress() {
  return {
    state: readonly(state),
    depth: readonly(depth),
    resume: readonly(resume),
    hydrated: readonly(hydrated),
    persistenceError: readonly(persistenceError),
    storageKey: readonly(currentStorageKey),
    setDepth,
    visitLesson,
    completeLesson,
    visitStation,
    completeStation,
    setLastAnchor,
    markChapterComplete,
    exportProgress,
    importProgress,
    exportJson,
    importJson,
    clear,
    hydrate,
  }
}

export function setTourProgressDependenciesForTests(dependencies: TourProgressTestDependencies): void {
  testDependencies = { ...dependencies }
}

export function setTourProgressStorageForTests(value: TourProgressStorage | null): void {
  testDependencies = { ...testDependencies, storage: value }
}

export function resetTourProgressForTests(): void {
  state.value = createTourProgress()
  persistenceError.value = null
  hydrated.value = false
  testDependencies = {}
}
