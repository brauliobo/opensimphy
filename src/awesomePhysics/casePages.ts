import { AWESOME_PHYSICS_ADAPTER_IDS } from './adapterFactories'
import { AWESOME_PHYSICS_DEFAULT_INPUTS } from './defaultInputs'
import type { AwesomePhysicsDefaultInput } from './defaultInputs'
import type { AwesomePhysicsJsonValue } from './workers/protocol'

export const AWESOME_PHYSICS_CASE_PAGE_IDS = [
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
] as const

export type AwesomePhysicsCasePageId = typeof AWESOME_PHYSICS_CASE_PAGE_IDS[number]

export interface AwesomePhysicsCasePreset {
  id: string
  label: string
  input: AwesomePhysicsDefaultInput
}

export interface AwesomePhysicsCasePage {
  catalogItemId: AwesomePhysicsCasePageId
  adapterId: string
  title: string
  lesson: string
  presets: readonly AwesomePhysicsCasePreset[]
}

const SCIKIT_BEAM_DEFAULT = AWESOME_PHYSICS_DEFAULT_INPUTS[AWESOME_PHYSICS_ADAPTER_IDS.scikitBeam]
const RAYSECT_DEFAULT = AWESOME_PHYSICS_DEFAULT_INPUTS[AWESOME_PHYSICS_ADAPTER_IDS.raysect]
const QUANTUM_OPTICS_JL_DEFAULT = AWESOME_PHYSICS_DEFAULT_INPUTS[AWESOME_PHYSICS_ADAPTER_IDS.quantumOpticsJl]
const ASTROPY_DEFAULT = AWESOME_PHYSICS_DEFAULT_INPUTS[AWESOME_PHYSICS_ADAPTER_IDS.astropy]
const PYMUNK_DEFAULT = AWESOME_PHYSICS_DEFAULT_INPUTS[AWESOME_PHYSICS_ADAPTER_IDS.pymunk]
const GALPY_DEFAULT = AWESOME_PHYSICS_DEFAULT_INPUTS[AWESOME_PHYSICS_ADAPTER_IDS.galpy]
const PHYSX_DEFAULT = AWESOME_PHYSICS_DEFAULT_INPUTS[AWESOME_PHYSICS_ADAPTER_IDS.physx]
const NEWTON_DEFAULT = AWESOME_PHYSICS_DEFAULT_INPUTS[AWESOME_PHYSICS_ADAPTER_IDS.newtonDynamics]
const NCOLLIDE_DEFAULT = AWESOME_PHYSICS_DEFAULT_INPUTS[AWESOME_PHYSICS_ADAPTER_IDS.ncollide]
const FLUID_ENGINE_DEV_DEFAULT = AWESOME_PHYSICS_DEFAULT_INPUTS[AWESOME_PHYSICS_ADAPTER_IDS.fluidEngineDev]
const CANTERA_DEFAULT = AWESOME_PHYSICS_DEFAULT_INPUTS[AWESOME_PHYSICS_ADAPTER_IDS.cantera]

