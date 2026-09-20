import { boundedInteger, boundedNumber } from '../simphy/numbers'
import {
  alignedReceiver,
  evaluateAlignment,
  evaluateMajority,
  majorityThreshold,
  randomBiasedRegister,
  REGISTER_WIDTH_MAX,
} from './quantumRegisterEngine'

export type AlignmentStepRule = 'meta-majority' | 'action-reaction' | 'attract' | 'co-move'
export type PhaseSource = 'independent' | 'shared-bath' | 'contagion'

export interface AlignmentPhysicsInput {
  agents: number
  width: number
  ticks: number
  seed: number
  matchP: number
  stepRule: AlignmentStepRule
  phaseSource: PhaseSource
}

export interface AlignmentPhysicsSnapshot {
  t: number
  msd: number
  relativeMsd: number
  meanAbs: number
  momentum: number
}

export interface AlignmentPhysicsResult {
  input: AlignmentPhysicsInput
  threshold: number
  odd: boolean
  handshakeRate: number
  multiAlignRate: number
  meanAlignmentsPerAgentTick: number
  coneViolations: number
  maxKick: number
  momentumMean: number
  momentumRms: number
  clusterSpan: number
  globalLockRate: number
  msdExponent: number
  relativeMsdExponent: number
  snapshots: AlignmentPhysicsSnapshot[]
  appeared: string[]
  absent: string[]
  finding: string
}

