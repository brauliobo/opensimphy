import { runAlignmentPhysics } from '../../src/quantum-registers/alignmentPhysicsSim'

describe('alignment physics ensemble', () => {
  it('keeps action-reaction momentum identically zero and meta-majority kicks at ±1', () => {
    const reaction = runAlignmentPhysics({
      agents: 8, width: 137, ticks: 40, seed: 11, matchP: 0.5, stepRule: 'action-reaction', phaseSource: 'independent',
    })
    const majority = runAlignmentPhysics({
      agents: 8, width: 137, ticks: 40, seed: 11, matchP: 0.5, stepRule: 'meta-majority', phaseSource: 'independent',
    })

    expect(reaction.momentumMean).toBe(0)
    expect(reaction.momentumRms).toBe(0)
    expect(majority.maxKick).toBeLessThanOrEqual(1)
    expect(majority.coneViolations).toBe(0)
    expect(majority.multiAlignRate).toBeGreaterThan(0.5)
  })
})
