import {
  DEFAULT_NUCLEAR_PAIR_ENUMERATION_INPUTS,
  nuclearPairEnumerationAudit,
  type EarthLiteralFinding,
  type NuclearPairEnumerationInputs,
} from "../audits.js";
import {
  boundedInteger,
  checkCancelled,
  positiveNumber,
  relativeError,
  type EarthRunOptions,
} from "../common.js";
import {
  buildEarthPredictionLedger,
  buildEarthPredictionRow,
  missingPredictionSlot,
  type EarthPredictionLedger,
  type EarthPredictionRow,
} from "./ledger.js";

export interface NuclearPqEnergyInputs extends NuclearPairEnumerationInputs {
  xi0Fm?: number;
  lambdaPrinted?: number;
  hbarCMeVFm?: number;
}

export const DEFAULT_NUCLEAR_PQ_ENERGY_INPUTS: NuclearPqEnergyInputs = {
  ...DEFAULT_NUCLEAR_PAIR_ENUMERATION_INPUTS,
  xi0Fm:         0.15,
  lambdaPrinted: 44.492,
  hbarCMeVFm:    197.326_971_8,
};

const PROGRAM_ID = "EARTH-NUC-001";
const LAMBDA_ALGEBRAIC = (4 * Math.PI) ** 3;
const KIND_CODE = { unknot: 0, knot: 1, link: 2 } as const;
const KNOTINFO_ID = "earth-dataset-knotinfo";
const PDG_ID = "earth-dataset-review-of-particle-physics-pdg-api";
const AME_ID = "earth-dataset-ame2020-and-nubase2020";
const MISSING_THAD = missingPredictionSlot("Physics Monastery (p,q) knot table (none; CODATA light-nuclei masses are not a nuclide map)");
const MISSING_NASSIM = missingPredictionSlot("Haramein torus-knot nuclide map (spherical PSU is not a knot)");
const PLAIN = "This is a knot-label table, not a nuclear mass model. Several printed knots are not the knots they claim.";

const PRINTED_NUCLIDES = [
  { claimId: "NUC-001-P",  label: "1H",  pdgLabel: "1H",  p: 3, q: 1, claimedA: 1,  claimedZ: 1, claimedKind: "knot" as const, smA: 1,  smZ: 1, printedEnergyFmInv: 3851.946_666_666_666_5 },
  { claimId: "NUC-001-HE", label: "4He", pdgLabel: "4He", p: 3, q: 3, claimedA: 4,  claimedZ: 2, claimedKind: "knot" as const, smA: 4,  smZ: 2, printedEnergyFmInv: null },
  { claimId: "NUC-001-C",  label: "12C", pdgLabel: "12C", p: 5, q: 5, claimedA: 12, claimedZ: 6, claimedKind: "knot" as const, smA: 12, smZ: 6, printedEnergyFmInv: null },
] as const;

type TorusKind = keyof typeof KIND_CODE;

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function torusKind(p: number, q: number): TorusKind {
  return p === 1 || q === 1 ? "unknot" : gcd(p, q) === 1 ? "knot" : "link";
}

function energyMetric(p: number, q: number): number {
  return p ** 2 + q ** 2 + p * q;
}

function energyFmInv(p: number, q: number, lambda: number, xi0Fm: number): number {
  return lambda * energyMetric(p, q) / xi0Fm;
}

function finding(id: string, category: EarthLiteralFinding["category"], message: string, residual: number | null): EarthLiteralFinding {
  return { id, status: "failure", category, message, relativeResidual: residual };
}

