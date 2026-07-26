import {
  boundedInteger,
  finiteNumber,
  positiveNumber,
  relativeError,
  type EarthKernelResult,
} from "./common.js";
import type { EarthLiteralFinding } from "./audits.js";

const AVOGADRO_CONSTANT = 6.022_140_76e23;
const JOULES_PER_KILOCALORIE = 4_184;
const JOULES_PER_MEV = 1.602_176_634e-13;
const SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;

export interface EarthUnitConversion {
  quantity: string;
  inputValue: number;
  inputUnit: string;
  factor: number;
  outputValue: number;
  outputUnit: string;
}

function reproductionDiagnostics(
  auditId: string,
  evaluatedClaims: number,
  findings: EarthLiteralFinding[],
): Record<string, boolean | number | string | null> {
  return {
    provenance: "reproduction",
    auditId,
    evaluatedClaims,
    failures: findings.length,
    validatesTheory: false,
    validatesBiology: false,
    medicalAdvice: false,
    medicalValidation: false,
  };
}

function boundedPositive(value: number, name: string, minimum: number, maximum: number): number {
  positiveNumber(value, name);
  if (value < minimum || value > maximum) throw new RangeError(`${name} must be from ${minimum} to ${maximum}`);
  return value;
}

function boundedArray<T>(value: T[], name: string, minimum: number, maximum: number): T[] {
  if (value.length < minimum || value.length > maximum) {
    throw new RangeError(`${name} must contain ${minimum} to ${maximum} entries`);
  }
  return value;
}

function boundedText(value: string, name: string, maximumLength = 128): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximumLength) {
    throw new RangeError(`${name} must contain 1 to ${maximumLength} characters`);
  }
  return value;
}

function failure(
  id: string,
  category: EarthLiteralFinding["category"],
  message: string,
  relativeResidual: number | null,
): EarthLiteralFinding {
  return { id, status: "failure", category, message, relativeResidual };
}

function conversion(
  quantity: string,
  inputValue: number,
  inputUnit: string,
  factor: number,
  outputUnit: string,
): EarthUnitConversion {
  return { quantity, inputValue, inputUnit, factor, outputValue: inputValue * factor, outputUnit };
}

export type RnaBase = "A" | "C" | "G" | "U";
export type RnaCodon = `${RnaBase}${RnaBase}${RnaBase}`;
export type GeneticCodeLabel =
  | "Ala" | "Arg" | "Asn" | "Asp" | "Cys" | "Gln" | "Glu" | "Gly" | "His" | "Ile"
  | "Leu" | "Lys" | "Met" | "Phe" | "Pro" | "Ser" | "STOP" | "Thr" | "Trp" | "Tyr" | "Val";

export interface PrintedGeneticCodeKnotEntry {
  codon: RnaCodon;
  linking: number;
  p: number;
  q: number;
  printedEnergyKcalPerMol: number;
  aminoAcid: GeneticCodeLabel;
  forbidden: boolean;
}

export interface GeneticCodeKnotTableAuditInputs {
  entries?: PrintedGeneticCodeKnotEntry[];
  unitEnergyKcalPerMol?: number;
  stopPenaltyKcalPerMol?: number;
  relativeTolerance?: number;
}

type PrintedCodonRow = readonly [RnaCodon, number, number, number, number, GeneticCodeLabel, boolean];

const PRINTED_CODON_ROWS: PrintedCodonRow[] = [
  ["GGG", 1, 3, 1, 7.83, "Gly", false], ["GGA", 2, 3, 1, 7.83, "Gly", false],
  ["GGU", 2, 3, 1, 7.83, "Gly", false], ["GGC", 2, 3, 1, 7.83, "Gly", false],
  ["GAG", 2, 3, 1, 7.83, "Glu", false], ["GAA", 3, 3, 1, 7.83, "Glu", false],
  ["GAU", 3, 3, 1, 7.83, "Asp", false], ["GAC", 3, 3, 1, 7.83, "Asp", false],
  ["GCG", 2, 3, 1, 7.83, "Ala", false], ["GCA", 3, 3, 1, 7.83, "Ala", false],
  ["GCU", 3, 3, 1, 7.83, "Ala", false], ["GCC", 3, 3, 1, 7.83, "Ala", false],
  ["GUG", 2, 3, 1, 7.83, "Val", false], ["GUA", 3, 3, 1, 7.83, "Val", false],
  ["GUU", 3, 3, 1, 7.83, "Val", false], ["GUC", 3, 3, 1, 7.83, "Val", false],
  ["AGG", 3, 3, 1, 7.83, "Arg", false], ["AGA", 4, 3, 1, 7.83, "Arg", false],
  ["AGU", 4, 3, 1, 7.83, "Ser", false], ["AGC", 4, 3, 1, 7.83, "Ser", false],
  ["AAG", 4, 3, 1, 7.83, "Lys", false], ["AAA", 5, 5, 1, 15.66, "Lys", false],
  ["AAU", 5, 5, 1, 15.66, "Asn", false], ["AAC", 5, 5, 1, 15.66, "Asn", false],
  ["AUG", 4, 3, 1, 7.83, "Met", false], ["AUA", 5, 5, 1, 15.66, "Ile", false],
  ["AUU", 5, 5, 1, 15.66, "Ile", false], ["AUC", 5, 5, 1, 15.66, "Ile", false],
  ["ACG", 4, 3, 1, 7.83, "Thr", false], ["ACA", 5, 5, 1, 15.66, "Thr", false],
  ["ACU", 5, 5, 1, 15.66, "Thr", false], ["ACC", 5, 5, 1, 15.66, "Thr", false],
  ["UGG", 4, 3, 1, 7.83, "Trp", false], ["UGA", 6, 3, 2, 69.47, "STOP", true],
  ["UGU", 4, 3, 1, 7.83, "Cys", false], ["UGC", 4, 3, 1, 7.83, "Cys", false],
  ["UAG", 6, 3, 2, 69.47, "STOP", true], ["UAA", 6, 3, 2, 69.47, "STOP", true],
  ["UAU", 5, 5, 1, 15.66, "Tyr", false], ["UAC", 5, 5, 1, 15.66, "Tyr", false],
  ["UUG", 4, 3, 1, 7.83, "Leu", false], ["UUA", 5, 5, 1, 15.66, "Leu", false],
  ["UUU", 5, 5, 1, 15.66, "Phe", false], ["UUC", 5, 5, 1, 15.66, "Phe", false],
  ["UCG", 4, 3, 1, 7.83, "Ser", false], ["UCA", 5, 5, 1, 15.66, "Ser", false],
  ["UCU", 5, 5, 1, 15.66, "Ser", false], ["UCC", 5, 5, 1, 15.66, "Ser", false],
  ["CGG", 3, 3, 1, 7.83, "Arg", false], ["CGA", 4, 3, 1, 7.83, "Arg", false],
  ["CGU", 3, 3, 1, 7.83, "Arg", false], ["CGC", 3, 3, 1, 7.83, "Arg", false],
  ["CAG", 3, 3, 1, 7.83, "Gln", false], ["CAA", 4, 3, 1, 7.83, "Gln", false],
  ["CAU", 4, 3, 1, 7.83, "His", false], ["CAC", 4, 3, 1, 7.83, "His", false],
  ["CCG", 3, 3, 1, 7.83, "Pro", false], ["CCA", 4, 3, 1, 7.83, "Pro", false],
  ["CCU", 4, 3, 1, 7.83, "Pro", false], ["CCC", 4, 3, 1, 7.83, "Pro", false],
  ["CUG", 3, 3, 1, 7.83, "Leu", false], ["CUA", 4, 3, 1, 7.83, "Leu", false],
  ["CUU", 4, 3, 1, 7.83, "Leu", false], ["CUC", 4, 3, 1, 7.83, "Leu", false],
];

