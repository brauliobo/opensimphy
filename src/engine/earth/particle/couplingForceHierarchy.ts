import { SPEED_OF_LIGHT_M_PER_S, ELEMENTARY_CHARGE_C, VACUUM_MAGNETIC_PERMEABILITY_H_PER_M, CODATA_2022_GRAVITATIONAL_CONSTANT_M3_PER_KG_S2 } from "../../../simphy/constants.js";
import { checkCancelled, positiveNumber, relativeError, type EarthRunOptions } from "../common.js";
import { CODATA_ALPHA, CODATA_HBAR, GOLDEN_RATIO, couplingAudit } from "../foundations.js";
import {
  CODATA_PROTON_RADIUS_FM,
  NASSIM_PROTON_RADIUS_FM,
  THAD_PROTON_RADIUS_FM,
} from "./protonMassRadiusChi.js";
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

export const COUPLING_FORCE_HIERARCHY_PROGRAM_ID = "EARTH-NUC-004" as const;
export const COUPLING_FORCE_HIERARCHY_METHOD_ID = "coupling-force-hierarchy" as const;
export const COUPLING_FORCE_HIERARCHY_KERNEL_ID = "coupling-force-hierarchy" as const;
export const COUPLING_FORCE_HIERARCHY_CLAIM_IDS = [
  "NUC-004-GAMMA", "NUC-004-ALPHA", "NUC-004-GS", "NUC-004-G", "NUC-004-GF",
  "NUC-004-FS0", "NUC-004-FS", "NUC-004-AS", "NUC-004-IB",
] as const;

export const NASSIM_ALPHA_S = 0.3811;
export const NASSIM_FORCE_CLAIM_N = 48.4;
export const NASSIM_FORCE_AUDIT_N = 23.818;
export const NASSIM_FORCE_CROSSING_RP = 2.406;
export const NASSIM_FORCE_CROSSING_N = 56.287;
export const EARTH_GS2_TABLE = 14.778;
export const EARTH_G_QG = 6.340_806_087_699_862e-11;
export const THAD_G = 6.674_303_155e-11;
export const THAD_GF_GEV = 1.166_378_521_83e-5;
export const THAD_ALPHA = 7.297_352_572_955e-3;
export const SM_G = CODATA_2022_GRAVITATIONAL_CONSTANT_M3_PER_KG_S2;
export const SM_GF_GEV = 1.166_378_7e-5;
export const SM_ALPHA_S_MZ = 0.1180;

export interface CouplingForceHierarchyInputs {
  xi0Fm?: number;
  nassimAlphaS?: number;
  nassimForceClaimN?: number;
  nassimProtonRadiusFm?: number;
}

export const DEFAULT_COUPLING_FORCE_HIERARCHY_INPUTS: CouplingForceHierarchyInputs = {
  xi0Fm:                0.15,
  nassimAlphaS:         NASSIM_ALPHA_S,
  nassimForceClaimN:    NASSIM_FORCE_CLAIM_N,
  nassimProtonRadiusFm: NASSIM_PROTON_RADIUS_FM,
};

const C = SPEED_OF_LIGHT_M_PER_S;
const E = ELEMENTARY_CHARGE_C;
const MU0 = VACUUM_MAGNETIC_PERMEABILITY_H_PER_M;
const XI0_M_DEFAULT = 0.15e-15;
const CODATA_ID = "earth-dataset-codata-recommended-values";
const PDG_ID = "earth-dataset-review-of-particle-physics-pdg-api";
const PLAIN = "Four programs do not share a force law. EARTH forms disagree with each other.";
const MODEL = "Coupling Theorem Γ(r) overlay vs Thad constructors, Nassim F_s, and SM couplings.";
const MISSING_THAD_GAMMA = missingPredictionSlot("Physics Monastery Γ(r) (none; 288 recipes have no tube coupling)");
const MISSING_NASSIM_GAMMA = missingPredictionSlot("Haramein Γ(r) (2010/2023 give F_s, not a φ-power tube law)");
const MISSING_THAD_FORCE = missingPredictionSlot("Physics Monastery F_s(r) (none)");
const MISSING_NASSIM_GF = missingPredictionSlot("Haramein G_F derivation (none)");
const MISSING_NASSIM_IB = missingPredictionSlot("Haramein IB=μ₀/(4π) constructor (none)");
const MISSING_EARTH_IB = { printed: null, evaluated: null, formula: "no EARTH inversion-boundary; Coupling Theorem has no IB" };
const MISSING_EARTH_FORCE = { printed: null, evaluated: null, formula: "Γ(r) is dimensionless; no EARTH force in newtons" };
const K_E = MU0 * C ** 2 / (4 * Math.PI);
const MU0_OVER_4PI = MU0 / (4 * Math.PI);
const ALPHA_SRC = 120 * Math.PI * 3 * GOLDEN_RATIO ** 2;

