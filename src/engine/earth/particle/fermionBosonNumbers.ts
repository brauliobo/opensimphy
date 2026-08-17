import { checkCancelled, type EarthRunOptions } from "../common.js";
import {
  DEFAULT_PARTICLE_QUANTUM_NUMBER_AUDIT_INPUTS,
  particleQuantumNumberAudit,
  type ParticleQuantumNumberAuditInputs,
} from "../extendedAudits.js";
import { CODATA_HBAR, GOLDEN_RATIO, planckTwistAudit } from "../foundations.js";
import {
  buildEarthPredictionLedger,
  buildEarthPredictionRow,
  identityPredictionSlot,
  missingPredictionSlot,
  reproPredictionSlot,
  type EarthPredictionCounterpartSlot,
  type EarthPredictionLedger,
  type EarthPredictionRow,
  type EarthPredictionRowInput,
} from "./ledger.js";

export type FermionBosonNumbersInputs = ParticleQuantumNumberAuditInputs;

export const DEFAULT_FERMION_BOSON_NUMBERS_INPUTS: FermionBosonNumbersInputs = DEFAULT_PARTICLE_QUANTUM_NUMBER_AUDIT_INPUTS;

const PROGRAM_ID = "EARTH-PRT-005";
const KERNEL_ID = "fermion-boson-numbers";
const PHI = GOLDEN_RATIO;
const PHI6 = PHI ** 6;
const PHI_INV2 = PHI ** -2;
const PHI12 = PHI ** 12;
const ELECTRON_MASS = 9.109_383_713_9e-31;
const XI0_M = 0.15e-15;
const SPEED_OF_LIGHT = 299_792_458;
const WEINBERG_LOG = Math.log(1 + Math.SQRT2);
const THAD_MW_OVER_MZ = WEINBERG_LOG;
const THAD_SIN2W_ONSHELL = 1 - WEINBERG_LOG ** 2;
const CODATA_ID = "earth-dataset-codata-recommended-values";
const PDG_ID = "earth-dataset-review-of-particle-physics-pdg-api";
const PLAIN = "φ⁶ is 17.944, not μ/e=206.768. |V_us|=φ⁻² evaluates to 0.382, not 0.224. Twist-count ħ is 0.01350 of CODATA. Down and electron Q are not their windings. Photon labels have no mass law. Thad reproduces lepton masses and G_F; its Weinberg angle is on-shell, not the EARTH MSbar-like number.";

const MISSING_THAD_QUARK = missingPredictionSlot("Physics Monastery quark / winding / kink table (none)");
const MISSING_THAD_CKM = missingPredictionSlot("Physics Monastery CKM |V_us| (none)");
const MISSING_THAD_NU = missingPredictionSlot("Physics Monastery neutrino spectrum (none)");
const MISSING_THAD_LOOP = missingPredictionSlot("Physics Monastery loop-boson dispersion (none)");
const MISSING_NASSIM_KINK = missingPredictionSlot("Haramein kink spectrum / generation cascade (none)");
const MISSING_NASSIM_CKM = missingPredictionSlot("Haramein CKM / |V_us| (none)");
const MISSING_NASSIM_LOOP = missingPredictionSlot("Haramein loop-boson mass (none; 2010 μ_p is era-1.32 fm and is excluded)");
const MISSING_NASSIM_WEAK = missingPredictionSlot("Haramein weak-angle / G_F derivation (none)");
const MISSING_EARTH_MASS = { printed: null, evaluated: null, formula: "no EARTH absolute-mass operator" };

function calibrationSlot(value: number, formula: string): EarthPredictionCounterpartSlot {
  return { value, formula, status: "calibration" };
}

function predictionSlot(value: number, formula: string): EarthPredictionCounterpartSlot {
  return { value, formula, status: "prediction" };
}

function row(input: Omit<EarthPredictionRowInput, "programId" | "kernelId" | "datasetIds"> & { datasetIds?: readonly string[] }): EarthPredictionRow {
  return buildEarthPredictionRow({
    ...input,
    programId:    PROGRAM_ID,
    kernelId:     KERNEL_ID,
    datasetIds:   input.datasetIds ?? [CODATA_ID, PDG_ID],
    modelSummary: input.modelSummary ?? "Fermion Theorem / Boson Isomorphism number ledger",
    plainLanguage: input.plainLanguage ?? PLAIN,
  });
}

