import { flushPromises, mount } from '@vue/test-utils'
import WallCanvas from '../../src/components/WallCanvas.vue'
import {
  WALL_IMPLEMENTATION_REVISION,
  WALL_OUTPUT_SCHEMA_REVISION,
  wallCompatibilityKey,
  type WallResult,
} from '../../src/registries/wallRegistry'
import { wall } from './fixtures'

function canvasResult(): WallResult {
  const options = { depth: 2, width: 3, mode: 'signed_log' as const, modulus: 0 }
  const sourceRevision = 'fixture-wall-source-v1'
  return {
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
    input: wall,
    options,
    payload: { id: wall.id, title: wall.title, kind: wall.kind, sequence: ['1'] },
    sourceRevision,
    implementationRevision: WALL_IMPLEMENTATION_REVISION,
    outputSchemaRevision: WALL_OUTPUT_SCHEMA_REVISION,
    compatibilityKey: wallCompatibilityKey(wall.id, sourceRevision, options),
    sourceProvenance: {
      url: 'https://example.test/walls/catalan.json',
      filename: wall.filename,
      sha256: 'a'.repeat(64),
    },
  }
}

describe('WallCanvas', () => {
  it('draws the matrix and reports display and exact-zero identity separately', async () => {
    const wrapper = mount(WallCanvas, {
      props: { result: canvasResult() },
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
