import { AWESOME_PHYSICS_ADAPTER_IDS } from './adapterFactories'
import type { CannonJsAdapterInputV1 } from './adapters/browser/cannonJs'
import type { MatterJsAdapterInputV1 } from './adapters/browser/matterJs'
import type { MyphysicslabInputV1 } from './adapters/browser/myphysicslab'
import type { ParticleClickerInput } from './adapters/browser/particleClicker'
import type { WebglRipplesInputV1 } from './adapters/browser/webglRipples'
import type { EmpyInputV1 } from './adapters/typescript/empy'
import type { FluidsInputV1 } from './adapters/typescript/fluids'
import type { GalaInputV1 } from './adapters/typescript/gala'
import type { PoppyInputV1 } from './adapters/typescript/poppy'
import type { PyRtInputV1 } from './adapters/typescript/pyRt'
import type { QmsolveInput } from './adapters/typescript/qmsolve'
import type { ScikitRfInputV1 } from './adapters/typescript/scikitRf'
import type { TightBindingInputV1 } from './adapters/typescript/tightBinding'
import type { CoolPropInputV1 } from './adapters/wasm/coolprop'
import type { PositionBasedDynamicsDistanceInputV1 } from './adapters/wasm/positionBasedDynamics'
import type { Bullet3InputV1 } from './adapters/wasm/bullet3'

export type AwesomePhysicsAdapterId = typeof AWESOME_PHYSICS_ADAPTER_IDS[keyof typeof AWESOME_PHYSICS_ADAPTER_IDS]

type AwesomePhysicsDefaultInputByAdapter = {
  [AWESOME_PHYSICS_ADAPTER_IDS.matterJs]: MatterJsAdapterInputV1
  [AWESOME_PHYSICS_ADAPTER_IDS.cannonJs]: CannonJsAdapterInputV1
  [AWESOME_PHYSICS_ADAPTER_IDS.myphysicslab]: MyphysicslabInputV1
  [AWESOME_PHYSICS_ADAPTER_IDS.webglRipples]: WebglRipplesInputV1
  [AWESOME_PHYSICS_ADAPTER_IDS.particleClicker]: ParticleClickerInput
  [AWESOME_PHYSICS_ADAPTER_IDS.qmsolve]: QmsolveInput
  [AWESOME_PHYSICS_ADAPTER_IDS.empy]: EmpyInputV1
  [AWESOME_PHYSICS_ADAPTER_IDS.pyRt]: PyRtInputV1
  [AWESOME_PHYSICS_ADAPTER_IDS.scikitRf]: ScikitRfInputV1
  [AWESOME_PHYSICS_ADAPTER_IDS.fluids]: FluidsInputV1
  [AWESOME_PHYSICS_ADAPTER_IDS.gala]: GalaInputV1
  [AWESOME_PHYSICS_ADAPTER_IDS.tightBinding]: TightBindingInputV1
  [AWESOME_PHYSICS_ADAPTER_IDS.poppy]: PoppyInputV1
  [AWESOME_PHYSICS_ADAPTER_IDS.coolprop]: CoolPropInputV1
  [AWESOME_PHYSICS_ADAPTER_IDS.positionBasedDynamics]: PositionBasedDynamicsDistanceInputV1
  [AWESOME_PHYSICS_ADAPTER_IDS.bullet3]: Bullet3InputV1
}

export type AwesomePhysicsDefaultInput = AwesomePhysicsDefaultInputByAdapter[AwesomePhysicsAdapterId]