function topologyRow(row: {
  claimId: string;
  pdgLabel: string;
  p: number;
  q: number;
  claimedKind: TorusKind;
  standardKind: TorusKind;
  smA: number;
  smZ: number;
}): EarthPredictionRow {
  return buildEarthPredictionRow({
    claimId:   row.claimId,
    programId: PROGRAM_ID,
    kernelId:  "nuclear-pq-energy",
    observable: `${row.pdgLabel}-torus-kind`,
    unit:      "1",
    sm: {
      value:       KIND_CODE[row.standardKind],
      uncertainty: 0,
      source:      `standard torus T(${row.p},${row.q})=${row.standardKind}; PDG label ${row.pdgLabel} A=${row.smA} Z=${row.smZ} (not AME mass)`,
      release:     "knot-theory + PDG nuclide label",
    },
    earth: {
      printed:    KIND_CODE[row.claimedKind],
      evaluated:  KIND_CODE[row.standardKind],
      formula:    `E(p,q)=λ̃₀(p²+q²+pq)/ξ₀; A=pq; Z=p-3; claimed T(${row.p},${row.q}) ${row.claimedKind}`,
    },
    thad:           MISSING_THAD,
    nassim:         MISSING_NASSIM,
    gate:           { metric: "exact", passIf: "exact" },
    auditStatus:    "falsified",
    g2aIndependent: true,
    datasetIds:     [KNOTINFO_ID, PDG_ID],
    modelSummary:   "CHEM-1 prime torus-knot nuclide table",
    plainLanguage:  PLAIN,
    discrepancy:    `knot-error: claimed ${row.claimedKind}, standard T(${row.p},${row.q}) is ${row.standardKind}`,
  });
}

