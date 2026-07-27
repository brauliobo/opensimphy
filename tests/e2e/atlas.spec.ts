import { expect, test, type Page } from '@playwright/test'
import type { RuntimeAudit } from '../../src/registries/runtimeAudit'

type AuditedRoute = 'tour' | 'formulas' | 'core' | 'walls'
type ReadyAudit<K extends AuditedRoute> = Extract<NonNullable<RuntimeAudit[K]>, { status: 'ready' }>

async function gotoRoute(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await expect(page.getByTestId('app-ready')).toBeVisible()
}

async function waitForRouteAudit<K extends AuditedRoute>(
  page: Page,
  path: string,
  readyTestId: string,
  domain: K,
): Promise<ReadyAudit<K>> {
  await gotoRoute(page, path)
  await expect(page.getByTestId(readyTestId)).toBeVisible()
  await expect.poll(() => page.evaluate((key) => window.__OPENSIMPHY_AUDIT__?.[key]?.status, domain)).toBe('ready')
  return page.evaluate((key) => window.__OPENSIMPHY_AUDIT__![key] as ReadyAudit<K>, domain)
}

async function expectNoDocumentOverflow(page: import('@playwright/test').Page) {
  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
}

test('reports exact complete coverage and captures overview evidence', async ({ page }, testInfo) => {
  const tourAudit = await waitForRouteAudit(page, '/', 'tour-ready', 'tour')
  expect(tourAudit.taxonomy.total).toBe(288)
  expect(tourAudit.taxonomy.topics).toHaveLength(8)
  expect(tourAudit.taxonomy.topics.reduce((sum, topic) => sum + topic.count, 0)).toBe(288)
  await expect(page.locator('.tour-station')).toHaveCount(8)
  await expect(page.locator('.topic-door')).toHaveCount(0)
  await expect(page.locator('.topic-category-card')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('overview.png'), fullPage: true })

  await gotoRoute(page, '/sources')
  await expect(page.getByTestId('completion-registry-ready')).toBeVisible()
  await expect(page.getByTestId('coverage-status')).toHaveAttribute('data-status', 'complete')
  await expect(page.getByTestId('coverage-recipes')).toContainText('288')
  await expect(page.getByTestId('coverage-walls')).toContainText('351')
})

