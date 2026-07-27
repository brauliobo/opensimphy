export type ReadingDepth = 'guided' | 'technical'
export type DepthComposition = 'technical-includes-guided'
export type ObservationItemRole =
  | 'fixed-definition'
  | 'measured-reference'
  | 'derived-model-value'
  | 'conventional-value'
  | 'model-input'
  | 'illustrative-scale'
  | 'practical-realization'

export type ClaimClass =
  | 'established-definition'
  | 'established-model'
  | 'observed-value'
  | 'source-claim'
  | 'identity'
  | 'assumption'
  | 'calibration'
  | 'exploratory-hypothesis'
  | 'prediction'

export type MethodRelationship =
  | 'not-applicable'
  | 'literal-reproduction'
  | 'traditional-baseline'
  | 'contract-validator'

export type ResultStatus =
  | 'not-evaluated'
  | 'computed'
  | 'compared'
  | 'failure'
  | 'blocked-source-model'
  | 'unresolved'

export type ModelOrigin = 'established-physics' | 'source-reproduction' | 'traditional-baseline'
export type SimulationTier = 'immediate' | 'local-worker' | 'artifact' | 'unavailable'
export type ConclusionScope = 'activity' | 'computation' | 'source' | 'empirical-evidence' | 'scientific-conclusion'
export type AttributionInheritance = 'nearest-attributed-ancestor'
export type NonEmptyArray<T> = [T, ...T[]]

export interface ValidationProtocol {
  id: string
  hypothesis: string
  calibratedInputIds: string[]
  heldOutObservableIds: string[]
  datasetRefs: string[]
  comparisonMethod: string
  uncertaintyTreatment: string
  acceptanceCriteria: string
  failureHandling: string
}

interface TourAttributionCore {
  claimClass: ClaimClass
  evidenceRefs: NonEmptyArray<string>
  sourceRevision: string
  sourceLocator: string
  methodRelationship: MethodRelationship
  modelOrigin: ModelOrigin
  caveats: string[]
}

type RuntimeTheoryValidationState =
  | { validatesTheory: false; validationProtocol?: never }
  | { validatesTheory: true; validationProtocol: ValidationProtocol }

export type TourSourceAttribution = TourAttributionCore & {
  resultStatus: 'not-evaluated'
  validatesTheory: false
  validationProtocol?: never
}

export type TourRuntimeResultAttribution = TourAttributionCore & {
  resultStatus: Exclude<ResultStatus, 'not-evaluated'>
} & RuntimeTheoryValidationState

export interface AttributionInheritancePolicy {
  inheritance: AttributionInheritance
  rule: string
  attributedRoots: string[]
  inheritingRecordKinds: string[]
  attribution: TourSourceAttribution
}

export interface AttributableText {
  attribution?: TourSourceAttribution
}

export interface ConclusionStatement<S extends ConclusionScope = ConclusionScope> {
  text: string
  scope: S
  attribution: TourSourceAttribution
}

export type LessonBlock = TourSourceAttribution & {
  id: string
  kind: 'prose' | 'definition' | 'list' | 'caveat' | 'derivation'
  title: string
  body: string[]
  glossaryIds: string[]
}

export type EquationStep = TourSourceAttribution & {
  id: string
  label: string
  expression: string
  explanation: string
}

export interface ObservationStageItem extends AttributableText {
  id: string
  label: string
  value: number
  unit: string
  role: ObservationItemRole
  explanation: string
  evidenceRefs: NonEmptyArray<string>
}

export interface ObservationStage {
  title: string
  question: string
  items: NonEmptyArray<ObservationStageItem>
  conclusion: string
  attribution: TourSourceAttribution
}

export interface Checkpoint {
  id: string
  kind: 'prediction' | 'classification' | 'explanation'
  prompt: string
  choices: Array<{ id: string; label: string }>
  answerId: string
  explanation: string
  attribution: TourSourceAttribution
}

