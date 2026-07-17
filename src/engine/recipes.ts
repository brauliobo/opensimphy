import type {
  DimensionAudit,
  EvaluationSymbol,
  GraphPoint,
  PrimitiveSymbolSource,
  RecipeBatchResult,
  RecipeEvaluation,
  RecipeSource,
  RatioSource,
  SimulationGraph,
} from "../types/engine.js";
import { add, complex, divide, exp, isFiniteComplex, log, magnitude, multiply, nearlyReal, parseComplex, subtract, ZERO } from "./complex.js";
import { DIMENSIONLESS, dimensionsEqual, formatDimension, UNIT_SYMBOLS } from "./dimensions.js";
import { defaultExpressionSymbols, evaluateExpression, ExpressionError, type EvaluatedExpression } from "./expression.js";

export const RECIPE_ABSOLUTE_TOLERANCE = 1e-300;
// Ordinary formulas stay within a few ulps of the 180-digit source run. Subtractive
// constructors also receive a forward-error allowance because they cancel numbers near one.
export const RECIPE_RELATIVE_TOLERANCE = 5e-12;
export const DEFAULT_GRAPH_STEPS = 65;

function expectedMeasurement(source: number | string): { value: number; sigma: number | null } {
  if (typeof source === "number") return { value: source, sigma: null };
  const match = source.trim().match(/^([+-]?(?:\d+\.?\d*|\.\d+))(?:\((\d+)\))?(?:[eE]([+-]?\d+))?$/);
  if (!match) throw new Error(`Invalid expected measurement: ${source}`);
  const exponent = Number(match[3] ?? 0);
  const mantissa = match[1]!;
  const value = Number(`${mantissa}e${exponent}`);
  if (!match[2]) return { value, sigma: null };
  const decimals = mantissa.includes(".") ? mantissa.length - mantissa.indexOf(".") - 1 : 0;
  return { value, sigma: Number(match[2]) * 10 ** (exponent - decimals) };
}

function productRatio(source: RatioSource, symbols: Readonly<Record<string, EvaluationSymbol>>): EvaluatedExpression {
  let logarithm = ZERO;
  let dimension = DIMENSIONLESS;
  const dependencies: string[] = [];
  for (const factor of source.numerator) {
    const evaluated = evaluateExpression(factor, symbols);
    logarithm = add(logarithm, log(evaluated.value));
    dimension = {
      time: dimension.time + evaluated.dimension.time,
      length: dimension.length + evaluated.dimension.length,
      charge: dimension.charge + evaluated.dimension.charge,
      temperature: dimension.temperature + evaluated.dimension.temperature,
      mass: dimension.mass + evaluated.dimension.mass,
    };
    dependencies.push(...evaluated.dependencies);
  }
  for (const factor of source.denominator) {
    const evaluated = evaluateExpression(factor, symbols);
    logarithm = subtract(logarithm, log(evaluated.value));
    dimension = {
      time: dimension.time - evaluated.dimension.time,
      length: dimension.length - evaluated.dimension.length,
      charge: dimension.charge - evaluated.dimension.charge,
      temperature: dimension.temperature - evaluated.dimension.temperature,
      mass: dimension.mass - evaluated.dimension.mass,
    };
    dependencies.push(...evaluated.dependencies);
  }
  return {
    value: exp(logarithm),
    dimension,
    dependencies: [...new Set(dependencies)],
  };
}

