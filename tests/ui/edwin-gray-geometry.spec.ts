import { mount } from '@vue/test-utils'
import GeometryInstrument from '../../src/components/edwin-gray/GeometryInstrument.vue'
import { evaluateGrayFullMotor, GRAY_PRESETS } from '../../src/edwin-gray/edwinGrayEngine'
import { freezeGrayFullMotorResult } from '../../src/edwin-gray/edwinGrayWorkbench'

const result = freezeGrayFullMotorResult(evaluateGrayFullMotor({
  ...GRAY_PRESETS.purple,
  revolutions: 1,
  mode: 'dynamic',
  machineMode: 'original-500rpm-contact-v1',
  rotorInertiaKgM2: 0.01,
  loadTorqueNm: 0.01,
}))

describe('Edwin Gray patent geometry', () => {
  it('draws the canonical 9×3 pair-station motor from the live event', () => {
    const geometry = mount(GeometryInstrument, {
      props: { depth: 'guided', result, activeEventIndex: 2 },
    })
    const event = result.events[2]!

    expect(geometry.get('[data-testid="gray-rotor"]').exists()).toBe(true)
    expect(geometry.get('[data-testid="gray-patent-stage"]').exists()).toBe(true)
    expect(geometry.findAll('[data-testid="gray-patent-stator"]')).toHaveLength(9)

    const rotor = geometry.get('[data-testid="gray-patent-rotor"]')
    expect(rotor.attributes('transform')).toContain(String(event.scheduledAbsoluteAngleDeg))
    expect(rotor.findAll('[data-testid="gray-patent-rotor-station"]')).toHaveLength(3)

    const expected = [...new Set(event.sectors.map((sector) => sector.statorPairStation))].sort((a, b) => a - b)
    const highlighted = geometry.findAll('[data-testid="gray-patent-stator"]')
      .filter((node) => node.classes().includes('gray-station-active'))
      .map((node) => Number(node.attributes('data-station')))
      .sort((a, b) => a - b)
    expect(highlighted).toEqual(expected)
    expect(geometry.get('[data-testid="gray-patent-status"]').text()).toContain('9 stator pair stations')
    expect(geometry.get('[data-testid="gray-patent-status"]').text()).toContain('3 rotor pair stations')
    expect(geometry.get('[data-testid="gray-patent-status"]').text()).toContain('event 3')
  })
})