export const DEFAULT_GENETIC_CODE_KNOT_TABLE_AUDIT_INPUTS: GeneticCodeKnotTableAuditInputs = {
  entries: PRINTED_CODON_ROWS.map(([codon, linking, p, q, printedEnergyKcalPerMol, aminoAcid, forbidden]) => ({
    codon,
    linking,
    p,
    q,
    printedEnergyKcalPerMol,
    aminoAcid,
    forbidden,
  })),
  unitEnergyKcalPerMol: 0.6023,
  stopPenaltyKcalPerMol: 2.61,
  relativeTolerance: 1e-3,
};

export interface GeneticCodeKnotTableAuditOutput {
  scope: "printed-table-only";
  entries: Array<PrintedGeneticCodeKnotEntry & {
    metric: number;
    formulaEnergyKcalPerMol: number;
    arithmeticResidual: number;
    arithmeticMatches: boolean;
    sourceRuleAllowsPair: boolean;
    standardTorusKind: "unknot" | "torus-knot";
  }>;
  coverage: { rows: number; uniqueCodons: number; completeStandardCodonSet: boolean };
  generativeMapping: { status: "blocked"; predictiveGenerator: false; reason: string };
  unitConversions: EarthUnitConversion[];
  findings: EarthLiteralFinding[];
}

export function geneticCodeKnotTableAudit(
  inputs: GeneticCodeKnotTableAuditInputs = DEFAULT_GENETIC_CODE_KNOT_TABLE_AUDIT_INPUTS,
): EarthKernelResult<GeneticCodeKnotTableAuditOutput> {
  const entries = boundedArray(inputs.entries ?? DEFAULT_GENETIC_CODE_KNOT_TABLE_AUDIT_INPUTS.entries!, "entries", 1, 64);
  const unitEnergy = boundedPositive(inputs.unitEnergyKcalPerMol ?? 0.6023, "unitEnergyKcalPerMol", 1e-9, 1e6);
  const stopPenalty = boundedPositive(inputs.stopPenaltyKcalPerMol ?? 2.61, "stopPenaltyKcalPerMol", 1e-9, 1e6);
  const tolerance = boundedPositive(inputs.relativeTolerance ?? 1e-3, "relativeTolerance", 1e-12, 0.1);
  const seenCodons = new Set<string>();
  const auditedEntries = entries.map((entry, index) => {
    const codon = boundedText(entry.codon, `entries[${index}].codon`, 3);
    if (!/^[ACGU]{3}$/.test(codon)) throw new RangeError(`entries[${index}].codon must be an RNA codon`);
    if (seenCodons.has(codon)) throw new RangeError(`entries contains duplicate codon ${codon}`);
    seenCodons.add(codon);
    const p = boundedInteger(entry.p, `entries[${index}].p`, 1, 99);
    const q = boundedInteger(entry.q, `entries[${index}].q`, 1, 99);
    const linking = boundedInteger(entry.linking, `entries[${index}].linking`, 0, 128);
    const printedEnergyKcalPerMol = boundedPositive(entry.printedEnergyKcalPerMol, `entries[${index}].printedEnergyKcalPerMol`, 1e-9, 1e6);
    boundedText(entry.aminoAcid, `entries[${index}].aminoAcid`, 8);
    const metric = p ** 2 + q ** 2 + p * q;
    const formulaEnergyKcalPerMol = unitEnergy * metric + (entry.forbidden ? stopPenalty : 0);
    const arithmeticResidual = relativeError(formulaEnergyKcalPerMol, printedEnergyKcalPerMol);
    return {
      ...entry,
      codon: codon as RnaCodon,
      p,
      q,
      linking,
      printedEnergyKcalPerMol,
      metric,
      formulaEnergyKcalPerMol,
      arithmeticResidual,
      arithmeticMatches: arithmeticResidual <= tolerance,
      sourceRuleAllowsPair: p % 2 === 1 && q % 2 === 1 && p <= q + 2,
      standardTorusKind: (p === 1 || q === 1 ? "unknot" : "torus-knot") as "unknot" | "torus-knot",
    };
  });

  const findings: EarthLiteralFinding[] = [];
  const failedEnergyGroups = new Map<string, typeof auditedEntries>();
  for (const entry of auditedEntries) {
    if (!entry.arithmeticMatches) {
      const key = `${entry.p},${entry.q},${entry.printedEnergyKcalPerMol}`;
      const group = failedEnergyGroups.get(key) ?? [];
      group.push(entry);
      failedEnergyGroups.set(key, group);
    }
  }
  for (const [key, group] of failedEnergyGroups) {
    findings.push(failure(
      `printed-energy-${key}`,
      "arithmetic",
      `${group.length} printed codon row(s) with knot/energy ${key} do not satisfy E=0.6023(p^2+q^2+pq) plus the printed stop penalty`,
      group[0]!.arithmeticResidual,
    ));
  }
  if (auditedEntries.some(({ sourceRuleAllowsPair }) => !sourceRuleAllowsPair)) findings.push(failure(
    "printed-table-violates-pair-rules",
    "topology",
    "The printed (3,2) rows violate the both-odd rule, while (5,1) violates the printed p <= q + 2 rule",
    null,
  ));
  if (auditedEntries.some(({ standardTorusKind, forbidden }) => standardTorusKind === "unknot" && !forbidden)) findings.push(failure(
    "printed-prime-knot-labels",
    "topology",
    "The printed (3,1) and (5,1) labels are unknots under standard torus-knot conventions",
    null,
  ));

  const aminoAcidEnergies = new Map<GeneticCodeLabel, Set<number>>();
  const energyLabels = new Map<number, Set<GeneticCodeLabel>>();
  for (const entry of auditedEntries) {
    const energies = aminoAcidEnergies.get(entry.aminoAcid) ?? new Set<number>();
    energies.add(entry.printedEnergyKcalPerMol);
    aminoAcidEnergies.set(entry.aminoAcid, energies);
    const labels = energyLabels.get(entry.printedEnergyKcalPerMol) ?? new Set<GeneticCodeLabel>();
    labels.add(entry.aminoAcid);
    energyLabels.set(entry.printedEnergyKcalPerMol, labels);
  }
  const splitDegeneracies = [...aminoAcidEnergies].filter(([, energies]) => energies.size > 1).map(([label]) => label);
  if (splitDegeneracies.length > 0) findings.push(failure(
    "synonymous-codons-split-across-energies",
    "sequence",
    `Synonymous codons for ${splitDegeneracies.join(", ")} have different printed knot energies`,
    null,
  ));
  const ambiguousEnergies = [...energyLabels].filter(([, labels]) => labels.size > 1).map(([energy]) => energy);
  if (ambiguousEnergies.length > 0) findings.push(failure(
    "same-energy-multiple-amino-acids",
    "sequence",
    `Printed energies ${ambiguousEnergies.join(", ")} each map to multiple amino-acid labels`,
    null,
  ));

  const allCodons = ["A", "C", "G", "U"].flatMap((first) =>
    ["A", "C", "G", "U"].flatMap((second) => ["A", "C", "G", "U"].map((third) => `${first}${second}${third}`)));
  const completeStandardCodonSet = allCodons.every((codon) => seenCodons.has(codon));
  if (!completeStandardCodonSet) findings.push(failure(
    "incomplete-printed-codon-coverage",
    "sequence",
    "The supplied printed table does not contain each of the 64 RNA codons exactly once",
    null,
  ));
  findings.push(failure(
    "incomplete-codon-to-knot-mapping",
    "dependency",
    "The source supplies a printed lookup table but no deterministic rule that generates knot, chirality, or variant-code assignments from an arbitrary codon",
    null,
  ));

  const mevToKcalPerMol = conversion(
    "one MeV per molecule",
    1,
    "MeV/molecule",
    JOULES_PER_MEV * AVOGADRO_CONSTANT / JOULES_PER_KILOCALORIE,
    "kcal/mol",
  );
  const sourceScaledMev = (938.27 / 13) / (3.8e-10 / 0.15e-15);
  const scaledEnergy = conversion(
    "source nuclear-to-biological unit energy",
    sourceScaledMev,
    "MeV/molecule",
    mevToKcalPerMol.factor,
    "kcal/mol",
  );
  findings.push(failure(
    "source-chemical-unit-scaling",
    "arithmetic",
    "The explicit nuclear-to-biological scaling and MeV conversion yield hundreds of kcal/mol, not the printed 0.657 or unexplained 0.6023 unit energy",
    relativeError(scaledEnergy.outputValue, 0.6023),
  ));

  return {
    method: "Bounded Float64 audit of the literal 64-row genetic-code/knot table; no predictive mapping generator",
    diagnostics: reproductionDiagnostics("EARTH-BIO-001", auditedEntries.length, findings),
    output: {
      scope: "printed-table-only",
      entries: auditedEntries,
      coverage: { rows: auditedEntries.length, uniqueCodons: seenCodons.size, completeStandardCodonSet },
      generativeMapping: {
        status: "blocked",
        predictiveGenerator: false,
        reason: "No complete deterministic codon-to-knot/chiral-flip rule is present in the source claims",
      },
      unitConversions: [mevToKcalPerMol, scaledEnergy],
      findings,
    },
  };
}

