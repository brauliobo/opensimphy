import { expect, test, type Page } from '@playwright/test'

const FULL_LESSON = '/tour/units/physical-quantities'
const QUICK_LESSON = `${FULL_LESSON}?path=quick`
const LESSON_SECTION_HASHES = ['#question', '#observe', '#explain', '#equation-ladder', '#try', '#interpret']

async function gotoLesson(page: Page, path = FULL_LESSON): Promise<void> {
  await page.goto(path)
  await expect(page.getByTestId('app-ready')).toBeVisible()
  await expect(page.getByTestId('tour-lesson-ready')).toBeVisible()
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
}

async function expectNoDocumentOverflowSoft(page: Page, path: string): Promise<void> {
  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect.soft(scrollWidth, `${path} should fit its ${clientWidth}px CSS viewport`).toBeLessThanOrEqual(clientWidth)
}

async function revealDimensionResult(page: Page, prediction: 'matches-target' | 'different-dimension' | 'operation-undefined'): Promise<void> {
  await page.getByTestId(`prediction-${prediction}`).check()
  await page.getByTestId('reveal-dimension-result').click()
  await expect(page.getByTestId('dimension-result')).toBeVisible()
}

async function expectResumeLink(page: Page, testId: 'nav-resume' | 'overview-resume' | 'saved-resume'): Promise<string> {
  const href = await page.getByTestId(testId).getAttribute('href')
  expect(href).toBeTruthy()
  const url = new URL(href!, 'http://opensimphy.test')
  expect(url.pathname).toBe(FULL_LESSON)
  expect(LESSON_SECTION_HASHES).toContain(url.hash)
  return href!
}

test('a first-time Guided user starts the only content-ready quick station', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('tour-ready')).toBeVisible()

  await expect(page.locator('.tour-station-tick')).toHaveCount(8)
  await expect(page.locator('.tour-station-link')).toHaveCount(1)
  await expect(page.locator('.topic-door, .formula-list, [data-testid="coverage-status"]')).toHaveCount(0)
  await expect(page.locator('.home-hero').getByTestId('reading-depth-guided')).toBeChecked()
  await page.getByTestId('begin-tour').click()

  await expect(page).toHaveURL(new RegExp(`${QUICK_LESSON.replace('?', '\\?')}$`))
  await expect(page.getByTestId('tour-lesson-ready')).toBeVisible()
  await expect(page.getByText('Quick station / 4 min', { exact: true })).toBeVisible()
  await expect(page.getByRole('main')).toHaveCount(1)
  await expect(page.locator('[data-tour-section]')).toHaveCount(6)
  await expect(page.locator('[data-tour-section] > .eyebrow')).toHaveText([
    '01 / Question',
    '02 / Observe',
    '03 / Explain',
    '04 / Equation ladder',
    '05 / Try',
    '06 / Interpret',
  ])
})

