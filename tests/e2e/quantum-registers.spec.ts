import { expect, test } from '@playwright/test'

test.describe('Quantum Register Lab', () => {
  test('walks 137-coin majority into alignment and named comparison instruments', async ({ page }) => {
    await page.goto('/labs/quantum-registers')
    await expect(page.getByTestId('quantum-registers-lab-ready')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Why 137 coins?' })).toBeVisible()
    await expect(page.locator('.quantum-lab-section > .quantum-instrument')).toHaveCount(6)
    await expect(page.getByTestId('majority-result')).toContainText('69 / 137')

    await page.getByTestId('majority-mode').selectOption('align')
    await expect(page.getByTestId('majority-result')).toContainText('Binomial commit P')
    await page.getByTestId('handshake-rule').selectOption('majority-phase')
    await expect(page.getByTestId('handshake-result')).toContainText('Majority phase alignment')

    await page.getByRole('link', { name: /back to all laboratories/i }).click()
    await expect(page).toHaveURL(/\/labs$/)
  })

  test('reflows at a narrow viewport without page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto('/labs/quantum-registers')
    await expect(page.getByTestId('quantum-registers-lab-ready')).toBeVisible()
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
    await expect(page.getByRole('heading', { name: 'Why 137 coins?' })).toBeVisible()
  })
})