function evaluateFormula(recipe: RecipeSource, symbols: Readonly<Record<string, EvaluationSymbol>>, inversionScale = 1): EvaluatedExpression {
  const externalGeometry = productRatio(recipe.external_geometry, symbols);
  const externalBoundary = productRatio(recipe.external_boundary, symbols);
  const inversionGeometry = productRatio(recipe.inversion_geometry, symbols);
  const root = evaluateExpression(recipe.root_transform.id, symbols);
  const boundary = symbols.IB;
  if (!boundary) throw new ExpressionError("Unknown symbol 'IB'", recipe.constant_id, 0, "IB");

  const inversion = multiply(multiply(inversionGeometry.value, root.value), complex(boundary.value.re * inversionScale, boundary.value.im * inversionScale));
  const bracket = { re: 1 + inversion.re, im: inversion.im };
  const externalDimension = {
    time: externalGeometry.dimension.time + externalBoundary.dimension.time,
    length: externalGeometry.dimension.length + externalBoundary.dimension.length,
    charge: externalGeometry.dimension.charge + externalBoundary.dimension.charge,
    temperature: externalGeometry.dimension.temperature + externalBoundary.dimension.temperature,
    mass: externalGeometry.dimension.mass + externalBoundary.dimension.mass,
  };
  const inversionDimension = {
    time: inversionGeometry.dimension.time + root.dimension.time + boundary.dimension.time,
    length: inversionGeometry.dimension.length + root.dimension.length + boundary.dimension.length,
    charge: inversionGeometry.dimension.charge + root.dimension.charge + boundary.dimension.charge,
    temperature: inversionGeometry.dimension.temperature + root.dimension.temperature + boundary.dimension.temperature,
    mass: inversionGeometry.dimension.mass + root.dimension.mass + boundary.dimension.mass,
  };
  if (!dimensionsEqual(inversionDimension, DIMENSIONLESS)) throw new Error(`Inversion term for ${recipe.constant_id} is not dimensionless (${formatDimension(inversionDimension)})`);
  let value;
  let dimension = externalDimension;
  if (recipe.combine === "-") {
    if (!dimensionsEqual(externalDimension, DIMENSIONLESS)) throw new Error(`Subtractive constructor for ${recipe.constant_id} requires dimensionless external terms`);
    value = subtract(multiply(externalGeometry.value, externalBoundary.value), bracket);
  } else if (recipe.combine === "inversion") {
    value = divide(multiply(externalGeometry.value, externalBoundary.value), bracket);
  } else if (recipe.combine === "+") {
    if (!dimensionsEqual(externalGeometry.dimension, externalBoundary.dimension)) throw new Error(`Additive constructor for ${recipe.constant_id} has incompatible external terms`);
    value = add(externalGeometry.value, multiply(externalBoundary.value, bracket));
    dimension = externalGeometry.dimension;
  } else {
    const external = productRatio({
      numerator: [...recipe.external_geometry.numerator, ...recipe.external_boundary.numerator],
      denominator: [...recipe.external_geometry.denominator, ...recipe.external_boundary.denominator],
    }, symbols);
    value = multiply(external.value, bracket);
  }
  return {
    value,
    dimension,
    dependencies: [...new Set([
      ...externalGeometry.dependencies,
      ...externalBoundary.dependencies,
      ...inversionGeometry.dependencies,
      ...root.dependencies,
      "IB",
    ])],
  };
}

