import { CODATA_ALPHA } from "../foundations.js";
import {
  buildEarthPredictionLedger,
  buildEarthPredictionRow,
  identityPredictionSlot,
  missingPredictionSlot,
  reproPredictionSlot,
  type EarthPredictionLedger,
  type EarthPredictionRow,
  type EarthPredictionRowInput,
} from "./ledger.js";

export const ELECTRON_BOHR_RYDBERG_PROGRAM_ID = "EARTH-PRT-001" as const;
export const ELECTRON_BOHR_RYDBERG_KERNEL_ID = "electron-bohr-rydberg" as const;
export const ELECTRON_BOHR_RYDBERG_CLAIM_IDS = [
  "PRT-001-PHI18", "PRT-001-ALPHA", "PRT-001-A0", "PRT-001-ME", "PRT-001-RYD",
] as const;

const DATASET = "earth-dataset-codata-recommended-values";
const GATE = { metric: "relative", passIf: "<=1e-8" } as const;
const PLAIN =
  "EARTH's electron formulas are arithmetic you can check. They do not recover the Bohr radius or α.";
const MODEL =
  "CHEM-2 φ¹⁸ / α / a₀ / m_e / R_∞ ledger. Printed CODATA-looking outputs are not repaired.";

const C = 299_792_458;
const H = 6.626_070_15e-34;
const E = 1.602_176_634e-19;
const HBAR = H / (2 * Math.PI);
const CODATA_A0 = 5.29177210544e-11;
const CODATA_ME = 9.109_383_713_9e-31;
const CODATA_RYD = 10_973_731.568_157;
const CODATA_RE = 2.817_940_320_5e-15;
const CODATA_GE = -2.002_319_304_360_92;
const THAD_ALPHA = 7.297_352_572_955e-3;
const THAD_A0 = 5.291_772_105_21e-11;
const THAD_ME = 9.109_383_710_14e-31;
const THAD_RYD = 1.097_373_156_811_00e7;
const THAD_E = 1.602_176_574_06e-19;
const THAD_RE = 2.817_940_326_99e-15;
const THAD_GE = -2.002_319_304_360_65;

const MISSING_THAD_PHI18 = missingPredictionSlot("Physics Monastery φ¹⁸ constructor (none; ROBERTS-001 is l_P m_P=ħ/c)");
const MISSING_NASSIM_PHI18 = missingPredictionSlot("Haramein φ¹⁸ constructor (none)");
const MISSING_NASSIM_ALPHA = missingPredictionSlot("Haramein α derivation (α is an input to m_e=ħ/(c α a_0))");
const MISSING_NASSIM_A0 = missingPredictionSlot("Haramein a_0 derivation (a_0 is an input to m_e=ħ/(c α a_0))");
const MISSING_NASSIM_RYD = missingPredictionSlot("Haramein R_∞ derivation (none)");
const MISSING_NASSIM_E = missingPredictionSlot("Haramein elementary-charge constructor (none)");
const MISSING_NASSIM_RE = missingPredictionSlot("Haramein Thomson r_e constructor (none)");
const MISSING_NASSIM_GE = missingPredictionSlot("Haramein electron g-factor constructor (none)");

export interface ElectronBohrRydbergAuditSlice {
  dependencies: { claimedPhi18: number; actualPhi18: number; claimedAlphaInverse: number; computedAlphaInverse: number };
  bohr: { sourcePrintedResult: number; effectiveActualDependencies: number };
  electron: { sourcePrintedResult: number; actualDependencies: number };
  rydberg: { sourcePrintedResult: number; fromActualElectronFormula: number };
}

function mevToKg(energyMeV: number): number {
  return energyMeV * 1e6 * E / C ** 2;
}

