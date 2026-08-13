import { expect, test } from '@playwright/test'

test('disabled deployment omits ONELAB navigation and route', async ({ page }) => {
  await page.goto('/labs')
  await expect(page.getByTestId('app-ready')).toBeVisible()
  await expect(page.getByTestId('onelab-nav')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Browser ONELAB' })).toHaveCount(0)

  await page.goto('/labs/onelab')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Browser microstrip proof' })).toHaveCount(0)
  await expect(page.getByTestId('onelab-warm')).toHaveCount(0)
})
