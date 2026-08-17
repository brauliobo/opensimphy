import { CODATA_2022_GRAVITATIONAL_CONSTANT_M3_PER_KG_S2, SPEED_OF_LIGHT_M_PER_S } from "../../../simphy/constants.js";
import {
  DEFAULT_PROTON_FORMULA_AUDIT_INPUTS,
  EARTH_GOLDEN_RATIO,
  EARTH_HBAR_C_MEV_FM,
  protonFormulaAudit,
  type ProtonFormulaAuditInputs,
} from "../audits.js";
import { checkCancelled, positiveNumber, relativeError, type EarthRunOptions } from "../common.js";
import {
  buildEarthPredictionLedger,
  buildEarthPredictionRow,
  identityPredictionSlot,
  missingPredictionSlot,
  reproPredictionSlot,
  type EarthPredictionLedger,
  type EarthPredictionRow,
} from "./ledger.js";

export interface ProtonMassRadiusChiInputs extends ProtonFormulaAuditInputs {
  gravitationalConstant?: number;
  protonMassKg?: number;
  speedOfLight?: number;
}

export const DEFAULT_PROTON_MASS_RADIUS_CHI_INPUTS: ProtonMassRadiusChiInputs = {
  ...DEFAULT_PROTON_FORMULA_AUDIT_INPUTS,
  gravitationalConstant: CODATA_2022_GRAVITATIONAL_CONSTANT_M3_PER_KG_S2,
  protonMassKg:          1.672_621_925_95e-27,
  speedOfLight:          SPEED_OF_LIGHT_M_PER_S,
};

export const CODATA_PROTON_RADIUS_FM = 0.84075;
export const CODATA_PROTON_RADIUS_UNC_FM = 0.00064;
export const CODATA_PROTON_MASS_MEV = 938.27208816;
export const THAD_PROTON_RADIUS_FM = 0.8434316144;
export const THAD_PROTON_MASS_MEV = 938.272087;
export const NASSIM_PROTON_RADIUS_FM = 0.8412356402;
export const NASSIM_PROTON_ENERGY_MEV = 938.0888;
export const NASSIM_CHI = 2.953e-39;
export const NASSIM_SCHWARZSCHILD_MASS_KG = 5.664e11;

const PROGRAM_ID = "EARTH-NUC-004";
const KERNEL_ID = "proton-mass-radius-chi";
const CODATA_ID = "earth-dataset-codata-recommended-values";
const LAMBDA_ALGEBRAIC = (4 * Math.PI) ** 3;
const MODEL_SUMMARY = "Four ways to name the proton's size and mass. Shared coordinates are a change of units, not a shared theory.";
const MISSING_THAD_XI = missingPredictionSlot("Physics Monastery ξ₀ (ROBERTS-013/014 have no tube core)");
const MISSING_NASSIM_XI = missingPredictionSlot("Haramein ξ₀ (r_p=4ħ/(m_p c) is not a tube core)");
const MISSING_THAD_CHI = missingPredictionSlot("Physics Monastery χ operator (ROBERTS spectrum has no compactness)");
const MISSING_THAD_MS = missingPredictionSlot("Physics Monastery Schwarzschild M_S (none; 288 recipes are not M_S)");

function sigmaResidual(value: number, center: number, uncertainty: number): number {
  return Math.abs(value - center) / uncertainty;
}

function compactness(massKg: number, radiusM: number, G: number, c: number): number {
  return 2 * G * massKg / (radiusM * c ** 2);
}

function schwarzschildMass(radiusM: number, G: number, c: number): number {
  return radiusM * c ** 2 / (2 * G);
}

function row(input: Parameters<typeof buildEarthPredictionRow>[0]): EarthPredictionRow {
  return buildEarthPredictionRow({
    ...input,
    modelSummary:  MODEL_SUMMARY,
    plainLanguage: MODEL_SUMMARY,
  });
}

