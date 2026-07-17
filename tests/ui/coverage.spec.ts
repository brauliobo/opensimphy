import { mount } from '@vue/test-utils'
import CoverageStrip from '../../src/components/CoverageStrip.vue'
import { snapshot } from './fixtures'

describe('CoverageStrip', () => {
  it('fails closed when any exact count mismatches', () => {
    const wrapper = mount(CoverageStrip, {
      props: { rows: snapshot(false).coverage, complete: false },
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })

    expect(wrapper.get('[data-testid="coverage-status"]').attributes('data-status')).toBe('incomplete')
    expect(wrapper.text()).toContain('FAIL CLOSED / INCOMPLETE')
    expect(wrapper.get('[data-testid="coverage-recipes"]').text()).toContain('2')
  })

  it('only reports complete when explicitly supplied as exact', () => {
    const wrapper = mount(CoverageStrip, {
      props: { rows: snapshot(true).coverage, complete: true },
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    expect(wrapper.get('[data-testid="coverage-status"]').attributes('data-status')).toBe('complete')
  })
})
