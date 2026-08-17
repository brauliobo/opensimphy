import {
  boundedInteger,
  boundedNumber,
  boundedPositive,
  finiteNumber,
  relativeError,
  type EarthKernelResult,
} from "./common.js";
import {
  ELEMENTARY_CHARGE_C,
  GOLDEN_RATIO,
  PLANCK_CONSTANT_J_S,
  SPEED_OF_LIGHT_M_PER_S,
} from "../../simphy/constants.js";

const SPEED_OF_LIGHT = SPEED_OF_LIGHT_M_PER_S;
const PLANCK_CONSTANT = PLANCK_CONSTANT_J_S;
const ELEMENTARY_CHARGE = ELEMENTARY_CHARGE_C;
const ELECTRON_MASS = 9.109_383_713_9e-31;
const VACUUM_PERMITTIVITY = 8.854_187_812_8e-12;

export type ExtendedAuditStatus = "pass" | "failure";

export interface ExtendedAuditFinding {
  id: string;
  status: ExtendedAuditStatus;
  category: "literal" | "quantum-number" | "selection-rule" | "conservation" | "activity" | "charge-balance";
  message: string;
  relativeResidual: number | null;
}

export interface SourceClaimReference {
  document: string;
  location: string;
  text: string;
}

function boundedList<T>(values: T[], name: string, minimum = 1, maximum = 512): T[] {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    throw new RangeError(`${name} must contain ${minimum} to ${maximum} entries`);
  }
  return values;
}

