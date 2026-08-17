import type {
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export const ASTROPY_CATALOG_ITEM_ID = 'awesome-astropy' as const
export const ASTROPY_ADAPTER_ID = 'awesome-astropy-typescript' as const
export const ASTROPY_KERNEL_REVISION = 'astropy-units-galactic-typescript-v1' as const
export const ASTROPY_SOURCE_REVISION = 'cb3c511e2e6e' as const
export const ASTROPY_SOURCE_CAVEATS = Object.freeze({
  upstream: 'https://github.com/astropy/astropy',
  license: 'astropy is BSD-3-Clause; this independent kernel does not redistribute astropy, C extensions, or remote data providers.',
  data: 'No astropy FITS, WCS, mmap, or remote catalog is bundled.',
})

const AU_M = 149597870700
const PARSEC_M = AU_M * 648000 / Math.PI
const LIGHT_YEAR_M = 9460730472580800
const JULIAN_YEAR_S = 365.25 * 86400
const ARCSEC_RAD = Math.PI / (180 * 3600)
const RA_NGP_RAD = (192.85948 * Math.PI) / 180
const DEC_NGP_RAD = (27.12825 * Math.PI) / 180
const L_NCP_RAD = (122.93192 * Math.PI) / 180

export const ASTROPY_BOUNDS = Object.freeze({
  valueAbs: 1e15,
  raDeg: Object.freeze({ min: 0, max: 360 }),
  decDeg: Object.freeze({ min: -90, max: 90 }),
  maxOutputAbs: 1e30,
} as const)

export const ASTROPY_LENGTH_UNITS = ['m', 'au', 'pc', 'ly'] as const
export const ASTROPY_ANGLE_UNITS = ['rad', 'deg', 'arcmin', 'arcsec'] as const
export const ASTROPY_TIME_UNITS = ['s', 'day', 'yr'] as const
export type AstropyUnitV1 =
  | typeof ASTROPY_LENGTH_UNITS[number]
  | typeof ASTROPY_ANGLE_UNITS[number]
  | typeof ASTROPY_TIME_UNITS[number]

export interface AstropyUnitConvertInputV1 {
  operation: 'unit-convert'
  value: number
  from: AstropyUnitV1
  to: AstropyUnitV1
}

export interface AstropyIcrsToGalacticInputV1 {
  operation: 'icrs-to-galactic'
  raDeg: number
  decDeg: number
}

export type AstropyInputV1 = AstropyUnitConvertInputV1 | AstropyIcrsToGalacticInputV1

export interface AstropyUnitConvertOutputV1 {
  schemaVersion: 1
  operation: 'unit-convert'
  input: AstropyUnitConvertInputV1
  value: number
  dimension: 'length' | 'angle' | 'time'
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
  validatesTheory: false
  doesNotEstablish: string
}

export interface AstropyIcrsToGalacticOutputV1 {
  schemaVersion: 1
  operation: 'icrs-to-galactic'
  input: AstropyIcrsToGalacticInputV1
  lDeg: number
  bDeg: number
  assumptions: readonly string[]
  numericalMethod: string
  licenseCaveat: string
  validatesTheory: false
  doesNotEstablish: string
}

export type AstropyOutputV1 = AstropyUnitConvertOutputV1 | AstropyIcrsToGalacticOutputV1
export type AstropyAdapter = AwesomePhysicsAdapterV1<AstropyInputV1, AstropyOutputV1>
export type AstropyAdapterFactory = AwesomePhysicsAdapterFactoryV1<AstropyInputV1, AstropyOutputV1>

const TO_SI: Readonly<Record<AstropyUnitV1, number>> = Object.freeze({
  m: 1,
  au: AU_M,
  pc: PARSEC_M,
  ly: LIGHT_YEAR_M,
  rad: 1,
  deg: Math.PI / 180,
  arcmin: Math.PI / (180 * 60),
  arcsec: ARCSEC_RAD,
  s: 1,
  day: 86400,
  yr: JULIAN_YEAR_S,
})

function dimensionOf(unit: AstropyUnitV1): 'length' | 'angle' | 'time' {
  if ((ASTROPY_LENGTH_UNITS as readonly string[]).includes(unit)) return 'length'
  if ((ASTROPY_ANGLE_UNITS as readonly string[]).includes(unit)) return 'angle'
  return 'time'
}

function fail(path: string, message: string): never {
  throw new TypeError(`${path} ${message}`)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'must be a JSON object')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) fail(path, 'must be a plain JSON object')
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], path: string): void {
  const unknown = Object.keys(value).filter((key) => !required.includes(key))
  const missing = required.filter((key) => !Object.hasOwn(value, key))
  if (unknown.length > 0) fail(path, `has unknown properties: ${unknown.join(', ')}`)
  if (missing.length > 0) fail(path, `is missing properties: ${missing.join(', ')}`)
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
  return value
}

function boundedNumber(value: unknown, path: string, minimum: number, maximum: number): number {
  const result = finiteNumber(value, path)
  if (result < minimum || result > maximum) fail(path, `must be between ${minimum} and ${maximum}`)
  return result
}

function finiteOutput(value: number, path: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > ASTROPY_BOUNDS.maxOutputAbs) {
    throw new RangeError(`${path} is outside the finite output bound`)
  }
  return value === 0 ? 0 : value
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  if (signal.reason instanceof Error) throw signal.reason
  const error = new Error('The astropy operation was aborted')
  error.name = 'AbortError'
  throw error
}

function parseUnit(value: unknown, path: string): AstropyUnitV1 {
  if (typeof value !== 'string' || !Object.hasOwn(TO_SI, value)) fail(path, 'must be a supported unit')
  return value as AstropyUnitV1
}

