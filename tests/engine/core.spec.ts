import { CORE_CASES, evaluateCoreRegistry } from '../../src/engine/core'

interface ComplexResult {
  re: number
  im: number
}

const evaluations = evaluateCoreRegistry()
const evaluationsById = new Map(evaluations.map((evaluation) => [evaluation.id, evaluation]))

function evaluation(id: string) {
  const value = evaluationsById.get(id)
  if (!value) throw new Error(`Missing core evaluation: ${id}`)
  return value
}

function relativeError(actual: number, expected: number): number {
  return Math.abs((actual - expected) / expected)
}

describe('core registry', () => {
  it('evaluates the exact registry with unique IDs and finite, non-artificial graph sweeps', () => {
    expect(CORE_CASES).toHaveLength(37)
    expect(evaluations).toHaveLength(CORE_CASES.length)
    expect(new Set(evaluations.map(({ id }) => id)).size).toBe(CORE_CASES.length)
    expect(evaluations.filter(({ graphReady }) => !graphReady).map(({ id }) => id)).toEqual([])
    expect(evaluations.filter(({ graph }) => graph.length !== 33).map(({ id }) => id)).toEqual([])
    expect(evaluations.filter(({ residual }) => residual !== null && !Number.isFinite(residual)).map(({ id }) => id)).toEqual([])
    expect(evaluations.filter(({ graph }) => graph.every(({ y }) => y === graph[0]?.y)).map(({ id }) => id)).toEqual([])
  })

  it('computes the five Monastery Planck closed forms, boundaries, and normalized site surfaces', () => {
    const expected = [
      { id: 'planck-time', geometric: Math.PI * Math.sinh(1 / 4) ** 2, scalar: 5.391258368323129, boundary: 5.391258368323129e-44, exponent: -44, unit: 's' },
      { id: 'planck-length', geometric: 1 / Math.sinh(Math.sinh(1 / 7)), scalar: 1.616259181756454, boundary: 1.616259181756454e-35, exponent: -35, unit: 'm' },
      { id: 'planck-charge', geometric: (5 / Math.sqrt(7)) * 3 ** (-1 / 3) / 0.4749493799879206503, scalar: 1.875545967139625, boundary: 1.875545967139625e-18, exponent: -18, unit: 'C' },
      { id: 'planck-temperature', geometric: 2 * (5 / Math.sqrt(7)) ** 2 * Math.cosh(5 / 2) ** 2 * Math.cos(7 / 5) ** 2, scalar: 1.416786985907946, boundary: 1.416786985907946e32, exponent: 32, unit: 'K' },
      { id: 'planck-mass', geometric: 5 * (4 * Math.PI / 2) * Math.cos(7 / 5) ** 2, scalar: 2.176426838175787, boundary: 2.176426838175787e-8, exponent: -8, unit: 'kg' },
    ]

    for (const target of expected) {
      const current = evaluation(target.id)
      const result = current.result as { geometric: number; scalar: number; boundary: number; exponent: number; unit: string }
      expect(relativeError(result.geometric, target.geometric)).toBeLessThan(2e-15)
      expect(Math.abs(result.scalar - target.scalar)).toBeLessThan(1e-14)
      expect(relativeError(result.boundary, target.boundary)).toBeLessThan(1e-14)
      expect(result.exponent).toBe(target.exponent)
      expect(result.unit).toBe(target.unit)

      const normalizedSite = current.surface.find(({ x, y }) => x === 1 && y === 0)
      expect(normalizedSite).toBeDefined()
      expect(Math.abs(normalizedSite!.real - 1)).toBeLessThan(2e-13)
      expect(Math.abs(normalizedSite!.imaginary)).toBeLessThan(2e-13)
      expect(current.surface.some(({ imaginary }) => Math.abs(imaginary) > 1e-12)).toBe(true)
      expect(current.surface.every(({ x, y, real, imaginary, magnitude }) => (
        Math.hypot(x, y) >= 0.2
        && Number.isFinite(real)
        && Number.isFinite(imaginary)
        && Number.isFinite(magnitude)
      ))).toBe(true)
    }
  })

  it('derives the inversion boundary from the typed Planck boundaries', () => {
    const expected = (1.616259181756454e-35 * 2.176426838175787e-8) / 1.875545967139625e-18 ** 2
    const result = evaluation('inversion-boundary').result as number

    expect(relativeError(result, expected)).toBeLessThan(2e-15)
    expect(relativeError(result, 9.99999199973622e-8)).toBeLessThan(2e-15)
  })

  it('constructs the recovered quartic, companion matrix, roots, and invariants', () => {
    const quartic = evaluation('hyperbolic-quartic-roots').result as {
      a: number
      coefficients: ComplexResult[]
      companion: ComplexResult[][]
      roots: ComplexResult[]
      rootResiduals: number[]
      coefficientResidual: number
      targetDeltas: number[]
    }
    const expectedA = Math.exp(Math.PI ** 2 / 4) - 2.176426838175787e-8

    expect(Math.abs(quartic.a - expectedA)).toBeLessThan(2e-14)
    expect(quartic.coefficients.map(({ re }) => re)).toEqual([
      1,
      0,
      2 * Math.PI,
      -2 * Math.PI * quartic.a,
      2 * Math.PI,
    ])
    expect(quartic.coefficients.every(({ im }) => im === 0)).toBe(true)
    expect(quartic.companion[0]?.[3]?.re).toBe(-2 * Math.PI)
    expect(quartic.companion[1]?.[3]?.re).toBe(2 * Math.PI * quartic.a)
    expect(quartic.companion[2]?.[3]?.re).toBe(-2 * Math.PI)
    expect(Math.abs(quartic.companion[3]?.[3]?.re ?? Number.NaN)).toBe(0)
    expect(quartic.roots).toHaveLength(4)
    expect(Math.max(...quartic.rootResiduals)).toBeLessThan(1e-11)
    expect(quartic.coefficientResidual).toBeLessThan(1e-11)
    expect(Math.max(...quartic.targetDeltas)).toBeLessThan(1e-12)

    const invariantIds = [
      'hyperbolic-quartic-roots',
      'elementary-symmetric-invariants',
      'inverse-invariants',
      'power-sum-invariants',
      'companion-traces',
      'companion-determinants',
      'companion-powers',
      'companion-log-flow',
      'companion-root-locus',
    ]
    expect(invariantIds.flatMap((id) => {
      const residual = evaluation(id).residual
      return residual === null || Math.abs(residual) > 1e-10 ? [{ id, residual }] : []
    })).toEqual([])

    const rootLocus = evaluation('companion-root-locus')
    expect(rootLocus.surface).toHaveLength(33 * 4)
    expect(rootLocus.surface.every(({ real, imaginary, magnitude }) => Number.isFinite(real) && Number.isFinite(imaginary) && Number.isFinite(magnitude))).toBe(true)
  })

  it('computes every principal-branch manifold identity with the recovered signs', () => {
    const figureEight = evaluation('figure-eight-volume').result as {
      phiI: ComplexResult
      gieseking: number
      volume: ComplexResult
      twiceGieseking: ComplexResult
      identityResidual: number
      comparisonResidual: number
      phaseResidual: number
      inverseDilogarithm: ComplexResult
      inverseResidual: number
      directDilogarithm: ComplexResult
      directResidual: number
      dilogarithmSum: ComplexResult
      sumExpected: number
      sumResidual: number
      nuclearToElectron: number
      radiusElectronResidual: number
    }
    expect(Math.abs(figureEight.phiI.re - 0.5)).toBeLessThan(2e-15)
    expect(Math.abs(figureEight.phiI.im - Math.sqrt(3) / 2)).toBeLessThan(2e-15)
    expect(figureEight.phaseResidual).toBeLessThan(1e-14)
    expect(Math.abs(figureEight.gieseking - 1.0149416064096536)).toBeLessThan(1e-12)
    expect(Math.abs(figureEight.volume.re - 2.029883212819307)).toBeLessThan(2e-12)
    expect(Math.abs(figureEight.volume.im)).toBeLessThan(1e-14)
    expect(figureEight.identityResidual).toBeLessThan(1e-14)
    expect(Math.abs(figureEight.comparisonResidual)).toBeLessThan(1e-12)

    const gieseking = evaluation('gieseking-volume').result as { gieseking: number; volume: number; comparisonResidual: number }
    expect(Math.abs(gieseking.volume - 2 * gieseking.gieseking)).toBeLessThan(1e-14)
    expect(Math.abs(gieseking.comparisonResidual)).toBeLessThan(1e-12)

    const base = (4 * Math.PI / 24) ** 2
    expect(Math.abs(figureEight.inverseDilogarithm.re - base)).toBeLessThan(1e-14)
    expect(Math.abs(figureEight.inverseDilogarithm.im + figureEight.gieseking)).toBeLessThan(1e-14)
    expect(Math.abs(figureEight.directDilogarithm.re - base)).toBeLessThan(1e-14)
    expect(Math.abs(figureEight.directDilogarithm.im - figureEight.gieseking)).toBeLessThan(1e-14)
    expect(figureEight.inverseResidual).toBeLessThan(1e-13)
    expect(figureEight.directResidual).toBeLessThan(1e-13)
    expect(Math.abs(figureEight.sumExpected - Math.PI ** 2 / 18)).toBeLessThan(1e-14)
    expect(Math.abs(figureEight.dilogarithmSum.re - Math.PI ** 2 / 18)).toBeLessThan(1e-14)
    expect(Math.abs(figureEight.dilogarithmSum.im)).toBeLessThan(1e-14)
    expect(figureEight.sumResidual).toBeLessThan(1e-13)
    expect(Math.abs(figureEight.nuclearToElectron - base)).toBeLessThan(1e-14)
    expect(Math.abs(figureEight.radiusElectronResidual)).toBeLessThan(1e-14)

    expect(Math.abs(evaluation('dilog-conjugacy').residual!)).toBeLessThan(1e-13)

    const catalan = evaluation('catalan-dilog').result as {
      catalan: number
      twiceCatalan: ComplexResult
      identityResidual: number
      comparisonResidual: number
      nuclearToPositiveKnot: number
      radiusKnotResidual: number
    }
    expect(Math.abs(catalan.catalan - 0.915965594177219)).toBeLessThan(1e-10)
    expect(Math.abs(catalan.twiceCatalan.re - 2 * catalan.catalan)).toBeLessThan(1e-14)
    expect(Math.abs(catalan.twiceCatalan.im)).toBeLessThan(1e-14)
    expect(catalan.identityResidual).toBeLessThan(1e-14)
    expect(Math.abs(catalan.comparisonResidual)).toBeLessThan(1e-10)
    expect(Math.abs(catalan.nuclearToPositiveKnot - catalan.catalan)).toBeLessThan(1e-14)
    expect(Math.abs(catalan.radiusKnotResidual)).toBeLessThan(1e-14)

    const manifoldIds = CORE_CASES.filter(({ category }) => category === 'manifold').map(({ id }) => id)
    expect(manifoldIds.flatMap((id) => {
      const residual = evaluation(id).residual
      return residual === null || Math.abs(residual) > 1e-9 ? [{ id, residual }] : []
    })).toEqual([])
  })

  it('matches the explicit 24D factor product and exposes constructive and twisted components', () => {
    const transform24 = evaluation('hypersphere-24d-leech').result as {
      factors: number[]
      factorProduct: number
      hypersphere: number
    }
    expect(transform24.factors).toEqual([
      4 * Math.PI / 120,
      4 * Math.PI / 44,
      4 * Math.PI / 35,
      (4 * Math.PI / 18) ** 2,
      (4 * Math.PI / 32) ** 3,
      (4 * Math.PI / 8) ** 4,
    ])
    expect(relativeError(transform24.factorProduct, Math.PI ** 12 / 479001600)).toBeLessThan(5e-15)
    expect(relativeError(transform24.factorProduct, transform24.hypersphere)).toBeLessThan(5e-15)
    expect(Math.abs(evaluation('hypersphere-24d-leech').residual!)).toBeLessThan(1e-18)

    const constructive = evaluation('constructive-zeros').result as {
      constructivePositive: ComplexResult
      constructiveNegative: ComplexResult
      constructiveProduct: ComplexResult
      radialSquare: number
    }
    expect(constructive.constructivePositive.im).toBeGreaterThan(0)
    expect(constructive.constructiveNegative.im).toBeLessThan(0)
    expect(Math.abs(constructive.constructiveProduct.re - constructive.radialSquare)).toBeLessThan(1e-12)
    expect(Math.abs(constructive.constructiveProduct.im)).toBeLessThan(1e-12)

    const twisted = evaluation('twisted-zeros').result as {
      twistedPositive: ComplexResult
      twistedNegative: ComplexResult
      twistedProduct: ComplexResult
      radialEighth: number
    }
    expect(twisted.twistedPositive.im).toBeGreaterThan(0)
    expect(twisted.twistedNegative.im).toBeLessThan(0)
    expect(Math.abs(twisted.twistedProduct.re - twisted.radialEighth)).toBeLessThan(1e-8)
    expect(Math.abs(twisted.twistedProduct.im)).toBeLessThan(1e-10)
    expect(evaluation('constructive-zeros').graphReady).toBe(true)
    expect(evaluation('twisted-zeros').graphReady).toBe(true)
  })
})
