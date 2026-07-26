import type { EarthDocumentRecord } from './corpus'
import {
  EARTH_PROGRAM_DEFINITIONS,
  getDefaultEarthMethodId,
  isEarthSimulationId,
  listEarthMethods,
} from '../engine/earth'

export type SimulationMethodValue = string | string[]
export type SimulationMethod = string | string[] | Record<string, SimulationMethodValue>
export type ExecutionTier = string | number

export interface SimulationSourceState {
  text: string
  status: string
}

interface SimulationExecutionMethodBase {
  id: string
  title: string
  relationship: string
  modelOrigin: string
  runtime: string
  earthDerived: boolean
  validatesEarthTheory: false
}

export interface RunnableSimulationExecutionMethod extends SimulationExecutionMethodBase {
  runnable: true
}

export interface UnavailableSimulationExecutionMethod extends SimulationExecutionMethodBase {
  runtime: 'unavailable'
  runnable: false
  precision: null
  model: string
}

export type SimulationExecutionMethod = RunnableSimulationExecutionMethod | UnavailableSimulationExecutionMethod

export interface ScientificSimulationRecord {
  id: string
  title: string
  prefix: string
  classification: string
  classificationSource: string | null
  executionTier: ExecutionTier
  executionTiers: string[]
  tierSource: string | null
  inferredTypeMetadata: boolean
  executionMode: string
  runnable: boolean
  scientificStatus: string
  defaultMethodId: string
  executionMethods: SimulationExecutionMethod[]
  highLevelGoal: string
  minorGoals: string[]
  method: SimulationMethod
  outputs: string[]
  sourceState: SimulationSourceState
  currentState: string
  sourceDocumentIds: string[]
  dependencies: string[]
  gateStates: Record<string, string>
  blockers: string[]
}

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export interface ScientificSimulationRegistry {
  records: ScientificSimulationRecord[]
  summary: Record<string, JsonValue>
}

export interface ScientificSimulationBundle {
  registry: ScientificSimulationRegistry
  sourceDocuments: Map<string, EarthDocumentRecord>
  sourceRevision: string | null
  completionGeneratedAt: string
}

const RECORD_KEYS = [
  'id',
  'title',
  'prefix',
  'classification',
  'executionTier',
  'executionMode',
  'highLevelGoal',
  'minorGoals',
  'method',
  'outputs',
  'currentState',
  'sourceDocumentIds',
  'dependencies',
  'gateStates',
  'blockers',
] as const

const GENERATED_RECORD_KEYS = [
  'id',
  'prefix',
  'goal',
  'highLevelGoal',
  'minorGoals',
  'classification',
  'classificationSource',
  'executionTiers',
  'tierSource',
  'inferredTypeMetadata',
  'methodInput',
  'outputAcceptance',
  'sourceState',
  'execution',
  'runnable',
  'scientificStatus',
  'defaultMethodId',
  'executionMethods',
  'sourceDocumentIds',
  'dependencyIds',
  'gateStates',
  'blockers',
] as const

const GENERATED_CLASSIFICATIONS = new Set([
  'exact-calculator', 'numerical-simulation', 'dataset-audit', 'audit-only', 'exploratory', 'blocked-model',
])
const GENERATED_EXECUTION_MODES = new Set(['calculator', 'browser-worker', 'blocked'])
const GENERATED_SCIENTIFIC_STATUSES = new Set(['unresolved', 'exploratory', 'blocked-source', 'blocked'])
const GENERATED_GATE_STATES = new Set(['pass', 'partial', 'pending', 'blocked', 'not-applicable', 'not-evaluated'])

interface SourcePlanIntegrity {
  path: string
  revision: string
  sha256: string
}

interface GeneratedRegistryIntegrity {
  sourceRevision: string
  sourcePlan: SourcePlanIntegrity
  gateIds: string[]
  summary: {
    sourceRows: number
    registered: number
    prefixes: number
    sourceLinked: number
    runnable: number
    blocked: number
    totalMethods: number
    runnableMethods: number
  }
}

