import { CODATA_2022_MEASURED_CONSTANTS } from '../../src/tour/physicsConstants'
import {
  BARE_ODD_GRAIN,
  dressingFactor,
  evaluateDressedAlpha,
  solveDressedAlpha,
} from '../../src/quantum-registers/dressedAlpha'

describe('dressed α from zp+1 winding on bare 137', () => {
  it('solves the implicit winding closer to CODATA than bare 1/137', () => {
    const result = evaluateDressedAlpha(137)
    const codata = CODATA_2022_MEASURED_CONSTANTS.fineStructureConstant.value
    const bareErr = Math.abs(1 / 137 - codata) / codata
    expect(result.bare).toBe(BARE_ODD_GRAIN)
    expect(result.dressing).toBeGreaterThan(1)
    expect(result.solvedRelativeError).toBeLessThan(bareErr)
    expect(result.solvedRelativeError).toBeLessThan(result.jumpRelativeError)
    expect(dressingFactor(result.solvedAlpha)).toBeCloseTo(result.dressing, 12)
  })

  it('picks 137 over 136 and 138 as the bare integer nearest CODATA', () => {
    const at137 = solveDressedAlpha(137).alpha
    const at136 = solveDressedAlpha(136).alpha
    const at138 = solveDressedAlpha(138).alpha
    const codata = CODATA_2022_MEASURED_CONSTANTS.fineStructureConstant.value
    const err = (alpha: number) => Math.abs(alpha - codata)
    expect(err(at137)).toBeLessThan(err(at136))
    expect(err(at137)).toBeLessThan(err(at138))
  })
})
