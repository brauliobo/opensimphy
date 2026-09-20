import { runFastPath, type FastPathCombine, type FastPathPairing, type FastPathStart } from '../src/quantum-registers/fastPathSim.ts'

const jobs: Array<{ start: FastPathStart, combine: FastPathCombine, pairing: FastPathPairing, ticks: number }> = [
  { start: 'onehot', combine: 'xor',         pairing: 'neighbor', ticks: 65536 },
  { start: 'onehot', combine: 'aligned-xor', pairing: 'neighbor', ticks: 65536 },
  { start: 'onehot', combine: 'or',          pairing: 'neighbor', ticks: 65536 },
  { start: 'onehot', combine: 'add',         pairing: 'neighbor', ticks: 65536 },
  { start: 'onehot', combine: 'xor',         pairing: 'random',   ticks: 65536 },
  { start: 'random', combine: 'xor',         pairing: 'neighbor', ticks: 65536 },
  { start: 'random', combine: 'aligned-xor', pairing: 'random',   ticks: 65536 },
  { start: 'random', combine: 'or',          pairing: 'neighbor', ticks: 65536 },
  { start: 'random', combine: 'add',         pairing: 'neighbor', ticks: 65536 },
]

function weightsAt(result: ReturnType<typeof runFastPath>): string {
  return result.snapshots
    .filter((row) => row.t === 0 || (row.t & (row.t - 1)) === 0 || row.t === 3 || row.t === 127 || row.t === result.ticks)
    .map((row) => `${row.t}:${row.meanWeight.toFixed(1)}/${row.meanIslands.toFixed(1)}/${row.necklaces}`)
    .join('  ')
}

console.log('start   op           pair      w    wt2  blk8  maj   dup   all1   t=end wt/isl/neck')
for (const width of [15, 137]) {
  for (const job of jobs) {
    const result = runFastPath({ width, seed: 11, ...job })
    const last = result.snapshots.at(-1)!
    console.log([
      job.start.padEnd(7),
      job.combine.padEnd(12),
      job.pairing.padEnd(8),
      String(width).padStart(3),
      String(result.timeToWeight2 ?? '-').padStart(5),
      String(result.timeToBlock8 ?? '-').padStart(5),
      String(result.timeToMajority ?? '-').padStart(5),
      String(result.timeToDuplicate ?? '-').padStart(5),
      String(result.timeToAllOnes ?? '-').padStart(5),
      `${last.meanWeight.toFixed(1)}/${last.meanIslands.toFixed(1)}/${last.necklaces}/${last.unique}`.padStart(18),
    ].join('  '))
    console.log(`  ${weightsAt(result)}`)
    console.log(`  ${result.finding}`)
  }
  console.log('')
}