interface RegistryParseResult {
  registry: ScientificSimulationRegistry
  generated: GeneratedRegistryIntegrity | null
}

interface SourceDocumentParseResult {
  documents: Map<string, EarthDocumentRecord>
  sourceRevision: string | null
}

function fail(path: string, message: string): never {
  throw new Error(`Scientific simulation registry integrity error at ${path}: ${message}`)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (!isObject(value)) fail(path, 'expected an object')
  return value
}

function exactKeys(object: Record<string, unknown>, expected: readonly string[], path: string): void {
  const keys = Object.keys(object).sort()
  const expectedKeys = [...expected].sort()
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    fail(path, `expected exactly these fields: ${expected.join(', ')}`)
  }
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(path, 'expected a non-empty string')
  return value
}

function stringList(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) fail(path, 'expected an array')
  return value.map((item, index) => nonEmptyString(item, `${path}[${index}]`))
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(path, 'expected a non-negative integer')
  }
  return value
}

function booleanAt(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'expected a boolean')
  return value
}

function nullableString(value: unknown, path: string): string | null {
  return value === null ? null : nonEmptyString(value, path)
}

function methodValue(value: unknown, path: string): SimulationMethodValue {
  if (typeof value === 'string') return nonEmptyString(value, path)
  return stringList(value, path)
}

function methodAt(value: unknown, path: string): SimulationMethod {
  if (typeof value === 'string' || Array.isArray(value)) return methodValue(value, path)
  const object = objectAt(value, path)
  const entries = Object.entries(object)
  if (entries.length === 0) fail(path, 'expected at least one method section')
  return Object.fromEntries(entries.map(([key, item]) => [
    nonEmptyString(key, `${path} key`),
    methodValue(item, `${path}.${key}`),
  ]))
}

function stringMap(value: unknown, path: string): Record<string, string> {
  const object = objectAt(value, path)
  return Object.fromEntries(Object.entries(object).map(([key, item]) => [
    nonEmptyString(key, `${path} key`),
    nonEmptyString(item, `${path}.${key}`),
  ]))
}

function executionMethodAt(value: unknown, path: string): SimulationExecutionMethod {
  const object = objectAt(value, path)
  const runnable = booleanAt(object.runnable, `${path}.runnable`)
  const commonKeys = [
    'id', 'title', 'relationship', 'modelOrigin', 'runtime', 'runnable', 'earthDerived', 'validatesEarthTheory',
  ]
  exactKeys(object, runnable ? commonKeys : [...commonKeys, 'precision', 'model'], path)
  if (object.validatesEarthTheory !== false) fail(`${path}.validatesEarthTheory`, 'must remain false')
  const method = {
    id:                   nonEmptyString(object.id, `${path}.id`),
    title:                nonEmptyString(object.title, `${path}.title`),
    relationship:         nonEmptyString(object.relationship, `${path}.relationship`),
    modelOrigin:          nonEmptyString(object.modelOrigin, `${path}.modelOrigin`),
    runtime:              nonEmptyString(object.runtime, `${path}.runtime`),
    earthDerived:         booleanAt(object.earthDerived, `${path}.earthDerived`),
    validatesEarthTheory: false,
  }
  if (runnable) return { ...method, runnable: true }
  if (method.id !== 'earth-source-model-v1') fail(`${path}.id`, 'unavailable methods must use earth-source-model-v1')
  if (method.relationship !== 'earth-source-model') fail(`${path}.relationship`, 'unavailable methods must represent the EARTH source model')
  if (method.modelOrigin !== 'earth-corpus') fail(`${path}.modelOrigin`, 'unavailable source methods must originate in the EARTH corpus')
  if (method.runtime !== 'unavailable') fail(`${path}.runtime`, 'non-runnable methods must have unavailable runtime')
  if (!method.earthDerived) fail(`${path}.earthDerived`, 'unavailable source methods must remain EARTH-derived')
  if (object.precision !== null) fail(`${path}.precision`, 'unavailable methods must have null precision')
  return {
    ...method,
    runtime: 'unavailable',
    runnable: false,
    precision: null,
    model: nonEmptyString(object.model, `${path}.model`),
  }
}

