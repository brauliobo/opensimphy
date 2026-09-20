import {
  BRANCH_POINTS,
  PHYSICAL_ROOTS,
  SPECIAL_A,
  TWO_PI,
  branchAImag,
  branchAReal,
  describeRoots,
  evaluatePartition,
  harmonicA,
  mobiusCharts,
  monodromyAround,
  physicalPartitionA,
  solvePartitionQuartic,
  uniqueLambdas,
  unitCircleA,
  vietaSums,
} from '../../src/hyperbolic-partition/partitionEngine'
import { magnitude, subtract } from '../../src/engine/complex'

describe('hyperbolic partition quartic engine', () => {
  it('reproduces the monastery physical roots and Vieta ledger', () => {
    const a = physicalPartitionA()
    const roots = solvePartitionQuartic(a)
    const ledger = vietaSums(roots)

    expect(a).toBeCloseTo(SPECIAL_A.physical, 12)
    expect(a).toBeCloseTo(Math.exp(Math.PI ** 2 / 4), 6)
    roots.forEach((root, index) => {
      expect(magnitude(subtract(root, PHYSICAL_ROOTS[index]!))).toBeLessThan(1e-9)
      expect(magnitude(evaluatePartition(a, root))).toBeLessThan(1e-10)
    })
    expect(ledger.sum.re).toBeCloseTo(0, 8)
    expect(ledger.sum.im).toBeCloseTo(0, 8)
    expect(ledger.sumSquares.re).toBeCloseTo(-4 * Math.PI, 6)
    expect(ledger.product.re).toBeCloseTo(TWO_PI, 6)
    expect(ledger.product.im).toBeCloseTo(0, 8)
  })

  it('places a=0 roots on the imaginary axis', () => {
    const roots = describeRoots(0)
    expect(roots).toHaveLength(4)
    for (const root of roots) {
      expect(Math.abs(root.value.re)).toBeLessThan(1e-8)
      expect(root.residual).toBeLessThan(1e-10)
    }
    const radii = roots.map((root) => root.radius).sort((left, right) => left - right)
    expect(radii[0]).toBeCloseTo(1.117, 2)
    expect(radii[3]).toBeCloseTo(2.244, 2)
  })

  it('names branch, harmonic, and unit-circle specials from the monastery explorer', () => {
    expect(branchAReal()).toBeCloseTo(2.124022, 5)
    expect(branchAImag()).toBeCloseTo(0.3301188, 6)
    expect(harmonicA()).toBeCloseTo(Math.sqrt(8 / 3 - 4 * Math.PI / 27), 12)
    expect(unitCircleA()).toBeCloseTo(1 - 1 / TWO_PI, 12)
    expect(BRANCH_POINTS).toHaveLength(4)
  })

  it('collapses 24 Möbius charts to 6 cross-ratios', () => {
    const roots = solvePartitionQuartic(SPECIAL_A.physical)
    const charts = mobiusCharts(roots)
    const unique = uniqueLambdas(charts)
    expect(charts).toHaveLength(24)
    expect(unique).toHaveLength(6)
  })

  it('returns a non-trivial permutation after a loop around +a₁', () => {
    const result = monodromyAround(BRANCH_POINTS[0]!.a, 0.4, 72)
    const moved = result.permutation.filter((target, index) => target !== index)
    expect(moved.length).toBeGreaterThanOrEqual(2)
    expect(result.cycleType).not.toBe('id')
  })
})
