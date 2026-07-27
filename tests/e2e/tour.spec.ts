import { expect, test, type Page } from '@playwright/test'

const FULL_LESSON = '/tour/units/physical-quantities'
const QUICK_LESSON = `${FULL_LESSON}?path=quick`
const LESSON_SECTION_HASHES = ['#question', '#observe', '#explain', '#equation-ladder', '#try', '#interpret']
const SCIENTIFIC_NUMBER = /[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/i

interface QuickStationCase {
  id: string
  path: string
  simulationId: string
  minutes: 3 | 4
  instrumentTestId: string
  predictionTestId: string
  revealTestId: string
  resultTestId: string
  staleTestId: string
  resetTestId: string
  assertResult: (page: Page) => Promise<void>
  changeInput: (page: Page) => Promise<void>
}

interface InstrumentCase {
  name: string
  path: string
  instrumentTestId: string
  predictionTestId: string
  revealTestId: string
  resultTestId: string
  svgTestId?: string
}

async function gotoLesson(page: Page, path = FULL_LESSON): Promise<void> {
  await page.goto(path)
  await expect(page.getByTestId('app-ready')).toBeVisible()
  await expect(page.getByTestId('tour-lesson-ready')).toBeVisible()
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
}

async function expectFiniteOutput(page: Page, testId: string): Promise<number> {
  const text = await page.getByTestId(testId).innerText()
  const match = text.match(SCIENTIFIC_NUMBER)
  expect(match, `${testId} should expose a finite numeric output`).not.toBeNull()
  const value = Number(match![0])
  expect(Number.isFinite(value), `${testId} should expose a finite numeric output`).toBe(true)
  return value
}

const quickStations: QuickStationCase[] = [
  {
    id: 'anchors-scales',
    path: '/tour/units/physical-quantities?path=quick',
    simulationId: 'dimensional-equation-builder',
    minutes: 4,
    instrumentTestId: 'dimension-builder',
    predictionTestId: 'prediction-matches-target',
    revealTestId: 'reveal-dimension-result',
    resultTestId: 'dimension-result',
    staleTestId: 'prediction-stale',
    resetTestId: 'reset-dimension-builder',
    assertResult: async (page) => {
      await expect(page.getByTestId('operation-status')).toHaveText('Defined')
      await expect(page.getByTestId('target-match')).toContainText('Dimensions match')
      await expectFiniteOutput(page, 'coordinate-value')
    },
    changeInput: async (page) => page.getByTestId('preset-force-from-motion').click(),
  },
  {
    id: 'unit-bridges',
    path: '/tour/unit-bridges/photon-equivalent-scales?path=quick',
    simulationId: 'photon-scale-converter',
    minutes: 3,
    instrumentTestId: 'photon-bridge',
    predictionTestId: 'photon-prediction-wavelength-falls',
    revealTestId: 'reveal-photon-bridge',
    resultTestId: 'photon-bridge-result',
    staleTestId: 'photon-prediction-stale',
    resetTestId: 'reset-photon-bridge',
    assertResult: async (page) => {
      await expectFiniteOutput(page, 'photon-frequency-result')
      await expect(page.getByTestId('photon-equivalence-caveat')).toContainText('not photon rest mass')
      await expect(page.getByTestId('photon-equivalence-caveat')).toContainText('not a thermodynamic state')
    },
    changeInput: async (page) => page.getByTestId('photon-preset-x-ray').click(),
  },
  {
    id: 'electrical-standards',
    path: '/tour/electrical-standards/quantum-electrical-standards?path=quick',
    simulationId: 'electrical-standards-network',
    minutes: 3,
    instrumentTestId: 'electrical-standards-network',
    predictionTestId: 'electrical-prediction-mixed-status',
    revealTestId: 'reveal-electrical-standards',
    resultTestId: 'electrical-standards-result',
    staleTestId: 'electrical-prediction-stale',
    resetTestId: 'reset-electrical-standards',
    assertResult: async (page) => {
      await expectFiniteOutput(page, 'electrical-charge-result')
      await expect(page.getByTestId('electrical-standards-table')).toContainText('current exact SI')
      await expect(page.getByTestId('electrical-standards-table')).toContainText('Historical 1990 conventional value')
    },
    changeInput: async (page) => {
      await page.locator('.tour-lesson-controls').getByTestId('reading-depth-technical').check()
      await page.getByTestId('electrical-preset-josephson').click()
      await expect(page.getByTestId('electrical-frequency')).toBeEnabled()
      expect(Number(await page.getByTestId('electrical-frequency').inputValue())).toBeGreaterThan(0)
      await expect(page.getByTestId('electrical-direction-results')).toContainText('Josephson voltage from frequency')
    },
  },
  {
    id: 'atoms-materials',
    path: '/tour/atomic-structure/hydrogen-spectra?path=quick',
    simulationId: 'hydrogen-spectrum-explorer',
    minutes: 4,
    instrumentTestId: 'atomic-spectrum-explorer',
    predictionTestId: 'atomic-prediction-longer',
    revealTestId: 'reveal-atomic-result',
    resultTestId: 'atomic-result',
    staleTestId: 'atomic-prediction-stale',
    resetTestId: 'reset-atomic-explorer',
    assertResult: async (page) => {
      const proton = await expectFiniteOutput(page, 'atomic-proton-comparison-wavelength')
      const infinite = await expectFiniteOutput(page, 'atomic-infinite-comparison-wavelength')
      expect(proton).toBeGreaterThan(infinite)
      await expect(page.getByTestId('atomic-prediction-comparison')).toContainText('The two align')
    },
    changeInput: async (page) => page.getByTestId('atomic-upper').fill('4'),
  },
  {
    id: 'particles-mass',
    path: '/tour/particle-scales/particle-mass-scales?path=quick',
    simulationId: 'particle-scale-comparator',
    minutes: 3,
    instrumentTestId: 'particle-scale-comparator',
    predictionTestId: 'particle-prediction-state-derived',
    revealTestId: 'reveal-particle-result',
    resultTestId: 'particle-result',
    staleTestId: 'particle-prediction-stale',
    resetTestId: 'reset-particle-comparator',
    assertResult: async (page) => {
      await expectFiniteOutput(page, 'particle-rest-energy')
      await expectFiniteOutput(page, 'particle-de-broglie')
      await expect(page.getByTestId('particle-prediction-comparison')).toContainText('momentum-state-derived outputs')
    },
    changeInput: async (page) => {
      const before = await page.getByTestId('particle-de-broglie').innerText()
      await page.getByTestId('particle-momentum').fill('2')
      await expect(page.getByTestId('particle-de-broglie')).not.toHaveText(before)
    },
  },
  {
    id: 'spin-magnetism',
    path: '/tour/spin-magnetism/spin-precession?path=quick',
    simulationId: 'spin-precession-visualizer',
    minutes: 3,
    instrumentTestId: 'spin-precession-visualizer',
    predictionTestId: 'spin-prediction-clockwise',
    revealTestId: 'reveal-spin-result',
    resultTestId: 'spin-result',
    staleTestId: 'spin-prediction-stale',
    resetTestId: 'reset-spin-visualizer',
    assertResult: async (page) => {
      expect(await expectFiniteOutput(page, 'spin-cyclic-frequency')).toBeGreaterThan(0)
      await expect(page.getByTestId('spin-prediction-comparison')).toContainText('Result: clockwise')
      await expect(page.getByTestId('spin-text-alternative')).toContainText('not a measured spin trajectory')
    },
    changeInput: async (page) => {
      await page.getByTestId('spin-particle').selectOption('electron')
      expect(await expectFiniteOutput(page, 'spin-cyclic-frequency')).toBeLessThan(0)
      await expect(page.getByTestId('spin-result')).toContainText('counterclockwise')
    },
  },
  {
    id: 'heat-radiation',
    path: '/tour/heat-matter/blackbody-radiation?path=quick',
    simulationId: 'blackbody-spectrum',
    minutes: 4,
    instrumentTestId: 'blackbody-spectrum',
    predictionTestId: 'blackbody-prediction-shorter-t4',
    revealTestId: 'reveal-blackbody-result',
    resultTestId: 'blackbody-result',
    staleTestId: 'blackbody-prediction-stale',
    resetTestId: 'reset-blackbody',
    assertResult: async (page) => {
      await expectFiniteOutput(page, 'blackbody-peak-value')
      await expectFiniteOutput(page, 'blackbody-exitance-value')
      await expect(page.getByTestId('blackbody-prediction-comparison')).toContainText('peak shifts to shorter wavelength')
      await expect(page.getByTestId('blackbody-prediction-comparison')).toContainText('^4')
    },
    changeInput: async (page) => page.getByTestId('blackbody-preset-room').click(),
  },
  {
    id: 'molar-matter',
    path: '/tour/heat-matter/particle-to-mole?path=quick',
    simulationId: 'particle-to-mole-scaler',
    minutes: 3,
    instrumentTestId: 'molar-matter-scaler',
    predictionTestId: 'molar-prediction-all-linear',
    revealTestId: 'reveal-molar-result',
    resultTestId: 'molar-result',
    staleTestId: 'molar-prediction-stale',
    resetTestId: 'reset-molar',
    assertResult: async (page) => {
      await expect(page.getByTestId('molar-prediction-comparison')).toContainText('entity-count ratio 2')
      await expect(page.getByTestId('molar-prediction-comparison')).toContainText('mass ratio 2')
      await expect(page.getByTestId('molar-doubling-table')).toContainText('2x at the same T and p')
    },
    changeInput: async (page) => page.getByTestId('molar-amount').fill('2'),
  },
]

const instruments: InstrumentCase[] = [
  { name: 'dimension builder', path: FULL_LESSON, instrumentTestId: 'dimension-builder', predictionTestId: 'prediction-matches-target', revealTestId: 'reveal-dimension-result', resultTestId: 'dimension-result' },
  { name: 'scale ruler', path: '/tour/anchors/clocks-action-light-gravity', instrumentTestId: 'scale-ruler', predictionTestId: 'scale-prediction-near-zero', revealTestId: 'reveal-scale-ruler', resultTestId: 'scale-ruler-result', svgTestId: 'scale-ruler-svg' },
  { name: 'photon bridge', path: quickStations[1]!.path, instrumentTestId: 'photon-bridge', predictionTestId: 'photon-prediction-wavelength-falls', revealTestId: 'reveal-photon-bridge', resultTestId: 'photon-bridge-result', svgTestId: 'photon-bridge-svg' },
  { name: 'electrical standards', path: quickStations[2]!.path, instrumentTestId: 'electrical-standards-network', predictionTestId: 'electrical-prediction-mixed-status', revealTestId: 'reveal-electrical-standards', resultTestId: 'electrical-standards-result', svgTestId: 'electrical-standards-svg' },
  { name: 'atomic spectrum', path: quickStations[3]!.path, instrumentTestId: 'atomic-spectrum-explorer', predictionTestId: 'atomic-prediction-longer', revealTestId: 'reveal-atomic-result', resultTestId: 'atomic-result', svgTestId: 'atomic-svg' },
  { name: 'particle scales', path: quickStations[4]!.path, instrumentTestId: 'particle-scale-comparator', predictionTestId: 'particle-prediction-state-derived', revealTestId: 'reveal-particle-result', resultTestId: 'particle-result', svgTestId: 'particle-svg' },
  { name: 'spin precession', path: quickStations[5]!.path, instrumentTestId: 'spin-precession-visualizer', predictionTestId: 'spin-prediction-clockwise', revealTestId: 'reveal-spin-result', resultTestId: 'spin-result', svgTestId: 'spin-svg' },
  { name: 'black-body spectrum', path: quickStations[6]!.path, instrumentTestId: 'blackbody-spectrum', predictionTestId: 'blackbody-prediction-shorter-t4', revealTestId: 'reveal-blackbody-result', resultTestId: 'blackbody-result', svgTestId: 'blackbody-spectrum-svg' },
  { name: 'molar matter', path: quickStations[7]!.path, instrumentTestId: 'molar-matter-scaler', predictionTestId: 'molar-prediction-all-linear', revealTestId: 'reveal-molar-result', resultTestId: 'molar-result', svgTestId: 'molar-flow-svg' },
]

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

test('orientation exposes all eight content-ready quick stations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('tour-ready')).toBeVisible()

  await expect(page.locator('.tour-station-tick')).toHaveCount(8)
  await expect(page.locator('.tour-station-link')).toHaveCount(8)
  await expect(page.locator('.tour-station-planned')).toHaveCount(0)
  await expect(page.locator('.tour-station-link small:first-of-type')).toHaveText(quickStations.map(({ minutes }) => `${minutes} min / content-ready`))
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

for (const station of quickStations) {
  test(`${station.id} completes its prediction-first quick-station journey`, async ({ page }) => {
    const simulationResponse = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith(`/data/generated/tour/simulations/${station.simulationId}.json`))
    await gotoLesson(page, station.path)
    await simulationResponse

    await expect(page.getByText(`Quick station / ${station.minutes} min`, { exact: true })).toBeVisible()
    await expect(page.getByTestId(station.instrumentTestId)).toBeVisible()
    await expect(page.getByTestId(station.revealTestId)).toBeDisabled()
    await page.getByTestId(station.predictionTestId).check()
    await page.getByTestId(station.revealTestId).click()
    await expect(page.getByTestId(station.resultTestId)).toBeVisible()
    await station.assertResult(page)

    await station.changeInput(page)
    await expect(page.getByTestId(station.staleTestId)).toBeVisible()
    await expect(page.getByTestId(station.predictionTestId)).not.toBeChecked()

    await page.getByTestId(station.resetTestId).click()
    await expect(page.getByTestId(station.resultTestId)).toHaveCount(0)
    await expect(page.getByTestId(station.staleTestId)).toHaveCount(0)
    await expect(page.getByTestId(station.revealTestId)).toBeDisabled()
  })
}

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

test('the full map reports eight ready chapters, nine lessons, and 12 honest planned chapters', async ({ page }) => {
  await page.goto('/tour')
  await expect(page.getByTestId('tour-map-ready')).toBeVisible()
  await expect(page.locator('.tour-act')).toHaveCount(4)
  await expect(page.locator('.tour-chapter-spine li')).toHaveCount(20)
  await expect(page.locator('.tour-chapter-spine small').filter({ hasText: /^Available/ })).toHaveCount(8)
  await expect(page.locator('.tour-chapter-spine small').filter({ hasText: /^Planned overview/ })).toHaveCount(12)
  expect(await page.evaluate(() => window.__OPENSIMPHY_AUDIT__?.tour)).toEqual(expect.objectContaining({
    status: 'ready',
    manifest: { chapters: 20, lessons: 9, simulations: 9, quickStations: 8 },
  }))

  await page.getByRole('link', { name: /Units, Dimensions, and Physical Quantities/ }).click()
  await expect(page.getByRole('heading', { name: 'Units, Dimensions, and Physical Quantities' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Physical quantities/ })).toHaveAttribute('href', FULL_LESSON)

  await page.goto('/tour/evidence')
  await expect(page.getByRole('heading', { name: 'Reproduction Is Not Validation' })).toBeVisible()
  await expect(page.getByText('Planned chapter', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'This chapter is on the field-course roadmap' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lessons' })).toHaveCount(0)
})

test('sequential lesson and chapter links swap all nine instruments without leaking local state', async ({ page }) => {
  const resultIds = instruments.map(({ resultTestId }) => resultTestId)
  const expectCleanInstrument = async (instrument: InstrumentCase, previousTestId?: string) => {
    await expect(page.getByTestId('tour-lesson-ready')).toBeVisible()
    await expect(page.getByTestId(instrument.instrumentTestId)).toBeVisible()
    if (previousTestId) await expect(page.getByTestId(previousTestId)).toHaveCount(0)
    for (const resultId of resultIds) await expect(page.getByTestId(resultId)).toHaveCount(0)
    await expect(page.getByTestId(instrument.instrumentTestId).locator('input[type="radio"]:checked')).toHaveCount(0)
  }
  const openOnlyLesson = async (path: string) => {
    await page.locator(`a[href="${path}"]`).click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
  }

  await gotoLesson(page)
  await revealDimensionResult(page, 'matches-target')
  await page.getByRole('navigation', { name: 'Tour lesson navigation' }).getByRole('link', { name: /^Next chapter:/ }).click()
  await expect(page.getByRole('heading', { name: 'Measurement, Uncertainty, and Standards' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Adjacent Tour chapters' }).getByRole('link', { name: 'Next chapter' }).click()
  await expect(page.getByRole('heading', { name: 'Anatomy of a Formula Recipe' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Adjacent Tour chapters' }).getByRole('link', { name: 'Next chapter' }).click()
  await expect(page.getByRole('heading', { name: 'Clocks, Action, Light, and Gravity' })).toBeVisible()
  await openOnlyLesson('/tour/anchors/clocks-action-light-gravity')
  await expectCleanInstrument(instruments[1]!, instruments[0]!.instrumentTestId)
  await expect(page.getByTestId('scale-family')).toHaveValue('length')

  for (let index = 2; index < instruments.length - 2; index += 1) {
    const instrument = instruments[index]!
    const previous = instruments[index - 1]!
    await page.getByRole('navigation', { name: 'Tour lesson navigation' }).getByRole('link', { name: /^Next chapter:/ }).click()
    await openOnlyLesson(instrument.path.replace('?path=quick', ''))
    await expectCleanInstrument(instrument, previous.instrumentTestId)
  }

  const blackbody = instruments[7]!
  const molar = instruments[8]!
  await page.getByRole('navigation', { name: 'Tour lesson navigation' }).getByRole('link', { name: /^Next chapter:/ }).click()
  await openOnlyLesson(blackbody.path.replace('?path=quick', ''))
  await expectCleanInstrument(blackbody, instruments[6]!.instrumentTestId)
  await page.getByRole('navigation', { name: 'Tour lesson navigation' }).getByRole('link', { name: 'Next lesson' }).click()
  await expectCleanInstrument(molar, blackbody.instrumentTestId)
  await page.getByRole('navigation', { name: 'Tour lesson navigation' }).getByRole('link', { name: 'Previous lesson' }).click()
  await expectCleanInstrument(blackbody, molar.instrumentTestId)
  await page.getByRole('navigation', { name: 'Tour lesson navigation' }).getByRole('link', { name: 'Next lesson' }).click()
  await expectCleanInstrument(molar, blackbody.instrumentTestId)
})

test('the deep anchors scale ruler preserves status and evidence distinctions', async ({ page }) => {
  await gotoLesson(page, '/tour/anchors/clocks-action-light-gravity')
  await page.getByTestId('scale-preset-planck-length').click()
  await page.getByTestId('scale-prediction-negative').check()
  await page.getByTestId('reveal-scale-ruler').click()

  await expectFiniteOutput(page, 'scale-selected-value')
  await expect(page.getByTestId('scale-result-status')).toHaveText('COMPUTED')
  await expect(page.getByTestId('scale-ruler-table')).toContainText('Exact defined reference')
  await expect(page.getByTestId('scale-ruler-table')).toContainText('Measured or adjusted')
  await expect(page.getByTestId('scale-ruler-table')).toContainText('Derived from measured value')
  await expect(page.getByTestId('scale-evidence-refs').getByRole('link')).not.toHaveCount(0)
  await expect(page.getByTestId('scale-normalization-caveat')).toContainText('not predictions')
})

test('returns from a Formula record to the exact quick-path lesson context', async ({ page }) => {
  await gotoLesson(page, '/tour/units/physical-quantities?path=quick')
  await page.getByRole('link', { name: 'Formula Delta_nu_Cs, opens Formula record' }).click()
  await expect(page.getByTestId('formula-record-ready')).toBeVisible()
  await expect(page).toHaveURL(/\/atlas\/Delta_nu_Cs\?returnTo=/)
  await page.getByTestId('tour-return').click()
  await expect(page).toHaveURL(/\/tour\/units\/physical-quantities\?path=quick#interpret$/)
  await expect(page.getByTestId('tour-lesson-ready')).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'Local Notebook' })).toBeVisible()
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

test('orientation and map reflow at 320px without document overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/')
  await expect(page.getByTestId('tour-ready')).toBeVisible()
  await expectNoDocumentOverflow(page)
  await page.goto('/tour')
  await expect(page.getByTestId('tour-map-ready')).toBeVisible()
  await expectNoDocumentOverflow(page)
})

for (const instrument of instruments) {
  test(`${instrument.name} supports keyboard, 320px/400% reflow, target size, reduced motion, and forced colors`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' })
    await gotoLesson(page, instrument.path)
    const root = page.getByTestId(instrument.instrumentTestId)
    await expect(root).toBeVisible()
    await expectNoDocumentOverflow(page)

    const targets = await root.locator('button, select, input[type="range"]').evaluateAll((elements) => elements
      .filter((element) => {
        const style = getComputedStyle(element)
        const box = element.getBoundingClientRect()
        return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0
      })
      .map((element) => {
        const box = element.getBoundingClientRect()
        return { testId: element.getAttribute('data-testid'), width: box.width, height: box.height }
      }))
    expect(targets.length).toBeGreaterThan(0)
    for (const target of targets) {
      expect.soft(target.width, `${instrument.name} ${target.testId ?? 'target'} width`).toBeGreaterThanOrEqual(44)
      expect.soft(target.height, `${instrument.name} ${target.testId ?? 'target'} height`).toBeGreaterThanOrEqual(44)
    }

    await page.getByTestId(instrument.predictionTestId).focus()
    await page.keyboard.press('Space')
    await page.getByTestId(instrument.revealTestId).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId(instrument.resultTestId)).toBeVisible()
    if (instrument.svgTestId) await expect(page.getByTestId(instrument.svgTestId)).toHaveAttribute('role', 'img')
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true)
    await expectNoDocumentOverflow(page)
  })
}
