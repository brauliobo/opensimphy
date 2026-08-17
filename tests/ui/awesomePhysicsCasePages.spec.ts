import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { vi } from 'vitest'
import catalogJson from '../../public/data/generated/awesomePhysics/catalog.json'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import { AWESOME_PHYSICS_CASE_PAGE_IDS, awesomePhysicsCasePage } from '../../src/awesomePhysics/casePages'
import {
  astropyFigure,
  canteraFigure,
  fluidEngineDevFigure,
  galpyFigure,
  ncollideFigure,
  newtonFigure,
  physxFigure,
  pymunkFigure,
  quantumOpticsJlFigure,
  raysectFigure,
  scikitBeamFigure,
} from '../../src/awesomePhysics/caseFigures'
import { awesomePhysicsDefaultInput } from '../../src/awesomePhysics/defaultInputs'
import { resetAwesomePhysicsAdapterRegistrationsForTests } from '../../src/awesomePhysics/registerAdapters'
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
      { path: '/labs/cases', name: 'case-hub', component: { template: '<div />' } },
    ],
  })
}

async function mountDetail(id: string) {
  const router = testRouter()
  await router.push(`/awesome-physics/${id}`)
  const wrapper = mount(AwesomePhysicsSimulationView, {
    props: { id },
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('Awesome Physics case pages', () => {
  beforeEach(() => {
    resetAwesomePhysicsAdapterRegistrationsForTests()
    resetAwesomePhysicsRegistryForTests()
    runnerMock.mockReset()
    setAwesomePhysicsRegistryForTests({ catalog, simulations })
  })

  afterEach(() => {
    resetAwesomePhysicsAdapterRegistrationsForTests()
    resetAwesomePhysicsRegistryForTests()
  })

  it('registers the eleven lesson pages with typed presets', () => {
    expect([...AWESOME_PHYSICS_CASE_PAGE_IDS]).toEqual([
      'awesome-scikit-beam',
      'awesome-raysect',
      'awesome-quantumoptics-jl',
      'awesome-astropy',
      'awesome-pymunk',
      'awesome-galpy',
      'awesome-physx-3-4',
      'awesome-newton-dynamics',
      'awesome-ncollide',
      'awesome-fluid-engine-dev',
      'awesome-cantera',
    ])
    expect(awesomePhysicsCasePage('awesome-scikit-beam')?.presets.map(({ id }) => id)).toEqual(['sphere-form-factor', 'lag-correlation'])
    expect(awesomePhysicsCasePage('awesome-galpy')?.adapterId).toBe('awesome-galpy-wasm')
    expect(awesomePhysicsCasePage('awesome-pymunk')?.adapterId).toBe('awesome-pymunk-wasm')
    expect(awesomePhysicsCasePage('awesome-physx-3-4')?.adapterId).toBe('awesome-physx-3-4-wasm')
    expect(awesomePhysicsCasePage('awesome-newton-dynamics')?.adapterId).toBe('awesome-newton-dynamics-wasm')
    expect(awesomePhysicsCasePage('awesome-ncollide')?.adapterId).toBe('awesome-ncollide-wasm')
    expect(awesomePhysicsCasePage('awesome-fluid-engine-dev')?.adapterId).toBe('awesome-fluid-engine-dev-wasm')
    expect(awesomePhysicsCasePage('awesome-cantera')?.adapterId).toBe('awesome-cantera-wasm')
    expect(awesomePhysicsCasePage('awesome-physx-3-4')?.presets.map(({ id }) => id)).toEqual(['step', 'version'])
    expect(awesomePhysicsCasePage('awesome-newton-dynamics')?.presets.map(({ id }) => id)).toEqual(['step', 'version'])
    expect(awesomePhysicsCasePage('awesome-ncollide')?.presets.map(({ id }) => id)).toEqual(['step', 'distance', 'time-of-impact'])
    expect(awesomePhysicsCasePage('awesome-fluid-engine-dev')?.presets.map(({ id }) => id)).toEqual(['step', 'step-0', 'step-1'])
    expect(awesomePhysicsCasePage('awesome-cantera')?.presets.map(({ id }) => id)).toEqual(['equilibrate-hp', 'thermo', 'reactor'])
    expect(awesomePhysicsCasePage('awesome-matter-js')).toBeNull()
    expect(awesomePhysicsCasePage('awesome-simbody')).toBeNull()
  })

  it('projects sphere, prism, Jaynes-Cummings, unit, Chipmunk, orbit, PhysX, Newton, ncollide, SPH, and Cantera figures', () => {
    const sphere = scikitBeamFigure({
      operation: 'sphere-form-factor',
      samples: [
        { qNmInv: 0, formFactor: 1, intensity: 1 },
        { qNmInv: 1, formFactor: 0.5, intensity: 0.25 },
      ],
      firstMinimumQNmInv: 0.9,
    })
    expect(sphere?.series[0]?.points[0]).toEqual({ x: 0, y: 1 })
    expect(sphere?.metrics.find(({ label }) => label === 'I(0)')?.value).toBe('1')

    const prism = raysectFigure({
      operation: 'prism-trace',
      refractiveIndex: 1.5,
      deviationDeg: 38,
      transmitted: true,
      polyline: [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 1 }],
    })
    expect(prism?.ray).toHaveLength(4)
    expect(prism?.prism).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }])

    const jc = quantumOpticsJlFigure({
      operation: 'jaynes-cummings',
      vacuumRabiFrequency: 2,
      peakExcitedPopulation: 1,
      samples: [{ step: 0, time: 0, excitedPopulation: 1, cavityPhotons: 0, inversion: 1 }],
    })
    expect(jc?.series[0]?.points[0]).toEqual({ x: 0, y: 1 })

    const units = astropyFigure({ operation: 'unit-convert', value: 3.0856775814913673e16, dimension: 'length' })
    expect(units?.operation).toBe('unit-convert')
    expect(astropyFigure({ operation: 'icrs-to-galactic', lDeg: 0, bDeg: 0 })?.marker).toEqual({ x: 0, y: 0 })

    const ball = pymunkFigure({ operation: 'step', snapshot: { x: 0, y: 0.47, angle: 0.1, steps: 60 } })
    expect(ball?.y).toBeCloseTo(0.47)

    const orbit = galpyFigure({
      operation: 'integrate-orbit',
      circularVelocityAtR0: 1,
      invariants: { energyRelativeDrift: 1e-8, LzRelativeDrift: 1e-8 },
      samples: [{ time: 0, R: 1, z: 0.1, phi: 0, energy: -1 }],
    })
    expect(orbit?.series[0]?.points[0]).toEqual({ x: 1, y: 0.1 })
    expect(galpyFigure({ operation: 'circular-velocity', value: 1 })?.metrics[0]?.value).toBe('1')

    const physx = physxFigure({ operation: 'step', y: 9.997, value: 9.997, units: 'world-units' })
    expect(physx?.y).toBeCloseTo(9.997)
    expect(physxFigure({ operation: 'version', version: 30400 })?.metrics[0]?.value).toBe('30400')
    expect(physxFigure({ operation: 'step', y: 9.997 })).toBeNull()

    const newton = newtonFigure({ operation: 'step', y: 9.997, value: 9.997, units: 'world-units' })
    expect(newton?.y).toBeCloseTo(9.997)
    expect(newtonFigure({ operation: 'version', version: 400 })?.metrics[0]?.value).toBe('400')
    expect(newtonFigure({ operation: 'step', y: 9.997 })).toBeNull()

    const collide = ncollideFigure({ operation: 'step', y: -0.75, value: -0.75, units: 'world-units' })
    expect(collide?.y).toBeCloseTo(-0.75)
    expect(ncollideFigure({ operation: 'distance', value: 2.65 })?.metrics[0]?.value).toBe('2.650000')
    expect(ncollideFigure({ operation: 'step', y: -0.75 })).toBeNull()

    const sph = fluidEngineDevFigure({ operation: 'step', y: -3.981664, value: -3.981664, units: 'world-units' })
    expect(sph?.y).toBeCloseTo(-3.981664)
    expect(fluidEngineDevFigure({ operation: 'step', y: 1 })).toBeNull()

    const hp = canteraFigure({
      operation: 'equilibrate-hp',
      temperatureK: 2800,
      pressurePa: 101325,
      enthalpyMass: 1.2e6,
      density: 0.12,
    })
    expect(hp?.marker).toEqual({ x: 101325, y: 2800 })
    expect(canteraFigure({
      operation: 'reactor',
      temperatureK: 1100,
      enthalpyMass: 1e6,
      moleFractionOH: 0.01,
      timeS: 0.001,
    })?.marker).toEqual({ x: 0.001, y: 0.01 })
    expect(canteraFigure({ operation: 'equilibrate-hp', temperatureK: 2800 })).toBeNull()
  })

  it('opens scikit-beam from the catalog through in-app routing and fills the SAXS figure', async () => {
    runnerMock.mockResolvedValue({
      operation: 'sphere-form-factor',
      samples: [
        { qNmInv: 0, formFactor: 1, intensity: 1 },
        { qNmInv: 1.5, formFactor: 0.2, intensity: 0.04 },
      ],
      firstMinimumQNmInv: 0.9,
    } as never)

    const router = testRouter()
    await router.push('/awesome-physics')
    const catalogView = mount(AwesomePhysicsCatalogView, { global: { plugins: [router] } })
    await flushPromises()

    const card = catalogView.get('[data-testid="awesome-catalog-card-awesome-scikit-beam"]')
    expect(card.get('a.text-link').attributes('href')).toBe('/awesome-physics/awesome-scikit-beam')
    await card.get('[data-testid="awesome-catalog-run"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.params).toEqual({ id: 'awesome-scikit-beam' })
    catalogView.unmount()

    const { wrapper } = await mountDetail('awesome-scikit-beam')
    expect(wrapper.find('[data-testid="awesome-case-page-awesome-scikit-beam"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="awesome-case-idle"]').exists()).toBe(true)
    expect(JSON.parse((wrapper.get('[data-testid="awesome-physics-inputs"]').element as HTMLTextAreaElement).value)).toEqual(
      awesomePhysicsDefaultInput('awesome-scikit-beam-typescript'),
    )

    await wrapper.get('[data-testid="awesome-physics-run"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="awesome-case-scikit-beam-curve"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="awesome-case-scikit-beam-metrics"]').text()).toContain('I(0)')
    wrapper.unmount()
  })

  it('switches the scikit-beam lag-correlation preset without a full reload', async () => {
    const { wrapper } = await mountDetail('awesome-scikit-beam')
    const select = wrapper.get('[data-testid="awesome-physics-preset"]')
    await select.setValue('lag-correlation')
    await select.trigger('change')
    await flushPromises()
    expect(JSON.parse((wrapper.get('[data-testid="awesome-physics-inputs"]').element as HTMLTextAreaElement).value)).toEqual({
      operation: 'lag-correlation',
      intensity: [1, 0, 1, 0, 1, 0],
    })
    wrapper.unmount()
  })

  it('renders raysect, QuantumOptics.jl, astropy, pymunk, galpy, PhysX, Newton, ncollide, SPH, and Cantera lesson pages', async () => {
    const payloads = {
      'awesome-raysect': {
        operation: 'prism-trace',
        refractiveIndex: 1.52,
        deviationDeg: 38.2,
        transmitted: true,
        polyline: [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0.4 }],
      },
      'awesome-quantumoptics-jl': {
        operation: 'jaynes-cummings',
        vacuumRabiFrequency: 2,
        peakExcitedPopulation: 1,
        samples: [
          { step: 0, time: 0, excitedPopulation: 1, cavityPhotons: 0, inversion: 1 },
          { step: 20, time: 0.2, excitedPopulation: 0.6, cavityPhotons: 0.4, inversion: 0.2 },
        ],
      },
      'awesome-astropy': { operation: 'unit-convert', value: 3.0856775814913673e16, dimension: 'length' },
      'awesome-pymunk': { operation: 'step', snapshot: { x: 0, y: 0.47, angle: 0.05, steps: 60 } },
      'awesome-galpy': {
        operation: 'integrate-orbit',
        circularVelocityAtR0: 1,
        invariants: { energyRelativeDrift: 1e-9, LzRelativeDrift: 1e-9 },
        samples: [
          { time: 0, R: 1, z: 0.1, phi: 0, energy: -1 },
          { time: 0.2, R: 1.01, z: 0.09, phi: 0.2, energy: -1 },
        ],
      },
      'awesome-physx-3-4': { operation: 'step', y: 9.997, value: 9.997, units: 'world-units' },
      'awesome-newton-dynamics': { operation: 'step', y: 9.997, value: 9.997, units: 'world-units' },
      'awesome-ncollide': { operation: 'step', y: -0.75, value: -0.75, units: 'world-units' },
      'awesome-fluid-engine-dev': { operation: 'step', y: -3.981664, value: -3.981664, units: 'world-units' },
      'awesome-cantera': { operation: 'equilibrate-hp', temperatureK: 2800, pressurePa: 101325, enthalpyMass: 1.2e6, density: 0.12 },
    } as const

    for (const [id, payload] of Object.entries(payloads)) {
      runnerMock.mockResolvedValueOnce(payload as never)
      const { wrapper, router } = await mountDetail(id)
      expect(wrapper.find(`[data-testid="awesome-case-page-${id}"]`).exists()).toBe(true)
      expect(router.resolve(`/awesome-physics/${id}`).name).toBe('awesome-physics-detail')
      await wrapper.get('[data-testid="awesome-physics-run"]').trigger('click')
      await flushPromises()
      if (id === 'awesome-raysect') expect(wrapper.find('[data-testid="awesome-case-raysect-ray"]').exists()).toBe(true)
      if (id === 'awesome-quantumoptics-jl') expect(wrapper.find('[data-testid="awesome-case-quantumoptics-jl-curve"]').exists()).toBe(true)
      if (id === 'awesome-astropy') expect(wrapper.get('[data-testid="awesome-case-astropy-metrics"]').text()).toContain('length')
      if (id === 'awesome-pymunk') expect(wrapper.find('[data-testid="awesome-case-pymunk-ball"]').exists()).toBe(true)
      if (id === 'awesome-galpy') expect(wrapper.find('[data-testid="awesome-case-galpy-curve"]').exists()).toBe(true)
      if (id === 'awesome-physx-3-4') expect(wrapper.find('[data-testid="awesome-case-physx-sphere"]').exists()).toBe(true)
      if (id === 'awesome-newton-dynamics') expect(wrapper.find('[data-testid="awesome-case-newton-sphere"]').exists()).toBe(true)
      if (id === 'awesome-ncollide') expect(wrapper.find('[data-testid="awesome-case-ncollide-ball"]').exists()).toBe(true)
      if (id === 'awesome-fluid-engine-dev') expect(wrapper.find('[data-testid="awesome-case-fluid-engine-dev-jet"]').exists()).toBe(true)
      if (id === 'awesome-cantera') expect(wrapper.find('[data-testid="awesome-case-cantera-marker"]').exists()).toBe(true)
      wrapper.unmount()
    }
  })

  it('opens PhysX, Newton, ncollide, SPH, and Cantera from the catalog through in-app routing', async () => {
    for (const id of ['awesome-physx-3-4', 'awesome-newton-dynamics', 'awesome-ncollide', 'awesome-fluid-engine-dev', 'awesome-cantera'] as const) {
      const router = testRouter()
      await router.push('/awesome-physics')
      const catalogView = mount(AwesomePhysicsCatalogView, { global: { plugins: [router] } })
      await flushPromises()

      const card = catalogView.get(`[data-testid="awesome-catalog-card-${id}"]`)
      expect(card.get('a.text-link').attributes('href')).toBe(`/awesome-physics/${id}`)
      await card.get('[data-testid="awesome-catalog-run"]').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.params).toEqual({ id })
      catalogView.unmount()
    }
  })
})
