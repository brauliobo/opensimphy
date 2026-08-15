import { mount } from '@vue/test-utils'
import { vi } from 'vitest'
import EnergyLedgerInstrument from '../../src/components/edwin-gray/EnergyLedgerInstrument.vue'
import FamilyInstrument from '../../src/components/edwin-gray/FamilyInstrument.vue'
import GeometryInstrument from '../../src/components/edwin-gray/GeometryInstrument.vue'
import PulseCycleInstrument from '../../src/components/edwin-gray/PulseCycleInstrument.vue'

describe('Edwin Gray lab instruments', () => {
  it('draws the selected prototype and reports pole count', async () => {
    const wrapper = mount(GeometryInstrument, { props: { depth: 'guided' } })

    expect(wrapper.get('[data-testid="gray-geometry-result"]').text()).toContain('3 stator')
    expect(wrapper.get('[data-testid="gray-patent-topology"]').text()).toContain('9 stator pair stations')
    expect(wrapper.get('[data-testid="gray-event-schedule"] tbody').findAll('tr')).toHaveLength(27)
    expect(wrapper.get('[data-testid="gray-geometry-status"]').attributes('aria-live')).toBe('polite')
    await wrapper.get('[data-testid="gray-geometry-motor"]').setValue('black')
    expect(wrapper.get('[data-testid="gray-geometry-result"]').text()).toContain('1 stator')
    expect(wrapper.get('[data-testid="gray-geometry-result"] svg').attributes('role')).toBe('img')
  })

  it('marks an unquenched dump below 500 rpm', async () => {
    const wrapper = mount(PulseCycleInstrument, { props: { depth: 'guided' } })

    expect(wrapper.get('[data-testid="gray-pulse-status"]').text()).toContain('arc quenched')
    await wrapper.get('[data-testid="gray-pulse-rpm"]').setValue('120')
    expect(wrapper.get('[data-testid="gray-pulse-status"]').text()).toContain('unquenched dump')
    expect(wrapper.get('[data-testid="gray-pulse-result"]').findAll('table tbody tr')).toHaveLength(11)
    expect(wrapper.get('[data-testid="gray-pulse-result"]').get('table caption').text()).toContain('Classical pulse samples')
  })

  it('does not start spin-up animation when reduced motion is preferred', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList)
    const wrapper = mount(PulseCycleInstrument, { props: { depth: 'guided' } })

    await wrapper.get('[data-testid="gray-pulse-play"]').trigger('click')

    expect(wrapper.get('[data-testid="gray-pulse-play"]').text()).toBe('Spin up')
    expect(wrapper.get('[data-testid="gray-pulse-motion-notice"]').text()).toContain('reduced motion')
  })

  it('keeps classical COP below 100% and shows the EMA4 claim separately', async () => {
    const wrapper = mount(EnergyLedgerInstrument, { props: { depth: 'technical' } })

    expect(wrapper.get('[data-testid="gray-claimed-cop"]').text()).toContain('300')
    const cop = Number(wrapper.get('[data-testid="gray-classical-cop"]').text().replace('%', ''))
    expect(cop).toBeGreaterThanOrEqual(0)
    expect(cop).toBeLessThan(100)
  })

  it('lists six machines and zero recovery on gold', () => {
    const wrapper = mount(FamilyInstrument, { props: { depth: 'guided' } })
    const gold = wrapper.get('[data-motor="gold"]').text()

    expect(wrapper.get('[data-testid="gray-family-result"]').findAll('table tbody tr')).toHaveLength(6)
    expect(gold).toMatch(/0\.00e\+0/)
    expect(wrapper.get('table caption').text()).toContain('Later colored prototype evidence comparison')
    expect(wrapper.get('[role="status"]').attributes('aria-live')).toBe('polite')
  })
})
