import { EarthCancellationError } from '../../src/engine/earth/common'
import {
  EARTH_PHYSICAL_COMPARATOR_DEFAULTS,
  EARTH_PHYSICAL_COMPARATORS,
  cutAndProjectComparison,
  dispersionContractAudit,
  eventCoincidencePermutationAudit,
  finiteDifferenceHessianAudit,
  goldenScaleResidualAudit,
  hadronObservableContractAudit,
  hopfEnergyComparison,
  hopfFluxComparison,
  kinkEigenmodeComparison,
  layeredElasticWaveComparison,
  nuclearMassResidualAudit,
  radialLoopPotentialComparison,
  scalarCollapseComparison,
  strandGeometryComparison,
  structureFactorComparison,
  weightedGraphMetricAudit,
  wkbBarrierComparison,
} from '../../src/engine/earth/physicalComparators'

const IDS = [
  'EARTH-FND-009',
  'EARTH-FND-012',
  'EARTH-FND-013',
  'EARTH-GEO-001',
  'EARTH-GEO-002',
  'EARTH-GEO-003',
  'EARTH-GEO-005',
  'EARTH-FLD-002',
  'EARTH-FLD-003',
  'EARTH-FLD-004',
  'EARTH-FLD-009',
  'EARTH-NUC-002',
  'EARTH-NUC-003',
  'EARTH-NUC-005',
  'EARTH-PRT-002',
  'EARTH-PRT-003',
  'EARTH-PRT-004',
] as const

const BLOCKERS = {
  'EARTH-FND-009': 'Needs frozen density/length datasets.',
  'EARTH-FND-012': 'BX until points, edges, and inverse rules are defined.',
  'EARTH-FND-013': 'Data-blocked; exact selection protocol and authenticated catalogs are absent.',
  'EARTH-GEO-001': 'BX: projector matrices and window coordinates are absent.',
  'EARTH-GEO-002': 'Depends on GEO-001 and licensed/open data.',
  'EARTH-GEO-003': 'BX: no embedding or objective function.',
  'EARTH-GEO-005': 'BX until the map and cell boundaries are supplied.',
  'EARTH-FLD-002': 'BX until normalization/domain/BCs are source-locked; cannot report Hopf charge.',
  'EARTH-FLD-003': 'No verified execution adapter or immutable offline artifact is available.',
  'EARTH-FLD-004': 'Depends on a solved background.',
  'EARTH-FLD-009': 'BX: no EARTH elastic tensor or grain law.',
  'EARTH-NUC-002': 'BX: mapping and pairing function are absent.',
  'EARTH-NUC-003': 'BX: no barrier, rate law, or weak-transition operator.',
  'EARTH-NUC-005': 'BX: published action does not support the claimed topology or parton observables.',
  'EARTH-PRT-002': 'BX: `k`, `r_0`, coupling, and topology are undefined.',
  'EARTH-PRT-003': 'BX: normalization and fractional-winding mechanism absent.',
  'EARTH-PRT-004': 'Depends on FLD background and a gauge model.',
} as const