export interface LessonQuickPath {
  estimatedMinutes: number
  guidedBlockIds: string[]
  equationStepIds: string[]
  checkpointIds: string[]
  simulationPresetId: string
}

export interface TourSourceLessonRecord {
  schemaVersion: 1
  id: string
  chapterId: string
  order: number
  title: string
  question: string
  answerPreview: string
  summary: string
  attribution: TourSourceAttribution
  estimatedMinutes: number
  quickPath?: LessonQuickPath
  depthComposition: DepthComposition
  prerequisites: string[]
  observationStage: ObservationStage
  guidedBlocks: LessonBlock[]
  technicalBlocks: LessonBlock[]
  equationSteps: EquationStep[]
  simulationId: string | null
  formulaIds: string[]
  programIds: string[]
  glossaryIds: string[]
  evidenceRefs: string[]
  checkpoints: Checkpoint[]
  seenInActivity: Array<ConclusionStatement<'activity'>>
  computedHere: Array<ConclusionStatement<'computation'>>
  reproducedFromSource: Array<ConclusionStatement<'source'>>
  comparedWithEvidence: Array<ConclusionStatement<'empirical-evidence'>>
  establishes: Array<ConclusionStatement<'scientific-conclusion'>>
  doesNotEstablish: Array<ConclusionStatement<'scientific-conclusion'>>
}

export interface TourGeneratedLessonRecord extends TourSourceLessonRecord {
  previousLessonId: string | null
  nextLessonId: string | null
}

export interface TourSourceChapterRecord {
  schemaVersion: 1
  id: string
  order: number
  act: 1 | 2 | 3 | 4
  title: string
  question: string
  summary: string
  status: 'content-ready' | 'planned'
  quickStationIds: string[]
  lessonIds: string[]
  attribution: TourSourceAttribution
}

export interface TourGeneratedChapterRecord extends TourSourceChapterRecord {
  previousChapterId: string | null
  nextChapterId: string | null
}

export interface TourControlOption {
  value: string
  label: string
  description?: string
}

export type TourInputRole =
  | 'parameter'
  | 'preset-selection'
  | 'coordinate-selection'
  | 'display-option'
  | 'target-quantity'
  | 'canonical-quantity-value'
  | 'fixed-constant'
  | 'calibrated-input'
  | 'nuisance-parameter'
  | 'held-out-observable'

interface TourControlBase extends AttributableText {
  id: string
  label: string
  inputRole: TourInputRole
  readingDepth: ReadingDepth
  description: string
  playfulPrompt?: string
}

export interface TourSelectControl extends TourControlBase {
  type: 'select'
  default: string
  options: TourControlOption[]
}

interface TourNumericControlBase extends TourControlBase {
  unit: string
  default: number
  min: number
  max: number
  step: number
}

export interface TourRangeControl extends TourNumericControlBase {
  type: 'range'
}

export interface TourNumberControl extends TourNumericControlBase {
  type: 'number'
}

export interface TourToggleControl extends TourControlBase {
  type: 'toggle'
  default: boolean
}

export type TourControl = TourSelectControl | TourRangeControl | TourNumberControl | TourToggleControl

export interface TourPreset extends AttributableText {
  id: string
  label: string
  description: string
  inspectionPrompt: string
  inputs: Record<string, number | string | boolean>
}

export type ResultFinding = TourSourceAttribution & {
  changed: string
  cause: string
  equation: string
  assumptions: string[]
  establishes: string
  doesNotEstablish: string
}

export interface ImmediateRuntimeLimits {
  tier: 'immediate'
  maxOperations: number
  maxDurationMs: number
}

export interface LocalWorkerRuntimeLimits {
  tier: 'local-worker'
  maxOperations: number
  maxDurationMs: number
  maxIterations: number
}

export interface ArtifactRuntimeLimits {
  tier: 'artifact'
  maxArtifactBytes: number
}

export interface UnavailableRuntimeLimits {
  tier: 'unavailable'
  reason: string
}

