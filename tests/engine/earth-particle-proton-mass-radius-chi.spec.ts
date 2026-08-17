import {
  CODATA_PROTON_MASS_MEV,
  CODATA_PROTON_RADIUS_FM,
  DEFAULT_PROTON_MASS_RADIUS_CHI_INPUTS,
  NASSIM_CHI,
  NASSIM_PROTON_ENERGY_MEV,
  NASSIM_PROTON_RADIUS_FM,
  NASSIM_SCHWARZSCHILD_MASS_KG,
  THAD_PROTON_MASS_MEV,
  THAD_PROTON_RADIUS_FM,
  protonMassRadiusChi,
} from '../../src/engine/earth/particle/protonMassRadiusChi'
import { EARTH_PREDICTION_SCHEMA } from '../../src/engine/earth/particle/ledger'
import { getDefaultEarthMethodId, runEarthMethod } from '../../src/engine/earth'

describe('EARTH-NUC-004 proton mass-radius ledger', () => {
  const kernel = protonMassRadiusChi()
  const result = runEarthMethod('EARTH-NUC-004', getDefaultEarthMethodId('EARTH-NUC-004'), DEFAULT_PROTON_MASS_RADIUS_CHI_INPUTS)
  const byId = Object.fromEntries(kernel.output.predictions.map((row) => [row.claimId, row]))

  it('keeps the runEarthMethod envelope and does not validate EARTH', () => {
    expect(result).toMatchObject({
      schemaVersion: 2,
      programId: 'EARTH-NUC-004',
      methodId: 'earth-source-reproduction-v1',
      status: 'completed',
      validatesEarthTheory: false,
    })
    expect(kernel.output.validatesEarthTheory).toBe(false)
    expect(kernel.output.schemaVersion).toBe(EARTH_PREDICTION_SCHEMA)
    expect(kernel.output.scientificStatus).toBe('audit')
    expect(kernel.output.scientificStatus).not.toBe('prediction')
    expect(kernel.output.modelSummary).toBe(
      "Four ways to name the proton's size and mass. Shared coordinates are a change of units, not a shared theory.",
    )
    expect(result.predictions).toEqual(kernel.output.predictions)
  })

  it('emits four distinct r_p hypotheses and the locked claimIds', () => {
    const { radiusHypotheses } = kernel.output
    expect(radiusHypotheses.earthXi0Fm).toBe(0.15)
    expect(radiusHypotheses.earthFiveTubeFm).toBeCloseTo(0.2864745084375789, 12)
    expect(radiusHypotheses.thadCatalanFm).toBe(THAD_PROTON_RADIUS_FM)
    expect(radiusHypotheses.nassimAnsatzFm).toBe(NASSIM_PROTON_RADIUS_FM)
    expect(radiusHypotheses.smCodataFm).toBe(CODATA_PROTON_RADIUS_FM)
    expect(new Set([
      radiusHypotheses.earthFiveTubeFm,
      radiusHypotheses.thadCatalanFm,
      radiusHypotheses.nassimAnsatzFm,
      radiusHypotheses.smCodataFm,
    ]).size).toBe(4)

    expect(byId['NUC-004-XI']?.auditStatus).toBe('falsified')
    expect(byId['NUC-004-RP']?.auditStatus).toBe('falsified')
    expect(byId['NUC-004-MP']?.auditStatus).toBe('falsified')
    expect(byId['NUC-004-XI']?.g2aIndependent).toBe(false)
    expect(byId['NUC-004-RP']?.earth).toMatchObject({ printed: 0.8414 })
    expect(byId['NUC-004-RP']?.earth.evaluated).toBeCloseTo(radiusHypotheses.earthFiveTubeFm, 12)
    expect(byId['NUC-004-RP']?.gate.verdict).toBe('fail')
    expect(JSON.stringify(kernel.output.predictions)).not.toContain('1.32')
  })

  it('keeps Nassim r_p as the only independent particle prediction', () => {
    const rp = byId['NUC-004-RP']!
    expect(rp.nassim).toMatchObject({
      value: NASSIM_PROTON_RADIUS_FM,
      status: 'prediction',
      formula: 'r_p=4ħ/(m_p c)',
    })
    expect(rp.thad).toMatchObject({
      value: THAD_PROTON_RADIUS_FM,
      status: 'prediction',
      formula: expect.stringContaining('ROBERTS-014'),
    })
    expect(rp.sm).toMatchObject({ value: CODATA_PROTON_RADIUS_FM, uncertainty: 0.00064, source: 'CODATA', release: '2022' })
    expect(kernel.output.sigma.nassim).toBeCloseTo(0.76, 2)
    expect(kernel.output.sigma.thad).toBeCloseTo(4.19, 2)
    expect(kernel.output.flags).toEqual(expect.arrayContaining([
      'calibration-circular',
      'identity-not-prediction',
      'nassim-radius-ansatz',
    ]))
  })

  it('records Thad mass as repro and Nassim E_p/χ/M_S as non-predictions', () => {
    const mp = byId['NUC-004-MP']!
    expect(mp.thad).toMatchObject({ value: THAD_PROTON_MASS_MEV, status: 'repro' })
    expect(mp.nassim).toMatchObject({ value: NASSIM_PROTON_ENERGY_MEV, status: 'calibration' })
    expect(mp.sm.value).toBe(CODATA_PROTON_MASS_MEV)
    expect(mp.earth.evaluated).toBeGreaterThan(1e4)
    expect(mp.earth.evaluated).not.toBeCloseTo(CODATA_PROTON_MASS_MEV, 0)
    expect(mp.gate.verdict).toBe('fail')

    expect(byId['NUC-004-CHI']?.nassim).toMatchObject({ value: NASSIM_CHI, status: 'identity' })
    expect(byId['NUC-004-MS']).toMatchObject({
      auditStatus: 'identity',
      g2aIndependent: false,
      nassim: { value: NASSIM_SCHWARZSCHILD_MASS_KG, status: 'identity' },
    })
    expect(kernel.output.nassim.schwarzschildMassKg).toBe(NASSIM_SCHWARZSCHILD_MASS_KG)
    expect(kernel.output.nassim.era2010RadiusFm).toBeNull()
    expect(kernel.output.thad.recipe53).toBe('repro')
  })

  it('leaves the ξ₀ route failed and does not repair λ̃₀', () => {
    const xi = byId['NUC-004-XI']!
    expect(xi.earth.printed).toBe(0.15)
    expect(xi.earth.evaluated).toBeCloseTo(1.536179199616156, 12)
    expect(xi.gate.verdict).toBe('fail')
    expect(kernel.output.radius.xiFromPrintedRadiusRouteFm).toBeCloseTo(1.536179199616156, 12)
    expect(kernel.output.energyVariants.every(({ relativeResidualToCanonical }) => relativeResidualToCanonical > 1)).toBe(true)
    expect(kernel.output.lambda.printed).toBe(44.492)
    expect(kernel.output.lambda.relativeResidual).toBeGreaterThan(0.9)
    expect(kernel.output.lambda.flag).toBe('arithmetic-cx')
  })
})
