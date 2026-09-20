import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ComputeView from '../../src/views/ComputeView.vue'
import ComputePrompt from '../../src/components/compute/ComputePrompt.vue'
import { COMPUTE_EXAMPLE_QUERIES, COMPUTE_LAB_PATH } from '../../src/compute/examples'
import { EMPTY_COMPUTE_CONTEXT } from '../../src/compute/types'

function createRouterForCompute() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: COMPUTE_LAB_PATH, name: 'compute', component: ComputeView },
    ],
  })
}

describe('Compute lab', () => {
  it('evaluates Planck mass over Planck time squared into spring-constant interpretations', async () => {
    const router = createRouterForCompute()
    await router.push(COMPUTE_LAB_PATH)
    const wrapper = mount(ComputeView, { global: { plugins: [router] } })
    await wrapper.get('[data-testid="compute-example"]').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="compute-formatted"]').exists()).toBe(true)
    })

    expect(wrapper.get('[data-testid="compute-example"]').text()).toBe(COMPUTE_EXAMPLE_QUERIES[0])
    expect(wrapper.findAll('[data-testid="compute-example"]')).toHaveLength(COMPUTE_EXAMPLE_QUERIES.length)

    expect(wrapper.get('[data-testid="compute-formatted"]').text()).toMatch(/kg s\^-2/)
    expect(wrapper.get('[data-testid="compute-dimensions"]').text()).toContain('[mass][time]^{-2}')
    expect(wrapper.get('[data-testid="compute-interpretations"]').text()).toContain('spring constant')
    expect(wrapper.get('[data-testid="compute-interpretations"]').text()).toContain('surface tension')
  })
})

describe('ComputePrompt', () => {
  it('renders the bound monastery context label', async () => {
    const router = createRouterForCompute()
    await router.push(COMPUTE_LAB_PATH)
    const wrapper = mount(ComputePrompt, {
      props: { context: { ...EMPTY_COMPUTE_CONTEXT, sourceLabel: 'Formula m_P: Planck mass' } },
      global: { plugins: [router] },
    })
    expect(wrapper.get('[data-testid="compute-prompt"]').text()).toContain('Formula m_P: Planck mass')
  })
})
