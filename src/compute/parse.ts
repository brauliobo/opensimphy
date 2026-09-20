import type { ComputeIntent } from './types'

const DEFAULT_FROM = -8
const DEFAULT_TO = 8

export function parseComputeIntent(source: string): ComputeIntent {
  const text = source.trim()
  if (/^(?:plot3d|surface)\s+/i.test(text)) {
    const range = parseRange2(stripCommand(text, /^(?:plot3d|surface)\s+/i))
    return { kind: 'plot3d', expression: range.expression, variable: 'x', xFrom: range.xFrom, xTo: range.xTo, yFrom: range.yFrom, yTo: range.yTo }
  }
  if (/^(?:plot|graph)\s+/i.test(text)) {
    const body = stripCommand(text, /^(?:plot|graph)\s+/i)
    if (hasIndependent(body, 'x') && hasIndependent(body, 'y')) {
      const range = parseRange2(body)
      return { kind: 'plot3d', expression: range.expression, variable: 'x', xFrom: range.xFrom, xTo: range.xTo, yFrom: range.yFrom, yTo: range.yTo }
    }
    const range = parseRange1(body)
    return { kind: 'plot2d', expression: range.expression, variable: range.variable, xFrom: range.from, xTo: range.to }
  }
  const derivative = text.match(/^(?:d(?:\^(\d+))?\/d([A-Za-z_]\w*)(?:\^\d+)?|diff|derivative)\s+(?:of\s+)?(.+)$/i)
  if (derivative) {
    return {
      kind:       'differentiate',
      expression: derivative[3]!.trim(),
      variable:   derivative[2] ?? firstVariable(derivative[3]!) ?? 'x',
      order:      derivative[1] ? Number(derivative[1]) : 1,
    }
  }
  const integrate = text.match(/^(?:integrate|integral|nint)\s+(.+)$/i) ?? text.match(/^∫\s*(.+)$/u)
  if (integrate) return parseIntegrate(integrate[1]!)
  const solve = text.match(/^solve\s+(.+)$/i)
  if (solve) return parseSolve(solve[1]!)
  const simplify = text.match(/^simplify\s+(.+)$/i)
  if (simplify) return { kind: 'simplify', expression: simplify[1]!.trim() }
  if (/det\s*\(|inv\s*\(|eigs?\s*\(|eigenvalues?\s*\(|lusolve\s*\(/i.test(text) || /\[\[/.test(text) || /\[[^\]]+;/.test(text)) {
    return { kind: 'matrix', expression: text }
  }
  return { kind: 'evaluate', expression: text }
}

function stripCommand(text: string, pattern: RegExp): string {
  return text.replace(pattern, '').trim()
}

function parseIntegrate(body: string): ComputeIntent {
  const definite = body.match(/^(.+?)\s+(?:d([A-Za-z_]\w*)\s+)?from\s+(.+?)\s+to\s+(.+)$/i)
  if (definite) {
    return {
      kind:       'integrate',
      expression: stripDx(definite[1]!).trim(),
      variable:   definite[2] ?? firstVariable(definite[1]!) ?? 'x',
      from:       definite[3]!.trim(),
      to:         definite[4]!.trim(),
    }
  }
  const dx = body.match(/^(.+?)\s+d([A-Za-z_]\w*)$/i)
  if (dx) return { kind: 'integrate', expression: dx[1]!.trim(), variable: dx[2] }
  return { kind: 'integrate', expression: stripDx(body).trim(), variable: firstVariable(body) ?? 'x' }
}

function parseSolve(body: string): ComputeIntent {
  const forVar = body.match(/^(.+?)\s+for\s+([A-Za-z_]\w*)$/i)
  const equation = (forVar ? forVar[1]! : body).trim()
  return { kind: 'solve', expression: equation, equation, variable: forVar?.[2] ?? firstVariable(equation) ?? 'x' }
}

function parseRange1(body: string): { expression: string; variable: string; from: number; to: number } {
  const named = body.match(/^(.+?)\s+from\s+([-+0-9.eE]+)\s+to\s+([-+0-9.eE]+)$/i)
  if (named) {
    return {
      expression: named[1]!.trim(),
      variable:   firstVariable(named[1]!) ?? 'x',
      from:       Number(named[2]),
      to:         Number(named[3]),
    }
  }
  return { expression: body.trim(), variable: firstVariable(body) ?? 'x', from: DEFAULT_FROM, to: DEFAULT_TO }
}

function parseRange2(body: string): { expression: string; xFrom: number; xTo: number; yFrom: number; yTo: number } {
  const named = body.match(/^(.+?)\s+from\s+([-+0-9.eE]+)\s+to\s+([-+0-9.eE]+)$/i)
  const expression = (named ? named[1]! : body).trim()
  const from = named ? Number(named[2]) : DEFAULT_FROM
  const to = named ? Number(named[3]) : DEFAULT_TO
  return { expression, xFrom: from, xTo: to, yFrom: from, yTo: to }
}

function stripDx(body: string): string {
  return body.replace(/\s+d[A-Za-z_]\w*$/i, '').trim()
}

function hasIndependent(expression: string, name: string): boolean {
  return new RegExp(`(?<![A-Za-z_])${name}(?![A-Za-z0-9_])`).test(expression)
}

function firstVariable(expression: string): string | undefined {
  const matches = expression.match(/(?<![A-Za-z_])[A-Za-z](?![A-Za-z0-9_])/g) ?? []
  return matches.find((name) => name !== 'e' && name !== 'i' && name !== 'h' && name !== 'c' && name !== 'G') ?? matches[0]
}
