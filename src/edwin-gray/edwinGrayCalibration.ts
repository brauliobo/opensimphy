import {
  validateGrayMagneticLookup,
  type GrayMagneticLookup,
} from './edwinGrayEngine'
import {
  GRAY_MACHINE_CONTRACTS,
  GRAY_PATENT_MACHINE_ID,
  type GrayMachineContract,
  type GrayMachineContractId,
} from './edwinGrayMachines'

const SHA256 = /^[a-f0-9]{64}$/
const EVENT_STEP_DEG = 40 / 3
const CLASS_COUNT = 3
const EVENT_COUNT = 27

export const GRAY_CALIBRATION_PATH = 'data/generated/edwin-gray/motor-fem-calibration-pack-v1.json'
export const GRAY_CALIBRATION_TRANSFER_PROXY = 0.011584935659327932
export const GRAY_CALIBRATION_ACCEPTANCE_THRESHOLD = 0.02

export interface GrayCalibrationValue {
  value: number
  unit: 'J' | 'H'
}

export interface GrayCalibrationClass {
  eventClass: 0 | 1 | 2
  eventIndex: 0 | 1 | 2
  rotorAngleDeg: number
  jobInputHash: string
  checkpointSha256: string
  resultSha256: string
  observables: {
    magneticEnergyJ: GrayCalibrationValue
    coEnergyJ: GrayCalibrationValue
    inductanceH: GrayCalibrationValue
  }
  uncertaintyBasis: 'measured' | 'transfer-assumed'
}

export interface GrayCalibrationPack {
  contract: 'edwin-gray-motor-fem-calibration-pack'
  contractVersion: 1
  profileId: 'fast-limited-calibration-v1'
  status: 'limited-not-validated'
  productionEligible: false
  fullConvergenceClaim: false
  optIn: true
  defaultEnabled: false
  configuration: {
    eventClasses: readonly [0, 1, 2]
    meshSizeM: 0.025
    driveCurrentA: 10
    solverProfile: 'direct-mumps-publication-v1'
    resources: {
      memoryGiB: 24
      memorySwapGiB: 24
      cpus: 2
      threads: 2
      serial: true
    }
    hardDeadlineSeconds: 1720
  }
  evidence: {
    modelInputHash: string
    environmentIdentityHash: string
    pilotReportSha256: string
    symmetryProofSha256: string
    coarseFineDrift: {
      measured: typeof GRAY_CALIBRATION_TRANSFER_PROXY
      maximum: typeof GRAY_CALIBRATION_ACCEPTANCE_THRESHOLD
      status: 'passed'
    }
  }
  classes: readonly GrayCalibrationClass[]
  uncertainty: {
    relativeBound: typeof GRAY_CALIBRATION_ACCEPTANCE_THRESHOLD
    quantities: readonly ['L', 'W', "W'"]
    classBasis: Readonly<{ '0': 'measured'; '1': 'transfer-assumed'; '2': 'transfer-assumed' }>
  }
  torque: { bounded: false; reason: string }
  limitations: readonly string[]
}

