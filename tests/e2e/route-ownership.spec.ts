import { expect, test, type Page, type Worker } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

const rootOwnerArtifacts = [
  '/data/generated/recipes.json',
  '/data/generated/symbols.json',
  '/data/generated/taxonomy.json',
  '/data/generated/walls.json',
  '/data/generated/completion.json',
] as const

type WorkerOwner = 'formula' | 'core' | 'wall' | 'earth'

interface RouteActivity {
  requests: string[]
  workers: string[]
}

interface ActivityCheckpoint {
  requests: number
  workers: number
}

function normalizePath(url: string): string {
  const pathname = new URL(url).pathname.replace(/\/{2,}/g, '/')
  const dataRoot = pathname.indexOf('/data/')
  return dataRoot === -1 ? pathname : pathname.slice(dataRoot)
}

function observeRoute(page: Page): RouteActivity {
  const activity: RouteActivity = { requests: [], workers: [] }
  page.on('request', (request) => activity.requests.push(normalizePath(request.url())))
  page.on('worker', (worker: Worker) => activity.workers.push(normalizePath(worker.url())))
  return activity
}

function unique(paths: string[]): string[] {
  return [...new Set(paths)].sort()
}

function isOwnerArtifact(path: string): boolean {
  return rootOwnerArtifacts.includes(path as typeof rootOwnerArtifacts[number])
    || path.startsWith('/data/generated/tour/')
    || path.startsWith('/data/number-walls/')
}

function requestedOwnerArtifacts(activity: RouteActivity): string[] {
  return unique(activity.requests.filter(isOwnerArtifact))
}

function workerOwners(activity: RouteActivity): WorkerOwner[] {
  return activity.workers.flatMap((path) => {
    const normalized = path.toLocaleLowerCase()
    if (normalized.includes('formula.worker')) return ['formula']
    if (normalized.includes('core.worker')) return ['core']
    if (normalized.includes('numberwall.worker')) return ['wall']
    if (normalized.includes('earthsimulation.worker')) return ['earth']
    return []
  })
}

async function gotoColdRoute(page: Page, path: string): Promise<RouteActivity> {
  const activity = observeRoute(page)
  await page.goto(path)
  await expect(page.getByTestId('app-ready')).toBeVisible()
  return activity
}

function checkpoint(activity: RouteActivity): ActivityCheckpoint {
  return { requests: activity.requests.length, workers: activity.workers.length }
}

function activitySince(activity: RouteActivity, start: ActivityCheckpoint): RouteActivity {
  return {
    requests: activity.requests.slice(start.requests),
    workers: activity.workers.slice(start.workers),
  }
}

function expectOwnerArtifacts(activity: RouteActivity, expected: readonly string[]): void {
  expect(requestedOwnerArtifacts(activity)).toEqual([...expected].sort())
}

test('the tour owns only its manifest and taxonomy', async ({ page }) => {
  const activity = await gotoColdRoute(page, '/')
  await expect(page.getByTestId('tour-ready')).toBeVisible()

  expectOwnerArtifacts(activity, [
    '/data/generated/tour/manifest.json',
    '/data/generated/taxonomy.json',
  ])
  expect(workerOwners(activity).filter((owner) => owner === 'formula' || owner === 'core' || owner === 'wall')).toEqual([])
})

