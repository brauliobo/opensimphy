import { boundedInteger, boundedNumber } from '../simphy/numbers'
import { grainCoupling } from './grainCoupling'
import { shiftIn } from './historyChainSim'
import {
  alignedReceiver,
  binomialPge,
  evaluateAlignment,
  evaluateMajority,
  majorityThreshold,
  popcount,
  randomBiasedRegister,
  REGISTER_WIDTH_MAX,
} from './quantumRegisterEngine'

export const CHOICE_PRINCIPLES = Object.freeze([
  'offer: a particle carries one odd-width phase word, not a Hilbert vector',
  'futures: each allowed move is a competing receiver (a possible next step)',
  'handshake: a future is eligible only when aligned bits ≥ majority threshold',
  'coupling: scores are aligned-bit counts; the MAP move is the highest eligible score',
  'choice: the taken step is sampled from eligible futures (MAP, margin, or softmax)',
  'ledger: a completed coupling may rewrite one offer bit, so past conditions the next tick',
  'complete: a committed MAP step may still fail at rate 1 − (2M−1)/M²',
])

export type ChoiceSelect = 'max-align' | 'softmax' | 'margin'
export type ChoiceLedger = 'none' | 'shift-majority' | 'copy-disagree' | 'self-moves'
export type ChoiceField = 'iid' | 'frozen'
export type LedgerLeak = 'none' | 'dribble' | 'flip-jump'

export interface ChoiceWalkInput {
  width: number
  ticks: number
  seed: number
  dims: 1 | 2
  matchP: number[]
  select: ChoiceSelect
  ledger: ChoiceLedger
  field: ChoiceField
  gateComplete: boolean
  beta?: number
  start?: bigint
  startX?: number
  startY?: number
  ledgerLeak?: LedgerLeak
  matchPAt?: (x: number, y: number) => number[]
}

export interface ChoiceSnapshot {
  t: number
  x: number
  y: number
  r2: number
}

export interface ChoiceWalkResult {
  width: number
  ticks: number
  dims: 1 | 2
  dirs: number
  threshold: number
  coupling: number
  matchP: number[]
  predictedDir: number
  moveCounts: number[]
  stay: number
  handshakes: number
  completions: number
  mapFollows: number
  empiricalDir: number
  recoveredBias: boolean
  stayRate: number
  handshakeRate: number
  completeRate: number
  mapFollowRate: number
  predictedCommit: number[]
  choiceEntropy: number
  x: number
  y: number
  msdExponent: number
  snapshots: ChoiceSnapshot[]
  multiEligibleRate: number
  maxEligible: number
  reversed: boolean
  reverseTime: number | null
  onesEnd: number
  validatesTheory: false
  finding: string
}

export interface ChoiceEnsembleResult {
  trials: number
  recoveredBias: number
  meanStayRate: number
  meanHandshakeRate: number
  meanCompleteRate: number
  meanMapFollowRate: number
  meanMoveFrac: number[]
  meanEntropy: number
  meanMsdExponent: number
  predictedDir: number
  empiricalDir: number
  validatesTheory: false
  finding: string
}

export interface ChoicePairResult {
  width: number
  ticks: number
  handshakeRate: number
  sameGivenHandshake: number
  sameGivenFree: number
  validatesTheory: false
  finding: string
}

export interface DerivedLaw {
  name: string
  from: string
  statement: string
  supported: boolean
}

const DIRS_1D = Object.freeze([
  Object.freeze({ dx: 1,  dy: 0 }),
  Object.freeze({ dx: -1, dy: 0 }),
])
const DIRS_2D = Object.freeze([
  Object.freeze({ dx: 1,  dy: 0 }),
  Object.freeze({ dx: 0,  dy: 1 }),
  Object.freeze({ dx: -1, dy: 0 }),
  Object.freeze({ dx: 0,  dy: -1 }),
])

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

function entropy(fracs: number[]): number {
  return -fracs.reduce((sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0), 0)
}

function argmax(values: number[]): number {
  let best = 0
  for (let i = 1; i < values.length; i++) if (values[i]! > values[best]!) best = i
  return best
}