export const AWESOME_PHYSICS_CASE_PAGES: readonly AwesomePhysicsCasePage[] = Object.freeze([
  {
    catalogItemId: 'awesome-scikit-beam',
    adapterId:     AWESOME_PHYSICS_ADAPTER_IDS.scikitBeam,
    title:         'Sphere SAXS form factor',
    lesson:        'Independent TypeScript kernel: Rayleigh-Gans sphere F(q) and a static 1D lag correlation. scikit-beam Cython and detector images are not used.',
    presets:       Object.freeze([
      { id: 'sphere-form-factor', label: 'Sphere form factor', input: SCIKIT_BEAM_DEFAULT },
      {
        id:    'lag-correlation',
        label: 'Lag correlation',
        input: { operation: 'lag-correlation' as const, intensity: [1, 0, 1, 0, 1, 0] },
      },
    ]),
  },
  {
    catalogItemId: 'awesome-raysect',
    adapterId:     AWESOME_PHYSICS_ADAPTER_IDS.raysect,
    title:         'Cauchy prism Snell trace',
    lesson:        'Independent TypeScript kernel: 2D isosceles prism in air with n = A + B/λ_μm². The raysect engine is not used.',
    presets:       Object.freeze([{ id: 'prism-trace', label: 'Prism trace', input: RAYSECT_DEFAULT }]),
  },
  {
    catalogItemId: 'awesome-quantumoptics-jl',
    adapterId:     AWESOME_PHYSICS_ADAPTER_IDS.quantumOpticsJl,
    title:         'Jaynes-Cummings TypeScript stand-in',
    lesson:        'Independent TypeScript kernel on the single-excitation manifold. Julia and QuantumOptics.jl are not executed.',
    presets:       Object.freeze([{ id: 'jaynes-cummings', label: 'Jaynes-Cummings', input: QUANTUM_OPTICS_JL_DEFAULT }]),
  },
  {
    catalogItemId: 'awesome-astropy',
    adapterId:     AWESOME_PHYSICS_ADAPTER_IDS.astropy,
    title:         'SI units and ICRS to Galactic',
    lesson:        'Independent TypeScript kernel: SI unit conversion and a Reid & Brunthaler ICRS→Galactic rotation. astropy C extensions, FITS, and remote data are not used.',
    presets:       Object.freeze([
      { id: 'unit-convert', label: 'Parsec to metre', input: ASTROPY_DEFAULT },
      {
        id:    'icrs-to-galactic',
        label: 'ICRS to Galactic',
        input: { operation: 'icrs-to-galactic' as const, raDeg: 266.4051, decDeg: -28.936175 },
      },
    ]),
  },
  {
    catalogItemId: 'awesome-pymunk',
    adapterId:     AWESOME_PHYSICS_ADAPTER_IDS.pymunk,
    title:         'Chipmunk headless ball',
    lesson:        'Verified local pymunk/Chipmunk WASM: a 2D ball over a static ground. A finite snapshot is not theory validation.',
    presets:       Object.freeze([
      { id: 'step', label: 'Step 60', input: PYMUNK_DEFAULT },
      { id: 'snapshot', label: 'Snapshot', input: { operation: 'snapshot' as const } },
    ]),
  },
  {
    catalogItemId: 'awesome-galpy',
    adapterId:     AWESOME_PHYSICS_ADAPTER_IDS.galpy,
    title:         'MWPotential2014 orbit',
    lesson:        'Verified local galpy WASM: leapfrog orbit in MWPotential2014 natural units. A finite orbit is not a galactic mass-model validation.',
    presets:       Object.freeze([
      { id: 'integrate-orbit', label: 'Integrate orbit', input: GALPY_DEFAULT },
      { id: 'circular-velocity', label: 'Circular velocity', input: { operation: 'circular-velocity' as const, R: 1 } },
    ]),
  },
  {
    catalogItemId: 'awesome-physx-3-4',
    adapterId:     AWESOME_PHYSICS_ADAPTER_IDS.physx,
    title:         'PhysX 3.4 headless sphere',
    lesson:        'Verified local PhysX 3.4 WASM: a sphere over a static y = 0 plane with g = -10. A finite snapshot is not theory validation.',
    presets:       Object.freeze([
      { id: 'step', label: 'Step', input: PHYSX_DEFAULT },
      { id: 'version', label: 'Version', input: { operation: 'version' as const } },
    ]),
  },
  {
    catalogItemId: 'awesome-newton-dynamics',
    adapterId:     AWESOME_PHYSICS_ADAPTER_IDS.newtonDynamics,
    title:         'Newton Dynamics headless sphere',
    lesson:        'Verified local Newton Dynamics WASM: a free sphere under g = -10. A finite snapshot is not theory validation.',
    presets:       Object.freeze([
      { id: 'step', label: 'Step', input: NEWTON_DEFAULT },
      { id: 'version', label: 'Version', input: { operation: 'version' as const } },
    ]),
  },
  {
    catalogItemId: 'awesome-ncollide',
    adapterId:     AWESOME_PHYSICS_ADAPTER_IDS.ncollide,
    title:         'ncollide2d CCD plane settle',
    lesson:        'Verified local ncollide2d WASM: ball/cuboid distance and a CCD plane-settling step. A finite collision fixture is not theory validation.',
    presets:       Object.freeze([
      { id: 'step', label: 'CCD settle', input: NCOLLIDE_DEFAULT },
      { id: 'distance', label: 'Distance', input: { operation: 'distance' as const } },
      { id: 'time-of-impact', label: 'Time of impact', input: { operation: 'time-of-impact' as const } },
    ]),
  },
  {
    catalogItemId: 'awesome-fluid-engine-dev',
    adapterId:     AWESOME_PHYSICS_ADAPTER_IDS.fluidEngineDev,
    title:         'Jet 2D SPH step',
    lesson:        'Verified local fluid-engine-dev WASM: serial Jet 2D SPH. jet_sph2_step(0/1/60) is a finite fixture, not a fluids-theory validation.',
    presets:       Object.freeze([
      { id: 'step', label: 'Step 60', input: FLUID_ENGINE_DEV_DEFAULT },
      { id: 'step-0', label: 'Step 0', input: { operation: 'step' as const, steps: 0 } },
      { id: 'step-1', label: 'Step 1', input: { operation: 'step' as const, steps: 1 } },
    ]),
  },
  {
    catalogItemId: 'awesome-cantera',
    adapterId:     AWESOME_PHYSICS_ADAPTER_IDS.cantera,
    title:         'Cantera H2/O2 zero-D',
    lesson:        'Verified local Cantera WASM: ohmech thermo, HP equilibrium, and a constant-pressure reactor. A finite fixture is not a kinetics or mechanism validation.',
    presets:       Object.freeze([
      { id: 'equilibrate-hp', label: 'HP equilibrium', input: CANTERA_DEFAULT },
      { id: 'thermo', label: 'Thermo', input: { operation: 'thermo' as const, temperatureK: 1001, pressurePa: 101325 } },
      { id: 'reactor', label: 'Reactor', input: { operation: 'reactor' as const, temperatureK: 1001, pressurePa: 101325, timeS: 0.001 } },
    ]),
  },
])

const CASE_PAGES_BY_ID = new Map(AWESOME_PHYSICS_CASE_PAGES.map((page) => [page.catalogItemId, page]))

export function isAwesomePhysicsCasePageId(id: string): id is AwesomePhysicsCasePageId {
  return CASE_PAGES_BY_ID.has(id as AwesomePhysicsCasePageId)
}

export function awesomePhysicsCasePage(id: string): AwesomePhysicsCasePage | null {
  return CASE_PAGES_BY_ID.get(id as AwesomePhysicsCasePageId) ?? null
}

export function awesomePhysicsCasePresets(id: string): readonly AwesomePhysicsCasePreset[] {
  return awesomePhysicsCasePage(id)?.presets ?? []
}

export function awesomePhysicsCasePresetInput(preset: AwesomePhysicsCasePreset): AwesomePhysicsJsonValue {
  return JSON.parse(JSON.stringify(preset.input)) as AwesomePhysicsJsonValue
}
