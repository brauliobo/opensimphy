import { EarthCancellationError } from '../../src/engine/earth/common'
import {
  DEFAULT_ACTION_POTENTIAL_WAVEFORM_INPUTS,
  DEFAULT_AGGREGATE_SURVIVAL_THRESHOLD_INPUTS,
  DEFAULT_AXON_KINK_PROPAGATION_INPUTS,
  DEFAULT_BLIND_SPECTRUM_PROTOCOL_INPUTS,
  DEFAULT_CONNECTOME_EIGENMODE_INPUTS,
  DEFAULT_DNA_TWIST_WRITHE_ENERGY_INPUTS,
  DEFAULT_FINITE_MARKOV_STATE_GRAPH_INPUTS,
  DEFAULT_PROTEIN_ANGLE_RESIDUAL_INPUTS,
  DEFAULT_PROTEIN_RIBBON_SINE_GORDON_INPUTS,
  DEFAULT_SEVEN_POINT_EIGHT_THREE_HZ_AUDIT_INPUTS,
  actionPotentialWaveformResidual,
  aggregateSurvivalThresholdHazardCalculator,
  axonKinkPropagationComparison,
  blindSpectrumProtocolAudit,
  connectomeEigenmodeComparison,
  dnaTwistWritheEnergyComparison,
  finiteMarkovStateGraph,
  proteinAngleResidualAudit,
  proteinRibbonSineGordonComparison,
  sevenPointEightThreeHzSpectralAudit,
} from '../../src/engine/earth/bioNeuroComparators'

describe('EARTH bounded biology comparison kernels', () => {
  it('BIO-002 solves the corrected normalized elastic-ribbon equation', () => {
    const result = proteinRibbonSineGordonComparison()

    expect(result.output.equation).toBe('A*d2theta/ds2=U*sin(theta)')
    expect(result.output.normalization.width).toBe(1)
    expect(result.output.maximumNormalizedResidual).toBeLessThan(1e-3)
    expect(result.output.rootMeanSquareNormalizedResidual).toBeLessThan(5e-4)
    expect(result.output.analyticEnergy).toBe(8)
    expect(result.output.energyRelativeResidual).toBeLessThan(1e-6)
    expect(result.output.totalTwistRadians).toBeCloseTo(2 * Math.PI, 3)
    expect(result.diagnostics).toMatchObject({ id: 'EARTH-BIO-002', correctedEulerLagrangeEquation: true, validatesTheory: false })
  })

  it('BIO-003 computes circular user-supplied angle and pitch residuals', () => {
    const result = proteinAngleResidualAudit()
    const wrapped = result.output.records.find(({ id }) => id === 'synthetic-wrap')!

    expect(wrapped).toMatchObject({ phiResidualDegrees: -2, psiResidualDegrees: 2 })
    expect(wrapped.angularResidualDegrees).toBeCloseTo(Math.sqrt(8), 12)
    expect(result.output.rootMeanSquarePitchResidualAngstrom).toBe(0)
    expect(result.diagnostics).toMatchObject({ id: 'EARTH-BIO-003', bundledBiologicalRecords: false, sequenceInference: false })
  })

  it('BIO-005 preserves link=twist+writhe and uses standard twistable-rod energy', () => {
    const result = dnaTwistWritheEnergyComparison()
    const expectedTwistEnergy = 0.5 * 75 * 340 * (2 * Math.PI * -3 / 340) ** 2

    expect(result.output).toMatchObject({ excessLinkingNumber: -5, twist: -3, writhe: -2, closureResidual: 0 })
    expect(result.output.twistEnergyKbt).toBeCloseTo(expectedTwistEnergy, 12)
    expect(result.output.totalEnergyKbt).toBeCloseTo(result.output.bendingEnergyKbt + expectedTwistEnergy, 12)
    expect(result.diagnostics).toMatchObject({ id: 'EARTH-BIO-005', earthDerivedStiffness: false })
  })

  it('BIO-006 propagates a finite explicit-rate Markov graph and accounts for energy', () => {
    const result = finiteMarkovStateGraph()

    expect(result.output.states).toHaveLength(3)
    expect(result.output.transitions).toHaveLength(4)
    expect(result.output.occupancyNormalizationResidual).toBeLessThan(1e-12)
    expect(result.output.states.reduce((sum, state) => sum + state.finalOccupancy, 0)).toBeCloseTo(1, 12)
    expect(result.output.expectedEnergyKbt).toBeGreaterThan(0)
    expect(result.diagnostics).toMatchObject({ id: 'EARTH-BIO-006', explicitRatesRequired: true, sourceRateLawAvailable: false })
  })
})

