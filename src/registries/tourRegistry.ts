import { readonly, shallowRef } from 'vue'
import type { TaxonomyArtifact } from '../types/engine'
import type {
  TourGeneratedChapterRecord,
  TourGeneratedLessonRecord,
  TourGeneratedManifest,
  TourGeneratedSimulation,
  TourClaimVocabularySource,
  TourGlossarySource,
  TourReferencesSource,
} from '../types/tour'
import { matchTourOfflineResponse, parseTourOfflineManifest } from '../tour/offlinePack'
import { publishRuntimeAudit, clearRuntimeAuditDomain } from './runtimeAudit'
import { parseTaxonomyArtifact, setTaxonomyRegistryForTests, useTaxonomyRegistry } from './taxonomyRegistry'

interface PendingLoad<T> {
  controller: AbortController
  promise: Promise<T>
}

interface TourRegistryFixture {
  manifest: TourGeneratedManifest
  taxonomy: TaxonomyArtifact
  chapters?: TourGeneratedChapterRecord[]
  lessons?: TourGeneratedLessonRecord[]
  simulations?: TourGeneratedSimulation[]
  glossary?: TourGlossarySource
  references?: TourReferencesSource
}

const manifest = shallowRef<TourGeneratedManifest | null>(null)
const ready = shallowRef(false)
const error = shallowRef<Error | null>(null)
const chapters = new Map<string, TourGeneratedChapterRecord>()
const lessons = new Map<string, TourGeneratedLessonRecord>()
const simulations = new Map<string, TourGeneratedSimulation>()
const pendingChapters = new Map<string, PendingLoad<TourGeneratedChapterRecord>>()
const pendingLessons = new Map<string, PendingLoad<TourGeneratedLessonRecord>>()
const pendingSimulations = new Map<string, PendingLoad<TourGeneratedSimulation>>()
let glossary: TourGlossarySource | null = null
let references: TourReferencesSource | null = null
let pendingGlossary: PendingLoad<TourGlossarySource> | null = null
let pendingReferences: PendingLoad<TourReferencesSource> | null = null
let initialization: Promise<void> | null = null
let controller: AbortController | null = null
let generation = 0
const taxonomyRegistry = useTaxonomyRegistry()

const ATTRIBUTION_KEYS = ['claimClass', 'evidenceRefs', 'sourceRevision', 'sourceLocator', 'methodRelationship', 'modelOrigin', 'resultStatus', 'validatesTheory', 'caveats'] as const
const CLAIM_CLASS_IDS = ['established-definition', 'established-model', 'observed-value', 'source-claim', 'identity', 'assumption', 'calibration', 'exploratory-hypothesis', 'prediction'] as const
const METHOD_RELATIONSHIP_IDS = ['not-applicable', 'literal-reproduction', 'traditional-baseline', 'contract-validator'] as const
const MODEL_ORIGIN_IDS = ['established-physics', 'source-reproduction', 'traditional-baseline'] as const
const RESULT_STATUS_IDS = ['not-evaluated', 'computed', 'compared', 'failure', 'blocked-source-model', 'unresolved'] as const
const CONCLUSION_SCOPE_IDS = ['activity', 'computation', 'source', 'empirical-evidence', 'scientific-conclusion'] as const
const CONCLUSION_FIELDS = ['seenInActivity', 'computedHere', 'reproducedFromSource', 'comparedWithEvidence', 'establishes', 'doesNotEstablish'] as const
const VALIDATION_PROTOCOL_KEYS = ['id', 'hypothesis', 'calibratedInputIds', 'heldOutObservableIds', 'datasetRefs', 'comparisonMethod', 'uncertaintyTreatment', 'acceptanceCriteria', 'failureHandling'] as const
const CLAIM_CLASSES = new Set(CLAIM_CLASS_IDS)
const METHOD_RELATIONSHIPS = new Set(METHOD_RELATIONSHIP_IDS)
const MODEL_ORIGINS = new Set(MODEL_ORIGIN_IDS)
const LESSON_BLOCK_KINDS = new Set(['prose', 'definition', 'list', 'caveat', 'derivation'])
const CHECKPOINT_KINDS = new Set(['prediction', 'classification', 'explanation'])
const OBSERVATION_ITEM_ROLES = new Set(['fixed-definition', 'practical-realization'])
const INPUT_ROLES = new Set(['parameter', 'preset-selection', 'coordinate-selection', 'display-option', 'target-quantity', 'canonical-quantity-value', 'fixed-constant', 'calibrated-input', 'nuisance-parameter', 'held-out-observable'])
const OUTPUT_TYPES = new Set(['operation-status', 'rational-dimension-vector', 'boolean', 'string', 'number'])
const DIMENSION_AXES = ['time', 'length', 'mass', 'electric-current', 'thermodynamic-temperature', 'amount-of-substance', 'luminous-intensity']
const NUMERICAL_METHOD_KINDS = new Set(['exact-symbolic', 'direct-evaluation', 'iterative', 'optimization', 'sampling', 'integration', 'interpolation', 'other'])
const DATASET_STATES = new Set(['not-applicable', 'not-loaded', 'loaded', 'precomputed-artifact', 'unavailable'])
const DATASET_PURPOSES = new Set(['calibration', 'comparison', 'held-out-evaluation', 'visualization'])
const REFERENCE_CLASSIFICATIONS = new Set(['primary-standard', 'reference-data', 'textbook', 'source-corpus', 'internal-policy'])
const ACCESS_STATUSES = new Set(['verified-accessible', 'partially-accessible', 'blocked', 'not-checked'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(path: string, message: string): never {
  throw new TypeError(`${path} ${message}`)
}

function requireRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) fail(path, 'must be an object')
}

function requireExactKeys(value: unknown, required: readonly string[], optional: readonly string[], path: string): asserts value is Record<string, unknown> {
  requireRecord(value, path)
  const allowed = new Set([...required, ...optional])
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  const missing = required.filter((key) => !Object.hasOwn(value, key))
  if (unknown.length) fail(path, `has unknown properties: ${unknown.join(', ')}`)
  if (missing.length) fail(path, `is missing properties: ${missing.join(', ')}`)
}

function requireNonEmptyString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'must be a non-empty string')
}

function requireSafeId(value: unknown, path: string): asserts value is string {
  requireNonEmptyString(value, path)
  if (!isSafeId(value)) fail(path, 'must be a safe ID')
}

function requireStringArray(value: unknown, path: string, nonEmpty = false): asserts value is string[] {
  if (!Array.isArray(value)) fail(path, 'must be an array')
  if (nonEmpty && value.length === 0) fail(path, 'must not be empty')
  value.forEach((entry, index) => requireNonEmptyString(entry, `${path}[${index}]`))
}

function requireIdArray(value: unknown, path: string, nonEmpty = false): asserts value is string[] {
  if (!Array.isArray(value)) fail(path, 'must be an array')
  if (nonEmpty && value.length === 0) fail(path, 'must not be empty')
  value.forEach((entry, index) => requireSafeId(entry, `${path}[${index}]`))
}

function requireUnique(values: readonly string[], path: string): void {
  if (!hasUniqueValues(values)) fail(path, 'must contain unique values')
}

function requireFiniteNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
}

function requirePositiveInteger(value: unknown, path: string): asserts value is number {
  if (!positiveInteger(value)) fail(path, 'must be a positive integer')
}

function validateAttributionFields(value: Record<string, unknown>, path: string): void {
  if (!CLAIM_CLASSES.has(value.claimClass as string)) fail(`${path}.claimClass`, 'is not recognized')
  requireStringArray(value.evidenceRefs, `${path}.evidenceRefs`, true)
  value.evidenceRefs.forEach((reference, index) => requireSafeId(reference, `${path}.evidenceRefs[${index}]`))
  requireNonEmptyString(value.sourceRevision, `${path}.sourceRevision`)
  requireNonEmptyString(value.sourceLocator, `${path}.sourceLocator`)
  if (!METHOD_RELATIONSHIPS.has(value.methodRelationship as string)) fail(`${path}.methodRelationship`, 'is not recognized')
  if (!MODEL_ORIGINS.has(value.modelOrigin as string)) fail(`${path}.modelOrigin`, 'is not recognized')
  if (value.resultStatus !== 'not-evaluated') fail(`${path}.resultStatus`, 'must be not-evaluated')
  if (value.validatesTheory !== false) fail(`${path}.validatesTheory`, 'must be false')
  requireStringArray(value.caveats, `${path}.caveats`)
}

