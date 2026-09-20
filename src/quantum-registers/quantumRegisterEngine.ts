import { boundedInteger, boundedNumber } from '../simphy/numbers'
import { CODATA_2022_MEASURED_CONSTANTS } from '../tour/physicsConstants'

export const REGISTER_WIDTH_MAX = 137
export const HILBERT_AMPLITUDE_WIDTH_MAX = 8
export const UNIVERSE_SIZE_MAX = 64
export const UNIVERSE_STEPS_MAX = 400
export const MAJORITY_WALK_MAX = 120
export const HIERARCHY_CLOSURE_COUNT = 137
export const BINARY_137 = (1n << 7n) + (1n << 3n) + 1n
export const PARKER_RHODES_LEVEL2_BASIS = Object.freeze([0b1110n, 0b1101n, 0b1100n])

export const COMBINATORIAL_HIERARCHY = Object.freeze([
  Object.freeze({ level: 1, independent: 2, dcsCount: 3,   width: 2,  enumerable: true }),
  Object.freeze({ level: 2, independent: 3, dcsCount: 7,   width: 4,  enumerable: true }),
  Object.freeze({ level: 3, independent: 7, dcsCount: 127, width: 16, enumerable: true }),
  Object.freeze({ level: 4, independent: 127, dcsCount: null, width: 256, enumerable: false }),
])

export type HandshakeRule = 'xor-closed' | 'coprime' | 'and-overlap' | 'hamming-least' | 'majority-phase'
export type UniversePreset = 'dcs-7' | 'random'
export type MajorityMode = 'coins' | 'align'

export interface RegisterPairInput {
  width: number
  a: bigint
  b: bigint
}

export interface RegisterPairResult {
  width: number
  a: bigint
  b: bigint
  xor: bigint
  and: bigint
  notA: bigint
  popA: number
  popB: number
  popXor: number
  popAnd: number
  hamming: number
  gcd: bigint
  coprime: boolean
  involutionZero: boolean
  bitsA: number[]
  bitsB: number[]
  bitsXor: number[]
  configurationCountText: string
  registerBytes: number
  finding: string
}

export interface HierarchyLevelRow {
  level: number
  independent: number
  dcsCount: number | null
  width: number
  enumerable: boolean
}

export interface HierarchyResult {
  levels: readonly HierarchyLevelRow[]
  closureCount: number
  binary137: bigint
  binary137Match: boolean
  level2Basis: readonly bigint[]
  level2Dcs: bigint[]
  level2Rank: number
  nextLevelRefused: string
  apparentCoupling: number
  codataAlpha: number
  couplingRelativeError: number
  finding: string
}

export interface HandshakeInput {
  preset: UniversePreset
  width: number
  size: number
  seed: number
  emitterIndex: number
  rule: HandshakeRule
  minOverlap: number
}

export interface HandshakeCandidate {
  index: number
  value: bigint
  compatible: boolean
  xor: bigint
  hamming: number
  gcd: bigint
  overlap: number
}

export interface HandshakeResult {
  width: number
  universe: bigint[]
  emitterIndex: number
  emitter: bigint
  rule: HandshakeRule
  candidates: HandshakeCandidate[]
  compatibleCount: number
  selectedIndex: number | null
  selected: bigint | null
  apparentProbability: number
  involutionZero: boolean
  finding: string
}

export interface HilbertBoundResult {
  width: number
  amplitudeCountText: string
  amplitudeLog10: number
  complex128BytesText: string
  registerBytes: number
  allocatesHilbert: boolean
  finding: string
}

export interface UniverseInput {
  preset: UniversePreset
  startWidth: number
  startCount: number
  seed: number
  maxSteps: number
  maxWidth: number
  maxSize: number
}

export interface UniverseResult {
  width: number
  size: number
  steps: number
  ticks: number
  adjoined: number
  nullXors: number
  xorClosedHits: number
  reached137: boolean
  universe: bigint[]
  lastA: bigint | null
  lastB: bigint | null
  lastXor: bigint | null
  finding: string
}

export function maskWidth(width: number): bigint {
  const bits = boundedInteger(width, 'width', 1, REGISTER_WIDTH_MAX)
  return (1n << BigInt(bits)) - 1n
}

