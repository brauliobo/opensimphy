import { expect, test } from '@playwright/test'
import reference from '../../tools/wasm/fixtures/microstrip-reference.json' with { type: 'json' }
import artifactLock from '../../tools/wasm/artifacts.lock.json' with { type: 'json' }

const defaultReference = reference.runs[0]

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
  await expect(page.getByTestId('onelab-mesh')).toContainText(`${defaultReference.nodes} nodes / ${defaultReference.elements} elements`)
  await expect(page.getByTestId('onelab-dofs')).toHaveText(String(defaultReference.degreesOfFreedom))
  expectResidualClose(Number(await page.getByTestId('onelab-initial-residual').innerText()), defaultReference.initialResidual)
  expectResidualClose(Number(await page.getByTestId('onelab-residual').innerText()), defaultReference.residual)
  expect(Number(await page.getByTestId('onelab-residual').innerText())).toBeLessThan(Number(await page.getByTestId('onelab-initial-residual').innerText()) * 1e-12)
  await expect(page.getByTestId('onelab-scalar')).toContainText('samples')
  await expect(page.getByTestId('onelab-vector')).toContainText('samples')
  await expect(page.getByTestId('result-viewer')).toBeVisible()
  const solvedScene = await page.evaluate(() => {
    const fields = [...document.querySelectorAll<HTMLOptionElement>('[data-testid="result-field"] option')].map((option) => option.textContent)
    const summary = JSON.parse(document.querySelector<HTMLOutputElement>('[data-testid="result-viewer"] [data-testid="viewer-render-summary"]')!.value)
    return { fields, summary }
  })
  expect(solvedScene.fields).toContain('v / node')
  expect(solvedScene.fields).toContain('e / element')
  expect(solvedScene.summary.result.deformationScale).toBe(0)
  await page.getByTestId('result-field').selectOption({ label: 'e / element' })
  await expect.poll(async () => JSON.parse(await page.getByTestId('result-viewer').getByTestId('viewer-render-summary').innerText()).result.glyphs).toBe(768)
  const glyphMetadata = JSON.parse(await page.getByTestId('result-viewer').getByTestId('viewer-render-summary').innerText()).result
  expect(glyphMetadata.sceneDiagonal).toBeGreaterThan(0)
  for (const length of glyphMetadata.glyphLengthRange) {
    expect(length / glyphMetadata.sceneDiagonal).toBeGreaterThanOrEqual(0.003)
    expect(length / glyphMetadata.sceneDiagonal).toBeLessThanOrEqual(0.04)
  }
  expect(glyphMetadata.glyphRadiusRange[0] / glyphMetadata.glyphLengthRange[0]).toBeCloseTo(0.12)
  expect(glyphMetadata.glyphRadiusRange[1] / glyphMetadata.glyphLengthRange[1]).toBeCloseTo(0.12)
  const mapped = await page.evaluate(() => {
    const host = document.querySelector('[data-testid="result-viewer"]')!
    return {
      fields: [...host.querySelectorAll<HTMLOptionElement>('[data-testid="result-field"] option')].map((option) => option.textContent),
      legend: [...host.querySelectorAll('[data-testid="result-legend"] span')].map((span) => Number(span.textContent)),
    }
  })
  expect(mapped.fields).toEqual(expect.arrayContaining(['v / node', 'e / element', 'd / element', 'e_cut / independent']))
  expectVectorClose(mapped.legend[0]!, defaultReference.vector.min)
  expectVectorClose(mapped.legend[1]!, defaultReference.vector.max)
  const mappedFields = JSON.parse(await page.getByTestId('mapped-field-summary').innerText())
  expect(mappedFields.find(({ name }: { name: string }) => name === 'v')).toMatchObject({ association: 'node', samples: 727, globalRange: [0, 0.001] })
  expect(mappedFields.find(({ name }: { name: string }) => name === 'e')).toMatchObject({ association: 'element', samples: 1337 })
  const resultSceneSummary = await page.evaluate(() => {
    const text = document.querySelector<HTMLOutputElement>('[data-testid="mapped-field-summary"]')!.value
    const viewer = document.querySelector('[data-testid="result-viewer"]')!
    return { fields: JSON.parse(text), controls: viewer.querySelectorAll('[data-testid^="result-"]').length }
  })
  expect(resultSceneSummary.controls).toBeGreaterThanOrEqual(5)
  const sceneTags = await page.evaluate(() => JSON.parse(document.querySelector<HTMLOutputElement>('[data-testid="mapped-scene-summary"]')!.value))
  expect(sceneTags).toMatchObject({ nodes: 727, nodeTagsUnique: true, elementTagsUnique: true, connectivityValid: true, nodeClassificationComplete: true })
  expect(sceneTags.physicalGroups).toEqual(expect.arrayContaining([
    expect.objectContaining({ dimension: 2, tag: 1, name: 'Air', entityTags: [15] }),
    expect.objectContaining({ dimension: 2, tag: 2, name: 'Dielectric', entityTags: [13] }),
  ]))
  const spatialProbes = JSON.parse(await page.getByTestId('mapped-spatial-probes').innerText()) as typeof defaultReference.probes
  spatialProbes.forEach((probe, index) => {
    const expected = defaultReference.probes[index]
    expectScalarSampleClose(probe.scalar, expected.scalar)
    probe.vector.forEach((value, component) => expectVectorClose(value, expected.vector[component]))
  })
  const scalar = JSON.parse(await page.getByTestId('onelab-scalar').innerText()) as typeof defaultReference.scalar
  const vector = JSON.parse(await page.getByTestId('onelab-vector').innerText()) as typeof defaultReference.vector
  expect(scalar.samples).toBe(defaultReference.scalar.samples)
  expect(vector.samples).toBe(defaultReference.vector.samples)
  for (const key of ['min', 'max', 'mean'] as const) expectScalarAggregateClose(scalar[key], defaultReference.scalar[key])
  for (const key of ['min', 'max', 'mean'] as const) expectVectorClose(vector[key], defaultReference.vector[key])
  const samples = JSON.parse(await page.getByTestId('onelab-samples').innerText()) as typeof defaultReference.samples
  expect(samples.map(({ key }) => key)).toEqual(defaultReference.samples.map(({ key }) => key))
  samples.forEach((sample, index) => {
    const expected = defaultReference.samples[index]
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

test('checks parser metadata, computes two native meshes, preserves edits through cancellation and resets defaults', async ({ page }) => {
  await page.goto('/labs/onelab')
  await page.getByTestId('onelab-warm').click()
  await expect(page.getByTestId('onelab-state')).toHaveAttribute('data-state', 'ready')

  const meshSize = page.getByTestId('parameter-global-mesh-size-factor').locator('input')
  const workflow = page.getByTestId('parameter-workflow').locator('select')
  const label = page.getByTestId('parameter-label')
  const derived = page.getByTestId('parameter-derived-substrate-target-[m]')
  await expect(meshSize).toHaveAttribute('min', '0.5')
  await expect(meshSize).toHaveAttribute('max', '2')
  await expect(meshSize).toHaveAttribute('step', '0.5')
  await expect(derived.locator('input')).toHaveAttribute('readonly', '')
  await expect(label.locator('select')).toHaveValue('upstream tutorial')

  await workflow.selectOption('1')
  await page.getByTestId('onelab-check').click()
  await expect(page.getByTestId('onelab-state')).toHaveAttribute('data-state', 'complete')
  await expect(page.getByTestId('onelab-runs')).toHaveCount(0)
  await expect(label).toBeHidden()
  await expect(derived).toBeHidden()

  await workflow.selectOption('0')
  await meshSize.fill('1')
  await page.getByTestId('onelab-solve').click()
  await expect(page.getByTestId('onelab-runs')).toHaveText('1')
  const firstMesh = await page.getByTestId('onelab-mesh').innerText()
  const firstSamples = await page.getByTestId('onelab-samples').innerText()
  const firstMeshHash = firstMesh.split(' / ').at(-1)
  expect(firstMeshHash).toBe(defaultReference.meshSha256)

  await meshSize.fill('2')
  await page.getByTestId('onelab-solve').click()
  await expect(page.getByTestId('onelab-runs')).toHaveText('2')
  const secondReference = reference.runs[1]
  const secondMesh = await page.getByTestId('onelab-mesh').innerText()
  expect(secondMesh).toContain(`${secondReference.nodes} nodes / ${secondReference.elements} elements`)
  expect(secondMesh).not.toBe(firstMesh)
  expect(secondMesh.split(' / ').at(-1)).toBe(secondReference.meshSha256)
  await expect(page.getByTestId('result-field').locator('option', { hasText: 'v / node' })).toHaveCount(1)
  await expect(page.getByTestId('result-field').locator('option', { hasText: 'e / element' })).toHaveCount(1)
  const remappedFields = JSON.parse(await page.getByTestId('mapped-field-summary').innerText())
  expect(remappedFields.find(({ name }: { name: string }) => name === 'v')).toMatchObject({ association: 'node', samples: 233, globalRange: [0, 0.001], provenance: { representation: 'list', sourceFile: 'v.pos' } })
  const remappedVector = remappedFields.find(({ name }: { name: string }) => name === 'e')
  expect(remappedVector).toMatchObject({ association: 'element', samples: 403, provenance: { representation: 'list', sourceFile: 'e.pos' } })
  expectVectorClose(remappedVector.globalRange[0], secondReference.vector.min)
  expectVectorClose(remappedVector.globalRange[1], secondReference.vector.max)
  const remappedScene = JSON.parse(await page.getByTestId('mapped-scene-summary').innerText())
  expect(remappedScene).toMatchObject({ nodes: 233, nodeTagsUnique: true, elementTagsUnique: true, connectivityValid: true, regionTags: [0] })
  expect(remappedScene.physicalGroups).toEqual(expect.arrayContaining([
    expect.objectContaining({ dimension: 2, tag: 1, name: 'Air' }), expect.objectContaining({ dimension: 2, tag: 2, name: 'Dielectric' }),
  ]))
  const remappedProbes = JSON.parse(await page.getByTestId('mapped-spatial-probes').innerText()) as typeof secondReference.probes
  remappedProbes.forEach((probe, index) => {
    expectScalarSampleClose(probe.scalar, secondReference.probes[index].scalar)
    probe.vector.forEach((value, component) => expectVectorClose(value, secondReference.probes[index].vector[component]))
  })
  const exports = JSON.parse(await page.getByTestId('mapped-export-summary').innerText())
  expect(exports.find(({ id }: { id: string }) => id.startsWith('v-'))).toMatchObject({ csvRows: 234, posRecords: 233, hasTime: true })
  expect(exports.find(({ id }: { id: string }) => id.startsWith('e-'))).toMatchObject({ csvRows: 404, posRecords: 403, hasTime: true })
  expect(exports.find(({ id }: { id: string }) => id.startsWith('e_cut-'))).toMatchObject({ csvRows: 62, posRecords: 61, hasTime: true })
  await expect(page.getByTestId('onelab-dofs')).toHaveText(String(secondReference.degreesOfFreedom))
  expectResidualClose(Number(await page.getByTestId('onelab-initial-residual').innerText()), secondReference.initialResidual)
  expectResidualClose(Number(await page.getByTestId('onelab-residual').innerText()), secondReference.residual)
  const secondSamples = JSON.parse(await page.getByTestId('onelab-samples').innerText()) as typeof secondReference.samples
  expect(JSON.stringify(secondSamples)).not.toBe(firstSamples)
  secondSamples.forEach((sample, index) => {
    const expected = secondReference.samples[index]
    sample.coordinate.forEach((value, component) => expect(Math.abs(value - expected.coordinate[component])).toBeLessThanOrEqual(reference.tolerance.coordinateAbsolute))
    expectScalarSampleClose(sample.scalar, expected.scalar)
    sample.vector.forEach((value, component) => expectVectorClose(value, expected.vector[component]))
    expectVectorClose(sample.magnitude, expected.magnitude)
  })

  const oldWorker = await page.getByTestId('onelab-worker').getAttribute('data-worker-id')
  await meshSize.fill('0.5')
  await page.getByTestId('onelab-solve').click()
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('[data-testid="onelab-cancel"]')!
    button.disabled = false
    button.click()
  })
  await expect(page.getByTestId('onelab-state')).toHaveAttribute('data-state', 'cancelled')
  await expect(meshSize).toHaveValue('0.5')
  await expect(page.getByTestId('onelab-result')).toHaveCount(0)
  await meshSize.fill('2')
  await page.getByTestId('onelab-solve').click()
  await expect(page.getByTestId('onelab-runs')).toHaveText('3')
  const newWorker = await page.getByTestId('onelab-worker').getAttribute('data-worker-id')
  expect(newWorker).not.toBe(oldWorker)
  await expect(meshSize).toHaveValue('2')

  await page.getByTestId('onelab-reset').click()
  await expect(page.getByTestId('onelab-state')).toHaveAttribute('data-state', 'complete')
  await expect(meshSize).toHaveValue('1')
  await expect(page.getByTestId('onelab-result')).toHaveCount(0)
  await page.getByTestId('onelab-solve').click()
  await expect(page.getByTestId('onelab-runs')).toHaveText('4')
  await expect(page.getByTestId('onelab-mesh')).toContainText(`${defaultReference.nodes} nodes / ${defaultReference.elements} elements`)
  expect((await page.getByTestId('onelab-mesh').innerText()).split(' / ').at(-1)).toBe(defaultReference.meshSha256)
})