const tourRoutes = [
  {
    path: '/tour',
    expected: ['/data/generated/tour/manifest.json', '/data/generated/taxonomy.json'],
    ready: async (page: Page) => expect(page.getByTestId('tour-map-ready')).toBeVisible(),
  },
  {
    path: '/tour/units',
    expected: [
      '/data/generated/tour/manifest.json',
      '/data/generated/taxonomy.json',
      '/data/generated/tour/chapters/units.json',
    ],
    ready: async (page: Page) => expect(page.getByRole('heading', { name: 'Units, Dimensions, and Physical Quantities' })).toBeVisible(),
  },
  {
    path: '/tour/units/physical-quantities?path=quick',
    expected: [
      '/data/generated/tour/manifest.json',
      '/data/generated/taxonomy.json',
      '/data/generated/tour/chapters/units.json',
      '/data/generated/tour/lessons/physical-quantities.json',
      '/data/generated/tour/simulations/dimensional-equation-builder.json',
      '/data/generated/tour/glossary.json',
      '/data/generated/tour/references.json',
    ],
    ready: async (page: Page) => expect(page.getByTestId('tour-lesson-ready')).toBeVisible(),
  },
  {
    path: '/saved',
    expected: ['/data/generated/tour/manifest.json', '/data/generated/taxonomy.json'],
    ready: async (page: Page) => expect(page.getByRole('heading', { name: 'Saved Tour Progress' })).toBeVisible(),
  },
  {
    path: '/evidence',
    expected: [],
    ready: async (page: Page) => expect(page.getByRole('heading', { name: 'Evidence Guide' })).toBeVisible(),
  },
  {
    path: '/unknown/ownership-route',
    expected: [],
    ready: async (page: Page) => expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible(),
  },
] as const

for (const route of tourRoutes) {
  test(`${route.path} loads only its Tour-owned artifacts and no workers`, async ({ page }) => {
    const activity = await gotoColdRoute(page, route.path)
    await route.ready(page)

    expectOwnerArtifacts(activity, route.expected)
    expect(workerOwners(activity)).toEqual([])
  })
}

const earthDocumentSlug = 'for-your-understanding--ab8c1d3e7b71'
const earthRoutes = [
  {
    path: '/earth',
    ready: async (page: Page) => expect(page.getByTestId('earth-evidence-ledger')).toBeVisible(),
  },
  {
    path: '/earth/corpus',
    ready: async (page: Page) => expect(page.getByTestId('earth-document-grid').locator('.earth-document-card')).toHaveCount(63),
  },
  {
    path: '/earth/programs',
    ready: async (page: Page) => expect(page.getByTestId('program-registry-statement')).toContainText('130 canonical programs'),
  },
  {
    path: '/earth/programs/EARTH-PRT-001',
    ready: async (page: Page) => expect(page.getByTestId('program-evidence-summary')).toContainText('Formula records'),
  },
  {
    path: '/earth/datasets',
    ready: async (page: Page) => expect(page.getByTestId('dataset-summary')).toContainText('19 metadata-authenticated records'),
  },
  {
    path: `/earth/corpus/${earthDocumentSlug}`,
    ready: async (page: Page) => expect(page.getByTestId('earth-document-reading')).toBeVisible(),
  },
  {
    path: `/earth/${earthDocumentSlug}`,
    ready: async (page: Page) => expect(page.getByTestId('earth-document-reading')).toBeVisible(),
  },
] as const

for (const route of earthRoutes) {
  test(`${route.path} stays within the EARTH data domain`, async ({ page }) => {
    const activity = await gotoColdRoute(page, route.path)
    await route.ready(page)

    expectOwnerArtifacts(activity, [])
    expect(workerOwners(activity).filter((owner) => owner === 'formula' || owner === 'core' || owner === 'wall')).toEqual([])
    if (route.path === '/earth/programs/EARTH-PRT-001') expect(workerOwners(activity)).not.toContain('earth')
    if (route.path.endsWith(earthDocumentSlug)) {
      await expect(page.getByRole('heading', { name: 'For Your Understanding' })).toBeVisible()
      expect(workerOwners(activity)).toEqual([])
    }
  })
}

for (const route of [
  { path: '/atlas', readyTestId: 'formula-registry-ready' },
  { path: '/atlas/1', readyTestId: 'formula-record-ready' },
] as const) {
  test(`${route.path} owns the formula registry and one formula worker`, async ({ page }) => {
    const activity = await gotoColdRoute(page, route.path)
    await expect(page.getByTestId(route.readyTestId)).toBeVisible()

    expectOwnerArtifacts(activity, [
      '/data/generated/recipes.json',
      '/data/generated/symbols.json',
      '/data/generated/taxonomy.json',
    ])
    expect(workerOwners(activity)).toEqual(['formula'])
  })
}

