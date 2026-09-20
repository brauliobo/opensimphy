import type { EvaluationSymbol } from '../types/engine'
import { complex } from '../engine/complex'
import { DIMENSIONLESS } from '../engine/dimensions'
import { ExpressionError, evaluateExpression } from '../engine/expression'
import { computeBaseSymbols } from './constants'
import { formatBasicDimensions, formatComplex, formatSiUnit } from './format'
import { ensureGiac, formatGiacExact, formatSolveList, giacEval, giacLatex, parseGiacNumber } from './giac'
import { parseComputeIntent } from './parse'
import { plotFunction2d, plotFunction3d } from './plots'
import { interpretDimension, QUANTITY_KIND_CAVEAT } from './quantities'
import { rewriteComputeQuery } from './rewrite'
import { EMPTY_COMPUTE_CONTEXT, type ComputeContext, type ComputeIntent, type ComputeResult } from './types'

type MathJs = typeof import('mathjs')
type Sampler = (extras: Record<string, number>) => number

let mathjs: MathJs | undefined

export async function evaluateQuery(query: string, context: ComputeContext = EMPTY_COMPUTE_CONTEXT): Promise<ComputeResult> {
  const rewritten = rewriteComputeQuery(query)
  if (!rewritten) return { query, rewritten, intent: { kind: 'evaluate', expression: '' }, interpretations: [], steps: [], warnings: [], error: 'Empty query.' }
  const intent = parseComputeIntent(rewritten)
  const symbols = { ...computeBaseSymbols(), ...context.symbols }
  const steps = [`Interpreted query as ${intent.kind}.`]
  if (rewritten !== query.trim()) steps.push(`Rewrote named constants to ${rewritten}.`)
  if (context.sourceLabel) steps.push(`Bound symbols from ${context.sourceLabel}.`)
  try {
    return await dispatch(query, rewritten, intent, symbols, context, steps)
  } catch (reason) {
    return {
      query,
      rewritten,
      intent,
      interpretations: [],
      steps,
      warnings:        context.notes,
      error:           reason instanceof Error ? reason.message : String(reason),
    }
  }
}

async function dispatch(
  query: string,
  rewritten: string,
  intent: ComputeIntent,
  symbols: Record<string, EvaluationSymbol>,
  context: ComputeContext,
  steps: string[],
): Promise<ComputeResult> {
  if (intent.kind === 'evaluate') return evaluateValue(query, rewritten, intent, symbols, context, steps)
  if (intent.kind === 'differentiate') return differentiate(query, rewritten, intent, symbols, context, steps)
  if (intent.kind === 'integrate') return integrate(query, rewritten, intent, symbols, context, steps)
  if (intent.kind === 'solve') return solve(query, rewritten, intent, context, steps)
  if (intent.kind === 'simplify') {
    await ensureGiac()
    const symbolic = giacEval(`simplify(${intent.expression})`)
    steps.push('Simplified with Giac/Xcas.')
    return baseResult(query, rewritten, intent, context, steps, { symbolic, latex: toLatex(symbolic), formatted: symbolic })
  }
  if (intent.kind === 'matrix') {
    await ensureGiac()
    const formatted = giacEval(intent.expression)
    steps.push('Evaluated the matrix command with Giac/Xcas.')
    return baseResult(query, rewritten, intent, context, steps, { formatted, symbolic: formatted })
  }
  if (intent.kind === 'plot2d') return plot2d(query, rewritten, intent, symbols, context, steps)
  return plot3d(query, rewritten, intent, symbols, context, steps)
}

async function evaluateValue(
  query: string,
  rewritten: string,
  intent: ComputeIntent,
  symbols: Record<string, EvaluationSymbol>,
  context: ComputeContext,
  steps: string[],
): Promise<ComputeResult> {
  try {
    const evaluated = evaluateExpression(intent.expression, symbols)
    const interpretations = interpretDimension(evaluated.dimension)
    steps.push('Evaluated with the monastery-compatible dimensional engine.')
    return baseResult(query, rewritten, intent, context, steps, {
      value:                 evaluated.value,
      dimension:             evaluated.dimension,
      siUnit:                formatSiUnit(evaluated.dimension),
      basicDimensions:       formatBasicDimensions(evaluated.dimension),
      formatted:             `${formatComplex(evaluated.value)} ${formatSiUnit(evaluated.dimension)}`.trim(),
      interpretations,
      interpretationCaveat:  interpretations.length ? QUANTITY_KIND_CAVEAT : undefined,
    })
  } catch (reason) {
    if (!(reason instanceof ExpressionError)) throw reason
    if (!isCasRecoverable(reason)) throw reason
    await ensureGiac()
    steps.push('Evaluated with the Giac/Xcas computer algebra system.')
    const raw = giacEval(intent.expression)
    const numeric = parseGiacNumber(raw)
    if (numeric !== undefined) {
      return baseResult(query, rewritten, intent, context, steps, {
        value:     complex(numeric),
        dimension: DIMENSIONLESS,
        siUnit:    '1',
        formatted: formatGiacExact(raw),
      })
    }
    return baseResult(query, rewritten, intent, context, steps, {
      formatted: raw,
      symbolic:  raw,
      latex:     toLatex(raw),
    })
  }
}