test('converts the committed STEP in a worker and hands a uniquely matched face to live Gmsh authority', async ({ page }) => {
  await page.goto('/labs/onelab')
  await expect(page.getByTestId('app-ready')).toBeVisible()
  await page.getByTestId('viewer-load').click()
  await expect.poll(async () => {
    const state = await page.getByTestId('viewer-state').getAttribute('data-state')
    if (state === 'error') throw new Error(await page.getByRole('alert').innerText())
    return state
  }).toBe('ready')
  await expect(page.getByTestId('viewer-source')).toHaveText('meshstep-preview')
  await expect(page.getByTestId('viewer-matches')).toHaveText('6 unique surface matches')
  await expect(page.getByTestId('scene-canvas')).toBeVisible()

  const previewSummary = JSON.parse(await page.getByTestId('viewer-preview-summary').innerText())
  const gmshSummary = JSON.parse(await page.getByTestId('viewer-authoritative-summary').innerText())
  expect(previewSummary.bounds.dimensions).toEqual([20, 20, 20])
  expect(gmshSummary.bounds).toEqual({ min: [-10, -10, 0], max: [10, 10, 20], dimensions: [20, 20, 20] })
  expect(gmshSummary.nodes).toBeGreaterThan(8)
  expect(gmshSummary.triangles).toBeGreaterThan(12)
  expect(gmshSummary.entityCounts).toEqual([8, 12, 6, 1])
  expect(gmshSummary.blockDimensions).toEqual([0, 1, 2, 3])
  expect(gmshSummary.nodeTagsUnique).toBe(true)
  expect(gmshSummary.elementTagsUnique).toBe(true)
  expect(gmshSummary.connectivityValid).toBe(true)
  expect(gmshSummary.nodeClassificationComplete).toBe(true)
  expect(gmshSummary.surfaceEntityTags).toEqual([101, 102, 103, 104, 105, 106])
  expect(gmshSummary.regionTags).toEqual([201])
  expect(gmshSummary.physicalGroups.filter(({ dimension }: { dimension: number }) => dimension === 2)).toHaveLength(6)
  expect(gmshSummary.physicalGroups.find(({ dimension }: { dimension: number }) => dimension === 3)).toMatchObject({ tag: 401, name: 'cube-volume', entityTags: [201] })
  const correspondence = JSON.parse(await page.getByTestId('viewer-correspondence').innerText())
  expect(correspondence).toHaveLength(6)
  for (const { preview, authoritative } of correspondence) {
    expect(Math.abs(preview.area - authoritative.area)).toBeLessThan(1)
    expect(Math.hypot(...preview.centroid.map((value: number, axis: number) => value - authoritative.centroid[axis]))).toBeLessThan(0.01)
    expect(Math.abs(preview.normal.reduce((sum: number, value: number, axis: number) => sum + value * authoritative.normal[axis], 0))).toBeGreaterThan(0.999)
  }

  const canvas = page.getByTestId('scene-canvas')
  const box = await canvas.boundingBox()
  expect(box).toBeTruthy()
  await canvas.dispatchEvent('pointerdown', { pointerId: 7, isPrimary: true, button: 0, clientX: box!.x + 20, clientY: box!.y + 20 })
  await canvas.dispatchEvent('pointerup', { pointerId: 7, isPrimary: true, button: 0, clientX: box!.x + 40, clientY: box!.y + 20 })
  await expect(page.getByTestId('viewer-selection')).toContainText('Preview none')
  await expect(page.getByTestId('measurement-readout')).toHaveCount(0)
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width / 2 + 2, box!.y + box!.height / 2)
  await page.mouse.up()
  await expect(page.getByTestId('viewer-selection')).toContainText('Preview none')
  await expect(page.getByTestId('measurement-readout')).toHaveCount(0)
  await canvas.click({ position: { x: box!.width / 2, y: box!.height / 2 } })
  await expect(page.getByTestId('viewer-selection')).not.toContainText('Preview none')
  await page.getByTestId('viewer-handoff').click()
  await expect(page.getByTestId('viewer-source')).toHaveText('gmsh-authoritative')
  await expect(page.getByTestId('viewer-selection')).not.toContainText('Gmsh none')
  await expect(page.getByTestId('measurement-readout')).toHaveCount(0)

  const gmshBox = await canvas.boundingBox()
  await canvas.click({ position: { x: gmshBox!.width * 0.49, y: gmshBox!.height * 0.5 } })
  await canvas.click({ position: { x: gmshBox!.width * 0.51, y: gmshBox!.height * 0.5 } })
  await expect(page.getByTestId('measurement-readout')).toContainText('mm')

  const initialRender = JSON.parse(await page.getByTestId('viewer-render-summary').innerText())
  await page.getByTestId('scene-clip').click()
  await expect(page.getByTestId('scene-clip')).toHaveAttribute('aria-pressed', 'true')
  expect(JSON.parse(await page.getByTestId('viewer-render-summary').innerText()).clipped).toBe(true)
  await page.getByTestId('scene-explode').fill('3')
  const explodedRender = JSON.parse(await page.getByTestId('viewer-render-summary').innerText())
  expect(explodedRender.explosion).toBe(3)
  expect(explodedRender.positionSample).not.toEqual(initialRender.positionSample)
  expect(explodedRender.sourceSample).toEqual(initialRender.sourceSample)
  await page.getByTestId('scene-fit').click()
})

