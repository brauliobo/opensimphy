import { ELEMENTARY_CHARGE_C, PLANCK_CONSTANT_J_S, SPEED_OF_LIGHT_M_PER_S } from "../../../simphy/constants.js";
import { GOLDEN_RATIO, CODATA_ALPHA, CODATA_HBAR } from "../foundations.js";
import {
  buildEarthPredictionLedger,
  buildEarthPredictionRow,
  identityPredictionSlot,
  missingPredictionSlot,
  reproPredictionSlot,
  type EarthPredictionLedger,
  type EarthPredictionRow,
  type EarthPredictionRowInput,
  type EarthPredictionScalar,
} from "./ledger.js";

export const CX_CLAIM_IDS = Object.freeze([
  "PRT-001-PHI18", "PRT-001-ALPHA", "PRT-001-A0", "PRT-001-ME", "PRT-001-RYD",
  "PRT-005-U", "PRT-005-D", "PRT-005-E", "PRT-005-NU", "PRT-005-GAMMA",
  "PRT-005-MUE", "PRT-005-VUS", "PRT-005-SIN2W", "PRT-005-GF",
  "NUC-001-P", "NUC-001-HE", "NUC-001-C",
  "NUC-004-XI", "NUC-004-RP", "NUC-004-MP", "NUC-002-AME",
  "FND-011-HBAR", "GRV-001-G",
  "FLD-005-VAR", "FLD-006-TC", "FLD-007-FLOQ", "FLD-008-SG",
] as const);

export type CxClaimId = typeof CX_CLAIM_IDS[number];

const CODATA = "earth-dataset-codata-recommended-values";
const PDG    = "earth-dataset-review-of-particle-physics-pdg-api";
const AME    = "earth-dataset-ame2020-and-nubase2020";
const KNOT   = "earth-dataset-knotinfo";

const C          = SPEED_OF_LIGHT_M_PER_S;
const XI0_M      = 0.15e-15;
const XI0_FM     = 0.15;
const MP_KG      = 1.672_621_923_69e-27;
const MP_MEV     = 938.272_081_3;
const HBAR_C     = 197.326_980_4;
const E_CHARGE   = ELEMENTARY_CHARGE_C;
const H          = PLANCK_CONSTANT_J_S;
const ZHE_1      = 0.085_424_543_153_330_47;
const RP_SM      = 0.840_75;
const RP_SM_UNC  = 0.000_64;
const RP_THAD    = 0.843_431_614_4;
const RP_NASSIM  = 0.841_235_640_2;
const LAMBDA_LIT = (4 * Math.PI) ** 3;
const PHI18      = GOLDEN_RATIO ** 18;
const ALPHA_SRC  = 120 * Math.PI * 3 * GOLDEN_RATIO ** 2;
const TWIST      = 1 / Math.sqrt(3 * GOLDEN_RATIO ** 2);
const HBAR_TWIST = TWIST * XI0_M * MP_KG * C / (6 * Math.PI);
const A0_EVAL    = XI0_M * PHI18 * ALPHA_SRC;
const ME_EVAL    = MP_MEV * GOLDEN_RATIO ** -36 / ALPHA_SRC;
const RYD_EVAL   = ME_EVAL * 1e6 * E_CHARGE / (2 * H * C * ALPHA_SRC ** 2);
const G_COUPLING = GOLDEN_RATIO ** -72 * XI0_M ** 4 * C ** 4 / CODATA_HBAR;
const G_QG       = 6.340_806_087_699_862e-11;
const MP_LIT     = Math.PI ** 2 * Math.sqrt(LAMBDA_LIT) / XI0_FM * HBAR_C;
const FIVE_XI    = 5 * XI0_FM * GOLDEN_RATIO ** -2;
const XI_FROM_RP = 0.8414 * Math.sqrt(10 / 3);
const E_P_NASSIM = 4 * CODATA_HBAR * C / 0.8414e-15 / (E_CHARGE * 1e6);

