import { expect, test, type Locator, type Page, type Worker } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

const workbenchRegions = [
  'workbench-region-stage',
  'workbench-region-essential',
  'workbench-region-actions',
  'workbench-region-findings',
  'workbench-region-controls',
  'workbench-region-evidence',
  'workbench-region-raw',
] as const

async function gotoReady(page: Page, path: string, readyTestId: string): Promise<void> {
  await page.goto(path)
  await expect(page.getByTestId('app-ready')).toBeVisible()
  await expect(page.getByTestId(readyTestId)).toBeVisible()
}

async function selectValues(locator: Locator): Promise<string[]> {
  return locator.locator('option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))
}

async function expectNoOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
}

async function savedRuns(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) => candidate.endsWith(':saved-runs:v1'))
    if (!key) return []
    return (JSON.parse(localStorage.getItem(key) ?? '{}') as { runs?: Array<Record<string, unknown>> }).runs ?? []
  })
}

test('/labs presents three owned labs and a separate author collection without eager domain data or workers', async ({ page }) => {
  const requests: string[] = []
  const workers: string[] = []
  page.on('request', (request) => requests.push(new URL(request.url()).pathname))
  page.on('worker', (worker: Worker) => workers.push(new URL(worker.url()).pathname))

  await gotoReady(page, '/labs', 'completion-registry-ready')

  await expect(page.locator('.lab-choice-grid > a')).toHaveCount(3)
  expect(await page.locator('.lab-choice-grid a').evaluateAll((links) => links.map((link) => link.getAttribute('href')))).toEqual([
    '/labs/core',
    '/labs/walls',
    '/labs/earth/EARTH-PLAN-008',
  ])
  await expect(page.locator('.author-collection-grid > a')).toHaveAttribute('href', '/labs/authors/chenopdodium')
  await expect(page.locator('.author-collection-grid > a')).toContainText(/710 rendered without uncaught page errors/i)
  await expect(page.locator('.author-collection-grid > a')).toContainText(/retained failed requests may still exist/i)
  await expect(page.locator('.lab-choice-grid a[href="/labs/earth/EARTH-PLAN-008"]')).toContainText('EARTH method workbench')
  await expect(page.locator('a[href="/earth/programs"]')).toContainText('Program Registry')
  expect([...new Set(requests.filter((path) => path.startsWith('/data/')))]).toEqual(['/data/generated/completion.json'])
  expect(workers).toEqual([])
})

