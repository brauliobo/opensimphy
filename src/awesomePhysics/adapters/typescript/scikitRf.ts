import { fail, record, exactKeys, finiteNumber, boundedNumber, throwIfAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const SCIKIT_RF_ADAPTER_ID = 'awesome-scikit-rf-typescript'
export const SCIKIT_RF_KERNEL_REVISION = 'scikit-rf-complex-conversion-typescript-v1'
export const SCIKIT_RF_SOURCE_REVISION = '34652721a23b'
export const SCIKIT_RF_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/scikit-rf/scikit-rf',
  license: 'scikit-rf is BSD-3-Clause licensed; descriptor license integration remains a separate review step.',
  data: 'No scikit-rf Python runtime, Touchstone files, or external RF data is bundled.',
})

const MAX_COMPONENT = 1e9
const MAX_MAGNITUDE = 1e9

export interface ScikitRfComplexV1 {
  re: number
  im: number
}

export type ScikitRfComplexInputV1 = number | ScikitRfComplexV1

export interface ScikitRfImpedanceInputV1 {
  impedance: ScikitRfComplexInputV1
  referenceImpedance: ScikitRfComplexInputV1
  waveDefinition?: 'power' | 'traveling'
}

export interface ScikitRfZInputV1 {
  z: ScikitRfComplexInputV1
  z0: ScikitRfComplexInputV1
  waveDefinition?: 'power' | 'traveling'
}

export type ScikitRfInputV1 = ScikitRfImpedanceInputV1 | ScikitRfZInputV1

export interface ScikitRfOutputV1 {
  impedance: ScikitRfComplexV1
  referenceImpedance: ScikitRfComplexV1
  reflection: ScikitRfComplexV1
  transmission: ScikitRfComplexV1
  reflectionMagnitude: number
  transmissionMagnitude: number
  waveDefinition: 'power' | 'traveling'
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
}

export type ScikitRfComplex = ScikitRfComplexV1
export type ScikitRfInput = ScikitRfInputV1
export type ScikitRfOutput = ScikitRfOutputV1
export type ScikitRfAdapterInputV1 = ScikitRfInputV1
export type ScikitRfAdapterOutputV1 = ScikitRfOutputV1
export type ScikitRfAdapter = AwesomePhysicsAdapterV1<ScikitRfInputV1, ScikitRfOutputV1>
export type ScikitRfAdapterFactory = AwesomePhysicsAdapterFactoryV1<ScikitRfInputV1, ScikitRfOutputV1>

interface Complex extends ScikitRfComplexV1 {}

function complex(value: unknown, path: string, realMinimum: number, realMaximum: number): Complex {
  if (typeof value === 'number') return { re: boundedNumber(value, path, realMinimum, realMaximum), im: 0 }
  const object = record(value, path)
  exactKeys(object, ['re', 'im'], [], path)
  return {
    re: boundedNumber(object.re, `${path}.re`, realMinimum, realMaximum),
    im: boundedNumber(object.im, `${path}.im`, -MAX_COMPONENT, MAX_COMPONENT),
  }
}

function subtract(left: Complex, right: Complex): Complex {
  return { re: left.re - right.re, im: left.im - right.im }
}

function add(left: Complex, right: Complex): Complex {
  return { re: left.re + right.re, im: left.im + right.im }
}

function conjugate(value: Complex): Complex {
  return { re: value.re, im: -value.im }
}

function divide(left: Complex, right: Complex): Complex {
  const denominator = right.re * right.re + right.im * right.im
  if (!Number.isFinite(denominator) || denominator <= Number.EPSILON) throw new RangeError('scikit-rf impedance conversion has a zero denominator')
  return {
    re: (left.re * right.re + left.im * right.im) / denominator,
    im: (left.im * right.re - left.re * right.im) / denominator,
  }
}

function magnitude(value: Complex): number {
  const result = Math.hypot(value.re, value.im)
  if (!Number.isFinite(result) || result > MAX_MAGNITUDE) throw new RangeError('scikit-rf output magnitude is outside the finite bound')
  return result
}

