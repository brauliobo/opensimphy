import { boundedInteger } from '../simphy/numbers'
import {
  evaluateAlignment,
  evaluateMajority,
  majorityThreshold,
  popcount,
  randomBiasedRegister,
  REGISTER_WIDTH_MAX,
} from './quantumRegisterEngine'

export type HistoryRule = 'majority' | 'markov' | 'persist' | 'gated-past'

export interface HistoryChainInput {
  width: number
  ticks: number
  seed: number
  rule: HistoryRule
  start?: bigint
}

export interface HistoryChainResult {
  width: number
  rule: HistoryRule
  ticks: number
  absorbed: 0 | 1 | null
  absorbTime: number | null
  cycleLength: number | null
  finalOnes: number
  startOnes: number
  startMajority: 0 | 1 | null
  inserts: number[]
  onesSeries: number[]
}

export interface HistoryEnsembleResult {
  width: number
  rule: HistoryRule
  trials: number
  ticks: number
  absorb0: number
  absorb1: number
  cycling: number
  unresolved: number
  agreeWithStartMajority: number
  meanAbsorbTime: number
  meanFinalOnes: number
  finding: string
}

export interface CoupledHistoryResult {
  width: number
  agents: number
  ticks: number
  uniqueStart: number
  uniqueEnd: number
  uniqueSeries: number[]
  meanHammingEnd: number
  consensus: boolean
  absorbPattern: 'all-0' | 'all-1' | 'mixed' | 'other'
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

export function maskBits(width: number): bigint {
  return (1n << BigInt(boundedInteger(width, 'width', 1, REGISTER_WIDTH_MAX))) - 1n
}

export function shiftIn(word: bigint, width: number, bit: 0 | 1): bigint {
  return ((word << 1n) | BigInt(bit)) & maskBits(width)
}

function adjacentMask(word: bigint, width: number): bigint {
  const rotated = ((word << 1n) | (word >> BigInt(width - 1))) & maskBits(width)
  return ~(word ^ rotated) & maskBits(width)
}

function adjacentAgreements(word: bigint, width: number): number {
  return popcount(adjacentMask(word, width))
}

function nextBit(word: bigint, width: number, rule: HistoryRule, random: () => number, gate: bigint): 0 | 1 {
  const vote = evaluateMajority(word, width)
  if (rule === 'majority') return vote.majority === 1 ? 1 : 0
  if (rule === 'markov') return random() < popcount(word) / width ? 1 : 0
  if (rule === 'persist') {
    const locked = adjacentAgreements(word, width) >= majorityThreshold(width)
    const bit = vote.majority === 1 ? 1 : 0
    return locked ? bit : (bit ^ 1) as 0 | 1
  }
  const gated = word & gate
  const slots = popcount(gate)
  if (slots === 0) return vote.majority === 1 ? 1 : 0
  return popcount(gated) * 2 >= slots ? 1 : 0
}

export function runHistoryChain(input: HistoryChainInput): HistoryChainResult {
  const width  = boundedInteger(input.width, 'width', 3, REGISTER_WIDTH_MAX)
  const ticks  = boundedInteger(input.ticks, 'ticks', 1, 8000)
  const random = rng32(input.seed)
  let word     = input.start ?? randomBiasedRegister(width, random, 0.5)
  const startOnes = popcount(word)
  const startMajority = evaluateMajority(word, width).majority
  const seen = new Map<bigint, number>()
  const inserts: number[] = []
  const onesSeries: number[] = [startOnes]
  let absorbed: 0 | 1 | null = startOnes === 0 ? 0 : startOnes === width ? 1 : null
  let absorbTime: number | null = absorbed === null ? null : 0
  let cycleLength: number | null = null
  let gate = maskBits(width)
  seen.set(word, 0)

  for (let t = 1; t <= ticks && absorbed === null && cycleLength === null; t++) {
    const bit = nextBit(word, width, input.rule, random, gate)
    inserts.push(bit)
    gate = adjacentMask(word, width)
    word = shiftIn(word, width, bit)
    const ones = popcount(word)
    onesSeries.push(ones)
    if (ones === 0 || ones === width) {
      absorbed = ones === 0 ? 0 : 1
      absorbTime = t
      break
    }
    const previous = seen.get(word)
    if (previous !== undefined) {
      cycleLength = t - previous
      break
    }
    seen.set(word, t)
  }

  return {
    width,
    rule: input.rule,
    ticks,
    absorbed,
    absorbTime,
    cycleLength,
    finalOnes: popcount(word),
    startOnes,
    startMajority,
    inserts: inserts.slice(-64),
    onesSeries: onesSeries.filter((_, index) => index % Math.ceil(onesSeries.length / 24) === 0 || index === onesSeries.length - 1),
  }
}

export function runHistoryEnsemble(rule: HistoryRule, width: number, trials: number, ticks: number, seed: number, start: 'random' | 'onehot' = 'random'): HistoryEnsembleResult {
  let absorb0 = 0, absorb1 = 0, cycling = 0, unresolved = 0, agree = 0, absorbTimeSum = 0, absorbCount = 0, finalOnes = 0
  for (let trial = 0; trial < trials; trial++) {
    const result = runHistoryChain({
      width,
      ticks,
      seed: seed + trial * 17,
      rule,
      start: start === 'onehot' ? 1n << BigInt(trial % width) : undefined,
    })
    finalOnes += result.finalOnes
    if (result.absorbed === 0) absorb0++
    else if (result.absorbed === 1) absorb1++
    else if (result.cycleLength !== null) cycling++
    else unresolved++
    if (result.absorbed !== null) {
      absorbTimeSum += result.absorbTime ?? 0
      absorbCount++
      if (result.absorbed === result.startMajority) agree++
    }
  }
  const finding = ensembleFinding(rule, width, absorb0, absorb1, cycling, unresolved, trials, absorbCount === 0 ? 0 : absorbTimeSum / absorbCount, agree)
  return {
    width,
    rule,
    trials,
    ticks,
    absorb0,
    absorb1,
    cycling,
    unresolved,
    agreeWithStartMajority: agree,
    meanAbsorbTime: absorbCount === 0 ? 0 : absorbTimeSum / absorbCount,
    meanFinalOnes: finalOnes / trials,
    finding,
  }
}

function ensembleFinding(
  rule: HistoryRule,
  width: number,
  absorb0: number,
  absorb1: number,
  cycling: number,
  unresolved: number,
  trials: number,
  meanTime: number,
  agree: number,
): string {
  if (rule === 'majority') {
    return `Majority-chained history on ${width} bits absorbed to constant 0/1 in ${absorb0 + absorb1}/${trials} trials (mean ${meanTime.toFixed(1)} steps). Start majority predicted the attractor in ${agree}/${absorb0 + absorb1}. This is a two-state lock, not a field theory.`
  }
  if (rule === 'markov') {
    return `P(next=1 | window) = ones/${width} absorbed ${absorb0 + absorb1}/${trials} times, cycled ${cycling}, still mixed ${unresolved}. Boundaries 0^w and 1^w are absorbing; the interior is a sliding-window martingale.`
  }
  if (rule === 'gated-past') {
    return `Gated-past majority (next bit = majority of history bits whose previous neighbor-agreement mask was 1) absorbed ${absorb0 + absorb1}/${trials} (mean ${meanTime.toFixed(1)} steps). Start majority still predicted ${agree}/${absorb0 + absorb1}. The registered gate chains a past condition; the attractors are still 0^w and 1^w.`
  }
  return `Persist (keep majority if adjacent agreements ≥ threshold, else invert) width ${width}: absorb0=${absorb0} absorb1=${absorb1} cycles=${cycling} unresolved=${unresolved}/${trials}. Short cycles are repeating 137-windows, not extra particles.`
}

export function runCoupledHistory(agents: number, width: number, ticks: number, seed: number, start: 'random' | 'onehot' = 'random'): CoupledHistoryResult {
  const n = boundedInteger(agents, 'agents', 2, REGISTER_WIDTH_MAX)
  const w = boundedInteger(width, 'width', 3, REGISTER_WIDTH_MAX)
  const steps = boundedInteger(ticks, 'ticks', 8, 4000)
  const random = rng32(seed)
  const histories = start === 'onehot'
    ? Array.from({ length: n }, (_, index) => 1n << BigInt(index % w))
    : Array.from({ length: n }, () => randomBiasedRegister(w, random, 0.5))
  const uniqueStart = new Set(histories).size
  const uniqueSeries: number[] = [uniqueStart]
  const sampleAt = new Set([1, 2, 5, 10, 20, 50, 100, 200, 400, steps])

  for (let t = 1; t <= steps; t++) {
    const next = histories.map((word, index) => {
      let bit: 0 | 1 = evaluateMajority(word, w).majority === 1 ? 1 : 0
      const partners: bigint[] = []
      for (let other = 0; other < n; other++) {
        if (other === index) continue
        if (evaluateAlignment(word, histories[other]!, w).committed) partners.push(histories[other]!)
      }
      if (partners.length > 0) {
        const partner = partners[Math.floor(random() * partners.length)]!
        bit = evaluateMajority(partner, w).majority === 1 ? 1 : 0
      }
      return shiftIn(word, w, bit)
    })
    for (let index = 0; index < n; index++) histories[index] = next[index]!
    if (sampleAt.has(t)) uniqueSeries.push(new Set(histories).size)
  }

  let hamming = 0, pairs = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      hamming += popcount(histories[i]! ^ histories[j]!)
      pairs++
    }
  }
  const uniqueEnd = new Set(histories).size
  const ones = histories.map((word) => popcount(word))
  const absorbPattern = ones.every((value) => value === 0) ? 'all-0'
    : ones.every((value) => value === w) ? 'all-1'
      : ones.every((value) => value === 0 || value === w) ? 'mixed'
        : 'other'
  return {
    width: w,
    agents: n,
    ticks: steps,
    uniqueStart,
    uniqueEnd,
    uniqueSeries,
    meanHammingEnd: pairs === 0 ? 0 : hamming / pairs,
    consensus: uniqueEnd === 1,
    absorbPattern,
    finding: `Coupled history registers (${start}): ${uniqueStart} start patterns → ${uniqueEnd} after ${steps} ticks (Hamming ${pairs === 0 ? 0 : (hamming / pairs).toFixed(1)} bits). ${absorbPattern} consensus=${uniqueEnd === 1}. Past majority bits of aligned partners are shifted in; this is voter-model memory, not a Lagrangian.`,
  }
}
