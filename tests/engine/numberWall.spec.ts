import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  bareissDeterminant,
  numberWallCell,
  simulateNumberWall,
  WallCancelledError,
} from '../../src/engine/numberWall'
import type { WallMode, WallPayload } from '../../src/types/engine'

interface PublishedWallPayload extends WallPayload {
  rows: Array<{ row: number; values: Array<string | null> }>
}

describe('number-wall engine', () => {
  it('uses exact Bareiss determinants including pivot swaps', () => {
    expect(bareissDeterminant([
      [0n, 2n, 1n],
      [3n, 0n, 4n],
      [5n, 6n, 0n],
    ])).toBe(58n)
    expect(numberWallCell([0n, 1n, 1n, 2n, 3n, 5n], 1, 2)).toBe(-1n)
    expect(numberWallCell([0n, 1n, 1n, 2n, 3n, 5n], 2, 2)).toBe(0n)
  })

  it('supports every bounded display mode and cancellation', () => {
    const payload: WallPayload = {
      id: 'fixture',
      title: 'Fixture',
      kind: 'terms',
      sequence: ['0', '1', '1', '2', '3', '5', '8', '13'],
    }
    const modes: WallMode[] = ['mod', 'valuation', 'signed_log', 'row_signed_log', 'small_values', 'zero_windows']

    for (const mode of modes) {
      const result = simulateNumberWall(payload, { terms: 8, depth: 3, mode })
      expect(result.mode).toBe(mode)
      expect(result.cells.length).toBeGreaterThan(0)
    }
    expect(() => simulateNumberWall(payload, { shouldCancel: () => true })).toThrow(WallCancelledError)
    expect(() => simulateNumberWall(payload, { terms: 101 })).toThrow(/terms must be an integer/)
  })

  it.each([
    'catalan.json',
    'fibonacci.json',
    'thue-morse.json',
    'nature-001-hyperfine-transition-frequency-of-Cesium-133.json',
  ])('matches 800 published cells from %s', async (filename) => {
    const payload = JSON.parse(await readFile(join(process.cwd(), 'public', 'data', 'number-walls', filename), 'utf8')) as PublishedWallPayload
    const sequence = payload.sequence.map(BigInt)
    const rows = payload.rows.slice(0, 8)

    expect(rows).toHaveLength(8)
    for (const row of rows) {
      expect(row.values).toHaveLength(100)
      row.values.forEach((published, column) => {
        expect(numberWallCell(sequence, row.row, column)?.toString() ?? null).toBe(published)
      })
    }
  })
})
