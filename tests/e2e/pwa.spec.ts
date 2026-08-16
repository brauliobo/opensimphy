import { expect, test } from '@playwright/test'
import { grayFemLookupRevision } from '../../src/edwin-gray/edwinGrayFem'
import { GRAY_MACHINE_CONTRACTS, GRAY_PATENT_MACHINE_ID } from '../../src/edwin-gray/edwinGrayMachines'
import { runtimeRegistryRevision } from './runtime-registry-revision'

const QUICK_LESSON = '/tour/units/physical-quantities?path=quick'
const GUIDED_CACHE_PREFIX = 'opensimphy-guided-tour-'
const GRAY_WORKER_CACHE = 'opensimphy-gray-worker'
const GRAY_LUT_CACHE = 'opensimphy-gray-fem-lut'
const GRAY_CALIBRATION_CACHE = `opensimphy-gray-fem-calibration-${runtimeRegistryRevision}`
const GRAY_PATENT_CONTRACT = GRAY_MACHINE_CONTRACTS[GRAY_PATENT_MACHINE_ID]
const GRAY_MODEL_INPUT_HASH = GRAY_PATENT_CONTRACT.modelInputHash
if (!GRAY_MODEL_INPUT_HASH) throw new Error('Generated patent machine contract has no FEM model identity')
const GRAY_LUT_REVISION = grayFemLookupRevision(GRAY_PATENT_CONTRACT)
const GRAY_LUT_PATH = `/data/generated/edwin-gray/motor-fem-lut-v1.json?revision=${GRAY_LUT_REVISION}`
const GRAY_CALIBRATION_PATH = '/data/generated/edwin-gray/motor-fem-calibration-pack-v1.json'
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

function compatibleGrayLut() {
  const compatibility = {
    machineContractId: GRAY_PATENT_CONTRACT.machineContractId,
    machineRevision: GRAY_PATENT_CONTRACT.machineRevision,
    modelRevision: GRAY_PATENT_CONTRACT.modelRevision,
    topologyIdentity: GRAY_PATENT_CONTRACT.topologyIdentity,
    turns: GRAY_PATENT_CONTRACT.compatibleTurns,
    excitation: GRAY_PATENT_CONTRACT.compatibleExcitation,
    modelInputHash: GRAY_MODEL_INPUT_HASH,
  }
  return {
    contract: 'edwin-gray-browser-result',
    contractVersion: 1,
    lutContract: 'motor-fem-lut-v1',
    caseId: 'pwa-compatible-gray-lut',
    status: 'complete',
    expectedAnglesDeg: [0, 180],
    compatibility,
    entries: [0, 180].map((rotorAngleDeg, index) => ({
      entryId: `pwa-angle-${rotorAngleDeg}`,
      status: 'complete',
      parameters: {
        rotorAngleDeg,
        eventIndex: index,
        excitationContract: GRAY_PATENT_CONTRACT.compatibleExcitation,
        meshSizeM: 0.01,
        driveCurrentA: 1,
      },
      observables: {
        magneticEnergyJ: { value: 0.1 + index * 0.01, unit: 'J' },
        coEnergyJ: { value: 0.1 + index * 0.01, unit: 'J' },
        inductanceH: { value: 0.2 + index * 0.02, unit: 'H' },
      },
      provenance: {
        synthetic: false,
        sourceFormat: 'solver-json',
        solver: 'pwa-test-solver',
        backend: 'production-preview-fixture',
        modelInputHash: GRAY_MODEL_INPUT_HASH,
        jobInputHash: String(index + 1).repeat(64),
        symmetryApplied: false,
        artifacts: [{ path: `angle-${rotorAngleDeg}.json`, sha256: String(index + 3).repeat(64) }],
      },
    })),
    provenance: {
      synthetic: false,
      limitations: ['Production-preview fixture for compatible runtime-cache behavior only.'],
      source: 'tests/e2e/pwa.spec.ts',
    },
  }
}

async function ensureServiceWorkerControl(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('tour-ready')).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  return `${(value / 1024).toFixed(value < 1024 * 10 ? 1 : 0)} KB`
}