export const AWESOME_PHYSICS_DEFAULT_INPUTS = {
  [AWESOME_PHYSICS_ADAPTER_IDS.matterJs]: {
    bodies: [
      {
        id: 'body-a',
        position: { x: 80, y: 24 },
        velocity: { x: 12, y: 0 },
        radius: 8,
        mass: 1,
      },
    ],
    bounds: { width: 160, height: 100 },
    gravity: { x: 0, y: 9.81 },
    steps: 120,
    dt: 0.016,
    sampleEvery: 20,
    restitution: 0.8,
  },
  [AWESOME_PHYSICS_ADAPTER_IDS.cannonJs]: {
    bodies: [
      {
        id: 'body-a',
        position: { x: 0, y: 3, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        radius: 0.5,
        mass: 1,
      },
    ],
    gravity: { x: 0, y: -9.81, z: 0 },
    floorY: 0,
    steps: 120,
    dt: 0.016,
    sampleEvery: 20,
    restitution: 0.8,
  },
  [AWESOME_PHYSICS_ADAPTER_IDS.myphysicslab]: {
    steps: 240,
    sampleEvery: 20,
    timeStep: 0.01,
    mass: 1,
    stiffness: 4,
    damping: 0.05,
    restLength: 1,
    initialPosition: 1.25,
    initialVelocity: 0,
  },
  [AWESOME_PHYSICS_ADAPTER_IDS.webglRipples]: {
    gridSize: 33,
    steps: 64,
    taps: [{ x: 0.5, y: 0.5, amplitude: 1, radius: 3, step: 0 }],
    sampleEvery: 16,
    damping: 0.98,
    waveSpeed: 0.4,
  },
  [AWESOME_PHYSICS_ADAPTER_IDS.particleClicker]: {
    initial: {
      particles: 0,
      funding: 0,
      reputation: 1,
      clicks: 0,
      elapsedSeconds: 0,
    },
    actions: [
      { type: 'click', count: 5 },
      { type: 'advance', seconds: 1 },
    ],
  },
  [AWESOME_PHYSICS_ADAPTER_IDS.qmsolve]: {
    potential: 'harmonic-oscillator',
    initialState: 'gaussian-wave-packet',
    gridSize: 65,
    domainHalfWidth: 8,
    timeStep: 0.002,
    steps: 240,
    oscillatorFrequency: 1,
    packetCenter: 0,
    packetWidth: 1,
    packetMomentum: 0,
    sampleCount: 13,
  },
  [AWESOME_PHYSICS_ADAPTER_IDS.empy]: {
    wavelength: 550e-9,
    layers: [
      { refractiveIndex: 1, thickness: null },
      { refractiveIndex: 1.5, thickness: 100e-9 },
      { refractiveIndex: 1.45, thickness: null },
    ],
  },
  [AWESOME_PHYSICS_ADAPTER_IDS.pyRt]: {
    ray: { origin: [-2, 0, 0], direction: [1, 0, 0] },
    sphere: { center: [0, 0, 0], radius: 1 },
    tMin: 0,
    tMax: 10,
  },
  [AWESOME_PHYSICS_ADAPTER_IDS.scikitRf]: {
    impedance: { re: 75, im: 5 },
    referenceImpedance: { re: 50, im: 0 },
    waveDefinition: 'power',
  },
  [AWESOME_PHYSICS_ADAPTER_IDS.fluids]: {
    operation: 'ideal-gas-sound-speed',
    temperatureK: 300,
    isentropicExponent: 1.4,
    molarMassGPerMol: 28.97,
  },
  [AWESOME_PHYSICS_ADAPTER_IDS.gala]: {
    bodies: [
      { mass: 1, position: [-1, 0, 0], velocity: [0, -0.25, 0] },
      { mass: 1, position: [1, 0, 0], velocity: [0, 0.25, 0] },
    ],
    timeStep: 0.01,
    steps: 100,
    sampleEvery: 20,
  },
  [AWESOME_PHYSICS_ADAPTER_IDS.tightBinding]: {
    onsiteEnergyEv: 0,
    hoppingEnergyEv: -1,
    latticeSpacingM: 5e-10,
    chemicalPotentialEv: 0,
    temperatureK: 300,
    kPointCount: 33,
    spinDegeneracy: 2,
  },
  [AWESOME_PHYSICS_ADAPTER_IDS.poppy]: {
    wavelength: 550e-9,
    propagationDistance: 1,
    aperture: { shape: 'circular', radius: 1e-3 },
    positions: [-1e-3, -5e-4, 0, 5e-4, 1e-3],
  },
  [AWESOME_PHYSICS_ADAPTER_IDS.coolprop]: {
    operation: 'F2K',
    celsius: 0,
  },
  [AWESOME_PHYSICS_ADAPTER_IDS.positionBasedDynamics]: {
    operation: 'solve-distance',
    x0: 0,
    x1: 2,
    restLength: 1,
    inverseMass0: 1,
    inverseMass1: 1,
    stiffness: 1,
  },
  [AWESOME_PHYSICS_ADAPTER_IDS.bullet3]: {
    operation: 'step',
  },
} as const satisfies AwesomePhysicsDefaultInputByAdapter

export function awesomePhysicsDefaultInput(adapterId: string): AwesomePhysicsDefaultInput | null {
  if (!Object.hasOwn(AWESOME_PHYSICS_DEFAULT_INPUTS, adapterId)) return null
  return (AWESOME_PHYSICS_DEFAULT_INPUTS as Record<string, AwesomePhysicsDefaultInput>)[adapterId] ?? null
}
