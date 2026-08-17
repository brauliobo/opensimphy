import { runEarthMethod, runEarthSimulation } from '../../src/engine/earth'
import { surgeryFloquetTls } from '../../src/engine/earth/particle/surgeryFloquetTls'

describe('EARTH-FLD-007 surgery Floquet TLS analogue', () => {
  it('keeps the Shirley product unitary and refuses a surgery-barrier proof', () => {
    const kernel = surgeryFloquetTls({ bias: 1, drive: 0.8, frequency: 1.2, stepsPerPeriod: 256 })
    expect(kernel.output.unitarityResidual).toBeLessThan(1e-11)
    expect(Number.isFinite(kernel.output.refinementResidual)).toBe(true)
    expect(kernel.output.surgeryBarrierProof).toBe(false)
    expect(kernel.output.analogueOnly).toBe(true)
    expect(kernel.output.claimedLatticePoints).toBe(201)
    expect(kernel.output.analogueHilbertDimension).toBe(2)
    expect(kernel.output.plainLanguage).toBe('toy two-level analogue, not Hopfion surgery')
    expect(kernel.output.barrierActionRelativeResidual).toBeLessThan(1e-15)
    expect(kernel.output.driveIsSchumannHz).toBe(false)
    expect(kernel.diagnostics.validatesEarthTheory).toBe(false)
  })

  it('emits blocked FLD-007-FLOQ with missing Thad/Nassim and a failed exact gate', () => {
    const kernel = surgeryFloquetTls()
    const row = kernel.predictionLedger.predictions[0]
    expect(kernel.predictionLedger).toMatchObject({
      schemaVersion: 'earth-prediction/v1',
      scientificStatus: 'blocked',
      validatesEarthTheory: false,
    })
    expect(row).toMatchObject({
      claimId: 'FLD-007-FLOQ',
      programId: 'EARTH-FLD-007',
      kernelId: 'floquetBenchmark',
      earth: { printed: 201, evaluated: 2 },
      sm: { value: 2 },
      thad: { value: null, status: 'missing' },
      nassim: { value: null, status: 'missing' },
      auditStatus: 'blocked',
      gate: { metric: 'exact', passIf: 'exact', verdict: 'fail' },
      plainLanguage: 'toy two-level analogue, not Hopfion surgery',
    })
    expect(row?.thad.formula).toContain('Physics Monastery')
    expect(row?.nassim.formula).toContain('Haramein')
    expect(kernel.predictionLedger.findings.some(({ text }) => text.includes('arithmetic-cx'))).toBe(true)
  })

  it('registers on FLD-007 without claiming EARTH validation', () => {
    const result = runEarthSimulation('EARTH-FLD-007', {
      bias: 1,
      drive: 0,
      frequency: 1.2,
      stepsPerPeriod: 128,
    })
    expect(result).toMatchObject({
      schemaVersion: 2,
      programId: 'EARTH-FLD-007',
      methodId: 'traditional-numerical-baseline-v1',
      validatesEarthTheory: false,
      provenance: { kind: 'comparison', validatesEarthTheory: false },
    })
    expect(result.output.unitarityResidual).toBeLessThan(1e-11)
    expect(result.output.undrivenQuasienergy).toBeCloseTo(0.5, 13)
    expect(result.predictions[0]).toMatchObject({
      claimId: 'FLD-007-FLOQ',
      auditStatus: 'blocked',
      thad: { status: 'missing' },
      nassim: { status: 'missing' },
    })
    expect(runEarthMethod('EARTH-FLD-007', 'traditional-numerical-baseline-v1', {}).validatesEarthTheory).toBe(false)
  })
})
