import {
  boundedInteger,
  boundedNumber,
  checkCancelled,
  finiteNumber,
  type EarthKernelResult,
  type EarthRunOptions,
} from "./common.js";

type DataScope = "synthetic" | "deidentified-aggregate";

function addIndexed(values: number[], index: number, delta: number): void {
  values[index] = values[index]! + delta;
}

function addIndexedMatrix(matrix: number[][], row: number, column: number, delta: number): void {
  addIndexed(matrix[row]!, column, delta);
}

function boundedList<T>(value: T[], name: string, minimum: number, maximum: number): T[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new RangeError(`${name} must contain ${minimum} to ${maximum} entries`);
  }
  return value;
}

function boundedText(value: string, name: string, maximum = 128): string {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} is required`);
  if (value.length > maximum) throw new RangeError(`${name} must contain at most ${maximum} characters`);
  return value;
}

function strictBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${name} must be boolean`);
  return value;
}

function diagnostics(
  id: string,
  blocker: string,
  extra: Record<string, boolean | number | string | null> = {},
): Record<string, boolean | number | string | null> {
  return {
    id,
    provenanceKind: "comparison",
    benchmarkLabel: "standard-or-normalized-comparison-not-EARTH-derived",
    blocker,
    validatesTheory: false,
    validatesBiology: false,
    medicalAdvice: false,
    medicalValidation: false,
    clinicalUse: false,
    personalDataStored: false,
    hiddenNetworkOrData: false,
    deterministic: true,
    ...extra,
  };
}

function validateDataScope(value: DataScope, name: string): DataScope {
  if (value !== "synthetic" && value !== "deidentified-aggregate") {
    throw new RangeError(`${name} must be synthetic or deidentified-aggregate`);
  }
  return value;
}

function relativeResidual(actual: number, expected: number): number {
  return expected === 0 ? Math.abs(actual) : Math.abs(actual - expected) / Math.abs(expected);
}

function rootMeanSquare(values: number[]): number {
  return Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0) / values.length);
}

// EARTH-BIO-002
export interface ProteinRibbonSineGordonInputs {
  gridPoints?: number;
  normalizedHalfLength?: number;
  normalizedCenter?: number;
  elasticStiffness?: number;
  pinningStrength?: number;
}

export const DEFAULT_PROTEIN_RIBBON_SINE_GORDON_INPUTS: ProteinRibbonSineGordonInputs = {
  gridPoints: 513,
  normalizedHalfLength: 10,
  normalizedCenter: 0,
  elasticStiffness: 1,
  pinningStrength: 1,
};

export function proteinRibbonSineGordonComparison(
  inputs: ProteinRibbonSineGordonInputs = DEFAULT_PROTEIN_RIBBON_SINE_GORDON_INPUTS,
  options: EarthRunOptions = {},
): EarthKernelResult<{
  equation: "A*d2theta/ds2=U*sin(theta)";
  normalization: { width: number; normalizedCoordinate: "x=(s-center)/sqrt(A/U)" };
  samples: Array<{ x: number; s: number; theta: number; derivativePerLength: number; equationResidual: number | null }>;
  maximumNormalizedResidual: number;
  rootMeanSquareNormalizedResidual: number;
  numericalEnergy: number;
  analyticEnergy: number;
  energyRelativeResidual: number;
  totalTwistRadians: number;
  caveats: string[];
}> {
  const gridPoints = boundedInteger(inputs.gridPoints ?? 513, "gridPoints", 33, 8193);
  const halfLength = boundedNumber(inputs.normalizedHalfLength ?? 10, "normalizedHalfLength", 4, 32);
  const center = boundedNumber(
    inputs.normalizedCenter ?? 0,
    "normalizedCenter",
    -halfLength + 2,
    halfLength - 2,
  );
  const stiffness = boundedNumber(inputs.elasticStiffness ?? 1, "elasticStiffness", 1e-12, 1e12);
  const pinning = boundedNumber(inputs.pinningStrength ?? 1, "pinningStrength", 1e-12, 1e12);
  const width = Math.sqrt(stiffness / pinning);
  if (!Number.isFinite(width) || width < 1e-12 || width > 1e12) {
    throw new RangeError("sqrt(elasticStiffness/pinningStrength) must be from 1e-12 to 1e12");
  }

  checkCancelled(options);
  const spacing = 2 * halfLength / (gridPoints - 1);
  const theta = new Array<number>(gridPoints);
  const derivative = new Array<number>(gridPoints);
  for (let index = 0; index < gridPoints; index += 1) {
    if ((index & 255) === 0) checkCancelled(options);
    const x = -halfLength + index * spacing;
    const offset = x - center;
    theta[index] = 4 * Math.atan(Math.exp(offset));
    derivative[index] = 2 / (width * Math.cosh(offset));
  }

  const samples = new Array<{
    x: number;
    s: number;
    theta: number;
    derivativePerLength: number;
    equationResidual: number | null;
  }>(gridPoints);
  const residuals: number[] = [];
  let numericalEnergy = 0;
  for (let index = 0; index < gridPoints; index += 1) {
    if ((index & 255) === 0) checkCancelled(options);
    const x = -halfLength + index * spacing;
    let equationResidual: number | null = null;
    if (index > 0 && index < gridPoints - 1) {
      const secondDerivativeNormalized = (theta[index + 1]! - 2 * theta[index]! + theta[index - 1]!) / spacing ** 2;
      equationResidual = secondDerivativeNormalized - Math.sin(theta[index]!);
      residuals.push(equationResidual);
    }
    const density = 0.5 * stiffness * derivative[index]! ** 2 + pinning * (1 - Math.cos(theta[index]!));
    numericalEnergy += density * width * spacing * (index === 0 || index === gridPoints - 1 ? 0.5 : 1);
    samples[index] = { x, s: width * x, theta: theta[index]!, derivativePerLength: derivative[index]!, equationResidual };
  }
  const analyticEnergy = 8 * Math.sqrt(stiffness * pinning);
  return {
    method: "Corrected elastic-ribbon Euler-Lagrange equation normalized to the analytic static sine-Gordon kink",
    diagnostics: diagnostics(
      "EARTH-BIO-002",
      "The source does not supply a verified protein-specific stiffness, pinning potential, boundary condition, or sequence chemistry",
      { correctedEulerLagrangeEquation: true, proteinSpecificParametersAvailable: false },
    ),
    output: {
      equation: "A*d2theta/ds2=U*sin(theta)",
      normalization: { width, normalizedCoordinate: "x=(s-center)/sqrt(A/U)" },
      samples,
      maximumNormalizedResidual: Math.max(...residuals.map(Math.abs)),
      rootMeanSquareNormalizedResidual: rootMeanSquare(residuals),
      numericalEnergy,
      analyticEnergy,
      energyRelativeResidual: relativeResidual(numericalEnergy, analyticEnergy),
      totalTwistRadians: theta[gridPoints - 1]! - theta[0]!,
      caveats: [
        "This is a normalized elastic-ribbon comparator, not a protein-folding model.",
        "Its parameters are not inferred from EARTH claims or molecular data.",
      ],
    },
  };
}

// EARTH-BIO-003
export interface ProteinAngleDatum {
  id: string;
  observedPhiDegrees: number;
  observedPsiDegrees: number;
  comparatorPhiDegrees: number;
  comparatorPsiDegrees: number;
  observedPitchAngstrom?: number;
  comparatorPitchAngstrom?: number;
  uncertaintyDegrees?: number;
}

export interface ProteinAngleResidualInputs {
  dataScope?: DataScope;
  data?: ProteinAngleDatum[];
}

export const DEFAULT_PROTEIN_ANGLE_RESIDUAL_INPUTS: ProteinAngleResidualInputs = {
  dataScope: "synthetic",
  data: [
    { id: "synthetic-a", observedPhiDegrees: -60, observedPsiDegrees: -45, comparatorPhiDegrees: -57, comparatorPsiDegrees: -47, observedPitchAngstrom: 5.4, comparatorPitchAngstrom: 5.4 },
    { id: "synthetic-b", observedPhiDegrees: -125, observedPsiDegrees: 130, comparatorPhiDegrees: -120, comparatorPsiDegrees: 135, uncertaintyDegrees: 4 },
    { id: "synthetic-wrap", observedPhiDegrees: 179, observedPsiDegrees: -179, comparatorPhiDegrees: -179, comparatorPsiDegrees: 179 },
  ],
};

