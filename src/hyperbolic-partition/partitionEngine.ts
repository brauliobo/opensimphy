import type { ComplexValue } from '../types/engine'
import {
  add,
  argument,
  complex,
  divide,
  I,
  magnitude,
  multiply,
  subtract,
} from '../engine/complex'

export const PARTITION_SOURCE_URL = 'https://www.physicsmonastery.earth/hyperbolic-partition-eq'
export const TWO_PI = 2 * Math.PI
export const A_COMPACT = 15

const DISC = Math.sqrt(Math.PI ** 2 + 6 * Math.PI)
const CRITICAL_U = (DISC - Math.PI) / 3
const CRITICAL_X_REAL = Math.sqrt(CRITICAL_U)
const CRITICAL_X_IMAG = Math.sqrt((Math.PI + DISC) / 3)

export interface PartitionRoot {
  label: string
  value: ComplexValue
  residual: number
  radius: number
  angle: number
}

export interface MobiusChart {
  inf: number
  zero: number
  one: number
  lambdaIndex: number
  lambda: ComplexValue
}

export interface MonodromyResult {
  center: ComplexValue
  permutation: readonly number[]
  cycleType: string
  samples: readonly ComplexValue[]
  trails: readonly ComplexValue[][]
}

export const PHYSICAL_ROOTS: readonly ComplexValue[] = Object.freeze([
  Object.freeze({ re: 0.08542454315333047, im: 0 }),
  Object.freeze({ re: 3.6675675348550103, im: 0 }),
  Object.freeze({ re: -1.8764960390041704, im: 4.066152626159726 }),
  Object.freeze({ re: -1.8764960390041704, im: -4.066152626159726 }),
])

function monasteryPlanckMassKg(): number {
  const geometric = 10 * Math.PI * Math.cos(1.4) ** 2
  return Math.log(8 / geometric) * 1e-8
}

export function asA(value: number | ComplexValue): ComplexValue {
  return typeof value === 'number' ? complex(Number.isFinite(value) ? value : Math.sign(value) * Math.sinh(A_COMPACT)) : value
}

export function physicalPartitionA(): number {
  return Math.exp(Math.PI ** 2 / 4) - monasteryPlanckMassKg()
}

export function branchAReal(): number {
  const x = CRITICAL_X_REAL
  return x ** 3 / TWO_PI + x + 1 / x
}

export function branchAImag(): number {
  return partitionAFromRoot(multiply(I, complex(CRITICAL_X_IMAG))).im
}

export function unitCircleA(): number {
  return 1 - 1 / TWO_PI
}

export function harmonicA(): number {
  return Math.sqrt(8 / 3 - 4 * Math.PI / 27)
}

export const SPECIAL_A = Object.freeze({
  zero: 0,
  unitCircle: unitCircleA(),
  harmonic: harmonicA(),
  branch: branchAReal(),
  physical: physicalPartitionA(),
})

export function aFromSlider(t: number): number {
  if (t <= -1) return Number.NEGATIVE_INFINITY
  if (t >= 1) return Number.POSITIVE_INFINITY
  return Math.sinh(A_COMPACT * t)
}

export function sliderFromA(a: number): number {
  if (!Number.isFinite(a)) return a < 0 ? -1 : 1
  return Math.max(-1, Math.min(1, Math.asinh(a) / A_COMPACT))
}

export function partitionCoefficients(a: number | ComplexValue): ComplexValue[] {
  const parameter = asA(a)
  return [complex(1), complex(0), complex(TWO_PI), multiply(complex(-TWO_PI), parameter), complex(TWO_PI)]
}

export function evaluatePartition(a: number | ComplexValue, x: ComplexValue): ComplexValue {
  return partitionCoefficients(a).reduce((result, coefficient) => add(multiply(result, x), coefficient), complex(0))
}

function partitionAFromRoot(x: ComplexValue): ComplexValue {
  return divide(add(add(multiply(multiply(x, x), multiply(x, x)), multiply(complex(TWO_PI), multiply(x, x))), complex(TWO_PI)), multiply(complex(TWO_PI), x))
}

