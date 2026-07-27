import { mount, type VueWrapper } from '@vue/test-utils'
import AtomicSpectrumExplorer from '../../src/components/tour/AtomicSpectrumExplorer.vue'
import ParticleScaleComparator from '../../src/components/tour/ParticleScaleComparator.vue'
import SpinPrecessionVisualizer from '../../src/components/tour/SpinPrecessionVisualizer.vue'
import type { AtomicSpectrumResult } from '../../src/tour/atomicSpectrumEngine'
import type { ParticleScaleResult } from '../../src/tour/particleScaleEngine'
import type { SpinPrecessionResult } from '../../src/tour/spinPrecessionEngine'
import type { ReadingDepth, TourGeneratedSimulation } from '../../src/types/tour'
import atomicJson from '../../public/data/generated/tour/simulations/hydrogen-spectrum-explorer.json'
import particleJson from '../../public/data/generated/tour/simulations/particle-scale-comparator.json'
import spinJson from '../../public/data/generated/tour/simulations/spin-precession-visualizer.json'

type InstrumentComponent = typeof AtomicSpectrumExplorer | typeof ParticleScaleComparator | typeof SpinPrecessionVisualizer

function freshSimulation(source: unknown): TourGeneratedSimulation {
  return structuredClone(source) as TourGeneratedSimulation
}

function mountInstrument(
  component: InstrumentComponent,
  source: unknown,
  depth: ReadingDepth = 'guided',
  initialPresetId?: string,
): VueWrapper {
  return mount(component, {
    props: {
      simulation: freshSimulation(source),
      depth,
      ...(initialPresetId ? { initialPresetId } : {}),
    },
  })
}

async function revealAtomic(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('[data-testid="atomic-prediction-longer"]').setValue(true)
  await wrapper.get('[data-testid="reveal-atomic-result"]').trigger('click')
}

async function revealParticle(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('[data-testid="particle-prediction-state-derived"]').setValue(true)
  await wrapper.get('[data-testid="reveal-particle-result"]').trigger('click')
}

async function revealSpin(wrapper: VueWrapper, prediction = 'clockwise'): Promise<void> {
  await wrapper.get(`[data-testid="spin-prediction-${prediction}"]`).setValue(true)
  await wrapper.get('[data-testid="reveal-spin-result"]').trigger('click')
}

