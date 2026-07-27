import type { CompletionReport } from '../types/engine.js'

type CompletionSection = CompletionReport['recipes']

function completionSection(value: unknown, name: string, required: string[]): CompletionSection {
  if (!value || typeof value !== 'object') throw new TypeError(`Completion ${name} section must be an object`)
  const source = value as Record<string, unknown>
  for (const key of new Set(['source', 'implemented', 'graphed', ...required])) {
    if (!Number.isSafeInteger(source[key]) || Number(source[key]) < 0) throw new TypeError(`Completion ${name}.${key} must be a non-negative integer`)
  }
  return source as unknown as CompletionSection
}

function requireExact(name: string, section: CompletionSection, expected: number, keys: Array<keyof CompletionSection>): void {
  if (section.source !== expected) throw new TypeError(`Completion ${name}.source must equal ${expected}`)
  for (const key of keys) {
    if (section[key] !== section.source) throw new TypeError(`Completion ${name}.${key} must equal ${name}.source`)
  }
}

export function parseCompletionReport(value: unknown): CompletionReport {
  if (!value || typeof value !== 'object') throw new TypeError('Completion report must be an object')
  const source = value as Record<string, unknown>
  if (source.schemaVersion !== 1) throw new TypeError('Unsupported completion schema version')
  if (typeof source.generatedAt !== 'string' || source.generatedAt.length === 0) throw new TypeError('Completion report requires a generation date')
  if (!Array.isArray(source.unresolved) || !source.unresolved.every((entry) => typeof entry === 'string')) throw new TypeError('Completion unresolved entries must be strings')
  if (!Array.isArray(source.errors) || !source.errors.every((entry) => typeof entry === 'string')) throw new TypeError('Completion errors must be strings')
  if (typeof source.complete !== 'boolean') throw new TypeError('Completion status must be a boolean')
  const recipes = completionSection(source.recipes, 'recipes', ['evaluated'])
  const walls = completionSection(source.walls, 'walls', ['parseable', 'simulatable'])
  const core = completionSection(source.core, 'core', ['evaluated', 'simulatable'])
  requireExact('recipes', recipes, 288, ['implemented', 'evaluated', 'graphed'])
  if (recipes.parseable !== undefined && recipes.parseable !== recipes.source) throw new TypeError('Completion recipes.parseable must equal recipes.source')
  requireExact('walls', walls, 351, ['implemented', 'parseable', 'simulatable'])
  if (walls.graphed !== 0) throw new TypeError('Completion walls.graphed must be 0')
  requireExact('core', core, 37, ['implemented', 'evaluated', 'graphed', 'simulatable'])
  if (!source.audit || typeof source.audit !== 'object') throw new TypeError('Completion report requires audit settings')
  const audit = source.audit as Record<string, unknown>
  if (audit.precision !== 'float64-reproduction') throw new TypeError('Completion audit precision is invalid')
  if (!Number.isSafeInteger(audit.wallTerms) || Number(audit.wallTerms) < 1) throw new TypeError('Completion audit wallTerms must be a positive integer')
  if (!Number.isSafeInteger(audit.wallDepth) || Number(audit.wallDepth) < 0) throw new TypeError('Completion audit wallDepth must be a non-negative integer')
  if (!['mod', 'valuation', 'signed_log', 'row_signed_log', 'small_values', 'zero_windows'].includes(String(audit.wallMode))) {
    throw new TypeError('Completion audit wallMode is invalid')
  }
  if (source.inputs !== undefined && (!source.inputs || typeof source.inputs !== 'object' || Array.isArray(source.inputs)
    || !Object.values(source.inputs).every((entry) => typeof entry === 'string'))) {
    throw new TypeError('Completion inputs must be a string map')
  }
  return source as unknown as CompletionReport
}
