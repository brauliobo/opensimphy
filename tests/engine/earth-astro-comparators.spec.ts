import { EarthCancellationError } from '../../src/engine/earth/common'
import {
  EARTH_ASTRO_COMPARATOR_DEFAULTS,
  EARTH_ASTRO_COMPARATORS,
  baoToyCorrelation,
  boundedPeriodogram,
  canonicalScalarStressComponents,
  compactObjectFormulaContract,
  dynamoScalingComparator,
  flatLambdaCdmBackground,
  galaxyMorphologyPitchResidualAudit,
  habitableZoneMonotonicityAudit,
  hrMassLuminosityRegression,
  jeansEscapeComparator,
  laneEmdenPolytrope,
  lensingClusterFormulaContract,
  linearDiskDensityMode,
  linearGrowthComparator,
  newtonianHydrostaticSphere,
  orbitalRatioMultiplicityAudit,
  planetShellCircularityAudit,
  profileBoundaryRatioAudit,
  radialOscillatorModes,
  radialScalarProfileResidual,
  rotationCurveResidualAudit,
  schwarzschildPpnObservables,
  shearWaveBenchmark,
  stellarMassRadiusResidualAudit,
  toySachsWolfeSpectrum,
  waveDispersionComparator,
} from '../../src/engine/earth/astroComparators'

const REQUESTED_IDS = [
  'EARTH-GRV-003', 'EARTH-GRV-004', 'EARTH-GRV-005', 'EARTH-GRV-006',
  'EARTH-COS-002', 'EARTH-COS-003', 'EARTH-COS-004', 'EARTH-COS-005',
  'EARTH-PLAN-001', 'EARTH-PLAN-002', 'EARTH-PLAN-003', 'EARTH-PLAN-004', 'EARTH-PLAN-006', 'EARTH-PLAN-007', 'EARTH-PLAN-011',
  'EARTH-STAR-001', 'EARTH-STAR-002', 'EARTH-STAR-004', 'EARTH-STAR-005', 'EARTH-STAR-006', 'EARTH-STAR-007',
  'EARTH-GAL-001', 'EARTH-GAL-002', 'EARTH-GAL-003', 'EARTH-GAL-006', 'EARTH-GAL-007',
] as const

describe('bounded gravity and cosmology standard comparators', () => {
  it('covers GRV-003 through GRV-006 without treating scalar standards as EARTH gravity', () => {
    const profile = radialScalarProfileResidual()
    const stress = canonicalScalarStressComponents()
    const ppn = schwarzschildPpnObservables()
    const waves = waveDispersionComparator()

    expect(profile.label).toBe('EARTH-GRV-003')
    expect(profile.output.rmsResidual).toBeCloseTo(0, 15)
    expect(profile.diagnostics.topologyClaim).toBe(false)

    expect(stress.label).toBe('EARTH-GRV-004')
    expect(stress.output).toMatchObject({
      energyDensity: 0.28125,
      radialPressure: 0.03125,
      tangentialPressure: -0.03125,
    })

    expect(ppn.label).toBe('EARTH-GRV-005')
    expect(ppn.output.schwarzschildRadiusMetres).toBeGreaterThan(2_900)
    expect(ppn.output.schwarzschildRadiusMetres).toBeLessThan(3_000)
    expect(ppn.output.lightDeflectionRadians * 206_264.806).toBeCloseTo(1.75, 1)

    expect(waves.label).toBe('EARTH-GRV-006')
    expect(waves.output.series.every(({ phaseSpeed, groupSpeed }) => Math.abs(phaseSpeed * groupSpeed - 1) < 1e-14)).toBe(true)
    expect(waves.diagnostics.tensorPolarizationsDerived).toBe(false)
  })

  it('covers COS-002 through COS-005 with bounded textbook background and toy calculations', () => {
    const background = flatLambdaCdmBackground({ redshifts: [0, 1], quadratureSteps: 512 })
    const growth = linearGrowthComparator()
    const spectrum = toySachsWolfeSpectrum()
    const correlation = baoToyCorrelation()

    expect(background.label).toBe('EARTH-COS-002')
    expect(background.output.omegaLambda).toBeCloseTo(0.7, 15)
    expect(background.output.series[0]).toMatchObject({ redshift: 0, comovingDistanceMegaparsecs: 0, lookbackTimeGyr: 0 })
    expect(background.output.series[1]!.comovingDistanceMegaparsecs).toBeGreaterThan(3_000)

    expect(growth.label).toBe('EARTH-COS-003')
    expect(growth.output.normalizedGrowth).toBeGreaterThan(0.7)
    expect(growth.output.normalizedGrowth).toBeLessThan(0.9)
    expect(growth.output.logarithmicGrowthRate).toBeCloseTo(0.513, 2)

    expect(spectrum.label).toBe('EARTH-COS-004')
    expect(spectrum.output.series).toHaveLength(29)
    expect(spectrum.output.series.every(({ scaledPower }) => Math.abs(scaledPower - 2.1e-9 / 25) < 1e-24)).toBe(true)

    expect(correlation.label).toBe('EARTH-COS-005')
    expect(correlation.output.peakSeparationMegaparsecs).toBeGreaterThan(103)
    expect(correlation.output.peakSeparationMegaparsecs).toBeLessThan(106)
    expect(correlation.diagnostics.nonlinearEvolutionIncluded).toBe(false)
  })
})