export interface MetabolismFidelityLifespanAuditInputs {
  deltaChi?: number;
  fidelityChecks?: number;
  claimedErrorRate?: number;
  speedMPerS?: number;
  cellLengthM?: number;
  cellCount?: number;
  surgeryEnergyKcalPerMol?: number;
  claimedBasalPowerW?: number;
  cumulativeAttemptThreshold?: number;
  surgeriesPerSecond?: number;
  claimedLifespanYears?: number;
  relativeTolerance?: number;
}

export const DEFAULT_METABOLISM_FIDELITY_LIFESPAN_AUDIT_INPUTS: MetabolismFidelityLifespanAuditInputs = {
  deltaChi: 0.15,
  fidelityChecks: 18,
  claimedErrorRate: 1e-9,
  speedMPerS: 2.998e8,
  cellLengthM: 1e-5,
  cellCount: 3.7e13,
  surgeryEnergyKcalPerMol: 7.83,
  claimedBasalPowerW: 100,
  cumulativeAttemptThreshold: 1e9,
  surgeriesPerSecond: 20,
  claimedLifespanYears: 120,
  relativeTolerance: 1e-3,
};

interface AuditedBiologicalRates {
  fidelity: { formula: "errorRate=deltaChi^checks"; reproducedErrorRate: number; claimedErrorRate: number; relativeResidual: number };
  metabolism: { frequencyHzPerCell: number; energyJPerSurgery: number; reproducedPowerW: number; claimedPowerW: number; relativeResidual: number };
  lifespan: { thresholdSeconds: number; reproducedYears: number; claimedYears: number; relativeResidual: number };
  unitConversions: EarthUnitConversion[];
}