function wrappedDegrees(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

export function proteinAngleResidualAudit(
  inputs: ProteinAngleResidualInputs = DEFAULT_PROTEIN_ANGLE_RESIDUAL_INPUTS,
  options: EarthRunOptions = {},
): EarthKernelResult<{
  records: Array<ProteinAngleDatum & {
    phiResidualDegrees: number;
    psiResidualDegrees: number;
    angularResidualDegrees: number;
    standardizedAngularResidual: number | null;
    pitchResidualAngstrom: number | null;
  }>;
  rootMeanSquareAngularResidualDegrees: number;
  rootMeanSquarePitchResidualAngstrom: number | null;
  dataScope: DataScope;
  caveats: string[];
}> {
  const dataScope = validateDataScope(inputs.dataScope ?? "synthetic", "dataScope");
  const data = boundedList(inputs.data ?? DEFAULT_PROTEIN_ANGLE_RESIDUAL_INPUTS.data!, "data", 1, 4096);
  const ids = new Set<string>();
  const pitchResiduals: number[] = [];
  checkCancelled(options);
  const records = data.map((datum, index) => {
    if ((index & 255) === 0) checkCancelled(options);
    const id = boundedText(datum.id, `data[${index}].id`);
    if (ids.has(id)) throw new RangeError(`data id must be unique: ${id}`);
    ids.add(id);
    const observedPhiDegrees = boundedNumber(datum.observedPhiDegrees, `data[${index}].observedPhiDegrees`, -180, 180);
    const observedPsiDegrees = boundedNumber(datum.observedPsiDegrees, `data[${index}].observedPsiDegrees`, -180, 180);
    const comparatorPhiDegrees = boundedNumber(datum.comparatorPhiDegrees, `data[${index}].comparatorPhiDegrees`, -180, 180);
    const comparatorPsiDegrees = boundedNumber(datum.comparatorPsiDegrees, `data[${index}].comparatorPsiDegrees`, -180, 180);
    const uncertaintyDegrees = datum.uncertaintyDegrees === undefined
      ? undefined
      : boundedNumber(datum.uncertaintyDegrees, `data[${index}].uncertaintyDegrees`, 1e-6, 180);
    if ((datum.observedPitchAngstrom === undefined) !== (datum.comparatorPitchAngstrom === undefined)) {
      throw new RangeError(`data[${index}] must supply both observedPitchAngstrom and comparatorPitchAngstrom`);
    }
    const observedPitchAngstrom = datum.observedPitchAngstrom === undefined
      ? undefined
      : boundedNumber(datum.observedPitchAngstrom, `data[${index}].observedPitchAngstrom`, 1e-6, 1e6);
    const comparatorPitchAngstrom = datum.comparatorPitchAngstrom === undefined
      ? undefined
      : boundedNumber(datum.comparatorPitchAngstrom, `data[${index}].comparatorPitchAngstrom`, 1e-6, 1e6);
    const phiResidualDegrees = wrappedDegrees(observedPhiDegrees - comparatorPhiDegrees);
    const psiResidualDegrees = wrappedDegrees(observedPsiDegrees - comparatorPsiDegrees);
    const angularResidualDegrees = Math.hypot(phiResidualDegrees, psiResidualDegrees);
    const pitchResidualAngstrom = observedPitchAngstrom === undefined
      ? null
      : observedPitchAngstrom - comparatorPitchAngstrom!;
    if (pitchResidualAngstrom !== null) pitchResiduals.push(pitchResidualAngstrom);
    return {
      ...datum,
      id,
      observedPhiDegrees,
      observedPsiDegrees,
      comparatorPhiDegrees,
      comparatorPsiDegrees,
      observedPitchAngstrom,
      comparatorPitchAngstrom,
      uncertaintyDegrees,
      phiResidualDegrees,
      psiResidualDegrees,
      angularResidualDegrees,
      standardizedAngularResidual: uncertaintyDegrees === undefined ? null : angularResidualDegrees / uncertaintyDegrees,
      pitchResidualAngstrom,
    };
  });
  return {
    method: "Circular phi/psi residuals and optional pitch residuals against user-supplied molecular-mechanics comparators",
    diagnostics: diagnostics(
      "EARTH-BIO-003",
      "No open structure adapter or source-derived sequence chemistry is supplied; records are compared only as provided",
      {
        suppliedRecords: records.length,
        dataScope,
        bundledBiologicalRecords: false,
        sequenceInference: false,
      },
    ),
    output: {
      records,
      rootMeanSquareAngularResidualDegrees: rootMeanSquare(records.map(({ angularResidualDegrees }) => angularResidualDegrees)),
      rootMeanSquarePitchResidualAngstrom: pitchResiduals.length === 0 ? null : rootMeanSquare(pitchResiduals),
      dataScope,
      caveats: [
        "Residuals compare supplied angles; they do not validate a folding mechanism.",
        "Only synthetic or deidentified aggregate/public-structure measurements are accepted.",
      ],
    },
  };
}

// EARTH-BIO-005
export interface DnaTwistWritheEnergyInputs {
  contourLengthNm?: number;
  bendingPersistenceLengthNm?: number;
  twistPersistenceLengthNm?: number;
  excessLinkingNumber?: number;
  writhe?: number;
  curvaturePerNm?: number[];
}

export const DEFAULT_DNA_TWIST_WRITHE_ENERGY_INPUTS: DnaTwistWritheEnergyInputs = {
  contourLengthNm: 340,
  bendingPersistenceLengthNm: 50,
  twistPersistenceLengthNm: 75,
  excessLinkingNumber: -5,
  writhe: -2,
  curvaturePerNm: [0.002, 0.003, 0.004, 0.003],
};

export function dnaTwistWritheEnergyComparison(
  inputs: DnaTwistWritheEnergyInputs = DEFAULT_DNA_TWIST_WRITHE_ENERGY_INPUTS,
  options: EarthRunOptions = {},
): EarthKernelResult<{
  identity: "DeltaLk=DeltaTw+Wr";
  excessLinkingNumber: number;
  twist: number;
  writhe: number;
  closureResidual: number;
  uniformExcessTwistDensityRadiansPerNm: number;
  bendingEnergyKbt: number;
  twistEnergyKbt: number;
  totalEnergyKbt: number;
  torqueKbtRadians: number;
  caveats: string[];
}> {
  const contourLength = boundedNumber(inputs.contourLengthNm ?? 340, "contourLengthNm", 1e-3, 1e9);
  const bendingPersistence = boundedNumber(inputs.bendingPersistenceLengthNm ?? 50, "bendingPersistenceLengthNm", 1e-6, 1e6);
  const twistPersistence = boundedNumber(inputs.twistPersistenceLengthNm ?? 75, "twistPersistenceLengthNm", 1e-6, 1e6);
  const excessLinkingNumber = boundedNumber(inputs.excessLinkingNumber ?? -5, "excessLinkingNumber", -1e6, 1e6);
  const writhe = boundedNumber(inputs.writhe ?? -2, "writhe", -1e6, 1e6);
  const curvatures = boundedList(inputs.curvaturePerNm ?? [0], "curvaturePerNm", 1, 8192).map((value, index) =>
    boundedNumber(value, `curvaturePerNm[${index}]`, -1e3, 1e3));
  checkCancelled(options);
  let squaredCurvatureMean = 0;
  for (let index = 0; index < curvatures.length; index += 1) {
    if ((index & 255) === 0) checkCancelled(options);
    squaredCurvatureMean += curvatures[index]! ** 2 / curvatures.length;
  }
  const twist = excessLinkingNumber - writhe;
  const twistDensity = 2 * Math.PI * twist / contourLength;
  const bendingEnergyKbt = 0.5 * bendingPersistence * contourLength * squaredCurvatureMean;
  const twistEnergyKbt = 0.5 * twistPersistence * contourLength * twistDensity ** 2;
  return {
    method: "Sequence-averaged standard twistable Kirchhoff rod energy with the exact link-twist-writhe identity",
    diagnostics: diagnostics(
      "EARTH-BIO-005",
      "The stiffnesses are standard user inputs, not values derived by the EARTH source",
      { standardTwistableRod: true, earthDerivedStiffness: false },
    ),
    output: {
      identity: "DeltaLk=DeltaTw+Wr",
      excessLinkingNumber,
      twist,
      writhe,
      closureResidual: excessLinkingNumber - twist - writhe,
      uniformExcessTwistDensityRadiansPerNm: twistDensity,
      bendingEnergyKbt,
      twistEnergyKbt,
      totalEnergyKbt: bendingEnergyKbt + twistEnergyKbt,
      torqueKbtRadians: twistPersistence * twistDensity,
      caveats: [
        "Energy is reported in kBT for a sequence-averaged, uniform-twist rod.",
        "This calculator does not infer salt response, buckling, or a molecular structure.",
      ],
    },
  };
}

// EARTH-BIO-006
export interface MarkovTransition {
  from: string;
  to: string;
  ratePerSecond: number;
  energyCostKbt?: number;
}

export interface FiniteMarkovStateGraphInputs {
  states?: string[];
  transitions?: MarkovTransition[];
  initialOccupancy?: number[];
  durationSeconds?: number;
  integrationSteps?: number;
}

export const DEFAULT_FINITE_MARKOV_STATE_GRAPH_INPUTS: FiniteMarkovStateGraphInputs = {
  states: ["unbound", "engaged", "released"],
  transitions: [
    { from: "unbound", to: "engaged", ratePerSecond: 2, energyCostKbt: 1 },
    { from: "engaged", to: "unbound", ratePerSecond: 0.5 },
    { from: "engaged", to: "released", ratePerSecond: 1.25, energyCostKbt: 2 },
    { from: "released", to: "unbound", ratePerSecond: 0.2 },
  ],
  initialOccupancy: [1, 0, 0],
  durationSeconds: 5,
  integrationSteps: 1000,
};

export function finiteMarkovStateGraph(
  inputs: FiniteMarkovStateGraphInputs = DEFAULT_FINITE_MARKOV_STATE_GRAPH_INPUTS,
  options: EarthRunOptions = {},
): EarthKernelResult<{
  states: Array<{ id: string; initialOccupancy: number; finalOccupancy: number }>;
  transitions: Array<MarkovTransition & { expectedCount: number; expectedEnergyKbt: number }>;
  durationSeconds: number;
  integrationSteps: number;
  occupancyNormalizationResidual: number;
  expectedEnergyKbt: number;
  caveats: string[];
}> {
  const stateNames = boundedList(inputs.states ?? DEFAULT_FINITE_MARKOV_STATE_GRAPH_INPUTS.states!, "states", 2, 64)
    .map((state, index) => boundedText(state, `states[${index}]`, 64));
  const stateIndex = new Map<string, number>();
  stateNames.forEach((state, index) => {
    if (stateIndex.has(state)) throw new RangeError(`state names must be unique: ${state}`);
    stateIndex.set(state, index);
  });
  const transitions = boundedList(
    inputs.transitions ?? DEFAULT_FINITE_MARKOV_STATE_GRAPH_INPUTS.transitions!,
    "transitions",
    1,
    4096,
  ).map((transition, index) => {
    const from = boundedText(transition.from, `transitions[${index}].from`, 64);
    const to = boundedText(transition.to, `transitions[${index}].to`, 64);
    if (!stateIndex.has(from) || !stateIndex.has(to)) throw new RangeError(`transitions[${index}] references an unknown state`);
    if (from === to) throw new RangeError(`transitions[${index}] must connect different states`);
    return {
      from,
      to,
      ratePerSecond: boundedNumber(transition.ratePerSecond, `transitions[${index}].ratePerSecond`, 1e-12, 1e9),
      energyCostKbt: boundedNumber(transition.energyCostKbt ?? 0, `transitions[${index}].energyCostKbt`, 0, 1e9),
    };
  });
  const initial = boundedList(
    inputs.initialOccupancy ?? DEFAULT_FINITE_MARKOV_STATE_GRAPH_INPUTS.initialOccupancy!,
    "initialOccupancy",
    stateNames.length,
    stateNames.length,
  ).map((value, index) => boundedNumber(value, `initialOccupancy[${index}]`, 0, 1));
  const initialTotal = initial.reduce((sum, value) => sum + value, 0);
  if (Math.abs(initialTotal - 1) > 1e-12) throw new RangeError("initialOccupancy must sum to one within 1e-12");
  const duration = boundedNumber(inputs.durationSeconds ?? 5, "durationSeconds", 1e-9, 1e9);
  const requestedSteps = boundedInteger(inputs.integrationSteps ?? 1000, "integrationSteps", 1, 20_000);
  const exitRates = new Array<number>(stateNames.length).fill(0);
  for (const transition of transitions) addIndexed(exitRates, stateIndex.get(transition.from)!, transition.ratePerSecond);
  const stableSteps = Math.ceil(duration * Math.max(...exitRates) / 0.25);
  const integrationSteps = Math.max(requestedSteps, stableSteps);
  if (integrationSteps > 20_000) throw new RangeError("durationSeconds and rates require more than 20000 stable integration steps");
  const step = duration / integrationSteps;
  const derivative = (occupancy: number[]): number[] => {
    const change = new Array<number>(stateNames.length).fill(0);
    for (const transition of transitions) {
      const flow = occupancy[stateIndex.get(transition.from)!]! * transition.ratePerSecond;
      addIndexed(change, stateIndex.get(transition.from)!, -flow);
      addIndexed(change, stateIndex.get(transition.to)!, flow);
    }
    return change;
  };
  const addScaled = (base: number[], change: number[], scale: number) =>
    base.map((value, index) => value + change[index]! * scale);

  checkCancelled(options);
  let occupancy = [...initial];
  const expectedCounts = new Array<number>(transitions.length).fill(0);
  for (let iteration = 0; iteration < integrationSteps; iteration += 1) {
    if ((iteration & 31) === 0) checkCancelled(options);
    const before = occupancy;
    const k1 = derivative(before);
    const k2 = derivative(addScaled(before, k1, step / 2));
    const k3 = derivative(addScaled(before, k2, step / 2));
    const k4 = derivative(addScaled(before, k3, step));
    occupancy = before.map((value, index) => value + step * (k1[index]! + 2 * k2[index]! + 2 * k3[index]! + k4[index]!) / 6);
    for (let index = 0; index < transitions.length; index += 1) {
      const transition = transitions[index]!;
      const from = stateIndex.get(transition.from)!;
      addIndexed(expectedCounts, index, 0.5 * (before[from]! + occupancy[from]!) * transition.ratePerSecond * step);
    }
  }
  const occupancyTotal = occupancy.reduce((sum, value) => sum + value, 0);
  const auditedTransitions = transitions.map((transition, index) => ({
    ...transition,
    expectedCount: expectedCounts[index]!,
    expectedEnergyKbt: expectedCounts[index]! * transition.energyCostKbt,
  }));
  return {
    method: "Bounded deterministic RK4 propagation of a finite continuous-time Markov graph with explicit transition rates",
    diagnostics: diagnostics(
      "EARTH-BIO-006",
      "The source supplies no transition graph, rate law, barriers, concentrations, or nucleotide-coupling parameters",
      { explicitRatesRequired: true, sourceRateLawAvailable: false },
    ),
    output: {
      states: stateNames.map((id, index) => ({ id, initialOccupancy: initial[index]!, finalOccupancy: occupancy[index]! })),
      transitions: auditedTransitions,
      durationSeconds: duration,
      integrationSteps,
      occupancyNormalizationResidual: Math.abs(occupancyTotal - 1),
      expectedEnergyKbt: auditedTransitions.reduce((sum, transition) => sum + transition.expectedEnergyKbt, 0),
      caveats: [
        "Rates and energy costs are explicit inputs; no missing suppression factor is invented.",
        "The graph is a finite-state comparator, not a ribosome or spliceosome mechanism.",
      ],
    },
  };
}

// EARTH-NEURO-001
export interface AxonKinkPropagationInputs {
  normalizedSpeed?: number;
  initialCenter?: number;
  normalizedDuration?: number;
  timeSamples?: number;
  profilePoints?: number;
  normalizedHalfLength?: number;
  nodePositions?: number[];
  transmissionPerNode?: number;
}

export const DEFAULT_AXON_KINK_PROPAGATION_INPUTS: AxonKinkPropagationInputs = {
  normalizedSpeed: 0.6,
  initialCenter: -4,
  normalizedDuration: 8,
  timeSamples: 33,
  profilePoints: 257,
  normalizedHalfLength: 12,
  nodePositions: [-1, 2, 5],
  transmissionPerNode: 0.9,
};

export function axonKinkPropagationComparison(
  inputs: AxonKinkPropagationInputs = DEFAULT_AXON_KINK_PROPAGATION_INPUTS,
  options: EarthRunOptions = {},
): EarthKernelResult<{
  normalization: { limitingWaveSpeed: 1; staticWidth: 1 };
  lorentzFactor: number;
  movingWidth: number;
  normalizedEnergy: number;
  normalizedMomentum: number;
  trajectory: Array<{ time: number; center: number; transmittedEnergy: number; crossedNodes: number }>;
  finalProfile: Array<{ x: number; theta: number }>;
  caveats: string[];
}> {
  const speed = boundedNumber(inputs.normalizedSpeed ?? 0.6, "normalizedSpeed", -0.999, 0.999);
  const initialCenter = boundedNumber(inputs.initialCenter ?? -4, "initialCenter", -1e4, 1e4);
  const duration = boundedNumber(inputs.normalizedDuration ?? 8, "normalizedDuration", 0, 1e4);
  const timeSamples = boundedInteger(inputs.timeSamples ?? 33, "timeSamples", 2, 4097);
  const profilePoints = boundedInteger(inputs.profilePoints ?? 257, "profilePoints", 33, 8193);
  const halfLength = boundedNumber(inputs.normalizedHalfLength ?? 12, "normalizedHalfLength", 4, 1e4);
  const transmission = boundedNumber(inputs.transmissionPerNode ?? 0.9, "transmissionPerNode", 0, 1);
  const nodes = boundedList(inputs.nodePositions ?? [], "nodePositions", 0, 1024)
    .map((value, index) => boundedNumber(value, `nodePositions[${index}]`, -halfLength, halfLength))
    .sort((left, right) => left - right);
  for (let index = 1; index < nodes.length; index += 1) {
    if (nodes[index] === nodes[index - 1]) throw new RangeError("nodePositions must be unique");
  }
  const finalCenter = initialCenter + speed * duration;
  if (Math.abs(initialCenter) > halfLength - 2 || Math.abs(finalCenter) > halfLength - 2) {
    throw new RangeError("the kink center must remain at least two normalized widths from each boundary");
  }
  checkCancelled(options);
  const gamma = 1 / Math.sqrt(1 - speed ** 2);
  const crossedAt = (center: number) => nodes.filter((node) => speed >= 0
    ? node > initialCenter && node <= center
    : node < initialCenter && node >= center).length;
  const trajectory = Array.from({ length: timeSamples }, (_, index) => {
    if ((index & 255) === 0) checkCancelled(options);
    const time = duration * index / (timeSamples - 1);
    const center = initialCenter + speed * time;
    const crossedNodes = crossedAt(center);
    return { time, center, transmittedEnergy: 8 * gamma * transmission ** crossedNodes, crossedNodes };
  });
  const finalProfile = Array.from({ length: profilePoints }, (_, index) => {
    if ((index & 255) === 0) checkCancelled(options);
    const x = -halfLength + 2 * halfLength * index / (profilePoints - 1);
    return { x, theta: 4 * Math.atan(Math.exp(gamma * (x - finalCenter))) };
  });
  return {
    method: "Analytic normalized moving sine-Gordon kink with declared per-node transmission bookkeeping",
    diagnostics: diagnostics(
      "EARTH-NEURO-001",
      "No measured axon voltage/current map or physical coefficients connect the normalized field to an axon",
      { normalizedOnly: true, physicalVoltageMapAvailable: false, physicalEnergyMapAvailable: false },
    ),
    output: {
      normalization: { limitingWaveSpeed: 1, staticWidth: 1 },
      lorentzFactor: gamma,
      movingWidth: 1 / gamma,
      normalizedEnergy: 8 * gamma,
      normalizedMomentum: 8 * gamma * speed,
      trajectory,
      finalProfile,
      caveats: [
        "Speed, distance, time, and energy are normalized and must not be read as physiological units.",
        "Node transmission is an explicit bookkeeping factor, not a saltatory-conduction law.",
      ],
    },
  };
}

// EARTH-NEURO-002
export interface WaveformSample {
  timeMs: number;
  voltageMv: number;
}

export interface ActionPotentialWaveformInputs {
  dataScope?: DataScope;
  samples?: WaveformSample[];
  restingVoltageMv?: number;
  peakExcursionMv?: number;
  stimulusTimeMs?: number;
  riseTimeMs?: number;
  decayTimeMs?: number;
  afterHyperpolarizationMv?: number;
  afterHyperpolarizationTimeMs?: number;
}

function hhLikeVoltage(
  timeMs: number,
  restingVoltageMv: number,
  peakExcursionMv: number,
  stimulusTimeMs: number,
  riseTimeMs: number,
  decayTimeMs: number,
  afterHyperpolarizationMv: number,
  afterHyperpolarizationTimeMs: number,
): number {
  const elapsed = timeMs - stimulusTimeMs;
  if (elapsed <= 0) return restingVoltageMv;
  const peakTime = Math.log(decayTimeMs / riseTimeMs) / (1 / riseTimeMs - 1 / decayTimeMs);
  const shape = (1 - Math.exp(-elapsed / riseTimeMs)) * Math.exp(-elapsed / decayTimeMs);
  const peakShape = (1 - Math.exp(-peakTime / riseTimeMs)) * Math.exp(-peakTime / decayTimeMs);
  const after = afterHyperpolarizationMv * (elapsed / afterHyperpolarizationTimeMs)
    * Math.exp(1 - elapsed / afterHyperpolarizationTimeMs);
  return restingVoltageMv + peakExcursionMv * shape / peakShape + after;
}

const DEFAULT_WAVEFORM_PARAMETERS = {
  restingVoltageMv: -65,
  peakExcursionMv: 100,
  stimulusTimeMs: 1,
  riseTimeMs: 0.25,
  decayTimeMs: 1.5,
  afterHyperpolarizationMv: -8,
  afterHyperpolarizationTimeMs: 3,
} as const;

export const DEFAULT_ACTION_POTENTIAL_WAVEFORM_INPUTS: ActionPotentialWaveformInputs = {
  dataScope: "synthetic",
  ...DEFAULT_WAVEFORM_PARAMETERS,
  samples: Array.from({ length: 65 }, (_, index) => {
    const timeMs = index * 0.125;
    return {
      timeMs,
      voltageMv: hhLikeVoltage(timeMs, -65, 100, 1, 0.25, 1.5, -8, 3) + 0.25 * Math.sin(index * 0.7),
    };
  }),
};

export function actionPotentialWaveformResidual(
  inputs: ActionPotentialWaveformInputs = DEFAULT_ACTION_POTENTIAL_WAVEFORM_INPUTS,
  options: EarthRunOptions = {},
): EarthKernelResult<{
  comparator: "fixed phenomenological HH-like difference-of-exponentials waveform";
  samples: Array<WaveformSample & { comparatorVoltageMv: number; residualMv: number }>;
  rootMeanSquareResidualMv: number;
  meanAbsoluteResidualMv: number;
  peakObservedMv: number;
  peakComparatorMv: number;
  peakTimeResidualMs: number;
  dataScope: DataScope;
  caveats: string[];
}> {
  const dataScope = validateDataScope(inputs.dataScope ?? "synthetic", "dataScope");
  const sourceSamples = boundedList(inputs.samples ?? DEFAULT_ACTION_POTENTIAL_WAVEFORM_INPUTS.samples!, "samples", 8, 8192);
  const resting = boundedNumber(inputs.restingVoltageMv ?? -65, "restingVoltageMv", -250, 250);
  const peakExcursion = boundedNumber(inputs.peakExcursionMv ?? 100, "peakExcursionMv", 1e-6, 500);
  const stimulus = boundedNumber(inputs.stimulusTimeMs ?? 1, "stimulusTimeMs", -1e6, 1e6);
  const rise = boundedNumber(inputs.riseTimeMs ?? 0.25, "riseTimeMs", 1e-6, 1e6);
  const decay = boundedNumber(inputs.decayTimeMs ?? 1.5, "decayTimeMs", 1e-6, 1e6);
  if (decay <= rise) throw new RangeError("decayTimeMs must be greater than riseTimeMs");
  const after = boundedNumber(inputs.afterHyperpolarizationMv ?? -8, "afterHyperpolarizationMv", -500, 0);
  const afterTime = boundedNumber(inputs.afterHyperpolarizationTimeMs ?? 3, "afterHyperpolarizationTimeMs", 1e-6, 1e6);
  checkCancelled(options);
  let previousTime = -Infinity;
  const samples = sourceSamples.map((sample, index) => {
    if ((index & 255) === 0) checkCancelled(options);
    const timeMs = boundedNumber(sample.timeMs, `samples[${index}].timeMs`, -1e6, 1e6);
    if (timeMs <= previousTime) throw new RangeError("sample times must be strictly increasing");
    previousTime = timeMs;
    const voltageMv = boundedNumber(sample.voltageMv, `samples[${index}].voltageMv`, -500, 500);
    const comparatorVoltageMv = hhLikeVoltage(timeMs, resting, peakExcursion, stimulus, rise, decay, after, afterTime);
    return { timeMs, voltageMv, comparatorVoltageMv, residualMv: voltageMv - comparatorVoltageMv };
  });
  const observedPeak = samples.reduce((best, sample) => sample.voltageMv > best.voltageMv ? sample : best);
  const comparatorPeak = samples.reduce((best, sample) => sample.comparatorVoltageMv > best.comparatorVoltageMv ? sample : best);
  return {
    method: "Pointwise user-waveform residual against a fixed, explicit phenomenological HH-like comparator without parameter fitting",
    diagnostics: diagnostics(
      "EARTH-NEURO-002",
      "The EARTH source lacks a voltage/current coupling; this comparator is not a Hodgkin-Huxley or cable-equation solver",
      { dataScope, fittedToWaveform: false, rawWaveformRetained: false, physiologicalInference: false },
    ),
    output: {
      comparator: "fixed phenomenological HH-like difference-of-exponentials waveform",
      samples,
      rootMeanSquareResidualMv: rootMeanSquare(samples.map(({ residualMv }) => residualMv)),
      meanAbsoluteResidualMv: samples.reduce((sum, { residualMv }) => sum + Math.abs(residualMv), 0) / samples.length,
      peakObservedMv: observedPeak.voltageMv,
      peakComparatorMv: comparatorPeak.comparatorVoltageMv,
      peakTimeResidualMs: observedPeak.timeMs - comparatorPeak.timeMs,
      dataScope,
      caveats: [
        "The waveform is a numerical comparator and cannot diagnose physiology or disease.",
        "Input samples are processed in memory and are not retained by this kernel.",
      ],
    },
  };
}

// EARTH-NEURO-003
export interface ConnectomeEdge {
  from: string;
  to: string;
  lengthM: number;
  propagationSpeedMPerS: number;
  coupling: number;
}

export interface ConnectomeEigenmodeInputs {
  nodeIds?: string[];
  edges?: ConnectomeEdge[];
  dampingPerSecond?: number;
  maximumSweeps?: number;
}

export const DEFAULT_CONNECTOME_EIGENMODE_INPUTS: ConnectomeEigenmodeInputs = {
  nodeIds: ["n0", "n1", "n2", "n3"],
  edges: [
    { from: "n0", to: "n1", lengthM: 0.1, propagationSpeedMPerS: 2, coupling: 0.5 },
    { from: "n1", to: "n2", lengthM: 0.12, propagationSpeedMPerS: 2.2, coupling: 0.4 },
    { from: "n2", to: "n3", lengthM: 0.09, propagationSpeedMPerS: 1.8, coupling: 0.6 },
    { from: "n3", to: "n0", lengthM: 0.11, propagationSpeedMPerS: 2.1, coupling: 0.45 },
  ],
  dampingPerSecond: 0.5,
  maximumSweeps: 128,
};

function symmetricEigenDecomposition(
  source: number[][],
  maximumSweeps: number,
  options: EarthRunOptions,
): { values: number[]; vectors: number[][]; offDiagonalResidual: number; sweeps: number } {
  const size = source.length;
  const matrix = source.map((row) => [...row]);
  const vectors: number[][] = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => (row === column ? 1 : 0)));
  let sweeps = 0;
  for (; sweeps < maximumSweeps; sweeps += 1) {
    checkCancelled(options);
    let maximum = 0;
    let pivotRow = 0;
    let pivotColumn = 1;
    for (let row = 0; row < size - 1; row += 1) {
      for (let column = row + 1; column < size; column += 1) {
        const magnitude = Math.abs(matrix[row]![column]!);
        if (magnitude > maximum) {
          maximum = magnitude;
          pivotRow = row;
          pivotColumn = column;
        }
      }
    }
    if (maximum < 1e-12) break;
    const app = matrix[pivotRow]![pivotRow]!;
    const aqq = matrix[pivotColumn]![pivotColumn]!;
    const apq = matrix[pivotRow]![pivotColumn]!;
    const angle = 0.5 * Math.atan2(2 * apq, aqq - app);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    for (let index = 0; index < size; index += 1) {
      if (index === pivotRow || index === pivotColumn) continue;
      const aip = matrix[index]![pivotRow]!;
      const aiq = matrix[index]![pivotColumn]!;
      matrix[index]![pivotRow] = cosine * aip - sine * aiq;
      matrix[pivotRow]![index] = matrix[index]![pivotRow]!;
      matrix[index]![pivotColumn] = sine * aip + cosine * aiq;
      matrix[pivotColumn]![index] = matrix[index]![pivotColumn]!;
    }
    matrix[pivotRow]![pivotRow] = cosine ** 2 * app - 2 * sine * cosine * apq + sine ** 2 * aqq;
    matrix[pivotColumn]![pivotColumn] = sine ** 2 * app + 2 * sine * cosine * apq + cosine ** 2 * aqq;
    matrix[pivotRow]![pivotColumn] = 0;
    matrix[pivotColumn]![pivotRow] = 0;
    for (let index = 0; index < size; index += 1) {
      const vip = vectors[index]![pivotRow]!;
      const viq = vectors[index]![pivotColumn]!;
      vectors[index]![pivotRow] = cosine * vip - sine * viq;
      vectors[index]![pivotColumn] = sine * vip + cosine * viq;
    }
  }
  let offDiagonalSquared = 0;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (row !== column) offDiagonalSquared += matrix[row]![column]! ** 2;
    }
  }
  const sorted = Array.from({ length: size }, (_, index) => index)
    .sort((left, right) => matrix[left]![left]! - matrix[right]![right]!);
  const values = sorted.map((index) => matrix[index]![index]!);
  const sortedVectors = sorted.map((column) => {
    const vector = vectors.map((row) => row[column]!);
    let largestIndex = 0;
    for (let index = 1; index < vector.length; index += 1) {
      if (Math.abs(vector[index]!) > Math.abs(vector[largestIndex]!)) largestIndex = index;
    }
    return vector[largestIndex]! < 0 ? vector.map((value) => -value) : vector;
  });
  return { values, vectors: sortedVectors, offDiagonalResidual: Math.sqrt(offDiagonalSquared), sweeps };
}