function executionMethodsAt(value: unknown, path: string): SimulationExecutionMethod[] {
  if (!Array.isArray(value) || value.length === 0) fail(path, 'expected at least one execution method')
  const methods = value.map((method, index) => executionMethodAt(method, `${path}[${index}]`))
  if (new Set(methods.map(({ id }) => id)).size !== methods.length) fail(path, 'contains duplicate method IDs')
  return methods
}

function jsonValue(value: unknown, path: string): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(path, 'expected a finite JSON number')
    return value
  }
  if (Array.isArray(value)) return value.map((item, index) => jsonValue(item, `${path}[${index}]`))
  const object = objectAt(value, path)
  return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, jsonValue(item, `${path}.${key}`)]))
}

function tierAt(value: unknown, path: string): ExecutionTier {
  if (typeof value === 'string') return nonEmptyString(value, path)
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value
  return fail(path, 'expected a non-empty string or non-negative integer')
}

function recordAt(value: unknown, index: number): ScientificSimulationRecord {
  const path = `records[${index}]`
  const object = objectAt(value, path)
  exactKeys(object, RECORD_KEYS, path)

  const executionMode = nonEmptyString(object.executionMode, `${path}.executionMode`)
  const executionTier = tierAt(object.executionTier, `${path}.executionTier`)
  const currentState = nonEmptyString(object.currentState, `${path}.currentState`)
  const runnable = executionMode !== 'blocked'
  const defaultMethodId = 'legacy-requested-method'
  return {
    id:                nonEmptyString(object.id, `${path}.id`),
    title:             nonEmptyString(object.title, `${path}.title`),
    prefix:            nonEmptyString(object.prefix, `${path}.prefix`),
    classification:    nonEmptyString(object.classification, `${path}.classification`),
    classificationSource: null,
    executionTier,
    executionTiers:    [String(executionTier)],
    tierSource:         null,
    inferredTypeMetadata: true,
    executionMode,
    runnable,
    scientificStatus:  runnable ? 'unresolved' : 'blocked',
    defaultMethodId,
    executionMethods:  runnable ? [{
      id: defaultMethodId,
      title: 'Legacy requested execution method',
      relationship: 'source-contract-validator',
      modelOrigin: 'engine-audit',
      runtime: 'browser-worker',
      runnable: true,
      earthDerived: false,
      validatesEarthTheory: false,
    }] : [{
      id: 'earth-source-model-v1',
      title: 'EARTH source formulation (unavailable)',
      relationship: 'earth-source-model',
      modelOrigin: 'earth-corpus',
      runtime: 'unavailable',
      runnable: false,
      earthDerived: true,
      validatesEarthTheory: false,
      precision: null,
      model: `The governing EARTH source contract is incomplete: ${currentState}`,
    }],
    highLevelGoal:     nonEmptyString(object.highLevelGoal, `${path}.highLevelGoal`),
    minorGoals:        stringList(object.minorGoals, `${path}.minorGoals`),
    method:            methodAt(object.method, `${path}.method`),
    outputs:           stringList(object.outputs, `${path}.outputs`),
    sourceState:       { text: currentState, status: currentState },
    currentState,
    sourceDocumentIds: stringList(object.sourceDocumentIds, `${path}.sourceDocumentIds`),
    dependencies:      stringList(object.dependencies, `${path}.dependencies`),
    gateStates:        stringMap(object.gateStates, `${path}.gateStates`),
    blockers:          stringList(object.blockers, `${path}.blockers`),
  }
}

