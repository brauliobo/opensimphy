import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const simulationsJson = JSON.parse(
  readFileSync(resolve(process.cwd(), 'public/data/generated/awesomePhysics/simulations.json'), 'utf8'),
) as { summary: { runnable: number } }

test('loads the Awesome Physics catalog with deterministic counts and an accessible footer link', async ({ page }) => {
  await page.goto('/awesome-physics')

  await expect(page.getByTestId('app-ready')).toBeVisible()
  await expect(page.getByTestId('awesome-physics-catalog-ready')).toBeVisible()
  await expect(page.getByTestId('awesome-catalog-counts')).toContainText('Catalog records86')
  await expect(page.getByTestId('awesome-catalog-counts')).toContainText('Projects + archive76')
  await expect(page.getByTestId('awesome-catalog-counts')).toContainText('Organizations10')
  await expect(page.locator('.awesome-catalog-card')).toHaveCount(86)
  await expect(page.getByTestId('awesome-catalog-run')).toHaveCount(simulationsJson.summary.runnable)
  await expect(page.getByTestId('footer-awesome-physics')).toHaveAttribute('href', '/awesome-physics')
})

test('navigates to an available detail and runs the verified Bullet3 default', async ({ page }) => {
  await page.goto('/awesome-physics')
  await expect(page.getByTestId('awesome-physics-catalog-ready')).toBeVisible()

  await expect(page.getByTestId('awesome-physics-shell')).toBeVisible()
  await page.getByTestId('awesome-catalog-card-awesome-matter-js').getByRole('link', { name: 'Open detail ->' }).click()
  await expect(page).toHaveURL(/\/awesome-physics\/awesome-matter-js$/)
  await expect(page.getByTestId('awesome-physics-shell')).toBeVisible()
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
  await expect(page.getByTestId('awesome-physics-run-panel')).toBeVisible()

  await page.getByTestId('awesome-physics-run').click()
  const bulletStatus = page.getByTestId('awesome-physics-status')
  await expect.poll(async () => (await bulletStatus.textContent())?.trim() ?? '', {
    timeout: 15_000,
    message: 'Bullet3 generic worker did not complete; inspect the detail route for diagnostics',
  }).toContain('completed')

  const bulletResultText = await page.getByTestId('awesome-physics-result').locator('code').textContent()
  const bulletOutput = JSON.parse(bulletResultText ?? '') as { operation?: unknown; y?: unknown }
  expect(bulletOutput.operation).toBe('step')
  expect(bulletOutput.y).toBeCloseTo(9.997221946716309, 6)
})

test('runs the verified qutip TypeScript default on the detail route', async ({ page }) => {
  await page.goto('/awesome-physics/awesome-qutip')
  await expect(page.getByTestId('awesome-physics-detail-ready')).toBeVisible()
  await expect(page.getByTestId('awesome-physics-run-panel')).toBeVisible()

  await page.getByTestId('awesome-physics-run').click()
  const runStatus = page.getByTestId('awesome-physics-status')
  await expect.poll(async () => (await runStatus.textContent())?.trim() ?? '', {
    timeout: 15_000,
    message: 'qutip TypeScript worker did not complete; inspect the detail route for diagnostics',
  }).toContain('completed')

  const resultText = await page.getByTestId('awesome-physics-result').locator('code').textContent()
  const output = JSON.parse(resultText ?? '') as {
    operation?: unknown
    effectiveRabiFrequency?: unknown
    peakExcitedPopulation?: unknown
    validatesTheory?: unknown
  }
  expect(output.operation).toBe('rabi-population')
  expect(output.effectiveRabiFrequency).toBe(1)
  expect(output.peakExcitedPopulation).toBeGreaterThan(0.7)
  expect(output.validatesTheory).toBe(false)
})