function logLogExponent(points: ChoiceSnapshot[]): number {
  const usable = points.filter((point) => point.t >= 20 && point.r2 > 0)
  if (usable.length < 3) return 0
  const xs = usable.map((point) => Math.log(point.t))
  const ys = usable.map((point) => Math.log(point.r2))
  const xBar = mean(xs)
  const yBar = mean(ys)
  const denom = xs.reduce((sum, x) => sum + (x - xBar) ** 2, 0)
  if (denom === 0) return 0
  return xs.reduce((sum, x, index) => sum + (x - xBar) * (ys[index]! - yBar), 0) / denom
}

function sampleWeighted(weights: number[], random: () => number): number {
  const total = weights.reduce((sum, w) => sum + w, 0)
  let needle = random() * total
  for (let i = 0; i < weights.length; i++) {
    needle -= weights[i]!
    if (needle <= 0) return i
  }
  return weights.length - 1
}

function copyOneDisagree(offer: bigint, receiver: bigint, width: number, random: () => number): bigint {
  const disagreed: number[] = []
  const xor = offer ^ receiver
  for (let i = 0; i < width; i++) if ((xor >> BigInt(i)) & 1n) disagreed.push(i)
  if (disagreed.length === 0) return offer
  const i    = disagreed[Math.floor(random() * disagreed.length)]!
  const mask = 1n << BigInt(i)
  return ((receiver >> BigInt(i)) & 1n) === 1n ? offer | mask : offer & ~mask
}

export function allOnes(width: number): bigint {
  return (1n << BigInt(width)) - 1n
}

function softmaxWeights(aligned: number[], eligible: boolean[], beta: number): number[] {
  const scores = aligned.map((value, i) => eligible[i] ? beta * value : Number.NEGATIVE_INFINITY)
  const finite = scores.filter(Number.isFinite)
  const peak   = finite.length === 0 ? 0 : Math.max(...finite)
  return scores.map((score) => Number.isFinite(score) ? Math.exp(score - peak) : 0)
}

export function predictedDirection(matchP: number[]): number {
  return argmax(matchP)
}

export function mapSetOf(aligned: number[], eligible: boolean[]): number[] {
  const live = eligible.flatMap((ok, i) => ok ? [i] : [])
  if (live.length === 0) return []
  const peak = Math.max(...live.map((i) => aligned[i]!))
  return live.filter((i) => aligned[i] === peak)
}

export function pickDir(
  aligned: number[],
  eligible: boolean[],
  select: ChoiceSelect,
  beta: number,
  threshold: number,
  random: () => number,
): number | null {
  const live = eligible.flatMap((ok, i) => ok ? [i] : [])
  if (live.length === 0) return null
  if (select === 'max-align') {
    const tied = mapSetOf(aligned, eligible)
    return tied[Math.floor(random() * tied.length)]!
  }
  const weights = select === 'margin'
    ? aligned.map((value, i) => eligible[i] ? Math.max(0, value - threshold + 1) : 0)
    : softmaxWeights(aligned, eligible, beta)
  if (weights.every((w) => w <= 0)) return live[Math.floor(random() * live.length)]!
  return sampleWeighted(weights, random)
}

