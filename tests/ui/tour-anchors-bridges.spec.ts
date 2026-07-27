import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ElectricalStandardsNetwork from '../../src/components/tour/ElectricalStandardsNetwork.vue'
import PhotonBridge from '../../src/components/tour/PhotonBridge.vue'
import ScaleRuler from '../../src/components/tour/ScaleRuler.vue'
import type { ElectricalStandardsEvaluation } from '../../src/tour/electricalStandardsEngine'
import type { PhotonBridgeEvaluation } from '../../src/tour/photonBridgeEngine'
import type { ScaleRulerEvaluation } from '../../src/tour/scaleRulerEngine'
import type { ReadingDepth, TourGeneratedSimulation } from '../../src/types/tour'
import electricalJson from '../../public/data/generated/tour/simulations/electrical-standards-network.json'
import photonJson from '../../public/data/generated/tour/simulations/photon-scale-converter.json'
import scaleJson from '../../public/data/generated/tour/simulations/physical-scale-ruler.json'

function fresh(source: object): TourGeneratedSimulation {
  return structuredClone(source) as unknown as TourGeneratedSimulation
}

function mountScale(depth: ReadingDepth = 'guided', initialPresetId?: string) {
  return mount(ScaleRuler, { props: { simulation: fresh(scaleJson), depth, ...(initialPresetId ? { initialPresetId } : {}) } })
}

function mountPhoton(depth: ReadingDepth = 'guided', initialPresetId?: string) {
  return mount(PhotonBridge, { props: { simulation: fresh(photonJson), depth, ...(initialPresetId ? { initialPresetId } : {}) } })
}

function mountElectrical(depth: ReadingDepth = 'guided', initialPresetId?: string) {
  return mount(ElectricalStandardsNetwork, { props: { simulation: fresh(electricalJson), depth, ...(initialPresetId ? { initialPresetId } : {}) } })
}

