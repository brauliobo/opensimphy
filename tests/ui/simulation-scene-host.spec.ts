import { mount } from '@vue/test-utils'
import SimulationSceneHost from '../../src/components/SimulationSceneHost.vue'
import type { SimulationScene } from '../../src/simulation/scene'

const dispose = vi.fn()
const setScene = vi.fn()
const setClipping = vi.fn()
const setExplosion = vi.fn()
const fit = vi.fn()
const clearMeasurement = vi.fn()
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
    renderState = renderState
  },
}))

const scene = {
  source: 'meshstep-preview',
  referencePositions: new Float64Array(), surfaceTriangles: new Uint32Array(), triangleEntityTags: new Uint32Array(),
  entities: [], elementBlocks: [], groups: [], fields: [], surfaceSignatures: [],
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
})