export function parseAstropyInput(value: unknown): AstropyInputV1 {
  const input = record(value, 'astropy input')
  if (input.operation === 'unit-convert') {
    exactKeys(input, ['operation', 'value', 'from', 'to'], 'astropy input')
    const from = parseUnit(input.from, 'astropy input.from')
    const to = parseUnit(input.to, 'astropy input.to')
    if (dimensionOf(from) !== dimensionOf(to)) fail('astropy input.to', 'must have the same dimension as from')
    return {
      operation: 'unit-convert',
      value: boundedNumber(input.value, 'astropy input.value', -ASTROPY_BOUNDS.valueAbs, ASTROPY_BOUNDS.valueAbs),
      from,
      to,
    }
  }
  if (input.operation === 'icrs-to-galactic') {
    exactKeys(input, ['operation', 'raDeg', 'decDeg'], 'astropy input')
    return {
      operation: 'icrs-to-galactic',
      raDeg: boundedNumber(input.raDeg, 'astropy input.raDeg', ASTROPY_BOUNDS.raDeg.min, ASTROPY_BOUNDS.raDeg.max),
      decDeg: boundedNumber(input.decDeg, 'astropy input.decDeg', ASTROPY_BOUNDS.decDeg.min, ASTROPY_BOUNDS.decDeg.max),
    }
  }
  fail('astropy input.operation', 'must be unit-convert or icrs-to-galactic')
}

function solveUnits(input: AstropyUnitConvertInputV1, signal?: AbortSignal): AstropyUnitConvertOutputV1 {
  throwIfAborted(signal)
  const si = input.value * TO_SI[input.from]
  return {
    schemaVersion: 1,
    operation: 'unit-convert',
    input,
    value: finiteOutput(si / TO_SI[input.to], 'value'),
    dimension: dimensionOf(input.from),
    assumptions: [
      'Length uses the IAU 2012 astronomical unit and the parsec defined from 1 au subtending 1 arcsec.',
      'Time uses the Julian year 365.25 d. Angle conversions are exact SI radian factors.',
      'astropy C extensions, FITS, WCS, mmap, and remote data providers are not used.',
    ],
    numericalMethod: 'Direct bounded conversion through SI base units.',
    licenseCaveat: ASTROPY_SOURCE_CAVEATS.license,
    validatesTheory: false,
    doesNotEstablish: 'A finite unit or coordinate conversion does not establish catalog agreement or scientific validation of astropy.',
  }
}

function wrapLongitudeDeg(degrees: number): number {
  const wrapped = ((degrees % 360) + 360) % 360
  return wrapped === 0 ? 0 : wrapped
}

function solveGalactic(input: AstropyIcrsToGalacticInputV1, signal?: AbortSignal): AstropyIcrsToGalacticOutputV1 {
  throwIfAborted(signal)
  const ra = (input.raDeg * Math.PI) / 180
  const dec = (input.decDeg * Math.PI) / 180
  const deltaRa = ra - RA_NGP_RAD
  const sinB = Math.sin(dec) * Math.sin(DEC_NGP_RAD) + Math.cos(dec) * Math.cos(DEC_NGP_RAD) * Math.cos(deltaRa)
  const y = Math.cos(dec) * Math.sin(deltaRa)
  const x = Math.sin(dec) * Math.cos(DEC_NGP_RAD) - Math.cos(dec) * Math.sin(DEC_NGP_RAD) * Math.cos(deltaRa)
  const bDeg = finiteOutput((Math.asin(Math.min(1, Math.max(-1, sinB))) * 180) / Math.PI, 'bDeg')
  const lDeg = finiteOutput(wrapLongitudeDeg((L_NCP_RAD - Math.atan2(y, x)) * 180 / Math.PI), 'lDeg')
  return {
    schemaVersion: 1,
    operation: 'icrs-to-galactic',
    input,
    lDeg,
    bDeg,
    assumptions: [
      'ICRS to Galactic uses the Reid & Brunthaler NGP (α=192.85948°, δ=27.12825°, l_NCP=122.93192°).',
      'No precession, proper motion, or observer location is applied.',
      'astropy frames, WCS, FITS, and remote data providers are not used.',
    ],
    numericalMethod: 'Direct spherical rotation from ICRS to Galactic longitude and latitude.',
    licenseCaveat: ASTROPY_SOURCE_CAVEATS.license,
    validatesTheory: false,
    doesNotEstablish: 'A finite unit or coordinate conversion does not establish catalog agreement or scientific validation of astropy.',
  }
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  throwIfAborted(signal)
  if (descriptor.catalogItemId !== ASTROPY_CATALOG_ITEM_ID || descriptor.title !== 'astropy') {
    throw new TypeError('astropy adapter requires the astropy simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('astropy adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.trim().length === 0)) {
    throw new TypeError('astropy descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(descriptor.adapterId))) {
    throw new TypeError('astropy descriptor adapterId must be a safe ID')
  }
  return {
    adapterId: descriptor.adapterId ?? ASTROPY_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptor.contentRevision,
      modelRevision: descriptor.modelRevision,
      implementationRevision: descriptor.implementationRevision,
      outputRevision: descriptor.outputRevision,
    },
  }
}

export const createAstropyAdapter: AstropyAdapterFactory = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      throwIfAborted(signal)
      throwIfAborted(runSignal)
      const parsed = parseAstropyInput(input)
      const output = parsed.operation === 'unit-convert'
        ? solveUnits(parsed, runSignal ?? signal)
        : solveGalactic(parsed, runSignal ?? signal)
      throwIfAborted(runSignal)
      return output
    },
  }
}

export const astropyAdapterFactory = createAstropyAdapter
