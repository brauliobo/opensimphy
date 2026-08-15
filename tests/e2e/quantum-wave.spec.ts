import { expect, test } from '@playwright/test'

test.describe('Quantum Wave Lab', () => {
  test('walks the source sequence through the interactive instruments', async ({ page }) => {
    await page.goto('/labs/quantum-wave')
    await expect(page.getByTestId('quantum-wave-lab-ready')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Why does physics need i?' })).toBeVisible()
    await expect(page.locator('.quantum-lab-section > .quantum-instrument')).toHaveCount(8)

    await page.getByTestId('spectrum-prediction').getByLabel('Shorter').check()
    await page.getByTestId('spectrum-reveal').click()
    await expect(page.getByTestId('spectrum-result')).toContainText('656')
    await expect(page.getByTestId('spectrum-result').locator('table tbody tr')).toHaveCount(5)

    await page.getByTestId('complex-real-mode').click()
    await expect(page.getByTestId('complex-result')).toContainText('real')
    await page.getByTestId('probability-coherent').uncheck()
    await expect(page.getByTestId('probability-result')).toContainText('Coherent: no')

    await page.getByRole('link', { name: /frame map/i }).click()
    await expect(page).toHaveURL(/#quantum-source-map$/)
    await expect(page.getByRole('heading', { name: 'The frame map behind this lab' })).toBeVisible()
  })

  test('reflows at a narrow viewport without page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto('/labs/quantum-wave')
    await expect(page.getByTestId('quantum-wave-lab-ready')).toBeVisible()
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
    await expect(page.getByRole('heading', { name: 'Why does physics need i?' })).toBeVisible()
    await expect(page.getByRole('link', { name: /back to all laboratories/i })).toBeVisible()
  })
})
