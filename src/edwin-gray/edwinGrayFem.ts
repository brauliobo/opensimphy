import {
  validateGrayMagneticLookup,
  type GrayMagneticLookup,
} from './edwinGrayEngine'
import {
  GRAY_MACHINE_CONTRACTS,
  type GrayMachineContract,
  type GrayMachineContractId,
} from './edwinGrayMachines'

export interface GrayFemNumberValue {
  value: number
  unit: string
}

export interface GrayFemLookupEntry {
  entryId: string
  status: 'complete'
  parameters: {
    rotorAngleDeg: number
    meshSizeM: number
    driveCurrentA: number
  }
  observables: {
    magneticEnergyJ: GrayFemNumberValue
    coEnergyJ: GrayFemNumberValue
    inductanceH: GrayFemNumberValue
  }
  provenance: {
    synthetic: false
    sourceFormat: 'getdp-table' | 'solver-json'
    solver: string
    backend: string
    modelInputHash: string
    jobInputHash: string
    inputHash?: string
    symmetryApplied: boolean
    artifacts: readonly {
      path: string
      sha256: string
    }[]
  }
}

export interface GrayFemLookupDocument {
  contract: 'edwin-gray-browser-result'
  contractVersion: 1
  lutContract: 'motor-fem-lut-v1'
  caseId: string
  status: 'complete'
  expectedAnglesDeg: readonly number[]
  entries: readonly GrayFemLookupEntry[]
  compatibility?: GrayFemCompatibility
  provenance: {
    synthetic: false
    limitations: readonly string[]
    source: string
  }
}

export interface GrayFemCompatibility {
  machineContractId: GrayMachineContractId
  machineRevision: number
  modelRevision: number
  topologyIdentity: string
  turns: number
  excitation: string
  modelInputHash: string
}