function sourcePlanAt(value: unknown, path: string): SourcePlanIntegrity {
  const object = objectAt(value, path)
  exactKeys(object, ['path', 'revision', 'sha256'], path)
  const sha256 = nonEmptyString(object.sha256, `${path}.sha256`)
  if (!/^[a-f0-9]{64}$/.test(sha256)) fail(`${path}.sha256`, 'expected a lowercase SHA256 digest')
  return {
    path:     nonEmptyString(object.path, `${path}.path`),
    revision: nonEmptyString(object.revision, `${path}.revision`),
    sha256,
  }
}

function validateRecords(records: ScientificSimulationRecord[]): void {
  const ids = new Set<string>()
  records.forEach((record, index) => {
    if (ids.has(record.id)) fail(`records[${index}].id`, `duplicate id ${record.id}`)
    ids.add(record.id)
    if (new Set(record.sourceDocumentIds).size !== record.sourceDocumentIds.length) {
      fail(`records[${index}].sourceDocumentIds`, 'contains duplicate document IDs')
    }
  })
}

function requestedRegistryAt(object: Record<string, unknown>): RegistryParseResult {
  exactKeys(object, ['records', 'summary'], 'registry')
  if (!Array.isArray(object.records)) fail('records', 'expected an array')
  if (object.records.length !== 130) fail('records', `expected 130 records, received ${object.records.length}`)

  const records = object.records.map(recordAt)
  validateRecords(records)

  const rawSummary = objectAt(object.summary, 'summary')
  const summary = Object.fromEntries(Object.entries(rawSummary).map(([key, item]) => [
    key,
    jsonValue(item, `summary.${key}`),
  ]))
  return { registry: { records, summary }, generated: null }
}

