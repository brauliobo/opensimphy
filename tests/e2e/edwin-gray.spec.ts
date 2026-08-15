import { expect, test } from '@playwright/test'

test.describe('Edwin Gray Motor Lab', () => {
  test('walks the reconstructed machines through the interactive instruments', async ({ page }) => {
    await page.goto('/labs/edwin-gray')
    await expect(page.getByTestId('edwin-gray-lab-ready')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'What did the purple motor actually switch?' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Motor Edwin Gray' })).toBeVisible()
    await expect(page.getByText(/Uploader: Rogerio Polenta\. Uploaded 2026-08-11/)).toBeVisible()
    await expect(page.locator('.quantum-lab-header__source')).toContainText('1:16:08')
    await expect(page.locator('.quantum-lab-section > .quantum-instrument')).toHaveCount(5)
    await expect(page.locator('table')).toHaveCount(6)
    await expect(page.locator('table caption')).toHaveCount(6)

    await expect(page.getByTestId('gray-patent-topology')).toContainText('9 stator pair stations')
    await expect(page.getByTestId('gray-event-schedule').locator('tbody tr')).toHaveCount(27)
    await expect(page.getByTestId('gray-event-schedule').locator('caption')).toContainText('27-event schedule')
    await expect(page.getByTestId('gray-fem-status')).toContainText('FEM status: not-run')
    await expect(page.getByTestId('gray-fem-status')).toContainText('FEAScript is not a magnetic solver')
    await expect(page.getByTestId('gray-fem-status').getByRole('link', { name: /fem\/edwin-gray provenance/i })).toHaveAttribute('href', 'https://github.com/brauliobo/opensimphy/blob/main/fem/edwin-gray/README.md')

    const claim = page.getByTestId('gray-claim-reproduction')
    await expect(claim).toContainText('26.8 W in / 7,460 W out / displayed COP 282')
    await expect(claim.getByTestId('gray-claim-arithmetic-cop')).toHaveText('278.36')
    await expect(claim.getByTestId('gray-claim-mismatch')).toHaveText('+3.64 COP')
    await expect(claim.getByTestId('gray-claim-deficit')).toHaveText('7433.2 W')
    await expect(claim.getByTestId('gray-claim-target-output')).toHaveText('7557.6 W')
    await expect(claim.getByTestId('gray-claim-closed-cop')).toHaveText('1.00')
    await expect(page.getByTestId('gray-system-cop')).toHaveText('Unavailable / inconclusive')

    await expect(page.getByTestId('gray-original-evidence')).toContainText('minimum of 500 RPM')
    await expect(page.getByTestId('gray-modified-evidence')).toContainText('AWG 14 wire')
    await expect(page.getByTestId('gray-modified-evidence')).toContainText('10 kilowatts')
    await expect(page.getByTestId('gray-recovery-evidence')).toContainText('Recovery remains unknown')
    await expect(page.getByTestId('gray-recovery-evidence')).toContainText('values remain unknown')

    await page.getByTestId('gray-geometry-motor').selectOption('black')
    await expect(page.getByTestId('gray-geometry-result')).toContainText('1 stator')

    await page.getByTestId('gray-pulse-rpm').fill('120')
    await expect(page.getByTestId('gray-pulse-status')).toContainText('unquenched dump')
    await expect(page.getByTestId('gray-pulse-status')).toHaveAttribute('role', 'status')

    await page.getByRole('link', { name: /frame map/i }).click()
    await expect(page).toHaveURL(/#gray-source-map$/)
    await expect(page.getByRole('heading', { name: 'The frame map behind this lab' })).toBeVisible()
    await expect(page.locator('#gray-source-map')).toHaveCount(1)
    await expect(page.locator('#gray-source-map iframe')).toHaveCount(0)
    await page.getByText('Optional source video player', { exact: true }).click()
    await expect(page.getByTestId('gray-video-activate')).toBeVisible()
    await page.getByTestId('gray-video-activate').click()
    await expect(page.locator('#gray-source-map iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/nC740fpBs4M/)
    await expect(page.locator('#gray-source-map').getByRole('status')).toContainText('loaded by user request')
  })

  test('reflows at a narrow viewport without page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto('/labs/edwin-gray')
    await expect(page.getByTestId('edwin-gray-lab-ready')).toBeVisible()
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
    await expect(page.getByRole('link', { name: /back to all laboratories/i })).toBeVisible()
  })

  test('disables spin-up animation under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/labs/edwin-gray')

    await page.getByTestId('gray-pulse-play').click()

    await expect(page.getByTestId('gray-pulse-motion-notice')).toContainText('Spin-up animation is disabled because reduced motion is preferred.')
    await expect(page.getByTestId('gray-pulse-play')).toHaveText('Spin up')
  })
})
