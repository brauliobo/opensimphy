import { normalizeExpressionGlyphs } from '../engine/glyphs'
import { COMPUTE_PHRASE_ALIASES } from './constants'
import { COMPUTE_UNIT_ALIASES } from './units'

const WRAPPED = /[{]([^}]+)[}]/g
const SCIENTIFIC = /(\d+(?:\.\d+)?)\s*\*\s*10\s*\^\s*\(?([+-]?\d+)\)?/g

export function rewriteComputeQuery(source: string): string {
  let text = normalizeExpressionGlyphs(source).trim()
    .replace(WRAPPED, (_, body: string) => `(${body})`)
  for (const [phrase, token] of COMPUTE_PHRASE_ALIASES) {
    text = text.replace(new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi'), token)
  }
  for (const [phrase, token] of COMPUTE_UNIT_ALIASES) {
    text = text.replace(new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi'), token)
  }
  text = text.replace(SCIENTIFIC, (_, coeff: string, exp: string) => `${coeff}e${exp}`)
  return text.replace(/\s+/g, ' ').trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
