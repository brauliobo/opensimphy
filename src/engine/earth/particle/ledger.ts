import { fail } from "../../../simphy/contract";
import { relativeError } from "../common.js";

export const EARTH_PREDICTION_SCHEMA = "earth-prediction/v1" as const;
export const EARTH_PREDICTION_MAPPING = "four-program-ledger" as const;

export const EARTH_PREDICTION_LABELS = Object.freeze({
  earth:  "EARTH",
  thad:   "Thad",
  nassim: "Nassim",
  sm:     "SM",
} as const);

export type EarthPredictionProgram = keyof typeof EARTH_PREDICTION_LABELS;
export type EarthPredictionLabel = typeof EARTH_PREDICTION_LABELS[EarthPredictionProgram];

export type EarthPredictionSlotStatus =
  | "prediction"
  | "repro"
  | "calibration"
  | "identity"
  | "missing"
  | "falsified"
  | "blocked";

export type EarthPredictionAuditStatus =
  | "falsified"
  | "testable"
  | "identity"
  | "calibration"
  | "blocked"
  | "missing";

export type EarthPredictionScientificStatus =
  | "prediction"
  | "audit"
  | "comparison"
  | "blocked"
  | "unresolved";

export type EarthPredictionVerdict = "pass" | "fail";
export type EarthPredictionScalar = number | string | null;

export interface EarthPredictionSmSlot {
  value: number | null;
  uncertainty: number | null;
  source: string;
  release: string;
}

export interface EarthPredictionEarthSlot {
  printed: EarthPredictionScalar;
  evaluated: EarthPredictionScalar;
  formula: string;
}

export interface EarthPredictionCounterpartSlot {
  value: EarthPredictionScalar;
  formula: string | null;
  status: EarthPredictionSlotStatus;
}

export interface EarthPredictionResidual {
  earthPrintedVsEval: number | null;
  earthEvalVsSm: number | null;
  thadVsSm: number | null;
  nassimVsSm: number | null;
}

export interface EarthPredictionGate {
  metric: string;
  passIf: string;
  verdict: EarthPredictionVerdict;
}

export interface EarthPredictionRow {
  claimId: string;
  programId: string;
  kernelId: string;
  observable: string;
  unit: string;
  sm: EarthPredictionSmSlot;
  earth: EarthPredictionEarthSlot;
  thad: EarthPredictionCounterpartSlot;
  nassim: EarthPredictionCounterpartSlot;
  residual: EarthPredictionResidual;
  gate: EarthPredictionGate;
  auditStatus: EarthPredictionAuditStatus;
  g2aIndependent: boolean;
  datasetIds: readonly string[];
  modelSummary?: string;
  plainLanguage?: string;
  correlation?: string;
  discrepancy?: string;
}

export interface EarthPredictionFinding {
  claimId: string | null;
  text: string;
}

export interface EarthPredictionLedger {
  schemaVersion: typeof EARTH_PREDICTION_SCHEMA;
  mapping: typeof EARTH_PREDICTION_MAPPING;
  simulationId: string;
  scientificStatus: EarthPredictionScientificStatus;
  validatesEarthTheory: false;
  predictions: readonly EarthPredictionRow[];
  residuals: Readonly<Record<string, EarthPredictionResidual>>;
  findings: readonly EarthPredictionFinding[];
  blockers: readonly string[];
  referenceDatasetIds: readonly string[];
}

export interface EarthPredictionRowInput {
  claimId: string;
  programId: string;
  kernelId: string;
  observable: string;
  unit: string;
  sm: EarthPredictionSmSlot;
  earth: EarthPredictionEarthSlot;
  thad: EarthPredictionCounterpartSlot;
  nassim: EarthPredictionCounterpartSlot;
  gate: { metric: string; passIf: string };
  auditStatus: EarthPredictionAuditStatus;
  g2aIndependent: boolean;
  datasetIds: readonly string[];
  modelSummary?: string;
  plainLanguage?: string;
  correlation?: string;
  discrepancy?: string;
}

export interface EarthPredictionLedgerInput {
  simulationId: string;
  predictions: readonly EarthPredictionRow[];
  findings?: readonly EarthPredictionFinding[];
  blockers?: readonly string[];
  referenceDatasetIds?: readonly string[];
  scientificStatus?: EarthPredictionScientificStatus;
}