function generatedRecordAt(value: unknown, index: number, gateIds: string[]): ScientificSimulationRecord {
  const path = `items[${index}]`
  const object = objectAt(value, path)
  exactKeys(object, GENERATED_RECORD_KEYS, path)
  const classificationSource = nullableString(object.classificationSource, `${path}.classificationSource`)
  const tierSource = nullableString(object.tierSource, `${path}.tierSource`)
  const inferredTypeMetadata = booleanAt(object.inferredTypeMetadata, `${path}.inferredTypeMetadata`)
  if (inferredTypeMetadata !== (classificationSource === null && tierSource === null)) {
    fail(`${path}.inferredTypeMetadata`, 'does not agree with classification and tier source fields')
  }
  const classification = nonEmptyString(object.classification, `${path}.classification`)
  if (!GENERATED_CLASSIFICATIONS.has(classification)) fail(`${path}.classification`, 'is not a generated classification')
  const runnable = booleanAt(object.runnable, `${path}.runnable`)
  const scientificStatus = nonEmptyString(object.scientificStatus, `${path}.scientificStatus`)
  if (!GENERATED_SCIENTIFIC_STATUSES.has(scientificStatus)) fail(`${path}.scientificStatus`, 'is not a generated scientific status')
  const executionTiers = stringList(object.executionTiers, `${path}.executionTiers`)
  if (executionTiers.length === 0) fail(`${path}.executionTiers`, 'expected at least one tier')
  if (executionTiers.some((tier) => !/^(?:T[0-3]|BX)$/.test(tier))) fail(`${path}.executionTiers`, 'contains an invalid tier')
  const rawSourceState = objectAt(object.sourceState, `${path}.sourceState`)
  exactKeys(rawSourceState, ['text', 'status'], `${path}.sourceState`)
  const sourceState = {
    text: nonEmptyString(rawSourceState.text, `${path}.sourceState.text`),
    status: nonEmptyString(rawSourceState.status, `${path}.sourceState.status`),
  }
  if (!['ready', 'blocked'].includes(sourceState.status)) fail(`${path}.sourceState.status`, 'expected ready or blocked')
  const gateStates = stringMap(object.gateStates, `${path}.gateStates`)
  exactKeys(gateStates, gateIds, `${path}.gateStates`)
  if (Object.values(gateStates).some((state) => !GENERATED_GATE_STATES.has(state))) fail(`${path}.gateStates`, 'contains an invalid gate state')
  const id = nonEmptyString(object.id, `${path}.id`)
  const prefix = nonEmptyString(object.prefix, `${path}.prefix`)
  const executionMode = nonEmptyString(object.execution, `${path}.execution`)
  if (!GENERATED_EXECUTION_MODES.has(executionMode)) fail(`${path}.execution`, 'is not a generated execution mode')
  const blockers = stringList(object.blockers, `${path}.blockers`)
  const blocked = executionMode === 'blocked'
  const defaultMethodId = nonEmptyString(object.defaultMethodId, `${path}.defaultMethodId`)
  const executionMethods = executionMethodsAt(object.executionMethods, `${path}.executionMethods`)
  if (!id.startsWith(`EARTH-${prefix}-`)) fail(`${path}.prefix`, 'does not match the record ID')
  if (runnable === blocked) fail(`${path}.runnable`, 'does not agree with execution mode')
  if (blocked && scientificStatus !== 'blocked') fail(`${path}.scientificStatus`, 'blocked execution must have blocked scientific status')
  if (blocked && blockers.length === 0) fail(`${path}.blockers`, 'blocked execution must include an execution blocker')
  if (sourceState.status === 'blocked' && !blockers.includes(sourceState.text)) {
    fail(`${path}.blockers`, 'must preserve the blocked source state text')
  }
  if (classification === 'dataset-audit' && !['pending', 'blocked'].includes(gateStates.G0b)) {
    fail(`${path}.gateStates.G0b`, 'dataset audits must remain pending or blocked')
  }
  if (!executionMethods.some(({ id: methodId, runnable: methodRunnable }) => methodId === defaultMethodId && methodRunnable)) {
    fail(`${path}.defaultMethodId`, 'must identify a runnable execution method')
  }
  if (!isEarthSimulationId(id) || !EARTH_PROGRAM_DEFINITIONS[id]) fail(`${path}.id`, 'is not supported by the EARTH engine')
  if (defaultMethodId !== getDefaultEarthMethodId(id)) fail(`${path}.defaultMethodId`, 'does not match the EARTH engine default')
  const engineMethods = listEarthMethods(id)
  const runnableMethods = executionMethods.filter((method): method is RunnableSimulationExecutionMethod => method.runnable)
  if (runnableMethods.length !== engineMethods.length) fail(`${path}.executionMethods`, 'runnable methods do not match the EARTH engine method count')
  engineMethods.forEach((engineMethod, methodIndex) => {
    const generatedMethod = runnableMethods[methodIndex]
    const expected = {
      id:                   engineMethod.id,
      title:                engineMethod.title,
      relationship:         engineMethod.relationship,
      modelOrigin:          engineMethod.modelOrigin,
      runtime:              engineMethod.runtime,
      runnable:             engineMethod.runtime !== 'unavailable',
      earthDerived:         engineMethod.earthDerived,
      validatesEarthTheory: engineMethod.validatesEarthTheory,
    }
    if (Object.entries(expected).some(([key, value]) => generatedMethod[key as keyof typeof generatedMethod] !== value)) {
      fail(`${path}.executionMethods`, `runnable method ${engineMethod.id} does not match the EARTH engine method definition`)
    }
  })
  for (const [methodIndex, method] of executionMethods.entries()) {
    if (!method.runnable && !method.model.includes(sourceState.text)) {
      fail(`${path}.executionMethods[${methodIndex}].model`, 'must preserve the source blocker text')
    }
  }
  const unavailableMethods = executionMethods.filter(({ runnable: methodRunnable }) => !methodRunnable)
  const hasRunnableSourceReproduction = executionMethods.some((method) => (
    method.runnable && method.relationship === 'earth-source-reproduction'
  ))
  if (unavailableMethods.length > 1) fail(`${path}.executionMethods`, 'must not contain duplicate unavailable source methods')
  if (unavailableMethods.length > 0 && scientificStatus !== 'blocked-source') {
    fail(`${path}.executionMethods`, 'unavailable source methods require blocked-source scientific status')
  }
  if (scientificStatus === 'blocked-source' && !hasRunnableSourceReproduction && unavailableMethods.length !== 1) {
    fail(`${path}.executionMethods`, 'blocked-source programs require one unavailable source method when no source reproduction is runnable')
  }
  if (executionMethods.every(({ earthDerived }) => !earthDerived) && (gateStates.G2 === 'pass' || gateStates.G3 === 'pass')) {
    fail(`${path}.gateStates`, 'independent methods cannot pass source-model closure or verification')
  }

  return {
    id,
    title:                  nonEmptyString(object.goal, `${path}.goal`),
    prefix,
    classification,
    classificationSource,
    executionTier:          executionTiers.join('/'),
    executionTiers,
    tierSource,
    inferredTypeMetadata,
    executionMode,
    runnable,
    scientificStatus,
    defaultMethodId,
    executionMethods,
    highLevelGoal:          nonEmptyString(object.highLevelGoal, `${path}.highLevelGoal`),
    minorGoals:             stringList(object.minorGoals, `${path}.minorGoals`),
    method:                 { method: nonEmptyString(object.methodInput, `${path}.methodInput`) },
    outputs:                [nonEmptyString(object.outputAcceptance, `${path}.outputAcceptance`)],
    sourceState,
    currentState:           sourceState.status,
    sourceDocumentIds:      stringList(object.sourceDocumentIds, `${path}.sourceDocumentIds`),
    dependencies:           stringList(object.dependencyIds, `${path}.dependencyIds`),
    gateStates,
    blockers,
  }
}