function boundedText(value: string, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} is required`);
  if (value.length > 512) throw new RangeError(`${name} must not exceed 512 characters`);
  return value;
}

function comparisonDiagnostics(extra: Record<string, boolean | number | string | null>): Record<string, boolean | number | string | null> {
  return {
    provenanceKind: "comparison",
    benchmarkLabel: "standard-comparison-not-EARTH-derived",
    validatesEarthTheory: false,
    deterministic: true,
    hiddenNetworkOrData: false,
    ...extra,
  };
}

function reproductionDiagnostics(extra: Record<string, boolean | number | string | null>): Record<string, boolean | number | string | null> {
  return {
    provenanceKind: "reproduction",
    benchmarkLabel: "literal-source-audit",
    validatesEarthTheory: false,
    deterministic: true,
    hiddenNetworkOrData: false,
    ...extra,
  };
}

function isHalfInteger(value: number): boolean {
  return Number.isInteger(value * 2) && !Number.isInteger(value);
}

function validateAngularMomentum(value: number, name: string): number {
  boundedNumber(value, name, 0, 100);
  if (!Number.isInteger(value * 2)) throw new RangeError(`${name} must be an integer or half-integer from 0 to 100`);
  return value;
}

// EARTH-PRT-005
export type ParticleStatistics = "fermion" | "boson";

export interface ParticleQuantumNumberClaim {
  id: string;
  particle: string;
  source: SourceClaimReference;
  sourceStatistics: ParticleStatistics;
  sourceSpin: number;
  sourceChargeE: number;
  sourceWinding?: number;
  sourceMonodromyTurns: number;
  standardStatistics: ParticleStatistics;
  standardSpin: number;
  standardChargeE: number;
}

export interface ParticleLiteralClaim {
  id: string;
  source: SourceClaimReference;
  expression: string;
  claimedValue: number;
  evaluatedValue: number;
  standardComparatorValue: number;
  comparatorLabel: string;
}

export interface ParticleQuantumNumberAuditInputs {
  quantumClaims?: ParticleQuantumNumberClaim[];
  literalClaims?: ParticleLiteralClaim[];
  relativeTolerance?: number;
}

export const DEFAULT_PARTICLE_QUANTUM_NUMBER_AUDIT_INPUTS: ParticleQuantumNumberAuditInputs = {
  relativeTolerance: 1e-9,
  quantumClaims: [
    {
      id: "up-quark",
      particle: "up quark",
      source: {
        document: "Fermion Theorem",
        location: "lines 27-45 and 52-54",
        text: "Spin 1/2; winding +2/3 per colour gives charge +2/3.",
      },
      sourceStatistics: "fermion",
      sourceSpin: 0.5,
      sourceChargeE: 2 / 3,
      sourceWinding: 2 / 3,
      sourceMonodromyTurns: 2,
      standardStatistics: "fermion",
      standardSpin: 0.5,
      standardChargeE: 2 / 3,
    },
    {
      id: "down-quark",
      particle: "down quark",
      source: {
        document: "Fermion Theorem",
        location: "lines 39-45 and 52-55",
        text: "Q_em=w, but winding -2/3 per colour is assigned effective charge -1/3.",
      },
      sourceStatistics: "fermion",
      sourceSpin: 0.5,
      sourceChargeE: -1 / 3,
      sourceWinding: -2 / 3,
      sourceMonodromyTurns: 2,
      standardStatistics: "fermion",
      standardSpin: 0.5,
      standardChargeE: -1 / 3,
    },
    {
      id: "electron",
      particle: "electron",
      source: {
        document: "Fermion Theorem",
        location: "lines 39-45 and 52-57",
        text: "Q_em=w, but outside-wall winding -2 is assigned charge -1.",
      },
      sourceStatistics: "fermion",
      sourceSpin: 0.5,
      sourceChargeE: -1,
      sourceWinding: -2,
      sourceMonodromyTurns: 2,
      standardStatistics: "fermion",
      standardSpin: 0.5,
      standardChargeE: -1,
    },
    {
      id: "neutrino",
      particle: "neutrino",
      source: {
        document: "Fermion Theorem",
        location: "lines 45 and 57",
        text: "Zero winding gives a neutral spin-1/2 fermion.",
      },
      sourceStatistics: "fermion",
      sourceSpin: 0.5,
      sourceChargeE: 0,
      sourceWinding: 0,
      sourceMonodromyTurns: 2,
      standardStatistics: "fermion",
      standardSpin: 0.5,
      standardChargeE: 0,
    },
    {
      id: "photon",
      particle: "photon",
      source: {
        document: "Boson Isomorphism",
        location: "lines 17-35",
        text: "A 2pi monodromy closed loop is a massless spin-1 boson with two transverse modes.",
      },
      sourceStatistics: "boson",
      sourceSpin: 1,
      sourceChargeE: 0,
      sourceMonodromyTurns: 1,
      standardStatistics: "boson",
      standardSpin: 1,
      standardChargeE: 0,
    },
  ],
  literalClaims: [
    {
      id: "generation-ratio-phi6",
      source: {
        document: "Fermion Theorem",
        location: "lines 47-59",
        text: "The generation and muon/electron ratio phi^6 is printed as 206.7682831916941.",
      },
      expression: "phi^6",
      claimedValue: 206.768_283_191_694_1,
      evaluatedValue: GOLDEN_RATIO ** 6,
      standardComparatorValue: 206.768_283,
      comparatorLabel: "standard measured muon/electron mass ratio supplied by the audit default",
    },
    {
      id: "mixing-phi-minus-2",
      source: {
        document: "Fermion Theorem",
        location: "line 59",
        text: "The CKM magnitude |V_us|=phi^-2 is printed as 0.2225209339563144.",
      },
      expression: "phi^-2",
      claimedValue: 0.222_520_933_956_314_4,
      evaluatedValue: GOLDEN_RATIO ** -2,
      standardComparatorValue: 0.2243,
      comparatorLabel: "standard |V_us| comparator printed beside the EARTH claim",
    },
  ],
};

export function particleQuantumNumberAudit(
  inputs: ParticleQuantumNumberAuditInputs = DEFAULT_PARTICLE_QUANTUM_NUMBER_AUDIT_INPUTS,
): EarthKernelResult<{
  quantumClaims: Array<ParticleQuantumNumberClaim & {
    spinMatchesStandard: boolean;
    chargeMatchesStandard: boolean;
    statisticsMatchStandard: boolean;
    representationValid: boolean;
    windingChargeConsistent: boolean | null;
  }>;
  literalClaims: Array<ParticleLiteralClaim & { expressionResidual: number; standardResidual: number }>;
  findings: ExtendedAuditFinding[];
  graph: { nodes: string[]; edges: Array<{ from: string; to: string; relation: string }> };
}> {
  const relativeTolerance = boundedPositive(inputs.relativeTolerance ?? 1e-9, "relativeTolerance", 1e-16, 0.1);
  const sourceQuantumClaims = boundedList(inputs.quantumClaims ?? DEFAULT_PARTICLE_QUANTUM_NUMBER_AUDIT_INPUTS.quantumClaims!, "quantumClaims", 1, 128);
  const sourceLiteralClaims = boundedList(inputs.literalClaims ?? DEFAULT_PARTICLE_QUANTUM_NUMBER_AUDIT_INPUTS.literalClaims!, "literalClaims", 0, 128);
  const quantumClaims = sourceQuantumClaims.map((claim) => {
    boundedText(claim.id, "claim id");
    boundedText(claim.particle, `${claim.id} particle`);
    boundedText(claim.source.document, `${claim.id} source document`);
    boundedText(claim.source.location, `${claim.id} source location`);
    boundedText(claim.source.text, `${claim.id} source text`);
    const sourceSpin = validateAngularMomentum(claim.sourceSpin, `${claim.id} sourceSpin`);
    const standardSpin = validateAngularMomentum(claim.standardSpin, `${claim.id} standardSpin`);
    const sourceChargeE = boundedNumber(claim.sourceChargeE, `${claim.id} sourceChargeE`, -100, 100);
    const standardChargeE = boundedNumber(claim.standardChargeE, `${claim.id} standardChargeE`, -100, 100);
    const sourceWinding = claim.sourceWinding === undefined ? undefined : boundedNumber(claim.sourceWinding, `${claim.id} sourceWinding`, -100, 100);
    const sourceMonodromyTurns = boundedInteger(claim.sourceMonodromyTurns, `${claim.id} sourceMonodromyTurns`, 1, 16);
    return {
      ...claim,
      sourceSpin,
      standardSpin,
      sourceChargeE,
      standardChargeE,
      sourceWinding,
      sourceMonodromyTurns,
      spinMatchesStandard: relativeError(sourceSpin, standardSpin) <= relativeTolerance,
      chargeMatchesStandard: relativeError(sourceChargeE, standardChargeE) <= relativeTolerance,
      statisticsMatchStandard: claim.sourceStatistics === claim.standardStatistics,
      representationValid: claim.sourceStatistics === "fermion"
        ? isHalfInteger(sourceSpin) && sourceMonodromyTurns === 2
        : Number.isInteger(sourceSpin) && sourceMonodromyTurns === 1,
      windingChargeConsistent: sourceWinding === undefined ? null : relativeError(sourceWinding, sourceChargeE) <= relativeTolerance,
    };
  });
  const literalClaims = sourceLiteralClaims.map((claim) => {
    boundedText(claim.id, "literal claim id");
    boundedText(claim.expression, `${claim.id} expression`);
    boundedText(claim.comparatorLabel, `${claim.id} comparatorLabel`);
    boundedText(claim.source.document, `${claim.id} source document`);
    boundedText(claim.source.location, `${claim.id} source location`);
    boundedText(claim.source.text, `${claim.id} source text`);
    const claimedValue = finiteNumber(claim.claimedValue, `${claim.id} claimedValue`);
    const evaluatedValue = finiteNumber(claim.evaluatedValue, `${claim.id} evaluatedValue`);
    const standardComparatorValue = finiteNumber(claim.standardComparatorValue, `${claim.id} standardComparatorValue`);
    return {
      ...claim,
      claimedValue,
      evaluatedValue,
      standardComparatorValue,
      expressionResidual: relativeError(evaluatedValue, claimedValue),
      standardResidual: relativeError(evaluatedValue, standardComparatorValue),
    };
  });
  const findings: ExtendedAuditFinding[] = [];
  for (const claim of quantumClaims) {
    const checks = [
      ["spin", claim.spinMatchesStandard, "source spin differs from the supplied standard comparator"],
      ["charge", claim.chargeMatchesStandard, "source charge differs from the supplied standard comparator"],
      ["statistics", claim.statisticsMatchStandard, "source statistics differ from the supplied standard comparator"],
      ["representation", claim.representationValid, "source spin/monodromy does not define the claimed integer or half-integer representation"],
    ] as const;
    for (const [suffix, passes, message] of checks) findings.push({
      id: `${claim.id}-${suffix}`,
      status: passes ? "pass" : "failure",
      category: "quantum-number",
      message,
      relativeResidual: null,
    });
    if (claim.windingChargeConsistent !== null) findings.push({
      id: `${claim.id}-winding-charge`,
      status: claim.windingChargeConsistent ? "pass" : "failure",
      category: "quantum-number",
      message: "The explicit source equation Q_em=w is inconsistent with the source's assigned charge",
      relativeResidual: relativeError(claim.sourceWinding!, claim.sourceChargeE),
    });
  }
  for (const claim of literalClaims) findings.push({
    id: `${claim.id}-literal-evaluation`,
    status: claim.expressionResidual <= relativeTolerance ? "pass" : "failure",
    category: "literal",
    message: `${claim.expression} does not evaluate to the source's printed value`,
    relativeResidual: claim.expressionResidual,
  });
  return {
    method: "Bounded typed evaluation of explicit Fermion Theorem and Boson Isomorphism claims beside supplied standard quantum-number comparators",
    diagnostics: reproductionDiagnostics({
      quantumClaims: quantumClaims.length,
      literalClaims: literalClaims.length,
      failedChecks: findings.filter(({ status }) => status === "failure").length,
      standardValuesAreEarthDerived: false,
    }),
    output: {
      quantumClaims,
      literalClaims,
      findings,
      graph: {
        nodes: [
          ...quantumClaims.flatMap(({ id }) => [`source:${id}`, `standard:${id}`]),
          ...literalClaims.flatMap(({ id }) => [`expression:${id}`, `standard:${id}`]),
        ],
        edges: [
          ...quantumClaims.map(({ id }) => ({ from: `source:${id}`, to: `standard:${id}`, relation: "compares-quantum-numbers" })),
          ...literalClaims.map(({ id }) => ({ from: `expression:${id}`, to: `standard:${id}`, relation: "compares-value" })),
        ],
      },
    },
  };
}

