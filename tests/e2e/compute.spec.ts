import { expect, test, type Page } from '@playwright/test'
import { COMPUTE_EXAMPLE_QUERIES, COMPUTE_LAB_PATH } from '../../src/compute/examples'

test.use({ serviceWorkers: 'block' })

const [
  PLANCK_RATIO,
  MIXED_GEV,
  PLOT_2D,
  PLOT_3D,
  INTEGRAL,
  DERIVATIVE,
  SOLVE,
  DETERMINANT,
  INDEFINITE,
] = COMPUTE_EXAMPLE_QUERIES

type ComputeSurface = {
  path: string
  ready: string
  label: string | RegExp
}

const PROMPT_ONLY_SURFACES: readonly ComputeSurface[] = [
  { path: '/tour/units/physical-quantities', ready: 'tour-lesson-ready', label: /Tour simulation|Tour lesson/ },
  { path: '/labs/edwin-gray', ready: 'edwin-gray-lab-ready', label: 'Edwin Gray motor lab' },
  { path: '/labs/quantum-wave', ready: 'quantum-wave-lab-ready', label: 'Quantum wave lab' },
  { path: '/labs/quantum-registers', ready: 'quantum-registers-lab-ready', label: 'Quantum register lab' },
  { path: '/labs/clifford-space', ready: 'clifford-space-lab-ready', label: 'Clifford space lab' },
  { path: '/labs/hyperbolic-partition', ready: 'hyperbolic-partition-lab-ready', label: 'Hyperbolic partition lab' },
  { path: '/labs/cases', ready: 'case-hub-ready', label: 'Simulation cases' },
  { path: '/awesome-physics/awesome-matter-js', ready: 'awesome-physics-detail-ready', label: 'Awesome Physics case' },
]

const DOCK_SURFACES: readonly ComputeSurface[] = [
  { path: COMPUTE_LAB_PATH, ready: 'compute-lab-ready', label: 'SI defining constants' },
  { path: '/atlas/1', ready: 'formula-record-ready', label: /Formula / },
  { path: '/labs/core', ready: 'core-registry-ready', label: /Core case|Core lab/ },
  { path: '/labs/walls', ready: 'wall-registry-ready', label: /Number wall|Number walls/ },
  { path: '/labs/earth/EARTH-PLAN-008', ready: 'earth-workbench-header', label: /EARTH method|EARTH workbench/ },
]

async function openReady(page: Page, path: string, ready: string): Promise<void> {
  await page.goto(path)
  await expect(page.getByTestId('app-ready')).toBeVisible()
  await expect(page.getByTestId(ready)).toBeVisible()
}

async function runQuery(page: Page, query: string): Promise<void> {
  const field = page.getByTestId('compute-query')
  await field.scrollIntoViewIfNeeded()
  await field.fill(query)
  await expect(field).toHaveValue(query)
  await page.getByTestId('compute-run').click()
  await expect(page.locator('[data-testid="compute-formatted"], [data-testid="compute-error"]')).toBeVisible()
}

test('Compute lab evaluates Planck mass over Planck time squared into spring-constant interpretations', async ({ page }) => {
  await openReady(page, COMPUTE_LAB_PATH, 'compute-lab-ready')
  await page.getByRole('button', { name: PLANCK_RATIO, exact: true }).click()
  await expect(page.getByTestId('compute-dimensions')).toContainText('[mass][time]^{-2}')
  await expect(page.getByTestId('compute-si-unit')).toContainText('kg s^-2')
  await expect(page.getByTestId('compute-interpretations')).toContainText('spring constant')
  await expect(page.getByTestId('compute-interpretations')).toContainText('surface tension')
  await expect(page.getByTestId('compute-interpretations')).toContainText('These names share this dimension')
})

test('Compute lab evaluates a mixed-unit GeV / meter^3 / newton radical as inverse length', async ({ page }) => {
  await openReady(page, COMPUTE_LAB_PATH, 'compute-lab-ready')
  await page.getByRole('button', { name: MIXED_GEV, exact: true }).click()
  await expect(page.getByTestId('compute-si-unit')).toContainText('m^-1')
  await expect(page.getByTestId('compute-dimensions')).toContainText('[length]^{-1}')
  await expect(page.getByTestId('compute-interpretations')).toContainText('wavenumber')
  await expect(page.getByTestId('compute-formatted')).toContainText('6.524')
})

