import { expect, test } from '@playwright/test'
import { simulateNumberWall } from '../../src/engine/numberWall'

async function waitForAudit(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.getByTestId('app-ready')).toBeVisible()
  return page.evaluate(() => window.__OPENSIMPHY_AUDIT__)
}

test('reports exact complete coverage and captures overview evidence', async ({ page }, testInfo) => {
  const audit = await waitForAudit(page)
  expect(audit).toBeTruthy()
  expect(audit?.formulas).toHaveLength(288)
  expect(audit?.walls).toHaveLength(351)
  expect(audit?.topics).toHaveLength(8)
  expect(audit?.topics.reduce((sum, topic) => sum + topic.count, 0)).toBe(288)
  await expect(page.locator('.topic-door')).toHaveCount(8)
  await expect(page.locator('.topic-category-card')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('overview.png'), fullPage: true })

  await page.goto('/sources')
  await expect(page.getByTestId('coverage-status')).toHaveAttribute('data-status', 'complete')
  await expect(page.getByTestId('coverage-recipes')).toContainText('288')
  await expect(page.getByTestId('coverage-walls')).toContainText('351')
})

test('uses the homepage tour to open a classified atlas slice', async ({ page }) => {
  await waitForAudit(page)
  const topicDoor = page.getByTestId('topic-magnetism')
  await expect(topicDoor).toContainText('81 constants / 5 families')
  await topicDoor.click()

  await expect(page).toHaveURL(/\/topics\/magnetism$/)
  await expect(page.getByRole('heading', { name: 'Spin, moments & magnetic response' })).toBeVisible()
  await expect(page.locator('.topic-category-card')).toHaveCount(5)
  await expect(page.locator('.topic-featured-grid a')).toHaveCount(4)
  await page.getByRole('link', { name: /View all 81/ }).click()

  await expect(page).toHaveURL(/\/atlas\?topic=magnetism$/)
  await expect(page.getByTestId('formula-topic')).toHaveValue('magnetism')
  await expect(page.locator('.formula-row')).toHaveCount(24)
  await expect(page.locator('.header-stat')).toContainText('81 / 288')
  await expect(page.getByTestId('advanced-filters')).not.toHaveAttribute('open', '')
})

test('browses and searches the formula atlas', async ({ page }) => {
  await waitForAudit(page)
  await page.goto('/atlas')
  await expect(page.getByRole('heading', { name: 'Formula Atlas' })).toBeVisible()
  await expect(page.getByTestId('formula-row-1')).toBeVisible()
  await page.getByTestId('formula-search').fill('hyperfine transition')
  await expect(page.getByTestId('formula-row-1')).toBeVisible()
  await page.getByTestId('formula-classification').selectOption('exact')
  await expect(page.locator('.formula-row').first()).toBeVisible()
  await page.getByTestId('formula-search').fill('')
  await page.getByTestId('formula-classification').selectOption('all')
  await page.getByTestId('advanced-filters').locator('summary').click()
  await page.getByTestId('formula-status').selectOption('fail')
  await expect(page.locator('.formula-row')).toHaveCount(3)
  await expect(page.getByTestId('formula-row-120')).toBeVisible()
  await expect(page.getByTestId('formula-row-211')).toBeVisible()
  await expect(page.getByTestId('formula-row-277')).toBeVisible()
})

test('all recipe graphs are engine-ready and first, middle, last routes render', async ({ page }, testInfo) => {
  const audit = await waitForAudit(page)
  expect(audit?.formulas.every((formula) => formula.graphReady)).toBe(true)

  for (const ordinal of [1, 144, 288]) {
    const formula = audit?.formulas.find((item) => item.ordinal === ordinal)
    expect(formula, `missing recipe ${ordinal}`).toBeTruthy()
    await page.goto(`/atlas/${ordinal}`)
    await page.getByTestId('graph-disclosure').locator('summary').click()
    await expect(page.getByTestId('formula-graph-ready')).toBeVisible()
    await expect(page.locator('.equation-plate')).toContainText('(EG * EB)')
  }
  await page.screenshot({ path: testInfo.outputPath('formula-288.png'), fullPage: true })
})

