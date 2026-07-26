import {
  EarthCancellationError,
  DEFAULT_EARTH_SIMULATION_INPUTS,
  GOLDEN_RATIO,
  SUPPORTED_EARTH_SIMULATION_IDS,
  runEarthSimulation,
} from '../../src/engine/earth'

describe('EARTH foundation numerical audits', () => {
  it('retains the documented golden-power, pi, alpha, and Planck-twist failures', () => {
    const powers = runEarthSimulation('EARTH-FND-002', {
      exponents: [6, 18, -18],
      claims: [
        { exponent: 6, claimed: 14.778 },
        { exponent: 18, claimed: 2584 },
      ],
    })
    expect(powers.provenance.kind).toBe('reproduction')
    expect(powers.output.powers.find(({ exponent }) => exponent === 6)?.value).toBeCloseTo(17.94427190999916, 13)
    expect(powers.output.powers.find(({ exponent }) => exponent === 18)?.value).toBeCloseTo(5777.999826929732, 10)
    expect(powers.output.claims.every(({ matches }) => !matches)).toBe(true)
    expect(powers.diagnostics.failedClaims).toBe(2)

    const constants = runEarthSimulation('EARTH-FND-003', {})
    expect(constants.output.piExpressions.map(({ value }) => value)).toEqual([
      expect.closeTo(0.9356218266489363, 14),
      expect.closeTo(2.0361478418205086, 14),
      expect.any(Number),
    ])
    expect(constants.output.piExpressions.every(({ residualToPi }) => Math.abs(residualToPi) > 1)).toBe(true)
    expect(Math.abs(constants.output.quartic.atPositiveRoot)).toBeLessThan(2e-14)
    expect(constants.output.alpha.sourceInverseUsingPi).toBeCloseTo(2960.9266845258185, 10)
    expect(constants.output.alpha.relativeResidual).toBeGreaterThan(0.9)

    const action = runEarthSimulation('EARTH-FND-011', {
      uncertainty: { xi0: 0.001e-15, protonMass: 3e-37 },
    })
    expect(action.output.twistAngle).toBeCloseTo(0.3568220897730899, 14)
    expect(action.output.action).toBeCloseTo(1.423837948980579e-36, 14)
    expect(action.output.ratioToCodata).toBeCloseTo(0.013501567607371487, 14)
    expect(action.output.standardUncertainty).toBeGreaterThan(0)
  })

  it('iterates the literal substitution and derives its actual incidence spectrum', () => {
    const words = runEarthSimulation('EARTH-FND-004', { generations: 8, maximumFactorLength: 6 })
    expect(words.diagnostics.exactDoubling).toBe(true)
    expect(words.output.words.map(({ word }) => word.length)).toEqual([256, 256, 256])
    expect(new Set(words.output.words.map(({ word }) => word)).size).toBe(3)
    expect(words.output.words.every(({ complexity }) => complexity.length === 6)).toBe(true)

    const spectrum = runEarthSimulation('EARTH-FND-005', {})
    expect(spectrum.output.canonical.matrix).toEqual([[1, 1, 1], [1, 0, 1], [0, 1, 0]])
    expect(spectrum.output.canonical.columnSums).toEqual([2, 2, 2])
    expect(spectrum.output.canonical.eigenvalues).toEqual([-1, 0, 2])
    expect(spectrum.output.canonical.perronRoot).toBe(2)
    expect(spectrum.output.printed?.perronRoot).toBeCloseTo(1 + Math.sqrt(2), 14)
    expect(spectrum.output.canonical.perronRoot).not.toBeCloseTo(GOLDEN_RATIO, 10)
  })

  it('classifies standard torus knots and links instead of preserving source labels', () => {
    const result = runEarthSimulation('EARTH-FND-007', {
      pairs: [
        { p: 3, q: 1, label: 'source proton trefoil' },
        { p: 3, q: 3, label: 'source composite' },
        { p: 2, q: 3, label: 'standard trefoil' },
      ],
    })
    expect(result.output.classifications).toEqual([
      { p: 3, q: 1, label: 'source proton trefoil', gcd: 1, components: 1, kind: 'unknot', minimalCrossingNumber: 0 },
      { p: 3, q: 3, label: 'source composite', gcd: 3, components: 3, kind: 'link', minimalCrossingNumber: 6 },
      { p: 2, q: 3, label: 'standard trefoil', gcd: 1, components: 1, kind: 'knot', minimalCrossingNumber: 3 },
    ])
  })

  it('propagates same-scale density uncertainty and compares all coupling forms', () => {
    const spacing = runEarthSimulation('EARTH-FND-008', {
      xi0: 0.15,
      referenceDensity: 8,
      density: 1,
      lengthUnit: 'fm',
      densityUnit: 'fm^-3',
      uncertainty: { density: 0.03 },
    })
    expect(spacing.output.spacing).toBeCloseTo(0.3, 15)
    expect(spacing.output.derivatives.density).toBeCloseTo(-0.1, 15)
    expect(spacing.output.standardUncertainty).toBeCloseTo(0.003, 15)
    expect(spacing.diagnostics.unitsConverted).toBe(false)

    const coupling = runEarthSimulation('EARTH-FND-010', { rOverXi0: [1, GOLDEN_RATIO ** 10, GOLDEN_RATIO ** 20] })
    expect(coupling.output.points[0]).toMatchObject({
      direct: expect.closeTo(17.94427190999916, 12),
      intermediate: expect.closeTo(321.996894379985, 10),
      boxed: expect.closeTo(321.996894379985, 10),
    })
    expect(coupling.diagnostics.algebraicallyEquivalent).toBe(false)
    expect(coupling.output.points[2]?.boxed).toBeCloseTo(2.687415718559084e-23, 12)
  })
})

