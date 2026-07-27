import type {
  WallCell,
  WallMode,
  WallPayload,
  WallSimulation,
  WallSimulationOptions,
} from "../types/engine.js";
import { isPrimeInteger } from "../math/integer.js";

export const MAX_WALL_TERMS = 100;
export const MAX_WALL_DEPTH = 50;

export class WallCancelledError extends Error {
  constructor() {
    super("Number-wall simulation cancelled");
    this.name = "WallCancelledError";
  }
}

function assertInteger(value: number, name: string, minimum: number, maximum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer from ${minimum} through ${maximum}`);
  }
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export function bareissDeterminant(input: readonly (readonly bigint[])[]): bigint {
  const size = input.length;
  if (size === 0) return 1n;
  if (input.some((row) => row.length !== size)) throw new RangeError("Bareiss determinant requires a square matrix");
  if (size === 1) return input[0]![0]!;
  const matrix = input.map((row) => [...row]);
  let previous = 1n;
  let sign = 1n;
  for (let pivotIndex = 0; pivotIndex < size - 1; pivotIndex += 1) {
    if (matrix[pivotIndex]![pivotIndex] === 0n) {
      let replacement = pivotIndex + 1;
      while (replacement < size && matrix[replacement]![pivotIndex] === 0n) replacement += 1;
      if (replacement === size) return 0n;
      [matrix[pivotIndex], matrix[replacement]] = [matrix[replacement]!, matrix[pivotIndex]!];
      sign = -sign;
    }
    const pivot = matrix[pivotIndex]![pivotIndex]!;
    for (let row = pivotIndex + 1; row < size; row += 1) {
      for (let column = pivotIndex + 1; column < size; column += 1) {
        const numerator = matrix[row]![column]! * pivot - matrix[row]![pivotIndex]! * matrix[pivotIndex]![column]!;
        if (numerator % previous !== 0n) throw new Error("Bareiss exact division invariant failed");
        matrix[row]![column] = numerator / previous;
      }
      matrix[row]![pivotIndex] = 0n;
    }
    previous = pivot;
  }
  return sign * matrix[size - 1]![size - 1]!;
}

export function numberWallCell(sequence: readonly bigint[], row: number, column: number): bigint | null {
  if (row === -1) return column >= 0 && column < sequence.length ? 1n : null;
  if (row === 0) return sequence[column] ?? null;
  if (row < -1 || column < row || column + row >= sequence.length) return null;
  const matrix = Array.from({ length: row + 1 }, (_, matrixRow) =>
    Array.from({ length: row + 1 }, (_, matrixColumn) => sequence[column - matrixRow + matrixColumn]!),
  );
  return bareissDeterminant(matrix);
}

export function parseWallPayload(value: unknown): WallPayload {
  if (!value || typeof value !== "object") throw new TypeError("Wall payload must be an object");
  const source = value as Record<string, unknown>;
  if (typeof source.id !== "string" || !source.id) throw new TypeError("Wall payload requires a non-empty ID");
  if (typeof source.title !== "string") throw new TypeError(`Wall payload ${source.id} requires a title`);
  if (typeof source.kind !== "string") throw new TypeError(`Wall payload ${source.id} requires a kind`);
  if (!Array.isArray(source.sequence) || source.sequence.length === 0 || source.sequence.length > MAX_WALL_TERMS) {
    throw new RangeError(`Wall payload ${source.id} must contain 1 through ${MAX_WALL_TERMS} terms`);
  }
  const sequence = source.sequence.map((term, index) => {
    if (typeof term !== "string" || !/^[+-]?\d+$/.test(term)) throw new TypeError(`Invalid integer at ${source.id}[${index}]`);
    BigInt(term);
    return term;
  });
  return { ...source, id: source.id, title: source.title, kind: source.kind, sequence } as WallPayload;
}

function signedLog(value: bigint): { sign: -1 | 0 | 1; log: number | null } {
  if (value === 0n) return { sign: 0, log: null };
  const text = absolute(value).toString();
  const prefixLength = Math.min(16, text.length);
  const prefix = Number(text.slice(0, prefixLength));
  return {
    sign: value > 0n ? 1 : -1,
    log: text.length - prefixLength + Math.log10(prefix),
  };
}

function valuation(value: bigint, prime: bigint): number | null {
  if (value === 0n) return null;
  let remaining = absolute(value);
  let exponent = 0;
  while (remaining % prime === 0n) {
    remaining /= prime;
    exponent += 1;
  }
  return exponent;
}

function normalizeMod(value: bigint, modulus: bigint): number {
  return Number(((value % modulus) + modulus) % modulus);
}

function modeCell(row: number, column: number, exact: bigint, mode: WallMode, options: Required<Pick<WallSimulationOptions, "modulus" | "valuationPrime" | "smallValueLimit">>): WallCell {
  const isExactZero = exact === 0n;
  if (mode === "mod") return { row, column, isExactZero, value: normalizeMod(exact, BigInt(options.modulus)) };
  if (mode === "valuation") return { row, column, isExactZero, value: valuation(exact, BigInt(options.valuationPrime)) };
  if (mode === "small_values") {
    const small = absolute(exact) <= BigInt(options.smallValueLimit);
    return { row, column, isExactZero, exact: small ? exact.toString() : undefined, value: small ? exact.toString() : null };
  }
  if (mode === "zero_windows") return { row, column, isExactZero, value: isExactZero ? 1 : 0, sign: isExactZero ? 0 : exact > 0n ? 1 : -1 };
  const transformed = signedLog(exact);
  return { row, column, isExactZero, value: transformed.log, sign: transformed.sign };
}

export function simulateNumberWall(payloadInput: WallPayload | unknown, inputOptions: WallSimulationOptions = {}): WallSimulation {
  const payload = parseWallPayload(payloadInput);
  const terms = inputOptions.terms ?? payload.sequence.length;
  const depth = inputOptions.depth ?? Math.min(payload.visibleDepth ?? MAX_WALL_DEPTH, MAX_WALL_DEPTH);
  const mode = inputOptions.mode ?? "signed_log";
  const modulus = inputOptions.modulus ?? 2;
  const valuationPrime = inputOptions.valuationPrime ?? 2;
  const smallValueLimit = inputOptions.smallValueLimit ?? 10;
  assertInteger(terms, "terms", 1, Math.min(MAX_WALL_TERMS, payload.sequence.length));
  assertInteger(depth, "depth", 0, MAX_WALL_DEPTH);
  assertInteger(modulus, "modulus", 2, 2_147_483_647);
  assertInteger(valuationPrime, "valuationPrime", 2, 2_147_483_647);
  if (mode === "valuation" && !isPrimeInteger(valuationPrime)) throw new RangeError("valuationPrime must be prime in valuation mode");
  assertInteger(smallValueLimit, "smallValueLimit", 0, 2_147_483_647);

  const sequence = payload.sequence.slice(0, terms).map(BigInt);
  const cells: WallCell[] = [];
  const exactRows = new Map<number, Array<{ column: number; value: bigint }>>();
  for (let row = -1; row <= depth; row += 1) {
    if (inputOptions.shouldCancel?.()) throw new WallCancelledError();
    const values: Array<{ column: number; value: bigint }> = [];
    for (let column = 0; column < terms; column += 1) {
      const exact = numberWallCell(sequence, row, column);
      if (exact !== null) values.push({ column, value: exact });
    }
    exactRows.set(row, values);
  }

  const transformOptions = { modulus, valuationPrime, smallValueLimit };
  for (const [row, values] of exactRows) {
    const rowMaximum = mode === "row_signed_log"
      ? Math.max(0, ...values.map(({ value }) => signedLog(value).log ?? 0))
      : 0;
    for (const { column, value } of values) {
      const cell = modeCell(row, column, value, mode, transformOptions);
      if (mode === "row_signed_log" && typeof cell.value === "number") cell.value -= rowMaximum;
      cells.push(cell);
    }
  }

  const zeroWindows = mode === "zero_windows" ? [] as Array<{ row: number; start: number; length: number }> : undefined;
  if (zeroWindows) {
    for (const [row, values] of exactRows) {
      let start: number | null = null;
      let previous = -2;
      for (const entry of values.filter(({ value }) => value === 0n)) {
        if (start === null || entry.column !== previous + 1) {
          if (start !== null) zeroWindows.push({ row, start, length: previous - start + 1 });
          start = entry.column;
        }
        previous = entry.column;
      }
      if (start !== null) zeroWindows.push({ row, start, length: previous - start + 1 });
    }
  }

  return { id: payload.id, terms, depth, mode, cells, zeroWindows };
}

export async function loadWallPayload(filename: string, baseUrl = "/data/number-walls"): Promise<WallPayload> {
  if (!filename.endsWith(".json") || filename.includes("/") || filename.includes("\\")) throw new Error("Unsafe wall filename");
  const response = await fetch(`${baseUrl}/${encodeURIComponent(filename)}`);
  if (!response.ok) throw new Error(`Failed to load wall payload ${filename}: ${response.status}`);
  return parseWallPayload(await response.json());
}