export function normalizeRegister(value: bigint, width: number): bigint {
  if (value < 0n) throw new RangeError('register value must be non-negative')
  return value & maskWidth(width)
}

export function registerBytes(width: number): number {
  return Math.ceil(boundedInteger(width, 'width', 1, REGISTER_WIDTH_MAX) / 8)
}

export function popcount(value: bigint): number {
  let bits  = value < 0n ? -value : value
  let count = 0
  while (bits) {
    bits &= bits - 1n
    count++
  }
  return count
}

export function gcd(left: bigint, right: bigint): bigint {
  let a = left  < 0n ? -left  : left
  let b = right < 0n ? -right : right
  while (b !== 0n) [a, b] = [b, a % b]
  return a
}

export function bitsOf(value: bigint, width: number): number[] {
  const bits  = boundedInteger(width, 'width', 1, REGISTER_WIDTH_MAX)
  const word  = normalizeRegister(value, bits)
  return Array.from({ length: bits }, (_, index) => Number((word >> BigInt(index)) & 1n))
}

export function formatPowerOfTwo(exponent: number): string {
  const bits = boundedInteger(exponent, 'exponent', 0, REGISTER_WIDTH_MAX)
  if (bits <= 52) return String(2 ** bits)
  const log10    = bits * Math.LOG10E * Math.LN2
  const power    = Math.floor(log10)
  const mantissa = 10 ** (log10 - power)
  return `${mantissa.toFixed(4)}e+${power}`
}

export function parseRegister(text: string, width: number): bigint {
  const trimmed = text.trim().toLowerCase()
  if (!trimmed) throw new RangeError('register text is empty')
  const value = trimmed.startsWith('0b') || trimmed.startsWith('0x') || /^[0-9]+$/.test(trimmed)
    ? BigInt(trimmed)
    : (() => { throw new RangeError('register text must be decimal, 0b binary, or 0x hex') })()
  return normalizeRegister(value, width)
}

export function formatRegister(value: bigint, width: number): string {
  const bits = boundedInteger(width, 'width', 1, REGISTER_WIDTH_MAX)
  const word = normalizeRegister(value, bits)
  if (bits <= 16) return `0b${word.toString(2).padStart(bits, '0')}`
  return `0x${word.toString(16)}`
}

export function gf2Rank(vectors: readonly bigint[]): number {
  const rows = [...vectors]
  let maxBit = 0
  for (const vector of rows) {
    let word = vector
    let bit  = 0
    while (word > 0n) {
      word >>= 1n
      bit++
    }
    if (bit > maxBit) maxBit = bit
  }
  let rank = 0
  for (let bit = maxBit - 1; bit >= 0; bit--) {
    const mask  = 1n << BigInt(bit)
    const pivot = rows.findIndex((row, index) => index >= rank && (row & mask) !== 0n)
    if (pivot < 0) continue
    ;[rows[rank], rows[pivot]] = [rows[pivot]!, rows[rank]!]
    for (let index = 0; index < rows.length; index++) {
      if (index !== rank && (rows[index]! & mask) !== 0n) rows[index]! ^= rows[rank]!
    }
    rank++
  }
  return rank
}

export function enumerateDcs(basis: readonly bigint[]): bigint[] {
  if (basis.length === 0 || basis.length > 12) {
    throw new RangeError('DCS basis must have 1 to 12 independent strings')
  }
  if (gf2Rank(basis) !== basis.length) throw new RangeError('DCS basis must be linearly independent over GF(2)')
  const values = new Set<bigint>()
  const limit  = 1 << basis.length
  for (let mask = 1; mask < limit; mask++) {
    let word = 0n
    for (let index = 0; index < basis.length; index++) {
      if (mask & (1 << index)) word ^= basis[index]!
    }
    values.add(word)
  }
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
}

