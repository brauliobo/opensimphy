import { fail, jsonRecord as record, exactKeys, finiteNumber, boundedNumber, requireSafeIntegerBetween, throwIfAborted, throwIfAnyAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

/**
 * Independent educational kernel inspired by the local shut-up-and-calculate
 * band examples. It does not import or redistribute the upstream Python,
 * NumPy, SciPy, Numba, or Matplotlib implementation.
 */

export const TIGHT_BINDING_CATALOG_ITEM_ID = 'awesome-shut-up-and-calculate' as const
export const TIGHT_BINDING_ADAPTER_ID = 'awesome-shut-up-and-calculate-typescript' as const
export const TIGHT_BINDING_KERNEL_REVISION = 'tight-binding-1d-occupancy-typescript-v1' as const
export const TIGHT_BINDING_SOURCE_REVISION = '0896fe8ef4f4' as const
export const TIGHT_BINDING_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/Sinan81/shut-up-and-calculate',
  license: 'The upstream shut-up-and-calculate project is MIT-licensed; this independent kernel does not redistribute its source or dependencies.',
  data: 'No NumPy, SciPy, Numba, Matplotlib runtime, crystal data, or external dataset is bundled.',
})

export const TIGHT_BINDING_BOUNDS = Object.freeze({
  onsiteEnergyEv: Object.freeze({ min: -100, max: 100 }),
  hoppingEnergyEv: Object.freeze({ min: -50, max: 50 }),
  latticeSpacingM: Object.freeze({ min: 1e-12, max: 1e-6 }),
  chemicalPotentialEv: Object.freeze({ min: -200, max: 200 }),
  temperatureK: Object.freeze({ min: 0, max: 1e5 }),
  kPointCount: Object.freeze({ min: 3, max: 256 }),
  maxOutputAbs: 1e13,
} as const)

const BOLTZMANN_EV_PER_K = 8.617333262145e-5
const MAX_EXPONENT = 50

export interface TightBindingInputV1 {
  readonly onsiteEnergyEv: number
  readonly hoppingEnergyEv: number
  readonly latticeSpacingM: number
  readonly chemicalPotentialEv: number
  readonly temperatureK: number
  readonly kPointCount: number
  readonly spinDegeneracy?: 1 | 2
}

export interface TightBindingResolvedInputV1 {
  readonly onsiteEnergyEv: number
  readonly hoppingEnergyEv: number
  readonly latticeSpacingM: number
  readonly chemicalPotentialEv: number
  readonly temperatureK: number
  readonly kPointCount: number
  readonly spinDegeneracy: 1 | 2
}

export interface TightBindingBandSampleV1 {
  readonly index: number
  readonly reducedWaveVector: number
  readonly waveVectorRadPerM: number
  readonly energyEv: number
  readonly occupancy: number
}

export interface TightBindingOutputV1 {
  readonly schemaVersion: 1
  readonly model: 'tight-binding-1d-cosine-v1'
  readonly parameters: TightBindingResolvedInputV1
  readonly units: {
    readonly energy: 'eV'
    readonly reducedWaveVector: 'rad'
    readonly waveVector: 'rad/m'
    readonly latticeSpacing: 'm'
    readonly temperature: 'K'
    readonly occupancy: '1'
    readonly filling: 'electrons/cell'
  }
  readonly band: readonly TightBindingBandSampleV1[]
  readonly bandMinimumEv: number
  readonly bandMaximumEv: number
  readonly occupancyMinimum: number
  readonly occupancyMaximum: number
  readonly fillingElectronsPerCell: number
  readonly assumptions: readonly string[]
  readonly numericalMethod: string
  readonly licenseCaveat: string
}

export type TightBindingInput = TightBindingInputV1
export type TightBindingOutput = TightBindingOutputV1
export type TightBindingAdapter = AwesomePhysicsAdapterV1<TightBindingInputV1, TightBindingOutputV1>
export type TightBindingAdapterFactory = AwesomePhysicsAdapterFactoryV1<TightBindingInputV1, TightBindingOutputV1>

