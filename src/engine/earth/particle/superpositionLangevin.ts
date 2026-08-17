import { type EarthKernelResult, type EarthRunOptions } from "../common.js";
import { stochasticDiffusion, type StochasticDiffusionInputs } from "../fields.js";
import {
  buildEarthPredictionLedger,
  buildEarthPredictionRow,
  missingPredictionSlot,
} from "./ledger.js";

export const FLD_005_CLAIM_ID = "FLD-005-VAR";
export const PRINTED_LAMBDA_0 = 44.492;
export const PRINTED_NU = 99.482;
export const PRINTED_LAMBDA_TILDE_0 = 1984.4017075391882372;
export const LAMBDA_TILDE_0 = (4 * Math.PI) ** 3;
export const SUPERPOSITION_KT = 1;
export const SUPERPOSITION_XI = 1;

export type SuperpositionLangevinInputs = StochasticDiffusionInputs;

export function earthLangevinNu(lambda0 = PRINTED_LAMBDA_0): number {
  return lambda0 * Math.sqrt(5);
}

export function earthLangevinSlope(nu: number, mu: number, kT = SUPERPOSITION_KT, xi = SUPERPOSITION_XI): number {
  return 2 * nu * kT / (mu * xi ** 3);
}

export function superpositionLangevin(
  inputs: SuperpositionLangevinInputs = {},
  options: EarthRunOptions = {},
): EarthKernelResult<ReturnType<typeof stochasticDiffusion>["output"] & {
  claimId: typeof FLD_005_CLAIM_ID;
  lambda0: number;
  lambdaTilde0: number;
  nu: number;
  mu: number;
  printedNu: number;
  analyticSlope: number;
  printedSlope: number;
  kT: number;
  xi: number;
  lambda0EqualsLambdaTilde0: false;
  sourceEulerUnstable: true;
  continuumNoiseDefined: false;
  bornRuleDerived: false;
}> {
  const diffusion = stochasticDiffusion(inputs, options);
  const nu = earthLangevinNu();
  const mu = LAMBDA_TILDE_0;
  const analyticSlope = earthLangevinSlope(nu, mu);
  const printedSlope = earthLangevinSlope(PRINTED_NU, PRINTED_LAMBDA_TILDE_0);
  const row = buildEarthPredictionRow({
    claimId:        FLD_005_CLAIM_ID,
    programId:      "EARTH-FLD-005",
    kernelId:       "superpositionLangevin",
    observable:     "FDT variance",
    unit:           "1",
    sm: {
      value:       diffusion.output.expectedVariance,
      uncertainty: diffusion.output.varianceRelativeResidual,
      source:      "implicit backward-Euler periodic FDT",
      release:     "OpenSimPhy FLD-005 traditional-numerical-baseline-v1",
    },
    earth: {
      printed:   printedSlope,
      evaluated: analyticSlope,
      formula:   "⟨(Δθ)²⟩=2νkT t/(μ ξ³); ν=λ₀√5; μ=λ̃₀",
    },
    thad:   missingPredictionSlot("Physics Monastery Formula Atlas grain-boundary Langevin / FDT (ν,μ)"),
    nassim: missingPredictionSlot("Haramein (ν,μ) Langevin coefficients; vacuum-fluctuation prose is not this SPDE"),
    gate:   { metric: "relative", passIf: "relative≤1e-8" },
    auditStatus:    "blocked",
    g2aIndependent: true,
    datasetIds:     [],
    modelSummary:   "Pinned EARTH (ν,μ) next to the implicit FDT comparator. Source Euler is unstable.",
    plainLanguage:  "This is a damped random-walk FDT check, not a Born-rule derivation or a calibrated EARTH source model.",
    correlation:    "Diffusion and FDT exist as mathematics; the implicit kernel is testable as software.",
    discrepancy:    "λ₀=44.492 ≠ λ̃₀=(4π)³; continuum noise is undefined; Thad and Nassim have no (ν,μ).",
  });
  const predictionLedger = buildEarthPredictionLedger({
    simulationId: "EARTH-FLD-005",
    predictions:  [row],
    findings: [
      { claimId: FLD_005_CLAIM_ID, text: "λ₀=44.492 is not λ̃₀=(4π)³, so the printed viscosity and modulus are not one coupling." },
      { claimId: FLD_005_CLAIM_ID, text: "Source explicit Euler is unstable; the existing implicit diffusion kernel is kept." },
      { claimId: FLD_005_CLAIM_ID, text: "Continuum noise √(2νkT/μ) η has no map onto the discrete noiseScale." },
      { claimId: FLD_005_CLAIM_ID, text: "No Born-rule derivation is claimed or computed." },
    ],
    blockers: [
      "EARTH physical model BX because λ₀ ≠ λ̃₀ and continuum noise normalization are undefined.",
    ],
    referenceDatasetIds: [],
  });
  return {
    method: diffusion.method,
    diagnostics: {
      ...diffusion.diagnostics,
      earthLambdaConflict:     true,
      continuumNoiseDefined:   false,
      sourceEulerUnstable:     true,
      bornRuleDerived:         false,
      nu,
      mu,
      analyticSlope,
    },
    output: {
      ...diffusion.output,
      claimId:                   FLD_005_CLAIM_ID,
      lambda0:                   PRINTED_LAMBDA_0,
      lambdaTilde0:              mu,
      nu,
      mu,
      printedNu:                 PRINTED_NU,
      analyticSlope,
      printedSlope,
      kT:                        SUPERPOSITION_KT,
      xi:                        SUPERPOSITION_XI,
      lambda0EqualsLambdaTilde0: false,
      sourceEulerUnstable:       true,
      continuumNoiseDefined:     false,
      bornRuleDerived:           false,
    },
    predictionLedger,
  };
}