function durandKerner(coefficients: ComplexValue[], seeds: ComplexValue[]): ComplexValue[] {
  let roots = seeds.map((seed) => complex(seed.re, seed.im))
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const next = roots.map((root, index) => {
      const denominator = roots.reduce((product, other, otherIndex) => (
        otherIndex === index ? product : multiply(product, subtract(root, other))
      ), complex(1))
      const value = coefficients.reduce((result, coefficient) => add(multiply(result, root), coefficient), complex(0))
      return subtract(root, divide(value, denominator))
    })
    const change = Math.max(...next.map((root, index) => magnitude(subtract(root, roots[index]!))))
    roots = next
    if (change < 1e-14) break
  }
  return roots
}

export function orderPartitionRoots(roots: ComplexValue[]): ComplexValue[] {
  return [...roots].sort((left, right) => {
    const imaginaryOrder = Math.abs(left.im) - Math.abs(right.im)
    if (Math.abs(imaginaryOrder) > 1e-10) return imaginaryOrder
    if (Math.abs(left.im) < 1e-10 && Math.abs(right.im) < 1e-10) return left.re - right.re
    return right.im - left.im
  })
}

const DEFAULT_SEEDS: ComplexValue[] = [complex(1), complex(0.4, 0.9), complex(-0.5, 0.7), complex(-0.7, -0.6)]

export function solvePartitionQuartic(a: number | ComplexValue, previous?: readonly ComplexValue[], order = true): ComplexValue[] {
  const seeds = previous && previous.length === 4 ? [...previous] : DEFAULT_SEEDS
  const roots = durandKerner(partitionCoefficients(a), seeds)
  return order ? orderPartitionRoots(roots) : roots
}

export function describeRoots(a: number | ComplexValue, previous?: readonly ComplexValue[]): PartitionRoot[] {
  const roots = solvePartitionQuartic(a, previous)
  return roots.map((value, index) => ({
    label: `zhe_${index + 1}`,
    value,
    residual: magnitude(evaluatePartition(a, value)),
    radius: magnitude(value),
    angle: argument(value),
  }))
}

export function vietaSums(roots: readonly ComplexValue[]): { sum: ComplexValue; sumSquares: ComplexValue; product: ComplexValue } {
  const sum = roots.reduce(add, complex(0))
  const sumSquares = roots.reduce((total, root) => add(total, multiply(root, root)), complex(0))
  const product = roots.reduce(multiply, complex(1))
  return { sum, sumSquares, product }
}

export function mobiusToInfinity01(z: ComplexValue, zInf: ComplexValue, zZero: ComplexValue, zOne: ComplexValue): ComplexValue {
  const numerator = multiply(subtract(z, zZero), subtract(zOne, zInf))
  const denominator = multiply(subtract(z, zInf), subtract(zOne, zZero))
  return divide(numerator, denominator)
}

export function crossRatio(z1: ComplexValue, z2: ComplexValue, z3: ComplexValue, z4: ComplexValue): ComplexValue {
  return divide(multiply(subtract(z3, z1), subtract(z4, z2)), multiply(subtract(z3, z2), subtract(z4, z1)))
}

function permutations4(): number[][] {
  const out: number[][] = []
  const used = [false, false, false, false]
  const current: number[] = []
  function visit(): void {
    if (current.length === 4) {
      out.push([...current])
      return
    }
    for (let index = 0; index < 4; index += 1) {
      if (used[index]) continue
      used[index] = true
      current.push(index)
      visit()
      current.pop()
      used[index] = false
    }
  }
  visit()
  return out
}

export const ROOT_PERMUTATIONS = Object.freeze(permutations4().map((perm) => Object.freeze(perm)))

export function mobiusCharts(roots: readonly ComplexValue[]): MobiusChart[] {
  return ROOT_PERMUTATIONS.map((perm) => ({
    inf: perm[0]!,
    zero: perm[1]!,
    one: perm[2]!,
    lambdaIndex: perm[3]!,
    lambda: mobiusToInfinity01(roots[perm[3]!]!, roots[perm[0]!]!, roots[perm[1]!]!, roots[perm[2]!]!),
  }))
}

export function uniqueLambdas(charts: readonly MobiusChart[], tolerance = 1e-8): ComplexValue[] {
  const unique: ComplexValue[] = []
  for (const chart of charts) {
    if (unique.some((value) => magnitude(subtract(value, chart.lambda)) < tolerance)) continue
    unique.push(chart.lambda)
  }
  return unique
}

