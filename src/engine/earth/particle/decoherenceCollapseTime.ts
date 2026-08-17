import { type EarthKernelResult, type EarthRunOptions } from "../common.js";
import {
  DEFAULT_DECOHERENCE_SCALING_INPUTS,
  decoherenceScalingSweep,
  type DecoherenceScalingInputs,
} from "../extendedNumerics.js";
import { GOLDEN_RATIO } from "../foundations.js";
import {
  buildEarthPredictionLedger,
  buildEarthPredictionRow,
  missingPredictionSlot,
} from "./ledger.js";
import {
  earthLangevinNu,
  earthLangevinSlope,
  LAMBDA_TILDE_0,
  PRINTED_LAMBDA_0,
  SUPERPOSITION_KT,
  SUPERPOSITION_XI,
} from "./superpositionLangevin.js";

export const FLD_006_CLAIM_ID = "FLD-006-TC";
export const DELTA_CHI_PRINTED = 0.15;
export const DELTA_CHI_ALGEBRAIC = 1 / Math.sqrt(3 * GOLDEN_RATIO ** 2);
export const CLAIMED_DENSITY_EXPONENT = -1 / 3;
export const CLAIMED_TEMPERATURE_EXPONENT = -1;
export const COLLAPSE_TIME_PLAIN_LANGUAGE =
  "collapse-time scaling with two conflicting δχ values; not SM decoherence";

export type DecoherenceCollapseTimeInputs = DecoherenceScalingInputs;

export function earthCoherenceLength(density: number, referenceDensity: number, xiRef = SUPERPOSITION_XI): number {
  return xiRef * (referenceDensity / density) ** (1 / 3);
}

export function earthCollapseTime(deltaChi: number, mu: number, xi: number, kT: number, nu: number): number {
  return deltaChi ** 2 / earthLangevinSlope(nu, mu, kT, xi);
}

function unique(values: number[]): number[] {
  return [...new Set(values)];
}

function logLogExponent(xs: number[], ys: number[]): number {
  const n = xs.length;
  const lx = xs.map(Math.log);
  const ly = ys.map(Math.log);
  const meanX = lx.reduce((sum, value) => sum + value, 0) / n;
  const meanY = ly.reduce((sum, value) => sum + value, 0) / n;
  let covariance = 0;
  let variance = 0;
  for (let index = 0; index < n; index += 1) {
    covariance += (lx[index]! - meanX) * (ly[index]! - meanY);
    variance += (lx[index]! - meanX) ** 2;
  }
  return covariance / variance;
}