test('Compute lab hydrates a calculus query from the URL', async ({ page }) => {
  await page.goto(`${COMPUTE_LAB_PATH}?q=${encodeURIComponent(INTEGRAL)}`)
  await expect(page.getByTestId('app-ready')).toBeVisible()
  await expect(page.getByTestId('compute-lab-ready')).toBeVisible()
  await expect(page.getByTestId('compute-formatted')).toContainText('1/3')
})

test('Compute lab examples cover integrate, differentiate, solve, det, and graphs', async ({ page }) => {
  await openReady(page, COMPUTE_LAB_PATH, 'compute-lab-ready')

  await page.getByRole('button', { name: INTEGRAL, exact: true }).click()
  await expect(page.getByTestId('compute-formatted')).toContainText('1/3')

  await page.getByRole('button', { name: INDEFINITE, exact: true }).click()
  await expect(page.getByTestId('compute-formatted')).toContainText('cos')

  await page.getByRole('button', { name: DERIVATIVE, exact: true }).click()
  await expect(page.getByTestId('compute-formatted')).toContainText('sin')
  await expect(page.getByTestId('compute-formatted')).toContainText('cos')
  await expect(page.getByTestId('compute-plot')).toBeVisible()

  await page.getByRole('button', { name: SOLVE, exact: true }).click()
  await expect(page.getByTestId('compute-formatted')).toContainText('x = -1')
  await expect(page.getByTestId('compute-formatted')).toContainText('x = 3')

  await page.getByRole('button', { name: DETERMINANT, exact: true }).click()
  await expect(page.getByTestId('compute-formatted')).toHaveText('-2')

  await page.getByRole('button', { name: PLOT_2D, exact: true }).click()
  await expect(page.getByTestId('compute-formatted')).toContainText('sin(x)')
  await expect(page.getByTestId('compute-plot')).toBeVisible()

  await page.getByRole('button', { name: PLOT_3D, exact: true }).click()
  await expect(page.getByTestId('compute-formatted')).toContainText('sin(x)*cos(y)')
  await expect(page.getByTestId('compute-plot')).toBeVisible()
})

test('Compute lab keeps monastery dimensional errors out of the CAS fallback', async ({ page }) => {
  await openReady(page, COMPUTE_LAB_PATH, 'compute-lab-ready')
  await runQuery(page, 'sin(m_P)')
  await expect(page.getByTestId('compute-error')).toContainText('sin argument must be dimensionless')
})

test('Labs index leads with the compute kernel', async ({ page }) => {
  await openReady(page, '/labs', 'completion-registry-ready')
  await expect(page.locator('.lab-choice-grid a').first()).toHaveAttribute('href', COMPUTE_LAB_PATH)
})

test('Tour prompt opens the same query in the Compute lab', async ({ page }) => {
  await openReady(page, '/tour/units/physical-quantities', 'tour-lesson-ready')
  await runQuery(page, INTEGRAL)
  await expect(page.getByTestId('compute-formatted')).toContainText('1/3')
  await expect(page.getByTestId('compute-plot')).toHaveCount(0)
  await page.getByTestId('compute-open-lab').click()
  await expect(page).toHaveURL(/\/labs\/compute\?q=/)
  await expect(page.getByTestId('compute-lab-ready')).toBeVisible()
  await expect(page.getByTestId('compute-formatted')).toContainText('1/3')
  await expect(page.getByTestId('compute-plot')).toHaveCount(0)
})

for (const surface of PROMPT_ONLY_SURFACES) {
  test(`${surface.path} embeds the kernel prompt without a Plotly host`, async ({ page }) => {
    await openReady(page, surface.path, surface.ready)
    await expect(page.getByTestId('compute-prompt')).toBeVisible()
    await expect(page.getByTestId('compute-prompt')).toContainText(surface.label)
    await runQuery(page, PLOT_2D)
    await expect(page.getByTestId('compute-formatted')).toContainText('sin(x)')
    await expect(page.getByTestId('compute-plot')).toHaveCount(0)
    await expect(page.getByTestId('compute-open-lab')).toHaveAttribute('href', /\/labs\/compute\?q=/)
  })
}

for (const surface of DOCK_SURFACES) {
  test(`${surface.path} hosts a local Plotly dock beside the kernel prompt`, async ({ page }) => {
    await openReady(page, surface.path, surface.ready)
    await expect(page.getByTestId('compute-prompt')).toBeVisible()
    await expect(page.getByTestId('compute-prompt')).toContainText(surface.label)
    await runQuery(page, PLOT_2D)
    await expect(page.getByTestId('compute-plot')).toBeVisible()
  })
}
