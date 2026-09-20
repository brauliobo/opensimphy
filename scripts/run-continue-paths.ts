import { runFastPath } from '../src/quantum-registers/fastPathSim.ts'
import { runCoupledHistory, runHistoryEnsemble } from '../src/quantum-registers/historyChainSim.ts'

const rules = ['majority', 'markov', 'persist', 'gated-past'] as const

console.log('--- one-hot history chain (137 trials, one start bit each) ---')
console.log('rule         abs0  abs1  cycle  mixed  t_abs  ones')
for (const rule of rules) {
  const result = runHistoryEnsemble(rule, 137, 137, 800, 7, 'onehot')
  console.log([
    rule.padEnd(12),
    String(result.absorb0).padStart(4),
    String(result.absorb1).padStart(5),
    String(result.cycling).padStart(6),
    String(result.unresolved).padStart(6),
    result.meanAbsorbTime.toFixed(1).padStart(6),
    result.meanFinalOnes.toFixed(1).padStart(5),
  ].join('  '))
}

console.log('\n--- coupled one-hot histories ---')
for (const agents of [16, 137]) {
  const coupled = runCoupledHistory(agents, 137, 200, 21, 'onehot')
  console.log(`n=${agents} unique ${coupled.uniqueStart}→${coupled.uniqueEnd}  ${coupled.absorbPattern}  series=${coupled.uniqueSeries.join(',')}`)
}

console.log('\n--- one-hot neighbor XOR / OR / ADD, with and without +u flip-jump ---')
for (const combine of ['xor', 'or', 'add'] as const) {
  for (const flipJump of [false, true]) {
    const result = runFastPath({ width: 137, ticks: 256, seed: 11, start: 'onehot', combine, pairing: 'neighbor', flipJump })
    const at = (t: number) => result.snapshots.find((row) => row.t === t)
    console.log(`${combine.padEnd(3)} jump=${flipJump ? 'on ' : 'off'}  jumps=${String(result.jumps).padStart(4)}  t7=${at(7)?.meanWeight.toFixed(1)}  t127=${at(127)?.meanWeight.toFixed(1)}  t128=${at(128)?.meanWeight.toFixed(1)}  end=${at(256)?.meanWeight.toFixed(1)}/${at(256)?.necklaces}`)
  }
}