export function evaluateRegisterPair(input: RegisterPairInput): RegisterPairResult {
  const width = boundedInteger(input.width, 'width', 1, REGISTER_WIDTH_MAX)
  const a     = normalizeRegister(input.a, width)
  const b     = normalizeRegister(input.b, width)
  const xor   = a ^ b
  const and   = a & b
  const gcdAB = gcd(a, b)
  return {
    width,
    a,
    b,
    xor,
    and,
    notA:            (~a) & maskWidth(width),
    popA:            popcount(a),
    popB:            popcount(b),
    popXor:          popcount(xor),
    popAnd:          popcount(and),
    hamming:         popcount(xor),
    gcd:             gcdAB,
    coprime:         a !== 0n && b !== 0n && gcdAB === 1n,
    involutionZero:  (a ^ b ^ xor) === 0n,
    bitsA:           bitsOf(a, width),
    bitsB:           bitsOf(b, width),
    bitsXor:         bitsOf(xor, width),
    configurationCountText: formatPowerOfTwo(width),
    registerBytes:   registerBytes(width),
    finding:         width === REGISTER_WIDTH_MAX
      ? `A ${REGISTER_WIDTH_MAX}-bit register has ${formatPowerOfTwo(width)} configurations and occupies ${registerBytes(width)} bytes. That is a word, not a Hilbert vector of ${formatPowerOfTwo(width)} amplitudes.`
      : `XOR is addition in GF(2)^${width}. a ⊕ b ⊕ (a ⊕ b) = 0 is an identity, not an energy source.`,
  }
}

export function evaluateHierarchy(): HierarchyResult {
  const level2Dcs          = enumerateDcs(PARKER_RHODES_LEVEL2_BASIS)
  const apparentCoupling   = 1 / HIERARCHY_CLOSURE_COUNT
  const codataAlpha        = CODATA_2022_MEASURED_CONSTANTS.fineStructureConstant.value
  const couplingRelativeError = Math.abs(apparentCoupling - codataAlpha) / codataAlpha
  return {
    levels:          COMBINATORIAL_HIERARCHY,
    closureCount:    HIERARCHY_CLOSURE_COUNT,
    binary137:       BINARY_137,
    binary137Match:  BINARY_137 === BigInt(HIERARCHY_CLOSURE_COUNT),
    level2Basis:     PARKER_RHODES_LEVEL2_BASIS,
    level2Dcs,
    level2Rank:      gf2Rank(PARKER_RHODES_LEVEL2_BASIS),
    nextLevelRefused: 'Level 4 would enumerate 2^127 − 1 discriminately closed subsets. This engine refuses that expansion.',
    apparentCoupling,
    codataAlpha,
    couplingRelativeError,
    finding: `3 + 7 + 127 = ${HIERARCHY_CLOSURE_COUNT} is an exact counting identity. 1/${HIERARCHY_CLOSURE_COUNT} is a channel-count label, not a QED derivation of α.`,
  }
}