async function differentiate(
  query: string,
  rewritten: string,
  intent: ComputeIntent,
  symbols: Record<string, EvaluationSymbol>,
  context: ComputeContext,
  steps: string[],
): Promise<ComputeResult> {
  await ensureGiac()
  const variable = intent.variable ?? 'x'
  const spec = (intent.order ?? 1) > 1 ? `${intent.expression},${variable},${intent.order}` : `${intent.expression},${variable}`
  const symbolic = giacEval(`normal(diff(${spec}))`)
  steps.push(`Symbolic derivative with Giac/Xcas with respect to ${variable}.`)
  const sample = await makeSampler(symbolic, symbols, [variable])
  return baseResult(query, rewritten, intent, context, steps, {
    symbolic,
    latex:     toLatex(symbolic),
    formatted: symbolic,
    figure:    plotFunction2d((x) => sample({ [variable]: x }), -8, 8, `d/d${variable}`),
  })
}

async function integrate(
  query: string,
  rewritten: string,
  intent: ComputeIntent,
  symbols: Record<string, EvaluationSymbol>,
  context: ComputeContext,
  steps: string[],
): Promise<ComputeResult> {
  await ensureGiac()
  const variable = intent.variable ?? 'x'
  if (intent.from === undefined || intent.to === undefined) {
    const symbolic = giacEval(`integrate(${intent.expression},${variable})`)
    steps.push(`Indefinite integral with Giac/Xcas with respect to ${variable}.`)
    return baseResult(query, rewritten, intent, context, steps, {
      formatted: symbolic,
      symbolic,
      latex:     toLatex(symbolic),
    })
  }
  let raw: string
  let numerical = false
  try {
    raw = giacEval(`simplify(int(${intent.expression},${variable},${intent.from},${intent.to}))`)
  } catch {
    raw = giacEval(`evalf(int(${intent.expression},${variable},${intent.from},${intent.to}))`)
    numerical = true
  }
  const exact = formatGiacExact(raw)
  const numeric = parseGiacNumber(raw) ?? parseGiacNumber(giacEval(`evalf(${exact})`))
  if (numeric === undefined || !Number.isFinite(numeric)) throw new TypeError(`Giac integral was not numeric: ${raw}`)
  steps.push(numerical
    ? `Numerical integral with Giac/Xcas evalf of ${intent.expression} d${variable} from ${intent.from} to ${intent.to}.`
    : `Definite integral with Giac/Xcas of ${intent.expression} d${variable} from ${intent.from} to ${intent.to}.`)
  const fromNum = Number(intent.from)
  const toNum = Number(intent.to)
  const sample = Number.isFinite(fromNum) && Number.isFinite(toNum)
    ? await makeSampler(intent.expression, symbols, [variable])
    : undefined
  return baseResult(query, rewritten, intent, context, steps, {
    value:     complex(numeric),
    dimension: DIMENSIONLESS,
    siUnit:    '1',
    formatted: exact,
    symbolic:  exact,
    latex:     toLatex(exact),
    figure:    sample
      ? plotFunction2d((x) => sample({ [variable]: x }), fromNum, toNum, intent.expression)
      : undefined,
  })
}

