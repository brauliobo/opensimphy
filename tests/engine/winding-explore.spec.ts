import { CODATA_2022_MEASURED_CONSTANTS } from '../../src/tour/physicsConstants'
import { evaluateDressedAlpha } from '../../src/quantum-registers/dressedAlpha'
import { ablationTable, expansionInverse, zpTable } from '../../src/quantum-registers/windingExplore'

describe('winding ablations and zp+1', () => {
  it('needs zp=1; the (1−2α²/π²) factor only tunes the last digits', () => {
    const rows = ablationTable(137)
    const byKind = Object.fromEntries(rows.map((row) => [row.kind, row.relativeError]))
    expect(byKind.full).toBeLessThan(byKind['half-turn']!)
    expect(byKind['half-turn']!).toBeLessThan(byKind['small-angle']!)
    expect(byKind['small-angle']!).toBeLessThan(byKind.bare!)
    expect(byKind.full).toBeLessThan(1e-11)
    const zp = zpTable(137)
    expect(zp[0]!.zp).toBe(1)
    expect(zp[0]!.relativeError).toBeLessThan(zp[1]!.relativeError)
    expect(zp[0]!.relativeError).toBeLessThan(zp[2]!.relativeError)
    expect(expansionInverse(137).relativeError).toBeLessThan(3e-7)
    expect(evaluateDressedAlpha(137).codataAlpha).toBe(CODATA_2022_MEASURED_CONSTANTS.fineStructureConstant.value)
  })
})