export function connectomeEigenmodeComparison(
  inputs: ConnectomeEigenmodeInputs = DEFAULT_CONNECTOME_EIGENMODE_INPUTS,
  options: EarthRunOptions = {},
): EarthKernelResult<{
  nodes: string[];
  edges: Array<ConnectomeEdge & { effectiveRateSquared: number }>;
  modes: Array<{ index: number; eigenvaluePerSecondSquared: number; frequencyHz: number; dampedFrequencyHz: number; vector: number[] }>;
  dampingPerSecond: number;
  connected: true;
  offDiagonalResidual: number;
  sweeps: number;
  caveats: string[];
}> {
  const nodes = boundedList(inputs.nodeIds ?? DEFAULT_CONNECTOME_EIGENMODE_INPUTS.nodeIds!, "nodeIds", 2, 64)
    .map((node, index) => boundedText(node, `nodeIds[${index}]`, 64));
  const nodeIndex = new Map<string, number>();
  nodes.forEach((node, index) => {
    if (nodeIndex.has(node)) throw new RangeError(`nodeIds must be unique: ${node}`);
    nodeIndex.set(node, index);
  });
  const pairKeys = new Set<string>();
  const edges = boundedList(inputs.edges ?? DEFAULT_CONNECTOME_EIGENMODE_INPUTS.edges!, "edges", 1, 4096).map((edge, index) => {
    const from = boundedText(edge.from, `edges[${index}].from`, 64);
    const to = boundedText(edge.to, `edges[${index}].to`, 64);
    if (!nodeIndex.has(from) || !nodeIndex.has(to)) throw new RangeError(`edges[${index}] references an unknown node`);
    if (from === to) throw new RangeError(`edges[${index}] must connect different nodes`);
    const key = [from, to].sort().join("\u0000");
    if (pairKeys.has(key)) throw new RangeError(`edges must not contain duplicate undirected pair ${from}-${to}`);
    pairKeys.add(key);
    const lengthM = boundedNumber(edge.lengthM, `edges[${index}].lengthM`, 1e-9, 1e6);
    const propagationSpeedMPerS = boundedNumber(edge.propagationSpeedMPerS, `edges[${index}].propagationSpeedMPerS`, 1e-9, 3e8);
    const coupling = boundedNumber(edge.coupling, `edges[${index}].coupling`, 1e-12, 1e6);
    return { from, to, lengthM, propagationSpeedMPerS, coupling, effectiveRateSquared: coupling * (propagationSpeedMPerS / lengthM) ** 2 };
  });
  const damping = boundedNumber(inputs.dampingPerSecond ?? 0.5, "dampingPerSecond", 0, 1e9);
  const maximumSweeps = boundedInteger(inputs.maximumSweeps ?? 128, "maximumSweeps", 1, 4096);
  const adjacency = Array.from({ length: nodes.length }, () => [] as number[]);
  for (const edge of edges) {
    const from = nodeIndex.get(edge.from)!;
    const to = nodeIndex.get(edge.to)!;
    adjacency[from]!.push(to);
    adjacency[to]!.push(from);
  }
  const visited = new Set<number>([0]);
  const queue = [0];
  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const neighbour of adjacency[node]!) {
      if (!visited.has(neighbour)) {
        visited.add(neighbour);
        queue.push(neighbour);
      }
    }
  }
  if (visited.size !== nodes.length) throw new RangeError("weighted graph must be connected");
  const laplacian = Array.from({ length: nodes.length }, () => new Array<number>(nodes.length).fill(0));
  for (const edge of edges) {
    const from = nodeIndex.get(edge.from)!;
    const to = nodeIndex.get(edge.to)!;
    addIndexedMatrix(laplacian, from, from, edge.effectiveRateSquared);
    addIndexedMatrix(laplacian, to, to, edge.effectiveRateSquared);
    addIndexedMatrix(laplacian, from, to, -edge.effectiveRateSquared);
    addIndexedMatrix(laplacian, to, from, -edge.effectiveRateSquared);
  }
  const decomposition = symmetricEigenDecomposition(laplacian, maximumSweeps, options);
  const modes = decomposition.values.map((rawValue, index) => {
    const eigenvalue = Math.max(0, rawValue);
    const angularFrequency = Math.sqrt(eigenvalue);
    const dampedAngularFrequency = Math.sqrt(Math.max(0, eigenvalue - damping ** 2 / 4));
    return {
      index,
      eigenvaluePerSecondSquared: eigenvalue,
      frequencyHz: angularFrequency / (2 * Math.PI),
      dampedFrequencyHz: dampedAngularFrequency / (2 * Math.PI),
      vector: decomposition.vectors[index]!,
    };
  });
  return {
    method: "Jacobi eigen-decomposition of a bounded symmetric delay-scaled weighted graph Laplacian",
    diagnostics: diagnostics(
      "EARTH-NEURO-003",
      "No frozen connectome, measured edge parameters, or source-derived coupling law is bundled",
      { suppliedNodes: nodes.length, suppliedEdges: edges.length, stateIndependentLinearModesOnly: true },
    ),
    output: {
      nodes,
      edges,
      modes,
      dampingPerSecond: damping,
      connected: true,
      offDiagonalResidual: decomposition.offDiagonalResidual,
      sweeps: decomposition.sweeps,
      caveats: [
        "Eigenfrequencies follow only from the supplied linear graph law and are not neural-state predictions.",
        "Node labels and aggregate weights must not contain personal connectome identifiers.",
      ],
    },
  };
}

