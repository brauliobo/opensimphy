import { checkCancelled, type EarthKernelResult, type EarthRunOptions } from "../common.js";
import { potentialDerivativeAudit, type PotentialDerivativeInputs } from "../fields.js";
import {
  buildEarthPredictionLedger,
  buildEarthPredictionRow,
  missingPredictionSlot,
} from "./ledger.js";

export const WALL_VS_SINE_GORDON_PROGRAM_ID = "EARTH-FLD-010" as const;
export const WALL_VS_SINE_GORDON_KERNEL_ID = "wall-vs-sine-gordon" as const;

export type WallVsSineGordonInputs = PotentialDerivativeInputs;

const PLAIN_LANGUAGE =
  "The printed wall energy is (1-cos θ)², claimed as sine-Gordon. Sine-Gordon is V=1-cos θ with force sin θ. The wall force 2(1-cos θ)sin θ is not sin θ, so the fermion-wall formula is not sine-Gordon.";

const MISSING_THAD = missingPredictionSlot(
  "Physics Monastery / 288 Formula Atlas has no tube-wall potential or sine-Gordon fermion operator",
);
const MISSING_NASSIM = missingPredictionSlot(
  "Haramein papers have no tube-wall potential or sine-Gordon fermion operator",
);

export function wallVsSineGordon(
  inputs: WallVsSineGordonInputs = {},
  options: EarthRunOptions = {},
): EarthKernelResult<ReturnType<typeof potentialDerivativeAudit>["output"]> {
  checkCancelled(options);
  const audit = potentialDerivativeAudit(inputs);
  const maxSg = audit.output.maximumSineGordonDifference;
  const maxFd = audit.output.maximumFiniteDifferenceResidual;
  const sgRow = buildEarthPredictionRow({
    claimId:        "FLD-010-SG",
    programId:      WALL_VS_SINE_GORDON_PROGRAM_ID,
    kernelId:       WALL_VS_SINE_GORDON_KERNEL_ID,
    observable:     "max |2(1-cos θ)sin θ - sin θ|",
    unit:           "1",
    sm:             { value: 0, uncertainty: 0, source: "sine-Gordon V=1-cos θ, V'=sin θ", release: "classical-field-theory" },
    earth:          { printed: 0, evaluated: maxSg, formula: "V=(1-cos θ)² claimed as sine-Gordon; V'=2(1-cos θ)sin θ" },
    thad:           MISSING_THAD,
    nassim:         MISSING_NASSIM,
    gate:           { metric: "relative", passIf: "relative≤1e-8" },
    auditStatus:    "falsified",
    g2aIndependent: true,
    datasetIds:     [],
    modelSummary:   "Printed wall potential is not sine-Gordon.",
    plainLanguage:  PLAIN_LANGUAGE,
    correlation:    "both are 2π-periodic scalar potentials of a phase θ",
    discrepancy:    "2(1-cos θ)sin θ ≠ sin θ",
  });
  const fdRow = buildEarthPredictionRow({
    claimId:        "FLD-010-FD",
    programId:      WALL_VS_SINE_GORDON_PROGRAM_ID,
    kernelId:       WALL_VS_SINE_GORDON_KERNEL_ID,
    observable:     "max |V'_analytic - V'_FD|",
    unit:           "1",
    sm:             { value: 0, uncertainty: 0, source: "centered finite difference of V=(1-cos θ)²", release: "software-comparator" },
    earth:          { printed: maxFd, evaluated: maxFd, formula: "V'=2(1-cos θ)sin θ checked by centered differences" },
    thad:           MISSING_THAD,
    nassim:         MISSING_NASSIM,
    gate:           { metric: "relative", passIf: "relative≤1e-8" },
    auditStatus:    "testable",
    g2aIndependent: true,
    datasetIds:     [],
    modelSummary:   "The wall force is the derivative of (1-cos θ)².",
    plainLanguage:  "The computer derivative of the printed wall energy matches 2(1-cos θ)sin θ. That only checks the algebra, not sine-Gordon.",
  });
  const ledger = buildEarthPredictionLedger({
    simulationId:        WALL_VS_SINE_GORDON_KERNEL_ID,
    scientificStatus:    "audit",
    predictions:         [sgRow, fdRow],
    findings:            [
      { claimId: "FLD-010-SG", text: "source-conflict: 2(1-cos θ)sin θ ≠ sin θ; formula falsified as sine-Gordon" },
      { claimId: "FLD-010-FD", text: "finite-difference residual of the wall force is small; software check only" },
    ],
    blockers:            [
      "Thad: no tube-wall potential or sine-Gordon fermion operator",
      "Nassim: no tube-wall potential or sine-Gordon fermion operator",
    ],
    referenceDatasetIds: [],
  });
  return {
    method: audit.method,
    diagnostics: {
      ...audit.diagnostics,
      equivalentToSineGordon: false,
      plainLanguage:          PLAIN_LANGUAGE,
    },
    output:           audit.output,
    predictions:      ledger.predictions,
    predictionLedger: ledger,
  };
}