export function fermionBosonNumbers(
  inputs: FermionBosonNumbersInputs = DEFAULT_FERMION_BOSON_NUMBERS_INPUTS,
  options: EarthRunOptions = {},
) {
  checkCancelled(options);
  const audit = particleQuantumNumberAudit(inputs);
  const twist = planckTwistAudit();
  const earthGfSi = PHI ** -36 * XI0_M ** 2 / (CODATA_HBAR * SPEED_OF_LIGHT);
  const muonFromPhi6 = ELECTRON_MASS * PHI6;
  const tauFromPhi12 = ELECTRON_MASS * PHI12;

  const predictions = [
    row({
      claimId:    "PRT-005-U",
      observable: "u-charge",
      unit:       "e",
      sm:         { value: 2 / 3, uncertainty: 0, source: "PDG u quark Q", release: "PDG 2026" },
      earth:      { printed: 2 / 3, evaluated: 2 / 3, formula: "Q_em=w; w=+2/3" },
      thad:       MISSING_THAD_QUARK,
      nassim:     MISSING_NASSIM_KINK,
      gate:       { metric: "exact", passIf: "exact" },
      auditStatus:    "testable",
      g2aIndependent: true,
      correlation:    "Q=w holds as a label",
      discrepancy:    "topological-gate: Hopf sector π₃(S¹)=0; label only",
    }),
    row({
      claimId:    "PRT-005-D",
      observable: "d-charge",
      unit:       "e",
      sm:         { value: -1 / 3, uncertainty: 0, source: "PDG d quark Q", release: "PDG 2026" },
      earth:      { printed: -1 / 3, evaluated: -2 / 3, formula: "Q_em=w; w=-2/3 assigned Q=-1/3" },
      thad:       MISSING_THAD_QUARK,
      nassim:     MISSING_NASSIM_KINK,
      gate:       { metric: "exact", passIf: "exact" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      discrepancy:    "Q≠w: assigned -1/3 vs winding -2/3",
    }),
    row({
      claimId:    "PRT-005-E",
      observable: "e-charge",
      unit:       "e",
      sm:         { value: -1, uncertainty: 0, source: "PDG electron Q", release: "PDG 2026" },
      earth:      { printed: -1, evaluated: -2, formula: "Q_em=w; w=-2 assigned Q=-1" },
      thad:       MISSING_THAD_QUARK,
      nassim:     MISSING_NASSIM_KINK,
      gate:       { metric: "exact", passIf: "exact" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      discrepancy:    "Q≠w: assigned -1 vs winding -2",
    }),
    row({
      claimId:    "PRT-005-NU",
      observable: "nu-charge",
      unit:       "e",
      sm:         { value: 0, uncertainty: 0, source: "PDG neutrino Q", release: "PDG 2026" },
      earth:      { printed: 0, evaluated: 0, formula: "Q_em=w; w=0" },
      thad:       MISSING_THAD_NU,
      nassim:     MISSING_NASSIM_KINK,
      gate:       { metric: "exact", passIf: "exact" },
      auditStatus:    "testable",
      g2aIndependent: true,
      correlation:    "Q=w holds as a label",
      discrepancy:    "testable as a label only; no neutrino mass operator",
    }),
    row({
      claimId:    "PRT-005-GAMMA",
      observable: "photon-spin",
      unit:       "hbar",
      sm:         { value: 1, uncertainty: 0, source: "PDG photon J^P", release: "PDG 2026" },
      earth:      { printed: 1, evaluated: 1, formula: "2π monodromy closed loop; two transverse modes claimed" },
      thad:       MISSING_THAD_LOOP,
      nassim:     MISSING_NASSIM_LOOP,
      gate:       { metric: "exact", passIf: "exact" },
      auditStatus:    "blocked",
      g2aIndependent: true,
      discrepancy:    "blocked: labels match; no dispersion or mass law from a scalar",
    }),
    row({
      claimId:    "PRT-005-MUE",
      observable: "mu-e-mass-ratio",
      unit:       "1",
      sm:         { value: 206.768_283, uncertainty: 4.6e-7, source: "CODATA / PDG m_μ/m_e", release: "CODATA 2022" },
      earth:      { printed: 206.768_283_191_694_1, evaluated: PHI6, formula: "μ/e=φ⁶" },
      thad:       reproPredictionSlot(206.768_283, "m_μ/m_e recipes 55/67"),
      nassim:     MISSING_NASSIM_KINK,
      gate:       { metric: "relative", passIf: "<=1e-9" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      discrepancy:    `arithmetic-cx: φ⁶=${PHI6} not 206.768`,
    }),
    row({
      claimId:    "PRT-005-VUS",
      observable: "|V_us|",
      unit:       "1",
      sm:         { value: 0.2243, uncertainty: 0.0005, source: "PDG |V_us|", release: "PDG 2026" },
      earth:      { printed: 0.222_520_933_956_314_4, evaluated: PHI_INV2, formula: "|V_us|=φ⁻²" },
      thad:       MISSING_THAD_CKM,
      nassim:     MISSING_NASSIM_CKM,
      gate:       { metric: "relative", passIf: "<=1e-9" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      discrepancy:    `arithmetic-cx: φ⁻²=${PHI_INV2}; printed 0.22252 is not φ⁻²`,
    }),
    row({
      claimId:    "PRT-005-SIN2W",
      observable: "sin2-theta-W",
      unit:       "1",
      sm:         { value: 0.23121, uncertainty: 0.00004, source: "PDG sin²θ_W MSbar", release: "PDG 2026" },
      earth:      { printed: 0.23122, evaluated: 0.23122, formula: "printed 0.23122; no independent formula" },
      thad:       predictionSlot(THAD_SIN2W_ONSHELL, "1-[log(1+√2)]² on-shell"),
      nassim:     MISSING_NASSIM_WEAK,
      gate:       { metric: "relative", passIf: "<=1e-9" },
      auditStatus:    "calibration",
      g2aIndependent: false,
      discrepancy:    "scheme clash: EARTH 0.23122 is MSbar-like; Thad 0.22318 is on-shell",
    }),
    row({
      claimId:    "PRT-005-GF",
      observable: "G_F/(hbar c)^3",
      unit:       "GeV^-2",
      sm:         { value: 1.166_378_7e-5, uncertainty: 6e-12, source: "CODATA G_F/(ħc)³", release: "CODATA 2022" },
      earth:      { printed: null, evaluated: earthGfSi, formula: "φ⁻³⁶ ξ₀²/ħc" },
      thad:       reproPredictionSlot(1.166_378_521_83e-5, "recipe 150 G_F/(ħc)³"),
      nassim:     MISSING_NASSIM_WEAK,
      gate:       { metric: "relative", passIf: "<=1e-9" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      discrepancy:    "unit-inconsistent: φ⁻³⁶ ξ₀²/ħc is not GeV⁻²",
    }),
    row({
      claimId:    "FND-011-HBAR",
      observable: "hbar",
      unit:       "J s",
      sm:         { value: CODATA_HBAR, uncertainty: 0, source: "SI exact ħ=h/2π", release: "CODATA 2022 / SI" },
      earth:      { printed: CODATA_HBAR, evaluated: twist.output.action, formula: "ħ=δχ ξ₀ (m_p c/3)/(2π)" },
      thad:       identityPredictionSlot(CODATA_HBAR, "ROBERTS-001 l_P m_P=ħ/c"),
      nassim:     calibrationSlot(CODATA_HBAR, "CODATA ħ input to r_p=4ħ/(m_p c)"),
      gate:       { metric: "relative", passIf: "<=1e-9" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      datasetIds:     [CODATA_ID],
      discrepancy:    `arithmetic-cx: ${twist.output.ratioToCodata.toFixed(5)} ħ`,
    }),
    row({
      claimId:    "PRT-005-MMU",
      observable: "muon-mass",
      unit:       "kg",
      sm:         { value: 1.883_531_627e-28, uncertainty: 4.2e-36, source: "CODATA muon mass", release: "CODATA 2022" },
      earth:      { printed: ELECTRON_MASS * 206.768_283, evaluated: muonFromPhi6, formula: "m_μ=m_e φ⁶" },
      thad:       reproPredictionSlot(1.883_531_615_023_63e-28, "recipe 55 m_μ"),
      nassim:     MISSING_NASSIM_KINK,
      gate:       { metric: "relative", passIf: "<=1e-9" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      discrepancy:    "φ⁶ cascade misses m_μ; Thad recipe is CODATA repro",
    }),
    row({
      claimId:    "PRT-005-MTAU",
      observable: "tau-mass",
      unit:       "kg",
      sm:         { value: 3.167_54e-27, uncertainty: 2.1e-31, source: "CODATA / PDG tau mass", release: "CODATA 2022" },
      earth:      { printed: null, evaluated: tauFromPhi12, formula: "m_τ=m_e φ¹² from φ⁶ cascade" },
      thad:       reproPredictionSlot(3.167_545_466_689_53e-27, "recipe 68 m_τ"),
      nassim:     MISSING_NASSIM_KINK,
      gate:       { metric: "relative", passIf: "<=1e-9" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      discrepancy:    "φ¹² cascade misses m_τ; Thad recipe is CODATA repro",
    }),
    row({
      claimId:    "PRT-005-MN",
      observable: "neutron-mass",
      unit:       "kg",
      sm:         { value: 1.674_927_500_56e-27, uncertainty: 8.5e-37, source: "CODATA neutron mass", release: "CODATA 2022" },
      earth:      MISSING_EARTH_MASS,
      thad:       reproPredictionSlot(1.674_927_498_878_77e-27, "recipe 52 m_n"),
      nassim:     MISSING_NASSIM_KINK,
      gate:       { metric: "relative", passIf: "<=1e-9" },
      auditStatus:    "missing",
      g2aIndependent: true,
      discrepancy:    "no EARTH neutron-mass operator; Thad recipe is CODATA repro",
    }),
    row({
      claimId:    "PRT-005-MWZ",
      observable: "m_W/m_Z",
      unit:       "1",
      sm:         { value: 0.88145, uncertainty: 0.00013, source: "PDG m_W/m_Z", release: "PDG 2026" },
      earth:      { printed: null, evaluated: null, formula: "finite ξ₀ yields W/Z; no pole from ξ₀=0.15 fm" },
      thad:       predictionSlot(THAD_MW_OVER_MZ, "log(1+√2) supplement"),
      nassim:     MISSING_NASSIM_LOOP,
      gate:       { metric: "relative", passIf: "<=1e-9" },
      auditStatus:    "blocked",
      g2aIndependent: true,
      discrepancy:    "no electroweak scale from ξ₀; Thad supplement −0.62σ vs PDG",
    }),
    row({
      claimId:    "PRT-005-GP",
      observable: "proton-g-factor",
      unit:       "1",
      sm:         { value: 5.585_694_689_3, uncertainty: 1.6e-9, source: "CODATA g_p", release: "CODATA 2022" },
      earth:      MISSING_EARTH_MASS,
      thad:       reproPredictionSlot(5.585_694_690_13, "recipe 132 g_+"),
      nassim:     missingPredictionSlot("Haramein proton g-factor (none; 2010 μ_p is era-1.32 fm and is excluded)"),
      gate:       { metric: "relative", passIf: "<=1e-9" },
      auditStatus:    "missing",
      g2aIndependent: true,
      discrepancy:    "no EARTH g_p; Thad recipe is CODATA repro",
    }),
  ];

  const predictionLedger: EarthPredictionLedger = buildEarthPredictionLedger({
    simulationId:        KERNEL_ID,
    predictions,
    scientificStatus:    "audit",
    referenceDatasetIds: [CODATA_ID, PDG_ID],
    blockers: [
      "PRT-005-GAMMA: photon labels have no dispersion or mass law",
      "PRT-005-MWZ: no W/Z pole from ξ₀=0.15 fm",
      "Hopf sector π₃(S¹)=0; charge labels are not Hopf charge",
    ],
    findings: [
      { claimId: "PRT-005-MUE", text: "arithmetic-cx: φ⁶=17.944 not μ/e=206.768" },
      { claimId: "PRT-005-VUS", text: "arithmetic-cx: φ⁻²=0.381966; no Thad CKM" },
      { claimId: "FND-011-HBAR", text: "arithmetic-cx: twist-count ħ is 0.01350 CODATA; Thad ROBERTS-001 is an identity; Nassim uses CODATA ħ" },
      { claimId: "PRT-005-D", text: "Q≠w for d (assigned -1/3, w=-2/3)" },
      { claimId: "PRT-005-E", text: "Q≠w for e (assigned -1, w=-2)" },
      { claimId: "PRT-005-U", text: "u and ν Q=w labels are testable only" },
      { claimId: "PRT-005-GAMMA", text: "photon labels blocked: no dispersion/mass law" },
      { claimId: "PRT-005-SIN2W", text: "scheme clash: EARTH 0.23122 MSbar-like vs Thad on-shell 0.22318" },
      { claimId: "PRT-005-GF", text: "unit-inconsistent EARTH G_F; Thad recipe 150 is CODATA repro" },
    ],
  });

  return {
    method: "Four-column Fermion Theorem and Boson Isomorphism number ledger; known CX left unrepaired",
    diagnostics: {
      ...audit.diagnostics,
      provenanceKind: "reproduction",
      validatesEarthTheory: false,
      hbarRatioToCodata: twist.output.ratioToCodata,
      phi6: PHI6,
      phiInv2: PHI_INV2,
    },
    predictionLedger,
    output: {
      ...audit.output,
      schemaVersion: predictionLedger.schemaVersion,
      simulationId: predictionLedger.simulationId,
      scientificStatus: predictionLedger.scientificStatus,
      validatesEarthTheory: false as const,
      predictions: predictionLedger.predictions,
      residuals: predictionLedger.residuals,
      blockers: predictionLedger.blockers,
      referenceDatasetIds: predictionLedger.referenceDatasetIds,
      plainLanguage: PLAIN,
      hbar: {
        printed: CODATA_HBAR,
        evaluated: twist.output.action,
        ratioToCodata: twist.output.ratioToCodata,
      },
      hardGates: { hopfSector: false, substitutionGrowth: 2, torus31: "unknot" as const },
      flags: ["arithmetic-cx", "topological-gate", "unit-inconsistent", "identity-not-prediction", "missing-operator", "scheme-clash"],
    },
  };
}

export type FermionBosonNumbersOutput = ReturnType<typeof fermionBosonNumbers>["output"];
