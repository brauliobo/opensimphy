import {
  DEFAULT_DERRICK_SCALAR_GATE_INPUTS,
  derrickScalarGate,
} from '../../src/engine/earth/particle/derrickScalarGate'
import { EARTH_PREDICTION_SCHEMA } from '../../src/engine/earth/particle/ledger'
import { getDefaultEarthMethodId, runEarthMethod } from '../../src/engine/earth'

const LAMBDA_ALGEBRAIC = (4 * Math.PI) ** 3

describe('EARTH-FLD-001 Derrick topology gate', () => {
  const kernel = derrickScalarGate()
  const result = runEarthMethod('EARTH-FLD-001', getDefaultEarthMethodId('EARTH-FLD-001'), DEFAULT_DERRICK_SCALAR_GATE_INPUTS)

  it('keeps the runEarthMethod envelope and does not validate EARTH', () => {
    expect(result).toMatchObject({
      schemaVersion: 2,
      programId: 'EARTH-FLD-001',
      methodId: 'earth-source-reproduction-v1',
      status: 'completed',
      validatesEarthTheory: false,
    })
    expect(result.output.validatesEarthTheory).toBe(false)
    expect(result.output.schemaVersion).toBe(EARTH_PREDICTION_SCHEMA)
    expect(result.output.scientificStatus).toBe('audit')
    expect(result.output.plainLanguage).toBe('this field cannot carry Hopfions')
    expect(result.diagnostics.validatesEarthTheory).toBe(false)
    expect(result.diagnostics.hopfLabelForbidden).toBe(true)
  })

  it('keeps the existing 3D Derrick collapse and forbids a Hopf label', () => {
    expect(result.output.finding).toBe('collapse-to-zero-size')
    expect(result.output.stationaryLambda).toBeNull()
    expect(result.output.formula).toBe('E(lambda)=lambda*E_gradient+lambda^3*E_potential')
    expect(result.output.derivativeAtOne).toBe(4)
    expect(result.diagnostics.finiteSizeMinimum).toBe(false)
    expect(result.diagnostics.derivativeStrictlyPositive).toBe(true)
    expect(result.output.homotopy).toEqual({ pi3OfS1: 0, hopfCharge: 0, hopfLabelForbidden: true })
    expect(result.output.hardGates.hopfSector).toBe(false)
    expect(result.output.flags).toEqual(expect.arrayContaining(['topological-gate', 'missing-operator']))
  })

  it('emits earth-prediction/v1 rows with Thad and Nassim missing-operator slots', () => {
    const rows = result.predictions
    expect(rows.map(({ claimId }) => claimId)).toEqual(['FLD-001-DERRICK', 'FLD-001-PI3'])
    expect(result.output.predictions).toEqual(rows)
    for (const row of rows) {
      expect(row.thad).toMatchObject({ value: null, status: 'missing' })
      expect(row.nassim).toMatchObject({ value: null, status: 'missing' })
      expect(row.thad.formula).toContain('field action')
      expect(row.nassim.formula).toContain('field action')
      expect(row.auditStatus).toBe('falsified')
      expect(row.gate.verdict).toBe('fail')
      expect(row.plainLanguage).toBe('this field cannot carry Hopfions')
      expect(row.g2aIndependent).toBe(true)
    }
    expect(rows[0]).toMatchObject({
      earth: { printed: 1, evaluated: 0 },
      sm: { value: 0, release: 'Derrick 1964' },
    })
    expect(rows[1]).toMatchObject({
      observable: 'pi_3(S^1)',
      earth: { printed: 1, evaluated: 0 },
      sm: { value: 0 },
    })
    expect(rows[1]?.discrepancy).toContain('π₃(S¹)=0')
  })

  it('keeps the printed λ̃₀=44.492 vs (4π)³ CX and matches the standalone kernel', () => {
    expect(result.output.lambdaTilde0).toBe(44.492)
    expect(result.output.lambdaTilde0Literal).toBeCloseTo(LAMBDA_ALGEBRAIC, 12)
    expect(result.output.lambdaTilde0Residual).toBeGreaterThan(0.9)
    expect(kernel.output.predictions).toEqual(result.output.predictions)
    expect(kernel.output.homotopy).toEqual(result.output.homotopy)
    expect(result.output.blockers.some((item) => item.includes('Hopf sector'))).toBe(true)
  })
})
