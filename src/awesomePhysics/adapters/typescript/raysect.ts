import { fail, jsonRecord as record, finiteNumber, boundedNumber, exactKeys, throwIfAborted, throwIfAnyAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const RAYSECT_CATALOG_ITEM_ID = 'awesome-raysect' as const
export const RAYSECT_ADAPTER_ID = 'awesome-raysect-typescript' as const
export const RAYSECT_KERNEL_REVISION = 'raysect-prism-snell-cauchy-typescript-v1' as const
export const RAYSECT_SOURCE_REVISION = '5ed9a21b5f6e' as const
export const RAYSECT_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/raysect/source',
  license: 'raysect is BSD-3-Clause; this independent kernel does not redistribute the raysect engine or multiprocessing runtime.',
  data: 'No raysect Python/Cython runtime, scene graph, or spectral mesh is bundled.',
})

export const RAYSECT_BOUNDS = Object.freeze({
  apexAngleDeg: Object.freeze({ min: 1, max: 90 }),
  incidenceAngleDeg: Object.freeze({ min: 0, max: 89 }),
  wavelengthNm: Object.freeze({ min: 380, max: 780 }),
  cauchyA: Object.freeze({ min: 1.0001, max: 2.5 }),
  cauchyB: Object.freeze({ min: 0, max: 0.05 }),
  maxOutputAbs: 1e6,
} as const)

export interface RaysectPrismInputV1 {
  operation: 'prism-trace'
  apexAngleDeg: number
  incidenceAngleDeg: number
  wavelengthNm: number
  cauchyA: number
  cauchyB: number
}

export type RaysectInputV1 = RaysectPrismInputV1

export interface RaysectPointV1 {
  x: number
  y: number
}

export interface RaysectPrismOutputV1 {
  schemaVersion: 1
  operation: 'prism-trace'
  input: RaysectPrismInputV1
  refractiveIndex: number
  refractionAngleDeg: number
  exitAngleDeg: number
  deviationDeg: number
  transmitted: true
  polyline: readonly RaysectPointV1[]
  incoming: RaysectPointV1
  outgoing: RaysectPointV1
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
  validatesTheory: false
  doesNotEstablish: string
}

export type RaysectOutputV1 = RaysectPrismOutputV1
export type RaysectAdapter = AwesomePhysicsAdapterV1<RaysectInputV1, RaysectOutputV1>
export type RaysectAdapterFactory = AwesomePhysicsAdapterFactoryV1<RaysectInputV1, RaysectOutputV1>
function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > RAYSECT_BOUNDS.maxOutputAbs) {
    throw new RangeError(`${path} is outside the finite output bound`)
  }
  return value === 0 ? 0 : value
}
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

function toDegrees(radians: number): number {
  return radians * (180 / Math.PI)
}

function rotate(x: number, y: number, angle: number): RaysectPointV1 {
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return { x: x * cosine - y * sine, y: x * sine + y * cosine }
}

function intersectRayLine(
  origin: RaysectPointV1,
  direction: RaysectPointV1,
  lineDirection: RaysectPointV1,
): RaysectPointV1 {
  const originCross = origin.x * direction.y - origin.y * direction.x
  const lineCross = lineDirection.x * direction.y - lineDirection.y * direction.x
  if (Math.abs(lineCross) < 1e-15) fail('raysect prism', 'interior ray is parallel to the exit face')
  const scale = originCross / lineCross
  if (scale <= 1e-12) fail('raysect prism', 'interior ray does not hit the exit face')
  return {
    x: finiteOutput(lineDirection.x * scale, 'exit.x'),
    y: finiteOutput(lineDirection.y * scale, 'exit.y'),
  }
}

export function parseRaysectInput(value: unknown): RaysectInputV1 {
  const input = record(value, 'raysect input')
  if (input.operation !== 'prism-trace') fail('raysect input.operation', 'must be prism-trace')
  exactKeys(input, ['operation', 'apexAngleDeg', 'incidenceAngleDeg', 'wavelengthNm', 'cauchyA', 'cauchyB'], 'raysect input')
  return {
    operation: 'prism-trace',
    apexAngleDeg: boundedNumber(input.apexAngleDeg, 'raysect input.apexAngleDeg', RAYSECT_BOUNDS.apexAngleDeg.min, RAYSECT_BOUNDS.apexAngleDeg.max),
    incidenceAngleDeg: boundedNumber(input.incidenceAngleDeg, 'raysect input.incidenceAngleDeg', RAYSECT_BOUNDS.incidenceAngleDeg.min, RAYSECT_BOUNDS.incidenceAngleDeg.max),
    wavelengthNm: boundedNumber(input.wavelengthNm, 'raysect input.wavelengthNm', RAYSECT_BOUNDS.wavelengthNm.min, RAYSECT_BOUNDS.wavelengthNm.max),
    cauchyA: boundedNumber(input.cauchyA, 'raysect input.cauchyA', RAYSECT_BOUNDS.cauchyA.min, RAYSECT_BOUNDS.cauchyA.max),
    cauchyB: boundedNumber(input.cauchyB, 'raysect input.cauchyB', RAYSECT_BOUNDS.cauchyB.min, RAYSECT_BOUNDS.cauchyB.max),
  }
}