describe('Tour atomic, particle-scale, and spin instruments', () => {
  it('fails closed for ID, revision, compatibility, control, option, preset, output, and initial-preset contract drift', () => {
    const cases: Array<[InstrumentComponent, unknown, (simulation: TourGeneratedSimulation) => void, string]> = [
      [AtomicSpectrumExplorer, atomicJson, (simulation) => { simulation.id = 'wrong-atomic-id' }, 'atomic-contract-error'],
      [ParticleScaleComparator, particleJson, (simulation) => { simulation.revision.modelRevision = 'wrong-model' }, 'particle-contract-error'],
      [SpinPrecessionVisualizer, spinJson, (simulation) => { simulation.controls.pop() }, 'spin-contract-error'],
      [AtomicSpectrumExplorer, atomicJson, (simulation) => { simulation.presets[0]!.inputs.nUpper = 13 }, 'atomic-contract-error'],
      [AtomicSpectrumExplorer, atomicJson, (simulation) => { simulation.comparison.compatibilityKey = 'wrong-key' }, 'atomic-contract-error'],
      [AtomicSpectrumExplorer, atomicJson, (simulation) => { simulation.predictionPrompt += ' Changed.' }, 'atomic-contract-error'],
      [AtomicSpectrumExplorer, atomicJson, (simulation) => { if (simulation.limits.tier === 'immediate') simulation.limits.maxOperations = 1 }, 'atomic-contract-error'],
      [AtomicSpectrumExplorer, atomicJson, (simulation) => { if (simulation.limits.tier === 'immediate') simulation.limits.maxDurationMs = 15 }, 'atomic-contract-error'],
      [AtomicSpectrumExplorer, atomicJson, (simulation) => { simulation.outputSchema[6]!.unit = 'm' }, 'atomic-contract-error'],
      [ParticleScaleComparator, particleJson, (simulation) => { simulation.outputSchema[0]!.unit = 'g' }, 'particle-contract-error'],
      [SpinPrecessionVisualizer, spinJson, (simulation) => {
        const control = simulation.controls[0]
        if (control?.type === 'select') control.options[0]!.value = 'neutron'
      }, 'spin-contract-error'],
      [SpinPrecessionVisualizer, spinJson, (simulation) => {
        const control = simulation.controls[1]
        if (control?.type === 'range') control.max = 21
      }, 'spin-contract-error'],
    ]

    for (const [component, source, mutate, errorTestId] of cases) {
      const simulation = freshSimulation(source)
      mutate(simulation)
      const wrapper = mount(component, { props: { simulation, depth: 'guided' } })
      expect(wrapper.get(`[data-testid="${errorTestId}"]`).attributes('role')).toBe('alert')
      expect(wrapper.text()).toContain('cannot run')
      expect(wrapper.find('[role="status"]').exists()).toBe(false)
      expect(wrapper.emitted('evaluated')).toBeUndefined()
    }

    const unknownInitial = mountInstrument(SpinPrecessionVisualizer, spinJson, 'guided', 'not-a-preset')
    expect(unknownInitial.get('[data-testid="spin-contract-error"]').text()).toContain('not-a-preset')

    const current = mountInstrument(SpinPrecessionVisualizer, spinJson)
    expect(current.find('[data-testid="spin-contract-error"]').exists()).toBe(false)
    const remountContract = freshSimulation(spinJson)
    remountContract.comparison.compatibilityKey = 'stale-dispatch-key'
    const remounted = mount(SpinPrecessionVisualizer, { props: { simulation: remountContract, depth: 'guided' } })
    expect(remounted.get('[data-testid="spin-contract-error"]').text()).toContain('compatibility contract')
  })

  it('applies every generated preset and supports initial presets without rewriting generated copy', async () => {
    const atomic = mountInstrument(AtomicSpectrumExplorer, atomicJson, 'technical', 'lyman-alpha')
    expect((atomic.get('[data-testid="atomic-upper"]').element as HTMLInputElement).value).toBe('2')
    expect((atomic.get('[data-testid="atomic-lower"]').element as HTMLInputElement).value).toBe('1')
    await atomic.get('[data-testid="atomic-preset-balmer-alpha-infinite"]').trigger('click')
    expect((atomic.get('[data-testid="atomic-nucleus"]').element as HTMLSelectElement).value).toBe('infinite')
    expect(atomic.get('[data-testid="atomic-inspection-prompt"]').text()).toBe(atomicJson.presets[2]!.inspectionPrompt)

    const particle = mountInstrument(ParticleScaleComparator, particleJson, 'guided', 'proton-fast')
    expect((particle.get('[data-testid="particle-choice"]').element as HTMLSelectElement).value).toBe('proton')
    expect((particle.get('[data-testid="particle-momentum"]').element as HTMLInputElement).value).toBe('2')
    await particle.get('[data-testid="particle-preset-electron"]').trigger('click')
    expect(particle.get('[data-testid="particle-inspection-prompt"]').text()).toBe(particleJson.presets[0]!.inspectionPrompt)

    const spin = mountInstrument(SpinPrecessionVisualizer, spinJson, 'technical', 'electron-resonance')
    expect((spin.get('[data-testid="spin-particle"]').element as HTMLSelectElement).value).toBe('electron')
    expect((spin.get('[data-testid="spin-field"]').element as HTMLInputElement).value).toBe('0.34')
    for (const preset of spinJson.presets) {
      await spin.get(`[data-testid="spin-preset-${preset.id}"]`).trigger('click')
      expect(spin.get('[data-testid="spin-inspection-prompt"]').text()).toBe(preset.inspectionPrompt)
    }
  })

  it('requires predictions and exposes numeric atomic outputs through one accessible SVG and a bounded table', async () => {
    const wrapper = mountInstrument(AtomicSpectrumExplorer, atomicJson)
    expect(wrapper.get('[data-testid="reveal-atomic-result"]').attributes()).toHaveProperty('disabled')

    await revealAtomic(wrapper)

    const output = wrapper.emitted<AtomicSpectrumResult[]>('evaluated')![0]![0]!
    expect(output.vacuumWavelengthNm).toBeCloseTo(656.47, 1)
    expect(output.energyEv).toBeGreaterThan(1)
    expect(wrapper.get('[data-testid="atomic-prediction-comparison"]').text()).toContain('The two align')
    expect(wrapper.get('[data-testid="atomic-prediction-gate"]').text()).toContain(atomicJson.predictionPrompt)
    const protonWavelength = Number(wrapper.get('[data-testid="atomic-proton-comparison-wavelength"]').text())
    const infiniteWavelength = Number(wrapper.get('[data-testid="atomic-infinite-comparison-wavelength"]').text())
    expect(protonWavelength).toBeGreaterThan(infiniteWavelength)
    expect(wrapper.get('[data-testid="atomic-mass-comparison-table"]').findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.get('[data-testid="atomic-mass-comparison-table"]').find('caption').text()).toContain('same Z and principal-level transition')
    expect(wrapper.get('[data-testid="atomic-comparison-finding"]').text()).toContain(`${protonWavelength}`)
    expect(wrapper.get('[data-testid="atomic-comparison-finding"]').text()).toContain(`${infiniteWavelength}`)
    expect(wrapper.findAll('[data-testid="atomic-result"] svg')).toHaveLength(1)
    expect(wrapper.get('[data-testid="atomic-svg"]').attributes('role')).toBe('img')
    expect(wrapper.get('[data-testid="atomic-svg"]').find('title').text()).toContain('energy levels')
    expect(wrapper.get('[data-testid="atomic-series-table"]').find('caption').text()).toContain('not transition-strength or observation claims')
    expect(wrapper.get('[data-testid="atomic-series-table"]').findAll('tbody tr')).toHaveLength(10)
    expect(wrapper.get('[data-testid="atomic-series-table"]').findAll('tbody th[scope="row"]')).toHaveLength(10)
  })

  it('shows linked particle dependencies and known electron scales without treating axes as observations', async () => {
    const wrapper = mountInstrument(ParticleScaleComparator, particleJson)
    await revealParticle(wrapper)

    const output = wrapper.emitted<ParticleScaleResult[]>('evaluated')![0]![0]!
    expect(output.restEnergyEv).toBeCloseTo(510_998.95, 1)
    expect(output.deBroglieWavelengthM).toBe(output.comptonWavelengthM)
    expect(wrapper.findAll('[data-testid="particle-result"] svg')).toHaveLength(1)
    expect(wrapper.get('[data-testid="particle-svg"]').attributes('role')).toBe('img')
    expect(wrapper.get('[data-testid="particle-scale-table"]').findAll('tbody tr')).toHaveLength(7)
    expect(wrapper.get('[data-testid="particle-scale-table"]').text()).toContain('momentum state-derived')
    expect(wrapper.get('[data-testid="particle-scale-table"]').find('caption').text()).toContain('not independent observations')
    expect(wrapper.get('[data-testid="particle-prediction-comparison"]').text()).toContain('The two align')
  })

  it('renders a static final spin vector with signed cyclic and angular outputs and an accessible sample table', async () => {
    const wrapper = mountInstrument(SpinPrecessionVisualizer, spinJson)
    await revealSpin(wrapper)

    const output = wrapper.emitted<SpinPrecessionResult[]>('evaluated')![0]![0]!
    expect(output.signedCyclicFrequencyHz).toBeCloseTo(42.577_478_461e6, 5)
    expect(output.angularFrequencyRadPerSecond).toBe(2 * Math.PI * output.signedCyclicFrequencyHz)
    expect(output.phaseRadians).toBe(-output.angularFrequencyRadPerSecond * output.timeSeconds)
    expect(output.rotationSense).toBe('clockwise')
    expect(output.periodSeconds).toBeGreaterThan(0)
    expect(wrapper.findAll('[data-testid="spin-result"] svg')).toHaveLength(1)
    expect(wrapper.get('[data-testid="spin-svg"]').attributes('role')).toBe('img')
    expect(wrapper.get('[data-testid="spin-svg"]').find('desc').text()).toContain('Static final unit vector')
    expect(wrapper.get('[data-testid="spin-sample-table"]').findAll('tbody tr')).toHaveLength(64)
    expect(wrapper.get('[data-testid="spin-sample-table"]').find('caption').text()).toContain('not measurements')
    expect(wrapper.get('[data-testid="spin-frequency-distinction"]').text()).toContain('exactly 2 pi f')
    expect(wrapper.get('[data-testid="spin-frequency-distinction"]').text()).toContain('phi = -omega t')
    expect(wrapper.get('[data-testid="spin-prediction-comparison"]').text()).toContain('The two align')
    expect(wrapper.get('[data-testid="spin-text-alternative"]').text()).toContain('not a measured spin trajectory')
  })

  it('separates Guided and Technical controls while disclosing hidden state', async () => {
    const atomic = mountInstrument(AtomicSpectrumExplorer, atomicJson)
    expect(atomic.find('[data-testid="atomic-control-atomicNumber"]').exists()).toBe(false)
    expect(atomic.get('[data-testid="atomic-guided-z-disclosure"]').text()).toContain('Z remains fixed at 1')
    expect(atomic.find('[data-testid="atomic-technical-disclosure"]').exists()).toBe(false)
    await atomic.setProps({ depth: 'technical' })
    expect(atomic.get('[data-testid="atomic-number"]').attributes()).toMatchObject({ min: '1', max: '10', step: '1' })
    expect(atomic.get('[data-testid="atomic-technical-disclosure"]').text().toLowerCase()).toContain('selection')

    const particle = mountInstrument(ParticleScaleComparator, particleJson)
    expect(particle.findAll('[data-testid^="particle-control-"]')).toHaveLength(2)
    expect(particle.find('[data-testid="particle-technical-disclosure"]').exists()).toBe(false)
    await particle.setProps({ depth: 'technical' })
    expect(particle.get('[data-testid="particle-technical-disclosure"]').text()).toContain('composite particles')

    const spin = mountInstrument(SpinPrecessionVisualizer, spinJson)
    expect(spin.findAll('[data-testid^="spin-control-"]')).toHaveLength(3)
    expect(spin.get('[data-testid="spin-guided-sample-disclosure"]').text()).toContain('64 deterministic phase samples')
    await spin.setProps({ depth: 'technical' })
    expect(spin.findAll('[data-testid^="spin-control-"]')).toHaveLength(4)
    expect(spin.get('[data-testid="spin-samples"]').attributes()).toMatchObject({ min: '2', max: '128', step: '1' })
    expect(spin.get('[data-testid="spin-technical-disclosure"]').text()).toContain('signed cyclic gamma/(2 pi)')
  })

  it('marks every button, select, range, and prediction choice as a 44px scoped hit target at narrow width', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 })
    const instruments: Array<[VueWrapper, string, string]> = [
      [mountInstrument(AtomicSpectrumExplorer, atomicJson, 'technical'), 'atomic-hit-target', 'atomic-prediction-target'],
      [mountInstrument(ParticleScaleComparator, particleJson, 'technical'), 'particle-hit-target', 'particle-prediction-target'],
      [mountInstrument(SpinPrecessionVisualizer, spinJson, 'technical'), 'spin-hit-target', 'spin-prediction-target'],
    ]

    for (const [wrapper, className, predictionClassName] of instruments) {
      const targets = wrapper.findAll('button, select, input[type="range"]')
      expect(targets.length).toBeGreaterThan(0)
      expect(targets.every((target) => target.classes().includes(className))).toBe(true)
      const predictionTargets = wrapper.findAll('fieldset label')
      expect(predictionTargets.length).toBeGreaterThan(0)
      expect(predictionTargets.every((target) => target.classes().includes(predictionClassName))).toBe(true)
    }
  })

  it('updates immediately after reveal, marks predictions stale, and resets to immutable source defaults', async () => {
    const atomicSimulation = freshSimulation(atomicJson)
    const atomicBefore = structuredClone(atomicSimulation)
    const atomic = mount(AtomicSpectrumExplorer, { props: { simulation: atomicSimulation, depth: 'technical', initialPresetId: 'lyman-alpha' } })
    await revealAtomic(atomic)
    await atomic.get('[data-testid="atomic-upper"]').setValue(4)
    expect(atomic.emitted('evaluated')).toHaveLength(2)
    expect(atomic.get('[data-testid="atomic-prediction-stale"]').text()).toContain('previous prediction is not compared')
    expect(atomic.get('[data-testid="atomic-prediction-comparison"]').text()).toBe('')
    await atomic.get('[data-testid="reset-atomic-explorer"]').trigger('click')
    expect((atomic.get('[data-testid="atomic-upper"]').element as HTMLInputElement).value).toBe('3')
    expect((atomic.get('[data-testid="atomic-nucleus"]').element as HTMLSelectElement).value).toBe('proton')
    expect(atomic.find('[data-testid="atomic-result"]').exists()).toBe(false)
    expect(atomicSimulation).toEqual(atomicBefore)

    const particleSimulation = freshSimulation(particleJson)
    const particleBefore = structuredClone(particleSimulation)
    const particle = mount(ParticleScaleComparator, { props: { simulation: particleSimulation, depth: 'guided', initialPresetId: 'proton-fast' } })
    await revealParticle(particle)
    await particle.get('[data-testid="particle-momentum"]').setValue(3)
    expect(particle.emitted('evaluated')).toHaveLength(2)
    expect(particle.get('[data-testid="particle-prediction-stale"]').exists()).toBe(true)
    await particle.get('[data-testid="reset-particle-comparator"]').trigger('click')
    expect((particle.get('[data-testid="particle-choice"]').element as HTMLSelectElement).value).toBe('electron')
    expect((particle.get('[data-testid="particle-momentum"]').element as HTMLInputElement).value).toBe('1')
    expect(particleSimulation).toEqual(particleBefore)

    const spinSimulation = freshSimulation(spinJson)
    const spinBefore = structuredClone(spinSimulation)
    const spin = mount(SpinPrecessionVisualizer, { props: { simulation: spinSimulation, depth: 'technical', initialPresetId: 'electron-resonance' } })
    await revealSpin(spin, 'counterclockwise')
    await spin.get('[data-testid="spin-field"]').setValue(0.68)
    expect(spin.emitted('evaluated')).toHaveLength(2)
    expect(spin.get('[data-testid="spin-prediction-stale"]').exists()).toBe(true)
    await spin.get('[data-testid="reset-spin-visualizer"]').trigger('click')
    expect((spin.get('[data-testid="spin-particle"]').element as HTMLSelectElement).value).toBe('proton')
    expect((spin.get('[data-testid="spin-field"]').element as HTMLInputElement).value).toBe('1')
    expect((spin.get('[data-testid="spin-samples"]').element as HTMLInputElement).value).toBe('64')
    expect(spinSimulation).toEqual(spinBefore)
  })

  it('publishes complete dynamic findings, provenance, evidence, caveats, and explicit non-validation without scores or Plotly', async () => {
    const instruments: Array<[VueWrapper, string, string[]]> = [
      [mountInstrument(AtomicSpectrumExplorer, atomicJson), 'atomic', ['selection rules', 'Hamiltonian', 'Bohr/Rydberg']],
      [mountInstrument(ParticleScaleComparator, particleJson, 'technical', 'proton'), 'particle', ['dependent representations', 'state-dependent', 'composite particles']],
      [mountInstrument(SpinPrecessionVisualizer, spinJson, 'guided', 'electron-resonance'), 'spin', ['relaxation', 'material response', 'observed resonance']],
    ]
    await revealAtomic(instruments[0]![0])
    await revealParticle(instruments[1]![0])
    await revealSpin(instruments[2]![0], 'counterclockwise')

    for (const [wrapper, prefix, caveats] of instruments) {
      const finding = wrapper.get(`[data-testid="${prefix}-finding-panel"]`)
      expect(finding.findAll('h4').map((heading) => heading.text())).toEqual([
        'What changed', 'Why', 'Equation', 'Assumptions', 'Establishes', 'Does not establish', 'Scientific caveats', 'Evidence references',
      ])
      expect(wrapper.get(`[data-testid="${prefix}-finding-status"]`).text()).toBe('COMPUTED')
      expect(wrapper.get(`[data-testid="${prefix}-source-revision"]`).text()).toContain('CODATA 2022')
      expect(wrapper.get(`[data-testid="${prefix}-evidence"]`).findAll('a').every((link) => link.attributes('href')?.startsWith('#reference-'))).toBe(true)
      expect(wrapper.get(`[data-testid="${prefix}-validation-boundary"]`).text()).toContain('validatesTheory is false')
      for (const caveat of caveats) expect(wrapper.text()).toContain(caveat)
      expect(wrapper.text().toLowerCase()).not.toMatch(/\b(score|mastery|streak|plotly)\b/)
      expect(wrapper.find('canvas').exists()).toBe(false)
    }
  })
})
