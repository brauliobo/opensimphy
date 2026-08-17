import {
  EARTH_PREDICTION_LABELS,
  EARTH_PREDICTION_MAPPING,
  EARTH_PREDICTION_SCHEMA,
  assertEarthPredictionRow,
  buildEarthPredictionLedger,
  buildEarthPredictionRow,
  earthMethodPredictions,
  identityPredictionSlot,
  missingPredictionSlot,
  predictionRowsForDisplay,
  reproPredictionSlot,
} from '../../src/engine/earth/particle/ledger'
import { getDefaultEarthMethodId, getEarthMethodDefaultInputs, runEarthMethod } from '../../src/engine/earth'

function rowInput(overrides: Record<string, unknown> = {}) {
  return {
    claimId:        'NUC-004-RP',
    programId:      'EARTH-NUC-004',
    kernelId:       'protonFormulaAudit',
    observable:     'r_p',
    unit:           'fm',
    sm:             { value: 0.84075, uncertainty: 0.00064, source: 'CODATA', release: '2022' },
    earth:          { printed: 0.28648, evaluated: 0.28648, formula: '5 ξ₀ φ^{-2}' },
    thad:           { value: 0.84343161, formula: 'Catalan chain', status: 'prediction' },
    nassim:         { value: 0.84123564, formula: '4 ħ/(m_p c)', status: 'prediction' },
    gate:           { metric: 'sigma', passIf: '<=3σ' },
    auditStatus:    'falsified',
    g2aIndependent: true,
    datasetIds:     ['earth-dataset-codata-recommended-values'],
    modelSummary:   'Four names for the proton radius.',
    ...overrides,
  }
}

describe('earth-prediction/v1 four-program ledger', () => {
  it('locks schema, mapping, and short labels', () => {
    expect(EARTH_PREDICTION_SCHEMA).toBe('earth-prediction/v1')
    expect(EARTH_PREDICTION_MAPPING).toBe('four-program-ledger')
    expect(EARTH_PREDICTION_LABELS).toEqual({ earth: 'EARTH', thad: 'Thad', nassim: 'Nassim', sm: 'SM' })
  })

  it('emits every required row field and first-class missing counterparts', () => {
    const row = buildEarthPredictionRow(rowInput({
      thad:   missingPredictionSlot('no NUC knot table in Physics Monastery'),
      nassim: missingPredictionSlot('no (p,q) map in Haramein'),
    }))
    expect(row).toMatchObject({
      claimId: 'NUC-004-RP',
      programId: 'EARTH-NUC-004',
      kernelId: 'protonFormulaAudit',
      thad: { value: null, status: 'missing' },
      nassim: { value: null, status: 'missing' },
    })
    expect(row).not.toHaveProperty('validatesEarthTheory')
    expect(row.thad.formula).toContain('Physics Monastery')
    expect(row.gate.verdict).toBe('fail')
  })

  it('fails the gate when printed differs from evaluated and does not repair toward SM', () => {
    const row = buildEarthPredictionRow(rowInput({
      earth: { printed: 0.8414, evaluated: 0.28648, formula: '5 ξ₀ φ^{-2}' },
      nassim: { value: 0.84075, formula: 'forced to SM', status: 'prediction' },
    }))
    expect(row.residual.earthPrintedVsEval).toBeGreaterThan(0.5)
    expect(row.gate.verdict).toBe('fail')
    expect(row.earth.evaluated).toBe(0.28648)
  })

  it('distinguishes prediction, repro, identity, and missing slot statuses', () => {
    const independent = buildEarthPredictionRow(rowInput())
    expect(independent.thad.status).toBe('prediction')
    expect(independent.nassim.status).toBe('prediction')

    const recipe = buildEarthPredictionRow(rowInput({
      thad: reproPredictionSlot(0.84075, '288 atlas constructor'),
      nassim: identityPredictionSlot(0.51099895069, 'm_e=ħ/(c α a_0)'),
    }))
    expect(recipe.thad.status).toBe('repro')
    expect(recipe.nassim.status).toBe('identity')

    expect(() => buildEarthPredictionLedger({
      simulationId: 'EARTH-NUC-004',
      predictions: [recipe],
      scientificStatus: 'prediction',
    })).toThrow(/cannot be prediction/)
  })

  it('refuses scientificStatus prediction when the target entered the inputs', () => {
    const circular = buildEarthPredictionRow(rowInput({ g2aIndependent: false, auditStatus: 'calibration' }))
    expect(() => buildEarthPredictionLedger({
      simulationId: 'EARTH-NUC-004',
      predictions: [circular],
      scientificStatus: 'prediction',
    })).toThrow(/target entered the inputs/)

    const ledger = buildEarthPredictionLedger({
      simulationId: 'EARTH-NUC-004',
      predictions: [circular],
      findings: [{ claimId: 'NUC-004-RP', text: 'r_p used as input' }],
      blockers: [],
      referenceDatasetIds: ['earth-dataset-codata-recommended-values'],
    })
    expect(ledger).toMatchObject({
      schemaVersion: 'earth-prediction/v1',
      mapping: 'four-program-ledger',
      scientificStatus: 'audit',
      validatesEarthTheory: false,
    })
    expect(ledger.residuals['NUC-004-RP']).toEqual(circular.residual)
  })

  it('treats silent omission of a counterpart as a test failure', () => {
    const omitted = { ...rowInput() }
    delete (omitted as { thad?: unknown }).thad
    expect(() => assertEarthPredictionRow(omitted)).toThrow(/silent omission/)
    expect(() => assertEarthPredictionRow(rowInput({ nassim: undefined }))).toThrow(/silent omission/)
    expect(() => missingPredictionSlot('')).toThrow(/non-empty string/)
  })

  it('lets existing kernels attach predictions without changing the envelope contract', () => {
    const programId = 'EARTH-FND-011'
    const methodId = getDefaultEarthMethodId(programId)
    const result = runEarthMethod(programId, methodId, getEarthMethodDefaultInputs(programId, methodId))
    expect(result).toMatchObject({
      schemaVersion: 2,
      validatesEarthTheory: false,
      predictions: [],
    })

    const attached = earthMethodPredictions({ predictions: [buildEarthPredictionRow(rowInput())] })
    expect(attached).toHaveLength(1)
    expect(attached[0]?.claimId).toBe('NUC-004-RP')
    expect(predictionRowsForDisplay(attached)[0]).toMatchObject({
      claimId: 'NUC-004-RP',
      modelSummary: 'Four names for the proton radius.',
      columns: [
        { label: 'EARTH', status: 'falsified' },
        { label: 'Thad', status: 'prediction' },
        { label: 'Nassim', status: 'prediction' },
        { label: 'SM', status: 'sm' },
      ],
    })
  })
})