export function runChoiceWalk(input: ChoiceWalkInput): ChoiceWalkResult {
  const width  = boundedInteger(input.width, 'width', 3, REGISTER_WIDTH_MAX)
  const ticks  = boundedInteger(input.ticks, 'ticks', 1, 8000)
  const dims   = input.dims
  const dirs   = dims === 1 ? DIRS_1D : DIRS_2D
  const n      = dirs.length
  if (input.matchP.length !== n) throw new RangeError(`matchP must have ${n} entries`)
  const matchP = input.matchP.map((p, i) => boundedNumber(p, `matchP[${i}]`, 0, 1))
  const beta   = boundedNumber(input.beta ?? 0.2, 'beta', 0, 8)
  const random = rng32(input.seed)
  const threshold = majorityThreshold(width)
  const coupling  = grainCoupling(width)
  const self      = input.ledger === 'self-moves'
  const leak      = input.ledgerLeak ?? 'none'
  if (self && dims !== 1) throw new RangeError('self-moves requires dims=1')

  let offer = input.start ?? randomBiasedRegister(width, random, 0.5)
  let localP = matchP
  let receivers = dirs.map((_, i) => self
    ? (i === 0 ? allOnes(width) : 0n)
    : alignedReceiver(offer, width, random, localP[i]!))

  const moveCounts = Array.from({ length: n }, () => 0)
  let stay = 0, handshakes = 0, completions = 0, mapFollows = 0, multiEligible = 0, maxEligible = 0
  let x = input.startX ?? 0, y = input.startY ?? 0
  const snapshotAt = new Set([10, 20, 50, 100, 200, 400, 800, 1600, 3200, ticks])
  const snapshots: ChoiceSnapshot[] = []
  const predictedDir = self ? (popcount(offer) >= threshold ? 0 : 1) : predictedDirection(matchP)
  const predictedCommit = self
    ? dirs.map(() => 1)
    : matchP.map((p) => binomialPge(width, threshold, p))
  const startSign = predictedDir === 0 ? 1 : -1
  let reverseTime: number | null = null

  for (let t = 1; t <= ticks; t++) {
    if (input.matchPAt) {
      localP = input.matchPAt(x, y).map((p, i) => boundedNumber(p, `matchPAt[${i}]`, 0, 1))
      if (localP.length !== n) throw new RangeError(`matchPAt must have ${n} entries`)
    }
    if (!self && input.field === 'iid') {
      if (input.ledger === 'none') offer = randomBiasedRegister(width, random, 0.5)
      receivers = dirs.map((_, i) => alignedReceiver(offer, width, random, localP[i]!))
    } else if (self) {
      receivers = [allOnes(width), 0n]
    }
    const votes     = receivers.map((receiver) => evaluateAlignment(offer, receiver, width))
    const aligned   = votes.map((vote) => vote.aligned)
    const eligible  = votes.map((vote) => vote.committed)
    const liveN     = eligible.filter(Boolean).length
    maxEligible     = Math.max(maxEligible, liveN)
    if (liveN >= 2) multiEligible++
    if (liveN > 0) handshakes++
    const mapSet    = mapSetOf(aligned, eligible)
    const choice    = pickDir(aligned, eligible, input.select, beta, threshold, random)
    if (choice !== null && mapSet.includes(choice)) mapFollows++
    const gated     = choice !== null && (!input.gateComplete || random() < coupling)
    if (choice === null || !gated) {
      stay++
    } else {
      completions++
      moveCounts[choice]!++
      x += dirs[choice]!.dx
      y += dirs[choice]!.dy
      if (self && reverseTime === null && Math.sign(dirs[choice]!.dx) !== startSign) reverseTime = t
      if (input.ledger === 'shift-majority') offer = shiftIn(offer, width, evaluateMajority(receivers[choice]!, width).majority === 1 ? 1 : 0)
      if (input.ledger === 'copy-disagree') offer = copyOneDisagree(offer, receivers[choice]!, width, random)
      if (self) {
        if (leak === 'flip-jump' && random() < coupling) offer ^= allOnes(width)
        else {
          const chosen = (choice === 0 ? 1 : 0) as 0 | 1
          const bit    = leak === 'dribble' && random() < coupling ? ((1 - chosen) as 0 | 1) : chosen
          offer = shiftIn(offer, width, bit)
        }
      }
    }
    if (snapshotAt.has(t)) snapshots.push({ t, x, y, r2: x * x + y * y })
  }

  const empiricalDir   = argmax(moveCounts)
  const uniqueBias     = !self && matchP.filter((p) => p === matchP[predictedDir]!).length === 1
  const recoveredBias  = uniqueBias && empiricalDir === predictedDir && moveCounts[empiricalDir]! > stay
  const stayRate       = stay / ticks
  const handshakeRate  = handshakes / ticks
  const completeRate   = completions / ticks
  const mapFollowRate  = mapFollows / ticks
  const moveFrac       = moveCounts.map((count) => count / ticks)
  const choiceEntropy  = entropy([...moveFrac, stayRate])
  const msdExponent    = logLogExponent(snapshots)
  const finding = [
    `principles: offer/futures/handshake/coupling`,
    `w=${width} thresh=${threshold} ${dims}d ${input.select} ${input.ledger} ${input.field}${input.gateComplete ? ' gated' : ''}`,
    `MAP dir ${predictedDir} empirical ${empiricalDir} recovered=${recoveredBias}`,
    `handshake ${handshakeRate.toFixed(3)} complete ${completeRate.toFixed(3)} MAP-follow ${mapFollowRate.toFixed(3)} stay ${stayRate.toFixed(3)}`,
    `H=${choiceEntropy.toFixed(2)} bit  MSD~t^${msdExponent.toFixed(2)}  w′=${coupling.toExponential(3)}`,
    `eligible max ${maxEligible} multi ${ (multiEligible / ticks).toFixed(3)} reverse ${reverseTime ?? 'none'}`,
    'derived walk from coupling scores, not Maxwell/Dirac; validatesTheory=false',
  ].join('; ')

  return {
    width, ticks, dims, dirs: n, threshold, coupling, matchP, predictedDir, moveCounts, stay, handshakes,
    completions, mapFollows, empiricalDir, recoveredBias, stayRate, handshakeRate, completeRate,
    mapFollowRate, predictedCommit, choiceEntropy, x, y, msdExponent, snapshots,
    multiEligibleRate: multiEligible / ticks, maxEligible, reversed: reverseTime !== null, reverseTime,
    onesEnd: popcount(offer), validatesTheory: false, finding,
  }
}