export type RuntimeLimits =
  | ImmediateRuntimeLimits
  | LocalWorkerRuntimeLimits
  | ArtifactRuntimeLimits
  | UnavailableRuntimeLimits

export interface RationalExponent {
  numerator: number
  denominator: number
}

export type DimensionVector = [
  RationalExponent,
  RationalExponent,
  RationalExponent,
  RationalExponent,
  RationalExponent,
  RationalExponent,
  RationalExponent,
]

export interface DimensionOperationOutput {
  operationStatus: 'defined' | 'undefined-unlike-addition'
  resultDimension: DimensionVector | null
  targetDimension: DimensionVector
  targetMatch: boolean
  quantityKindCaveat: string
  coordinateValue: number | null
  coordinateUnit: string | null
}

export interface DimensionAxis {
  id: 'time' | 'length' | 'mass' | 'electric-current' | 'thermodynamic-temperature' | 'amount-of-substance' | 'luminous-intensity'
  symbol: string
}

export interface DimensionBasis {
  system: 'ISQ'
  axes: DimensionAxis[]
  exponentType: 'rational'
  activityExponentSubset: 'integer'
}

export interface TourOutputField {
  id: string
  label: string
  type: 'operation-status' | 'rational-dimension-vector' | 'boolean' | 'string' | 'number'
  unit: string | null
  nullable: boolean
  description: string
  attribution?: TourSourceAttribution
}

export interface TourSourceComparisonContract extends AttributableText {
  compatibility: 'same-simulation-revision-and-output-schema'
  incompatibleBehavior: string
}

export interface TourGeneratedComparisonContract extends TourSourceComparisonContract {
  /** SHA-256 over simulation id, contentRevision, modelRevision, implementationRevision, and canonical output schema. */
  compatibilityKey: string
}

export interface VisualizationAlternative extends AttributableText {
  type: 'text' | 'table'
  description: string
}

export interface VisualizationContract extends AttributableText {
  kind: string
  description: string
  alternatives: VisualizationAlternative[]
  reducedMotionBehavior: string
}

export interface SimulationRevision {
  contentRevision: string
  modelRevision: string
  implementationRevision: string
}

export interface ModelComponent {
  id: string
  label: string
  modelOrigin: ModelOrigin
  description: string
  attribution: TourSourceAttribution
}

export interface NumericalMethodMetadata {
  kind: 'exact-symbolic' | 'direct-evaluation' | 'iterative' | 'optimization' | 'sampling' | 'integration' | 'interpolation' | 'other'
  name: string
  description: string
  deterministic: boolean
  implementationRef?: string
  tolerance?: number
  maxIterations?: number
}

export interface DatasetStateMetadata {
  state: 'not-applicable' | 'not-loaded' | 'loaded' | 'precomputed-artifact' | 'unavailable'
  datasetRefs: string[]
  purposes: Array<'calibration' | 'comparison' | 'held-out-evaluation' | 'visualization'>
  revision?: string
  selection?: string
}

export type TourSourceSimulation = TourSourceAttribution & {
  schemaVersion: 1
  id: string
  lessonId: string
  title: string
  question: string
  predictionPrompt: string
  revision: SimulationRevision
  dimensionBasis?: DimensionBasis
  numericalMethod?: NumericalMethodMetadata
  datasetState?: DatasetStateMetadata
  modelComponents: ModelComponent[]
  equations: string[]
  assumptions: string[]
  glossaryIds: NonEmptyArray<string>
  controls: TourControl[]
  presets: TourPreset[]
  outputSchema: TourOutputField[]
  comparison: TourSourceComparisonContract
  visualization: VisualizationContract
  finding: ResultFinding
  limits: RuntimeLimits
}

export type TourGeneratedSimulation = Omit<TourSourceSimulation, 'comparison'> & {
  comparison: TourGeneratedComparisonContract
}

export interface TourGlossaryEntry {
  id: string
  term: string
  guidedDefinition: string
  technicalDefinition: string
  guided: boolean
  evidenceRefs: NonEmptyArray<string>
  attribution: TourSourceAttribution
}