function coulombN(rM: number): number {
  return K_E * E ** 2 / rM ** 2;
}

function nassimForceN(rM: number, rpM: number, alphaS: number): number {
  const lambdaP = rpM / 4;
  return (CODATA_HBAR * C * alphaS / (2 * rM ** 2)) * (1 + rM / lambdaP) * Math.exp(-(rM - rpM) / lambdaP);
}

function crossingRp(rpM: number, alphaS: number): { rOverRp: number; forceN: number } {
  let lo = 2 * rpM;
  let hi = 3 * rpM;
  for (let step = 0; step < 80; step += 1) {
    const mid = (lo + hi) / 2;
    if (nassimForceN(mid, rpM, alphaS) > coulombN(mid)) lo = mid;
    else hi = mid;
  }
  const rM = (lo + hi) / 2;
  return { rOverRp: rM / rpM, forceN: coulombN(rM) };
}

function gammaForms(rOverXi0: number) {
  const logarithmBasePhi = Math.log(rOverXi0) / Math.log(GOLDEN_RATIO);
  return {
    direct:       GOLDEN_RATIO ** 6 / rOverXi0 ** 6,
    intermediate: GOLDEN_RATIO ** (6 * (2 - 2 * logarithmBasePhi)),
    boxed:        GOLDEN_RATIO ** 12 / rOverXi0 ** 6,
  };
}

function pairwiseConflict(values: readonly number[]): number {
  let maximum = 0;
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      maximum = Math.max(maximum, relativeError(values[left]!, values[right]!));
    }
  }
  return maximum;
}

function row(input: Omit<EarthPredictionRowInput, "programId" | "kernelId" | "datasetIds" | "modelSummary" | "plainLanguage"> & {
  datasetIds?: readonly string[];
}): EarthPredictionRow {
  return buildEarthPredictionRow({
    ...input,
    programId:     COUPLING_FORCE_HIERARCHY_PROGRAM_ID,
    kernelId:      COUPLING_FORCE_HIERARCHY_KERNEL_ID,
    datasetIds:    input.datasetIds ?? [CODATA_ID, PDG_ID],
    modelSummary:  MODEL,
    plainLanguage: PLAIN,
  });
}

