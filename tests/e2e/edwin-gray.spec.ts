import { expect, test, type Page } from '@playwright/test'

const reflowViewports = [
  { width: 1440, height: 900, label: 'desktop' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 640, height: 900, label: '200% equivalent' },
  { width: 390, height: 844, label: 'mobile' },
  { width: 320, height: 900, label: '400% equivalent' },
] as const

async function expectContainedReflow(page: Page, expectScrollableTable: boolean): Promise<void> {
  const layout = await page.evaluate(() => {
    const root = document.documentElement
    const tableScrollers = [...document.querySelectorAll<HTMLElement>('.gray-table-scroll')]
      .filter((element) => element.offsetParent !== null)
      .map((element) => {
        const bounds = element.getBoundingClientRect()
        return {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          left: bounds.left,
          right: bounds.right,
        }
      })
    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      tableScrollers,
    }
  })

  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1)
  expect(layout.tableScrollers.length).toBeGreaterThan(0)
  for (const scroller of layout.tableScrollers) {
    expect.soft(scroller.left).toBeGreaterThanOrEqual(-1)
    expect.soft(scroller.right).toBeLessThanOrEqual(layout.clientWidth + 1)
  }
  if (expectScrollableTable) {
    expect(layout.tableScrollers.some((scroller) => scroller.scrollWidth > scroller.clientWidth + 1)).toBe(true)
  }
}

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
    await expect(page.getByTestId('gray-event-timeline').locator('tbody tr.is-active')).toHaveAttribute('aria-current', 'true')
    await expect(page.getByTestId('gray-event-timeline').locator('tbody tr.is-active')).toContainText('Current event:')
    await expect(page.getByTestId('gray-circuit-table')).toBeVisible()
  })

  test('uses one event live summary, silences autoplay, and associates worker progress', async ({ page }) => {
    const eventSummary = page.getByTestId('gray-event-summary')
    await expect(eventSummary).toHaveAttribute('role', 'status')
    await expect(eventSummary).toHaveAttribute('aria-live', 'polite')
    await expect(page.getByTestId('gray-geometry-instrument').locator('[role="status"]')).toHaveCount(0)
    await expect(page.getByTestId('gray-circuit-instrument').locator('[role="status"]')).toHaveCount(0)
    await expect(page.getByTestId('gray-pulse-instrument').locator('[role="status"]')).toHaveCount(0)

    const workerStatus = page.locator('#gray-worker-status')
    await expect(workerStatus).toHaveAttribute('role', 'status')
    await expect(workerStatus).toHaveAttribute('aria-live', 'polite')
    await expect(page.getByRole('progressbar', { name: 'Gray worker progress' })).toHaveAttribute(
      'aria-describedby',
      'gray-worker-status gray-worker-progress-value',
    )

    await page.getByTestId('gray-timeline-play').click()
    await expect(eventSummary).toHaveAttribute('aria-live', 'off')
    await expect(eventSummary).not.toContainText('Event 1 / 27')
    await page.getByTestId('gray-timeline-play').click()
    await expect(eventSummary).toHaveAttribute('aria-live', 'polite')
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

  test('reflows without document overflow and keeps wide tables contained', async ({ page }) => {
    for (const viewport of reflowViewports) {
      await test.step(viewport.label, async () => {
        await page.setViewportSize(viewport)
        await page.reload()
        await expect(page.getByTestId('gray-workbench').locator('[data-status="completed"]')).toBeVisible()
        await expectContainedReflow(page, viewport.width <= 768)
      })
    }
  })

  test('supports keyboard controls, visible focus, and 44px workbench targets', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await page.reload()
    await expect(page.getByTestId('gray-workbench').locator('[data-status="completed"]')).toBeVisible()
    const run = page.getByTestId('gray-run')
    await page.getByTestId('gray-revolutions').fill('2')
    await run.focus()
    await expect(run).toBeFocused()
    expect(await run.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('gray-workbench').locator('[data-status="completed"]')).toBeVisible()

    const slider = page.getByTestId('gray-event-slider')
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(slider).toHaveValue('1')
    await expect(page.getByTestId('gray-event-summary')).toContainText('Event 2 / 54')

    const vocabulary = page.getByText('Open the essential vocabulary', { exact: true })
    await vocabulary.focus()
    await page.keyboard.press('Space')
    await expect(vocabulary.locator('..')).toHaveAttribute('open', '')

    const media = page.getByText('Optional source video player', { exact: true })
    await media.focus()
    await page.keyboard.press('Enter')
    await expect(media.locator('..')).toHaveAttribute('open', '')

    const targets = await page.getByTestId('gray-workbench').locator('button, select, input').evaluateAll((elements) => elements
      .filter((element) => {
        const style = getComputedStyle(element)
        const bounds = element.getBoundingClientRect()
        return style.visibility !== 'hidden' && style.display !== 'none' && bounds.width > 0 && bounds.height > 0
      })
      .map((element) => {
        const bounds = element.getBoundingClientRect()
        return { name: element.getAttribute('data-testid') ?? element.tagName, width: bounds.width, height: bounds.height }
      }))
    for (const target of targets) {
      expect.soft(target.width, `${target.name} width`).toBeGreaterThanOrEqual(44)
      expect.soft(target.height, `${target.name} height`).toBeGreaterThanOrEqual(44)
    }
  })

  test('disables animation for reduced motion and preserves distinctions in forced colors', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await expect(page.getByTestId('gray-workbench').locator('[data-status="completed"]')).toBeVisible()
    await page.getByTestId('gray-timeline-play').click()
    await expect(page.getByTestId('gray-motion-notice')).toContainText('reduced motion')
    await expect(page.getByTestId('gray-event-slider')).toHaveValue('0')

    await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' })
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true)
    const forcedColorStyles = await page.evaluate(() => {
      const style = (selector: string) => getComputedStyle(document.querySelector<HTMLElement>(selector)!)
      return {
        assumptionBorder: style('.gray-assumption-label').borderLeftStyle,
        evidenceBorder: style('.gray-evidence-label').borderLeftStyle,
        originalBorder: style('[data-testid="gray-original-evidence"]').borderTopStyle,
        modifiedBorder: style('[data-testid="gray-modified-evidence"]').borderTopStyle,
        recoveryBorder: style('[data-testid="gray-recovery-evidence"]').borderTopStyle,
        statusBorder: style('.gray-status').borderLeftStyle,
        activeOutline: style('[data-testid="gray-event-timeline"] tr.is-active').outlineStyle,
        statorAdjustment: style('.gray-stator').forcedColorAdjust,
        statorFill: style('.gray-stator').fill,
        rotorAdjustment: style('.gray-rotor').forcedColorAdjust,
        rotorFill: style('.gray-rotor').fill,
        recoveryAdjustment: style('.gray-recovery').forcedColorAdjust,
        recoveryDash: style('.gray-recovery').strokeDasharray,
      }
    })
    expect(forcedColorStyles.evidenceBorder).toBe('solid')
    expect(forcedColorStyles.assumptionBorder).toBe('dashed')
    expect(forcedColorStyles.originalBorder).toBe('solid')
    expect(forcedColorStyles.modifiedBorder).toBe('double')
    expect(forcedColorStyles.recoveryBorder).toBe('dashed')
    expect(forcedColorStyles.statusBorder).toBe('solid')
    expect(forcedColorStyles.activeOutline).not.toBe('none')
    expect(forcedColorStyles.statorAdjustment).toBe('none')
    expect(forcedColorStyles.rotorAdjustment).toBe('none')
    expect(forcedColorStyles.recoveryAdjustment).toBe('none')
    expect(forcedColorStyles.statorFill).not.toBe(forcedColorStyles.rotorFill)
    expect(forcedColorStyles.recoveryDash).not.toBe('none')
    await expectContainedReflow(page, true)
  })
})
