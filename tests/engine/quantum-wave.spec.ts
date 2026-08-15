import {
  evaluateComplexWave,
  evaluateFourier,
  evaluateHydrogenMaterials,
  evaluateOperator,
  evaluateProbability,
  evaluateSpectrum,
  evaluateStandingWave,
} from '../../src/quantum-wave/quantumWaveEngine'

describe('quantum-wave teaching engine', () => {
  it('connects a hydrogen level difference to the Balmer-alpha line', () => {
    const result = evaluateSpectrum({ element: 'hydrogen', upperLevel: 3, lowerLevel: 2 })

    expect(result.selected.wavelengthNm).toBeCloseTo(656.1, 0)
    expect(result.selected.energyEv).toBeGreaterThan(1)
    expect(result.lines).toHaveLength(5)
    expect(result.levels).toHaveLength(8)
  })

  it('selects only declared reference lines for non-hydrogen catalog views', () => {
    const sodium = evaluateSpectrum({ element: 'sodium', upperLevel: 3, lowerLevel: 2, catalogIndex: 1 })
    const calcium = evaluateSpectrum({ element: 'calcium', upperLevel: 3, lowerLevel: 2, catalogIndex: 2 })

    expect(sodium.lines).toHaveLength(2)
    expect(sodium.selected.label).toBe('D1')
    expect(calcium.lines).toHaveLength(3)
    expect(calcium.selected.label).toBe('g')
  })

  it('keeps nodes fixed while standing-wave phase changes', () => {
    const result = evaluateStandingWave({ amplitude: 1, modeNumber: 4, period: 2, time: 0.5 })

    expect(result.nodes).toEqual([0, 2, 4, 6, 8])
    expect(result.antinodes).toHaveLength(4)
    expect(result.wavelength).toBe(4)
    expect(result.points[0]!.y).toBeCloseTo(0)
    expect(result.points[40]!.y).toBeCloseTo(0)
  })

  it('shows the pure-wave second derivative as a predictable kinetic scale', () => {
    const result = evaluateOperator({ kind: 'pure', wavelength: 4, packetWidth: 1.5 })
    const central = result.points.find((point) => Math.abs(point.x) < 0.01)

    expect(result.momentumMagnitude).toBeGreaterThan(0)
    expect(result.pureWaveKineticEigenvalueJ).toBeGreaterThan(0)
    expect(central).toBeDefined()
    expect(central!.curvature).toBeCloseTo(0, 2)
    expect(central!.kineticOperatorActionJ).toBeCloseTo(0, 20)
    expect(result.table).toHaveLength(9)
  })

  it('improves the finite square-wave approximation as components are added', () => {
    const one = evaluateFourier({ componentCount: 1 })
    const many = evaluateFourier({ componentCount: 9 })

    expect(many.highestHarmonic).toBe(17)
    expect(many.rmse).toBeLessThan(one.rmse)
    expect(many.components).toHaveLength(9)
  })

  it('keeps complex magnitude fixed while a real exponential grows', () => {
    const complex = evaluateComplexWave({ mode: 'complex', time: Math.PI, waveNumber: 1, growthRate: 0.2 })
    const real = evaluateComplexWave({ mode: 'real', time: Math.PI, waveNumber: 1, growthRate: 0.2 })

    expect(complex.vector.magnitude).toBeCloseTo(1)
    expect(complex.magnitudeRange.minimum).toBeCloseTo(1)
    expect(complex.magnitudeRange.maximum).toBeCloseTo(1)
    expect(real.vector.magnitude).toBeGreaterThan(1)
    expect(real.magnitudeRange.maximum).toBeGreaterThan(real.magnitudeRange.minimum)
  })

  it('normalizes a coherent two-slit distribution and exposes a deterministic table', () => {
    const result = evaluateProbability({ wavelength: 1, slitSeparation: 1.4, screenDistance: 8, shots: 240, coherent: true })

    expect(result.totalProbability).toBeCloseTo(1)
    expect(result.screen).toHaveLength(161)
    expect(result.table).toHaveLength(11)
    expect(result.screen.some((point) => point.counts > 0)).toBe(true)
    expect(result.screen.reduce((total, point) => total + point.counts, 0)).toBe(result.shots)
  })

  it('keeps orbital density and band-gap views explicitly schematic', () => {
    const orbital = evaluateHydrogenMaterials({ mode: '2p', bandGapEv: 1.1 })
    const bands = evaluateHydrogenMaterials({ mode: 'bands', bandGapEv: 2.2 })

    expect(orbital.orbital).toHaveLength(625)
    expect(orbital.orbital.some((point) => point.probability > 0)).toBe(true)
    expect(orbital.orbital.find((point) => point.x === 0 && point.y === 0)?.probability).toBe(0)
    expect(bands.bands).toHaveLength(3)
    expect(bands.finding).toContain('2.20 eV')
    expect(bands.bands[1]!.y - bands.bands[1]!.height).toBeGreaterThan(bands.bands[0]!.y)
    expect(bands.bands[2]!.y - bands.bands[2]!.height).toBeGreaterThan(bands.bands[1]!.y)
  })
})
