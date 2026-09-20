import { COMPUTE_PHRASE_ALIASES } from './constants'

const WRAPPED = /[{]([^}]+)[}]/g

export function rewriteComputeQuery(source: string): string {
  let text = source.trim().replace(WRAPPED, (_, body: string) => `(${body})`)
  for (const [phrase, token] of COMPUTE_PHRASE_ALIASES) {
    const pattern = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi')
    text = text.replace(pattern, token)
  }
  return text.replace(/\s+/g, ' ').trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
