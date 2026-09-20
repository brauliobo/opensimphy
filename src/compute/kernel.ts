import type { EvaluationSymbol } from '../types/engine'
import { complex } from '../engine/complex'
import { DIMENSIONLESS, isDimensionless } from '../engine/dimensions'
import { ExpressionError, evaluateExpression } from '../engine/expression'
import { adaptiveSimpson } from './calculus'
import {
  compiledSampler,
  ensureMathjs,
  evaluateMatrixQuery,
  numericEvaluate,
  solveResidual,
  symbolicDerivative,
  symbolicSimplify,
  toLatex,
} from './cas'
import { computeBaseSymbols } from './constants'
import { formatBasicDimensions, formatComplex, formatScalar, formatSiUnit } from './format'
import { parseComputeIntent } from './parse'
import { plotFunction2d, plotFunction3d } from './plots'
import { interpretDimension, QUANTITY_KIND_CAVEAT } from './quantities'
import { rewriteComputeQuery } from './rewrite'
import { EMPTY_COMPUTE_CONTEXT, type ComputeContext, type ComputeIntent, type ComputeResult } from './types'

export async function evaluateQuery(query: string, context: ComputeContext = EMPTY_COMPUTE_CONTEXT): Promise<ComputeResult> {
  await ensureMathjs()
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
    const symbolic = symbolicSimplify(intent.expression)
    return baseResult(query, rewritten, intent, context, steps, { symbolic, latex: toLatex(symbolic), formatted: symbolic })
  }
  if (intent.kind === 'matrix') {
    const matrix = evaluateMatrixQuery(intent.expression)
    return baseResult(query, rewritten, intent, context, steps, { formatted: matrix.formatted, symbolic: matrix.formatted })
  }
  if (intent.kind === 'plot2d') return plot2d(query, rewritten, intent, symbols, context, steps)
  return plot3d(query, rewritten, intent, symbols, context, steps)
}

function evaluateValue(
  query: string,
  rewritten: string,
  intent: ComputeIntent,
  symbols: Record<string, EvaluationSymbol>,
  context: ComputeContext,
  steps: string[],
): ComputeResult {
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
    steps.push('Evaluated as a dimensionless CAS expression with mathjs.')
    const value = numericEvaluate(intent.expression, numericScope(symbols))
    return baseResult(query, rewritten, intent, context, steps, {
      value:       complex(value),
      dimension:   DIMENSIONLESS,
      siUnit:      '1',
      formatted:   formatScalar(value),
      interpretations: [],
    })
  }
}

function differentiate(
  query: string,
  rewritten: string,
  intent: ComputeIntent,
  symbols: Record<string, EvaluationSymbol>,
  context: ComputeContext,
  steps: string[],
): ComputeResult {
  const variable = intent.variable ?? 'x'
  const symbolic = symbolicDerivative(intent.expression, variable, intent.order ?? 1)
  steps.push(`Symbolic derivative with respect to ${variable}.`)
  return baseResult(query, rewritten, intent, context, steps, {
    symbolic,
    latex:     toLatex(symbolic),
    formatted: symbolic,
    figure:    plotFunction2d((x) => sampleExpression(symbolic, symbols, { [variable]: x }), -8, 8, `d/d${variable}`),
  })
}

function integrate(
  query: string,
  rewritten: string,
  intent: ComputeIntent,
  symbols: Record<string, EvaluationSymbol>,
  context: ComputeContext,
  steps: string[],
): ComputeResult {
  const variable = intent.variable ?? 'x'
  if (intent.from === undefined || intent.to === undefined) {
    return baseResult(query, rewritten, intent, context, steps, {
      error: 'Indefinite symbolic integration is not in the fast kernel. Supply limits, for example: integrate x^2 from 0 to 1.',
    })
  }
  const from = numericBound(intent.from, symbols)
  const to = numericBound(intent.to, symbols)
  const value = adaptiveSimpson((x) => sampleExpression(intent.expression, symbols, { [variable]: x }), from, to)
  steps.push(`Adaptive Simpson integral of ${intent.expression} d${variable} from ${from} to ${to}.`)
  return baseResult(query, rewritten, intent, context, steps, {
    value:     complex(value),
    dimension: DIMENSIONLESS,
    siUnit:    '1',
    formatted: formatScalar(value),
    figure:    plotFunction2d((x) => sampleExpression(intent.expression, symbols, { [variable]: x }), from, to, intent.expression),
  })
}

function solve(
  query: string,
  rewritten: string,
  intent: ComputeIntent,
  context: ComputeContext,
  steps: string[],
): ComputeResult {
  const variable = intent.variable ?? 'x'
  const { roots, residual } = solveResidual(intent.equation ?? intent.expression, variable)
  if (!roots.length) throw new RangeError(`No real root found for ${intent.expression}`)
  steps.push(`Newton search on residual ${residual}.`)
  return baseResult(query, rewritten, intent, context, steps, {
    formatted: roots.map((root) => `${variable} = ${formatScalar(root)}`).join(', '),
    symbolic:  roots.map((root) => `${variable}=${formatScalar(root)}`).join(', '),
    value:     complex(roots[0]!),
    dimension: DIMENSIONLESS,
  })
}

function plot2d(
  query: string,
  rewritten: string,
  intent: ComputeIntent,
  symbols: Record<string, EvaluationSymbol>,
  context: ComputeContext,
  steps: string[],
): ComputeResult {
  const variable = intent.variable ?? 'x'
  const from = intent.xFrom ?? -8
  const to = intent.xTo ?? 8
  steps.push(`Sampled ${intent.expression} versus ${variable} from ${from} to ${to}.`)
  return baseResult(query, rewritten, intent, context, steps, {
    formatted: intent.expression,
    figure:    plotFunction2d((x) => sampleExpression(intent.expression, symbols, { [variable]: x }), from, to, intent.expression),
  })
}

function plot3d(
  query: string,
  rewritten: string,
  intent: ComputeIntent,
  symbols: Record<string, EvaluationSymbol>,
  context: ComputeContext,
  steps: string[],
): ComputeResult {
  const xFrom = intent.xFrom ?? -8
  const xTo = intent.xTo ?? 8
  const yFrom = intent.yFrom ?? -8
  const yTo = intent.yTo ?? 8
  steps.push(`Sampled ${intent.expression} on a 36×36 grid.`)
  return baseResult(query, rewritten, intent, context, steps, {
    formatted: intent.expression,
    figure:    plotFunction3d(
      (x, y) => sampleExpression(intent.expression, symbols, { x, y }),
      xFrom,
      xTo,
      yFrom,
      yTo,
      intent.expression,
    ),
  })
}

function sampleExpression(expression: string, symbols: Record<string, EvaluationSymbol>, extras: Record<string, number>): number {
  const bound = { ...symbols }
  for (const [name, value] of Object.entries(extras)) {
    bound[name] = { value: complex(value), dimension: DIMENSIONLESS, source: 'parameter' }
  }
  try {
    const evaluated = evaluateExpression(expression, bound)
    if (!isDimensionless(evaluated.dimension) && Object.keys(extras).length > 0) {
      return evaluated.value.re
    }
    return evaluated.value.re
  } catch (reason) {
    if (!(reason instanceof ExpressionError)) throw reason
    return compiledSampler(expression, Object.keys(extras))({ ...numericScope(symbols), ...extras })
  }
}

function numericBound(expression: string, symbols: Record<string, EvaluationSymbol>): number {
  try {
    return evaluateExpression(expression, symbols).value.re
  } catch (reason) {
    if (!(reason instanceof ExpressionError)) throw reason
    return numericEvaluate(expression, numericScope(symbols))
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
