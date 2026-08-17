import type {
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../types/awesomePhysics'

export type LazyAwesomePhysicsAdapterFactoryV1 = AwesomePhysicsAdapterFactoryV1

export const AWESOME_PHYSICS_ADAPTER_IDS = Object.freeze({
  matterJs: 'matter-js-browser',
  cannonJs: 'cannon-js-browser',
  myphysicslab: 'awesome-myphysicslab-browser-v1',
  webglRipples: 'awesome-webgl-ripples-browser-v1',
  particleClicker: 'awesome-particle-clicker-browser-v1',
  qmsolve: 'awesome-qmsolve-typescript',
  empy: 'awesome-empy-typescript',
  pyRt: 'awesome-pyrt-typescript',
  scikitRf: 'awesome-scikit-rf-typescript',
  fluids: 'awesome-fluids-typescript',
  gala: 'awesome-gala-typescript',
  tightBinding: 'awesome-shut-up-and-calculate-typescript',
  poppy: 'awesome-poppy-typescript',
  coolprop: 'awesome-coolprop-wasm',
  nphysics2d: 'awesome-nphysics2d-wasm',
  positionBasedDynamics: 'awesome-positionbaseddynamics-wasm',
  bullet3: 'awesome-bullet3-wasm',
})

type AdapterFactoryModuleLoader = (
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
) => ReturnType<LazyAwesomePhysicsAdapterFactoryV1>

// Keep each import literal so Vite emits one lazy chunk per adapter module.
export const awesomePhysicsAdapterFactoryMap: ReadonlyMap<string, AdapterFactoryModuleLoader> = new Map([
  [AWESOME_PHYSICS_ADAPTER_IDS.matterJs, async (descriptor, signal) => {
    const module = await import('./adapters/browser/matterJs')
    return module.createMatterJsAdapterFactory(descriptor, signal)
  }],
  [AWESOME_PHYSICS_ADAPTER_IDS.cannonJs, async (descriptor, signal) => {
    const module = await import('./adapters/browser/cannonJs')
    return module.createCannonJsAdapterFactory(descriptor, signal)
  }],
  [AWESOME_PHYSICS_ADAPTER_IDS.myphysicslab, async (descriptor, signal) => {
    const module = await import('./adapters/browser/myphysicslab')
    return module.createMyphysicslabAdapterFactory(descriptor, signal)
  }],
  [AWESOME_PHYSICS_ADAPTER_IDS.webglRipples, async (descriptor, signal) => {
    const module = await import('./adapters/browser/webglRipples')
    return module.createWebglRipplesAdapterFactory(descriptor, signal)
  }],
  [AWESOME_PHYSICS_ADAPTER_IDS.particleClicker, async (descriptor, signal) => {
    const module = await import('./adapters/browser/particleClicker')
    return module.createParticleClickerAdapterFactory(descriptor, signal)
  }],
  [AWESOME_PHYSICS_ADAPTER_IDS.qmsolve, async (descriptor, signal) => {
    const module = await import('./adapters/typescript/qmsolve')
    return module.qmsolveAdapterFactory(descriptor, signal)
  }],
  [AWESOME_PHYSICS_ADAPTER_IDS.empy, async (descriptor, signal) => {
    const module = await import('./adapters/typescript/empy')
    return module.empyAdapterFactory(descriptor, signal)
  }],
  [AWESOME_PHYSICS_ADAPTER_IDS.pyRt, async (descriptor, signal) => {
    const module = await import('./adapters/typescript/pyRt')
    return module.pyRtAdapterFactory(descriptor, signal)
  }],
  [AWESOME_PHYSICS_ADAPTER_IDS.scikitRf, async (descriptor, signal) => {
    const module = await import('./adapters/typescript/scikitRf')
    return module.scikitRfAdapterFactory(descriptor, signal)
  }],
  [AWESOME_PHYSICS_ADAPTER_IDS.fluids, async (descriptor, signal) => {
    const module = await import('./adapters/typescript/fluids')
    return module.fluidsAdapterFactory(descriptor, signal)
  }],
  [AWESOME_PHYSICS_ADAPTER_IDS.gala, async (descriptor, signal) => {
    const module = await import('./adapters/typescript/gala')
    return module.galaAdapterFactory(descriptor, signal)
  }],
  [AWESOME_PHYSICS_ADAPTER_IDS.tightBinding, async (descriptor, signal) => {
    const module = await import('./adapters/typescript/tightBinding')
    return module.tightBindingAdapterFactory(descriptor, signal)
  }],
  [AWESOME_PHYSICS_ADAPTER_IDS.poppy, async (descriptor, signal) => {
    const module = await import('./adapters/typescript/poppy')
    return module.poppyAdapterFactory(descriptor, signal)
  }],
  [AWESOME_PHYSICS_ADAPTER_IDS.coolprop, async (descriptor, signal) => {
    const module = await import('./adapters/wasm/coolprop')
    return module.createCoolPropAdapter(descriptor, signal)
  }],
  [AWESOME_PHYSICS_ADAPTER_IDS.nphysics2d, async (descriptor, signal) => {
    const module = await import('./adapters/wasm/nphysics2d')
    return module.createNphysics2dAdapterFactory(descriptor, signal)
  }],
  [AWESOME_PHYSICS_ADAPTER_IDS.positionBasedDynamics, async (descriptor, signal) => {
    const module = await import('./adapters/wasm/positionBasedDynamics')
    return module.positionBasedDynamicsAdapterFactory(descriptor, signal)
  }],
  [AWESOME_PHYSICS_ADAPTER_IDS.bullet3, async (descriptor, signal) => {
    const module = await import('./adapters/wasm/bullet3')
    return module.createBullet3AdapterFactory(descriptor, signal)
  }],
])

export const awesomePhysicsAdapterFactories = awesomePhysicsAdapterFactoryMap