function generatedRegistryAt(object: Record<string, unknown>): RegistryParseResult {
  exactKeys(object, ['schemaVersion', 'sourceRevision', 'sourcePlan', 'gateIds', 'summary', 'items'], 'registry')
  if (object.schemaVersion !== 2) fail('registry.schemaVersion', 'expected schema version 2')
  const sourceRevision = nonEmptyString(object.sourceRevision, 'registry.sourceRevision')
  const sourcePlan = sourcePlanAt(object.sourcePlan, 'registry.sourcePlan')
  const gateIds = stringList(object.gateIds, 'registry.gateIds')
  if (gateIds.length === 0 || new Set(gateIds).size !== gateIds.length) fail('registry.gateIds', 'expected unique gate IDs')
  if (!Array.isArray(object.items)) fail('registry.items', 'expected an array')
  if (object.items.length !== 130) fail('registry.items', `expected 130 records, received ${object.items.length}`)

  const rawSummary = objectAt(object.summary, 'registry.summary')
  exactKeys(rawSummary, [
    'sourceRows', 'registered', 'prefixes', 'sourceLinked', 'runnable', 'blocked', 'totalMethods', 'runnableMethods',
  ], 'registry.summary')
  const summary = {
    sourceRows:      nonNegativeInteger(rawSummary.sourceRows, 'registry.summary.sourceRows'),
    registered:      nonNegativeInteger(rawSummary.registered, 'registry.summary.registered'),
    prefixes:        nonNegativeInteger(rawSummary.prefixes, 'registry.summary.prefixes'),
    sourceLinked:    nonNegativeInteger(rawSummary.sourceLinked, 'registry.summary.sourceLinked'),
    runnable:        nonNegativeInteger(rawSummary.runnable, 'registry.summary.runnable'),
    blocked:         nonNegativeInteger(rawSummary.blocked, 'registry.summary.blocked'),
    totalMethods:    nonNegativeInteger(rawSummary.totalMethods, 'registry.summary.totalMethods'),
    runnableMethods: nonNegativeInteger(rawSummary.runnableMethods, 'registry.summary.runnableMethods'),
  }
  if (summary.sourceRows !== 130 || summary.registered !== 130 || summary.sourceLinked !== 130) {
    fail('registry.summary', 'expected exact 130-record source, registration, and source-link coverage')
  }
  if (summary.runnable + summary.blocked !== 130) fail('registry.summary', 'runnable and blocked counts must total 130')
  if (summary.runnableMethods !== 134) fail('registry.summary.runnableMethods', 'expected exactly 134 runnable methods')

  const records = object.items.map((item, index) => generatedRecordAt(item, index, gateIds))
  validateRecords(records)
  if (new Set(records.map((record) => record.prefix)).size !== summary.prefixes) {
    fail('registry.summary.prefixes', 'does not match record prefixes')
  }
  if (records.filter((record) => record.sourceDocumentIds.length > 0).length !== summary.sourceLinked) {
    fail('registry.summary.sourceLinked', 'does not match linked records')
  }
  if (records.filter((record) => record.executionMode === 'blocked').length !== summary.blocked) {
    fail('registry.summary.blocked', 'does not match blocked records')
  }
  if (records.filter((record) => record.executionMode !== 'blocked').length !== summary.runnable) {
    fail('registry.summary.runnable', 'does not match runnable records')
  }
  if (records.reduce((total, record) => total + record.executionMethods.length, 0) !== summary.totalMethods) {
    fail('registry.summary.totalMethods', 'does not match record methods')
  }
  if (records.reduce((total, record) => total + record.executionMethods.filter(({ runnable }) => runnable).length, 0) !== summary.runnableMethods) {
    fail('registry.summary.runnableMethods', 'does not match runnable record methods')
  }
  return {
    registry: { records, summary },
    generated: { sourceRevision, sourcePlan, gateIds, summary },
  }
}