describe('bounded planetary standard comparators', () => {
  it('covers PLAN-001 and PLAN-002 with explicit circularity and profile provenance', () => {
    const independent = planetShellCircularityAudit()
    const circular = planetShellCircularityAudit({
      observedRadiusMetres: 6,
      shellScaleMetres: 1,
      shellCount: 6,
      shellCountDerivedFromObservedRadius: true,
    })
    const boundary = profileBoundaryRatioAudit()

    expect(independent.label).toBe('EARTH-PLAN-001')
    expect(independent.output.eligibleAsIndependentResidual).toBe(true)
    expect(circular.output).toMatchObject({ circular: true, eligibleAsIndependentResidual: false, fractionalResidual: 0 })

    expect(boundary.label).toBe('EARTH-PLAN-002')
    expect(boundary.output.series[0]).toMatchObject({ ratioBelowToAbove: 1.2, relativeResidual: 0 })
    expect(boundary.diagnostics.authenticatedProfileBundled).toBe(false)
  })

  it('covers PLAN-003, PLAN-004, and PLAN-006 with closed standard formula invariants', () => {
    const sphere = newtonianHydrostaticSphere({ radiusMetres: 10, densityKgPerCubicMetre: 2, samples: 5 })
    const shear = shearWaveBenchmark({ lengthMetres: 100, densityKgPerCubicMetre: 4, shearModulusPascals: 100, modes: 3 })
    const dynamo = dynamoScalingComparator()

    expect(sphere.label).toBe('EARTH-PLAN-003')
    expect(sphere.output.series[0]).toMatchObject({ enclosedMassKg: 0, gravityMetresPerSecondSquared: 0 })
    expect(sphere.output.series.at(-1)!.pressurePascals).toBeCloseTo(0, 20)
    expect(sphere.diagnostics.tovSolved).toBe(false)

    expect(shear.label).toBe('EARTH-PLAN-004')
    expect(shear.output.shearSpeedMetresPerSecond).toBe(5)
    expect(shear.output.modes.map(({ frequencyHertz }) => frequencyHertz)).toEqual([0.025, 0.05, 0.075])

    expect(dynamo.label).toBe('EARTH-PLAN-006')
    expect(dynamo.output.rossbyNumber).toBeGreaterThan(0)
    expect(dynamo.output.magneticReynoldsNumber).toBeCloseTo(220, 14)
    expect(dynamo.output.elsasserNumber).toBeGreaterThan(0)
  })

  it('covers PLAN-007 and PLAN-011 with multiplicity and Jeans baselines', () => {
    const orbit = orbitalRatioMultiplicityAudit()
    const escape = jeansEscapeComparator()

    expect(orbit.label).toBe('EARTH-PLAN-007')
    expect(orbit.output.testedPowers).toBe(25)
    expect(orbit.output.series[0]).toMatchObject({ nearestExponent: 0, nearestPower: 1, logResidual: 0 })
    expect(orbit.output.series.every(({ multiplicityCorrectedScore }) => multiplicityCorrectedScore >= 0 && multiplicityCorrectedScore <= 1)).toBe(true)

    expect(escape.label).toBe('EARTH-PLAN-011')
    expect(escape.output.jeansParameter).toBeGreaterThan(1)
    expect(escape.output.mostProbableThermalSpeedMetresPerSecond).toBeGreaterThan(1_000)
    expect(escape.output.escapeFluxPerSquareMetrePerSecond).toBeGreaterThan(0)
    expect(escape.diagnostics.atmosphericProfileBundled).toBe(false)
  })
})