function evaluateBiologicalRates(inputs: MetabolismFidelityLifespanAuditInputs): AuditedBiologicalRates {
  const deltaChi = boundedPositive(inputs.deltaChi ?? 0.15, "deltaChi", 1e-6, 1);
  const fidelityChecks = boundedInteger(inputs.fidelityChecks ?? 18, "fidelityChecks", 1, 128);
  const claimedErrorRate = boundedPositive(inputs.claimedErrorRate ?? 1e-9, "claimedErrorRate", 1e-30, 1);
  const speedMPerS = boundedPositive(inputs.speedMPerS ?? 2.998e8, "speedMPerS", 1, 3.1e8);
  const cellLengthM = boundedPositive(inputs.cellLengthM ?? 1e-5, "cellLengthM", 1e-12, 1);
  const cellCount = boundedPositive(inputs.cellCount ?? 3.7e13, "cellCount", 1, 1e18);
  const surgeryEnergyKcalPerMol = boundedPositive(inputs.surgeryEnergyKcalPerMol ?? 7.83, "surgeryEnergyKcalPerMol", 1e-12, 1e6);
  const claimedPowerW = boundedPositive(inputs.claimedBasalPowerW ?? 100, "claimedBasalPowerW", 1e-12, 1e12);
  const cumulativeAttemptThreshold = boundedPositive(inputs.cumulativeAttemptThreshold ?? 1e9, "cumulativeAttemptThreshold", 1, 1e20);
  const surgeriesPerSecond = boundedPositive(inputs.surgeriesPerSecond ?? 20, "surgeriesPerSecond", 1e-12, 1e12);
  const claimedYears = boundedPositive(inputs.claimedLifespanYears ?? 120, "claimedLifespanYears", 1e-9, 1e9);
  boundedPositive(inputs.relativeTolerance ?? 1e-3, "relativeTolerance", 1e-12, 0.1);

  const reproducedErrorRate = deltaChi ** fidelityChecks;
  const frequencyHzPerCell = 3 * speedMPerS * deltaChi ** 2 / (2 * Math.PI * cellLengthM);
  const energyConversion = conversion(
    "surgery energy",
    surgeryEnergyKcalPerMol,
    "kcal/mol",
    JOULES_PER_KILOCALORIE / AVOGADRO_CONSTANT,
    "J/surgery",
  );
  const reproducedPowerW = frequencyHzPerCell * cellCount * energyConversion.outputValue;
  const thresholdSeconds = cumulativeAttemptThreshold / surgeriesPerSecond;
  const lifespanConversion = conversion("attempt-threshold time", thresholdSeconds, "s", 1 / SECONDS_PER_YEAR, "years");
  return {
    fidelity: {
      formula: "errorRate=deltaChi^checks",
      reproducedErrorRate,
      claimedErrorRate,
      relativeResidual: relativeError(reproducedErrorRate, claimedErrorRate),
    },
    metabolism: {
      frequencyHzPerCell,
      energyJPerSurgery: energyConversion.outputValue,
      reproducedPowerW,
      claimedPowerW,
      relativeResidual: relativeError(reproducedPowerW, claimedPowerW),
    },
    lifespan: {
      thresholdSeconds,
      reproducedYears: lifespanConversion.outputValue,
      claimedYears,
      relativeResidual: relativeError(lifespanConversion.outputValue, claimedYears),
    },
    unitConversions: [energyConversion, lifespanConversion],
  };
}

export interface MetabolismFidelityLifespanAuditOutput extends AuditedBiologicalRates {
  scope: "literal-formulas";
  findings: EarthLiteralFinding[];
}

export function metabolismFidelityLifespanAudit(
  inputs: MetabolismFidelityLifespanAuditInputs = DEFAULT_METABOLISM_FIDELITY_LIFESPAN_AUDIT_INPUTS,
): EarthKernelResult<MetabolismFidelityLifespanAuditOutput> {
  const rates = evaluateBiologicalRates(inputs);
  const tolerance = inputs.relativeTolerance ?? 1e-3;
  const findings: EarthLiteralFinding[] = [];
  if (rates.fidelity.relativeResidual > tolerance) findings.push(failure(
    "fidelity-error-rate",
    "arithmetic",
    "deltaChi^18 does not reproduce the printed one-error-per-billion value",
    rates.fidelity.relativeResidual,
  ));
  if (rates.metabolism.relativeResidual > tolerance) findings.push(failure(
    "metabolic-power",
    "arithmetic",
    "The printed frequency, per-surgery energy, and cell count do not reproduce 100 W",
    rates.metabolism.relativeResidual,
  ));
  if (rates.lifespan.relativeResidual > tolerance) findings.push(failure(
    "lifespan-threshold",
    "arithmetic",
    "A threshold of 1e9 attempts at 20 attempts/s does not reproduce 120 years",
    rates.lifespan.relativeResidual,
  ));
  findings.push(failure(
    "lifespan-organism-scale-factor",
    "dependency",
    "The source does not specify the organism-scale factor needed to turn a per-strand attempt threshold into a lifespan",
    null,
  ));
  return {
    method: "Bounded Float64 evaluation of printed fidelity, metabolism, and lifespan formulas",
    diagnostics: reproductionDiagnostics("EARTH-BIO-007", 3, findings),
    output: { scope: "literal-formulas", ...rates, findings },
  };
}

export interface TranslationSplicingArithmeticAuditInputs {
  unitEnergyKcalPerMol?: number;
  peptideMetric?: number;
  claimedPeptideEnergyKcalPerMol?: number;
  speedMPerS?: number;
  proteinSpacingAngstrom?: number;
  deltaChi?: number;
  claimedTranslationRatePerS?: number;
  chiralFlipPenaltyKcalPerMol?: number;
  splicingFlips?: number;
  claimedSplicingEnergyKcalPerMol?: number;
  atpHydrolysisKcalPerMol?: number;
  relativeTolerance?: number;
}

export const DEFAULT_TRANSLATION_SPLICING_ARITHMETIC_AUDIT_INPUTS: TranslationSplicingArithmeticAuditInputs = {
  unitEnergyKcalPerMol: 0.6023,
  peptideMetric: 13,
  claimedPeptideEnergyKcalPerMol: -7.83,
  speedMPerS: 2.998e8,
  proteinSpacingAngstrom: 3.8,
  deltaChi: 0.15,
  claimedTranslationRatePerS: 20,
  chiralFlipPenaltyKcalPerMol: 2.61,
  splicingFlips: 2,
  claimedSplicingEnergyKcalPerMol: 5.22,
  atpHydrolysisKcalPerMol: 7.3,
  relativeTolerance: 1e-3,
};

export interface TranslationSplicingArithmeticAuditOutput {
  scope: "literal-energy-rate-arithmetic";
  peptideBond: { reproducedKcalPerMol: number; claimedKcalPerMol: number; energyJPerBond: number; relativeResidual: number };
  translation: { baseFrequencyHz: number; suppressedFrequencyHz: number; claimedRatePerS: number; relativeResidual: number };
  splicing: { reproducedKcalPerMol: number; claimedKcalPerMol: number; atpEquivalent: number; relativeResidual: number };
  unitConversions: EarthUnitConversion[];
  findings: EarthLiteralFinding[];
}

