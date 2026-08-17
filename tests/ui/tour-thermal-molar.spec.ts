import { mount } from '@vue/test-utils'
import BlackbodySpectrum from '../../src/components/tour/BlackbodySpectrum.vue'
import MolarMatterScaler from '../../src/components/tour/MolarMatterScaler.vue'
import type { BlackbodyEvaluation } from '../../src/tour/blackbodyEngine'
import type { MolarMatterEvaluation } from '../../src/tour/molarMatterEngine'
import type { ReadingDepth, TourGeneratedSimulation } from '../../src/types/tour'
import blackbodyJson from '../../public/data/generated/tour/simulations/blackbody-spectrum.json'
import molarJson from '../../public/data/generated/tour/simulations/particle-to-mole-scaler.json'

function freshBlackbody(): TourGeneratedSimulation {
  return structuredClone(blackbodyJson) as unknown as TourGeneratedSimulation
}

function freshMolar(): TourGeneratedSimulation {
  return structuredClone(molarJson) as unknown as TourGeneratedSimulation
}

function mountBlackbody(depth: ReadingDepth = 'guided', initialPresetId?: string) {
  return mount(BlackbodySpectrum, {
    props: {
      simulation: freshBlackbody(),
      depth,
      ...(initialPresetId ? { initialPresetId } : {}),
    },
  })
}

function mountMolar(depth: ReadingDepth = 'guided', initialPresetId?: string) {
  return mount(MolarMatterScaler, {
    props: {
      simulation: freshMolar(),
      depth,
      ...(initialPresetId ? { initialPresetId } : {}),
    },
  })
}

async function revealBlackbody(wrapper: ReturnType<typeof mountBlackbody>, prediction = 'shorter-t4'): Promise<void> {
  await wrapper.get(`[data-testid="blackbody-prediction-${prediction}"]`).setValue(true)
  await wrapper.get('[data-testid="reveal-blackbody-result"]').trigger('click')
}

async function revealMolar(wrapper: ReturnType<typeof mountMolar>, prediction = 'all-linear'): Promise<void> {
  await wrapper.get(`[data-testid="molar-prediction-${prediction}"]`).setValue(true)
  await wrapper.get('[data-testid="reveal-molar-result"]').trigger('click')
}