function validateAttribution(value: unknown, path: string): void {
  requireExactKeys(value, ATTRIBUTION_KEYS, [], path)
  validateAttributionFields(value, path)
}

function validateOptionalAttribution(value: Record<string, unknown>, path: string): void {
  if (value.attribution !== undefined) validateAttribution(value.attribution, `${path}.attribution`)
}

function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value)
}

function isNullableSafeId(value: unknown): value is string | null {
  return value === null || isSafeId(value)
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function orderedChapters(value: TourGeneratedManifest): TourGeneratedChapterRecord[] {
  return [...value.chapters].sort((left, right) => left.order - right.order)
}

function orderedLessonIds(value: TourGeneratedManifest): string[] {
  return orderedChapters(value).flatMap((chapter) => chapter.lessonIds)
}

function lessonOwners(value: TourGeneratedManifest): Map<string, string> {
  return new Map(value.chapters.flatMap((chapter) => chapter.lessonIds.map((lessonId) => [lessonId, chapter.id] as const)))
}

function simulationOwners(value: TourGeneratedManifest, loadedLessons = lessons): Map<string, string> {
  const owners = new Map<string, string>()
  for (const station of value.quickStations) {
    if (station.status === 'content-ready' && station.simulationId && station.lessonId) owners.set(station.simulationId, station.lessonId)
  }
  for (const lesson of loadedLessons.values()) {
    if (lesson.simulationId) owners.set(lesson.simulationId, lesson.id)
  }
  return owners
}

export function parseTourManifest(value: unknown): TourGeneratedManifest {
  return parseTourOfflineManifest(value)
}

function validateChapter(value: unknown, path: string): asserts value is Record<string, unknown> {
  requireExactKeys(value, ['schemaVersion', 'id', 'order', 'act', 'title', 'question', 'summary', 'status', 'quickStationIds', 'lessonIds', 'attribution', 'previousChapterId', 'nextChapterId'], [], path)
  if (value.schemaVersion !== 1) fail(`${path}.schemaVersion`, 'must be 1')
  requireSafeId(value.id, `${path}.id`)
  if (!nonNegativeInteger(value.order)) fail(`${path}.order`, 'must be a non-negative integer')
  if (![1, 2, 3, 4].includes(value.act as number)) fail(`${path}.act`, 'must be an integer from 1 through 4')
  for (const field of ['title', 'question', 'summary']) requireNonEmptyString(value[field], `${path}.${field}`)
  if (value.status !== 'content-ready' && value.status !== 'planned') fail(`${path}.status`, 'is not recognized')
  requireIdArray(value.quickStationIds, `${path}.quickStationIds`)
  requireIdArray(value.lessonIds, `${path}.lessonIds`)
  requireUnique(value.quickStationIds, `${path}.quickStationIds`)
  requireUnique(value.lessonIds, `${path}.lessonIds`)
  validateAttribution(value.attribution, `${path}.attribution`)
  if (!isNullableSafeId(value.previousChapterId)) fail(`${path}.previousChapterId`, 'must be null or a safe ID')
  if (!isNullableSafeId(value.nextChapterId)) fail(`${path}.nextChapterId`, 'must be null or a safe ID')
}

function validateObservationStage(value: unknown, path: string): void {
  requireExactKeys(value, ['title', 'question', 'items', 'conclusion', 'attribution'], [], path)
  requireNonEmptyString(value.title, `${path}.title`)
  requireNonEmptyString(value.question, `${path}.question`)
  requireNonEmptyString(value.conclusion, `${path}.conclusion`)
  validateAttribution(value.attribution, `${path}.attribution`)
  if (!Array.isArray(value.items) || value.items.length === 0) fail(`${path}.items`, 'must be a non-empty array')
  const ids: string[] = []
  value.items.forEach((item, index) => {
    const itemPath = `${path}.items[${index}]`
    requireExactKeys(item, ['id', 'label', 'value', 'unit', 'role', 'explanation', 'evidenceRefs'], ['attribution'], itemPath)
    requireSafeId(item.id, `${itemPath}.id`)
    ids.push(item.id)
    requireNonEmptyString(item.label, `${itemPath}.label`)
    requireFiniteNumber(item.value, `${itemPath}.value`)
    requireNonEmptyString(item.unit, `${itemPath}.unit`)
    if (!OBSERVATION_ITEM_ROLES.has(item.role as string)) fail(`${itemPath}.role`, 'is not recognized')
    requireNonEmptyString(item.explanation, `${itemPath}.explanation`)
    requireIdArray(item.evidenceRefs, `${itemPath}.evidenceRefs`, true)
    validateOptionalAttribution(item, itemPath)
  })
  requireUnique(ids, `${path} item IDs`)
}

function validateLessonBlock(value: unknown, path: string): void {
  requireExactKeys(value, ['id', 'kind', 'title', 'body', 'glossaryIds', ...ATTRIBUTION_KEYS], [], path)
  requireSafeId(value.id, `${path}.id`)
  if (!LESSON_BLOCK_KINDS.has(value.kind as string)) fail(`${path}.kind`, 'is not recognized')
  requireNonEmptyString(value.title, `${path}.title`)
  requireStringArray(value.body, `${path}.body`, true)
  requireIdArray(value.glossaryIds, `${path}.glossaryIds`)
  requireUnique(value.glossaryIds, `${path}.glossaryIds`)
  validateAttributionFields(value, path)
}

function validateEquationStep(value: unknown, path: string): void {
  requireExactKeys(value, ['id', 'label', 'expression', 'explanation', ...ATTRIBUTION_KEYS], [], path)
  requireSafeId(value.id, `${path}.id`)
  for (const field of ['label', 'expression', 'explanation']) requireNonEmptyString(value[field], `${path}.${field}`)
  validateAttributionFields(value, path)
}

function validateCheckpoint(value: unknown, path: string): void {
  requireExactKeys(value, ['id', 'kind', 'prompt', 'choices', 'answerId', 'explanation', 'attribution'], [], path)
  requireSafeId(value.id, `${path}.id`)
  if (!CHECKPOINT_KINDS.has(value.kind as string)) fail(`${path}.kind`, 'is not recognized')
  requireNonEmptyString(value.prompt, `${path}.prompt`)
  if (!Array.isArray(value.choices) || value.choices.length < 2) fail(`${path}.choices`, 'must contain at least two choices')
  const choiceIds: string[] = []
  value.choices.forEach((choice, index) => {
    const choicePath = `${path}.choices[${index}]`
    requireExactKeys(choice, ['id', 'label'], [], choicePath)
    requireSafeId(choice.id, `${choicePath}.id`)
    requireNonEmptyString(choice.label, `${choicePath}.label`)
    choiceIds.push(choice.id)
  })
  requireUnique(choiceIds, `${path} choice IDs`)
  requireSafeId(value.answerId, `${path}.answerId`)
  if (!choiceIds.includes(value.answerId)) fail(`${path}.answerId`, 'does not resolve to a choice')
  requireNonEmptyString(value.explanation, `${path}.explanation`)
  validateAttribution(value.attribution, `${path}.attribution`)
}

function validateConclusionStatements(value: unknown, scope: string, path: string): void {
  if (!Array.isArray(value) || value.length === 0) fail(path, 'must be a non-empty array')
  value.forEach((statement, index) => {
    const statementPath = `${path}[${index}]`
    requireExactKeys(statement, ['text', 'scope', 'attribution'], [], statementPath)
    requireNonEmptyString(statement.text, `${statementPath}.text`)
    if (statement.scope !== scope) fail(`${statementPath}.scope`, `must be ${scope}`)
    validateAttribution(statement.attribution, `${statementPath}.attribution`)
  })
}

function validateQuickPath(value: unknown, lesson: Record<string, unknown>, path: string): void {
  requireExactKeys(value, ['estimatedMinutes', 'guidedBlockIds', 'equationStepIds', 'checkpointIds', 'simulationPresetId'], [], path)
  requirePositiveInteger(value.estimatedMinutes, `${path}.estimatedMinutes`)
  if (value.estimatedMinutes > Number(lesson.estimatedMinutes)) fail(`${path}.estimatedMinutes`, 'must not exceed lesson estimatedMinutes')
  requireIdArray(value.guidedBlockIds, `${path}.guidedBlockIds`, true)
  requireIdArray(value.equationStepIds, `${path}.equationStepIds`, true)
  requireIdArray(value.checkpointIds, `${path}.checkpointIds`, true)
  requireSafeId(value.simulationPresetId, `${path}.simulationPresetId`)
  for (const field of ['guidedBlockIds', 'equationStepIds', 'checkpointIds'] as const) requireUnique(value[field], `${path}.${field}`)
  const guidedIds = new Set((lesson.guidedBlocks as Array<Record<string, unknown>>).map(({ id }) => id))
  const equationIds = new Set((lesson.equationSteps as Array<Record<string, unknown>>).map(({ id }) => id))
  const checkpointIds = new Set((lesson.checkpoints as Array<Record<string, unknown>>).map(({ id }) => id))
  value.guidedBlockIds.forEach((id) => { if (!guidedIds.has(id)) fail(`${path}.guidedBlockIds`, `contains unknown Guided block ${id}`) })
  value.equationStepIds.forEach((id) => { if (!equationIds.has(id)) fail(`${path}.equationStepIds`, `contains unknown equation step ${id}`) })
  value.checkpointIds.forEach((id) => { if (!checkpointIds.has(id)) fail(`${path}.checkpointIds`, `contains unknown checkpoint ${id}`) })
}

function validateLesson(value: unknown, path: string): asserts value is Record<string, unknown> {
  const required = ['schemaVersion', 'id', 'chapterId', 'order', 'title', 'question', 'answerPreview', 'summary', 'attribution', 'estimatedMinutes', 'depthComposition', 'prerequisites', 'observationStage', 'guidedBlocks', 'technicalBlocks', 'equationSteps', 'simulationId', 'formulaIds', 'programIds', 'glossaryIds', 'evidenceRefs', 'checkpoints', 'seenInActivity', 'computedHere', 'reproducedFromSource', 'comparedWithEvidence', 'establishes', 'doesNotEstablish', 'previousLessonId', 'nextLessonId']
  requireExactKeys(value, required, ['quickPath'], path)
  if (value.schemaVersion !== 1) fail(`${path}.schemaVersion`, 'must be 1')
  requireSafeId(value.id, `${path}.id`)
  requireSafeId(value.chapterId, `${path}.chapterId`)
  requirePositiveInteger(value.order, `${path}.order`)
  for (const field of ['title', 'question', 'answerPreview', 'summary']) requireNonEmptyString(value[field], `${path}.${field}`)
  validateAttribution(value.attribution, `${path}.attribution`)
  requirePositiveInteger(value.estimatedMinutes, `${path}.estimatedMinutes`)
  if (value.depthComposition !== 'technical-includes-guided') fail(`${path}.depthComposition`, 'must be technical-includes-guided')
  requireIdArray(value.prerequisites, `${path}.prerequisites`)
  requireUnique(value.prerequisites, `${path}.prerequisites`)
  validateObservationStage(value.observationStage, `${path}.observationStage`)
  for (const field of ['guidedBlocks', 'technicalBlocks'] as const) {
    if (!Array.isArray(value[field]) || value[field].length === 0) fail(`${path}.${field}`, 'must be a non-empty array')
    value[field].forEach((block, index) => validateLessonBlock(block, `${path}.${field}[${index}]`))
  }
  const blockIds = [...value.guidedBlocks, ...value.technicalBlocks].map((block) => (block as Record<string, unknown>).id as string)
  requireUnique(blockIds, `${path} block IDs`)
  if (!Array.isArray(value.equationSteps) || value.equationSteps.length === 0) fail(`${path}.equationSteps`, 'must be a non-empty array')
  value.equationSteps.forEach((step, index) => validateEquationStep(step, `${path}.equationSteps[${index}]`))
  requireUnique(value.equationSteps.map((step) => (step as Record<string, unknown>).id as string), `${path} equation step IDs`)
  if (!isNullableSafeId(value.simulationId)) fail(`${path}.simulationId`, 'must be null or a safe ID')
  requireStringArray(value.formulaIds, `${path}.formulaIds`)
  requireStringArray(value.programIds, `${path}.programIds`)
  requireIdArray(value.glossaryIds, `${path}.glossaryIds`, true)
  requireIdArray(value.evidenceRefs, `${path}.evidenceRefs`, true)
  for (const field of ['formulaIds', 'programIds', 'glossaryIds', 'evidenceRefs'] as const) requireUnique(value[field], `${path}.${field}`)
  const lessonGlossaryIds = new Set(value.glossaryIds)
  for (const field of ['guidedBlocks', 'technicalBlocks'] as const) {
    (value[field] as Array<Record<string, unknown>>).forEach((block, index) => {
      for (const glossaryId of block.glossaryIds as string[]) {
        if (!lessonGlossaryIds.has(glossaryId)) fail(`${path}.${field}[${index}].glossaryIds`, `references ${glossaryId}, which is absent from lesson.glossaryIds`)
      }
    })
  }
  if (!Array.isArray(value.checkpoints) || value.checkpoints.length === 0) fail(`${path}.checkpoints`, 'must be a non-empty array')
  value.checkpoints.forEach((checkpoint, index) => validateCheckpoint(checkpoint, `${path}.checkpoints[${index}]`))
  requireUnique(value.checkpoints.map((checkpoint) => (checkpoint as Record<string, unknown>).id as string), `${path} checkpoint IDs`)
  const scopes = {
    seenInActivity: 'activity',
    computedHere: 'computation',
    reproducedFromSource: 'source',
    comparedWithEvidence: 'empirical-evidence',
    establishes: 'scientific-conclusion',
    doesNotEstablish: 'scientific-conclusion',
  } as const
  for (const [field, scope] of Object.entries(scopes)) validateConclusionStatements(value[field], scope, `${path}.${field}`)
  if (!isNullableSafeId(value.previousLessonId)) fail(`${path}.previousLessonId`, 'must be null or a safe ID')
  if (!isNullableSafeId(value.nextLessonId)) fail(`${path}.nextLessonId`, 'must be null or a safe ID')
  if (value.quickPath !== undefined) {
    if (value.simulationId === null) fail(`${path}.quickPath`, 'requires a linked simulation')
    validateQuickPath(value.quickPath, value, `${path}.quickPath`)
  }
}

function validateControlValue(control: Record<string, unknown>, value: unknown, path: string): void {
  if (control.type === 'range' || control.type === 'number') {
    requireFiniteNumber(value, path)
    if (value < Number(control.min) || value > Number(control.max)) fail(path, `must be within [${String(control.min)}, ${String(control.max)}]`)
    const steps = (value - Number(control.min)) / Number(control.step)
    if (Math.abs(steps - Math.round(steps)) > 1e-9 * Math.max(1, Math.abs(steps))) fail(path, `must align with step ${String(control.step)}`)
  } else if (control.type === 'select') {
    const options = control.options as Array<Record<string, unknown>>
    if (typeof value !== 'string' || !options.some((option) => option.value === value)) fail(path, 'must match a select option')
  } else if (typeof value !== 'boolean') {
    fail(path, 'must be boolean')
  }
}

function validateControl(value: unknown, path: string): asserts value is Record<string, unknown> {
  requireRecord(value, path)
  const variant = value.type === 'select' ? ['options'] : (value.type === 'range' || value.type === 'number' ? ['unit', 'min', 'max', 'step'] : [])
  requireExactKeys(value, ['id', 'label', 'type', 'inputRole', 'readingDepth', 'description', 'default', ...variant], ['playfulPrompt', 'attribution'], path)
  requireSafeId(value.id, `${path}.id`)
  requireNonEmptyString(value.label, `${path}.label`)
  if (!['select', 'range', 'number', 'toggle'].includes(value.type as string)) fail(`${path}.type`, 'is not recognized')
  if (!INPUT_ROLES.has(value.inputRole as string)) fail(`${path}.inputRole`, 'is not recognized')
  if (value.readingDepth !== 'guided' && value.readingDepth !== 'technical') fail(`${path}.readingDepth`, 'is not recognized')
  requireNonEmptyString(value.description, `${path}.description`)
  if (value.playfulPrompt !== undefined) requireNonEmptyString(value.playfulPrompt, `${path}.playfulPrompt`)
  validateOptionalAttribution(value, path)
  if (value.type === 'select') {
    if (!Array.isArray(value.options) || value.options.length === 0) fail(`${path}.options`, 'must be a non-empty array')
    const optionValues: string[] = []
    value.options.forEach((option, index) => {
      const optionPath = `${path}.options[${index}]`
      requireExactKeys(option, ['value', 'label'], ['description'], optionPath)
      requireNonEmptyString(option.value, `${optionPath}.value`)
      requireNonEmptyString(option.label, `${optionPath}.label`)
      if (option.description !== undefined) requireNonEmptyString(option.description, `${optionPath}.description`)
      optionValues.push(option.value)
    })
    requireUnique(optionValues, `${path} option values`)
  } else if (value.type === 'range' || value.type === 'number') {
    requireNonEmptyString(value.unit, `${path}.unit`)
    for (const field of ['min', 'max', 'step']) requireFiniteNumber(value[field], `${path}.${field}`)
    if (value.min >= value.max) fail(`${path}.min`, 'must be less than max')
    if (value.step <= 0 || value.step > value.max - value.min) fail(`${path}.step`, 'must be positive and no greater than the control span')
  }
  validateControlValue(value, value.default, `${path}.default`)
}

function validateDimensionBasis(value: unknown, path: string): void {
  requireExactKeys(value, ['system', 'axes', 'exponentType', 'activityExponentSubset'], [], path)
  if (value.system !== 'ISQ') fail(`${path}.system`, 'must be ISQ')
  if (!Array.isArray(value.axes) || value.axes.length !== DIMENSION_AXES.length) fail(`${path}.axes`, 'must contain the seven ISQ axes')
  value.axes.forEach((axis, index) => {
    const axisPath = `${path}.axes[${index}]`
    requireExactKeys(axis, ['id', 'symbol'], [], axisPath)
    if (axis.id !== DIMENSION_AXES[index]) fail(`${axisPath}.id`, `must be ${DIMENSION_AXES[index]}`)
    requireNonEmptyString(axis.symbol, `${axisPath}.symbol`)
  })
  if (value.exponentType !== 'rational') fail(`${path}.exponentType`, 'must be rational')
  if (value.activityExponentSubset !== 'integer') fail(`${path}.activityExponentSubset`, 'must be integer')
}

function validateNumericalMethod(value: unknown, path: string): void {
  requireExactKeys(value, ['kind', 'name', 'description', 'deterministic'], ['implementationRef', 'tolerance', 'maxIterations'], path)
  if (!NUMERICAL_METHOD_KINDS.has(value.kind as string)) fail(`${path}.kind`, 'is not recognized')
  requireNonEmptyString(value.name, `${path}.name`)
  requireNonEmptyString(value.description, `${path}.description`)
  if (typeof value.deterministic !== 'boolean') fail(`${path}.deterministic`, 'must be boolean')
  if (value.implementationRef !== undefined) requireNonEmptyString(value.implementationRef, `${path}.implementationRef`)
  if (value.tolerance !== undefined) {
    requireFiniteNumber(value.tolerance, `${path}.tolerance`)
    if (value.tolerance <= 0) fail(`${path}.tolerance`, 'must be positive')
  }
  if (value.maxIterations !== undefined) requirePositiveInteger(value.maxIterations, `${path}.maxIterations`)
}

function validateDatasetState(value: unknown, path: string): void {
  requireExactKeys(value, ['state', 'datasetRefs', 'purposes'], ['revision', 'selection'], path)
  if (!DATASET_STATES.has(value.state as string)) fail(`${path}.state`, 'is not recognized')
  requireIdArray(value.datasetRefs, `${path}.datasetRefs`)
  requireStringArray(value.purposes, `${path}.purposes`)
  requireUnique(value.purposes, `${path}.purposes`)
  value.purposes.forEach((purpose) => { if (!DATASET_PURPOSES.has(purpose)) fail(`${path}.purposes`, `contains unrecognized purpose ${purpose}`) })
  if (value.revision !== undefined) requireNonEmptyString(value.revision, `${path}.revision`)
  if (value.selection !== undefined) requireNonEmptyString(value.selection, `${path}.selection`)
  if (value.state === 'not-applicable' && (value.datasetRefs.length || value.purposes.length)) fail(path, 'not-applicable state requires empty datasetRefs and purposes')
}

function validateModelComponents(value: unknown, path: string): void {
  if (!Array.isArray(value) || value.length === 0) fail(path, 'must be a non-empty array')
  const ids: string[] = []
  value.forEach((component, index) => {
    const componentPath = `${path}[${index}]`
    requireExactKeys(component, ['id', 'label', 'modelOrigin', 'description', 'attribution'], [], componentPath)
    requireSafeId(component.id, `${componentPath}.id`)
    ids.push(component.id)
    requireNonEmptyString(component.label, `${componentPath}.label`)
    if (!MODEL_ORIGINS.has(component.modelOrigin as string)) fail(`${componentPath}.modelOrigin`, 'is not recognized')
    requireNonEmptyString(component.description, `${componentPath}.description`)
    validateAttribution(component.attribution, `${componentPath}.attribution`)
    if ((component.attribution as Record<string, unknown>).modelOrigin !== component.modelOrigin) fail(`${componentPath}.attribution.modelOrigin`, 'must match modelOrigin')
  })
  requireUnique(ids, `${path} IDs`)
}

function validateOutputSchema(value: unknown, path: string): void {
  if (!Array.isArray(value) || value.length === 0) fail(path, 'must be a non-empty array')
  const ids: string[] = []
  value.forEach((field, index) => {
    const fieldPath = `${path}[${index}]`
    requireExactKeys(field, ['id', 'label', 'type', 'unit', 'nullable', 'description'], ['attribution'], fieldPath)
    requireSafeId(field.id, `${fieldPath}.id`)
    ids.push(field.id)
    requireNonEmptyString(field.label, `${fieldPath}.label`)
    if (!OUTPUT_TYPES.has(field.type as string)) fail(`${fieldPath}.type`, 'is not recognized')
    if (field.unit !== null) requireNonEmptyString(field.unit, `${fieldPath}.unit`)
    if (typeof field.nullable !== 'boolean') fail(`${fieldPath}.nullable`, 'must be boolean')
    requireNonEmptyString(field.description, `${fieldPath}.description`)
    validateOptionalAttribution(field, fieldPath)
  })
  requireUnique(ids, `${path} IDs`)
}

function validateComparison(value: unknown, path: string): void {
  requireExactKeys(value, ['compatibility', 'incompatibleBehavior', 'compatibilityKey'], ['attribution'], path)
  if (value.compatibility !== 'same-simulation-revision-and-output-schema') fail(`${path}.compatibility`, 'is not recognized')
  requireNonEmptyString(value.incompatibleBehavior, `${path}.incompatibleBehavior`)
  if (typeof value.compatibilityKey !== 'string' || !/^[a-f0-9]{64}$/.test(value.compatibilityKey)) fail(`${path}.compatibilityKey`, 'must be a SHA-256 hex digest')
  validateOptionalAttribution(value, path)
}

function validateVisualization(value: unknown, path: string): void {
  requireExactKeys(value, ['kind', 'description', 'alternatives', 'reducedMotionBehavior'], ['attribution'], path)
  requireNonEmptyString(value.kind, `${path}.kind`)
  requireNonEmptyString(value.description, `${path}.description`)
  requireNonEmptyString(value.reducedMotionBehavior, `${path}.reducedMotionBehavior`)
  validateOptionalAttribution(value, path)
  if (!Array.isArray(value.alternatives) || value.alternatives.length !== 2) fail(`${path}.alternatives`, 'must contain text and table alternatives')
  value.alternatives.forEach((alternative, index) => {
    const alternativePath = `${path}.alternatives[${index}]`
    requireExactKeys(alternative, ['type', 'description'], ['attribution'], alternativePath)
    if (alternative.type !== (index === 0 ? 'text' : 'table')) fail(`${alternativePath}.type`, `must be ${index === 0 ? 'text' : 'table'}`)
    requireNonEmptyString(alternative.description, `${alternativePath}.description`)
    validateOptionalAttribution(alternative, alternativePath)
  })
}

function validateFinding(value: unknown, path: string): void {
  requireExactKeys(value, ['changed', 'cause', 'equation', 'assumptions', 'establishes', 'doesNotEstablish', ...ATTRIBUTION_KEYS], [], path)
  for (const field of ['changed', 'cause', 'equation', 'establishes', 'doesNotEstablish']) requireNonEmptyString(value[field], `${path}.${field}`)
  requireStringArray(value.assumptions, `${path}.assumptions`, true)
  validateAttributionFields(value, path)
}

function validateLimits(value: unknown, path: string): void {
  requireRecord(value, path)
  if (value.tier === 'immediate') {
    requireExactKeys(value, ['tier', 'maxOperations', 'maxDurationMs'], [], path)
    if (value.maxOperations !== 1) fail(`${path}.maxOperations`, 'must be 1 for immediate tier')
    requirePositiveInteger(value.maxDurationMs, `${path}.maxDurationMs`)
  } else if (value.tier === 'local-worker') {
    requireExactKeys(value, ['tier', 'maxOperations', 'maxDurationMs', 'maxIterations'], [], path)
    requirePositiveInteger(value.maxOperations, `${path}.maxOperations`)
    requirePositiveInteger(value.maxDurationMs, `${path}.maxDurationMs`)
    requirePositiveInteger(value.maxIterations, `${path}.maxIterations`)
  } else if (value.tier === 'artifact') {
    requireExactKeys(value, ['tier', 'maxArtifactBytes'], [], path)
    requirePositiveInteger(value.maxArtifactBytes, `${path}.maxArtifactBytes`)
  } else if (value.tier === 'unavailable') {
    requireExactKeys(value, ['tier', 'reason'], [], path)
    requireNonEmptyString(value.reason, `${path}.reason`)
  } else {
    fail(`${path}.tier`, 'is not recognized')
  }
}

function validateSimulation(value: unknown, path: string, ownerManifest: TourGeneratedManifest): asserts value is Record<string, unknown> {
  const required = ['schemaVersion', 'id', 'lessonId', 'title', 'question', 'predictionPrompt', ...ATTRIBUTION_KEYS, 'revision', 'modelComponents', 'equations', 'assumptions', 'glossaryIds', 'controls', 'presets', 'outputSchema', 'comparison', 'visualization', 'finding', 'limits']
  requireExactKeys(value, required, ['dimensionBasis', 'numericalMethod', 'datasetState'], path)
  if (value.schemaVersion !== 1) fail(`${path}.schemaVersion`, 'must be 1')
  requireSafeId(value.id, `${path}.id`)
  requireSafeId(value.lessonId, `${path}.lessonId`)
  for (const field of ['title', 'question', 'predictionPrompt']) requireNonEmptyString(value[field], `${path}.${field}`)
  validateAttributionFields(value, path)
  requireExactKeys(value.revision, ['contentRevision', 'modelRevision', 'implementationRevision'], [], `${path}.revision`)
  if (value.revision.contentRevision !== ownerManifest.contentRevision) fail(`${path}.revision.contentRevision`, 'must match manifest contentRevision')
  requireNonEmptyString(value.revision.modelRevision, `${path}.revision.modelRevision`)
  requireNonEmptyString(value.revision.implementationRevision, `${path}.revision.implementationRevision`)
  const currentDimensionContract = value.id === 'dimensional-equation-builder'
    && ownerManifest.quickStations.some((station) => station.status === 'content-ready' && station.simulationId === value.id)
  if (currentDimensionContract && value.revision.implementationRevision !== 'tour-dimension-engine-v1') {
    fail(`${path}.revision.implementationRevision`, 'must be tour-dimension-engine-v1 for the current dimension engine contract')
  }
  if (value.dimensionBasis !== undefined) validateDimensionBasis(value.dimensionBasis, `${path}.dimensionBasis`)
  if (value.numericalMethod !== undefined) validateNumericalMethod(value.numericalMethod, `${path}.numericalMethod`)
  if (value.datasetState !== undefined) validateDatasetState(value.datasetState, `${path}.datasetState`)
  validateModelComponents(value.modelComponents, `${path}.modelComponents`)
  requireStringArray(value.equations, `${path}.equations`, true)
  requireStringArray(value.assumptions, `${path}.assumptions`, true)
  requireIdArray(value.glossaryIds, `${path}.glossaryIds`, true)
  requireUnique(value.glossaryIds, `${path}.glossaryIds`)
  if (!Array.isArray(value.controls) || value.controls.length === 0) fail(`${path}.controls`, 'must be a non-empty array')
  value.controls.forEach((control, index) => validateControl(control, `${path}.controls[${index}]`))
  const controls = value.controls as Array<Record<string, unknown>>
  requireUnique(controls.map((control) => control.id as string), `${path} control IDs`)
  if (!Array.isArray(value.presets) || value.presets.length === 0) fail(`${path}.presets`, 'must be a non-empty array')
  const controlIds = controls.map((control) => control.id as string)
  const presetIds: string[] = []
  value.presets.forEach((preset, index) => {
    const presetPath = `${path}.presets[${index}]`
    requireExactKeys(preset, ['id', 'label', 'description', 'inspectionPrompt', 'inputs'], ['attribution'], presetPath)
    requireSafeId(preset.id, `${presetPath}.id`)
    presetIds.push(preset.id)
    for (const field of ['label', 'description', 'inspectionPrompt']) requireNonEmptyString(preset[field], `${presetPath}.${field}`)
    requireExactKeys(preset.inputs, controlIds, [], `${presetPath}.inputs`)
    controls.forEach((control) => validateControlValue(control, preset.inputs[control.id as string], `${presetPath}.inputs.${String(control.id)}`))
    validateOptionalAttribution(preset, presetPath)
  })
  requireUnique(presetIds, `${path} preset IDs`)
  validateOutputSchema(value.outputSchema, `${path}.outputSchema`)
  validateComparison(value.comparison, `${path}.comparison`)
  validateVisualization(value.visualization, `${path}.visualization`)
  validateFinding(value.finding, `${path}.finding`)
  validateLimits(value.limits, `${path}.limits`)
}

function parseChapter(value: unknown, id: string, ownerManifest: TourGeneratedManifest): TourGeneratedChapterRecord {
  const path = `Tour chapter ${id}`
  const expected = ownerManifest.chapters.find((chapter) => chapter.id === id)
  if (!expected) fail(path, 'is not declared by the manifest')
  validateChapter(value, path)
  if (value.id !== id) fail(`${path}.id`, `must match requested ID ${id}`)
  if (value.order !== expected.order
    || value.act !== expected.act
    || value.status !== expected.status
    || value.previousChapterId !== expected.previousChapterId
    || value.nextChapterId !== expected.nextChapterId
    || !sameValues(value.quickStationIds as string[], expected.quickStationIds)
    || !sameValues(value.lessonIds as string[], expected.lessonIds)) {
    fail(path, 'ownership or navigation does not match the manifest')
  }
  return value as unknown as TourGeneratedChapterRecord
}

function parseLesson(value: unknown, id: string, ownerManifest: TourGeneratedManifest, loadedLessons = lessons): TourGeneratedLessonRecord {
  const path = `Tour lesson ${id}`
  const owner = lessonOwners(ownerManifest).get(id)
  if (!owner) fail(path, 'is not declared by the manifest')
  validateLesson(value, path)
  if (value.id !== id) fail(`${path}.id`, `must match requested ID ${id}`)
  const lessonIds = orderedLessonIds(ownerManifest)
  const index = lessonIds.indexOf(id)
  const expectedOrder = ownerManifest.chapters.find((chapter) => chapter.id === owner)!.lessonIds.indexOf(id) + 1
  if (value.chapterId !== owner || value.order !== expectedOrder) fail(path, 'chapter ownership or order does not match the manifest')
  for (const prerequisite of value.prerequisites as string[]) {
    if (!lessonIds.includes(prerequisite) || prerequisite === id) fail(`${path}.prerequisites`, `contains invalid lesson ${prerequisite}`)
  }
  if (typeof value.simulationId === 'string') {
    const stationOwner = ownerManifest.quickStations.find((station) => station.status === 'content-ready' && station.simulationId === value.simulationId)?.lessonId
    const loadedOwner = [...loadedLessons.values()].find((lesson) => lesson.simulationId === value.simulationId)?.id
    if ((stationOwner && stationOwner !== id) || (loadedOwner && loadedOwner !== id)) fail(`${path}.simulationId`, 'ownership does not match existing declarations')
  }
  if (value.previousLessonId !== (lessonIds[index - 1] ?? null) || value.nextLessonId !== (lessonIds[index + 1] ?? null)) {
    fail(path, 'navigation does not match the manifest')
  }
  return value as unknown as TourGeneratedLessonRecord
}

function parseSimulation(value: unknown, id: string, ownerManifest: TourGeneratedManifest, loadedLessons = lessons): TourGeneratedSimulation {
  const path = `Tour simulation ${id}`
  const owner = simulationOwners(ownerManifest, loadedLessons).get(id)
  if (!owner) fail(path, 'is not declared by a content-ready station or loaded lesson')
  validateSimulation(value, path, ownerManifest)
  if (value.id !== id) fail(`${path}.id`, `must match requested ID ${id}`)
  if (value.lessonId !== owner) fail(`${path}.lessonId`, `must match owner ${owner}`)
  const ownerLesson = loadedLessons.get(owner)
  if (ownerLesson?.quickPath && !(value.presets as Array<Record<string, unknown>>).some((preset) => preset.id === ownerLesson.quickPath!.simulationPresetId)) {
    fail(`${path}.presets`, `does not contain lesson quick-path preset ${ownerLesson.quickPath.simulationPresetId}`)
  }
  return value as unknown as TourGeneratedSimulation
}

function parseGlossary(value: unknown, ownerManifest: TourGeneratedManifest): TourGlossarySource {
  const path = 'Tour glossary'
  requireExactKeys(value, ['schemaVersion', 'entries'], [], path)
  if (value.schemaVersion !== 1) fail(`${path}.schemaVersion`, 'must be 1')
  if (!Array.isArray(value.entries)) fail(`${path}.entries`, 'must be an array')
  const ids: string[] = []
  value.entries.forEach((entry, index) => {
    const entryPath = `${path}.entries[${index}]`
    requireExactKeys(entry, ['id', 'term', 'guidedDefinition', 'technicalDefinition', 'guided', 'evidenceRefs', 'attribution'], [], entryPath)
    requireSafeId(entry.id, `${entryPath}.id`)
    ids.push(entry.id)
    for (const field of ['term', 'guidedDefinition', 'technicalDefinition']) requireNonEmptyString(entry[field], `${entryPath}.${field}`)
    if (typeof entry.guided !== 'boolean') fail(`${entryPath}.guided`, 'must be boolean')
    requireIdArray(entry.evidenceRefs, `${entryPath}.evidenceRefs`, true)
    validateAttribution(entry.attribution, `${entryPath}.attribution`)
  })
  requireUnique(ids, `${path} IDs`)
  if (ids.length !== ownerManifest.counts.glossary) fail(path, 'coverage does not match the manifest')
  return value as unknown as TourGlossarySource
}

function parseReferences(value: unknown, ownerManifest: TourGeneratedManifest): TourReferencesSource {
  const path = 'Tour references'
  requireExactKeys(value, ['schemaVersion', 'policy', 'policyAttribution', 'entries'], [], path)
  if (value.schemaVersion !== 1) fail(`${path}.schemaVersion`, 'must be 1')
  requireNonEmptyString(value.policy, `${path}.policy`)
  if (!Array.isArray(value.entries)) fail(`${path}.entries`, 'must be an array')
  const ids: string[] = []
  value.entries.forEach((entry, index) => {
    const entryPath = `${path}.entries[${index}]`
    requireExactKeys(entry, ['id', 'title', 'sourceFamily', 'url', 'classification', 'responsibleOrganization', 'publicationYear', 'edition', 'revision', 'sourceLocator', 'accessedAt', 'accessStatus', 'scopeNote', 'supersededForCurrentSIDefinitions', 'licenseNote'], ['doi'], entryPath)
    requireSafeId(entry.id, `${entryPath}.id`)
    ids.push(entry.id)
    for (const field of ['title', 'sourceFamily', 'responsibleOrganization', 'edition', 'revision', 'sourceLocator', 'scopeNote', 'licenseNote']) requireNonEmptyString(entry[field], `${entryPath}.${field}`)
    requireNonEmptyString(entry.url, `${entryPath}.url`)
    try {
      if (new URL(entry.url).protocol !== 'https:') fail(`${entryPath}.url`, 'must use HTTPS')
    } catch (reason) {
      if (reason instanceof TypeError && reason.message.startsWith(entryPath)) throw reason
      fail(`${entryPath}.url`, 'must be a valid URL')
    }
    if (!REFERENCE_CLASSIFICATIONS.has(entry.classification as string)) fail(`${entryPath}.classification`, 'is not recognized')
    requirePositiveInteger(entry.publicationYear, `${entryPath}.publicationYear`)
    if (entry.publicationYear > 9999) fail(`${entryPath}.publicationYear`, 'must have four or fewer digits')
    if (entry.doi !== undefined) {
      requireNonEmptyString(entry.doi, `${entryPath}.doi`)
      if (!/^10\.\d{4,9}\/\S+$/.test(entry.doi)) fail(`${entryPath}.doi`, 'must be a DOI without a URL prefix')
    }
    requireNonEmptyString(entry.accessedAt, `${entryPath}.accessedAt`)
    const parsedDate = new Date(`${entry.accessedAt}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.accessedAt) || Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== entry.accessedAt) fail(`${entryPath}.accessedAt`, 'must be an ISO calendar date')
    if (!ACCESS_STATUSES.has(entry.accessStatus as string)) fail(`${entryPath}.accessStatus`, 'is not recognized')
    if (typeof entry.supersededForCurrentSIDefinitions !== 'boolean') fail(`${entryPath}.supersededForCurrentSIDefinitions`, 'must be boolean')
  })
  requireUnique(ids, `${path} IDs`)
  if (ids.length !== ownerManifest.counts.references) fail(path, 'coverage does not match the manifest')
  validateAttribution(value.policyAttribution, `${path}.policyAttribution`)
  return value as unknown as TourReferencesSource
}

function requireExactValues(value: unknown, expected: readonly string[], path: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length !== expected.length || !value.every((entry, index) => entry === expected[index])) {
    fail(path, `must equal [${expected.join(', ')}]`)
  }
}

function validateVocabularyAxis(value: unknown, expected: readonly string[], path: string): void {
  if (!Array.isArray(value)) fail(path, 'must be an array')
  requireExactValues(value.map((entry) => isRecord(entry) ? entry.id : undefined), expected, path)
  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`
    requireExactKeys(entry, ['id', 'definition', 'usageWarning', 'attribution'], [], entryPath)
    requireSafeId(entry.id, `${entryPath}.id`)
    requireNonEmptyString(entry.definition, `${entryPath}.definition`)
    requireNonEmptyString(entry.usageWarning, `${entryPath}.usageWarning`)
    validateAttribution(entry.attribution, `${entryPath}.attribution`)
  })
}

export function parseTourClaimVocabulary(value: unknown): TourClaimVocabularySource {
  const path = 'Tour claim vocabulary'
  requireExactKeys(value, ['schemaVersion', 'claimClasses', 'methodRelationships', 'modelOrigins', 'resultStatuses', 'conclusionScopes', 'validatesTheory', 'conclusionBoundary'], [], path)
  if (value.schemaVersion !== 1) fail(`${path}.schemaVersion`, 'must be 1')
  validateVocabularyAxis(value.claimClasses, CLAIM_CLASS_IDS, `${path}.claimClasses`)
  validateVocabularyAxis(value.methodRelationships, METHOD_RELATIONSHIP_IDS, `${path}.methodRelationships`)
  validateVocabularyAxis(value.modelOrigins, MODEL_ORIGIN_IDS, `${path}.modelOrigins`)
  validateVocabularyAxis(value.resultStatuses, RESULT_STATUS_IDS, `${path}.resultStatuses`)
  validateVocabularyAxis(value.conclusionScopes, CONCLUSION_SCOPE_IDS, `${path}.conclusionScopes`)

  requireExactKeys(value.validatesTheory, ['definition', 'usageWarning', 'trueRequires', 'attribution'], [], `${path}.validatesTheory`)
  requireNonEmptyString(value.validatesTheory.definition, `${path}.validatesTheory.definition`)
  requireNonEmptyString(value.validatesTheory.usageWarning, `${path}.validatesTheory.usageWarning`)
  requireExactValues(value.validatesTheory.trueRequires, VALIDATION_PROTOCOL_KEYS, `${path}.validatesTheory.trueRequires`)
  validateAttribution(value.validatesTheory.attribution, `${path}.validatesTheory.attribution`)

  requireExactKeys(value.conclusionBoundary, ['required', 'statementRequired', 'attributionRequired', 'scopeMapping', 'rule', 'attribution'], [], `${path}.conclusionBoundary`)
  requireExactValues(value.conclusionBoundary.required, CONCLUSION_FIELDS, `${path}.conclusionBoundary.required`)
  requireExactValues(value.conclusionBoundary.statementRequired, ['text', 'scope', 'attribution'], `${path}.conclusionBoundary.statementRequired`)
  requireExactValues(value.conclusionBoundary.attributionRequired, ATTRIBUTION_KEYS, `${path}.conclusionBoundary.attributionRequired`)
  requireExactKeys(value.conclusionBoundary.scopeMapping, CONCLUSION_FIELDS, [], `${path}.conclusionBoundary.scopeMapping`)
  const scopeMapping = {
    seenInActivity: 'activity',
    computedHere: 'computation',
    reproducedFromSource: 'source',
    comparedWithEvidence: 'empirical-evidence',
    establishes: 'scientific-conclusion',
    doesNotEstablish: 'scientific-conclusion',
  } as const
  for (const field of CONCLUSION_FIELDS) {
    if (value.conclusionBoundary.scopeMapping[field] !== scopeMapping[field]) fail(`${path}.conclusionBoundary.scopeMapping.${field}`, `must be ${scopeMapping[field]}`)
  }
  requireNonEmptyString(value.conclusionBoundary.rule, `${path}.conclusionBoundary.rule`)
  validateAttribution(value.conclusionBoundary.attribution, `${path}.conclusionBoundary.attribution`)
  return value as unknown as TourClaimVocabularySource
}

function resourceEndingWith(resources: ReadonlyMap<string, unknown>, suffix: string): unknown {
  const matches = [...resources].filter(([url]) => url.endsWith(suffix))
  if (matches.length !== 1) throw new TypeError(`Guided tour pack requires exactly one ${suffix} resource`)
  return matches[0]![1]
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  return JSON.stringify(value) ?? 'undefined'
}

export function validateTourOfflinePackResources(
  resources: ReadonlyMap<string, unknown>,
  expectedManifest: TourGeneratedManifest,
): void {
  const ownerManifest = parseTourManifest(resourceEndingWith(resources, '/data/generated/tour/manifest.json'))
  if (canonicalJson(ownerManifest) !== canonicalJson(parseTourManifest(expectedManifest))) {
    throw new TypeError('Guided tour download manifest does not match the requested pack')
  }
  parseTaxonomyArtifact(resourceEndingWith(resources, '/data/generated/taxonomy.json'))
  parseTourClaimVocabulary(resourceEndingWith(resources, '/data/generated/tour/claim-vocabulary.json'))
  parseGlossary(resourceEndingWith(resources, '/data/generated/tour/glossary.json'), ownerManifest)
  parseReferences(resourceEndingWith(resources, '/data/generated/tour/references.json'), ownerManifest)

  const loadedLessons = new Map<string, TourGeneratedLessonRecord>()
  for (const chapter of orderedChapters(ownerManifest).filter(({ status }) => status === 'content-ready')) {
    parseChapter(resourceEndingWith(resources, `/data/generated/tour/chapters/${chapter.id}.json`), chapter.id, ownerManifest)
    for (const lessonId of chapter.lessonIds) {
      const lesson = parseLesson(resourceEndingWith(resources, `/data/generated/tour/lessons/${lessonId}.json`), lessonId, ownerManifest, loadedLessons)
      loadedLessons.set(lessonId, lesson)
    }
  }
  const simulationIds = [...new Set(ownerManifest.quickStations
    .filter(({ status, simulationId }) => status === 'content-ready' && simulationId !== null)
    .map(({ simulationId }) => simulationId!))]
  for (const simulationId of simulationIds) {
    parseSimulation(resourceEndingWith(resources, `/data/generated/tour/simulations/${simulationId}.json`), simulationId, ownerManifest, loadedLessons)
  }
}

function abortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) return signal.reason
  return new DOMException('The operation was aborted', 'AbortError')
}

