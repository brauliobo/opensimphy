import { CODATA_2022_MEASURED_CONSTANTS } from '../../src/tour/physicsConstants'
import {
  evaluateGrainCoupling,
  grainCoupling,
  nearestGrainToAlpha,
} from '../../src/quantum-registers/grainCoupling'

describe('grain coupling vs Planck-exponent 137', () => {
  it('keeps the SI exponent sum at 137 and moves it in CGS', () => {
    const result = evaluateGrainCoupling(137)
    expect(result.siExponents).toEqual([44, 35, 18, 32, 8])
    expect(result.siExponentSum).toBe(137)
    expect(result.cgsExponentSum).not.toBe(137)
    expect(result.absLogSum).toBeCloseTo(135.6, 1)
    expect(result.chargeRatioSquared).toBeCloseTo(result.codataAlpha, 10)
    expect(result.chargeRatio).toBeCloseTo(1 / Math.sqrt(result.codataAlpha), 8)
  })

  it('reads machine α from (2M−1)/M², not from 1/137', () => {
    const alpha = CODATA_2022_MEASURED_CONSTANTS.fineStructureConstant.value
    const at137 = evaluateGrainCoupling(137)
    expect(grainCoupling(137)).toBe(273 / 18769)
    expect(at137.coupling).not.toBeCloseTo(alpha, 3)
    expect(at137.coupling).not.toBeCloseTo(1 / 137, 6)
    expect(nearestGrainToAlpha(alpha)).toBe(274)
    expect(Math.abs(grainCoupling(274) - alpha)).toBeLessThan(Math.abs(grainCoupling(137) - alpha))
    expect(at137.finding).toContain('unit artifact')
  })
})
