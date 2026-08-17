import { checkCancelled, relativeError, type EarthKernelResult, type EarthRunOptions } from "../common.js";
import { sineGordonBenchmark, type SineGordonInputs } from "../fields.js";
import {
  buildEarthPredictionLedger,
  buildEarthPredictionRow,
  missingPredictionSlot,
} from "./ledger.js";

export const FERMION_SG_KINK_PROGRAM_ID = "EARTH-FLD-008" as const;
export const FERMION_SG_KINK_KERNEL_ID = "sineGordonBenchmark" as const;
export const XI0_FM = 0.15;
export const DOMAIN_WIDTHS = 10;
export const CLAIMED_FRACTIONAL_WINDING = 2 / 3;

export type FermionSgKinkInputs = SineGordonInputs;

const PLAIN_LANGUAGE = "toy SG kink at a width, not a fermion";

const MISSING_THAD = missingPredictionSlot(
  "Physics Monastery / 288 Formula Atlas has no tube-wall sine-Gordon kink or fermion spectrum",
);
const MISSING_NASSIM = missingPredictionSlot(
  "Haramein papers have no tube-wall sine-Gordon kink or fermion spectrum",
);

export function fermionSgKink(
  inputs: FermionSgKinkInputs = {},
  options: EarthRunOptions = {},
): EarthKernelResult<ReturnType<typeof sineGordonBenchmark>["output"] & {
  xi0Fm: number;
  width: number;
  winding: number;
  topologicalWinding: number;
  fractionalWinding: false;
  hopfLabelForbidden: true;
  fermionLabelForbidden: true;
  prt003Blocked: true;
  energyRelativeResidual: number;
  plainLanguage: string;
  flags: readonly string[];
  validatesEarthTheory: false;
}> {
  checkCancelled(options);
  const width = inputs.width ?? XI0_FM;
  const benchmark = sineGordonBenchmark({
    ...inputs,
    width,
    halfLength: inputs.halfLength ?? DOMAIN_WIDTHS * width,
  });
  const theta = benchmark.output.theta;
  const winding = (theta[theta.length - 1]! - theta[0]!) / (2 * Math.PI);
  const topologicalWinding = Math.round(winding);
  const energyRelativeResidual = relativeError(benchmark.output.numericalEnergy, benchmark.output.analyticEnergy);
  const rms = benchmark.output.rmsResidual;
  const rmsRow = buildEarthPredictionRow({
    claimId:        "FLD-008-SG",
    programId:      FERMION_SG_KINK_PROGRAM_ID,
    kernelId:       FERMION_SG_KINK_KERNEL_ID,
    observable:     "kink profile RMS vs analytic SG",
    unit:           "1",
    sm:             { value: 0, uncertainty: 0, source: "analytic SG θ=4 arctan(exp(x/ξ)), EOM residual 0", release: "classical-field-theory" },
    earth:          { printed: rms, evaluated: rms, formula: "SM analytic kink at width ξ₀; EARTH wall V=(1-cosθ)² is not this PDE (FLD-010)" },
    thad:           MISSING_THAD,
    nassim:         MISSING_NASSIM,
    gate:           { metric: "relative", passIf: "relative≤1e-2" },
    auditStatus:    "testable",
    g2aIndependent: true,
    datasetIds:     [],
    modelSummary:   "Analytic sine-Gordon kink sampled at EARTH width ξ₀.",
    plainLanguage:  PLAIN_LANGUAGE,
    correlation:    "the sampled field is the textbook SG kink",
    discrepancy:    "EARTH wall formula already falsified as SG on FLD-010; this residual is the SM comparator, not a fermion",
  });
  const energyRow = buildEarthPredictionRow({
    claimId:        "FLD-008-E",
    programId:      FERMION_SG_KINK_PROGRAM_ID,
    kernelId:       FERMION_SG_KINK_KERNEL_ID,
    observable:     "kink energy vs 8/width",
    unit:           "1",
    sm:             { value: benchmark.output.analyticEnergy, uncertainty: 0, source: "sine-Gordon kink energy 8/width", release: "classical-field-theory" },
    earth:          { printed: benchmark.output.numericalEnergy, evaluated: benchmark.output.numericalEnergy, formula: "trapezoid of ½(θ')²+(1-cosθ)/width² on the analytic kink" },
    thad:           MISSING_THAD,
    nassim:         MISSING_NASSIM,
    gate:           { metric: "relative", passIf: "relative≤1e-8" },
    auditStatus:    "testable",
    g2aIndependent: true,
    datasetIds:     [],
    modelSummary:   "SG kink energy 8/width at the sampled width.",
    plainLanguage:  PLAIN_LANGUAGE,
    correlation:    "numerical energy tracks 8/width for the analytic kink",
    discrepancy:    "energy match is a software check of the SM comparator, not an EARTH fermion mass",
  });
  const windingRow = buildEarthPredictionRow({
    claimId:        "FLD-008-W",
    programId:      FERMION_SG_KINK_PROGRAM_ID,
    kernelId:       FERMION_SG_KINK_KERNEL_ID,
    observable:     "kink winding ∫dθ/2π",
    unit:           "1",
    sm:             { value: 1, uncertainty: 0, source: "SG kink Δθ=2π so ∫dθ/2π=1", release: "classical-field-theory" },
    earth:          { printed: CLAIMED_FRACTIONAL_WINDING, evaluated: topologicalWinding, formula: "EARTH fermion Q from wall kink winding; printed w=±2/3" },
    thad:           MISSING_THAD,
    nassim:         MISSING_NASSIM,
    gate:           { metric: "exact", passIf: "exact" },
    auditStatus:    "blocked",
    g2aIndependent: true,
    datasetIds:     [],
    modelSummary:   "Integer SG winding is not a fractional fermion charge.",
    plainLanguage:  PLAIN_LANGUAGE,
    discrepancy:    "topological-gate: ∫dθ/2π=1; no w=±2/3; PRT-003 spectrum still blocked; Hopf/fermion labels forbidden",
  });
  const ledger = buildEarthPredictionLedger({
    simulationId:        FERMION_SG_KINK_PROGRAM_ID,
    scientificStatus:    "comparison",
    predictions:         [rmsRow, energyRow, windingRow],
    findings:            [
      { claimId: "FLD-008-SG", text: "RMS residual vs analytic SG is a software check at width ξ₀; EARTH wall is not SG (FLD-010)" },
      { claimId: "FLD-008-E",  text: "numerical energy tracks 8/width for the analytic kink" },
      { claimId: "FLD-008-W",  text: "topological-gate: integer winding ≠ ±2/3; PRT-003 spectrum still blocked; Hopf/fermion labels forbidden" },
    ],
    blockers:            [
      "PRT-003 fermion kink spectrum with fractional winding remains blocked",
      "Thad: no tube-wall sine-Gordon kink or fermion spectrum",
      "Nassim: no tube-wall sine-Gordon kink or fermion spectrum",
    ],
    referenceDatasetIds: [],
  });
  return {
    method: benchmark.method,
    diagnostics: {
      ...benchmark.diagnostics,
      xi0Fm:                 XI0_FM,
      width,
      topologicalWinding,
      fractionalWinding:     false,
      hopfLabelForbidden:    true,
      fermionLabelForbidden: true,
      prt003Blocked:         true,
      topologicalGate:       "integer winding ≠ ±2/3",
      validatesEarthTheory:  false,
      plainLanguage:         PLAIN_LANGUAGE,
    },
    output: {
      ...benchmark.output,
      xi0Fm:                  XI0_FM,
      width,
      winding,
      topologicalWinding,
      fractionalWinding:      false,
      hopfLabelForbidden:     true,
      fermionLabelForbidden:  true,
      prt003Blocked:          true,
      energyRelativeResidual,
      plainLanguage:          PLAIN_LANGUAGE,
      flags:                  ["topological-gate"],
      validatesEarthTheory:   false,
    },
    predictions:      ledger.predictions,
    predictionLedger: ledger,
  };
}