export function translationSplicingArithmeticAudit(
  inputs: TranslationSplicingArithmeticAuditInputs = DEFAULT_TRANSLATION_SPLICING_ARITHMETIC_AUDIT_INPUTS,
): EarthKernelResult<TranslationSplicingArithmeticAuditOutput> {
  const unitEnergy = boundedPositive(inputs.unitEnergyKcalPerMol ?? 0.6023, "unitEnergyKcalPerMol", 1e-12, 1e6);
  const peptideMetric = boundedInteger(inputs.peptideMetric ?? 13, "peptideMetric", 1, 1_000_000);
  const claimedPeptideEnergy = finiteNumber(inputs.claimedPeptideEnergyKcalPerMol ?? -7.83, "claimedPeptideEnergyKcalPerMol");
  if (claimedPeptideEnergy >= 0) throw new RangeError("claimedPeptideEnergyKcalPerMol must be negative");
  const speed = boundedPositive(inputs.speedMPerS ?? 2.998e8, "speedMPerS", 1, 3.1e8);
  const spacingAngstrom = boundedPositive(inputs.proteinSpacingAngstrom ?? 3.8, "proteinSpacingAngstrom", 1e-6, 1e9);
  const deltaChi = boundedPositive(inputs.deltaChi ?? 0.15, "deltaChi", 1e-6, 1);
  const claimedRate = boundedPositive(inputs.claimedTranslationRatePerS ?? 20, "claimedTranslationRatePerS", 1e-12, 1e12);
  const flipPenalty = boundedPositive(inputs.chiralFlipPenaltyKcalPerMol ?? 2.61, "chiralFlipPenaltyKcalPerMol", 1e-12, 1e6);
  const splicingFlips = boundedInteger(inputs.splicingFlips ?? 2, "splicingFlips", 1, 128);
  const claimedSplicingEnergy = boundedPositive(inputs.claimedSplicingEnergyKcalPerMol ?? 5.22, "claimedSplicingEnergyKcalPerMol", 1e-12, 1e6);
  const atpHydrolysis = boundedPositive(inputs.atpHydrolysisKcalPerMol ?? 7.3, "atpHydrolysisKcalPerMol", 1e-12, 1e6);
  const tolerance = boundedPositive(inputs.relativeTolerance ?? 1e-3, "relativeTolerance", 1e-12, 0.1);

  const lengthConversion = conversion("protein spacing", spacingAngstrom, "angstrom", 1e-10, "m");
  const reproducedPeptideEnergy = -unitEnergy * peptideMetric;
  const peptideConversion = conversion(
    "peptide-bond energy magnitude",
    Math.abs(reproducedPeptideEnergy),
    "kcal/mol",
    JOULES_PER_KILOCALORIE / AVOGADRO_CONSTANT,
    "J/bond",
  );
  const baseFrequencyHz = 3 * speed / (2 * Math.PI * lengthConversion.outputValue);
  const suppressedFrequencyHz = baseFrequencyHz * deltaChi ** 2;
  const reproducedSplicingEnergy = splicingFlips * flipPenalty;
  const peptideResidual = relativeError(reproducedPeptideEnergy, claimedPeptideEnergy);
  const rateResidual = relativeError(suppressedFrequencyHz, claimedRate);
  const splicingResidual = relativeError(reproducedSplicingEnergy, claimedSplicingEnergy);
  const findings: EarthLiteralFinding[] = [];
  if (peptideResidual > tolerance) findings.push(failure("peptide-bond-energy", "arithmetic", "The peptide-bond formula does not reproduce its printed energy", peptideResidual));
  if (rateResidual > tolerance) findings.push(failure(
    "translation-rate",
    "arithmetic",
    "Multiplying the printed strand-flip frequency by deltaChi^2 still gives a petahertz rate, not 20 amino acids/s",
    rateResidual,
  ));
  if (splicingResidual > tolerance) findings.push(failure("splicing-energy", "arithmetic", "The chiral-flip count does not reproduce the printed splicing energy", splicingResidual));
  findings.push(failure(
    "translation-rate-suppression",
    "dependency",
    "No further dimensionless suppression or biochemical rate law is supplied to connect the printed oscillation frequency to translation rate",
    null,
  ));
  return {
    method: "Bounded Float64 audit of printed translation/splicing energies and strand-flip rate",
    diagnostics: reproductionDiagnostics("EARTH-BIO-008", 3, findings),
    output: {
      scope: "literal-energy-rate-arithmetic",
      peptideBond: {
        reproducedKcalPerMol: reproducedPeptideEnergy,
        claimedKcalPerMol: claimedPeptideEnergy,
        energyJPerBond: peptideConversion.outputValue,
        relativeResidual: peptideResidual,
      },
      translation: { baseFrequencyHz, suppressedFrequencyHz, claimedRatePerS: claimedRate, relativeResidual: rateResidual },
      splicing: {
        reproducedKcalPerMol: reproducedSplicingEnergy,
        claimedKcalPerMol: claimedSplicingEnergy,
        atpEquivalent: reproducedSplicingEnergy / atpHydrolysis,
        relativeResidual: splicingResidual,
      },
      unitConversions: [lengthConversion, peptideConversion],
      findings,
    },
  };
}

export interface LivingStateArithmeticAuditInputs extends MetabolismFidelityLifespanAuditInputs {
  bodyMassKg?: number;
  protonMassKg?: number;
  claimedQ?: number;
  bodyDensityKgPerM3?: number;
  nuclearBaryonDensityPerM3?: number;
  xi0Fm?: number;
  phi?: number;
  shellCount?: number;
  claimedBodySizeM?: number;
  minimumViableQ?: number;
}

export const DEFAULT_LIVING_STATE_ARITHMETIC_AUDIT_INPUTS: LivingStateArithmeticAuditInputs = {
  ...DEFAULT_METABOLISM_FIDELITY_LIFESPAN_AUDIT_INPUTS,
  bodyMassKg: 70,
  protonMassKg: 1.673e-27,
  claimedQ: 3.7e37,
  bodyDensityKgPerM3: 1_000,
  nuclearBaryonDensityPerM3: 1.7e44,
  xi0Fm: 0.15,
  phi: 1.618,
  shellCount: 54,
  claimedBodySizeM: 1.9,
  minimumViableQ: 4.8e6,
};

export interface LivingStateArithmeticAuditOutput {
  scope: "literal-living-state-arithmetic";
  q: { reproduced: number; claimed: number; relativeResidual: number };
  bodyDensity: { baryonsPerM3: number; coherenceLengthM: number };
  bodySize: { shellCount: number; reproducedM: number; claimedM: number; relativeResidual: number };
  minimumViableQ: { printedTrefoils: number; equivalentMassKg: number; derivationSpecified: false };
  mutation: AuditedBiologicalRates["fidelity"];
  metabolism: AuditedBiologicalRates["metabolism"];
  lifespan: AuditedBiologicalRates["lifespan"];
  unitConversions: EarthUnitConversion[];
  findings: EarthLiteralFinding[];
}

