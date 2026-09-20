import { grainCoupling } from '../../src/quantum-registers/grainCoupling'
import { allOnes, runChoiceWalk } from '../../src/quantum-registers/choiceCouplingSim'
import {
  derivedConsequences,
  runComplementary,
  runHabitVsField,
  runSharedFuture,
} from '../../src/quantum-registers/choiceConsequencesSim'

describe('choice coupling consequences', () => {
  it('takes one step even when every future handshakes', () => {
    const row = runChoiceWalk({
      width: 137, ticks: 40, seed: 4, dims: 2, matchP: [1, 1, 1, 1],
      select: 'max-align', ledger: 'none', field: 'iid', gateComplete: false,
    })
    expect(row.maxEligible).toBe(4)
    expect(row.stay).toBe(0)
    expect(row.completions).toBe(40)
  })

  it('keeps lab motion inside the completed-coupling cone', () => {
    const row = runChoiceWalk({
      width: 137, ticks: 1500, seed: 4, dims: 2, matchP: [1, 1, 1, 1],
      select: 'max-align', ledger: 'none', field: 'iid', gateComplete: true,
    })
    expect(Math.hypot(row.x, row.y)).toBeLessThanOrEqual(row.completions)
    expect(row.completeRate).toBeCloseTo(grainCoupling(137), 2)
  })

  it('does not reverse ballistic history by w′-dribble, but does by +u flip-jump', () => {
    const dribble = runChoiceWalk({
      width: 137, ticks: 800, seed: 9, dims: 1, matchP: [0.5, 0.5],
      select: 'max-align', ledger: 'self-moves', field: 'frozen', gateComplete: false,
      start: allOnes(137), ledgerLeak: 'dribble',
    })
    const jump = runChoiceWalk({
      width: 137, ticks: 800, seed: 9, dims: 1, matchP: [0.5, 0.5],
      select: 'max-align', ledger: 'self-moves', field: 'frozen', gateComplete: false,
      start: allOnes(137), ledgerLeak: 'flip-jump',
    })
    expect(dribble.reversed).toBe(false)
    expect(dribble.onesEnd).toBeGreaterThan(120)
    expect(jump.reversed).toBe(true)
    expect(jump.reverseTime).toBeGreaterThan(1)
  })

  it('lets a fully aligned ledger outrank a 0.9 environment under MAP', () => {
    const row = runHabitVsField('max-align', 137, 80, 2, 0.9)
    expect(row.reversed).toBe(false)
    expect(row.x).toBe(80)
    expect(row.onesEnd).toBe(137)
  })

  it('forbids a double handshake on complementary receivers', () => {
    const row = runComplementary(137, 120, 3)
    expect(row.bothEligible).toBe(0)
    expect(row.eitherEligible).toBe(120)
  })

  it('raises co-motion only when a shared future is listed', () => {
    const off = runSharedFuture(false, 137, 200, 6)
    const on  = runSharedFuture(true, 137, 200, 6)
    expect(on.sameRate).toBeGreaterThan(off.sameRate + 0.04)
    expect(on.jointRate).toBeGreaterThan(0.1)
  })

  it('supports the deeper derived consequences', () => {
    for (const law of derivedConsequences(11)) expect(law.supported, law.name).toBe(true)
  })
})