// EARTH-NEURO-004
export interface SevenPointEightThreeHzAuditInputs {
  dataScope?: DataScope;
  samples?: number[];
  sampleRateHz?: number;
  targetFrequencyHz?: number;
  localWindowHz?: number;
}

const DEFAULT_SPECTRAL_SAMPLE_RATE = 64;
export const DEFAULT_SEVEN_POINT_EIGHT_THREE_HZ_AUDIT_INPUTS: SevenPointEightThreeHzAuditInputs = {
  dataScope: "synthetic",
  sampleRateHz: DEFAULT_SPECTRAL_SAMPLE_RATE,
  targetFrequencyHz: 7.83,
  localWindowHz: 2,
  samples: Array.from({ length: 512 }, (_, index) => {
    const time = index / DEFAULT_SPECTRAL_SAMPLE_RATE;
    const redLike = 0.35 * Math.sin(2 * Math.PI * 1.25 * time) + 0.15 * Math.sin(2 * Math.PI * 2.5 * time + 0.4);
    return redLike + 0.2 * Math.sin(2 * Math.PI * 7.83 * time + 0.2);
  }),
};

function spectralPower(samples: number[], sampleRateHz: number, frequencyHz: number): number {
  let real = 0;
  let imaginary = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const phase = 2 * Math.PI * frequencyHz * index / sampleRateHz;
    real += samples[index]! * Math.cos(phase);
    imaginary -= samples[index]! * Math.sin(phase);
  }
  return (real ** 2 + imaginary ** 2) / samples.length ** 2;
}

