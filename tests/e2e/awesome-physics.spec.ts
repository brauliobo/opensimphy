import { expect, test } from '@playwright/test'

test('loads the Awesome Physics catalog with deterministic counts and an accessible footer link', async ({ page }) => {
  await page.goto('/awesome-physics')

  await expect(page.getByTestId('app-ready')).toBeVisible()
  await expect(page.getByTestId('awesome-physics-catalog-ready')).toBeVisible()
  await expect(page.getByTestId('awesome-catalog-counts')).toContainText('Catalog records86')
  await expect(page.getByTestId('awesome-catalog-counts')).toContainText('Projects + archive76')
  await expect(page.getByTestId('awesome-catalog-counts')).toContainText('Organizations10')
  await expect(page.locator('.awesome-catalog-card')).toHaveCount(86)
  await expect(page.getByTestId('awesome-catalog-run')).toHaveCount(13)
  await expect(page.getByTestId('footer-awesome-physics')).toHaveAttribute('href', '/awesome-physics')
})

test('navigates to an available detail with Run and an unavailable detail without Run', async ({ page }) => {
  await page.goto('/awesome-physics')
  await expect(page.getByTestId('awesome-physics-catalog-ready')).toBeVisible()

  await page.getByTestId('awesome-catalog-card-awesome-matter-js').getByRole('link', { name: 'Open detail ->' }).click()
  await expect(page).toHaveURL(/\/awesome-physics\/awesome-matter-js$/)
  await expect(page.getByTestId('awesome-physics-detail-ready')).toBeVisible()
  await expect(page.getByTestId('awesome-physics-run-panel')).toBeVisible()
  await expect(page.getByTestId('awesome-physics-run')).toBeVisible()

  await page.goto('/awesome-physics/awesome-bullet3')
  await expect(page.getByTestId('awesome-physics-detail-ready')).toBeVisible()
  await expect(page.getByTestId('awesome-physics-no-run')).toBeVisible()
  await expect(page.getByTestId('awesome-physics-run-panel')).toHaveCount(0)
  await expect(page.getByTestId('awesome-physics-run')).toHaveCount(0)
})
