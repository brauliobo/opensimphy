import {
  boundedInteger,
  boundedNumber,
  checkCancelled,
  finiteNumber,
  positiveNumber,
  seededRandom,
  type EarthDiagnostics,
  type EarthKernelResult,
  type EarthRunOptions,
} from "./common.js";
import { cross3, dot3, scale3, sub3 } from "../../simphy/vec.js";

export type { EarthKernelResult } from "./common.js";

export type PhysicalComparatorId =
  | "EARTH-FND-009"
  | "EARTH-FND-012"
  | "EARTH-FND-013"
  | "EARTH-GEO-001"
  | "EARTH-GEO-002"
  | "EARTH-GEO-003"
  | "EARTH-GEO-005"
  | "EARTH-FLD-002"
  | "EARTH-FLD-003"
  | "EARTH-FLD-004"
  | "EARTH-FLD-009"
  | "EARTH-NUC-002"
  | "EARTH-NUC-003"
  | "EARTH-NUC-005"
  | "EARTH-PRT-002"
  | "EARTH-PRT-003"
  | "EARTH-PRT-004";

export type PhysicalComparatorKind = "standard-comparison" | "source-contract-audit";

export type PhysicalComparatorResult<Id extends PhysicalComparatorId, Output> = EarthKernelResult<Output> & {
  id: Id;
};

const EARTH_BLOCKERS: Record<PhysicalComparatorId, string> = {
  "EARTH-FND-009": "Needs frozen density/length datasets.",
  "EARTH-FND-012": "BX until points, edges, and inverse rules are defined.",
  "EARTH-FND-013": "Data-blocked; exact selection protocol and authenticated catalogs are absent.",
  "EARTH-GEO-001": "BX: projector matrices and window coordinates are absent.",
  "EARTH-GEO-002": "Depends on GEO-001 and licensed/open data.",
  "EARTH-GEO-003": "BX: no embedding or objective function.",
  "EARTH-GEO-005": "BX until the map and cell boundaries are supplied.",
  "EARTH-FLD-002": "BX until normalization/domain/BCs are source-locked; cannot report Hopf charge.",
  "EARTH-FLD-003": "No verified execution adapter or immutable offline artifact is available.",
  "EARTH-FLD-004": "Depends on a solved background.",
  "EARTH-FLD-009": "BX: no EARTH elastic tensor or grain law.",
  "EARTH-NUC-002": "BX: mapping and pairing function are absent.",
  "EARTH-NUC-003": "BX: no barrier, rate law, or weak-transition operator.",
  "EARTH-NUC-005": "BX: published action does not support the claimed topology or parton observables.",
  "EARTH-PRT-002": "BX: `k`, `r_0`, coupling, and topology are undefined.",
  "EARTH-PRT-003": "BX: normalization and fractional-winding mechanism absent.",
  "EARTH-PRT-004": "Depends on FLD background and a gauge model.",
};

function diagnostics(
  id: PhysicalComparatorId,
  kind: PhysicalComparatorKind,
  extra: EarthDiagnostics = {},
): EarthDiagnostics {
  return {
    kernelKind: kind,
    benchmarkLabel: kind === "standard-comparison"
      ? "standard-comparison-not-EARTH-derived"
      : "source-contract-audit-not-EARTH-derived",
    earthBlocker: EARTH_BLOCKERS[id],
    earthBlockerRetained: true,
    earthModelStatus: "blocked",
    earthValidationClaim: false,
    validatesEarthTheory: false,
    deterministic: true,
    ...extra,
  };
}

function result<Id extends PhysicalComparatorId, Output>(
  id: Id,
  kind: PhysicalComparatorKind,
  method: string,
  output: Output,
  extra: EarthDiagnostics = {},
): PhysicalComparatorResult<Id, Output> {
  return { id, method, diagnostics: diagnostics(id, kind, extra), output };
}

function boundedList<T>(values: readonly T[], name: string, minimum: number, maximum: number): readonly T[] {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    throw new RangeError(`${name} must contain ${minimum} to ${maximum} entries`);
  }
  return values;
}