function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > TIGHT_BINDING_BOUNDS.maxOutputAbs) {
    throw new RangeError(`${path} is outside the finite output bound`)
  }
  return value === 0 ? 0 : value
}
export function calculateTightBindingBandEnergyEv(
  waveVectorRadPerM: number,
  latticeSpacingM: number,
  onsiteEnergyEv: number,
  hoppingEnergyEv: number,
): number {
  const latticeSpacing = boundedNumber(
    latticeSpacingM,
    'latticeSpacingM',
    TIGHT_BINDING_BOUNDS.latticeSpacingM.min,
    TIGHT_BINDING_BOUNDS.latticeSpacingM.max,
  )
  const waveVector = boundedNumber(waveVectorRadPerM, 'waveVectorRadPerM', -Math.PI / latticeSpacing, Math.PI / latticeSpacing)
  const onsite = boundedNumber(
    onsiteEnergyEv,
    'onsiteEnergyEv',
    TIGHT_BINDING_BOUNDS.onsiteEnergyEv.min,
    TIGHT_BINDING_BOUNDS.onsiteEnergyEv.max,
  )
  const hopping = boundedNumber(
    hoppingEnergyEv,
    'hoppingEnergyEv',
    TIGHT_BINDING_BOUNDS.hoppingEnergyEv.min,
    TIGHT_BINDING_BOUNDS.hoppingEnergyEv.max,
  )
  return finiteOutput(onsite - 2 * hopping * Math.cos(waveVector * latticeSpacing), 'band energy')
}

export function calculateTightBindingOccupancy(
  energyEv: number,
  chemicalPotentialEv: number,
  temperatureK: number,
): number {
  const energy = boundedNumber(energyEv, 'energyEv', -TIGHT_BINDING_BOUNDS.maxOutputAbs, TIGHT_BINDING_BOUNDS.maxOutputAbs)
  const chemicalPotential = boundedNumber(
    chemicalPotentialEv,
    'chemicalPotentialEv',
    TIGHT_BINDING_BOUNDS.chemicalPotentialEv.min,
    TIGHT_BINDING_BOUNDS.chemicalPotentialEv.max,
  )
  const temperature = boundedNumber(
    temperatureK,
    'temperatureK',
    TIGHT_BINDING_BOUNDS.temperatureK.min,
    TIGHT_BINDING_BOUNDS.temperatureK.max,
  )
  if (temperature === 0) return energy < chemicalPotential ? 1 : energy > chemicalPotential ? 0 : 0.5

  const exponent = (energy - chemicalPotential) / (BOLTZMANN_EV_PER_K * temperature)
  if (!Number.isFinite(exponent)) throw new RangeError('Fermi-Dirac exponent is outside the finite bound')
  if (exponent >= MAX_EXPONENT) return 0
  if (exponent <= -MAX_EXPONENT) return 1
  return finiteOutput(1 / (1 + Math.exp(exponent)), 'occupancy')
}

function parseInput(input: unknown): TightBindingResolvedInputV1 {
  const object = record(input, 'tight-binding input')
  exactKeys(object, [
    'onsiteEnergyEv',
    'hoppingEnergyEv',
    'latticeSpacingM',
    'chemicalPotentialEv',
    'temperatureK',
    'kPointCount',
  ], ['spinDegeneracy'], 'tight-binding input')

  const spinDegeneracy = !Object.hasOwn(object, 'spinDegeneracy') ? 2 : object.spinDegeneracy
  if (spinDegeneracy !== 1 && spinDegeneracy !== 2) fail('tight-binding input.spinDegeneracy', 'must be 1 or 2')
  return {
    onsiteEnergyEv: boundedNumber(object.onsiteEnergyEv, 'tight-binding input.onsiteEnergyEv', TIGHT_BINDING_BOUNDS.onsiteEnergyEv.min, TIGHT_BINDING_BOUNDS.onsiteEnergyEv.max),
    hoppingEnergyEv: boundedNumber(object.hoppingEnergyEv, 'tight-binding input.hoppingEnergyEv', TIGHT_BINDING_BOUNDS.hoppingEnergyEv.min, TIGHT_BINDING_BOUNDS.hoppingEnergyEv.max),
    latticeSpacingM: boundedNumber(object.latticeSpacingM, 'tight-binding input.latticeSpacingM', TIGHT_BINDING_BOUNDS.latticeSpacingM.min, TIGHT_BINDING_BOUNDS.latticeSpacingM.max),
    chemicalPotentialEv: boundedNumber(object.chemicalPotentialEv, 'tight-binding input.chemicalPotentialEv', TIGHT_BINDING_BOUNDS.chemicalPotentialEv.min, TIGHT_BINDING_BOUNDS.chemicalPotentialEv.max),
    temperatureK: boundedNumber(object.temperatureK, 'tight-binding input.temperatureK', TIGHT_BINDING_BOUNDS.temperatureK.min, TIGHT_BINDING_BOUNDS.temperatureK.max),
    kPointCount: requireSafeIntegerBetween(object.kPointCount, 'tight-binding input.kPointCount', TIGHT_BINDING_BOUNDS.kPointCount.min, TIGHT_BINDING_BOUNDS.kPointCount.max),
    spinDegeneracy,
  }
}

