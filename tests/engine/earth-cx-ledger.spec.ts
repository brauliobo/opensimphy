import {
  CX_CLAIM_IDS,
  CX_KERNEL_REGRESSIONS,
  CX_LEDGER,
  cxLedgerRow,
} from '../../src/engine/earth/particle/cx-ledger'
import {
  GOLDEN_RATIO,
  CODATA_ALPHA,
  CODATA_HBAR,
  goldenPowerAudit,
  piAlphaAudit,
  planckTwistAudit,
} from '../../src/engine/earth/foundations'

describe('EARTH particle CX ledger', () => {
  it('uses the locked SM claimIds and earth-prediction/v1 ledger types', () => {
    expect(CX_LEDGER.schemaVersion).toBe('earth-prediction/v1')
    expect(CX_LEDGER.mapping).toBe('four-program-ledger')
    expect(CX_LEDGER.validatesEarthTheory).toBe(false)
    expect(CX_LEDGER.scientificStatus).toBe('audit')
    expect(CX_LEDGER.predictions.map(({ claimId }) => claimId)).toEqual([...CX_CLAIM_IDS])
    expect(CX_LEDGER.predictions.every(({ claimId }) => CX_CLAIM_IDS.includes(claimId))).toBe(true)
  })

  it('recomputes α^{-1}, φ^{18}, ħ, and π and keeps them falsified', () => {
    const phi18 = goldenPowerAudit({ exponents: [18], claims: [{ exponent: 18, claimed: 2584 }] })
    const alpha = piAlphaAudit()
    const hbar = planckTwistAudit()
    const ledgerPhi = cxLedgerRow('PRT-001-PHI18')
    const ledgerAlpha = cxLedgerRow('PRT-001-ALPHA')
    const ledgerHbar = cxLedgerRow('FND-011-HBAR')
    const piRow = CX_KERNEL_REGRESSIONS.find(({ observable }) => observable === 'π')

    expect(phi18.output.claims[0]?.computed).toBeCloseTo(GOLDEN_RATIO ** 18, 10)
    expect(ledgerPhi.earth.evaluated).toBeCloseTo(GOLDEN_RATIO ** 18, 10)
    expect(ledgerPhi.earth.printed).toBe(2584)
    expect(ledgerPhi.auditStatus).toBe('falsified')
    expect(ledgerPhi.gate.verdict).toBe('fail')

    expect(alpha.output.alpha.sourceInverseUsingPi).toBeCloseTo(120 * Math.PI * 3 * GOLDEN_RATIO ** 2, 10)
    expect(ledgerAlpha.earth.evaluated).toBeCloseTo(120 * Math.PI * 3 * GOLDEN_RATIO ** 2, 10)
    expect(ledgerAlpha.sm.value).toBeCloseTo(1 / CODATA_ALPHA, 12)
    expect(ledgerAlpha.auditStatus).toBe('falsified')
    expect(ledgerAlpha.thad.status).toBe('prediction')
    expect(ledgerAlpha.nassim.status).toBe('identity')

    expect(hbar.output.action).toBeCloseTo(1.423837948980579e-36, 14)
    expect(ledgerHbar.earth.evaluated).toBeCloseTo(hbar.output.action, 14)
    expect(ledgerHbar.sm.value).toBe(CODATA_HBAR)
    expect(ledgerHbar.auditStatus).toBe('falsified')
    expect(ledgerHbar.thad.status).toBe('identity')
    expect(ledgerHbar.nassim.status).toBe('missing')

    expect(piRow?.evaluated).toBeCloseTo(Math.sqrt(6) * GOLDEN_RATIO ** -2, 14)
    expect(piRow?.sm).toBe(Math.PI)
    expect(Math.abs(Number(piRow?.evaluated) - Math.PI)).toBeGreaterThan(2)
    expect(piRow?.status).toBe('falsified')
  })

  it('locks the four r_p hypotheses and Thad/Nassim extras', () => {
    const radius = cxLedgerRow('NUC-004-RP')
    expect(radius.earth.evaluated).toBeCloseTo(5 * 0.15 * GOLDEN_RATIO ** -2, 14)
    expect(radius.auditStatus).toBe('falsified')
    expect(radius.thad).toMatchObject({ value: 0.8434316144, status: 'prediction' })
    expect(radius.nassim).toMatchObject({ value: 0.8412356402, status: 'prediction' })
    expect(radius.sm).toMatchObject({ value: 0.84075, uncertainty: 0.00064 })
    expect((Number(radius.thad.value) - 0.84075) / 0.00064).toBeCloseTo(4.19, 2)
    expect((Number(radius.nassim.value) - 0.84075) / 0.00064).toBeCloseTo(0.76, 2)
    expect(radius.gate.verdict).toBe('fail')

    expect(cxLedgerRow('PRT-005-SIN2W').thad).toMatchObject({ value: 0.22318060001, status: 'prediction' })
    expect(cxLedgerRow('PRT-005-MUE').earth.evaluated).toBeCloseTo(GOLDEN_RATIO ** 6, 12)
    expect(cxLedgerRow('NUC-001-P').earth.evaluated).toBe(0)
    expect(cxLedgerRow('GRV-001-G').nassim.status).toBe('blocked')
    expect(CX_LEDGER.findings.some(({ text }) => text.includes('23.818'))).toBe(true)
  })

  it('does not reopen falsified PRT-001 rows as predictions', () => {
    for (const claimId of ['PRT-001-PHI18', 'PRT-001-ALPHA', 'PRT-001-A0', 'PRT-001-ME', 'PRT-001-RYD'] as const) {
      const row = cxLedgerRow(claimId)
      expect(row.auditStatus).toBe('falsified')
      expect(row.gate.verdict).toBe('fail')
    }
  })
})