function consumerView<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(abortError(signal))
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', abort)
      callback()
    }
    const abort = () => finish(() => reject(abortError(signal)))
    signal.addEventListener('abort', abort, { once: true })
    promise.then(
      (value) => finish(() => resolve(value)),
      (reason) => finish(() => reject(reason)),
    )
  })
}

async function fetchTourJson(
  url: string,
  failureLabel: string,
  revision: string | undefined,
  signal: AbortSignal,
): Promise<{ value: unknown; offlineRevision: string | null }> {
  let response: Response
  let networkFailure: Error
  try {
    response = await fetch(url, { signal, cache: 'no-store' })
  } catch (reason) {
    if (signal.aborted) throw abortError(signal)
    networkFailure = reason instanceof Error ? reason : new Error(String(reason))
    try {
      const offline = await matchTourOfflineResponse(url, revision)
      if (offline) return { value: await offline.response.json(), offlineRevision: offline.metadata.revision }
    } catch {
      // Cache Storage is an optional degraded path; preserve the network failure when it is unavailable.
    }
    throw networkFailure
  }

  if (!response.ok) {
    networkFailure = new Error(`${failureLabel} failed to load (${response.status})`)
    if (response.status < 500) throw networkFailure
    try {
      const offline = await matchTourOfflineResponse(url, revision)
      if (offline) return { value: await offline.response.json(), offlineRevision: offline.metadata.revision }
    } catch {
      // Cache Storage is an optional degraded path; preserve the HTTP failure when it is unavailable.
    }
    throw networkFailure
  }

  return { value: await response.json(), offlineRevision: null }
}

