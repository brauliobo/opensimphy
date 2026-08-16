import { expect, test } from '@playwright/test'

test('loads the Awesome Physics catalog with deterministic counts and an accessible footer link', async ({ page }) => {
  await page.goto('/awesome-physics')

  await expect(page.getByTestId('app-ready')).toBeVisible()
  await expect(page.getByTestId('awesome-physics-catalog-ready')).toBeVisible()
  await expect(page.getByTestId('awesome-catalog-counts')).toContainText('Catalog records86')
  await expect(page.getByTestId('awesome-catalog-counts')).toContainText('Projects + archive76')
  await expect(page.getByTestId('awesome-catalog-counts')).toContainText('Organizations10')
  await expect(page.locator('.awesome-catalog-card')).toHaveCount(86)
  await expect(page.getByTestId('awesome-catalog-run')).toHaveCount(14)
  await expect(page.getByTestId('footer-awesome-physics')).toHaveAttribute('href', '/awesome-physics')
})

test('navigates to an available detail with Run and an unavailable detail without Run', async ({ page }) => {
  await page.goto('/awesome-physics')
  await expect(page.getByTestId('awesome-physics-catalog-ready')).toBeVisible()

  await page.getByTestId('awesome-catalog-card-awesome-matter-js').getByRole('link', { name: 'Open detail ->' }).click()
  await expect(page).toHaveURL(/\/awesome-physics\/awesome-matter-js$/)
  await expect(page.getByTestId('awesome-physics-detail-ready')).toBeVisible()
  await expect(page.getByTestId('awesome-physics-run-panel')).toBeVisible()
  await expect(page.getByTestId('awesome-physics-run')).toBeVisible()

  const runStatus = page.getByTestId('awesome-physics-status')
  const runError = page.getByTestId('awesome-physics-error')
  await page.getByTestId('awesome-physics-run').click()
  await expect.poll(async () => {
    const statusText = (await runStatus.textContent())?.trim() ?? ''
    const errorCount = await runError.count()
    const errorText = errorCount > 0 ? (await runError.textContent())?.trim() ?? '' : ''
    return { statusText, errorText }
  }, {
    timeout: 15_000,
    message: 'matter-js browser worker did not complete; inspect statusText and errorText for diagnostics',
  }).toEqual({
    statusText: expect.stringContaining('completed'),
    errorText: '',
  })

  const result = page.getByTestId('awesome-physics-result')
  await expect(result).toBeVisible({ timeout: 15_000 })
  const resultText = await result.locator('code').textContent()
  expect(resultText).not.toBeNull()
  const output = JSON.parse(resultText ?? '') as {
    schemaVersion?: unknown
    dimension?: unknown
    frames?: unknown
  }
  expect(output).toMatchObject({ schemaVersion: 1, dimension: 2 })
  expect(Array.isArray(output.frames)).toBe(true)

  await page.goto('/awesome-physics/awesome-bullet3')
  await expect(page.getByTestId('awesome-physics-detail-ready')).toBeVisible()
  await expect(page.getByTestId('awesome-physics-no-run')).toBeVisible()
  await expect(page.getByTestId('awesome-physics-run-panel')).toHaveCount(0)
  await expect(page.getByTestId('awesome-physics-run')).toHaveCount(0)
})

test('runs the verified CoolProp classic-worker route with its typed default', async ({ page }) => {
  await page.goto('/awesome-physics/awesome-coolprop')
  await expect(page.getByTestId('awesome-physics-detail-ready')).toBeVisible()
  await expect(page.getByTestId('awesome-physics-run-panel')).toBeVisible()

  await page.getByTestId('awesome-physics-run').click()
  const runStatus = page.getByTestId('awesome-physics-status')
  await expect.poll(async () => (await runStatus.textContent())?.trim() ?? '', {
    timeout: 30_000,
    message: 'CoolProp classic worker did not complete; inspect the detail route for diagnostics',
  }).toContain('completed')

  const resultText = await page.getByTestId('awesome-physics-result').locator('code').textContent()
  const output = JSON.parse(resultText ?? '') as { operation?: unknown; kelvin?: unknown }
  expect(output.operation).toBe('F2K')
  expect(output.kelvin).toBeCloseTo(255.3722222222, 10)
})
