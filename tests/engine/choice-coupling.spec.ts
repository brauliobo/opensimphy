import { grainCoupling } from '../../src/quantum-registers/grainCoupling'
import {
  derivedChoiceLaws,
  runChoicePair,
  runChoiceWalk,
} from '../../src/quantum-registers/choiceCouplingSim'

describe('choice coupling from named principles', () => {
  it('recovers the hidden matchP bias as the most probable MAP move', () => {
    const biased = runChoiceWalk({
      width: 137, ticks: 200, seed: 11, dims: 2, matchP: [0.72, 0.5, 0.5, 0.5],
      select: 'max-align', ledger: 'none', field: 'iid', gateComplete: false,
    })
    const fair = runChoiceWalk({
      width: 137, ticks: 200, seed: 11, dims: 2, matchP: [0.55, 0.55, 0.55, 0.55],
      select: 'max-align', ledger: 'none', field: 'iid', gateComplete: false,
    })

    expect(biased.validatesTheory).toBe(false)
    expect(biased.predictedDir).toBe(0)
    expect(biased.empiricalDir).toBe(0)
    expect(biased.recoveredBias).toBe(true)
    expect(biased.moveCounts[0]!).toBeGreaterThan(biased.moveCounts[1]!)
    expect(fair.recoveredBias).toBe(false)
    expect(fair.choiceEntropy).toBeGreaterThan(1.8)
  })

  it('turns the 137-bit self register into inertia: odd width forbids a tie', () => {
    const plus = runChoiceWalk({
      width: 137, ticks: 80, seed: 3, dims: 1, matchP: [0.5, 0.5],
      select: 'max-align', ledger: 'self-moves', field: 'frozen', gateComplete: false,
      start: (1n << 137n) - 1n,
    })
    const minus = runChoiceWalk({
      width: 137, ticks: 80, seed: 3, dims: 1, matchP: [0.5, 0.5],
      select: 'max-align', ledger: 'self-moves', field: 'frozen', gateComplete: false,
      start: (1n << 68n) - 1n,
    })

    expect(plus.stay).toBe(0)
    expect(plus.x).toBe(80)
    expect(plus.moveCounts[1]).toBe(0)
    expect(minus.x).toBe(-80)
    expect(minus.moveCounts[0]).toBe(0)
  })

  it('gates completed steps at w′ without dropping handshake', () => {
    const gated = runChoiceWalk({
      width: 137, ticks: 2000, seed: 7, dims: 2, matchP: [1, 1, 1, 1],
      select: 'max-align', ledger: 'none', field: 'iid', gateComplete: true,
    })
    expect(gated.handshakeRate).toBe(1)
    expect(gated.completeRate).toBeCloseTo(grainCoupling(137), 2)
  })

  it('concentrates a 0.56 vs 0.50 bias more at 137 than at 15', () => {
    const thin = runChoiceWalk({
      width: 15, ticks: 400, seed: 5, dims: 1, matchP: [0.56, 0.5],
      select: 'max-align', ledger: 'none', field: 'iid', gateComplete: false,
    })
    const thick = runChoiceWalk({
      width: 137, ticks: 400, seed: 5, dims: 1, matchP: [0.56, 0.5],
      select: 'max-align', ledger: 'none', field: 'iid', gateComplete: false,
    })
    expect(thick.moveCounts[0]! / thick.completions).toBeGreaterThan(thin.moveCounts[0]! / thin.completions)
    expect(thick.empiricalDir).toBe(0)
  })

  it('does not treat a pair handshake as a force that co-moves independent MAP choices', () => {
    const pair = runChoicePair(137, 300, 13, 0.55)
    expect(Math.abs(pair.sameGivenHandshake - pair.sameGivenFree)).toBeLessThan(0.2)
    expect(pair.validatesTheory).toBe(false)
  })

  it('supports the derived laws from the named principles', () => {
    const laws = derivedChoiceLaws(11)
    for (const law of laws) expect(law.supported, law.name).toBe(true)
  })
})
