import { expect, test } from '@playwright/test'

test.describe('Edwin Gray Workbench', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/labs/edwin-gray')
    await expect(page.getByTestId('edwin-gray-lab-ready')).toBeVisible()
    await expect(page.getByTestId('gray-workbench')).toBeVisible()
    await expect(page.getByTestId('gray-workbench').locator('[data-status="completed"]')).toBeVisible()
  })

  test('runs one canonical event train and marks its result stale on URL-owned input changes', async ({ page }) => {
    await expect(page.getByTestId('gray-shared-timeline')).toContainText('Event 1 / 27')
    await expect(page.getByTestId('gray-event-timeline').locator('tbody tr')).toHaveCount(27)
    await expect(page.getByTestId('gray-run-ledger')).toBeVisible()
    await expect(page.getByTestId('gray-structured-findings')).toContainText('validatesTheory: false')
    await expect(page.getByTestId('gray-claim-reproduction')).toContainText('explicitly separate')
    await expect(page.getByTestId('gray-retained-cop-evidence')).toContainText('COP 282')
    await expect(page.getByTestId('gray-retained-cop-evidence')).toContainText('Absent')

    await page.getByTestId('gray-revolutions').fill('2')
    await expect(page.getByTestId('gray-stale')).toBeVisible()
    await expect(page).toHaveURL(/grayRevolutions=2/)
    await page.getByTestId('gray-run').click()
    await expect(page.getByTestId('gray-workbench').locator('[data-status="completed"]')).toBeVisible()
    await expect(page.getByTestId('gray-stale')).toHaveCount(0)
    await expect(page.getByTestId('gray-event-timeline').locator('tbody tr')).toHaveCount(54)
    await expect(page.getByTestId('gray-shared-timeline')).toContainText('Event 1 / 54')
  })

  test('shares the active event across rotor, circuit, and timeline panels', async ({ page }) => {
    await page.getByTestId('gray-event-slider').fill('2')

    await expect(page.getByTestId('gray-geometry-status')).toContainText('event 3')
    await expect(page.getByTestId('gray-pulse-status')).toContainText('Event 3')
    await expect(page.getByTestId('gray-event-timeline').locator('tbody tr.is-active')).toHaveCount(1)
    await expect(page.getByTestId('gray-circuit-table')).toBeVisible()
  })

  test('fails closed when the selected machine has no compatible FEM lookup', async ({ page }) => {
    await expect(page.getByTestId('gray-fem-runtime-status')).toHaveAttribute('data-state', 'unavailable')
    await expect(page.getByTestId('gray-magnetic-model').locator('option[value="fem-lookup"]')).toHaveAttribute('disabled', '')

    await page.getByTestId('gray-machine-contract').selectOption('patent-3890548-illustrative')
    await expect(page.getByTestId('gray-fem-runtime-status')).not.toHaveAttribute('data-state', 'ready')
    await expect(page.getByTestId('gray-magnetic-model')).toHaveValue('illustrative-surrogate')
    await expect(page.getByTestId('gray-fem-status')).toContainText('never relabeled FEM')

    await page.getByTestId('gray-machine-contract').selectOption('edwin-gray-gold')
    await expect(page.getByTestId('gray-fem-runtime-status')).toHaveAttribute('data-state', 'unavailable')
    await expect(page.getByTestId('gray-fem-runtime-status')).toContainText('No prototype-specific geometry')
  })

  test('visibly rejects invalid and future URL revisions', async ({ page }) => {
    await page.goto('/labs/edwin-gray?grayRevision=2')
    await expect(page.getByTestId('gray-revision-error')).toContainText('supports revision 1')
    await expect(page.getByTestId('gray-run')).toBeDisabled()

    await page.goto('/labs/edwin-gray?grayRevision=invalid')
    await expect(page.getByTestId('gray-revision-error')).toContainText('Unsupported Gray workbench input revision')
  })

  test('saves and compares revisioned snapshots', async ({ page }) => {
    await page.getByTestId('gray-snapshot-save').click()
    await page.getByTestId('gray-load').fill('0.02')
    await page.getByTestId('gray-run').click()
    await expect(page.getByTestId('gray-workbench').locator('[data-status="completed"]')).toBeVisible()
    await page.getByTestId('gray-snapshot-save').click()

    const rows = page.getByTestId('gray-snapshot-table').locator('tbody tr')
    await expect(rows).toHaveCount(2)
    await rows.nth(0).getByRole('checkbox').check()
    await rows.nth(1).getByRole('checkbox').check()
    await expect(page.getByTestId('gray-snapshot-comparison')).toContainText('Compatible comparison')
    await expect(page.getByTestId('gray-comparison-inputs')).toContainText('loadTorqueNm')
    await expect(page.getByTestId('gray-comparison-deltas')).toBeVisible()
  })

  test('preserves the local source lesson and optional external media gate', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'What did the purple motor actually switch?' })).toBeVisible()
    await expect(page.getByTestId('gray-original-evidence')).toContainText('minimum of 500 RPM')
    await page.getByRole('link', { name: /frame map/i }).click()
    await expect(page.locator('#gray-source-map iframe')).toHaveCount(0)
    await page.getByText('Optional source video player', { exact: true }).click()
    await page.getByTestId('gray-video-activate').click()
    await expect(page.locator('#gray-source-map iframe')).toHaveAttribute('src', /youtube-nocookie\.com/)
  })

  test('reflows at a narrow viewport and disables animation for reduced motion', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await expect(page.getByTestId('gray-workbench').locator('[data-status="completed"]')).toBeVisible()
    await page.getByTestId('gray-timeline-play').click()
    await expect(page.getByTestId('gray-motion-notice')).toContainText('reduced motion')
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
  })
})