export interface EarthPredictionDisplayColumn {
  program: EarthPredictionProgram;
  label: EarthPredictionLabel;
  value: EarthPredictionScalar;
  unit: string | null;
  status: string;
  residualVsSm: number | null;
}

export interface EarthPredictionDisplayRow {
  claimId: string;
  observable: string;
  unit: string;
  modelSummary: string;
  plainLanguage: string;
  gate: EarthPredictionVerdict;
  auditStatus: EarthPredictionAuditStatus;
  columns: readonly EarthPredictionDisplayColumn[];
  residual: EarthPredictionResidual;
  correlation: string | null;
  discrepancy: string | null;
}

const ROW_KEYS = [
  "claimId", "programId", "kernelId", "observable", "unit",
  "sm", "earth", "thad", "nassim", "residual", "gate",
  "auditStatus", "g2aIndependent", "datasetIds",
] as const;

const SLOT_STATUSES = new Set<EarthPredictionSlotStatus>([
  "prediction", "repro", "calibration", "identity", "missing", "falsified", "blocked",
]);

const AUDIT_STATUSES = new Set<EarthPredictionAuditStatus>([
  "falsified", "testable", "identity", "calibration", "blocked", "missing",
]);

const SCIENTIFIC_STATUSES = new Set<EarthPredictionScientificStatus>([
  "prediction", "audit", "comparison", "blocked", "unresolved",
]);

const OPTIONAL_ROW_KEYS = new Set(["modelSummary", "plainLanguage", "correlation", "discrepancy"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) fail(path, "must be a non-empty string");
  return value;
}

function scalar(value: unknown, path: string): EarthPredictionScalar {
  if (value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(path, "must be finite or null");
    return value;
  }
  if (typeof value === "string") return value;
  fail(path, "must be a finite number, string, or null");
}

function nullableNumber(value: unknown, path: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "must be a finite number or null");
  return value;
}

function numericResidual(actual: EarthPredictionScalar, expected: EarthPredictionScalar): number | null {
  if (typeof actual !== "number" || typeof expected !== "number") return null;
  return relativeError(actual, expected);
}

function printedDiffersFromEvaluated(printed: EarthPredictionScalar, evaluated: EarthPredictionScalar): boolean {
  if (typeof printed === "number" && typeof evaluated === "number") {
    return relativeError(printed, evaluated) > 8 * Number.EPSILON;
  }
  return printed !== evaluated;
}

function parsePassIf(passIf: string): { kind: "relative" | "sigma" | "exact"; limit: number } {
  if (passIf === "exact") return { kind: "exact", limit: 0 };
  const sigma = /^[<=≤]{1,2}\s*([0-9.]+)\s*σ$/.exec(passIf);
  if (sigma) return { kind: "sigma", limit: Number(sigma[1]) };
  const relative = /^(?:relative)?\s*[<=≤]{1,2}\s*([0-9.eE+-]+)$/.exec(passIf);
  if (relative) return { kind: "relative", limit: Number(relative[1]) };
  fail("gate.passIf", `unsupported (${passIf})`);
}

function gateScore(row: Pick<EarthPredictionRow, "earth" | "sm" | "gate">): number | null {
  const evaluated = row.earth.evaluated;
  const expected = row.sm.value;
  if (row.gate.metric === "exact" || row.gate.passIf === "exact") {
    if (evaluated === null || expected === null) return null;
    return evaluated === expected ? 0 : 1;
  }
  if (typeof evaluated !== "number" || typeof expected !== "number") return null;
  if (row.gate.metric === "sigma") {
    const uncertainty = row.sm.uncertainty;
    if (uncertainty === null || uncertainty === 0) return null;
    return Math.abs(evaluated - expected) / Math.abs(uncertainty);
  }
  return relativeError(evaluated, expected);
}

export function decideEarthPredictionVerdict(row: Pick<EarthPredictionRow, "earth" | "sm" | "gate">): EarthPredictionVerdict {
  if (printedDiffersFromEvaluated(row.earth.printed, row.earth.evaluated)) return "fail";
  const parsed = parsePassIf(row.gate.passIf);
  const score = gateScore({ ...row, gate: { ...row.gate, metric: parsed.kind === "sigma" ? "sigma" : row.gate.metric } });
  if (score === null) return "fail";
  if (parsed.kind === "exact") return score === 0 ? "pass" : "fail";
  return score <= parsed.limit ? "pass" : "fail";
}

