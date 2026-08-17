import {
  CLAIMED_DENSITY_EXPONENT,
  COLLAPSE_TIME_PLAIN_LANGUAGE,
  DELTA_CHI_ALGEBRAIC,
  DELTA_CHI_PRINTED,
  FLD_006_CLAIM_ID,
  decoherenceCollapseTime,
  earthCoherenceLength,
  earthCollapseTime,
} from '../../src/engine/earth/particle/decoherenceCollapseTime'
import {
  LAMBDA_TILDE_0,
  PRINTED_LAMBDA_0,
  earthLangevinNu,
} from '../../src/engine/earth/particle/superpositionLangevin'
import { GOLDEN_RATIO } from '../../src/engine/earth/foundations'
import { getDefaultEarthMethodId, runEarthMethod } from '../../src/engine/earth'

describe('EARTH-FLD-006 collapse-time scaling ledger', () => {
  const kernel = decoherenceCollapseTime()
  const result = runEarthMethod('EARTH-FLD-006', getDefaultEarthMethodId('EARTH-FLD-006'), {})

  it('keeps the runEarthMethod envelope and does not validate EARTH', () => {
    expect(result).toMatchObject({
      schemaVersion: 2,
      programId: 'EARTH-FLD-006',
      methodId: 'traditional-numerical-baseline-v1',
      status: 'completed',
      validatesEarthTheory: false,
      provenance: { kind: 'comparison', validatesEarthTheory: false },
    })
    expect(result.output.validatesEarthTheory).toBe(false)
    expect(result.output.muNuIndependent).toBe(false)
    expect(kernel.predictionLedger?.validatesEarthTheory).toBe(false)
    expect(kernel.predictionLedger?.scientificStatus).toBe('blocked')
  })

  it('reuses FLD-005 (ν,μ) pins and emits both δχ values', () => {
    const nu = earthLangevinNu(PRINTED_LAMBDA_0)
    expect(result.output.lambda0).toBe(PRINTED_LAMBDA_0)
    expect(result.output.mu).toBe(LAMBDA_TILDE_0)
    expect(result.output.nu).toBeCloseTo(nu, 12)
    expect(result.output.lambda0EqualsLambdaTilde0).toBe(false)
    expect(result.output.deltaChiPrinted).toBe(DELTA_CHI_PRINTED)
    expect(result.output.deltaChiAlgebraic).toBeCloseTo(1 / Math.sqrt(3 * GOLDEN_RATIO ** 2), 12)
    expect(result.output.deltaChiAlgebraic).toBeCloseTo(0.3568, 3)
    expect(DELTA_CHI_ALGEBRAIC).not.toBeCloseTo(DELTA_CHI_PRINTED, 2)
    expect(result.output.collapseTimeAlgebraic / result.output.collapseTimePrinted).toBeCloseTo(
      (DELTA_CHI_ALGEBRAIC / DELTA_CHI_PRINTED) ** 2,
      12,
    )
    expect(earthCoherenceLength(8, 1)).toBeCloseTo(0.5, 12)
    expect(earthCollapseTime(DELTA_CHI_PRINTED, LAMBDA_TILDE_0, 1, 1, nu)).toBe(
      result.output.collapseTimePrinted,
    )
  })

  it('fits t_c ∝ ρ^{-1}/T against the printed ρ^{-1/3} claim', () => {
    expect(result.output.claimedDensityExponent).toBe(CLAIMED_DENSITY_EXPONENT)
    expect(result.output.fittedDensityExponent).toBeCloseTo(-1, 12)
    expect(result.output.fittedDensityExponent).not.toBeCloseTo(-1 / 3, 2)
    expect(result.output.fittedTemperatureExponent).toBeCloseTo(-1, 12)
    expect(result.output.claimedTemperatureExponent).toBe(-1)
    expect(result.output.points.length).toBeGreaterThan(0)
    expect(result.output.points.every(({ collapseTimePrinted, collapseTimeAlgebraic }) => (
      collapseTimePrinted > 0 && collapseTimeAlgebraic > collapseTimePrinted
    ))).toBe(true)
  })

  it('emits blocked FLD-006-TC with missing Thad/Nassim and SM not a δχ law', () => {
    const row = result.predictions[0]
    expect(result.predictions).toHaveLength(1)
    expect(row).toMatchObject({
      claimId: FLD_006_CLAIM_ID,
      programId: 'EARTH-FLD-006',
      kernelId: 'decoherenceCollapseTime',
      observable: 't_c scaling',
      auditStatus: 'blocked',
      earth: { printed: -1 / 3 },
      sm: { value: null },
      thad: { value: null, status: 'missing' },
      nassim: { value: null, status: 'missing' },
      gate: { verdict: 'fail' },
      plainLanguage: COLLAPSE_TIME_PLAIN_LANGUAGE,
    })
    expect(row?.earth.evaluated).toBeCloseTo(result.output.fittedDensityExponent, 12)
    expect(row?.sm.source).toContain('not this δχ law')
    expect(row?.thad.formula).toContain('Physics Monastery')
    expect(row?.nassim.formula).toContain('τ_p=r_p/c')
    expect(row?.residual.thadVsSm).toBeNull()
    expect(row?.residual.nassimVsSm).toBeNull()
    expect(kernel.output.claimId).toBe(FLD_006_CLAIM_ID)
  })
})