const noThadField   = missingPredictionSlot("Thad has no field/decoherence/spectra/knot table");
const noNassimField = missingPredictionSlot("Nassim has no Langevin/Floquet/SG/knot table");
const noThad        = missingPredictionSlot("no Thad Formula/wall claim for this observable");
const noNassim      = missingPredictionSlot("no Haramein formula for this observable");

function cx(input: EarthPredictionRowInput): EarthPredictionRow {
  return buildEarthPredictionRow(input);
}

function sm(value: number | null, uncertainty: number | null, source: string, release: string) {
  return { value, uncertainty, source, release };
}

const rows: EarthPredictionRow[] = [
  cx({
    claimId: "PRT-001-PHI18", programId: "EARTH-PRT-001", kernelId: "goldenPowerAudit",
    observable: "φ^18", unit: "1",
    sm:    sm(null, null, "algebra", "math"),
    earth: { printed: 2584, evaluated: PHI18, formula: "φ^18" },
    thad:  noThad, nassim: noNassim,
    gate: { metric: "relative", passIf: "relative≤1e-8" },
    auditStatus: "falsified", g2aIndependent: true, datasetIds: [],
    discrepancy: "printed 2584 vs φ^18=5777.9998269 (+123.6%)",
  }),
  cx({
    claimId: "PRT-001-ALPHA", programId: "EARTH-PRT-001", kernelId: "piAlphaAudit",
    observable: "α^{-1}", unit: "1",
    sm:    sm(1 / CODATA_ALPHA, 2.1e-8, "CODATA", "2022"),
    earth: { printed: 137.0359990842167, evaluated: ALPHA_SRC, formula: "120π·3·φ^2" },
    thad:  { value: 1 / ZHE_1 ** 2, formula: "α=zhe_1^2 (Transform Dictionary extra, not a 288 repro)", status: "prediction" },
    nassim: identityPredictionSlot(1 / CODATA_ALPHA, "Bohr identity m_e=ħ/(c α a_0) uses α as input"),
    gate: { metric: "relative", passIf: "relative≤1e-8" },
    auditStatus: "falsified", g2aIndependent: true, datasetIds: [CODATA],
    discrepancy: "120π·3·φ^2=2960.93, not 137.036; Nassim α is circular",
  }),
  cx({
    claimId: "PRT-001-A0", programId: "EARTH-PRT-001", kernelId: "electronBohrRydbergAudit",
    observable: "a_0", unit: "m",
    sm:    sm(5.29177210544e-11, null, "CODATA", "2022"),
    earth: { printed: 5.29177210903e-11, evaluated: A0_EVAL, formula: "a_0=ξ₀ φ^{18} α^{-1}" },
    thad:  noThad,
    nassim: missingPredictionSlot("Nassim 2019 uses a_0 as input to the Bohr identity"),
    gate: { metric: "relative", passIf: "relative≤1e-8" },
    auditStatus: "falsified", g2aIndependent: false, datasetIds: [CODATA],
    discrepancy: "ξ₀ φ^{18}=8.667e-13 m; with real α^{-1}: 2.566e-9 m; printed CODATA-looking a_0 is circular",
  }),
  cx({
    claimId: "PRT-001-ME", programId: "EARTH-PRT-001", kernelId: "electronBohrRydbergAudit",
    observable: "m_e", unit: "MeV",
    sm:    sm(0.51099895069, null, "CODATA", "2022"),
    earth: { printed: 0.5109989461, evaluated: ME_EVAL, formula: "m_e=m_p φ^{-36}/α^{-1}" },
    thad:  { value: null, formula: "m_e is a 288-recipe constructor input (88 consumers)", status: "calibration" },
    nassim: identityPredictionSlot(0.51099895069, "m_e=ħ/(c α a_0)"),
    gate: { metric: "relative", passIf: "relative≤1e-8" },
    auditStatus: "falsified", g2aIndependent: false, datasetIds: [CODATA],
    discrepancy: "real deps give 9.49e-9 MeV; Nassim electron mass is the Bohr identity",
  }),
  cx({
    claimId: "PRT-001-RYD", programId: "EARTH-PRT-001", kernelId: "electronBohrRydbergAudit",
    observable: "R_∞", unit: "m^{-1}",
    sm:    sm(10_973_731.568157, 0.000012, "CODATA", "2022"),
    earth: { printed: 10_973_731.56816, evaluated: RYD_EVAL, formula: "R_∞ from failed m_e,α" },
    thad:  noThad, nassim: noNassim,
    gate: { metric: "relative", passIf: "relative≤1e-8" },
    auditStatus: "falsified", g2aIndependent: false, datasetIds: [CODATA],
  }),
  cx({
    claimId: "PRT-005-U", programId: "EARTH-PRT-005", kernelId: "particleQuantumNumberAudit",
    observable: "u: s, Q", unit: "1",
    sm:    sm(2 / 3, null, "PDG", "2026"),
    earth: { printed: 2 / 3, evaluated: 2 / 3, formula: "Q=w=+2/3" },
    thad:  noThad, nassim: noNassim,
    gate: { metric: "relative", passIf: "relative≤1e-9" },
    auditStatus: "testable", g2aIndependent: true, datasetIds: [PDG],
    discrepancy: "labels match; Hopf sector is independently falsified (π₃(S¹)=0, FLD-001)",
  }),
  cx({
    claimId: "PRT-005-D", programId: "EARTH-PRT-005", kernelId: "particleQuantumNumberAudit",
    observable: "d: Q vs w", unit: "1",
    sm:    sm(-1 / 3, null, "PDG", "2026"),
    earth: { printed: -1 / 3, evaluated: -2 / 3, formula: "Q_em=w but assigned Q=-1/3, w=-2/3" },
    thad:  noThad, nassim: noNassim,
    gate: { metric: "relative", passIf: "relative≤1e-9" },
    auditStatus: "falsified", g2aIndependent: true, datasetIds: [PDG],
    discrepancy: "internal Q≠w for the down quark",
  }),
  cx({
    claimId: "PRT-005-E", programId: "EARTH-PRT-005", kernelId: "particleQuantumNumberAudit",
    observable: "e: Q vs w", unit: "1",
    sm:    sm(-1, null, "PDG", "2026"),
    earth: { printed: -1, evaluated: -2, formula: "Q_em=w but assigned Q=-1, w=-2" },
    thad:  { value: null, formula: "e=zhe_1 q_P is a charge-magnitude extra, not a Q=w derivation", status: "missing" },
    nassim: noNassim,
    gate: { metric: "relative", passIf: "relative≤1e-9" },
    auditStatus: "falsified", g2aIndependent: true, datasetIds: [PDG],
    discrepancy: "internal Q≠w for the electron",
  }),
  cx({
    claimId: "PRT-005-NU", programId: "EARTH-PRT-005", kernelId: "particleQuantumNumberAudit",
    observable: "ν: s, Q", unit: "1",
    sm:    sm(0, null, "PDG", "2026"),
    earth: { printed: 0, evaluated: 0, formula: "Q=w=0" },
    thad:  noThad, nassim: noNassim,
    gate: { metric: "relative", passIf: "relative≤1e-9" },
    auditStatus: "testable", g2aIndependent: true, datasetIds: [PDG],
    discrepancy: "label only; no mass/mixing operator",
  }),
  cx({
    claimId: "PRT-005-GAMMA", programId: "EARTH-PRT-005", kernelId: "particleQuantumNumberAudit",
    observable: "γ: s, Q", unit: "1",
    sm:    sm(0, null, "PDG", "2026"),
    earth: { printed: 0, evaluated: 0, formula: "spin-1, Q=0, 2π monodromy" },
    thad:  noThad, nassim: noNassim,
    gate: { metric: "relative", passIf: "relative≤1e-9" },
    auditStatus: "blocked", g2aIndependent: true, datasetIds: [PDG],
    discrepancy: "labels match; no EARTH dispersion/mass law. Thad extra m_W/m_Z=log(1+√2) is not a γ claim.",
  }),
  cx({
    claimId: "PRT-005-MUE", programId: "EARTH-PRT-005", kernelId: "particleQuantumNumberAudit",
    observable: "μ/e", unit: "1",
    sm:    sm(206.768283, null, "PDG", "2026"),
    earth: { printed: 206.7682831916941, evaluated: GOLDEN_RATIO ** 6, formula: "φ^6" },
    thad:  noThad, nassim: noNassim,
    gate: { metric: "relative", passIf: "relative≤1e-9" },
    auditStatus: "falsified", g2aIndependent: true, datasetIds: [PDG],
    discrepancy: "φ^6=17.94427, not 206.768 (−91.3%)",
  }),
  cx({
    claimId: "PRT-005-VUS", programId: "EARTH-PRT-005", kernelId: "particleQuantumNumberAudit",
    observable: "|V_us|", unit: "1",
    sm:    sm(0.2243, 0.0005, "PDG", "2026"),
    earth: { printed: 0.2225209339563144, evaluated: GOLDEN_RATIO ** -2, formula: "φ^{-2}" },
    thad:  noThad, nassim: noNassim,
    gate: { metric: "relative", passIf: "relative≤1e-9" },
    auditStatus: "falsified", g2aIndependent: true, datasetIds: [PDG],
    discrepancy: "φ^{-2}=0.381966; printed 0.22252 is sin(π/14), not φ^{-2}",
  }),
  cx({
    claimId: "PRT-005-SIN2W", programId: "EARTH-PRT-005", kernelId: "particleQuantumNumberAudit",
    observable: "sin^2 θ_W", unit: "1",
    sm:    sm(0.23121, 0.00004, "PDG", "2026"),
    earth: { printed: 0.23122, evaluated: null, formula: "no formula supplied" },
    thad:  { value: 0.22318060001, formula: "on-shell 1-(m_W/m_Z)^2 with m_W/m_Z=log(1+√2)", status: "prediction" },
    nassim: noNassim,
    gate: { metric: "relative", passIf: "relative≤1e-9" },
    auditStatus: "missing", g2aIndependent: false, datasetIds: [PDG],
    discrepancy: "EARTH number has no formula. Thad 0.22318060001 is on-shell vs PDG MSbar 0.23121; vs CODATA on-shell 0.22305(23) is +0.57σ.",
  }),
  cx({
    claimId: "PRT-005-GF", programId: "EARTH-PRT-005", kernelId: "particleQuantumNumberAudit",
    observable: "G_F", unit: "GeV^{-2}",
    sm:    sm(1.1663787e-5, null, "PDG", "2026"),
    earth: { printed: "φ^{-36} ξ₀^2/ħc", evaluated: GOLDEN_RATIO ** -36 * XI0_M ** 2 / (CODATA_HBAR * C), formula: "φ^{-36} ξ₀^2/ħc" },
    thad:  noThad, nassim: noNassim,
    gate: { metric: "relative", passIf: "relative≤1e-9" },
    auditStatus: "falsified", g2aIndependent: true, datasetIds: [PDG],
    discrepancy: "dimensions do not close; SI eval ~2.13e-14 is not G_F",
  }),
  cx({
    claimId: "NUC-001-P", programId: "EARTH-NUC-001", kernelId: "nuclearPairEnumerationAudit",
    observable: "¹H T(p,q) crossings", unit: "1",
    sm:    sm(3, null, "knot theory T(2,3)", "standard"),
    earth: { printed: 3, evaluated: 0, formula: "claimed T(3,1) trefoil; A=pq, Z=p-3" },
    thad:  noThadField, nassim: missingPredictionSlot("Nassim proton is spherical PSU, not a knot"),
    gate: { metric: "exact", passIf: "exact" },
    auditStatus: "falsified", g2aIndependent: true, datasetIds: [KNOT],
    discrepancy: "T(3,1) is the unknot (0 crossings); A=3,Z=0 not ¹H",
  }),
  cx({
    claimId: "NUC-001-HE", programId: "EARTH-NUC-001", kernelId: "nuclearPairEnumerationAudit",
    observable: "⁴He components", unit: "1",
    sm:    sm(1, null, "PDG nuclide", "2026"),
    earth: { printed: 1, evaluated: 3, formula: "claimed T(3,3) knot; A=4,Z=2" },
    thad:  noThadField, nassim: noNassimField,
    gate: { metric: "exact", passIf: "exact" },
    auditStatus: "falsified", g2aIndependent: true, datasetIds: [PDG, KNOT],
    discrepancy: "T(3,3) is a 3-component link; A=9,Z=0",
  }),
  cx({
    claimId: "NUC-001-C", programId: "EARTH-NUC-001", kernelId: "nuclearPairEnumerationAudit",
    observable: "¹²C components", unit: "1",
    sm:    sm(1, null, "PDG nuclide", "2026"),
    earth: { printed: 1, evaluated: 5, formula: "claimed T(5,5) knot; A=12,Z=6" },
    thad:  noThadField, nassim: noNassimField,
    gate: { metric: "exact", passIf: "exact" },
    auditStatus: "falsified", g2aIndependent: true, datasetIds: [PDG, KNOT],
    discrepancy: "T(5,5) is a 5-component link; A=25,Z=2",
  }),
  cx({
    claimId: "NUC-004-XI", programId: "EARTH-NUC-004", kernelId: "protonFormulaAudit",
    observable: "ξ₀ from r_p", unit: "fm",
    sm:    sm(null, null, "identity check", "math"),
    earth: { printed: 0.15, evaluated: XI_FROM_RP, formula: "ξ₀=r_p √(10/3), r_p=0.8414 fm" },
    thad:  noThad, nassim: missingPredictionSlot("Nassim takes r_p as the input scale"),
    gate: { metric: "relative", passIf: "relative≤1e-6" },
    auditStatus: "falsified", g2aIndependent: false, datasetIds: [CODATA],
    discrepancy: "r_p √(10/3)=1.53618 fm, not 0.15 fm",
  }),
  cx({
    claimId: "NUC-004-RP", programId: "EARTH-NUC-004", kernelId: "protonFormulaAudit",
    observable: "r_p", unit: "fm",
    sm:    sm(RP_SM, RP_SM_UNC, "CODATA", "2022"),
    earth: { printed: 0.8414, evaluated: FIVE_XI, formula: "5 ξ₀ φ^{-2} (also ξ₀=0.15 fm as proton scale)" },
    thad:  { value: RP_THAD, formula: "Catalan chain r_p=r_e (π/6)^2/K", status: "prediction" },
    nassim: { value: RP_NASSIM, formula: "r_p=4ħ/(m_p c)=4λ_p", status: "prediction" },
    gate: { metric: "sigma", passIf: "<=3σ" },
    auditStatus: "falsified", g2aIndependent: true, datasetIds: [CODATA],
    discrepancy: "Four r_p hypotheses: EARTH 0.15 and 0.8414 routes falsified (5ξ₀φ^{-2}=0.28648 fm); Nassim 0.8412356402 fm (+0.76σ); Thad 0.8434316144 fm (+4.19σ); SM 0.84075(64) fm",
  }),
  cx({
    claimId: "NUC-004-MP", programId: "EARTH-NUC-004", kernelId: "protonFormulaAudit",
    observable: "m_p", unit: "MeV",
    sm:    sm(938.27208816, null, "CODATA", "2022"),
    earth: { printed: 938.272, evaluated: MP_LIT, formula: "m_p=π^2 √λ̃₀/ξ₀ with λ̃₀=(4π)^3 or 44.492" },
    thad:  { value: 938.2896 * 0.9999820, formula: "ROBERTS-013 GeV/c^2×0.9382896, root corr. 0.9999820", status: "calibration" },
    nassim: { value: E_P_NASSIM, formula: "E_p=4ħc/r at r=0.8414 fm", status: "prediction" },
    gate: { metric: "relative", passIf: "relative≤1e-6" },
    auditStatus: "falsified", g2aIndependent: false, datasetIds: [CODATA],
    discrepancy: "λ=44.492 → 8.66e4 MeV; (4π)^3 → 5.78e5 MeV. Thad recipe is calibration. Nassim E_p(0.8414 fm)=938.0888 MeV (−0.0195%).",
  }),
  cx({
    claimId: "NUC-002-AME", programId: "EARTH-NUC-002", kernelId: "none",
    observable: "nuclide masses", unit: "MeV",
    sm:    sm(null, null, "AME2020", "2020"),
    earth: { printed: "<10^{-19} residuals", evaluated: null, formula: "no (Z,N)↦(p,q) map" },
    thad:  noThadField, nassim: noNassimField,
    gate: { metric: "relative", passIf: "relative≤1e-6" },
    auditStatus: "blocked", g2aIndependent: true, datasetIds: [AME],
  }),
  cx({
    claimId: "FND-011-HBAR", programId: "EARTH-FND-011", kernelId: "planckTwistAudit",
    observable: "ħ", unit: "J s",
    sm:    sm(CODATA_HBAR, null, "CODATA / SI", "2022"),
    earth: { printed: CODATA_HBAR, evaluated: HBAR_TWIST, formula: "ħ=δχ ξ₀ (m_p c/3)/(2π), δχ=1/√(3φ^2)" },
    thad:  identityPredictionSlot(CODATA_HBAR, "l_P m_P=ħ/c"),
    nassim: missingPredictionSlot("ħ is an input to r_p=4ħ/(m_p c), not derived"),
    gate: { metric: "relative", passIf: "relative≤1e-8" },
    auditStatus: "falsified", g2aIndependent: false, datasetIds: [CODATA],
    discrepancy: "twist ħ=1.42384e-36 J s = 0.01350 ħ (−98.65%). Printed δχ=0.15 vs 1/√(3φ^2)=0.356822.",
  }),
  cx({
    claimId: "GRV-001-G", programId: "EARTH-GRV-001", kernelId: "gravityFormulaAudit",
    observable: "G", unit: "m^3 kg^{-1} s^{-2}",
    sm:    sm(6.67430e-11, 0.00015e-11, "CODATA", "2022"),
    earth: { printed: G_QG, evaluated: G_COUPLING, formula: "φ^{-72} ξ₀^4 c^4/ħ  and  G_strong×(3/2)^3×α^{18}" },
    thad:  reproPredictionSlot(6.67430e-11, "288 recipe 50 Newtonian G (CODATA repro)"),
    nassim: { value: null, formula: "2020 G blocked-source (abstract-only PDF); M_S=Lc^2/(2G) is an identity in G", status: "blocked" },
    gate: { metric: "relative", passIf: "relative≤1e-8" },
    auditStatus: "falsified", g2aIndependent: true, datasetIds: [CODATA],
    discrepancy: "two unequal EARTH formulas: 3.479e-11 and 6.3408e-11; neither is CODATA. Nassim 2020 G blocked.",
  }),
  cx({
    claimId: "FLD-005-VAR", programId: "EARTH-FLD-005", kernelId: "stochasticDiffusion",
    observable: "variance vs FDT", unit: "1",
    sm:    sm(null, null, "Langevin+FDT", "textbook"),
    earth: { printed: "⟨(Δθ)^2⟩=2kTνt/(μ ξ^3)", evaluated: "λ₀=44.492 ≠ λ̃₀=(4π)^3", formula: "ν=λ₀√5; μ=λ̃₀ ρ/(ρ_nuc ξ₀^3)" },
    thad:  noThadField, nassim: noNassimField,
    gate: { metric: "relative", passIf: "relative≤1e-6" },
    auditStatus: "blocked", g2aIndependent: true, datasetIds: [],
    discrepancy: "EARTH coefficients unlocked; software comparator remains testable vs analytic FDT",
  }),
  cx({
    claimId: "FLD-006-TC", programId: "EARTH-FLD-006", kernelId: "decoherenceScalingSweep",
    observable: "t_c scaling", unit: "1",
    sm:    sm(null, null, "Caldeira–Leggett", "textbook"),
    earth: { printed: "t_c∝ρ^{-1/3}/T", evaluated: null, formula: "cannot score until μ,ν independent" },
    thad:  noThadField, nassim: noNassimField,
    gate: { metric: "relative", passIf: "relative≤1e-6" },
    auditStatus: "blocked", g2aIndependent: true, datasetIds: [],
  }),
  cx({
    claimId: "FLD-007-FLOQ", programId: "EARTH-FLD-007", kernelId: "floquetBenchmark",
    observable: "surgery barrier", unit: "1",
    sm:    sm(null, null, "unitary 2-level Floquet", "textbook"),
    earth: { printed: "NP surgery barrier", evaluated: null, formula: "no observable map" },
    thad:  noThadField, nassim: noNassimField,
    gate: { metric: "relative", passIf: "relative≤1e-6" },
    auditStatus: "blocked", g2aIndependent: true, datasetIds: [],
  }),
  cx({
    claimId: "FLD-008-SG", programId: "EARTH-FLD-008", kernelId: "sineGordonBenchmark",
    observable: "wall potential", unit: "1",
    sm:    sm(null, null, "sine-Gordon ½(∂θ)^2-(1-cosθ)", "textbook"),
    earth: { printed: "sine-Gordon", evaluated: "(1-cosθ)^2", formula: "-(λ̃₀/4ξ₀^2)(1-cosθ)^2" },
    thad:  noThadField, nassim: noNassimField,
    gate: { metric: "exact", passIf: "exact" },
    auditStatus: "falsified", g2aIndependent: true, datasetIds: [],
    discrepancy: "(1-cosθ)^2 ≠ sine-Gordon; software residual vs analytic SG stays testable",
  }),
];

