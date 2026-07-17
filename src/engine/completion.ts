import type {
  CompletionReport,
  PrimitiveSymbolSource,
  RecipeSource,
  WallMode,
} from "../types/engine.js";
import { CORE_CASES, evaluateCoreRegistry, type CoreCase } from "./core.js";
import { parseWallPayload, simulateNumberWall } from "./numberWall.js";
import { evaluateRecipes } from "./recipes.js";

export const EXPECTED_RECIPE_COUNT = 288;
export const EXPECTED_WALL_COUNT = 351;
export const COMPLETION_WALL_TERMS = 8;
export const COMPLETION_WALL_DEPTH = 3;

export interface CompletionAuditInput {
  recipes: RecipeSource[];
  symbols: PrimitiveSymbolSource[];
  wallPayloads: unknown[];
  wallSourceCount?: number;
  coreCases?: CoreCase[];
}

export interface CompletionAuditOptions {
  generatedAt?: string;
  expectedRecipes?: number;
  expectedWalls?: number;
  wallTerms?: number;
  wallDepth?: number;
  wallMode?: WallMode;
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort((left, right) => left.localeCompare(right, "en"));
}

export function buildCompletionReport(input: CompletionAuditInput, options: CompletionAuditOptions = {}): CompletionReport {
  const generatedAt     = options.generatedAt ?? "runtime";
  const expectedRecipes = options.expectedRecipes ?? EXPECTED_RECIPE_COUNT;
  const expectedWalls   = options.expectedWalls ?? EXPECTED_WALL_COUNT;
  const wallTerms       = options.wallTerms ?? COMPLETION_WALL_TERMS;
  const wallDepth       = options.wallDepth ?? COMPLETION_WALL_DEPTH;
  const wallMode        = options.wallMode ?? "signed_log";
  const errors: string[] = [];
  const unresolved: string[] = [];

  const duplicateRecipeNumbers = duplicates(input.recipes.map(({ recipe_number }) => String(recipe_number)));
  const duplicateRecipeIds = duplicates(input.recipes.map(({ constant_id }) => constant_id));
  if (duplicateRecipeNumbers.length > 0) errors.push(`Duplicate recipe numbers: ${duplicateRecipeNumbers.join(", ")}`);
  if (duplicateRecipeIds.length > 0) errors.push(`Duplicate recipe IDs: ${duplicateRecipeIds.join(", ")}`);

  let evaluatedRecipes = 0;
  let graphedRecipes = 0;
  try {
    const batch = evaluateRecipes(input.recipes, input.symbols, { graphSteps: 3 });
    evaluatedRecipes = batch.evaluations.length;
    graphedRecipes = batch.evaluations.filter(({ graphReady }) => graphReady).length;
    unresolved.push(...batch.unresolved.map(({ recipeNumber, id, error }) => `recipe ${recipeNumber} (${id}): ${error}`));
    errors.push(...batch.errors.map(({ recipeNumber, id, error }) => `recipe ${recipeNumber} (${id}): ${error}`));
    errors.push(...batch.evaluations
      .filter(({ modelParity }) => !modelParity)
      .map(({ recipeNumber, id, relativeModelError }) => `recipe ${recipeNumber} (${id}) model parity failed (${relativeModelError})`));
  } catch (error) {
    errors.push(`Recipe audit failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const coreCases = input.coreCases ?? CORE_CASES;
  const duplicateCoreIds = duplicates(coreCases.map(({ id }) => id));
  if (duplicateCoreIds.length > 0) errors.push(`Duplicate core IDs: ${duplicateCoreIds.join(", ")}`);
  let evaluatedCore = 0;
  let graphedCore = 0;
  try {
    const evaluations = evaluateCoreRegistry(coreCases);
    evaluatedCore = evaluations.length;
    graphedCore = evaluations.filter(({ graphReady }) => graphReady).length;
  } catch (error) {
    errors.push(`Core audit failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const wallIds = new Set<string>();
  let implementedWalls = 0;
  let simulatableWalls = 0;
  for (const payloadInput of input.wallPayloads) {
    try {
      const payload = parseWallPayload(payloadInput);
      if (wallIds.has(payload.id)) throw new Error(`Duplicate wall ID: ${payload.id}`);
      wallIds.add(payload.id);
      implementedWalls += 1;
      const terms = Math.min(wallTerms, payload.sequence.length);
      const depth = Math.min(wallDepth, Math.max(0, terms - 1));
      const simulation = simulateNumberWall(payload, { terms, depth, mode: wallMode });
      if (simulation.cells.length === 0) throw new Error("Small simulation produced no cells");
      simulatableWalls += 1;
    } catch (error) {
      errors.push(`Wall audit failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const recipeSourceCount = input.recipes.length;
  const wallSourceCount = input.wallSourceCount ?? input.wallPayloads.length;
  const coreSourceCount = coreCases.length;
  const recipes = {
    source: recipeSourceCount,
    implemented: recipeSourceCount,
    evaluated: evaluatedRecipes,
    graphed: graphedRecipes,
    parseable: recipeSourceCount - unresolved.length,
  };
  const walls = {
    source: wallSourceCount,
    implemented: implementedWalls,
    graphed: 0,
    parseable: implementedWalls,
    simulatable: simulatableWalls,
  };
  const core = {
    source: coreSourceCount,
    implemented: coreSourceCount,
    evaluated: evaluatedCore,
    graphed: graphedCore,
    simulatable: graphedCore,
  };
  const complete = errors.length === 0
    && unresolved.length === 0
    && recipes.source === expectedRecipes
    && recipes.implemented === expectedRecipes
    && recipes.evaluated === expectedRecipes
    && recipes.graphed === expectedRecipes
    && walls.source === expectedWalls
    && walls.implemented === expectedWalls
    && walls.simulatable === expectedWalls
    && core.source > 0
    && core.implemented === core.source
    && core.evaluated === core.source
    && core.graphed === core.source
    && core.simulatable === core.source;

  return {
    schemaVersion: 1,
    generatedAt,
    audit: { precision: "float64-reproduction", wallTerms, wallDepth, wallMode },
    complete,
    recipes,
    walls,
    core,
    unresolved,
    errors,
  };
}

function completionSection(value: unknown, name: string, required: string[]): CompletionReport["recipes"] {
  if (!value || typeof value !== "object") throw new TypeError(`Completion ${name} section must be an object`);
  const source = value as Record<string, unknown>;
  for (const key of ["source", "implemented", "graphed", ...required]) {
    if (!Number.isSafeInteger(source[key]) || Number(source[key]) < 0) throw new TypeError(`Completion ${name}.${key} must be a non-negative integer`);
  }
  return source as unknown as CompletionReport["recipes"];
}

export function parseCompletionReport(value: unknown): CompletionReport {
  if (!value || typeof value !== "object") throw new TypeError("Completion report must be an object");
  const source = value as Record<string, unknown>;
  if (source.schemaVersion !== 1) throw new TypeError("Unsupported completion schema version");
  if (typeof source.generatedAt !== "string" || source.generatedAt.length === 0) throw new TypeError("Completion report requires a generation date");
  if (!Array.isArray(source.unresolved) || !source.unresolved.every((entry) => typeof entry === "string")) throw new TypeError("Completion unresolved entries must be strings");
  if (!Array.isArray(source.errors) || !source.errors.every((entry) => typeof entry === "string")) throw new TypeError("Completion errors must be strings");
  if (typeof source.complete !== "boolean") throw new TypeError("Completion status must be a boolean");
  completionSection(source.recipes, "recipes", ["evaluated"]);
  completionSection(source.walls, "walls", ["simulatable"]);
  completionSection(source.core, "core", ["evaluated", "simulatable"]);
  if (!source.audit || typeof source.audit !== "object") throw new TypeError("Completion report requires audit settings");
  return source as unknown as CompletionReport;
}