export interface GrayCalibrationMagneticLookup extends GrayMagneticLookup {
  source: 'limited-fem-calibration'
  magneticEnergyJ: readonly number[]
  calibration: {
    status: 'limited-not-validated'
    productionEligible: false
    fullConvergenceClaim: false
    transferProxyRelative: typeof GRAY_CALIBRATION_TRANSFER_PROXY
    classBasis: readonly ['measured', 'transfer-assumed', 'transfer-assumed']
    torqueBounded: false
    symmetryProofSha256: string
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function object(value: unknown, label: string, keys: readonly string[]): Record<string, unknown> {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`)
  const record = value as Record<string, unknown>
  const actual = Object.keys(record).sort()
  const expected = [...keys].sort()
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label} fields do not match the calibration contract`)
  return record
}

function exactArray(value: unknown, expected: readonly unknown[], label: string): void {
  assert(Array.isArray(value) && JSON.stringify(value) === JSON.stringify(expected), `${label} is invalid`)
}

function hash(value: unknown, label: string): string {
  assert(typeof value === 'string' && SHA256.test(value), `${label} must be a SHA-256 hash`)
  return value
}

function finiteValue(value: unknown, unit: 'J' | 'H', label: string): GrayCalibrationValue {
  const record = object(value, label, ['value', 'unit'])
  assert(typeof record.value === 'number' && Number.isFinite(record.value), `${label}.value must be finite`)
  assert(record.value >= 0 && (unit !== 'H' || record.value > 0), `${label}.value is outside the magnetic lookup domain`)
  assert(record.unit === unit, `${label}.unit must be ${unit}`)
  return { value: record.value, unit }
}

function rejectUnavailableCalibration(value: unknown): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return
  const pack = value as Record<string, unknown>
  if (pack.contract !== 'edwin-gray-motor-fem-calibration-pack') return
  if (pack.contractVersion === 1) {
    throw new Error('Limited FEM calibration unavailable: cached contract v1 has the known pilot provenance mismatch and cannot establish an uncertainty bound.')
  }
  if (pack.contractVersion !== 2) return
  assert(pack.status === 'unavailable-provenance-mismatch' && pack.runtimeAvailable === false,
    'Calibration contract v2 must remain unavailable when provenance does not match')
  const evidence = object(pack.evidence, 'Unavailable calibration evidence', [
    'modelInputHash', 'pilotModelInputHash', 'environmentIdentityHash', 'pilotReportSha256',
    'pilotSpecificationSha256', 'currentSpecificationSha256', 'symmetryProofSha256', 'coarseFineDrift',
  ])
  assert(hash(evidence.modelInputHash, 'Calibration model input hash')
    !== hash(evidence.pilotModelInputHash, 'Pilot model input hash'), 'Calibration v2 must declare the pilot model mismatch')
  const drift = object(evidence.coarseFineDrift, 'Unavailable calibration pilot drift', [
    'observed', 'passTolerance', 'status',
  ])
  assert(drift.observed === GRAY_CALIBRATION_TRANSFER_PROXY
    && drift.passTolerance === GRAY_CALIBRATION_ACCEPTANCE_THRESHOLD
    && drift.status === 'legacy-pilot-only', 'Unavailable calibration pilot drift disclosure is invalid')
  const uncertainty = object(pack.uncertainty, 'Unavailable calibration uncertainty', [
    'established', 'relativeBound', 'passTolerance', 'reason', 'quantities', 'classBasis',
  ])
  assert(uncertainty.established === false && uncertainty.relativeBound === null
    && uncertainty.passTolerance === GRAY_CALIBRATION_ACCEPTANCE_THRESHOLD,
  'Unavailable calibration must not declare an uncertainty bound')
  throw new Error('Limited FEM calibration unavailable: pilot and class-run provenance mismatch; the observed pilot drift and 2% acceptance threshold are not uncertainty bounds, and class transfer is assumption-only.')
}

