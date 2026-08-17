import { fail, record, requireBoolean, requireNonEmptyString, requireSafeInteger } from '../simphy/contract'
import type { CompletionReport } from '../types/engine.js'

type CompletionSection = CompletionReport['recipes']

function completionSection(value: unknown, name: string, required: string[]): CompletionSection {
  const source = record(value, `Completion.${name}`)
  for (const key of new Set(['source', 'implemented', 'graphed', ...required])) {
    requireSafeInteger(source[key], `Completion.${name}.${key}`)
  }
  return source as unknown as CompletionSection
}

function requireExact(name: string, section: CompletionSection, expected: number, keys: Array<keyof CompletionSection>): void {
  if (section.source !== expected) fail(`Completion.${name}.source`, `must equal ${expected}`)
  for (const key of keys) {
    if (section[key] !== section.source) fail(`Completion.${name}.${key}`, `must equal ${name}.source`)
  }
}

export function parseCompletionReport(value: unknown): CompletionReport {
  const source = record(value, 'Completion report')
  if (source.schemaVersion !== 1) fail('Completion report.schemaVersion', 'must be 1')
  requireNonEmptyString(source.generatedAt, 'Completion report.generatedAt')
  if (!Array.isArray(source.unresolved) || !source.unresolved.every((entry) => typeof entry === 'string')) {
    fail('Completion report.unresolved', 'must be an array of strings')
  }
  if (!Array.isArray(source.errors) || !source.errors.every((entry) => typeof entry === 'string')) {
    fail('Completion report.errors', 'must be an array of strings')
  }
  requireBoolean(source.complete, 'Completion report.complete')
  const recipes = completionSection(source.recipes, 'recipes', ['evaluated'])
  const walls = completionSection(source.walls, 'walls', ['parseable', 'simulatable'])
  const core = completionSection(source.core, 'core', ['evaluated', 'simulatable'])
  requireExact('recipes', recipes, 288, ['implemented', 'evaluated', 'graphed'])
  if (recipes.parseable !== undefined && recipes.parseable !== recipes.source) fail('Completion.recipes.parseable', 'must equal recipes.source')
  requireExact('walls', walls, 351, ['implemented', 'parseable', 'simulatable'])
  if (walls.graphed !== 0) fail('Completion.walls.graphed', 'must be 0')
  requireExact('core', core, 37, ['implemented', 'evaluated', 'graphed', 'simulatable'])
  const audit = record(source.audit, 'Completion report.audit')
  if (audit.precision !== 'float64-reproduction') fail('Completion report.audit.precision', 'is invalid')
  requireSafeInteger(audit.wallTerms, 'Completion report.audit.wallTerms', 1)
  requireSafeInteger(audit.wallDepth, 'Completion report.audit.wallDepth')
  if (!['mod', 'valuation', 'signed_log', 'row_signed_log', 'small_values', 'zero_windows'].includes(String(audit.wallMode))) {
    fail('Completion report.audit.wallMode', 'is invalid')
  }
  if (source.inputs !== undefined) {
    const inputs = record(source.inputs, 'Completion report.inputs')
    for (const [key, entry] of Object.entries(inputs)) requireNonEmptyString(entry, `Completion report.inputs.${key}`)
  }
  return source as unknown as CompletionReport
}