export function nearestIndex(target: ComplexValue, candidates: readonly ComplexValue[]): number {
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  candidates.forEach((candidate, index) => {
    const distance = magnitude(subtract(target, candidate))
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}

export function continueAlongPath(startRoots: readonly ComplexValue[], path: readonly ComplexValue[]): ComplexValue[][] {
  let roots = [...startRoots]
  const trails = roots.map((root) => [root])
  for (const sample of path) {
    const next = durandKerner(partitionCoefficients(sample), roots)
    roots = roots.map((root) => next[nearestIndex(root, next)]!)
    roots.forEach((root, index) => trails[index]!.push(root))
  }
  return trails
}

export function circlePath(center: ComplexValue, radius: number, samples = 72): ComplexValue[] {
  return Array.from({ length: samples }, (_, index) => {
    const angle = TWO_PI * ((index + 1) / samples)
    return complex(center.re + radius * Math.cos(angle), center.im + radius * Math.sin(angle))
  })
}

export function monodromyAround(center: ComplexValue, radius = 0.35, samples = 96): MonodromyResult {
  const start = complex(center.re + radius, center.im)
  const startRoots = solvePartitionQuartic(start, undefined, false)
  const path = circlePath(center, radius, samples)
  const trails = continueAlongPath(startRoots, path)
  const endRoots = trails.map((trail) => trail.at(-1)!)
  const permutation = startRoots.map((_, index) => nearestIndex(endRoots[index]!, startRoots))
  const seen = new Set<number>()
  const cycles: number[][] = []
  for (let startIndex = 0; startIndex < 4; startIndex += 1) {
    if (seen.has(startIndex)) continue
    const cycle = [startIndex]
    seen.add(startIndex)
    let cursor = permutation[startIndex]!
    while (!seen.has(cursor)) {
      cycle.push(cursor)
      seen.add(cursor)
      cursor = permutation[cursor]!
    }
    if (cycle.length > 1) cycles.push(cycle.map((index) => index + 1))
  }
  const cycleType = cycles.length === 0 ? 'id' : cycles.map((cycle) => `(${cycle.join('')})`).join('')
  return { center, permutation, cycleType, samples: path, trails }
}

export function realLocus(count = 161): { a: number; roots: ComplexValue[] }[] {
  return Array.from({ length: count }, (_, index) => {
    const t = -1 + 2 * index / (count - 1)
    const a = aFromSlider(t)
    return { a, roots: solvePartitionQuartic(a) }
  })
}

let cachedRealLocus: { a: number; roots: ComplexValue[] }[] | undefined

export function realLocusCached(): { a: number; roots: ComplexValue[] }[] {
  cachedRealLocus ??= realLocus()
  return cachedRealLocus
}

export function stereographic(z: ComplexValue): { x: number; y: number; z: number } {
  const radiusSq = z.re * z.re + z.im * z.im
  const denom = 1 + radiusSq
  return { x: 2 * z.re / denom, y: 2 * z.im / denom, z: (radiusSq - 1) / denom }
}

export const BRANCH_POINTS = Object.freeze([
  Object.freeze({ id: 'plus-a1', label: '+a₁', a: complex(branchAReal()), monodromy: '(12)' }),
  Object.freeze({ id: 'minus-a1', label: '−a₁', a: complex(-branchAReal()), monodromy: '(14)' }),
  Object.freeze({ id: 'plus-b1', label: '+b₁', a: complex(0, branchAImag()), monodromy: '(23)' }),
  Object.freeze({ id: 'minus-b1', label: '−b₁', a: complex(0, -branchAImag()), monodromy: '(24)' }),
])

export function formatComplex(value: ComplexValue, digits = 6): string {
  if (!Number.isFinite(value.re) || !Number.isFinite(value.im)) return '∞'
  if (Math.abs(value.im) < 10 ** -digits) return value.re.toFixed(digits)
  const imag = `${Math.abs(value.im).toFixed(digits)} i`
  if (Math.abs(value.re) < 10 ** -digits) return `${value.im < 0 ? '−' : ''}${imag}`
  return `${value.re.toFixed(digits)} ${value.im < 0 ? '−' : '+'} ${imag}`
}

export function formatAngle(angle: number): string {
  return `${(angle * 180 / Math.PI).toFixed(2)}°`
}
