import {
  evaluateAlignment,
  gf2Rank,
  popcount,
} from '../../src/quantum-registers/quantumRegisterEngine'
import {
  islandCount,
  oneHotRegisters,
  runFastPath,
} from '../../src/quantum-registers/fastPathSim'

describe('fast-path one-hot registers', () => {
  it('treats each of the 137 unit words as a register that always majority-aligns', () => {
    const registers = oneHotRegisters(137)
    expect(registers).toHaveLength(137)
    expect(gf2Rank(registers)).toBe(137)
    expect(registers.every((word) => popcount(word) === 1)).toBe(true)
    expect(islandCount(registers[0]!, 137)).toBe(1)
    const vote = evaluateAlignment(registers[0]!, registers[1]!, 137)
    expect(vote.disagreed).toBe(2)
    expect(vote.aligned).toBe(135)
    expect(vote.committed).toBe(true)
    expect(popcount(registers[0]! ^ registers[1]!)).toBe(2)
  })

  it('turns adjacent one-hots into 11-blocks at t=1 and returns to weight 2 at dyadic ticks', () => {
    const result = runFastPath({ width: 15, ticks: 8, seed: 1, start: 'onehot', combine: 'xor', pairing: 'neighbor' })
    const at = (t: number) => result.snapshots.find((row) => row.t === t)
    expect(result.timeToWeight2).toBe(1)
    expect(at(1)?.meanWeight).toBe(2)
    expect(at(1)?.meanIslands).toBe(1)
    expect(at(2)?.meanWeight).toBe(2)
    expect(at(4)?.meanWeight).toBe(2)
    expect(at(8)?.meanWeight).toBe(2)
    expect(at(0)?.necklaces).toBe(1)
    expect(at(8)?.necklaces).toBe(1)
  })

  it('grows ordered 1-runs under neighbor OR of one-hot registers', () => {
    const result = runFastPath({ width: 15, ticks: 20, seed: 1, start: 'onehot', combine: 'or', pairing: 'neighbor' })
    expect(result.timeToBlock8).toBe(7)
    expect(result.timeToAllOnes).toBe(14)
  })

  it('hits majority at t=127 on the 137 one-hot neighbor-XOR path', () => {
    const result = runFastPath({ width: 137, ticks: 128, seed: 1, start: 'onehot', combine: 'xor', pairing: 'neighbor' })
    expect(result.timeToBlock8).toBe(7)
    expect(result.timeToMajority).toBe(127)
    expect(result.snapshots.find((row) => row.t === 128)?.meanWeight).toBe(2)
  })

  it('lets the +u completeness jump punch Sierpinski at the first majority window', () => {
    const quiet = runFastPath({ width: 15, ticks: 16, seed: 1, start: 'onehot', combine: 'xor', pairing: 'neighbor' })
    const leak  = runFastPath({ width: 15, ticks: 16, seed: 1, start: 'onehot', combine: 'xor', pairing: 'neighbor', flipJump: true })
    expect(quiet.jumps).toBe(0)
    expect(quiet.snapshots.find((row) => row.t === 8)?.meanWeight).toBe(2)
    expect(leak.jumps).toBeGreaterThan(0)
    expect(leak.snapshots.find((row) => row.t === 8)?.meanWeight).not.toBe(2)
  })
})
