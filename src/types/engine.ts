export interface ComplexValue {
  re: number;
  im: number;
}

export interface DimensionVector {
  time: number;
  length: number;
  charge: number;
  temperature: number;
  mass: number;
}

export interface EvaluationSymbol {
  value: ComplexValue;
  dimension: DimensionVector;
  source?: "primitive" | "recipe" | "unit" | "parameter";
}

export interface RatioSource {
  numerator: string[];
  denominator: string[];
}

export interface RecipeSource {
  recipe_number: number;
  constant_id: string;
  display_name: string;
  column: string;
  island: string;
  dimension: string;
  combine?: "+" | "-" | "inversion";
  external_geometry: RatioSource;
  external_boundary: RatioSource;
  inversion_geometry: RatioSource;
  root_transform: { id: string };
  expected_kind: "exact" | "measured";
  expected_value: number | string;
  expected_digits: string;
  expected_digits_label: string;
  model_value: string;
  wall_id: string;
  published_result?: PublishedRecipeResult;
}

export interface PrimitiveSymbolSource {
  token: string;
  value: string;
  dimension: string;
}

export interface PublishedRecipeResult {
  recipeNumber: number;
  constantId: string;
  displayName: string;
  buildPass: number;
  dependencies: string[];
  computed: string | null;
  computedDimension: string | null;
  zScore: number | null;
}

export interface GraphPoint {
  x: number;
  y: number;
  imaginary: number;
  magnitude: number;
  sign: -1 | 0 | 1;
  log10Abs: number | null;
  finite: boolean;
}

export interface GraphMarker {
  x: number;
  y: number;
  label: "computed" | "expected";
}

export interface SimulationGraph {
  parameter: "inversion-boundary-scale";
  precision: "float64-reproduction";
  points: GraphPoint[];
  markers: GraphMarker[];
  graphReady: boolean;
}

export interface DimensionAudit {
  declared: string;
  declaredVector: DimensionVector | null;
  computedVector: DimensionVector;
  matches: boolean;
  finding: string | null;
}

export interface RecipeEvaluation {
  recipeNumber: number;
  id: string;
  name: string;
  value: ComplexValue;
  scalarValue: number;
  modelValue: number;
  expectedValue: number;
  expectedSigma: number | null;
  residual: number;
  relativeModelError: number;
  zScore: number | null;
  modelParity: boolean;
  precision: "float64-reproduction";
  buildPass: number;
  dependencies: string[];
  formula: string;
  dimensionAudit: DimensionAudit;
  graph: SimulationGraph;
  graphReady: boolean;
}

export interface RecipeBatchResult {
  evaluations: RecipeEvaluation[];
  unresolved: Array<{ recipeNumber: number; id: string; error: string }>;
  errors: Array<{ recipeNumber: number; id: string; error: string }>;
  passes: number;
  precision: "float64-reproduction";
}

export type WallMode = "mod" | "valuation" | "signed_log" | "row_signed_log" | "small_values" | "zero_windows";

export interface WallPayload {
  id: string;
  title: string;
  kind: string;
  sequence: string[];
  visibleWidth?: number;
  visibleDepth?: number;
  [key: string]: unknown;
}

export interface WallCell {
  row: number;
  column: number;
  exact?: string;
  value: number | string | null;
  sign?: -1 | 0 | 1;
}

export interface WallSimulation {
  id: string;
  terms: number;
  depth: number;
  mode: WallMode;
  cells: WallCell[];
  zeroWindows?: Array<{ row: number; start: number; length: number }>;
}

export interface WallSimulationOptions {
  terms?: number;
  depth?: number;
  mode?: WallMode;
  modulus?: number;
  valuationPrime?: number;
  smallValueLimit?: number;
  shouldCancel?: () => boolean;
}

export interface CompletionSection {
  source: number;
  implemented: number;
  evaluated?: number;
  graphed: number;
  parseable?: number;
  simulatable?: number;
}

export interface CompletionReport {
  schemaVersion: 1;
  generatedAt: string;
  audit: {
    precision: "float64-reproduction";
    wallTerms: number;
    wallDepth: number;
    wallMode: WallMode;
  };
  inputs?: Record<string, string>;
  complete: boolean;
  recipes: CompletionSection;
  walls: CompletionSection;
  core: CompletionSection;
  unresolved: string[];
  errors: string[];
}

export interface RegistryArtifact {
  schemaVersion: 1;
  generatedAt: string;
  inputs: Record<string, string>;
  recipes: {
    count: number;
    dataUrl: string;
    items: Array<{ recipeNumber: number; id: string; name: string; wallId: string }>;
  };
  walls: {
    count: number;
    dataUrl: string;
    items: Array<{ id: string; title: string; category: string; filename: string }>;
  };
  core: {
    count: number;
    items: Array<{
      id: string;
      title: string;
      category: string;
      sourceUrl: string;
      formula: string;
      provenance: "physics-monastery" | "engine-extension";
    }>;
  };
}