export function sevenPointEightThreeHzSpectralAudit(
  inputs: SevenPointEightThreeHzAuditInputs = DEFAULT_SEVEN_POINT_EIGHT_THREE_HZ_AUDIT_INPUTS,
  options: EarthRunOptions = {},
): EarthKernelResult<{
  dataScope: DataScope;
  targetFrequencyHz: number;
  exactTargetPower: number;
  nearestFourierFrequencyHz: number;
  nearestFourierPower: number;
  localBackgroundPower: number;
  localPowerRatio: number;
  lagOneAutocorrelation: number;
  redNoiseExpectedPower: number;
  redNoisePowerRatio: number;
  significanceClaim: "none";
  caveats: string[];
}> {
  const dataScope = validateDataScope(inputs.dataScope ?? "synthetic", "dataScope");
  const samples = boundedList(inputs.samples ?? DEFAULT_SEVEN_POINT_EIGHT_THREE_HZ_AUDIT_INPUTS.samples!, "samples", 64, 16_384)
    .map((value, index) => boundedNumber(value, `samples[${index}]`, -1e12, 1e12));
  const sampleRate = boundedNumber(inputs.sampleRateHz ?? 64, "sampleRateHz", 1e-3, 1e6);
  const target = boundedNumber(inputs.targetFrequencyHz ?? 7.83, "targetFrequencyHz", 1e-9, sampleRate / 2);
  const localWindow = boundedNumber(inputs.localWindowHz ?? 2, "localWindowHz", sampleRate / samples.length, sampleRate / 4);
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const centered = samples.map((value) => value - mean);
  checkCancelled(options);
  const exactTargetPower = spectralPower(centered, sampleRate, target);
  const binWidth = sampleRate / samples.length;
  const nearestBin = Math.max(1, Math.min(Math.floor(samples.length / 2), Math.round(target / binWidth)));
  const nearestFrequency = nearestBin * binWidth;
  const nearestFourierPower = spectralPower(centered, sampleRate, nearestFrequency);
  const windowBins = Math.max(1, Math.floor(localWindow / binWidth));
  const localPowers: number[] = [];
  for (let bin = Math.max(1, nearestBin - windowBins); bin <= Math.min(Math.floor(samples.length / 2), nearestBin + windowBins); bin += 1) {
    if ((bin & 31) === 0) checkCancelled(options);
    if (Math.abs(bin - nearestBin) <= 1) continue;
    localPowers.push(spectralPower(centered, sampleRate, bin * binWidth));
  }
  if (localPowers.length === 0) throw new RangeError("localWindowHz must include background bins outside the target bin");
  const localBackgroundPower = localPowers.reduce((sum, value) => sum + value, 0) / localPowers.length;
  let lagProduct = 0;
  let lagVariance = 0;
  for (let index = 1; index < centered.length; index += 1) {
    if ((index & 255) === 0) checkCancelled(options);
    lagProduct += centered[index]! * centered[index - 1]!;
    lagVariance += centered[index - 1]! ** 2;
  }
  const lagOneAutocorrelation = Math.max(-0.99, Math.min(0.99, lagVariance === 0 ? 0 : lagProduct / lagVariance));
  const variance = centered.reduce((sum, value) => sum + value ** 2, 0) / centered.length;
  const redNoiseExpectedPower = variance / centered.length * (1 - lagOneAutocorrelation ** 2)
    / (1 + lagOneAutocorrelation ** 2 - 2 * lagOneAutocorrelation * Math.cos(2 * Math.PI * target / sampleRate));
  return {
    method: "Detrended single-series Fourier audit at 7.83 Hz with local-bin and fitted AR(1) red-noise comparators",
    diagnostics: diagnostics(
      "EARTH-NEURO-004",
      "A single supplied series cannot establish corrected cross-subject significance, and red-noise uncertainty is not a white-noise null",
      { dataScope, multipleComparisonCorrectionApplied: false, crossSubjectInference: false, rawTimeSeriesRetained: false },
    ),
    output: {
      dataScope,
      targetFrequencyHz: target,
      exactTargetPower,
      nearestFourierFrequencyHz: nearestFrequency,
      nearestFourierPower,
      localBackgroundPower,
      localPowerRatio: localBackgroundPower === 0 ? Number.MAX_VALUE : exactTargetPower / localBackgroundPower,
      lagOneAutocorrelation,
      redNoiseExpectedPower,
      redNoisePowerRatio: redNoiseExpectedPower === 0 ? Number.MAX_VALUE : exactTargetPower / redNoiseExpectedPower,
      significanceClaim: "none",
      caveats: [
        "AR(1) is only a red-noise comparator; no p-value or significance claim is produced.",
        "Artifact rejection, preregistration, multiple comparisons, and independent subjects remain external requirements.",
        "This spectral result has no medical or cognitive interpretation.",
      ],
    },
  };
}

