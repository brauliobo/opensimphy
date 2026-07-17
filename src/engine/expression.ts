import type { ComplexValue, DimensionVector, EvaluationSymbol } from "../types/engine.js";
import {
  add,
  complex,
  cos,
  cosh,
  divide,
  exp,
  I,
  log,
  multiply,
  negate,
  nearlyReal,
  power,
  sin,
  sinh,
  subtract,
} from "./complex.js";
import {
  addDimensions,
  DIMENSIONLESS,
  dimensionsEqual,
  isDimensionless,
  scaleDimension,
  subtractDimensions,
} from "./dimensions.js";

export interface EvaluatedExpression extends EvaluationSymbol {
  dependencies: string[];
}

interface Token {
  type: "number" | "identifier" | "operator" | "eof";
  text: string;
  value?: number;
}

export class ExpressionError extends Error {
  constructor(message: string, public readonly expression: string, public readonly offset: number, public readonly unknownSymbol?: string) {
    super(`${message} at ${offset} in "${expression}"`);
    this.name = "ExpressionError";
  }
}

function factorial(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 170) throw new RangeError(`Factorial requires an integer from 0 through 170, received ${value}`);
  let result = 1;
  for (let index = 2; index <= value; index += 1) result *= index;
  return result;
}

function subfactorial(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 170) throw new RangeError(`Subfactorial requires an integer from 0 through 170, received ${value}`);
  if (value === 0) return 1;
  if (value === 1) return 0;
  let previous = 1;
  let current = 0;
  for (let index = 2; index <= value; index += 1) [previous, current] = [current, (index - 1) * (current + previous)];
  return current;
}

function gammaReal(value: number): number {
  if (Number.isSafeInteger(value) && value > 0) return factorial(value - 1);
  const coefficients = [
    0.9999999999998099,
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];
  if (value < 0.5) return Math.PI / (Math.sin(Math.PI * value) * gammaReal(1 - value));
  const shifted = value - 1;
  let series = coefficients[0]!;
  for (let index = 1; index < coefficients.length; index += 1) series += coefficients[index]! / (shifted + index);
  const t = shifted + 7.5;
  return Math.sqrt(2 * Math.PI) * t ** (shifted + 0.5) * Math.exp(-t) * series;
}

function zetaInteger(value: number): number {
  if (!Number.isSafeInteger(value) || value < 2) throw new RangeError(`zeta currently requires an integer >= 2, received ${value}`);
  if (value === 2) return Math.PI ** 2 / 6;
  if (value === 3) return 1.2020569031595942;
  let sum = 0;
  for (let index = 1; index <= 100_000; index += 1) sum += index ** -value;
  return sum;
}

function mergeDependencies(...groups: string[][]): string[] {
  return [...new Set(groups.flat())];
}

function quantity(value: ComplexValue, dimension: DimensionVector, dependencies: string[] = []): EvaluatedExpression {
  return { value, dimension, dependencies };
}