describe('EARTH bounded neuroscience comparison kernels', () => {
  it('NEURO-001 reports only normalized kink propagation and node transmission metrics', () => {
    const result = axonKinkPropagationComparison()
    const final = result.output.trajectory.at(-1)!

    expect(result.output.lorentzFactor).toBeCloseTo(1.25, 12)
    expect(result.output.movingWidth).toBeCloseTo(0.8, 12)
    expect(result.output.normalizedEnergy).toBeCloseTo(10, 12)
    expect(final).toMatchObject({ center: expect.closeTo(0.8, 12), crossedNodes: 1, transmittedEnergy: expect.closeTo(9, 12) })
    expect(result.diagnostics).toMatchObject({ id: 'EARTH-NEURO-001', normalizedOnly: true, physicalVoltageMapAvailable: false })
  })

  it('NEURO-002 scores a waveform against a fixed unfitted HH-like comparator', () => {
    const result = actionPotentialWaveformResidual()

    expect(result.output.samples).toHaveLength(65)
    expect(result.output.rootMeanSquareResidualMv).toBeGreaterThan(0)
    expect(result.output.rootMeanSquareResidualMv).toBeLessThan(0.3)
    expect(result.output.dataScope).toBe('synthetic')
    expect(result.diagnostics).toMatchObject({ id: 'EARTH-NEURO-002', fittedToWaveform: false, rawWaveformRetained: false })
  })

  it('NEURO-003 computes sorted bounded weighted-graph eigenmodes', () => {
    const result = connectomeEigenmodeComparison()
    const eigenvalues = result.output.modes.map(({ eigenvaluePerSecondSquared }) => eigenvaluePerSecondSquared)

    expect(result.output.connected).toBe(true)
    expect(result.output.modes).toHaveLength(4)
    expect(eigenvalues[0]).toBeLessThan(1e-9)
    expect(eigenvalues).toEqual([...eigenvalues].sort((left, right) => left - right))
    expect(result.output.modes.every(({ vector }) => vector.length === 4)).toBe(true)
    expect(result.output.offDiagonalResidual).toBeLessThan(1e-8)
    expect(result.diagnostics).toMatchObject({ id: 'EARTH-NEURO-003', stateIndependentLinearModesOnly: true })
  })

  it('NEURO-004 audits supplied 7.83-Hz power against local and red-noise comparators without significance', () => {
    const result = sevenPointEightThreeHzSpectralAudit()

    expect(result.output.targetFrequencyHz).toBe(7.83)
    expect(result.output.exactTargetPower).toBeGreaterThan(result.output.localBackgroundPower)
    expect(result.output.localPowerRatio).toBeGreaterThan(1)
    expect(result.output.significanceClaim).toBe('none')
    expect(result.output.caveats.join(' ')).toContain('red-noise')
    expect(result.diagnostics).toMatchObject({ id: 'EARTH-NEURO-004', multipleComparisonCorrectionApplied: false, crossSubjectInference: false })
  })

  it('NEURO-005 calculates hazards only under an aggregate synthetic threshold contract', () => {
    const result = aggregateSurvivalThresholdHazardCalculator()
    const expectedSurvival = (1 - 4 / 100) * (1 - 5 / 94) * (1 - 6 / 86)

    expect(result.output.cumulativeSurvival).toBeCloseTo(expectedSurvival, 14)
    expect(result.output.aggregateHazardRatioAboveToBelow).toBeGreaterThan(1)
    expect(result.output.contract).toMatchObject({
      dataScope: 'aggregate-synthetic',
      operationalBiomarkerValidated: false,
      individualPredictionAllowed: false,
    })
    expect(result.diagnostics).toMatchObject({ id: 'EARTH-NEURO-005', individualRecordsAccepted: false, diseasePrediction: false })
  })
})

