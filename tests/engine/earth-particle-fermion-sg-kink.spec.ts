import { getDefaultEarthMethodId, runEarthMethod, runEarthSimulation } from '../../src/engine/earth'
import {
  CLAIMED_FRACTIONAL_WINDING,
  XI0_FM,
  fermionSgKink,
} from '../../src/engine/earth/particle/fermionSgKink'

describe('EARTH-FLD-008 EARTH-width sine-Gordon kink', () => {
  const kernel = fermionSgKink()
  const result = runEarthMethod('EARTH-FLD-008', getDefaultEarthMethodId('EARTH-FLD-008'), {})

  it('keeps the runEarthMethod envelope and does not validate EARTH', () => {
    expect(result).toMatchObject({
      schemaVersion: 2,
      programId: 'EARTH-FLD-008',
      methodId: 'traditional-numerical-baseline-v1',
      status: 'completed',
      validatesEarthTheory: false,
      provenance: { kind: 'comparison', validatesEarthTheory: false },
    })
    expect(result.predictionLedger?.validatesEarthTheory).toBe(false)
    expect(result.predictionLedger?.scientificStatus).toBe('comparison')
    expect(result.output.plainLanguage).toBe('toy SG kink at a width, not a fermion')
    expect(result.diagnostics.plainLanguage).toContain('not a fermion')
    expect(result.output.fermionLabelForbidden).toBe(true)
    expect(result.output.hopfLabelForbidden).toBe(true)
    expect(result.output.validatesEarthTheory).toBe(false)
  })

  it('samples the analytic SG kink at ξ₀ and accepts RMS and energy vs 8/width', () => {
    expect(result.output.width).toBe(XI0_FM)
    expect(result.output.xi0Fm).toBe(0.15)
    expect(result.output.analyticEnergy).toBeCloseTo(8 / XI0_FM, 12)
    expect(result.output.numericalEnergy).toBeCloseTo(result.output.analyticEnergy, 5)
    expect(result.output.energyRelativeResidual).toBeLessThan(1e-8)
    expect(result.output.rmsResidual).toBeLessThan(1e-2)
    expect(result.output.theta[Math.floor(result.output.theta.length / 2)]).toBeCloseTo(Math.PI, 2)
    expect(result.output.topologicalWinding).toBe(1)
    expect(result.output.fractionalWinding).toBe(false)
    expect(result.output.prt003Blocked).toBe(true)
    expect(result.output.flags).toEqual(['topological-gate'])
    expect(result.output.topologicalWinding).not.toBe(CLAIMED_FRACTIONAL_WINDING)
    expect(result.output.topologicalWinding).not.toBe(-CLAIMED_FRACTIONAL_WINDING)
  })

  it('emits FLD-008 rows with Thad and Nassim missing and forbids fermion/Hopf labels', () => {
    const [sg, energy, winding] = result.predictions
    expect(result.predictions.map(({ claimId }) => claimId)).toEqual(['FLD-008-SG', 'FLD-008-E', 'FLD-008-W'])
    expect(sg).toMatchObject({
      claimId: 'FLD-008-SG',
      programId: 'EARTH-FLD-008',
      kernelId: 'sineGordonBenchmark',
      auditStatus: 'testable',
      earth: { evaluated: result.output.rmsResidual },
      sm: { value: 0 },
      thad: { value: null, status: 'missing' },
      nassim: { value: null, status: 'missing' },
      gate: { verdict: 'pass' },
      plainLanguage: 'toy SG kink at a width, not a fermion',
    })
    expect(sg?.thad.formula).toContain('Physics Monastery')
    expect(sg?.nassim.formula).toContain('Haramein')
    expect(sg?.discrepancy).toContain('FLD-010')
    expect(energy).toMatchObject({
      claimId: 'FLD-008-E',
      auditStatus: 'testable',
      sm: { value: result.output.analyticEnergy },
      earth: { evaluated: result.output.numericalEnergy },
      thad: { status: 'missing' },
      nassim: { status: 'missing' },
      gate: { verdict: 'pass' },
    })
    expect(winding).toMatchObject({
      claimId: 'FLD-008-W',
      auditStatus: 'blocked',
      earth: { printed: CLAIMED_FRACTIONAL_WINDING, evaluated: 1 },
      sm: { value: 1 },
      thad: { status: 'missing' },
      nassim: { status: 'missing' },
      gate: { verdict: 'fail' },
    })
    expect(winding?.discrepancy).toContain('topological-gate')
    expect(winding?.discrepancy).toContain('PRT-003')
    expect(winding?.discrepancy).toContain('no w=±2/3')
    expect(result.predictionLedger?.blockers.some((item) => item.includes('PRT-003'))).toBe(true)
  })

  it('matches the standalone kernel and the default simulation path', () => {
    const viaSimulation = runEarthSimulation('EARTH-FLD-008', {})
    expect(kernel.predictions).toEqual(result.predictions)
    expect(viaSimulation.predictions).toEqual(result.predictions)
    expect(viaSimulation.validatesEarthTheory).toBe(false)
    expect(viaSimulation.provenance.model).toContain('not a fermion')
  })
})