function dimensionAudit(recipe: RecipeSource, computed: EvaluatedExpression): DimensionAudit {
  try {
    const declared = evaluateExpression(recipe.dimension, UNIT_SYMBOLS).dimension;
    const matches = dimensionsEqual(declared, computed.dimension);
    return {
      declared: recipe.dimension,
      declaredVector: declared,
      computedVector: computed.dimension,
      matches,
      finding: matches ? null : `Source declaration ${recipe.dimension} resolves to ${formatDimension(declared)}, formula resolves to ${formatDimension(computed.dimension)}`,
    };
  } catch (error) {
    return {
      declared: recipe.dimension,
      declaredVector: null,
      computedVector: computed.dimension,
      matches: false,
      finding: `Source declaration could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function graphPoint(x: number, value: { re: number; im: number }): GraphPoint {
  const absolute = magnitude(value);
  const finite = isFiniteComplex(value) && Number.isFinite(absolute);
  return {
    x,
    y: value.re,
    imaginary: value.im,
    magnitude: absolute,
    sign: value.re === 0 ? 0 : value.re > 0 ? 1 : -1,
    log10Abs: finite && absolute > 0 ? Math.log10(absolute) : null,
    finite,
  };
}

function buildGraph(recipe: RecipeSource, symbols: Readonly<Record<string, EvaluationSymbol>>, computed: number, expected: number, steps: number): SimulationGraph {
  if (!Number.isSafeInteger(steps) || steps < 3 || steps > 1001) throw new RangeError("Graph steps must be an integer from 3 through 1001");
  const points = Array.from({ length: steps }, (_, index) => {
    const scale = (2 * index) / (steps - 1);
    return graphPoint(scale, evaluateFormula(recipe, symbols, scale).value);
  });
  return {
    parameter: "inversion-boundary-scale",
    precision: "float64-reproduction",
    points,
    markers: [
      { x: 1, y: computed, label: "computed" },
      { x: 1, y: expected, label: "expected" },
    ],
    graphReady: points.length > 0 && points.every((point) => point.finite),
  };
}

export function createPrimitiveSymbols(sources: PrimitiveSymbolSource[]): Record<string, EvaluationSymbol> {
  const symbols = defaultExpressionSymbols();
  for (const source of sources) {
    let dimension = DIMENSIONLESS;
    if (source.dimension !== "-") dimension = evaluateExpression(source.dimension, UNIT_SYMBOLS).dimension;
    symbols[source.token] = { value: parseComplex(source.value), dimension, source: "primitive" };
  }
  return symbols;
}

export interface RecipeEvaluationOptions {
  graphSteps?: number;
  relativeTolerance?: number;
  absoluteTolerance?: number;
}

export function evaluateRecipes(
  recipes: RecipeSource[],
  primitiveSources: PrimitiveSymbolSource[],
  options: RecipeEvaluationOptions = {},
): RecipeBatchResult {
  const symbols = createPrimitiveSymbols(primitiveSources);
  const pending = new Map(recipes.map((recipe) => [recipe.recipe_number, recipe]));
  const evaluations: RecipeEvaluation[] = [];
  const errors: RecipeBatchResult["errors"] = [];
  const graphSteps = options.graphSteps ?? DEFAULT_GRAPH_STEPS;
  const relativeTolerance = options.relativeTolerance ?? RECIPE_RELATIVE_TOLERANCE;
  const absoluteTolerance = options.absoluteTolerance ?? RECIPE_ABSOLUTE_TOLERANCE;
  let pass = 0;

  while (pending.size > 0) {
    pass += 1;
    let built = 0;
    for (const [number, recipe] of [...pending]) {
      try {
        const computed = evaluateFormula(recipe, symbols);
        const scalarValue = nearlyReal(computed.value);
        const modelValue = Number(recipe.model_value);
        const expected = expectedMeasurement(recipe.expected_value);
        if (!Number.isFinite(scalarValue) || !Number.isFinite(modelValue) || !Number.isFinite(expected.value)) throw new Error("Recipe produced a non-finite scalar");
        const modelResidual = scalarValue - modelValue;
        const relativeModelError = Math.abs(modelResidual) / Math.max(Math.abs(modelValue), Number.MIN_VALUE);
        const cancellationTolerance = recipe.combine === "-"
          ? 64 * Number.EPSILON * Math.max(1, Math.abs(scalarValue), Math.abs(modelValue))
          : 0;
        const tolerance = Math.max(absoluteTolerance, relativeTolerance * Math.abs(modelValue), cancellationTolerance);
        const residual = scalarValue - expected.value;
        const graph = buildGraph(recipe, symbols, scalarValue, expected.value, graphSteps);
        const evaluation: RecipeEvaluation = {
          recipeNumber: recipe.recipe_number,
          id: recipe.constant_id,
          name: recipe.display_name,
          value: computed.value,
          scalarValue,
          modelValue,
          expectedValue: expected.value,
          expectedSigma: expected.sigma,
          residual,
          relativeModelError,
          zScore: expected.sigma ? residual / expected.sigma : null,
          modelParity: Math.abs(modelResidual) <= tolerance,
          precision: "float64-reproduction",
          buildPass: pass,
          dependencies: computed.dependencies,
          formula: recipe.combine === "-"
            ? "(EG * EB) - (1 + IG * R * IB)"
            : recipe.combine === "inversion"
              ? "(EG * EB) / (1 + IG * R * IB)"
              : recipe.combine === "+"
                ? "EG + EB * (1 + IG * R * IB)"
                : "(EG * EB) * (1 + IG * R * IB)",
          dimensionAudit: dimensionAudit(recipe, computed),
          graph,
          graphReady: graph.graphReady,
        };
        evaluations.push(evaluation);
        symbols[recipe.constant_id] = { value: computed.value, dimension: computed.dimension, source: "recipe" };
        pending.delete(number);
        built += 1;
      } catch (error) {
        if (error instanceof ExpressionError && error.unknownSymbol) continue;
        errors.push({ recipeNumber: recipe.recipe_number, id: recipe.constant_id, error: error instanceof Error ? error.message : String(error) });
        pending.delete(number);
      }
    }
    if (built === 0) break;
    if (pass > recipes.length) throw new Error("Recipe dependency build exceeded source count");
  }

  const unresolved = [...pending.values()].map((recipe) => {
    try {
      evaluateFormula(recipe, symbols);
      return { recipeNumber: recipe.recipe_number, id: recipe.constant_id, error: "Unresolved dependency" };
    } catch (error) {
      return { recipeNumber: recipe.recipe_number, id: recipe.constant_id, error: error instanceof Error ? error.message : String(error) };
    }
  });
  evaluations.sort((left, right) => left.recipeNumber - right.recipeNumber);
  return { evaluations, unresolved, errors, passes: pass, precision: "float64-reproduction" };
}

export async function loadRecipeSources(baseUrl = "/data/generated"): Promise<{ recipes: RecipeSource[]; symbols: PrimitiveSymbolSource[] }> {
  const [recipeResponse, symbolResponse] = await Promise.all([fetch(`${baseUrl}/recipes.json`), fetch(`${baseUrl}/symbols.json`)]);
  if (!recipeResponse.ok || !symbolResponse.ok) throw new Error(`Failed to load recipe sources (${recipeResponse.status}, ${symbolResponse.status})`);
  return { recipes: await recipeResponse.json() as RecipeSource[], symbols: await symbolResponse.json() as PrimitiveSymbolSource[] };
}
