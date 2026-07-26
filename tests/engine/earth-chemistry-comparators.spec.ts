import {
  CHEMISTRY_COMPARATOR_KERNELS,
  bondResidualComparator,
  canonicalHopfTextureDiagnostic,
  christoffelWaveSolver,
  coreLevelTransitionSpectrum,
  crystalPhonon1d,
  eosStandardComparison,
  geometryResidualComparator,
  jonesMalusComparator,
  kineticConductivityComparator,
  lorentzDielectricResponse,
  massWeightedHessianModes,
  oscillatorThermodynamics,
  pesStationaryBarrierAudit,
  planckSpectrumComparator,
  refractiveIndexTransform,
  shellHamiltonianEigenvalues,
  spectralDerivativeIntensities,
  transitionTemperatureResidualComparator,
  twoLevelElectronicSpectrum,
  twoSpinNmrSpectrum,
  undepletedPumpNonlinearEstimate,
  vanDerWaalsCoexistenceComparator,
  weightedSphericalObjective,
} from '../../src/engine/earth/chemistryComparators'

const REQUESTED_IDS = [
  'EARTH-CHEM-003',
  'EARTH-CHEM-005',
  'EARTH-CHEM-006',
  'EARTH-CHEM-008',
  'EARTH-CHEM-009',
  'EARTH-SPEC-002',
  'EARTH-SPEC-003',
  'EARTH-SPEC-004',
  'EARTH-SPEC-005',
  'EARTH-SPEC-006',
  'EARTH-MAT-001',
  'EARTH-MAT-002',
  'EARTH-MAT-003',
  'EARTH-MAT-005',
  'EARTH-MAT-007',
  'EARTH-MAT-008',
  'EARTH-MAT-009',
  'EARTH-THERM-002',
  'EARTH-THERM-004',
  'EARTH-THERM-005',
  'EARTH-THERM-008',
  'EARTH-THERM-009',
  'EARTH-THERM-010',
] as const

describe('EARTH chemistry and spectroscopy source-contract kernels', () => {
  it('computes supplied bond and geometry residual tables', () => {
    const bonds = bondResidualComparator({
      rows: [{ id: 'C-C', observedLength: 1.5, predictedLength: 1.6, observedEnergy: 4, predictedEnergy: 3 }],
    })
    const geometry = geometryResidualComparator({
      rows: [{ id: 'bent', observedAnglesDegrees: [100, 110], predictedAnglesDegrees: [101, 108] }],
    })

    expect(bonds.label).toBe('EARTH-CHEM-003')
    expect(bonds.output.rows[0]).toMatchObject({ lengthResidual: expect.closeTo(0.1, 14), energyResidual: -1 })
    expect(bonds.output.rmsLengthResidual).toBeCloseTo(0.1, 14)
    expect(geometry.label).toBe('EARTH-CHEM-005')
    expect(geometry.output.rows[0]?.residualsDegrees).toEqual([1, -2])
    expect(geometry.output.rmsAngleResidualDegrees).toBeCloseTo(Math.sqrt(2.5), 14)
  })

  it('evaluates the weighted spherical objective and finite shell spectrum', () => {
    const spherical = weightedSphericalObjective({ vectors: [[1, 0, 0], [-1, 0, 0]], weights: [2, 3] })
    const shell = shellHamiltonianEigenvalues({ matrix: [[2, 1], [1, 2]] })

    expect(spherical.label).toBe('EARTH-CHEM-006')
    expect(spherical.output.objective).toBeCloseTo(6, 14)
    expect(shell.label).toBe('EARTH-CHEM-008')
    expect(shell.output.eigenvalues).toEqual([expect.closeTo(1, 13), expect.closeTo(3, 13)])
    expect(shell.output.maximumResidual).toBeLessThan(1e-12)
  })

  it('audits sampled one-dimensional stationary points and barriers', () => {
    const result = pesStationaryBarrierAudit()

    expect(result.label).toBe('EARTH-CHEM-009')
    expect(result.output.stationary.map(({ kind }) => kind)).toEqual(['minimum', 'maximum', 'minimum'])
    expect(result.output.barriers[0]).toMatchObject({ forwardBarrier: 1, reverseBarrier: 1 })
  })

  it('solves supplied mass-weighted modes and derivative intensities', () => {
    const modes = massWeightedHessianModes({ hessian: [[1, -1], [-1, 1]], masses: [1, 1] })
    const intensities = spectralDerivativeIntensities({
      modes: [{ id: 'symmetric', frequency: 1, dipoleDerivative: [1, 0, 0], polarizabilityDerivative: [1, 1, 1, 0, 0, 0] }],
    })

    expect(modes.label).toBe('EARTH-SPEC-002')
    expect(modes.output.modes.map(({ eigenvalue }) => eigenvalue)).toEqual([expect.closeTo(0, 13), expect.closeTo(2, 13)])
    expect(modes.output.modes.map(({ character }) => character)).toEqual(['zero', 'vibrational'])
    expect(intensities.label).toBe('EARTH-SPEC-003')
    expect(intensities.output.modes[0]).toMatchObject({ infraredIntensity: 1, ramanActivity: 45, depolarizationRatio: 0 })
  })

  it('computes bounded two-level, two-spin, and core-level spectra', () => {
    const electronic = twoLevelElectronicSpectrum({ groundEnergy: 0, excitedEnergy: 3, transitionDipole: 2, linewidth: 0.1, samples: 9 })
    const nmr = twoSpinNmrSpectrum({ frequencyA: 100, frequencyB: 120, scalarCoupling: 10 })
    const core = coreLevelTransitionSpectrum({ transitions: [{ id: 'K', coreEnergy: -10, finalEnergy: 2, matrixElement: 0.5 }] })

    expect(electronic.label).toBe('EARTH-SPEC-004')
    expect(electronic.output.oscillatorStrength).toBe(8)
    expect(electronic.output.spectrum).toHaveLength(9)
    expect(nmr.label).toBe('EARTH-SPEC-005')
    expect(nmr.output.lines.map(({ frequency }) => frequency)).toEqual([95, 105, 115, 125])
    expect(core.label).toBe('EARTH-SPEC-006')
    expect(core.output.transitions[0]).toMatchObject({ energy: 12, relativeIntensity: 3 })
  })
})