describe('Tour physical anchors and bridges instruments', () => {
  it('fails closed when ID, revision, control, or preset contracts drift', () => {
    const wrongScale = fresh(scaleJson)
    wrongScale.id = 'other-ruler'
    const failedScale = mount(ScaleRuler, { props: { simulation: wrongScale, depth: 'guided' } })
    expect(failedScale.get('[role="alert"]').text()).toContain('cannot run')
    expect(failedScale.find('[data-testid="scale-control-family"]').exists()).toBe(false)
    expect(failedScale.emitted('evaluated')).toBeUndefined()

    const wrongPhoton = fresh(photonJson)
    wrongPhoton.revision.implementationRevision = 'future-bridge'
    const failedPhoton = mount(PhotonBridge, { props: { simulation: wrongPhoton, depth: 'guided' } })
    expect(failedPhoton.get('[role="alert"]').text()).toContain('revision')
    expect(failedPhoton.find('[data-testid="photon-control-frequency"]').exists()).toBe(false)

    const wrongElectrical = fresh(electricalJson)
    wrongElectrical.presets[0]!.inputs.voltageV = -1
    const failedElectrical = mount(ElectricalStandardsNetwork, { props: { simulation: wrongElectrical, depth: 'guided' } })
    expect(failedElectrical.get('[role="alert"]').text()).toContain('outside')
    expect(failedElectrical.find('[data-testid="electrical-control-preset"]').exists()).toBe(false)

    const wrongInitial = mountPhoton('guided', 'undeclared-source')
    expect(wrongInitial.get('[role="alert"]').text()).toContain('not declared')

    const wrongCompatibility = fresh(scaleJson)
    wrongCompatibility.comparison.compatibilityKey = 'stale-key'
    expect(mount(ScaleRuler, { props: { simulation: wrongCompatibility, depth: 'guided' } }).get('[role="alert"]').text()).toContain('runtime contract')

    const wrongUnit = fresh(electricalJson)
    wrongUnit.outputSchema[3]!.unit = 'Hz'
    expect(mount(ElectricalStandardsNetwork, { props: { simulation: wrongUnit, depth: 'technical' } }).get('[role="alert"]').text()).toContain('output schema')
  })

  it.each([
    [ScaleRuler, scaleJson, 'scale-ruler-error'],
    [PhotonBridge, photonJson, 'photon-bridge-error'],
    [ElectricalStandardsNetwork, electricalJson, 'electrical-standards-error'],
  ] as const)('rejects prompt and exact runtime drift for an owned bridge validator', (component, source, errorTestId) => {
    for (const mutate of [
      (simulation: TourGeneratedSimulation) => { simulation.predictionPrompt += ' Changed.' },
      (simulation: TourGeneratedSimulation) => { if (simulation.limits.tier === 'immediate') simulation.limits.maxOperations += 1 },
      (simulation: TourGeneratedSimulation) => { if (simulation.limits.tier === 'immediate') simulation.limits.maxDurationMs += 1 },
    ]) {
      const simulation = fresh(source)
      mutate(simulation)
      const wrapper = mount(component, { props: { simulation, depth: 'guided' } })
      expect(wrapper.get(`[data-testid="${errorTestId}"]`).attributes('role')).toBe('alert')
    }
  })

  it('requires predictions, reveals without scoring, marks live changes stale, and resets each instrument', async () => {
    const scale = mountScale()
    expect(scale.get('[data-testid="reveal-scale-ruler"]').attributes()).toHaveProperty('disabled')
    await scale.get('[data-testid="scale-prediction-near-zero"]').setValue(true)
    await scale.get('[data-testid="reveal-scale-ruler"]').trigger('click')
    expect(scale.find('[data-testid="scale-ruler-result"]').exists()).toBe(true)
    await scale.get('[data-testid="scale-family"]').setValue('time')
    await nextTick()
    expect(scale.get('[data-testid="scale-prediction-stale"]').text()).toContain('not compared')
    expect(scale.get('[data-testid="scale-prediction-comparison"]').text()).toBe('')
    await scale.get('[data-testid="reset-scale-ruler"]').trigger('click')
    expect(scale.find('[data-testid="scale-ruler-result"]').exists()).toBe(false)
    expect((scale.get('[data-testid="scale-family"]').element as HTMLSelectElement).value).toBe('length')

    const photon = mountPhoton()
    expect(photon.get('[data-testid="reveal-photon-bridge"]').attributes()).toHaveProperty('disabled')
    await photon.get('[data-testid="photon-prediction-wavelength-falls"]').setValue(true)
    await photon.get('[data-testid="reveal-photon-bridge"]').trigger('click')
    await photon.get('[data-testid="photon-frequency"]').setValue(1e10)
    expect(photon.get('[data-testid="photon-prediction-stale"]').text()).toContain('not compared')
    await photon.get('[data-testid="reset-photon-bridge"]').trigger('click')
    expect(photon.find('[data-testid="photon-bridge-result"]').exists()).toBe(false)
    expect((photon.get('[data-testid="photon-frequency"]').element as HTMLInputElement).value).toBe('500000000000000')

    const electrical = mountElectrical()
    expect(electrical.get('[data-testid="reveal-electrical-standards"]').attributes()).toHaveProperty('disabled')
    await electrical.get('[data-testid="electrical-prediction-mixed-status"]').setValue(true)
    await electrical.get('[data-testid="reveal-electrical-standards"]').trigger('click')
    await electrical.get('[data-testid="electrical-voltage"]').setValue(2)
    expect(electrical.get('[data-testid="electrical-prediction-stale"]').text()).toContain('not compared')
    await electrical.get('[data-testid="reset-electrical-standards"]').trigger('click')
    expect(electrical.find('[data-testid="electrical-standards-result"]').exists()).toBe(false)
    expect((electrical.get('[data-testid="electrical-voltage"]').element as HTMLInputElement).value).toBe('1')

    for (const wrapper of [scale, photon, electrical]) {
      expect(wrapper.text().toLowerCase()).not.toMatch(/score|mastery|points|streak/)
      expect(wrapper.findAll('.tour-touch-target').every((target) => target.classes().includes('tour-touch-target'))).toBe(true)
    }
  })

  it('uses generated scale presets and two Guided controls across Planck, laboratory, human, and astronomical scales', async () => {
    const wrapper = mountScale('guided', 'planck-mass')
    expect(wrapper.findAll('[data-testid^="scale-control-"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="scale-technical-disclosure"]').exists()).toBe(false)
    expect((wrapper.get('[data-testid="scale-family"]').element as HTMLSelectElement).value).toBe('mass')
    expect((wrapper.get('[data-testid="scale-selection"]').element as HTMLSelectElement).value).toBe('planck-mass')
    expect(wrapper.text()).toContain('Start at human height')
    expect(wrapper.text()).toContain('Inspect the Planck length')
    expect(wrapper.text()).toContain('Invert the clock anchor')

    await wrapper.get('[data-testid="scale-preset-caesium-period"]').trigger('click')
    expect((wrapper.get('[data-testid="scale-family"]').element as HTMLSelectElement).value).toBe('time')
    expect(wrapper.get('[data-testid="scale-inspection-prompt"]').text()).toBe(scaleJson.presets[2]!.inspectionPrompt)
    expect(wrapper.text()).toContain(scaleJson.controls[0]!.playfulPrompt)

    await wrapper.get('[data-testid="scale-family"]').setValue('length')
    await nextTick()
    expect(wrapper.get('[data-testid="scale-selection"]').text()).toContain('Planck length')
    expect(wrapper.get('[data-testid="scale-selection"]').text()).toContain('Human height scale')
    expect(wrapper.get('[data-testid="scale-selection"]').text()).toContain('Earth mean radius')
    expect(wrapper.get('[data-testid="scale-selection"]').text()).toContain('Astronomical unit')

    await wrapper.setProps({ depth: 'technical' })
    expect(wrapper.get('[data-testid="scale-technical-disclosure"]').text()).toContain('measured G')
  })

  it('renders the scale ruler key values, status distinctions, SVG alternative, and normalization boundary', async () => {
    const wrapper = mountScale('guided', 'planck-length')
    await wrapper.get('[data-testid="scale-prediction-negative"]').setValue(true)
    await wrapper.get('[data-testid="reveal-scale-ruler"]').trigger('click')

    const output = wrapper.emitted<ScaleRulerEvaluation[]>('evaluated')![0]![0]!
    expect(output.selected.id).toBe('planck-length')
    expect(output.selectedLog10).toBeLessThan(-34)
    expect(wrapper.get('[data-testid="scale-ruler-svg"]').attributes('role')).toBe('img')
    expect(wrapper.get('[data-testid="scale-ruler-svg"]').attributes('aria-labelledby')).toBeTruthy()
    expect(wrapper.get('[data-testid="scale-ruler-table"]').findAll('tbody tr')).toHaveLength(9)
    expect(wrapper.get('[data-testid="scale-ruler-table"]').findAll('tbody th[scope="row"]')).toHaveLength(9)
    expect(wrapper.text()).toContain('Exact defined reference')
    expect(wrapper.text()).toContain('Exact derived value')
    expect(wrapper.text()).toContain('Measured or adjusted')
    expect(wrapper.text()).toContain('Derived from measured value')
    expect(wrapper.text()).toContain('Illustrative scale')
    expect(wrapper.text()).toContain('Astronomical unit definition (149,597,870,700 m exact)')
    expect(wrapper.text()).toContain('Exact SI speed of light and Julian-year convention')
    expect(wrapper.text()).toContain('Parsec geometry (648,000/pi astronomical units)')
    expect(wrapper.text()).not.toContain('IAU 2015 Resolution B3 astronomical conventions')
    expect(wrapper.text()).toContain('CODATA 2022 recommended values')
    expect(wrapper.text()).toContain('OpenSimPhy internal illustrative scope')
    expect(wrapper.get('[data-testid="scale-ruler-table"]').findAll('.scale-ruler-row-evidence')).toHaveLength(9)
    expect(wrapper.get('[data-testid="scale-ruler-table"]').findAll('.scale-ruler-row-evidence a').length).toBeGreaterThanOrEqual(9)
    expect(wrapper.get('[data-testid="scale-prediction-comparison"]').text()).toContain('Computed position shown in this activity')
    expect(wrapper.text()).not.toContain('Observed')
    expect(wrapper.get('[data-testid="scale-normalization-caveat"]').text()).toContain('not predictions')
  })

  it('uses all generated photon presets, one Guided control, and Technical disclosure', async () => {
    const wrapper = mountPhoton('guided', 'visible-blue')
    expect(wrapper.findAll('[data-testid^="photon-control-"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="photon-technical-disclosure"]').exists()).toBe(false)
    expect((wrapper.get('[data-testid="photon-frequency"]').element as HTMLInputElement).value).toBe(String(photonJson.presets[2]!.inputs.frequencyHz))
    expect(wrapper.text()).toContain('Radio')
    expect(wrapper.text()).toContain('Microwave')
    expect(wrapper.text()).toContain('Visible blue')
    expect(wrapper.text()).toContain('X-ray')
    expect(wrapper.text()).toContain('Gamma ray')

    await wrapper.get('[data-testid="photon-preset-x-ray"]').trigger('click')
    expect(wrapper.get('[data-testid="photon-inspection-prompt"]').text()).toBe(photonJson.presets[3]!.inspectionPrompt)
    expect(wrapper.text()).toContain(photonJson.controls[0]!.playfulPrompt)
    await wrapper.setProps({ depth: 'technical' })
    expect(wrapper.get('[data-testid="photon-technical-disclosure"]').text()).toContain('No input-frequency uncertainty')
  })

  it('links all five photon quantities with key blue-light values and explicit equivalence caveats', async () => {
    const wrapper = mountPhoton('guided', 'visible-blue')
    await wrapper.get('[data-testid="photon-prediction-wavelength-falls"]').setValue(true)
    await wrapper.get('[data-testid="reveal-photon-bridge"]').trigger('click')

    const output = wrapper.emitted<PhotonBridgeEvaluation[]>('evaluated')![0]![0]!
    expect(output.vacuumWavelengthM).toBeCloseTo(450e-9, 20)
    expect(output.photonEnergyJ).toBeGreaterThan(4e-19)
    expect(output.equivalentMassKg).toBeGreaterThan(4e-36)
    expect(output.equivalentTemperatureK).toBeGreaterThan(3e4)
    expect(wrapper.get('[data-testid="photon-bridge-svg"]').attributes('role')).toBe('img')
    expect(wrapper.get('[data-testid="photon-bridge-svg"]').findAll('.photon-bridge-lane')).toHaveLength(5)
    expect(wrapper.get('[data-testid="photon-bridge-table"]').findAll('tbody tr')).toHaveLength(5)
    expect(wrapper.get('[data-testid="photon-equivalence-caveat"]').text()).toContain('not photon rest mass')
    expect(wrapper.get('[data-testid="photon-equivalence-caveat"]').text()).toContain('not a thermodynamic state')
    expect(wrapper.get('[data-testid="photon-equivalence-caveat"]').text()).toContain('algebraically dependent linked representations')
    expect(wrapper.text()).not.toContain('independent logarithmic lanes')
    expect(wrapper.text()).not.toContain('Observed')
  })

  it('keeps three Guided electrical controls and exposes the fourth generated control at Technical depth', async () => {
    const wrapper = mountElectrical('guided', 'josephson')
    expect(wrapper.findAll('[data-testid^="electrical-control-"]')).toHaveLength(3)
    expect(wrapper.find('[data-testid="electrical-control-frequency"]').exists()).toBe(false)
    expect((wrapper.get('[data-testid="electrical-view"]').element as HTMLSelectElement).value).toBe('josephson')
    expect((wrapper.get('[data-testid="electrical-carriers"]').element as HTMLInputElement).value).toBe('2')
    expect((wrapper.get('[data-testid="electrical-voltage"]').element as HTMLInputElement).value).toBe('0.001')
    expect(wrapper.text()).toContain('Single electron at one volt')
    expect(wrapper.text()).toContain('Josephson voltage path')
    expect(wrapper.text()).toContain('Quantum Hall identity path')

    await wrapper.setProps({ depth: 'technical' })
    expect(wrapper.findAll('[data-testid^="electrical-control-"]')).toHaveLength(4)
    expect(wrapper.get('[data-testid="electrical-control-frequency"]').text()).toContain('V = f/K_J')
    expect((wrapper.get('[data-testid="electrical-frequency"]').element as HTMLInputElement).value).toBe('70000000000')
    expect(wrapper.get('[data-testid="electrical-technical-disclosure"]').text()).toContain('No calibration certificate')
    await wrapper.get('[data-testid="electrical-prediction-mixed-status"]').setValue(true)
    await wrapper.get('[data-testid="reveal-electrical-standards"]').trigger('click')
    const output = wrapper.emitted<ElectricalStandardsEvaluation[]>('evaluated')![0]![0]!
    expect(output.josephsonVoltageFromFrequencyV).toBeGreaterThan(1e-4)
    expect(wrapper.get('[data-testid="electrical-direction-results"]').text()).toContain('Josephson frequency from voltage')
    expect(wrapper.get('[data-testid="electrical-direction-results"]').text()).toContain('Josephson voltage from frequency')
    expect(wrapper.get('[data-testid="electrical-network-status"]').text()).toBe('exact-input-dependent-and-historical-layers-separated')
    expect(wrapper.text()).not.toContain('Observed')

    const inactive = mountElectrical('technical', 'hall')
    expect((inactive.get('[data-testid="electrical-frequency"]').element as HTMLInputElement).value).toBe('0')
    expect(inactive.get('[data-testid="electrical-frequency"]').attributes()).toHaveProperty('disabled')
    expect(inactive.get('[data-testid="electrical-control-frequency"]').text()).toContain('inactive and fixed at zero')
    await inactive.get('[data-testid="electrical-prediction-mixed-status"]').setValue(true)
    await inactive.get('[data-testid="reveal-electrical-standards"]').trigger('click')
    const inactiveOutput = inactive.emitted<ElectricalStandardsEvaluation[]>('evaluated')![0]![0]!
    expect(inactiveOutput.josephsonFrequencyFromVoltageHz).toBeNull()
    expect(inactiveOutput.josephsonVoltageFromFrequencyV).toBeNull()
    expect(inactive.get('[data-testid="electrical-direction-results"]').text()).toContain('Not computed outside the Josephson view')
  })

  it('renders h/e identity edges, current versus 1990 values, and no inferred-residual validation', async () => {
    const wrapper = mountElectrical('guided', 'hall')
    await wrapper.get('[data-testid="electrical-prediction-mixed-status"]').setValue(true)
    await wrapper.get('[data-testid="reveal-electrical-standards"]').trigger('click')

    const output = wrapper.emitted<ElectricalStandardsEvaluation[]>('evaluated')![0]![0]!
    expect(output.nodes.find(({ id }) => id === 'KJ')?.value).toBeGreaterThan(4.8e14)
    expect(output.nodes.find(({ id }) => id === 'RK')?.value).toBeGreaterThan(25_000)
    expect(output.historicalComparisons[0]!.partsPerMillion).toBeGreaterThan(0)
    expect(output.historicalComparisons[1]!.partsPerMillion).toBeLessThan(0)
    expect(wrapper.get('[data-testid="electrical-standards-svg"]').attributes('role')).toBe('img')
    expect(wrapper.get('[data-testid="electrical-standards-svg"]').findAll('.electrical-network-node').length).toBeGreaterThanOrEqual(10)
    expect(wrapper.get('[data-testid="electrical-standards-table"]').findAll('tbody tr')).toHaveLength(output.nodes.length)
    expect(wrapper.get('[data-testid="electrical-standards-table"]').text()).toContain('Historical 1990 conventional value')
    expect(wrapper.get('[data-testid="electrical-standards-table"]').text()).toContain('current exact SI')
    expect(wrapper.get('[data-testid="electrical-realization-caveat"]').text()).toContain('do not make a practical')
    expect(wrapper.get('[data-testid="electrical-validation-boundary"]').text()).toContain('No inferred residual')
    expect(output.finding.evidenceRefs).toContain('cipm-1988-electrical-conventional-values')
    expect(wrapper.get('[data-testid="electrical-evidence-refs"] a[href="#reference-cipm-1988-electrical-conventional-values"]').text())
      .toBe('cipm-1988-electrical-conventional-values')
  })

  it('renders full runtime provenance, evidence links, and non-validation boundaries', async () => {
    const cases = [
      { wrapper: mountScale(), prediction: '[data-testid="scale-prediction-near-zero"]', reveal: '[data-testid="reveal-scale-ruler"]', finding: '[data-testid="scale-ruler-finding"]', evidence: '[data-testid="scale-evidence-refs"]', boundary: '[data-testid="scale-validation-boundary"]' },
      { wrapper: mountPhoton(), prediction: '[data-testid="photon-prediction-wavelength-falls"]', reveal: '[data-testid="reveal-photon-bridge"]', finding: '[data-testid="photon-bridge-finding"]', evidence: '[data-testid="photon-evidence-refs"]', boundary: '[data-testid="photon-validation-boundary"]' },
      { wrapper: mountElectrical(), prediction: '[data-testid="electrical-prediction-mixed-status"]', reveal: '[data-testid="reveal-electrical-standards"]', finding: '[data-testid="electrical-standards-finding"]', evidence: '[data-testid="electrical-evidence-refs"]', boundary: '[data-testid="electrical-validation-boundary"]' },
    ]

    for (const testCase of cases) {
      await testCase.wrapper.get(testCase.prediction).setValue(true)
      await testCase.wrapper.get(testCase.reveal).trigger('click')
      const finding = testCase.wrapper.get(testCase.finding)
      expect(finding.text()).toContain('Runtime result status')
      expect(finding.text()).toContain('Claim class')
      expect(finding.text()).toContain('Model origin')
      expect(finding.text()).toContain('Method relationship')
      expect(finding.text()).toContain('Validates theory')
      expect(finding.text()).toContain('Source revision')
      expect(finding.text()).toContain('Source locator')
      expect(finding.text()).toContain('What changed')
      expect(finding.text()).toContain('Does not establish')
      expect(finding.text()).toContain('Caveats')
      expect(testCase.wrapper.get(testCase.evidence).findAll('a').every((link) => link.attributes('href')?.startsWith('#reference-'))).toBe(true)
      expect(testCase.wrapper.get(testCase.boundary).text().toLowerCase()).toContain('validation')
    }
  })

  it('never mutates generated simulation sources while applying presets and evaluating', async () => {
    const scaleSource = fresh(scaleJson)
    const photonSource = fresh(photonJson)
    const electricalSource = fresh(electricalJson)
    const originals = [structuredClone(scaleSource), structuredClone(photonSource), structuredClone(electricalSource)]
    const scale = mount(ScaleRuler, { props: { simulation: scaleSource, depth: 'technical' } })
    const photon = mount(PhotonBridge, { props: { simulation: photonSource, depth: 'technical' } })
    const electrical = mount(ElectricalStandardsNetwork, { props: { simulation: electricalSource, depth: 'technical' } })

    await scale.get('[data-testid="scale-preset-planck-mass"]').trigger('click')
    await scale.get('[data-testid="scale-prediction-positive"]').setValue(true)
    await scale.get('[data-testid="reveal-scale-ruler"]').trigger('click')
    await photon.get('[data-testid="photon-preset-gamma"]').trigger('click')
    await photon.get('[data-testid="photon-prediction-wavelength-falls"]').setValue(true)
    await photon.get('[data-testid="reveal-photon-bridge"]').trigger('click')
    await electrical.get('[data-testid="electrical-preset-josephson"]').trigger('click')
    await electrical.get('[data-testid="electrical-frequency"]').setValue(70e9)
    await electrical.get('[data-testid="electrical-prediction-mixed-status"]').setValue(true)
    await electrical.get('[data-testid="reveal-electrical-standards"]').trigger('click')

    expect(scaleSource).toEqual(originals[0])
    expect(photonSource).toEqual(originals[1])
    expect(electricalSource).toEqual(originals[2])
  })

  it('initializes clean state from dispatcher-style remount keys', async () => {
    const firstScale = mountScale('guided', 'planck-length')
    await firstScale.get('[data-testid="scale-prediction-negative"]').setValue(true)
    await firstScale.get('[data-testid="reveal-scale-ruler"]').trigger('click')
    firstScale.unmount()
    const remountedScale = mountScale('guided', 'planck-mass')
    expect((remountedScale.get('[data-testid="scale-family"]').element as HTMLSelectElement).value).toBe('mass')
    expect(remountedScale.find('[data-testid="scale-ruler-result"]').exists()).toBe(false)

    const firstPhoton = mountPhoton('guided', 'radio')
    await firstPhoton.get('[data-testid="photon-prediction-wavelength-falls"]').setValue(true)
    await firstPhoton.get('[data-testid="reveal-photon-bridge"]').trigger('click')
    firstPhoton.unmount()
    const remountedPhoton = mountPhoton('guided', 'gamma')
    expect((remountedPhoton.get('[data-testid="photon-frequency"]').element as HTMLInputElement).value).toBe(String(photonJson.presets[4]!.inputs.frequencyHz))
    expect(remountedPhoton.find('[data-testid="photon-bridge-result"]').exists()).toBe(false)

    const firstElectrical = mountElectrical('technical', 'josephson')
    await firstElectrical.get('[data-testid="electrical-frequency"]').setValue(1e12)
    firstElectrical.unmount()
    const remountedElectrical = mountElectrical('technical', 'hall')
    expect((remountedElectrical.get('[data-testid="electrical-view"]').element as HTMLSelectElement).value).toBe('hall')
    expect((remountedElectrical.get('[data-testid="electrical-frequency"]').element as HTMLInputElement).value).toBe('0')
    expect(remountedElectrical.find('[data-testid="electrical-standards-result"]').exists()).toBe(false)
  })
})
