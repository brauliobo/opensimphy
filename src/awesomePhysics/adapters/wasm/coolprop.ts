import { fail, jsonRecord as record, exactKeys, boundedNumber, throwIfAborted, throwIfAnyAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const COOLPROP_ADAPTER_ID = 'awesome-coolprop-wasm'
export const COOLPROP_SOURCE_REVISION = '4db89c1ce8d0b0d98ba7f03594f58a845351cf6a'
export const COOLPROP_IMPLEMENTATION_REVISION = 'coolprop-classic-worker-v1'
export const COOLPROP_OUTPUT_REVISION = 'coolprop-classic-worker-output-v1'
export const COOLPROP_ARTIFACT_INTEGRITY = Object.freeze({
  javascript: Object.freeze({
    path: 'wasm/awesomePhysics/coolprop/coolprop.js',
    sha256: '0ffde908dc61430b78e02f5b60a1eee04d4b80f69af72739235b3ecb16eac7f6',
    byteSize: 171012,
  }),
  wasm: Object.freeze({
    path: 'wasm/awesomePhysics/coolprop/coolprop.wasm',
    sha256: '57742e874984ad5cddb12db534ea3a9c9903e5c5c518a08e18a099827a3a9829',
    byteSize: 9352013,
  }),
})

export const COOLPROP_PROVENANCE = Object.freeze({
  source: 'CoolProp',
  sourceRevision: COOLPROP_SOURCE_REVISION,
  implementationRevision: COOLPROP_IMPLEMENTATION_REVISION,
  execution: 'verified-local-classic-worker',
  license: 'MIT',
  validatesTheory: false,
  doesNotEstablish: 'A property-library evaluation is not a validation of a physical theory, model, or experimental result.',
  artifact: COOLPROP_ARTIFACT_INTEGRITY,
})

export const COOLPROP_BOUNDS = Object.freeze({
  inputStringLength: 128,
  maximumAbsoluteValue: 1e12,
  f2kCelsius: Object.freeze({ min: -10_000, max: 1_000_000 }),
  maximumAbstractStateOutputs: 16,
  maximumInputBytes: 64 * 1024,
  maximumOutputBytes: 4 * 1024 * 1024,
})

export const COOLPROP_ABSTRACT_STATE_OUTPUTS = Object.freeze([
  'T',
  'rhomolar',
  'rhomass',
  'p',
  'Q',
  'tau',
  'delta',
  'molar_mass',
  'acentric_factor',
  'gas_constant',
  'Bvirial',
  'Cvirial',
  'compressibility_factor',
  'hmolar',
  'hmass',
  'smolar',
  'smass',
  'umolar',
  'umass',
  'cpmolar',
  'cpmass',
  'cvmolar',
  'cvmass',
  'gibbsmolar',
  'gibbsmass',
  'helmholtzmolar',
  'helmholtzmass',
  'speed_sound',
  'isothermal_compressibility',
  'isobaric_expansion_coefficient',
  'isentropic_expansion_coefficient',
  'viscosity',
  'conductivity',
  'surface_tension',
  'Prandtl',
  'T_critical',
  'p_critical',
  'rhomolar_critical',
  'rhomass_critical',
  'p_triple',
  'Ttriple',
  'Tmin',
  'Tmax',
  'pmax',
  'dipole_moment',
] as const)

export type CoolPropAbstractStateOutputName = typeof COOLPROP_ABSTRACT_STATE_OUTPUTS[number]

export interface CoolPropF2KInputV1 {
  operation: 'F2K'
  celsius: number
}

export interface CoolPropPropsSIInputV1 {
  operation: 'PropsSI'
  output: string
  input1: string
  value1: number
  input2: string
  value2: number
  fluid: string
}

export interface CoolPropAbstractStateInputV1 {
  operation: 'AbstractState'
  backend: string
  fluid: string
  inputPair: string
  value1: number
  value2: number
  outputs: readonly CoolPropAbstractStateOutputName[]
}

export type CoolPropInputV1 = CoolPropF2KInputV1 | CoolPropPropsSIInputV1 | CoolPropAbstractStateInputV1

export interface CoolPropOutputProvenanceV1 {
  source: 'CoolProp'
  sourceRevision: string
  implementationRevision: string
  execution: 'verified-local-classic-worker'
  license: 'MIT'
  validatesTheory: false
  doesNotEstablish: string
  artifact: typeof COOLPROP_ARTIFACT_INTEGRITY
}

export interface CoolPropF2KOutputV1 {
  schemaVersion: 1
  operation: 'F2K'
  input: CoolPropF2KInputV1
  kelvin: number
  units: { celsius: 'degC'; kelvin: 'K' }
  provenance: CoolPropOutputProvenanceV1
}

export interface CoolPropPropsSIOutputV1 {
  schemaVersion: 1
  operation: 'PropsSI'
  input: CoolPropPropsSIInputV1
  value: number
  provenance: CoolPropOutputProvenanceV1
}

export interface CoolPropAbstractStateOutputV1 {
  schemaVersion: 1
  operation: 'AbstractState'
  input: CoolPropAbstractStateInputV1
  backend: string
  values: Record<string, number>
  provenance: CoolPropOutputProvenanceV1
}

export type CoolPropOutputV1 = CoolPropF2KOutputV1 | CoolPropPropsSIOutputV1 | CoolPropAbstractStateOutputV1
export type CoolPropAdapterV1 = AwesomePhysicsAdapterV1<CoolPropInputV1, CoolPropOutputV1>
export type CoolPropAdapterFactoryV1 = AwesomePhysicsAdapterFactoryV1<CoolPropInputV1, CoolPropOutputV1>

const COOLPROP_ABS = COOLPROP_BOUNDS.maximumAbsoluteValue

function boundedString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > COOLPROP_BOUNDS.inputStringLength) {
    fail(path, `must be a non-empty string of at most ${COOLPROP_BOUNDS.inputStringLength} characters`)
  }
  return value
}