export function couplingForceHierarchy(
  inputs: CouplingForceHierarchyInputs = DEFAULT_COUPLING_FORCE_HIERARCHY_INPUTS,
  options: EarthRunOptions = {},
) {
  checkCancelled(options);
  const xi0Fm = positiveNumber(inputs.xi0Fm ?? 0.15, "xi0Fm");
  const xi0M = xi0Fm * 1e-15;
  const alphaS = positiveNumber(inputs.nassimAlphaS ?? NASSIM_ALPHA_S, "nassimAlphaS");
  const claimedForceN = positiveNumber(inputs.nassimForceClaimN ?? NASSIM_FORCE_CLAIM_N, "nassimForceClaimN");
  const rpFm = positiveNumber(inputs.nassimProtonRadiusFm ?? NASSIM_PROTON_RADIUS_FM, "nassimProtonRadiusFm");
  const rpM = rpFm * 1e-15;
  const r26M = 2.6 * rpM;
  const r26OverXi0 = r26M / xi0M;
  const rOverXi0 = [1, GOLDEN_RATIO ** 8, GOLDEN_RATIO ** 10, GOLDEN_RATIO ** 18, GOLDEN_RATIO ** 20, GOLDEN_RATIO ** 62, r26OverXi0];
  const overlay = couplingAudit({ rOverXi0 });
  const atXi0 = gammaForms(1);
  const atPhi10 = gammaForms(GOLDEN_RATIO ** 10);
  const atPhi20 = gammaForms(GOLDEN_RATIO ** 20);
  const conflict = pairwiseConflict([atXi0.direct, atXi0.intermediate, atXi0.boxed]);
  const phi6 = GOLDEN_RATIO ** 6;
  const gCoupling = GOLDEN_RATIO ** -72 * xi0M ** 4 * C ** 4 / CODATA_HBAR;
  const gStrong = C ** 3 * xi0M ** 2 / CODATA_HBAR;
  const gQg = EARTH_G_QG;
  const earthGfSi = GOLDEN_RATIO ** -36 * xi0M ** 2 / (CODATA_HBAR * C);
  const forceXi0N = nassimForceN(xi0M, rpM, alphaS);
  const force26N = nassimForceN(r26M, rpM, alphaS);
  const smXi0N = coulombN(xi0M);
  const sm26N = coulombN(r26M);
  const crossing = crossingRp(rpM, alphaS);
  const gamma26 = gammaForms(r26OverXi0);

  const predictions = [
    row({
      claimId:        "NUC-004-GAMMA",
      observable:     "Gamma(r=xi0)",
      unit:           "1",
      sm:             { value: CODATA_ALPHA, uncertainty: 1.1e-12, source: "CODATA α (q²=0), not a tube Γ", release: "2022" },
      earth:          { printed: EARTH_GS2_TABLE, evaluated: atXi0.boxed, formula: "Γ(r)=φ¹²(ξ₀/r)⁶ vs φ⁶(ξ₀/r)⁶ vs φ^{6(2-2 log_φ(r/ξ₀))}" },
      thad:           MISSING_THAD_GAMMA,
      nassim:         MISSING_NASSIM_GAMMA,
      gate:           { metric: "relative", passIf: "<=1e-6" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      discrepancy:    "source-conflict: at r=ξ₀ the three printed forms are 17.944 vs 321.997 vs table 14.778",
    }),
    row({
      claimId:        "NUC-004-ALPHA",
      observable:     "alpha",
      unit:           "1",
      sm:             { value: CODATA_ALPHA, uncertainty: 1.1e-12, source: "CODATA α", release: "2022" },
      earth:          { printed: 1 / 137.035_999_084, evaluated: atPhi20.boxed, formula: "Γ(ξ₀ φ²⁰)=φ¹²(ξ₀/r)⁶ claimed 1/137; also Γ(ξ₀ φ¹⁰)" },
      thad:           { value: THAD_ALPHA, formula: "α=zhe_1² supplement", status: "prediction" },
      nassim:         MISSING_NASSIM_GAMMA,
      gate:           { metric: "relative", passIf: "<=1e-6" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      discrepancy:    "no 1/137 at φ¹⁰ or φ²⁰; 120π·3·φ² is 2960.93, not 137.036",
    }),
    row({
      claimId:        "NUC-004-GS",
      observable:     "g_s^2",
      unit:           "1",
      sm:             { value: SM_ALPHA_S_MZ, uncertainty: 0.0009, source: "PDG α_s(M_Z)", release: "PDG 2024" },
      earth:          { printed: EARTH_GS2_TABLE, evaluated: phi6, formula: "g_s²≈φ⁶" },
      thad:           MISSING_THAD_GAMMA,
      nassim:         { value: NASSIM_ALPHA_S, formula: "frozen α_s=0.3811 one-loop at 938 MeV; do not retune", status: "falsified" },
      gate:           { metric: "relative", passIf: "<=1e-6" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      discrepancy:    `arithmetic-cx: φ⁶=${phi6} not table 14.778 and not α_s(M_Z)`,
    }),
    row({
      claimId:        "NUC-004-G",
      observable:     "G",
      unit:           "m^3 kg^-1 s^-2",
      sm:             { value: SM_G, uncertainty: 0.000_15e-11, source: "CODATA G", release: "2022" },
      earth:          { printed: gQg, evaluated: gCoupling, formula: "φ^{-72} ξ₀^4 c^4/ħ  and  G_strong×(3/2)^3×α^{18}" },
      thad:           reproPredictionSlot(THAD_G, "recipe 50 Newtonian G"),
      nassim:         { value: null, formula: "Haramein 2020 G blocked-source (abstract-only PDF)", status: "blocked" },
      gate:           { metric: "relative", passIf: "<=1e-8" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      datasetIds:     [CODATA_ID],
      discrepancy:    "two unequal EARTH G formulas; neither is CODATA. Nassim 2020 G blocked-source",
    }),
    row({
      claimId:        "NUC-004-GF",
      observable:     "G_F/(hbar c)^3",
      unit:           "GeV^-2",
      sm:             { value: SM_GF_GEV, uncertainty: 6e-12, source: "CODATA G_F/(ħc)³", release: "2022" },
      earth:          { printed: "φ^{-36} ξ₀^2/ħc", evaluated: earthGfSi, formula: "φ^{-36} ξ₀²/ħc" },
      thad:           reproPredictionSlot(THAD_GF_GEV, "recipe 150 G_F/(ħc)³"),
      nassim:         MISSING_NASSIM_GF,
      gate:           { metric: "relative", passIf: "<=1e-9" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      discrepancy:    "G_F units fail: φ^{-36} ξ₀²/ħc is not GeV^{-2}",
    }),
    row({
      claimId:        "NUC-004-FS0",
      observable:     "F(r=xi0)",
      unit:           "N",
      sm:             { value: smXi0N, uncertainty: null, source: "Coulomb e²/(4πε₀ r²) at r=ξ₀", release: "SI" },
      earth:          MISSING_EARTH_FORCE,
      thad:           MISSING_THAD_FORCE,
      nassim:         { value: forceXi0N, formula: "F_s=−∇φ_g Yukawa screening at r=ξ₀, α_s frozen 0.3811", status: "falsified" },
      gate:           { metric: "relative", passIf: "<=1e-3" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      discrepancy:    "EARTH has no newton force; Nassim/SM overlay at r=ξ₀ is not a shared law",
    }),
    row({
      claimId:        "NUC-004-FS",
      observable:     "F(r=2.6 r_p)",
      unit:           "N",
      sm:             { value: sm26N, uncertainty: null, source: "Coulomb e²/(4πε₀ r²) at 2.6 r_p", release: "SI" },
      earth:          MISSING_EARTH_FORCE,
      thad:           MISSING_THAD_FORCE,
      nassim:         { value: force26N, formula: "F_s=−∇φ_g at 2.6 r_p; claimed 48.4 N", status: "falsified" },
      gate:           { metric: "relative", passIf: "<=1e-3" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      discrepancy:    `Nassim F_s(2.6 r_p) claimed ${claimedForceN} N vs audit ${NASSIM_FORCE_AUDIT_N} N; crossing ${NASSIM_FORCE_CROSSING_RP} r_p at ${NASSIM_FORCE_CROSSING_N} N`,
    }),
    row({
      claimId:        "NUC-004-AS",
      observable:     "alpha_s",
      unit:           "1",
      sm:             { value: SM_ALPHA_S_MZ, uncertainty: 0.0009, source: "PDG α_s(M_Z)", release: "PDG 2024" },
      earth:          { printed: EARTH_GS2_TABLE, evaluated: phi6, formula: "g_s²≈φ⁶ at r≤ξ₀" },
      thad:           MISSING_THAD_GAMMA,
      nassim:         { value: alphaS, formula: "α_s=0.3811 frozen; do not retune", status: "falsified" },
      gate:           { metric: "relative", passIf: "<=1e-6" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      discrepancy:    "Nassim α_s frozen at 0.3811; failure kept. Not PDG α_s(M_Z)",
    }),
    row({
      claimId:        "NUC-004-IB",
      observable:     "IB",
      unit:           "N A^-2",
      sm:             { value: MU0_OVER_4PI, uncertainty: null, source: "μ₀/(4π)", release: "CODATA 2018 μ₀" },
      earth:          MISSING_EARTH_IB,
      thad:           identityPredictionSlot(MU0_OVER_4PI, "IB=μ₀/(4π) identity"),
      nassim:         MISSING_NASSIM_IB,
      gate:           { metric: "relative", passIf: "<=1e-12" },
      auditStatus:    "identity",
      g2aIndependent: false,
      datasetIds:     [CODATA_ID],
      discrepancy:    "Thad IB=μ₀/(4π) is an identity, not a force law",
    }),
  ];

  const predictionLedger: EarthPredictionLedger = buildEarthPredictionLedger({
    simulationId:        COUPLING_FORCE_HIERARCHY_KERNEL_ID,
    predictions,
    scientificStatus:    "audit",
    referenceDatasetIds: [CODATA_ID, PDG_ID],
    blockers:            ["Nassim 2020 G: abstract-only PDF, blocked-source"],
    findings: [
      { claimId: "NUC-004-GAMMA", text: "source-conflict: three printed Γ(r) forms including Γ(r)=φ¹²(ξ₀/r)⁶ disagree" },
      { claimId: "NUC-004-ALPHA", text: "no 1/137 at φ¹⁰/φ²⁰; 120π·3·φ² is not 137" },
      { claimId: "NUC-004-GS", text: "g_s²≈φ⁶ is arithmetic-cx vs table 14.778 and vs PDG α_s" },
      { claimId: "NUC-004-G", text: "G two formulas falsified (GRV-001); Thad recipe 50 is repro; Nassim 2020 G blocked-source" },
      { claimId: "NUC-004-GF", text: "G_F units fail; Thad recipe 150 G_F/(ħc)³ is repro" },
      { claimId: "NUC-004-FS", text: `Nassim F_s(2.6 r_p) claimed ${claimedForceN} N vs audit ${NASSIM_FORCE_AUDIT_N} N; crossing ${NASSIM_FORCE_CROSSING_RP} r_p at ${NASSIM_FORCE_CROSSING_N} N. α_s frozen ${alphaS}` },
    ],
  });

  return {
    method: "Four-program coupling-force hierarchy; EARTH Γ(r) forms unrepaired",
    diagnostics: {
      provenance:           "reproduction",
      validatesEarthTheory: false,
      sourceConflict:       conflict > 32 * Number.EPSILON,
      nassimAlphaSFrozen:   alphaS === NASSIM_ALPHA_S,
      nassimForceFailed:    relativeError(force26N, claimedForceN) > 0.01,
      gTwoFormulasFalsified: relativeError(gCoupling, gQg) > 1e-3,
    },
    predictionLedger,
    predictions,
    output: {
      schemaVersion:        predictionLedger.schemaVersion,
      simulationId:         predictionLedger.simulationId,
      scientificStatus:     predictionLedger.scientificStatus,
      validatesEarthTheory: false as const,
      predictions:          predictionLedger.predictions,
      residuals:            predictionLedger.residuals,
      blockers:             predictionLedger.blockers,
      referenceDatasetIds:  predictionLedger.referenceDatasetIds,
      modelSummary:         MODEL,
      plainLanguage:        PLAIN,
      protonRadiiFm: {
        nassim: NASSIM_PROTON_RADIUS_FM,
        thad:   THAD_PROTON_RADIUS_FM,
        sm:     CODATA_PROTON_RADIUS_FM,
      },
      gamma: {
        sourceConflict: overlay.diagnostics.algebraicallyEquivalent !== true,
        maximumPairwiseRelativeDifference: overlay.diagnostics.maximumPairwiseRelativeDifference,
        atXi0,
        atPhi10,
        atPhi20,
        boxed: "φ¹² (ξ₀/r)⁶",
        points: overlay.output.points,
      },
      earth: {
        gs2Printed:     EARTH_GS2_TABLE,
        gs2Evaluated:   phi6,
        alphaSource:    ALPHA_SRC,
        gCoupling,
        gQg,
        gStrong,
        gfSi:           earthGfSi,
      },
      thad: {
        ib:    MU0_OVER_4PI,
        alpha: THAD_ALPHA,
        gfGev: THAD_GF_GEV,
        g:     THAD_G,
        gamma: null,
      },
      nassim: {
        alphaS,
        claimedForceN,
        auditForceN:     NASSIM_FORCE_AUDIT_N,
        forceAtXi0N:     forceXi0N,
        forceAt26RpN:    force26N,
        crossingROverRp: crossing.rOverRp,
        crossingForceN:  crossing.forceN,
        gamma:           null,
      },
      sm: {
        alpha:      CODATA_ALPHA,
        alphaSMz:   SM_ALPHA_S_MZ,
        gfGev:      SM_GF_GEV,
        g:          SM_G,
        coulombXi0N: smXi0N,
        coulomb26N:  sm26N,
      },
      forceOverlay: [
        { r: "xi0", rFm: xi0Fm, earthGamma: atXi0, nassimN: forceXi0N, smN: smXi0N },
        { r: "2.6 r_p", rFm: 2.6 * rpFm, earthGamma: gamma26, nassimN: force26N, smN: sm26N, claimedN: claimedForceN },
      ],
      flags: [
        "source-conflict",
        "arithmetic-cx",
        "units",
        "blocked-source",
        "identity-not-prediction",
      ],
    },
  };
}

export type CouplingForceHierarchyOutput = ReturnType<typeof couplingForceHierarchy>["output"];