function loadRecord<T>(
  directory: 'chapters' | 'lessons' | 'simulations',
  id: string,
  allowed: boolean,
  cache: Map<string, T>,
  pendingLoads: Map<string, PendingLoad<T>>,
  parse: (value: unknown) => T,
  signal?: AbortSignal,
): Promise<T | null> {
  if (!isSafeId(id) || !allowed) return Promise.resolve(null)
  if (signal?.aborted) return Promise.reject(abortError(signal))
  const cached = cache.get(id)
  if (cached) return Promise.resolve(cached)
  const existing = pendingLoads.get(id)
  if (existing) return consumerView(existing.promise, signal)

  const attempt = generation
  const pending: PendingLoad<T> = {
    controller: new AbortController(),
    promise: Promise.resolve(null as never),
  }
  pending.promise = (async () => {
    try {
      const url = `${import.meta.env.BASE_URL}data/generated/tour/${directory}/${id}.json`
      const { value } = await fetchTourJson(url, `Tour ${directory.slice(0, -1)} ${id}`, manifest.value?.contentRevision, pending.controller.signal)
      if (pending.controller.signal.aborted || attempt !== generation) throw abortError(pending.controller.signal)
      const parsed = parse(value)
      if (attempt !== generation) throw abortError(pending.controller.signal)
      cache.set(id, parsed)
      return parsed
    } finally {
      if (pendingLoads.get(id) === pending) pendingLoads.delete(id)
    }
  })()
  pendingLoads.set(id, pending)
  return consumerView(pending.promise, signal)
}

