import { standingWaveSpectrumAudit } from '../../src/engine/earth/audits'
import {
  CHEM6_CHIRAL_LINES_CLAIM_IDS,
  CHEM6_CHIRAL_LINES_METHOD_ID,
  DEFAULT_CHEM6_CHIRAL_LINES_INPUTS,
  chem6ChiralLines,
} from '../../src/engine/earth/particle/chem6ChiralLines'
import { EARTH_PREDICTION_SCHEMA } from '../../src/engine/earth/particle/ledger'
import { getDefaultEarthMethodId, runEarthMethod } from '../../src/engine/earth'

describe('EARTH-PRT-001 CHEM-6 chiral line ledger', () => {
  const kernel = chem6ChiralLines()
  const result = runEarthMethod('EARTH-PRT-001', CHEM6_CHIRAL_LINES_METHOD_ID, DEFAULT_CHEM6_CHIRAL_LINES_INPUTS)
  const byId = Object.fromEntries(result.predictions.map((row) => [row.claimId, row]))

  it('keeps the runEarthMethod envelope and does not validate EARTH', () => {
    expect(result).toMatchObject({
      schemaVersion: 2,
      programId: 'EARTH-PRT-001',
      methodId: 'chem6-chiral-lines-v1',
      status: 'completed',
      validatesEarthTheory: false,
    })
    expect(result.predictionLedger).toMatchObject({
      schemaVersion: EARTH_PREDICTION_SCHEMA,
      mapping: 'four-program-ledger',
      scientificStatus: 'audit',
      validatesEarthTheory: false,
    })
    expect(result.diagnostics.validatesEarthTheory).toBe(false)
    expect(result.diagnostics.acquiredHitranBytes).toBe(0)
    expect(result.diagnostics.g4Claimed).toBe(false)
    expect(kernel.predictions).toEqual(result.predictions)
    expect(getDefaultEarthMethodId('EARTH-PRT-001')).toBe('earth-source-reproduction-v1')
  })

  it('recomputes the printed CHEM-6 examples and keeps the large SPEC-001 failures', () => {
    const printed = Object.fromEntries(result.output.modes.map((mode) => [mode.claimId, mode.printed]))
    expect(printed).toEqual({ 'SP-01': 3030, 'SP-02': 1650, 'SP-03': 2140, 'SP-04': 287, 'SP-05': 8047.8 })
    expect(result.output.modes[0]?.unit).toBe('cm^-1')
    expect(result.output.modes[0]?.evaluated).toBeGreaterThan(900_000)
    expect(result.output.modes[0]?.printedRelativeResidual).toBeGreaterThan(100)
    expect(result.output.modes.every((mode) => mode.printedRelativeResidual > 0.5)).toBe(true)

    const spec001 = standingWaveSpectrumAudit()
    expect(spec001.output.modes[0]?.claimedValue).toBe(3030)
    expect(spec001.output.modes[0]?.printedWavenumberPerCm).toBeGreaterThan(900_000)
    expect(spec001.output.modes[0]?.claimedRelativeResidual).toBeGreaterThan(100)
    expect(spec001.output.findings.every(({ status }) => status === 'failure')).toBe(true)
    expect(result.output.modes[0]?.evaluated).toBeCloseTo(spec001.output.modes[0]!.printedWavenumberPerCm, 6)
  })

  it('falsifies all five lines without repairing printed values or claiming G4', () => {
    expect(CHEM6_CHIRAL_LINES_CLAIM_IDS.every((id) => byId[id])).toBe(true)
    for (const id of CHEM6_CHIRAL_LINES_CLAIM_IDS) {
      expect(byId[id], id).toMatchObject({
        auditStatus: 'falsified',
        gate: { verdict: 'fail', passIf: '<=1e-8' },
        discrepancy: 'arithmetic-cx / unit-inconsistent',
        datasetIds: [],
      })
      expect(byId[id]?.plainLanguage).toBe('printed CHEM-6 lines do not come out of the printed ν_m formula')
      expect(byId[id]?.sm.source).toContain('HITRAN/NIST')
      expect(byId[id]?.sm.source).toContain('0 acquired bytes')
      expect(byId[id]?.sm.source).toContain('not G4')
    }
    expect(byId['SP-01']?.earth.printed).toBe(3030)
    expect(byId['SP-01']?.earth.evaluated).toBeGreaterThan(900_000)
    expect(byId['SP-04']?.earth.printed).toBe(287)
    expect(byId['SP-04']?.unit).toBe('nm')
    expect(byId['SP-05']?.earth.printed).toBe(8047.8)
    expect(byId['SP-05']?.unit).toBe('eV')
  })

  it('marks Thad missing and Nassim as the E=hc/λ identity only', () => {
    for (const id of CHEM6_CHIRAL_LINES_CLAIM_IDS) {
      expect(byId[id]?.thad).toMatchObject({ value: null, status: 'missing' })
      expect(byId[id]?.thad.formula).toContain('Δν_Cs')
      expect(byId[id]?.nassim.status).toBe('identity')
      expect(byId[id]?.nassim.formula).toContain('E=hc/λ')
      expect(byId[id]?.nassim.status).not.toBe('prediction')
    }
    expect(result.predictions.every((row) => row.thad.status === 'missing')).toBe(true)
    expect(result.predictions.every((row) => row.nassim.status === 'identity')).toBe(true)
    expect(result.predictionLedger?.blockers.some((text) => text.includes('Δν_Cs'))).toBe(true)
    expect(result.predictionLedger?.blockers.some((text) => text.includes('0 acquired bytes'))).toBe(true)
  })
})