export function protonMassRadiusChi(
  inputs: ProtonMassRadiusChiInputs = DEFAULT_PROTON_MASS_RADIUS_CHI_INPUTS,
  options: EarthRunOptions = {},
) {
  checkCancelled(options);
  const audit = protonFormulaAudit(inputs);
  const xi0Fm = positiveNumber(inputs.xi0Fm ?? 0.15, "xi0Fm");
  const printedRadiusFm = positiveNumber(inputs.protonChargeRadiusFm ?? 0.8414, "protonChargeRadiusFm");
  const smRadiusFm = positiveNumber(inputs.canonicalProtonChargeRadiusFm ?? CODATA_PROTON_RADIUS_FM, "canonicalProtonChargeRadiusFm");
  const smMassMeV = positiveNumber(inputs.canonicalProtonEnergyMeV ?? CODATA_PROTON_MASS_MEV, "canonicalProtonEnergyMeV");
  const hbarCMeVFm = positiveNumber(inputs.hbarCMeVFm ?? EARTH_HBAR_C_MEV_FM, "hbarCMeVFm");
  const G = positiveNumber(inputs.gravitationalConstant ?? CODATA_2022_GRAVITATIONAL_CONSTANT_M3_PER_KG_S2, "gravitationalConstant");
  const protonMassKg = positiveNumber(inputs.protonMassKg ?? 1.672_621_925_95e-27, "protonMassKg");
  const c = positiveNumber(inputs.speedOfLight ?? SPEED_OF_LIGHT_M_PER_S, "speedOfLight");
  const lambdaPrinted = positiveNumber(inputs.lambdaClaims?.[0]?.value ?? 44.492, "lambdaPrinted");
  const fiveTubeFm = 5 * xi0Fm * EARTH_GOLDEN_RATIO ** -2;
  const tubeFm = xi0Fm * EARTH_GOLDEN_RATIO ** -2;
  const xiFromPrintedRadiusFm = printedRadiusFm * Math.sqrt(10 / 3);
  const inverseLengthFm = Math.PI ** 2 * Math.sqrt(lambdaPrinted) / xi0Fm;
  const earthMassMeV = inverseLengthFm * hbarCMeVFm;
  const smChi = compactness(protonMassKg, smRadiusFm * 1e-15, G, c);
  const earthChi = compactness(protonMassKg, xi0Fm * 1e-15, G, c);
  const smMsKg = schwarzschildMass(smRadiusFm * 1e-15, G, c);
  const nassimSigma = sigmaResidual(NASSIM_PROTON_RADIUS_FM, smRadiusFm, CODATA_PROTON_RADIUS_UNC_FM);
  const thadSigma = sigmaResidual(THAD_PROTON_RADIUS_FM, smRadiusFm, CODATA_PROTON_RADIUS_UNC_FM);
  const sm = {
    radius: { value: smRadiusFm, uncertainty: CODATA_PROTON_RADIUS_UNC_FM, source: "CODATA", release: "2022" },
    mass:   { value: smMassMeV, uncertainty: null, source: "CODATA", release: "2022" },
    chi:    { value: smChi, uncertainty: null, source: "CODATA χ=2Gm_p/(r_p c²)", release: "2022" },
    ms:     { value: smMsKg, uncertainty: null, source: "CODATA Schwarzschild identity M_S=r_p c²/(2G)", release: "2022" },
  } as const;

  const predictions = [
    row({
      claimId:        "NUC-004-XI",
      programId:      PROGRAM_ID,
      kernelId:       KERNEL_ID,
      observable:     "xi0",
      unit:           "fm",
      sm:             { value: null, uncertainty: null, source: "CODATA has no ξ₀; r_p is the measured length", release: "2022" },
      earth:          { printed: 0.15, evaluated: xiFromPrintedRadiusFm, formula: "ξ₀=r_p √(10/3)" },
      thad:           MISSING_THAD_XI,
      nassim:         MISSING_NASSIM_XI,
      gate:           { metric: "relative", passIf: "<=1e-6" },
      auditStatus:    "falsified",
      g2aIndependent: false,
      datasetIds:     [CODATA_ID],
      discrepancy:    "calibration-circular: ξ₀=r_p√(10/3) recomputes 1.536 fm, not 0.15 fm",
    }),
    row({
      claimId:        "NUC-004-RP",
      programId:      PROGRAM_ID,
      kernelId:       KERNEL_ID,
      observable:     "r_p",
      unit:           "fm",
      sm:             sm.radius,
      earth:          { printed: 0.8414, evaluated: fiveTubeFm, formula: "5 ξ₀ φ^{-2}" },
      thad:           { value: THAD_PROTON_RADIUS_FM, formula: "ROBERTS-014 Catalan chain r_e (π/6)²/K", status: "prediction" },
      nassim:         { value: NASSIM_PROTON_RADIUS_FM, formula: "r_p=4ħ/(m_p c)", status: "prediction" },
      gate:           { metric: "sigma", passIf: "<=3σ" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      datasetIds:     [CODATA_ID],
      discrepancy:    `EARTH 5ξ₀φ^{-2} and ξ₀=0.15 fm fail; Nassim +${nassimSigma.toFixed(2)}σ testable ansatz; Thad +${thadSigma.toFixed(2)}σ supplement`,
    }),
    row({
      claimId:        "NUC-004-MP",
      programId:      PROGRAM_ID,
      kernelId:       KERNEL_ID,
      observable:     "m_p",
      unit:           "MeV",
      sm:             sm.mass,
      earth:          { printed: 938.272, evaluated: earthMassMeV, formula: "m_p=π² √λ̃₀ / ξ₀" },
      thad:           reproPredictionSlot(THAD_PROTON_MASS_MEV, "ROBERTS-013 GeV/c²×0.9382896 × 0.9999820 root; recipe 53 repro"),
      nassim:         { value: NASSIM_PROTON_ENERGY_MEV, formula: "E_p=4ħc/r_p at 0.8414 fm", status: "calibration" },
      gate:           { metric: "relative", passIf: "<=1e-6" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      datasetIds:     [CODATA_ID],
      discrepancy:    "EARTH π²√λ̃₀/ξ₀ is not CODATA m_p; Thad 288 recipe is repro; Nassim E_p uses r=0.8414 fm",
    }),
    row({
      claimId:        "NUC-004-CHI",
      programId:      PROGRAM_ID,
      kernelId:       KERNEL_ID,
      observable:     "chi",
      unit:           "1",
      sm:             sm.chi,
      earth:          { printed: earthChi, evaluated: earthChi, formula: "χ=2Gm_p/(ξ₀ c²)" },
      thad:           MISSING_THAD_CHI,
      nassim:         identityPredictionSlot(NASSIM_CHI, "χ=α_g/2 after r_p=4ħ/(m_p c)"),
      gate:           { metric: "relative", passIf: "<=1e-6" },
      auditStatus:    "falsified",
      g2aIndependent: true,
      datasetIds:     [CODATA_ID],
      discrepancy:    "Nassim χ=α_g/2 is identity after the radius ansatz, not a derived screening",
    }),
    row({
      claimId:        "NUC-004-MS",
      programId:      PROGRAM_ID,
      kernelId:       KERNEL_ID,
      observable:     "M_S",
      unit:           "kg",
      sm:             sm.ms,
      earth:          { printed: null, evaluated: null, formula: "no independent EARTH M_S; Schwarzschild is not an EARTH derivation" },
      thad:           MISSING_THAD_MS,
      nassim:         identityPredictionSlot(NASSIM_SCHWARZSCHILD_MASS_KG, "M_S=r_p c²/(2G) Schwarzschild identity"),
      gate:           { metric: "relative", passIf: "<=1e-6" },
      auditStatus:    "identity",
      g2aIndependent: false,
      datasetIds:     [CODATA_ID],
      discrepancy:    "identity-not-prediction: M_S≈5.664e11 kg is Schwarzschild, not a mass derivation",
    }),
  ];

  const predictionLedger: EarthPredictionLedger = buildEarthPredictionLedger({
    simulationId:        "proton-mass-radius-chi",
    predictions,
    scientificStatus:    "audit",
    referenceDatasetIds: [CODATA_ID],
    blockers:            [],
    findings: [
      { claimId: "NUC-004-XI", text: "calibration-circular: ξ₀=r_p√(10/3) evaluates to 1.536 fm, not printed 0.15 fm" },
      { claimId: "NUC-004-RP", text: "EARTH r_p routes (ξ₀=0.15 fm and 5ξ₀φ^{-2}) are falsified; do not repair" },
      { claimId: "NUC-004-RP", text: `Nassim r_p=4ħ/(m_p c)=0.8412356402 fm is a testable ansatz (+${nassimSigma.toFixed(2)}σ)` },
      { claimId: "NUC-004-RP", text: `Thad ROBERTS-014 Catalan r_p=0.8434316144 fm is a competing hypothesis (+${thadSigma.toFixed(2)}σ)` },
      { claimId: "NUC-004-MP", text: "EARTH m_p=π²√λ̃₀/ξ₀ stays falsified; λ̃₀=44.492 vs (4π)³ is arithmetic-cx" },
      { claimId: "NUC-004-MP", text: "Thad ROBERTS-013 / recipe 53 is repro (EG already has 0.9382896 GeV), not a mass derivation" },
      { claimId: "NUC-004-MS", text: "Nassim M_S≈5.664e11 kg is Schwarzschild identity, not a prediction" },
    ],
  });

  return {
    method: "Four-program proton mass/radius/χ ledger; EARTH formulas unrepaired",
    diagnostics: {
      ...audit.diagnostics,
      provenance: "reproduction",
      validatesEarthTheory: false,
      nassimRadiusAnsatz: true,
      thadMassIsRepro: true,
      schwarzschildMassIsIdentity: true,
    },
    predictionLedger,
    output: {
      ...audit.output,
      schemaVersion:        predictionLedger.schemaVersion,
      simulationId:         predictionLedger.simulationId,
      scientificStatus:     predictionLedger.scientificStatus,
      validatesEarthTheory: false as const,
      predictions:          predictionLedger.predictions,
      residuals:            predictionLedger.residuals,
      blockers:             predictionLedger.blockers,
      referenceDatasetIds:  predictionLedger.referenceDatasetIds,
      modelSummary:         MODEL_SUMMARY,
      radiusHypotheses: {
        earthXi0Fm:     xi0Fm,
        earthTubeFm:    tubeFm,
        earthFiveTubeFm: fiveTubeFm,
        thadCatalanFm:  THAD_PROTON_RADIUS_FM,
        nassimAnsatzFm: NASSIM_PROTON_RADIUS_FM,
        smCodataFm:     smRadiusFm,
      },
      sigma: { nassim: nassimSigma, thad: thadSigma },
      lambda: {
        printed:          lambdaPrinted,
        algebraic:        LAMBDA_ALGEBRAIC,
        relativeResidual: relativeError(lambdaPrinted, LAMBDA_ALGEBRAIC),
        flag:             "arithmetic-cx",
      },
      nassim: {
        radiusFm:           NASSIM_PROTON_RADIUS_FM,
        energyMeV:          NASSIM_PROTON_ENERGY_MEV,
        chi:                NASSIM_CHI,
        schwarzschildMassKg: NASSIM_SCHWARZSCHILD_MASS_KG,
        era2010RadiusFm:    null,
      },
      thad: {
        radiusFm: THAD_PROTON_RADIUS_FM,
        massMeV:  THAD_PROTON_MASS_MEV,
        recipe53: "repro",
      },
      hardGates: { hopfSector: false, substitutionGrowth: 2, torus31: "unknot" as const },
      flags: [
        "calibration-circular",
        "arithmetic-cx",
        "identity-not-prediction",
        "nassim-radius-ansatz",
      ],
    },
  };
}

export type ProtonMassRadiusChiOutput = ReturnType<typeof protonMassRadiusChi>["output"];
