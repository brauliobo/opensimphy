import {
  DEFAULT_ELECTRON_BOHR_RYDBERG_AUDIT_INPUTS,
  electronBohrRydbergAudit,
} from '../../src/engine/earth/audits'
import { relativeError } from '../../src/engine/earth/common'
import { ELECTRON_BOHR_RYDBERG_CLAIM_IDS } from '../../src/engine/earth/particle/electronBohrRydberg'
import { EARTH_PREDICTION_SCHEMA } from '../../src/engine/earth/particle/ledger'
import { getDefaultEarthMethodId, runEarthMethod } from '../../src/engine/earth'

describe('EARTH-PRT-001 electron Bohr Rydberg ledger', () => {
  const kernel = electronBohrRydbergAudit()
  const result = runEarthMethod('EARTH-PRT-001', getDefaultEarthMethodId('EARTH-PRT-001'), DEFAULT_ELECTRON_BOHR_RYDBERG_AUDIT_INPUTS)
  const byId = Object.fromEntries(result.predictions.map((row) => [row.claimId, row]))

  it('keeps the runEarthMethod envelope and does not validate EARTH', () => {
    expect(result).toMatchObject({
      schemaVersion: 2,
      programId: 'EARTH-PRT-001',
      methodId: 'earth-source-reproduction-v1',
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
    expect(kernel.predictions).toEqual(result.predictions)
  })

  it('keeps the existing PRT-001 audit fields and printed CODATA-looking outputs', () => {
    expect(result.output.dependencies.actualPhi18).toBeCloseTo(5777.999826929732, 10)
    expect(result.output.dependencies.computedAlphaInverse).toBeCloseTo(2960.9266845258185, 10)
    expect(result.output.dependencies.claimedPhi18).toBe(2584)
    expect(result.output.bohr.unit).toBe('m')
    expect(result.output.electron.unit).toBe('MeV/c^2')
    expect(result.output.rydberg.unit).toBe('m^-1')
    expect(result.output.bohr.sourcePrintedResult).toBe(5.29177210903e-11)
    expect(result.output.electron.sourcePrintedResult).toBe(0.5109989461)
    expect(result.output.electron.actualDependencies).toBeLessThan(1e-5)
    expect(result.output.rydberg.sourcePrintedResult).toBe(10_973_731.56816)
    expect(result.output.findings.find(({ id }) => id === 'canonical-output-circularity')?.status).toBe('failure')
  })

  it('falsifies φ¹⁸, α, a₀, m_e, and R_∞ without repairing printed CODATA-looking outputs', () => {
    expect(ELECTRON_BOHR_RYDBERG_CLAIM_IDS.every((id) => byId[id])).toBe(true)
    for (const id of ELECTRON_BOHR_RYDBERG_CLAIM_IDS) {
      expect(byId[id], id).toMatchObject({ auditStatus: 'falsified', gate: { verdict: 'fail', passIf: '<=1e-8' } })
    }
    expect(byId['PRT-001-PHI18']?.earth.printed).toBe(2584)
    expect(byId['PRT-001-PHI18']?.earth.evaluated).toBeCloseTo(5777.999826929732, 10)
    expect(byId['PRT-001-ALPHA']?.earth.evaluated).toBeCloseTo(1 / 2960.9266845258185, 12)
    expect(byId['PRT-001-A0']?.earth.printed).toBe(5.29177210903e-11)
    expect(byId['PRT-001-A0']?.earth.evaluated).toBeCloseTo(2.5662350806112704e-9, 12)
    expect(relativeError(byId['PRT-001-A0']?.earth.evaluated as number, 5.29177210544e-11)).toBeGreaterThan(1)
    expect(byId['PRT-001-ME']?.earth.evaluated).toBeLessThan(1e-35)
    expect(byId['PRT-001-RYD']?.earth.printed).toBe(10_973_731.56816)
    expect(byId['PRT-001-RYD']?.earth.evaluated).toBeLessThan(1)
    expect(relativeError(byId['PRT-001-RYD']?.earth.evaluated as number, 10_973_731.568157)).toBeGreaterThan(1e-8)
  })

  it('labels Thad α as supplement and a₀ / m_e / R_∞ as repro', () => {
    expect(byId['PRT-001-ALPHA']?.thad).toMatchObject({ value: 7.297352572955e-3, status: 'prediction' })
    expect(byId['PRT-001-ALPHA']?.thad.formula).toContain('supplement')
    expect(byId['PRT-001-A0']?.thad).toMatchObject({ value: 5.29177210521e-11, status: 'repro' })
    expect(byId['PRT-001-ME']?.thad).toMatchObject({ value: 9.10938371014e-31, status: 'repro' })
    expect(byId['PRT-001-RYD']?.thad).toMatchObject({ value: 1.09737315681100e7, status: 'repro' })
    expect(byId['PRT-001-PHI18']?.thad.status).toBe('missing')
    expect(byId['PRT-001-E']?.thad).toMatchObject({ value: 1.60217657406e-19, status: 'prediction' })
    expect(byId['PRT-001-RE']?.thad).toMatchObject({ value: 2.81794032699e-15, status: 'repro' })
    expect(byId['PRT-001-RE']?.discrepancy).toContain('+5.00σ')
    expect(byId['PRT-001-GE']?.thad).toMatchObject({ value: -2.00231930436065, status: 'repro' })
    expect(byId['PRT-001-GE']?.earth).toMatchObject({ printed: -2, evaluated: -2 })
    expect(byId['PRT-001-GE']?.auditStatus).toBe('falsified')
  })

  it('marks Nassim m_e as identity, not a prediction', () => {
    expect(byId['PRT-001-ME']?.nassim.status).toBe('identity')
    expect(byId['PRT-001-ME']?.nassim.formula).toContain('ħ/(c α a_0)')
    expect(byId['PRT-001-ME']?.nassim.formula).toContain('circular')
    expect(byId['PRT-001-ME']?.nassim.status).not.toBe('prediction')
    expect(byId['PRT-001-ALPHA']?.nassim.status).toBe('missing')
    expect(byId['PRT-001-A0']?.nassim.status).toBe('missing')
    expect(byId['PRT-001-RYD']?.nassim.status).toBe('missing')
    expect(result.predictions.every((row) => row.nassim.status !== 'prediction')).toBe(true)
  })
})