function registryAt(value: unknown): RegistryParseResult {
  const object = objectAt(value, 'registry')
  return Object.hasOwn(object, 'records') ? requestedRegistryAt(object) : generatedRegistryAt(object)
}

function sourceDocumentsAt(value: unknown): SourceDocumentParseResult {
  const object = objectAt(value, 'EARTH manifest')
  if (!Array.isArray(object.documents)) fail('EARTH manifest.documents', 'expected an array')
  const documents = new Map<string, EarthDocumentRecord>()

  object.documents.forEach((item, index) => {
    const document = objectAt(item, `EARTH manifest.documents[${index}]`)
    const id = nonEmptyString(document.id, `EARTH manifest.documents[${index}].id`)
    nonEmptyString(document.slug, `EARTH manifest.documents[${index}].slug`)
    nonEmptyString(document.title, `EARTH manifest.documents[${index}].title`)
    if (documents.has(id)) fail(`EARTH manifest.documents[${index}].id`, `duplicate id ${id}`)
    documents.set(id, item as EarthDocumentRecord)
  })
  const sourceRevision = object.sourceRevision === undefined
    ? null
    : nonEmptyString(object.sourceRevision, 'EARTH manifest.sourceRevision')
  return { documents, sourceRevision }
}

function completionAt(value: unknown, generated: GeneratedRegistryIntegrity | null): string {
  const object = objectAt(value, 'completion')
  if (object.complete !== true) fail('completion.complete', 'expected a successful completion audit')
  if (!generated) {
    if (!Array.isArray(object.errors) || object.errors.length !== 0) fail('completion.errors', 'expected an empty array')
    if (!Array.isArray(object.unresolved) || object.unresolved.length !== 0) fail('completion.unresolved', 'expected an empty array')
    return nonEmptyString(object.generatedAt, 'completion.generatedAt')
  }

  exactKeys(object, [
    'schemaVersion', 'sourceRevision', 'sourcePlan', 'source', 'registered', 'sourceLinked', 'implemented', 'runnable',
    'blocked', 'methods', 'runnableMethods', 'prefixes', 'structuralCoverageExact', 'executableCoverageExact',
    'scientificallyValidated', 'complete',
  ], 'completion')
  if (object.schemaVersion !== 2) fail('completion.schemaVersion', 'expected schema version 2')
  if (object.sourceRevision !== generated.sourceRevision) fail('completion.sourceRevision', 'does not match registry')
  const sourcePlan = sourcePlanAt(object.sourcePlan, 'completion.sourcePlan')
  if (JSON.stringify(sourcePlan) !== JSON.stringify(generated.sourcePlan)) fail('completion.sourcePlan', 'does not match registry')
  const summaryPairs = [
    ['source', 'sourceRows'],
    ['registered', 'registered'],
    ['sourceLinked', 'sourceLinked'],
    ['runnable', 'runnable'],
    ['blocked', 'blocked'],
    ['methods', 'totalMethods'],
    ['runnableMethods', 'runnableMethods'],
    ['prefixes', 'prefixes'],
  ] as const
  summaryPairs.forEach(([completionKey, summaryKey]) => {
    if (nonNegativeInteger(object[completionKey], `completion.${completionKey}`) !== generated.summary[summaryKey]) {
      fail(`completion.${completionKey}`, 'does not match registry summary')
    }
  })
  if (nonNegativeInteger(object.implemented, 'completion.implemented') !== generated.summary.runnable) {
    fail('completion.implemented', 'must match the exact runnable registry count')
  }
  if (object.structuralCoverageExact !== true) fail('completion.structuralCoverageExact', 'expected exact coverage')
  if (object.executableCoverageExact !== true) fail('completion.executableCoverageExact', 'expected exact executable coverage')
  if (object.scientificallyValidated !== false) fail('completion.scientificallyValidated', 'must remain false')
  return sourcePlan.revision
}

