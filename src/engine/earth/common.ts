import type { EarthPredictionLedger, EarthPredictionRow } from "./particle/ledger.js";
import {
  boundedInteger,
  boundedNumber,
  boundedPositive,
  finiteNumber,
  gaussian,
  logarithmicSamples,
  nonNegativeNumber,
  positiveNumber,
  relativeError,
  requireInteger,
  seededRandom,
} from "../../simphy/numbers.js";

export {
  boundedInteger,
  boundedNumber,
  boundedPositive,
  finiteNumber,
  gaussian,
  logarithmicSamples,
  nonNegativeNumber,
  positiveNumber,
  relativeError,
  requireInteger,
  seededRandom,
};

export type EarthProvenanceKind = "reproduction" | "comparison";

export type EarthMethodRelationship =
  | "earth-source-reproduction"
  | "traditional-analytic-baseline"
  | "traditional-numerical-baseline"
  | "source-contract-validator";

export type EarthModelOrigin = "earth-corpus" | "standard-physics" | "engine-audit";
export type EarthMethodRuntime = "browser-worker" | "offline-artifact" | "unavailable";

export interface EarthMethodProvenance {
  kind: EarthProvenanceKind;
  precision: "float64";
  model: string;
  relationship: EarthMethodRelationship;
  modelOrigin: EarthModelOrigin;
  earthDerived: boolean;
  validatesEarthTheory: false;
}

export interface EarthRunOptions {
  seed?: number;
  isCancelled?: () => boolean;
}

export interface EarthDiagnostics {
  [key: string]: boolean | number | string | null;
}

export interface EarthKernelResult<Output> {
  method: string;
  diagnostics: EarthDiagnostics;
  output: Output;
  predictions?: readonly EarthPredictionRow[];
  predictionLedger?: EarthPredictionLedger;
}

export interface EarthMethodDefinition<
  ProgramId extends string = string,
  MethodId extends string = string,
  Inputs = unknown,
  Output = unknown,
> extends EarthMethodProvenance {
  id: MethodId;
  programId: ProgramId;
  title: string;
  runtime: EarthMethodRuntime;
  defaultInputs: Inputs;
  execute: (inputs: Inputs, options: EarthRunOptions) => EarthKernelResult<Output>;
}

export interface EarthProgramDefinition<
  ProgramId extends string = string,
  MethodId extends string = string,
  Inputs = unknown,
  Output = unknown,
> {
  id: ProgramId;
  defaultMethodId: MethodId;
  methods: readonly EarthMethodDefinition<ProgramId, MethodId, Inputs, Output>[];
}

export interface EarthSimulationResult<Id extends string, Output, MethodId extends string = string> extends EarthKernelResult<Output> {
  schemaVersion: 2;
  programId: Id;
  methodId: MethodId;
  executionStatus: "completed";
  id: Id;
  status: "completed";
  relationship: EarthMethodRelationship;
  modelOrigin: EarthModelOrigin;
  earthDerived: boolean;
  validatesEarthTheory: false;
  provenance: EarthMethodProvenance;
  predictions: readonly EarthPredictionRow[];
}

export class EarthCancellationError extends Error {
  constructor() {
    super("EARTH simulation cancelled");
    this.name = "EarthCancellationError";
  }
}

export function checkCancelled(options: EarthRunOptions): void {
  if (options.isCancelled?.()) throw new EarthCancellationError();
}