// EARTH-SPEC-007
export interface RotationalTransitionInput {
  id: string;
  lowerJ: number;
  upperJ: number;
  claimedAllowed?: boolean;
}

export interface HyperfineTransitionInput {
  id: string;
  lowerF: number;
  upperF: number;
  claimedAllowed?: boolean;
}

export interface MolecularSpectroscopyAuditInputs {
  lowerRotationalConstantCmInverse?: number;
  upperRotationalConstantCmInverse?: number;
  vibrationalOriginCmInverse?: number;
  hyperfineCouplingHz?: number;
  nuclearSpin?: number;
  electronicAngularMomentum?: number;
  rotationalTransitions?: RotationalTransitionInput[];
  rovibrationalTransitions?: RotationalTransitionInput[];
  hyperfineTransitions?: HyperfineTransitionInput[];
}

export const DEFAULT_MOLECULAR_SPECTROSCOPY_AUDIT_INPUTS: MolecularSpectroscopyAuditInputs = {
  lowerRotationalConstantCmInverse: 1.9225,
  upperRotationalConstantCmInverse: 1.895,
  vibrationalOriginCmInverse: 2_143.27,
  hyperfineCouplingHz: 1_420_405_751.768,
  nuclearSpin: 0.5,
  electronicAngularMomentum: 0.5,
  rotationalTransitions: [
    { id: "J0-to-J1", lowerJ: 0, upperJ: 1 },
    { id: "J1-to-J3", lowerJ: 1, upperJ: 3 },
  ],
  rovibrationalTransitions: [
    { id: "R0", lowerJ: 0, upperJ: 1 },
    { id: "Q1", lowerJ: 1, upperJ: 1 },
    { id: "P1", lowerJ: 1, upperJ: 0 },
  ],
  hyperfineTransitions: [
    { id: "F0-to-F1", lowerF: 0, upperF: 1 },
    { id: "F0-to-F0", lowerF: 0, upperF: 0 },
    { id: "F1-to-F1", lowerF: 1, upperF: 1 },
  ],
};

function rotationalAllowed(lowerJ: number, upperJ: number): boolean {
  return Math.abs(upperJ - lowerJ) === 1;
}

function hyperfineLevelAllowed(F: number, nuclearSpin: number, electronicAngularMomentum: number): boolean {
  return F >= Math.abs(nuclearSpin - electronicAngularMomentum)
    && F <= nuclearSpin + electronicAngularMomentum
    && Number.isInteger(F - Math.abs(nuclearSpin - electronicAngularMomentum));
}

