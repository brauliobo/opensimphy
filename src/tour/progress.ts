import type { ReadingDepth, TourProgress } from '../types/tour'

export interface TourProgressParseResult {
  progress: TourProgress
  valid: boolean
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const SAFE_ANCHOR = /^#?[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function createTourProgress(): TourProgress {
  return {
    version: 1,
    readingDepth: 'guided',
    chapters: {},
    lessons: {},
    stations: {},
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function ownDataValue(value: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  return descriptor && 'value' in descriptor ? descriptor.value : undefined
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.getOwnPropertyDescriptor(value, key) !== undefined
}

export function isSafeTourId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value) && !UNSAFE_KEYS.has(value)
}

export function isSafeTourAnchor(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ANCHOR.test(value) && !UNSAFE_KEYS.has(value.replace(/^#/, ''))
}

export function isSafeTourRoute(value: unknown): value is string {
  if (typeof value !== 'string'
    || value.length === 0
    || value.length > 2048
    || !value.startsWith('/')
    || value.startsWith('//')
    || value.includes('\\')
    || /[\u0000-\u001f\u007f\s]/.test(value)) return false

  try {
    const decoded = decodeURIComponent(value)
    return !decoded.startsWith('//') && !decoded.includes('\\') && !/[\u0000-\u001f\u007f]/.test(decoded)
  } catch {
    return false
  }
}

export function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
}

function parseValue(value: unknown): TourProgressParseResult {
  const fallback = createTourProgress()
  const readingDepth = isRecord(value) ? ownDataValue(value, 'readingDepth') : undefined
  if (!isRecord(value)
    || ownDataValue(value, 'version') !== 1
    || (readingDepth !== 'guided' && readingDepth !== 'technical')) {
    return { progress: fallback, valid: false }
  }

  const chaptersValue = ownDataValue(value, 'chapters')
  const lessonsValue = ownDataValue(value, 'lessons')
  if (!isRecord(chaptersValue) || !isRecord(lessonsValue)) return { progress: fallback, valid: false }

  const chapters: TourProgress['chapters'] = {}
  for (const chapterId of Object.keys(chaptersValue)) {
    if (!isSafeTourId(chapterId)) continue
    const chapterValue = ownDataValue(chaptersValue, chapterId)
    if (!isRecord(chapterValue)) return { progress: fallback, valid: false }
    const status = ownDataValue(chapterValue, 'status')
    if (status !== 'not-started' && status !== 'visited' && status !== 'complete') {
      return { progress: fallback, valid: false }
    }

    const chapter: TourProgress['chapters'][string] = { status }
    const lastLessonId = ownDataValue(chapterValue, 'lastLessonId')
    const updatedAt = ownDataValue(chapterValue, 'updatedAt')
    if (hasOwn(chapterValue, 'lastLessonId')) {
      if (typeof lastLessonId !== 'string') return { progress: fallback, valid: false }
      if (isSafeTourId(lastLessonId)) chapter.lastLessonId = lastLessonId
    }
    if (hasOwn(chapterValue, 'updatedAt')) {
      if (!isIsoTimestamp(updatedAt)) return { progress: fallback, valid: false }
      chapter.updatedAt = updatedAt
    }
    chapters[chapterId] = chapter
  }

  const lessons: TourProgress['lessons'] = {}
  for (const lessonId of Object.keys(lessonsValue)) {
    if (!isSafeTourId(lessonId)) continue
    const lessonValue = ownDataValue(lessonsValue, lessonId)
    if (!isRecord(lessonValue)
      || typeof ownDataValue(lessonValue, 'visited') !== 'boolean'
      || typeof ownDataValue(lessonValue, 'complete') !== 'boolean') {
      return { progress: fallback, valid: false }
    }

    const lesson: TourProgress['lessons'][string] = {
      visited: ownDataValue(lessonValue, 'visited') as boolean,
      complete: ownDataValue(lessonValue, 'complete') as boolean,
    }
    if (lesson.complete && !lesson.visited) return { progress: fallback, valid: false }
    const lastAnchor = ownDataValue(lessonValue, 'lastAnchor')
    if (hasOwn(lessonValue, 'lastAnchor')) {
      if (typeof lastAnchor !== 'string') return { progress: fallback, valid: false }
      if (isSafeTourAnchor(lastAnchor)) lesson.lastAnchor = lastAnchor
    }
    lessons[lessonId] = lesson
  }

  const stationsValue = ownDataValue(value, 'stations')
  if (hasOwn(value, 'stations') && !isRecord(stationsValue)) return { progress: fallback, valid: false }
  const stations: TourProgress['stations'] = {}
  if (isRecord(stationsValue)) {
    for (const stationId of Object.keys(stationsValue)) {
      if (!isSafeTourId(stationId)) continue
      const stationValue = ownDataValue(stationsValue, stationId)
      if (!isRecord(stationValue)
        || typeof ownDataValue(stationValue, 'visited') !== 'boolean'
        || typeof ownDataValue(stationValue, 'complete') !== 'boolean') {
        return { progress: fallback, valid: false }
      }

      const station: TourProgress['stations'][string] = {
        visited: ownDataValue(stationValue, 'visited') as boolean,
        complete: ownDataValue(stationValue, 'complete') as boolean,
      }
      if (station.complete && !station.visited) return { progress: fallback, valid: false }
      const updatedAt = ownDataValue(stationValue, 'updatedAt')
      if (hasOwn(stationValue, 'updatedAt')) {
        if (!isIsoTimestamp(updatedAt)) return { progress: fallback, valid: false }
        station.updatedAt = updatedAt
      }
      stations[stationId] = station
    }
  }

  const progress: TourProgress = {
    version: 1,
    readingDepth: readingDepth as ReadingDepth,
    chapters,
    lessons,
    stations,
  }
  const resumeRoute = ownDataValue(value, 'resumeRoute')
  if (hasOwn(value, 'resumeRoute')) {
    if (typeof resumeRoute !== 'string') return { progress: fallback, valid: false }
    if (isSafeTourRoute(resumeRoute)) progress.resumeRoute = resumeRoute
  }
  return { progress, valid: true }
}

export function parseTourProgressResult(value: unknown): TourProgressParseResult {
  return parseValue(value)
}

export function parseTourProgress(value: unknown): TourProgress {
  return parseValue(value).progress
}

export const normalizeTourProgress = parseTourProgress

export function parseTourProgressJsonResult(json: string): TourProgressParseResult {
  try {
    return parseValue(JSON.parse(json) as unknown)
  } catch {
    return { progress: createTourProgress(), valid: false }
  }
}

export function parseTourProgressJson(json: string): TourProgress {
  return parseTourProgressJsonResult(json).progress
}

export function exportTourProgressJson(progress: TourProgress): string {
  return JSON.stringify(parseTourProgress(progress), null, 2)
}

function canonical(progress: TourProgress): TourProgress {
  return parseTourProgress(progress)
}

function requireId(value: string, label: string): void {
  if (!isSafeTourId(value)) throw new TypeError(`${label} is unsafe`)
}

function requireTimestamp(value: string): void {
  if (!isIsoTimestamp(value)) throw new TypeError('updatedAt must be an ISO timestamp')
}

function nextChapter(
  progress: TourProgress,
  chapterId: string,
  lessonId: string,
  updatedAt: string,
): TourProgress['chapters'][string] {
  const current = progress.chapters[chapterId]
  return {
    status: current?.status === 'complete' ? 'complete' : 'visited',
    lastLessonId: lessonId,
    updatedAt,
  }
}

export function setDepth(progress: TourProgress, readingDepth: ReadingDepth): TourProgress {
  if (readingDepth !== 'guided' && readingDepth !== 'technical') throw new TypeError('Unsupported reading depth')
  return { ...canonical(progress), readingDepth }
}

export function visitLesson(
  progress: TourProgress,
  chapterId: string,
  lessonId: string,
  route: string,
  updatedAt: string,
): TourProgress {
  requireId(chapterId, 'Chapter ID')
  requireId(lessonId, 'Lesson ID')
  if (!isSafeTourRoute(route)) throw new TypeError('Resume route is unsafe')
  requireTimestamp(updatedAt)
  const current = canonical(progress)
  const lesson = current.lessons[lessonId]
  return {
    ...current,
    chapters: { ...current.chapters, [chapterId]: nextChapter(current, chapterId, lessonId, updatedAt) },
    lessons: {
      ...current.lessons,
      [lessonId]: {
        visited: true,
        complete: lesson?.complete === true,
        ...(lesson?.lastAnchor ? { lastAnchor: lesson.lastAnchor } : {}),
      },
    },
    resumeRoute: route,
  }
}

export function completeLesson(
  progress: TourProgress,
  chapterId: string,
  lessonId: string,
  updatedAt: string,
  route?: string,
): TourProgress {
  requireId(chapterId, 'Chapter ID')
  requireId(lessonId, 'Lesson ID')
  requireTimestamp(updatedAt)
  if (route !== undefined && !isSafeTourRoute(route)) throw new TypeError('Resume route is unsafe')
  const current = canonical(progress)
  const lesson = current.lessons[lessonId]
  return {
    ...current,
    chapters: { ...current.chapters, [chapterId]: nextChapter(current, chapterId, lessonId, updatedAt) },
    lessons: {
      ...current.lessons,
      [lessonId]: {
        visited: true,
        complete: true,
        ...(lesson?.lastAnchor ? { lastAnchor: lesson.lastAnchor } : {}),
      },
    },
    ...(route === undefined ? {} : { resumeRoute: route }),
  }
}

export function visitStation(
  progress: TourProgress,
  stationId: string,
  route: string,
  updatedAt: string,
): TourProgress {
  requireId(stationId, 'Station ID')
  if (!isSafeTourRoute(route)) throw new TypeError('Resume route is unsafe')
  requireTimestamp(updatedAt)
  const current = canonical(progress)
  const station = current.stations[stationId]
  return {
    ...current,
    stations: {
      ...current.stations,
      [stationId]: {
        visited: true,
        complete: station?.complete === true,
        updatedAt,
      },
    },
    resumeRoute: route,
  }
}

export function completeStation(
  progress: TourProgress,
  stationId: string,
  updatedAt: string,
  route?: string,
): TourProgress {
  requireId(stationId, 'Station ID')
  requireTimestamp(updatedAt)
  if (route !== undefined && !isSafeTourRoute(route)) throw new TypeError('Resume route is unsafe')
  const current = canonical(progress)
  return {
    ...current,
    stations: {
      ...current.stations,
      [stationId]: {
        visited: true,
        complete: true,
        updatedAt,
      },
    },
    ...(route === undefined ? {} : { resumeRoute: route }),
  }
}

export function setLastAnchor(progress: TourProgress, lessonId: string, anchor: string): TourProgress {
  requireId(lessonId, 'Lesson ID')
  if (!isSafeTourAnchor(anchor)) throw new TypeError('Lesson anchor is unsafe')
  const current = canonical(progress)
  const lesson = current.lessons[lessonId]
  const normalizedAnchor = anchor.startsWith('#') ? anchor : `#${anchor}`
  const resumeRoute = current.resumeRoute?.replace(/#.*$/, '')
  return {
    ...current,
    lessons: {
      ...current.lessons,
      [lessonId]: {
        visited: lesson?.visited === true,
        complete: lesson?.complete === true,
        lastAnchor: normalizedAnchor,
      },
    },
    ...(resumeRoute ? { resumeRoute: `${resumeRoute}${normalizedAnchor}` } : {}),
  }
}

export function markChapterComplete(
  progress: TourProgress,
  chapterId: string,
  updatedAt: string,
  requiredLessonIds?: readonly string[],
): TourProgress {
  requireId(chapterId, 'Chapter ID')
  requireTimestamp(updatedAt)
  requiredLessonIds?.forEach((lessonId) => requireId(lessonId, 'Required lesson ID'))
  const current = canonical(progress)
  if (requiredLessonIds && !requiredLessonIds.every((lessonId) => current.lessons[lessonId]?.complete === true)) return current
  const chapter = current.chapters[chapterId]
  return {
    ...current,
    chapters: {
      ...current.chapters,
      [chapterId]: {
        status: 'complete',
        ...(chapter?.lastLessonId ? { lastLessonId: chapter.lastLessonId } : {}),
        updatedAt,
      },
    },
  }
}
