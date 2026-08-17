import {
  DEFAULT_FERMION_BOSON_NUMBERS_INPUTS,
  fermionBosonNumbers,
} from '../../src/engine/earth/particle/fermionBosonNumbers'
import { EARTH_PREDICTION_SCHEMA } from '../../src/engine/earth/particle/ledger'
import { CODATA_HBAR, GOLDEN_RATIO } from '../../src/engine/earth/foundations'
import { getDefaultEarthMethodId, runEarthMethod } from '../../src/engine/earth'

const PHI6 = GOLDEN_RATIO ** 6
const PHI_INV2 = GOLDEN_RATIO ** -2
const WEINBERG_LOG = Math.log(1 + Math.SQRT2)

describe('EARTH-PRT-005 fermion boson number ledger', () => {
  const kernel = fermionBosonNumbers()
  const result = runEarthMethod('EARTH-PRT-005', getDefaultEarthMethodId('EARTH-PRT-005'), DEFAULT_FERMION_BOSON_NUMBERS_INPUTS)
  const byId = Object.fromEntries((result.predictions.length ? result.predictions : kernel.predictionLedger.predictions).map((row) => [row.claimId, row]))

  it('keeps the runEarthMethod envelope and does not validate EARTH', () => {
    expect(result).toMatchObject({
      schemaVersion: 2,
      programId: 'EARTH-PRT-005',
      methodId: 'earth-source-reproduction-v1',
      status: 'completed',
      validatesEarthTheory: false,
    })
    expect(kernel.output.validatesEarthTheory).toBe(false)
    expect(kernel.output.schemaVersion).toBe(EARTH_PREDICTION_SCHEMA)
    expect(kernel.output.scientificStatus).toBe('audit')
    expect(kernel.output.plainLanguage).toContain('φ⁶ is 17.944')
    expect(kernel.diagnostics.validatesEarthTheory).toBe(false)
    expect(result.predictions.map(({ claimId }) => claimId)).toEqual(kernel.predictionLedger.predictions.map(({ claimId }) => claimId))
    expect(kernel).toEqual(fermionBosonNumbers())
  })

  it('keeps the existing quantum-number audit table', () => {
    expect(result.output.quantumClaims.find(({ id }) => id === 'down-quark')).toMatchObject({
      sourceWinding: -2 / 3,
      sourceChargeE: -1 / 3,
      windingChargeConsistent: false,
    })
    expect(result.output.literalClaims.find(({ id }) => id === 'generation-ratio-phi6')?.evaluatedValue).toBeCloseTo(PHI6, 13)
  })

  it('falsifies μ/e=φ⁶, |V_us|=φ⁻², and twist-count ħ without repair', () => {
    expect(byId['PRT-005-MUE']).toMatchObject({
      auditStatus: 'falsified',
      earth: { evaluated: PHI6 },
      thad: { status: 'repro', value: 206.768283 },
      nassim: { status: 'missing', value: null },
    })
    expect(byId['PRT-005-MUE']?.earth.evaluated).toBeCloseTo(17.94427190999916, 12)
    expect(byId['PRT-005-MUE']?.earth.printed).not.toBeCloseTo(PHI6, 2)
    expect(byId['PRT-005-MUE']?.gate.verdict).toBe('fail')

    expect(byId['PRT-005-VUS']).toMatchObject({
      auditStatus: 'falsified',
      earth: { evaluated: PHI_INV2 },
      thad: { status: 'missing', value: null },
    })
    expect(byId['PRT-005-VUS']?.earth.evaluated).toBeCloseTo(0.38196601125010515, 14)
    expect(byId['PRT-005-VUS']?.thad.formula).toContain('CKM')

    expect(byId['FND-011-HBAR']).toMatchObject({
      auditStatus: 'falsified',
      thad: { status: 'identity', formula: 'ROBERTS-001 l_P m_P=ħ/c' },
      nassim: { status: 'calibration', value: CODATA_HBAR },
    })
    expect(kernel.output.hbar.ratioToCodata).toBeCloseTo(0.01350, 5)
    expect(byId['FND-011-HBAR']?.earth.evaluated).toBeCloseTo(0.01350 * CODATA_HBAR, 8)
    expect(byId['FND-011-HBAR']?.earth.evaluated).not.toBe(CODATA_HBAR)
  })

  it('marks d and e Q≠w falsified, u and ν testable only, photon blocked', () => {
    expect(byId['PRT-005-D']).toMatchObject({ auditStatus: 'falsified', earth: { printed: -1 / 3, evaluated: -2 / 3 } })
    expect(byId['PRT-005-E']).toMatchObject({ auditStatus: 'falsified', earth: { printed: -1, evaluated: -2 } })
    expect(byId['PRT-005-U']).toMatchObject({ auditStatus: 'testable', earth: { printed: 2 / 3, evaluated: 2 / 3 }, gate: { verdict: 'pass' } })
    expect(byId['PRT-005-NU']).toMatchObject({ auditStatus: 'testable', earth: { printed: 0, evaluated: 0 }, thad: { status: 'missing' } })
    expect(byId['PRT-005-GAMMA']).toMatchObject({
      auditStatus: 'blocked',
      thad: { status: 'missing' },
      nassim: { status: 'missing' },
    })
    expect(byId['PRT-005-GAMMA']?.nassim.formula).toContain('2010 μ_p')
    expect(kernel.output.hardGates.hopfSector).toBe(false)
  })

  it('emits locked Thad repro/supplement slots and no Thad CKM', () => {
    expect(byId['PRT-005-MMU']?.thad).toMatchObject({ status: 'repro', value: 1.88353161502363e-28 })
    expect(byId['PRT-005-MTAU']?.thad).toMatchObject({ status: 'repro' })
    expect(byId['PRT-005-MN']?.thad).toMatchObject({ status: 'repro' })
    expect(byId['PRT-005-GF']?.thad).toMatchObject({ status: 'repro', value: 1.16637852183e-5 })
    expect(byId['PRT-005-GP']?.thad).toMatchObject({ status: 'repro', value: 5.58569469013 })
    expect(byId['PRT-005-MWZ']?.thad).toMatchObject({ status: 'prediction', value: WEINBERG_LOG })
    expect(byId['PRT-005-SIN2W']?.thad).toMatchObject({ status: 'prediction', value: 1 - WEINBERG_LOG ** 2 })
    expect(byId['PRT-005-SIN2W']?.discrepancy).toContain('scheme clash')
    expect(byId['PRT-005-VUS']?.thad.status).toBe('missing')
    expect(result.predictions.some((row) => row.thad.formula?.includes('V_us') && row.thad.status !== 'missing')).toBe(false)
  })
})
