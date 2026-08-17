import {
  boundedInteger,
  boundedNumber,
  checkCancelled,
  logarithmicSamples,
  nonNegativeNumber,
  positiveNumber,
  relativeError,
  type EarthRunOptions,
} from "../common.js";
import {
  buildEarthPredictionLedger,
  buildEarthPredictionRow,
  missingPredictionSlot,
  type EarthPredictionLedger,
} from "./ledger.js";

export interface DerrickScalarGateInputs {
  gradientEnergy?: number;
  potentialEnergy?: number;
  lambdaMinimum?: number;
  lambdaMaximum?: number;
  samples?: number;
  lambdaTilde0?: number;
}

export const DEFAULT_DERRICK_SCALAR_GATE_INPUTS: DerrickScalarGateInputs = {
  gradientEnergy:  1,
  potentialEnergy: 1,
  lambdaMinimum:   0.01,
  lambdaMaximum:   100,
  samples:         129,
  lambdaTilde0:    44.492,
};

const PROGRAM_ID = "EARTH-FLD-001";
const KERNEL_ID = "derrick-scalar-gate";
const LAMBDA_TILDE_LITERAL = (4 * Math.PI) ** 3;
const PLAIN = "this field cannot carry Hopfions";
const MISSING_THAD = missingPredictionSlot("Thad/Physics Monastery scalar field action");
const MISSING_NASSIM = missingPredictionSlot("Haramein holographic-mass Lagrangian; not this scalar field action");

function scaleEnergy(inputs: DerrickScalarGateInputs) {
  const gradientEnergy = nonNegativeNumber(inputs.gradientEnergy ?? 1, "gradientEnergy");
  const potentialEnergy = nonNegativeNumber(inputs.potentialEnergy ?? 1, "potentialEnergy");
  if (gradientEnergy === 0 && potentialEnergy === 0) throw new RangeError("At least one energy contribution must be positive");
  const lambdaMinimum = boundedNumber(inputs.lambdaMinimum ?? 0.01, "lambdaMinimum", 1e-6, 1e6);
  const lambdaMaximum = boundedNumber(inputs.lambdaMaximum ?? 100, "lambdaMaximum", 1e-6, 1e6);
  if (lambdaMaximum <= lambdaMinimum) throw new RangeError("lambdaMaximum must be greater than lambdaMinimum");
  const samples = boundedInteger(inputs.samples ?? 129, "samples", 2, 4096);
  const series = logarithmicSamples(lambdaMinimum, lambdaMaximum, samples).map((lambda) => {
    const gradientTerm = lambda * gradientEnergy;
    const potentialTerm = lambda ** 3 * potentialEnergy;
    return {
      lambda,
      gradientTerm,
      potentialTerm,
      totalEnergy: gradientTerm + potentialTerm,
      derivative:  gradientEnergy + 3 * lambda ** 2 * potentialEnergy,
    };
  });
  return {
    gradientEnergy,
    potentialEnergy,
    derivativeAtOne:              gradientEnergy + 3 * potentialEnergy,
    derivativeStrictlyPositive:   series.every(({ derivative }) => derivative > 0),
    series,
  };
}

