import {
  validateGrayMagneticLookup,
  type GrayMagneticLookup,
} from './edwinGrayEngine'

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
    inputHash: string
    symmetryApplied: boolean
    artifacts: readonly string[]
  }
}

export interface GrayFemLookupDocument {
  contract: 'edwin-gray-browser-result'
  contractVersion: 1
  lutContract: 'motor-fem-lut-v1'
  caseId: string
  status: 'complete'
  entries: readonly GrayFemLookupEntry[]
  provenance: {
    synthetic: false
    limitations: readonly string[]
    source: string
  }
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
  assert(typeof entry.provenance.inputHash === 'string' && /^[a-f0-9]{64}$/.test(entry.provenance.inputHash), `FEM entry ${index} input hash is invalid`)
  assert(typeof entry.provenance.symmetryApplied === 'boolean', `FEM entry ${index} symmetry provenance is incomplete`)
  assert(Array.isArray(entry.provenance.artifacts) && entry.provenance.artifacts.length > 0 && entry.provenance.artifacts.every((artifact) => typeof artifact === 'string' && artifact.length > 0), `FEM entry ${index} artifacts are incomplete`)
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
  assert(Array.isArray(document.entries) && document.entries.length >= 2, 'At least two complete FEM angles are required')
  assert(document.provenance?.synthetic === false, 'FEM document is synthetic or unmarked')
  assert(Array.isArray(document.provenance.limitations) && document.provenance.limitations.length > 0, 'FEM document limitations are missing')
  assert(typeof document.provenance.source === 'string' && document.provenance.source.length > 0, 'FEM document source provenance is missing')
  return {
    contract: document.contract,
    contractVersion: document.contractVersion,
    lutContract: document.lutContract,
    caseId: document.caseId,
    status: document.status,
    entries: document.entries.map(parseEntry),
    provenance: document.provenance,
  }
}

export function buildGrayMagneticLookup(value: unknown): GrayMagneticLookup {
  const document = parseGrayFemLookupDocument(value)
  const entries = [...document.entries].sort((left, right) => left.parameters.rotorAngleDeg - right.parameters.rotorAngleDeg)
  const referenceCurrentA = entries[0]!.parameters.driveCurrentA
  assert(entries.every((entry) => entry.parameters.driveCurrentA === referenceCurrentA), 'FEM lookup entries must share one reference current')
  const anglesDeg = entries.map((entry) => entry.parameters.rotorAngleDeg)
  assert(anglesDeg.every((angleDeg, index) => index === 0 || angleDeg > anglesDeg[index - 1]!), 'FEM lookup angles must be strictly increasing')
  const firstProvenance = entries[0]!.provenance
  assert(entries.every((entry) => entry.provenance.inputHash === firstProvenance.inputHash), 'FEM lookup entries must share one input hash')
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
      inputHash: firstProvenance.inputHash,
    },
  }
  validateGrayMagneticLookup(lookup)
  return lookup
}

export function loadGrayMagneticLookup(fetcher: typeof fetch = fetch): Promise<GrayMagneticLookup> {
  const path = 'data/generated/edwin-gray/motor-fem-lut-v1.json'
  return fetcher(`${import.meta.env.BASE_URL}${path}`)
    .then((response) => {
      if (!response.ok) throw new Error(`FEM lookup request failed with ${response.status}`)
      return response.json() as Promise<unknown>
    })
    .then(buildGrayMagneticLookup)
}
