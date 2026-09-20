import { boundedInteger, boundedNumber } from '../simphy/numbers'
import { grainCoupling } from './grainCoupling'
import { shiftIn } from './historyChainSim'
import {
  allOnes,
  pickDir,
  runChoiceEnsemble,
  runChoiceWalk,
  type DerivedLaw,
} from './choiceCouplingSim'
import {
  alignedReceiver,
  evaluateAlignment,
  evaluateMajority,
  majorityThreshold,
  popcount,
  randomBiasedRegister,
  REGISTER_WIDTH_MAX,
} from './quantumRegisterEngine'

export const CONSEQUENCE_NOTES = Object.freeze([
  'exclusive: many futures may handshake; at most one step is taken',
  'two clocks: lab ticks vs completed couplings; |Δx| ≤ completions ≤ ticks',
  'dribble: completeness-rate opposite bits cannot cross majority in a 137-window',
  'jump: a full +u flip at w′ does reverse the worldline',
  'habit: a fully aligned self ledger outranks any env with matchP < 1 under MAP',
  'complement: antipodal receivers split the width, so odd M forbids a double handshake',
  'locale: matchP(x) is an environment of futures, not a potential energy',
  'shared-future: co-motion needs a common receiver listed as a future, not offer-offer handshake',
])

export interface HabitFieldResult {
  select: 'max-align' | 'softmax'
  envMatchP: number
  x: number
  onesEnd: number
  reversed: boolean
  validatesTheory: false
  finding: string
}

export interface ComplementaryResult {
  width: number
  ticks: number
  bothEligible: number
  eitherEligible: number
  validatesTheory: false
  finding: string
}

export interface SharedFutureResult {
  couple: boolean
  sameRate: number
  jointRate: number
  validatesTheory: false
  finding: string
}