export function molecularSpectroscopyAudit(
  inputs: MolecularSpectroscopyAuditInputs = DEFAULT_MOLECULAR_SPECTROSCOPY_AUDIT_INPUTS,
): EarthKernelResult<{
  constants: { lowerRotationalConstantCmInverse: number; upperRotationalConstantCmInverse: number; vibrationalOriginCmInverse: number; hyperfineCouplingHz: number; nuclearSpin: number; electronicAngularMomentum: number };
  formulas: { rotational: string; rovibrational: string; hyperfine: string; selectionRules: string[] };
  rotational: Array<RotationalTransitionInput & { lowerEnergyCmInverse: number; upperEnergyCmInverse: number; transitionCmInverse: number; standardAllowed: boolean; sourceClaimMatches: boolean | null }>;
  rovibrational: Array<RotationalTransitionInput & { transitionCmInverse: number; branch: "P" | "Q" | "R" | "other"; standardAllowed: boolean; sourceClaimMatches: boolean | null }>;
  hyperfine: Array<HyperfineTransitionInput & { lowerEnergyHz: number; upperEnergyHz: number; transitionHz: number; levelsValid: boolean; standardAllowed: boolean; sourceClaimMatches: boolean | null }>;
  findings: ExtendedAuditFinding[];
  graph: { nodes: string[]; edges: Array<{ from: string; to: string; transition: string }> };
}> {
  const lowerRotationalConstantCmInverse = boundedPositive(inputs.lowerRotationalConstantCmInverse ?? 1.9225, "lowerRotationalConstantCmInverse", 1e-12, 1e6);
  const upperRotationalConstantCmInverse = boundedPositive(inputs.upperRotationalConstantCmInverse ?? 1.895, "upperRotationalConstantCmInverse", 1e-12, 1e6);
  const vibrationalOriginCmInverse = boundedPositive(inputs.vibrationalOriginCmInverse ?? 2_143.27, "vibrationalOriginCmInverse", 1e-12, 1e9);
  const hyperfineCouplingHz = boundedNumber(inputs.hyperfineCouplingHz ?? 1_420_405_751.768, "hyperfineCouplingHz", -1e15, 1e15);
  const nuclearSpin = validateAngularMomentum(inputs.nuclearSpin ?? 0.5, "nuclearSpin");
  const electronicAngularMomentum = validateAngularMomentum(inputs.electronicAngularMomentum ?? 0.5, "electronicAngularMomentum");
  const rotationalInputs = boundedList(inputs.rotationalTransitions ?? DEFAULT_MOLECULAR_SPECTROSCOPY_AUDIT_INPUTS.rotationalTransitions!, "rotationalTransitions");
  const rovibrationalInputs = boundedList(inputs.rovibrationalTransitions ?? DEFAULT_MOLECULAR_SPECTROSCOPY_AUDIT_INPUTS.rovibrationalTransitions!, "rovibrationalTransitions");
  const hyperfineInputs = boundedList(inputs.hyperfineTransitions ?? DEFAULT_MOLECULAR_SPECTROSCOPY_AUDIT_INPUTS.hyperfineTransitions!, "hyperfineTransitions");
  const rotational = rotationalInputs.map((transition) => {
    boundedText(transition.id, "rotational transition id");
    const lowerJ = boundedInteger(transition.lowerJ, `${transition.id} lowerJ`, 0, 100);
    const upperJ = boundedInteger(transition.upperJ, `${transition.id} upperJ`, 0, 100);
    const lowerEnergyCmInverse = lowerRotationalConstantCmInverse * lowerJ * (lowerJ + 1);
    const upperEnergyCmInverse = lowerRotationalConstantCmInverse * upperJ * (upperJ + 1);
    const standardAllowed = rotationalAllowed(lowerJ, upperJ);
    return {
      ...transition,
      lowerJ,
      upperJ,
      lowerEnergyCmInverse,
      upperEnergyCmInverse,
      transitionCmInverse: Math.abs(upperEnergyCmInverse - lowerEnergyCmInverse),
      standardAllowed,
      sourceClaimMatches: transition.claimedAllowed === undefined ? null : transition.claimedAllowed === standardAllowed,
    };
  });
  const rovibrational = rovibrationalInputs.map((transition) => {
    boundedText(transition.id, "rovibrational transition id");
    const lowerJ = boundedInteger(transition.lowerJ, `${transition.id} lowerJ`, 0, 100);
    const upperJ = boundedInteger(transition.upperJ, `${transition.id} upperJ`, 0, 100);
    const deltaJ = upperJ - lowerJ;
    const standardAllowed = Math.abs(deltaJ) === 1;
    return {
      ...transition,
      lowerJ,
      upperJ,
      transitionCmInverse: vibrationalOriginCmInverse
        + upperRotationalConstantCmInverse * upperJ * (upperJ + 1)
        - lowerRotationalConstantCmInverse * lowerJ * (lowerJ + 1),
      branch: (deltaJ === -1 ? "P" : deltaJ === 0 ? "Q" : deltaJ === 1 ? "R" : "other") as "P" | "Q" | "R" | "other",
      standardAllowed,
      sourceClaimMatches: transition.claimedAllowed === undefined ? null : transition.claimedAllowed === standardAllowed,
    };
  });
  const hyperfineEnergy = (F: number) => hyperfineCouplingHz / 2
    * (F * (F + 1) - nuclearSpin * (nuclearSpin + 1) - electronicAngularMomentum * (electronicAngularMomentum + 1));
  const hyperfine = hyperfineInputs.map((transition) => {
    boundedText(transition.id, "hyperfine transition id");
    const lowerF = validateAngularMomentum(transition.lowerF, `${transition.id} lowerF`);
    const upperF = validateAngularMomentum(transition.upperF, `${transition.id} upperF`);
    const levelsValid = hyperfineLevelAllowed(lowerF, nuclearSpin, electronicAngularMomentum)
      && hyperfineLevelAllowed(upperF, nuclearSpin, electronicAngularMomentum);
    const standardAllowed = levelsValid && Math.abs(upperF - lowerF) <= 1 && !(lowerF === 0 && upperF === 0);
    const lowerEnergyHz = hyperfineEnergy(lowerF);
    const upperEnergyHz = hyperfineEnergy(upperF);
    return {
      ...transition,
      lowerF,
      upperF,
      lowerEnergyHz,
      upperEnergyHz,
      transitionHz: Math.abs(upperEnergyHz - lowerEnergyHz),
      levelsValid,
      standardAllowed,
      sourceClaimMatches: transition.claimedAllowed === undefined ? null : transition.claimedAllowed === standardAllowed,
    };
  });
  const findings: ExtendedAuditFinding[] = [
    ...rotational,
    ...rovibrational,
    ...hyperfine,
  ].flatMap((transition) => transition.sourceClaimMatches === null ? [] : [{
    id: `${transition.id}-selection-rule`,
    status: transition.sourceClaimMatches ? "pass" as const : "failure" as const,
    category: "selection-rule" as const,
    message: "The supplied allowed/forbidden claim disagrees with the standard electric-dipole selection rule",
    relativeResidual: null,
  }]);
  return {
    method: "Rigid-rotor, diatomic rovibrational, and scalar I.J hyperfine formulas using only supplied constants and standard electric-dipole selection rules",
    diagnostics: comparisonDiagnostics({
      rotationalTransitions: rotational.length,
      rovibrationalTransitions: rovibrational.length,
      hyperfineTransitions: hyperfine.length,
      suppliedSelectionClaims: findings.length,
      failedSelectionClaims: findings.filter(({ status }) => status === "failure").length,
      earthSelectionRulesAvailable: false,
      earthTransitionOperatorAvailable: false,
      intensitiesComputed: false,
    }),
    output: {
      constants: { lowerRotationalConstantCmInverse, upperRotationalConstantCmInverse, vibrationalOriginCmInverse, hyperfineCouplingHz, nuclearSpin, electronicAngularMomentum },
      formulas: {
        rotational: "E_J/(h*c)=B*J*(J+1)",
        rovibrational: "nu~=nu~0+B'*J'*(J'+1)-B''*J''*(J''+1)",
        hyperfine: "E_F/h=(A/2)[F(F+1)-I(I+1)-J(J+1)]",
        selectionRules: ["rotational/rovibrational: delta J=+/-1", "hyperfine: delta F=0,+/-1, excluding F=0 to F=0"],
      },
      rotational,
      rovibrational,
      hyperfine,
      findings,
      graph: {
        nodes: [
          ...rotational.flatMap(({ id, lowerJ, upperJ }) => [`rot:${id}:J${lowerJ}`, `rot:${id}:J${upperJ}`]),
          ...rovibrational.flatMap(({ id, lowerJ, upperJ }) => [`rovib:${id}:v0J${lowerJ}`, `rovib:${id}:v1J${upperJ}`]),
          ...hyperfine.flatMap(({ id, lowerF, upperF }) => [`hf:${id}:F${lowerF}`, `hf:${id}:F${upperF}`]),
        ],
        edges: [
          ...rotational.map(({ id, lowerJ, upperJ }) => ({ from: `rot:${id}:J${lowerJ}`, to: `rot:${id}:J${upperJ}`, transition: id })),
          ...rovibrational.map(({ id, lowerJ, upperJ }) => ({ from: `rovib:${id}:v0J${lowerJ}`, to: `rovib:${id}:v1J${upperJ}`, transition: id })),
          ...hyperfine.map(({ id, lowerF, upperF }) => ({ from: `hf:${id}:F${lowerF}`, to: `hf:${id}:F${upperF}`, transition: id })),
        ],
      },
    },
  };
}

