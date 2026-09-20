import { runPairJump, tensorPairRates, type PairStart } from '../src/quantum-registers/pairGrainSim.ts'

const starts: PairStart[] = ['locked-plus', 'tensor-plus-plus', 'two-independent', 'both-majority-gate', 'handshake-gate']

const tensor = tensorPairRates(137)
console.log(`tensor  pp=${tensor.pp.toExponential(4)}  either=${tensor.either.toExponential(4)}  joint w′(274)=${tensor.jointRate.toExponential(4)}  pm=${tensor.pm.toExponential(4)}`)
console.log('start                 w′_pred       w′/α    meas      wait    1/w′     ties')
for (const start of starts) {
  const trials = start.endsWith('gate') ? 8_000 : 40_000
  const result = runPairJump(start, trials, 13)
  console.log([
    start.padEnd(20),
    result.predictedRate.toExponential(4).padStart(11),
    result.rateOverAlpha.toFixed(3).padStart(6),
    result.measuredRate.toExponential(4).padStart(10),
    result.meanWait.toFixed(1).padStart(8),
    result.predictedWait.toFixed(1).padStart(8),
    result.concatTieRate.toFixed(3).padStart(6),
  ].join('  '))
  console.log(`  ${result.finding}`)
}