export interface CxKernelRegression {
  programId: string;
  kernelId: string;
  observable: string;
  printed: EarthPredictionScalar;
  evaluated: EarthPredictionScalar;
  sm: EarthPredictionScalar;
  status: "falsified" | "internally inconsistent";
  note: string;
}

export const CX_KERNEL_REGRESSIONS: readonly CxKernelRegression[] = Object.freeze([
  {
    programId: "EARTH-FND-001", kernelId: "canonicalConstantAudit", observable: "δχ",
    printed: 0.15, evaluated: TWIST, sm: null, status: "falsified",
    note: "1/√(3φ^2)=0.356822, not 0.15; used by FND-011-HBAR",
  },
  {
    programId: "EARTH-FND-001", kernelId: "canonicalConstantAudit", observable: "(4π)^3",
    printed: 1973.9208802178713, evaluated: LAMBDA_LIT, sm: null, status: "internally inconsistent",
    note: "literal (4π)^3=1984.4017; toolkit also prints λ̃₀=44.492 (NUC-004-MP)",
  },
  {
    programId: "EARTH-FND-003", kernelId: "piAlphaAudit", observable: "π",
    printed: Math.PI, evaluated: Math.sqrt(6) * GOLDEN_RATIO ** -2, sm: Math.PI, status: "falsified",
    note: "√6 φ^{-2}=0.935622 and √(30-6√5)/2=2.03615 are not π",
  },
  {
    programId: "EARTH-FND-004", kernelId: "substitutionAudit", observable: "substitution growth",
    printed: GOLDEN_RATIO, evaluated: 2, sm: 2, status: "falsified",
    note: "uniform 1→12,2→13,3→21 has Perron root 2, not φ",
  },
  {
    programId: "EARTH-FND-010", kernelId: "couplingAudit", observable: "Γ(r)",
    printed: 14.778, evaluated: GOLDEN_RATIO ** 6, sm: CODATA_ALPHA, status: "internally inconsistent",
    note: "three printed forms disagree; at r=ξ₀: 17.944 vs 321.997 vs table 14.778; none gives 1/137",
  },
  {
    programId: "EARTH-FLD-001", kernelId: "derrickScalingAudit", observable: "π₃(S¹)",
    printed: "Hopf Q=1", evaluated: 0, sm: 0, status: "falsified",
    note: "published scalar vacuum is S¹; π₃(S¹)=0; Derrick collapse",
  },
  {
    programId: "EARTH-CHEM-004", kernelId: "sphericalCoordination", observable: "tetrahedral angle",
    printed: 109.47122063449069, evaluated: 2 * Math.asin(1 / GOLDEN_RATIO) * 180 / Math.PI, sm: Math.acos(-1 / 3) * 180 / Math.PI,
    status: "falsified",
    note: "2 asin(φ^{-1})=76.345°; 109.471° is the SM arccos(-1/3) value",
  },
]);