describe('EARTH material standard-comparison kernels', () => {
  it('returns the conventional monatomic-chain dispersion', () => {
    const result = crystalPhonon1d({ mass: 1, springConstant: 1, latticeSpacing: 1, waveVectorSamples: 3 })

    expect(result.label).toBe('EARTH-MAT-001')
    expect(result.output.acousticVelocity).toBe(1)
    expect(result.output.dispersion.map(({ angularFrequency }) => angularFrequency)).toEqual([2, 0, 2])
  })

  it('solves the isotropic Christoffel problem without attributing a tensor to EARTH', () => {
    const result = christoffelWaveSolver({ density: 2, direction: [0, 0, 1], lambda: 2, shearModulus: 3 })

    expect(result.label).toBe('EARTH-MAT-002')
    expect(result.output.model).toBe('isotropic-standard-comparison')
    expect(result.output.modes.map(({ speed }) => speed)).toEqual([
      expect.closeTo(Math.sqrt(1.5), 13),
      expect.closeTo(Math.sqrt(1.5), 13),
      expect.closeTo(2, 13),
    ])
  })

  it('computes Lorentz response and its principal refractive transform', () => {
    const dielectric = lorentzDielectricResponse({ frequencies: [0], epsilonInfinity: 1, oscillators: [{ resonance: 1, strength: 1, damping: 0.1 }] })
    const refractive = refractiveIndexTransform({ samples: [{ frequency: 1, epsilon: { re: 2.25, im: 0 } }] })

    expect(dielectric.label).toBe('EARTH-MAT-003')
    expect(dielectric.output.response[0]?.epsilon).toEqual({ re: 2, im: 0 })
    expect(refractive.label).toBe('EARTH-MAT-005')
    expect(refractive.output.samples[0]).toMatchObject({ refractiveIndex: 1.5, extinctionCoefficient: 0, absorptionCoefficient: 0 })
  })

  it('reproduces Malus law and a positive undepleted-pump estimate', () => {
    const polarization = jonesMalusComparator({ inputAngleRadians: 0, analyzerAngleRadians: Math.PI / 4, retardanceRadians: 0 })
    const nonlinear = undepletedPumpNonlinearEstimate()

    expect(polarization.label).toBe('EARTH-MAT-007')
    expect(polarization.output.transmittedIntensity).toBeCloseTo(0.5, 14)
    expect(polarization.output.transmittedIntensity).toBeCloseTo(polarization.output.malusIntensityWithoutRetarder, 14)
    expect(nonlinear.label).toBe('EARTH-MAT-008')
    expect(nonlinear.output.phaseMatchingFactor).toBe(1)
    expect(nonlinear.output.conversionEfficiency).toBeGreaterThan(0)
  })

  it('samples only the canonical analytic Hopf texture diagnostic', () => {
    const result = canonicalHopfTextureDiagnostic({ gridPoints: 3, extent: 2 })

    expect(result.label).toBe('EARTH-MAT-009')
    expect(result.output.samples).toHaveLength(27)
    expect(result.output.maximumNormResidual).toBeLessThan(1e-14)
    expect(result.output).toMatchObject({ canonicalAnalyticHopfIndex: 1, relaxedMicromagneticState: false, stabilityTested: false })
  })
})

