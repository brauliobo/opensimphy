import {
  cosmologyHorizonCountCalculator,
  plateSeismicFormulaAudit,
  pulsationHarmonicSourceAudit,
  smbhRatioResidualAudit,
  stellarLifetimeFormulaSweep,
  supernovaNeutronStarSourceAudit,
  tullyFisherRegression,
} from '../../src/engine/earth/astroAudits'

describe('EARTH bounded astrophysical literal audits', () => {
  it('normalizes radius/diameter and proper/comoving inputs while exposing circularity', () => {
    const lightYearMetres = 9.4607304725808e15
    const common = {
      distanceConvention: 'proper' as const,
      scaleFactor: 1,
      baryonMassDensityKgPerCubicMetre: 4.2e-28,
      densityConvention: 'proper' as const,
      distanceDerivedFromDensity: true,
      densityDerivedFromTargetCount: true,
    }
    const radius = cosmologyHorizonCountCalculator({
      ...common,
      horizonDistanceMetres: 46.5e9 * lightYearMetres,
      horizonExtent: 'radius',
    })
    const diameter = cosmologyHorizonCountCalculator({
      ...common,
      horizonDistanceMetres: 93e9 * lightYearMetres,
      horizonExtent: 'diameter',
    })

    expect(radius.output.baryonCount).toBeCloseTo(diameter.output.baryonCount, 10)
    expect(radius.output.baryonCount).toBeGreaterThan(8e79)
    expect(radius.output.baryonCount).toBeLessThan(1e80)
    expect(radius.output.circularityFlags).toMatchObject({
      distanceDerivedFromDensity: true,
      densityDerivedFromTargetCount: true,
      anyCircularInput: true,
    })
    expect(radius.output.series.map(({ scenario }) => scenario)).toEqual(['lower', 'central', 'upper'])
    expect(radius.diagnostics).toMatchObject({
      provenanceKind: 'comparison',
      benchmarkLabel: 'comparison',
      validatesTheory: false,
      validationClaim: 'none',
    })
  })

  it('reproduces the plate and seismic arithmetic instead of the printed results', () => {
    const result = plateSeismicFormulaAudit()
    const shear = result.output.formulas.find(({ id }) => id === 'shear-speed')!
    const seismic = result.output.formulas.find(({ id }) => id === 'mantle-seismic-speed')!
    const plateCount = result.output.formulas.find(({ id }) => id === 'plate-count')!
    const plateSpeed = result.output.formulas.find(({ id }) => id === 'plate-speed')!

    expect(shear.literalValue).toBeCloseTo(3 * 0.15 * 299_792_458 / (2 * Math.PI), 8)
    expect(shear.arithmeticMatches).toBe(false)
    expect(seismic.literalValue).toBeCloseTo(0.0021471, 6)
    expect(seismic.sourceClaimedValue).toBe(4_500)
    expect(plateCount.literalValue).toBeCloseTo((1 + Math.sqrt(5)) / 2, 14)
    expect(plateCount.sourceClaimedValue).toBe(15.95)
    expect(plateSpeed.literalValue).toBeGreaterThan(1e18)
    expect(result.output.series).toHaveLength(8)
  })

  it('shows that the literal stellar lifetime law increases with mass', () => {
    const result = stellarLifetimeFormulaSweep({ samples: 16 })
    const proxima = result.output.claims.find(({ label }) => label === 'proxima-source-example')!
    const rigel = result.output.claims.find(({ label }) => label === 'rigel-source-example')!

    expect(result.output.monotonicDirection).toBe('increasing')
    expect(proxima.literalLifetimeGyr).toBeLessThan(10)
    expect(proxima.claimedLifetimeGyr).toBe(4_000)
    expect(rigel.literalLifetimeGyr).toBeGreaterThan(1e8)
    expect(rigel.claimedLifetimeGyr).toBe(0.008)
    expect(proxima.arithmeticMatches).toBe(false)
    expect(rigel.arithmeticMatches).toBe(false)
    expect(result.output.series).toHaveLength(16)
  })

  it('retains the pulsation formula dimensions and flags observed-period harmonic selection', () => {
    const result = pulsationHarmonicSourceAudit()

    expect(result.output.dimensionalUnitFromSIInputs).toBe('kg^1/2')
    expect(result.output.dimensionallyValidAsPeriod).toBe(false)
    expect(result.output.series).toHaveLength(2)
    expect(result.output.series.every(({ targetLeakage }) => targetLeakage)).toBe(true)
    expect(result.output.series.every(({ relativeResidual }) => relativeResidual !== null && relativeResidual > 1e6)).toBe(true)
    expect(result.diagnostics).toMatchObject({
      provenanceKind: 'reproduction',
      targetLeakageAssignments: 2,
      externalCatalogUsed: false,
      validatesTheory: false,
    })
  })

  it('exposes the missing neutron-star projection and kick-speed arithmetic failure', () => {
    const result = supernovaNeutronStarSourceAudit()
    const radius = result.output.formulas.find(({ id }) => id === 'neutron-star-radius')!
    const kick = result.output.formulas.find(({ id }) => id === 'kick-speed')!

    expect(radius.literalValue).toBeCloseTo(0.15e-15 * ((1 + Math.sqrt(5)) / 2) ** 6, 28)
    expect(radius.literalValue).toBeLessThan(1e-14)
    expect(radius.sourceClaimedValue).toBe(11_800)
    expect(radius.arithmeticMatches).toBe(false)
    expect(kick.literalValue / 1_000).toBeGreaterThan(20_000)
    expect(kick.sourceClaimedValue / 1_000).toBe(430)
    expect(kick.arithmeticMatches).toBe(false)
    expect(result.output.thresholds.derivedBySourceFormula).toBe(false)
    expect(result.output.series).toHaveLength(3)
  })
})

