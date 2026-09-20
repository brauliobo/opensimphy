import { expect, test } from '@playwright/test'

test('deployment includes the ONELAB laboratory route', async ({ page }) => {
  await page.goto('/labs')
  await expect(page.getByTestId('app-ready')).toBeVisible()
  await expect(page.getByTestId('onelab-nav')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Browser ONELAB' })).toBeVisible()

  await page.goto('/labs/onelab')
  await expect(page).toHaveURL(/\/labs\/onelab$/)
  await expect(page.getByRole('heading', { name: 'Browser ONELAB workbench' })).toBeVisible()
  await expect(page.getByTestId('onelab-warm')).toBeVisible()
})