test('runs the verified scikit-beam, raysect, QuantumOptics.jl, and astropy TypeScript defaults', async ({ page }) => {
  const cases = [
    {
      id: 'awesome-scikit-beam',
      operation: 'sphere-form-factor',
      check: (output: Record<string, unknown>) => {
        expect(output.operation).toBe('sphere-form-factor')
        expect((output.samples as unknown[])[0]).toMatchObject({ qNmInv: 0, formFactor: 1, intensity: 1 })
      },
    },
    {
      id: 'awesome-raysect',
      operation: 'prism-trace',
      check: (output: Record<string, unknown>) => {
        expect(output.operation).toBe('prism-trace')
        expect(output.transmitted).toBe(true)
        expect(output.deviationDeg).toBeGreaterThan(30)
      },
    },
    {
      id: 'awesome-quantumoptics-jl',
      operation: 'jaynes-cummings',
      check: (output: Record<string, unknown>) => {
        expect(output.operation).toBe('jaynes-cummings')
        expect(output.vacuumRabiFrequency).toBe(2)
        expect(output.validatesTheory).toBe(false)
      },
    },
    {
      id: 'awesome-astropy',
      operation: 'unit-convert',
      check: (output: Record<string, unknown>) => {
        expect(output.operation).toBe('unit-convert')
        expect(output.dimension).toBe('length')
        expect(output.value).toBeGreaterThan(3e16)
      },
    },
  ] as const

  for (const item of cases) {
    await page.goto(`/awesome-physics/${item.id}`)
    await expect(page.getByTestId('awesome-physics-detail-ready')).toBeVisible()
    await page.getByTestId('awesome-physics-run').click()
    const runStatus = page.getByTestId('awesome-physics-status')
    await expect.poll(async () => (await runStatus.textContent())?.trim() ?? '', {
      timeout: 15_000,
      message: `${item.id} TypeScript worker did not complete`,
    }).toContain('completed')
    const resultText = await page.getByTestId('awesome-physics-result').locator('code').textContent()
    item.check(JSON.parse(resultText ?? '') as Record<string, unknown>)
    await expect(page.getByTestId(`awesome-case-page-${item.id}`)).toBeVisible()
    if (item.id === 'awesome-scikit-beam') await expect(page.getByTestId('awesome-case-scikit-beam-curve')).toBeVisible()
    if (item.id === 'awesome-raysect') await expect(page.getByTestId('awesome-case-raysect-ray')).toBeVisible()
    if (item.id === 'awesome-quantumoptics-jl') await expect(page.getByTestId('awesome-case-quantumoptics-jl-curve')).toBeVisible()
    if (item.id === 'awesome-astropy') await expect(page.getByTestId('awesome-case-astropy-metrics')).toContainText('length')
  }
})

test('runs the verified pymunk and galpy WASM defaults on their case pages', async ({ page }) => {
  await page.goto('/awesome-physics')
  await expect(page.getByTestId('awesome-physics-catalog-ready')).toBeVisible()
  await page.getByTestId('awesome-catalog-card-awesome-pymunk').getByRole('link', { name: 'Open detail ->' }).click()
  await expect(page).toHaveURL(/\/awesome-physics\/awesome-pymunk$/)
  await expect(page.getByTestId('awesome-physics-shell')).toBeVisible()
  await expect(page.getByTestId('awesome-case-page-awesome-pymunk')).toBeVisible()
  await page.getByTestId('awesome-physics-run').click()
  await expect.poll(async () => (await page.getByTestId('awesome-physics-status').textContent())?.trim() ?? '', {
    timeout: 30_000,
    message: 'pymunk WASM worker did not complete',
  }).toContain('completed')
  const pymunkText = await page.getByTestId('awesome-physics-result').locator('code').textContent()
  const pymunk = JSON.parse(pymunkText ?? '') as { operation?: unknown, snapshot?: { y?: unknown } }
  expect(pymunk.operation).toBe('step')
  expect(Number(pymunk.snapshot?.y)).toBeGreaterThan(0)
  await expect(page.getByTestId('awesome-case-pymunk-ball')).toBeVisible()

  await page.goto('/awesome-physics/awesome-galpy')
  await expect(page.getByTestId('awesome-case-page-awesome-galpy')).toBeVisible()
  await page.getByTestId('awesome-physics-run').click()
  await expect.poll(async () => (await page.getByTestId('awesome-physics-status').textContent())?.trim() ?? '', {
    timeout: 30_000,
    message: 'galpy WASM worker did not complete',
  }).toContain('completed')
  const galpyText = await page.getByTestId('awesome-physics-result').locator('code').textContent()
  const galpy = JSON.parse(galpyText ?? '') as { operation?: unknown }
  expect(galpy.operation).toBe('integrate-orbit')
  await expect(page.getByTestId('awesome-case-galpy-curve')).toBeVisible()
})

