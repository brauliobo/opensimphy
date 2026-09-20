import { evaluateDressedAlpha } from '../src/quantum-registers/dressedAlpha.ts'
import { ablationTable, expansionInverse, nearestGrainMatches, zpTable } from '../src/quantum-registers/windingExplore.ts'

const dressed = evaluateDressedAlpha(137)
const expand  = expansionInverse(137)
console.log('kind         zp   α⁻¹              rel to CODATA')
for (const row of ablationTable(137)) {
  console.log(`${row.kind.padEnd(12)} ${String(row.zp).padStart(2)}  ${row.inverse.toFixed(12).padStart(16)}  ${row.relativeError.toExponential(3)}`)
}
console.log(`small-angle closed 137+π²/(2·137)=${expand.sum.toFixed(12)}  rel ${expand.relativeError.toExponential(3)}`)
console.log('')
for (const row of zpTable(137)) {
  console.log(`full zp=${row.zp}  α⁻¹=${row.inverse.toFixed(6)}  rel ${row.relativeError.toExponential(3)}`)
}
console.log(`\nCODATA α⁻¹=${dressed.codataInverse.toFixed(12)}  w′(274)⁻¹=${dressed.jumpInverse.toFixed(6)}`)
console.log('\nnearest (2M−1)/M² in M=2..400 to named constants (search, not a derivation)')
for (const row of nearestGrainMatches()) {
  console.log(`${row.name.padEnd(10)}  M=${String(row.grainM).padStart(3)}  w′=${row.rate.toExponential(4)}  target=${row.target.toExponential(4)}  rel=${row.relativeError.toExponential(3)}`)
}