function loadSingleton<T>(
  name: 'glossary' | 'references',
  cached: () => T | null,
  setCached: (value: T) => void,
  getPending: () => PendingLoad<T> | null,
  setPending: (value: PendingLoad<T> | null) => void,
  parse: (value: unknown) => T,
  signal?: AbortSignal,
): Promise<T | null> {
  if (signal?.aborted) return Promise.reject(abortError(signal))
  const cachedValue = cached()
  if (cachedValue) return Promise.resolve(cachedValue)
  const existing = getPending()
  if (existing) return consumerView(existing.promise, signal)

  const attempt = generation
  const pending: PendingLoad<T> = {
    controller: new AbortController(),
    promise: Promise.resolve(null as never),
  }
  pending.promise = (async () => {
    try {
      const url = `${import.meta.env.BASE_URL}data/generated/tour/${name}.json`
      const { value } = await fetchTourJson(url, `Tour ${name}`, manifest.value?.contentRevision, pending.controller.signal)
      if (pending.controller.signal.aborted || attempt !== generation) throw abortError(pending.controller.signal)
      const parsed = parse(value)
      if (attempt !== generation) throw abortError(pending.controller.signal)
      setCached(parsed)
      return parsed
    } finally {
      if (getPending() === pending) setPending(null)
    }
  })()
  setPending(pending)
  return consumerView(pending.promise, signal)
}

