import { flushPromises, mount } from '@vue/test-utils'
import PlotlyPanel from '../../src/components/PlotlyPanel.vue'
import { figure } from './fixtures'

describe('PlotlyPanel', () => {
  it('publishes readiness only after the asynchronous renderer resolves', async () => {
    const wrapper = mount(PlotlyPanel, { props: { figure, label: 'Test sweep', testId: 'formula-graph-ready' } })
    expect(wrapper.find('[data-testid="formula-graph-ready"]').exists()).toBe(false)

    await flushPromises()

    expect(wrapper.get('[data-testid="formula-graph-ready"]').attributes('data-plot-state')).toBe('ready')
    expect(wrapper.emitted('ready')).toHaveLength(1)
  })
})