function parseClass(value: unknown, index: number): GrayCalibrationClass {
  const label = `Calibration class ${index}`
  const record = object(value, label, [
    'eventClass', 'eventIndex', 'rotorAngleDeg', 'jobInputHash', 'checkpointSha256',
    'resultSha256', 'observables', 'uncertaintyBasis',
  ])
  assert(record.eventClass === index && record.eventIndex === index, `${label} must represent event class/index ${index}`)
  assert(record.rotorAngleDeg === index * EVENT_STEP_DEG, `${label} rotor angle is invalid`)
  const observables = object(record.observables, `${label} observables`, [
    'magneticEnergyJ', 'coEnergyJ', 'inductanceH',
  ])
  const uncertaintyBasis = index === 0 ? 'measured' : 'transfer-assumed'
  assert(record.uncertaintyBasis === uncertaintyBasis, `${label} uncertainty basis is invalid`)
  return {
    eventClass: index as 0 | 1 | 2,
    eventIndex: index as 0 | 1 | 2,
    rotorAngleDeg: record.rotorAngleDeg,
    jobInputHash: hash(record.jobInputHash, `${label} job input hash`),
    checkpointSha256: hash(record.checkpointSha256, `${label} checkpoint hash`),
    resultSha256: hash(record.resultSha256, `${label} result hash`),
    observables: {
      magneticEnergyJ: finiteValue(observables.magneticEnergyJ, 'J', `${label} magneticEnergyJ`),
      coEnergyJ: finiteValue(observables.coEnergyJ, 'J', `${label} coEnergyJ`),
      inductanceH: finiteValue(observables.inductanceH, 'H', `${label} inductanceH`),
    },
    uncertaintyBasis,
  }
}