function chapterById(id: string, signal?: AbortSignal): Promise<TourGeneratedChapterRecord | null> {
  const ownerManifest = manifest.value
  return loadRecord('chapters', id, Boolean(ownerManifest?.chapters.some((chapter) => chapter.id === id)), chapters, pendingChapters,
    (value) => parseChapter(value, id, ownerManifest!), signal)
}

function lessonById(id: string, signal?: AbortSignal): Promise<TourGeneratedLessonRecord | null> {
  const ownerManifest = manifest.value
  return loadRecord('lessons', id, Boolean(ownerManifest && lessonOwners(ownerManifest).has(id)), lessons, pendingLessons,
    (value) => parseLesson(value, id, ownerManifest!), signal)
}

function simulationById(id: string, signal?: AbortSignal): Promise<TourGeneratedSimulation | null> {
  const ownerManifest = manifest.value
  return loadRecord('simulations', id, Boolean(ownerManifest && simulationOwners(ownerManifest).has(id)), simulations, pendingSimulations,
    (value) => parseSimulation(value, id, ownerManifest!), signal)
}

function loadGlossary(signal?: AbortSignal): Promise<TourGlossarySource | null> {
  const ownerManifest = manifest.value
  if (!ownerManifest) return Promise.resolve(null)
  return loadSingleton('glossary', () => glossary, (value) => { glossary = value }, () => pendingGlossary, (value) => { pendingGlossary = value },
    (value) => parseGlossary(value, ownerManifest), signal)
}