test('runs the verified PhysX and Newton WASM defaults on their case pages', async ({ page }) => {
  await page.goto('/awesome-physics')
  await expect(page.getByTestId('awesome-physics-catalog-ready')).toBeVisible()
  await page.getByTestId('awesome-catalog-card-awesome-physx-3-4').getByRole('link', { name: 'Open detail ->' }).click()
  await expect(page).toHaveURL(/\/awesome-physics\/awesome-physx-3-4$/)
  await expect(page.getByTestId('awesome-physics-shell')).toBeVisible()
  await expect(page.getByTestId('awesome-case-page-awesome-physx-3-4')).toBeVisible()
  await page.getByTestId('awesome-physics-run').click()
  await expect.poll(async () => (await page.getByTestId('awesome-physics-status').textContent())?.trim() ?? '', {
    timeout: 30_000,
    message: 'PhysX WASM worker did not complete',
  }).toContain('completed')
  const physxText = await page.getByTestId('awesome-physics-result').locator('code').textContent()
  const physx = JSON.parse(physxText ?? '') as { operation?: unknown, y?: unknown }
  expect(physx.operation).toBe('step')
  expect(Number(physx.y)).toBeCloseTo(9.997, 3)
  await expect(page.getByTestId('awesome-case-physx-sphere')).toBeVisible()

  await page.goto('/awesome-physics/awesome-newton-dynamics')
  await expect(page.getByTestId('awesome-case-page-awesome-newton-dynamics')).toBeVisible()
  await page.getByTestId('awesome-physics-run').click()
  await expect.poll(async () => (await page.getByTestId('awesome-physics-status').textContent())?.trim() ?? '', {
    timeout: 30_000,
    message: 'Newton WASM worker did not complete',
  }).toContain('completed')
  const newtonText = await page.getByTestId('awesome-physics-result').locator('code').textContent()
  const newton = JSON.parse(newtonText ?? '') as { operation?: unknown, y?: unknown }
  expect(newton.operation).toBe('step')
  expect(Number(newton.y)).toBeCloseTo(9.997, 3)
  await expect(page.getByTestId('awesome-case-newton-sphere')).toBeVisible()
})

