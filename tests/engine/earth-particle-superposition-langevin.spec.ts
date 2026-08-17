import {
  FLD_005_CLAIM_ID,
  LAMBDA_TILDE_0,
  PRINTED_LAMBDA_0,
  PRINTED_NU,
  earthLangevinNu,
  earthLangevinSlope,
  superpositionLangevin,
} from '../../src/engine/earth/particle/superpositionLangevin'
import { getDefaultEarthMethodId, runEarthMethod } from '../../src/engine/earth'

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

describe('EARTH-FLD-005 Langevin FDT ledger', () => {
  const kernel = superpositionLangevin(inputs, { seed: 991 })
  const result = runEarthMethod('EARTH-FLD-005', getDefaultEarthMethodId('EARTH-FLD-005'), inputs, { seed: 991 })

  it('keeps the runEarthMethod envelope and does not validate EARTH', () => {
    expect(result).toMatchObject({
      schemaVersion: 2,
      programId: 'EARTH-FLD-005',
      methodId: 'traditional-numerical-baseline-v1',
      status: 'completed',
      validatesEarthTheory: false,
      provenance: { kind: 'comparison', validatesEarthTheory: false },
    })
    expect(result.diagnostics.scheme).toBe('implicit-backward-euler')
    expect(result.diagnostics.unconditionallyStable).toBe(true)
    expect(result.diagnostics.bornRuleDerived).toBe(false)
    expect(result.output.bornRuleDerived).toBe(false)
  })

  it('pins EARTH (ν,μ) as ν=λ₀√5 and μ=λ̃₀ with slope 2νkT/(μ ξ³)', () => {
    const nu = earthLangevinNu(PRINTED_LAMBDA_0)
    const slope = earthLangevinSlope(nu, LAMBDA_TILDE_0)
    expect(result.output.lambda0).toBe(PRINTED_LAMBDA_0)
    expect(result.output.lambdaTilde0).toBeCloseTo((4 * Math.PI) ** 3, 12)
    expect(result.output.nu).toBeCloseTo(PRINTED_LAMBDA_0 * Math.sqrt(5), 12)
    expect(result.output.mu).toBe(result.output.lambdaTilde0)
    expect(result.output.analyticSlope).toBeCloseTo(slope, 12)
    expect(result.output.printedNu).toBe(PRINTED_NU)
    expect(result.output.lambda0EqualsLambdaTilde0).toBe(false)
    expect(result.output.sourceEulerUnstable).toBe(true)
    expect(result.output.continuumNoiseDefined).toBe(false)
  })

  it('emits FLD-005-VAR with SM FDT residual and Thad/Nassim missing', () => {
    const row = result.predictions[0]
    expect(result.predictions).toHaveLength(1)
    expect(row).toMatchObject({
      claimId: 'FLD-005-VAR',
      programId: 'EARTH-FLD-005',
      kernelId: 'superpositionLangevin',
      observable: 'FDT variance',
      auditStatus: 'blocked',
      gate: { verdict: 'fail' },
      thad: { value: null, status: 'missing' },
      nassim: { value: null, status: 'missing' },
    })
    expect(row?.claimId).toBe(FLD_005_CLAIM_ID)
    expect(row?.sm.value).toBe(result.output.expectedVariance)
    expect(row?.sm.uncertainty).toBe(result.output.varianceRelativeResidual)
    expect(row?.earth.evaluated).toBe(result.output.analyticSlope)
    expect(row?.thad.formula).toContain('Physics Monastery')
    expect(row?.nassim.formula).toContain('Haramein')
    expect(row?.residual.thadVsSm).toBeNull()
    expect(row?.residual.nassimVsSm).toBeNull()
    expect(JSON.stringify(result)).not.toMatch(/Born rule derived|P\(\+\)|P\(−\)/)
  })

  it('keeps the implicit FDT comparator testable as software', () => {
    expect(result.output.expectedVariance).toBeGreaterThan(0)
    expect(result.output.varianceRelativeResidual).toBeLessThan(0.35)
    expect(result.output.correlation[0]).toBeCloseTo(1, 14)
    expect(kernel.output.expectedVariance).toBe(result.output.expectedVariance)
    expect(kernel.predictionLedger?.validatesEarthTheory).toBe(false)
    expect(kernel.predictionLedger?.scientificStatus).toBe('blocked')
  })
})