describe('EARTH-X-005 blind spectrum contract', () => {
  it('scores only held-out targets with the pre-frozen mapping', () => {
    const result = blindSpectrumProtocolAudit()

    expect(result.output.accepted).toBe(true)
    expect(result.output.violations).toEqual([])
    expect(result.output.heldOutResiduals).toEqual([
      { id: 'target-a', predictedValue: 7, targetValue: 7.1, residual: expect.closeTo(0.1, 12), relativeResidual: expect.closeTo(0.1 / 7.1, 12) },
      { id: 'target-b', predictedValue: 9, targetValue: 8.8, residual: expect.closeTo(-0.2, 12), relativeResidual: expect.closeTo(0.2 / 8.8, 12) },
    ])
    expect(result.output.heldOutRootMeanSquareResidual).toBeCloseTo(Math.sqrt(0.025), 12)
    expect(result.output.validationClaim).toBe('none')
    expect(result.diagnostics).toMatchObject({ id: 'EARTH-X-005', targetExclusionEnforced: true, targetContainingCalibration: false })
  })

  it('withholds held-out residuals when the blind protocol was not frozen', () => {
    const result = blindSpectrumProtocolAudit({
      ...DEFAULT_BLIND_SPECTRUM_PROTOCOL_INPUTS,
      mappingFrozenBeforeTargetAccess: false,
    })

    expect(result.output.accepted).toBe(false)
    expect(result.output.violations).toContain('mapping-not-frozen-before-target-access')
    expect(result.output.heldOutResiduals).toEqual([])
    expect(result.output.heldOutRootMeanSquareResidual).toBeNull()
  })

  it('refuses every declared target-containing calibration path', () => {
    expect(() => blindSpectrumProtocolAudit({
      ...DEFAULT_BLIND_SPECTRUM_PROTOCOL_INPUTS,
      calibration: [{ id: 'bad', spectrumValue: 1, referenceValue: 3, containsHeldOutTarget: true }],
    })).toThrow('contains a held-out target')
    expect(() => blindSpectrumProtocolAudit({
      ...DEFAULT_BLIND_SPECTRUM_PROTOCOL_INPUTS,
      calibration: [{ id: 'bad', spectrumValue: 1, referenceValue: 3, targetIdsUsed: ['target-a'] }],
    })).toThrow('target-containing calibration is refused')
    expect(() => blindSpectrumProtocolAudit({
      ...DEFAULT_BLIND_SPECTRUM_PROTOCOL_INPUTS,
      calibration: [{ id: 'target-a', spectrumValue: 1, referenceValue: 3 }],
    })).toThrow('calibration contains held-out target id')
  })
})

