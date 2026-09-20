import { runCoupledHistory, runHistoryEnsemble } from '../src/quantum-registers/historyChainSim.ts'

const rules = ['majority', 'markov', 'persist', 'gated-past'] as const

console.log('rule         w    trials  ticks  abs0  abs1  cycle  mixed  agree  t_abs   ones')
for (const width of [15, 137]) {
  for (const rule of rules) {
    const ticks  = rule === 'majority' ? 400 : rule === 'markov' ? 4000 : 2000
    const trials = rule === 'majority' ? 200 : 80
    const result = runHistoryEnsemble(rule, width, trials, ticks, 7)
    console.log([
      rule.padEnd(12),
      String(result.width).padStart(3),
      String(result.trials).padStart(6),
      String(result.ticks).padStart(6),
      String(result.absorb0).padStart(5),
      String(result.absorb1).padStart(5),
      String(result.cycling).padStart(6),
      String(result.unresolved).padStart(6),
      String(result.agreeWithStartMajority).padStart(6),
      result.meanAbsorbTime.toFixed(1).padStart(6),
      result.meanFinalOnes.toFixed(1).padStart(6),
    ].join('  '))
  }
}

console.log('')
for (const width of [15, 137]) {
  const coupled = runCoupledHistory(16, width, 400, 21)
  console.log(`coupled w=${width} agents=${coupled.agents}: unique ${coupled.uniqueStart} → ${coupled.uniqueEnd}  Hamming ${coupled.meanHammingEnd.toFixed(1)}  pattern=${coupled.absorbPattern}  series=${coupled.uniqueSeries.join(',')}`)
  console.log(coupled.finding)
}