function solvePrism(input: RaysectPrismInputV1, signal?: AbortSignal): RaysectPrismOutputV1 {
  throwIfAborted(signal, 'The raysect operation was aborted')
  const wavelengthUm = input.wavelengthNm / 1000
  const refractiveIndex = finiteOutput(input.cauchyA + input.cauchyB / (wavelengthUm * wavelengthUm), 'refractiveIndex')
  const apex = toRadians(input.apexAngleDeg)
  const incidence = toRadians(input.incidenceAngleDeg)
  const sinR1 = Math.sin(incidence) / refractiveIndex
  if (Math.abs(sinR1) >= 1) fail('raysect input.incidenceAngleDeg', 'exceeds the critical angle at the entrance face')
  const refraction = Math.asin(sinR1)
  const r2 = apex - refraction
  const sinI2 = refractiveIndex * Math.sin(r2)
  if (Math.abs(sinI2) >= 1) fail('raysect prism', 'total internal reflection at the exit face')
  const exit = Math.asin(sinI2)
  const deviation = incidence + exit - apex

  const leftDir = { x: -Math.sin(apex / 2), y: -Math.cos(apex / 2) }
  const rightDir = { x: Math.sin(apex / 2), y: -Math.cos(apex / 2) }
  const inward = { x: Math.cos(apex / 2), y: -Math.sin(apex / 2) }
  const incoming = rotate(inward.x, inward.y, -incidence)
  const interior = rotate(inward.x, inward.y, -refraction)
  const entry = { x: finiteOutput(leftDir.x, 'entry.x'), y: finiteOutput(leftDir.y, 'entry.y') }
  const exitPoint = intersectRayLine(entry, interior, rightDir)
  const outgoing = rotate(incoming.x, incoming.y, -deviation)
  const before = {
    x: finiteOutput(entry.x - incoming.x, 'polyline[0].x'),
    y: finiteOutput(entry.y - incoming.y, 'polyline[0].y'),
  }
  const after = {
    x: finiteOutput(exitPoint.x + outgoing.x, 'polyline[3].x'),
    y: finiteOutput(exitPoint.y + outgoing.y, 'polyline[3].y'),
  }
  return {
    schemaVersion: 1,
    operation: 'prism-trace',
    input,
    refractiveIndex,
    refractionAngleDeg: finiteOutput(toDegrees(refraction), 'refractionAngleDeg'),
    exitAngleDeg: finiteOutput(toDegrees(exit), 'exitAngleDeg'),
    deviationDeg: finiteOutput(toDegrees(deviation), 'deviationDeg'),
    transmitted: true,
    polyline: [before, entry, exitPoint, after],
    incoming: { x: finiteOutput(incoming.x, 'incoming.x'), y: finiteOutput(incoming.y, 'incoming.y') },
    outgoing: { x: finiteOutput(outgoing.x, 'outgoing.x'), y: finiteOutput(outgoing.y, 'outgoing.y') },
    assumptions: [
      'The lesson is a 2D isosceles prism in air with Cauchy dispersion n = A + B/λ_μm².',
      'Refraction uses Snell law; total internal reflection is rejected rather than approximated.',
      'The polyline is constructed from the same angles with unit face length. The raysect engine is not used.',
    ],
    numericalMethod: 'Bounded Snell prism trace with Cauchy refractive index and a four-point 2D polyline.',
    licenseCaveat: RAYSECT_SOURCE_CAVEATS.license,
    validatesTheory: false,
    doesNotEstablish: 'A finite prism trace does not establish experimental optical agreement or scientific validation of raysect.',
  }
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal, 'The raysect operation was aborted')
  if (descriptor.catalogItemId !== RAYSECT_CATALOG_ITEM_ID || descriptor.title !== 'raysect') {
    throw new TypeError('raysect adapter requires the raysect simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('raysect adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.trim().length === 0)) {
    throw new TypeError('raysect descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('raysect descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? RAYSECT_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createRaysectAdapter: RaysectAdapterFactory = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      throwIfAborted(signal, 'The raysect operation was aborted')
      throwIfAborted(runSignal, 'The raysect operation was aborted')
      const output = solvePrism(parseRaysectInput(input), runSignal ?? signal)
      throwIfAborted(runSignal, 'The raysect operation was aborted')
      return output
    },
  }
}

export const raysectAdapterFactory = createRaysectAdapter