// EARTH-MAT-010
export interface PhotonKinematicsAuditInputs {
  speedOfLight?: number;
  planckConstant?: number;
  elementaryCharge?: number;
  electronMassKg?: number;
  vacuumPermittivity?: number;
  incidentWavelengthM?: number;
  comptonScatteringAngleRad?: number;
  restFrequencyHz?: number;
  observerApproachVelocityMPerS?: number;
  photoelectricFrequencyHz?: number;
  workFunctionEv?: number;
  radiatingChargeC?: number;
  accelerationMPerS2?: number;
}

export const DEFAULT_PHOTON_KINEMATICS_AUDIT_INPUTS: PhotonKinematicsAuditInputs = {
  speedOfLight: SPEED_OF_LIGHT,
  planckConstant: PLANCK_CONSTANT,
  elementaryCharge: ELEMENTARY_CHARGE,
  electronMassKg: ELECTRON_MASS,
  vacuumPermittivity: VACUUM_PERMITTIVITY,
  incidentWavelengthM: 0.071_073e-9,
  comptonScatteringAngleRad: Math.PI,
  restFrequencyHz: 500e12,
  observerApproachVelocityMPerS: 30_000,
  photoelectricFrequencyHz: 1e15,
  workFunctionEv: 2.2,
  radiatingChargeC: ELEMENTARY_CHARGE,
  accelerationMPerS2: 1e15,
};

export function photonKinematicsAudit(
  inputs: PhotonKinematicsAuditInputs = DEFAULT_PHOTON_KINEMATICS_AUDIT_INPUTS,
): EarthKernelResult<{
  constants: { speedOfLight: number; planckConstant: number; elementaryCharge: number; electronMassKg: number; vacuumPermittivity: number };
  compton: { formula: string; incidentWavelengthM: number; scatteringAngleRad: number; electronComptonWavelengthM: number; wavelengthShiftM: number; scatteredWavelengthM: number; incidentPhotonEnergyJ: number; scatteredPhotonEnergyJ: number; recoilKineticFromEnergyJ: number; recoilKineticFromMomentumJ: number; energyMomentumResidual: number };
  doppler: { formula: string; restFrequencyHz: number; approachVelocityMPerS: number; beta: number; observedFrequencyHz: number };
  photoelectric: { formula: string; photonEnergyEv: number; workFunctionEv: number; emitted: boolean; maximumKineticEnergyEv: number; energyBalanceResidualEv: number | null };
  larmor: { formula: string; chargeC: number; accelerationMPerS2: number; powerW: number; nonRelativistic: true };
  findings: ExtendedAuditFinding[];
  series: Array<{ angleRad: number; wavelengthShiftM: number }>;
}> {
  const speedOfLight = boundedPositive(inputs.speedOfLight ?? SPEED_OF_LIGHT, "speedOfLight", 1, 1e10);
  const planckConstant = boundedPositive(inputs.planckConstant ?? PLANCK_CONSTANT, "planckConstant", 1e-40, 1e-30);
  const elementaryCharge = boundedPositive(inputs.elementaryCharge ?? ELEMENTARY_CHARGE, "elementaryCharge", 1e-25, 1e-15);
  const electronMassKg = boundedPositive(inputs.electronMassKg ?? ELECTRON_MASS, "electronMassKg", 1e-35, 1e-25);
  const vacuumPermittivity = boundedPositive(inputs.vacuumPermittivity ?? VACUUM_PERMITTIVITY, "vacuumPermittivity", 1e-15, 1e-9);
  const incidentWavelengthM = boundedPositive(inputs.incidentWavelengthM ?? 0.071_073e-9, "incidentWavelengthM", 1e-18, 1e3);
  const scatteringAngleRad = boundedNumber(inputs.comptonScatteringAngleRad ?? Math.PI, "comptonScatteringAngleRad", 0, Math.PI);
  const restFrequencyHz = boundedPositive(inputs.restFrequencyHz ?? 500e12, "restFrequencyHz", 1, 1e30);
  const approachVelocityMPerS = boundedNumber(inputs.observerApproachVelocityMPerS ?? 30_000, "observerApproachVelocityMPerS", -0.999_999 * speedOfLight, 0.999_999 * speedOfLight);
  const photoelectricFrequencyHz = boundedPositive(inputs.photoelectricFrequencyHz ?? 1e15, "photoelectricFrequencyHz", 1, 1e30);
  const workFunctionEv = boundedPositive(inputs.workFunctionEv ?? 2.2, "workFunctionEv", 1e-12, 1e9);
  const radiatingChargeC = boundedNumber(inputs.radiatingChargeC ?? ELEMENTARY_CHARGE, "radiatingChargeC", -1, 1);
  const accelerationMPerS2 = boundedNumber(inputs.accelerationMPerS2 ?? 1e15, "accelerationMPerS2", -1e30, 1e30);
  const electronComptonWavelengthM = planckConstant / (electronMassKg * speedOfLight);
  const wavelengthShiftM = electronComptonWavelengthM * (1 - Math.cos(scatteringAngleRad));
  const scatteredWavelengthM = incidentWavelengthM + wavelengthShiftM;
  const incidentPhotonEnergyJ = planckConstant * speedOfLight / incidentWavelengthM;
  const scatteredPhotonEnergyJ = planckConstant * speedOfLight / scatteredWavelengthM;
  const incidentMomentum = incidentPhotonEnergyJ / speedOfLight;
  const scatteredMomentum = scatteredPhotonEnergyJ / speedOfLight;
  const recoilMomentum = Math.hypot(
    incidentMomentum - scatteredMomentum * Math.cos(scatteringAngleRad),
    scatteredMomentum * Math.sin(scatteringAngleRad),
  );
  const recoilKineticFromEnergyJ = incidentPhotonEnergyJ - scatteredPhotonEnergyJ;
  const electronRestEnergyJ = electronMassKg * speedOfLight ** 2;
  const recoilKineticFromMomentumJ = Math.hypot(recoilMomentum * speedOfLight, electronRestEnergyJ) - electronRestEnergyJ;
  const energyMomentumResidual = relativeError(recoilKineticFromMomentumJ, recoilKineticFromEnergyJ);
  const beta = approachVelocityMPerS / speedOfLight;
  const observedFrequencyHz = restFrequencyHz * Math.sqrt((1 + beta) / (1 - beta));
  const photonEnergyEv = planckConstant * photoelectricFrequencyHz / elementaryCharge;
  const emitted = photonEnergyEv >= workFunctionEv;
  const maximumKineticEnergyEv = Math.max(0, photonEnergyEv - workFunctionEv);
  const energyBalanceResidualEv = emitted ? photonEnergyEv - workFunctionEv - maximumKineticEnergyEv : null;
  const larmorPowerW = radiatingChargeC ** 2 * accelerationMPerS2 ** 2
    / (6 * Math.PI * vacuumPermittivity * speedOfLight ** 3);
  const findings: ExtendedAuditFinding[] = [
    {
      id: "compton-energy-momentum",
      status: energyMomentumResidual <= 1e-12 ? "pass" : "failure",
      category: "conservation",
      message: "Compton recoil must satisfy relativistic energy and momentum conservation",
      relativeResidual: energyMomentumResidual,
    },
    {
      id: "photoelectric-energy",
      status: energyBalanceResidualEv === null || Math.abs(energyBalanceResidualEv) <= 1e-12 ? "pass" : "failure",
      category: "conservation",
      message: "Above threshold, h*nu must equal work function plus maximum electron kinetic energy",
      relativeResidual: energyBalanceResidualEv === null ? null : Math.abs(energyBalanceResidualEv),
    },
  ];
  return {
    method: "Standard SI Compton, longitudinal relativistic Doppler, Einstein photoelectric, and non-relativistic Larmor comparators; no EARTH emission law",
    diagnostics: comparisonDiagnostics({
      standardPhysicsOnly: true,
      earthEmissionFunctionalAvailable: false,
      earthScatteringFunctionalAvailable: false,
      conservationFailures: findings.filter(({ status }) => status === "failure").length,
    }),
    output: {
      constants: { speedOfLight, planckConstant, elementaryCharge, electronMassKg, vacuumPermittivity },
      compton: {
        formula: "lambda'-lambda=h/(m_e*c)*(1-cos(theta))",
        incidentWavelengthM,
        scatteringAngleRad,
        electronComptonWavelengthM,
        wavelengthShiftM,
        scatteredWavelengthM,
        incidentPhotonEnergyJ,
        scatteredPhotonEnergyJ,
        recoilKineticFromEnergyJ,
        recoilKineticFromMomentumJ,
        energyMomentumResidual,
      },
      doppler: {
        formula: "f_obs=f_0*sqrt((1+beta)/(1-beta)); beta>0 is approach",
        restFrequencyHz,
        approachVelocityMPerS,
        beta,
        observedFrequencyHz,
      },
      photoelectric: {
        formula: "K_max=h*nu-Phi",
        photonEnergyEv,
        workFunctionEv,
        emitted,
        maximumKineticEnergyEv,
        energyBalanceResidualEv,
      },
      larmor: {
        formula: "P=q^2*a^2/(6*pi*epsilon_0*c^3)",
        chargeC: radiatingChargeC,
        accelerationMPerS2,
        powerW: larmorPowerW,
        nonRelativistic: true,
      },
      findings,
      series: Array.from({ length: 33 }, (_, index) => {
        const angleRad = Math.PI * index / 32;
        return { angleRad, wavelengthShiftM: electronComptonWavelengthM * (1 - Math.cos(angleRad)) };
      }),
    },
  };
}

