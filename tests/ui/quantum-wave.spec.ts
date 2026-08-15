import { mount } from '@vue/test-utils'
import ComplexPlaneInstrument from '../../src/components/quantum/ComplexPlaneInstrument.vue'
import HydrogenMaterialsInstrument from '../../src/components/quantum/HydrogenMaterialsInstrument.vue'
import OperatorInstrument from '../../src/components/quantum/OperatorInstrument.vue'
import ProbabilityInstrument from '../../src/components/quantum/ProbabilityInstrument.vue'
import QuantumTooltip from '../../src/components/quantum/QuantumTooltip.vue'
import SchrodingerAssembler from '../../src/components/quantum/SchrodingerAssembler.vue'
import SpectrumInstrument from '../../src/components/quantum/SpectrumInstrument.vue'
import StandingWaveInstrument from '../../src/components/quantum/StandingWaveInstrument.vue'

describe('Quantum Wave Lab instruments', () => {
  it('requires a prediction before revealing a spectrum and keeps the table alternative', async () => {
    const wrapper = mount(SpectrumInstrument, { props: { depth: 'guided' } })

    expect(wrapper.find('[data-testid="spectrum-result"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="spectrum-reveal"]').attributes()).toHaveProperty('disabled')
    await wrapper.get('input[value="shorter"]').setValue(true)
    await wrapper.get('[data-testid="spectrum-reveal"]').trigger('click')

    expect(wrapper.get('[data-testid="spectrum-result"]').text()).toContain('656')
    expect(wrapper.get('table').findAll('tbody tr')).toHaveLength(5)
    expect(wrapper.get('.quantum-boundary').text()).toContain('does not identify a unique atom')

    await wrapper.get('[data-testid="spectrum-upper"]').setValue('4')
    expect(wrapper.find('[data-testid="spectrum-result"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="spectrum-reveal"]').attributes()).toHaveProperty('disabled')
  })

  it('updates the probability screen and exposes the technical normalization caveat', async () => {
    const wrapper = mount(ProbabilityInstrument, { props: { depth: 'technical' } })

    expect(wrapper.get('[data-testid="probability-result"]').text()).toContain('Complex total')
    expect(wrapper.get('[data-testid="probability-result"]').text()).toContain('Technical reading')
    await wrapper.get('[data-testid="probability-coherent"]').setValue(false)

    expect(wrapper.get('[data-testid="probability-result"]').text()).toContain('Coherent: no')
    expect(wrapper.get('table').findAll('tbody tr')).toHaveLength(11)
  })

  it('keeps the corrected physical readouts visible in the standing, operator, and materials views', () => {
    const standing = mount(StandingWaveInstrument, { props: { depth: 'guided' } })
    const operator = mount(OperatorInstrument, { props: { depth: 'guided' } })
    const materials = mount(HydrogenMaterialsInstrument, { props: { depth: 'guided' } })

    expect(standing.get('[data-testid="standing-result"]').text()).toContain('Boundary mode n')
    expect(standing.get('[data-testid="standing-result"]').text()).toContain('Wavelength lambda')
    expect(operator.get('[data-testid="operator-result"]').text()).toContain('Pure-wave K')
    expect(operator.get('[data-testid="operator-result"]').text()).not.toContain('Reference K')
    expect(materials.get('[data-testid="materials-result"]').text()).toContain('schematic model')
  })

  it('switches between real and complex modes without losing an accessible SVG', async () => {
    const wrapper = mount(ComplexPlaneInstrument, { props: { depth: 'guided' } })

    expect(wrapper.get('[data-testid="complex-result"] svg').attributes('role')).toBe('img')
    await wrapper.get('[data-testid="complex-real-mode"]').trigger('click')
    expect(wrapper.get('[data-testid="complex-result"]').text()).toContain('real')
    expect(wrapper.get('[data-testid="complex-real-mode"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.complex-imaginary-wave').exists()).toBe(false)
  })

  it('assembles and disassembles the Schrodinger teaching form', async () => {
    const wrapper = mount(SchrodingerAssembler, { props: { depth: 'technical' } })

    expect(wrapper.get('[data-complete="true"]').exists()).toBe(true)
    await wrapper.get('[data-testid="equation-potential"]').setValue(false)
    expect(wrapper.find('[data-complete="true"]').exists()).toBe(false)
    expect(wrapper.get('.quantum-boundary').text()).toContain('does not independently derive')
  })

  it('opens a teacher tooltip with Guided and Technical copy', async () => {
    const wrapper = mount(QuantumTooltip, {
      props: { term: 'phase', plain: 'A cycle position.', technical: 'An oscillatory argument.', depth: 'technical' },
    })

    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('[role="tooltip"]').text()).toContain('An oscillatory argument.')
  })
})