test('/labs/core owns one core worker and no root JSON', async ({ page }) => {
  const activity = await gotoColdRoute(page, '/labs/core')
  await expect(page.getByTestId('core-registry-ready')).toBeVisible()

  expectOwnerArtifacts(activity, [])
  expect(workerOwners(activity)).toEqual(['core'])
})

test('/labs/walls defers its selected payload and wall worker until Run', async ({ page }) => {
  const activity = await gotoColdRoute(page, '/labs/walls')
  await expect(page.getByTestId('wall-registry-ready')).toBeVisible()

  expectOwnerArtifacts(activity, ['/data/generated/walls.json'])
  expect(unique(activity.requests.filter((path) => path.startsWith('/data/number-walls/')))).toEqual([])
  expect(workerOwners(activity)).toEqual([])

  await page.getByTestId('wall-run').click()
  await expect(page.getByTestId('wall-simulation-ready')).toBeVisible()

  expect(unique(activity.requests.filter((path) => path.startsWith('/data/number-walls/')))).toHaveLength(1)
  expect(workerOwners(activity)).toEqual(['wall'])
})

test('/labs owns only the completion report', async ({ page }) => {
  const activity = await gotoColdRoute(page, '/labs')
  await expect(page.getByTestId('completion-registry-ready')).toBeVisible()

  expectOwnerArtifacts(activity, ['/data/generated/completion.json'])
  expect(workerOwners(activity)).toEqual([])
})

test('warm Atlas to Tour to EARTH navigation keeps owner activity route-bound and audit history session-wide', async ({ page }) => {
  const activity = await gotoColdRoute(page, '/atlas')
  await expect(page.getByTestId('formula-registry-ready')).toBeVisible()
  expectOwnerArtifacts(activity, [
    '/data/generated/recipes.json',
    '/data/generated/symbols.json',
    '/data/generated/taxonomy.json',
  ])
  expect(workerOwners(activity)).toEqual(['formula'])

  const afterAtlas = checkpoint(activity)
  await page.locator('#primary-navigation').getByRole('link', { name: /Tour/ }).click()
  await expect(page).toHaveURL(/\/tour$/)
  await expect(page.getByTestId('tour-map-ready')).toBeVisible()
  const tourActivity = activitySince(activity, afterAtlas)
  expectOwnerArtifacts(tourActivity, ['/data/generated/tour/manifest.json'])
  expect(workerOwners(tourActivity)).toEqual([])

  const tourAudit = await page.evaluate(() => window.__OPENSIMPHY_AUDIT__)
  expect(tourAudit?.schemaVersion).toBe(2)
  expect(tourAudit?.formulas).toEqual(expect.objectContaining({ status: 'ready', evaluated: 288 }))
  expect(tourAudit?.tour).toEqual(expect.objectContaining({ status: 'ready' }))

  const afterTour = checkpoint(activity)
  await page.locator('#primary-navigation').getByRole('link', { name: /Evidence/ }).click()
  await expect(page).toHaveURL(/\/evidence$/)
  await page.getByRole('link', { name: 'Open the EARTH evidence dossier' }).click()
  await expect(page).toHaveURL(/\/earth$/)
  await expect(page.getByTestId('earth-evidence-ledger')).toBeVisible()
  const earthActivity = activitySince(activity, afterTour)
  expectOwnerArtifacts(earthActivity, [])
  expect(workerOwners(earthActivity)).toEqual([])

  const earthAudit = await page.evaluate(() => window.__OPENSIMPHY_AUDIT__)
  expect(earthAudit?.formulas).toEqual(expect.objectContaining({ status: 'ready', evaluated: 288 }))
  expect(earthAudit?.tour).toEqual(expect.objectContaining({ status: 'ready' }))
  expect(earthAudit?.app).toEqual(expect.objectContaining({ status: 'ready', route: '/earth' }))
})