test('the prediction-first dimension builder distinguishes valid, mismatched-kind, and undefined presets', async ({ page }) => {
  await gotoLesson(page)
  await expect(page.getByTestId('reveal-dimension-result')).toBeDisabled()

  await page.getByTestId('preset-average-speed-from-path').click()
  await revealDimensionResult(page, 'matches-target')
  await expect(page.getByTestId('operation-status')).toHaveText('Defined')
  await expect(page.getByTestId('target-match')).toContainText('Dimensions match')
  await expect(page.getByTestId('coordinate-value')).toContainText('2 m/s')

  await page.getByTestId('preset-force-from-motion').click()
  await expect(page.getByTestId('operation-status')).toHaveText('Defined')
  await expect(page.getByTestId('target-match')).toContainText('Dimensions match')

  await page.getByTestId('preset-energy-or-torque').click()
  await expect(page.getByTestId('operation-status')).toHaveText('Defined')
  await expect(page.getByTestId('target-match')).toContainText('quantity-kind identity is not established')
  await expect(page.getByTestId('quantity-kind-caveat')).toContainText('energy and torque')

  await page.getByTestId('preset-unlike-sum').click()
  await expect(page.getByTestId('operation-status')).toContainText('Undefined')
  await expect(page.getByTestId('target-match')).toContainText('Not applicable')
  await expect(page.getByTestId('quantity-kind-caveat')).toContainText('cannot rescue')

  await page.getByTestId('preset-average-speed-from-path').click()
  await page.getByTestId('dimension-coordinate').selectOption('mechanical-cgs')
  await expect(page.getByTestId('coordinate-value')).toContainText('200 cm/s')
  await page.locator('.tour-lesson-controls').getByTestId('reading-depth-technical').check()
  await expect(page.getByTestId('dimension-magnitude')).toHaveValue('2')
  await page.getByTestId('dimension-magnitude').fill('3')
  await expect(page.getByTestId('coordinate-value')).toContainText('300 cm/s')
  await page.getByTestId('dimension-coordinate').selectOption('si')
  await expect(page.getByTestId('coordinate-value')).toContainText('3 m/s')
  await page.locator('.tour-lesson-controls').getByTestId('reading-depth-guided').check()
  await expect(page.getByTestId('guided-coordinate-disclosure')).toContainText('fixed target-bound sample value of 3 m/s')
  await expect(page.getByTestId('guided-coordinate-disclosure')).not.toContainText('sample value of 2 m/s')
})

test('switching from Guided to Technical preserves the lesson, preset, and local progress', async ({ page }) => {
  await gotoLesson(page)
  await page.getByTestId('preset-energy-or-torque').click()
  await expect(page.getByTestId('dimension-target')).toHaveValue('torque')
  await expectResumeLink(page, 'nav-resume')
  await expect(page.getByText('A number is only one part of a quantity value')).toBeVisible()
  await expect(page.getByText('Dimensions form exponent vectors')).toHaveCount(0)

  await page.locator('.tour-lesson-controls').getByTestId('reading-depth-technical').check()

  await expect(page).toHaveURL(new RegExp(`${FULL_LESSON}$`))
  await expect(page.getByTestId('dimension-target')).toHaveValue('torque')
  await expectResumeLink(page, 'nav-resume')
  await expect(page.getByText('A number is only one part of a quantity value')).toBeVisible()
  await expect(page.getByText('Dimensions form exponent vectors')).toBeVisible()
  await expect(page.getByTestId('technical-disclosure')).toBeVisible()
})

test('Technical quick mode is additive and station completion remains independent', async ({ page }) => {
  await gotoLesson(page, QUICK_LESSON)
  await expect(page.getByText('International System of Units definitions fix anchors; laboratories realize them', { exact: true })).toBeVisible()
  await expect(page.getByText('Dimensions and quantity kinds answer different questions')).toBeVisible()
  await expect(page.getByText('Dimensions form exponent vectors')).toHaveCount(0)
  await expect(page.locator('[data-equation-id]')).toHaveCount(1)

  await page.locator('.tour-lesson-controls').getByTestId('reading-depth-technical').check()
  await expect(page.getByTestId('quick-technical-estimate')).toContainText('Guided quick estimate')
  await expect(page.getByText('International System of Units definitions fix anchors; laboratories realize them', { exact: true })).toBeVisible()
  await expect(page.getByText('Dimensions and quantity kinds answer different questions')).toBeVisible()
  await expect(page.getByText('Dimensions form exponent vectors')).toBeVisible()
  await page.getByTestId('equation-reveal-all').click()
  await expect(page.locator('[data-equation-id]')).toHaveCount(6)

  await page.getByTestId('mark-lesson-complete').click()
  await expect(page.getByTestId('completion-announcement')).toHaveText('Station marked complete.')
  await expect(page.getByTestId('lesson-completed-state')).toHaveText('Station completed')

  await page.goto('/saved')
  await expect(page.locator('.saved-progress-summary dd')).toHaveText(['1', '0', '0'])
  await page.getByTestId('export-progress').click()
  await expect(page.getByTestId('export-output')).toContainText('"anchors-scales"')

  await page.goto('/')
  await expect(page.getByTestId('tour-ready')).toBeVisible()
  await expect(page.getByTestId('station-progress-anchors-scales')).toHaveText('Quick station: complete')

  await gotoLesson(page)
  await expect(page.getByTestId('lesson-completed-state')).toHaveCount(0)
  await expect(page.getByTestId('mark-lesson-complete')).toBeEnabled()
  await page.goto('/tour')
  await expect(page.getByRole('link', { name: /Units, Dimensions, and Physical Quantities/ }).locator('xpath=..')).toHaveAttribute('data-progress', 'visited')
})