describe('EARTH bio/neuro defaults, bounds, cancellation, and ethics', () => {
  const kernels = [
    proteinRibbonSineGordonComparison,
    proteinAngleResidualAudit,
    dnaTwistWritheEnergyComparison,
    finiteMarkovStateGraph,
    axonKinkPropagationComparison,
    actionPotentialWaveformResidual,
    connectomeEigenmodeComparison,
    sevenPointEightThreeHzSpectralAudit,
    aggregateSurvivalThresholdHazardCalculator,
    blindSpectrumProtocolAudit,
  ]

  it('exports defaults and returns deterministic results for every final blocked ID', () => {
    expect(DEFAULT_PROTEIN_RIBBON_SINE_GORDON_INPUTS.gridPoints).toBe(513)
    expect(DEFAULT_PROTEIN_ANGLE_RESIDUAL_INPUTS.dataScope).toBe('synthetic')
    expect(DEFAULT_DNA_TWIST_WRITHE_ENERGY_INPUTS.excessLinkingNumber).toBe(-5)
    expect(DEFAULT_FINITE_MARKOV_STATE_GRAPH_INPUTS.states).toHaveLength(3)
    expect(DEFAULT_AXON_KINK_PROPAGATION_INPUTS.normalizedSpeed).toBe(0.6)
    expect(DEFAULT_ACTION_POTENTIAL_WAVEFORM_INPUTS.samples).toHaveLength(65)
    expect(DEFAULT_CONNECTOME_EIGENMODE_INPUTS.nodeIds).toHaveLength(4)
    expect(DEFAULT_SEVEN_POINT_EIGHT_THREE_HZ_AUDIT_INPUTS.samples).toHaveLength(512)
    expect(DEFAULT_AGGREGATE_SURVIVAL_THRESHOLD_INPUTS.dataScope).toBe('aggregate-synthetic')
    expect(DEFAULT_BLIND_SPECTRUM_PROTOCOL_INPUTS.heldOut).toHaveLength(2)

    for (const kernel of kernels) expect(kernel()).toEqual(kernel())
  })

  it('publishes privacy, ethical, and non-medical diagnostics for every kernel', () => {
    for (const kernel of kernels) {
      expect(kernel().diagnostics).toMatchObject({
        validatesTheory: false,
        validatesBiology: false,
        medicalAdvice: false,
        medicalValidation: false,
        clinicalUse: false,
        personalDataStored: false,
        hiddenNetworkOrData: false,
      })
    }
  })

  it('rejects unbounded, non-finite, raw-scope, and individual-data requests', () => {
    expect(() => proteinRibbonSineGordonComparison({ gridPoints: 8194 })).toThrow('gridPoints must be an integer from 33 to 8193')
    expect(() => proteinAngleResidualAudit({ dataScope: 'raw-personal' as never })).toThrow('dataScope must be synthetic or deidentified-aggregate')
    expect(() => dnaTwistWritheEnergyComparison({ contourLengthNm: Number.NaN })).toThrow('contourLengthNm must be finite')
    expect(() => finiteMarkovStateGraph({ integrationSteps: 20_001 })).toThrow('integrationSteps must be an integer from 1 to 20000')
    expect(() => axonKinkPropagationComparison({ normalizedSpeed: 1 })).toThrow('normalizedSpeed must be within [-0.999, 0.999]')
    expect(() => actionPotentialWaveformResidual({ samples: [] })).toThrow('samples must contain 8 to 8192 entries')
    expect(() => connectomeEigenmodeComparison({ nodeIds: ['a', 'b'], edges: [] })).toThrow('edges must contain 1 to 4096 entries')
    expect(() => sevenPointEightThreeHzSpectralAudit({ samples: Array(63).fill(0) })).toThrow('samples must contain 64 to 16384 entries')
    expect(() => aggregateSurvivalThresholdHazardCalculator({ dataScope: 'individual' as never })).toThrow('individual or clinical records are not accepted')
    expect(() => blindSpectrumProtocolAudit({ complexityMatchedNulls: 10_001 })).toThrow('complexityMatchedNulls must be an integer from 1 to 10000')
  })

  it('supports cancellation in bounded numerical work', () => {
    expect(() => proteinRibbonSineGordonComparison({}, { isCancelled: () => true })).toThrow(EarthCancellationError)
    expect(() => finiteMarkovStateGraph({}, { isCancelled: () => true })).toThrow(EarthCancellationError)
    expect(() => connectomeEigenmodeComparison({}, { isCancelled: () => true })).toThrow(EarthCancellationError)
    expect(() => sevenPointEightThreeHzSpectralAudit({}, { isCancelled: () => true })).toThrow(EarthCancellationError)
  })
})
