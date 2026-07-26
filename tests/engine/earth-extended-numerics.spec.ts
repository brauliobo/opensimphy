import { EarthCancellationError } from '../../src/engine/earth/common'
import {
  decoherenceScalingSweep,
  fixedPointRecognizabilityAudit,
  fresnelInterfaceSolver,
  kramersKronigAudit,
  trefoilTubeComparison,
} from '../../src/engine/earth/extendedNumerics'

describe('EARTH extended bounded audits', () => {
  it('audits the literal substitution without promoting symbolic equivalence to physical equivalence', () => {
    const first = fixedPointRecognizabilityAudit({ iterations: 10 })
    const second = fixedPointRecognizabilityAudit({ iterations: 10 })

    expect(first).toEqual(second)
    expect(first.label).toBe('EARTH-FND-006')
    expect(first.output.oneSided.exactPrefixFixed).toBe(true)
    expect(first.output.oneSided.prefix).toHaveLength(1024)
    expect(first.output.primitivity).toMatchObject({ primitive: true, minimumPositivePower: 3 })
    expect(first.output.twoSided).toMatchObject({
      fixedUnderSingleSubstitution: false,
      minimumSubstitutionPower: 3,
    })
    expect(first.output.inverseParsing.filter(({ unique }) => unique).map(({ offset }) => offset)).toEqual([0])
    expect(first.diagnostics.physicalEquivalence).toBe('blocked')
    expect(first.diagnostics.earthValidationClaim).toBe(false)
    expect(first.output.theoremScope).toContain('no physical-vacuum')
  })

  it('converges for the standard elastic trefoil and obeys geometric scaling', () => {
    const coarse = trefoilTubeComparison({ samples: 128, scale: 1, tubeRadius: 0.1, bendingRigidity: 2 })
    const fine = trefoilTubeComparison({ samples: 256, scale: 1, tubeRadius: 0.1, bendingRigidity: 2 })
    const doubled = trefoilTubeComparison({ samples: 256, scale: 2, tubeRadius: 0.1, bendingRigidity: 2 })

    const coarseLengthError = Math.abs(coarse.output.polygonalLength - coarse.output.quadratureLength)
    const fineLengthError = Math.abs(fine.output.polygonalLength - fine.output.quadratureLength)
    expect(fineLengthError).toBeLessThan(coarseLengthError / 3.9)
    expect(doubled.output.quadratureLength).toBeCloseTo(2 * fine.output.quadratureLength, 12)
    expect(doubled.output.bendingEnergy).toBeCloseTo(fine.output.bendingEnergy / 2, 12)
    expect(fine.output.tubeVolume).toBeCloseTo(Math.PI * 0.1 ** 2 * fine.output.quadratureLength, 12)
    expect(fine.diagnostics.fieldRelaxationPerformed).toBe(false)
    expect(fine.diagnostics.topologyValidationClaim).toBe(false)
  })

  it('derives scaling from the finite-step FLD-005 parameters and records conflicting claims', () => {
    const inputs = {
      densities: [0.25, 0.5, 1, 2, 4],
      temperatures: [0.5, 1, 2],
      diffusion: { reference: 0, densityExponent: 0, temperatureExponent: 0 },
      damping: { reference: 1, densityExponent: 1, temperatureExponent: 0 },
      noise: { reference: 1, densityExponent: 0, temperatureExponent: 0.5 },
      mode: 0,
      timeStep: 0.002,
      steps: 10_000,
      claimedVarianceExponents: { density: 0, temperature: 0, tolerance: 0.1 },
    }
    const first = decoherenceScalingSweep(inputs)
    const second = decoherenceScalingSweep(inputs)

    expect(first).toEqual(second)
    expect(first.output.formula).toContain('g_m=[1+dt*')
    expect(first.output.points).toHaveLength(15)
    expect(first.output.fittedVarianceExponents.density).toBeCloseTo(-1, 2)
    expect(first.output.fittedVarianceExponents.temperature).toBeCloseTo(1, 12)
    expect(first.output.conflicts.map(({ variable }) => variable)).toEqual(['density', 'temperature'])
    expect(first.diagnostics.dimensionalCalibrationAvailable).toBe(false)
  })

  it('converges on the Lorentz Kramers-Kronig benchmark and accepts an explicit spectrum', () => {
    const coarse = kramersKronigAudit({
      lorentz: { samples: 257, maximumFrequency: 20 },
      edgeExclusion: 8,
    })
    const fine = kramersKronigAudit({
      lorentz: { samples: 513, maximumFrequency: 20 },
      edgeExclusion: 16,
    })
    expect(fine.output.rmsResidual).toBeLessThan(coarse.output.rmsResidual)
    expect(fine.output.rmsResidual).toBeLessThan(2e-3)

    const frequencies = Array.from({ length: 257 }, (_, index) => 20 * index / 256)
    const real: number[] = []
    const imaginary: number[] = []
    for (const frequency of frequencies) {
      const detuning = 4 - frequency ** 2
      const loss = 0.4 * frequency
      const denominator = detuning ** 2 + loss ** 2
      real.push(0.25 + detuning / denominator)
      imaginary.push(loss / denominator)
    }
    const supplied = kramersKronigAudit({
      spectrum: { frequencies, real, imaginary, highFrequencyLimit: 0.25 },
      edgeExclusion: 8,
    })
    expect(supplied.output.source).toBe('user-spectrum')
    expect(supplied.output.rmsResidual).toBeCloseTo(coarse.output.rmsResidual, 14)
    expect(supplied.diagnostics.causalModelValidationClaim).toBe(false)
  })

  it('matches normal-incidence, Brewster-angle, and total-internal-reflection Fresnel benchmarks', () => {
    const normal = fresnelInterfaceSolver()
    expect(normal.output.polarizations.map(({ reflectance }) => reflectance)).toEqual([
      expect.closeTo(0.04, 14),
      expect.closeTo(0.04, 14),
    ])
    expect(normal.output.polarizations.every(({ transmittance }) => Math.abs(transmittance - 0.96) < 1e-14)).toBe(true)
    expect(normal.diagnostics.allEnergyChecksPass).toBe(true)

    const absorbing = fresnelInterfaceSolver({
      transmittedIndex: { re: 1.5, im: 0.2 },
      incidenceAngleRadians: Math.PI / 6,
      polarization: 'both',
    })
    expect(absorbing.output.transmittedCosine.im).toBeGreaterThan(0)
    expect(absorbing.output.polarizations.every(({ energyBalanceResidual }) => energyBalanceResidual < 1e-14)).toBe(true)

    const brewster = fresnelInterfaceSolver({ incidenceAngleRadians: Math.atan(1.5), polarization: 'p' })
    expect(brewster.output.polarizations[0]?.reflectance).toBeLessThan(1e-29)
    expect(brewster.output.polarizations[0]?.energyBalanceResidual).toBeLessThan(1e-14)

    const totalInternalReflection = fresnelInterfaceSolver({
      incidentIndex: { re: 1.5, im: 0 },
      transmittedIndex: { re: 1, im: 0 },
      incidenceAngleRadians: Math.PI / 3,
      polarization: 'both',
    })
    expect(totalInternalReflection.output.transmittedCosine.im).toBeGreaterThan(0)
    expect(totalInternalReflection.output.polarizations.every(({ reflectance, transmittance, energyBalanced }) => (
      Math.abs(reflectance - 1) < 1e-14 && transmittance === 0 && energyBalanced
    ))).toBe(true)
  })

  it('labels every result as non-validating comparison work', () => {
    const results = [
      fixedPointRecognizabilityAudit(),
      trefoilTubeComparison({ samples: 64 }),
      decoherenceScalingSweep(),
      kramersKronigAudit({ lorentz: { samples: 65 }, edgeExclusion: 2 }),
      fresnelInterfaceSolver(),
    ]
    expect(results.map(({ label }) => label)).toEqual([
      'EARTH-FND-006',
      'EARTH-GEO-004',
      'EARTH-FLD-006',
      'EARTH-MAT-004',
      'EARTH-MAT-006',
    ])
    expect(results.every(({ diagnostics }) => (
      diagnostics.earthValidationClaim === false && diagnostics.physicalEquivalence === 'blocked'
    ))).toBe(true)
  })

  it('enforces bounds and cooperative cancellation on iterative kernels', () => {
    expect(() => fixedPointRecognizabilityAudit({ iterations: 19 })).toThrow('iterations must be an integer from 3 to 18')
    expect(() => trefoilTubeComparison({ samples: 63 })).toThrow('samples must be an integer from 64 to 16384')
    expect(() => decoherenceScalingSweep({ densities: [1, 2] })).toThrow('densities must contain 3 to 64 values')
    expect(() => kramersKronigAudit({ lorentz: { samples: 32 } })).toThrow('lorentz.samples must be an integer from 33 to 2049')
    expect(() => fresnelInterfaceSolver({ incidenceAngleRadians: Math.PI / 2 })).toThrow('incidenceAngleRadians')

    const cancelled = { isCancelled: () => true }
    expect(() => fixedPointRecognizabilityAudit({}, cancelled)).toThrow(EarthCancellationError)
    expect(() => trefoilTubeComparison({}, cancelled)).toThrow(EarthCancellationError)
    expect(() => decoherenceScalingSweep({}, cancelled)).toThrow(EarthCancellationError)
    expect(() => kramersKronigAudit({}, cancelled)).toThrow(EarthCancellationError)
  })
})