describe('EARTH thermodynamic standard-comparison kernels', () => {
  it('reports transition-temperature residuals with assignment state', () => {
    const result = transitionTemperatureResidualComparator({ rows: [{ id: 'sample', observedTemperature: 100, predictedTemperature: 110 }] })

    expect(result.label).toBe('EARTH-THERM-002')
    expect(result.output.rows[0]).toMatchObject({ residual: 10, relativeResidual: 0.1, assignmentFrozen: false })
    expect(result.output.allAssignmentsFrozen).toBe(false)
  })

  it('labels ideal and van der Waals EOS values as comparisons', () => {
    const result = eosStandardComparison({ temperature: 1, volume: 2, particles: 1, gasConstant: 1, attraction: 0, excludedVolume: 0 })

    expect(result.label).toBe('EARTH-THERM-004')
    expect(result.output.modelLabels).toEqual({ ideal: 'ideal-gas-standard-comparison', nonIdeal: 'van-der-Waals-standard-comparison' })
    expect(result.output.idealPressure).toBe(0.5)
    expect(result.output.vanDerWaalsPressure).toBe(0.5)
    expect(result.output.authenticatedWaterOrCo2Eos).toBe(false)
  })

  it('solves the reduced van der Waals Maxwell construction', () => {
    const result = vanDerWaalsCoexistenceComparator({ reducedTemperature: 0.85 })

    expect(result.label).toBe('EARTH-THERM-005')
    expect(result.output.modelLabel).toContain('not-EARTH-derived')
    expect(result.output.liquidVolume).toBeLessThan(result.output.unstableVolume)
    expect(result.output.unstableVolume).toBeLessThan(result.output.vaporVolume)
    expect(Math.abs(result.output.equalAreaResidual)).toBeLessThan(1e-11)
    expect(vanDerWaalsCoexistenceComparator({ reducedTemperature: 0.5 }).output.liquidVolume).toBeGreaterThan(1 / 3)
    expect(vanDerWaalsCoexistenceComparator({ reducedTemperature: 0.999 }).output.vaporVolume).toBeGreaterThan(1)
  })

  it('computes oscillator thermodynamics, Planck radiance, and kinetic conductivity', () => {
    const oscillator = oscillatorThermodynamics({ temperature: 300, modes: [{ frequencyHz: 1e12 }] })
    const planck = planckSpectrumComparator({ temperature: 300, frequencies: [1e12] })
    const conductivity = kineticConductivityComparator({
      dimensions: 3,
      modes: [{ id: 'mode', volumetricHeatCapacity: 1, groupVelocity: 2, meanFreePath: 3 }],
    })

    expect(oscillator.label).toBe('EARTH-THERM-008')
    expect(oscillator.output.partitionFunction).toBeGreaterThan(0)
    expect(oscillator.output.heatCapacity).toBeGreaterThan(0)
    expect(oscillator.output).toMatchObject({ constantPressureHeatCapacityAvailable: false, latentHeatAvailable: false })
    expect(planck.label).toBe('EARTH-THERM-009')
    expect(planck.output.spectrum[0]?.spectralRadiance).toBeGreaterThan(0)
    expect(conductivity.label).toBe('EARTH-THERM-010')
    expect(conductivity.output.conductivity).toBe(2)
    expect(conductivity.output.uncertaintyAvailable).toBe(false)
  })
})

describe('EARTH chemistry comparator provenance, determinism, and bounds', () => {
  it('covers every requested ID and never makes an EARTH validation claim', () => {
    expect(Object.keys(CHEMISTRY_COMPARATOR_KERNELS)).toEqual(REQUESTED_IDS)

    for (const id of REQUESTED_IDS) {
      const result = CHEMISTRY_COMPARATOR_KERNELS[id]()
      expect(result.label).toBe(id)
      expect(result.method.length).toBeGreaterThan(10)
      expect(result.diagnostics).toMatchObject({
        provenanceKind: 'comparison',
        benchmarkLabel: 'conventional-normalized-benchmark',
        blockerRetained: true,
        sourceContractAvailable: false,
        earthMaterialLawUsed: false,
        earthValidationClaim: false,
        validatesTheory: false,
        validationClaim: 'none',
        deterministic: true,
      })
      expect(result.diagnostics.blocker).toEqual(expect.any(String))
      expect(result).toEqual(CHEMISTRY_COMPARATOR_KERNELS[id]())
    }
  })

  it('rejects malformed, non-finite, singular, and unbounded inputs', () => {
    expect(() => bondResidualComparator({ rows: [{ id: 'x', observedLength: Number.NaN, predictedLength: 1 }] })).toThrow('must be finite')
    expect(() => geometryResidualComparator({ rows: [{ id: 'x', observedAnglesDegrees: [90], predictedAnglesDegrees: [] }] })).toThrow('equal lengths')
    expect(() => weightedSphericalObjective({ vectors: [[1, 0, 0], [1, 0, 0]] })).toThrow('coincident directions')
    expect(() => shellHamiltonianEigenvalues({ matrix: [[1, 2], [3, 4]] })).toThrow('must be symmetric')
    expect(() => massWeightedHessianModes({ hessian: [[1]], masses: [0] })).toThrow('must be from')
    expect(() => christoffelWaveSolver({ direction: [0, 0, 0] })).toThrow('non-zero norm')
    expect(() => eosStandardComparison({ volume: 1, particles: 2, excludedVolume: 0.5 })).toThrow('must exceed')
    expect(() => canonicalHopfTextureDiagnostic({ gridPoints: 34 })).toThrow('integer from 3 to 33')
    expect(() => crystalPhonon1d({ waveVectorSamples: 100_000 })).toThrow('integer from 3 to 4097')
    expect(() => planckSpectrumComparator({ frequencies: [] })).toThrow('must contain 1 to 4097 entries')
  })
})