describe('EARTH user-supplied galactic comparisons', () => {
  it('fits only training rows in log space and scores held-out rows', () => {
    const result = tullyFisherRegression({
      data: [
        { id: 'train-a', velocityKilometresPerSecond: 10, baryonicMassSolar: 1e6, heldOut: false },
        { id: 'train-b', velocityKilometresPerSecond: 100, baryonicMassSolar: 1e10, heldOut: false, targetLeakage: true },
        { id: 'test', velocityKilometresPerSecond: 1_000, baryonicMassSolar: 1e14, heldOut: true },
      ],
    })

    expect(result.output.slope).toBeCloseTo(4, 14)
    expect(result.output.intercept).toBeCloseTo(2, 14)
    expect(result.output.trainingScatterDex).toBeCloseTo(0, 14)
    expect(result.output.heldOutRootMeanSquareErrorDex).toBeCloseTo(0, 14)
    expect(result.output.series.find(({ id }) => id === 'test')).toMatchObject({ heldOut: true, residualDex: 0 })
    expect(result.diagnostics).toMatchObject({
      provenanceKind: 'comparison',
      benchmarkLabel: 'comparison',
      targetLeakageRecords: 1,
      bundledMockData: false,
      validatesTheory: false,
      validationClaim: 'none',
    })
    expect(result.output.validationClaim).toBe('none')
  })

  it('uses frozen phi^-18 and reports the source ratio error without bundled records', () => {
    const phi = (1 + Math.sqrt(5)) / 2
    const result = smbhRatioResidualAudit({
      data: [
        {
          id: 'host-a',
          hostMassSolar: 1e12,
          blackHoleMassSolar: 1e9,
          hostMassDerivedFromBlackHoleMass: true,
        },
      ],
    })

    expect(result.output.frozenPhiMinus18).toBeCloseTo(phi ** -18, 16)
    expect(result.output.frozenPhiMinus18).toBeCloseTo(1 / 5_777.999826929732, 16)
    expect(result.output.sourceClaimedRatio).toBe(0.0073)
    expect(result.output.sourceRatioRelativeResidual).toBeGreaterThan(0.9)
    expect(result.output.series[0]).toMatchObject({
      predictedBlackHoleMassSolar: expect.closeTo(phi ** -18 * 1e12, 6),
      targetLeakage: true,
    })
    expect(result.output.validationClaim).toBe('none')
    expect(result.diagnostics).toMatchObject({ bundledMockData: false, targetLeakageRecords: 1, validatesTheory: false })
  })

  it('requires supplied data and rejects non-finite or unbounded work', () => {
    expect(() => tullyFisherRegression(undefined as never)).toThrow('inputs are required')
    expect(() => smbhRatioResidualAudit(undefined as never)).toThrow('inputs are required')
    expect(() => tullyFisherRegression({
      data: [
        { id: 'a', velocityKilometresPerSecond: 10, baryonicMassSolar: 1, heldOut: false },
        { id: 'b', velocityKilometresPerSecond: Number.NaN, baryonicMassSolar: 2, heldOut: false },
      ],
    })).toThrow('data[1].velocityKilometresPerSecond must be finite')
    expect(() => pulsationHarmonicSourceAudit({
      harmonics: [{ id: 'bad', harmonic: 33 }],
    })).toThrow('harmonics[0].harmonic must be an integer from -32 to 32')
    expect(() => plateSeismicFormulaAudit({ harmonics: 1_025 })).toThrow('harmonics must be an integer from 1 to 1024')
    expect(() => cosmologyHorizonCountCalculator({
      horizonDistanceMetres: Infinity,
      horizonExtent: 'radius',
      distanceConvention: 'proper',
      scaleFactor: 1,
      baryonMassDensityKgPerCubicMetre: 1,
      densityConvention: 'proper',
    })).toThrow('horizonDistanceMetres must be finite')
  })
})