function solve(input: TightBindingResolvedInputV1, signal?: AbortSignal): TightBindingOutputV1 {
  throwIfAborted(signal, 'The tight-binding operation was aborted')
  const band: TightBindingBandSampleV1[] = []
  let bandMinimumEv = Infinity
  let bandMaximumEv = -Infinity
  let occupancyMinimum = Infinity
  let occupancyMaximum = -Infinity
  let occupancySum = 0

  for (let index = 0; index < input.kPointCount; index += 1) {
    throwIfAborted(signal, 'The tight-binding operation was aborted')
    const reducedWaveVector = -Math.PI + (2 * Math.PI * index) / (input.kPointCount - 1)
    const waveVectorRadPerM = reducedWaveVector / input.latticeSpacingM
    const energyEv = calculateTightBindingBandEnergyEv(
      waveVectorRadPerM,
      input.latticeSpacingM,
      input.onsiteEnergyEv,
      input.hoppingEnergyEv,
    )
    const occupancy = calculateTightBindingOccupancy(energyEv, input.chemicalPotentialEv, input.temperatureK)
    bandMinimumEv = Math.min(bandMinimumEv, energyEv)
    bandMaximumEv = Math.max(bandMaximumEv, energyEv)
    occupancyMinimum = Math.min(occupancyMinimum, occupancy)
    occupancyMaximum = Math.max(occupancyMaximum, occupancy)
    const endpointWeight = index === 0 || index === input.kPointCount - 1 ? 0.5 : 1
    occupancySum += endpointWeight * occupancy
    band.push({
      index,
      reducedWaveVector: finiteOutput(reducedWaveVector, `band[${index}].reducedWaveVector`),
      waveVectorRadPerM: finiteOutput(waveVectorRadPerM, `band[${index}].waveVectorRadPerM`),
      energyEv,
      occupancy,
    })
  }

  const fillingElectronsPerCell = finiteOutput(
    input.spinDegeneracy * occupancySum / (input.kPointCount - 1),
    'fillingElectronsPerCell',
  )
  const output: TightBindingOutputV1 = {
    schemaVersion: 1,
    model: 'tight-binding-1d-cosine-v1',
    parameters: { ...input },
    units: {
      energy: 'eV',
      reducedWaveVector: 'rad',
      waveVector: 'rad/m',
      latticeSpacing: 'm',
      temperature: 'K',
      occupancy: '1',
      filling: 'electrons/cell',
    },
    band,
    bandMinimumEv: finiteOutput(bandMinimumEv, 'bandMinimumEv'),
    bandMaximumEv: finiteOutput(bandMaximumEv, 'bandMaximumEv'),
    occupancyMinimum: finiteOutput(occupancyMinimum, 'occupancyMinimum'),
    occupancyMaximum: finiteOutput(occupancyMaximum, 'occupancyMaximum'),
    fillingElectronsPerCell,
    assumptions: [
      'The model has one orbital per site and only a nearest-neighbour hopping term in one spatial dimension.',
      'The dispersion is E(k) = onsiteEnergy - 2 hoppingEnergy cos(k a), with k sampled over the first Brillouin zone [-pi/a, pi/a].',
      'Energies and chemical potential are supplied in electronvolts, lattice spacing in metres, and temperature in kelvin.',
      'Occupancy is the spin-independent Fermi-Dirac probability; filling multiplies its Brillouin-zone average by the supplied spin degeneracy.',
      'The endpoint grid is a deterministic sample for visualization and quadrature, not a thermodynamic-limit proof.',
    ],
    numericalMethod: 'Direct cosine band evaluation and numerically stable Fermi-Dirac occupancy at a bounded uniform k grid.',
    licenseCaveat: TIGHT_BINDING_SOURCE_CAVEATS.license,
  }
  const serialized = JSON.stringify(output)
  if (serialized === undefined) throw new Error('Tight-binding output could not be serialized as JSON')
  throwIfAborted(signal, 'The tight-binding operation was aborted')
  return output
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal, 'The tight-binding operation was aborted')
  if (descriptor.catalogItemId !== TIGHT_BINDING_CATALOG_ITEM_ID || descriptor.title !== 'Shut up and calculate') {
    throw new TypeError('tight-binding adapter requires the shut-up-and-calculate simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('tight-binding adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.trim().length === 0)) {
    throw new TypeError('tight-binding descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined
    && (typeof descriptor.adapterId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('tight-binding descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? TIGHT_BINDING_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createTightBindingAdapter: TightBindingAdapterFactory = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      throwIfAborted(signal, 'The tight-binding operation was aborted')
      throwIfAborted(runSignal, 'The tight-binding operation was aborted')
      const output = solve(parseInput(input), runSignal ?? signal)
      throwIfAborted(runSignal, 'The tight-binding operation was aborted')
      return output
    },
  }
}

export const tightBindingAdapterFactory = createTightBindingAdapter
export const createShutUpAndCalculateAdapter = createTightBindingAdapter
