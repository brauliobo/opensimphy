const MINUS_GLYPHS = '−–—'
const TIMES_GLYPHS = '×✕⋅·∙'

export function asciiOperatorGlyph(character: string): string | undefined {
  if (MINUS_GLYPHS.includes(character)) return '-'
  if (TIMES_GLYPHS.includes(character)) return '*'
}

export function normalizeExpressionGlyphs(source: string): string {
  return [...source].map((character) => asciiOperatorGlyph(character) ?? character).join('')
}