test('explicit completion and Resume persist after reload', async ({ page }) => {
  await gotoLesson(page)
  await expect(page.getByTestId('lesson-completed-state')).toHaveCount(0)
  await page.getByTestId('mark-lesson-complete').click()
  await expect(page.getByTestId('completion-announcement')).toHaveText('Lesson marked complete.')
  await expect(page.getByTestId('lesson-completed-state')).toHaveText('Lesson completed')

  const resumeHref = await expectResumeLink(page, 'nav-resume')
  await page.goto(resumeHref)
  await expect(page.getByTestId('tour-lesson-ready')).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('tour-lesson-ready')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`${resumeHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
  await expect(page.locator(new URL(resumeHref, 'http://opensimphy.test').hash)).toBeFocused()
  await expect(page.getByTestId('lesson-completed-state')).toHaveText('Lesson completed')
  await expect(page.getByTestId('mark-lesson-complete')).toBeDisabled()
  await expectResumeLink(page, 'nav-resume')

  await page.goto('/')
  await expect(page.getByTestId('tour-ready')).toBeVisible()
  await expectResumeLink(page, 'overview-resume')
  await page.goto('/tour')
  await expect(page.getByRole('link', { name: /Units, Dimensions, and Physical Quantities/ }).locator('xpath=..')).toHaveAttribute('data-progress', 'complete')
})

test('visiting a lesson in a fresh browser context does not complete it', async ({ page }) => {
  await gotoLesson(page)
  await expect(page.getByTestId('lesson-completed-state')).toHaveCount(0)
  await expect(page.getByTestId('mark-lesson-complete')).toBeEnabled()

  await page.goto('/saved')
  const summary = page.locator('.saved-progress-summary')
  await expect(summary).toContainText('Visited lessons')
  await expect(summary).toContainText('Completed lessons')
  await expect(summary.locator('dd')).toHaveText(['1', '0', '0'])
})

test('the full map has four acts, 20 chapters, one available lesson, and honest planned chapters', async ({ page }) => {
  await page.goto('/tour')
  await expect(page.getByTestId('tour-map-ready')).toBeVisible()
  await expect(page.locator('.tour-act')).toHaveCount(4)
  await expect(page.locator('.tour-chapter-spine li')).toHaveCount(20)
  await expect(page.getByRole('link', { name: /Units, Dimensions, and Physical Quantities/ })).toContainText('Available')

  await page.getByRole('link', { name: /Units, Dimensions, and Physical Quantities/ }).click()
  await expect(page.getByRole('heading', { name: 'Units, Dimensions, and Physical Quantities' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Physical quantities/ })).toHaveAttribute('href', FULL_LESSON)

  await page.goto('/tour/anchors')
  await expect(page.getByRole('heading', { name: 'Clocks, Action, Light, and Gravity' })).toBeVisible()
  await expect(page.getByText('Planned chapter', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'This chapter is on the field-course roadmap' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lessons' })).toHaveCount(0)
})

test('unknown URLs and chapters preserve their requested path and expose recovery', async ({ page }) => {
  await page.goto('/unknown/tour/path?mode=recovery')
  await expect(page).toHaveURL(/\/unknown\/tour\/path\?mode=recovery$/)
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await expect(page.getByTestId('requested-path')).toHaveText('/unknown/tour/path?mode=recovery')
  await expect(page.getByRole('navigation', { name: 'Recovery links' }).getByRole('link')).toHaveCount(4)

  await page.goto('/tour/unknown-chapter')
  await expect(page).toHaveURL(/\/tour\/unknown-chapter$/)
  await expect(page.getByRole('heading', { name: 'Tour chapter not found' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Return to the Tour map' })).toBeVisible()
})

test('saved progress can be exported and explicitly cleared', async ({ page }) => {
  await gotoLesson(page)
  await page.getByTestId('preset-average-speed-from-path').click()
  await page.goto('/saved')
  await expect(page.getByRole('heading', { name: 'Saved Tour Progress' })).toBeVisible()
  await expectResumeLink(page, 'saved-resume')

  await page.getByTestId('export-progress').click()
  await expect(page.getByTestId('export-output')).toContainText('"physical-quantities"')
  await page.getByTestId('request-clear').click()
  await expect(page.getByTestId('confirm-clear')).toBeVisible()
  await page.getByTestId('confirm-clear').click()

  await expect(page.getByTestId('import-result')).toHaveText('Local Tour progress cleared.')
  await expect(page.locator('.saved-progress-summary dd')).toHaveText(['0', '0', '0'])
  await expect(page.getByTestId('saved-resume')).toHaveCount(0)
})

test('chapter and lesson routes publish their generated titles', async ({ page }) => {
  await page.goto('/tour/units')
  await expect(page.getByRole('heading', { name: 'Units, Dimensions, and Physical Quantities' })).toBeVisible()
  await expect(page).toHaveTitle('Units, Dimensions, and Physical Quantities | OpenSimPhy Atlas')

  await page.getByRole('link', { name: /Physical quantities/ }).click()
  await expect(page.getByTestId('tour-lesson-ready')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'A number is not yet a physical quantity' })).toBeVisible()
  await expect(page).toHaveTitle('A number is not yet a physical quantity | OpenSimPhy Atlas')
})

for (const width of [320, 390, 768, 1440]) {
  test(`keeps orientation, map, and lesson operable without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })

    await page.goto('/')
    await expect(page.getByTestId('tour-ready')).toBeVisible()
    await expectNoDocumentOverflowSoft(page, '/')

    await page.goto('/tour')
    await expect(page.getByTestId('tour-map-ready')).toBeVisible()
    await expectNoDocumentOverflowSoft(page, '/tour')

    await gotoLesson(page)
    await expect(page.getByTestId('dimension-builder')).toBeVisible()
    await expectNoDocumentOverflowSoft(page, FULL_LESSON)
  })
}