describe('Tour black-body spectrum instrument', () => {
  it('uses generated presets and keeps Guided to temperature while Technical exposes the bounded grid', async () => {
    const wrapper = mountBlackbody('guided', 'incandescent')

    expect(wrapper.findAll('[data-testid^="blackbody-preset-"]')).toHaveLength(5)
    expect(wrapper.findAll('[data-testid^="blackbody-control-"]')).toHaveLength(1)
    expect((wrapper.get('[data-testid="blackbody-temperature"]').element as HTMLInputElement).value).toBe('2700')
    expect(wrapper.get('[data-testid="blackbody-inspection-prompt"]').text()).toBe(blackbodyJson.presets[2]!.inspectionPrompt)
    expect(wrapper.text()).toContain(blackbodyJson.controls[0]!.playfulPrompt)

    await wrapper.get('[data-testid="blackbody-preset-room"]').trigger('click')
    expect((wrapper.get('[data-testid="blackbody-temperature"]').element as HTMLInputElement).value).toBe('293.15')
    await wrapper.setProps({ depth: 'technical' })

    expect(wrapper.findAll('[data-testid^="blackbody-control-"]')).toHaveLength(4)
    expect(wrapper.get('[data-testid="blackbody-wavelength-minimum"]').attributes('min')).toBe('1e-9')
    expect(wrapper.get('[data-testid="blackbody-wavelength-maximum"]').attributes('max')).toBe('0.01')
    expect(wrapper.get('[data-testid="blackbody-sample-count"]').attributes('max')).toBe('256')
    expect(wrapper.get('[data-testid="blackbody-technical-disclosure"]').text()).toContain('emissivity is exactly 1')
    expect(wrapper.get('[data-testid="blackbody-technical-disclosure"]').text()).toContain('not loaded or measured data')
  })

  it('requires a prediction and renders numeric Wien/Stefan results as SVG, text, and a reduced table without scoring', async () => {
    const wrapper = mountBlackbody()
    expect(wrapper.get('[data-testid="reveal-blackbody-result"]').attributes()).toHaveProperty('disabled')
    expect(wrapper.get('[data-testid="blackbody-prediction-prompt"]').text()).toBe(blackbodyJson.predictionPrompt)
    expect(wrapper.get('[data-testid="blackbody-temperature-declaration"]').text()).toContain('Incandescent at 2700 K with Sun photosphere at 5772 K')

    await revealBlackbody(wrapper)

    const output = wrapper.emitted<BlackbodyEvaluation[]>('evaluated')![0]![0]!
    expect(output.temperatureKelvin).toBe(5_772)
    expect(output.wienPeakWavelengthMetres * 1e9).toBeCloseTo(502, 0)
    expect(output.stefanBoltzmannExitanceWattsPerSquareMetre).toBeGreaterThan(6e7)
    const comparison = wrapper.get('[data-testid="blackbody-prediction-comparison"]').text()
    expect(comparison).toContain('peak shifts to shorter wavelength')
    expect(comparison).toContain('equal to (2.13778)^4')
    expect(comparison).toContain('prediction aligns with the model')
    expect(wrapper.get('[data-testid="blackbody-temperature-comparison-table"]').findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.get('[data-testid="blackbody-spectrum-svg"]').attributes('role')).toBe('img')
    expect(wrapper.get('[data-testid="blackbody-spectrum-curve"]').attributes('points')!.split(' ')).toHaveLength(129)
    expect(wrapper.find('[data-testid="blackbody-peak-marker"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="blackbody-text-alternative"]').text()).toContain('not a measured spectrum or a color inference')
    expect(wrapper.get('[data-testid="blackbody-text-alternative"]').text()).toContain('chosen 380-750 nm visible interval')
    expect(wrapper.get('[data-testid="blackbody-spectrum-table"]').findAll('tbody tr')).toHaveLength(11)
    expect(wrapper.text().toLowerCase()).not.toMatch(/score|mastery|points|streak/)
  })

  it('updates revealed output as stale and resets to immutable source defaults', async () => {
    const simulation = freshBlackbody()
    const original = structuredClone(simulation)
    const wrapper = mount(BlackbodySpectrum, { props: { simulation, depth: 'technical', initialPresetId: 'room' } })
    await revealBlackbody(wrapper)

    await wrapper.get('[data-testid="blackbody-temperature"]').setValue(10_000)
    expect(wrapper.emitted('evaluated')).toHaveLength(2)
    expect(wrapper.get('[data-testid="blackbody-prediction-stale"]').text()).toContain('previous prediction is not compared')
    expect(wrapper.get('[data-testid="blackbody-prediction-comparison"]').text()).toBe('')
    expect(wrapper.findAll('[data-testid^="blackbody-prediction-"]:checked')).toHaveLength(0)

    await wrapper.get('[data-testid="reset-blackbody"]').trigger('click')
    expect((wrapper.get('[data-testid="blackbody-temperature"]').element as HTMLInputElement).value).toBe('5772')
    expect(wrapper.find('[data-testid="blackbody-result"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="reveal-blackbody-result"]').attributes()).toHaveProperty('disabled')
    expect(simulation).toEqual(original)
  })

  it('shows dynamic provenance, evidence, and the explicit non-validation boundary', async () => {
    const wrapper = mountBlackbody()
    await revealBlackbody(wrapper)
    const output = wrapper.emitted<BlackbodyEvaluation[]>('evaluated')![0]![0]!

    expect(wrapper.get('[data-testid="blackbody-finding-result-status"]').text()).toBe('COMPUTED')
    expect(wrapper.get('[data-testid="blackbody-provenance-revision"]').text()).toBe(output.finding.sourceRevision)
    expect(wrapper.get('[data-testid="blackbody-provenance-locator"]').text()).toBe(output.finding.sourceLocator)
    expect(wrapper.get('[data-testid="blackbody-evidence-refs"]').findAll('a').map((link) => link.attributes('href')))
      .toEqual(output.finding.evidenceRefs.map((reference) => `#reference-${reference}`))
    expect(output.finding.evidenceRefs).toContain('openstax-university-physics-v3')
    expect(wrapper.get('[data-testid="blackbody-does-not-establish"]').text()).toContain('measured spectrum')
    expect(wrapper.get('[data-testid="blackbody-does-not-establish"]').text()).toContain('color')
    expect(wrapper.get('[data-testid="blackbody-validation-boundary"]').text()).toContain('No empirical comparison or theory validation')
  })
})

