import { flushPromises, mount } from '@vue/test-utils'
import simulationJson from '../../public/data/generated/tour/simulations/dimensional-equation-builder.json'
import TourSimulationStage from '../../src/components/tour/TourSimulationStage.vue'
import type { TourGeneratedSimulation } from '../../src/types/tour'
import { instrumentStubs } from './tourInstrumentStubs'

vi.mock('../../src/components/tour/DimensionBuilder.vue', async () => {
  const { instrumentStubs: stubs } = await import('./tourInstrumentStubs')
  return { __esModule: true, default: stubs.DimensionBuilder }
})

const simulation = simulationJson as unknown as TourGeneratedSimulation
const mountedWrappers: Array<{ unmount(): void }> = []

afterEach(() => {
  while (mountedWrappers.length) mountedWrappers.pop()?.unmount()
})

it('resolves a mocked instrument after a parent prop update', async () => {
  const wrapper = mount(TourSimulationStage, {
    props: {
      simulation,
      depth: 'guided',
      initialPresetId: 'quick-preset',
    },
  })
  mountedWrappers.push(wrapper)
  await flushPromises()
  await wrapper.setProps({ depth: 'technical' })
  await flushPromises()
  expect(wrapper.html()).toContain('dimension-builder-stub')
})