test('Gray payloads use bounded runtime caches and the warmed surrogate runs offline', async ({ context, page }) => {
  await ensureServiceWorkerControl(page)

  const precachedUrls = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.includes('workbox-precache'))
    return (await Promise.all(names.map(async (name) => (await (await caches.open(name)).keys()).map(({ url }) => url)))).flat()
  })
  expect(precachedUrls.some((url) => /edwinGray\.worker-[^/]+\.js$/.test(url))).toBe(false)
  expect(precachedUrls.some((url) => url.includes('/data/generated/edwin-gray/'))).toBe(false)

  const serviceWorker = await (await page.request.get('/sw.js')).text()
  expect(serviceWorker).toContain(GRAY_WORKER_CACHE)
  expect(serviceWorker).toContain(GRAY_LUT_CACHE)
  expect(serviceWorker).toContain(GRAY_CALIBRATION_CACHE)
  expect(serviceWorker).toContain('motor-fem-calibration-pack-v1')
  expect(serviceWorker).toContain('maxEntries:2')
  expect(serviceWorker).toContain('maxEntries:1')
  expect(serviceWorker).toContain('networkTimeoutSeconds:5')
  expect(serviceWorker).toContain('skipWaiting')
  expect(serviceWorker).toContain('clientsClaim')

  await page.goto('/labs/edwin-gray')
  await expect(page.getByTestId('gray-workbench').locator('[data-status="completed"]')).toBeVisible()
  await expect.poll(() => page.evaluate(async (cacheName) => {
    const cache = await caches.open(cacheName)
    return (await cache.keys()).filter(({ url }) => /\/assets\/edwinGray\.worker-[^/]+\.js$/.test(url)).length
  }, GRAY_WORKER_CACHE)).toBe(1)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByTestId('gray-workbench').locator('[data-status="completed"]')).toBeVisible()
  await page.getByTestId('gray-run').click()
  await expect(page.getByTestId('gray-workbench').locator('[data-status="completed"]')).toBeVisible()

  await page.getByTestId('gray-machine-contract').selectOption(GRAY_PATENT_MACHINE_ID)
  await expect(page.getByTestId('gray-fem-runtime-status')).not.toHaveAttribute('data-state', 'ready')
  await expect(page.getByTestId('gray-fem-runtime-status')).toContainText(/unavailable|failed|fetch/i)
  await expect(page.getByTestId('gray-magnetic-model')).toHaveValue('illustrative-surrogate')
  expect(await page.evaluate(async (cacheName) => (await (await caches.open(cacheName)).keys()).length, GRAY_LUT_CACHE)).toBe(0)
  expect(await page.evaluate(async (cacheName) => (await (await caches.open(cacheName)).keys()).length, GRAY_CALIBRATION_CACHE)).toBe(0)
})

test('a warmed unavailable calibration pack remains fail-closed offline', async ({ context, page }) => {
  await ensureServiceWorkerControl(page)
  await page.goto('/labs/edwin-gray')
  await expect(page.getByTestId('gray-workbench').locator('[data-status="completed"]')).toBeVisible()
  await page.getByTestId('gray-machine-contract').selectOption(GRAY_PATENT_MACHINE_ID)
  await expect(page.getByTestId('gray-calibration-runtime-status')).toHaveAttribute('data-state', 'invalid')
  await expect(page.getByTestId('gray-calibration-runtime-status')).toContainText('provenance mismatch')
  await expect(page.getByTestId('gray-magnetic-model')).toHaveValue('illustrative-surrogate')
  expect(await page.evaluate(async (cacheName) => (await (await caches.open(cacheName)).keys()).length, GRAY_CALIBRATION_CACHE)).toBe(1)

  await context.setOffline(true)
  await page.getByTestId('gray-calibration-recheck').click()
  await expect(page.getByTestId('gray-calibration-runtime-status')).toHaveAttribute('data-state', 'invalid')
  await expect(page.getByTestId('gray-calibration-runtime-status')).toContainText('provenance mismatch')
  await expect(page.getByTestId('gray-magnetic-model').locator('option[value="limited-fem-calibration"]')).toHaveAttribute('disabled', '')

  const cached = await page.evaluate(async (cacheName) => (await (await caches.open(cacheName)).keys()).map(({ url }) => url), GRAY_CALIBRATION_CACHE)
  expect(cached).toHaveLength(1)
  expect(cached[0]).toContain(GRAY_CALIBRATION_PATH)
})

