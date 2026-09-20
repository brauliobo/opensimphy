import { mount } from '@vue/test-utils'
import MajorityPhaseInstrument from '../../src/components/quantum-registers/MajorityPhaseInstrument.vue'
import HandshakeInstrument from '../../src/components/quantum-registers/HandshakeInstrument.vue'
import HierarchyInstrument from '../../src/components/quantum-registers/HierarchyInstrument.vue'

describe('Quantum register lab instruments', () => {
  it('flips 137 coins and reports a definite majority step', () => {
    const wrapper = mount(MajorityPhaseInstrument, { props: { depth: 'guided' } })

    expect(wrapper.get('[data-testid="majority-result"]').text()).toContain('137')
    expect(wrapper.get('[data-testid="majority-result"]').text()).toContain('69 / 137')
    expect(wrapper.get('[data-testid="majority-result"]').text()).not.toContain('tie, no step')
    expect(wrapper.get('[data-testid="majority-result"] svg').attributes('role')).toBe('img')
  })

  it('switches to alignment mode and keeps the binomial lock visible', async () => {
    const wrapper = mount(MajorityPhaseInstrument, { props: { depth: 'technical' } })

    await wrapper.get('[data-testid="majority-mode"]').setValue('align')
    expect(wrapper.get('[data-testid="majority-result"]').text()).toContain('Binomial commit P')
    expect(wrapper.get('[data-testid="majority-result"]').text()).toMatch(/0\.9\d{3}/)
    expect(wrapper.get('.quantum-boundary').text()).toContain('derivation of α')
  })

  it('keeps 1/137 a counting label and exposes majority-phase handshake', () => {
    const hierarchy = mount(HierarchyInstrument, { props: { depth: 'guided' } })
    const handshake = mount(HandshakeInstrument, { props: { depth: 'guided' } })

    expect(hierarchy.get('[data-testid="hierarchy-result"]').text()).toContain('137')
    expect(hierarchy.get('[data-testid="hierarchy-result"]').text()).toContain('not a QED')
    expect(handshake.get('[data-testid="handshake-rule"]').text()).toContain('Majority phase alignment')
  })
})