function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}

async function readJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(dataUrl(path), { signal })
  if (!response.ok) throw new Error(`Scientific simulation registry failed to load (${response.status})`)
  return response.json() as Promise<unknown>
}

export function isSimulationBlocked(record: ScientificSimulationRecord): boolean {
  return record.executionMode === 'blocked'
}

export function hasSimulationRunControl(record: ScientificSimulationRecord): boolean {
  return !isSimulationBlocked(record)
    && (record.executionMode === 'calculator' || record.executionMode === 'browser-worker')
}

export async function loadScientificSimulationBundle(signal?: AbortSignal): Promise<ScientificSimulationBundle> {
  const [registryJson, manifestJson, completionJson] = await Promise.all([
    readJson('/data/generated/earth/scientific-simulations.json', signal),
    readJson('/data/generated/earth/manifest.json', signal),
    readJson('/data/generated/earth/completion.json', signal),
  ])
  const parsedRegistry = registryAt(registryJson)
  const registry = parsedRegistry.registry
  const parsedSources = sourceDocumentsAt(manifestJson)
  const sourceDocuments = parsedSources.documents
  if (parsedRegistry.generated && parsedSources.sourceRevision !== parsedRegistry.generated.sourceRevision) {
    fail('EARTH manifest.sourceRevision', 'does not match registry')
  }
  const completionGeneratedAt = completionAt(completionJson, parsedRegistry.generated)

  registry.records.forEach((record, recordIndex) => {
    record.sourceDocumentIds.forEach((id, sourceIndex) => {
      if (!sourceDocuments.has(id)) {
        fail(`records[${recordIndex}].sourceDocumentIds[${sourceIndex}]`, `unknown EARTH document ${id}`)
      }
    })
  })

  return { registry, sourceDocuments, sourceRevision: parsedSources.sourceRevision, completionGeneratedAt }
}