test('the production PWA rejects a corrupted cached calibration pack offline', async ({ context, page }) => {
  await ensureServiceWorkerControl(page)
  const response = await page.request.get(GRAY_CALIBRATION_PATH)
  expect(response.ok()).toBe(true)
  const calibrationPack = await response.json()
  await page.goto('/labs/edwin-gray')
  await expect(page.getByTestId('gray-workbench').locator('[data-status="completed"]')).toBeVisible()

  await page.evaluate(async ({ cacheName, path, value }) => {
    const cache = await caches.open(cacheName)
    await cache.put(path, new Response(JSON.stringify({
      ...value,
      evidence: { ...value.evidence, currentSpecificationSha256: '0'.repeat(64) },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
  }, { cacheName: GRAY_CALIBRATION_CACHE, path: GRAY_CALIBRATION_PATH, value: calibrationPack })

  await context.setOffline(true)
  await page.getByTestId('gray-machine-contract').selectOption(GRAY_PATENT_MACHINE_ID)
  await expect(page.getByTestId('gray-calibration-runtime-status')).toHaveAttribute('data-state', 'invalid')
  await expect(page.getByTestId('gray-calibration-runtime-status')).toContainText(
    /pilot and class-run provenance mismatch.*not uncertainty bounds.*assumption-only/,
  )
  await expect(page.getByTestId('gray-magnetic-model')).toHaveValue('illustrative-surrogate')
  await expect(page.getByTestId('gray-magnetic-model').locator('option[value="limited-fem-calibration"]')).toHaveAttribute('disabled', '')
})

test('a previously fetched compatible revisioned Gray LUT remains usable offline', async ({ context, page }) => {
  await ensureServiceWorkerControl(page)
  await page.goto('/labs/edwin-gray')
  await expect(page.getByTestId('gray-workbench').locator('[data-status="completed"]')).toBeVisible()

  const lut = compatibleGrayLut()
  await page.evaluate(async ({ cacheName, path, value }) => {
    const cache = await caches.open(cacheName)
    await cache.put(path, new Response(JSON.stringify(value), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
  }, { cacheName: GRAY_LUT_CACHE, path: GRAY_LUT_PATH, value: lut })

  await context.setOffline(true)
  await page.getByTestId('gray-machine-contract').selectOption(GRAY_PATENT_MACHINE_ID)
  await expect(page.getByTestId('gray-fem-runtime-status')).toHaveAttribute('data-state', 'ready')
  await expect(page.getByTestId('gray-fem-runtime-status')).toContainText('pwa-compatible-gray-lut')
  await page.getByTestId('gray-magnetic-model').selectOption('fem-lookup')
  await page.getByTestId('gray-run').click()
  await expect(page.getByTestId('gray-workbench').locator('[data-status="completed"]')).toBeVisible()

  const cachedUrls = await page.evaluate(async (cacheName) => (await (await caches.open(cacheName)).keys()).map(({ url }) => url), GRAY_LUT_CACHE)
  expect(cachedUrls).toHaveLength(1)
  expect(cachedUrls[0]).toContain(`revision=${GRAY_LUT_REVISION}`)

  const incompatibleLut = {
    ...lut,
    compatibility: { ...lut.compatibility, modelRevision: lut.compatibility.modelRevision + 1 },
  }
  await page.evaluate(async ({ cacheName, path, value }) => {
    const cache = await caches.open(cacheName)
    await cache.put(path, new Response(JSON.stringify(value), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
  }, { cacheName: GRAY_LUT_CACHE, path: GRAY_LUT_PATH, value: incompatibleLut })
  await page.getByRole('button', { name: 'Recheck FEM lookup' }).click()
  await expect(page.getByTestId('gray-fem-runtime-status')).toHaveAttribute('data-state', 'invalid')
  await expect(page.getByTestId('gray-fem-runtime-status')).toContainText('model revision mismatch')
  await expect(page.getByTestId('gray-magnetic-model')).toHaveValue('illustrative-surrogate')
})

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