export function runChoiceEnsemble(
  input: Omit<ChoiceWalkInput, 'seed'> & { trials: number, seed: number },
): ChoiceEnsembleResult {
  const trials = boundedInteger(input.trials, 'trials', 1, 400)
  const walks  = Array.from({ length: trials }, (_, i) => runChoiceWalk({ ...input, seed: input.seed + i * 17 }))
  const meanMoveFrac = walks[0]!.moveCounts.map((_, i) => mean(walks.map((walk) => walk.moveCounts[i]! / input.ticks)))
  const empiricalDir = argmax(meanMoveFrac)
  const predictedDir = walks[0]!.predictedDir
  const recovered    = walks.filter((walk) => walk.recoveredBias).length / trials
  return {
    trials,
    recoveredBias: recovered,
    meanStayRate: mean(walks.map((walk) => walk.stayRate)),
    meanHandshakeRate: mean(walks.map((walk) => walk.handshakeRate)),
    meanCompleteRate: mean(walks.map((walk) => walk.completeRate)),
    meanMapFollowRate: mean(walks.map((walk) => walk.mapFollowRate)),
    meanMoveFrac,
    meanEntropy: mean(walks.map((walk) => walk.choiceEntropy)),
    meanMsdExponent: mean(walks.map((walk) => walk.msdExponent)),
    predictedDir,
    empiricalDir,
    validatesTheory: false,
    finding: `ensemble ${trials}: recover ${recovered.toFixed(2)} MAP ${predictedDir}→${empiricalDir} stay ${mean(walks.map((w) => w.stayRate)).toFixed(3)} complete ${mean(walks.map((w) => w.completeRate)).toFixed(3)}`,
  }
}