export function computeEarthPredictionResidual(
  earth: EarthPredictionEarthSlot,
  sm: EarthPredictionSmSlot,
  thad: EarthPredictionCounterpartSlot,
  nassim: EarthPredictionCounterpartSlot,
): EarthPredictionResidual {
  return {
    earthPrintedVsEval: numericResidual(earth.evaluated, earth.printed),
    earthEvalVsSm:      numericResidual(earth.evaluated, sm.value),
    thadVsSm:           numericResidual(thad.value, sm.value),
    nassimVsSm:         numericResidual(nassim.value, sm.value),
  };
}

export function missingPredictionSlot(missingObject: string): EarthPredictionCounterpartSlot {
  return { value: null, formula: requiredString(missingObject, "missingObject"), status: "missing" };
}

export function identityPredictionSlot(value: EarthPredictionScalar, formula: string): EarthPredictionCounterpartSlot {
  return { value, formula: requiredString(formula, "formula"), status: "identity" };
}

export function reproPredictionSlot(value: EarthPredictionScalar, formula: string): EarthPredictionCounterpartSlot {
  return { value, formula: requiredString(formula, "formula"), status: "repro" };
}

function assertSmSlot(value: unknown, path: string): EarthPredictionSmSlot {
  if (!isRecord(value)) fail(path, "must be an object");
  return {
    value:       nullableNumber(value.value, `${path}.value`),
    uncertainty: nullableNumber(value.uncertainty, `${path}.uncertainty`),
    source:      requiredString(value.source, `${path}.source`),
    release:     requiredString(value.release, `${path}.release`),
  };
}

function assertEarthSlot(value: unknown, path: string): EarthPredictionEarthSlot {
  if (!isRecord(value)) fail(path, "must be an object");
  return {
    printed:    scalar(value.printed, `${path}.printed`),
    evaluated:  scalar(value.evaluated, `${path}.evaluated`),
    formula:    requiredString(value.formula, `${path}.formula`),
  };
}

function assertCounterpartSlot(value: unknown, path: string): EarthPredictionCounterpartSlot {
  if (value === undefined) fail(path, "silent omission is a test failure; use status missing");
  if (!isRecord(value)) fail(path, "must be an object");
  const status = value.status;
  if (typeof status !== "string" || !SLOT_STATUSES.has(status as EarthPredictionSlotStatus)) {
    fail(`${path}.status`, "must be prediction|repro|calibration|identity|missing|falsified|blocked");
  }
  const slot = {
    value:   scalar(value.value, `${path}.value`),
    formula: value.formula === null ? null : requiredString(value.formula, `${path}.formula`),
    status:  status as EarthPredictionSlotStatus,
  };
  if (slot.status === "missing" && slot.value !== null) fail(`${path}.value`, "missing slots cannot carry a value");
  if (slot.status === "prediction" && slot.value === null) fail(`${path}.value`, "prediction slots must carry a value");
  if (slot.status === "missing" && (slot.formula === null || slot.formula.length === 0)) {
    fail(`${path}.formula`, "missing slots must name the missing source object");
  }
  return slot;
}