export function livingStateArithmeticAudit(
  inputs: LivingStateArithmeticAuditInputs = DEFAULT_LIVING_STATE_ARITHMETIC_AUDIT_INPUTS,
): EarthKernelResult<LivingStateArithmeticAuditOutput> {
  const rates = evaluateBiologicalRates(inputs);
  const bodyMass = boundedPositive(inputs.bodyMassKg ?? 70, "bodyMassKg", 1e-21, 1e9);
  const protonMass = boundedPositive(inputs.protonMassKg ?? 1.673e-27, "protonMassKg", 1e-30, 1e-24);
  const claimedQ = boundedPositive(inputs.claimedQ ?? 3.7e37, "claimedQ", 1, 1e50);
  const bodyDensity = boundedPositive(inputs.bodyDensityKgPerM3 ?? 1_000, "bodyDensityKgPerM3", 1e-9, 1e9);
  const nuclearDensity = boundedPositive(inputs.nuclearBaryonDensityPerM3 ?? 1.7e44, "nuclearBaryonDensityPerM3", 1e20, 1e50);
  const xi0Fm = boundedPositive(inputs.xi0Fm ?? 0.15, "xi0Fm", 1e-9, 1e9);
  const phi = boundedPositive(inputs.phi ?? 1.618, "phi", 1.000_001, 10);
  const shellCount = boundedInteger(inputs.shellCount ?? 54, "shellCount", 0, 256);
  const claimedBodySize = boundedPositive(inputs.claimedBodySizeM ?? 1.9, "claimedBodySizeM", 1e-12, 1e9);
  const minimumViableQ = boundedPositive(inputs.minimumViableQ ?? 4.8e6, "minimumViableQ", 1, 1e50);
  const tolerance = inputs.relativeTolerance ?? 1e-3;

  const reproducedQ = bodyMass / protonMass;
  const qResidual = relativeError(reproducedQ, claimedQ);
  const baryonsPerM3 = bodyDensity / protonMass;
  const xiConversion = conversion("nuclear coherence length", xi0Fm, "fm", 1e-15, "m");
  const coherenceLengthM = xiConversion.outputValue * (nuclearDensity / baryonsPerM3) ** (1 / 3);
  const reproducedBodySizeM = coherenceLengthM * phi ** shellCount;
  const bodySizeResidual = relativeError(reproducedBodySizeM, claimedBodySize);
  const findings: EarthLiteralFinding[] = [];
  if (qResidual > tolerance) findings.push(failure(
    "human-topological-charge",
    "arithmetic",
    "70 kg divided by the printed proton mass is about 4.2e28, not 3.7e37",
    qResidual,
  ));
  if (bodySizeResidual > tolerance) findings.push(failure("body-shell-size", "arithmetic", "The printed shell count does not exactly reproduce the claimed body size", bodySizeResidual));
  if (rates.fidelity.relativeResidual > tolerance) findings.push(failure("living-state-mutation-rate", "arithmetic", "deltaChi^18 does not reproduce 1e-9", rates.fidelity.relativeResidual));
  if (rates.metabolism.relativeResidual > tolerance) findings.push(failure("living-state-metabolic-power", "arithmetic", "The printed per-cell rate and energy do not reproduce 100 W", rates.metabolism.relativeResidual));
  if (rates.lifespan.relativeResidual > tolerance) findings.push(failure("living-state-lifespan", "arithmetic", "The printed attempt threshold and rate do not reproduce 120 years", rates.lifespan.relativeResidual));
  findings.push(failure(
    "minimum-viable-q-derivation",
    "dependency",
    "The printed minimum viable Q is asserted from a genome scale without a conversion from genome size or cell mass to proton count",
    null,
  ));
  return {
    method: "Bounded Float64 evaluation of printed living-state Q, size, mutation, metabolism, and lifespan arithmetic",
    diagnostics: reproductionDiagnostics("EARTH-BIO-009", 6, findings),
    output: {
      scope: "literal-living-state-arithmetic",
      q: { reproduced: reproducedQ, claimed: claimedQ, relativeResidual: qResidual },
      bodyDensity: { baryonsPerM3, coherenceLengthM },
      bodySize: { shellCount, reproducedM: reproducedBodySizeM, claimedM: claimedBodySize, relativeResidual: bodySizeResidual },
      minimumViableQ: { printedTrefoils: minimumViableQ, equivalentMassKg: minimumViableQ * protonMass, derivationSpecified: false },
      mutation: rates.fidelity,
      metabolism: rates.metabolism,
      lifespan: rates.lifespan,
      unitConversions: [xiConversion, ...rates.unitConversions],
      findings,
    },
  };
}

export interface AxonActionPotentialArithmeticAuditInputs {
  xi0Fm?: number;
  nuclearDensityPerM3?: number;
  myelinDensityPerM3?: number;
  phi?: number;
  lambda0?: number;
  speedMPerS?: number;
  deltaChi?: number;
  claimedInnerDiameterUm?: number;
  claimedLambda?: number;
  claimedWidthNm?: number;
  claimedUnloadedVelocityMPerS?: number;
  claimedSaltatoryVelocityMPerS?: number;
  nodeMultiplierMinimum?: number;
  nodeMultiplierMaximum?: number;
  claimedAbsoluteRefractoryMs?: number;
  claimedRelativeRefractoryMs?: number;
  claimedPeakMv?: number;
  claimedAfterHyperpolarizationMv?: number;
  claimedRestEnergyJ?: number;
  claimedRestEnergyMeV?: number;
  claimedSpikeEnergyJ?: number;
  atpEnergyJ?: number;
  claimedAtpPerSpike?: number;
  relativeTolerance?: number;
}

export const DEFAULT_AXON_ACTION_POTENTIAL_ARITHMETIC_AUDIT_INPUTS: AxonActionPotentialArithmeticAuditInputs = {
  xi0Fm: 0.15,
  nuclearDensityPerM3: 1.7e44,
  myelinDensityPerM3: 0.95e30,
  phi: 1.618,
  lambda0: 44.49,
  speedMPerS: 2.998e8,
  deltaChi: 0.15,
  claimedInnerDiameterUm: 1.139,
  claimedLambda: 3.43e32,
  claimedWidthNm: 11.4,
  claimedUnloadedVelocityMPerS: 108.7,
  claimedSaltatoryVelocityMPerS: 284.6,
  nodeMultiplierMinimum: 413,
  nodeMultiplierMaximum: 826,
  claimedAbsoluteRefractoryMs: 1.5,
  claimedRelativeRefractoryMs: 2.43,
  claimedPeakMv: 105,
  claimedAfterHyperpolarizationMv: -17,
  claimedRestEnergyJ: 1.65e-16,
  claimedRestEnergyMeV: 1.03,
  claimedSpikeEnergyJ: 3.3e-17,
  atpEnergyJ: 5.1e-20,
  claimedAtpPerSpike: 667,
  relativeTolerance: 1e-3,
};

