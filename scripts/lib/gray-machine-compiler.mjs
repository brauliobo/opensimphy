import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const GRAY_COMPILER_REVISION = 'gray-machine-compiler-v1'
export const GRAY_API_REVISION = 1
export const GRAY_METHOD_REVISION = 'bounded-midpoint-event-map-v2'
export const GRAY_EVENT_REVISION = 'us3890548a-27-event-v1'

const EVIDENCE_FIELDS = new Set([
  'machineId',
  'name',
  'source',
  'engineModel',
  'topology',
  'geometryRevision',
  'windingTurns',
  'excitationEventSchedule',
  'materials',
  'circuit',
  'mechanicalLoad',
  'femAvailability',
])
const EVIDENCE_KEYS = ['evidenceClass', 'evidenceRefs', 'note', 'value']
const PROTOTYPE_BLOCKERS = [
  'topology',
  'geometryRevision',
  'windingTurns',
  'excitationEventSchedule',
  'materials',
  'circuit',
  'mechanicalLoad',
]
const MACHINE_REVISION = 1
const MODEL_REVISION = 1
const PATENT_CONTRACT_ID = 'us3890548a-illustrative-topology-v1'

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function schemaTypeMatches(value, type) {
  if (type === 'null') return value === null
  if (type === 'array') return Array.isArray(value)
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value)
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
  return typeof value === type
}

function resolveReference(root, reference) {
  if (!reference.startsWith('#/')) throw new Error(`Unsupported schema reference ${reference}`)
  return reference.slice(2).split('/').reduce((value, key) => value?.[key], root)
}

export function validateAgainstSchema(value, schema, path = '$', root = schema) {
  if (schema.$ref) return validateAgainstSchema(value, resolveReference(root, schema.$ref), path, root)
  if (Object.hasOwn(schema, 'const') && value !== schema.const) throw new Error(`${path} must equal ${JSON.stringify(schema.const)}`)
  if (schema.enum && !schema.enum.some((entry) => canonicalJson(entry) === canonicalJson(value))) {
    throw new Error(`${path} is outside the schema enum`)
  }
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : []
  if (types.length && !types.some((type) => schemaTypeMatches(value, type))) {
    throw new Error(`${path} must have type ${types.join(' or ')}`)
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) throw new Error(`${path}.${key} is required`)
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(schema.properties ?? {}, key)) throw new Error(`${path}.${key} is not allowed`)
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) validateAgainstSchema(value[key], childSchema, `${path}.${key}`, root)
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) throw new Error(`${path} has too few items`)
    if (schema.uniqueItems && new Set(value.map(canonicalJson)).size !== value.length) throw new Error(`${path} items must be unique`)
    value.forEach((item, index) => validateAgainstSchema(item, schema.items ?? {}, `${path}[${index}]`, root))
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) throw new Error(`${path} is too short`)
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) throw new Error(`${path} does not match ${schema.pattern}`)
  }
}

