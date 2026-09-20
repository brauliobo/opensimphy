import { grainCoupling } from '../../src/quantum-registers/grainCoupling'
import { flipJumpKraus, runFlipJumpEnsemble } from '../../src/quantum-registers/flipJumpSim'

describe('flip-jump completeness', () => {
  it('forces w′ = (2M−1)/M² from 1 − ((M−1)/M)² on the +u projector', () => {
    const kraus = flipJumpKraus(137)
    expect(kraus.rate).toBe(grainCoupling(137))
    expect(kraus.rate).toBe(273 / 18769)
    expect(1 - ((137 - 1) / 137) ** 2).toBeCloseTo(kraus.rate, 12)
    expect(kraus.completenessResidual).toBeLessThan(1e-15)
    expect(kraus.meanWait).toBeCloseTo(18769 / 273, 12)
  })

  it('jumps from +u at w′ and never from −u', () => {
    const result = runFlipJumpEnsemble(15, 20_000, 40, 7)
    expect(result.jumpRateFromMinus).toBe(0)
    expect(result.jumpRateFromPlus).toBeGreaterThan(result.predictedRate * 0.9)
    expect(result.jumpRateFromPlus).toBeLessThan(result.predictedRate * 1.1)
    expect(result.meanWaitFromPlus).toBeGreaterThan(result.predictedWait * 0.9)
    expect(result.meanWaitFromPlus).toBeLessThan(result.predictedWait * 1.1)
    expect(result.completenessResidual).toBeLessThan(1e-15)
  })
})