// EARTH-NEURO-005
export interface AggregateSurvivalBin {
  startTime: number;
  endTime: number;
  atRisk: number;
  events: number;
  censored: number;
  aboveThresholdAtRisk: number;
  aboveThresholdEvents: number;
}

export interface AggregateSurvivalThresholdInputs {
  dataScope?: "aggregate-synthetic";
  thresholdName?: string;
  thresholdValue?: number;
  thresholdUnit?: string;
  bins?: AggregateSurvivalBin[];
}

export const DEFAULT_AGGREGATE_SURVIVAL_THRESHOLD_INPUTS: AggregateSurvivalThresholdInputs = {
  dataScope: "aggregate-synthetic",
  thresholdName: "synthetic-marker-cutoff",
  thresholdValue: 1,
  thresholdUnit: "arbitrary-unit",
  bins: [
    { startTime: 0, endTime: 1, atRisk: 100, events: 4, censored: 2, aboveThresholdAtRisk: 40, aboveThresholdEvents: 3 },
    { startTime: 1, endTime: 2, atRisk: 94, events: 5, censored: 3, aboveThresholdAtRisk: 36, aboveThresholdEvents: 4 },
    { startTime: 2, endTime: 3, atRisk: 86, events: 6, censored: 4, aboveThresholdAtRisk: 30, aboveThresholdEvents: 4 },
  ],
};