export interface CompatibleGrayFemLookupDocument extends GrayFemLookupDocument {
  compatibility: GrayFemCompatibility
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function numberValue(value: unknown, unit: string, label: string): number {
  assert(value && typeof value === 'object', `${label} is missing`)
  const candidate = value as { value?: unknown; unit?: unknown }
  assert(typeof candidate.value === 'number' && Number.isFinite(candidate.value), `${label}.value must be finite`)
  assert(candidate.unit === unit, `${label}.unit must be ${unit}`)
  return candidate.value
}

function parseCompatibility(value: unknown): GrayFemCompatibility {
  assert(value && typeof value === 'object', 'FEM compatibility metadata must be an object')
  const compatibility = value as Partial<GrayFemCompatibility>
  assert(typeof compatibility.machineContractId === 'string'
    && compatibility.machineContractId in GRAY_MACHINE_CONTRACTS, 'FEM machine contract ID is invalid')
  assert(Number.isInteger(compatibility.machineRevision) && compatibility.machineRevision! > 0, 'FEM machine revision is invalid')
  assert(Number.isInteger(compatibility.modelRevision) && compatibility.modelRevision! > 0, 'FEM model revision is invalid')
  assert(typeof compatibility.topologyIdentity === 'string' && compatibility.topologyIdentity.length > 0, 'FEM topology identity is missing')
  assert(Number.isInteger(compatibility.turns) && compatibility.turns! > 0, 'FEM turns compatibility is invalid')
  assert(typeof compatibility.excitation === 'string' && compatibility.excitation.length > 0, 'FEM excitation compatibility is missing')
  assert(typeof compatibility.modelInputHash === 'string'
    && /^[a-f0-9]{64}$/.test(compatibility.modelInputHash), 'FEM compatibility model input hash is invalid')
  return compatibility as GrayFemCompatibility
}

function parseEntry(value: unknown, index: number): GrayFemLookupEntry {
  assert(value && typeof value === 'object', `FEM entry ${index} must be an object`)
  const entry = value as Partial<GrayFemLookupEntry>
  assert(typeof entry.entryId === 'string' && entry.entryId.length > 0, `FEM entry ${index} has no entry ID`)
  assert(entry.status === 'complete', `FEM entry ${index} is not complete`)
  assert(entry.parameters && Number.isFinite(entry.parameters.rotorAngleDeg), `FEM entry ${index} has no angle`)
  assert(entry.parameters.rotorAngleDeg >= 0 && entry.parameters.rotorAngleDeg < 360, `FEM entry ${index} angle is out of range`)
  assert(entry.parameters && Number.isFinite(entry.parameters.meshSizeM) && entry.parameters.meshSizeM > 0, `FEM entry ${index} has no mesh size`)
  assert(entry.parameters && Number.isFinite(entry.parameters.driveCurrentA) && entry.parameters.driveCurrentA > 0, `FEM entry ${index} has no current`)
  assert(entry.observables && typeof entry.observables === 'object', `FEM entry ${index} has no observables`)
  assert(entry.provenance?.synthetic === false, `FEM entry ${index} is synthetic or unmarked`)
  assert(entry.provenance.sourceFormat === 'getdp-table' || entry.provenance.sourceFormat === 'solver-json', `FEM entry ${index} source format is invalid`)
  assert(typeof entry.provenance.solver === 'string' && entry.provenance.solver.length > 0 && typeof entry.provenance.backend === 'string' && entry.provenance.backend.length > 0, `FEM entry ${index} provenance is incomplete`)
  assert(typeof entry.provenance.modelInputHash === 'string' && /^[a-f0-9]{64}$/.test(entry.provenance.modelInputHash), `FEM entry ${index} model input hash is invalid`)
  assert(typeof entry.provenance.jobInputHash === 'string' && /^[a-f0-9]{64}$/.test(entry.provenance.jobInputHash), `FEM entry ${index} job input hash is invalid`)
  assert(entry.provenance.inputHash === undefined || entry.provenance.inputHash === entry.provenance.jobInputHash, `FEM entry ${index} legacy input hash is inconsistent`)
  assert(typeof entry.provenance.symmetryApplied === 'boolean', `FEM entry ${index} symmetry provenance is incomplete`)
  assert(Array.isArray(entry.provenance.artifacts) && entry.provenance.artifacts.length > 0, `FEM entry ${index} artifacts are incomplete`)
  assert(entry.provenance.artifacts.every((artifact) => artifact
    && typeof artifact.path === 'string'
    && artifact.path.length > 0
    && typeof artifact.sha256 === 'string'
    && /^[a-f0-9]{64}$/.test(artifact.sha256)), `FEM entry ${index} artifact hashes are invalid`)
  assert(new Set(entry.provenance.artifacts.map((artifact) => artifact.path)).size === entry.provenance.artifacts.length, `FEM entry ${index} artifact paths are duplicated`)
  numberValue(entry.observables.magneticEnergyJ, 'J', `FEM entry ${index} magneticEnergyJ`)
  numberValue(entry.observables.coEnergyJ, 'J', `FEM entry ${index} coEnergyJ`)
  numberValue(entry.observables.inductanceH, 'H', `FEM entry ${index} inductanceH`)
  return entry as GrayFemLookupEntry
}

export function parseGrayFemLookupDocument(value: unknown): GrayFemLookupDocument {
  assert(value && typeof value === 'object', 'FEM lookup document must be an object')
  const document = value as Partial<GrayFemLookupDocument>
  assert(document.contract === 'edwin-gray-browser-result', 'Unsupported FEM result contract')
  assert(document.contractVersion === 1, 'Unsupported FEM result contract version')
  assert(document.lutContract === 'motor-fem-lut-v1', 'Unsupported FEM LUT contract')
  assert(typeof document.caseId === 'string' && document.caseId.length > 0, 'FEM caseId is required')
  assert(document.status === 'complete', 'FEM lookup is not complete')
  assert(Array.isArray(document.expectedAnglesDeg) && document.expectedAnglesDeg.length > 0, 'FEM expected angle contract is missing')
  assert(document.expectedAnglesDeg.every((angle) => Number.isFinite(angle) && angle >= 0 && angle < 360), 'FEM expected angle contract is invalid')
  assert(new Set(document.expectedAnglesDeg.map((angle) => angle.toFixed(10))).size === document.expectedAnglesDeg.length, 'FEM expected angle contract contains duplicates')
  assert(Array.isArray(document.entries) && document.entries.length > 0, 'FEM lookup has no complete entries')
  assert(document.provenance?.synthetic === false, 'FEM document is synthetic or unmarked')
  assert(Array.isArray(document.provenance.limitations) && document.provenance.limitations.length > 0, 'FEM document limitations are missing')
  assert(typeof document.provenance.source === 'string' && document.provenance.source.length > 0, 'FEM document source provenance is missing')
  const entries = document.entries.map(parseEntry)
  const compatibility = document.compatibility === undefined
    ? undefined
    : parseCompatibility(document.compatibility)
  const first = entries[0]!
  assert(entries.every((entry) => entry.parameters.meshSizeM === first.parameters.meshSizeM), 'FEM lookup entries must share one mesh size')
  assert(entries.every((entry) => entry.parameters.driveCurrentA === first.parameters.driveCurrentA), 'FEM lookup entries must share one reference current')
  assert(entries.every((entry) => entry.provenance.modelInputHash === first.provenance.modelInputHash), 'FEM lookup entries must share one model input hash')
  assert(entries.every((entry) => entry.provenance.solver === first.provenance.solver && entry.provenance.backend === first.provenance.backend), 'FEM lookup entries must share one solver environment')
  assert(new Set(entries.map((entry) => entry.provenance.jobInputHash)).size === entries.length, 'FEM lookup entries must have distinct job input hashes')
  const actualAngles = [...entries].map((entry) => entry.parameters.rotorAngleDeg).sort((left, right) => left - right)
  assert(new Set(actualAngles.map((angle) => angle.toFixed(10))).size === actualAngles.length, 'FEM lookup entries contain duplicate angles')
  const declaredAngles = [...document.expectedAnglesDeg].sort((left, right) => left - right)
  assert(actualAngles.length === declaredAngles.length
    && actualAngles.every((angle, index) => angle.toFixed(10) === declaredAngles[index]!.toFixed(10)), 'FEM lookup angles must exactly match the declared sweep contract')
  return {
    contract: document.contract,
    contractVersion: document.contractVersion,
    lutContract: document.lutContract,
    caseId: document.caseId,
    status: document.status,
    expectedAnglesDeg: document.expectedAnglesDeg,
    entries,
    ...(compatibility ? { compatibility } : {}),
    provenance: document.provenance,
  }
}

function compatibilityMismatch(field: string): never {
  throw new Error(`FEM lookup is incompatible with the machine contract: ${field} mismatch`)
}

export function requireCompatibleGrayFemLookup(
  document: GrayFemLookupDocument,
  machine: GrayMachineContract | GrayMachineContractId,
): CompatibleGrayFemLookupDocument {
  const contract = typeof machine === 'string' ? GRAY_MACHINE_CONTRACTS[machine] : machine
  const compatibility = document.compatibility
  assert(compatibility, 'FEM lookup compatibility metadata is required')
  if (compatibility.machineContractId !== contract.machineContractId) compatibilityMismatch('machine contract ID')
  if (compatibility.machineRevision !== contract.machineRevision) compatibilityMismatch('machine revision')
  if (compatibility.modelRevision !== contract.modelRevision) compatibilityMismatch('model revision')
  if (compatibility.topologyIdentity !== contract.topologyIdentity) compatibilityMismatch('topology identity')
  if (compatibility.turns !== contract.compatibleTurns) compatibilityMismatch('turns')
  if (compatibility.excitation !== contract.compatibleExcitation) compatibilityMismatch('excitation')
  if (contract.modelInputHash === null) compatibilityMismatch('model input hash')
  if (compatibility.modelInputHash !== contract.modelInputHash) compatibilityMismatch('model input hash')
  if (!document.entries.every((entry) => entry.provenance.modelInputHash === compatibility.modelInputHash)) {
    compatibilityMismatch('model input hash provenance')
  }
  return document as CompatibleGrayFemLookupDocument
}

export function buildGrayMagneticLookup(value: unknown): GrayMagneticLookup {
  const document = parseGrayFemLookupDocument(value)
  const entries = [...document.entries].sort((left, right) => left.parameters.rotorAngleDeg - right.parameters.rotorAngleDeg)
  const referenceCurrentA = entries[0]!.parameters.driveCurrentA
  assert(entries.every((entry) => entry.parameters.driveCurrentA === referenceCurrentA), 'FEM lookup entries must share one reference current')
  const anglesDeg = entries.map((entry) => entry.parameters.rotorAngleDeg)
  assert(anglesDeg.every((angleDeg, index) => index === 0 || angleDeg > anglesDeg[index - 1]!), 'FEM lookup angles must be strictly increasing')
  const firstProvenance = entries[0]!.provenance
  const lookup: GrayMagneticLookup = {
    source: 'fem-lookup',
    caseId: document.caseId,
    referenceCurrentA,
    anglesDeg,
    inductanceH: entries.map((entry) => numberValue(entry.observables.inductanceH, 'H', 'inductanceH')),
    coEnergyJ: entries.map((entry) => numberValue(entry.observables.coEnergyJ, 'J', 'coEnergyJ')),
    provenance: {
      solver: firstProvenance.solver,
      backend: firstProvenance.backend,
      inputHash: firstProvenance.modelInputHash,
    },
  }
  validateGrayMagneticLookup(lookup)
  return lookup
}

export function loadGrayMagneticLookup(
  machine: GrayMachineContract | GrayMachineContractId,
  fetcher: typeof fetch = fetch,
): Promise<GrayMagneticLookup> {
  const path = 'data/generated/edwin-gray/motor-fem-lut-v1.json'
  return fetcher(`${import.meta.env.BASE_URL}${path}`)
    .then((response) => {
      if (!response.ok) throw new Error(`FEM lookup request failed with ${response.status}`)
      return response.json() as Promise<unknown>
    })
    .then((value) => {
      const document = parseGrayFemLookupDocument(value)
      requireCompatibleGrayFemLookup(document, machine)
      return buildGrayMagneticLookup(document)
    })
}
