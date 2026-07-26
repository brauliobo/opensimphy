import {
  EARTH_DOMAIN_DEFAULT_INPUTS,
  atmosphericScaleHeightAudit,
  compactnessKottlerInterface,
  derrickScalingAudit,
  dnaGeometryLinkingAudit,
  geomagneticExpressionAudit,
  gravityFormulaAudit,
  planetaryBindingEnergyAudit,
  planckEntropyAudit,
  screeningNoGoLedger,
  waterPhaseCoherenceSweep,
} from '../../src/engine/earth/domains'

describe('remaining EARTH no-dataset domain kernels', () => {
  it('derives the declared Derrick convention and finds collapse rather than a finite-size minimum', () => {
    const result = derrickScalingAudit({
      gradientEnergy: 2,
      potentialEnergy: 3,
      lambdaMinimum: 0.5,
      lambdaMaximum: 2,
      samples: 3,
    })

    expect(result.diagnostics.provenanceKind).toBe('reproduction')
    expect(result.output.convention).toContain('psi_lambda(x)=psi(x/lambda)')
    expect(result.output.formula).toBe('E(lambda)=lambda*E_gradient+lambda^3*E_potential')
    expect(result.output.derivativeAtOne).toBe(11)
    expect(result.output.stationaryLambda).toBeNull()
    expect(result.output.finding).toBe('collapse-to-zero-size')
    expect(result.output.series[1]).toMatchObject({
      lambda: expect.closeTo(1, 14),
      gradientTerm: expect.closeTo(2, 14),
      potentialTerm: expect.closeTo(3, 14),
      totalEnergy: expect.closeTo(5, 14),
    })
    expect(() => derrickScalingAudit({ gradientEnergy: 0, potentialEnergy: 0 })).toThrow('At least one energy contribution must be positive')
  })

  it('retains the literal gravity, Planck, and geomagnetic dimensional failures', () => {
    const gravity = gravityFormulaAudit()
    expect(gravity.diagnostics.failedDimensionalChecks).toBe(4)
    expect(gravity.diagnostics.targetCircularity).toBe(true)
    expect(gravity.output.formulas.every(({ dimensionallyValidInSI }) => !dimensionallyValidInSI)).toBe(true)
    expect(gravity.output.formulas.find(({ name }) => name === 'G')?.literalSIUnit).toBe('m^2')
    expect(gravity.output.formulas.find(({ name }) => name === 'CMB-temperature')?.relativeResidual).toBeGreaterThan(1e20)

    const planck = planckEntropyAudit()
    expect(planck.diagnostics.provenanceKind).toBe('comparison')
    expect(planck.diagnostics.sourceLengthsMutuallyConsistent).toBe(false)
    expect(planck.output.lengths.find(({ name }) => name === 'metric-source')?.ratioToStandard).toBeGreaterThan(1e18)
    expect(planck.output.lengths.find(({ name }) => name === 'quantum-gravity-source')?.metres).toBeGreaterThan(1e-6)
    expect(planck.output.entropyPerBoltzmann.find(({ name }) => name === 'source-xi0')?.ratioToStandard).toBeLessThan(1e-30)

    const geomagnetic = geomagneticExpressionAudit()
    expect(geomagnetic.diagnostics.dimensionallyMagneticMoment).toBe(false)
    expect(geomagnetic.diagnostics.containsChargeOrCurrentInput).toBe(false)
    expect(geomagnetic.diagnostics.sourceIntermediateClaim1Point194e19Matches).toBe(false)
    expect(geomagnetic.output.literalDimension).toBe('kg m^4 s^-1')
    expect(geomagnetic.output.relativeResidual).toBeGreaterThan(0.1)
  })

  it('preserves both compactness identities and the Kottler double-counting state', () => {
    const gravitationalConstant = 6.67430e-11
    const speedOfLight = 299792458
    const hubblePerSecond = 2.2e-18
    const lengthMetres = speedOfLight / hubblePerSecond
    const massKg = lengthMetres * speedOfLight ** 2 / (2 * gravitationalConstant)
    const result = compactnessKottlerInterface({
      gravitationalConstant,
      speedOfLight,
      states: [{ id: 'unit-compactness-at-de-sitter-radius', lengthMetres, massKg, hubblePerSecond }],
      radialSamples: 9,
    })
    const state = result.output.states[0]!

    expect(result.diagnostics.predictsMass).toBe(false)
    expect(state.compactnessFromPlanckRatios).toBeCloseTo(1, 14)
    expect(state.compactnessSI).toBeCloseTo(1, 14)
    expect(state.screeningRatio).toBeCloseTo(state.compactnessSI, 14)
    expect(state.compactnessIdentityRelativeResidual).toBeLessThan(5e-16)
    expect(state.hubbleTerm).toBeCloseTo(1, 14)
    expect(state.kottlerF).toBeCloseTo(-1, 14)
    expect(state.regime).toBe('inside-horizon')
  })

  it('exposes the atmosphere, water, binding, and DNA conversion failures without dataset claims', () => {
    const atmosphere = atmosphericScaleHeightAudit()
    expect(atmosphere.diagnostics.comparator).toBe('simple-standard-isothermal-hydrostatic')
    expect(atmosphere.output.sourceCoherenceMetres).toBeLessThan(1e-9)
    expect(atmosphere.output.hydrostaticScaleHeightMetres).toBeGreaterThan(8000)
    expect(atmosphere.output.requiredProjectionFactor).toBeGreaterThan(1e13)

    const water = waterPhaseCoherenceSweep({
      temperatureMinimumKelvin: 273.15,
      temperatureMaximumKelvin: 373.15,
      temperaturePoints: 3,
      pressureMinimumPascal: 101325,
      pressureMaximumPascal: 101325,
      pressurePoints: 1,
    })
    expect(water.diagnostics.iapwsImplementation).toBe(false)
    expect(water.output.comparatorLimitations).toContain('not IAPWS-95')
    expect(water.output.points[0]?.phase).toBe('liquid')
    expect(water.output.points[0]?.coherenceAngstrom).toBeCloseTo(0.0985, 3)
    expect(water.output.points.filter(({ phase }) => phase === 'liquid').every(({ relativeResidualToTarget }) => relativeResidualToTarget > 0.9)).toBe(true)

    const binding = planetaryBindingEnergyAudit()
    expect(binding.diagnostics.printedBindingIsEnergyInSI).toBe(false)
    expect(binding.diagnostics.printedSeismicIsSpeedInSI).toBe(false)
    expect(binding.output.binding.uniformSphereComparatorJoules / 2.24e32).toBeCloseTo(1, 2)
    expect(binding.output.binding.convertedRelativeResidual).toBeGreaterThan(1e30)
    expect(binding.output.seismic.literalDimension).not.toBe(binding.output.seismic.requiredDimension)

    const dna = dnaGeometryLinkingAudit()
    expect(dna.output.densityTransform.coherenceAngstrom).toBeCloseTo(0.000696, 5)
    expect(dna.output.densityTransform.requiredHiddenFactor).toBeGreaterThan(40_000)
    expect(dna.diagnostics.pitchRiseRepeatIdentityHolds).toBe(false)
    expect(dna.diagnostics.printedRepeatClaimHolds).toBe(false)
    expect(dna.output.literalGeometry.repeatFromPitchAndRise).toBeCloseTo(16.18, 2)
    expect(dna.output.basePairing.derivedByGeometry).toBe(false)
    expect(dna.output.forms.map(({ form }) => form)).toEqual(['A', 'B', 'Z'])
  })

  it('keeps screening route values independent of target comparison and rejects leaked routes', () => {
    const first = screeningNoGoLedger()
    const second = screeningNoGoLedger({ targetChi: 1e-20 })
    expect(first.output.noGo).toBe(true)
    expect(first.output.independentRouteIds).toEqual([])
    expect(first.output.routes.map(({ chi }) => chi)).toEqual(second.output.routes.map(({ chi }) => chi))
    expect(first.output.routes.filter(({ chi }) => chi !== null).every(({ targetLeakage, independentlyEligible }) => targetLeakage && !independentlyEligible)).toBe(true)

    const independentRoute = {
      id: 'blind-route',
      chi: 4e-39,
      kind: 'prediction' as const,
      dependencies: ['none'] as const,
    }
    const near = screeningNoGoLedger({ targetChi: 4.01e-39, relativeTolerance: 0.01, routes: [{ ...independentRoute, dependencies: [...independentRoute.dependencies] }] })
    const far = screeningNoGoLedger({ targetChi: 9e-39, relativeTolerance: 0.01, routes: [{ ...independentRoute, dependencies: [...independentRoute.dependencies] }] })
    expect(near.output.routes[0]?.chi).toBe(far.output.routes[0]?.chi)
    expect(near.output.independentMatchingRouteIds).toEqual(['blind-route'])
    expect(far.output.independentMatchingRouteIds).toEqual([])
  })

  it('is deterministic, publishes all ten defaults, and enforces sweep bounds', () => {
    expect(Object.keys(EARTH_DOMAIN_DEFAULT_INPUTS)).toEqual([
      'EARTH-FLD-001',
      'EARTH-GRV-001',
      'EARTH-COS-001',
      'EARTH-COS-006',
      'EARTH-PLAN-005',
      'EARTH-PLAN-008',
      'EARTH-PLAN-009',
      'EARTH-PLAN-012',
      'EARTH-BIO-004',
      'EARTH-X-003',
    ])
    expect(waterPhaseCoherenceSweep()).toEqual(waterPhaseCoherenceSweep())
    expect(screeningNoGoLedger()).toEqual(screeningNoGoLedger())
    expect(() => waterPhaseCoherenceSweep({
      temperaturePoints: 512,
      pressureMinimumPascal: 1000,
      pressureMaximumPascal: 1e7,
      pressurePoints: 17,
    })).toThrow('temperaturePoints*pressurePoints must not exceed 8192')
    expect(() => compactnessKottlerInterface({ states: [] })).toThrow('states must contain 1 to 256 entries')
    expect(() => dnaGeometryLinkingAudit({ basePairCount: 0 })).toThrow('basePairCount must be an integer from 1 to 1000000000')
  })
})
