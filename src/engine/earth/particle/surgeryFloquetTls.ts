import { relativeError, type EarthKernelResult, type EarthRunOptions } from "../common.js";
import { floquetBenchmark, type FloquetInputs } from "../fields.js";
import {
  buildEarthPredictionLedger,
  buildEarthPredictionRow,
  missingPredictionSlot,
  type EarthPredictionLedger,
} from "./ledger.js";

export type SurgeryFloquetTlsInputs = FloquetInputs;

const PROGRAM_ID = "EARTH-FLD-007";
const KERNEL_ID = "floquetBenchmark";
const CLAIM_ID = "FLD-007-FLOQ";
const CLAIMED_LATTICE = 201;
const ANALOGUE_LEVELS = 2;
const SCALED_BARRIER = 100;
const PRINTED_B = 628.318_530_717_958_647_692_3;
const PRINTED_HZ = 7.83;
const PLAIN_LANGUAGE = "toy two-level analogue, not Hopfion surgery";

export function surgeryFloquetTls(
  inputs: SurgeryFloquetTlsInputs = {},
  options: EarthRunOptions = {},
): EarthKernelResult<{
  model: string;
  period: number;
  operator: ReturnType<typeof floquetBenchmark>["output"]["operator"];
  quasienergies: [number, number];
  transitionProbability: number;
  unitarityResidual: number;
  refinementResidual: number;
  undrivenQuasienergy: number | null;
  analogueHilbertDimension: number;
  claimedLatticePoints: number;
  analogueOnly: true;
  surgeryBarrierProof: false;
  printedBarrierActionB: number;
  evaluatedBarrierActionB: number;
  barrierActionRelativeResidual: number;
  printedDriveHz: number;
  floquetDriveFrequency: number;
  driveIsSchumannHz: false;
  plainLanguage: string;
}> & { predictionLedger: EarthPredictionLedger } {
  const benchmark = floquetBenchmark(inputs, options);
  const evaluatedB = 2 * Math.PI * SCALED_BARRIER;
  const driveFrequency = inputs.frequency ?? 1.2;
  const row = buildEarthPredictionRow({
    claimId:         CLAIM_ID,
    programId:       PROGRAM_ID,
    kernelId:        KERNEL_ID,
    observable:      "Floquet Hilbert dimension",
    unit:            "1",
    sm: {
      value:        ANALOGUE_LEVELS,
      uncertainty:  0,
      source:       "Shirley 1965 two-level Floquet; OpenSimPhy floquetBenchmark",
      release:      "Phys. Rev. 138 B979",
    },
    earth: {
      printed:    CLAIMED_LATTICE,
      evaluated:  ANALOGUE_LEVELS,
      formula:    "V=-½ω_b²x²+F x cos(ω_d t) on N=201; analogue is 2-level Shirley",
    },
    thad:            missingPredictionSlot("Physics Monastery / 288 Formula Atlas has no Floquet surgery-barrier operator"),
    nassim:          missingPredictionSlot("Haramein papers have no Floquet surgery-barrier operator"),
    gate:            { metric: "exact", passIf: "exact" },
    auditStatus:     "blocked",
    g2aIndependent:  true,
    datasetIds:      [],
    modelSummary:    "Two-level Shirley Floquet analogue of the printed N=201 surgery barrier.",
    plainLanguage:   PLAIN_LANGUAGE,
    correlation:     "unitarity of the Shirley product is a software test, not EARTH validation",
    discrepancy:     "2-level ≠ N=201; B≈628 and f=7.83 Hz are arithmetic-cx; no surgery-barrier proof",
  });
  const predictionLedger = buildEarthPredictionLedger({
    simulationId:        PROGRAM_ID,
    scientificStatus:    "blocked",
    predictions:         [row],
    findings: [
      { claimId: CLAIM_ID, text: "EARTH surgery barrier is analogue only: 2-level Shirley ≠ N=201 spatial Floquet." },
      { claimId: CLAIM_ID, text: `B printed ${PRINTED_B} equals 2π×100 after scaling E_barrier to 100 v9.3 units (arithmetic-cx), not a surgery energy in J.` },
      { claimId: CLAIM_ID, text: `printed Schumann f=${PRINTED_HZ} Hz is not the Shirley drive; ω is dimensionless and unmapped to particle measurement.` },
      { claimId: CLAIM_ID, text: "Unitarity residual of the two-level product is a software comparator; no Hopfion surgery-barrier proof." },
    ],
    blockers: [
      "N=201 driven inverted-parabola Floquet is not implemented; kernel is 2-level only",
      "no Hopfion surgery-barrier operator",
      "Thad/Nassim missing-operator",
    ],
    referenceDatasetIds: [],
  });
  return {
    method: benchmark.method,
    diagnostics: {
      ...benchmark.diagnostics,
      analogueOnly:              true,
      claimedLatticePoints:      CLAIMED_LATTICE,
      analogueHilbertDimension:  ANALOGUE_LEVELS,
      surgeryBarrierProof:       false,
      arithmeticCx:              true,
      validatesEarthTheory:      false,
    },
    output: {
      ...benchmark.output,
      analogueHilbertDimension:       ANALOGUE_LEVELS,
      claimedLatticePoints:           CLAIMED_LATTICE,
      analogueOnly:                   true,
      surgeryBarrierProof:            false,
      printedBarrierActionB:          PRINTED_B,
      evaluatedBarrierActionB:        evaluatedB,
      barrierActionRelativeResidual:  relativeError(evaluatedB, PRINTED_B),
      printedDriveHz:                 PRINTED_HZ,
      floquetDriveFrequency:          driveFrequency,
      driveIsSchumannHz:              false,
      plainLanguage:                  PLAIN_LANGUAGE,
    },
    predictions:      predictionLedger.predictions,
    predictionLedger,
  };
}
