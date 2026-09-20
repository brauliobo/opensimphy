import { boundedInteger } from '../simphy/numbers'
import { grainCoupling } from './grainCoupling'
import {
  evaluateAlignment,
  evaluateMajority,
  gf2Rank,
  majorityThreshold,
  maskWidth,
  popcount,
  randomBiasedRegister,
  REGISTER_WIDTH_MAX,
} from './quantumRegisterEngine'

export const FAST_PATH_TICKS_MAX = 131072
export type FastPathStart = 'onehot' | 'random'
export type FastPathCombine = 'xor' | 'or' | 'add' | 'aligned-xor'
export type FastPathPairing = 'neighbor' | 'random'

export interface FastPathInput {
  width: number
  ticks: number
  seed: number
  start: FastPathStart
  combine: FastPathCombine
  pairing: FastPathPairing
  flipJump?: boolean
}

export interface FastPathSnapshot {
  t: number
  unique: number
  necklaces: number
  rank: number
  meanWeight: number
  meanIslands: number
  meanMaxRun: number
  handshakeRate: number
  majorityOnes: number
  distinctWeights: number
}

export interface FastPathResult {
  width: number
  ticks: number
  start: FastPathStart
  combine: FastPathCombine
  pairing: FastPathPairing
  snapshots: FastPathSnapshot[]
  timeToWeight2: number | null
  timeToBlock8: number | null
  timeToMajority: number | null
  timeToDuplicate: number | null
  timeToAllOnes: number | null
  flipJump: boolean
  jumps: number
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

export function oneHotRegisters(width: number): bigint[] {
  const bits = boundedInteger(width, 'width', 1, REGISTER_WIDTH_MAX)
  return Array.from({ length: bits }, (_, index) => 1n << BigInt(index))
}

export function islandCount(word: bigint, width: number): number {
  const mask = maskWidth(width)
  const bits = word & mask
  if (bits === 0n) return 0
  if (bits === mask) return 1
  let islands = 0
  let previous = (bits >> BigInt(width - 1)) & 1n
  for (let index = 0; index < width; index++) {
    const bit = (bits >> BigInt(index)) & 1n
    if (bit === 1n && previous === 0n) islands++
    previous = bit
  }
  return islands
}

export function maxRun(word: bigint, width: number): number {
  const mask = maskWidth(width)
  const bits = word & mask
  if (bits === 0n) return 0
  if (bits === mask) return width
  let best = 0
  let run = 0
  for (let index = 0; index < width * 2; index++) {
    if (((bits >> BigInt(index % width)) & 1n) === 1n) {
      run++
      if (run > best) best = run
    } else run = 0
  }
  return Math.min(best, width)
}

export function necklaceKey(word: bigint, width: number): bigint {
  const mask = maskWidth(width)
  let rot = word & mask
  let min = rot
  for (let index = 1; index < width; index++) {
    rot = ((rot << 1n) | (rot >> BigInt(width - 1))) & mask
    if (rot < min) min = rot
  }
  return min
}

function partnerIndex(index: number, size: number, pairing: FastPathPairing, random: () => number): number {
  if (pairing === 'neighbor') return (index + 1) % size
  let other = Math.floor(random() * (size - 1))
  if (other >= index) other++
  return other
}

function combineWords(left: bigint, right: bigint, width: number, combine: FastPathCombine): bigint {
  const mask = maskWidth(width)
  if (combine === 'xor') return (left ^ right) & mask
  if (combine === 'or') return (left | right) & mask
  if (combine === 'add') return (left + right) & mask
  return evaluateAlignment(left, right, width).committed ? (left ^ right) & mask : left
}

function snapshotOf(registers: readonly bigint[], width: number, t: number, handshakeRate: number): FastPathSnapshot {
  const n = registers.length
  let weight = 0, islands = 0, runs = 0, majorityOnes = 0
  const unique = new Set<bigint>()
  const necklaces = new Set<bigint>()
  const weights = new Set<number>()
  for (const word of registers) {
    const ones = popcount(word)
    unique.add(word)
    necklaces.add(necklaceKey(word, width))
    weights.add(ones)
    weight += ones
    islands += islandCount(word, width)
    runs += maxRun(word, width)
    if (evaluateMajority(word, width).majority === 1) majorityOnes++
  }
  return {
    t,
    unique: unique.size,
    necklaces: necklaces.size,
    rank: gf2Rank(registers),
    meanWeight: weight / n,
    meanIslands: islands / n,
    meanMaxRun: runs / n,
    handshakeRate,
    majorityOnes,
    distinctWeights: weights.size,
  }
}

function sampleTicks(ticks: number): number[] {
  const wanted = new Set<number>([0, 1, 2, 3, 4, 5, 7, 8, 15, 16, 32, 64, 127, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, ticks])
  return [...wanted].filter((tick) => tick <= ticks).sort((left, right) => left - right)
}

function hitTime(registers: readonly bigint[], width: number, t: number, threshold: number): {
  weight2: number | null
  block8: number | null
  majority: number | null
  duplicate: number | null
  allOnes: number | null
} {
  let weight2 = false, block8 = false, majority = false, allOnes = true
  const unique = new Set<bigint>()
  for (const word of registers) {
    const ones = popcount(word)
    unique.add(word)
    if (ones === 2) weight2 = true
    if (ones >= threshold) majority = true
    if (ones !== width) allOnes = false
    if (!block8 && maxRun(word, width) >= 8) block8 = true
  }
  return {
    weight2:    weight2 ? t : null,
    block8:     block8 ? t : null,
    majority:   majority ? t : null,
    duplicate:  unique.size < registers.length ? t : null,
    allOnes:    allOnes ? t : null,
  }
}

export function runFastPath(input: FastPathInput): FastPathResult {
  const width   = boundedInteger(input.width, 'width', 3, REGISTER_WIDTH_MAX)
  const ticks   = boundedInteger(input.ticks, 'ticks', 1, FAST_PATH_TICKS_MAX)
  const random  = rng32(input.seed)
  const size    = width
  let registers = input.start === 'onehot'
    ? oneHotRegisters(width)
    : Array.from({ length: size }, () => randomBiasedRegister(width, random, 0.5))
  const snapshots = [snapshotOf(registers, width, 0, input.start === 'onehot' ? 1 : handshakeAmong(registers, width))]
  const sampled = new Set(sampleTicks(ticks))
  const threshold = majorityThreshold(width)
  const initial = hitTime(registers, width, 0, threshold)
  let timeToWeight2   = initial.weight2
  let timeToBlock8    = initial.block8
  let timeToMajority  = initial.majority
  let timeToDuplicate = initial.duplicate
  let timeToAllOnes   = initial.allOnes
  const jumpRate = input.flipJump ? grainCoupling(width) : 0
  let jumps = 0

  for (let t = 1; t <= ticks; t++) {
    const needHandshake = sampled.has(t) || input.combine === 'aligned-xor'
    let aligned = 0
    const next = registers.map((word, index) => {
      const other = registers[partnerIndex(index, size, input.pairing, random)]!
      if (needHandshake && evaluateAlignment(word, other, width).committed) aligned++
      return combineWords(word, other, width, input.combine)
    })
    registers = next
    if (jumpRate > 0) {
      const mask = maskWidth(width)
      registers = registers.map((word) => {
        if (evaluateMajority(word, width).majority !== 1 || random() >= jumpRate) return word
        jumps++
        return (~word) & mask
      })
    }
    if (timeToWeight2 === null || timeToBlock8 === null || timeToMajority === null || timeToDuplicate === null || timeToAllOnes === null) {
      let allOnes = true
      const unique = timeToDuplicate === null ? new Set<bigint>() : null
      for (const word of registers) {
        const ones = popcount(word)
        if (timeToWeight2 === null && ones === 2) timeToWeight2 = t
        if (timeToMajority === null && ones >= threshold) timeToMajority = t
        if (ones !== width) allOnes = false
        unique?.add(word)
        if (timeToBlock8 === null && maxRun(word, width) >= 8) timeToBlock8 = t
      }
      if (timeToDuplicate === null && unique !== null && unique.size < size) timeToDuplicate = t
      if (timeToAllOnes === null && allOnes) timeToAllOnes = t
    }
    if (sampled.has(t)) snapshots.push(snapshotOf(registers, width, t, aligned / size))
  }

  return {
    width,
    ticks,
    start: input.start,
    combine: input.combine,
    pairing: input.pairing,
    snapshots,
    timeToWeight2,
    timeToBlock8,
    timeToMajority,
    timeToDuplicate,
    timeToAllOnes,
    flipJump: Boolean(input.flipJump),
    jumps,
    finding: fastPathFinding(input, snapshots, { timeToWeight2, timeToBlock8, timeToMajority, timeToDuplicate, timeToAllOnes }, jumps),
  }
}

function handshakeAmong(registers: readonly bigint[], width: number): number {
  let aligned = 0
  const n = registers.length
  for (let index = 0; index < n; index++) {
    if (evaluateAlignment(registers[index]!, registers[(index + 1) % n]!, width).committed) aligned++
  }
  return aligned / n
}

function fastPathFinding(
  input: FastPathInput,
  snapshots: FastPathSnapshot[],
  times: Pick<FastPathResult, 'timeToWeight2' | 'timeToBlock8' | 'timeToMajority' | 'timeToDuplicate' | 'timeToAllOnes'>,
  jumps: number,
): string {
  const last = snapshots.at(-1)!
  const start = snapshots[0]!
  if (input.flipJump) {
    return `Completeness flip on +u at w′=(2M−1)/M², M=${input.width}: ${jumps} jumps in ${last.t} ticks. End weight ${last.meanWeight.toFixed(1)} islands ${last.meanIslands.toFixed(1)} necklaces ${last.necklaces}. Majority windows leak; 137 is the odd grain, not a coupling constant.`
  }
  if (input.start === 'onehot' && input.combine === 'xor' && input.pairing === 'neighbor') {
    return `One-hot registers under neighbor XOR: identity → sliding 11 blocks at t=1, then Pascal-mod-2 / Sierpinski rows. Weight at t=2^k returns to 2. End t=${last.t} meanWeight=${last.meanWeight.toFixed(2)} islands=${last.meanIslands.toFixed(2)} unique=${last.unique}. This is linear CA geometry, not a field.`
  }
  if (input.start === 'onehot' && input.combine === 'aligned-xor' && input.pairing === 'neighbor') {
    return `Handshake-gated neighbor XOR of one-hots follows Sierpinski until adjacent Hamming exceeds 68, then freezes (end weight ${last.meanWeight.toFixed(1)}, islands ${last.meanIslands.toFixed(1)}). The gate is a past alignment condition, not a new particle.`
  }
  if (input.combine === 'or' && input.start === 'onehot' && input.pairing === 'neighbor') {
    return `Neighbor OR of one-hots grows a 1-block of length t+1; all-1s at t=${times.timeToAllOnes ?? 'unreached'}. Simple runs appear in order. End unique=${last.unique}.`
  }
  if (input.combine === 'add' && input.start === 'onehot') {
    return `Integer ADD of one-hot registers makes shifted small integers and carry runs. Block8 at t=${times.timeToBlock8 ?? 'unreached'}, all-1s at t=${times.timeToAllOnes ?? 'unreached'}. End meanMaxRun=${last.meanMaxRun.toFixed(1)}.`
  }
  return `${input.start} ${input.combine}/${input.pairing}: weight ${start.meanWeight.toFixed(1)}→${last.meanWeight.toFixed(1)}, islands ${start.meanIslands.toFixed(1)}→${last.meanIslands.toFixed(1)}, unique ${start.unique}→${last.unique}, majority-1 at t=${times.timeToMajority ?? 'unreached'}. Combining odd-width registers does not emit Maxwell.`
}