export function runChoicePair(width: number, ticks: number, seed: number, matchP = 0.55): ChoicePairResult {
  const bits   = boundedInteger(width, 'width', 3, REGISTER_WIDTH_MAX)
  const steps  = boundedInteger(ticks, 'ticks', 1, 8000)
  const agree  = boundedNumber(matchP, 'matchP', 0, 1)
  const random = rng32(seed)
  let hs = 0, sameHs = 0, free = 0, sameFree = 0
  for (let t = 0; t < steps; t++) {
    const offerA = randomBiasedRegister(bits, random, 0.5)
    const offerB = randomBiasedRegister(bits, random, 0.5)
    const recA     = [alignedReceiver(offerA, bits, random, agree), alignedReceiver(offerA, bits, random, agree)]
    const recB     = [alignedReceiver(offerB, bits, random, agree), alignedReceiver(offerB, bits, random, agree)]
    const votesA   = recA.map((receiver) => evaluateAlignment(offerA, receiver, bits))
    const votesB   = recB.map((receiver) => evaluateAlignment(offerB, receiver, bits))
    const eligA    = votesA.map((vote) => vote.committed)
    const eligB    = votesB.map((vote) => vote.committed)
    const alignedA = votesA.map((vote) => vote.aligned)
    const alignedB = votesB.map((vote) => vote.aligned)
    const choiceA = pickDir(alignedA, eligA, 'max-align', 0.2, majorityThreshold(bits), random)
    const choiceB = pickDir(alignedB, eligB, 'max-align', 0.2, majorityThreshold(bits), random)
    const coupled = evaluateAlignment(offerA, offerB, bits).committed
    if (choiceA === null || choiceB === null) continue
    if (coupled) {
      hs++
      if (choiceA === choiceB) sameHs++
    } else {
      free++
      if (choiceA === choiceB) sameFree++
    }
  }
  const handshakeRate     = hs / steps
  const sameGivenHandshake = hs === 0 ? 0 : sameHs / hs
  const sameGivenFree      = free === 0 ? 0 : sameFree / free
  return {
    width: bits,
    ticks: steps,
    handshakeRate,
    sameGivenHandshake,
    sameGivenFree,
    validatesTheory: false,
    finding: `pair handshake ${handshakeRate.toFixed(3)}: P(same|hs)=${sameGivenHandshake.toFixed(3)} vs P(same|free)=${sameGivenFree.toFixed(3)}. Independent MAP choices stay uncorrelated; handshake is not itself a force.`,
  }
}

