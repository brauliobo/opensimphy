import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { vi } from 'vitest'
import catalogJson from '../../public/data/generated/awesomePhysics/catalog.json'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import { resetAwesomePhysicsAdapterRegistrationsForTests } from '../../src/awesomePhysics/registerAdapters'
import { awesomePhysicsDefaultInput } from '../../src/awesomePhysics/defaultInputs'
import { runAwesomePhysicsInWorker } from '../../src/awesomePhysics/workers/runInWorker'
import { resetAwesomePhysicsRegistryForTests, setAwesomePhysicsRegistryForTests } from '../../src/registries/awesomePhysicsRegistry'
import AwesomePhysicsCatalogView from '../../src/views/AwesomePhysicsCatalogView.vue'
import AwesomePhysicsSimulationView from '../../src/views/AwesomePhysicsSimulationView.vue'
import type {
  AwesomePhysicsCatalogArtifactV1,
  AwesomePhysicsSimulationArtifactV1,
} from '../../src/types/awesomePhysics'

vi.mock('../../src/awesomePhysics/workers/runInWorker', () => ({
  runAwesomePhysicsInWorker: vi.fn(),
}))

const catalog = catalogJson as AwesomePhysicsCatalogArtifactV1
const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const runnerMock = vi.mocked(runAwesomePhysicsInWorker)

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/awesome-physics', name: 'awesome-physics-catalog', component: AwesomePhysicsCatalogView },
      { path: '/awesome-physics/:id', name: 'awesome-physics-detail', component: AwesomePhysicsSimulationView, props: true },
    ],
  })
}

function installRegistryFixture(): void {
  setAwesomePhysicsRegistryForTests({ catalog, simulations })
}

async function mountDetail(id: string) {
  const router = testRouter()
  await router.push(`/awesome-physics/${id}`)
  const wrapper = mount(AwesomePhysicsSimulationView, {
    props: { id },
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

describe('Awesome Physics catalog and detail surfaces', () => {
  beforeEach(() => {
    resetAwesomePhysicsAdapterRegistrationsForTests()
    resetAwesomePhysicsRegistryForTests()
    runnerMock.mockReset()
    installRegistryFixture()
  })

  afterEach(() => {
    resetAwesomePhysicsAdapterRegistrationsForTests()
    resetAwesomePhysicsRegistryForTests()
  })

  it('renders every project, archive, and organization record with deterministic counts', async () => {
    const router = testRouter()
    await router.push('/awesome-physics')
    const wrapper = mount(AwesomePhysicsCatalogView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.get('[data-testid="awesome-catalog-counts"]').text()).toContain('Catalog records86')
    expect(wrapper.get('[data-testid="awesome-catalog-counts"]').text()).toContain('Projects + archive76')
    expect(wrapper.get('[data-testid="awesome-catalog-counts"]').text()).toContain('Organizations10')
    expect(wrapper.findAll('.awesome-catalog-card')).toHaveLength(86)
    expect(wrapper.findAll('[data-testid="awesome-catalog-run"]')).toHaveLength(14)
    expect(runnerMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('searches all fields and filters archive and organization records without reordering matches', async () => {
    const router = testRouter()
    await router.push('/awesome-physics')
    const wrapper = mount(AwesomePhysicsCatalogView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.get('[data-testid="awesome-physics-search"]').setValue('awesome-matter-js')
    expect(wrapper.findAll('.awesome-catalog-card')).toHaveLength(1)
    expect(wrapper.get('[data-testid="awesome-catalog-card-awesome-matter-js"]').exists()).toBe(true)

    await wrapper.get('[data-testid="awesome-physics-clear"]').trigger('click')
    await wrapper.get('[data-testid="awesome-physics-record-type"]').setValue('archive')
    expect(wrapper.findAll('.awesome-catalog-card')).toHaveLength(1)
    expect(wrapper.find('.awesome-catalog-card.is-organization').exists()).toBe(false)

    await wrapper.get('[data-testid="awesome-physics-record-type"]').setValue('organization')
    expect(wrapper.findAll('.awesome-catalog-card')).toHaveLength(10)
    expect(wrapper.findAll('.awesome-catalog-card.is-organization')).toHaveLength(10)
    wrapper.unmount()
  })

  it('exposes Run only for available descriptors and hides it for gated records', async () => {
    const router = testRouter()
    await router.push('/awesome-physics')
    const wrapper = mount(AwesomePhysicsCatalogView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.get('[data-testid="awesome-catalog-card-awesome-matter-js"]').find('[data-testid="awesome-catalog-run"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="awesome-catalog-card-awesome-bullet3"]').find('[data-testid="awesome-catalog-run"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="awesome-catalog-card-awesome-mujoco-py"]').find('[data-testid="awesome-catalog-run"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="awesome-catalog-card-awesome-solid-state-simulations-archive"]').find('[data-testid="awesome-catalog-run"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('fails closed for an unknown detail route parameter', async () => {
    const wrapper = await mountDetail('not-a-catalog-record')

    expect(wrapper.get('[data-testid="awesome-physics-detail-error"]').text()).toContain('was not found in the catalog')
    expect(wrapper.find('[data-testid="awesome-physics-run-panel"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('invokes the fake worker runner with typed defaults and preserves provenance boundaries', async () => {
    runnerMock.mockImplementation(async (_request, options) => {
      options?.onProgress?.(25)
      return { safe: true, result: 'bounded' } as never
    })
    const wrapper = await mountDetail('awesome-qmsolve')
    const expectedInput = awesomePhysicsDefaultInput('awesome-qmsolve-typescript')

    expect(expectedInput).not.toBeNull()
    expect(JSON.parse((wrapper.get('[data-testid="awesome-physics-inputs"]').element as HTMLTextAreaElement).value)).toEqual(expectedInput)
    expect(wrapper.get('[data-testid="awesome-physics-provenance"]').text()).toContain('does not establish')
    expect(wrapper.get('[data-testid="awesome-physics-provenance"]').text()).toContain('scientific theory validation')

    await wrapper.get('[data-testid="awesome-physics-run"]').trigger('click')
    await flushPromises()

    expect(runnerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'run',
        adapterId: 'awesome-qmsolve-typescript',
        input: expectedInput,
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal), onProgress: expect.any(Function) }),
    )
    expect(wrapper.get('[data-testid="awesome-physics-result"]').text()).toContain('"safe": true')
    expect(wrapper.get('[data-testid="awesome-physics-result"]').find('script').exists()).toBe(false)
    wrapper.unmount()
  })

  it('cancels an active fake run and resets inputs and result state', async () => {
    let signal: AbortSignal | undefined
    runnerMock.mockImplementation((_request, options) => {
      signal = options?.signal
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => resolve({ cancelled: true } as never), { once: true })
      }) as never
    })
    const wrapper = await mountDetail('awesome-matter-js')
    const input = wrapper.get('[data-testid="awesome-physics-inputs"]')
    const initialInput = (input.element as HTMLTextAreaElement).value

    await wrapper.get('[data-testid="awesome-physics-run"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="awesome-physics-cancel"]').trigger('click')
    await flushPromises()

    expect(signal?.aborted).toBe(true)
    expect(wrapper.get('[data-testid="awesome-physics-status"]').text()).toContain('cancelled')
    await input.setValue('{"changed":true}')
    await wrapper.get('[data-testid="awesome-physics-reset"]').trigger('click')

    expect((input.element as HTMLTextAreaElement).value).toBe(initialInput)
    expect(wrapper.get('[data-testid="awesome-physics-status"]').text()).toContain('idle')
    expect(wrapper.find('[data-testid="awesome-physics-result"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
