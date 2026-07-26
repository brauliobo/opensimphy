import type { EarthDocumentShard } from './corpus'

interface ReadingBlockBase {
  startLine: number
  endLine: number
}

export interface ReadingHeadingBlock extends ReadingBlockBase {
  kind: 'heading'
  anchor: string
  level: number
  text: string
}

export interface ReadingTextBlock extends ReadingBlockBase {
  kind: 'paragraph' | 'code' | 'formula'
  text: string
  language?: string
}

export interface ReadingListBlock extends ReadingBlockBase {
  kind: 'list'
  ordered: boolean
  items: Array<{ line: number, text: string }>
}

export type EarthReadingBlock = ReadingHeadingBlock | ReadingTextBlock | ReadingListBlock

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/
const LIST_ITEM = /^\s*(?:([-+*])|(\d+)[.)])\s+(.+)$/

function displayFormulaEnd(lines: string[], index: number): number | null {
  const line = lines[index] ?? ''
  const dollars = line.indexOf('$$')
  if (dollars >= 0) {
    if (line.indexOf('$$', dollars + 2) >= 0) return index
    const close = lines.slice(index + 1).findIndex((candidate) => candidate.includes('$$'))
    return close < 0 ? lines.length - 1 : index + close + 1
  }
  if (line.includes('\\[')) {
    if (line.includes('\\]', line.indexOf('\\[') + 2)) return index
    const close = lines.slice(index + 1).findIndex((candidate) => candidate.includes('\\]'))
    return close < 0 ? lines.length - 1 : index + close + 1
  }
  const environment = line.match(/\\begin\{(equation\*?|align\*?|gather\*?|multline\*?)\}/)
  if (!environment?.[1]) return null
  const endToken = `\\end{${environment[1]}}`
  if (line.includes(endToken, environment.index! + environment[0].length)) return index
  const close = lines.slice(index + 1).findIndex((candidate) => candidate.includes(endToken))
  return close < 0 ? lines.length - 1 : index + close + 1
}

export function earthReadingBlocks(document: EarthDocumentShard['document']): EarthReadingBlock[] {
  const lines = document.sanitizedMarkdown.split('\n')
  const headings = new Map(document.structure.headings.map((heading) => [heading.line, heading]))
  const blocks: EarthReadingBlock[] = []
  let index = 0

  while (index < lines.length) {
    const lineNumber = index + 1
    const line = lines[index] ?? ''
    if (!line.trim()) {
      index += 1
      continue
    }

    const heading = headings.get(lineNumber)
    if (heading) {
      blocks.push({
        kind:      'heading',
        anchor:    `source-${heading.id}`,
        level:     Math.min(6, Math.max(1, heading.level)),
        text:      heading.text,
        startLine: lineNumber,
        endLine:   lineNumber,
      })
      index += 1
      continue
    }

    const fence = line.match(FENCE)
    if (fence?.[1]) {
      const marker = fence[1][0]
      const length = fence[1].length
      let end = index + 1
      while (end < lines.length) {
        const closing = (lines[end] ?? '').match(/^ {0,3}(`+|~+)\s*$/)
        if (closing?.[1]?.[0] === marker && closing[1].length >= length) break
        end += 1
      }
      blocks.push({
        kind:      'code',
        language:  fence[2]?.trim().split(/\s+/, 1)[0] || undefined,
        text:      lines.slice(index + 1, end).join('\n'),
        startLine: lineNumber,
        endLine:   Math.min(end + 1, lines.length),
      })
      index = Math.min(end + 1, lines.length)
      continue
    }

    const formulaEnd = displayFormulaEnd(lines, index)
    if (formulaEnd !== null) {
      blocks.push({
        kind:      'formula',
        text:      lines.slice(index, formulaEnd + 1).join('\n'),
        startLine: lineNumber,
        endLine:   formulaEnd + 1,
      })
      index = formulaEnd + 1
      continue
    }

    const listItem = line.match(LIST_ITEM)
    if (listItem) {
      const ordered = Boolean(listItem[2])
      const items: ReadingListBlock['items'] = []
      let end = index
      while (end < lines.length) {
        const candidate = (lines[end] ?? '').match(LIST_ITEM)
        if (!candidate || Boolean(candidate[2]) !== ordered) break
        items.push({ line: end + 1, text: candidate[3] ?? '' })
        end += 1
      }
      blocks.push({ kind: 'list', ordered, items, startLine: lineNumber, endLine: end })
      index = end
      continue
    }

    let end = index + 1
    while (end < lines.length) {
      const candidate = lines[end] ?? ''
      if (!candidate.trim()
        || headings.has(end + 1)
        || FENCE.test(candidate)
        || LIST_ITEM.test(candidate)
        || displayFormulaEnd(lines, end) !== null) break
      end += 1
    }
    blocks.push({ kind: 'paragraph', text: lines.slice(index, end).join('\n'), startLine: lineNumber, endLine: end })
    index = end
  }

  return blocks
}

export function sourceLineLabel(startLine: number, endLine: number): string {
  return startLine === endLine ? `L${startLine}` : `L${startLine}–L${endLine}`
}
