import { mount } from '@vue/test-utils'
import CliffordSpaceInstrument from '../../src/components/clifford-space/CliffordSpaceInstrument.vue'

const dispose = vi.fn()
const setModel = vi.fn()
const setCamera = vi.fn()
const setPerspective = vi.fn()
const pick = vi.fn()

vi.mock('../../src/clifford-space/cliffordSpaceScene', () => ({
  CliffordSpaceScene: class {
    dispose = dispose
    setModel = setModel
    setCamera = setCamera
    setPerspective = setPerspective
    pick = pick
  },
}))

describe('Clifford space instrument', () => {
  afterEach(() => {
    dispose.mockClear()
    setModel.mockClear()
    setCamera.mockClear()
    setPerspective.mockClear()
    pick.mockClear()
  })

  it('defaults the probe to the cube center and shows the two-blade combination', () => {
    const wrapper = mount(CliffordSpaceInstrument)

    expect(wrapper.get('[data-testid="principal-combination"]').text()).toBe('0.3536 k + 0.3536 L')
    expect(wrapper.get('[data-testid="basis-norm"]').text()).toContain('1.0000')
    expect(wrapper.get('[data-testid="basis-bar-1"]').text()).toMatch(/0\.3536/)
    expect(wrapper.get('[data-testid="basis-bar-k"]').text()).toMatch(/0\.3536/)
    expect(wrapper.get('[data-testid="basis-bar-L"]').text()).toMatch(/0\.3536/)
    expect(wrapper.get('[data-testid="space-mode"] button[value="tiling"]').attributes('aria-selected')).toBe('true')
    expect((wrapper.get('[data-testid="label-set"]').element as HTMLSelectElement).value).toBe('inside-dodecahedron')
    expect(setPerspective).toHaveBeenCalledWith(false)
    wrapper.unmount()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('sends the probe to the origin and isolates the scalar', async () => {
    const wrapper = mount(CliffordSpaceInstrument)

    await wrapper.get('[data-testid="go-origin"]').trigger('click')

    expect(wrapper.get('[data-testid="principal-combination"]').text()).toContain('1.0000')
    expect(wrapper.get('[data-testid="basis-bar-1"]').text()).toMatch(/1\.0000/)
    expect(wrapper.get('[data-testid="basis-bar-I"]').text()).toMatch(/0\.0000/)
    expect(wrapper.get('[data-testid="basis-bar-L"]').text()).toMatch(/0\.0000/)
    expect(wrapper.get('[data-testid="basis-norm"]').text()).toContain('1.0000')
    wrapper.unmount()
  })

  it('pushes one-cube mode and an x view into the scene host', async () => {
    const wrapper = mount(CliffordSpaceInstrument)
    setModel.mockClear()
    setCamera.mockClear()

    await wrapper.get('[data-testid="space-mode"] button[value="one-cube"]').trigger('click')
    await wrapper.get('[data-testid="camera-view"] button[value="x"]').trigger('click')

    expect(setModel).toHaveBeenCalled()
    expect(setCamera).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('turns perspective on when orthographic is unchecked', async () => {
    const wrapper = mount(CliffordSpaceInstrument)
    setPerspective.mockClear()

    await wrapper.get('[data-testid="orthographic"]').setValue(false)

    expect(setPerspective).toHaveBeenCalledWith(true)
    wrapper.unmount()
  })
})