export function decoherenceCollapseTime(
  inputs: DecoherenceCollapseTimeInputs = {},
  options: EarthRunOptions = {},
): EarthKernelResult<ReturnType<typeof decoherenceScalingSweep>["output"] & {
  claimId: typeof FLD_006_CLAIM_ID;
  lambda0: number;
  lambdaTilde0: number;
  nu: number;
  mu: number;
  kT: number;
  xiRef: number;
  deltaChiPrinted: number;
  deltaChiAlgebraic: number;
  collapseTimePrinted: number;
  collapseTimeAlgebraic: number;
  claimedDensityExponent: number;
  fittedDensityExponent: number;
  claimedTemperatureExponent: number;
  fittedTemperatureExponent: number;
  lambda0EqualsLambdaTilde0: false;
  muNuIndependent: false;
  validatesEarthTheory: false;
  points: Array<ReturnType<typeof decoherenceScalingSweep>["output"]["points"][number] & {
    xi: number;
    collapseTimePrinted: number;
    collapseTimeAlgebraic: number;
  }>;
}> {
  const sweep = decoherenceScalingSweep(inputs, options);
  const nu = earthLangevinNu();
  const mu = LAMBDA_TILDE_0;
  const referenceDensity = inputs.referenceDensity ?? DEFAULT_DECOHERENCE_SCALING_INPUTS.referenceDensity;
  const referenceTemperature = inputs.referenceTemperature ?? DEFAULT_DECOHERENCE_SCALING_INPUTS.referenceTemperature;
  const densities = unique(sweep.output.points.map(({ density }) => density));
  const temperatures = unique(sweep.output.points.map(({ temperature }) => temperature));
  const kTAt = (temperature: number) => SUPERPOSITION_KT * temperature / referenceTemperature;
  const collapseAt = (deltaChi: number, density: number, temperature: number) => earthCollapseTime(
    deltaChi, mu, earthCoherenceLength(density, referenceDensity), kTAt(temperature), nu,
  );
  const densityTimes = densities.map((density) => collapseAt(DELTA_CHI_ALGEBRAIC, density, referenceTemperature));
  const temperatureTimes = temperatures.map((temperature) => collapseAt(DELTA_CHI_ALGEBRAIC, referenceDensity, temperature));
  const fittedDensityExponent = logLogExponent(densities, densityTimes);
  const fittedTemperatureExponent = logLogExponent(temperatures, temperatureTimes);
  const collapseTimePrinted = collapseAt(DELTA_CHI_PRINTED, referenceDensity, referenceTemperature);
  const collapseTimeAlgebraic = collapseAt(DELTA_CHI_ALGEBRAIC, referenceDensity, referenceTemperature);
  const points = sweep.output.points.map((point) => {
    const xi = earthCoherenceLength(point.density, referenceDensity);
    return {
      ...point,
      xi,
      collapseTimePrinted:    earthCollapseTime(DELTA_CHI_PRINTED, mu, xi, kTAt(point.temperature), nu),
      collapseTimeAlgebraic:  earthCollapseTime(DELTA_CHI_ALGEBRAIC, mu, xi, kTAt(point.temperature), nu),
    };
  });
  const row = buildEarthPredictionRow({
    claimId:        FLD_006_CLAIM_ID,
    programId:      "EARTH-FLD-006",
    kernelId:       "decoherenceCollapseTime",
    observable:     "t_c scaling",
    unit:           "1",
    sm: {
      value:       null,
      uncertainty: null,
      source:      "environment decoherence scales with T, not this δχ law",
      release:     "Caldeira–Leggett textbook",
    },
    earth: {
      printed:   CLAIMED_DENSITY_EXPONENT,
      evaluated: fittedDensityExponent,
      formula:   "t_c=δχ² μ ξ(ρ)³/(2 kT ν); ξ∝ρ^{-1/3}; ν=λ₀√5; μ=λ̃₀",
    },
    thad:   missingPredictionSlot("Physics Monastery Formula Atlas grain-boundary collapse time t_c"),
    nassim: missingPredictionSlot("Haramein τ_p=r_p/c is a different object, not this t_c"),
    gate:   { metric: "relative", passIf: "relative≤1e-6" },
    auditStatus:    "blocked",
    g2aIndependent: true,
    datasetIds:     [],
    modelSummary:   "Pinned FLD-005 (ν,μ) collapse-time sweep. μ and ν are not independent.",
    plainLanguage:  COLLAPSE_TIME_PLAIN_LANGUAGE,
    correlation:    "Printed t_c carries a 1/T factor; SM environment decoherence also scales with T.",
    discrepancy:    "Pinned μ gives t_c∝ρ^{-1} not ρ^{-1/3}; δχ=0.15 ≠ 1/√(3φ²); λ₀≠λ̃₀ so μ,ν are blocked.",
  });
  const predictionLedger = buildEarthPredictionLedger({
    simulationId: "EARTH-FLD-006",
    predictions:  [row],
    findings: [
      { claimId: FLD_006_CLAIM_ID, text: "λ₀=44.492 ≠ λ̃₀=(4π)³, so viscosity ν=λ₀√5 and modulus μ=λ̃₀ are not independent." },
      { claimId: FLD_006_CLAIM_ID, text: "Printed t_c∝ρ^{-1/3}/T; with pinned μ and ξ∝ρ^{-1/3} the formula gives ρ^{-1}/T." },
      { claimId: FLD_006_CLAIM_ID, text: "δχ printed 0.15 and algebraic 1/√(3φ²)≈0.3568 both emitted; they are not the same t_c." },
      { claimId: FLD_006_CLAIM_ID, text: "Haramein τ_p=r_p/c is a different object and is not identified with t_c." },
    ],
    blockers: [
      "EARTH physical model blocked until μ and ν are independent; they are not because λ₀ ≠ λ̃₀.",
    ],
    referenceDatasetIds: [],
  });
  return {
    method: sweep.method,
    diagnostics: {
      ...sweep.diagnostics,
      lambda0EqualsLambdaTilde0: false,
      muNuIndependent:           false,
      validatesEarthTheory:      false,
      nu,
      mu,
      fittedDensityExponent,
      fittedTemperatureExponent,
    },
    output: {
      ...sweep.output,
      claimId:                     FLD_006_CLAIM_ID,
      lambda0:                     PRINTED_LAMBDA_0,
      lambdaTilde0:                mu,
      nu,
      mu,
      kT:                          SUPERPOSITION_KT,
      xiRef:                       SUPERPOSITION_XI,
      deltaChiPrinted:             DELTA_CHI_PRINTED,
      deltaChiAlgebraic:           DELTA_CHI_ALGEBRAIC,
      collapseTimePrinted,
      collapseTimeAlgebraic,
      claimedDensityExponent:      CLAIMED_DENSITY_EXPONENT,
      fittedDensityExponent,
      claimedTemperatureExponent:  CLAIMED_TEMPERATURE_EXPONENT,
      fittedTemperatureExponent,
      lambda0EqualsLambdaTilde0:   false,
      muNuIndependent:             false,
      validatesEarthTheory:        false,
      points,
    },
    predictions:      predictionLedger.predictions,
    predictionLedger,
  };
}