export function aggregateSurvivalThresholdHazardCalculator(
  inputs: AggregateSurvivalThresholdInputs = DEFAULT_AGGREGATE_SURVIVAL_THRESHOLD_INPUTS,
  options: EarthRunOptions = {},
): EarthKernelResult<{
  contract: {
    dataScope: "aggregate-synthetic";
    thresholdName: string;
    thresholdValue: number;
    thresholdUnit: string;
    operationalBiomarkerValidated: false;
    individualPredictionAllowed: false;
  };
  bins: Array<AggregateSurvivalBin & {
    intervalHazard: number;
    aboveThresholdHazard: number;
    belowThresholdHazard: number;
    survival: number;
  }>;
  cumulativeSurvival: number;
  aggregateHazardRatioAboveToBelow: number | null;
  caveats: string[];
}> {
  if ((inputs.dataScope ?? "aggregate-synthetic") !== "aggregate-synthetic") {
    throw new RangeError("dataScope must be aggregate-synthetic; individual or clinical records are not accepted");
  }
  const thresholdName = boundedText(inputs.thresholdName ?? "synthetic-marker-cutoff", "thresholdName", 128);
  const thresholdValue = boundedNumber(inputs.thresholdValue ?? 1, "thresholdValue", -1e12, 1e12);
  const thresholdUnit = boundedText(inputs.thresholdUnit ?? "arbitrary-unit", "thresholdUnit", 64);
  const sourceBins = boundedList(inputs.bins ?? DEFAULT_AGGREGATE_SURVIVAL_THRESHOLD_INPUTS.bins!, "bins", 1, 1024);
  let survival = 1;
  let previousRemaining: number | null = null;
  let abovePersonTime = 0;
  let belowPersonTime = 0;
  let aboveEvents = 0;
  let belowEvents = 0;
  checkCancelled(options);
  const bins = sourceBins.map((bin, index) => {
    if ((index & 63) === 0) checkCancelled(options);
    const startTime = boundedNumber(bin.startTime, `bins[${index}].startTime`, 0, 1e12);
    const endTime = boundedNumber(bin.endTime, `bins[${index}].endTime`, 0, 1e12);
    if (endTime <= startTime) throw new RangeError(`bins[${index}].endTime must be greater than startTime`);
    const atRisk = boundedInteger(bin.atRisk, `bins[${index}].atRisk`, 1, 1_000_000_000);
    const events = boundedInteger(bin.events, `bins[${index}].events`, 0, atRisk);
    const censored = boundedInteger(bin.censored, `bins[${index}].censored`, 0, atRisk - events);
    if (previousRemaining !== null && atRisk !== previousRemaining) {
      throw new RangeError(`bins[${index}].atRisk must equal the previous bin remainder`);
    }
    const aboveThresholdAtRisk = boundedInteger(bin.aboveThresholdAtRisk, `bins[${index}].aboveThresholdAtRisk`, 0, atRisk);
    const aboveThresholdEvents = boundedInteger(bin.aboveThresholdEvents, `bins[${index}].aboveThresholdEvents`, 0, events);
    if (aboveThresholdEvents > aboveThresholdAtRisk) throw new RangeError(`bins[${index}].aboveThresholdEvents exceeds aboveThresholdAtRisk`);
    const belowAtRisk = atRisk - aboveThresholdAtRisk;
    const belowBinEvents = events - aboveThresholdEvents;
    if (belowBinEvents > belowAtRisk) throw new RangeError(`bins[${index}] below-threshold events exceed below-threshold at-risk count`);
    const duration = endTime - startTime;
    survival *= 1 - events / atRisk;
    abovePersonTime += aboveThresholdAtRisk * duration;
    belowPersonTime += belowAtRisk * duration;
    aboveEvents += aboveThresholdEvents;
    belowEvents += belowBinEvents;
    previousRemaining = atRisk - events - censored;
    return {
      startTime,
      endTime,
      atRisk,
      events,
      censored,
      aboveThresholdAtRisk,
      aboveThresholdEvents,
      intervalHazard: events / (atRisk * duration),
      aboveThresholdHazard: aboveThresholdAtRisk === 0 ? 0 : aboveThresholdEvents / (aboveThresholdAtRisk * duration),
      belowThresholdHazard: belowAtRisk === 0 ? 0 : belowBinEvents / (belowAtRisk * duration),
      survival,
    };
  });
  const aboveHazard = abovePersonTime === 0 ? 0 : aboveEvents / abovePersonTime;
  const belowHazard = belowPersonTime === 0 ? 0 : belowEvents / belowPersonTime;
  return {
    method: "Aggregate synthetic Kaplan-Meier product and incidence-density hazard calculation under a frozen threshold contract",
    diagnostics: diagnostics(
      "EARTH-NEURO-005",
      "No operational topological biomarker or external longitudinal validation exists; controlled clinical data are excluded",
      { dataScope: "aggregate-synthetic", individualRecordsAccepted: false, diseasePrediction: false, externalValidation: false },
    ),
    output: {
      contract: {
        dataScope: "aggregate-synthetic",
        thresholdName,
        thresholdValue,
        thresholdUnit,
        operationalBiomarkerValidated: false,
        individualPredictionAllowed: false,
      },
      bins,
      cumulativeSurvival: survival,
      aggregateHazardRatioAboveToBelow: belowHazard === 0 ? null : aboveHazard / belowHazard,
      caveats: [
        "Synthetic aggregate hazards are arithmetic demonstrations, not disease-onset estimates.",
        "No individual, controlled-access, or clinical record is accepted or retained.",
        "The threshold has no validated medical interpretation.",
      ],
    },
  };
}