export interface DwellResult {
  width: number
  matchP: number[]
  meanDwell: number
  switches: number
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

export function runHabitVsField(
  select: 'max-align' | 'softmax',
  width: number,
  ticks: number,
  seed: number,
  envMatchP = 0.9,
  beta = 0.2,
): HabitFieldResult {
  const bits      = boundedInteger(width, 'width', 3, REGISTER_WIDTH_MAX)
  const steps     = boundedInteger(ticks, 'ticks', 1, 8000)
  const envP      = boundedNumber(envMatchP, 'envMatchP', 0, 1)
  const threshold = majorityThreshold(bits)
  const random    = rng32(seed)
  let offer = allOnes(bits)
  let x = 0
  const startSign = 1
  let reversed = false
  for (let t = 1; t <= steps; t++) {
    const rec = [
      allOnes(bits),
      0n,
      alignedReceiver(offer, bits, random, 1 - envP),
      alignedReceiver(offer, bits, random, envP),
    ]
    const votes    = rec.map((receiver) => evaluateAlignment(offer, receiver, bits))
    const aligned  = votes.map((vote) => vote.aligned)
    const eligible = votes.map((vote) => vote.committed)
    const choice   = pickDir(aligned, eligible, select, beta, threshold, random)
    if (choice === null) continue
    const dir = choice === 0 || choice === 2 ? 1 : -1
    x += dir
    if (Math.sign(dir) !== startSign) reversed = true
    offer = shiftIn(offer, bits, dir === 1 ? 1 : 0)
  }
  return {
    select, envMatchP: envP, x, onesEnd: popcount(offer), reversed, validatesTheory: false,
    finding: `habit MAP vs env matchP=${envP}: x=${x} ones=${popcount(offer)} reversed=${reversed}. Full self alignment scores ${bits}; env mean ${ (envP * bits).toFixed(1)}.`,
  }
}

export function runComplementary(width: number, ticks: number, seed: number): ComplementaryResult {
  const bits   = boundedInteger(width, 'width', 3, REGISTER_WIDTH_MAX)
  const steps  = boundedInteger(ticks, 'ticks', 1, 8000)
  const random = rng32(seed)
  const mask   = allOnes(bits)
  let both = 0, either = 0
  for (let t = 0; t < steps; t++) {
    const offer = randomBiasedRegister(bits, random, 0.5)
    const rec   = randomBiasedRegister(bits, random, 0.5)
    const a     = evaluateAlignment(offer, rec, bits).committed
    const b     = evaluateAlignment(offer, (~rec) & mask, bits).committed
    if (a || b) either++
    if (a && b) both++
  }
  return {
    width: bits, ticks: steps, bothEligible: both, eitherEligible: either, validatesTheory: false,
    finding: `complementary futures: both-eligible ${both}/${steps}. Odd width splits aligned+disagreed=${bits}, so majority cannot hold on both.`,
  }
}

export function runSharedFuture(couple: boolean, width: number, ticks: number, seed: number): SharedFutureResult {
  const bits   = boundedInteger(width, 'width', 3, REGISTER_WIDTH_MAX)
  const steps  = boundedInteger(ticks, 'ticks', 1, 8000)
  const random = rng32(seed)
  const thresh = majorityThreshold(bits)
  let same = 0, joint = 0, moved = 0
  for (let t = 0; t < steps; t++) {
    const offerA = randomBiasedRegister(bits, random, 0.5)
    const offerB = randomBiasedRegister(bits, random, 0.5)
    const envA   = [alignedReceiver(offerA, bits, random, 0.55), alignedReceiver(offerA, bits, random, 0.55)]
    const envB   = [alignedReceiver(offerB, bits, random, 0.55), alignedReceiver(offerB, bits, random, 0.55)]
    const shared = randomBiasedRegister(bits, random, 0.5)
    const pickEnv = (offer: bigint, rec: bigint[]) => {
      const votes    = rec.map((receiver) => evaluateAlignment(offer, receiver, bits))
      return pickDir(votes.map((v) => v.aligned), votes.map((v) => v.committed), 'max-align', 0.2, thresh, random)
    }
    let dirA = pickEnv(offerA, envA)
    let dirB = pickEnv(offerB, envB)
    const jointNow = couple
      && evaluateAlignment(offerA, shared, bits).committed
      && evaluateAlignment(offerB, shared, bits).committed
    if (jointNow) {
      joint++
      const step = evaluateMajority(shared, bits).step
      dirA = step === 1 ? 0 : 1
      dirB = dirA
    }
    if (dirA === null || dirB === null) continue
    moved++
    if (dirA === dirB) same++
  }
  const sameRate  = moved === 0 ? 0 : same / moved
  const jointRate = joint / steps
  return {
    couple, sameRate, jointRate, validatesTheory: false,
    finding: `shared future ${couple ? 'on' : 'off'}: P(same)=${sameRate.toFixed(3)} joint=${jointRate.toFixed(3)}. Co-motion is a listed common receiver, not offer-offer alignment.`,
  }
}

export function runDwell(width: number, ticks: number, seed: number, matchP: [number, number]): DwellResult {
  const bits   = boundedInteger(width, 'width', 3, REGISTER_WIDTH_MAX)
  const steps  = boundedInteger(ticks, 'ticks', 1, 8000)
  const random = rng32(seed)
  const thresh = majorityThreshold(bits)
  let last: number | null = null, run = 0, runs = 0, runSum = 0, switches = 0
  for (let t = 0; t < steps; t++) {
    const offer = randomBiasedRegister(bits, random, 0.5)
    const rec   = matchP.map((p) => alignedReceiver(offer, bits, random, p))
    const votes = rec.map((receiver) => evaluateAlignment(offer, receiver, bits))
    const choice = pickDir(votes.map((v) => v.aligned), votes.map((v) => v.committed), 'max-align', 0.2, thresh, random)
    if (choice === null) continue
    if (last === null) { last = choice; run = 1; continue }
    if (choice === last) run++
    else {
      switches++
      runSum += run
      runs++
      last = choice
      run = 1
    }
  }
  if (run > 0 && last !== null) { runSum += run; runs++ }
  return { width: bits, matchP, meanDwell: runs === 0 ? 0 : runSum / runs, switches }
}

export function susceptibility(width: number, delta: number, ticks: number, trials: number, seed: number): number {
  const row = runChoiceEnsemble({
    width, ticks, trials, seed, dims: 1, matchP: [0.5 + delta, 0.5],
    select: 'max-align', ledger: 'none', field: 'iid', gateComplete: false,
  })
  const moved = 1 - row.meanStayRate
  const pPlus = moved <= 0 ? 0.5 : row.meanMoveFrac[0]! / moved
  return (pPlus - 0.5) / delta
}

export function derivedConsequences(seed = 11): DerivedLaw[] {
  const exclusive = runChoiceWalk({
    width: 137, ticks: 80, seed, dims: 2, matchP: [1, 1, 1, 1],
    select: 'max-align', ledger: 'none', field: 'iid', gateComplete: false,
  })
  const clocks = runChoiceWalk({
    width: 137, ticks: 2000, seed, dims: 2, matchP: [1, 1, 1, 1],
    select: 'max-align', ledger: 'none', field: 'iid', gateComplete: true,
  })
  const dribble = runChoiceWalk({
    width: 137, ticks: 2000, seed, dims: 1, matchP: [0.5, 0.5],
    select: 'max-align', ledger: 'self-moves', field: 'frozen', gateComplete: false,
    start: allOnes(137), ledgerLeak: 'dribble',
  })
  const jumps = Array.from({ length: 12 }, (_, i) => runChoiceWalk({
    width: 137, ticks: 800, seed: seed + i * 19, dims: 1, matchP: [0.5, 0.5],
    select: 'max-align', ledger: 'self-moves', field: 'frozen', gateComplete: false,
    start: allOnes(137), ledgerLeak: 'flip-jump',
  }))
  const habit = runHabitVsField('max-align', 137, 120, seed, 0.9)
  const softHabit = runHabitVsField('softmax', 137, 120, seed, 0.9, 0.2)
  const complement = runComplementary(137, 200, seed)
  const barrier = runChoiceWalk({
    width: 137, ticks: 300, seed, dims: 1, matchP: [0.5, 0.5],
    select: 'max-align', ledger: 'none', field: 'iid', gateComplete: false,
    startX: -6,
    matchPAt: (x) => x < 0 ? [0.7, 0.5] : [0.05, 0.7],
  })
  const sharedOff = runSharedFuture(false, 137, 300, seed)
  const sharedOn  = runSharedFuture(true, 137, 300, seed)
  const dwellFair = runDwell(137, 400, seed, [0.5, 0.5])
  const dwellBias = runDwell(137, 400, seed, [0.62, 0.5])
  const chi15  = susceptibility(15, 0.04, 200, 8, seed)
  const chi137 = susceptibility(137, 0.04, 200, 6, seed)
  const wPrime = grainCoupling(137)
  const jumpTimes = jumps.map((row) => row.reverseTime).filter((t): t is number => t !== null)
  const rClock = Math.hypot(clocks.x, clocks.y)
  return [
    {
      name: 'exclusive occupancy',
      from: 'one offer, many futures, one sampled choice',
      statement: `matchP=1 2d: maxEligible=${exclusive.maxEligible} multi=${exclusive.multiEligibleRate.toFixed(2)} stay=${exclusive.stay} completions=${exclusive.completions}`,
      supported: exclusive.maxEligible === 4 && exclusive.multiEligibleRate === 1 && exclusive.stay === 0 && exclusive.completions === 80,
    },
    {
      name: 'two clocks and a speed limit',
      from: 'complete at w′; a step is at most one lattice hop',
      statement: `lab |v|=${(rClock / clocks.ticks).toFixed(4)} proper ${(rClock / Math.max(1, clocks.completions)).toFixed(2)} cone ${rClock <= clocks.completions} w′=${wPrime.toFixed(4)}`,
      supported: rClock <= clocks.completions && clocks.completions <= clocks.ticks && Math.abs(clocks.completeRate - wPrime) < 0.015,
    },
    {
      name: 'dribble cannot reverse a 137-window',
      from: 'ledger shift-in of opposite bits at rate w′; E[zeros]≈Mw′≈2',
      statement: `dribble reversed=${dribble.reversed} onesEnd=${dribble.onesEnd} x=${dribble.x}`,
      supported: !dribble.reversed && dribble.onesEnd > 120 && dribble.x > 1500,
    },
    {
      name: 'completeness jump does reverse',
      from: 'flip-jump of +u at w′; mean wait 1/w′',
      statement: `reversed ${jumpTimes.length}/12 mean t=${jumpTimes.length ? mean(jumpTimes).toFixed(1) : 'na'} vs ${ (1 / wPrime).toFixed(1)}`,
      supported: jumpTimes.length === 12 && mean(jumpTimes) > 20 && mean(jumpTimes) < 150,
    },
    {
      name: 'habit outranks a strong field under MAP',
      from: 'self aligned=M beats env mean matchP·M < M',
      statement: `MAP x=${habit.x} ones=${habit.onesEnd} reversed=${habit.reversed}; softmax x=${softHabit.x} ones=${softHabit.onesEnd} reversed=${softHabit.reversed}`,
      supported: !habit.reversed && habit.x === 120 && habit.onesEnd === 137,
    },
    {
      name: 'complementary futures are mutually exclusive',
      from: 'aligned + disagreed = width; odd majority cannot hold twice',
      statement: `both-eligible ${complement.bothEligible} either ${complement.eitherEligible}`,
      supported: complement.bothEligible === 0 && complement.eitherEligible === complement.ticks,
    },
    {
      name: 'locale matchP reflects at a wall',
      from: 'futures indexed by x, not a force law',
      statement: `start -6 wall 0: end x=${barrier.x}`,
      supported: barrier.x <= 1 && barrier.x >= -40,
    },
    {
      name: 'shared future co-moves; offer handshake did not',
      from: 'a common receiver listed as a future, both must handshake it',
      statement: `P(same) off ${sharedOff.sameRate.toFixed(3)} on ${sharedOn.sameRate.toFixed(3)} joint ${sharedOn.jointRate.toFixed(3)}`,
      supported: sharedOn.sameRate > sharedOff.sameRate + 0.05 && sharedOn.jointRate > 0.1,
    },
    {
      name: 'bias lengthens dwell; width sharpens susceptibility',
      from: 'MAP near a matchP tie flickers; large odd M is a steep classifier',
      statement: `dwell fair ${dwellFair.meanDwell.toFixed(1)} bias ${dwellBias.meanDwell.toFixed(1)}; χ15=${chi15.toFixed(1)} χ137=${chi137.toFixed(1)}`,
      supported: dwellBias.meanDwell > dwellFair.meanDwell * 2 && chi137 > chi15,
    },
  ]
}