export const CX_LEDGER: EarthPredictionLedger = buildEarthPredictionLedger({
  simulationId:     "earth-cx-ledger",
  scientificStatus: "audit",
  predictions:      rows,
  referenceDatasetIds: [CODATA, PDG, AME, KNOT],
  blockers: [
    "NUC-002-AME: no (Z,N)↦(p,q) map; AME/NUBASE 0 acquired bytes",
    "FLD-006/007: no independent μ,ν or surgery-energy map",
    "Nassim 2020 G: abstract-only PDF, blocked-source",
    "19 registered datasets, 0 bytes acquired, 0 G0b passes",
  ],
  findings: [
    { claimId: "NUC-004-RP", text: "Four r_p hypotheses: EARTH 0.15/0.8414 falsified; Nassim 0.8412356402 fm (+0.76σ); Thad 0.8434316144 fm (+4.19σ); SM 0.84075(64) fm." },
    { claimId: null, text: "Nassim force at 2.6 r_p claimed 48.4 N vs audit 23.818 N (falsified). Crossing is 2.406 r_p at 56.287 N." },
    { claimId: null, text: "288 Thad recipes are calibration/repro. Extras kept: r_p Catalan, α=zhe_1^2, e=zhe_1 q_P, m_W/m_Z=log(1+√2), sin^2θ_W=0.22318060001 on-shell." },
    { claimId: null, text: "Identity/calibration, never prediction: Thad Planck products; Thad proton recipe; Nassim M_S=Lc^2/(2G); Nassim m_e from a_0,α; EARTH L∝n^{-1/3}." },
    { claimId: "PRT-001-PHI18", text: "Do not reopen as predictions: PRT-001 φ^18/α/a_0/m_e/R_∞; PRT-005 Q≠w for d,e; μ/e=φ^6; |V_us|=φ^{-2}; G_F units; NUC-001 maps; NUC-004 ξ₀ and EARTH r_p/m_p; ħ twist; G two formulas; Hopf on S¹; T(3,1); growth 2≠φ; Haramein 2.6 r_p force." },
  ],
});

export function cxLedgerRow(claimId: CxClaimId): EarthPredictionRow {
  const row = CX_LEDGER.predictions.find((entry) => entry.claimId === claimId);
  if (!row) throw new RangeError(`Unknown CX claimId: ${claimId}`);
  return row;
}
