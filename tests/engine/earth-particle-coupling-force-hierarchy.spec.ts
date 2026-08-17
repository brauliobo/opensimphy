import {
  COUPLING_FORCE_HIERARCHY_CLAIM_IDS,
  COUPLING_FORCE_HIERARCHY_METHOD_ID,
  DEFAULT_COUPLING_FORCE_HIERARCHY_INPUTS,
  EARTH_GS2_TABLE,
  NASSIM_ALPHA_S,
  NASSIM_FORCE_AUDIT_N,
  NASSIM_FORCE_CLAIM_N,
  NASSIM_FORCE_CROSSING_N,
  NASSIM_FORCE_CROSSING_RP,
  SM_ALPHA_S_MZ,
  SM_G,
  SM_GF_GEV,
  THAD_ALPHA,
  THAD_G,
  THAD_GF_GEV,
  couplingForceHierarchy,
} from '../../src/engine/earth/particle/couplingForceHierarchy'
import {
  CODATA_PROTON_RADIUS_FM,
  DEFAULT_PROTON_MASS_RADIUS_CHI_INPUTS,
  NASSIM_PROTON_RADIUS_FM,
  THAD_PROTON_RADIUS_FM,
} from '../../src/engine/earth/particle/protonMassRadiusChi'
import { EARTH_PREDICTION_SCHEMA } from '../../src/engine/earth/particle/ledger'
import { CODATA_ALPHA, GOLDEN_RATIO } from '../../src/engine/earth/foundations'
import { getDefaultEarthMethodId, runEarthMethod } from '../../src/engine/earth'