describe('Tour molar-matter scaler instrument', () => {
  it('shows no more than three generated Guided controls and exposes Technical state, charge, and mass inputs', async () => {
    const wrapper = mountMolar()

    expect(wrapper.findAll('[data-testid^="molar-control-"]')).toHaveLength(3)
    expect(wrapper.text()).toContain(molarJson.controls[0]!.playfulPrompt)
    expect(wrapper.text()).toContain(molarJson.controls[1]!.playfulPrompt)
    expect(wrapper.get('[data-testid="molar-guided-state"]').text()).toContain('273.15 K')
    expect(wrapper.get('[data-testid="molar-guided-state"]').text()).toContain('101325 Pa')
    expect(wrapper.get('[data-testid="molar-prediction-prompt"]').text()).toBe(molarJson.predictionPrompt)
    expect(wrapper.get('[data-testid="molar-doubling-declaration"]').text()).toContain('Compare 1 mol with 2 mol')

    await wrapper.setProps({ depth: 'technical' })
    expect(wrapper.findAll('[data-testid^="molar-control-"]')).toHaveLength(7)
    expect(wrapper.find('[data-testid="molar-guided-state"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="molar-charge"]').attributes('step')).toBe('1')
    expect(wrapper.get('[data-testid="molar-pressure"]').attributes('max')).toBe('100000000')
    expect(wrapper.get('[data-testid="molar-technical-disclosure"]').text()).toContain('standard atmosphere is exactly 101325 Pa')
    expect(wrapper.get('[data-testid="molar-technical-disclosure"]').text()).toContain('current SI does not define carbon-12 molar mass as exactly 0.012 kg/mol')
  })

  it('applies the generated preset and renders only applicable count, mass, ideal-volume, and Faraday outputs', async () => {
    const wrapper = mountMolar('technical', 'standard-ideal-gas')
    await wrapper.get('[data-testid="molar-amount"]').setValue(2)
    await wrapper.get('[data-testid="molar-charge"]').setValue(1)
    await wrapper.get('[data-testid="molar-preset-standard-ideal-gas"]').trigger('click')

    expect((wrapper.get('[data-testid="molar-amount"]').element as HTMLInputElement).value).toBe('1')
    expect((wrapper.get('[data-testid="molar-charge"]').element as HTMLInputElement).value).toBe('0')
    expect(wrapper.get('[data-testid="molar-inspection-prompt"]').text()).toBe(molarJson.presets[0]!.inspectionPrompt)
    await revealMolar(wrapper)

    const output = wrapper.emitted<MolarMatterEvaluation[]>('evaluated')![0]![0]!
    expect(output.entityCount).toBeCloseTo(6.02214076e23, 8)
    expect(output.bulkMassKg).toBe(0.02897)
    expect(output.idealGasVolumeCubicMetres! * 1_000).toBeCloseTo(22.414, 3)
    expect(output.faradayChargeCoulombs).toBe(0)
    expect(wrapper.get('[data-testid="molar-flow-svg"]').attributes('role')).toBe('img')
    expect(wrapper.findAll('[data-flow-quantity]')).toHaveLength(4)
    expect(wrapper.get('[data-testid="molar-output-table"]').findAll('tbody tr')).toHaveLength(5)
    expect(wrapper.find('[data-quantity="ideal-gas-volume"]').exists()).toBe(true)
    expect(wrapper.find('[data-quantity="molar-energy"]').exists()).toBe(false)
    expect(wrapper.find('[data-quantity="sample-energy"]').exists()).toBe(false)
    const comparison = wrapper.get('[data-testid="molar-prediction-comparison"]').text()
    expect(comparison).toContain('entity-count ratio 2')
    expect(comparison).toContain('mass ratio 2')
    expect(comparison).toContain('ideal-gas-volume ratio 2 at the same temperature and pressure')
    expect(comparison).toContain('0 C to 0 C because z = 0')
    expect(comparison).toContain('prediction aligns with the dependent identities')
    const doublingTable = wrapper.get('[data-testid="molar-doubling-table"]')
    expect(doublingTable.findAll('tbody tr')).toHaveLength(4)
    expect(doublingTable.text()).toContain('2x at the same T and p')
    expect(doublingTable.text()).toContain('linear identity with z = 0')
    expect(wrapper.text().toLowerCase()).not.toMatch(/score|mastery|points|streak/)
  })

  it('marks live control changes stale, recomputes numeric results, and resets source defaults without mutation', async () => {
    const simulation = freshMolar()
    const original = structuredClone(simulation)
    const wrapper = mount(MolarMatterScaler, { props: { simulation, depth: 'technical' } })
    await revealMolar(wrapper)

    await wrapper.get('[data-testid="molar-amount"]').setValue(2)
    const emissions = wrapper.emitted<MolarMatterEvaluation[]>('evaluated')!
    expect(emissions).toHaveLength(2)
    expect(emissions[1]![0]!.entityCount).toBe(2 * emissions[0]![0]!.entityCount)
    expect(wrapper.get('[data-testid="molar-prediction-stale"]').text()).toContain('previous prediction is not compared')
    expect(wrapper.get('[data-testid="molar-prediction-comparison"]').text()).toBe('')

    await wrapper.get('[data-testid="reset-molar"]').trigger('click')
    expect((wrapper.get('[data-testid="molar-amount"]').element as HTMLInputElement).value).toBe('1')
    expect((wrapper.get('[data-testid="molar-temperature"]').element as HTMLInputElement).value).toBe('273.15')
    expect(wrapper.find('[data-testid="molar-result"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="reveal-molar-result"]').attributes()).toHaveProperty('disabled')
    expect(simulation).toEqual(original)
  })

  it('reports runtime caveats and provenance without presenting dependent conversions as validation', async () => {
    const wrapper = mountMolar('technical')
    await revealMolar(wrapper)
    const output = wrapper.emitted<MolarMatterEvaluation[]>('evaluated')![0]![0]!

    expect(wrapper.get('[data-testid="molar-finding-result-status"]').text()).toBe('COMPUTED')
    expect(wrapper.get('[data-testid="molar-provenance-revision"]').text()).toBe(output.finding.sourceRevision)
    expect(wrapper.get('[data-testid="molar-runtime-caveats"]').text()).toContain('exact convention 101325 Pa')
    expect(wrapper.get('[data-testid="molar-runtime-caveats"]').text()).toContain('ideal-gas law neglects interactions')
    expect(wrapper.get('[data-testid="molar-evidence-refs"]').findAll('a').map((link) => link.attributes('href')))
      .toEqual(output.finding.evidenceRefs.map((reference) => `#reference-${reference}`))
    expect(output.finding.evidenceRefs).toContain('iupac-green-book-3')
    expect(wrapper.get('[data-testid="molar-does-not-establish"]').text()).toContain('not empirical validation')
    expect(wrapper.get('[data-testid="molar-validation-boundary"]').text()).toContain('No empirical comparison or theory validation')
  })
})