export function nuclearPqEnergyAudit(
  inputs: NuclearPqEnergyInputs = DEFAULT_NUCLEAR_PQ_ENERGY_INPUTS,
  options: EarthRunOptions = {},
) {
  checkCancelled(options);
  const enumeration   = nuclearPairEnumerationAudit(inputs);
  const xi0Fm         = positiveNumber(inputs.xi0Fm ?? 0.15, "xi0Fm");
  const lambdaPrinted = positiveNumber(inputs.lambdaPrinted ?? 44.492, "lambdaPrinted");
  const hbarCMeVFm    = positiveNumber(inputs.hbarCMeVFm ?? 197.326_971_8, "hbarCMeVFm");
  const lambdaCx      = relativeError(lambdaPrinted, LAMBDA_ALGEBRAIC);

  const nuclides = PRINTED_NUCLIDES.map((claim) => {
    const p = boundedInteger(claim.p, `${claim.label} p`, 1, 1_000_000);
    const q = boundedInteger(claim.q, `${claim.label} q`, 1, 1_000_000);
    const kind = torusKind(p, q);
    const evaluatedEnergyFmInv = energyFmInv(p, q, lambdaPrinted, xi0Fm);
    return {
      claimId: claim.claimId,
      label: claim.label,
      pdgLabel: claim.pdgLabel,
      p,
      q,
      claimedKind: claim.claimedKind,
      standardKind: kind,
      claimedA: claim.claimedA,
      evaluatedA: p * q,
      smA: claim.smA,
      claimedZ: claim.claimedZ,
      evaluatedZ: p - 3,
      smZ: claim.smZ,
      printedEnergyFmInv: claim.printedEnergyFmInv,
      evaluatedEnergyFmInv,
      algebraicEnergyFmInv: energyFmInv(p, q, LAMBDA_ALGEBRAIC, xi0Fm),
      evaluatedEnergyMeV: evaluatedEnergyFmInv * hbarCMeVFm,
      knotError: kind !== claim.claimedKind,
    };
  });

  const predictions = [
    ...nuclides.map((row) => topologyRow(row)),
    buildEarthPredictionRow({
      claimId:   "NUC-002-AME",
      programId: PROGRAM_ID,
      kernelId:  "nuclear-pq-energy",
      observable: "nuclide-mass",
      unit:      "keV",
      sm:        { value: null, uncertainty: null, source: "AME2020 / NUBASE2020", release: "AME2020" },
      earth:     { printed: null, evaluated: null, formula: "no (Z,N)→(p,q) map; f(A−Z) absent" },
      thad:      MISSING_THAD,
      nassim:    MISSING_NASSIM,
      gate:      { metric: "relative", passIf: "<=1e-19" },
      auditStatus:    "blocked",
      g2aIndependent: false,
      datasetIds:     [AME_ID],
      modelSummary:   "AME nuclide masses",
      plainLanguage:  "AME masses are blocked until a (Z,N)→(p,q) map and frozen dataset bytes exist.",
      discrepancy:    "NUC-002-AME blocked; 0 dataset bytes; no AME residual claimed",
    }),
  ];

  const predictionLedger: EarthPredictionLedger = buildEarthPredictionLedger({
    simulationId:        "nuclear-pq-energy",
    predictions,
    scientificStatus:    "audit",
    referenceDatasetIds: [KNOTINFO_ID, PDG_ID, AME_ID],
    blockers:            ["NUC-002-AME: no (Z,N)→(p,q) map; f(A−Z) absent; AME2020 0 dataset bytes"],
    findings: [
      { claimId: "NUC-001-P", text: "knot-error: T(3,1) is an unknot, not a trefoil" },
      { claimId: "NUC-001-HE", text: "knot-error: T(3,3) is a 3-component link, not a knot" },
      { claimId: "NUC-001-C", text: "knot-error: T(5,5) is a 5-component link, not a knot" },
      { claimId: "NUC-001-P", text: "arithmetic-cx: printed λ̃₀=44.492 vs (4π)³" },
      { claimId: "NUC-002-AME", text: "blocked: no (Z,N)→(p,q) map; AME 0 dataset bytes" },
    ],
  });

  const findings: EarthLiteralFinding[] = [
    ...enumeration.output.findings,
    finding("NUC-001-P-knot", "topology", "knot-error: T(3,1) is an unknot, not a trefoil", 1),
    finding("NUC-001-HE-knot", "topology", "knot-error: T(3,3) is a 3-component link, not a knot", 1),
    finding("NUC-001-C-knot", "topology", "knot-error: T(5,5) is a 5-component link, not a knot", 1),
    finding("NUC-001-lambda", "arithmetic", "arithmetic-cx: printed λ̃₀=44.492 vs (4π)³", lambdaCx),
    finding("NUC-001-P-A", "source-claim", "A=pq evaluates to 3, not PDG ¹H A=1", relativeError(3, 1)),
    finding("NUC-001-P-Z", "source-claim", "Z=p-3 evaluates to 0, not PDG ¹H Z=1", relativeError(0, 1)),
    finding("NUC-002-AME", "source-claim", "NUC-002-AME blocked: no (Z,N)→(p,q) map; AME 0 dataset bytes", null),
  ];

  return {
    method: "Literal CHEM-1 E(p,q), A=pq, Z=p-3 with standard torus class and PDG labels; no AME masses",
    diagnostics: {
      ...enumeration.diagnostics,
      provenance: "reproduction",
      validatesEarthTheory: false,
      datasetBytes: 0,
      ameResidualClaimed: false,
    },
    predictionLedger,
    output: {
      ...enumeration.output,
      findings,
      schemaVersion: predictionLedger.schemaVersion,
      simulationId: predictionLedger.simulationId,
      scientificStatus: predictionLedger.scientificStatus,
      validatesEarthTheory: false as const,
      predictions: predictionLedger.predictions,
      residuals: predictionLedger.residuals,
      blockers: predictionLedger.blockers,
      referenceDatasetIds: predictionLedger.referenceDatasetIds,
      nuclides,
      lambda: {
        printed: lambdaPrinted,
        algebraic: LAMBDA_ALGEBRAIC,
        relativeResidual: lambdaCx,
        flag: "arithmetic-cx",
      },
      hardGates: { hopfSector: false, substitutionGrowth: 2, torus31: "unknot" as const },
      discrepancies: [
        { pair: "earth-printed-vs-eval", residual: 1, relativeResidual: 1, flag: "knot-error" },
        { pair: "lambda-printed-vs-algebraic", residual: lambdaPrinted - LAMBDA_ALGEBRAIC, relativeResidual: lambdaCx, flag: "arithmetic-cx" },
        { pair: "thad-vs-sm", residual: null, relativeResidual: null, flag: "missing-operator" },
        { pair: "nassim-vs-sm", residual: null, relativeResidual: null, flag: "missing-operator" },
      ],
      flags: ["knot-error", "arithmetic-cx", "missing-operator"],
      missing: {
        thad:   { object: "(p,q) knot table", source: "Physics Monastery / 288 Formula Atlas", status: "missing" as const, note: "no nuclide map; light-nuclei CODATA reproductions are not a (p,q) table" },
        nassim: { object: "torus-knot nuclide map", source: "Haramein spherical PSU", status: "missing" as const, note: "spherical PSU is not a knot" },
      },
      ameResidualClaimed: false,
    },
  };
}

export type NuclearPqEnergyOutput = ReturnType<typeof nuclearPqEnergyAudit>["output"];