export interface TourGlossarySource {
  schemaVersion: 1
  entries: TourGlossaryEntry[]
}

export interface TourReference {
  id: string
  title: string
  sourceFamily: string
  url: `https://${string}`
  classification: 'primary-standard' | 'reference-data' | 'textbook' | 'source-corpus' | 'internal-policy'
  responsibleOrganization: string
  publicationYear: number
  edition: string
  revision: string
  doi?: string
  sourceLocator: string
  accessedAt: string
  accessStatus: 'verified-accessible' | 'partially-accessible' | 'blocked' | 'not-checked'
  scopeNote: string
  supersededForCurrentSIDefinitions: boolean
  licenseNote: string
}

export interface TourReferencesSource {
  schemaVersion: 1
  policy: string
  policyAttribution: TourSourceAttribution
  entries: TourReference[]
}

export interface ClaimVocabularyAxisEntry<Id extends string = string> {
  id: Id
  definition: string
  usageWarning: string
  attribution: TourSourceAttribution
}

export interface TourClaimVocabularySource {
  schemaVersion: 1
  claimClasses: Array<ClaimVocabularyAxisEntry<ClaimClass>>
  methodRelationships: Array<ClaimVocabularyAxisEntry<MethodRelationship>>
  modelOrigins: Array<ClaimVocabularyAxisEntry<ModelOrigin>>
  resultStatuses: Array<ClaimVocabularyAxisEntry<ResultStatus>>
  conclusionScopes: Array<ClaimVocabularyAxisEntry<ConclusionScope>>
  validatesTheory: {
    definition: string
    usageWarning: string
    trueRequires: Array<keyof ValidationProtocol>
    attribution: TourSourceAttribution
  }
  conclusionBoundary: {
    required: Array<'seenInActivity' | 'computedHere' | 'reproducedFromSource' | 'comparedWithEvidence' | 'establishes' | 'doesNotEstablish'>
    statementRequired: Array<'text' | 'scope' | 'attribution'>
    attributionRequired: string[]
    scopeMapping: {
      seenInActivity: 'activity'
      computedHere: 'computation'
      reproducedFromSource: 'source'
      comparedWithEvidence: 'empirical-evidence'
      establishes: 'scientific-conclusion'
      doesNotEstablish: 'scientific-conclusion'
    }
    rule: string
    attribution: TourSourceAttribution
  }
}

export interface QuickStation {
  id: string
  order: number
  title: string
  question: string
  interaction: string
  chapterId: string
  lessonId: string | null
  simulationId: string | null
  glossaryIds?: NonEmptyArray<string>
  estimatedMinutes: number
  status: 'content-ready' | 'planned'
}

export interface TourContentStatusPolicy {
  contentReady: string
  planned: string
  attribution: TourSourceAttribution
}

interface TourManifestBase {
  schemaVersion: 1
  contentRevision: string
  title: string
  thesis: string
  attribution: TourSourceAttribution
  readingDepths: ReadingDepth[]
  depthComposition: DepthComposition
  quickStations: QuickStation[]
  attributionPolicy: AttributionInheritancePolicy
  contentStatusPolicy: TourContentStatusPolicy
}

export interface TourSourceManifest extends TourManifestBase {}

export interface TourGeneratedManifest extends TourManifestBase {
  chapters: TourGeneratedChapterRecord[]
  counts: {
    chapters: number
    lessons: number
    simulations: number
    glossary: number
    references: number
  }
}

export interface TourProgress {
  version: 1
  readingDepth: ReadingDepth
  chapters: Record<string, {
    status: 'not-started' | 'visited' | 'complete'
    lastLessonId?: string
    updatedAt?: string
  }>
  lessons: Record<string, {
    visited: boolean
    complete: boolean
    lastAnchor?: string
  }>
  stations: Record<string, {
    visited: boolean
    complete: boolean
    updatedAt?: string
  }>
  resumeRoute?: string
}