describe('Tour thermal and molar contract boundaries', () => {
  it('fails closed on contract drift and emits no result', () => {
    const blackbody = freshBlackbody()
    blackbody.outputSchema.pop()
    const failedBlackbody = mount(BlackbodySpectrum, { props: { simulation: blackbody, depth: 'guided' } })
    expect(failedBlackbody.get('[data-testid="blackbody-contract-error"]').text()).toContain('cannot run')
    expect(failedBlackbody.find('[data-testid="blackbody-prediction-gate"]').exists()).toBe(false)
    expect(failedBlackbody.emitted('evaluated')).toBeUndefined()

    const wrongBlackbodyTier = freshBlackbody()
    wrongBlackbodyTier.limits = { tier: 'artifact', maxArtifactBytes: 256 }
    const failedTier = mount(BlackbodySpectrum, { props: { simulation: wrongBlackbodyTier, depth: 'guided' } })
    expect(failedTier.get('[data-testid="blackbody-contract-error"]').text()).toContain('runtime limit is incompatible')

    const molar = freshMolar()
    const gasControl = molar.controls.find(({ id }) => id === 'gasModel')
    if (gasControl?.type === 'select') gasControl.options.push({ value: 'none', label: 'No gas' })
    const failedMolar = mount(MolarMatterScaler, { props: { simulation: molar, depth: 'technical' } })
    expect(failedMolar.get('[data-testid="molar-contract-error"]').text()).toContain('cannot run')
    expect(failedMolar.find('[data-testid="molar-prediction-gate"]').exists()).toBe(false)
    expect(failedMolar.emitted('evaluated')).toBeUndefined()

    const incompatibleComparison = freshMolar()
    incompatibleComparison.comparison.compatibilityKey = '0'.repeat(64)
    const failedComparison = mount(MolarMatterScaler, { props: { simulation: incompatibleComparison, depth: 'guided' } })
    expect(failedComparison.get('[data-testid="molar-contract-error"]').text()).toContain('visualization or evidence boundary is incompatible')
  })

  it.each([
    [BlackbodySpectrum, freshBlackbody, 'blackbody-contract-error'],
    [MolarMatterScaler, freshMolar, 'molar-contract-error'],
  ] as const)('rejects prompt, runtime, revision, output-unit, and compatibility drift', (component, fresh, errorTestId) => {
    const mutations = [
      (simulation: TourGeneratedSimulation) => { simulation.predictionPrompt += ' Changed.' },
      (simulation: TourGeneratedSimulation) => { if (simulation.limits.tier === 'immediate') simulation.limits.maxOperations = 1 },
      (simulation: TourGeneratedSimulation) => { if (simulation.limits.tier === 'immediate') simulation.limits.maxDurationMs = 15 },
      (simulation: TourGeneratedSimulation) => { simulation.revision.contentRevision = 'stale-content' },
      (simulation: TourGeneratedSimulation) => { simulation.revision.modelRevision = 'stale-model' },
      (simulation: TourGeneratedSimulation) => { simulation.revision.implementationRevision = 'stale-implementation' },
      (simulation: TourGeneratedSimulation) => { simulation.outputSchema[0]!.unit = 'wrong-unit' },
      (simulation: TourGeneratedSimulation) => { simulation.comparison.compatibilityKey = 'stale-key' },
    ]

    for (const mutate of mutations) {
      const simulation = fresh()
      mutate(simulation)
      const wrapper = mount(component, { props: { simulation, depth: 'guided' } })
      expect(wrapper.get(`[data-testid="${errorTestId}"]`).attributes('role')).toBe('alert')
      expect(wrapper.emitted('evaluated')).toBeUndefined()
    }
  })
})