test('mobile controls remain usable and ten route cycles release all viewer resources', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/labs')
  for (let cycle = 0; cycle < 10; cycle++) {
    await page.getByTestId('onelab-nav').click()
    await expect(page).toHaveURL(/\/labs\/onelab$/)
    await expect(page.getByTestId('viewer-load')).toBeVisible()
    await page.getByTestId('viewer-load').click()
    await expect(page.getByTestId('viewer-state')).toHaveAttribute('data-state', 'ready')
    await expect(page.getByTestId('scene-fit')).toBeVisible()
    await page.getByTestId('scene-fit').click()
    await page.getByTestId('scene-clip').click()
    await page.getByTestId('nav-toggle').click()
    await page.getByRole('link', { name: '02 Labs' }).click()
    await expect(page.getByTestId('onelab-nav')).toBeVisible()
    await expect.poll(() => page.evaluate(() => ({
      diagnostics: window.__sceneDiagnostics,
      canvases: document.querySelectorAll('[data-testid="scene-canvas"]').length,
      overlays: document.querySelectorAll('[data-testid="scene-overlay"]').length,
    }))).toEqual({
      diagnostics: { hosts: 0, workers: 0, frames: 0, observers: 0, canvases: 0, overlays: 0, contexts: 0, geometries: 0, materials: 0 },
      canvases: 0,
      overlays: 0,
    })
  }
})