function boundedText(value: string, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} is required`);
  if (value.length > 128) throw new RangeError(`${name} must not exceed 128 characters`);
  return value;
}

function boundedWork(value: number, name: string, maximum: number): void {
  if (!Number.isSafeInteger(value) || value > maximum) throw new RangeError(`${name} must not exceed ${maximum}`);
}

function checkedVector(values: readonly number[], name: string, dimension: number, maximumMagnitude = 1e12): number[] {
  if (!Array.isArray(values) || values.length !== dimension) throw new RangeError(`${name} must contain exactly ${dimension} entries`);
  return values.map((value, index) => boundedNumber(value, `${name}[${index}]`, -maximumMagnitude, maximumMagnitude));
}

function relativeResidual(actual: number, expected: number): number {
  return expected === 0 ? Math.abs(actual) : Math.abs(actual - expected) / Math.abs(expected);
}

function linearSamples(minimum: number, maximum: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => minimum + (maximum - minimum) * index / (count - 1));
}

// EARTH-FND-009
export interface ScaleObservation {
  id: string;
  observed: number;
  reference: number;
}

export interface GoldenScaleResidualInputs {
  observations?: readonly ScaleObservation[];
  ratio?: number;
  exponentMinimum?: number;
  exponentMaximum?: number;
}

export const DEFAULT_GOLDEN_SCALE_RESIDUAL_INPUTS = Object.freeze({
  observations: [{ id: "dimensionless-self-check", observed: 2, reference: 1 }],
  ratio: 2,
  exponentMinimum: -4,
  exponentMaximum: 4,
}) satisfies GoldenScaleResidualInputs;

export function goldenScaleResidualAudit(
  inputs: GoldenScaleResidualInputs = DEFAULT_GOLDEN_SCALE_RESIDUAL_INPUTS,
  options: EarthRunOptions = {},
): PhysicalComparatorResult<"EARTH-FND-009", {
  ratio: number;
  exponentRange: [number, number];
  observations: Array<ScaleObservation & { nearestExponent: number; fittedScale: number; logResidual: number; relativeResidual: number }>;
}> {
  const observations = boundedList(inputs.observations ?? DEFAULT_GOLDEN_SCALE_RESIDUAL_INPUTS.observations, "observations", 1, 256);
  const ratio = boundedNumber(inputs.ratio ?? 2, "ratio", 1.000001, 1e6);
  const exponentMinimum = boundedInteger(inputs.exponentMinimum ?? -4, "exponentMinimum", -128, 128);
  const exponentMaximum = boundedInteger(inputs.exponentMaximum ?? 4, "exponentMaximum", -128, 128);
  if (exponentMaximum < exponentMinimum) throw new RangeError("exponentMaximum must not be less than exponentMinimum");
  boundedWork(observations.length * (exponentMaximum - exponentMinimum + 1), "scale sweep work", 65_536);
  const checked = observations.map((observation, index) => ({
    id: boundedText(observation.id, `observations[${index}].id`),
    observed: boundedNumber(observation.observed, `observations[${index}].observed`, 1e-200, 1e200),
    reference: boundedNumber(observation.reference, `observations[${index}].reference`, 1e-200, 1e200),
  }));
  const output = checked.map((observation) => {
    checkCancelled(options);
    let nearestExponent = exponentMinimum;
    let fittedScale = observation.reference * ratio ** exponentMinimum;
    let best = Math.abs(Math.log(observation.observed / fittedScale));
    for (let exponent = exponentMinimum + 1; exponent <= exponentMaximum; exponent += 1) {
      const candidate = observation.reference * ratio ** exponent;
      if (!Number.isFinite(candidate) || candidate <= 0) throw new RangeError("scale sweep produced a non-finite candidate");
      const residual = Math.abs(Math.log(observation.observed / candidate));
      if (residual < best) {
        nearestExponent = exponent;
        fittedScale = candidate;
        best = residual;
      }
    }
    return { ...observation, nearestExponent, fittedScale, logResidual: Math.log(observation.observed / fittedScale), relativeResidual: relativeResidual(fittedScale, observation.observed) };
  });
  return result(
    "EARTH-FND-009",
    "source-contract-audit",
    "Bounded nearest-exponent residual sweep over explicitly supplied scales without fitting the ratio to targets",
    { ratio, exponentRange: [exponentMinimum, exponentMaximum], observations: output },
    { frozenEarthDatasetAvailable: false, ratioDerivedFromTargets: false },
  );
}

// EARTH-FND-012
export interface WeightedGraphEdge {
  from: string;
  to: string;
  weight: number;
}

export interface WeightedGraphMetricInputs {
  nodes?: readonly string[];
  edges?: readonly WeightedGraphEdge[];
  directed?: boolean;
  tolerance?: number;
}

export const DEFAULT_WEIGHTED_GRAPH_METRIC_INPUTS = Object.freeze({
  nodes: ["a", "b", "c"],
  edges: [{ from: "a", to: "b", weight: 1 }, { from: "b", to: "c", weight: 1 }, { from: "a", to: "c", weight: 3 }],
  directed: false,
  tolerance: 1e-12,
}) satisfies WeightedGraphMetricInputs;

export function weightedGraphMetricAudit(
  inputs: WeightedGraphMetricInputs = DEFAULT_WEIGHTED_GRAPH_METRIC_INPUTS,
  options: EarthRunOptions = {},
): PhysicalComparatorResult<"EARTH-FND-012", {
  nodes: string[];
  distances: number[][];
  connected: boolean;
  axioms: { positive: boolean; identity: boolean; symmetric: boolean; triangle: boolean };
}> {
  const nodeInputs = boundedList(inputs.nodes ?? DEFAULT_WEIGHTED_GRAPH_METRIC_INPUTS.nodes, "nodes", 1, 64);
  const edgeInputs = boundedList(inputs.edges ?? DEFAULT_WEIGHTED_GRAPH_METRIC_INPUTS.edges, "edges", 0, 4096);
  const directed = inputs.directed ?? false;
  const tolerance = boundedNumber(inputs.tolerance ?? 1e-12, "tolerance", 0, 1);
  boundedWork(nodeInputs.length ** 3, "graph metric work", 262_144);
  const nodes = nodeInputs.map((node, index) => boundedText(node, `nodes[${index}]`));
  if (new Set(nodes).size !== nodes.length) throw new RangeError("nodes must be unique");
  const indexByNode = new Map(nodes.map((node, index) => [node, index]));
  const distances = nodes.map((_, row) => nodes.map((__, column) => row === column ? 0 : Number.POSITIVE_INFINITY));
  for (let edgeIndex = 0; edgeIndex < edgeInputs.length; edgeIndex += 1) {
    checkCancelled(options);
    const edge = edgeInputs[edgeIndex]!;
    const from = indexByNode.get(edge.from);
    const to = indexByNode.get(edge.to);
    if (from === undefined || to === undefined) throw new RangeError(`edges[${edgeIndex}] references an unknown node`);
    const weight = boundedNumber(edge.weight, `edges[${edgeIndex}].weight`, Number.MIN_VALUE, 1e100);
    distances[from]![to] = Math.min(distances[from]![to]!, weight);
    if (!directed) distances[to]![from] = Math.min(distances[to]![from]!, weight);
  }
  for (let intermediate = 0; intermediate < nodes.length; intermediate += 1) {
    checkCancelled(options);
    for (let from = 0; from < nodes.length; from += 1) {
      for (let to = 0; to < nodes.length; to += 1) {
        distances[from]![to] = Math.min(distances[from]![to]!, distances[from]![intermediate]! + distances[intermediate]![to]!);
      }
    }
  }
  const connected = distances.every((row) => row.every(Number.isFinite));
  const positive = distances.every((row, rowIndex) => row.every((distance, columnIndex) => rowIndex === columnIndex ? distance === 0 : distance > 0));
  const identity = distances.every((row, rowIndex) => row.every((distance, columnIndex) => (distance === 0) === (rowIndex === columnIndex)));
  const symmetric = distances.every((row, rowIndex) => row.every((distance, columnIndex) => Math.abs(distance - distances[columnIndex]![rowIndex]!) <= tolerance));
  let triangle = true;
  for (let first = 0; first < nodes.length && triangle; first += 1) {
    checkCancelled(options);
    for (let middle = 0; middle < nodes.length && triangle; middle += 1) {
      for (let last = 0; last < nodes.length; last += 1) {
        if (distances[first]![last]! > distances[first]![middle]! + distances[middle]![last]! + tolerance) {
          triangle = false;
          break;
        }
      }
    }
  }
  return result(
    "EARTH-FND-012",
    "source-contract-audit",
    "Floyd-Warshall shortest paths and finite weighted-graph metric-axiom checks on user-declared nodes and edges",
    { nodes, distances, connected, axioms: { positive, identity, symmetric, triangle } },
    { directed, inverseRulesSuppliedByEarth: false },
  );
}

// EARTH-FND-013
export interface EventCoincidencePermutationInputs {
  eventSequence?: readonly number[];
  catalogSequence?: readonly number[];
  permutations?: number;
  seed?: number;
}

export const DEFAULT_EVENT_COINCIDENCE_PERMUTATION_INPUTS = Object.freeze({
  eventSequence: [1, 0, 1, 0, 1, 0, 0, 0],
  catalogSequence: [1, 0, 0, 0, 1, 0, 1, 0],
  permutations: 256,
  seed: 13,
}) satisfies EventCoincidencePermutationInputs;

export function eventCoincidencePermutationAudit(
  inputs: EventCoincidencePermutationInputs = DEFAULT_EVENT_COINCIDENCE_PERMUTATION_INPUTS,
  options: EarthRunOptions = {},
): PhysicalComparatorResult<"EARTH-FND-013", {
  observedCoincidences: number;
  nullCoincidences: number[];
  nullMean: number;
  effectSize: number;
  upperTailPValue: number;
}> {
  const eventInput = boundedList(inputs.eventSequence ?? DEFAULT_EVENT_COINCIDENCE_PERMUTATION_INPUTS.eventSequence, "eventSequence", 4, 4096);
  const catalogInput = boundedList(inputs.catalogSequence ?? DEFAULT_EVENT_COINCIDENCE_PERMUTATION_INPUTS.catalogSequence, "catalogSequence", 4, 4096);
  if (eventInput.length !== catalogInput.length) throw new RangeError("eventSequence and catalogSequence must have equal lengths");
  const eventSequence = eventInput.map((value, index) => boundedInteger(value, `eventSequence[${index}]`, 0, 1));
  const catalogSequence = catalogInput.map((value, index) => boundedInteger(value, `catalogSequence[${index}]`, 0, 1));
  const permutations = boundedInteger(inputs.permutations ?? 256, "permutations", 1, 10_000);
  boundedWork(eventSequence.length * permutations, "permutation work", 2_000_000);
  const seed = boundedInteger(inputs.seed ?? 13, "seed", 0, 0xffff_ffff);
  const random = seededRandom(seed);
  const coincidence = (catalog: readonly number[]) => eventSequence.reduce((sum, event, index) => sum + event * catalog[index]!, 0);
  const observedCoincidences = coincidence(catalogSequence);
  const nullCoincidences: number[] = [];
  for (let permutation = 0; permutation < permutations; permutation += 1) {
    if ((permutation & 31) === 0) checkCancelled(options);
    const shuffled = [...catalogSequence];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap]!, shuffled[index]!];
    }
    nullCoincidences.push(coincidence(shuffled));
  }
  const nullMean = nullCoincidences.reduce((sum, value) => sum + value, 0) / nullCoincidences.length;
  const exceedances = nullCoincidences.filter((value) => value >= observedCoincidences).length;
  return result(
    "EARTH-FND-013",
    "source-contract-audit",
    "Seeded fixed-margin permutation test for coincidence between two explicitly supplied binary sequences",
    { observedCoincidences, nullCoincidences, nullMean, effectSize: observedCoincidences - nullMean, upperTailPValue: (exceedances + 1) / (permutations + 1) },
    { authenticatedCatalogsAvailable: false, selectionProtocolPreregistered: false, lookElsewhereCorrectionApplied: false },
  );
}

// EARTH-GEO-001
export interface CutAndProjectInputs {
  latticePoints?: readonly (readonly number[])[];
  parallelProjector?: readonly (readonly number[])[];
  perpendicularProjector?: readonly (readonly number[])[];
  windowMinimum?: readonly number[];
  windowMaximum?: readonly number[];
}

export const DEFAULT_CUT_AND_PROJECT_INPUTS = Object.freeze({
  latticePoints: [[0, 0, 0, 0, 0], [1, 0, 0, 0, 0], [0, 1, 0, 0, 0], [0, 0, 1, 1, 0], [0, 0, 0, 2, 0]],
  parallelProjector: [[1, 0, 0, 0, 0], [0, 1, 0, 0, 0], [0, 0, 1, 0, 0]],
  perpendicularProjector: [[0, 0, 0, 1, 0], [0, 0, 0, 0, 1]],
  windowMinimum: [-1, -1],
  windowMaximum: [1, 1],
}) satisfies CutAndProjectInputs;

function matrixVector(matrix: readonly (readonly number[])[], vector: readonly number[]): number[] {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index]!, 0));
}

export function cutAndProjectComparison(
  inputs: CutAndProjectInputs = DEFAULT_CUT_AND_PROJECT_INPUTS,
  options: EarthRunOptions = {},
): PhysicalComparatorResult<"EARTH-GEO-001", {
  accepted: Array<{ lattice: number[]; parallel: number[]; perpendicular: number[] }>;
  rejectedCount: number;
}> {
  const pointInputs = boundedList(inputs.latticePoints ?? DEFAULT_CUT_AND_PROJECT_INPUTS.latticePoints, "latticePoints", 1, 4096);
  const parallelInputs = boundedList(inputs.parallelProjector ?? DEFAULT_CUT_AND_PROJECT_INPUTS.parallelProjector, "parallelProjector", 3, 3);
  const perpendicularInputs = boundedList(inputs.perpendicularProjector ?? DEFAULT_CUT_AND_PROJECT_INPUTS.perpendicularProjector, "perpendicularProjector", 1, 5);
  const points = pointInputs.map((point, index) => checkedVector(point, `latticePoints[${index}]`, 5, 1e6));
  const parallelProjector = parallelInputs.map((row, index) => checkedVector(row, `parallelProjector[${index}]`, 5));
  const perpendicularProjector = perpendicularInputs.map((row, index) => checkedVector(row, `perpendicularProjector[${index}]`, 5));
  const dimension = perpendicularProjector.length;
  const windowMinimum = checkedVector(inputs.windowMinimum ?? DEFAULT_CUT_AND_PROJECT_INPUTS.windowMinimum, "windowMinimum", dimension);
  const windowMaximum = checkedVector(inputs.windowMaximum ?? DEFAULT_CUT_AND_PROJECT_INPUTS.windowMaximum, "windowMaximum", dimension);
  if (windowMaximum.some((value, index) => value < windowMinimum[index]!)) throw new RangeError("windowMaximum must be componentwise greater than or equal to windowMinimum");
  const accepted: Array<{ lattice: number[]; parallel: number[]; perpendicular: number[] }> = [];
  for (let index = 0; index < points.length; index += 1) {
    if ((index & 255) === 0) checkCancelled(options);
    const lattice = points[index]!;
    const perpendicular = matrixVector(perpendicularProjector, lattice);
    if (perpendicular.every((value, axis) => value >= windowMinimum[axis]! && value <= windowMaximum[axis]!)) {
      accepted.push({ lattice, parallel: matrixVector(parallelProjector, lattice), perpendicular });
    }
  }
  return result(
    "EARTH-GEO-001",
    "source-contract-audit",
    "Explicit 5D matrix projection with a user-declared axis-aligned perpendicular-space acceptance window",
    { accepted, rejectedCount: points.length - accepted.length },
    { projectorSource: "user-supplied-or-illustrative-default", earthProjectorsAvailable: false, earthWindowAvailable: false },
  );
}

// EARTH-GEO-002
export interface StructureFactorInputs {
  points?: readonly (readonly number[])[];
  waveVectors?: readonly (readonly number[])[];
  weights?: readonly number[];
}

export const DEFAULT_STRUCTURE_FACTOR_INPUTS = Object.freeze({
  points: [[0, 0, 0], [1, 0, 0]],
  waveVectors: [[0, 0, 0], [Math.PI, 0, 0], [2 * Math.PI, 0, 0]],
  weights: [1, 1],
}) satisfies StructureFactorInputs;

export function structureFactorComparison(
  inputs: StructureFactorInputs = DEFAULT_STRUCTURE_FACTOR_INPUTS,
  options: EarthRunOptions = {},
): PhysicalComparatorResult<"EARTH-GEO-002", {
  samples: Array<{ waveVector: number[]; real: number; imaginary: number; intensity: number }>;
}> {
  const pointInputs = boundedList(inputs.points ?? DEFAULT_STRUCTURE_FACTOR_INPUTS.points, "points", 1, 4096);
  const waveInputs = boundedList(inputs.waveVectors ?? DEFAULT_STRUCTURE_FACTOR_INPUTS.waveVectors, "waveVectors", 1, 4096);
  boundedWork(pointInputs.length * waveInputs.length, "structure-factor work", 2_000_000);
  const points = pointInputs.map((point, index) => checkedVector(point, `points[${index}]`, 3));
  const waveVectors = waveInputs.map((vector, index) => checkedVector(vector, `waveVectors[${index}]`, 3));
  const weightInputs = inputs.weights ?? Array.from({ length: points.length }, () => 1);
  if (!Array.isArray(weightInputs) || weightInputs.length !== points.length) throw new RangeError("weights must have one entry per point");
  const weights = weightInputs.map((weight, index) => boundedNumber(weight, `weights[${index}]`, -1e12, 1e12));
  const normalization = weights.reduce((sum, weight) => sum + weight ** 2, 0);
  if (normalization === 0) throw new RangeError("at least one weight must be non-zero");
  const samples = waveVectors.map((waveVector, waveIndex) => {
    if ((waveIndex & 63) === 0) checkCancelled(options);
    let real = 0;
    let imaginary = 0;
    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      const point = points[pointIndex]!;
      const phase = waveVector[0]! * point[0]! + waveVector[1]! * point[1]! + waveVector[2]! * point[2]!;
      real += weights[pointIndex]! * Math.cos(phase);
      imaginary += weights[pointIndex]! * Math.sin(phase);
    }
    return { waveVector, real, imaginary, intensity: (real ** 2 + imaginary ** 2) / normalization };
  });
  return result(
    "EARTH-GEO-002",
    "standard-comparison",
    "Direct finite-point structure factor S(q)=|sum_j w_j exp(i q dot r_j)|^2/sum_j w_j^2",
    { samples },
    { crystallographicDatasetAvailable: false, pointsAttributedToEarthGeo001: false },
  );
}

// EARTH-GEO-003
export interface StrandGeometryInputs {
  strandCount?: number;
  samples?: number;
  radius?: number;
  pitchPerTurn?: number;
  turns?: number;
}

export const DEFAULT_STRAND_GEOMETRY_INPUTS = Object.freeze({
  strandCount: 3,
  samples: 129,
  radius: 1,
  pitchPerTurn: 0.5,
  turns: 2,
}) satisfies StrandGeometryInputs;

type Vector3 = [number, number, number];

export function strandGeometryComparison(
  inputs: StrandGeometryInputs = DEFAULT_STRAND_GEOMETRY_INPUTS,
  options: EarthRunOptions = {},
): PhysicalComparatorResult<"EARTH-GEO-003", {
  strands: Array<{ phase: number; points: Vector3[]; polygonalLength: number }>;
  minimumSampledSeparation: number;
  closed: boolean;
}> {
  const strandCount = boundedInteger(inputs.strandCount ?? 3, "strandCount", 1, 5);
  const samples = boundedInteger(inputs.samples ?? 129, "samples", 8, 4096);
  boundedWork(strandCount * samples, "strand sampling work", 16_384);
  const radius = boundedNumber(inputs.radius ?? 1, "radius", 1e-9, 1e9);
  const pitchPerTurn = boundedNumber(inputs.pitchPerTurn ?? 0.5, "pitchPerTurn", -1e9, 1e9);
  const turns = boundedNumber(inputs.turns ?? 2, "turns", 0.01, 128);
  const strands = Array.from({ length: strandCount }, (_, strandIndex) => {
    const phase = 2 * Math.PI * strandIndex / strandCount;
    const points: Vector3[] = [];
    let polygonalLength = 0;
    for (let sample = 0; sample < samples; sample += 1) {
      if ((sample & 255) === 0) checkCancelled(options);
      const fraction = sample / (samples - 1);
      const angle = 2 * Math.PI * turns * fraction + phase;
      const point: Vector3 = [radius * Math.cos(angle), radius * Math.sin(angle), pitchPerTurn * turns * fraction];
      if (points.length > 0) {
        const previous = points[points.length - 1]!;
        polygonalLength += Math.hypot(point[0] - previous[0], point[1] - previous[1], point[2] - previous[2]);
      }
      points.push(point);
    }
    return { phase, points, polygonalLength };
  });
  let minimumSampledSeparation = Number.POSITIVE_INFINITY;
  for (let first = 0; first < strandCount; first += 1) {
    for (let second = first + 1; second < strandCount; second += 1) {
      for (let sample = 0; sample < samples; sample += 1) {
        const left = strands[first]!.points[sample]!;
        const right = strands[second]!.points[sample]!;
        minimumSampledSeparation = Math.min(minimumSampledSeparation, Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]));
      }
    }
  }
  if (strandCount === 1) minimumSampledSeparation = Number.POSITIVE_INFINITY;
  return result(
    "EARTH-GEO-003",
    "standard-comparison",
    "Uniform samples of explicitly parameterized phase-offset circular helices with polygonal lengths and same-parameter separations",
    { strands, minimumSampledSeparation, closed: pitchPerTurn === 0 && Number.isInteger(turns) },
    { knotTypeClaim: false, energyMinimumClaim: false, earthEmbeddingAvailable: false },
  );
}

// EARTH-GEO-005
export interface HopfFluxInputs {
  polarCells?: number;
  azimuthalCells?: number;
}

export const DEFAULT_HOPF_FLUX_INPUTS = Object.freeze({ polarCells: 64, azimuthalCells: 128 }) satisfies HopfFluxInputs;

export function hopfFluxComparison(
  inputs: HopfFluxInputs = DEFAULT_HOPF_FLUX_INPUTS,
  options: EarthRunOptions = {},
): PhysicalComparatorResult<"EARTH-GEO-005", {
  samples: Array<{ theta: number; phi: number; hopfImage: Vector3; berryFlux: number }>;
  totalFlux: number;
  firstChernEstimate: number;
}> {
  const polarCells = boundedInteger(inputs.polarCells ?? 64, "polarCells", 4, 512);
  const azimuthalCells = boundedInteger(inputs.azimuthalCells ?? 128, "azimuthalCells", 8, 1024);
  boundedWork(polarCells * azimuthalCells, "Hopf flux sampling work", 131_072);
  const deltaTheta = Math.PI / polarCells;
  const deltaPhi = 2 * Math.PI / azimuthalCells;
  const samples: Array<{ theta: number; phi: number; hopfImage: Vector3; berryFlux: number }> = [];
  let totalFlux = 0;
  for (let polar = 0; polar < polarCells; polar += 1) {
    checkCancelled(options);
    const theta = (polar + 0.5) * deltaTheta;
    for (let azimuthal = 0; azimuthal < azimuthalCells; azimuthal += 1) {
      const phi = (azimuthal + 0.5) * deltaPhi;
      const hopfImage: Vector3 = [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];
      const berryFlux = 0.5 * Math.sin(theta) * deltaTheta * deltaPhi;
      totalFlux += berryFlux;
      samples.push({ theta, phi, hopfImage, berryFlux });
    }
  }
  return result(
    "EARTH-GEO-005",
    "standard-comparison",
    "Midpoint sampling of the canonical CP1 spinor Hopf image and unit-monopole Berry curvature F=(1/2)sin(theta)dtheta wedge dphi",
    { samples, totalFlux, firstChernEstimate: totalFlux / (2 * Math.PI) },
    { earthMapAvailable: false, earthCrossingCellsAvailable: false, perCellEarthFluxClaim: false },
  );
}

// EARTH-FLD-002
export interface ScalarCollapseInputs {
  radialPoints?: number;
  radialMaximum?: number;
  timeStep?: number;
  steps?: number;
  initialRadius?: number;
  interfaceWidth?: number;
}

export const DEFAULT_SCALAR_COLLAPSE_INPUTS = Object.freeze({
  radialPoints: 129,
  radialMaximum: 16,
  timeStep: 0.001,
  steps: 500,
  initialRadius: 5,
  interfaceWidth: Math.SQRT2,
}) satisfies ScalarCollapseInputs;

function zeroCrossingRadius(field: readonly number[], spacing: number): number | null {
  for (let index = 0; index + 1 < field.length; index += 1) {
    const left = field[index]!;
    const right = field[index + 1]!;
    if (left === 0) return index * spacing;
    if (left * right < 0) return spacing * (index + Math.abs(left) / (Math.abs(left) + Math.abs(right)));
  }
  return null;
}

function radialScalarEnergy(field: readonly number[], spacing: number): number {
  let integral = 0;
  for (let index = 1; index + 1 < field.length; index += 1) {
    const radius = index * spacing;
    const gradient = (field[index + 1]! - field[index - 1]!) / (2 * spacing);
    const potential = 0.25 * (field[index]! ** 2 - 1) ** 2;
    integral += 2 * Math.PI * radius * (0.5 * gradient ** 2 + potential) * spacing;
  }
  return integral;
}

export function scalarCollapseComparison(
  inputs: ScalarCollapseInputs = DEFAULT_SCALAR_COLLAPSE_INPUTS,
  options: EarthRunOptions = {},
): PhysicalComparatorResult<"EARTH-FLD-002", {
  radius: number[];
  initialField: number[];
  finalField: number[];
  history: Array<{ step: number; energy: number; zeroCrossingRadius: number | null }>;
  finding: "collapsed" | "contracting" | "not-contracting";
}> {
  const radialPoints = boundedInteger(inputs.radialPoints ?? 129, "radialPoints", 17, 513);
  const radialMaximum = boundedNumber(inputs.radialMaximum ?? 16, "radialMaximum", 1e-3, 1e4);
  const steps = boundedInteger(inputs.steps ?? 500, "steps", 1, 20_000);
  boundedWork(radialPoints * steps, "scalar relaxation work", 2_000_000);
  const spacing = radialMaximum / (radialPoints - 1);
  const timeStep = boundedNumber(inputs.timeStep ?? 0.001, "timeStep", 1e-12, 0.2 * spacing ** 2);
  const initialRadius = boundedNumber(inputs.initialRadius ?? 5, "initialRadius", spacing, radialMaximum - 2 * spacing);
  const interfaceWidth = boundedNumber(inputs.interfaceWidth ?? Math.SQRT2, "interfaceWidth", spacing / 4, radialMaximum);
  checkCancelled(options);
  const radius = Array.from({ length: radialPoints }, (_, index) => index * spacing);
  let field = radius.map((radialCoordinate) => Math.tanh((radialCoordinate - initialRadius) / interfaceWidth));
  const initialField = [...field];
  const history: Array<{ step: number; energy: number; zeroCrossingRadius: number | null }> = [
    { step: 0, energy: radialScalarEnergy(field, spacing), zeroCrossingRadius: zeroCrossingRadius(field, spacing) },
  ];
  const historyStride = Math.max(1, Math.floor(steps / 100));
  for (let step = 1; step <= steps; step += 1) {
    if ((step & 31) === 0) checkCancelled(options);
    const next = [...field];
    next[0] = field[0]! + timeStep * (4 * (field[1]! - field[0]!) / spacing ** 2 - (field[0]! ** 3 - field[0]!));
    for (let index = 1; index + 1 < radialPoints; index += 1) {
      const radialCoordinate = index * spacing;
      const laplacian = (field[index + 1]! - 2 * field[index]! + field[index - 1]!) / spacing ** 2
        + (field[index + 1]! - field[index - 1]!) / (2 * spacing * radialCoordinate);
      next[index] = field[index]! + timeStep * (laplacian - (field[index]! ** 3 - field[index]!));
    }
    next[radialPoints - 1] = 1;
    field = next;
    if (step % historyStride === 0 || step === steps) {
      history.push({ step, energy: radialScalarEnergy(field, spacing), zeroCrossingRadius: zeroCrossingRadius(field, spacing) });
    }
  }
  const finalRadius = zeroCrossingRadius(field, spacing);
  const finding = finalRadius === null ? "collapsed" : finalRadius < initialRadius ? "contracting" : "not-contracting";
  return result(
    "EARTH-FLD-002",
    "standard-comparison",
    "Explicit radial gradient flow for the normalized two-dimensional Allen-Cahn energy with fixed vacuum boundary data",
    { radius, initialField, finalField: field, history, finding },
    { normalizedAllenCahnOnly: true, earthNormalizationAvailable: false, hopfChargeReported: false },
  );
}

// EARTH-FLD-003
export interface HopfEnergyInputs {
  gridPoints?: number;
  halfWidth?: number;
  sigmaCoupling?: number;
  skyrmeCoupling?: number;
}

export const DEFAULT_HOPF_ENERGY_INPUTS = Object.freeze({
  gridPoints: 13,
  halfWidth: 4,
  sigmaCoupling: 1,
  skyrmeCoupling: 1,
}) satisfies HopfEnergyInputs;

function canonicalHopfField(x: number, y: number, z: number): Vector3 {
  const denominator = x ** 2 + y ** 2 + z ** 2 + 1;
  const z1Re = 2 * x / denominator;
  const z1Im = 2 * y / denominator;
  const z2Re = 2 * z / denominator;
  const z2Im = (x ** 2 + y ** 2 + z ** 2 - 1) / denominator;
  return [
    2 * (z1Re * z2Re + z1Im * z2Im),
    2 * (z1Im * z2Re - z1Re * z2Im),
    z1Re ** 2 + z1Im ** 2 - z2Re ** 2 - z2Im ** 2,
  ];
}

function vectorDifference(left: Vector3, right: Vector3, denominator: number): Vector3 {
  return scale3(sub3(left, right), 1 / denominator) as Vector3;
}

export function hopfEnergyComparison(
  inputs: HopfEnergyInputs = DEFAULT_HOPF_ENERGY_INPUTS,
  options: EarthRunOptions = {},
): PhysicalComparatorResult<"EARTH-FLD-003", {
  spacing: number;
  sampledInteriorPoints: number;
  sigmaEnergy: number;
  skyrmeEnergy: number;
  totalEnergy: number;
  maximumUnitNormResidual: number;
}> {
  const gridPoints = boundedInteger(inputs.gridPoints ?? 13, "gridPoints", 7, 41);
  boundedWork(gridPoints ** 3, "Hopf energy sampling work", 68_921);
  const halfWidth = boundedNumber(inputs.halfWidth ?? 4, "halfWidth", 0.25, 100);
  const sigmaCoupling = boundedNumber(inputs.sigmaCoupling ?? 1, "sigmaCoupling", 0, 1e6);
  const skyrmeCoupling = boundedNumber(inputs.skyrmeCoupling ?? 1, "skyrmeCoupling", 0, 1e6);
  if (sigmaCoupling === 0 && skyrmeCoupling === 0) throw new RangeError("at least one Hopf energy coupling must be positive");
  const spacing = 2 * halfWidth / (gridPoints - 1);
  const coordinates = linearSamples(-halfWidth, halfWidth, gridPoints);
  let sigmaIntegral = 0;
  let skyrmeIntegral = 0;
  let maximumUnitNormResidual = 0;
  let sampledInteriorPoints = 0;
  for (let ix = 1; ix + 1 < gridPoints; ix += 1) {
    checkCancelled(options);
    for (let iy = 1; iy + 1 < gridPoints; iy += 1) {
      for (let iz = 1; iz + 1 < gridPoints; iz += 1) {
        const x = coordinates[ix]!;
        const y = coordinates[iy]!;
        const z = coordinates[iz]!;
        const value = canonicalHopfField(x, y, z);
        maximumUnitNormResidual = Math.max(maximumUnitNormResidual, Math.abs(Math.hypot(...value) - 1));
        const dx = vectorDifference(canonicalHopfField(x + spacing, y, z), canonicalHopfField(x - spacing, y, z), 2 * spacing);
        const dy = vectorDifference(canonicalHopfField(x, y + spacing, z), canonicalHopfField(x, y - spacing, z), 2 * spacing);
        const dz = vectorDifference(canonicalHopfField(x, y, z + spacing), canonicalHopfField(x, y, z - spacing), 2 * spacing);
        sigmaIntegral += 0.5 * (dot3(dx, dx) + dot3(dy, dy) + dot3(dz, dz));
        skyrmeIntegral += 0.5 * (dot3(cross3(dx, dy), cross3(dx, dy)) + dot3(cross3(dy, dz), cross3(dy, dz)) + dot3(cross3(dz, dx), cross3(dz, dx)));
        sampledInteriorPoints += 1;
      }
    }
  }
  const volumeElement = spacing ** 3;
  const sigmaEnergy = sigmaCoupling * sigmaIntegral * volumeElement;
  const skyrmeEnergy = skyrmeCoupling * skyrmeIntegral * volumeElement;
  return result(
    "EARTH-FLD-003",
    "standard-comparison",
    "Central-difference sigma and Skyrme energy sampling of the canonical unit Hopf map obtained by inverse stereographic projection",
    { spacing, sampledInteriorPoints, sigmaEnergy, skyrmeEnergy, totalEnergy: sigmaEnergy + skyrmeEnergy, maximumUnitNormResidual },
    { canonicalComparisonMapOnly: true, relaxedSolutionClaim: false, earthActionClaim: false },
  );
}

// EARTH-FLD-004
export interface FiniteDifferenceHessianInputs {
  objective?: (coordinates: readonly number[]) => number;
  point?: readonly number[];
  step?: number;
}

const DEFAULT_HESSIAN_OBJECTIVE = (coordinates: readonly number[]) => coordinates[0]! ** 2 + 2 * coordinates[1]! ** 2;

export const DEFAULT_FINITE_DIFFERENCE_HESSIAN_INPUTS = Object.freeze({
  objective: DEFAULT_HESSIAN_OBJECTIVE,
  point: [0, 0],
  step: 1e-3,
}) satisfies FiniteDifferenceHessianInputs;

export function finiteDifferenceHessianAudit(
  inputs: FiniteDifferenceHessianInputs = DEFAULT_FINITE_DIFFERENCE_HESSIAN_INPUTS,
  options: EarthRunOptions = {},
): PhysicalComparatorResult<"EARTH-FLD-004", {
  point: number[];
  objectiveValue: number;
  hessian: number[][];
  diagonal: number[];
  gershgorinBounds: [number, number];
}> {
  const objective = inputs.objective ?? DEFAULT_HESSIAN_OBJECTIVE;
  if (typeof objective !== "function") throw new TypeError("objective must be a function");
  const pointInput = boundedList(inputs.point ?? DEFAULT_FINITE_DIFFERENCE_HESSIAN_INPUTS.point, "point", 1, 32);
  const point = pointInput.map((value, index) => boundedNumber(value, `point[${index}]`, -1e100, 1e100));
  const step = boundedNumber(inputs.step ?? 1e-3, "step", 1e-10, 1);
  boundedWork(point.length ** 2, "Hessian work", 1024);
  const evaluate = (coordinates: number[], label: string): number => {
    checkCancelled(options);
    return finiteNumber(objective(coordinates), label);
  };
  const objectiveValue = evaluate([...point], "objective(point)");
  const hessian = point.map(() => point.map(() => 0));
  for (let row = 0; row < point.length; row += 1) {
    const plus = [...point];
    const minus = [...point];
    plus[row]! += step;
    minus[row]! -= step;
    hessian[row]![row] = (evaluate(plus, "objective diagonal plus") - 2 * objectiveValue + evaluate(minus, "objective diagonal minus")) / step ** 2;
    for (let column = row + 1; column < point.length; column += 1) {
      const plusPlus = [...point];
      const plusMinus = [...point];
      const minusPlus = [...point];
      const minusMinus = [...point];
      plusPlus[row]! += step; plusPlus[column]! += step;
      plusMinus[row]! += step; plusMinus[column]! -= step;
      minusPlus[row]! -= step; minusPlus[column]! += step;
      minusMinus[row]! -= step; minusMinus[column]! -= step;
      const value = (evaluate(plusPlus, "objective mixed plus-plus") - evaluate(plusMinus, "objective mixed plus-minus")
        - evaluate(minusPlus, "objective mixed minus-plus") + evaluate(minusMinus, "objective mixed minus-minus")) / (4 * step ** 2);
      hessian[row]![column] = value;
      hessian[column]![row] = value;
    }
  }
  let lower = Number.POSITIVE_INFINITY;
  let upper = Number.NEGATIVE_INFINITY;
  for (let row = 0; row < hessian.length; row += 1) {
    const radius = hessian[row]!.reduce((sum, value, column) => sum + (column === row ? 0 : Math.abs(value)), 0);
    lower = Math.min(lower, hessian[row]![row]! - radius);
    upper = Math.max(upper, hessian[row]![row]! + radius);
  }
  return result(
    "EARTH-FLD-004",
    "source-contract-audit",
    "Symmetric central finite-difference Hessian of an explicitly supplied scalar objective with Gershgorin spectral bounds",
    { point, objectiveValue, hessian, diagonal: hessian.map((row, index) => row[index]!), gershgorinBounds: [lower, upper] },
    { solvedEarthBackgroundAvailable: false, gaugeModesClassified: false, eigenvalueClaim: false },
  );
}

// EARTH-FLD-009
export interface ElasticLayer {
  density: number;
  modulus: number;
  thickness: number;
}

export interface LayeredElasticWaveInputs {
  layers?: readonly ElasticLayer[];
  frequencies?: readonly number[];
  incidentImpedance?: number;
  loadImpedance?: number;
}

export const DEFAULT_LAYERED_ELASTIC_WAVE_INPUTS = Object.freeze({
  layers: [{ density: 1, modulus: 4, thickness: 1 }, { density: 2, modulus: 8, thickness: 0.5 }],
  frequencies: [0.1, 0.5, 1],
  incidentImpedance: 2,
  loadImpedance: 4,
}) satisfies LayeredElasticWaveInputs;

interface Complex {
  re: number;
  im: number;
}

function complexAdd(left: Complex, right: Complex): Complex {
  return { re: left.re + right.re, im: left.im + right.im };
}

function complexMultiply(left: Complex, right: Complex): Complex {
  return { re: left.re * right.re - left.im * right.im, im: left.re * right.im + left.im * right.re };
}

function complexDivide(left: Complex, right: Complex): Complex {
  const denominator = right.re ** 2 + right.im ** 2;
  if (denominator === 0) throw new RangeError("elastic transfer denominator is zero");
  return { re: (left.re * right.re + left.im * right.im) / denominator, im: (left.im * right.re - left.re * right.im) / denominator };
}

type ComplexMatrix2 = [[Complex, Complex], [Complex, Complex]];

function multiplyComplexMatrices(left: ComplexMatrix2, right: ComplexMatrix2): ComplexMatrix2 {
  return [
    [complexAdd(complexMultiply(left[0][0], right[0][0]), complexMultiply(left[0][1], right[1][0])), complexAdd(complexMultiply(left[0][0], right[0][1]), complexMultiply(left[0][1], right[1][1]))],
    [complexAdd(complexMultiply(left[1][0], right[0][0]), complexMultiply(left[1][1], right[1][0])), complexAdd(complexMultiply(left[1][0], right[0][1]), complexMultiply(left[1][1], right[1][1]))],
  ];
}

export function layeredElasticWaveComparison(
  inputs: LayeredElasticWaveInputs = DEFAULT_LAYERED_ELASTIC_WAVE_INPUTS,
  options: EarthRunOptions = {},
): PhysicalComparatorResult<"EARTH-FLD-009", {
  layers: Array<ElasticLayer & { waveSpeed: number; impedance: number }>;
  effectiveTravelTimeSpeed: number;
  spectrum: Array<{ frequency: number; inputImpedance: Complex; reflectionAmplitude: Complex; reflectance: number; transmittance: number }>;
}> {
  const layerInputs = boundedList(inputs.layers ?? DEFAULT_LAYERED_ELASTIC_WAVE_INPUTS.layers, "layers", 1, 128);
  const frequencyInputs = boundedList(inputs.frequencies ?? DEFAULT_LAYERED_ELASTIC_WAVE_INPUTS.frequencies, "frequencies", 1, 2048);
  boundedWork(layerInputs.length * frequencyInputs.length, "elastic transfer work", 262_144);
  const layers = layerInputs.map((layer, index) => {
    const density = boundedNumber(layer.density, `layers[${index}].density`, 1e-12, 1e12);
    const modulus = boundedNumber(layer.modulus, `layers[${index}].modulus`, 1e-12, 1e18);
    const thickness = boundedNumber(layer.thickness, `layers[${index}].thickness`, 1e-12, 1e9);
    return { density, modulus, thickness, waveSpeed: Math.sqrt(modulus / density), impedance: Math.sqrt(modulus * density) };
  });
  const frequencies = frequencyInputs.map((frequency, index) => boundedNumber(frequency, `frequencies[${index}]`, 0, 1e12));
  const incidentImpedance = boundedNumber(inputs.incidentImpedance ?? 2, "incidentImpedance", 1e-12, 1e18);
  const loadImpedance = boundedNumber(inputs.loadImpedance ?? 4, "loadImpedance", 1e-12, 1e18);
  const totalThickness = layers.reduce((sum, layer) => sum + layer.thickness, 0);
  const effectiveTravelTimeSpeed = totalThickness / layers.reduce((sum, layer) => sum + layer.thickness / layer.waveSpeed, 0);
  const spectrum = frequencies.map((frequency, frequencyIndex) => {
    if ((frequencyIndex & 63) === 0) checkCancelled(options);
    let transfer: ComplexMatrix2 = [[{ re: 1, im: 0 }, { re: 0, im: 0 }], [{ re: 0, im: 0 }, { re: 1, im: 0 }]];
    for (const layer of layers) {
      const phase = 2 * Math.PI * frequency * layer.thickness / layer.waveSpeed;
      const cosine = Math.cos(phase);
      const sine = Math.sin(phase);
      transfer = multiplyComplexMatrices(transfer, [
        [{ re: cosine, im: 0 }, { re: 0, im: layer.impedance * sine }],
        [{ re: 0, im: sine / layer.impedance }, { re: cosine, im: 0 }],
      ]);
    }
    const inputImpedance = complexDivide(
      complexAdd(complexMultiply(transfer[0][0], { re: loadImpedance, im: 0 }), transfer[0][1]),
      complexAdd(complexMultiply(transfer[1][0], { re: loadImpedance, im: 0 }), transfer[1][1]),
    );
    const reflectionAmplitude = complexDivide(
      { re: inputImpedance.re - incidentImpedance, im: inputImpedance.im },
      { re: inputImpedance.re + incidentImpedance, im: inputImpedance.im },
    );
    const reflectance = reflectionAmplitude.re ** 2 + reflectionAmplitude.im ** 2;
    return { frequency, inputImpedance, reflectionAmplitude, reflectance, transmittance: Math.max(0, 1 - reflectance) };
  });
  return result(
    "EARTH-FLD-009",
    "standard-comparison",
    "Lossless scalar 1D longitudinal-wave transfer matrices for explicitly supplied isotropic elastic layers",
    { layers, effectiveTravelTimeSpeed, spectrum },
    { earthElasticTensorAvailable: false, grainLawAvailable: false, polarizationClaim: false, attenuationModelIncluded: false },
  );
}

// EARTH-NUC-002
export interface NuclearMassRecord {
  id: string;
  protonNumber: number;
  neutronNumber: number;
  predictedMass: number;
  observedMass: number;
  observedUncertainty?: number;
}

export interface NuclearMassResidualInputs {
  records?: readonly NuclearMassRecord[];
}

export const DEFAULT_NUCLEAR_MASS_RESIDUAL_INPUTS = Object.freeze({
  records: [{ id: "dimensionless-self-check", protonNumber: 1, neutronNumber: 0, predictedMass: 1, observedMass: 1, observedUncertainty: 0.01 }],
}) satisfies NuclearMassResidualInputs;

export function nuclearMassResidualAudit(
  inputs: NuclearMassResidualInputs = DEFAULT_NUCLEAR_MASS_RESIDUAL_INPUTS,
  options: EarthRunOptions = {},
): PhysicalComparatorResult<"EARTH-NUC-002", {
  records: Array<NuclearMassRecord & { massNumber: number; residual: number; relativeResidual: number; standardizedResidual: number | null }>;
  rmsResidual: number;
}> {
  const recordInputs = boundedList(inputs.records ?? DEFAULT_NUCLEAR_MASS_RESIDUAL_INPUTS.records, "records", 1, 4096);
  const ids = new Set<string>();
  const records = recordInputs.map((record, index) => {
    if ((index & 255) === 0) checkCancelled(options);
    const id = boundedText(record.id, `records[${index}].id`);
    if (ids.has(id)) throw new RangeError(`record id must be unique: ${id}`);
    ids.add(id);
    const protonNumber = boundedInteger(record.protonNumber, `records[${index}].protonNumber`, 0, 200);
    const neutronNumber = boundedInteger(record.neutronNumber, `records[${index}].neutronNumber`, 0, 400);
    if (protonNumber + neutronNumber === 0) throw new RangeError(`records[${index}] must contain at least one nucleon`);
    const predictedMass = boundedNumber(record.predictedMass, `records[${index}].predictedMass`, 1e-30, 1e12);
    const observedMass = boundedNumber(record.observedMass, `records[${index}].observedMass`, 1e-30, 1e12);
    const observedUncertainty = record.observedUncertainty === undefined
      ? undefined
      : boundedNumber(record.observedUncertainty, `records[${index}].observedUncertainty`, Number.MIN_VALUE, 1e12);
    const residual = predictedMass - observedMass;
    return {
      id,
      protonNumber,
      neutronNumber,
      predictedMass,
      observedMass,
      ...(observedUncertainty === undefined ? {} : { observedUncertainty }),
      massNumber: protonNumber + neutronNumber,
      residual,
      relativeResidual: relativeResidual(predictedMass, observedMass),
      standardizedResidual: observedUncertainty === undefined ? null : residual / observedUncertainty,
    };
  });
  const rmsResidual = Math.sqrt(records.reduce((sum, record) => sum + record.residual ** 2, 0) / records.length);
  return result(
    "EARTH-NUC-002",
    "source-contract-audit",
    "Residual and uncertainty-normalized comparison of explicitly supplied predicted and observed nuclear masses",
    { records, rmsResidual },
    { earthTopologyMappingAvailable: false, earthPairingFunctionAvailable: false, ameDatasetBundled: false },
  );
}

// EARTH-NUC-003
export interface WkbBarrierInputs {
  positions?: readonly number[];
  potential?: readonly number[];
  energy?: number;
  reducedMass?: number;
  hbar?: number;
  assaultFrequency?: number;
}

export const DEFAULT_WKB_BARRIER_INPUTS = Object.freeze({
  positions: [0, 0.5, 1, 1.5, 2],
  potential: [0, 2, 2, 2, 0],
  energy: 1,
  reducedMass: 1,
  hbar: 1,
}) satisfies WkbBarrierInputs;

export function wkbBarrierComparison(
  inputs: WkbBarrierInputs = DEFAULT_WKB_BARRIER_INPUTS,
  options: EarthRunOptions = {},
): PhysicalComparatorResult<"EARTH-NUC-003", {
  actionIntegral: number;
  transmission: number;
  decayRate: number | null;
  halfLife: number | null;
  forbiddenSegmentCount: number;
}> {
  const positionInputs = boundedList(inputs.positions ?? DEFAULT_WKB_BARRIER_INPUTS.positions, "positions", 3, 4096);
  const potentialInputs = boundedList(inputs.potential ?? DEFAULT_WKB_BARRIER_INPUTS.potential, "potential", 3, 4096);
  if (positionInputs.length !== potentialInputs.length) throw new RangeError("positions and potential must have equal lengths");
  const positions = positionInputs.map((value, index) => boundedNumber(value, `positions[${index}]`, -1e100, 1e100));
  const potential = potentialInputs.map((value, index) => boundedNumber(value, `potential[${index}]`, -1e100, 1e100));
  for (let index = 1; index < positions.length; index += 1) {
    if (positions[index]! <= positions[index - 1]!) throw new RangeError("positions must be strictly increasing");
  }
  const energy = boundedNumber(inputs.energy ?? 1, "energy", -1e100, 1e100);
  const reducedMass = boundedNumber(inputs.reducedMass ?? 1, "reducedMass", 1e-100, 1e100);
  const hbar = boundedNumber(inputs.hbar ?? 1, "hbar", 1e-100, 1e100);
  const assaultFrequency = inputs.assaultFrequency === undefined
    ? null
    : boundedNumber(inputs.assaultFrequency, "assaultFrequency", 1e-100, 1e100);
  let actionIntegral = 0;
  let forbiddenSegmentCount = 0;
  for (let index = 0; index + 1 < positions.length; index += 1) {
    if ((index & 255) === 0) checkCancelled(options);
    const leftKappa = Math.sqrt(2 * reducedMass * Math.max(0, potential[index]! - energy)) / hbar;
    const rightKappa = Math.sqrt(2 * reducedMass * Math.max(0, potential[index + 1]! - energy)) / hbar;
    if (leftKappa > 0 || rightKappa > 0) forbiddenSegmentCount += 1;
    actionIntegral += 0.5 * (leftKappa + rightKappa) * (positions[index + 1]! - positions[index]!);
  }
  if (!Number.isFinite(actionIntegral)) throw new RangeError("WKB action is non-finite for the supplied units");
  const transmission = Math.exp(-2 * actionIntegral);
  const decayRate = assaultFrequency === null ? null : assaultFrequency * transmission;
  return result(
    "EARTH-NUC-003",
    "standard-comparison",
    "Trapezoidal WKB forbidden-region action for an explicitly supplied one-dimensional barrier in consistent user units",
    { actionIntegral, transmission, decayRate, halfLife: decayRate === null || decayRate === 0 ? null : Math.log(2) / decayRate, forbiddenSegmentCount },
    { earthBarrierAvailable: false, earthRateLawAvailable: false, weakTransitionOperatorAvailable: false, prefactorSupplied: assaultFrequency !== null },
  );
}

// EARTH-NUC-005
export interface HadronObservableRecord {
  id: string;
  observable: string;
  unit: string;
  predicted?: number;
  observed?: number;
  uncertainty?: number;
}

export interface HadronObservableAuditInputs {
  records?: readonly HadronObservableRecord[];
}

const DEFAULT_HADRON_OBSERVABLE_RECORDS: readonly HadronObservableRecord[] = [
  { id: "radius-contract-placeholder", observable: "radius", unit: "user-unit" },
];

export const DEFAULT_HADRON_OBSERVABLE_AUDIT_INPUTS: HadronObservableAuditInputs = Object.freeze({
  records: DEFAULT_HADRON_OBSERVABLE_RECORDS,
});

export function hadronObservableContractAudit(
  inputs: HadronObservableAuditInputs = DEFAULT_HADRON_OBSERVABLE_AUDIT_INPUTS,
  options: EarthRunOptions = {},
): PhysicalComparatorResult<"EARTH-NUC-005", {
  records: Array<HadronObservableRecord & { requirementsSatisfied: boolean; residual: number | null; standardizedResidual: number | null }>;
  unsatisfiedRequirements: string[];
}> {
  const recordInputs = boundedList(inputs.records ?? DEFAULT_HADRON_OBSERVABLE_RECORDS, "records", 1, 2048);
  const ids = new Set<string>();
  const records = recordInputs.map((record, index) => {
    if ((index & 255) === 0) checkCancelled(options);
    const id = boundedText(record.id, `records[${index}].id`);
    if (ids.has(id)) throw new RangeError(`record id must be unique: ${id}`);
    ids.add(id);
    const observable = boundedText(record.observable, `records[${index}].observable`);
    const unit = boundedText(record.unit, `records[${index}].unit`);
    const predicted = record.predicted === undefined ? undefined : boundedNumber(record.predicted, `records[${index}].predicted`, -1e100, 1e100);
    const observed = record.observed === undefined ? undefined : boundedNumber(record.observed, `records[${index}].observed`, -1e100, 1e100);
    const uncertainty = record.uncertainty === undefined ? undefined : boundedNumber(record.uncertainty, `records[${index}].uncertainty`, Number.MIN_VALUE, 1e100);
    const residual = predicted === undefined || observed === undefined ? null : predicted - observed;
    return {
      id,
      observable,
      unit,
      ...(predicted === undefined ? {} : { predicted }),
      ...(observed === undefined ? {} : { observed }),
      ...(uncertainty === undefined ? {} : { uncertainty }),
      requirementsSatisfied: predicted !== undefined && observed !== undefined,
      residual,
      standardizedResidual: residual === null || uncertainty === undefined ? null : residual / uncertainty,
    };
  });
  const unsatisfiedRequirements = [
    "valid finite-energy action",
    "charge/current observable",
    "finite-energy boundary conditions",
    "nonlinear solved background",
    "frozen hadron extension rule",
  ];
  return result(
    "EARTH-NUC-005",
    "source-contract-audit",
    "Schema and residual audit of a user-supplied hadron observable table; no field or parton observable is generated",
    { records, unsatisfiedRequirements },
    { physicalFieldOutputProduced: false, modelContractSatisfied: false, unsatisfiedRequirementCount: unsatisfiedRequirements.length },
  );
}

// EARTH-PRT-002
export interface RadialLoopPotentialInputs {
  radii?: readonly number[];
  potential?: readonly number[];
}

export const DEFAULT_RADIAL_LOOP_POTENTIAL_INPUTS = Object.freeze({
  radii: [0.5, 1, 1.5, 2, 2.5],
  potential: [2.25, 1, 0.25, 0, 0.25],
}) satisfies RadialLoopPotentialInputs;

export function radialLoopPotentialComparison(
  inputs: RadialLoopPotentialInputs = DEFAULT_RADIAL_LOOP_POTENTIAL_INPUTS,
  options: EarthRunOptions = {},
): PhysicalComparatorResult<"EARTH-PRT-002", {
  sampledMinimum: { index: number; radius: number; potential: number };
  quadraticMinimum: { radius: number; potential: number; curvature: number } | null;
  boundaryMinimum: boolean;
}> {
  const radiusInputs = boundedList(inputs.radii ?? DEFAULT_RADIAL_LOOP_POTENTIAL_INPUTS.radii, "radii", 3, 16_384);
  const potentialInputs = boundedList(inputs.potential ?? DEFAULT_RADIAL_LOOP_POTENTIAL_INPUTS.potential, "potential", 3, 16_384);
  if (radiusInputs.length !== potentialInputs.length) throw new RangeError("radii and potential must have equal lengths");
  checkCancelled(options);
  const radii = radiusInputs.map((value, index) => boundedNumber(value, `radii[${index}]`, 1e-100, 1e100));
  const potential = potentialInputs.map((value, index) => boundedNumber(value, `potential[${index}]`, -1e100, 1e100));
  for (let index = 1; index < radii.length; index += 1) {
    if ((index & 1023) === 0) checkCancelled(options);
    if (radii[index]! <= radii[index - 1]!) throw new RangeError("radii must be strictly increasing");
  }
  let minimumIndex = 0;
  for (let index = 1; index < potential.length; index += 1) if (potential[index]! < potential[minimumIndex]!) minimumIndex = index;
  const sampledMinimum = { index: minimumIndex, radius: radii[minimumIndex]!, potential: potential[minimumIndex]! };
  const boundaryMinimum = minimumIndex === 0 || minimumIndex === radii.length - 1;
  let quadraticMinimum: { radius: number; potential: number; curvature: number } | null = null;
  if (!boundaryMinimum) {
    const x1 = radii[minimumIndex - 1]!;
    const x2 = radii[minimumIndex]!;
    const x3 = radii[minimumIndex + 1]!;
    const y1 = potential[minimumIndex - 1]!;
    const y2 = potential[minimumIndex]!;
    const y3 = potential[minimumIndex + 1]!;
    const slope12 = (y2 - y1) / (x2 - x1);
    const slope23 = (y3 - y2) / (x3 - x2);
    const curvature = 2 * (slope23 - slope12) / (x3 - x1);
    if (curvature > 0) {
      const linearCoefficient = slope12 - 0.5 * curvature * (x1 + x2);
      const radius = -linearCoefficient / curvature;
      if (radius >= x1 && radius <= x3) {
        const constant = y1 - 0.5 * curvature * x1 ** 2 - linearCoefficient * x1;
        quadraticMinimum = { radius, potential: 0.5 * curvature * radius ** 2 + linearCoefficient * radius + constant, curvature };
      }
    }
  }
  return result(
    "EARTH-PRT-002",
    "source-contract-audit",
    "Discrete minimum and local three-point quadratic interpolation of an explicitly supplied radial loop potential",
    { sampledMinimum, quadraticMinimum, boundaryMinimum },
    { earthPotentialAvailable: false, equilibriumAttributedToEarth: false, excitationSpectrumClaim: false },
  );
}

// EARTH-PRT-003
export interface KinkEigenmodeInputs {
  samples?: number;
  halfWidth?: number;
}

export const DEFAULT_KINK_EIGENMODE_INPUTS = Object.freeze({ samples: 513, halfWidth: 10 }) satisfies KinkEigenmodeInputs;

function normalizeMode(values: number[], spacing: number): number[] {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value ** 2 * spacing, 0));
  return values.map((value) => value / norm);
}

export function kinkEigenmodeComparison(
  inputs: KinkEigenmodeInputs = DEFAULT_KINK_EIGENMODE_INPUTS,
  options: EarthRunOptions = {},
): PhysicalComparatorResult<"EARTH-PRT-003", {
  coordinates: number[];
  kink: number[];
  potential: number[];
  modes: Array<{ name: "translation" | "shape"; analyticEigenvalue: number; rayleighEigenvalue: number; residual: number; eigenfunction: number[] }>;
  continuumThreshold: number;
}> {
  const samples = boundedInteger(inputs.samples ?? 513, "samples", 33, 4097);
  const halfWidth = boundedNumber(inputs.halfWidth ?? 10, "halfWidth", 4, 40);
  checkCancelled(options);
  const coordinates = linearSamples(-halfWidth, halfWidth, samples);
  const spacing = coordinates[1]! - coordinates[0]!;
  const kink = coordinates.map(Math.tanh);
  const potential = coordinates.map((coordinate) => 4 - 6 / Math.cosh(coordinate) ** 2);
  const rawModes = [
    { name: "translation" as const, analyticEigenvalue: 0, values: coordinates.map((coordinate) => 1 / Math.cosh(coordinate) ** 2) },
    { name: "shape" as const, analyticEigenvalue: 3, values: coordinates.map((coordinate) => Math.sinh(coordinate) / Math.cosh(coordinate) ** 2) },
  ];
  const modes = rawModes.map(({ name, analyticEigenvalue, values }) => {
    checkCancelled(options);
    const eigenfunction = normalizeMode(values, spacing);
    let numerator = 0;
    let denominator = 0;
    for (let index = 1; index + 1 < samples; index += 1) {
      if ((index & 1023) === 0) checkCancelled(options);
      const applied = -(eigenfunction[index + 1]! - 2 * eigenfunction[index]! + eigenfunction[index - 1]!) / spacing ** 2
        + potential[index]! * eigenfunction[index]!;
      numerator += eigenfunction[index]! * applied * spacing;
      denominator += eigenfunction[index]! ** 2 * spacing;
    }
    const rayleighEigenvalue = numerator / denominator;
    return { name, analyticEigenvalue, rayleighEigenvalue, residual: rayleighEigenvalue - analyticEigenvalue, eigenfunction };
  });
  return result(
    "EARTH-PRT-003",
    "standard-comparison",
    "Finite-difference Rayleigh checks of the canonical dimensionless phi-four kink translation and shape eigenmodes",
    { coordinates, kink, potential, modes, continuumThreshold: 4 },
    { earthNormalizationAvailable: false, fractionalWindingMechanismAvailable: false, earthParticleMassClaim: false },
  );
}

// EARTH-PRT-004
export interface DispersionPoint {
  waveNumber: number;
  omegaSquared: number;
}

export interface DispersionAuditInputs {
  points?: readonly DispersionPoint[];
}

export const DEFAULT_DISPERSION_AUDIT_INPUTS = Object.freeze({
  points: [{ waveNumber: 0, omegaSquared: 1 }, { waveNumber: 1, omegaSquared: 2 }, { waveNumber: 2, omegaSquared: 5 }],
}) satisfies DispersionAuditInputs;

export function dispersionContractAudit(
  inputs: DispersionAuditInputs = DEFAULT_DISPERSION_AUDIT_INPUTS,
  options: EarthRunOptions = {},
): PhysicalComparatorResult<"EARTH-PRT-004", {
  points: Array<DispersionPoint & { omega: number | null; stable: boolean; groupVelocity: number | null }>;
  unstableCount: number;
  unsatisfiedRequirements: string[];
}> {
  const pointInputs = boundedList(inputs.points ?? DEFAULT_DISPERSION_AUDIT_INPUTS.points, "points", 2, 16_384);
  checkCancelled(options);
  const checked = pointInputs.map((point, index) => ({
    waveNumber: boundedNumber(point.waveNumber, `points[${index}].waveNumber`, -1e12, 1e12),
    omegaSquared: boundedNumber(point.omegaSquared, `points[${index}].omegaSquared`, -1e100, 1e100),
  }));
  for (let index = 1; index < checked.length; index += 1) {
    if ((index & 1023) === 0) checkCancelled(options);
    if (checked[index]!.waveNumber <= checked[index - 1]!.waveNumber) throw new RangeError("wave numbers must be strictly increasing");
  }
  const frequencies = checked.map(({ omegaSquared }) => omegaSquared < 0 ? null : Math.sqrt(omegaSquared));
  const points = checked.map((point, index) => {
    const left = Math.max(0, index - 1);
    const right = Math.min(checked.length - 1, index + 1);
    const groupVelocity = frequencies[index] === null || frequencies[left] === null || frequencies[right] === null || left === right
      ? null
      : (frequencies[right]! - frequencies[left]!) / (checked[right]!.waveNumber - checked[left]!.waveNumber);
    return { ...point, omega: frequencies[index]!, stable: point.omegaSquared >= 0, groupVelocity };
  });
  const unsatisfiedRequirements = ["solved EARTH field background", "declared gauge constraints", "physical polarization normalization"];
  return result(
    "EARTH-PRT-004",
    "source-contract-audit",
    "Stability and finite-difference group-velocity audit of an explicitly supplied omega-squared dispersion table",
    { points, unstableCount: points.filter(({ stable }) => !stable).length, unsatisfiedRequirements },
    { physicalSpectrumProduced: false, earthBackgroundAvailable: false, gaugeModelAvailable: false },
  );
}

export const EARTH_PHYSICAL_COMPARATOR_DEFAULTS = {
  "EARTH-FND-009": DEFAULT_GOLDEN_SCALE_RESIDUAL_INPUTS,
  "EARTH-FND-012": DEFAULT_WEIGHTED_GRAPH_METRIC_INPUTS,
  "EARTH-FND-013": DEFAULT_EVENT_COINCIDENCE_PERMUTATION_INPUTS,
  "EARTH-GEO-001": DEFAULT_CUT_AND_PROJECT_INPUTS,
  "EARTH-GEO-002": DEFAULT_STRUCTURE_FACTOR_INPUTS,
  "EARTH-GEO-003": DEFAULT_STRAND_GEOMETRY_INPUTS,
  "EARTH-GEO-005": DEFAULT_HOPF_FLUX_INPUTS,
  "EARTH-FLD-002": DEFAULT_SCALAR_COLLAPSE_INPUTS,
  "EARTH-FLD-003": DEFAULT_HOPF_ENERGY_INPUTS,
  "EARTH-FLD-004": DEFAULT_FINITE_DIFFERENCE_HESSIAN_INPUTS,
  "EARTH-FLD-009": DEFAULT_LAYERED_ELASTIC_WAVE_INPUTS,
  "EARTH-NUC-002": DEFAULT_NUCLEAR_MASS_RESIDUAL_INPUTS,
  "EARTH-NUC-003": DEFAULT_WKB_BARRIER_INPUTS,
  "EARTH-NUC-005": DEFAULT_HADRON_OBSERVABLE_AUDIT_INPUTS,
  "EARTH-PRT-002": DEFAULT_RADIAL_LOOP_POTENTIAL_INPUTS,
  "EARTH-PRT-003": DEFAULT_KINK_EIGENMODE_INPUTS,
  "EARTH-PRT-004": DEFAULT_DISPERSION_AUDIT_INPUTS,
} as const;

export const EARTH_PHYSICAL_COMPARATORS = {
  "EARTH-FND-009": goldenScaleResidualAudit,
  "EARTH-FND-012": weightedGraphMetricAudit,
  "EARTH-FND-013": eventCoincidencePermutationAudit,
  "EARTH-GEO-001": cutAndProjectComparison,
  "EARTH-GEO-002": structureFactorComparison,
  "EARTH-GEO-003": strandGeometryComparison,
  "EARTH-GEO-005": hopfFluxComparison,
  "EARTH-FLD-002": scalarCollapseComparison,
  "EARTH-FLD-003": hopfEnergyComparison,
  "EARTH-FLD-004": finiteDifferenceHessianAudit,
  "EARTH-FLD-009": layeredElasticWaveComparison,
  "EARTH-NUC-002": nuclearMassResidualAudit,
  "EARTH-NUC-003": wkbBarrierComparison,
  "EARTH-NUC-005": hadronObservableContractAudit,
  "EARTH-PRT-002": radialLoopPotentialComparison,
  "EARTH-PRT-003": kinkEigenmodeComparison,
  "EARTH-PRT-004": dispersionContractAudit,
} as const;