test('runs the verified ncollide, fluid-engine-dev, and Cantera WASM defaults on their case pages', async ({ page }) => {
  await page.goto('/awesome-physics')
  await expect(page.getByTestId('awesome-physics-catalog-ready')).toBeVisible()
  await page.getByTestId('awesome-catalog-card-awesome-ncollide').getByRole('link', { name: 'Open detail ->' }).click()
  await expect(page).toHaveURL(/\/awesome-physics\/awesome-ncollide$/)
  await expect(page.getByTestId('awesome-physics-shell')).toBeVisible()
  await expect(page.getByTestId('awesome-case-page-awesome-ncollide')).toBeVisible()
  await page.getByTestId('awesome-physics-run').click()
  await expect.poll(async () => (await page.getByTestId('awesome-physics-status').textContent())?.trim() ?? '', {
    timeout: 30_000,
    message: 'ncollide WASM worker did not complete',
  }).toContain('completed')
  const ncollideText = await page.getByTestId('awesome-physics-result').locator('code').textContent()
  const ncollide = JSON.parse(ncollideText ?? '') as { operation?: unknown, y?: unknown }
  expect(ncollide.operation).toBe('step')
  expect(Number(ncollide.y)).toBeCloseTo(-0.75, 6)
  await expect(page.getByTestId('awesome-case-ncollide-ball')).toBeVisible()

  await page.goto('/awesome-physics/awesome-fluid-engine-dev')
  await expect(page.getByTestId('awesome-case-page-awesome-fluid-engine-dev')).toBeVisible()
  await page.getByTestId('awesome-physics-run').click()
  await expect.poll(async () => (await page.getByTestId('awesome-physics-status').textContent())?.trim() ?? '', {
    timeout: 30_000,
    message: 'fluid-engine-dev WASM worker did not complete',
  }).toContain('completed')
  const fluidText = await page.getByTestId('awesome-physics-result').locator('code').textContent()
  const fluid = JSON.parse(fluidText ?? '') as { operation?: unknown, y?: unknown }
  expect(fluid.operation).toBe('step')
  expect(Number(fluid.y)).toBeCloseTo(-3.981664, 5)
  await expect(page.getByTestId('awesome-case-fluid-engine-dev-jet')).toBeVisible()

  await page.goto('/awesome-physics/awesome-cantera')
  await expect(page.getByTestId('awesome-case-page-awesome-cantera')).toBeVisible()
  await page.getByTestId('awesome-physics-run').click()
  await expect.poll(async () => (await page.getByTestId('awesome-physics-status').textContent())?.trim() ?? '', {
    timeout: 30_000,
    message: 'Cantera WASM worker did not complete',
  }).toContain('completed')
  const canteraText = await page.getByTestId('awesome-physics-result').locator('code').textContent()
  const cantera = JSON.parse(canteraText ?? '') as { operation?: unknown, temperatureK?: unknown }
  expect(cantera.operation).toBe('equilibrate-hp')
  expect(Number(cantera.temperatureK)).toBeGreaterThan(1001)
  await expect(page.getByTestId('awesome-case-cantera-marker')).toBeVisible()
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

test('runs the verified nphysics2d Blob-companion module-worker route', async ({ page }) => {
  await page.goto('/awesome-physics/awesome-nphysics')
  await expect(page.getByTestId('awesome-physics-detail-ready')).toBeVisible()
  await expect(page.getByTestId('awesome-physics-run-panel')).toBeVisible()

  await page.getByTestId('awesome-physics-run').click()
  const status = page.getByTestId('awesome-physics-status')
  await expect.poll(async () => (await status.textContent())?.trim() ?? '', {
    timeout: 30_000,
    message: 'nphysics2d module worker did not complete; inspect the detail route for diagnostics',
  }).toContain('completed')

  const resultText = await page.getByTestId('awesome-physics-result').locator('code').textContent()
  const output = JSON.parse(resultText ?? '') as {
    schemaVersion?: unknown
    dimension?: unknown
    operation?: unknown
    snapshot?: { x?: unknown; y?: unknown; steps?: unknown }
    provenance?: { sourceRevision?: unknown }
  }
  expect(output).toMatchObject({
    schemaVersion: 1,
    dimension: 2,
    operation: 'snapshot',
    snapshot: { x: 0, y: 2, steps: 0 },
    provenance: { sourceRevision: '65aa85c5470a5da85e0c13652ce58400ae2e2201' },
  })
})

test('navigates from catalog to Spirit and runs the verified LLG default', async ({ page }) => {
  await page.goto('/awesome-physics')
  await expect(page.getByTestId('awesome-physics-catalog-ready')).toBeVisible()
  await expect(page.getByTestId('awesome-physics-shell')).toBeVisible()

  await page.getByTestId('awesome-catalog-card-awesome-spirit').getByRole('link', { name: 'Open detail ->' }).click()
  await expect(page).toHaveURL(/\/awesome-physics\/awesome-spirit$/)
  await expect(page.getByTestId('awesome-physics-shell')).toBeVisible()
  await expect(page.getByTestId('awesome-physics-detail-ready')).toBeVisible()
  await expect(page.getByTestId('awesome-physics-run-panel')).toBeVisible()

  await page.getByTestId('awesome-physics-run').click()
  const status = page.getByTestId('awesome-physics-status')
  await expect.poll(async () => (await status.textContent())?.trim() ?? '', {
    timeout: 15_000,
    message: 'Spirit LLG worker did not complete; inspect the detail route for diagnostics',
  }).toContain('completed')

  const resultText = await page.getByTestId('awesome-physics-result').locator('code').textContent()
  const output = JSON.parse(resultText ?? '') as {
    operation?: unknown
    solved?: unknown
    magnetization?: { z?: unknown }
    provenance?: { source?: unknown; validatesTheory?: unknown }
  }
  expect(output.operation).toBe('llg-heun')
  expect(output.solved).toBe(true)
  expect(output.magnetization?.z).toBeCloseTo(0.5848562455211069, 6)
  expect(output.provenance).toMatchObject({ source: 'spirit', validatesTheory: false })
})