export function assertEarthPredictionRow(value: unknown, path = "predictions[]"): EarthPredictionRow {
  if (!isRecord(value)) fail(path, "must be an object");
  for (const key of ROW_KEYS) {
    if (!(key in value)) fail(`${path}.${key}`, "silent omission is a test failure");
  }
  for (const key of Object.keys(value)) {
    if (!(ROW_KEYS as readonly string[]).includes(key) && !OPTIONAL_ROW_KEYS.has(key)) {
      fail(`${path}.${key}`, "unknown field");
    }
  }
  const auditStatus = value.auditStatus;
  if (typeof auditStatus !== "string" || !AUDIT_STATUSES.has(auditStatus as EarthPredictionAuditStatus)) {
    fail(`${path}.auditStatus`, "must be falsified|testable|identity|calibration|blocked|missing");
  }
  if (typeof value.g2aIndependent !== "boolean") fail(`${path}.g2aIndependent`, "must be boolean");
  if (!Array.isArray(value.datasetIds) || value.datasetIds.some((id) => typeof id !== "string" || id.length === 0)) {
    fail(`${path}.datasetIds`, "must be an array of non-empty strings");
  }
  if (!isRecord(value.gate)) fail(`${path}.gate`, "must be an object");
  const earth = assertEarthSlot(value.earth, `${path}.earth`);
  const sm = assertSmSlot(value.sm, `${path}.sm`);
  const thad = assertCounterpartSlot(value.thad, `${path}.thad`);
  const nassim = assertCounterpartSlot(value.nassim, `${path}.nassim`);
  const residual = computeEarthPredictionResidual(earth, sm, thad, nassim);
  const gate = {
    metric:  requiredString(value.gate.metric, `${path}.gate.metric`),
    passIf:  requiredString(value.gate.passIf, `${path}.gate.passIf`),
    verdict: decideEarthPredictionVerdict({
      earth,
      sm,
      gate: {
        metric: requiredString(value.gate.metric, `${path}.gate.metric`),
        passIf: requiredString(value.gate.passIf, `${path}.gate.passIf`),
        verdict: "fail",
      },
    }),
  };
  const optionalText = (key: "modelSummary" | "plainLanguage" | "correlation" | "discrepancy") => (
    value[key] === undefined ? undefined : requiredString(value[key], `${path}.${key}`)
  );
  return {
    claimId:         requiredString(value.claimId, `${path}.claimId`),
    programId:       requiredString(value.programId, `${path}.programId`),
    kernelId:        requiredString(value.kernelId, `${path}.kernelId`),
    observable:      requiredString(value.observable, `${path}.observable`),
    unit:            requiredString(value.unit, `${path}.unit`),
    sm,
    earth,
    thad,
    nassim,
    residual,
    gate,
    auditStatus:     auditStatus as EarthPredictionAuditStatus,
    g2aIndependent:  value.g2aIndependent,
    datasetIds:      value.datasetIds as readonly string[],
    modelSummary:    optionalText("modelSummary"),
    plainLanguage:   optionalText("plainLanguage"),
    correlation:     optionalText("correlation"),
    discrepancy:     optionalText("discrepancy"),
  };
}

export function canClaimPredictionStatus(rows: readonly EarthPredictionRow[]): boolean {
  return rows.length > 0 && rows.every((row) => (
    row.g2aIndependent
    && row.auditStatus === "testable"
    && row.gate.verdict === "pass"
    && row.thad.status !== "repro"
    && row.thad.status !== "calibration"
    && row.thad.status !== "identity"
    && row.nassim.status !== "repro"
    && row.nassim.status !== "calibration"
    && row.nassim.status !== "identity"
  ));
}

export function resolveEarthPredictionScientificStatus(
  rows: readonly EarthPredictionRow[],
  requested?: EarthPredictionScientificStatus,
): EarthPredictionScientificStatus {
  if (requested === "prediction" && !canClaimPredictionStatus(rows)) {
    fail("scientificStatus", "cannot be prediction if the target entered the inputs, a counterpart is identity/repro/calibration, or a gate failed");
  }
  if (requested) {
    if (!SCIENTIFIC_STATUSES.has(requested)) fail("scientificStatus", "unsupported");
    return requested;
  }
  if (rows.some((row) => row.auditStatus === "blocked")) return "blocked";
  return "audit";
}

export function buildEarthPredictionRow(input: EarthPredictionRowInput): EarthPredictionRow {
  return assertEarthPredictionRow({ ...input, residual: computeEarthPredictionResidual(input.earth, input.sm, input.thad, input.nassim), gate: { ...input.gate, verdict: "fail" } });
}

export function buildEarthPredictionLedger(input: EarthPredictionLedgerInput): EarthPredictionLedger {
  const predictions = input.predictions.map((row, index) => assertEarthPredictionRow(row, `predictions[${index}]`));
  const residuals = Object.fromEntries(predictions.map((row) => [row.claimId, row.residual]));
  return {
    schemaVersion:        EARTH_PREDICTION_SCHEMA,
    mapping:              EARTH_PREDICTION_MAPPING,
    simulationId:         requiredString(input.simulationId, "simulationId"),
    scientificStatus:     resolveEarthPredictionScientificStatus(predictions, input.scientificStatus),
    validatesEarthTheory: false,
    predictions,
    residuals,
    findings:             input.findings ?? [],
    blockers:             input.blockers ?? [],
    referenceDatasetIds:  input.referenceDatasetIds ?? [],
  };
}