test('route-away terminates an active STEP import and cancels an active render frame', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { workers: 0, observers: 0, frames: 0, pointerListeners: 0, contextLosses: 0 }
    ;(window as any).__lifecycleSpies = state
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      private tracked = true
      constructor(...args: ConstructorParameters<typeof Worker>) { super(...args); state.workers++ }
      override terminate() { if (this.tracked) { this.tracked = false; state.workers-- }; super.terminate() }
    } as typeof Worker
    const NativeObserver = window.ResizeObserver
    window.ResizeObserver = class implements ResizeObserver {
      private observer: ResizeObserver
      private tracked = true
      constructor(callback: ResizeObserverCallback) { state.observers++; this.observer = new NativeObserver(callback) }
      observe(target: Element, options?: ResizeObserverOptions) { this.observer.observe(target, options) }
      unobserve(target: Element) { this.observer.unobserve(target) }
      disconnect() { if (this.tracked) { this.tracked = false; state.observers-- }; this.observer.disconnect() }
    }
    const nativeRaf = window.requestAnimationFrame.bind(window)
    const nativeCancel = window.cancelAnimationFrame.bind(window)
    const active = new Set<number>()
    window.requestAnimationFrame = (callback) => {
      const id = nativeRaf((time) => { active.delete(id); state.frames = active.size; callback(time) })
      active.add(id); state.frames = active.size; return id
    }
    window.cancelAnimationFrame = (id) => { active.delete(id); state.frames = active.size; nativeCancel(id) }
    const add = EventTarget.prototype.addEventListener
    const remove = EventTarget.prototype.removeEventListener
    const canvasListeners = new WeakMap<HTMLCanvasElement, Map<string, Set<EventListenerOrEventListenerObject>>>()
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (this instanceof HTMLCanvasElement && listener && String(type).startsWith('pointer')) {
        const types = canvasListeners.get(this) ?? new Map()
        const listeners = types.get(String(type)) ?? new Set()
        if (!listeners.has(listener)) { listeners.add(listener); state.pointerListeners++ }
        types.set(String(type), listeners); canvasListeners.set(this, types)
      }
      return add.call(this, type, listener, options)
    }
    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      if (this instanceof HTMLCanvasElement && listener && String(type).startsWith('pointer')) {
        const listeners = canvasListeners.get(this)?.get(String(type))
        if (listeners?.delete(listener)) state.pointerListeners--
      }
      return remove.call(this, type, listener, options)
    }
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const getExtension = prototype.getExtension
      prototype.getExtension = function(name: string) {
        const extension = getExtension.call(this, name) as any
        if (name === 'WEBGL_lose_context' && extension && !extension.__lifecycleTracked) {
          extension.__lifecycleTracked = true
          const loseContext = extension.loseContext.bind(extension)
          extension.loseContext = () => { state.contextLosses++; loseContext() }
        }
        return extension
      }
    }
  })
  await page.goto('/labs/onelab')
  await page.route('**/fixtures/cube/cube.step*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_000))
    await route.continue()
  })
  await page.getByTestId('viewer-load').click()
  await expect(page.getByTestId('viewer-state')).toHaveAttribute('data-state', 'loading')
  await page.getByRole('link', { name: '02 Labs' }).click()
  await expect(page.getByTestId('onelab-nav')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__sceneDiagnostics)).toEqual({ hosts: 0, workers: 0, frames: 0, observers: 0, canvases: 0, overlays: 0, contexts: 0, geometries: 0, materials: 0 })
  await expect.poll(() => page.evaluate(() => (window as any).__lifecycleSpies)).toMatchObject({ workers: 0, observers: 0, frames: 0, pointerListeners: 0 })

  await page.getByTestId('onelab-nav').click()
  await page.getByTestId('viewer-load').click()
  await expect(page.getByTestId('viewer-state')).toHaveAttribute('data-state', 'ready')
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-testid="scene-fit"]')!.click())
  await page.getByRole('link', { name: '02 Labs' }).click()
  await expect.poll(() => page.evaluate(() => window.__sceneDiagnostics)).toEqual({ hosts: 0, workers: 0, frames: 0, observers: 0, canvases: 0, overlays: 0, contexts: 0, geometries: 0, materials: 0 })
  await expect.poll(() => page.evaluate(() => (window as any).__lifecycleSpies)).toMatchObject({ workers: 0, observers: 0, frames: 0, pointerListeners: 0 })
})
