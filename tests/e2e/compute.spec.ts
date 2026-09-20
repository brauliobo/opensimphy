import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

test('Compute lab evaluates Planck mass over Planck time squared into spring-constant interpretations', async ({ page }) => {
  await page.goto('/labs/compute')
  await expect(page.getByTestId('app-ready')).toBeVisible()
  await expect(page.getByTestId('compute-lab-ready')).toBeVisible()

  await page.getByTestId('compute-example').first().click()
  await expect(page.getByTestId('compute-dimensions')).toContainText('[mass][time]^{-2}')
  await expect(page.getByTestId('compute-si-unit')).toContainText('kg s^-2')
  await expect(page.getByTestId('compute-interpretations')).toContainText('spring constant')
  await expect(page.getByTestId('compute-interpretations')).toContainText('surface tension')
  await expect(page.getByTestId('compute-interpretations')).toContainText('These names share this dimension')
})

test('Tour lesson and Gray lab embed the prompt without a Plotly host', async ({ page }) => {
  await page.goto('/tour/units/physical-quantities')
  await expect(page.getByTestId('tour-lesson-ready')).toBeVisible()
  await expect(page.getByTestId('compute-prompt')).toBeVisible()
  await expect(page.getByTestId('compute-plot')).toHaveCount(0)

  await page.goto('/labs/edwin-gray')
  await expect(page.getByTestId('edwin-gray-lab-ready')).toBeVisible()
  await expect(page.getByTestId('compute-prompt')).toBeVisible()
  await expect(page.getByTestId('compute-plot')).toHaveCount(0)
})