describe('bounded independent EARTH physical comparators', () => {
  it('computes foundational residual, graph, and permutation audits from explicit inputs', () => {
    const scales = goldenScaleResidualAudit({
      observations: [{ id: 'four', observed: 4, reference: 1 }],
      ratio: 2,
      exponentMinimum: -2,
      exponentMaximum: 3,
    })
    expect(scales.output.observations[0]).toMatchObject({ nearestExponent: 2, fittedScale: 4, relativeResidual: 0 })
    expect(scales.diagnostics.ratioDerivedFromTargets).toBe(false)

    const graph = weightedGraphMetricAudit()
    expect(graph.output.distances[0]?.[2]).toBe(2)
    expect(graph.output.axioms).toEqual({ positive: true, identity: true, symmetric: true, triangle: true })

    const coincidence = eventCoincidencePermutationAudit({ permutations: 64, seed: 7 })
    expect(coincidence.output.nullCoincidences).toHaveLength(64)
    expect(coincidence.output.upperTailPValue).toBeGreaterThan(0)
    expect(coincidence.output.upperTailPValue).toBeLessThanOrEqual(1)
    expect(coincidence.diagnostics.authenticatedCatalogsAvailable).toBe(false)
  })

  it('runs explicit projection, structure-factor, strand, and canonical flux comparators', () => {
    const projected = cutAndProjectComparison()
    expect(projected.output.accepted).toHaveLength(4)
    expect(projected.output.rejectedCount).toBe(1)

    const structure = structureFactorComparison()
    expect(structure.output.samples.map(({ intensity }) => intensity)).toEqual([
      expect.closeTo(2, 14),
      expect.closeTo(0, 14),
      expect.closeTo(2, 14),
    ])

    const strands = strandGeometryComparison({ strandCount: 3, samples: 65, radius: 1, pitchPerTurn: 0, turns: 1 })
    expect(strands.output.closed).toBe(true)
    expect(strands.output.strands[0]?.polygonalLength).toBeCloseTo(2 * Math.PI, 2)
    expect(strands.output.minimumSampledSeparation).toBeCloseTo(Math.sqrt(3), 12)
    expect(strands.diagnostics.knotTypeClaim).toBe(false)

    const flux = hopfFluxComparison({ polarCells: 32, azimuthalCells: 64 })
    expect(flux.output.firstChernEstimate).toBeCloseTo(1, 3)
    expect(flux.output.samples.every(({ hopfImage }) => Math.abs(Math.hypot(...hopfImage) - 1) < 1e-14)).toBe(true)
    expect(flux.diagnostics.perCellEarthFluxClaim).toBe(false)
  })

  it('runs normalized field, Hessian, and layered-wave comparisons without EARTH attribution', () => {
    const collapse = scalarCollapseComparison({ radialPoints: 65, radialMaximum: 12, timeStep: 0.001, steps: 200, initialRadius: 4 })
    expect(collapse.output.history.at(-1)?.energy).toBeLessThan(collapse.output.history[0]!.energy)
    expect(['collapsed', 'contracting']).toContain(collapse.output.finding)
    expect(collapse.diagnostics.hopfChargeReported).toBe(false)

    const hopf = hopfEnergyComparison({ gridPoints: 9, halfWidth: 3 })
    expect(hopf.output.sigmaEnergy).toBeGreaterThan(0)
    expect(hopf.output.skyrmeEnergy).toBeGreaterThan(0)
    expect(hopf.output.maximumUnitNormResidual).toBeLessThan(1e-14)

    const hessian = finiteDifferenceHessianAudit({
      objective: ([x, y]) => x! ** 2 + 2 * y! ** 2 + x! * y!,
      point: [0, 0],
      step: 1e-3,
    })
    expect(hessian.output.hessian[0]).toEqual([expect.closeTo(2, 8), expect.closeTo(1, 8)])
    expect(hessian.output.hessian[1]).toEqual([expect.closeTo(1, 8), expect.closeTo(4, 8)])
    expect(hessian.diagnostics.eigenvalueClaim).toBe(false)

    const waves = layeredElasticWaveComparison({
      layers: [{ density: 1, modulus: 4, thickness: 1 }],
      frequencies: [0],
      incidentImpedance: 2,
      loadImpedance: 4,
    })
    expect(waves.output.spectrum[0]?.reflectance).toBeCloseTo(1 / 9, 14)
    expect(waves.output.spectrum[0]?.transmittance).toBeCloseTo(8 / 9, 14)
    expect(waves.diagnostics.earthElasticTensorAvailable).toBe(false)
  })

  it('audits supplied nuclear masses, a generic WKB barrier, and hadron table requirements', () => {
    const masses = nuclearMassResidualAudit({
      records: [{ id: 'x', protonNumber: 2, neutronNumber: 2, predictedMass: 4.01, observedMass: 4, observedUncertainty: 0.005 }],
    })
    expect(masses.output.records[0]).toMatchObject({ massNumber: 4, residual: expect.closeTo(0.01, 12), standardizedResidual: expect.closeTo(2, 12) })
    expect(masses.diagnostics.ameDatasetBundled).toBe(false)

    const barrier = wkbBarrierComparison()
    expect(barrier.output.actionIntegral).toBeCloseTo(3 * Math.SQRT2 / 2, 12)
    expect(barrier.output.transmission).toBeCloseTo(Math.exp(-3 * Math.SQRT2), 12)
    expect(barrier.output.decayRate).toBeNull()

    const hadrons = hadronObservableContractAudit({
      records: [{ id: 'radius', observable: 'charge radius', unit: 'fm', predicted: 0.85, observed: 0.84, uncertainty: 0.01 }],
    })
    expect(hadrons.output.records[0]).toMatchObject({ requirementsSatisfied: true, standardizedResidual: expect.closeTo(1, 12) })
    expect(hadrons.output.unsatisfiedRequirements).toContain('valid finite-energy action')
    expect(hadrons.diagnostics.modelContractSatisfied).toBe(false)
    expect(hadrons.diagnostics.physicalFieldOutputProduced).toBe(false)
  })

  it('minimizes supplied radial data, samples standard kink modes, and audits supplied dispersion', () => {
    const radial = radialLoopPotentialComparison()
    expect(radial.output.sampledMinimum).toMatchObject({ radius: 2, potential: 0 })
    expect(radial.output.quadraticMinimum).toMatchObject({ radius: expect.closeTo(2, 14), curvature: expect.closeTo(2, 14) })
    expect(radial.diagnostics.equilibriumAttributedToEarth).toBe(false)

    const kink = kinkEigenmodeComparison({ samples: 513, halfWidth: 10 })
    expect(kink.output.modes.map(({ analyticEigenvalue }) => analyticEigenvalue)).toEqual([0, 3])
    expect(kink.output.modes.every(({ residual }) => Math.abs(residual) < 0.002)).toBe(true)
    expect(kink.output.continuumThreshold).toBe(4)

    const dispersion = dispersionContractAudit({
      points: [{ waveNumber: 0, omegaSquared: 1 }, { waveNumber: 1, omegaSquared: -1 }, { waveNumber: 2, omegaSquared: 9 }],
    })
    expect(dispersion.output.unstableCount).toBe(1)
    expect(dispersion.output.points[1]).toMatchObject({ omega: null, stable: false, groupVelocity: null })
    expect(dispersion.output.unsatisfiedRequirements).toContain('declared gauge constraints')
    expect(dispersion.diagnostics.physicalSpectrumProduced).toBe(false)
  })

  it('exports exactly 17 deterministic defaults and retains every known blocker without validation claims', () => {
    expect(Object.keys(EARTH_PHYSICAL_COMPARATOR_DEFAULTS)).toEqual(IDS)
    expect(Object.keys(EARTH_PHYSICAL_COMPARATORS)).toEqual(IDS)

    const first = IDS.map((id) => EARTH_PHYSICAL_COMPARATORS[id]())
    const second = IDS.map((id) => EARTH_PHYSICAL_COMPARATORS[id]())
    expect(first).toEqual(second)
    for (const item of first) {
      expect(item.diagnostics).toMatchObject({
        earthBlocker: BLOCKERS[item.id],
        earthBlockerRetained: true,
        earthModelStatus: 'blocked',
        earthValidationClaim: false,
        validatesEarthTheory: false,
      })
      expect(['standard-comparison', 'source-contract-audit']).toContain(item.diagnostics.kernelKind)
      expect(String(item.diagnostics.benchmarkLabel)).toContain('not-EARTH-derived')
    }
  })

  it('enforces hard work bounds and cooperative cancellation', () => {
    expect(() => goldenScaleResidualAudit({ exponentMinimum: 4, exponentMaximum: 3 })).toThrow('exponentMaximum')
    expect(() => weightedGraphMetricAudit({ nodes: Array.from({ length: 65 }, (_, index) => String(index)), edges: [] })).toThrow('nodes must contain 1 to 64')
    expect(() => eventCoincidencePermutationAudit({ eventSequence: Array(4096).fill(0), catalogSequence: Array(4096).fill(0), permutations: 1000 })).toThrow('permutation work')
    expect(() => structureFactorComparison({ points: Array.from({ length: 1001 }, () => [0, 0, 0]), waveVectors: Array.from({ length: 2000 }, () => [0, 0, 0]) })).toThrow('structure-factor work')
    expect(() => scalarCollapseComparison({ radialPoints: 513, steps: 20_000 })).toThrow('scalar relaxation work')
    expect(() => hopfEnergyComparison({ gridPoints: 42 })).toThrow('gridPoints')
    expect(() => layeredElasticWaveComparison({ layers: [], frequencies: [1] })).toThrow('layers must contain 1 to 128')
    expect(() => nuclearMassResidualAudit({ records: [] })).toThrow('records must contain 1 to 4096')
    expect(() => wkbBarrierComparison({ positions: [0, 1, 1], potential: [2, 2, 2] })).toThrow('strictly increasing')
    expect(() => radialLoopPotentialComparison({ radii: [1, 1, 2], potential: [1, 0, 1] })).toThrow('strictly increasing')
    expect(() => kinkEigenmodeComparison({ samples: 32 })).toThrow('samples must be an integer from 33 to 4097')
    expect(() => dispersionContractAudit({ points: [{ waveNumber: 1, omegaSquared: 1 }, { waveNumber: 1, omegaSquared: 2 }] })).toThrow('strictly increasing')

    const cancelled = { isCancelled: () => true }
    for (const kernel of Object.values(EARTH_PHYSICAL_COMPARATORS)) {
      expect(() => kernel({}, cancelled)).toThrow(EarthCancellationError)
    }
  })
})
