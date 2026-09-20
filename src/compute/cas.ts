import { newtonRoot } from './calculus'

type NumericScope = Record<string, number>
type MathJs = typeof import('mathjs')

let mathjs: MathJs | undefined

export async function ensureMathjs(): Promise<void> {
  mathjs ??= await import('mathjs')
}

function math(): MathJs {
  if (!mathjs) throw new Error('mathjs is not loaded')
  return mathjs
}

export function symbolicDerivative(expression: string, variable: string, order = 1): string {
  const { derivative, simplify } = math()
  let node = derivative(expression, variable)
  for (let index = 1; index < order; index += 1) node = derivative(node, variable)
  return simplify(node).toString()
}

export function symbolicSimplify(expression: string): string {
  return math().simplify(expression).toString()
}

export function numericEvaluate(expression: string, scope: NumericScope = {}): number {
  const value = math().evaluate(expression, scope)
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value && typeof value === 'object' && 're' in value && typeof (value as { re: number }).re === 'number') {
    return (value as { re: number }).re
  }
  throw new TypeError(`mathjs produced a non-numeric result for ${expression}`)
}

export function compiledSampler(expression: string, variables: readonly string[]): (scope: NumericScope) => number {
  const compiled = math().parse(expression).compile()
  return (scope) => {
    const value = compiled.evaluate(scope)
    if (typeof value === 'number' && Number.isFinite(value)) return value
    throw new TypeError(`Cannot sample ${expression} at ${variables.join(',')}`)
  }
}

export function evaluateMatrixQuery(expression: string): { formatted: string } {
  const { det, eigs, evaluate, format, inv, matrix } = math()
  const match = expression.match(/^(det|inv|eigs?|eigenvalues?)\s*\(([\s\S]+)\)$/i)
  if (!match) return { formatted: format(evaluate(expression)) }
  const operand = matrix(parseMatrixLiteral(match[2]!))
  const command = match[1]!.toLowerCase()
  if (command === 'det') return { formatted: format(det(operand)) }
  if (command === 'inv') return { formatted: format(inv(operand)) }
  return { formatted: format(eigs(operand).values) }
}

export function solveResidual(expression: string, variable: string, guess = 1): { roots: number[]; residual: string } {
  const residual = toResidual(expression)
  const f = compiledSampler(residual, [variable])
  const roots: number[] = []
  for (const seed of [guess, -guess, 0.5, -0.5, 2, -2, 10, -10]) {
    const root = newtonRoot((x) => f({ [variable]: x }), seed)
    if (!Number.isFinite(root) || Math.abs(f({ [variable]: root })) > 1e-8) continue
    if (roots.some((existing) => Math.abs(existing - root) < 1e-7)) continue
    roots.push(root)
  }
  return { roots: roots.sort((left, right) => left - right), residual }
}

export function toLatex(expression: string): string {
  try {
    return math().parse(expression).toTex()
  } catch {
    return expression
  }
}

function parseMatrixLiteral(source: string): number[][] {
  const trimmed = source.trim()
  try {
    const parsed = JSON.parse(trimmed) as unknown
    return asNumericMatrix(parsed)
  } catch {
    if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) throw new SyntaxError(`Cannot parse matrix ${source}`)
    return trimmed.slice(1, -1).split(';').map((row) => row.split(',').map((cell) => Number(cell.trim())))
  }
}

function asNumericMatrix(value: unknown): number[][] {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError('matrix literal is not an array')
  if (value.every((row) => Array.isArray(row))) {
    return value.map((row) => (row as unknown[]).map((cell) => Number(cell)))
  }
  if (value.every((cell) => typeof cell === 'number')) return [value as number[]]
  throw new TypeError('matrix literal is not numeric')
}

function toResidual(equation: string): string {
  if (!equation.includes('=')) return equation
  const [left, right] = equation.split('=').map((part) => part.trim())
  if (!left || right === undefined) return equation
  return `(${left})-(${right || '0'})`
}