describe('bounded stellar standard comparators and user-data audits', () => {
  it('covers STAR-001, STAR-002, and STAR-004', () => {
    const massRadius = stellarMassRadiusResidualAudit()
    const polytrope = laneEmdenPolytrope()
    const hr = hrMassLuminosityRegression()

    expect(massRadius.label).toBe('EARTH-STAR-001')
    expect(massRadius.output.rootMeanSquareResidualDex).toBeCloseTo(0, 15)
    expect(massRadius.diagnostics.catalogBundled).toBe(false)

    expect(polytrope.label).toBe('EARTH-STAR-002')
    expect(polytrope.output.firstZeroXi).toBeCloseTo(Math.PI, 5)
    expect(polytrope.output.dimensionlessMass).toBeCloseTo(Math.PI, 4)
    expect(polytrope.diagnostics.nuclearEnergyGenerationIncluded).toBe(false)

    expect(hr.label).toBe('EARTH-STAR-004')
    expect(hr.output.exponent).toBeCloseTo(4, 14)
    expect(hr.output.normalization).toBeCloseTo(1, 14)
    expect(hr.output.heldOutRootMeanSquareErrorDex).toBeCloseTo(0, 14)
  })

  it('covers STAR-005, STAR-006, and STAR-007 without upgrading formula contracts to simulations', () => {
    const periodogram = boundedPeriodogram()
    const oscillations = radialOscillatorModes()
    const compact = compactObjectFormulaContract()

    expect(periodogram.label).toBe('EARTH-STAR-005')
    expect(periodogram.output.peakFrequency).toBeCloseTo(0.2, 2)
    expect(periodogram.output.frequencyTrials).toBe(256)
    expect(periodogram.diagnostics.redNoiseNullIncluded).toBe(false)

    expect(oscillations.label).toBe('EARTH-STAR-006')
    expect(oscillations.output.modes[1]!.angularFrequencyRadiansPerSecond).toBeCloseTo(
      2 * oscillations.output.modes[0]!.angularFrequencyRadiansPerSecond,
      14,
    )
    expect(oscillations.diagnostics.stellarProfileUsed).toBe(false)

    expect(compact.label).toBe('EARTH-STAR-007')
    expect(compact.output.outsideHorizon).toBe(true)
    expect(compact.output.compactness).toBeGreaterThan(0.1)
    expect(compact.output.surfaceRedshift).toBeGreaterThan(0)
    expect(compact.diagnostics.collapseSimulated).toBe(false)
  })
})

describe('bounded galactic contracts', () => {
  it('covers GAL-001, GAL-002, and GAL-003 as user-data or linear-standard work', () => {
    const morphology = galaxyMorphologyPitchResidualAudit()
    const disk = linearDiskDensityMode()
    const rotation = rotationCurveResidualAudit()

    expect(morphology.label).toBe('EARTH-GAL-001')
    expect(morphology.output.pitchRootMeanSquareErrorDegrees).toBeCloseTo(Math.sqrt(2.5), 14)
    expect(morphology.output.morphologyAccuracy).toBe(1)

    expect(disk.label).toBe('EARTH-GAL-002')
    expect(disk.output.stable).toBe(false)
    expect(disk.output.growthRatePerSecond).toBeGreaterThan(0)
    expect(disk.diagnostics.globalSpiralModeSolved).toBe(false)

    expect(rotation.label).toBe('EARTH-GAL-003')
    expect(rotation.output.rootMeanSquareResidualKilometresPerSecond).toBe(5)
    expect(rotation.output.chiSquared).toBe(2)
    expect(rotation.diagnostics.forceLawFitted).toBe(false)
  })

  it('covers GAL-006 and GAL-007 while preserving their source-contract limitations', () => {
    const zone = habitableZoneMonotonicityAudit()
    const lensing = lensingClusterFormulaContract()

    expect(zone.label).toBe('EARTH-GAL-006')
    expect(zone.output).toMatchObject({ monotonicDirection: 'decreasing', thresholdCrossings: 1, canDefineBoundedAnnulus: false })
    expect(zone.output.crossingRadiusKiloparsecs).toBeCloseTo(-5 * Math.log(0.2), 3)

    expect(lensing.label).toBe('EARTH-GAL-007')
    expect(lensing.output.pointMassDeflectionRadians).toBeGreaterThan(0)
    expect(lensing.output.einsteinAngleRadians).toBeGreaterThan(0)
    expect(lensing.output.virialVelocityDispersionMetresPerSecond).toBeGreaterThan(1e5)
    expect(lensing.diagnostics.jointLensingDynamicsFit).toBe(false)
  })
})

