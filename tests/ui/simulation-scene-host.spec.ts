import { mount } from '@vue/test-utils'
import SimulationSceneHost from '../../src/components/SimulationSceneHost.vue'
import type { SimulationScene } from '../../src/simulation/scene'

const dispose = vi.fn()
const setScene = vi.fn()
const setClipping = vi.fn()
const setExplosion = vi.fn()
const fit = vi.fn()
const clearMeasurement = vi.fn()
const setResult = vi.fn()
const renderState = vi.fn(() => ({ clipped: false, explosion: 0, positionSample: [], sourceSample: [], measurements: 0 }))

vi.mock('../../src/simulation/scene-host', () => ({
  SceneHost: class {
    onSelection?: unknown
    onMeasurement?: unknown
    dispose = dispose
    setScene = setScene
    setClipping = setClipping
    setExplosion = setExplosion
    fit = fit
    clearMeasurement = clearMeasurement
    setResult = setResult
    renderState = renderState
  },
}))

const scene = {
  source: 'meshstep-preview',
  referencePositions: new Float64Array(), surfaceTriangles: new Uint32Array(), triangleEntityTags: new Uint32Array(),
  entities: [], elementBlocks: [], groups: [], fields: [], surfaceSignatures: [],
} satisfies SimulationScene

const resultScene = {
  ...scene,
  fields: [{
    id: 'v', name: 'Potential', association: 'node' as const, components: 1 as const,
    values: new Float64Array([0, 1, 2, 3]), steps: new Int32Array([0, 1]), times: new Float64Array([0, 2]),
    ranges: new Float64Array([0, 1, 2, 3]), globalRange: [0, 3] as [number, number], tags: new BigUint64Array([1n, 2n]),
    provenance: { representation: 'list' as const, sourceFile: 'v.pos', viewName: 'v', dataTypes: ['SL'], originalRecords: 1 },
  }],
} satisfies SimulationScene

describe('SimulationSceneHost', () => {
  it('owns controls and disposes its host with the Vue lifecycle', async () => {
    const wrapper = mount(SimulationSceneHost, { props: { scene } })
    expect(setScene).toHaveBeenCalledWith(scene)
    await wrapper.get('[data-testid="scene-fit"]').trigger('click')
    await wrapper.get('[data-testid="scene-clip"]').trigger('click')
    await wrapper.get('[data-testid="scene-explode"]').setValue('3')
    expect(fit).toHaveBeenCalled()
    expect(setClipping).toHaveBeenCalledWith(true)
    expect(setExplosion).toHaveBeenCalledWith(3)
    await wrapper.setProps({ scene: { ...scene, source: 'gmsh-authoritative' } })
    expect(setClipping).toHaveBeenLastCalledWith(false)
    expect(setExplosion).toHaveBeenLastCalledWith(0)
    expect(wrapper.get('[data-testid="scene-clip"]').attributes('aria-pressed')).toBe('false')
    expect((wrapper.get('[data-testid="scene-explode"]').element as HTMLInputElement).value).toBe('0')
    wrapper.unmount()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('selects timesteps and range modes for mapped fields', async () => {
    const wrapper = mount(SimulationSceneHost, { props: { scene: resultScene } })
    await wrapper.vm.$nextTick()
    expect(setResult).toHaveBeenCalledWith('v', 0, 'global', undefined)
    const stepSelect = wrapper.get('[data-testid="result-step"]')
    ;(stepSelect.findAll('option')[1]!.element as HTMLOptionElement).selected = true
    await stepSelect.trigger('change')
    expect(setResult).toHaveBeenLastCalledWith('v', 1, 'global', undefined)
    await wrapper.get('[data-testid="result-range-mode"]').setValue('custom')
    await wrapper.get('[data-testid="result-range-min"]').setValue('0.5')
    await wrapper.get('[data-testid="result-range-max"]').setValue('2.5')
    expect(setResult).toHaveBeenLastCalledWith('v', 1, 'custom', [0.5, 2.5])
    expect(wrapper.get('[data-testid="result-legend"]').text()).toContain('0.5')
    wrapper.unmount()
  })
})
