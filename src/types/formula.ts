import type { DimensionAudit, GraphPoint, RecipeTaxonomy, SimulationGraph } from './engine'
import type { PlotFigure } from './plot'

export type FormulaSourceAudit = ExactSourceAudit | MeasuredSourceAudit

export interface ExactSourceAudit {
  basis: 'exact'
  comparisonScope: 'source-comparison'
  criterion: 'published-significant-digit-assessment'
  assessment: 'full match' | 'almost-full match' | 'not a match'
  matchedDigits: number
  totalCompared: number
  met: boolean
  validation: false
}

export interface MeasuredSourceAudit {
  basis: 'measured'
  comparisonScope: 'source-comparison'
  criterion: 'published-5.2-sigma'
  zScore: number
  observed: number
  threshold: 5.2
  met: boolean
  validation: false
}

export interface FormulaMeaning {
  name: string
  declaredQuantity: string
  unit: string
  sourceLabel: string
  guidedDefinition: string
  caveats: string[]
  boundary: 'source-reproduction-not-independent-validation'
}

export type FormulaEquationStage =
  | 'external-geometry'
  | 'external-boundary'
  | 'dimensionless-inversion-correction'
  | 'root-transform'
  | 'complete-constructor'

export interface FormulaEquationStep {
  stage: FormulaEquationStage
  token: 'EG' | 'EB' | 'IG-R-IB' | 'R' | 'formula'
  expression: string
  explanation: string
}

export type FormulaDependencyRole = 'recipe' | 'primitive' | 'parameter' | 'source-symbol'

export interface FormulaDependencyNode {
  token: string
  role: FormulaDependencyRole
  depth: number
  direct: boolean
  parents: string[]
}

export interface FormulaDependencyLedger {
  direct: string[]
  graph: FormulaDependencyNode[]
}

export interface FormulaDependencyAgreement {
  missingFromRuntime: string[]
  extraInRuntime: string[]
  matches: boolean
}

export interface AvailableRelativeResidual {
  available: true
  value: number
  denominator: 'expected-value'
}

export interface UnavailableRelativeResidual {
  available: false
  value: null
  reason: 'expected-value-is-zero'
}

export interface AvailableStandardizedResidual {
  available: true
  value: number
  scale: 'measured-sigma'
}

export interface UnavailableStandardizedResidual {
  available: false
  value: null
  reason: 'exact-source-comparison' | 'measured-sigma-unavailable' | 'z-score-unavailable'
}

export interface FormulaResidualScale {
  signedAbsolute: {
    value: number
    unit: string
  }
  relative: AvailableRelativeResidual | UnavailableRelativeResidual
  standardized: AvailableStandardizedResidual | UnavailableStandardizedResidual
}

export interface FormulaRawValues {
  expected: number | string
  expectedNumeric: number
  computed: number
  model: string
  modelNumeric: number
  precision: 'float64-reproduction'
}

export type FormulaArtifactLocator = FormulaRecipeSourceLocator | FormulaAuditSourceLocator

export interface FormulaRecipeSourceLocator {
  artifactId: 'constants-yaml'
  preservedPath: 'sources/constants.yaml'
  constantId: string
  recipeNumber: number
  publicSourceUrl: 'https://www.physicsmonastery.earth/288'
}

export interface FormulaAuditSourceLocator {
  artifactId: 'published-output'
  preservedPath: 'sources/latest-output.txt'
  constantId: string
  recipeNumber: number
  publicSourceUrl: 'https://www.physicsmonastery.earth/288'
}

export interface FormulaProvenance {
  recipeSource: FormulaRecipeSourceLocator
  auditSource: FormulaAuditSourceLocator
  recipeRevision: string
  symbolRevision: string
  sourceRevision: string
  boundary: 'source-reproduction-not-independent-validation'
}

export interface FormulaSourceEvaluation {
  buildPass: number
  computed: string | null
  computedDimension: string | null
}

export interface FormulaRuntimeEvaluation {
  buildPass: number
  computed: number
  precision: 'float64-reproduction'
  modelParity: boolean
}

export interface FormulaGraphTableRow extends GraphPoint {}

export interface FormulaRecord {
  id: string
  ordinal: number
  symbol: string
  name: string
  meaning: FormulaMeaning
  equation: string
  equationLadder: FormulaEquationStep[]
  column: string
  island: string
  classification: 'exact' | 'measured'
  topic: string
  category: string
  facets: RecipeTaxonomy['facets']
  sourceAudit: FormulaSourceAudit
  sourceUrl: string
  provenance: FormulaProvenance
  recipeRevision: string
  symbolRevision: string
  sourceRevision: string
  implementationRevision: string
  outputSchemaRevision: string
  compatibility: 'same-formula-revisions-and-output-schema'
  compatibilityKey: string
  decomposition: { EG: string; EB: string; IG: string; R: string; IB: string }
  sourceDependencies: FormulaDependencyLedger
  runtimeDependencies: FormulaDependencyLedger
  constructorLiterals: string[]
  dependencyAgreement: FormulaDependencyAgreement
  sourceEvaluation: FormulaSourceEvaluation
  runtimeEvaluation: FormulaRuntimeEvaluation
  rawValues: FormulaRawValues
  residualScale: FormulaResidualScale
  dimensionAudit: DimensionAudit
  modelParity: boolean
  computed: string
  expected: string
  residual: string
  zScore: string
  units: string
  simulationGraph: SimulationGraph
  graphPoints: GraphPoint[]
  graphTable: FormulaGraphTableRow[]
  graph: PlotFigure | null
  graphReady: boolean
}

export interface FormulaRegistryArtifact {
  schemaVersion: 1
  generatedAt: string
  inputs: {
    recipesSha256: string
    symbolsSha256: string
  }
  recipes: {
    count: number
    dataUrl: string
    items: Array<{
      recipeNumber: number
      id: string
      name: string
      wallId: string
    }>
  }
}