function assertFiniteTree(value, path) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${path} must be finite`)
  if (Array.isArray(value)) value.forEach((child, index) => assertFiniteTree(child, `${path}[${index}]`))
  else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) assertFiniteTree(child, `${path}.${key}`)
  }
}

function assertEvidence(contract) {
  const fields = [
    ...Object.entries(contract.identity),
    ...Object.entries(contract.compatibilityIdentity),
    ...contract.limitations.map((value, index) => [`limitations[${index}]`, value]),
  ]
  for (const [name, field] of fields) {
    if (!EVIDENCE_FIELDS.has(name) && !name.startsWith('limitations[')) throw new Error(`${contract.contractId}.${name} is not an evidence field`)
    if (canonicalJson(Object.keys(field).sort()) !== canonicalJson(EVIDENCE_KEYS)) {
      throw new Error(`${contract.contractId}.${name} must contain exactly value, evidenceClass, evidenceRefs, and note`)
    }
    if (!field.evidenceRefs.every((reference) => typeof reference === 'string' && reference.length > 0)) {
      throw new Error(`${contract.contractId}.${name} has invalid evidence references`)
    }
  }
  const runtime = contract.runtimeModel
  if (runtime.provenance.evidenceRefs.length === 0 || runtime.provenance.evidenceClass === 'calibrated') {
    throw new Error(`${contract.contractId}.runtimeModel must have explicit non-calibrated evidence provenance`)
  }
}

function assertRuntimeConsistency(contract) {
  const { runtimeModel, identity, compatibilityIdentity } = contract
  const { catalog, defaults, profile, sourceClassification } = runtimeModel
  if (profile.compatibleTurns !== defaults.turns) throw new Error(`${contract.contractId} profile/default turns differ`)
  if (catalog.engineMotorId === 'patent-illustrative') {
    if (contract.contractId !== PATENT_CONTRACT_ID
      || sourceClassification.kind !== 'patent-described-illustrative-model'
      || sourceClassification.sourceStatus !== 'patent-illustrative'
      || sourceClassification.surrogateStatus !== 'patent-illustrative-runtime-not-replica'
      || !profile.femCompatible
      || !/^[a-f0-9]{64}$/.test(profile.modelInputHash ?? '')) {
      throw new Error(`${contract.contractId} patent runtime classification or FEM profile is invalid`)
    }
    const fem = compatibilityIdentity.femAvailability.value
    if (!fem.compatible || fem.caseId !== profile.machineContractId || fem.scope !== 'illustrative-not-replica') {
      throw new Error(`${contract.contractId} patent runtime/FEM identities differ`)
    }
    return
  }
  if (identity.machineId.value !== catalog.engineMotorId || identity.name.value !== catalog.label) {
    throw new Error(`${contract.contractId} runtime catalog identity differs from descriptive identity`)
  }
  if (sourceClassification.kind !== 'source-described-prototype'
    || sourceClassification.sourceStatus !== 'descriptive'
    || sourceClassification.surrogateStatus !== 'illustrative-not-fem-calibrated'
    || profile.femCompatible
    || profile.modelInputHash !== null) {
    throw new Error(`${contract.contractId} prototype runtime must remain descriptive, illustrative, and FEM-blocked`)
  }
  for (const field of PROTOTYPE_BLOCKERS) {
    if (compatibilityIdentity[field].value !== null || compatibilityIdentity[field].evidenceClass !== 'unavailable') {
      throw new Error(`${contract.contractId} inherits unavailable FEM field ${field}`)
    }
  }
  const fem = compatibilityIdentity.femAvailability.value
  if (fem.compatible || fem.caseId !== null || canonicalJson(fem.blockedBy) !== canonicalJson(PROTOTYPE_BLOCKERS)) {
    throw new Error(`${contract.contractId} prototype FEM blocker set is invalid`)
  }
}

export function validateMachineContracts(contracts, schema) {
  if (contracts.length !== 7) throw new Error(`Expected seven Gray machine contracts, received ${contracts.length}`)
  for (const contract of contracts) {
    validateAgainstSchema(contract, schema, contract.contractId, schema)
    assertFiniteTree(contract, contract.contractId)
    assertEvidence(contract)
    assertRuntimeConsistency(contract)
  }
  const unique = (values, label) => {
    if (new Set(values).size !== values.length) throw new Error(`${label} must be unique`)
  }
  unique(contracts.map(({ contractId }) => contractId), 'contract IDs')
  unique(contracts.map(({ runtimeModel }) => runtimeModel.catalog.engineMotorId), 'runtime motor IDs')
  unique(contracts.map(({ runtimeModel }) => runtimeModel.profile.machineContractId), 'runtime machine contract IDs')
  unique(contracts.map(({ runtimeModel }) => runtimeModel.profile.topologyIdentity), 'runtime topology identities')
  unique(contracts.map(({ runtimeModel }) => runtimeModel.catalogOrder), 'runtime catalog order values')
  if (contracts.some(({ runtimeModel }) => !Number.isInteger(runtimeModel.catalogOrder) || runtimeModel.catalogOrder < 0)) {
    throw new Error('runtime catalog order values must be non-negative integers')
  }
}

function machineProjection(contract) {
  const runtime = contract.runtimeModel
  const patent = contract.contractId === PATENT_CONTRACT_ID
  return {
    machineContractId: runtime.profile.machineContractId,
    machineRevision: MACHINE_REVISION,
    modelRevision: MODEL_REVISION,
    engineMotorId: runtime.catalog.engineMotorId,
    label: patent ? 'US3890548A illustrative patent topology' : `${runtime.catalog.label} illustrative surrogate scenario`,
    claimStatus: patent ? 'patent-described-illustrative-model' : 'source-described-prototype',
    evidenceAvailability: patent ? 'patent-and-model-inputs' : 'descriptive-only',
    topologyIdentity: runtime.profile.topologyIdentity,
    compatibleTurns: runtime.profile.compatibleTurns,
    compatibleExcitation: runtime.profile.compatibleExcitation,
    modelInputHash: runtime.profile.modelInputHash,
    femStatus: patent ? 'not-run' : 'blocked',
    femBlocker: patent
      ? 'No complete checkpoint-attested FEM lookup is bundled with the browser application.'
      : 'No prototype-specific geometry, winding, excitation, or solver model is available.',
    runtimeClassification: runtime.sourceClassification,
  }
}

export function buildGrayMachineArtifact(contracts, schemaSource) {
  const sorted = [...contracts].sort((left, right) => left.contractId.localeCompare(right.contractId))
  const sourceHashes = Object.fromEntries(sorted.map((contract) => [
    `fem/edwin-gray/machines/v1/${contract.contractId}.json`,
    sha256(canonicalJson(contract)),
  ]))
  sourceHashes['fem/edwin-gray/schema/motor-machine.schema.json'] = sha256(canonicalJson(schemaSource))
  const runtimeModels = sorted.map(({ contractId, runtimeModel }) => ({ contractId, runtimeModel }))
  const sourceHash = sha256(canonicalJson({ sourceHashes, runtimeModels }))
  const revisions = {
    compiler: GRAY_COMPILER_REVISION,
    api: GRAY_API_REVISION,
    machine: MACHINE_REVISION,
    model: MODEL_REVISION,
    method: GRAY_METHOD_REVISION,
    event: GRAY_EVENT_REVISION,
    workbenchInput: 1,
    workbenchSource: 'US3890548A-and-Motor-Edwin-Gray-transcript-v1',
    workbenchImplementation: 'closed-form-event-map-v1',
    workbenchModel: 'gray-full-motor-v1',
  }
  const modelKey = sha256(canonicalJson({ revisions, sourceHash, runtimeModels }))
  const patent = sorted.find(({ contractId }) => contractId === PATENT_CONTRACT_ID)
  if (!patent) throw new Error(`Missing ${PATENT_CONTRACT_ID}`)
  const ordered = [...sorted].sort((left, right) => left.runtimeModel.catalogOrder - right.runtimeModel.catalogOrder)
  const prototypes = ordered.filter(({ machineKind }) => machineKind === 'engine-prototype')
  if (ordered.at(-1) !== patent) throw new Error('Patent illustrative runtime must be the final catalog entry')
  const motors = Object.fromEntries(ordered.map(({ runtimeModel }) => {
    const { engineMotorId, ...catalog } = runtimeModel.catalog
    return [engineMotorId, { id: engineMotorId, ...catalog }]
  }))
  const presets = Object.fromEntries(ordered.map(({ runtimeModel }) => [runtimeModel.catalog.engineMotorId, {
    motorId: runtimeModel.catalog.engineMotorId,
    ...runtimeModel.defaults,
  }]))
  const engineProfiles = Object.fromEntries(ordered.map(({ runtimeModel }) => [runtimeModel.profile.machineContractId, {
    contractId: runtimeModel.profile.machineContractId,
    motorId: runtimeModel.catalog.engineMotorId,
    machineRevision: MACHINE_REVISION,
    modelRevision: MODEL_REVISION,
    scenarioKind: runtimeModel.profile.scenarioKind,
    compatibleTurns: runtimeModel.profile.compatibleTurns,
    compatibleExcitation: runtimeModel.profile.compatibleExcitation,
    topologyIdentity: runtimeModel.profile.topologyIdentity,
    modelInputHash: runtimeModel.profile.modelInputHash,
    femCompatible: runtimeModel.profile.femCompatible,
  }]))
  const machineContracts = Object.fromEntries(ordered.map((contract) => {
    const projection = machineProjection(contract)
    return [projection.machineContractId, projection]
  }))
  return {
    metadata: {
      sourceHash,
      sourceHashes,
      modelKey,
      revisions,
      compatibilityKeys: {
        generatedModel: modelKey,
        machineProfiles: sha256(canonicalJson(engineProfiles)),
        workbenchSnapshots: modelKey,
      },
      provenance: {
        source: 'Seven versioned FEM machine contracts',
        generated: true,
        deterministic: true,
        prototypeScope: 'descriptive identity with illustrative surrogate parameters; not FEM-calibrated',
        patentScope: 'patent-described illustrative runtime; not a prototype replica or FEM result',
      },
    },
    prototypeMotorIds: prototypes.map(({ runtimeModel }) => runtimeModel.catalog.engineMotorId),
    motorIds: ordered.map(({ runtimeModel }) => runtimeModel.catalog.engineMotorId),
    machineIds: ordered.map(({ runtimeModel }) => runtimeModel.profile.machineContractId),
    patentMachineId: patent.runtimeModel.profile.machineContractId,
    patentModelInputHash: patent.runtimeModel.profile.modelInputHash,
    motors,
    presets,
    engineProfiles,
    machineContracts,
  }
}

export function renderGrayMachineModule(artifact) {
  return `// Generated by scripts/compile-gray-machines.mjs. Do not edit.\n`
    + `export const GRAY_MACHINE_ARTIFACT = ${JSON.stringify(artifact, null, 2)} as const\n`
}

