import { grainCoupling } from '../src/quantum-registers/grainCoupling.ts'
import { allOnes, runChoiceWalk } from '../src/quantum-registers/choiceCouplingSim.ts'
import {
  CONSEQUENCE_NOTES,
  derivedConsequences,
  runDwell,
  runSharedFuture,
  susceptibility,
} from '../src/quantum-registers/choiceConsequencesSim.ts'

console.log('notes')
for (const line of CONSEQUENCE_NOTES) console.log(`  - ${line}`)

console.log('\nconsequences')
for (const law of derivedConsequences(11)) {
  console.log(`${law.supported ? 'ok' : 'no'}  ${law.name}`)
  console.log(`    from: ${law.from}`)
  console.log(`    ${law.statement}`)
}

console.log('\nχ(δ=0.04) by width')
for (const width of [7, 15, 31, 69, 137]) {
  const chi = susceptibility(width, 0.04, 180, width === 137 ? 6 : 10, 11)
  console.log(`w=${String(width).padStart(3)}  χ=${chi.toFixed(2)}`)
}

console.log('\ndwell')
for (const matchP of [[0.5, 0.5], [0.55, 0.5], [0.62, 0.5]] as [number, number][]) {
  const thin = runDwell(15, 400, 11, matchP)
  const thick = runDwell(137, 400, 11, matchP)
  console.log(`p=${matchP[0].toFixed(2)}/${matchP[1].toFixed(2)}  dwell15=${thin.meanDwell.toFixed(1)}  dwell137=${thick.meanDwell.toFixed(1)}  sw137=${thick.switches}`)
}

console.log('\nshared future')
for (const couple of [false, true]) {
  const row = runSharedFuture(couple, 137, 400, 11)
  console.log(`couple=${couple}  P(same)=${row.sameRate.toFixed(3)}  joint=${row.jointRate.toFixed(3)}`)
}

const dribble = runChoiceWalk({
  width: 137, ticks: 2000, seed: 11, dims: 1, matchP: [0.5, 0.5],
  select: 'max-align', ledger: 'self-moves', field: 'frozen', gateComplete: false,
  start: allOnes(137), ledgerLeak: 'dribble',
})
const jump = runChoiceWalk({
  width: 137, ticks: 400, seed: 11, dims: 1, matchP: [0.5, 0.5],
  select: 'max-align', ledger: 'self-moves', field: 'frozen', gateComplete: false,
  start: allOnes(137), ledgerLeak: 'flip-jump',
})
console.log(`\ndribble ones=${dribble.onesEnd} reverse=${dribble.reversed} x=${dribble.x}`)
console.log(`jump    reverse t=${jump.reverseTime} x=${jump.x}  1/w′=${(1 / grainCoupling(137)).toFixed(1)}`)
