import {
  BINARY_137,
  COMBINATORIAL_HIERARCHY,
  HIERARCHY_CLOSURE_COUNT,
  PARKER_RHODES_LEVEL2_BASIS,
  REGISTER_WIDTH_MAX,
  binomialPge,
  enumerateDcs,
  evaluateAlignment,
  evaluateHandshake,
  evaluateHierarchy,
  evaluateHilbertBound,
  evaluateMajority,
  evaluateMajorityWalk,
  evaluateRegisterPair,
  evaluateUniverse,
  formatPowerOfTwo,
  gf2Rank,
  majorityThreshold,
  parseRegister,
  twoBitXorSupport,
  universeCapacity,
} from '../../src/quantum-registers/quantumRegisterEngine'

describe('quantum-register hypothesis engine', () => {
  it('takes the majority of 137 coin flips as a definite next step', () => {
    expect(majorityThreshold(137)).toBe(69)
    expect(evaluateMajority(0n, 137)).toMatchObject({ ones: 0, zeros: 137, majority: 0, step: -1, tie: false, odd: true })
    expect(evaluateMajority((1n << 69n) - 1n, 137)).toMatchObject({ ones: 69, zeros: 68, majority: 1, step: 1, tie: false })
    expect(evaluateMajority(0b11110000n, 8)).toMatchObject({ ones: 4, zeros: 4, tie: true, step: 0 })
    expect(binomialPge(5, 3, 0.5)).toBeCloseTo(0.5, 12)
    expect(binomialPge(5, 4, 0.5)).toBeCloseTo(6 / 32, 12)
    expect(binomialPge(137, 69, 0.5)).toBeCloseTo(0.5, 6)
    expect(binomialPge(137, 69, 0.6)).toBeGreaterThan(0.98)
  })

  it('commits a step only when a majority of 137 phases match', () => {
    const offer    = (1n << 137n) - 1n
    const aligned  = evaluateAlignment(offer, (1n << 69n) - 1n, 137)
    const split    = evaluateAlignment(offer, (1n << 68n) - 1n, 137)
    expect(aligned).toMatchObject({ aligned: 69, disagreed: 68, committed: true, step: 1 })
    expect(split).toMatchObject({ aligned: 68, disagreed: 69, committed: false, step: -1 })
  })

  it('walks fair 137-coin majority without ties and locks alignment at modest matchP', () => {
    const coins = evaluateMajorityWalk({ width: 137, seed: 137, steps: 80, matchP: 0.5, mode: 'coins' })
    const align = evaluateMajorityWalk({ width: 137, seed: 137, steps: 80, matchP: 0.6, mode: 'align' })
    const even  = evaluateMajorityWalk({ width: 8, seed: 3, steps: 40, matchP: 0.5, mode: 'coins' })

    expect(coins.odd).toBe(true)
    expect(coins.ties).toBe(0)
    expect(coins.commits).toBe(80)
    expect(coins.binomialCommitP).toBe(1)
    expect(coins.fairStepP).toBeCloseTo(0.5, 6)
    expect(coins.lastBits).toHaveLength(137)
    expect(align.binomialCommitP).toBeGreaterThan(0.98)
    expect(align.commits).toBeGreaterThan(60)
    expect(even.ties).toBeGreaterThan(0)
    expect(even.finding).toContain('even')
  })
  it('treats 137 as a masked word whose XOR involution is identically zero', () => {
    const a      = (1n << 136n) | 1n
    const b      = BINARY_137
    const result = evaluateRegisterPair({ width: REGISTER_WIDTH_MAX, a, b })

    expect(result.width).toBe(137)
    expect(result.registerBytes).toBe(18)
    expect(result.configurationCountText).toBe('1.7422e+41')
    expect(result.involutionZero).toBe(true)
    expect(result.xor).toBe(a ^ b)
    expect(result.bitsA).toHaveLength(137)
    expect(result.bitsA[0]).toBe(1)
    expect(result.bitsA[136]).toBe(1)
    expect(result.finding).toContain('not a Hilbert vector')
  })

  it('parses bounded literals and refuses a 137-qubit Hilbert allocation', () => {
    expect(parseRegister('0b10001001', 8)).toBe(137n)
    expect(parseRegister('0x89', 8)).toBe(137n)
    expect(evaluateHilbertBound(8).allocatesHilbert).toBe(true)
    expect(evaluateHilbertBound(8).complex128BytesText).toBe('4096')
    const refused = evaluateHilbertBound(137)
    expect(refused.allocatesHilbert).toBe(false)
    expect(refused.registerBytes).toBe(18)
    expect(refused.amplitudeCountText).toBe(formatPowerOfTwo(137))
    expect(refused.finding).toContain('refused')
  })

  it('closes the Parker-Rhodes 4-bit basis on exactly seven DCS strings', () => {
    const dcs = enumerateDcs(PARKER_RHODES_LEVEL2_BASIS)
    expect(gf2Rank(PARKER_RHODES_LEVEL2_BASIS)).toBe(3)
    expect(dcs).toEqual([1n, 2n, 3n, 12n, 13n, 14n, 15n])
    expect(dcs).toHaveLength(7)
  })

  it('keeps 3 + 7 + 127 = 137 as counting, not a QED derivation of α', () => {
    const hierarchy = evaluateHierarchy()
    expect(hierarchy.closureCount).toBe(HIERARCHY_CLOSURE_COUNT)
    expect(hierarchy.binary137Match).toBe(true)
    expect(hierarchy.levels.map((row) => row.dcsCount)).toEqual([3, 7, 127, null])
    expect(COMBINATORIAL_HIERARCHY[3]!.enumerable).toBe(false)
    expect(hierarchy.apparentCoupling).toBeCloseTo(1 / 137, 12)
    expect(hierarchy.couplingRelativeError).toBeGreaterThan(0)
    expect(hierarchy.couplingRelativeError).toBeLessThan(3e-4)
    expect(hierarchy.finding).toContain('not a QED derivation')
    expect(hierarchy.nextLevelRefused).toContain('2^127')
  })

  it('handshakes every partner inside a closed DCS and almost none in a sparse 137-bit set', () => {
    const closed = evaluateHandshake({
      preset: 'dcs-7', width: 4, size: 7, seed: 7, emitterIndex: 0, rule: 'xor-closed', minOverlap: 1,
    })
    const sparse = evaluateHandshake({
      preset: 'random', width: 137, size: 16, seed: 7, emitterIndex: 0, rule: 'xor-closed', minOverlap: 1,
    })

    expect(closed.width).toBe(4)
    expect(closed.universe).toHaveLength(7)
    expect(closed.compatibleCount).toBe(6)
    expect(closed.apparentProbability).toBe(1)
    expect(closed.involutionZero).toBe(true)
    expect(closed.selectedIndex).not.toBeNull()
    expect(sparse.width).toBe(137)
    expect(sparse.compatibleCount).toBe(0)
    expect(sparse.apparentProbability).toBe(0)
    const majority = evaluateHandshake({
      preset: 'random', width: 137, size: 16, seed: 7, emitterIndex: 0, rule: 'majority-phase', minOverlap: 1,
    })
    expect(majority.finding).toContain('69 of 137')
    expect(majority.apparentProbability).toBeGreaterThan(0)
    expect(majority.apparentProbability).toBeLessThan(1)
  })

  it('keeps coprime handshake a number-theory rate independent of claiming α', () => {
    const result = evaluateHandshake({
      preset: 'random', width: 16, size: 24, seed: 11, emitterIndex: 0, rule: 'coprime', minOverlap: 1,
    })
    expect(result.compatibleCount).toBeGreaterThan(0)
    expect(result.apparentProbability).toBeGreaterThan(0)
    expect(result.finding).toContain('not α')
  })

  it('caps a small-width universe and ticks without allocating amplitudes', () => {
    expect(universeCapacity(3)).toBe(7)
    const closed = evaluateUniverse({
      preset: 'dcs-7', startWidth: 4, startCount: 7, seed: 3, maxSteps: 40, maxWidth: 8, maxSize: 16,
    })
    expect(closed.xorClosedHits).toBeGreaterThan(0)
    expect(closed.size).toBe(7)
    expect(closed.reached137).toBe(false)

    const grown = evaluateUniverse({
      preset: 'random', startWidth: 8, startCount: 8, seed: 5, maxSteps: 200, maxWidth: 137, maxSize: 32,
    })
    expect(grown.size).toBeLessThanOrEqual(32)
    expect(grown.width).toBeLessThanOrEqual(137)
    expect(grown.finding).not.toContain('Standard Model law was emitted')
  })

  it('places equal two-bit toy support on the XOR-zero subspace', () => {
    const rows = twoBitXorSupport()
    const xorZero = rows.filter((row) => row.xor === 0).reduce((sum, row) => sum + row.probability, 0)
    expect(rows).toHaveLength(4)
    expect(xorZero).toBeCloseTo(1)
    expect(rows.find((row) => row.label === '01')?.probability).toBe(0)
  })
})