test('redirects a legacy topic into the Tour and opens the same classified Atlas slice', async ({ page }) => {
  await gotoRoute(page, '/topics/magnetism')
  await expect(page).toHaveURL(/\/tour\/spin-magnetism$/)
  await expect(page.getByRole('heading', { name: 'Spin, Magnetic Moments, and Anomalies' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lessons' })).toBeVisible()
  await expect(page.locator('a[href="/tour/spin-magnetism/spin-precession"]')).toBeVisible()
  await page.locator('#primary-navigation').getByRole('link', { name: 'Atlas' }).click()

  await expect(page).toHaveURL(/\/atlas$/)
  await expect(page.getByTestId('formula-registry-ready')).toBeVisible()
  await page.getByTestId('formula-topic').selectOption('magnetism')
  await expect(page).toHaveURL(/\/atlas\?topic=magnetism$/)
  await expect(page.getByTestId('formula-topic')).toHaveValue('magnetism')
  await expect(page.locator('.formula-row')).toHaveCount(24)
  await expect(page.locator('.header-stat')).toContainText('81 / 288')
  await expect(page.getByTestId('advanced-filters')).not.toHaveAttribute('open', '')
})

test('browses and searches the formula atlas', async ({ page }) => {
  await waitForRouteAudit(page, '/atlas', 'formula-registry-ready', 'formulas')
  await expect(page.getByRole('heading', { name: 'Formula Atlas' })).toBeVisible()
  await expect(page.getByTestId('formula-list')).not.toHaveAttribute('aria-live')
  await expect(page.getByTestId('formula-result-count')).toHaveAttribute('aria-live', 'polite')
  await expect(page.getByTestId('formula-result-count')).toContainText('Showing 1–24 of 288 matching formulas')
  await expect(page.getByTestId('dimension-conflict-count')).toHaveText('68 dimension conflicts')
  await expect(page.getByTestId('dependency-drift-count')).toHaveText('26 direct dependency differences')
  await expect(page.getByTestId('formula-row-1')).toBeVisible()
  await page.getByTestId('formula-search').fill('hyperfine transition')
  await expect(page.getByTestId('formula-row-1')).toBeVisible()
  await page.getByTestId('formula-basis').selectOption('exact')
  await expect(page.locator('.formula-row').first()).toBeVisible()
  await page.getByTestId('formula-search').fill('')
  await page.getByTestId('formula-basis').selectOption('all')
  await page.getByTestId('advanced-filters').locator('summary').click()
  await page.getByTestId('formula-source-criterion').selectOption('not-met')
  await expect(page.locator('.formula-row')).toHaveCount(3)
  await expect(page.getByTestId('formula-row-120')).toBeVisible()
  await expect(page.getByTestId('formula-row-211')).toBeVisible()
  await expect(page.getByTestId('formula-row-277')).toBeVisible()
})

test('all recipe graphs are engine-ready and first, middle, last routes render', async ({ page }, testInfo) => {
  const audit = await waitForRouteAudit(page, '/atlas', 'formula-registry-ready', 'formulas')
  expect(audit.expected).toBe(288)
  expect(audit.evaluated).toBe(288)
  expect(audit.graphed).toBe(288)

  for (const ordinal of [1, 144, 288]) {
    await gotoRoute(page, `/atlas/${ordinal}`)
    await expect(page.getByTestId('formula-record-ready'), `missing recipe ${ordinal}`).toBeVisible()
    await page.getByTestId('graph-disclosure').locator('summary').click()
    await expect(page.getByTestId('formula-graph-ready')).toBeVisible()
    await expect(page.locator('.equation-plate')).toContainText('(EG * EB)')
  }
  await page.screenshot({ path: testInfo.outputPath('formula-288.png'), fullPage: true })
})

test('formula ordinal 2 is meaning-first, tabled, revisioned, saved, and compared', async ({ page }) => {
  await gotoRoute(page, '/atlas/2')
  await expect(page.getByTestId('formula-record-ready')).toBeVisible()
  await expect(page).toHaveTitle(/electron volt-hertz relationship/)
  await expect(page.getByTestId('formula-meaning')).toContainText('What this quantity means')
  await expect(page.getByTestId('guided-meaning')).toContainText('Named target')
  await expect(page.getByTestId('guided-meaning')).toContainText('source-labelled')
  await expect(page.getByTestId('meaning-caveats')).toContainText('preserved wording, not an authoritative physical definition')
  await expect(page.getByTestId('formula-meaning')).toContainText('does not independently validate')
  await expect(page.getByTestId('constructor-token-key')).toContainText('External geometry')
  await expect(page.getByTestId('constructor-token-key')).toContainText('Inversion-boundary scale')
  await expect(page.getByTestId('sweep-table').locator('tbody tr')).toHaveCount(65)
  await expect(page.getByTestId('sweep-table').getByRole('columnheader')).toHaveText([
    'Scale', 'Real', 'Imaginary', 'Magnitude', 'Sign', 'Finite',
  ])

  const meaningOrder = await page.evaluate(() => {
    const meaning = document.querySelector('[data-testid="formula-meaning"]')
    const raw = document.querySelector('[data-testid="raw-anatomy"]')
    return Boolean(meaning && raw && (meaning.compareDocumentPosition(raw) & Node.DOCUMENT_POSITION_FOLLOWING))
  })
  expect(meaningOrder).toBe(true)

  await page.getByTestId('sweep-scale').fill('0.5')
  await page.getByTestId('freeze-comparison').click()
  await page.getByTestId('sweep-scale').fill('1.5')
  await page.getByTestId('freeze-comparison').click()
  await expect(page.getByTestId('compatible-comparison')).toContainText('selected-real delta')
  await expect(page.getByTestId('freeze-comparison')).toBeDisabled()

  await page.getByTestId('save-label').fill('Ordinal 2 formula state')
  await page.getByTestId('save-formula-run').click()
  await expect(page.locator('.save-result')).toContainText('Saved formula run')
  await page.goto('/saved')
  await expect(page.getByRole('heading', { name: 'Local Notebook' })).toBeVisible()
  await expect(page.getByTestId('saved-run-count')).toHaveText('1 run')
  await expect(page.getByTestId('saved-run-formula-link')).toHaveAttribute('href', '/atlas/2')
})

test('round trips a Unicode canonical formula ID while saving and notebook linking by ordinal', async ({ page }) => {
  const unicodeId = 'ℏ'
  const atlasQuery = 'q=reduced+Planck'
  const safeReturn = '/tour/anchors/units-and-dimensions?path=quick#interpret'
  const detailQuery = new URLSearchParams({ q: 'reduced Planck', returnTo: safeReturn }).toString()

  await gotoRoute(page, `/atlas?${atlasQuery}`)
  await page.goto(`/atlas/${encodeURIComponent(unicodeId)}?${detailQuery}`)
  await expect(page.getByTestId('formula-record-ready')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/atlas/${encodeURIComponent(unicodeId)}\\?`))
  await expect(page.getByTestId('formula-record-identity')).toContainText('ℏ')
  await expect(page.getByTestId('tour-return')).toHaveAttribute('href', safeReturn)

  await page.getByTestId('save-label').fill('Reduced Planck constant')
  await page.getByTestId('save-formula-run').click()
  await expect(page.locator('.save-result')).toContainText('Saved formula run')
  await page.getByTestId('atlas-return').click()
  await expect(page).toHaveURL(/\/atlas\?q=reduced(?:\+|%20)Planck$/)
  await expect(page.getByTestId('formula-search')).toHaveValue('reduced Planck')

  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`/atlas/${encodeURIComponent(unicodeId)}\\?`))
  await page.goto(`/atlas/${encodeURIComponent(unicodeId)}?returnTo=${encodeURIComponent('https://evil.test/tour/a/b')}`)
  await expect(page.getByTestId('formula-record-ready')).toBeVisible()
  await expect(page.getByTestId('tour-return')).toHaveCount(0)

  await page.goto('/saved')
  await expect(page.getByTestId('saved-run-count')).toHaveText('1 run')
  await expect(page.getByTestId('saved-run-formula-link')).toHaveAttribute('href', '/atlas/7')
})

test('renders the preserved V_m_1 pressure-label correction before numeric comparison', async ({ page }) => {
  await gotoRoute(page, '/atlas/V_m_1')
  await expect(page.getByTestId('formula-record-ready')).toBeVisible()
  await expect(page.getByTestId('meaning-caveats')).toContainText('source label says 100 kPa')
  await expect(page.getByTestId('meaning-caveats')).toContainText('101325.003754773 Pa')
  await expect(page.getByTestId('meaning-caveats')).toContainText('about 101.325 kPa')
  const caveatBeforeResidual = await page.evaluate(() => {
    const caveat = document.querySelector('[data-testid="meaning-caveats"]')
    const residual = document.querySelector('[data-testid="residual-scales"]')
    return Boolean(caveat && residual && (caveat.compareDocumentPosition(residual) & Node.DOCUMENT_POSITION_FOLLOWING))
  })
  expect(caveatBeforeResidual).toBe(true)
})

test('restores complete Atlas context after a formula round trip', async ({ page }) => {
  await gotoRoute(page, '/atlas')
  await page.getByTestId('formula-search').fill('hyperfine transition')
  await page.getByTestId('formula-basis').selectOption('exact')
  await expect(page).toHaveURL(/q=hyperfine(?:\+|%20)transition/)
  await expect(page).toHaveURL(/basis=exact/)
  await page.getByTestId('formula-row-1').click()
  await expect(page.getByTestId('formula-record-ready')).toBeVisible()
  await page.getByTestId('atlas-return').click()
  await expect(page.getByTestId('formula-registry-ready')).toBeVisible()
  await expect(page.getByTestId('formula-search')).toHaveValue('hyperfine transition')
  await expect(page.getByTestId('formula-basis')).toHaveValue('exact')
})

test('every core registry case is graph-ready and tabs render', async ({ page }) => {
  const audit = await waitForRouteAudit(page, '/labs/core', 'core-registry-ready', 'core')
  expect(audit.expected).toBe(37)
  expect(audit.evaluated).toBe(37)
  expect(audit.graphed).toBe(37)
  const cases = page.locator('[data-testid^="core-case-"]')
  await expect(cases).toHaveCount(37)
  for (let index = 0; index < 37; index += 1) {
    await cases.nth(index).click()
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
  const audit = await waitForRouteAudit(page, '/labs/walls', 'wall-registry-ready', 'walls')
  expect(audit.registered).toBe(351)

  const smallSimulationAudit = await page.evaluate(async () => {
    const { simulateNumberWall } = await import('/src/engine/numberWall.ts')
    const registry = await fetch('/data/generated/walls.json').then((response) => response.json()) as Array<{ id: string; filename: string }>
    const failures: Array<{ id: string; error: string }> = []
    let cursor = 0
    async function run(): Promise<void> {
      while (cursor < registry.length) {
        const entry = registry[cursor++]
        if (!entry) continue
        try {
          const payload = await fetch(`/data/number-walls/${encodeURIComponent(entry.filename)}`).then((response) => response.json()) as { sequence?: unknown[] }
          const simulation = simulateNumberWall(payload, {
            terms: Math.min(6, payload.sequence?.length ?? 0),
            depth: 2,
            mode: 'mod',
            modulus: 7,
          })
          if (simulation.id !== entry.id || simulation.cells.length === 0) failures.push({ id: entry.id, error: 'empty or mismatched simulation' })
        } catch (reason) {
          failures.push({ id: entry.id, error: reason instanceof Error ? reason.message : String(reason) })
        }
      }
    }
    await Promise.all(Array.from({ length: 12 }, run))
    return { tested: registry.length, failures }
  })
  expect(smallSimulationAudit.tested).toBe(351)
  expect(smallSimulationAudit.failures).toEqual([])

  await page.getByTestId('wall-search').fill('Catalan')
  for (const mode of ['mod', 'valuation', 'signed_log', 'row_signed_log', 'zero_windows', 'small_values']) {
    await page.getByTestId('wall-mode').selectOption(mode)
    await page.getByTestId('workbench-run').click()
    await expect(page.getByTestId('wall-simulation-ready')).toBeVisible()
  }
  await expect(page.getByTestId('wall-canvas')).toBeVisible()
  await page.getByTestId('wall-canvas').click({ position: { x: 10, y: 10 } })
  await expect(page.locator('.cell-readout')).toContainText('Cell [')
  await page.screenshot({ path: testInfo.outputPath('number-wall.png'), fullPage: true })
  expect(audit.registered).toBe(351)
})

test('mobile navigation remains operable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await waitForRouteAudit(page, '/', 'tour-ready', 'tour')
  const toggle = page.getByTestId('nav-toggle')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.locator('#primary-navigation').getByRole('link', { name: /Evidence/ }).click()
  await expect(page).toHaveURL(/\/evidence$/)
  await page.getByRole('link', { name: 'Open Sources & Limits' }).click()
  await expect(page).toHaveURL(/\/sources$/)
})

test('discovers the EARTH dossier and browses its locked corpus without executing source content', async ({ page }) => {
  await gotoRoute(page, '/earth')
  await expect(page.getByRole('heading', { name: 'EARTH Evidence Dossier' })).toBeVisible()
  await expect(page.getByTestId('earth-evidence-ledger')).toContainText('scientificallyValidated: false')
  await expect(page.getByTestId('earth-evidence-ledger')).toContainText('220')
  await expect(page.getByTestId('earth-evidence-ledger')).toContainText('134 runnable')
  await expect(page.locator('#primary-navigation a[href="/evidence"]')).toHaveAttribute('aria-current', 'location')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('link', { name: /03\/B Corpus · 63/ }).first().click()

  await expect(page).toHaveURL(/\/earth\/corpus$/)
  await expect(page.getByRole('heading', { name: 'EARTH Source Index' })).toBeVisible()
  await expect(page.locator('.earth-local-nav a[href="/earth/corpus"]')).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('#primary-navigation a[href="/evidence"]')).toHaveAttribute('aria-current', 'location')
  await expect(page.getByTestId('earth-document-grid').locator('.earth-document-card')).toHaveCount(63)
  await expect(page.getByTestId('earth-document-grid')).not.toHaveAttribute('aria-live')
  await expect(page.getByTestId('earth-result-count')).toHaveAttribute('aria-live', 'polite')
  await page.getByTestId('earth-search').fill('Universal Genetic Code')
  await page.getByTestId('earth-collection').selectOption('theorem')
  await page.getByTestId('earth-series').selectOption('BIO')
  await page.getByTestId('earth-evidence-filter').selectOption('simulations')
  await expect(page).toHaveURL(/q=Universal(?:\+|%20)Genetic(?:\+|%20)Code/)
  await expect(page).toHaveURL(/collection=theorem/)
  await expect(page).toHaveURL(/series=BIO/)
  await expect(page).toHaveURL(/evidence=simulations/)
  await expect(page.getByTestId('earth-document-grid').locator('.earth-document-card')).toHaveCount(1)
  await expect(page.locator('.earth-document-card')).toContainText('Program relations')
  await expect(page.locator('.earth-document-card')).toContainText('Source candidates')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('link', { name: /Universal Genetic Code/ }).click()

  await expect(page).toHaveURL(/\/earth\/corpus\/.+\?view=reading$/)
  await expect(page.getByTestId('earth-document-reading')).toBeVisible()
  await expect(page.getByTestId('earth-document-source')).toHaveCount(0)
  await expect(page.getByText('TEXT-ONLY / NO EXECUTION')).toBeVisible()
  await expect(page.getByTestId('earth-document-caveat')).toContainText('Exact source is authoritative')
  await expect(page.getByTestId('earth-document-caveat')).toContainText('locked original Markdown')
  await expect(page.locator('.earth-reading-panel img, .earth-reading-panel script')).toHaveCount(0)
  await expect(page.locator('.earth-reading-block.is-code')).toHaveCount(3)
  const firstOutline = page.locator('.earth-outline a').first()
  const firstAnchor = await firstOutline.getAttribute('href')
  expect(firstAnchor).toMatch(/^#source-/)
  await firstOutline.click()
  await expect(page).toHaveURL(new RegExp(`${firstAnchor}$`))
  await page.getByTestId('earth-source-mode').click()
  await expect(page).toHaveURL(/view=source/)
  await expect(page).toHaveURL(new RegExp(`${firstAnchor}$`))
  await expect(page.getByTestId('earth-document-source')).toBeVisible()
  await expect(page.getByTestId('earth-document-source')).toHaveAttribute('data-source-sha256', /^[a-f0-9]{64}$/)
  await expect(page.locator('.earth-source-panel img, .earth-source-panel script')).toHaveCount(0)
  await expect(page.getByTestId('earth-document-source')).toContainText('```python')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

  await page.goBack()
  await expect(page).toHaveURL(/\/earth\/corpus\?.*series=BIO/)
  await expect(page.getByTestId('earth-search')).toHaveValue('Universal Genetic Code')
  await expect(page.getByTestId('earth-collection')).toHaveValue('theorem')
  await expect(page.getByTestId('earth-series')).toHaveValue('BIO')
  await expect(page.getByTestId('earth-evidence-filter')).toHaveValue('simulations')
  await expect(page.getByTestId('earth-document-grid').locator('.earth-document-card')).toHaveCount(1)
  await page.getByTestId('earth-clear-filters').click()
  await expect(page).toHaveURL(/\/earth\/corpus$/)
  await expect(page.getByTestId('earth-document-grid').locator('.earth-document-card')).toHaveCount(63)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('filters and pages the URL-backed EARTH program registry, then restores state on back', async ({ page }) => {
  await gotoRoute(page, '/earth/programs')

  await expect(page.getByRole('heading', { name: 'EARTH Program Registry' })).toBeVisible()
  await expect(page.getByTestId('simulation-grid').locator('.earth-program-row')).toHaveCount(36)
  await expect(page.locator('.header-stat')).toContainText('130 / 130')
  await expect(page.getByTestId('program-registry-statement')).toContainText('130 canonical programs')
  await expect(page.getByTestId('program-registry-statement')).toContainText('220 declared methods')
  await expect(page.getByTestId('program-registry-statement')).toContainText('134 runnable: 37 source reproductions / 97 traditional comparisons or contract validators; 86 unavailable source formulations')
  await expect(page.getByTestId('program-registry-statement')).toContainText('Scientific validation not established')
  await expect(page.getByText('130 scientific simulations', { exact: false })).toHaveCount(0)
  await expect(page.locator('#primary-navigation a[href="/evidence"]')).toHaveClass(/router-link-active/)
  await expect(page.locator('.earth-local-nav a[href="/earth/programs"]')).toHaveAttribute('aria-current', 'page')
  await expect(page.getByTestId('simulation-advanced-filters')).not.toHaveAttribute('open', '')

  await page.getByTestId('simulation-domain').selectOption('FND')
  await expect(page).toHaveURL(/\/earth\/programs\?domain=FND$/)
  await expect(page.getByTestId('simulation-grid').locator('.earth-program-row')).toHaveCount(14)
  await expect(page.locator('.program-domain-group')).toHaveCount(1)
  await expect(page.locator('.program-domain-group')).toHaveAttribute('data-domain', 'FND')
  await page.getByTestId('simulation-domain').selectOption('all')

  await page.getByTestId('simulation-advanced-filters').locator('summary').click()
  await page.getByTestId('simulation-science').selectOption('blocked-source')
  await expect(page.getByTestId('simulation-grid').locator('.earth-program-row')).toHaveCount(36)
  await expect(page.getByTestId('simulation-advanced-filters').locator('summary')).toContainText('1 active filter')
  await page.getByTestId('simulation-search').fill('Fixed-point and recognizability tests')
  await expect(page).toHaveURL(/science=blocked-source/)
  await expect(page).toHaveURL(/q=Fixed-point(?:\+|%20)and(?:\+|%20)recognizability(?:\+|%20)tests/)
  await expect(page.getByTestId('simulation-grid').locator('.earth-program-row')).toHaveCount(1)
  const blockedRow = page.getByTestId('simulation-record-EARTH-FND-006')
  await expect(blockedRow).toHaveAttribute('href', '/earth/programs/EARTH-FND-006')
  await expect(blockedRow.locator('.program-row-identity')).toContainText('Canonical class: numerical simulation')
  await expect(blockedRow.locator('.program-row-science')).toContainText('SOURCE MODEL BLOCKED')
  await expect(blockedRow.locator('.program-row-science')).toContainText('Scientific status: BLOCKED BY SOURCE MODEL')
  await expect(blockedRow.locator('.program-row-methods')).toContainText('2 declared methods')
  await expect(blockedRow.locator('.program-row-methods')).toContainText('1 runnable · 1 unavailable · browser worker + unavailable')
  await expect(blockedRow.locator('.program-row-evidence')).toContainText('Next blocker')
  await page.getByTestId('simulation-record-EARTH-FND-006').click()

  await expect(page).toHaveURL(/\/earth\/programs\/EARTH-FND-006$/)
  await expect(page.getByRole('heading', { name: 'Fixed-point and recognizability tests' })).toBeVisible()
  await expect(page.getByTestId('simulation-gates')).toBeVisible()
  await expect(page.locator('.simulation-blockers-section')).toHaveClass(/has-scientific-blockers/)
  await expect(page.locator('.simulation-blockers-section')).not.toHaveClass(/is-blocked/)
  await expect(page.getByRole('heading', { name: 'Scientific limitations' })).toBeVisible()
  await expect(page.getByTestId('workbench-run')).toBeVisible()
  await expect(page.getByTestId('simulation-source-links').locator('a').first()).toHaveAttribute('href', /^\/earth\/corpus\/.+/)

  await page.locator('.workbench-method-disclosure summary').click()
  await page.locator('input[type="radio"][value="earth-source-model-v1"]').check()
  await expect(page).toHaveURL(/method=earth-source-model-v1/)
  await expect(page.getByTestId('simulation-method-unavailable')).toContainText('governing EARTH source contract is incomplete')
  await expect(page.getByTestId('simulation-method-unavailable')).toContainText('physical equivalence BX')
  await expect(page.getByTestId('workbench-run')).toHaveCount(0)
  await expect(page.getByTestId('workbench-run')).toHaveCount(0)
  await expect(page.getByTestId('simulation-inputs')).toHaveCount(0)

  await page.goBack()
  await expect(page.getByTestId('simulation-search')).toHaveValue('Fixed-point and recognizability tests')
  await expect(page.getByTestId('simulation-science')).toHaveValue('blocked-source')
  await expect(page.getByTestId('simulation-record-EARTH-FND-006')).toBeVisible()

  await page.getByTestId('simulation-search').fill('')
  await page.getByTestId('simulation-advanced-filters').locator('summary').click()
  await page.getByTestId('simulation-science').selectOption('all')
  await page.getByRole('button', { name: 'Next registry page' }).click()
  await expect(page).toHaveURL(/\/earth\/programs\?page=2$/)
  await expect(page.getByTestId('simulation-result-count')).toContainText('Showing 37–72 of 130 matching programs. Page 2 of 4.')
  const pageTwoLink = page.locator('.earth-program-row').first()
  const canonicalHref = await pageTwoLink.getAttribute('href')
  expect(canonicalHref).toMatch(/^\/earth\/programs\/EARTH-[A-Z]+-\d+$/)
  await pageTwoLink.click()
  await page.goBack()
  await expect(page).toHaveURL(/\/earth\/programs\?page=2$/)
  await expect(page.getByTestId('simulation-result-count')).toContainText('Page 2 of 4.')
  await expect(page.getByTestId('simulation-grid').locator('.earth-program-row')).toHaveCount(36)
})

test('runs a fast EARTH calculator in the dedicated worker', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoRoute(page, '/earth/programs/EARTH-FND-003')

  await expect(page.getByRole('heading', { name: 'Algebraic pi and alpha identities' })).toBeVisible()
  await expect(page.getByTestId('simulation-inputs')).toHaveValue('{}')
  await expect(page.getByTestId('workbench-run')).toHaveText('Run selected method')
  await page.getByTestId('workbench-run').click()

  await expect(page.getByTestId('simulation-status')).toContainText('completed')
  await expect(page.getByTestId('simulation-progress')).toHaveAttribute('aria-valuenow', '100')
  await expect(page.getByTestId('simulation-result')).toContainText('Source reproduction / audit only')
  await expect(page.getByTestId('workbench-conclusion')).toContainText('Scientific validation is not established')
  await expect(page.getByTestId('simulation-raw-result')).toContainText('"id": "EARTH-FND-003"')
  await expect(page.getByTestId('simulation-raw-result')).toContainText('"status": "completed"')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('switches a multi-method EARTH pilot on mobile without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoRoute(page, '/earth/programs/EARTH-PLAN-008')

  await expect(page).toHaveURL(/\/earth\/programs\/EARTH-PLAN-008$/)
  await expect(page.getByText('LOCAL TRADITIONAL BASELINE READY', { exact: false })).toBeVisible()
  await expect(page.getByTestId('simulation-method-rail')).toBeHidden()
  await expect(page.getByTestId('simulation-method-select')).toBeVisible()
  await expect(page.getByTestId('simulation-input-temperatureKelvin')).toHaveValue('288.15')
  await expect(page.getByTestId('method-provenance')).toContainText('Actual adapter runtime')
  await expect(page.getByTestId('method-provenance')).toContainText('browser worker')

  await page.getByTestId('simulation-method-select').selectOption('earth-source-reproduction-v1')
  await expect(page).toHaveURL(/method=earth-source-reproduction-v1/)
  await expect(page.getByTestId('simulation-input-surfaceMassDensityKgPerCubicMetre')).toHaveValue('1.225')
  await page.getByTestId('workbench-run').click()

  await expect(page.getByTestId('simulation-status')).toContainText('completed')
  await expect(page.getByTestId('simulation-result')).toContainText('Source reproduction / audit only')
  await expect(page.getByTestId('simulation-run-ledger')).toContainText('COMPLETED')
  await expect(page.getByTestId('simulation-run-ledger')).toContainText('NOT RUN')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('runs all 134 EARTH method defaults through dedicated workers', async ({ page }) => {
  test.setTimeout(180_000)
  await gotoRoute(page, '/earth/programs')
  await expect(page.getByTestId('program-registry-statement')).toBeVisible()

  const workerAudit = await page.evaluate(async () => {
    const [{ runEarthMethodInWorker }, engine] = await Promise.all([
      import('/src/earth/runSimulation.ts'),
      import('/src/engine/earth/index.ts'),
    ])
    const methods = engine.SUPPORTED_EARTH_SIMULATION_IDS.flatMap((programId) => (
      engine.listEarthMethods(programId).map((method) => ({ programId, method }))
    ))
    const failures: Array<{ id: string; methodId: string; error: string }> = []
    let cursor = 0

    async function run(): Promise<void> {
      while (cursor < methods.length) {
        const entry = methods[cursor++]
        if (!entry) continue
        try {
          const execution = await runEarthMethodInWorker(entry.programId, entry.method.id, entry.method.defaultInputs)
          if (execution.status !== 'completed' || execution.programId !== entry.programId || execution.methodId !== entry.method.id) {
            failures.push({ id: entry.programId, methodId: entry.method.id, error: execution.status })
          }
        } catch (reason) {
          failures.push({ id: entry.programId, methodId: entry.method.id, error: reason instanceof Error ? reason.message : String(reason) })
        }
      }
    }

    await Promise.all(Array.from({ length: 8 }, run))
    return { tested: methods.length, failures }
  })

  expect(workerAudit.tested).toBe(134)
  expect(workerAudit.failures).toEqual([])
})

test('renders the program registry without horizontal overflow on a narrow route', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoRoute(page, '/earth/programs')

  await expect(page.getByRole('heading', { name: 'EARTH Program Registry' })).toBeVisible()
  await expect(page.getByTestId('simulation-search')).toBeVisible()
  await expect(page.getByTestId('simulation-advanced-filters')).not.toHaveAttribute('open', '')
  await expect(page.getByTestId('simulation-grid').locator('.earth-program-row')).toHaveCount(36)
  await expect(page.locator('.program-ledger-key').first()).toBeHidden()
  await expect(page.locator('.earth-program-row').first().locator('.status-chip')).toHaveCount(0)
  await page.getByTestId('simulation-advanced-filters').locator('summary').click()
  await expect(page.getByTestId('simulation-runtime')).toBeVisible()
  const firstRowBox = await page.locator('.earth-program-row').first().boundingBox()
  expect(firstRowBox?.width).toBeLessThanOrEqual(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('audits authenticated EARTH dataset metadata without claiming G0b passed', async ({ page }) => {
  await gotoRoute(page, '/earth/datasets')

  await expect(page.getByRole('heading', { name: 'EARTH Dataset Ledger' })).toBeVisible()
  await expect(page.getByTestId('dataset-grid').locator('.dataset-record')).toHaveCount(19)
  await expect(page.getByTestId('dataset-grid').locator('.dataset-record[open]')).toHaveCount(0)
  await expect(page.getByTestId('disputed-claims').locator('.disputed-claim')).toHaveCount(4)
  await expect(page.getByTestId('dataset-summary')).toContainText('19 metadata-authenticated records')
  await expect(page.getByTestId('dataset-summary')).toContainText('0 acquired / 0 frozen')
  await expect(page.getByTestId('dataset-summary')).toContainText('G0b 0/19 passed')
  await expect(page.getByTestId('dataset-summary')).toContainText('10 pending / 9 blocked')
  await expect(page.getByTestId('dataset-summary')).toContainText('1 controlled-handling record')
  await expect(page.getByTestId('dataset-authentication-note')).toContainText('METADATA AUTHENTICATION ≠ SCIENTIFIC VALIDATION')
  await expect(page.locator('#primary-navigation a[href="/evidence"]')).toHaveClass(/router-link-active/)
  await expect(page.locator('.earth-local-nav a[href="/earth/datasets"]')).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('G0b passed true', { exact: true })).toHaveCount(0)
  await expect(page.locator('.dataset-record').first()).toContainText('JARVIS-DFT 3D')

  await page.getByTestId('dataset-sort').selectOption('name')
  await expect(page).toHaveURL(/\/earth\/datasets\?sort=name$/)
  await expect(page.locator('.dataset-record').first()).toContainText('AME2020 and NUBASE2020')
  await page.getByTestId('dataset-clear-filters').click()
  await expect(page).toHaveURL(/\/earth\/datasets$/)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId('dataset-search').fill('EEG Motor')
  await expect(page).toHaveURL(/\/earth\/datasets\?q=EEG\+Motor$/)
  await expect(page.getByTestId('dataset-result-count')).toContainText('1 of 19 records')
  const eeg = page.getByTestId('dataset-earth-dataset-eeg-motor-movement-imagery-dataset')
  await eeg.locator('summary').click()
  await expect(eeg).toHaveAttribute('open', '')
  await expect(eeg).toContainText('2 declared methods · 1 runnable · 1 unavailable source formulation')
  await expect(eeg).toContainText('Assignment not frozen')
  await expect(eeg).not.toContainText('available method contexts')
  const sourceLink = eeg.locator('.dataset-external-links a').first()
  await expect(sourceLink).toHaveAttribute('target', '_blank')
  await expect(sourceLink).toHaveAttribute('aria-label', /Open source 1 .* in a new tab/)
  await expect(eeg.locator('.dataset-terms-link')).toHaveAttribute('aria-label', /Open terms .* in a new tab/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

  await page.goto('/earth/programs')
  await page.goBack()
  await expect(page).toHaveURL(/\/earth\/datasets\?q=EEG\+Motor$/)
  await expect(page.getByTestId('dataset-search')).toHaveValue('EEG Motor')
  await page.getByTestId('dataset-clear-filters').click()
  await expect(page.getByTestId('dataset-grid').locator('.dataset-record')).toHaveCount(19)
})

test('navigates compact EARTH evidence from program sources to query-filtered dataset context', async ({ page }) => {
  const requested: string[] = []
  page.on('request', (request) => requested.push(new URL(request.url()).pathname))
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoRoute(page, '/earth/programs/EARTH-PRT-001')

  await expect(page.getByTestId('program-evidence-summary')).toContainText('Formula records')
  await expect(page.getByTestId('program-evidence-summary')).toContainText('30')
  await expect(page.getByTestId('program-evidence-records').locator('article')).toHaveCount(18)
  await expect(page.getByTestId('program-dataset-requirements')).toContainText('Dataset-to-method assignment is not frozen')
  await expect(page.getByTestId('program-dataset-requirements').getByRole('link', { name: 'CODATA recommended values' })).toBeVisible()
  expect(requested.filter((path) => path.includes('/earth/evidence/programs/'))).toEqual(['/data/generated/earth/evidence/programs/EARTH-PRT-001.json'])
  expect(requested.some((path) => path.endsWith('/scientific-coverage.json'))).toBe(false)

  await page.getByTestId('program-dataset-requirements').getByRole('link', { name: 'CODATA recommended values' }).click()
  await expect(page).toHaveURL(/\/earth\/datasets\?dataset=earth-dataset-codata-recommended-values&program=EARTH-PRT-001$/)
  await expect(page.getByTestId('dataset-grid').locator('.dataset-record')).toHaveCount(1)
  await expect(page.getByTestId('dataset-program')).toHaveValue('EARTH-PRT-001')
  await expect(page.getByTestId('dataset-method-policy')).toContainText('DATASET-TO-METHOD ASSIGNMENT IS NOT FROZEN')
  await page.locator('.dataset-record summary').click()
  await expect(page.locator('.dataset-program-context')).toContainText('declared methods')
  await expect(page.locator('.dataset-program-context')).toContainText('runnable')
  await expect(page.locator('.dataset-assignment-warning')).toContainText('Assignment not frozen')
  await expect(page.locator('.dataset-program-context')).not.toContainText('available method contexts')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('shows source caveat and PWA manifest/service-worker evidence', async ({ page, request }) => {
  await gotoRoute(page, '/sources')
  await expect(page.getByTestId('completion-registry-ready')).toBeVisible()
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

for (const width of [320, 390, 768, 1440]) {
  test(`keeps the EARTH routes operable without document overflow at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width, height: 900 })
    await gotoRoute(page, '/earth')
    await expect(page.getByRole('heading', { name: 'EARTH Evidence Dossier' })).toBeVisible()
    await expectNoDocumentOverflow(page)

    await page.goto('/earth/programs')
    await expect(page.getByRole('heading', { name: 'EARTH Program Registry' })).toBeVisible()
    const programSearch = page.getByLabel('Search programs')
    await programSearch.fill('EARTH-PLAN-008')
    await expect(page.getByTestId('simulation-record-EARTH-PLAN-008')).toBeVisible()
    await expectNoDocumentOverflow(page)
    await page.getByTestId('simulation-record-EARTH-PLAN-008').click()

    await expect(page.getByRole('heading', { name: 'Atmospheric scale-height audit' })).toBeVisible()
    if (width <= 760) {
      await expect(page.getByTestId('simulation-method-select')).toBeVisible()
      await page.getByTestId('simulation-method-select').selectOption('earth-source-reproduction-v1')
    } else {
      await page.locator('.workbench-method-disclosure summary').click()
      const sourceMethod = page.getByRole('radio', { name: /EARTH atmospheric density-coherence transform/ })
      await expect(sourceMethod).toBeVisible()
      await sourceMethod.check()
    }
    await expect(page.getByTestId('simulation-input-surfaceMassDensityKgPerCubicMetre')).toBeVisible()
    await expect(page.getByTestId('workbench-run')).toBeEnabled()
    await expectNoDocumentOverflow(page)

    await page.goto('/earth/datasets')
    await expect(page.getByRole('heading', { name: 'EARTH Dataset Ledger' })).toBeVisible()
    await page.getByLabel('Search evidence ledger').fill('EEG Motor')
    const dataset = page.getByTestId('dataset-earth-dataset-eeg-motor-movement-imagery-dataset')
    await dataset.locator('summary').click()
    await expect(dataset).toHaveAttribute('open', '')
    await expectNoDocumentOverflow(page)

    await page.goto('/earth/corpus')
    await expect(page.getByRole('heading', { name: 'EARTH Source Index' })).toBeVisible()
    await page.getByLabel('Search locked corpus').fill('Universal Genetic Code')
    await expect(page.getByRole('link', { name: /Universal Genetic Code/ })).toBeVisible()
    await expectNoDocumentOverflow(page)
  })
}
