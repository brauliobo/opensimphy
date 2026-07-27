import { flushPromises, mount } from '@vue/test-utils'
import WallCanvas from '../../src/components/WallCanvas.vue'

describe('WallCanvas', () => {
  it('draws the matrix and reports display and exact-zero identity separately', async () => {
    const wrapper = mount(WallCanvas, {
      props: {
        result: {
          id: 'fixture',
          width: 3,
          depth: 2,
          mode: 'signed_log',
          values: [['12345678901234567890', -2, 0], [3, 4, 5]],
          exactZeroMask: [[false, false, true], [false, false, false]],
          min: -2,
          max: 5,
          zeroCount: 1,
          graphReady: true,
        },
      },
    })
    await flushPromises()
    const canvas = wrapper.get('[data-testid="wall-canvas"]')
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d')

    Object.defineProperty(canvas.element, 'getBoundingClientRect', { value: () => ({ width: 960, height: 280 }) })
    await canvas.trigger('click', { offsetX: 1, offsetY: 1 })
    expect(wrapper.get('.cell-readout').text()).toContain('12345678901234567890')
    expect(wrapper.get('.cell-readout').text()).toContain('not an exact zero')
  })
})