export function evaluateExpression(expression: string, symbols: Readonly<Record<string, EvaluationSymbol>>): EvaluatedExpression {
  const source = expression.trim();
  if (!source) throw new ExpressionError("Empty expression", expression, 0);
  if (symbols[source]) return quantity(symbols[source].value, symbols[source].dimension, [source]);

  const symbolNames = Object.keys(symbols).filter((name) => name && !/[\s]/.test(name)).sort((left, right) => right.length - left.length);
  let offset = 0;
  let current: Token;

  function nextToken(): Token {
    while (/\s/.test(source[offset] ?? "")) offset += 1;
    if (offset >= source.length) return { type: "eof", text: "" };
    const rest = source.slice(offset);
    const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) {
      offset += number[0].length;
      return { type: "number", text: number[0], value: Number(number[0]) };
    }
    const character = rest[0]!;
    if ("+-*/^!(),".includes(character)) {
      offset += 1;
      return { type: "operator", text: character };
    }
    const known = symbolNames.find((name) => rest.startsWith(name));
    if (known) {
      offset += known.length;
      return { type: "identifier", text: known };
    }
    const identifier = rest.match(/^[\p{L}\p{M}_∞][\p{L}\p{M}\p{N}_∞]*/u);
    if (identifier) {
      offset += identifier[0].length;
      return { type: "identifier", text: identifier[0] };
    }
    throw new ExpressionError(`Unsupported token '${rest[0]}'`, source, offset);
  }

  function advance(): Token {
    const previous = current;
    current = nextToken();
    return previous;
  }

  function expect(text: string): void {
    if (current.text !== text) throw new ExpressionError(`Expected '${text}', found '${current.text || "end"}'`, source, offset);
    advance();
  }

  function addQuantities(left: EvaluatedExpression, right: EvaluatedExpression, subtractRight = false): EvaluatedExpression {
    if (!dimensionsEqual(left.dimension, right.dimension)) throw new ExpressionError("Cannot add values with different dimensions", source, offset);
    return quantity(subtractRight ? subtract(left.value, right.value) : add(left.value, right.value), left.dimension, mergeDependencies(left.dependencies, right.dependencies));
  }

  function multiplyQuantities(left: EvaluatedExpression, right: EvaluatedExpression, divideRight = false): EvaluatedExpression {
    return quantity(
      divideRight ? divide(left.value, right.value) : multiply(left.value, right.value),
      divideRight ? subtractDimensions(left.dimension, right.dimension) : addDimensions(left.dimension, right.dimension),
      mergeDependencies(left.dependencies, right.dependencies),
    );
  }

  function startsPrimary(token: Token): boolean {
    return token.type === "number" || token.type === "identifier" || token.text === "(" || token.text === "!";
  }

  function parseAdditive(): EvaluatedExpression {
    let left = parseMultiplicative();
    while (current.text === "+" || current.text === "-") {
      const operator = advance().text;
      left = addQuantities(left, parseMultiplicative(), operator === "-");
    }
    return left;
  }

  function parseMultiplicative(): EvaluatedExpression {
    let left = parseUnary();
    while (current.text === "*" || current.text === "/" || startsPrimary(current)) {
      const operator = current.text === "*" || current.text === "/" ? advance().text : "*";
      left = multiplyQuantities(left, parseUnary(), operator === "/");
    }
    return left;
  }

  function parseUnary(): EvaluatedExpression {
    if (current.text === "+") {
      advance();
      return parseUnary();
    }
    if (current.text === "-") {
      advance();
      const operand = parseUnary();
      return quantity(negate(operand.value), operand.dimension, operand.dependencies);
    }
    if (current.text === "!") {
      advance();
      const operand = parseUnary();
      if (!isDimensionless(operand.dimension)) throw new ExpressionError("Subfactorial argument must be dimensionless", source, offset);
      return quantity(complex(subfactorial(nearlyReal(operand.value))), DIMENSIONLESS, operand.dependencies);
    }
    return parsePower();
  }

  function parsePower(): EvaluatedExpression {
    let base = parsePostfix();
    if (current.text === "^") {
      advance();
      const exponent = parseUnary();
      if (!isDimensionless(exponent.dimension)) throw new ExpressionError("Exponent must be dimensionless", source, offset);
      const scalar = nearlyReal(exponent.value);
      base = quantity(power(base.value, exponent.value), scaleDimension(base.dimension, scalar), mergeDependencies(base.dependencies, exponent.dependencies));
    }
    return base;
  }

  function parsePostfix(): EvaluatedExpression {
    let result = parsePrimary();
    while (current.text === "!") {
      advance();
      if (!isDimensionless(result.dimension)) throw new ExpressionError("Factorial argument must be dimensionless", source, offset);
      result = quantity(complex(factorial(nearlyReal(result.value))), DIMENSIONLESS, result.dependencies);
    }
    return result;
  }

  function call(name: string, argument: EvaluatedExpression): EvaluatedExpression {
    if (!isDimensionless(argument.dimension) && name !== "Re" && name !== "Im") throw new ExpressionError(`${name} argument must be dimensionless`, source, offset);
    const dependencies = argument.dependencies;
    if (name === "Re") return quantity(complex(argument.value.re), argument.dimension, dependencies);
    if (name === "Im") return quantity(complex(argument.value.im), argument.dimension, dependencies);
    if (name === "zeta" || name === "ζ") return quantity(complex(zetaInteger(nearlyReal(argument.value))), DIMENSIONLESS, dependencies);
    if (name === "gamma" || name === "Γ") return quantity(complex(gammaReal(nearlyReal(argument.value))), DIMENSIONLESS, dependencies);
    if (name === "log" || name === "ln") return quantity(log(argument.value), DIMENSIONLESS, dependencies);
    if (name === "exp") return quantity(exp(argument.value), DIMENSIONLESS, dependencies);
    if (name === "sqrt") return quantity(power(argument.value, complex(0.5)), scaleDimension(argument.dimension, 0.5), dependencies);
    if (name === "sin") return quantity(sin(argument.value), DIMENSIONLESS, dependencies);
    if (name === "cos") return quantity(cos(argument.value), DIMENSIONLESS, dependencies);
    if (name === "sinh") return quantity(sinh(argument.value), DIMENSIONLESS, dependencies);
    if (name === "cosh") return quantity(cosh(argument.value), DIMENSIONLESS, dependencies);
    throw new ExpressionError(`Unknown function '${name}'`, source, offset, name);
  }

  function parsePrimary(): EvaluatedExpression {
    if (current.type === "number") return quantity(complex(advance().value!), DIMENSIONLESS);
    if (current.text === "(") {
      advance();
      const result = parseAdditive();
      expect(")");
      return result;
    }
    if (current.type === "identifier") {
      const name = advance().text;
      if (current.text === "(") {
        advance();
        const argument = parseAdditive();
        expect(")");
        return call(name, argument);
      }
      const symbol = symbols[name];
      if (!symbol) throw new ExpressionError(`Unknown symbol '${name}'`, source, offset, name);
      return quantity(symbol.value, symbol.dimension, [name]);
    }
    throw new ExpressionError(`Expected a value, found '${current.text || "end"}'`, source, offset);
  }

  current = nextToken();
  const result = parseAdditive();
  if (current.type !== "eof") throw new ExpressionError(`Unexpected token '${current.text}'`, source, offset);
  return result;
}

export function defaultExpressionSymbols(): Record<string, EvaluationSymbol> {
  return {
    pi: { value: complex(Math.PI), dimension: DIMENSIONLESS, source: "primitive" },
    π: { value: complex(Math.PI), dimension: DIMENSIONLESS, source: "primitive" },
    e: { value: complex(Math.E), dimension: DIMENSIONLESS, source: "primitive" },
    i: { value: I, dimension: DIMENSIONLESS, source: "primitive" },
  };
}
