import { expect, test } from '@playwright/test'

const QUICK_LESSON = '/tour/units/physical-quantities?path=quick'
const GUIDED_CACHE_PREFIX = 'opensimphy-guided-tour-'
const QUICK_INSTRUMENTS = [
  { path: QUICK_LESSON, instrument: 'dimension-builder', prediction: 'prediction-matches-target', reveal: 'reveal-dimension-result', result: 'dimension-result' },
  { path: '/tour/unit-bridges/photon-equivalent-scales?path=quick', instrument: 'photon-bridge', prediction: 'photon-prediction-wavelength-falls', reveal: 'reveal-photon-bridge', result: 'photon-bridge-result' },
  { path: '/tour/electrical-standards/quantum-electrical-standards?path=quick', instrument: 'electrical-standards-network', prediction: 'electrical-prediction-mixed-status', reveal: 'reveal-electrical-standards', result: 'electrical-standards-result' },
  { path: '/tour/atomic-structure/hydrogen-spectra?path=quick', instrument: 'atomic-spectrum-explorer', prediction: 'atomic-prediction-longer', reveal: 'reveal-atomic-result', result: 'atomic-result' },
  { path: '/tour/particle-scales/particle-mass-scales?path=quick', instrument: 'particle-scale-comparator', prediction: 'particle-prediction-state-derived', reveal: 'reveal-particle-result', result: 'particle-result' },
  { path: '/tour/spin-magnetism/spin-precession?path=quick', instrument: 'spin-precession-visualizer', prediction: 'spin-prediction-clockwise', reveal: 'reveal-spin-result', result: 'spin-result' },
  { path: '/tour/heat-matter/blackbody-radiation?path=quick', instrument: 'blackbody-spectrum', prediction: 'blackbody-prediction-shorter-t4', reveal: 'reveal-blackbody-result', result: 'blackbody-result' },
  { path: '/tour/heat-matter/particle-to-mole?path=quick', instrument: 'molar-matter-scaler', prediction: 'molar-prediction-all-linear', reveal: 'reveal-molar-result', result: 'molar-result' },
] as const

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  return `${(value / 1024).toFixed(value < 1024 * 10 ? 1 : 0)} KB`
}

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
  await expect(page.getByTestId('guided-pack-status')).toContainText('31 files')
  const metadata = await page.evaluate(async (prefix) => {
    const cacheName = (await caches.keys()).find((name) => name.startsWith(prefix))
    if (!cacheName) return null
    const cache = await caches.open(cacheName)
    const metadataRequest = (await cache.keys()).find(({ url }) => url.endsWith('/offline-pack-metadata.json'))
    return metadataRequest ? await (await cache.match(metadataRequest))?.json() : null
  }, GUIDED_CACHE_PREFIX)
  expect(metadata).toMatchObject({ revision: '2026-07-27', urls: expect.any(Array), bytes: expect.any(Number) })
  expect(metadata!.urls).toHaveLength(31)
  expect(metadata!.bytes).toBeGreaterThan(0)
  await expect(page.getByTestId('guided-pack-status')).toHaveText(`Ready offline / revision 2026-07-27 / 31 files / ${formatBytes(metadata!.bytes)}`)

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

  for (const instrument of QUICK_INSTRUMENTS) {
    await page.goto(instrument.path)
    await expect(page.getByTestId('tour-lesson-ready')).toBeVisible()
    await expect(page.getByTestId(instrument.instrument)).toBeVisible()
    await page.getByTestId(instrument.prediction).check()
    await page.getByTestId(instrument.reveal).click()
    await expect(page.getByTestId(instrument.result)).toBeVisible()
  }

  await page.reload()
  await expect(page.getByTestId('molar-matter-scaler')).toBeVisible()

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