export function assertEarthPredictionLedger(value: unknown, path = "predictionLedger"): EarthPredictionLedger {
  if (!isRecord(value)) fail(path, "must be an object");
  if (value.schemaVersion !== EARTH_PREDICTION_SCHEMA) fail(`${path}.schemaVersion`, `must be ${EARTH_PREDICTION_SCHEMA}`);
  if (value.mapping !== EARTH_PREDICTION_MAPPING) fail(`${path}.mapping`, `must be ${EARTH_PREDICTION_MAPPING}`);
  if (value.validatesEarthTheory !== false) fail(`${path}.validatesEarthTheory`, "must remain false");
  if (!Array.isArray(value.predictions)) fail(`${path}.predictions`, "must be an array");
  if (!Array.isArray(value.findings)) fail(`${path}.findings`, "must be an array");
  if (!Array.isArray(value.blockers) || value.blockers.some((item) => typeof item !== "string")) {
    fail(`${path}.blockers`, "must be an array of strings");
  }
  if (!Array.isArray(value.referenceDatasetIds) || value.referenceDatasetIds.some((id) => typeof id !== "string" || id.length === 0)) {
    fail(`${path}.referenceDatasetIds`, "must be an array of non-empty strings");
  }
  const scientificStatus = value.scientificStatus;
  if (typeof scientificStatus !== "string" || !SCIENTIFIC_STATUSES.has(scientificStatus as EarthPredictionScientificStatus)) {
    fail(`${path}.scientificStatus`, "must be prediction|audit|comparison|blocked|unresolved");
  }
  return buildEarthPredictionLedger({
    simulationId:        requiredString(value.simulationId, `${path}.simulationId`),
    predictions:         value.predictions as EarthPredictionRow[],
    findings:            value.findings as EarthPredictionFinding[],
    blockers:            value.blockers as string[],
    referenceDatasetIds: value.referenceDatasetIds as string[],
    scientificStatus:    scientificStatus as EarthPredictionScientificStatus,
  });
}

export function earthMethodPredictions(kernel: {
  predictions?: readonly EarthPredictionRow[];
  predictionLedger?: EarthPredictionLedger;
}): readonly EarthPredictionRow[] {
  if (kernel.predictionLedger) {
    const ledger = assertEarthPredictionLedger(kernel.predictionLedger);
    return ledger.predictions;
  }
  const rows = kernel.predictions ?? [];
  return rows.map((row, index) => assertEarthPredictionRow(row, `predictions[${index}]`));
}

export function predictionRowsForDisplay(rows: readonly EarthPredictionRow[]): EarthPredictionDisplayRow[] {
  return rows.map((row) => ({
    claimId:       row.claimId,
    observable:    row.observable,
    unit:          row.unit,
    modelSummary:  row.modelSummary ?? row.earth.formula,
    plainLanguage: row.plainLanguage ?? row.discrepancy ?? row.correlation ?? row.earth.formula,
    gate:          row.gate.verdict,
    auditStatus:   row.auditStatus,
    residual:      row.residual,
    correlation:   row.correlation ?? null,
    discrepancy:   row.discrepancy ?? null,
    columns: [
      { program: "earth",  label: EARTH_PREDICTION_LABELS.earth,  value: row.earth.evaluated, unit: row.unit, status: row.auditStatus, residualVsSm: row.residual.earthEvalVsSm },
      { program: "thad",   label: EARTH_PREDICTION_LABELS.thad,   value: row.thad.value,      unit: row.unit, status: row.thad.status, residualVsSm: row.residual.thadVsSm },
      { program: "nassim", label: EARTH_PREDICTION_LABELS.nassim, value: row.nassim.value,    unit: row.unit, status: row.nassim.status, residualVsSm: row.residual.nassimVsSm },
      { program: "sm",     label: EARTH_PREDICTION_LABELS.sm,     value: row.sm.value,        unit: row.unit, status: "sm", residualVsSm: 0 },
    ],
  }));
}