async function solve(
  query: string,
  rewritten: string,
  intent: ComputeIntent,
  context: ComputeContext,
  steps: string[],
): Promise<ComputeResult> {
  const variable = intent.variable ?? 'x'
  const equation = intent.equation ?? intent.expression
  await ensureGiac()
  let formatted = formatSolveList(giacEval(`solve(${equation},${variable})`), variable)
  if (!formatted) {
    formatted = formatSolveList(giacEval(`fsolve(${equation},${variable})`), variable)
    if (!formatted) throw new RangeError(`No root from Giac for ${intent.expression}`)
    steps.push(`Numerical root with Giac/Xcas fsolve for ${variable}.`)
  } else {
    steps.push(`Solved with Giac/Xcas for ${variable}.`)
  }
  const roots = [...formatted.matchAll(/=\s*([-+0-9.eE]+)/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value))
  return baseResult(query, rewritten, intent, context, steps, {
    formatted,
    symbolic:  formatted,
    value:     roots[0] === undefined ? undefined : complex(roots[0]),
    dimension: DIMENSIONLESS,
  })
}

async function plot2d(
  query: string,
  rewritten: string,
  intent: ComputeIntent,
  symbols: Record<string, EvaluationSymbol>,
  context: ComputeContext,
  steps: string[],
): Promise<ComputeResult> {
  const variable = intent.variable ?? 'x'
  const from = intent.xFrom ?? -8
  const to = intent.xTo ?? 8
  const sample = await makeSampler(intent.expression, symbols, [variable])
  steps.push(`Sampled ${intent.expression} versus ${variable} from ${from} to ${to}.`)
  return baseResult(query, rewritten, intent, context, steps, {
    formatted: intent.expression,
    figure:    plotFunction2d((x) => sample({ [variable]: x }), from, to, intent.expression),
  })
}

async function plot3d(
  query: string,
  rewritten: string,
  intent: ComputeIntent,
  symbols: Record<string, EvaluationSymbol>,
  context: ComputeContext,
  steps: string[],
): Promise<ComputeResult> {
  const xFrom = intent.xFrom ?? -8
  const xTo = intent.xTo ?? 8
  const yFrom = intent.yFrom ?? -8
  const yTo = intent.yTo ?? 8
  const sample = await makeSampler(intent.expression, symbols, ['x', 'y'])
  steps.push(`Sampled ${intent.expression} on a 36×36 grid.`)
  return baseResult(query, rewritten, intent, context, steps, {
    formatted: intent.expression,
    figure:    plotFunction3d((x, y) => sample({ x, y }), xFrom, xTo, yFrom, yTo, intent.expression),
  })
}

async function makeSampler(
  expression: string,
  symbols: Record<string, EvaluationSymbol>,
  variables: readonly string[],
): Promise<Sampler> {
  const probe = Object.fromEntries(variables.map((name) => [name, 0.125]))
  try {
    evaluateBound(expression, symbols, probe)
    return (extras) => evaluateBound(expression, symbols, extras)
  } catch (reason) {
    if (!(reason instanceof ExpressionError)) throw reason
    mathjs ??= await import('mathjs')
    const compiled = mathjs.parse(expression).compile()
    const scope = numericScope(symbols)
    return (extras) => {
      const value = compiled.evaluate({ ...scope, ...extras })
      if (typeof value === 'number' && Number.isFinite(value)) return value
      throw new TypeError(`Cannot sample ${expression} at ${variables.join(',')}`)
    }
  }
}

function evaluateBound(expression: string, symbols: Record<string, EvaluationSymbol>, extras: Record<string, number>): number {
  const bound = { ...symbols }
  for (const [name, value] of Object.entries(extras)) {
    bound[name] = { value: complex(value), dimension: DIMENSIONLESS, source: 'parameter' }
  }
  return evaluateExpression(expression, bound).value.re
}

function toLatex(expression: string): string {
  try {
    return giacLatex(expression)
  } catch {
    return expression
  }
}

function isCasRecoverable(reason: ExpressionError): boolean {
  return Boolean(reason.unknownSymbol)
    || reason.message.startsWith('Unknown function')
    || reason.message.startsWith('Unsupported token')
}

function numericScope(symbols: Record<string, EvaluationSymbol>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(symbols)
      .filter(([, symbol]) => Math.abs(symbol.value.im) <= 1e-15)
      .map(([name, symbol]) => [name, symbol.value.re]),
  )
}

function baseResult(
  query: string,
  rewritten: string,
  intent: ComputeIntent,
  context: ComputeContext,
  steps: string[],
  rest: Partial<ComputeResult>,
): ComputeResult {
  return {
    query,
    rewritten,
    intent,
    interpretations: [],
    steps,
    warnings:        [...context.notes],
    ...rest,
  }
}
