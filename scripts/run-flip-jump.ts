import { flipJumpKraus, runFlipJumpEnsemble } from '../src/quantum-registers/flipJumpSim.ts'

console.log('M      w′            1/w′      w′/α     +u jump   wait    survive  residual')
for (const grainM of [15, 69, 137, 274]) {
  const kraus  = flipJumpKraus(grainM)
  const result = runFlipJumpEnsemble(grainM, 40_000, 400, 11)
  console.log([
    String(grainM).padStart(4),
    kraus.rate.toExponential(6).padStart(12),
    kraus.meanWait.toFixed(2).padStart(8),
    result.rateOverAlpha.toFixed(3).padStart(7),
    result.jumpRateFromPlus.toFixed(4).padStart(8),
    result.meanWaitFromPlus.toFixed(2).padStart(8),
    `${result.plusSurvival.toFixed(3)}/${result.predictedPlusSurvival.toFixed(3)}`.padStart(13),
    kraus.completenessResidual.toExponential(2).padStart(10),
  ].join('  '))
  console.log(`  ${result.finding}`)
}
