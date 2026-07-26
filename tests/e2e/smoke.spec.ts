import { expect, test } from '@playwright/test'

test('traverses the EARTH evidence and method journey', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/earth')
  await expect(page.getByTestId('app-ready')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'EARTH Evidence Dossier' })).toBeVisible()

  await page.locator('.earth-local-nav').getByRole('link', { name: '03/C Programs · 130', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'EARTH Program Registry' })).toBeVisible()
  await page.getByLabel('Search programs').fill('EARTH-PLAN-008')
  await page.getByTestId('simulation-record-EARTH-PLAN-008').click()

  await expect(page.getByRole('heading', { name: 'Atmospheric scale-height audit' })).toBeVisible()
  const method = page.getByLabel('Selected execution method')
  await method.selectOption('traditional-analytic-baseline-v1')
  await expect(page.getByTestId('simulation-input-temperatureKelvin')).toHaveValue('288.15')
  await expect(page.getByTestId('simulation-status')).toContainText('idle')

  await method.selectOption('earth-source-reproduction-v1')
  await expect(page.getByTestId('simulation-input-surfaceMassDensityKgPerCubicMetre')).toHaveValue('1.225')
  await expect(page.getByTestId('method-provenance')).toContainText('earth source reproduction')
  await expect(page.getByTestId('simulation-status')).toContainText('idle')

  await page.locator('.earth-local-nav').getByRole('link', { name: '03/D Data · 19', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'EARTH Dataset Ledger' })).toBeVisible()
  await expect(page.getByLabel('Search evidence ledger')).toBeEditable()

  await page.locator('.earth-local-nav').getByRole('link', { name: '03/B Corpus · 63', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'EARTH Source Index' })).toBeVisible()
  await expect(page.getByLabel('Search locked corpus')).toBeEditable()
})