test('Core shares canonical state, remains route-evaluated, saves explicitly, and compares only compatible cases', async ({ page }) => {
  await gotoReady(page, '/labs/core', 'core-registry-ready')
  const shell = page.locator('.workbench-shell')
  const preset = page.getByTestId('core-preset-select')
  const cases = await selectValues(preset)
  expect(cases.length).toBeGreaterThanOrEqual(3)

  await page.goto('/labs/core?case=missing&projection=4d')
  await expect(page.getByTestId('workbench-url-state-warning')).toContainText('case, projection')
  await expect(page).toHaveURL(/\/labs\/core$/)
  await expect(shell).toHaveAttribute('data-execution-mode', 'route-evaluated')
  await expect(shell).toHaveAttribute('data-execution-status', 'completed')
  await expect(page.getByTestId('workbench-run')).toHaveCount(0)
  await expect(page.getByTestId('workbench-mode-status')).toContainText('evaluated all 37 declared cases on route load')

  await preset.selectOption(cases[1]!)
  await page.getByTestId('core-projection-2d').click()
  await page.getByTestId('core-plot-select').selectOption({ index: 1 })
  await expect(page).toHaveURL(new RegExp(`case=${cases[1]}`))
  await expect(page).toHaveURL(/projection=2d/)
  await expect(page).toHaveURL(/plot=/)
  const sharedUrl = page.url()

  await page.reload()
  await expect(page.getByTestId('core-registry-ready')).toBeVisible()
  await expect(preset).toHaveValue(cases[1]!)
  await expect(page.getByTestId('core-projection-2d')).toHaveClass(/active/)

  await page.goto(`/labs/core?case=${encodeURIComponent(cases[2]!)}`)
  await expect(page.getByTestId('core-registry-ready')).toBeVisible()
  await expect(preset).toHaveValue(cases[2]!)
  await page.goBack()
  await expect(page).toHaveURL(sharedUrl)
  await expect(preset).toHaveValue(cases[1]!)

  await page.getByTestId('workbench-reset').click()
  await expect(page).toHaveURL(/\/labs\/core$/)
  await expect(preset).toHaveValue(cases[0]!)
  expect(await savedRuns(page)).toHaveLength(0)
  await page.getByTestId('workbench-save').click()
  await expect(page.getByTestId('core-save-result')).toContainText('Saved Core run')
  expect(await savedRuns(page)).toHaveLength(1)

  await page.getByTestId('workbench-freeze').click()
  await page.getByTestId('core-projection-2d').click()
  await page.getByTestId('workbench-freeze').click()
  await expect(page.getByTestId('workbench-compare-status')).toContainText('Compatible snapshots')
  await expect(page.getByTestId('workbench-compare-finding')).toHaveCount(2)
  await expect(page.getByTestId('core-presentation-comparison')).toContainText('presentation state only')
  await expect(page.getByTestId('core-presentation-comparison')).toContainText('no scientific residual is inferred')

  await page.getByTestId('workbench-clear-compare').click()
  await page.getByTestId('workbench-freeze').click()
  await preset.selectOption(cases[1]!)
  await page.getByTestId('workbench-freeze').click()
  await expect(page.getByTestId('workbench-compare-status')).toContainText('Incompatible snapshots')
  await expect(page.getByTestId('workbench-domain-comparison')).toHaveCount(0)
  await expect(page.getByTestId('workbench-compare')).toContainText('no combined quantity is calculated')
  await expect(page.getByTestId('workbench-compare')).not.toContainText(/residual/i)

  await page.goto('/saved')
  await expect(page.getByTestId('saved-run-count')).toHaveText('1 run')
})