export interface AxonActionPotentialArithmeticAuditOutput {
  scope: "literal-axon-action-potential-arithmetic";
  coherence: { reproducedM: number; printedM: number; relativeResidual: number };
  diameter: { reproducedM: number; claimedM: number; relativeResidual: number };
  stiffness: { reproduced: number; claimed: number; relativeResidual: number };
  width: { fromPrintedStiffnessM: number; fromPrintedProjectionM: number; claimedM: number };
  velocity: { unloadedClaimedMPerS: number; formulaComplete: false; saltatoryReproducedMPerS: number; saltatoryClaimedMPerS: number };
  nodes: { elementaryM: number; intervalMinimumM: number; intervalMaximumM: number };
  refractory: { formulaSeconds: number; claimedAbsoluteSeconds: number; relativeReproducedSeconds: number; claimedRelativeSeconds: number };
  voltage: { rawPeakExpressionMPerS: number; rawAfterHyperpolarizationExpressionMPerS: number; voltageConversionSpecified: false; claimedPeakMv: number; claimedAfterHyperpolarizationMv: number };
  energy: { restJ: number; restMeVClaimed: number; restJAsMeV: number; spikeJ: number; atpPerSpike: number; claimedAtpPerSpike: number };
  unitConversions: EarthUnitConversion[];
  findings: EarthLiteralFinding[];
}

