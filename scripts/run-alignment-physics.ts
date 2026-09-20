import { runAlignmentPhysicsSuite, type AlignmentPhysicsResult } from '../src/quantum-registers/alignmentPhysicsSim.ts'

function row(result: AlignmentPhysicsResult): string {
  const i = result.input
  return [
    i.width.toString().padStart(3),
    i.stepRule.padEnd(16),
    i.phaseSource.padEnd(12),
    result.handshakeRate.toFixed(3),
    result.multiAlignRate.toFixed(3),
    result.msdExponent.toFixed(2).padStart(6),
    result.relativeMsdExponent.toFixed(2).padStart(6),
    result.globalLockRate.toFixed(3),
    result.momentumRms.toFixed(3).padStart(7),
    result.maxKick.toString().padStart(4),
    result.clusterSpan.toString().padStart(5),
    result.coneViolations.toString().padStart(5),
  ].join('  ')
}

const results = runAlignmentPhysicsSuite(137)
console.log('w    rule              source        P_hs   P_multi  MSD~t  rel~t  lock   p_rms  kick  span  cone')
for (const result of results) console.log(row(result))
console.log('')
for (const result of results) {
  console.log(`--- ${result.input.stepRule} / ${result.input.phaseSource} / w=${result.input.width}`)
  console.log(`appeared: ${result.appeared.join(' | ') || '(none)'}`)
  console.log(`absent:   ${result.absent.join(' | ')}`)
  console.log(`last snapshot: ${JSON.stringify(result.snapshots.at(-1))}`)
  console.log('')
}