test('Number Walls defers execution, freezes dispatched state, compares declared contracts, saves, and cancels', async ({ page }) => {
  const requests: string[] = []
  const workers: string[] = []
  let holdPayload = false
  page.on('request', (request) => requests.push(new URL(request.url()).pathname))
  page.on('worker', (worker: Worker) => workers.push(new URL(worker.url()).pathname))
  await page.route('**/data/number-walls/**', async (route) => {
    if (holdPayload) {
      await new Promise((resolve) => setTimeout(resolve, 750))
      await route.abort()
      return
    }
    await route.continue()
  })

  await gotoReady(page, '/labs/walls', 'wall-registry-ready')
  await expect(page).toHaveURL(/\/labs\/walls$/)
  expect(requests.filter((path) => path.startsWith('/data/number-walls/'))).toEqual([])
  expect(workers).toEqual([])

  await page.goto('/labs/walls?depth=2&depth=3')
  await expect(page.getByTestId('workbench-url-state-warning')).toContainText('depth')
  await expect(page).toHaveURL(/\/labs\/walls$/)

  await page.getByTestId('wall-preset').selectOption('compact')
  await expect(page).toHaveURL(/depth=8/)
  await expect(page).toHaveURL(/width=16/)
  await page.reload()
  await expect(page.getByTestId('wall-registry-ready')).toBeVisible()
  await expect(page.getByTestId('wall-preset')).toHaveValue('compact')
  await page.getByTestId('workbench-reset').click()
  await expect(page).toHaveURL(/\/labs\/walls$/)
  await expect(page.getByTestId('wall-preset')).toHaveValue('default')

  await page.getByTestId('workbench-run').click()
  await expect(page.getByTestId('wall-simulation-ready')).toBeVisible()
  expect([...new Set(requests.filter((path) => path.startsWith('/data/number-walls/')))]).toHaveLength(1)
  expect(workers.filter((path) => path.toLocaleLowerCase().includes('numberwall.worker'))).toHaveLength(1)
  await page.getByTestId('wall-canvas').focus()
  await page.keyboard.press('Home')
  await expect(page.locator('.cell-readout')).toContainText('Cell [0, 0]')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.cell-readout')).toContainText('Cell [1, 1]')

  await page.getByTestId('wall-depth').fill('8')
  await page.getByTestId('wall-depth').press('Tab')
  await expect(page.getByTestId('wall-result-stale')).toContainText('stale')
  await expect(page.getByTestId('finding-cause')).toContainText('depth 16')
  await expect(page.getByTestId('finding-establishes')).toContainText('local bounded matrix transform')
  await expect(page.getByTestId('finding-does-not-establish')).toContainText('Physical evidence')
  await expect(page.getByTestId('finding-validates-theory')).toHaveText('false')
  expect(await savedRuns(page)).toHaveLength(0)
  await page.getByTestId('workbench-save').click()
  expect(await savedRuns(page)).toHaveLength(1)

  await page.getByTestId('workbench-run').click()
  await expect(page.getByTestId('wall-simulation-ready')).toBeVisible()
  await page.getByTestId('workbench-freeze').click()
  await page.getByTestId('wall-modulus').fill('11')
  await page.getByTestId('wall-modulus').press('Tab')
  await page.getByTestId('workbench-run').click()
  await expect(page.getByTestId('wall-simulation-ready')).toBeVisible()
  await page.getByTestId('workbench-freeze').click()
  await expect(page.getByTestId('workbench-compare-status')).toContainText('Compatible snapshots')
  await expect(page.getByTestId('wall-compatible-deltas')).toBeVisible()
  await expect(page.getByTestId('workbench-compare')).not.toContainText(/residual/i)

  await page.getByTestId('workbench-clear-compare').click()
  await page.getByTestId('workbench-freeze').click()
  await page.getByTestId('wall-mode').selectOption('mod')
  await page.getByTestId('workbench-run').click()
  await expect(page.getByTestId('wall-simulation-ready')).toBeVisible()
  await page.getByTestId('workbench-freeze').click()
  await expect(page.getByTestId('workbench-compare-status')).toContainText('Incompatible snapshots')
  await expect(page.getByTestId('wall-compatible-deltas')).toHaveCount(0)
  await expect(page.getByTestId('workbench-domain-comparison')).toHaveCount(0)
  await expect(page.getByTestId('workbench-compare')).not.toContainText(/residual/i)

  await page.getByTestId('workbench-clear-compare').click()
  const sources = await selectValues(page.getByTestId('wall-source'))
  expect(sources.length).toBeGreaterThan(1)
  await page.getByTestId('wall-source').selectOption(sources[1]!)
  holdPayload = true
  await page.getByTestId('workbench-run').click()
  await expect(page.getByTestId('workbench-cancel')).toBeVisible()
  await page.getByTestId('workbench-cancel').click()
  await expect(page.locator('.workbench-shell')).toHaveAttribute('data-execution-status', 'cancelled')
  await expect(page.locator('.workbench-live-status')).toContainText('cancelled')

  await page.goto('/saved')
  await expect(page.getByTestId('saved-run-count')).toHaveText('1 run')
})