export function parseGrayCalibrationPack(value: unknown): GrayCalibrationPack {
  rejectUnavailableCalibration(value)
  const pack = object(value, 'Calibration pack', [
    'contract', 'contractVersion', 'profileId', 'status', 'productionEligible',
    'fullConvergenceClaim', 'optIn', 'defaultEnabled', 'configuration', 'evidence',
    'classes', 'uncertainty', 'torque', 'limitations',
  ])
  assert(pack.contract === 'edwin-gray-motor-fem-calibration-pack', 'Unsupported calibration pack contract')
  assert(pack.contractVersion === 1, 'Unsupported calibration pack contract version')
  assert(pack.profileId === 'fast-limited-calibration-v1', 'Unsupported calibration profile')
  assert(pack.status === 'limited-not-validated', 'Calibration status must be limited-not-validated')
  assert(pack.productionEligible === false, 'Calibration pack must not be production eligible')
  assert(pack.fullConvergenceClaim === false, 'Calibration pack must not claim full convergence')
  assert(pack.optIn === true && pack.defaultEnabled === false, 'Calibration pack must be explicit opt-in and disabled by default')

  const configuration = object(pack.configuration, 'Calibration configuration', [
    'eventClasses', 'meshSizeM', 'driveCurrentA', 'solverProfile', 'resources', 'hardDeadlineSeconds',
  ])
  exactArray(configuration.eventClasses, [0, 1, 2], 'Calibration event classes')
  assert(configuration.meshSizeM === 0.025 && configuration.driveCurrentA === 10, 'Calibration mesh/current profile is invalid')
  assert(configuration.solverProfile === 'direct-mumps-publication-v1', 'Calibration solver profile is invalid')
  assert(configuration.hardDeadlineSeconds === 1720, 'Calibration hard deadline is invalid')
  const resources = object(configuration.resources, 'Calibration resources', [
    'memoryGiB', 'memorySwapGiB', 'cpus', 'threads', 'serial',
  ])
  assert(resources.memoryGiB === 24 && resources.memorySwapGiB === 24 && resources.cpus === 2
    && resources.threads === 2 && resources.serial === true, 'Calibration resource profile is invalid')

  const evidence = object(pack.evidence, 'Calibration evidence', [
    'modelInputHash', 'environmentIdentityHash', 'pilotReportSha256', 'symmetryProofSha256', 'coarseFineDrift',
  ])
  const patent = GRAY_MACHINE_CONTRACTS[GRAY_PATENT_MACHINE_ID]
  assert(evidence.modelInputHash === patent.modelInputHash, 'Calibration model input hash does not match the patent illustrative machine')
  const coarseFineDrift = object(evidence.coarseFineDrift, 'Calibration coarse/fine drift', [
    'measured', 'maximum', 'status',
  ])
  assert(coarseFineDrift.measured === GRAY_CALIBRATION_TRANSFER_PROXY
    && coarseFineDrift.maximum === GRAY_CALIBRATION_ACCEPTANCE_THRESHOLD
    && coarseFineDrift.status === 'passed', 'Calibration coarse/fine drift evidence is invalid')

  assert(Array.isArray(pack.classes) && pack.classes.length === CLASS_COUNT, 'Calibration pack must contain exactly classes 0, 1, and 2')
  const classes = pack.classes.map(parseClass)

  const uncertainty = object(pack.uncertainty, 'Calibration uncertainty', ['relativeBound', 'quantities', 'classBasis'])
  assert(uncertainty.relativeBound === GRAY_CALIBRATION_ACCEPTANCE_THRESHOLD, 'Calibration uncertainty bound is invalid')
  exactArray(uncertainty.quantities, ['L', 'W', "W'"], 'Calibration uncertainty quantities')
  const classBasis = object(uncertainty.classBasis, 'Calibration class basis', ['0', '1', '2'])
  assert(classBasis['0'] === 'measured' && classBasis['1'] === 'transfer-assumed'
    && classBasis['2'] === 'transfer-assumed', 'Calibration class uncertainty basis is invalid')

  const torque = object(pack.torque, 'Calibration torque boundary', ['bounded', 'reason'])
  assert(torque.bounded === false && typeof torque.reason === 'string' && torque.reason.length > 0,
    'Calibration torque must be explicitly unbounded')
  assert(Array.isArray(pack.limitations) && pack.limitations.length > 0
    && pack.limitations.every((limitation) => typeof limitation === 'string' && limitation.length > 0),
  'Calibration limitations are required')

  return {
    contract: 'edwin-gray-motor-fem-calibration-pack',
    contractVersion: 1,
    profileId: 'fast-limited-calibration-v1',
    status: 'limited-not-validated',
    productionEligible: false,
    fullConvergenceClaim: false,
    optIn: true,
    defaultEnabled: false,
    configuration: {
      eventClasses: [0, 1, 2], meshSizeM: 0.025, driveCurrentA: 10,
      solverProfile: 'direct-mumps-publication-v1',
      resources: { memoryGiB: 24, memorySwapGiB: 24, cpus: 2, threads: 2, serial: true },
      hardDeadlineSeconds: 1720,
    },
    evidence: {
      modelInputHash: hash(evidence.modelInputHash, 'Calibration model input hash'),
      environmentIdentityHash: hash(evidence.environmentIdentityHash, 'Calibration environment identity hash'),
      pilotReportSha256: hash(evidence.pilotReportSha256, 'Calibration pilot report hash'),
      symmetryProofSha256: hash(evidence.symmetryProofSha256, 'Calibration symmetry proof hash'),
      coarseFineDrift: {
        measured: GRAY_CALIBRATION_TRANSFER_PROXY,
        maximum: GRAY_CALIBRATION_ACCEPTANCE_THRESHOLD,
        status: 'passed',
      },
    },
    classes,
    uncertainty: {
      relativeBound: GRAY_CALIBRATION_ACCEPTANCE_THRESHOLD,
      quantities: ['L', 'W', "W'"],
      classBasis: { '0': 'measured', '1': 'transfer-assumed', '2': 'transfer-assumed' },
    },
    torque: { bounded: false, reason: torque.reason },
    limitations: pack.limitations as string[],
  }
}

function compatibilityMismatch(field: string): never {
  throw new Error(`Limited FEM calibration is incompatible with the machine contract: ${field} mismatch`)
}