function parseF2K(value: Record<string, unknown>): CoolPropF2KInputV1 {
  exactKeys(value, ['operation', 'celsius'], 'CoolProp input')
  return {
    operation: 'F2K',
    celsius: boundedNumber(value.celsius, 'CoolProp input.celsius', COOLPROP_BOUNDS.f2kCelsius.min, COOLPROP_BOUNDS.f2kCelsius.max),
  }
}

function parsePropsSI(value: Record<string, unknown>): CoolPropPropsSIInputV1 {
  exactKeys(value, ['operation', 'output', 'input1', 'value1', 'input2', 'value2', 'fluid'], 'CoolProp input')
  return {
    operation: 'PropsSI',
    output: boundedString(value.output, 'CoolProp input.output'),
    input1: boundedString(value.input1, 'CoolProp input.input1'),
    value1: boundedNumber(value.value1, 'CoolProp input.value1', -COOLPROP_ABS, COOLPROP_ABS),
    input2: boundedString(value.input2, 'CoolProp input.input2'),
    value2: boundedNumber(value.value2, 'CoolProp input.value2', -COOLPROP_ABS, COOLPROP_ABS),
    fluid: boundedString(value.fluid, 'CoolProp input.fluid'),
  }
}

function parseAbstractState(value: Record<string, unknown>): CoolPropAbstractStateInputV1 {
  exactKeys(value, ['operation', 'backend', 'fluid', 'inputPair', 'value1', 'value2', 'outputs'], 'CoolProp input')
  if (!Array.isArray(value.outputs) || value.outputs.length < 1 || value.outputs.length > COOLPROP_BOUNDS.maximumAbstractStateOutputs) {
    fail('CoolProp input.outputs', `must contain between 1 and ${COOLPROP_BOUNDS.maximumAbstractStateOutputs} entries`)
  }
  const outputs = value.outputs.map((output, index) => {
    const name = boundedString(output, `CoolProp input.outputs[${index}]`)
    if (!(COOLPROP_ABSTRACT_STATE_OUTPUTS as readonly string[]).includes(name)) {
      fail(`CoolProp input.outputs[${index}]`, 'is not a supported AbstractState output')
    }
    return name as CoolPropAbstractStateOutputName
  })
  if (new Set(outputs).size !== outputs.length) fail('CoolProp input.outputs', 'must contain unique output names')
  return {
    operation: 'AbstractState',
    backend: boundedString(value.backend, 'CoolProp input.backend'),
    fluid: boundedString(value.fluid, 'CoolProp input.fluid'),
    inputPair: boundedString(value.inputPair, 'CoolProp input.inputPair'),
    value1: boundedNumber(value.value1, 'CoolProp input.value1', -COOLPROP_ABS, COOLPROP_ABS),
    value2: boundedNumber(value.value2, 'CoolProp input.value2', -COOLPROP_ABS, COOLPROP_ABS),
    outputs,
  }
}

export function parseCoolPropInput(value: unknown): CoolPropInputV1 {
  const input = record(value, 'CoolProp input')
  if (input.operation === 'F2K') return parseF2K(input)
  if (input.operation === 'PropsSI') return parsePropsSI(input)
  if (input.operation === 'AbstractState') return parseAbstractState(input)
  fail('CoolProp input.operation', 'must be F2K, PropsSI, or AbstractState')
}
function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal, 'The CoolProp operation was aborted')
  if (descriptor.catalogItemId !== 'awesome-coolprop' || descriptor.title !== 'CoolProp') {
    throw new TypeError('CoolProp adapter requires the CoolProp simulation descriptor')
  }
  if (descriptor.execution !== 'wasm') throw new TypeError('CoolProp adapter requires WASM execution')
  const adapterId = descriptor.adapterId ?? COOLPROP_ADAPTER_ID
  if (adapterId !== COOLPROP_ADAPTER_ID) throw new TypeError('CoolProp descriptor adapterId is incompatible')
  return {
    adapterId,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createCoolPropAdapter: CoolPropAdapterFactoryV1 = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      throwIfAborted(signal, 'The CoolProp operation was aborted')
      throwIfAborted(runSignal, 'The CoolProp operation was aborted')
      parseCoolPropInput(input)
      throw new Error('CoolProp must be dispatched through the dedicated classic-worker runner')
    },
  }
}

export const coolpropAdapterFactory = createCoolPropAdapter