describe('EARTH bounded numerical comparisons', () => {
  it('minimizes the spherical pair energy deterministically with gradient diagnostics', () => {
    const inputs = { coordination: 4, starts: 5, maximumIterations: 1500, gradientTolerance: 1e-8 }
    const first = runEarthSimulation('EARTH-CHEM-004', inputs, { seed: 12345 })
    const second = runEarthSimulation('EARTH-CHEM-004', inputs, { seed: 12345 })
    expect(first).toEqual(second)
    expect(first.output.energy).toBeCloseTo(9, 8)
    expect(first.output.pairAnglesDegrees.every((angle) => Math.abs(angle - 109.47122063449069) < 2e-4)).toBe(true)
    expect(first.diagnostics.finalProjectedGradientNorm).toBeLessThan(1e-6)
    expect(first.output.startDiagnostics.every(({ finalEnergy, initialEnergy }) => finalEnergy <= initialEnergy)).toBe(true)
  })

  it('keeps every supported coordination from N=2 through N=12 finite and on the sphere', () => {
    for (let coordination = 2; coordination <= 12; coordination += 1) {
      const result = runEarthSimulation('EARTH-CHEM-004', {
        coordination,
        starts: 3,
        maximumIterations: 800,
        gradientTolerance: 1e-7,
      }, { seed: 700 + coordination })
      expect(result.output.points).toHaveLength(coordination)
      expect(result.output.pairAnglesRadians).toHaveLength(coordination * (coordination - 1) / 2)
      expect(Number.isFinite(result.output.energy)).toBe(true)
      expect(result.output.points.every((point) => Math.abs(Math.hypot(...point) - 1) < 2e-15)).toBe(true)
    }
  })

  it('uses a stable normalized stochastic diffusion scheme with seeded ensembles', () => {
    const inputs = {
      gridPoints: 32,
      length: 1,
      timeStep: 0.01,
      steps: 100,
      diffusion: 0.2,
      damping: 1,
      noise: 0.3,
      ensembles: 24,
    }
    const first = runEarthSimulation('EARTH-FLD-005', inputs, { seed: 991 })
    const second = runEarthSimulation('EARTH-FLD-005', inputs, { seed: 991 })
    expect(first).toEqual(second)
    expect(first.provenance.kind).toBe('comparison')
    expect(first.diagnostics.unconditionallyStable).toBe(true)
    expect(first.diagnostics.finite).toBe(true)
    expect(first.output.correlation[0]).toBeCloseTo(1, 14)
    expect(first.output.expectedVariance).toBeGreaterThan(0)
    expect(first.output.varianceRelativeResidual).toBeLessThan(0.35)
  })

  it('preserves unitarity in the two-level Floquet comparison and the undriven limit', () => {
    const result = runEarthSimulation('EARTH-FLD-007', {
      bias: 1,
      drive: 0,
      frequency: 1.2,
      stepsPerPeriod: 128,
    })
    expect(result.provenance.kind).toBe('comparison')
    expect(result.output.unitarityResidual).toBeLessThan(2e-14)
    expect(result.output.transitionProbability).toBeLessThan(1e-28)
    expect(result.output.undrivenQuasienergy).toBeCloseTo(0.5, 13)
    expect(result.output.refinementResidual).toBeLessThan(2e-14)
  })

  it('benchmarks the analytic sine-Gordon kink with second-order residual convergence', () => {
    const coarse = runEarthSimulation('EARTH-FLD-008', { gridPoints: 257, halfLength: 8, width: 1 })
    const fine = runEarthSimulation('EARTH-FLD-008', { gridPoints: 513, halfLength: 8, width: 1 })
    expect(fine.output.maximumResidual).toBeLessThan(coarse.output.maximumResidual / 3.8)
    expect(fine.output.numericalEnergy).toBeCloseTo(fine.output.analyticEnergy, 5)
    expect(fine.output.theta[Math.floor(fine.output.theta.length / 2)]).toBeCloseTo(Math.PI, 14)
  })

  it('derives the squared-cosine potential force and rejects sine-Gordon equivalence', () => {
    const result = runEarthSimulation('EARTH-FLD-010', { theta: [0, Math.PI / 2, Math.PI] })
    expect(result.output.samples[1]).toMatchObject({
      analyticDerivative: expect.closeTo(2, 12),
      sineGordonDerivative: expect.closeTo(1, 12),
      differenceFromSineGordon: expect.closeTo(1, 12),
    })
    expect(result.output.maximumFiniteDifferenceResidual).toBeLessThan(1e-9)
    expect(result.diagnostics.equivalentToSineGordon).toBe(false)
  })
})

describe('EARTH dispatcher bounds and cancellation', () => {
  it('exports exactly the implemented IDs and rejects unsupported programs clearly', () => {
    expect(Object.keys(DEFAULT_EARTH_SIMULATION_INPUTS)).toEqual([...SUPPORTED_EARTH_SIMULATION_IDS])
    const untypedRun = runEarthSimulation as (id: string, inputs: unknown) => unknown
    expect(() => untypedRun('EARTH-FND-999', {})).toThrow('Unsupported EARTH simulation ID: EARTH-FND-999')
    expect(() => runEarthSimulation('EARTH-CHEM-004', { coordination: 13 })).toThrow('coordination must be an integer from 2 to 12')
    expect(() => runEarthSimulation('EARTH-FND-004', { generations: 19 })).toThrow('generations must be an integer from 0 to 18')
  })

  it('honors cooperative cancellation during iterative work', () => {
    let checks = 0
    expect(() => runEarthSimulation(
      'EARTH-FLD-005',
      { gridPoints: 64, steps: 500, ensembles: 32 },
      { isCancelled: () => ++checks > 3 },
    )).toThrow(EarthCancellationError)
    expect(checks).toBe(4)
  })
})
