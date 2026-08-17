import { boundedInteger, checkCancelled, positiveNumber, relativeError, type EarthKernelResult, type EarthRunOptions } from "../common.js";
import { GOLDEN_RATIO } from "../foundations.js";
import { ELEMENTARY_CHARGE_C, PLANCK_CONSTANT_J_S, SPEED_OF_LIGHT_M_PER_S } from "../../../simphy/constants.js";
import {
  buildEarthPredictionLedger,
  buildEarthPredictionRow,
  identityPredictionSlot,
  missingPredictionSlot,
  type EarthPredictionRowInput,
} from "./ledger.js";

export const CHEM6_CHIRAL_LINES_PROGRAM_ID = "EARTH-PRT-001" as const;
export const CHEM6_CHIRAL_LINES_METHOD_ID = "chem6-chiral-lines-v1" as const;
export const CHEM6_CHIRAL_LINES_KERNEL_ID = "chem6-chiral-lines" as const;
export const CHEM6_CHIRAL_LINES_CLAIM_IDS = ["SP-01", "SP-02", "SP-03", "SP-04", "SP-05"] as const;

export type Chem6ClaimUnit = "cm^-1" | "nm" | "eV";

export interface Chem6ChiralLineInput {
  claimId: (typeof CHEM6_CHIRAL_LINES_CLAIM_IDS)[number];
  label: string;
  distanceAngstrom: number;
  harmonic: number;
  printed: number;
  unit: Chem6ClaimUnit;
}

export interface Chem6ChiralLinesInputs {
  deltaChi?: number;
  speedOfLight?: number;
  planckConstant?: number;
  elementaryCharge?: number;
  modes?: Chem6ChiralLineInput[];
}

const C = SPEED_OF_LIGHT_M_PER_S;
const H = PLANCK_CONSTANT_J_S;
const E = ELEMENTARY_CHARGE_C;
const PRINTED_DELTA_CHI = 0.15;
const ALGEBRAIC_DELTA_CHI = 1 / Math.sqrt(3 * GOLDEN_RATIO ** 2);
const GATE = { metric: "relative", passIf: "<=1e-8" } as const;
const PLAIN = "printed CHEM-6 lines do not come out of the printed ν_m formula";
const MODEL = "CHEM-6 λ_m=2d_n/m and ν_m=m·3c·δχ²/(2π d_n). Printed IR/UV/X-ray examples are not repaired.";
const FORMULA = "λ_m=2d_n/m; ν_m=m·3c·δχ²/(2π d_n)";
const SM_SOURCE = "HITRAN/NIST named-line identity (0 acquired bytes; not G4)";
const MISSING_THAD = missingPredictionSlot("Physics Monastery IR/NMR/X-ray line law (none; Δν_Cs is not this slot)");

export const DEFAULT_CHEM6_CHIRAL_LINES_INPUTS: Chem6ChiralLinesInputs = {
  deltaChi:          PRINTED_DELTA_CHI,
  speedOfLight:      C,
  planckConstant:    H,
  elementaryCharge:  E,
  modes: [
    { claimId: "SP-01", label: "C-H stretch",         distanceAngstrom: 1.09,  harmonic: 1, printed: 3030,   unit: "cm^-1" },
    { claimId: "SP-02", label: "C=C stretch",         distanceAngstrom: 1.34,  harmonic: 1, printed: 1650,   unit: "cm^-1" },
    { claimId: "SP-03", label: "C triple C stretch",  distanceAngstrom: 1.203, harmonic: 1, printed: 2140,   unit: "cm^-1" },
    { claimId: "SP-04", label: "carbonyl UV-vis",     distanceAngstrom: 1.23,  harmonic: 1, printed: 287,    unit: "nm" },
    { claimId: "SP-05", label: "Cu K-alpha",          distanceAngstrom: 1.54,  harmonic: 1, printed: 8047.8, unit: "eV" },
  ],
};

function frequencyToUnit(frequencyHz: number, unit: Chem6ClaimUnit, c: number, h: number, e: number): number {
  if (unit === "cm^-1") return frequencyHz / (c * 100);
  if (unit === "nm") return c / frequencyHz * 1e9;
  return h * frequencyHz / e;
}

function identityFromLambda(lambdaM: number, unit: Chem6ClaimUnit, c: number, h: number, e: number): number {
  if (unit === "cm^-1") return 1 / (lambdaM * 100);
  if (unit === "nm") return lambdaM * 1e9;
  return h * c / (lambdaM * e);
}