// EARTH-X-005
export interface BlindSpectrumCalibrationDatum {
  id: string;
  spectrumValue: number;
  referenceValue: number;
  containsHeldOutTarget?: boolean;
  targetIdsUsed?: string[];
}

export interface BlindSpectrumHeldOutDatum {
  id: string;
  spectrumValue: number;
  targetValue: number;
}

export interface BlindSpectrumProtocolInputs {
  mappingScale?: number;
  mappingOffset?: number;
  mappingFrozenBeforeTargetAccess?: boolean;
  nullFamilyFrozenBeforeTargetAccess?: boolean;
  complexityMatchedNulls?: number;
  calibration?: BlindSpectrumCalibrationDatum[];
  heldOut?: BlindSpectrumHeldOutDatum[];
}

export const DEFAULT_BLIND_SPECTRUM_PROTOCOL_INPUTS: BlindSpectrumProtocolInputs = {
  mappingScale: 2,
  mappingOffset: 1,
  mappingFrozenBeforeTargetAccess: true,
  nullFamilyFrozenBeforeTargetAccess: true,
  complexityMatchedNulls: 16,
  calibration: [
    { id: "cal-a", spectrumValue: 1, referenceValue: 3 },
    { id: "cal-b", spectrumValue: 2, referenceValue: 5 },
  ],
  heldOut: [
    { id: "target-a", spectrumValue: 3, targetValue: 7.1 },
    { id: "target-b", spectrumValue: 4, targetValue: 8.8 },
  ],
};

export function blindSpectrumProtocolAudit(
  inputs: BlindSpectrumProtocolInputs = DEFAULT_BLIND_SPECTRUM_PROTOCOL_INPUTS,
  options: EarthRunOptions = {},
): EarthKernelResult<{
  accepted: boolean;
  violations: string[];
  frozenMapping: { scale: number; offset: number };
  calibrationResiduals: Array<{ id: string; residual: number }>;
  heldOutResiduals: Array<{ id: string; predictedValue: number; targetValue: number; residual: number; relativeResidual: number }>;
  heldOutRootMeanSquareResidual: number | null;
  heldOutMeanAbsoluteResidual: number | null;
  complexityMatchedNulls: number;
  validationClaim: "none";
  caveats: string[];
}> {
  const scale = boundedNumber(inputs.mappingScale ?? 2, "mappingScale", -1e12, 1e12);
  const offset = boundedNumber(inputs.mappingOffset ?? 1, "mappingOffset", -1e12, 1e12);
  const mappingFrozen = strictBoolean(inputs.mappingFrozenBeforeTargetAccess ?? true, "mappingFrozenBeforeTargetAccess");
  const nullFamilyFrozen = strictBoolean(inputs.nullFamilyFrozenBeforeTargetAccess ?? true, "nullFamilyFrozenBeforeTargetAccess");
  const complexityMatchedNulls = boundedInteger(inputs.complexityMatchedNulls ?? 16, "complexityMatchedNulls", 1, 10_000);
  const calibration = boundedList(inputs.calibration ?? DEFAULT_BLIND_SPECTRUM_PROTOCOL_INPUTS.calibration!, "calibration", 1, 4096);
  const heldOut = boundedList(inputs.heldOut ?? DEFAULT_BLIND_SPECTRUM_PROTOCOL_INPUTS.heldOut!, "heldOut", 1, 4096);
  const heldOutIds = new Set<string>();
  for (let index = 0; index < heldOut.length; index += 1) {
    const id = boundedText(heldOut[index]!.id, `heldOut[${index}].id`);
    if (heldOutIds.has(id)) throw new RangeError(`heldOut ids must be unique: ${id}`);
    heldOutIds.add(id);
  }
  const calibrationIds = new Set<string>();
  for (let index = 0; index < calibration.length; index += 1) {
    const datum = calibration[index]!;
    const id = boundedText(datum.id, `calibration[${index}].id`);
    if (calibrationIds.has(id)) throw new RangeError(`calibration ids must be unique: ${id}`);
    calibrationIds.add(id);
    if (heldOutIds.has(id)) throw new RangeError(`calibration contains held-out target id: ${id}`);
    if (datum.containsHeldOutTarget === true) throw new RangeError(`calibration[${index}] contains a held-out target`);
    if (datum.containsHeldOutTarget !== undefined) strictBoolean(datum.containsHeldOutTarget, `calibration[${index}].containsHeldOutTarget`);
    const targetIdsUsed = datum.targetIdsUsed ?? [];
    boundedList(targetIdsUsed, `calibration[${index}].targetIdsUsed`, 0, 4096);
    if (targetIdsUsed.length > 0) throw new RangeError(`calibration[${index}] uses target ids; target-containing calibration is refused`);
  }
  const violations: string[] = [];
  if (!mappingFrozen) violations.push("mapping-not-frozen-before-target-access");
  if (!nullFamilyFrozen) violations.push("null-family-not-frozen-before-target-access");
  const accepted = violations.length === 0;
  checkCancelled(options);
  const calibrationResiduals = calibration.map((datum, index) => {
    if ((index & 255) === 0) checkCancelled(options);
    const spectrumValue = boundedNumber(datum.spectrumValue, `calibration[${index}].spectrumValue`, -1e12, 1e12);
    const referenceValue = boundedNumber(datum.referenceValue, `calibration[${index}].referenceValue`, -1e12, 1e12);
    return { id: datum.id, residual: referenceValue - (scale * spectrumValue + offset) };
  });
  const heldOutResiduals = accepted ? heldOut.map((datum, index) => {
    if ((index & 255) === 0) checkCancelled(options);
    const spectrumValue = boundedNumber(datum.spectrumValue, `heldOut[${index}].spectrumValue`, -1e12, 1e12);
    const targetValue = boundedNumber(datum.targetValue, `heldOut[${index}].targetValue`, -1e12, 1e12);
    const predictedValue = scale * spectrumValue + offset;
    return {
      id: datum.id,
      predictedValue,
      targetValue,
      residual: targetValue - predictedValue,
      relativeResidual: relativeResidual(predictedValue, targetValue),
    };
  }) : [];
  return {
    method: "Blind-protocol validation followed by residual scoring with a user-frozen affine spectrum mapping",
    diagnostics: diagnostics(
      "EARTH-X-005",
      "A blind comparison requires independently held-out targets and frozen complexity-matched null families",
      {
        targetExclusionEnforced: true,
        targetContainingCalibration: false,
        mappingFrozenBeforeTargetAccess: mappingFrozen,
        nullFamilyFrozenBeforeTargetAccess: nullFamilyFrozen,
      },
    ),
    output: {
      accepted,
      violations,
      frozenMapping: { scale, offset },
      calibrationResiduals,
      heldOutResiduals,
      heldOutRootMeanSquareResidual: accepted ? rootMeanSquare(heldOutResiduals.map(({ residual }) => residual)) : null,
      heldOutMeanAbsoluteResidual: accepted
        ? heldOutResiduals.reduce((sum, { residual }) => sum + Math.abs(residual), 0) / heldOutResiduals.length
        : null,
      complexityMatchedNulls,
      validationClaim: "none",
      caveats: [
        "Residuals test only the frozen mapping on supplied held-out targets.",
        "Protocol acceptance does not establish equivalence between theories or validate either theory.",
      ],
    },
  };
}

export const proteinRibbonComparison = proteinRibbonSineGordonComparison;
export const dnaTwistWritheEnergy = dnaTwistWritheEnergyComparison;
export const markovStateGraph = finiteMarkovStateGraph;
export const axonKinkPropagation = axonKinkPropagationComparison;
export const connectomeEigenmodes = connectomeEigenmodeComparison;
export const spectral783HzAudit = sevenPointEightThreeHzSpectralAudit;
export const aggregateSurvivalHazardCalculator = aggregateSurvivalThresholdHazardCalculator;