// EARTH-THERM-006
export interface SolubilityProductAuditInputs {
  temperatureKelvin?: number;
  deltaEnergyKcalPerMol?: number;
  molarGasConstantKcalPerMolKelvin?: number;
  saltCoherenceAngstrom?: number;
  solutionCoherenceAngstrom?: number;
  coherenceExponent?: number;
  sourceClaimedKsp?: number;
  cationConcentrationMolPerL?: number;
  anionConcentrationMolPerL?: number;
  cationActivityCoefficient?: number;
  anionActivityCoefficient?: number;
  cationStoichiometry?: number;
  anionStoichiometry?: number;
  standardConcentrationMolPerL?: number;
}

export const DEFAULT_SOLUBILITY_PRODUCT_AUDIT_INPUTS: SolubilityProductAuditInputs = {
  temperatureKelvin: 298.15,
  deltaEnergyKcalPerMol: 2.61,
  molarGasConstantKcalPerMolKelvin: 0.001986,
  saltCoherenceAngstrom: 5.64,
  solutionCoherenceAngstrom: 3.8,
  coherenceExponent: 6,
  sourceClaimedKsp: 36,
  cationConcentrationMolPerL: 6,
  anionConcentrationMolPerL: 6,
  cationActivityCoefficient: 1,
  anionActivityCoefficient: 1,
  cationStoichiometry: 1,
  anionStoichiometry: 1,
  standardConcentrationMolPerL: 1,
};

