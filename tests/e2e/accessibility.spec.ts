import { expect, test, type Locator, type Page } from '@playwright/test'

async function expectTargetSize(locator: Locator): Promise<void> {
  const box = await locator.boundingBox()
  expect(box, 'control should have a rendered target').not.toBeNull()
  expect(box!.height).toBeGreaterThanOrEqual(44)
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))).toEqual(expect.objectContaining({
    clientWidth: expect.any(Number),
    scrollWidth: expect.any(Number),
  }))
  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
}

test('manages mobile navigation and route heading focus without stealing initial focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/earth')
  await expect(page.getByTestId('app-ready')).toBeVisible()
  const initialHeading = page.getByRole('heading', { name: 'EARTH Evidence Dossier' })
  await expect(initialHeading).toBeVisible()
  await expect(initialHeading).not.toBeFocused()

  const toggle = page.getByTestId('nav-toggle')
  await expect(toggle).toHaveAttribute('aria-controls', 'primary-navigation')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#primary-navigation a').first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toBeFocused()

  await page.locator('.earth-local-nav').getByRole('link', { name: '03/C Programs · 130', exact: true }).click()
  const programsHeading = page.getByRole('heading', { name: 'EARTH Program Registry' })
  await expect(programsHeading).toBeFocused()
  await expect(programsHeading).toHaveAttribute('tabindex', '-1')

  const search = page.getByLabel('Search programs')
  await search.fill('EARTH-PLAN-008')
  await expect(search).toBeFocused()
  await expect(page).toHaveURL(/q=EARTH-PLAN-008/)
})

test('supports labeled method controls, native keyboard selection, status text, and validation descriptions', async ({ page }) => {
  await page.goto('/earth/programs/EARTH-PLAN-008')
  await expect(page.getByRole('heading', { name: 'Atmospheric scale-height audit' })).toBeVisible()

  const workbench = page.locator('.simulation-workbench-section')
  await expect(workbench).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByRole('group', { name: 'Execution methods' })).toBeVisible()
  await expect(page.getByLabel('Selected execution method')).toHaveCount(1)

  const traditional = page.getByRole('radio', { name: /Standard isothermal hydrostatic scale-height baseline/ })
  const source = page.getByRole('radio', { name: /EARTH atmospheric density-coherence transform/ })
  await expect(traditional).toBeChecked()
  await traditional.focus()
  await page.keyboard.press('ArrowUp')
  await expect(source).toBeChecked()
  await expect(page).toHaveURL(/method=earth-source-reproduction-v1/)

  const density = page.getByTestId('simulation-input-surfaceMassDensityKgPerCubicMetre')
  const descriptionId = await density.getAttribute('aria-describedby')
  expect(descriptionId).toBeTruthy()
  await expect(page.locator(`#${descriptionId}`)).toContainText('Default:')
  await expect(density).toHaveAttribute('aria-invalid', 'false')
  await expect(page.getByTestId('simulation-status')).toHaveAttribute('aria-live', 'polite')
  await expect(page.getByTestId('simulation-status')).toContainText('idle')
  await expect(page.getByTestId('simulation-grid')).toHaveCount(0)

  await expectTargetSize(source.locator('xpath=..'))
  await expectTargetSize(page.getByTestId('simulation-run-control'))
  await expectTargetSize(page.getByTestId('simulation-advanced-inputs').locator('summary'))
  await expectTargetSize(page.getByTestId('simulation-source-links').locator('a').first())
})

test('operates disclosures and keeps changing ledgers outside live regions', async ({ page }) => {
  await page.goto('/earth/programs')
  await expect(page.getByRole('heading', { name: 'EARTH Program Registry' })).toBeVisible()
  await expect(page.getByTestId('simulation-grid')).not.toHaveAttribute('aria-live')
  await expect(page.getByTestId('simulation-result-count')).toHaveAttribute('aria-live', 'polite')

  const facets = page.getByTestId('simulation-advanced-filters')
  const facetsSummary = facets.locator('summary')
  await facetsSummary.focus()
  await page.keyboard.press('Enter')
  await expect(facets).toHaveAttribute('open', '')
  await expectTargetSize(facetsSummary)
  await expectTargetSize(page.getByLabel('Runtime availability'))
  await expectTargetSize(page.getByRole('button', { name: 'Next registry page' }))

  await page.goto('/earth/datasets?q=EEG+Motor')
  await expect(page.getByRole('heading', { name: 'EARTH Dataset Ledger' })).toBeVisible()
  await expect(page.getByTestId('dataset-grid')).not.toHaveAttribute('aria-live')
  await expect(page.getByTestId('dataset-result-count')).toHaveAttribute('aria-live', 'polite')
  const record = page.getByTestId('dataset-earth-dataset-eeg-motor-movement-imagery-dataset')
  const summary = record.locator('summary')
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(record).toHaveAttribute('open', '')
  await expectTargetSize(summary)
  await expectTargetSize(record.locator('.dataset-external-links a').first())
})

test('renders locked reading mode without executable or image content', async ({ page }) => {
  await page.goto('/earth/corpus')
  await page.getByLabel('Search locked corpus').fill('Universal Genetic Code')
  await page.getByRole('link', { name: /Universal Genetic Code/ }).click()
  await expect(page.getByTestId('earth-document-reading')).toBeVisible()
  await expect(page.locator('.earth-reading-panel script, .earth-reading-panel img')).toHaveCount(0)
  await expect(page.getByText('TEXT-ONLY / NO EXECUTION')).toBeVisible()
})

test('reflows at the CSS viewport equivalent of 200% zoom', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 })
  await page.goto('/earth/programs/EARTH-PLAN-008')
  await expect(page.getByRole('heading', { name: 'Atmospheric scale-height audit' })).toBeVisible()
  await expectNoDocumentOverflow(page)
  await expect(page.getByTestId('simulation-run-control')).toBeVisible()

  await page.goto('/earth/datasets')
  await expect(page.getByRole('heading', { name: 'EARTH Dataset Ledger' })).toBeVisible()
  await expectNoDocumentOverflow(page)
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('honors the reduced-motion media feature', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/earth')
    await expect(page.getByRole('heading', { name: 'EARTH Evidence Dossier' })).toBeVisible()
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
    expect(await page.locator('html').evaluate((element) => getComputedStyle(element).scrollBehavior)).toBe('auto')
  })
})