function loadReferences(signal?: AbortSignal): Promise<TourReferencesSource | null> {
  const ownerManifest = manifest.value
  if (!ownerManifest) return Promise.resolve(null)
  return loadSingleton('references', () => references, (value) => { references = value }, () => pendingReferences, (value) => { pendingReferences = value },
    (value) => parseReferences(value, ownerManifest), signal)
}

function publishSuccess(value: TourGeneratedManifest): void {
  const taxonomy = taxonomyRegistry.taxonomy.value
  if (!taxonomy) throw new Error('Tour taxonomy is unavailable')
  publishRuntimeAudit({
    tour: {
      status: 'ready',
      manifest: {
        chapters: value.counts.chapters,
        lessons: value.counts.lessons,
        simulations: value.counts.simulations,
        quickStations: value.quickStations.length,
      },
      taxonomy: {
        total: taxonomy.total,
        topics: taxonomy.topics.map(({ id, count }) => ({ id, count })),
      },
    },
  })
}

async function initialize(): Promise<void> {
  if (initialization) return initialization
  const attempt = ++generation
  const attemptController = new AbortController()
  controller = attemptController
  let successful = false
  const pending = Promise.resolve().then(async () => {
    ready.value = false
    error.value = null
    manifest.value = null
    clearRuntimeAuditDomain('tour')
    try {
      const manifestUrl = `${import.meta.env.BASE_URL}data/generated/tour/manifest.json`
      const { value, offlineRevision } = await fetchTourJson(manifestUrl, 'Tour manifest', undefined, attemptController.signal)
      const next = parseTourManifest(value)
      if (offlineRevision !== null && offlineRevision !== next.contentRevision) {
        throw new Error('Installed Guided tour revision does not match its manifest')
      }
      await taxonomyRegistry.initialize(next.contentRevision)
      if (taxonomyRegistry.error.value) throw taxonomyRegistry.error.value
      if (attempt !== generation) return
      manifest.value = next
      publishSuccess(next)
      ready.value = true
      successful = true
    } catch (reason) {
      if (attempt !== generation) return
      manifest.value = null
      if (attemptController.signal.aborted) {
        ready.value = false
        error.value = null
        clearRuntimeAuditDomain('tour')
      } else {
        error.value = reason instanceof Error ? reason : new Error(String(reason))
        publishRuntimeAudit({ tour: { status: 'error', error: error.value.message } })
        ready.value = true
      }
    } finally {
      if (attempt === generation) {
        controller = null
        if (!successful) initialization = null
      }
    }
  })
  initialization = pending
  return pending
}