describe('EARTH-NUC-004 coupling force hierarchy', () => {
  const kernel = couplingForceHierarchy()
  const result = runEarthMethod('EARTH-NUC-004', COUPLING_FORCE_HIERARCHY_METHOD_ID, DEFAULT_COUPLING_FORCE_HIERARCHY_INPUTS)
  const proton = runEarthMethod('EARTH-NUC-004', getDefaultEarthMethodId('EARTH-NUC-004'), DEFAULT_PROTON_MASS_RADIUS_CHI_INPUTS)
  const byId = Object.fromEntries(kernel.output.predictions.map((row) => [row.claimId, row]))
  const phi6 = GOLDEN_RATIO ** 6
  const phi12 = GOLDEN_RATIO ** 12

  it('keeps the runEarthMethod envelope and does not validate EARTH', () => {
    expect(result).toMatchObject({
      schemaVersion: 2,
      programId: 'EARTH-NUC-004',
      methodId: COUPLING_FORCE_HIERARCHY_METHOD_ID,
      status: 'completed',
      validatesEarthTheory: false,
    })
    expect(getDefaultEarthMethodId('EARTH-NUC-004')).toBe('earth-source-reproduction-v1')
    expect(proton.methodId).toBe('earth-source-reproduction-v1')
    expect(kernel.output.validatesEarthTheory).toBe(false)
    expect(kernel.output.schemaVersion).toBe(EARTH_PREDICTION_SCHEMA)
    expect(kernel.output.scientificStatus).toBe('audit')
    expect(kernel.output.plainLanguage).toBe('Four programs do not share a force law. EARTH forms disagree with each other.')
    expect(result.predictions).toEqual(kernel.output.predictions)
    expect(result.predictions.map(({ claimId }) => claimId)).toEqual([...COUPLING_FORCE_HIERARCHY_CLAIM_IDS])
  })

  it('reuses the proton r_p numbers and does not emit the proton ledger', () => {
    expect(kernel.output.protonRadiiFm).toEqual({
      nassim: NASSIM_PROTON_RADIUS_FM,
      thad: THAD_PROTON_RADIUS_FM,
      sm: CODATA_PROTON_RADIUS_FM,
    })
    expect(proton.predictions.map(({ claimId }) => claimId)).toEqual([
      'NUC-004-XI', 'NUC-004-RP', 'NUC-004-MP', 'NUC-004-CHI', 'NUC-004-MS',
    ])
    expect(result.predictions.map(({ claimId }) => claimId)).not.toEqual(proton.predictions.map(({ claimId }) => claimId))
  })

  it('overlays all three printed Γ(r) forms and flags source-conflict', () => {
    expect(kernel.output.gamma.boxed).toBe('φ¹² (ξ₀/r)⁶')
    expect(kernel.output.gamma.sourceConflict).toBe(true)
    expect(kernel.output.gamma.atXi0.direct).toBeCloseTo(phi6, 12)
    expect(kernel.output.gamma.atXi0.boxed).toBeCloseTo(phi12, 12)
    expect(kernel.output.gamma.atXi0.intermediate).toBeCloseTo(phi12, 12)
    expect(kernel.output.gamma.maximumPairwiseRelativeDifference).toBeGreaterThan(1)
    expect(byId['NUC-004-GAMMA']).toMatchObject({
      auditStatus: 'falsified',
      earth: { printed: EARTH_GS2_TABLE, formula: expect.stringContaining('φ¹²(ξ₀/r)⁶') },
      thad: { status: 'missing', value: null },
      nassim: { status: 'missing', value: null },
      gate: { verdict: 'fail' },
    })
    expect(byId['NUC-004-GAMMA']?.earth.evaluated).toBeCloseTo(phi12, 12)
    expect(byId['NUC-004-GAMMA']?.discrepancy).toContain('source-conflict')
    expect(kernel.output.flags).toEqual(expect.arrayContaining(['source-conflict']))
  })

  it('does not recover 1/137 at φ¹⁰/φ²⁰ and keeps g_s²≈φ⁶ as CX', () => {
    expect(kernel.output.gamma.atPhi10.boxed).not.toBeCloseTo(CODATA_ALPHA, 2)
    expect(kernel.output.gamma.atPhi20.boxed).not.toBeCloseTo(CODATA_ALPHA, 2)
    expect(kernel.output.earth.alphaSource).toBeCloseTo(2960.93, 1)
    expect(byId['NUC-004-ALPHA']).toMatchObject({
      auditStatus: 'falsified',
      thad: { value: THAD_ALPHA, status: 'prediction', formula: 'α=zhe_1² supplement' },
      gate: { verdict: 'fail' },
    })
    expect(byId['NUC-004-GS']?.earth.evaluated).toBeCloseTo(phi6, 12)
    expect(byId['NUC-004-GS']?.earth.printed).toBe(EARTH_GS2_TABLE)
    expect(byId['NUC-004-GS']?.earth.printed).not.toBeCloseTo(phi6, 1)
    expect(byId['NUC-004-GS']?.sm.value).toBe(SM_ALPHA_S_MZ)
  })

  it('falsifies both EARTH G formulas and records G_F units failure', () => {
    expect(Math.abs(kernel.output.earth.gCoupling / SM_G - 1)).toBeGreaterThan(0.01)
    expect(Math.abs(kernel.output.earth.gQg / SM_G - 1)).toBeGreaterThan(0.01)
    expect(Math.abs(kernel.output.earth.gCoupling / kernel.output.earth.gQg - 1)).toBeGreaterThan(0.01)
    expect(kernel.output.earth.gQg).toBe(6.340806087699862e-11)
    expect(kernel.diagnostics.gTwoFormulasFalsified).toBe(true)
    expect(byId['NUC-004-G']).toMatchObject({
      auditStatus: 'falsified',
      thad: { value: THAD_G, status: 'repro' },
      nassim: { value: null, status: 'blocked' },
      sm: { value: SM_G },
    })
    expect(byId['NUC-004-G']?.nassim.formula).toContain('blocked-source')
    expect(byId['NUC-004-GF']).toMatchObject({
      auditStatus: 'falsified',
      thad: { value: THAD_GF_GEV, status: 'repro' },
      sm: { value: SM_GF_GEV },
    })
    expect(byId['NUC-004-GF']?.discrepancy).toContain('units fail')
    expect(typeof byId['NUC-004-GF']?.earth.evaluated).toBe('number')
    expect(Math.abs(Number(byId['NUC-004-GF']?.earth.evaluated) / SM_GF_GEV - 1)).toBeGreaterThan(0.01)
  })

  it('keeps the Nassim 2.6 r_p force failure with frozen α_s=0.3811', () => {
    expect(kernel.output.nassim.alphaS).toBe(NASSIM_ALPHA_S)
    expect(kernel.diagnostics.nassimAlphaSFrozen).toBe(true)
    expect(kernel.output.nassim.claimedForceN).toBe(NASSIM_FORCE_CLAIM_N)
    expect(kernel.output.nassim.auditForceN).toBe(NASSIM_FORCE_AUDIT_N)
    expect(kernel.output.nassim.forceAt26RpN).toBeCloseTo(NASSIM_FORCE_AUDIT_N, 1)
    expect(kernel.output.nassim.forceAt26RpN).not.toBeCloseTo(NASSIM_FORCE_CLAIM_N, 0)
    expect(kernel.output.nassim.crossingROverRp).toBeCloseTo(NASSIM_FORCE_CROSSING_RP, 3)
    expect(kernel.output.nassim.crossingForceN).toBeCloseTo(NASSIM_FORCE_CROSSING_N, 1)
    expect(kernel.diagnostics.nassimForceFailed).toBe(true)
    expect(byId['NUC-004-FS']?.nassim).toMatchObject({ status: 'falsified' })
    expect(byId['NUC-004-FS']?.discrepancy).toContain('48.4')
    expect(byId['NUC-004-FS']?.discrepancy).toContain('23.818')
    expect(byId['NUC-004-AS']?.nassim.value).toBe(NASSIM_ALPHA_S)
    expect(kernel.output.forceOverlay).toHaveLength(2)
    expect(kernel.output.forceOverlay[0]?.r).toBe('xi0')
    expect(kernel.output.forceOverlay[1]?.r).toBe('2.6 r_p')
    expect(kernel.output.forceOverlay[1]?.claimedN).toBe(48.4)
  })

  it('records Thad IB as identity and keeps four programs without a shared force law', () => {
    expect(byId['NUC-004-IB']).toMatchObject({
      auditStatus: 'identity',
      thad: { status: 'identity', formula: 'IB=μ₀/(4π) identity' },
      nassim: { status: 'missing', value: null },
    })
    expect(kernel.output.thad.gamma).toBeNull()
    expect(kernel.output.nassim.gamma).toBeNull()
    expect(byId['NUC-004-GAMMA']?.plainLanguage).toBe(kernel.output.plainLanguage)
    expect(kernel.output.blockers.some((item) => item.includes('blocked-source'))).toBe(true)
  })
})
