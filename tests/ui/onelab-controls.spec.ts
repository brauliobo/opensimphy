import { flushPromises, mount } from '@vue/test-utils'
import { canonicalizeOnelab } from '../../src/simulation/onelab-db'

const defaults = canonicalizeOnelab({ onelab: { version: '1.3', parameters: [
  { type: 'number', name: 'Parameters/Mesh/Size', label: 'Mesh size', values: [1], min: 0.5, max: 2, step: 0.5, choices: [1, 2], valueLabels: { Fine: 1, Coarse: 2 }, changedValue: 31, visible: true, readOnly: false, clients: { Gmsh: 0, GetDP: 0 } },
  { type: 'string', name: 'Parameters/Label', values: ['native'], choices: ['native', 'audit'], changedValue: 31, visible: true, readOnly: false, clients: { Gmsh: 0 } },
  { type: 'number', name: 'Parameters/Derived', values: [0.1], min: -1e200, max: 1e200, step: 0, changedValue: 0, visible: false, readOnly: true, clients: { Gmsh: 0 } },
] } })

const openMicrostrip = vi.fn(async () => ({ files: [{ path: '/microstrip.geo', bytes: new Uint8Array([1]) }], defaults }))
let projectResponse = (envelope: any) => Promise.resolve({ action: envelope.action, projectId: envelope.projectId, revision: envelope.revision, database: envelope.action === 'reset' ? defaults : envelope.database })
const startProject = vi.fn((envelope) => ({ requestId: String(startProject.mock.calls.length), promise: projectResponse(envelope) }))

vi.mock('../../src/simulation/client', () => ({
  OnelabClient: class {
    warm = vi.fn(async () => ({}))
    openMicrostrip = openMicrostrip
    startProject = startProject
    onEnteredNative() { return () => {} }
    dispose() {}
  },
}))
vi.mock('../../src/simulation/viewer-client', () => ({ MeshstepClient: class { dispose() {} } }))

import OnelabLabView from '../../src/views/OnelabLabView.vue'

describe('ONELAB parameter controls', () => {
  beforeEach(() => {
    startProject.mockClear()
    projectResponse = (envelope) => Promise.resolve({ action: envelope.action, projectId: envelope.projectId, revision: envelope.revision, database: envelope.action === 'reset' ? defaults : envelope.database })
  })

  it('renders native metadata, changed state, check envelopes and reset defaults', async () => {
    const wrapper = mount(OnelabLabView, { global: { stubs: { SimulationSceneHost: true } } })
    await wrapper.get('[data-testid="onelab-warm"]').trigger('click')
    await flushPromises()
    const size = wrapper.get('[data-testid="parameter-size"]')
    expect(size.findAll('option').map((option) => option.text())).toEqual(['Fine', 'Coarse'])
    expect(wrapper.get('[data-testid="parameter-derived"]').isVisible()).toBe(false)
    await size.get('select').setValue('2')
    expect(size.attributes('data-changed')).toBe('31')
    await wrapper.get('[data-testid="onelab-check"]').trigger('click')
    await flushPromises()
    expect(startProject).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'check', revision: 1 }))
    await wrapper.get('[data-testid="onelab-reset"]').trigger('click')
    await flushPromises()
    expect(size.get('select').element.value).toBe('1')
    wrapper.unmount()
  })

  it('locks edits during native work and exits running on a stale response', async () => {
    let resolve!: (value: any) => void
    let envelope: any
    projectResponse = (request) => new Promise((next) => { envelope = request; resolve = next })
    const wrapper = mount(OnelabLabView, { global: { stubs: { SimulationSceneHost: true } } })
    await wrapper.get('[data-testid="onelab-warm"]').trigger('click')
    await flushPromises()
    const input = wrapper.get('[data-testid="parameter-size"] select')
    await wrapper.get('[data-testid="onelab-check"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(input.attributes('disabled')).toBeDefined()
    resolve({ action: envelope.action, projectId: 'foreign', revision: envelope.revision, database: envelope.database })
    await flushPromises()
    expect(wrapper.get('[data-testid="onelab-state"]').attributes('data-state')).toBe('stale')
    expect(input.attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[role="alert"]').text()).toContain('foreign-project')
    wrapper.unmount()
  })
})