export function useTourRegistry() {
  return {
    manifest: readonly(manifest),
    taxonomy: taxonomyRegistry.taxonomy,
    ready: readonly(ready),
    error: readonly(error),
    initialize,
    chapterById,
    lessonById,
    simulationById,
    loadGlossary,
    loadReferences,
  }
}

function clearLazyState(): void {
  for (const pending of [...pendingChapters.values(), ...pendingLessons.values(), ...pendingSimulations.values()]) pending.controller.abort()
  pendingGlossary?.controller.abort()
  pendingReferences?.controller.abort()
  chapters.clear()
  lessons.clear()
  simulations.clear()
  pendingChapters.clear()
  pendingLessons.clear()
  pendingSimulations.clear()
  glossary = null
  references = null
  pendingGlossary = null
  pendingReferences = null
}

function clearRegistryState(): void {
  generation += 1
  controller?.abort()
  controller = null
  initialization = null
  manifest.value = null
  ready.value = false
  error.value = null
  clearLazyState()
  clearRuntimeAuditDomain('tour')
}

export function setTourRegistryForTests(value: TourRegistryFixture | null): void {
  clearRegistryState()
  if (!value) return
  setTaxonomyRegistryForTests(value.taxonomy)
  try {
    const nextManifest = parseTourManifest(value.manifest)
    const nextChapters = new Map((value.chapters ?? []).map((chapter) => [chapter.id, parseChapter(chapter, chapter.id, nextManifest)]))
    const nextLessons = new Map<string, TourGeneratedLessonRecord>()
    for (const lesson of value.lessons ?? []) nextLessons.set(lesson.id, parseLesson(lesson, lesson.id, nextManifest, nextLessons))
    const nextSimulations = new Map((value.simulations ?? []).map((simulation) => [simulation.id, parseSimulation(simulation, simulation.id, nextManifest, nextLessons)]))
    const nextGlossary = value.glossary ? parseGlossary(value.glossary, nextManifest) : null
    const nextReferences = value.references ? parseReferences(value.references, nextManifest) : null
    publishSuccess(nextManifest)
    manifest.value = nextManifest
    nextChapters.forEach((chapter, id) => chapters.set(id, chapter))
    nextLessons.forEach((lesson, id) => lessons.set(id, lesson))
    nextSimulations.forEach((simulation, id) => simulations.set(id, simulation))
    glossary = nextGlossary
    references = nextReferences
    ready.value = true
    initialization = Promise.resolve()
  } catch (reason) {
    error.value = reason instanceof Error ? reason : new Error(String(reason))
    publishRuntimeAudit({ tour: { status: 'error', error: error.value.message } })
    ready.value = true
  }
}

export function resetTourRegistryForTests(): void {
  clearRegistryState()
}