export function solubilityProductAudit(
  inputs: SolubilityProductAuditInputs = DEFAULT_SOLUBILITY_PRODUCT_AUDIT_INPUTS,
): EarthKernelResult<{
  source: SourceClaimReference;
  printedExpression: string;
  literal: { boltzmannFactor: number; coherenceRatioPower: number; value: number; claimedValue: number; claimedRelativeResidual: number };
  standardActivityComparator: { label: "standard-comparison-not-EARTH-derived"; cationActivity: number; anionActivity: number; activityProduct: number; standardConcentrationMolPerL: number };
  caveats: string[];
  findings: ExtendedAuditFinding[];
}> {
  const temperatureKelvin = boundedPositive(inputs.temperatureKelvin ?? 298.15, "temperatureKelvin", 1, 1e6);
  const deltaEnergyKcalPerMol = boundedNumber(inputs.deltaEnergyKcalPerMol ?? 2.61, "deltaEnergyKcalPerMol", -1e6, 1e6);
  const molarGasConstantKcalPerMolKelvin = boundedPositive(inputs.molarGasConstantKcalPerMolKelvin ?? 0.001986, "molarGasConstantKcalPerMolKelvin", 1e-12, 1);
  const saltCoherenceAngstrom = boundedPositive(inputs.saltCoherenceAngstrom ?? 5.64, "saltCoherenceAngstrom", 1e-12, 1e12);
  const solutionCoherenceAngstrom = boundedPositive(inputs.solutionCoherenceAngstrom ?? 3.8, "solutionCoherenceAngstrom", 1e-12, 1e12);
  const coherenceExponent = boundedInteger(inputs.coherenceExponent ?? 6, "coherenceExponent", 1, 64);
  const sourceClaimedKsp = boundedPositive(inputs.sourceClaimedKsp ?? 36, "sourceClaimedKsp", 1e-300, 1e300);
  const cationConcentrationMolPerL = boundedPositive(inputs.cationConcentrationMolPerL ?? 6, "cationConcentrationMolPerL", 1e-15, 100);
  const anionConcentrationMolPerL = boundedPositive(inputs.anionConcentrationMolPerL ?? 6, "anionConcentrationMolPerL", 1e-15, 100);
  const cationActivityCoefficient = boundedPositive(inputs.cationActivityCoefficient ?? 1, "cationActivityCoefficient", 1e-12, 100);
  const anionActivityCoefficient = boundedPositive(inputs.anionActivityCoefficient ?? 1, "anionActivityCoefficient", 1e-12, 100);
  const cationStoichiometry = boundedInteger(inputs.cationStoichiometry ?? 1, "cationStoichiometry", 1, 16);
  const anionStoichiometry = boundedInteger(inputs.anionStoichiometry ?? 1, "anionStoichiometry", 1, 16);
  const standardConcentrationMolPerL = boundedPositive(inputs.standardConcentrationMolPerL ?? 1, "standardConcentrationMolPerL", 1e-12, 100);
  const boltzmannFactor = Math.exp(-deltaEnergyKcalPerMol / (molarGasConstantKcalPerMolKelvin * temperatureKelvin));
  const coherenceRatioPower = (saltCoherenceAngstrom / solutionCoherenceAngstrom) ** coherenceExponent;
  const literalValue = boltzmannFactor * coherenceRatioPower;
  if (!Number.isFinite(literalValue)) throw new RangeError("printed Ksp expression exceeds the Float64 bound");
  const cationActivity = cationActivityCoefficient * cationConcentrationMolPerL / standardConcentrationMolPerL;
  const anionActivity = anionActivityCoefficient * anionConcentrationMolPerL / standardConcentrationMolPerL;
  const activityProduct = cationActivity ** cationStoichiometry * anionActivity ** anionStoichiometry;
  if (!Number.isFinite(activityProduct)) throw new RangeError("activity product exceeds the Float64 bound");
  const claimedRelativeResidual = relativeError(literalValue, sourceClaimedKsp);
  const findings: ExtendedAuditFinding[] = [
    {
      id: "printed-ksp-versus-claim",
      status: claimedRelativeResidual <= 1e-8 ? "pass" : "failure",
      category: "literal",
      message: "The printed EARTH Ksp expression does not reproduce its NaCl Ksp claim",
      relativeResidual: claimedRelativeResidual,
    },
    {
      id: "printed-ksp-versus-activity-product",
      status: relativeError(literalValue, activityProduct) <= 1e-8 ? "pass" : "failure",
      category: "activity",
      message: "The coherence-length expression is not the standard dimensionless ion-activity product",
      relativeResidual: relativeError(literalValue, activityProduct),
    },
  ];
  return {
    method: "Literal bounded evaluation of the CHEM-8 Ksp expression beside a separately labeled standard ion-activity product",
    diagnostics: reproductionDiagnostics({
      standardComparator: "standard-comparison-not-EARTH-derived",
      failedChecks: findings.filter(({ status }) => status === "failure").length,
      predictiveActivityModelAvailable: false,
    }),
    output: {
      source: {
        document: "Theorem CHEM-8: Thermodynamics of Solutions and Phase Transitions",
        location: "lines 156-178",
        text: "Ksp=exp[-DeltaE0/(kT)]*(xi_salt/xi_solution)^6; NaCl claim Ksp approximately 36 at 298.15 K.",
      },
      printedExpression: "Ksp=exp(-DeltaE0/(R*T))*(xi_salt/xi_solution)^n",
      literal: { boltzmannFactor, coherenceRatioPower, value: literalValue, claimedValue: sourceClaimedKsp, claimedRelativeResidual },
      standardActivityComparator: { label: "standard-comparison-not-EARTH-derived", cationActivity, anionActivity, activityProduct, standardConcentrationMolPerL },
      caveats: [
        "Thermodynamic Ksp is dimensionless and is defined from activities relative to a declared standard state.",
        "A concentration product equals the activity product only under an ideal-solution approximation with activity coefficients equal to one.",
        "Concentrated NaCl is non-ideal; supplied activity coefficients are comparator inputs, not predictions of EARTH.",
        "The printed constant 0.001986 kcal mol^-1 K^-1 is the molar gas constant R, not the single-particle Boltzmann constant.",
      ],
      findings,
    },
  };
}

// EARTH-THERM-007
export type ElectrolyteSystem = "monoprotic-acid" | "fully-dissociated-salt";

export interface ElectrolyteSpeciationInputs {
  system?: ElectrolyteSystem;
  analyticalConcentrationMolPerL?: number;
  acidDissociationConstant?: number;
  waterIonProduct?: number;
  cationStoichiometry?: number;
  anionStoichiometry?: number;
  cationCharge?: number;
  anionCharge?: number;
}

export const DEFAULT_ELECTROLYTE_SPECIATION_INPUTS: ElectrolyteSpeciationInputs = {
  system: "monoprotic-acid",
  analyticalConcentrationMolPerL: 0.1,
  acidDissociationConstant: 1.8e-5,
  waterIonProduct: 1e-14,
  cationStoichiometry: 1,
  anionStoichiometry: 1,
  cationCharge: 1,
  anionCharge: -1,
};