test('EARTH Workbench owns distinct navigation, URL state, immutable runs, saves, comparisons, reset, and unavailable methods', async ({ page }) => {
  const programPath = '/labs/earth/EARTH-PLAN-008'
  const sourceMethod = 'earth-source-reproduction-v1'
  const requests: string[] = []
  page.on('request', (request) => requests.push(new URL(request.url()).pathname))
  await gotoReady(page, programPath, 'app-ready')
  await expect(page.getByRole('heading', { name: 'Atmospheric scale-height audit' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`${programPath}$`))
  await expect(page.locator('#primary-navigation a[href="/labs"]')).toHaveAttribute('aria-current', 'location')
  await expect(page.locator('#primary-navigation a[href="/evidence"]')).not.toHaveClass(/router-link-active/)
  await expect(page.getByTestId('earth-workbench-header')).toBeVisible()
  await expect(page.locator('.earth-local-nav')).toHaveCount(0)
  await expect(page.locator('.simulation-evidence-section')).toHaveCount(0)
  expect(requests.some((path) => path === '/data/generated/earth/datasets.json' || path.startsWith('/data/generated/earth/evidence/'))).toBe(false)

  await page.goto('/earth/programs/EARTH-PLAN-008')
  await expect(page.getByRole('heading', { name: 'Atmospheric scale-height audit' })).toBeVisible()
  await expect(page.locator('#primary-navigation a[href="/evidence"]')).toHaveAttribute('aria-current', 'location')
  await expect(page.locator('#primary-navigation a[href="/labs"]')).not.toHaveClass(/router-link-active/)
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`${programPath}$`))

  await page.locator('.workbench-method-disclosure summary').click()
  await page.getByRole('radio', { name: /EARTH atmospheric density-coherence transform/ }).check()
  await expect(page).toHaveURL(new RegExp(`method=${sourceMethod}`))
  const density = page.getByTestId('simulation-input-surfaceMassDensityKgPerCubicMetre')
  await density.fill('1.3')
  await expect(page).toHaveURL(/inputs=/)
  const sharedUrl = page.url()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Atmospheric scale-height audit' })).toBeVisible()
  await expect(density).toHaveValue('1.3')
  await expect(page).toHaveURL(sharedUrl)
  await page.goto(`${programPath}?method=${sourceMethod}`)
  await expect(density).toHaveValue('1.225')
  await page.goBack()
  await expect(page).toHaveURL(sharedUrl)
  await expect(density).toHaveValue('1.3')

  expect(await savedRuns(page)).toHaveLength(0)
  await page.getByTestId('workbench-run').click()
  await expect(page.getByTestId('simulation-result')).toBeVisible()
  await expect(page.getByTestId('finding-establishes')).toBeVisible()
  await expect(page.getByTestId('finding-does-not-establish')).toContainText(/scientific validation/i)
  await expect(page.getByTestId('finding-validates-theory')).toHaveText('false')
  await page.getByTestId('workbench-save').click()
  await expect(page.getByText('Saved EARTH run at', { exact: false })).toContainText('Saved EARTH run at')
  const runs = await savedRuns(page)
  expect(runs).toHaveLength(1)
  expect((runs[0]?.inputs as Record<string, unknown>).surfaceMassDensityKgPerCubicMetre).toBe(1.3)

  await page.getByTestId('workbench-freeze').click()
  await density.fill('1.4')
  await expect(page.getByTestId('simulation-result-stale')).toContainText('controls differ')
  await page.getByTestId('workbench-run').click()
  await expect(page.getByTestId('simulation-result-stale')).toHaveCount(0)
  await page.getByTestId('workbench-freeze').click()
  await expect(page.getByTestId('workbench-compare-status')).toContainText('Compatible snapshots')
  await expect(page.getByTestId('earth-parallel-scalar-deltas')).toBeVisible()
  await expect(page.getByTestId('workbench-compare')).not.toContainText(/residual:/i)

  await page.getByTestId('workbench-reset').click()
  await expect(page).toHaveURL(new RegExp(`${programPath}\\?method=${sourceMethod}$`))
  await expect(density).toHaveValue('1.225')
  await expect(page.getByTestId('simulation-result')).toHaveCount(0)
  await expect(page.getByTestId('workbench-compare-pending')).toContainText('0 of 2')

  await page.goto('/labs/earth/EARTH-FND-006?method=earth-source-model-v1')
  await expect(page.getByRole('heading', { name: 'Fixed-point and recognizability tests' })).toBeVisible()
  await expect(page.locator('.workbench-shell')).toHaveAttribute('data-execution-mode', 'unavailable')
  await expect(page.getByTestId('simulation-method-unavailable')).toContainText('Source formulation unavailable')
  await expect(page.getByTestId('workbench-run')).toHaveCount(0)
  await expect(page.getByTestId('workbench-run')).toHaveCount(0)
  await expect(page.locator('#primary-navigation a[href="/labs"]')).toHaveAttribute('aria-current', 'location')
})

