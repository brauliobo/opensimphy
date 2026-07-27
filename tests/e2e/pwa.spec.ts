import { expect, test } from '@playwright/test'

const QUICK_LESSON = '/tour/units/physical-quantities?path=quick'
const GUIDED_CACHE_PREFIX = 'opensimphy-guided-tour-'

test('explicit Guided pack supports offline lesson use and clear removes that capability', async ({ context, page }) => {
  await page.goto('/')
  await expect(page.getByTestId('tour-ready')).toBeVisible()
  await page.evaluate(async (prefix) => {
    await Promise.all((await caches.keys()).filter((name) => name.startsWith(prefix)).map((name) => caches.delete(name)))
    await navigator.serviceWorker.ready
  }, GUIDED_CACHE_PREFIX)
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload()
    await expect(page.getByTestId('tour-ready')).toBeVisible()
  }
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await expect(page.getByTestId('guided-pack-status')).toContainText('Not downloaded')

  await page.getByTestId('guided-pack-download').click()
  await expect(page.getByTestId('guided-pack-status')).toContainText('Ready offline')
  await expect(page.getByTestId('guided-pack-status')).toContainText('8 files')
  const metadata = await page.evaluate(async (prefix) => {
    const cacheName = (await caches.keys()).find((name) => name.startsWith(prefix))
    if (!cacheName) return null
    const cache = await caches.open(cacheName)
    const metadataRequest = (await cache.keys()).find(({ url }) => url.endsWith('/offline-pack-metadata.json'))
    return metadataRequest ? await (await cache.match(metadataRequest))?.json() : null
  }, GUIDED_CACHE_PREFIX)
  expect(metadata).toMatchObject({ revision: '2026-07-26', urls: expect.any(Array), bytes: expect.any(Number) })
  expect(metadata.urls).toHaveLength(8)
  expect(metadata.bytes).toBeGreaterThan(0)

  await page.goto(QUICK_LESSON)
  await expect(page.getByTestId('tour-lesson-ready')).toBeVisible()
  const cacheCleanup = await page.evaluate(async (guidedPrefix) => {
    const names = await caches.keys()
    const taxonomyCaches = names.filter((name) => name.startsWith('opensimphy-taxonomy-'))
    await Promise.all(taxonomyCaches.map((name) => caches.delete(name)))
    const remaining = await caches.keys()
    return {
      removedTaxonomyCaches: taxonomyCaches.length,
      guidedCaches: remaining.filter((name) => name.startsWith(guidedPrefix)).length,
      appShellCaches: remaining.filter((name) => name.includes('workbox-precache')).length,
    }
  }, GUIDED_CACHE_PREFIX)
  expect(cacheCleanup.removedTaxonomyCaches).toBeGreaterThan(0)
  expect(cacheCleanup.guidedCaches).toBe(1)
  expect(cacheCleanup.appShellCaches).toBeGreaterThan(0)
  await context.setOffline(true)
  await page.goto('/tour')
  await expect(page.getByTestId('tour-map-ready')).toBeVisible()
  await page.goto(QUICK_LESSON)
  await expect(page.getByTestId('tour-lesson-ready')).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('tour-lesson-ready')).toBeVisible()
  await page.getByTestId('preset-average-speed-from-path').click()
  await page.getByTestId('prediction-matches-target').check()
  await page.getByTestId('reveal-dimension-result').click()
  await expect(page.getByTestId('dimension-result')).toBeVisible()
  await expect(page.getByTestId('operation-status')).toHaveText('Defined')

  await page.goto('/saved')
  await expect(page.getByTestId('guided-pack-status')).toContainText('Ready offline')
  await page.getByTestId('guided-pack-clear').click()
  await expect(page.getByTestId('guided-pack-status')).toContainText('Not downloaded')
  expect(await page.evaluate(async (prefix) => (await caches.keys()).filter((name) => name.startsWith(prefix)), GUIDED_CACHE_PREFIX)).toEqual([])

  const freshPage = await context.newPage()
  const failedTourRequests: string[] = []
  freshPage.on('requestfailed', (request) => {
    if (request.url().includes('/data/generated/tour/')) failedTourRequests.push(request.url())
  })
  await freshPage.goto(QUICK_LESSON)
  await expect(freshPage.getByTestId('app-ready')).toBeVisible()
  await expect(freshPage.getByTestId('tour-lesson-ready')).toHaveCount(0)
  await expect(freshPage.getByRole('heading', { name: 'Lesson unavailable' })).toBeVisible()
  await expect(freshPage.getByRole('alert')).toContainText('Failed to fetch')
  await expect.poll(() => failedTourRequests.some((url) => url.endsWith('/data/generated/tour/manifest.json'))).toBe(true)
})
