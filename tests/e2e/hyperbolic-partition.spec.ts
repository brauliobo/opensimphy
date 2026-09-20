import { expect, test } from '@playwright/test'

test.describe('Hyperbolic Partition Lab', () => {
  test('shows the explorer, physical roots, and all monastery tabs', async ({ page }) => {
    await page.goto('/labs/hyperbolic-partition')
    await expect(page.getByTestId('hyperbolic-partition-lab-ready')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'How do four roots of T_a become an ideal tetrahedron?' })).toBeVisible()
    await expect(page.getByTestId('partition-canvas')).toBeVisible()
    await expect(page.getByTestId('root-zhe_1')).toBeVisible()
    await expect(page.getByTestId('vieta-product')).toContainText('6.28')

    await page.getByTestId('tab-mobius').click()
    await expect(page.getByTestId('mobius-unique')).toContainText('6 distinct λ')

    await page.getByTestId('tab-cross-ratio').click()
    await expect(page.getByTestId('cross-ratio-count')).toContainText('6 values')

    await page.getByTestId('tab-monodromy').click()
    await expect(page.getByTestId('monodromy-cycle')).toBeVisible()

    await page.getByTestId('tab-riemann').click()
    await page.getByTestId('riemann-sub-planar').click()
    await expect(page.getByTestId('riemann-sub-planar')).toHaveAttribute('aria-selected', 'true')

    await page.getByRole('link', { name: /back to all laboratories/i }).click()
    await expect(page).toHaveURL(/\/labs$/)
  })

  test('reflows at a narrow viewport without page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto('/labs/hyperbolic-partition')
    await expect(page.getByTestId('hyperbolic-partition-lab-ready')).toBeVisible()
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
    await expect(page.getByRole('heading', { name: 'How do four roots of T_a become an ideal tetrahedron?' })).toBeVisible()
    await expect(page.getByRole('link', { name: /back to all laboratories/i })).toBeVisible()
  })
})