for (const width of [320, 390, 768, 1440]) {
  test(`the common shell preserves action grammar, semantic order, targets, and reflow at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width, height: 900 })
    const routes = [
      {
        path: '/labs/core',
        ready: 'core-registry-ready',
        actions: ['Reset', 'Save result', 'Freeze for compare', 'Clear comparison'],
      },
      {
        path: '/labs/walls',
        ready: 'wall-registry-ready',
        actions: ['Run wall', 'Reset', 'Save result', 'Freeze for compare', 'Clear comparison'],
      },
      {
        path: '/labs/earth/EARTH-PLAN-008',
        ready: 'app-ready',
        actions: ['Run selected method', 'Reset selected method', 'Save result', 'Freeze for compare', 'Clear comparison'],
      },
    ] as const

    for (const route of routes) {
      await gotoReady(page, route.path, route.ready)
      await expect(page.locator('.workbench-shell')).toBeVisible()
      const order = await page.locator('.workbench-region').evaluateAll((regions) => regions.map((region) => (
        [...region.classList].find((name) => name.startsWith('workbench-region-'))
      )))
      expect(order).toEqual(workbenchRegions)

      const actionLabels = await page.locator('.workbench-region-actions button').allTextContents()
      expect(actionLabels.map((label) => label.trim())).toEqual(route.actions)
      const targetHeights = await page.locator('.workbench-region-actions button:visible').evaluateAll((buttons) => (
        buttons.map((button) => button.getBoundingClientRect().height)
      ))
      expect(targetHeights.length).toBeGreaterThan(0)
      expect(targetHeights.every((height) => height >= 44)).toBe(true)

      const gridAreas = await page.locator('.workbench-grid').evaluate((grid) => getComputedStyle(grid).gridTemplateAreas)
      if (width <= 1050) {
        expect(gridAreas).toBe('"stage" "essential" "actions" "findings" "controls" "evidence" "raw"')
      } else {
        expect(gridAreas).toBe('"essential stage findings" "controls stage findings" "actions actions actions" "evidence evidence evidence" "raw raw raw"')
      }
      await expectNoOverflow(page)
      if (width === 768) {
        const stageWidth = await page.locator('.workbench-region-stage').evaluate((stage) => stage.getBoundingClientRect().width)
        expect(stageWidth).toBeGreaterThanOrEqual(600)
      }
      await expect(page.getByRole('button', { name: route.actions[0], exact: true })).toHaveCount(1)
    }

    await page.goto('/labs/core')
    await expect(page.getByTestId('core-registry-ready')).toBeVisible()
    const corePreset = page.getByTestId('core-preset-select')
    const initialCorePreset = await corePreset.inputValue()
    await corePreset.focus()
    await page.keyboard.press('ArrowDown')
    expect(await corePreset.inputValue()).not.toBe(initialCorePreset)

    await page.goto('/labs/walls')
    await expect(page.getByTestId('wall-registry-ready')).toBeVisible()
    const wallSource = page.getByTestId('wall-source')
    const initialWallSource = await wallSource.inputValue()
    await wallSource.focus()
    await page.keyboard.press('ArrowDown')
    expect(await wallSource.inputValue()).not.toBe(initialWallSource)

    await page.goto('/labs/earth/EARTH-PLAN-008')
    await expect(page.getByRole('heading', { name: 'Atmospheric scale-height audit' })).toBeVisible()
    if (width <= 760) {
      const earthMethod = page.getByTestId('simulation-method-select')
      const initialEarthMethod = await earthMethod.inputValue()
      await earthMethod.focus()
      await page.keyboard.press('ArrowUp')
      expect(await earthMethod.inputValue()).not.toBe(initialEarthMethod)
    } else {
      await page.locator('.workbench-method-disclosure summary').click()
      const traditional = page.getByRole('radio', { name: /Standard isothermal hydrostatic scale-height baseline/ })
      await traditional.focus()
      await page.keyboard.press('ArrowUp')
      await expect(page.getByRole('radio', { name: /EARTH atmospheric density-coherence transform/ })).toBeChecked()
    }
  })
}