export function electrolyteSpeciationComparator(
  inputs: ElectrolyteSpeciationInputs = DEFAULT_ELECTROLYTE_SPECIATION_INPUTS,
): EarthKernelResult<{
  system: ElectrolyteSystem;
  model: "ideal-standard-comparison-not-EARTH-derived";
  species: Array<{ name: string; charge: number; concentrationMolPerL: number; activityCoefficient: 1; activity: number }>;
  balances: { analyticalTotalMolPerL: number; recoveredTotalMolPerL: number; massBalanceResidualMolPerL: number; positiveChargeMolPerL: number; negativeChargeMolPerL: number; chargeBalanceResidualMolPerL: number; equilibriumRelativeResidual: number | null };
  caveats: string[];
  graph: { nodes: string[]; edges: Array<{ from: string; to: string; relation: string }> };
}> {
  const system = inputs.system ?? "monoprotic-acid";
  if (system !== "monoprotic-acid" && system !== "fully-dissociated-salt") throw new TypeError("system must be monoprotic-acid or fully-dissociated-salt");
  const analyticalTotalMolPerL = boundedPositive(inputs.analyticalConcentrationMolPerL ?? 0.1, "analyticalConcentrationMolPerL", 1e-15, 100);
  if (system === "fully-dissociated-salt") {
    const cationStoichiometry = boundedInteger(inputs.cationStoichiometry ?? 1, "cationStoichiometry", 1, 16);
    const anionStoichiometry = boundedInteger(inputs.anionStoichiometry ?? 1, "anionStoichiometry", 1, 16);
    const cationCharge = boundedInteger(inputs.cationCharge ?? 1, "cationCharge", 1, 16);
    const anionCharge = boundedInteger(inputs.anionCharge ?? -1, "anionCharge", -16, -1);
    if (cationStoichiometry * cationCharge + anionStoichiometry * anionCharge !== 0) {
      throw new RangeError("salt stoichiometry and charges must describe an electrically neutral formula unit");
    }
    const cationConcentration = cationStoichiometry * analyticalTotalMolPerL;
    const anionConcentration = anionStoichiometry * analyticalTotalMolPerL;
    const positiveChargeMolPerL = cationCharge * cationConcentration;
    const negativeChargeMolPerL = -anionCharge * anionConcentration;
    return {
      method: "Exact ideal fully dissociated salt stoichiometry and charge balance; standard comparator only",
      diagnostics: comparisonDiagnostics({ system, iterations: 0, chargeBalanced: positiveChargeMolPerL === negativeChargeMolPerL, earthElectrolyteLawAvailable: false }),
      output: {
        system,
        model: "ideal-standard-comparison-not-EARTH-derived",
        species: [
          { name: "cation", charge: cationCharge, concentrationMolPerL: cationConcentration, activityCoefficient: 1, activity: cationConcentration },
          { name: "anion", charge: anionCharge, concentrationMolPerL: anionConcentration, activityCoefficient: 1, activity: anionConcentration },
        ],
        balances: {
          analyticalTotalMolPerL,
          recoveredTotalMolPerL: analyticalTotalMolPerL,
          massBalanceResidualMolPerL: 0,
          positiveChargeMolPerL,
          negativeChargeMolPerL,
          chargeBalanceResidualMolPerL: positiveChargeMolPerL - negativeChargeMolPerL,
          equilibriumRelativeResidual: null,
        },
        caveats: ["Complete dissociation and unit activity coefficients are declared ideal assumptions.", "No Pitzer, Debye-Huckel, ion pairing, precipitation, or EARTH constitutive law is included."],
        graph: { nodes: ["salt", "cation", "anion"], edges: [{ from: "salt", to: "cation", relation: "dissociates" }, { from: "salt", to: "anion", relation: "dissociates" }] },
      },
    };
  }
  const acidDissociationConstant = boundedPositive(inputs.acidDissociationConstant ?? 1.8e-5, "acidDissociationConstant", 1e-20, 1e6);
  const waterIonProduct = boundedPositive(inputs.waterIonProduct ?? 1e-14, "waterIonProduct", 1e-30, 1);
  const chargeFunction = (hydrogen: number) => hydrogen - waterIonProduct / hydrogen
    - analyticalTotalMolPerL * acidDissociationConstant / (hydrogen + acidDissociationConstant);
  let lower = Math.sqrt(waterIonProduct);
  let upper = analyticalTotalMolPerL + lower + acidDissociationConstant;
  for (let iteration = 0; iteration < 160; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    if (chargeFunction(midpoint) < 0) lower = midpoint;
    else upper = midpoint;
  }
  const hydrogen = (lower + upper) / 2;
  const hydroxide = waterIonProduct / hydrogen;
  const conjugateBase = analyticalTotalMolPerL * acidDissociationConstant / (hydrogen + acidDissociationConstant);
  const undissociatedAcid = analyticalTotalMolPerL - conjugateBase;
  const recoveredTotalMolPerL = undissociatedAcid + conjugateBase;
  const chargeBalanceResidualMolPerL = hydrogen - conjugateBase - hydroxide;
  const recoveredKa = hydrogen * conjugateBase / undissociatedAcid;
  const equilibriumRelativeResidual = relativeError(recoveredKa, acidDissociationConstant);
  return {
    method: "Bounded 160-step bisection of ideal monoprotic-acid mass action, water equilibrium, mass balance, and electroneutrality; standard comparator only",
    diagnostics: comparisonDiagnostics({
      system,
      iterations: 160,
      chargeBalanced: Math.abs(chargeBalanceResidualMolPerL) <= 1e-12 * analyticalTotalMolPerL,
      earthElectrolyteLawAvailable: false,
    }),
    output: {
      system,
      model: "ideal-standard-comparison-not-EARTH-derived",
      species: [
        { name: "HA", charge: 0, concentrationMolPerL: undissociatedAcid, activityCoefficient: 1, activity: undissociatedAcid },
        { name: "H+", charge: 1, concentrationMolPerL: hydrogen, activityCoefficient: 1, activity: hydrogen },
        { name: "A-", charge: -1, concentrationMolPerL: conjugateBase, activityCoefficient: 1, activity: conjugateBase },
        { name: "OH-", charge: -1, concentrationMolPerL: hydroxide, activityCoefficient: 1, activity: hydroxide },
      ],
      balances: {
        analyticalTotalMolPerL,
        recoveredTotalMolPerL,
        massBalanceResidualMolPerL: recoveredTotalMolPerL - analyticalTotalMolPerL,
        positiveChargeMolPerL: hydrogen,
        negativeChargeMolPerL: conjugateBase + hydroxide,
        chargeBalanceResidualMolPerL,
        equilibriumRelativeResidual,
      },
      caveats: ["This is an ideal dilute-solution comparator with all activity coefficients fixed to one.", "No Pitzer, Debye-Huckel, precipitation, or EARTH constitutive law is included."],
      graph: {
        nodes: ["HA", "H+", "A-", "OH-"],
        edges: [
          { from: "HA", to: "H+", relation: "dissociates" },
          { from: "HA", to: "A-", relation: "dissociates" },
          { from: "H+", to: "OH-", relation: "water-equilibrium" },
        ],
      },
    },
  };
}

export const earthPrt005Audit = particleQuantumNumberAudit;
export const earthSpec007Audit = molecularSpectroscopyAudit;
export const earthMat010Audit = photonKinematicsAudit;
export const earthTherm006Audit = solubilityProductAudit;
export const earthTherm007Audit = electrolyteSpeciationComparator;
