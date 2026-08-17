import {
  DEFAULT_NUCLEAR_PQ_ENERGY_INPUTS,
  nuclearPqEnergyAudit,
} from '../../src/engine/earth/particle/nuclearPqEnergy'
import { EARTH_PREDICTION_SCHEMA } from '../../src/engine/earth/particle/ledger'
import { getDefaultEarthMethodId, runEarthMethod } from '../../src/engine/earth'

const LAMBDA_ALGEBRAIC = (4 * Math.PI) ** 3

describe('EARTH-NUC-001 torus-pair energy ledger', () => {
  const kernel = nuclearPqEnergyAudit()
  const result = runEarthMethod('EARTH-NUC-001', getDefaultEarthMethodId('EARTH-NUC-001'), DEFAULT_NUCLEAR_PQ_ENERGY_INPUTS)

  it('keeps the runEarthMethod envelope and does not validate EARTH', () => {
    expect(result).toMatchObject({
      schemaVersion: 2,
      programId: 'EARTH-NUC-001',
      methodId: 'earth-source-reproduction-v1',
      status: 'completed',
      validatesEarthTheory: false,
    })
    expect(result.output.validatesEarthTheory).toBe(false)
    expect(result.output.schemaVersion).toBe(EARTH_PREDICTION_SCHEMA)
    expect(result.output.scientificStatus).toBe('audit')
    expect(result.output.ameResidualClaimed).toBe(false)
    expect(result.diagnostics.validatesEarthTheory).toBe(false)
    expect(result.diagnostics.datasetBytes).toBe(0)
  })

  it('preserves the existing (p,q) enumeration table', () => {
    expect(result.output.candidates.every(({ gcd }) => gcd === 1)).toBe(true)
    expect(result.output.sourceClaims).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'proton', standardKind: 'unknot', sourceRuleA: 3, sourceRuleZ: 0 }),
      expect.objectContaining({ label: 'helium-4', standardKind: 'link', sourceRuleA: 9, sourceRuleZ: 0 }),
      expect.objectContaining({ label: 'carbon-12', standardKind: 'link', sourceRuleA: 25, sourceRuleZ: 2 }),
    ]))
  })

  it('falsifies the printed ¹H, ⁴He, and ¹²C maps without repairing A or Z', () => {
    const byId = Object.fromEntries(result.output.nuclides.map((row) => [row.claimId, row]))
    expect(byId['NUC-001-P']).toMatchObject({
      p: 3, q: 1, standardKind: 'unknot', evaluatedA: 3, evaluatedZ: 0, smA: 1, smZ: 1, knotError: true,
    })
    expect(byId['NUC-001-HE']).toMatchObject({
      p: 3, q: 3, standardKind: 'link', evaluatedA: 9, evaluatedZ: 0, smA: 4, smZ: 2, knotError: true,
    })
    expect(byId['NUC-001-C']).toMatchObject({
      p: 5, q: 5, standardKind: 'link', evaluatedA: 25, evaluatedZ: 2, smA: 12, smZ: 6, knotError: true,
    })
    expect(result.output.hardGates.torus31).toBe('unknot')
    expect(result.output.flags).toEqual(expect.arrayContaining(['knot-error', 'arithmetic-cx', 'missing-operator']))
  })

  it('emits earth-prediction/v1 rows with Thad and Nassim missing, not a Thad mass map', () => {
    const rows = result.predictions
    expect(rows.map(({ claimId }) => claimId)).toEqual(['NUC-001-P', 'NUC-001-HE', 'NUC-001-C', 'NUC-002-AME'])
    for (const row of rows.slice(0, 3)) {
      expect(row.thad).toMatchObject({ value: null, status: 'missing' })
      expect(row.nassim).toMatchObject({ value: null, status: 'missing' })
      expect(row.thad.formula).toContain('knot table')
      expect(row.nassim.formula).toContain('spherical PSU is not a knot')
      expect(row.auditStatus).toBe('falsified')
      expect(row.gate.verdict).toBe('fail')
      expect(row.residual.thadVsSm).toBeNull()
      expect(row.residual.nassimVsSm).toBeNull()
      expect(row.sm.source).toContain('PDG label')
      expect(row.sm.source).toContain('not AME mass')
    }
    expect(rows[3]).toMatchObject({
      claimId: 'NUC-002-AME',
      auditStatus: 'blocked',
      thad: { status: 'missing', value: null },
      nassim: { status: 'missing', value: null },
      sm: { value: null, source: 'AME2020 / NUBASE2020' },
    })
    expect(result.output.missing.thad.note).toContain('not a (p,q) table')
    expect(result.output.missing.nassim.note).toBe('spherical PSU is not a knot')
    expect(JSON.stringify(rows)).not.toMatch(/0\.938/)
  })

  it('keeps the printed λ̃₀=44.492 vs (4π)³ arithmetic CX and literal E(p,q)', () => {
    const proton = result.output.nuclides.find(({ claimId }) => claimId === 'NUC-001-P')!
    expect(result.output.lambda.printed).toBe(44.492)
    expect(result.output.lambda.algebraic).toBeCloseTo(LAMBDA_ALGEBRAIC, 12)
    expect(result.output.lambda.relativeResidual).toBeGreaterThan(0.9)
    expect(result.output.lambda.flag).toBe('arithmetic-cx')
    expect(proton.evaluatedEnergyFmInv).toBeCloseTo(44.492 * 13 / 0.15, 12)
    expect(proton.evaluatedEnergyFmInv).not.toBeCloseTo(LAMBDA_ALGEBRAIC * 13 / 0.15, 6)
    expect(proton.printedEnergyFmInv).not.toBeNull()
    expect(proton.printedEnergyFmInv).not.toBeCloseTo(proton.evaluatedEnergyFmInv, 6)
  })

  it('does not claim an AME residual and matches the standalone kernel', () => {
    expect(result.output.blockers.some((item) => item.startsWith('NUC-002-AME'))).toBe(true)
    expect(result.output.referenceDatasetIds).toContain('earth-dataset-ame2020-and-nubase2020')
    expect(kernel.output.predictions).toEqual(result.predictions)
    expect(kernel.output.nuclides).toEqual(result.output.nuclides)
  })
})
