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

export function finiteNumber(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

export function boundedInteger(value: number, name: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

export function positiveNumber(value: number, name: string): number {
  finiteNumber(value, name);
  if (value <= 0) throw new RangeError(`${name} must be greater than zero`);
  return value;
}

export function nonNegativeNumber(value: number, name: string): number {
  finiteNumber(value, name);
  if (value < 0) throw new RangeError(`${name} must be non-negative`);
  return value;
}

export function relativeError(actual: number, expected: number): number {
  return expected === 0 ? Math.abs(actual) : Math.abs(actual - expected) / Math.abs(expected);
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

export function gaussian(random: () => number): number {
  const first = Math.max(random(), Number.MIN_VALUE);
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * random());
}