test('every core registry case is graph-ready and tabs render', async ({ page }) => {
  const audit = await waitForAudit(page)
  expect(audit?.core.length).toBeGreaterThan(0)
  expect(audit?.core.every((item) => item.graphReady)).toBe(true)
  await page.goto('/labs/core')
  for (const item of audit?.core ?? []) {
    await page.getByTestId(`core-case-${item.id}`).click()
    await expect(page.getByTestId('plot-ready')).toBeVisible()
  }
  const plotTabs = page.locator('.plot-tabs button')
  if (await plotTabs.count() > 1) {
    await plotTabs.nth(1).click()
    await expect(page.getByTestId('plot-ready')).toBeVisible()
  }
})

test('all wall inputs pass small-simulation completion and UI mode interaction', async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  const audit = await waitForAudit(page)
  expect(audit?.walls).toHaveLength(351)
  const wallCoverage = audit?.coverage.find((row) => row.key === 'walls')

  const registry = await page.request.get('/data/generated/walls.json').then((response) => response.json()) as Array<{ id: string; filename: string }>
  const failures: Array<{ id: string; error: string }> = []
  let cursor = 0
  async function run(): Promise<void> {
    while (cursor < registry.length) {
      const entry = registry[cursor++]
      if (!entry) continue
      try {
        const payload = await page.request.get(`/data/number-walls/${encodeURIComponent(entry.filename)}`).then((response) => response.json()) as { sequence?: unknown[] }
        const simulation = simulateNumberWall(payload, {
          terms: Math.min(6, payload.sequence?.length ?? 0), depth: 2, mode: 'mod', modulus: 7,
        })
        if (simulation.id !== entry.id || simulation.cells.length === 0) failures.push({ id: entry.id, error: 'empty or mismatched simulation' })
      } catch (reason) {
        failures.push({ id: entry.id, error: reason instanceof Error ? reason.message : String(reason) })
      }
    }
  }
  await Promise.all(Array.from({ length: 12 }, run))
  const smallSimulationAudit = { tested: registry.length, failures }
  expect(smallSimulationAudit.tested).toBe(351)
  expect(smallSimulationAudit.failures).toEqual([])

  await page.goto('/labs/walls')
  await page.getByTestId('wall-search').fill('Catalan')
  for (const mode of ['mod', 'valuation', 'signed_log', 'row_signed_log', 'zero_windows', 'small_values']) {
    await page.getByTestId('wall-mode').selectOption(mode)
    await page.getByTestId('wall-run').click()
    await expect(page.getByTestId('wall-simulation-ready')).toBeVisible()
  }
  await expect(page.getByTestId('wall-canvas')).toBeVisible()
  await page.getByTestId('wall-canvas').click({ position: { x: 10, y: 10 } })
  await expect(page.locator('.cell-readout')).toContainText('Cell [')
  await page.screenshot({ path: testInfo.outputPath('number-wall.png'), fullPage: true })
  expect(wallCoverage?.simulatable).toBe(351)
})

test('mobile navigation remains operable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await waitForAudit(page)
  const toggle = page.getByTestId('nav-toggle')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.locator('#primary-navigation').getByRole('link', { name: /Sources/ }).click()
  await expect(page).toHaveURL(/\/sources$/)
})

test('shows source caveat and PWA manifest/service-worker evidence', async ({ page, request }) => {
  await waitForAudit(page)
  await page.goto('/sources')
  await expect(page.getByTestId('sources-caveat')).toContainText('REPRODUCTION ≠ VALIDATION')

  const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifestLink).toBeTruthy()
  const manifest = await request.get(new URL(manifestLink!, 'http://127.0.0.1:5173').href)
  expect(manifest.ok()).toBe(true)
  const registration = await page.evaluate(async () => {
    await navigator.serviceWorker?.ready
    return Boolean(await navigator.serviceWorker?.getRegistration())
  })
  expect(registration).toBe(true)
})
