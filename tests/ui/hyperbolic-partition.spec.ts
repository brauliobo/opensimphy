import { mount } from '@vue/test-utils'
import HyperbolicPartitionInstrument from '../../src/components/hyperbolic-partition/HyperbolicPartitionInstrument.vue'
import { SPECIAL_A } from '../../src/hyperbolic-partition/partitionEngine'

describe('hyperbolic partition instrument', () => {
  it('opens on the physical a and lists four roots', () => {
    const wrapper = mount(HyperbolicPartitionInstrument)

    expect(wrapper.get('[data-testid="a-readout"]').text()).toContain(SPECIAL_A.physical.toFixed(8))
    expect(wrapper.get('[data-testid="root-zhe_1"]').text()).toContain('zhe_1')
    expect(wrapper.get('[data-testid="root-zhe_2"]').text()).toContain('zhe_2')
    expect(wrapper.get('[data-testid="root-zhe_3"]').text()).toContain('zhe_3')
    expect(wrapper.get('[data-testid="root-zhe_4"]').text()).toContain('zhe_4')
    expect(wrapper.get('[data-testid="vieta-product"]').text()).toMatch(/6\.28/)
    expect(wrapper.get('[data-testid="tab-roots"]').attributes('aria-selected')).toBe('true')
    wrapper.unmount()
  })

  it('switches explorer tabs and specials', async () => {
    const wrapper = mount(HyperbolicPartitionInstrument)

    await wrapper.get('[data-testid="tab-mobius"]').trigger('click')
    expect(wrapper.get('[data-testid="mobius-unique"]').text()).toContain('6 distinct λ')
    expect(wrapper.get('[data-testid="mobius-unique"]').text()).toContain('24 labeled charts')

    await wrapper.get('[data-testid="tab-cross-ratio"]').trigger('click')
    expect(wrapper.get('[data-testid="cross-ratio-count"]').text()).toContain('6 values')

    await wrapper.get('[data-testid="tab-monodromy"]').trigger('click')
    expect(wrapper.get('[data-testid="monodromy-cycle"]').text()).toMatch(/Loop around/)

    await wrapper.get('[data-testid="tab-riemann"]').trigger('click')
    expect(wrapper.get('[data-testid="riemann-sub-planar"]').attributes('role')).toBe('tab')

    await wrapper.get('[data-testid="special-0"]').trigger('click')
    expect(wrapper.get('[data-testid="a-readout"]').text()).toContain('a = 0.00000000')
    wrapper.unmount()
  })
})
