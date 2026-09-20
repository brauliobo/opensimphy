import { boundedInteger } from '../simphy/numbers'
import { CODATA_2022_MEASURED_CONSTANTS } from '../tour/physicsConstants'
import { grainCoupling } from './grainCoupling'

export interface FlipJumpKraus {
  grainM: number
  damp: number
  rate: number
  meanWait: number
  completenessResidual: number
}

export interface FlipJumpEnsembleResult {
  grainM: number
  trials: number
  ticks: number
  predictedRate: number
  jumpRateFromPlus: number
  jumpRateFromMinus: number
  meanWaitFromPlus: number
  predictedWait: number
  plusSurvival: number
  predictedPlusSurvival: number
  alpha: number
  rateOverAlpha: number
  completenessResidual: number
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

export function flipJumpKraus(grainM: number): FlipJumpKraus {
  const m    = boundedInteger(grainM, 'grainM', 2, 10_000)
  const damp = (m - 1) / m
  const rate = grainCoupling(m)
  return {
    grainM: m,
    damp,
    rate,
    meanWait: 1 / rate,
    completenessResidual: Math.hypot(damp * damp + rate - 1, 1 - damp * damp - rate),
  }
}

function geometricWait(rate: number, random: () => number): number {
  let wait = 1
  while (random() >= rate && wait < 1_000_000) wait++
  return wait
}

export function runFlipJumpEnsemble(grainM: number, trials: number, ticks: number, seed: number): FlipJumpEnsembleResult {
  const kraus  = flipJumpKraus(grainM)
  const n      = boundedInteger(trials, 'trials', 1, 200_000)
  const steps  = boundedInteger(ticks, 'ticks', 1, 8_000)
  const random = rng32(seed)
  let plusFirst = 0, waitSum = 0, plusAlive = 0
  for (let trial = 0; trial < n; trial++) {
    const wait = geometricWait(kraus.rate, random)
    if (wait === 1) plusFirst++
    if (wait > steps) plusAlive++
    waitSum += wait
  }
  const survival = (1 - kraus.rate) ** steps
  const alpha    = CODATA_2022_MEASURED_CONSTANTS.fineStructureConstant.value
  return {
    grainM: kraus.grainM,
    trials: n,
    ticks: steps,
    predictedRate: kraus.rate,
    jumpRateFromPlus: plusFirst / n,
    jumpRateFromMinus: 0,
    meanWaitFromPlus: waitSum / n,
    predictedWait: kraus.meanWait,
    plusSurvival: plusAlive / n,
    predictedPlusSurvival: survival,
    alpha,
    rateOverAlpha: kraus.rate / alpha,
    completenessResidual: kraus.completenessResidual,
    finding: `K₀=diag((M−1)/M, 1) in ±u forces L†L=((2M−1)/M²)P₊ᵤ (residual ${kraus.completenessResidual.toExponential(2)}). M=${kraus.grainM} w′=${kraus.rate.toExponential(4)} = α×${(kraus.rate / alpha).toFixed(3)}. +u jump ${ (plusFirst / n).toFixed(4)} vs ${kraus.rate.toFixed(4)}; −u dark; mean wait ${(waitSum / n).toFixed(2)} vs ${kraus.meanWait.toFixed(2)}. Rank-one leak of the aligned end, not Maxwell.`,
  }
}