export function derivedChoiceLaws(seed = 11): DerivedLaw[] {
  const unbiased = runChoiceEnsemble({
    width: 137, ticks: 400, trials: 8, seed, dims: 2, matchP: [0.55, 0.55, 0.55, 0.55],
    select: 'max-align', ledger: 'none', field: 'iid', gateComplete: false,
  })
  const biased = runChoiceEnsemble({
    width: 137, ticks: 400, trials: 8, seed, dims: 2, matchP: [0.72, 0.5, 0.5, 0.5],
    select: 'max-align', ledger: 'none', field: 'iid', gateComplete: false,
  })
  const thin = runChoiceEnsemble({
    width: 15, ticks: 400, trials: 12, seed, dims: 1, matchP: [0.56, 0.5],
    select: 'max-align', ledger: 'none', field: 'iid', gateComplete: false,
  })
  const thick = runChoiceEnsemble({
    width: 137, ticks: 400, trials: 8, seed, dims: 1, matchP: [0.56, 0.5],
    select: 'max-align', ledger: 'none', field: 'iid', gateComplete: false,
  })
  const inertia = runChoiceWalk({
    width: 137, ticks: 200, seed, dims: 1, matchP: [0.5, 0.5],
    select: 'max-align', ledger: 'self-moves', field: 'frozen', gateComplete: false,
    start: allOnes(137),
  })
  const gated = runChoiceWalk({
    width: 137, ticks: 2000, seed, dims: 2, matchP: [1, 1, 1, 1],
    select: 'max-align', ledger: 'none', field: 'iid', gateComplete: true,
  })
  const softmax = runChoiceWalk({
    width: 137, ticks: 400, seed, dims: 2, matchP: [0.7, 0.5, 0.5, 0.5],
    select: 'softmax', ledger: 'none', field: 'iid', gateComplete: false, beta: 0.2,
  })
  const frozen = runChoiceWalk({
    width: 137, ticks: 200, seed, dims: 2, matchP: [0.7, 0.5, 0.5, 0.5],
    select: 'max-align', ledger: 'copy-disagree', field: 'frozen', gateComplete: false,
  })
  const pair = runChoicePair(137, 400, seed, 0.55)
  const wPrime = grainCoupling(137)
  const thinP  = thin.meanMoveFrac[0]! / Math.max(1e-9, 1 - thin.meanStayRate)
  const thickP = thick.meanMoveFrac[0]! / Math.max(1e-9, 1 - thick.meanStayRate)
  return [
    {
      name: 'unbiased futures stay isotropic',
      from: 'handshake + MAP on equal matchP',
      statement: `four equal 0.55 futures: entropy ${unbiased.meanEntropy.toFixed(2)} bit, no recovered bias (${unbiased.recoveredBias.toFixed(2)})`,
      supported: unbiased.meanEntropy > 1.8 && unbiased.recoveredBias < 0.5,
    },
    {
      name: 'coupling recovers hidden bias',
      from: 'MAP of aligned bits vs matchP',
      statement: `matchP 0.72/0.5/0.5/0.5 → dir ${biased.predictedDir}, recover ${biased.recoveredBias.toFixed(2)}`,
      supported: biased.recoveredBias >= 0.75 && biased.empiricalDir === 0,
    },
    {
      name: 'odd large width concentrates choice',
      from: 'binomial majority at 15 vs 137',
      statement: `P(+|moved, 0.56) thin ${thinP.toFixed(3)} vs thick ${thickP.toFixed(3)}`,
      supported: thickP > thinP,
    },
    {
      name: 'own register is inertia',
      from: 'self-moves: receivers 1^M and 0^M, odd M forbids a tie',
      statement: `start 1^137 stays on +x for ${inertia.completions} ticks (stay ${inertia.stay})`,
      supported: inertia.moveCounts[0] === inertia.completions && inertia.stay === 0 && inertia.x === 200,
    },
    {
      name: 'completeness gates the step, not the MAP',
      from: 'K₀ completeness w′=(2M−1)/M²',
      statement: `matchP=1 gated complete ${gated.completeRate.toFixed(3)} vs w′ ${wPrime.toFixed(3)}`,
      supported: Math.abs(gated.completeRate - wPrime) < 0.02 && gated.handshakeRate === 1,
    },
    {
      name: 'softmax usually follows the register MAP',
      from: 'choice sampled from exp(β·aligned)',
      statement: `β=0.2 MAP-follow ${softmax.mapFollowRate.toFixed(3)}, empirical ${softmax.empiricalDir}`,
      supported: softmax.mapFollowRate > 0.7 && softmax.empiricalDir === 0,
    },
    {
      name: 'frozen field plus copy-disagree locks a worldline',
      from: 'ledger copies disagreed bits of the chosen future',
      statement: `frozen lock stay ${frozen.stayRate.toFixed(3)} empirical ${frozen.empiricalDir} r²=${frozen.snapshots.at(-1)?.r2}`,
      supported: frozen.stayRate < 0.15 && frozen.completions > 150,
    },
    {
      name: 'two offers handshake without forcing co-motion',
      from: 'independent MAP choices; pair alignment is a gate, not a kick',
      statement: `P(same|hs)=${pair.sameGivenHandshake.toFixed(3)} vs free ${pair.sameGivenFree.toFixed(3)}`,
      supported: Math.abs(pair.sameGivenHandshake - pair.sameGivenFree) < 0.2,
    },
  ]
}

export function runChoiceSuite(seed = 11): {
  principles: readonly string[]
  laws: DerivedLaw[]
  walks: Record<string, ChoiceWalkResult | ChoiceEnsembleResult | ChoicePairResult>
} {
  return {
    principles: CHOICE_PRINCIPLES,
    laws: derivedChoiceLaws(seed),
    walks: {
      unbiased: runChoiceEnsemble({
        width: 137, ticks: 400, trials: 8, seed, dims: 2, matchP: [0.55, 0.55, 0.55, 0.55],
        select: 'max-align', ledger: 'none', field: 'iid', gateComplete: false,
      }),
      biased: runChoiceEnsemble({
        width: 137, ticks: 400, trials: 8, seed, dims: 2, matchP: [0.72, 0.5, 0.5, 0.5],
        select: 'max-align', ledger: 'none', field: 'iid', gateComplete: false,
      }),
      inertia: runChoiceWalk({
        width: 137, ticks: 200, seed, dims: 1, matchP: [0.5, 0.5],
        select: 'max-align', ledger: 'self-moves', field: 'frozen', gateComplete: false,
        start: allOnes(137),
      }),
      pair: runChoicePair(137, 400, seed, 0.55),
    },
  }
}