export async function compileGrayMachines({ root, check = false } = {}) {
  const repositoryRoot = root ?? resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const machineRoot = join(repositoryRoot, 'fem/edwin-gray/machines/v1')
  const schemaPath = join(repositoryRoot, 'fem/edwin-gray/schema/motor-machine.schema.json')
  const outputPath = join(repositoryRoot, 'src/edwin-gray/generated/grayMachines.generated.ts')
  const filenames = (await readdir(machineRoot)).filter((name) => name.endsWith('.json')).sort()
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'))
  const contracts = await Promise.all(filenames.map(async (filename) => JSON.parse(await readFile(join(machineRoot, filename), 'utf8'))))
  validateMachineContracts(contracts, schema)
  for (let index = 0; index < filenames.length; index += 1) {
    if (filenames[index] !== `${contracts[index].contractId}.json`) throw new Error(`${filenames[index]} does not match contract ID ${contracts[index].contractId}`)
  }
  const artifact = buildGrayMachineArtifact(contracts, schema)
  const output = renderGrayMachineModule(artifact)
  if (Buffer.byteLength(output) >= 64 * 1024) throw new Error(`Generated artifact is ${Buffer.byteLength(output)} bytes; limit is below 65536 bytes`)
  let current = null
  try {
    current = await readFile(outputPath, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (check) {
    if (current !== output) throw new Error(`${relative(repositoryRoot, outputPath)} is stale; run node scripts/compile-gray-machines.mjs`)
    return { artifact, outputPath, bytes: Buffer.byteLength(output), changed: false }
  }
  if (current === output) return { artifact, outputPath, bytes: Buffer.byteLength(output), changed: false }
  await mkdir(dirname(outputPath), { recursive: true })
  const temporaryPath = `${outputPath}.${process.pid}.tmp`
  try {
    await writeFile(temporaryPath, output, { encoding: 'utf8', flag: 'wx' })
    await rename(temporaryPath, outputPath)
  } finally {
    await rm(temporaryPath, { force: true })
  }
  return { artifact, outputPath, bytes: Buffer.byteLength(output), changed: true }
}