export function derrickScalarGate(
  inputs: DerrickScalarGateInputs = DEFAULT_DERRICK_SCALAR_GATE_INPUTS,
  options: EarthRunOptions = {},
) {
  checkCancelled(options);
  const scaling = scaleEnergy(inputs);
  const lambdaTilde0 = positiveNumber(inputs.lambdaTilde0 ?? 44.492, "lambdaTilde0");
  const lambdaCx = relativeError(lambdaTilde0, LAMBDA_TILDE_LITERAL);
  const collapse = scaling.derivativeStrictlyPositive && scaling.series.every(({ derivative }) => derivative > 0);

  const derrickRow = buildEarthPredictionRow({
    claimId:        "FLD-001-DERRICK",
    programId:      PROGRAM_ID,
    kernelId:       KERNEL_ID,
    observable:     "finite-size-minimum",
    unit:           "1",
    sm: {
      value:       0,
      uncertainty: null,
      source:      "Derrick theorem: no stable finite-size 3D soliton for ½|∇ψ|² plus a non-negative potential",
      release:     "Derrick 1964",
    },
    earth: {
      printed:   1,
      evaluated: collapse ? 0 : 1,
      formula:   "E[ψ_λ]=λ∫½|∇ψ|² + λ³(λ̃₀/4)∫(|ψ|²−1)² in 3D; dE/dλ=E_grad+3λ² E_pot>0",
    },
    thad:           MISSING_THAD,
    nassim:         MISSING_NASSIM,
    gate:           { metric: "exact", passIf: "exact" },
    auditStatus:    "falsified",
    g2aIndependent: true,
    datasetIds:     [],
    modelSummary:   "Published EARTH scalar under three-dimensional Derrick dilation",
    plainLanguage:  PLAIN,
    discrepancy:    "Printed Q=1 Hopfion needs a finite-size minimum; the action collapses to zero size",
  });

  const topologyRow = buildEarthPredictionRow({
    claimId:        "FLD-001-PI3",
    programId:      PROGRAM_ID,
    kernelId:       KERNEL_ID,
    observable:     "pi_3(S^1)",
    unit:           "1",
    sm: {
      value:       0,
      uncertainty: 0,
      source:      "algebraic topology: vacuum |ψ|=1 is S¹; Hopf charge lives in π₃(S²)=ℤ",
      release:     "π₃(S¹)=0",
    },
    earth: {
      printed:   1,
      evaluated: 0,
      formula:   "vacuum manifold S¹ from |ψ|=1; claimed Hopf Q=1 requires π₃≠0",
    },
    thad:           MISSING_THAD,
    nassim:         MISSING_NASSIM,
    gate:           { metric: "exact", passIf: "exact" },
    auditStatus:    "falsified",
    g2aIndependent: true,
    datasetIds:     [],
    modelSummary:   "Topological gate on the published complex scalar",
    plainLanguage:  PLAIN,
    discrepancy:    "topological-gate: π₃(S¹)=0 forbids a Hopf label on this field",
  });

  const predictionLedger: EarthPredictionLedger = buildEarthPredictionLedger({
    simulationId:        PROGRAM_ID,
    predictions:         [derrickRow, topologyRow],
    scientificStatus:    "audit",
    referenceDatasetIds: [],
    blockers:            ["Published S¹ scalar has no Hopf sector; FLD-002/003/004 stay blocked"],
    findings: [
      { claimId: "FLD-001-DERRICK", text: "3D Derrick scaling of ½|∇ψ|²+(λ̃₀/4)(|ψ|²−1)² has no finite-size minimum" },
      { claimId: "FLD-001-PI3",     text: "topological-gate: π₃(S¹)=0; Hopf label forbidden" },
      { claimId: "FLD-001-DERRICK", text: `arithmetic-cx: printed λ̃₀=${lambdaTilde0} vs (4π)³=${LAMBDA_TILDE_LITERAL}` },
    ],
  });

  return {
    method: "3D Derrick dilation of the published EARTH scalar plus the π₃(S¹)=0 Hopf gate",
    diagnostics: {
      provenanceKind:                 "reproduction",
      benchmarkLabel:                 "reproduction",
      spatialDimension:               3,
      derivativeStrictlyPositive:     scaling.derivativeStrictlyPositive,
      finiteSizeMinimum:              false,
      topologicalStabilizerPresent:   false,
      validatesEarthTheory:           false,
      hopfLabelForbidden:             true,
      hopfSector:                     false,
      pi3OfS1:                        0,
      vacuumManifold:                 "S^1",
      topologicalGate:                "pi_3(S^1)=0",
      lambdaTilde0Cx:                 lambdaCx,
    },
    predictionLedger,
    output: {
      convention:             "psi_lambda(x)=psi(x/lambda), so lambda dilates every physical length by lambda",
      formula:                "E(lambda)=lambda*E_gradient+lambda^3*E_potential",
      gradientEnergy:         scaling.gradientEnergy,
      potentialEnergy:        scaling.potentialEnergy,
      derivativeAtOne:        scaling.derivativeAtOne,
      stationaryLambda:       null,
      finding:                "collapse-to-zero-size" as const,
      series:                 scaling.series,
      action:                 "E[ψ]=∫(½|∇ψ|²+(λ̃₀/4)(|ψ|²−1)²) d³x",
      lambdaTilde0,
      lambdaTilde0Literal:    LAMBDA_TILDE_LITERAL,
      lambdaTilde0Residual:   lambdaCx,
      vacuumManifold:         "S^1",
      homotopy:               { pi3OfS1: 0, hopfCharge: 0, hopfLabelForbidden: true },
      prediction:             "collapse-to-zero-size" as const,
      hopfLabelForbidden:     true,
      plainLanguage:          PLAIN,
      schemaVersion:          predictionLedger.schemaVersion,
      simulationId:           predictionLedger.simulationId,
      scientificStatus:       predictionLedger.scientificStatus,
      validatesEarthTheory:   false as const,
      predictions:            predictionLedger.predictions,
      residuals:              predictionLedger.residuals,
      findings:               predictionLedger.findings,
      blockers:               predictionLedger.blockers,
      referenceDatasetIds:    predictionLedger.referenceDatasetIds,
      hardGates:              { hopfSector: false, substitutionGrowth: 2, torus31: "unknot" as const },
      flags:                  ["topological-gate", "missing-operator", "arithmetic-cx"],
      missing: {
        thad:   { object: "scalar field action", source: "Thad/Physics Monastery", status: "missing" as const },
        nassim: { object: "this scalar field action", source: "Haramein holographic mass", status: "missing" as const },
      },
    },
  };
}

export type DerrickScalarGateOutput = ReturnType<typeof derrickScalarGate>["output"];