function mulberry32(seed: number): () => number {
  let state = boundedInteger(seed, 'seed', 1, 0xffff_ffff) >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function universeCapacity(width: number): number {
  const bits = boundedInteger(width, 'width', 1, REGISTER_WIDTH_MAX)
  if (bits >= 12) return UNIVERSE_SIZE_MAX
  return Math.min(UNIVERSE_SIZE_MAX, (1 << bits) - 1)
}

export function randomRegister(width: number, random: () => number, nonzero = true): bigint {
  const bits = boundedInteger(width, 'width', 1, REGISTER_WIDTH_MAX)
  let word = 0n
  for (let index = 0; index < bits; index++) {
    if (random() >= 0.5) word |= 1n << BigInt(index)
  }
  if (nonzero && word === 0n) word = 1n
  return word
}

function uniqueRandomUniverse(width: number, size: number, seed: number): bigint[] {
  const capacity = universeCapacity(width)
  if (capacity < 2) throw new RangeError(`width ${width} has too few nonzero strings for a universe`)
  const count  = Math.min(boundedInteger(size, 'size', 2, UNIVERSE_SIZE_MAX), capacity)
  const random = mulberry32(seed)
  const seen   = new Set<bigint>()
  while (seen.size < count) seen.add(randomRegister(width, random))
  return [...seen]
}

export function handshakeUniverse(input: Pick<HandshakeInput, 'preset' | 'width' | 'size' | 'seed'>): { width: number; universe: bigint[] } {
  if (input.preset === 'dcs-7') return { width: 4, universe: enumerateDcs(PARKER_RHODES_LEVEL2_BASIS) }
  const width = boundedInteger(input.width, 'width', 1, REGISTER_WIDTH_MAX)
  return { width, universe: uniqueRandomUniverse(width, input.size, input.seed) }
}

function isCompatible(rule: HandshakeRule, emitter: bigint, other: bigint, universe: readonly bigint[], minOverlap: number, width: number): boolean {
  if (rule === 'xor-closed')     return universe.includes(emitter ^ other)
  if (rule === 'coprime')        return emitter !== 0n && other !== 0n && gcd(emitter, other) === 1n
  if (rule === 'and-overlap')    return popcount(emitter & other) >= minOverlap
  if (rule === 'majority-phase') return evaluateAlignment(emitter, other, width).committed
  return true
}

export function evaluateHandshake(input: HandshakeInput): HandshakeResult {
  const minOverlap = boundedInteger(input.minOverlap, 'minOverlap', 0, REGISTER_WIDTH_MAX)
  const packed     = handshakeUniverse(input)
  const emitterIndex = boundedInteger(input.emitterIndex, 'emitterIndex', 0, packed.universe.length - 1)
  const emitter    = packed.universe[emitterIndex]!
  const candidates = packed.universe.flatMap((value, index) => {
    if (index === emitterIndex) return []
    return [{
      index,
      value,
      compatible: isCompatible(input.rule, emitter, value, packed.universe, minOverlap, packed.width),
      xor:        emitter ^ value,
      hamming:    popcount(emitter ^ value),
      gcd:        gcd(emitter, value),
      overlap:    popcount(emitter & value),
    }]
  })
  const compatible = candidates.filter((row) => row.compatible)
  let selected: HandshakeCandidate | undefined
  if (input.rule === 'hamming-least' && compatible.length > 0) {
    const best = Math.min(...compatible.map((row) => row.hamming))
    const ties = compatible.filter((row) => row.hamming === best)
    selected   = ties[Math.floor(mulberry32(input.seed)() * ties.length)]
  } else {
    selected = compatible[0]
  }
  const apparentProbability = candidates.length === 0 ? 0 : compatible.length / candidates.length
  const selectedValue       = selected?.value ?? null
  return {
    width:              packed.width,
    universe:           packed.universe,
    emitterIndex,
    emitter,
    rule:               input.rule,
    candidates,
    compatibleCount:    compatible.length,
    selectedIndex:      selected?.index ?? null,
    selected:           selectedValue,
    apparentProbability,
    involutionZero:     selectedValue === null ? true : (emitter ^ selectedValue ^ (emitter ^ selectedValue)) === 0n,
    finding:            handshakeFinding(input.rule, packed.width, apparentProbability, compatible.length),
  }
}

function handshakeFinding(rule: HandshakeRule, width: number, probability: number, compatibleCount: number): string {
  if (rule === 'xor-closed' && width === 4) {
    return 'A discriminately closed 7-string set makes every XOR land back in the set. Handshake success is algebraic closure, not a measured coupling.'
  }
  if (rule === 'xor-closed') {
    return `At width ${width}, a sparse random universe almost never already contains a ⊕ b (${compatibleCount} hits). 2^${width} is the configuration count of one word, not a stored amplitude vector.`
  }
  if (rule === 'coprime') {
    return `Coprime handshakes use integer gcd, not bit-width 137. Apparent probability ${probability.toFixed(3)} is a number-theory rate, not α.`
  }
  if (rule === 'majority-phase') {
    return `Majority phase alignment commits when at least ${majorityThreshold(width)} of ${width} bits match. That vote is the unpublished next-step rule, not a scattering amplitude.`
  }
  if (rule === 'and-overlap') {
    return 'AND-overlap counts shared 1-bits. It is a support filter, not a field interaction.'
  }
  return 'Least Hamming distance is a discrete least-action stand-in for first arrival. Ties are broken by a seeded draw.'
}

export function evaluateHilbertBound(width: number): HilbertBoundResult {
  const bits              = boundedInteger(width, 'width', 1, REGISTER_WIDTH_MAX)
  const amplitudeLog10    = bits * Math.LOG10E * Math.LN2
  const complex128Log10   = Math.log10(16) + amplitudeLog10
  const allocatesHilbert  = bits <= HILBERT_AMPLITUDE_WIDTH_MAX
  return {
    width:               bits,
    amplitudeCountText:  formatPowerOfTwo(bits),
    amplitudeLog10,
    complex128BytesText: bits <= 48 ? String(16 * 2 ** bits) : `${(10 ** (complex128Log10 - Math.floor(complex128Log10))).toFixed(4)}e+${Math.floor(complex128Log10)}`,
    registerBytes:       registerBytes(bits),
    allocatesHilbert,
    finding: allocatesHilbert
      ? `A ${bits}-qubit complex128 vector would use ${16 * 2 ** bits} bytes. This lab may display that analog. Width ${REGISTER_WIDTH_MAX} is refused as Hilbert space.`
      : `Storing ${formatPowerOfTwo(bits)} complex amplitudes is refused. The ${bits}-bit register is ${registerBytes(bits)} bytes of GF(2) word, not a quantum state vector.`,
  }
}

export function evaluateUniverse(input: UniverseInput): UniverseResult {
  const maxSteps = boundedInteger(input.maxSteps, 'maxSteps', 1, UNIVERSE_STEPS_MAX)
  const maxWidth = boundedInteger(input.maxWidth, 'maxWidth', 1, REGISTER_WIDTH_MAX)
  const maxSize  = boundedInteger(input.maxSize, 'maxSize', 2, UNIVERSE_SIZE_MAX)
  const random   = mulberry32(input.seed)
  let width      = input.preset === 'dcs-7' ? 4 : boundedInteger(input.startWidth, 'startWidth', 1, REGISTER_WIDTH_MAX)
  let universe   = input.preset === 'dcs-7'
    ? [...enumerateDcs(PARKER_RHODES_LEVEL2_BASIS)]
    : uniqueRandomUniverse(width, input.startCount, input.seed)
  let ticks = 0, adjoined = 0, nullXors = 0, xorClosedHits = 0
  let lastA: bigint | null = null, lastB: bigint | null = null, lastXor: bigint | null = null
  let steps = 0
  for (; steps < maxSteps && width <= maxWidth; steps++) {
    const indexA = Math.floor(random() * universe.length)
    let   indexB = Math.floor(random() * universe.length)
    if (indexB === indexA) indexB = (indexB + 1) % universe.length
    const a   = universe[indexA]!
    const b   = universe[indexB]!
    const xor = a ^ b
    lastA = a; lastB = b; lastXor = xor
    if (xor === 0n) {
      nullXors++
      if (width >= maxWidth) break
      universe = universe.map((word) => word | ((random() >= 0.5 ? 1n : 0n) << BigInt(width)))
      width++
      ticks++
      continue
    }
    if (universe.includes(xor)) {
      xorClosedHits++
      continue
    }
    if (universe.length < maxSize) {
      universe.push(xor)
      adjoined++
    }
  }
  const reached137 = width === REGISTER_WIDTH_MAX
  return {
    width,
    size: universe.length,
    steps,
    ticks,
    adjoined,
    nullXors,
    xorClosedHits,
    reached137,
    universe,
    lastA,
    lastB,
    lastXor,
    finding: reached137
      ? `Width reached ${REGISTER_WIDTH_MAX} after ${ticks} null-XOR ticks. The engine still stores ${universe.length} words, not ${formatPowerOfTwo(REGISTER_WIDTH_MAX)} amplitudes. No Standard Model law was emitted.`
      : `After ${steps} picks: ${adjoined} adjoined strings, ${xorClosedHits} already-closed XORs, ${ticks} ticks, width ${width}. Closure is a set identity, not a field theory.`,
  }
}

export function majorityThreshold(width: number): number {
  return Math.floor(boundedInteger(width, 'width', 1, REGISTER_WIDTH_MAX) / 2) + 1
}

export function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return Number.NEGATIVE_INFINITY
  const m = Math.min(k, n - k)
  let sum = 0
  for (let index = 1; index <= m; index++) sum += Math.log(n - m + index) - Math.log(index)
  return sum
}

