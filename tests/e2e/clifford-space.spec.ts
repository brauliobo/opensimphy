import { expect, test } from '@playwright/test'

test.describe('Clifford Space Lab', () => {
  test('shows the honeycomb instrument, origin scalar, and tiling mode', async ({ page }) => {
    await page.goto('/labs/clifford-space')
    await expect(page.getByTestId('clifford-space-lab-ready')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'What fills space around the unit cube?' })).toBeVisible()
    await expect(page.getByTestId('clifford-canvas')).toBeVisible()
    await expect(page.locator('[data-testid^="basis-bar-"]')).toHaveCount(8)
    await expect(page.getByTestId('basis-norm')).toContainText('1.0000')

    await page.getByTestId('go-origin').click()
    await expect(page.getByTestId('principal-combination')).toContainText('1.0000')

    await page.getByRole('tab', { name: 'Tiling of space' }).click()
    await expect(page.getByRole('tab', { name: 'Tiling of space' })).toHaveAttribute('aria-selected', 'true')

    await page.getByRole('link', { name: /back to all laboratories/i }).click()
    await expect(page).toHaveURL(/\/labs$/)
  })

  test('reflows at a narrow viewport without page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto('/labs/clifford-space')
    await expect(page.getByTestId('clifford-space-lab-ready')).toBeVisible()
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
    await expect(page.getByRole('heading', { name: 'What fills space around the unit cube?' })).toBeVisible()
    await expect(page.getByRole('link', { name: /back to all laboratories/i })).toBeVisible()
  })
})
