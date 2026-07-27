import {
  createTourProgressStorageKey,
  resetTourProgressForTests,
  setTourProgressDependenciesForTests,
  useTourProgress,
} from '../../src/registries/tourProgress'
import {
  createTourProgress,
  parseTourProgress,
  parseTourProgressJson,
} from '../../src/tour/progress'

const FIRST_TIME = '2026-07-26T10:00:00.000Z'
const SECOND_TIME = '2026-07-26T11:00:00.000Z'

class MemoryStorage {
  readonly values = new Map<string, string>()
  readonly removed: string[] = []
  failWrites = false
  failRemoves = false

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('blocked write')
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    if (this.failRemoves) throw new Error('blocked remove')
    this.removed.push(key)
    this.values.delete(key)
  }
}

describe('tour progress', () => {
  afterEach(() => {
    resetTourProgressForTests()
    window.localStorage.clear()
  })

  it('starts with guided v1 progress and hydrates stored progress', () => {
    const storage = new MemoryStorage()
    const key = createTourProgressStorageKey('/museum/')
    storage.values.set(key, JSON.stringify({
      version: 1,
      readingDepth: 'technical',
      chapters: { 'retired-chapter': { status: 'visited', lastLessonId: 'retired-lesson', updatedAt: FIRST_TIME } },
      lessons: { 'retired-lesson': { visited: true, complete: false } },
      resumeRoute: '/tour/retired-lesson',
    }))
    setTourProgressDependenciesForTests({ storage, baseUrl: '/museum/' })
    const progress = useTourProgress()

    expect(progress.state.value).toEqual(createTourProgress())
    progress.hydrate()

    expect(progress.hydrated.value).toBe(true)
    expect(progress.depth.value).toBe('technical')
    expect(progress.state.value.chapters['retired-chapter']?.status).toBe('visited')
    expect(progress.state.value.stations).toEqual({})
    expect(progress.resume.value).toBe('/tour/retired-lesson')
  })

  it('hydrates only once so repeated consumers cannot overwrite live session state', () => {
    const storage = new MemoryStorage()
    const key = createTourProgressStorageKey('/')
    storage.values.set(key, JSON.stringify({
      version: 1,
      readingDepth: 'guided',
      chapters: {},
      lessons: {},
      stations: {},
    }))
    setTourProgressDependenciesForTests({ storage, now: () => FIRST_TIME })
    const progress = useTourProgress()
    progress.hydrate()
    progress.visitStation('anchors-scales', '/tour/units/physical-quantities?path=quick')
    storage.values.set(key, JSON.stringify({
      version: 1,
      readingDepth: 'technical',
      chapters: {},
      lessons: {},
      stations: {},
    }))

    progress.hydrate()

    expect(progress.depth.value).toBe('guided')
    expect(progress.state.value.stations['anchors-scales']?.visited).toBe(true)
  })

  it('records visits without completing lessons, then completes explicitly', () => {
    const storage = new MemoryStorage()
    setTourProgressDependenciesForTests({ storage, now: () => FIRST_TIME })
    const progress = useTourProgress()

    progress.visitLesson('units', 'dimensions', '/tour/units/dimensions')
    expect(progress.state.value.lessons.dimensions).toEqual({ visited: true, complete: false })
    expect(progress.state.value.chapters.units).toEqual({
      status: 'visited',
      lastLessonId: 'dimensions',
      updatedAt: FIRST_TIME,
    })

    progress.completeLesson('units', 'dimensions')
    expect(progress.state.value.lessons.dimensions).toEqual({ visited: true, complete: true })
    expect(progress.state.value.chapters.units?.status).toBe('visited')
  })

  it('records and completes quick stations without completing lessons or chapters', () => {
    const storage = new MemoryStorage()
    setTourProgressDependenciesForTests({ storage, now: () => FIRST_TIME })
    const progress = useTourProgress()

    expect(progress.visitStation('anchors-scales', '/tour/units/physical-quantities?path=quick')).toBe(true)
    expect(progress.state.value.stations['anchors-scales']).toEqual({
      visited: true,
      complete: false,
      updatedAt: FIRST_TIME,
    })
    expect(progress.completeStation('anchors-scales')).toBe(true)
    expect(progress.state.value.stations['anchors-scales']?.complete).toBe(true)
    expect(progress.state.value.lessons).toEqual({})
    expect(progress.state.value.chapters).toEqual({})
    expect(() => progress.visitStation('__proto__', '/tour/units/physical-quantities?path=quick')).toThrow('Station ID is unsafe')
    expect(() => progress.completeStation('constructor')).toThrow('Station ID is unsafe')
  })

  it('persists depth changes without losing progress or the resume route', () => {
    const storage = new MemoryStorage()
    setTourProgressDependenciesForTests({ storage, now: () => FIRST_TIME, baseUrl: '/app/' })
    const progress = useTourProgress()
    progress.visitLesson('units', 'dimensions', '/tour/units/dimensions#basis')

    progress.setDepth('technical')

    expect(progress.depth.value).toBe('technical')
    expect(progress.resume.value).toBe('/tour/units/dimensions#basis')
    expect(progress.state.value.lessons.dimensions?.visited).toBe(true)
    expect(JSON.parse(storage.getItem(createTourProgressStorageKey('/app/'))!)).toEqual(progress.state.value)
  })

  it('updates the resume hash while preserving its query when an anchor changes', () => {
    const storage = new MemoryStorage()
    setTourProgressDependenciesForTests({ storage, now: () => FIRST_TIME })
    const progress = useTourProgress()
    progress.visitLesson('units', 'dimensions', '/tour/units/dimensions?path=quick#question')
    progress.setLastAnchor('dimensions', '#basis-vectors')

    expect(progress.resume.value).toBe('/tour/units/dimensions?path=quick#basis-vectors')
    expect(progress.state.value.lessons.dimensions?.lastAnchor).toBe('#basis-vectors')
  })

  it('completes chapters only explicitly or after all supplied lessons are complete', () => {
    const storage = new MemoryStorage()
    let now = FIRST_TIME
    setTourProgressDependenciesForTests({ storage, now: () => now })
    const progress = useTourProgress()
    progress.completeLesson('units', 'dimensions')

    expect(progress.markChapterComplete('units', ['dimensions', 'quantity-kinds'])).toBe(false)
    expect(progress.state.value.chapters.units?.status).toBe('visited')

    progress.completeLesson('units', 'quantity-kinds')
    now = SECOND_TIME
    expect(progress.markChapterComplete('units', ['dimensions', 'quantity-kinds'])).toBe(true)
    expect(progress.state.value.chapters.units?.updatedAt).toBe(SECOND_TIME)

    expect(progress.markChapterComplete('measurement')).toBe(true)
    expect(progress.state.value.chapters.measurement?.status).toBe('complete')
  })

  it('fails closed for unknown versions and malformed records', () => {
    expect(parseTourProgress({
      version: 2,
      readingDepth: 'technical',
      chapters: {},
      lessons: {},
    })).toEqual(createTourProgress())

    expect(parseTourProgress({
      version: 1,
      readingDepth: 'technical',
      chapters: { units: { status: 'visited' } },
      lessons: { dimensions: { visited: 'yes', complete: false } },
    })).toEqual(createTourProgress())
    expect(parseTourProgress({
      version: 1,
      readingDepth: 'technical',
      chapters: { units: { status: 'visited', updatedAt: 'yesterday' } },
      lessons: {},
    })).toEqual(createTourProgress())
    expect(parseTourProgress({
      version: 1,
      readingDepth: 'technical',
      chapters: {},
      lessons: {},
      stations: { 'anchors-scales': { visited: false, complete: true } },
    })).toEqual(createTourProgress())
    expect(parseTourProgressJson('{not json')).toEqual(createTourProgress())
  })

  it('prunes unsafe keys, routes, anchors, and inherited fields', () => {
    const parsed = parseTourProgressJson(`{
      "version": 1,
      "readingDepth": "technical",
      "chapters": {
        "safe-chapter": { "status": "visited", "lastLessonId": "constructor" },
        "__proto__": { "status": "complete" }
      },
      "lessons": {
        "safe-lesson": { "visited": true, "complete": false, "lastAnchor": "#bad anchor" },
        "constructor": { "visited": true, "complete": true }
      },
      "stations": {
        "safe-station": { "visited": true, "complete": false },
        "__proto__": { "visited": true, "complete": true },
        "prototype": { "visited": true, "complete": true }
      },
      "resumeRoute": "https://attacker.example/tour"
    }`)

    expect(parsed).toEqual({
      version: 1,
      readingDepth: 'technical',
      chapters: { 'safe-chapter': { status: 'visited' } },
      lessons: { 'safe-lesson': { visited: true, complete: false } },
      stations: { 'safe-station': { visited: true, complete: false } },
    })
    expect(Object.prototype).not.toHaveProperty('status')

    const inherited = Object.create({ version: 1, readingDepth: 'technical' }) as Record<string, unknown>
    inherited.chapters = {}
    inherited.lessons = {}
    expect(parseTourProgress(inherited)).toEqual(createTourProgress())
  })

  it('exports canonical JSON and imports only fully valid structures', () => {
    const storage = new MemoryStorage()
    setTourProgressDependenciesForTests({ storage, now: () => FIRST_TIME })
    const progress = useTourProgress()
    progress.visitLesson('units', 'dimensions', '/tour/units/dimensions')
    progress.visitStation('anchors-scales', '/tour/units/dimensions?path=quick')
    const exported = progress.exportProgress()

    progress.clear()
    expect(progress.importProgress(exported)).toBe(true)
    expect(progress.state.value.lessons.dimensions?.visited).toBe(true)
    expect(progress.state.value.stations['anchors-scales']?.visited).toBe(true)

    const before = progress.exportProgress()
    expect(progress.importProgress('{"version":1,"readingDepth":"guided","chapters":{},"lessons":{"bad":{}},"stations":{}}')).toBe(false)
    expect(progress.exportProgress()).toBe(before)
  })

  it('clear removes only the namespaced Tour key', () => {
    const storage = new MemoryStorage()
    const key = createTourProgressStorageKey('/app/')
    storage.values.set('unrelated', 'keep')
    setTourProgressDependenciesForTests({ storage, now: () => FIRST_TIME, baseUrl: '/app/' })
    const progress = useTourProgress()
    progress.visitLesson('units', 'dimensions', '/tour/units/dimensions')

    expect(progress.clear()).toBe(true)

    expect(storage.removed).toEqual([key])
    expect(storage.getItem(key)).toBeNull()
    expect(storage.getItem('unrelated')).toBe('keep')
    expect(progress.state.value).toEqual(createTourProgress())
  })

  it('surfaces storage exceptions while retaining functional in-memory state', () => {
    const unavailable = {
      getItem: () => { throw new Error('blocked read') },
      setItem: () => { throw new Error('blocked write') },
      removeItem: () => { throw new Error('blocked remove') },
    }
    setTourProgressDependenciesForTests({ storage: unavailable, now: () => FIRST_TIME })
    const progress = useTourProgress()

    progress.hydrate()
    expect(progress.persistenceError.value?.message).toBe('Tour progress could not hydrate')
    progress.visitLesson('units', 'dimensions', '/tour/units/dimensions')

    expect(progress.state.value.lessons.dimensions).toEqual({ visited: true, complete: false })
    expect(progress.persistenceError.value?.message).toBe('Tour progress could not persist')
    expect(progress.clear()).toBe(false)
    expect(progress.state.value).toEqual(createTourProgress())
    expect(progress.persistenceError.value?.message).toBe('Tour progress could not clear')
  })

  it('keeps validation success separate from failed persistence and exposes reload semantics', () => {
    const storage = new MemoryStorage()
    const key = createTourProgressStorageKey('/')
    const stored = JSON.stringify({
      version: 1,
      readingDepth: 'guided',
      chapters: {},
      lessons: { stored: { visited: true, complete: false } },
      stations: {},
    })
    storage.values.set(key, stored)
    setTourProgressDependenciesForTests({ storage, now: () => FIRST_TIME })
    const progress = useTourProgress()
    progress.hydrate()
    storage.failWrites = true

    expect(progress.importProgress('{"version":1,"readingDepth":"technical","chapters":{},"lessons":{},"stations":{}}')).toBe(true)
    expect(progress.depth.value).toBe('technical')
    expect(progress.persistenceError.value?.message).toBe('Tour progress could not persist')

    resetTourProgressForTests()
    storage.failWrites = false
    setTourProgressDependenciesForTests({ storage, now: () => FIRST_TIME })
    const reloaded = useTourProgress()
    reloaded.hydrate()
    expect(reloaded.depth.value).toBe('guided')
    expect(reloaded.state.value.lessons.stored?.visited).toBe(true)

    storage.failRemoves = true
    expect(reloaded.clear()).toBe(false)
    expect(reloaded.state.value).toEqual(createTourProgress())
    resetTourProgressForTests()
    storage.failRemoves = false
    setTourProgressDependenciesForTests({ storage })
    const afterFailedClear = useTourProgress()
    afterFailedClear.hydrate()
    expect(afterFailedClear.state.value.lessons.stored?.visited).toBe(true)
  })

  it('uses a versioned BASE_URL namespace', () => {
    const rootKey = createTourProgressStorageKey('/')
    const nestedKey = createTourProgressStorageKey('/physics/')

    expect(rootKey).toContain('v1')
    expect(rootKey).not.toBe(nestedKey)

    const storage = new MemoryStorage()
    setTourProgressDependenciesForTests({ storage, baseUrl: '/physics/' })
    const progress = useTourProgress()
    expect(progress.storageKey.value).toBe(nestedKey)
    progress.setDepth('technical')
    expect(storage.values.has(nestedKey)).toBe(true)
  })

  it('uses injected ISO timestamps deterministically', () => {
    const storage = new MemoryStorage()
    setTourProgressDependenciesForTests({ storage, now: () => FIRST_TIME })
    const progress = useTourProgress()
    progress.visitLesson('units', 'dimensions', '/tour/units/dimensions')
    expect(progress.state.value.chapters.units?.updatedAt).toBe(FIRST_TIME)

    setTourProgressDependenciesForTests({ storage, now: () => 'not-a-date' })
    expect(() => progress.completeLesson('units', 'dimensions')).toThrow('updatedAt must be an ISO timestamp')
  })

  it('resets singleton state and injected dependencies between tests', () => {
    setTourProgressDependenciesForTests({ storage: null, now: () => FIRST_TIME, baseUrl: '/first/' })
    const first = useTourProgress()
    first.visitLesson('units', 'dimensions', '/tour/units/dimensions')
    expect(first.persistenceError.value).not.toBeNull()

    resetTourProgressForTests()
    const second = useTourProgress()
    expect(second.state.value).toEqual(createTourProgress())
    expect(second.persistenceError.value).toBeNull()
    expect(second.storageKey.value).toBe(createTourProgressStorageKey(import.meta.env.BASE_URL))
  })
})