function logSumExp(values: number[]): number {
  const max = Math.max(...values)
  if (!Number.isFinite(max)) return max
  return max + Math.log(values.reduce((sum, value) => sum + Math.exp(value - max), 0))
}

export function binomialPge(n: number, k: number, p: number): number {
  const trials = boundedInteger(n, 'n', 1, REGISTER_WIDTH_MAX)
  const start  = boundedInteger(k, 'k', 0, trials + 1)
  const bias   = boundedNumber(p, 'p', 0, 1)
  if (start === 0) return 1
  if (start > trials) return 0
  if (bias === 0) return 0
  if (bias === 1) return 1
  const terms = Array.from({ length: trials - start + 1 }, (_, index) => {
    const hits = start + index
    return logChoose(trials, hits) + hits * Math.log(bias) + (trials - hits) * Math.log(1 - bias)
  })
  return Math.exp(logSumExp(terms))
}

export interface MajorityVote {
  width: number
  ones: number
  zeros: number
  threshold: number
  odd: boolean
  majority: 0 | 1 | null
  step: -1 | 0 | 1
  margin: number
  tie: boolean
}

export function evaluateMajority(word: bigint, width: number): MajorityVote {
  const bits      = boundedInteger(width, 'width', 1, REGISTER_WIDTH_MAX)
  const ones      = popcount(normalizeRegister(word, bits))
  const zeros     = bits - ones
  const threshold = majorityThreshold(bits)
  const odd       = bits % 2 === 1
  if (ones > zeros) return { width: bits, ones, zeros, threshold, odd, majority: 1, step: 1,  margin: ones - zeros,  tie: false }
  if (zeros > ones) return { width: bits, ones, zeros, threshold, odd, majority: 0, step: -1, margin: zeros - ones, tie: false }
  return { width: bits, ones, zeros, threshold, odd, majority: null, step: 0, margin: 0, tie: true }
}