function parseInput(input: unknown): {
  impedance: Complex
  referenceImpedance: Complex
  waveDefinition: 'power' | 'traveling'
} {
  const object = record(input, 'scikit-rf input')
  const impedanceKey = Object.hasOwn(object, 'impedance')
  const zKey = Object.hasOwn(object, 'z')
  if (impedanceKey === zKey) fail('scikit-rf input', 'must use exactly one of impedance/referenceImpedance or z/z0')

  let impedanceValue: unknown
  let referenceValue: unknown
  if (impedanceKey) {
    exactKeys(object, ['impedance', 'referenceImpedance'], ['waveDefinition'], 'scikit-rf input')
    impedanceValue = object.impedance
    referenceValue = object.referenceImpedance
  } else {
    exactKeys(object, ['z', 'z0'], ['waveDefinition'], 'scikit-rf input')
    impedanceValue = object.z
    referenceValue = object.z0
  }
  const impedance = complex(impedanceValue, 'scikit-rf input impedance', -MAX_COMPONENT, MAX_COMPONENT)
  const referenceImpedance = complex(referenceValue, 'scikit-rf input referenceImpedance', Number.EPSILON, MAX_COMPONENT)
  const waveDefinition = !Object.hasOwn(object, 'waveDefinition')
    ? 'power'
    : object.waveDefinition === 'power' || object.waveDefinition === 'traveling'
      ? object.waveDefinition
      : fail('scikit-rf input.waveDefinition', 'must be power or traveling')
  if (Math.hypot(impedance.re, impedance.im) > MAX_MAGNITUDE) fail('scikit-rf input.impedance', 'magnitude is outside the finite bound')
  if (Math.hypot(referenceImpedance.re, referenceImpedance.im) > MAX_MAGNITUDE) {
    fail('scikit-rf input.referenceImpedance', 'magnitude is outside the finite bound')
  }
  return { impedance, referenceImpedance, waveDefinition }
}

function solve(input: ReturnType<typeof parseInput>, signal?: AbortSignal): ScikitRfOutputV1 {
  throwIfAborted(signal)
  const denominator = add(input.impedance, input.referenceImpedance)
  const numerator = input.waveDefinition === 'power'
    ? subtract(input.impedance, conjugate(input.referenceImpedance))
    : subtract(input.impedance, input.referenceImpedance)
  const reflection = divide(numerator, denominator)
  const transmission = add({ re: 1, im: 0 }, reflection)
  const reflectionMagnitude = magnitude(reflection)
  const transmissionMagnitude = magnitude(transmission)
  return {
    impedance: { ...input.impedance },
    referenceImpedance: { ...input.referenceImpedance },
    reflection,
    transmission,
    reflectionMagnitude,
    transmissionMagnitude,
    waveDefinition: input.waveDefinition,
    assumptions: [
      'The scalar conversion represents a one-port load referenced to one complex characteristic impedance.',
      'Transmission is the voltage-wave coefficient 1 + reflection; no two-port S21 is inferred.',
      'The default power-wave definition follows scikit-rf for a possibly complex reference impedance; traveling waves use Z0 rather than its conjugate.',
    ],
    numericalMethod: 'Direct complex scalar z-to-s reflection conversion with transmission equal to 1 + S11.',
    licenseCaveat: SCIKIT_RF_SOURCE_CAVEATS.license,
  }
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-scikit-rf' || descriptor.title !== 'scikit-rf') {
    throw new TypeError('scikit-rf adapter requires the scikit-rf simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('scikit-rf adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.length === 0)) {
    throw new TypeError('scikit-rf descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string'
    || descriptor.adapterId.trim().length === 0 || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('scikit-rf descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? SCIKIT_RF_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createScikitRfAdapter: ScikitRfAdapterFactory = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      throwIfAborted(signal)
      throwIfAborted(runSignal)
      const output = solve(parseInput(input), runSignal ?? signal)
      throwIfAborted(runSignal)
      return output
    },
  }
}

export const scikitRfAdapterFactory = createScikitRfAdapter
export const createScikitRFAdapter = createScikitRfAdapter