export function requireCompatibleGrayCalibration(
  pack: GrayCalibrationPack,
  machine: GrayMachineContract | GrayMachineContractId,
): GrayMachineContract {
  const contract = typeof machine === 'string' ? GRAY_MACHINE_CONTRACTS[machine] : machine
  const patent = GRAY_MACHINE_CONTRACTS[GRAY_PATENT_MACHINE_ID]
  if (contract.machineContractId !== GRAY_PATENT_MACHINE_ID) compatibilityMismatch('patent illustrative machine')
  if (contract.machineRevision !== patent.machineRevision) compatibilityMismatch('machine revision')
  if (contract.modelRevision !== patent.modelRevision) compatibilityMismatch('model revision')
  if (contract.topologyIdentity !== 'us3890548a-nine-stator-three-rotor-pair-topology') compatibilityMismatch('topology identity')
  if (contract.compatibleTurns !== 100) compatibilityMismatch('turns')
  if (contract.compatibleExcitation !== 'impressed-current-magnetostatic') compatibilityMismatch('excitation')
  if (contract.modelInputHash !== pack.evidence.modelInputHash) compatibilityMismatch('model input hash')
  return contract
}

export function buildGrayCalibrationMagneticLookup(
  value: unknown,
  machine: GrayMachineContract | GrayMachineContractId = GRAY_PATENT_MACHINE_ID,
): GrayCalibrationMagneticLookup {
  const pack = parseGrayCalibrationPack(value)
  const contract = requireCompatibleGrayCalibration(pack, machine)
  const expanded = Array.from({ length: EVENT_COUNT }, (_, eventIndex) => ({
    angleDeg: eventIndex * 360 / EVENT_COUNT,
    source: pack.classes[eventIndex % CLASS_COUNT]!,
  }))
  const lookup: GrayCalibrationMagneticLookup = {
    source: 'limited-fem-calibration',
    caseId: 'patent-3890548-illustrative-limited-calibration',
    referenceCurrentA: pack.configuration.driveCurrentA,
    anglesDeg: expanded.map(({ angleDeg }) => angleDeg),
    inductanceH: expanded.map(({ source }) => source.observables.inductanceH.value),
    magneticEnergyJ: expanded.map(({ source }) => source.observables.magneticEnergyJ.value),
    coEnergyJ: expanded.map(({ source }) => source.observables.coEnergyJ.value),
    provenance: {
      solver: pack.configuration.solverProfile,
      backend: 'resource-bounded-calibration-pack',
      inputHash: pack.evidence.modelInputHash,
    },
    compatibility: {
      machineContractId: contract.machineContractId,
      machineRevision: contract.machineRevision,
      modelRevision: contract.modelRevision,
      topologyIdentity: contract.topologyIdentity,
      turns: contract.compatibleTurns,
      excitation: contract.compatibleExcitation,
      modelInputHash: pack.evidence.modelInputHash,
    },
    calibration: {
      status: 'limited-not-validated',
      productionEligible: false,
      fullConvergenceClaim: false,
      transferProxyRelative: GRAY_CALIBRATION_TRANSFER_PROXY,
      classBasis: ['measured', 'transfer-assumed', 'transfer-assumed'],
      torqueBounded: false,
      symmetryProofSha256: pack.evidence.symmetryProofSha256,
    },
  }
  validateGrayMagneticLookup(lookup)
  return Object.freeze({
    ...lookup,
    anglesDeg: Object.freeze(lookup.anglesDeg),
    inductanceH: Object.freeze(lookup.inductanceH),
    magneticEnergyJ: Object.freeze(lookup.magneticEnergyJ),
    coEnergyJ: Object.freeze(lookup.coEnergyJ),
    provenance: Object.freeze(lookup.provenance),
    compatibility: Object.freeze(lookup.compatibility),
    calibration: Object.freeze({ ...lookup.calibration, classBasis: Object.freeze(lookup.calibration.classBasis) }),
  })
}

export async function loadGrayCalibrationMagneticLookup(
  machine: GrayMachineContract | GrayMachineContractId,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<GrayCalibrationMagneticLookup> {
  const response = await fetcher(`${import.meta.env.BASE_URL}${GRAY_CALIBRATION_PATH}`, { signal })
  if (!response.ok) throw new Error(`Limited FEM calibration request failed with ${response.status}`)
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Limited FEM calibration request failed with 404')
  }
  return buildGrayCalibrationMagneticLookup(await response.json() as unknown, machine)
}