export interface AlignmentVote extends MajorityVote {
  aligned: number
  disagreed: number
  committed: boolean
}

export function evaluateAlignment(offer: bigint, receiver: bigint, width: number): AlignmentVote {
  const bits      = boundedInteger(width, 'width', 1, REGISTER_WIDTH_MAX)
  const disagreed = popcount(normalizeRegister(offer, bits) ^ normalizeRegister(receiver, bits))
  const aligned   = bits - disagreed
  const vote      = evaluateMajority((1n << BigInt(aligned)) - 1n, bits)
  return { ...vote, ones: aligned, zeros: disagreed, aligned, disagreed, committed: aligned >= vote.threshold }
}

export function randomBiasedRegister(width: number, random: () => number, p: number): bigint {
  const bits = boundedInteger(width, 'width', 1, REGISTER_WIDTH_MAX)
  const bias = boundedNumber(p, 'p', 0, 1)
  let word = 0n
  for (let index = 0; index < bits; index++) {
    if (random() < bias) word |= 1n << BigInt(index)
  }
  return word
}

export function alignedReceiver(offer: bigint, width: number, random: () => number, matchP: number): bigint {
  const bits   = boundedInteger(width, 'width', 1, REGISTER_WIDTH_MAX)
  const agree  = boundedNumber(matchP, 'matchP', 0, 1)
  const source = normalizeRegister(offer, bits)
  let word = 0n
  for (let index = 0; index < bits; index++) {
    const offerBit = (source >> BigInt(index)) & 1n
    const bit      = random() < agree ? offerBit : offerBit ^ 1n
    if (bit === 1n) word |= 1n << BigInt(index)
  }
  return word
}

export interface MajorityWalkInput {
  width: number
  seed: number
  steps: number
  matchP: number
  mode: MajorityMode
}

export interface MajorityWalkPoint {
  t: number
  position: number
  step: -1 | 0 | 1
  committed: boolean
  ones: number
}

export interface MajorityWalkResult {
  width: number
  odd: boolean
  threshold: number
  mode: MajorityMode
  matchP: number
  lastVote: MajorityVote
  lastAlignment: AlignmentVote | null
  lastBits: number[]
  lastAlignedBits: number[] | null
  commits: number
  ties: number
  path: MajorityWalkPoint[]
  position: number
  empiricalCommitRate: number
  binomialCommitP: number
  fairStepP: number
  finding: string
}