describe('comparison contracts', () => {
  it('retains the source blocker and rejects an EARTH validation claim for every blocked ID', () => {
    const results = [
      radialScalarProfileResidual(), canonicalScalarStressComponents(), schwarzschildPpnObservables(), waveDispersionComparator(),
      flatLambdaCdmBackground(), linearGrowthComparator(), toySachsWolfeSpectrum(), baoToyCorrelation(),
      planetShellCircularityAudit(), profileBoundaryRatioAudit(), newtonianHydrostaticSphere(), shearWaveBenchmark(),
      dynamoScalingComparator(), orbitalRatioMultiplicityAudit(), jeansEscapeComparator(),
      stellarMassRadiusResidualAudit(), laneEmdenPolytrope(), hrMassLuminosityRegression(), boundedPeriodogram(),
      radialOscillatorModes(), compactObjectFormulaContract(), galaxyMorphologyPitchResidualAudit(), linearDiskDensityMode(),
      rotationCurveResidualAudit(), habitableZoneMonotonicityAudit(), lensingClusterFormulaContract(),
    ]

    expect(Object.keys(EARTH_ASTRO_COMPARATOR_DEFAULTS)).toEqual(REQUESTED_IDS)
    expect(Object.keys(EARTH_ASTRO_COMPARATORS)).toEqual(REQUESTED_IDS)
    expect(results.map(({ label }) => label)).toEqual(REQUESTED_IDS)
    expect(results.every(({ diagnostics }) => (
      diagnostics.provenanceKind === 'comparison'
      && String(diagnostics.benchmarkLabel).includes('not-EARTH-derived')
      && typeof diagnostics.sourceBlocker === 'string'
      && diagnostics.sourceBlocker.length > 0
      && diagnostics.sourceBlockerRetained === true
      && diagnostics.earthModelStatus === 'blocked'
      && diagnostics.earthValidationClaim === false
      && diagnostics.validatesEarthTheory === false
      && diagnostics.physicalEquivalence === 'blocked'
      && diagnostics.deterministic === true
    ))).toBe(true)
  })

  it('enforces strict work/input bounds and cooperative cancellation', () => {
    expect(() => flatLambdaCdmBackground({ quadratureSteps: 33 })).toThrow('quadratureSteps must be even')
    expect(() => radialScalarProfileResidual({ radii: [0, 1], profile: [0] })).toThrow('profile must contain 2 to 4096 values')
    expect(() => profileBoundaryRatioAudit({ boundaries: [] })).toThrow('boundaries must contain 1 to 1024 entries')
    expect(() => boundedPeriodogram({ times: [0, 1, 2, 3], values: [1, 1, 1, 1] })).toThrow('non-zero variance')
    expect(() => lensingClusterFormulaContract({ lensDistanceMetres: 2, sourceDistanceMetres: 1 })).toThrow('lensDistanceMetres')

    const cancelled = { isCancelled: () => true }
    expect(() => radialScalarProfileResidual({}, cancelled)).toThrow(EarthCancellationError)
    expect(() => flatLambdaCdmBackground({}, cancelled)).toThrow(EarthCancellationError)
    expect(() => linearGrowthComparator({}, cancelled)).toThrow(EarthCancellationError)
    expect(() => toySachsWolfeSpectrum({}, cancelled)).toThrow(EarthCancellationError)
    expect(() => baoToyCorrelation({}, cancelled)).toThrow(EarthCancellationError)
    expect(() => newtonianHydrostaticSphere({}, cancelled)).toThrow(EarthCancellationError)
    expect(() => shearWaveBenchmark({}, cancelled)).toThrow(EarthCancellationError)
    expect(() => boundedPeriodogram({}, cancelled)).toThrow(EarthCancellationError)
    expect(() => habitableZoneMonotonicityAudit({}, cancelled)).toThrow(EarthCancellationError)
  })
})