function row(input: Omit<EarthPredictionRowInput, "programId" | "kernelId" | "gate" | "g2aIndependent" | "datasetIds" | "modelSummary" | "plainLanguage">): ReturnType<typeof buildEarthPredictionRow> {
  return buildEarthPredictionRow({
    ...input,
    programId:       CHEM6_CHIRAL_LINES_PROGRAM_ID,
    kernelId:        CHEM6_CHIRAL_LINES_KERNEL_ID,
    gate:            GATE,
    g2aIndependent:  true,
    datasetIds:      [],
    modelSummary:    MODEL,
    plainLanguage:   PLAIN,
  });
}

export function chem6ChiralLines(
  inputs: Chem6ChiralLinesInputs = DEFAULT_CHEM6_CHIRAL_LINES_INPUTS,
  options: EarthRunOptions = {},
): EarthKernelResult<{
  deltaChiPrinted: number;
  deltaChiAlgebraic: number;
  modes: Array<Chem6ChiralLineInput & {
    distanceM: number;
    standingWavelengthM: number;
    frequencyHz: number;
    evaluated: number;
    nassimIdentity: number;
    printedRelativeResidual: number;
  }>;
}> {
  checkCancelled(options);
  const modes = inputs.modes ?? DEFAULT_CHEM6_CHIRAL_LINES_INPUTS.modes!;
  if (modes.length < 1 || modes.length > 512) throw new RangeError("modes must contain 1 to 512 entries");
  const deltaChi         = positiveNumber(inputs.deltaChi ?? PRINTED_DELTA_CHI, "deltaChi");
  const speedOfLight     = positiveNumber(inputs.speedOfLight ?? C, "speedOfLight");
  const planckConstant   = positiveNumber(inputs.planckConstant ?? H, "planckConstant");
  const elementaryCharge = positiveNumber(inputs.elementaryCharge ?? E, "elementaryCharge");
  const computed = modes.map((mode) => {
    const harmonic = boundedInteger(mode.harmonic, `${mode.label} harmonic`, 1, 10_000);
    const distanceM = positiveNumber(mode.distanceAngstrom, `${mode.label} distanceAngstrom`) * 1e-10;
    const standingWavelengthM = 2 * distanceM / harmonic;
    const frequencyHz = harmonic * 3 * speedOfLight * deltaChi ** 2 / (2 * Math.PI * distanceM);
    const evaluated = frequencyToUnit(frequencyHz, mode.unit, speedOfLight, planckConstant, elementaryCharge);
    const nassimIdentity = identityFromLambda(standingWavelengthM, mode.unit, speedOfLight, planckConstant, elementaryCharge);
    return {
      ...mode,
      harmonic,
      distanceM,
      standingWavelengthM,
      frequencyHz,
      evaluated,
      nassimIdentity,
      printedRelativeResidual: relativeError(evaluated, mode.printed),
    };
  });
  const predictions = computed.map((mode) => row({
    claimId:     mode.claimId,
    observable:  mode.label,
    unit:        mode.unit,
    sm:          { value: mode.printed, uncertainty: null, source: SM_SOURCE, release: "comparator; no locked dataset" },
    earth:       { printed: mode.printed, evaluated: mode.evaluated, formula: FORMULA },
    thad:        MISSING_THAD,
    nassim:      identityPredictionSlot(mode.nassimIdentity, "E=hc/λ identity only"),
    auditStatus: "falsified",
    discrepancy: "arithmetic-cx / unit-inconsistent",
  }));
  const ledger = buildEarthPredictionLedger({
    simulationId:        CHEM6_CHIRAL_LINES_KERNEL_ID,
    scientificStatus:    "audit",
    referenceDatasetIds: [],
    predictions,
    findings: computed.map((mode) => ({
      claimId: mode.claimId,
      text:    `${mode.label}: printed ${mode.printed} ${mode.unit} vs ν_m → ${mode.evaluated} ${mode.unit}`,
    })),
    blockers: [
      "Thad: no IR/NMR/X-ray law; Δν_Cs is not this slot",
      "Nassim: E=hc/λ identity only",
      "SM: HITRAN/NIST line identities as comparators; 0 acquired bytes; not G4",
      "NMR ppm from δχ is not a shielding model",
    ],
  });
  return {
    method: "Literal CHEM-6 λ_m=2d_n/m and ν_m=m·3c·δχ²/(2π d_n) with SI conversion to printed cm⁻¹ / nm / eV",
    diagnostics: {
      validatesEarthTheory: false,
      deltaChiPrinted:      deltaChi,
      deltaChiAlgebraic:    ALGEBRAIC_DELTA_CHI,
      acquiredHitranBytes:  0,
      g4Claimed:            false,
      plainLanguage:        PLAIN,
    },
    output: {
      deltaChiPrinted:   deltaChi,
      deltaChiAlgebraic: ALGEBRAIC_DELTA_CHI,
      modes:             computed,
    },
    predictions:      ledger.predictions,
    predictionLedger: ledger,
  };
}
