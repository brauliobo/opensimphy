import { CODATA_2022_MEASURED_CONSTANTS } from '../../src/tour/physicsConstants'
import { grainCoupling } from '../../src/quantum-registers/grainCoupling'
import { PAIR_GRAIN, runPairJump, tensorPairRates } from '../../src/quantum-registers/pairGrainSim'

describe('pair of 137 as grain 274', () => {
  it('matches α as one joint K₀ on grain 2×137, not as a tensor product', () => {
    const alpha  = CODATA_2022_MEASURED_CONSTANTS.fineStructureConstant.value
    const tensor = tensorPairRates(137)
    const locked = runPairJump('locked-plus', 20_000, 5)

    expect(PAIR_GRAIN).toBe(274)
    expect(tensor.pairGrain).toBe(274)
    expect(tensor.jointRate).toBe(grainCoupling(274))
    expect(tensor.jointRate / alpha).toBeCloseTo(1, 2)
    expect(tensor.pp).toBeCloseTo(tensor.either, 12)
    expect(tensor.pp / alpha).toBeGreaterThan(3.5)
    expect(locked.rateOverAlpha).toBeCloseTo(1, 2)
    expect(locked.meanWait).toBeGreaterThan(120)
    expect(locked.meanWait).toBeLessThan(155)
  })
})
