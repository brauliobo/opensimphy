import { grainCoupling } from '../src/quantum-registers/grainCoupling.ts'
import {
  CHOICE_PRINCIPLES,
  derivedChoiceLaws,
  runChoiceEnsemble,
  runChoiceWalk,
} from '../src/quantum-registers/choiceCouplingSim.ts'

console.log('principles')
for (const line of CHOICE_PRINCIPLES) console.log(`  - ${line}`)

console.log('\nderived laws')
for (const law of derivedChoiceLaws(11)) {
  console.log(`${law.supported ? 'ok' : 'no'}  ${law.name}`)
  console.log(`    from: ${law.from}`)
  console.log(`    ${law.statement}`)
}

console.log('\nwidth concentration  matchP=[0.56, 0.50]  1d MAP')
console.log('w    recover  P(+)    P(-)    stay   H')
for (const width of [7, 15, 31, 69, 137]) {
  const row = runChoiceEnsemble({
    width, ticks: 300, trials: width === 137 ? 8 : 16, seed: 11, dims: 1, matchP: [0.56, 0.5],
    select: 'max-align', ledger: 'none', field: 'iid', gateComplete: false,
  })
  console.log([
    String(width).padStart(3),
    row.recoveredBias.toFixed(2).padStart(7),
    row.meanMoveFrac[0]!.toFixed(3).padStart(6),
    row.meanMoveFrac[1]!.toFixed(3).padStart(6),
    row.meanStayRate.toFixed(3).padStart(6),
    row.meanEntropy.toFixed(2).padStart(5),
  ].join('  '))
}

console.log('\nselect rules, bias [0.70, 0.50, 0.50, 0.50]')
for (const select of ['max-align', 'margin', 'softmax'] as const) {
  const row = runChoiceWalk({
    width: 137, ticks: 400, seed: 11, dims: 2, matchP: [0.7, 0.5, 0.5, 0.5],
    select, ledger: 'none', field: 'iid', gateComplete: false, beta: 0.2,
  })
  console.log(`${select.padEnd(10)} emp=${row.empiricalDir} follow=${row.mapFollowRate.toFixed(3)} counts=${row.moveCounts.join(',')}`)
}

const gated = runChoiceWalk({
  width: 137, ticks: 4000, seed: 11, dims: 2, matchP: [1, 1, 1, 1],
  select: 'max-align', ledger: 'none', field: 'iid', gateComplete: true,
})
console.log(`\ngated matchP=1 complete=${gated.completeRate.toFixed(4)} w′=${grainCoupling(137).toFixed(4)}`)
