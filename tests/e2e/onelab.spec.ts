import { expect, test } from '@playwright/test'
import reference from '../../tools/wasm/fixtures/microstrip-reference.json' with { type: 'json' }
import artifactLock from '../../tools/wasm/artifacts.lock.json' with { type: 'json' }

function expectVectorClose(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
    reference.tolerance.vectorAbsolute + reference.tolerance.relative * Math.abs(expected),
  )
}

function expectScalarSampleClose(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(reference.tolerance.scalarSampleAbsolute + reference.tolerance.relative * Math.abs(expected))
}

function expectScalarAggregateClose(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(reference.tolerance.scalarAggregateAbsolute + reference.tolerance.relative * Math.abs(expected))
}

function expectResidualClose(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(reference.tolerance.residualAbsolute + reference.tolerance.residualRelative * Math.abs(expected))
}

test('warms online then meshes, solves and extracts views fully offline across repeat and recreation', async ({ page, context }) => {
  await page.goto('/labs')
  await expect(page.getByTestId('app-ready')).toBeVisible()
  await expect(page.getByTestId('onelab-nav')).toBeVisible()
  await page.getByTestId('onelab-nav').click()
  await expect(page).toHaveURL(/\/labs\/onelab$/)
  await page.getByTestId('onelab-warm').click()
  await expect.poll(async () => {
    const state = await page.getByTestId('onelab-state').getAttribute('data-state')
    if (state === 'error') throw new Error(await page.getByRole('alert').innerText())
    return state
  }).toBe('ready')

  const cacheState = await page.evaluate(async () => {
    const names = await caches.keys()
    const current = names.find((name) => name.startsWith('opensimphy-onelab-') && !name.includes('-staging-'))!
    const cache = await caches.open(current)
    const manifest = await fetch('/simulation/manifest.json').then((response) => response.json()) as { version: string; files: Array<{ path: string }> }
    const expected = ['/simulation/manifest.json', `/simulation/${manifest.version}/complete.json`, ...manifest.files.map(({ path }) => `/simulation/${path}`)].sort()
    return { names, current, expected, assets: (await cache.keys()).map((request) => new URL(request.url).pathname).sort() }
  })
  expect(cacheState.current).toBe(`opensimphy-onelab-${artifactLock.contentVersion}`)
  expect(cacheState.names.filter((name) => name.startsWith('opensimphy-onelab-'))).toEqual([cacheState.current])
  expect(cacheState.assets).toEqual(cacheState.expected)
  expect(cacheState.assets.some((path) => path.endsWith('/gmsh/gmsh-core.wasm'))).toBe(true)
  expect(cacheState.assets.some((path) => path.endsWith('/getdp/getdp.wasm'))).toBe(true)
  expect(cacheState.assets.some((path) => path.endsWith('/complete.json'))).toBe(true)

  const repaired = await page.evaluate(async () => {
    const manifest = await fetch('/simulation/manifest.json').then((response) => response.json()) as { cacheName: string; files: Array<{ path: string; sha256: string }> }
    const file = manifest.files.find(({ path }) => path.endsWith('/fixtures/microstrip/microstrip.geo'))!
    const cache = await caches.open(manifest.cacheName)
    await cache.put(`/simulation/${file.path}`, new Response('corrupt'))
    return file
  })
  await page.reload()
  await expect(page.getByTestId('app-ready')).toBeVisible()
  await page.getByTestId('onelab-warm').click()
  await expect(page.getByTestId('onelab-state')).toHaveAttribute('data-state', 'ready')
  const repairedHash = await page.evaluate(async ({ path }) => {
    const manifest = await fetch('/simulation/manifest.json').then((response) => response.json()) as { cacheName: string }
    const bytes = await (await (await caches.open(manifest.cacheName)).match(`/simulation/${path}`))!.arrayBuffer()
    const hash = await crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('')
  }, repaired)
  expect(repairedHash).toBe(repaired.sha256)

  await context.setOffline(true)
  await page.getByTestId('onelab-solve').click()
  await expect.poll(async () => {
    const state = await page.getByTestId('onelab-state').getAttribute('data-state')
    if (state === 'error') throw new Error(await page.getByRole('alert').innerText())
    return state
  }).toBe('complete')
  await expect(page.getByTestId('onelab-runs')).toHaveText('1')
  await expect(page.getByTestId('onelab-mesh')).toContainText(`${reference.nodes} nodes / ${reference.elements} elements`)
  expectResidualClose(Number(await page.getByTestId('onelab-initial-residual').innerText()), reference.initialResidual)
  expectResidualClose(Number(await page.getByTestId('onelab-residual').innerText()), reference.residual)
  expect(Number(await page.getByTestId('onelab-residual').innerText())).toBeLessThan(Number(await page.getByTestId('onelab-initial-residual').innerText()) * 1e-12)
  await expect(page.getByTestId('onelab-scalar')).toContainText('samples')
  await expect(page.getByTestId('onelab-vector')).toContainText('samples')
  const scalar = JSON.parse(await page.getByTestId('onelab-scalar').innerText()) as typeof reference.scalar
  const vector = JSON.parse(await page.getByTestId('onelab-vector').innerText()) as typeof reference.vector
  expect(scalar.samples).toBe(reference.scalar.samples)
  expect(vector.samples).toBe(reference.vector.samples)
  for (const key of ['min', 'max', 'mean'] as const) expectScalarAggregateClose(scalar[key], reference.scalar[key])
  for (const key of ['min', 'max', 'mean'] as const) expectVectorClose(vector[key], reference.vector[key])
  const samples = JSON.parse(await page.getByTestId('onelab-samples').innerText()) as typeof reference.samples
  expect(samples.map(({ key }) => key)).toEqual(reference.samples.map(({ key }) => key))
  samples.forEach((sample, index) => {
    const expected = reference.samples[index]
    sample.coordinate.forEach((value, component) => expect(Math.abs(value - expected.coordinate[component])).toBeLessThanOrEqual(reference.tolerance.coordinateAbsolute))
    expectScalarSampleClose(sample.scalar, expected.scalar)
    sample.vector.forEach((value, component) => expectVectorClose(value, expected.vector[component]))
    expectVectorClose(sample.magnitude, expected.magnitude)
  })

  await page.getByTestId('onelab-solve').click()
  await expect(page.getByTestId('onelab-runs')).toHaveText('2')

  const oldWorker = await page.getByTestId('onelab-worker').getAttribute('data-worker-id')
  await page.getByTestId('onelab-solve').click()
  const cancelledRequest = await page.getByTestId('onelab-worker').getAttribute('data-request-id')
  expect(cancelledRequest).toBeTruthy()
  await expect(page.getByTestId('onelab-worker')).toHaveAttribute('data-request-id', cancelledRequest!)
  await expect(page.getByTestId('onelab-worker')).toHaveAttribute('data-native-operation', 'getdp-solve')
  await expect(page.getByTestId('onelab-worker')).toHaveAttribute('data-request-id', cancelledRequest!)
  await page.getByTestId('onelab-cancel').click()
  await expect(page.getByTestId('onelab-state')).toHaveAttribute('data-state', 'cancelled')
  await page.waitForTimeout(250)
  await expect(page.getByTestId('onelab-runs')).toHaveText('2')
  await expect(page.getByTestId('onelab-state')).toHaveAttribute('data-state', 'cancelled')

  await page.getByTestId('onelab-solve').click()
  await expect(page.getByTestId('onelab-worker')).not.toHaveAttribute('data-request-id', cancelledRequest!)
  await expect.poll(async () => {
    const state = await page.getByTestId('onelab-state').getAttribute('data-state')
    if (state === 'error') throw new Error(await page.getByRole('alert').innerText())
    return state
  }).toBe('complete')
  await expect(page.getByTestId('onelab-runs')).toHaveText('3')
  const newWorker = await page.getByTestId('onelab-worker').getAttribute('data-worker-id')
  expect(newWorker).toBeTruthy()
  expect(newWorker).not.toBe(oldWorker)
})