function row(input: Omit<EarthPredictionRowInput, "programId" | "kernelId" | "gate" | "g2aIndependent" | "datasetIds" | "modelSummary" | "plainLanguage"> & {
  modelSummary?: string;
  plainLanguage?: string;
}): EarthPredictionRow {
  return buildEarthPredictionRow({
    ...input,
    programId:      ELECTRON_BOHR_RYDBERG_PROGRAM_ID,
    kernelId:       ELECTRON_BOHR_RYDBERG_KERNEL_ID,
    gate:           GATE,
    g2aIndependent: true,
    datasetIds:     [DATASET],
    modelSummary:   input.modelSummary ?? MODEL,
    plainLanguage:  input.plainLanguage ?? PLAIN,
  });
}

export function buildElectronBohrRydbergLedger(output: ElectronBohrRydbergAuditSlice): EarthPredictionLedger {
  const { dependencies, bohr, electron, rydberg } = output;
  const nassimMe = HBAR / (C * CODATA_ALPHA * CODATA_A0);
  return buildEarthPredictionLedger({
    simulationId:        ELECTRON_BOHR_RYDBERG_KERNEL_ID,
    scientificStatus:    "audit",
    referenceDatasetIds: [DATASET],
    predictions: [
      row({
        claimId:     "PRT-001-PHI18",
        observable:  "phi^18",
        unit:        "1",
        sm:          { value: null, uncertainty: null, source: "not a CODATA observable", release: "CODATA 2022" },
        earth:       { printed: dependencies.claimedPhi18, evaluated: dependencies.actualPhi18, formula: "φ¹⁸ printed 2584 vs eval φ¹⁸" },
        thad:        MISSING_THAD_PHI18,
        nassim:      MISSING_NASSIM_PHI18,
        auditStatus: "falsified",
        discrepancy: "arithmetic-cx: printed 2584 vs eval ≈5778",
      }),
      row({
        claimId:     "PRT-001-ALPHA",
        observable:  "alpha",
        unit:        "1",
        sm:          { value: CODATA_ALPHA, uncertainty: 1.1e-12, source: "CODATA", release: "2022" },
        earth:       { printed: 1 / dependencies.claimedAlphaInverse, evaluated: 1 / dependencies.computedAlphaInverse, formula: "α⁻¹=120π·3·φ²" },
        thad:        { value: THAD_ALPHA, formula: "zhe_1² (supplement, +7.82σ vs CODATA 2022)", status: "prediction" },
        nassim:      MISSING_NASSIM_ALPHA,
        auditStatus: "falsified",
        discrepancy: "arithmetic-cx: eval α⁻¹≈2960.93 not 137.036; Thad α is a supplement constructor",
      }),
      row({
        claimId:     "PRT-001-A0",
        observable:  "a_0",
        unit:        "m",
        sm:          { value: CODATA_A0, uncertainty: 8.2e-21, source: "CODATA", release: "2022" },
        earth:       { printed: bohr.sourcePrintedResult, evaluated: bohr.effectiveActualDependencies, formula: "a₀=ξ₀ φ¹⁸ α⁻¹" },
        thad:        reproPredictionSlot(THAD_A0, "recipe 148 (uses m_e)"),
        nassim:      MISSING_NASSIM_A0,
        auditStatus: "falsified",
        discrepancy: "arithmetic-cx: ξ₀ φ¹⁸ α⁻¹ is not a₀; printed CODATA-looking a₀ is not repaired",
      }),
      row({
        claimId:     "PRT-001-ME",
        observable:  "m_e",
        unit:        "kg",
        sm:          { value: CODATA_ME, uncertainty: 2.8e-40, source: "CODATA", release: "2022" },
        earth:       { printed: mevToKg(electron.sourcePrintedResult), evaluated: mevToKg(electron.actualDependencies), formula: "m_e=m_p φ⁻³⁶/α⁻¹" },
        thad:        reproPredictionSlot(THAD_ME, "recipe 67"),
        nassim:      identityPredictionSlot(nassimMe, "m_e=ħ/(c α a_0); holographic m_e at r=a_0 (a_0, α inputs; circular)"),
        auditStatus: "falsified",
        discrepancy: "EARTH m_e formula misses CODATA; Nassim is Bohr identity, not a prediction",
      }),
      row({
        claimId:     "PRT-001-RYD",
        observable:  "R_∞",
        unit:        "m^-1",
        sm:          { value: CODATA_RYD, uncertainty: 1.2e-5, source: "CODATA", release: "2022" },
        earth:       { printed: rydberg.sourcePrintedResult, evaluated: rydberg.fromActualElectronFormula, formula: "R_∞=m_e c α²/(2h)" },
        thad:        reproPredictionSlot(THAD_RYD, "recipe 23 (−3.92σ)"),
        nassim:      MISSING_NASSIM_RYD,
        auditStatus: "falsified",
        discrepancy: "R_∞ fed by the EARTH electron/α formulas misses CODATA; printed value is not repaired",
      }),
      row({
        claimId:      "PRT-001-E",
        observable:   "e",
        unit:         "C",
        sm:           { value: E, uncertainty: 0, source: "SI exact", release: "BIPM SI Brochure 9" },
        earth:        { printed: null, evaluated: null, formula: "CHEM-2 does not derive e" },
        thad:         { value: THAD_E, formula: "zhe_1 q_P (supplement)", status: "prediction" },
        nassim:       MISSING_NASSIM_E,
        auditStatus:  "missing",
        modelSummary: "Thad elementary-charge supplement",
        plainLanguage: "EARTH does not derive e. Thad emits zhe_1 q_P as a supplement, not a CHEM-2 prediction.",
      }),
      row({
        claimId:      "PRT-001-RE",
        observable:   "r_e",
        unit:         "m",
        sm:           { value: CODATA_RE, uncertainty: 1.3e-18, source: "CODATA", release: "2022" },
        earth:        { printed: null, evaluated: null, formula: "CHEM-2 does not derive r_e" },
        thad:         reproPredictionSlot(THAD_RE, "recipe 147 Thomson r_e (+5.00σ)"),
        nassim:       MISSING_NASSIM_RE,
        auditStatus:  "missing",
        modelSummary: "Thad Thomson radius",
        plainLanguage: "Thad recipe 147 is +5.00σ versus CODATA. That residual is a flag, not a repair.",
        discrepancy:  "+5.00σ vs CODATA 2022",
      }),
      row({
        claimId:      "PRT-001-GE",
        observable:   "g_e",
        unit:         "1",
        sm:           { value: CODATA_GE, uncertainty: 3.6e-15, source: "CODATA", release: "2022" },
        earth:        { printed: -2, evaluated: -2, formula: "CHEM-2 spin-1/2 loop claims exact g_e=−2" },
        thad:         reproPredictionSlot(THAD_GE, "recipe 121 (keeps anomaly)"),
        nassim:       MISSING_NASSIM_GE,
        auditStatus:  "falsified",
        modelSummary: "EARTH exact −2 versus the electron anomaly",
        plainLanguage: "EARTH claims g_e=−2 exactly. Thad recipe 121 keeps the anomaly. That is not a Dirac-moment derivation.",
        discrepancy:  "EARTH exact −2 misses the anomaly; Thad repro keeps it",
      }),
    ],
    findings: [
      { claimId: "PRT-001-PHI18", text: "φ¹⁸ printed 2584, evaluated ≈5778" },
      { claimId: "PRT-001-ALPHA", text: "α⁻¹=120π·3·φ² evaluates to ≈2960.93, not 137.036" },
      { claimId: "PRT-001-A0", text: "a₀=ξ₀ φ¹⁸ α⁻¹ with evaluated dependencies is not the Bohr radius" },
      { claimId: "PRT-001-ME", text: "m_e=m_p φ⁻³⁶/α⁻¹ misses CODATA; Nassim m_e=ħ/(c α a_0) is identity" },
      { claimId: "PRT-001-RYD", text: "R_∞=m_e c α²/(2h) fed by the EARTH electron formula misses CODATA" },
      { claimId: "PRT-001-RE", text: "Thad Thomson r_e is +5.00σ versus CODATA 2022" },
      { claimId: "PRT-001-GE", text: "EARTH exact g_e=−2; Thad recipe 121 keeps the anomaly" },
    ],
  });
}

export const ELECTRON_BOHR_RYDBERG_PLAIN_LANGUAGE = PLAIN;