for (const zoom of [
  { label: '200%', width: 640 },
  { label: '400%', width: 320 },
]) {
  test(`reflows the Tour lesson at the ${zoom.label} CSS viewport equivalent`, async ({ page }) => {
    await page.setViewportSize({ width: zoom.width, height: 900 })
    await gotoLesson(page)
    await expectNoDocumentOverflow(page)
    await expect(page.getByTestId('dimension-target')).toBeVisible()
    await expect(page.getByTestId('mark-lesson-complete')).toBeVisible()
  })
}

test('Tour controls remain keyboard operable', async ({ page }) => {
  await gotoLesson(page)
  const guided = page.locator('.tour-lesson-controls').getByTestId('reading-depth-guided')
  await guided.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.tour-lesson-controls').getByTestId('reading-depth-technical')).toBeChecked()

  const preset = page.getByTestId('preset-force-from-motion')
  await preset.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('dimension-target')).toHaveValue('force')
  await page.getByTestId('prediction-matches-target').focus()
  await page.keyboard.press('Space')
  await page.getByTestId('reveal-dimension-result').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('dimension-result')).toBeVisible()
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('renders the Tour activity with reduced motion enabled', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoLesson(page)
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
    expect(await page.locator('html').evaluate((element) => getComputedStyle(element).scrollBehavior)).toBe('auto')
    await revealDimensionResult(page, 'matches-target')
    await expect(page.getByTestId('dimension-axis-table')).toBeVisible()
  })
})