function rng32(seed: number): () => number {
  let state = boundedInteger(seed, 'seed', 1, 0xffff_ffff) >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function logLogExponent(points: AlignmentPhysicsSnapshot[], key: 'msd' | 'relativeMsd'): number {
  const usable = points.filter((point) => point.t >= 20 && point[key] > 0)
  if (usable.length < 3) return 0
  const xs = usable.map((point) => Math.log(point.t))
  const ys = usable.map((point) => Math.log(point[key]))
  const xBar = mean(xs)
  const yBar = mean(ys)
  const denom = xs.reduce((sum, x) => sum + (x - xBar) ** 2, 0)
  if (denom === 0) return 0
  return xs.reduce((sum, x, index) => sum + (x - xBar) * (ys[index]! - yBar), 0) / denom
}

function signum(value: number): -1 | 0 | 1 {
  if (value > 0) return 1
  if (value < 0) return -1
  return 0
}

export function runAlignmentPhysics(input: AlignmentPhysicsInput): AlignmentPhysicsResult {
  const agents    = boundedInteger(input.agents, 'agents', 2, 64)
  const width     = boundedInteger(input.width, 'width', 3, REGISTER_WIDTH_MAX)
  const ticks     = boundedInteger(input.ticks, 'ticks', 8, 8000)
  const matchP    = boundedNumber(input.matchP, 'matchP', 0, 1)
  const random    = rng32(input.seed)
  const threshold = majorityThreshold(width)
  const unitStep  = input.stepRule === 'meta-majority' || input.stepRule === 'attract'
  const origins   = Array.from({ length: agents }, (_, index) => index * 2)
  const positions = [...origins]
  const phases    = Array.from({ length: agents }, () => randomBiasedRegister(width, random, 0.5))
  const snapshotAt = new Set([10, 20, 50, 100, 200, 400, 800, 1600, 3200, ticks])
  const snapshots: AlignmentPhysicsResult['snapshots'] = []
  const momenta: number[] = []
  let handshakes = 0, multiAlignTicks = 0, alignmentEvents = 0, coneViolations = 0, maxKick = 0, globalLocks = 0

  for (let t = 1; t <= ticks; t++) {
    if (input.phaseSource === 'shared-bath') {
      const bath = randomBiasedRegister(width, random, 0.5)
      for (let index = 0; index < agents; index++) phases[index] = alignedReceiver(bath, width, random, matchP)
    } else if (input.phaseSource === 'independent') {
      for (let index = 0; index < agents; index++) phases[index] = randomBiasedRegister(width, random, 0.5)
    }
    const votes  = phases.map((phase) => evaluateMajority(phase, width).step)
    const kicks  = Array.from({ length: agents }, () => 0)
    const counts = Array.from({ length: agents }, () => 0)
    for (let i = 0; i < agents; i++) {
      for (let j = i + 1; j < agents; j++) {
        if (!evaluateAlignment(phases[i]!, phases[j]!, width).committed) continue
        handshakes++
        counts[i]!++
        counts[j]!++
        if (input.stepRule === 'action-reaction') {
          kicks[i]! += votes[i]!
          kicks[j]! -= votes[i]!
        } else if (input.stepRule === 'attract') {
          const dir = signum(positions[j]! - positions[i]!)
          kicks[i]! += dir
          kicks[j]! -= dir
        } else if (input.stepRule === 'co-move') {
          kicks[i]! += votes[i]!
          kicks[j]! += votes[i]!
        } else {
          kicks[i]! += votes[j]!
          kicks[j]! += votes[i]!
        }
      }
    }
    if (input.phaseSource === 'contagion') {
      for (let i = 0; i < agents; i++) {
        for (let j = i + 1; j < agents; j++) {
          if (!evaluateAlignment(phases[i]!, phases[j]!, width).committed) continue
          if (random() < 0.5) phases[j] = phases[i]!
          else phases[i] = phases[j]!
        }
      }
    }
    alignmentEvents += counts.reduce((sum, count) => sum + count, 0)
    if (counts.some((count) => count >= 2)) multiAlignTicks++
    const applied = kicks.map((kick, index) => {
      const step = unitStep ? signum(kick) : kick
      maxKick = Math.max(maxKick, Math.abs(step))
      positions[index]! += step
      return step
    })
    const uniqueSteps = new Set(applied.filter((step) => step !== 0))
    if (uniqueSteps.size <= 1) globalLocks++
    const momentum = applied.reduce((sum, step) => sum + step, 0)
    momenta.push(momentum)
    const speed = unitStep ? 1 : Math.max(1, maxKick)
    for (const [index, position] of positions.entries()) {
      if (Math.abs(position - origins[index]!) > t * speed) coneViolations++
    }
    if (snapshotAt.has(t)) {
      const center = mean(positions)
      snapshots.push({
        t,
        msd:         mean(positions.map((position, index) => (position - origins[index]!) ** 2)),
        relativeMsd: mean(positions.map((position) => (position - center) ** 2)),
        meanAbs:     mean(positions.map((position, index) => Math.abs(position - origins[index]!))),
        momentum,
      })
    }
  }

  const msdExponent         = logLogExponent(snapshots, 'msd')
  const relativeMsdExponent = logLogExponent(snapshots, 'relativeMsd')
  const handshakeRate       = handshakes / (ticks * agents * (agents - 1) / 2)
  const multiAlignRate      = multiAlignTicks / ticks
  const meanAlignmentsPerAgentTick = alignmentEvents / (ticks * agents)
  const momentumMean        = mean(momenta)
  const momentumRms         = Math.sqrt(mean(momenta.map((value) => (value - momentumMean) ** 2)))
  const clusterSpan         = Math.max(...positions) - Math.min(...positions)
  const initialSpan         = origins[agents - 1]! - origins[0]!
  const globalLockRate      = globalLocks / ticks
  const appeared: string[]  = []
  const absent: string[]    = []

  if (unitStep && coneViolations === 0 && maxKick <= 1) appeared.push('causal cone |Δx| ≤ 1 from majority-of-alignments')
  else absent.push('strict causal cone of one step per tick')
  if (input.stepRule === 'action-reaction' && Math.abs(momentumMean) < 1e-9 && momentumRms < 1e-9) {
    appeared.push('exact pairwise momentum conservation')
  } else {
    absent.push('momentum conservation')
  }
  if (input.stepRule === 'attract' && clusterSpan < initialSpan * 0.5) appeared.push('spatial clustering from attractive alignments')
  else absent.push('bound-state clustering')
  if (msdExponent > 1.6) appeared.push(`ballistic lab-frame MSD ~ t^${msdExponent.toFixed(2)}`)
  else if (msdExponent > 0.7 && msdExponent < 1.3) appeared.push(`diffusive lab-frame MSD ~ t^${msdExponent.toFixed(2)}`)
  else absent.push('clean ballistic or diffusive MSD')
  if (input.phaseSource === 'shared-bath' && globalLockRate > 0.7 && relativeMsdExponent < 0.5) {
    appeared.push('shared 137-bit bath: global clock, relative motion suppressed')
  } else {
    absent.push('global time-lock from a shared bath')
  }
  if (input.phaseSource === 'contagion' && globalLockRate > 0.5) appeared.push('phase contagion reaches a common majority and rigid translation')
  else if (input.phaseSource === 'contagion') absent.push('phase-contagion consensus')
  if (multiAlignRate > 0.2) appeared.push(`multiple simultaneous alignments on ${(multiAlignRate * 100).toFixed(1)}% of ticks`)
  else absent.push('frequent simultaneous multi-alignments')
  absent.push('Maxwell / Dirac / Schrödinger dynamics')
  absent.push('1/137 as a generated coupling')
  absent.push('3-space metric or Lorentz boosts')

  return {
    input: { ...input, agents, width, ticks, matchP },
    threshold,
    odd: width % 2 === 1,
    handshakeRate,
    multiAlignRate,
    meanAlignmentsPerAgentTick,
    coneViolations,
    maxKick,
    momentumMean,
    momentumRms,
    clusterSpan,
    globalLockRate,
    msdExponent,
    relativeMsdExponent,
    snapshots,
    appeared,
    absent,
    finding: physicsFinding(input, handshakeRate, msdExponent, relativeMsdExponent, globalLockRate, momentumRms, clusterSpan),
  }
}

function physicsFinding(
  input: AlignmentPhysicsInput,
  handshakeRate: number,
  msdExponent: number,
  relativeMsdExponent: number,
  globalLockRate: number,
  momentumRms: number,
  clusterSpan: number,
): string {
  return [
    `width ${input.width} threshold ${majorityThreshold(input.width)} rule ${input.stepRule} source ${input.phaseSource}`,
    `handshake rate ${handshakeRate.toFixed(4)}`,
    `MSD exponent ${msdExponent.toFixed(2)} (comoving ${relativeMsdExponent.toFixed(2)})`,
    `global lock ${globalLockRate.toFixed(3)}`,
    `momentum rms ${momentumRms.toFixed(3)}`,
    `cluster span ${clusterSpan}`,
  ].join('; ')
}

export function runAlignmentPhysicsSuite(seed = 137): AlignmentPhysicsResult[] {
  const base = { agents: 16, ticks: 800, seed }
  const rows: AlignmentPhysicsInput[] = [
    { ...base, width: 137, matchP: 0.5, stepRule: 'meta-majority',    phaseSource: 'independent' },
    { ...base, width: 15,  matchP: 0.5, stepRule: 'meta-majority',    phaseSource: 'independent' },
    { ...base, width: 137, matchP: 0.5, stepRule: 'action-reaction',  phaseSource: 'independent' },
    { ...base, width: 137, matchP: 0.5, stepRule: 'attract',          phaseSource: 'independent' },
    { ...base, width: 137, matchP: 0.6, stepRule: 'co-move',          phaseSource: 'shared-bath' },
    { ...base, width: 137, matchP: 0.5, stepRule: 'meta-majority',    phaseSource: 'contagion' },
    { ...base, width: 137, matchP: 0.55, stepRule: 'meta-majority',   phaseSource: 'shared-bath' },
  ]
  return rows.map((row) => runAlignmentPhysics(row))
}