export function evaluateMajorityWalk(input: MajorityWalkInput): MajorityWalkResult {
  const width  = boundedInteger(input.width, 'width', 1, REGISTER_WIDTH_MAX)
  const steps  = boundedInteger(input.steps, 'steps', 1, MAJORITY_WALK_MAX)
  const matchP = boundedNumber(input.matchP, 'matchP', 0, 1)
  const random = mulberry32(input.seed)
  const path: MajorityWalkPoint[] = []
  let position = 0, commits = 0, ties = 0
  let lastVote: MajorityVote = evaluateMajority(0n, width)
  let lastAlignment: AlignmentVote | null = null
  let lastWord = 0n
  let lastReceiver = 0n
  for (let t = 1; t <= steps; t++) {
    const offer = randomBiasedRegister(width, random, 0.5)
    lastWord = offer
    if (input.mode === 'coins') {
      lastVote = evaluateMajority(offer, width)
      lastAlignment = null
      if (lastVote.tie) ties++
      else commits++
      position += lastVote.step
      path.push({ t, position, step: lastVote.step, committed: !lastVote.tie, ones: lastVote.ones })
      continue
    }
    lastReceiver  = alignedReceiver(offer, width, random, matchP)
    lastAlignment = evaluateAlignment(offer, lastReceiver, width)
    lastVote      = evaluateMajority(offer, width)
    if (lastAlignment.tie) ties++
    if (lastAlignment.committed) {
      commits++
      position += lastVote.step
      path.push({ t, position, step: lastVote.step, committed: true, ones: lastAlignment.aligned })
    } else {
      path.push({ t, position, step: 0, committed: false, ones: lastAlignment.aligned })
    }
  }
  const binomialCommitP = input.mode === 'coins'
    ? (width % 2 === 1 ? 1 : 1 - binomialPge(width, width / 2, 0.5) + binomialPge(width, width / 2 + 1, 0.5))
    : binomialPge(width, majorityThreshold(width), matchP)
  const fairStepP = binomialPge(width, majorityThreshold(width), 0.5)
  return {
    width,
    odd:                 width % 2 === 1,
    threshold:           majorityThreshold(width),
    mode:                input.mode,
    matchP,
    lastVote,
    lastAlignment,
    lastBits:            bitsOf(lastWord, width),
    lastAlignedBits:     lastAlignment === null ? null : bitsOf(~(lastWord ^ lastReceiver) & maskWidth(width), width),
    commits,
    ties,
    path,
    position,
    empiricalCommitRate: commits / steps,
    binomialCommitP,
    fairStepP,
    finding: majorityFinding(input.mode, width, matchP, binomialCommitP, fairStepP),
  }
}

function majorityFinding(mode: MajorityMode, width: number, matchP: number, commitP: number, fairStepP: number): string {
  const odd = width % 2 === 1
  if (mode === 'coins') {
    return odd
      ? `${width} is odd, so 137-style coin flips cannot tie. Majority phase is always a definite next step. For fair coins P(step = +1) = ${fairStepP.toFixed(4)}, a random walk, not a physical law.`
      : `${width} is even, so ties occur. P(no step) is the binomial middle term. The unpublished method uses 137 because it is odd.`
  }
  return `A step commits only when at least ${majorityThreshold(width)} of ${width} phases match. At per-bit agreement ${matchP.toFixed(2)}, P(majority lock) = ${commitP.toFixed(4)}. Width 137 concentrates a weak per-bit alignment into an almost-sure tick; it does not derive α or a field equation.`
}

export function twoBitXorSupport(): { label: string; xor: number; probability: number }[] {
  const amplitude = 1 / Math.sqrt(2)
  const p         = amplitude * amplitude
  return [
    { label: '00', xor: 0, probability: p },
    { label: '01', xor: 1, probability: 0 },
    { label: '10', xor: 1, probability: 0 },
    { label: '11', xor: 0, probability: p },
  ]
}
