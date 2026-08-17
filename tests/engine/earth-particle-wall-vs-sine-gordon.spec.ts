import { getDefaultEarthMethodId, runEarthMethod, runEarthSimulation } from '../../src/engine/earth'
import { wallVsSineGordon } from '../../src/engine/earth/particle/wallVsSineGordon'

describe('EARTH-FLD-010 wall potential vs sine-Gordon', () => {
  const inputs = { theta: [0, Math.PI / 2, Math.PI] }
  const kernel = wallVsSineGordon(inputs)
  const result = runEarthMethod('EARTH-FLD-010', getDefaultEarthMethodId('EARTH-FLD-010'), inputs)

  it('keeps the runEarthMethod envelope and does not validate EARTH', () => {
    expect(result).toMatchObject({
      schemaVersion: 2,
      programId: 'EARTH-FLD-010',
      methodId: 'earth-source-reproduction-v1',
      status: 'completed',
      validatesEarthTheory: false,
    })
    expect(result.predictionLedger?.validatesEarthTheory).toBe(false)
    expect(result.predictionLedger?.scientificStatus).toBe('audit')
    expect(result.diagnostics.equivalentToSineGordon).toBe(false)
    expect(result.diagnostics.plainLanguage).toContain('not sine-Gordon')
  })

  it('shows 2(1-cos θ)sin θ ≠ sin θ and a large sine-Gordon gap', () => {
    expect(result.output.samples[1]).toMatchObject({
      analyticDerivative: expect.closeTo(2, 12),
      sineGordonDerivative: expect.closeTo(1, 12),
      differenceFromSineGordon: expect.closeTo(1, 12),
    })
    expect(2 * (1 - Math.cos(Math.PI / 2)) * Math.sin(Math.PI / 2)).not.toBeCloseTo(Math.sin(Math.PI / 2), 12)
    expect(result.output.maximumSineGordonDifference).toBeGreaterThan(0.5)
    expect(result.output.maximumFiniteDifferenceResidual).toBeLessThan(1e-9)
  })

  it('emits earth-prediction/v1 rows with Thad and Nassim missing', () => {
    const [sg, fd] = result.predictions
    expect(sg).toMatchObject({
      claimId: 'FLD-010-SG',
      programId: 'EARTH-FLD-010',
      kernelId: 'wall-vs-sine-gordon',
      auditStatus: 'falsified',
      earth: { printed: 0, evaluated: result.output.maximumSineGordonDifference },
      sm: { value: 0, source: 'sine-Gordon V=1-cos θ, V\'=sin θ' },
      thad: { value: null, status: 'missing' },
      nassim: { value: null, status: 'missing' },
      gate: { verdict: 'fail' },
    })
    expect(sg?.thad.formula).toContain('Physics Monastery')
    expect(sg?.nassim.formula).toContain('Haramein')
    expect(sg?.plainLanguage).toContain('not sine-Gordon')
    expect(sg?.discrepancy).toContain('≠')
    expect(fd).toMatchObject({
      claimId: 'FLD-010-FD',
      auditStatus: 'testable',
      thad: { status: 'missing' },
      nassim: { status: 'missing' },
      gate: { verdict: 'pass' },
    })
    expect(fd?.earth.evaluated).toBeLessThan(1e-9)
  })

  it('matches the standalone kernel and the default simulation path', () => {
    const viaSimulation = runEarthSimulation('EARTH-FLD-010', inputs)
    expect(kernel.predictions).toEqual(result.predictions)
    expect(viaSimulation.predictions).toEqual(result.predictions)
    expect(viaSimulation.validatesEarthTheory).toBe(false)
  })
})
