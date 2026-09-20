import { boundedInteger } from '../simphy/numbers'
import { CODATA_2022_MEASURED_CONSTANTS } from '../tour/physicsConstants'
import {
  evaluateAlignment,
  evaluateMajority,
  popcount,
  randomBiasedRegister,
} from './quantumRegisterEngine'
import { grainCoupling } from './grainCoupling'
import { flipJumpKraus } from './flipJumpSim'

export const SINGLE_GRAIN = 137
export const PAIR_GRAIN   = 2 * SINGLE_GRAIN

export type PairStart = 'locked-plus' | 'tensor-plus-plus' | 'two-independent' | 'both-majority-gate' | 'handshake-gate'

export interface TensorPairRates {
  width: number
  pairGrain: number
  jointRate: number
  pp: number
  pm: number
  mp: number
  mm: number
  either: number
}

export interface PairJumpResult {
  start: PairStart
  width: number
  pairGrain: number
  trials: number
  predictedRate: number
  measuredRate: number
  meanWait: number
  predictedWait: number
  alpha: number
  rateOverAlpha: number
  concatTieRate: number
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

export function tensorPairRates(width = SINGLE_GRAIN): TensorPairRates {
  const m      = boundedInteger(width, 'width', 3, SINGLE_GRAIN)
  const damp   = (m - 1) / m
  const single = grainCoupling(m)
  const pp     = 1 - damp ** 4
  const either = 1 - (1 - single) ** 2
  return {
    width: m,
    pairGrain: 2 * m,
    jointRate: grainCoupling(2 * m),
    pp,
    pm: single,
    mp: single,
    mm: 0,
    either,
  }
}

export function concatTie(a: bigint, b: bigint, width: number): boolean {
  return popcount(a) + popcount(b) === width
}

function geometricWait(rate: number, random: () => number): number {
  if (rate <= 0) return 1_000_000
  let wait = 1
  while (random() >= rate && wait < 1_000_000) wait++
  return wait
}

function gatedWait(rate: number, open: () => boolean, random: () => number): number {
  for (let wait = 1; wait <= 1_000_000; wait++) {
    if (open() && random() < rate) return wait
  }
  return 1_000_000
}

export function runPairJump(start: PairStart, trials: number, seed: number, width = SINGLE_GRAIN): PairJumpResult {
  const m      = boundedInteger(width, 'width', 3, SINGLE_GRAIN)
  const n      = boundedInteger(trials, 'trials', 1, 80_000)
  const random = rng32(seed)
  const joint  = flipJumpKraus(2 * m)
  const single = flipJumpKraus(m)
  const tensor = tensorPairRates(m)
  const alpha  = CODATA_2022_MEASURED_CONSTANTS.fineStructureConstant.value
  const predictedRate = start === 'locked-plus'        ? joint.rate
    : start === 'tensor-plus-plus'  ? tensor.pp
      : start === 'two-independent'   ? tensor.either
        : start === 'both-majority-gate' ? 0.25 * joint.rate
          : 0.5 * joint.rate
  let waitSum = 0
  let firsts  = 0
  let ties    = 0
  let samples = 0

  for (let trial = 0; trial < n; trial++) {
    let wait = 1
    if (start === 'locked-plus') wait = geometricWait(joint.rate, random)
    else if (start === 'tensor-plus-plus') wait = geometricWait(tensor.pp, random)
    else if (start === 'two-independent') wait = Math.min(geometricWait(single.rate, random), geometricWait(single.rate, random))
    else if (start === 'both-majority-gate') {
      wait = gatedWait(joint.rate, () => {
        const a = randomBiasedRegister(m, random, 0.5)
        const b = randomBiasedRegister(m, random, 0.5)
        samples++
        if (concatTie(a, b, m)) ties++
        return evaluateMajority(a, m).majority === 1 && evaluateMajority(b, m).majority === 1
      }, random)
    } else {
      wait = gatedWait(joint.rate, () => {
        const a = randomBiasedRegister(m, random, 0.5)
        const b = randomBiasedRegister(m, random, 0.5)
        samples++
        if (concatTie(a, b, m)) ties++
        return evaluateAlignment(a, b, m).committed
      }, random)
    }
    if (wait === 1) firsts++
    waitSum += wait
  }

  const measuredRate = firsts / n
  const meanWait     = waitSum / n
  return {
    start,
    width: m,
    pairGrain: 2 * m,
    trials: n,
    predictedRate,
    measuredRate,
    meanWait,
    predictedWait: 1 / predictedRate,
    alpha,
    rateOverAlpha: predictedRate / alpha,
    concatTieRate: samples === 0 ? 0 : ties / samples,
    finding: pairFinding(start, predictedRate, measuredRate, meanWait, 1 / predictedRate, alpha, 2 * m),
  }
}

function pairFinding(
  start: PairStart,
  predictedRate: number,
  measuredRate: number,
  meanWait: number,
  predictedWait: number,
  alpha: number,
  pairGrain: number,
): string {
  if (start === 'locked-plus') {
    return `Locked pair of ${pairGrain / 2}-bit +u ends, one joint K₀ at grain ${pairGrain}: w′=${predictedRate.toExponential(4)} = α×${(predictedRate / alpha).toFixed(3)}. Wait ${meanWait.toFixed(1)} vs ${predictedWait.toFixed(1)}. Two 137s make α only as one 274-grain, not as two machines.`
  }
  if (start === 'tensor-plus-plus') {
    return `Tensor K₀⊗K₀ on |++⟩ leaks at 1−((M−1)/M)⁴=${predictedRate.toExponential(4)} = α×${(predictedRate / alpha).toFixed(3)}, wait ${meanWait.toFixed(1)}. Pairing as a product is ~4α, not α.`
  }
  if (start === 'two-independent') {
    return `Two independent 137 jumps: first-flip rate ${predictedRate.toExponential(4)} = α×${(predictedRate / alpha).toFixed(3)}, wait ${meanWait.toFixed(1)}. Separate grains do not make α.`
  }
  return `Gate ${start}: P(open)·w′(274)=${predictedRate.toExponential(4)} = α×${(predictedRate / alpha).toFixed(3)}; measured ${measuredRate.toExponential(4)}, wait ${meanWait.toFixed(1)} vs ${predictedWait.toFixed(1)}. Random pairs jump slower than α.`
}