export function axonActionPotentialArithmeticAudit(
  inputs: AxonActionPotentialArithmeticAuditInputs = DEFAULT_AXON_ACTION_POTENTIAL_ARITHMETIC_AUDIT_INPUTS,
): EarthKernelResult<AxonActionPotentialArithmeticAuditOutput> {
  const xi0Fm = boundedPositive(inputs.xi0Fm ?? 0.15, "xi0Fm", 1e-9, 1e9);
  const nuclearDensity = boundedPositive(inputs.nuclearDensityPerM3 ?? 1.7e44, "nuclearDensityPerM3", 1e20, 1e50);
  const myelinDensity = boundedPositive(inputs.myelinDensityPerM3 ?? 0.95e30, "myelinDensityPerM3", 1e10, 1e40);
  const phi = boundedPositive(inputs.phi ?? 1.618, "phi", 1.000_001, 10);
  const lambda0 = boundedPositive(inputs.lambda0 ?? 44.49, "lambda0", 1e-12, 1e12);
  const speed = boundedPositive(inputs.speedMPerS ?? 2.998e8, "speedMPerS", 1, 3.1e8);
  const deltaChi = boundedPositive(inputs.deltaChi ?? 0.15, "deltaChi", 1e-6, 1);
  const claimedDiameterUm = boundedPositive(inputs.claimedInnerDiameterUm ?? 1.139, "claimedInnerDiameterUm", 1e-9, 1e9);
  const claimedLambda = boundedPositive(inputs.claimedLambda ?? 3.43e32, "claimedLambda", 1e-30, 1e100);
  const claimedWidthNm = boundedPositive(inputs.claimedWidthNm ?? 11.4, "claimedWidthNm", 1e-9, 1e12);
  const unloadedVelocity = boundedPositive(inputs.claimedUnloadedVelocityMPerS ?? 108.7, "claimedUnloadedVelocityMPerS", 1e-9, 3.1e8);
  const claimedSaltatoryVelocity = boundedPositive(inputs.claimedSaltatoryVelocityMPerS ?? 284.6, "claimedSaltatoryVelocityMPerS", 1e-9, 3.1e8);
  const nodeMinimum = boundedInteger(inputs.nodeMultiplierMinimum ?? 413, "nodeMultiplierMinimum", 1, 1_000_000);
  const nodeMaximum = boundedInteger(inputs.nodeMultiplierMaximum ?? 826, "nodeMultiplierMaximum", nodeMinimum, 1_000_000);
  const absoluteMs = boundedPositive(inputs.claimedAbsoluteRefractoryMs ?? 1.5, "claimedAbsoluteRefractoryMs", 1e-12, 1e12);
  const relativeMs = boundedPositive(inputs.claimedRelativeRefractoryMs ?? 2.43, "claimedRelativeRefractoryMs", 1e-12, 1e12);
  const claimedPeakMv = finiteNumber(inputs.claimedPeakMv ?? 105, "claimedPeakMv");
  const claimedAhpMv = finiteNumber(inputs.claimedAfterHyperpolarizationMv ?? -17, "claimedAfterHyperpolarizationMv");
  const restEnergyJ = boundedPositive(inputs.claimedRestEnergyJ ?? 1.65e-16, "claimedRestEnergyJ", 1e-30, 1e6);
  const restEnergyMeV = boundedPositive(inputs.claimedRestEnergyMeV ?? 1.03, "claimedRestEnergyMeV", 1e-30, 1e30);
  const spikeEnergyJ = boundedPositive(inputs.claimedSpikeEnergyJ ?? 3.3e-17, "claimedSpikeEnergyJ", 1e-30, 1e6);
  const atpEnergyJ = boundedPositive(inputs.atpEnergyJ ?? 5.1e-20, "atpEnergyJ", 1e-30, 1);
  const claimedAtp = boundedPositive(inputs.claimedAtpPerSpike ?? 667, "claimedAtpPerSpike", 1e-12, 1e12);
  const tolerance = boundedPositive(inputs.relativeTolerance ?? 1e-3, "relativeTolerance", 1e-12, 0.1);

  const xiConversion = conversion("xi0", xi0Fm, "fm", 1e-15, "m");
  const coherenceM = xiConversion.outputValue * (nuclearDensity / myelinDensity) ** (1 / 3);
  const printedCoherenceM = 8.45e-12;
  const diameterConversion = conversion("printed inner diameter", claimedDiameterUm, "um", 1e-6, "m");
  const diameterM = coherenceM * phi ** (1 / 3);
  const reproducedLambda = lambda0 * (xiConversion.outputValue / coherenceM) ** 2;
  const widthConversion = conversion("printed kink width", claimedWidthNm, "nm", 1e-9, "m");
  const widthFromPrintedStiffnessM = speed / Math.sqrt(claimedLambda);
  const widthFromPrintedProjectionM = diameterConversion.outputValue * Math.sqrt(3) * phi ** 2;
  const saltatoryVelocity = unloadedVelocity * phi ** 2;
  const elementaryNodeM = diameterConversion.outputValue * phi ** 3;
  const absoluteConversion = conversion("absolute refractory period", absoluteMs, "ms", 1e-3, "s");
  const relativeConversion = conversion("relative refractory period", relativeMs, "ms", 1e-3, "s");
  const formulaRefractorySeconds = diameterConversion.outputValue / (speed * deltaChi) * phi ** 3;
  const relativeReproducedSeconds = absoluteConversion.outputValue * phi;
  const rawPeakExpression = deltaChi * 3 * speed / (2 * Math.PI);
  const energyConversion = conversion("printed rest energy", restEnergyJ, "J", 1 / JOULES_PER_MEV, "MeV");
  const atpPerSpike = spikeEnergyJ / atpEnergyJ;
  const findings: EarthLiteralFinding[] = [];

  if (relativeError(coherenceM, printedCoherenceM) > tolerance) findings.push(failure("axon-coherence-length", "arithmetic", "The density scaling does not reproduce the printed coherence length", relativeError(coherenceM, printedCoherenceM)));
  findings.push(failure("axon-inner-diameter", "arithmetic", "Multiplying the computed coherence length by phi^(1/3) does not produce 1.139 um", relativeError(diameterM, diameterConversion.outputValue)));
  findings.push(failure("axon-stiffness", "arithmetic", "lambda0(xi0/xiAxon)^2 does not produce 3.43e32", relativeError(reproducedLambda, claimedLambda)));
  findings.push(failure("kink-width-projection", "arithmetic", "1.139 um times sqrt(3) phi^2 is micrometres, not 11.4 nm", relativeError(widthFromPrintedProjectionM, widthConversion.outputValue)));
  findings.push(failure("kink-width-conflicting-routes", "source-claim", "The printed stiffness and printed projection formulas give incompatible kink widths", relativeError(widthFromPrintedStiffnessM, widthFromPrintedProjectionM)));
  findings.push(failure("unloaded-velocity-input", "dependency", "The velocity formula requires E_total, which is not supplied", null));
  if (relativeError(saltatoryVelocity, claimedSaltatoryVelocity) > tolerance) findings.push(failure("saltatory-velocity", "arithmetic", "The printed phi^2 velocity multiplier does not reproduce its claim", relativeError(saltatoryVelocity, claimedSaltatoryVelocity)));
  findings.push(failure("node-interval-range", "arithmetic", "Multipliers 413-826 applied to 4.82 um span about 2-4 mm, not 1-2 mm", relativeError(elementaryNodeM * nodeMaximum, 2e-3)));
  findings.push(failure("absolute-refractory-period", "arithmetic", "The printed relaxation formula with phi^3 is many orders below 1.5 ms", relativeError(formulaRefractorySeconds, absoluteConversion.outputValue)));
  if (relativeError(relativeReproducedSeconds, relativeConversion.outputValue) > tolerance) findings.push(failure("relative-refractory-period", "arithmetic", "phi times the absolute refractory period does not reproduce the printed relative period", relativeError(relativeReproducedSeconds, relativeConversion.outputValue)));
  findings.push(failure("peak-voltage-conversion", "dependency", "The peak-voltage formula contains an unspecified conversion factor", null));
  findings.push(failure("after-hyperpolarization-units", "dimension", "deltaChi(3c/2pi) has velocity units and cannot directly produce millivolts", null));
  findings.push(failure("rest-energy-joule-mev", "units", "The printed joule and MeV rest energies differ by a factor of one thousand", relativeError(energyConversion.outputValue, restEnergyMeV)));
  findings.push(failure("rest-spike-energy-conflict", "source-claim", "The printed rest energy and energy-per-spike values differ by a factor of five", relativeError(spikeEnergyJ, restEnergyJ)));
  if (relativeError(atpPerSpike, claimedAtp) > tolerance) findings.push(failure("atp-per-spike", "arithmetic", "The printed spike and ATP energies imply about 647 ATP, not 667", relativeError(atpPerSpike, claimedAtp)));

  return {
    method: "Bounded Float64 audit of printed axon and action-potential arithmetic; no clinical or medical validation",
    diagnostics: reproductionDiagnostics("EARTH-NEURO-006", 14, findings),
    output: {
      scope: "literal-axon-action-potential-arithmetic",
      coherence: { reproducedM: coherenceM, printedM: printedCoherenceM, relativeResidual: relativeError(coherenceM, printedCoherenceM) },
      diameter: { reproducedM: diameterM, claimedM: diameterConversion.outputValue, relativeResidual: relativeError(diameterM, diameterConversion.outputValue) },
      stiffness: { reproduced: reproducedLambda, claimed: claimedLambda, relativeResidual: relativeError(reproducedLambda, claimedLambda) },
      width: { fromPrintedStiffnessM: widthFromPrintedStiffnessM, fromPrintedProjectionM: widthFromPrintedProjectionM, claimedM: widthConversion.outputValue },
      velocity: {
        unloadedClaimedMPerS: unloadedVelocity,
        formulaComplete: false,
        saltatoryReproducedMPerS: saltatoryVelocity,
        saltatoryClaimedMPerS: claimedSaltatoryVelocity,
      },
      nodes: {
        elementaryM: elementaryNodeM,
        intervalMinimumM: elementaryNodeM * nodeMinimum,
        intervalMaximumM: elementaryNodeM * nodeMaximum,
      },
      refractory: {
        formulaSeconds: formulaRefractorySeconds,
        claimedAbsoluteSeconds: absoluteConversion.outputValue,
        relativeReproducedSeconds,
        claimedRelativeSeconds: relativeConversion.outputValue,
      },
      voltage: {
        rawPeakExpressionMPerS: rawPeakExpression,
        rawAfterHyperpolarizationExpressionMPerS: -rawPeakExpression,
        voltageConversionSpecified: false,
        claimedPeakMv,
        claimedAfterHyperpolarizationMv: claimedAhpMv,
      },
      energy: {
        restJ: restEnergyJ,
        restMeVClaimed: restEnergyMeV,
        restJAsMeV: energyConversion.outputValue,
        spikeJ: spikeEnergyJ,
        atpPerSpike,
        claimedAtpPerSpike: claimedAtp,
      },
      unitConversions: [xiConversion, diameterConversion, widthConversion, absoluteConversion, relativeConversion, energyConversion],
      findings,
    },
  };
}

export const translationSplicingAudit = translationSplicingArithmeticAudit;
export const livingStateAudit = livingStateArithmeticAudit;
export const axonActionPotentialAudit = axonActionPotentialArithmeticAudit;
