import { evaluateDressedAlpha, solveDressedAlpha } from '../src/quantum-registers/dressedAlpha.ts'

console.log('bare   α_solved          α⁻¹_solved     dress     vs CODATA rel    w′(2n) rel')
for (const bare of [136, 137, 138, 274]) {
  const result = evaluateDressedAlpha(bare)
  console.log([
    String(bare).padStart(4),
    result.solvedAlpha.toExponential(10).padStart(18),
    result.solvedInverse.toFixed(9).padStart(14),
    result.dressing.toFixed(8).padStart(10),
    result.solvedRelativeError.toExponential(3).padStart(12),
    result.jumpRelativeError.toExponential(3).padStart(12),
  ].join('  '))
  if (bare === 137) console.log(`  ${result.finding}`)
}

const self = evaluateDressedAlpha(137)
console.log(`\nCODATA α⁻¹=${self.codataInverse.toFixed(12)}`)
console.log(`identity |137·dress(α_CODATA) − α⁻¹|=${self.identityResidual.toExponential(4)}`)
console.log(`fixed-point from 1/137 and from 0.01: ${solveDressedAlpha(137).alpha}  (iterations ${solveDressedAlpha(137).iterations})`)
