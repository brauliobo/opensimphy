import {
  ATOMIC_NUCLEUS_MODEL_IDS,
  ATOMIC_SPECTRAL_SERIES,
  ATOMIC_SPECTRUM_BOUNDS,
  evaluateAtomicSpectrum,
  projectAtomicSpectrumTable,
  type AtomicSpectrumInput,
} from '../../src/tour/atomicSpectrumEngine'
import {
  evaluateParticleScale,
  PARTICLE_MOMENTUM_MODE_IDS,
  PARTICLE_SCALE_BOUNDS,
  PARTICLE_SCALE_CATALOG,
  PARTICLE_SCALE_IDS,
  projectParticleScaleTable,
  type ParticleScaleInput,
} from '../../src/tour/particleScaleEngine'
import {
  evaluateSpinPrecession,
  projectSpinPrecessionTable,
  SPIN_PRECESSION_BOUNDS,
  SPIN_PRECESSION_PARTICLE_IDS,
  SPIN_PRECESSION_PARTICLES,
  SPIN_PRECESSION_PRESET_IDS,
  SPIN_PRECESSION_PRESETS,
  type SpinPrecessionInput,
} from '../../src/tour/spinPrecessionEngine'

function relativeError(actual: number, expected: number): number {
  return Math.abs((actual - expected) / expected)
}

function expectFiniteNumbers(value: unknown): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value)).toBe(true)
    return
  }
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) expectFiniteNumbers(nested)
  }
}

describe('Tour atomic-spectrum engine', () => {
  const hydrogenInput: AtomicSpectrumInput = {
    atomicNumber: 1,
    nUpper: 3,
    nLower: 2,
    nucleusModel: 'proton',
  }

  it('computes conventional H-alpha and Lyman-alpha Rydberg values', () => {
    const hAlpha = evaluateAtomicSpectrum(hydrogenInput)
    const lymanAlpha = evaluateAtomicSpectrum({ ...hydrogenInput, nUpper: 2, nLower: 1 })

    expect(relativeError(hAlpha.vacuumWavelengthNm, 656.47)).toBeLessThan(5e-4)
    expect(relativeError(lymanAlpha.vacuumWavelengthNm, 121.568)).toBeLessThan(5e-4)
    expect(hAlpha.label).toBe('Balmer-alpha')
    expect(hAlpha.series).toBe('Balmer')
    expect(hAlpha.visible).toBe(true)
    expect(hAlpha.spectralRegion).toBe('visible')
    expect(lymanAlpha.label).toBe('Lyman-alpha')
    expect(lymanAlpha.series).toBe('Lyman')
    expect(lymanAlpha.visible).toBe(false)
    expect(lymanAlpha.spectralRegion).toBe('ultraviolet')
    expect(relativeError(hAlpha.energyJ, hAlpha.frequencyHz * 6.626_070_15e-34)).toBeLessThan(1e-15)
  })

  it('applies the proton reduced mass in the correct direction', () => {
    const infinite = evaluateAtomicSpectrum({ ...hydrogenInput, nucleusModel: 'infinite' })
    const proton = evaluateAtomicSpectrum(hydrogenInput)

    expect(proton.reducedMassFactor).toBeLessThan(1)
    expect(proton.effectiveRydbergMInverse).toBeLessThan(infinite.effectiveRydbergMInverse)
    expect(proton.energyJ).toBeLessThan(infinite.energyJ)
    expect(proton.frequencyHz).toBeLessThan(infinite.frequencyHz)
    expect(proton.vacuumWavelengthM).toBeGreaterThan(infinite.vacuumWavelengthM)
  })

  it('names the three conventional series and exposes a bounded accessible table', () => {
    expect(ATOMIC_SPECTRAL_SERIES.map(({ id, nLower }) => ({ id, nLower }))).toEqual([
      { id: 'Lyman', nLower: 1 },
      { id: 'Balmer', nLower: 2 },
      { id: 'Paschen', nLower: 3 },
    ])
    const result = evaluateAtomicSpectrum({ atomicNumber: 1, nUpper: 4, nLower: 3, nucleusModel: 'infinite' })
    const table = projectAtomicSpectrumTable(result)

    expect(result.series).toBe('Paschen')
    expect(result.lineSeriesTable).toHaveLength(9)
    expect(result.lineSeriesTable.length).toBeLessThanOrEqual(ATOMIC_SPECTRUM_BOUNDS.maxLineSeriesRows)
    expect(table[0]).toMatchObject({ transition: '4 -> 3', series: 'Paschen', spectralRegion: 'infrared' })
    expect(table.every(({ energyEv, frequencyHz, vacuumWavelengthNm }) => energyEv > 0 && frequencyHz > 0 && vacuumWavelengthNm > 0)).toBe(true)
  })

  it('enforces every atomic ID and quantum-number bound', () => {
    expect(ATOMIC_NUCLEUS_MODEL_IDS).toEqual(['infinite', 'proton'])
    expect(() => evaluateAtomicSpectrum({ ...hydrogenInput, atomicNumber: 0 })).toThrow('atomicNumber must be within [1, 10]')
    expect(() => evaluateAtomicSpectrum({ ...hydrogenInput, atomicNumber: 11 })).toThrow('atomicNumber must be within [1, 10]')
    expect(() => evaluateAtomicSpectrum({ ...hydrogenInput, atomicNumber: 1.5 })).toThrow('atomicNumber must be an integer')
    expect(() => evaluateAtomicSpectrum({ ...hydrogenInput, nUpper: 13 })).toThrow('nUpper must be within [2, 12]')
    expect(() => evaluateAtomicSpectrum({ ...hydrogenInput, nLower: 3 })).toThrow('nLower must be within [1, nUpper - 1]')
    expect(() => evaluateAtomicSpectrum({ ...hydrogenInput, nucleusModel: 'deuteron' } as unknown as AtomicSpectrumInput)).toThrow('Unknown atomic spectrum nucleus model: deuteron')
    expect(() => evaluateAtomicSpectrum(null as unknown as AtomicSpectrumInput)).toThrow('input must be an object')
  })

  it('states the Bohr/Rydberg, selection-rule, Hamiltonian, and validation limits', () => {
    const result = evaluateAtomicSpectrum(hydrogenInput)
    const caveats = result.finding.caveats.join(' ')

    expect(result.finding.assumptions.join(' ')).toContain('Bohr/Rydberg')
    expect(caveats).toContain('selection rules')
    expect(caveats).toContain('Hamiltonian')
    expect(result.finding.doesNotEstablish).toContain('empirically validate')
    expect(result.finding.evidenceRefs).toEqual(['openstax-university-physics-v3', 'codata-2022'])
    expect(result.finding.validatesTheory).toBe(false)
  })
})

describe('Tour particle-scale engine', () => {
  it('publishes the bounded catalog in increasing mass order', () => {
    expect(PARTICLE_SCALE_IDS).toEqual(['electron', 'muon', 'proton', 'neutron'])
    expect(PARTICLE_MOMENTUM_MODE_IDS).toEqual(['mass-times-c', 'si'])
    expect(PARTICLE_SCALE_CATALOG.map(({ id }) => id)).toEqual(PARTICLE_SCALE_IDS)
    expect(PARTICLE_SCALE_CATALOG.map(({ massKg }) => massKg)).toEqual([...PARTICLE_SCALE_CATALOG.map(({ massKg }) => massKg)].sort((a, b) => a - b))
    expect(PARTICLE_SCALE_CATALOG.map(({ composition }) => composition)).toEqual(['elementary', 'elementary', 'composite', 'composite'])
  })

  it('computes known electron rest and Compton scales with dependent representations', () => {
    const result = evaluateParticleScale({ particle: 'electron', momentumMode: 'mass-times-c', momentumMultiplier: 1 })

    expect(relativeError(result.restEnergyEv, 510_998.95)).toBeLessThan(1e-7)
    expect(relativeError(result.comptonWavelengthM, 2.426_310_235e-12)).toBeLessThan(1e-8)
    expect(relativeError(result.reducedComptonWavelengthM, 3.861_592_675e-13)).toBeLessThan(1e-8)
    expect(relativeError(result.comptonWavelengthM, 2 * Math.PI * result.reducedComptonWavelengthM)).toBeLessThan(1e-15)
    expect(result.deBroglieWavelengthM).toBe(result.comptonWavelengthM)
    expect(relativeError(result.relativisticTotalEnergyJ, Math.SQRT2 * result.restEnergyJ)).toBeLessThan(1e-15)
    expect(result.massRatioToElectron).toBe(1)

    const table = projectParticleScaleTable(result)
    expect(table).toHaveLength(7)
    expect(table.filter(({ dependency }) => dependency === 'momentum state-derived').map(({ quantity }) => quantity)).toEqual([
      'Momentum',
      'de Broglie wavelength',
      'Relativistic total energy',
    ])
  })

  it('keeps mass-derived scales fixed while de Broglie wavelength follows momentum', () => {
    const slow = evaluateParticleScale({ particle: 'proton', momentumMode: 'mass-times-c', momentumMultiplier: 0.5 })
    const fast = evaluateParticleScale({ particle: 'proton', momentumMode: 'mass-times-c', momentumMultiplier: 2 })
    const explicit = evaluateParticleScale({ particle: 'proton', momentumMode: 'si', momentumSi: fast.momentumKgMPerS })

    expect(fast.massKg).toBe(slow.massKg)
    expect(fast.comptonWavelengthM).toBe(slow.comptonWavelengthM)
    expect(relativeError(slow.deBroglieWavelengthM / fast.deBroglieWavelengthM, 4)).toBeLessThan(1e-15)
    expect(explicit.momentumMultiplier).toBeCloseTo(2, 14)
    expect(explicit.deBroglieWavelengthM).toBe(fast.deBroglieWavelengthM)
    expect(fast.relativisticTotalEnergyJ).toBeGreaterThan(slow.relativisticTotalEnergyJ)
  })

  it('preserves expected particle mass, energy, and wavelength ordering', () => {
    const results = PARTICLE_SCALE_IDS.map((particle) => evaluateParticleScale({
      particle,
      momentumMode: 'mass-times-c',
      momentumMultiplier: 1,
    }))

    expect(results.map(({ restEnergyJ }) => restEnergyJ)).toEqual([...results.map(({ restEnergyJ }) => restEnergyJ)].sort((a, b) => a - b))
    expect(results.map(({ comptonWavelengthM }) => comptonWavelengthM)).toEqual([...results.map(({ comptonWavelengthM }) => comptonWavelengthM)].sort((a, b) => b - a))
    expect(results[2].massRatioToProton).toBe(1)
    expect(results[3].massRatioToProton).toBeGreaterThan(1)
  })

  it('enforces momentum modes and finite inclusive bounds', () => {
    expect(evaluateParticleScale({ particle: 'electron', momentumMode: 'mass-times-c', momentumMultiplier: PARTICLE_SCALE_BOUNDS.momentumMultiplier.min }).relativisticKineticEnergyJ).toBeGreaterThan(0)
    expectFiniteNumbers(evaluateParticleScale({ particle: 'neutron', momentumMode: 'si', momentumSi: PARTICLE_SCALE_BOUNDS.momentumSi.min }))
    expect(() => evaluateParticleScale({ particle: 'tau', momentumMode: 'mass-times-c', momentumMultiplier: 1 } as unknown as ParticleScaleInput)).toThrow('Unknown particle scale particle: tau')
    expect(() => evaluateParticleScale({ particle: 'electron', momentumMode: 'velocity', momentumMultiplier: 1 } as unknown as ParticleScaleInput)).toThrow('Unknown particle scale momentum mode: velocity')
    expect(() => evaluateParticleScale({ particle: 'electron', momentumMode: 'mass-times-c', momentumMultiplier: 1e-7 })).toThrow('momentumMultiplier must be within')
    expect(() => evaluateParticleScale({ particle: 'electron', momentumMode: 'si', momentumSi: Number.POSITIVE_INFINITY })).toThrow('momentumSi must be finite')
    expect(() => evaluateParticleScale(null as unknown as ParticleScaleInput)).toThrow('input must be an object')
  })

  it('distinguishes invariant-mass scales from momentum state and empirical claims', () => {
    const finding = evaluateParticleScale({ particle: 'muon', momentumMode: 'mass-times-c', momentumMultiplier: 3 }).finding
    const caveats = finding.caveats.join(' ')

    expect(caveats).toContain('mass-derived')
    expect(caveats).toContain('state-dependent')
    expect(caveats).toContain('dependent representations')
    expect(finding.doesNotEstablish).toContain('independent measurements')
    expect(finding.evidenceRefs).toEqual(['openstax-university-physics-v3', 'codata-2022'])
    expect(finding.validatesTheory).toBe(false)
  })
})

describe('Tour spin-precession engine', () => {
  const protonInput: SpinPrecessionInput = {
    particle: 'proton',
    magneticFieldTesla: 1,
    timeSeconds: 1e-6,
    sampleCount: 8,
  }

  it('retains signed cyclic ratios and converts cyclic to angular frequency once', () => {
    const proton = evaluateSpinPrecession(protonInput)
    const electron = evaluateSpinPrecession({ ...protonInput, particle: 'electron' })
    const muon = evaluateSpinPrecession({ ...protonInput, particle: 'muon' })

    expect(relativeError(proton.signedCyclicFrequencyHz, 42.577_478_461e6)).toBeLessThan(1e-15)
    expect(proton.signedCyclicFrequencyHz).toBeGreaterThan(0)
    expect(electron.signedCyclicFrequencyHz).toBeLessThan(0)
    expect(muon.signedCyclicFrequencyHz).toBeLessThan(0)
    expect(proton.angularFrequencyRadPerSecond).toBe(2 * Math.PI * proton.signedCyclicFrequencyHz)
    expect(electron.angularFrequencyRadPerSecond).toBe(2 * Math.PI * electron.signedCyclicFrequencyHz)
    expect(proton.phaseRadians).toBe(-proton.angularFrequencyRadPerSecond * proton.timeSeconds)
    expect(electron.phaseRadians).toBe(-electron.angularFrequencyRadPerSecond * electron.timeSeconds)
    expect(proton.phaseCycles).toBe(-proton.signedCyclicFrequencyHz * proton.timeSeconds)
    expect(proton.rotationSense).toBe('clockwise')
    expect(electron.rotationSense).toBe('counterclockwise')

    const protonQuarterTurn = evaluateSpinPrecession({ ...protonInput, timeSeconds: proton.periodSeconds / 4, sampleCount: 2 })
    const electronQuarterTurn = evaluateSpinPrecession({ ...protonInput, particle: 'electron', timeSeconds: electron.periodSeconds / 4, sampleCount: 2 })
    expect(protonQuarterTurn.samples.at(-1)?.y).toBeCloseTo(-1, 14)
    expect(electronQuarterTurn.samples.at(-1)?.y).toBeCloseTo(1, 14)
  })

  it('scales linearly with field and reports a positive reciprocal period', () => {
    const oneTesla = evaluateSpinPrecession(protonInput)
    const threeTesla = evaluateSpinPrecession({ ...protonInput, magneticFieldTesla: 3 })
    const electron = evaluateSpinPrecession({ ...protonInput, particle: 'electron' })

    expect(threeTesla.signedCyclicFrequencyHz).toBe(3 * oneTesla.signedCyclicFrequencyHz)
    expect(relativeError(threeTesla.angularFrequencyRadPerSecond, 3 * oneTesla.angularFrequencyRadPerSecond)).toBeLessThan(2e-16)
    expect(relativeError(threeTesla.phaseRadians, 3 * oneTesla.phaseRadians)).toBeLessThan(2e-16)
    expect(relativeError(oneTesla.periodSeconds, 1 / Math.abs(oneTesla.signedCyclicFrequencyHz))).toBeLessThan(1e-15)
    expect(electron.periodSeconds).toBeGreaterThan(0)
    expect(electron.periodSeconds).toBe(1 / electron.cyclicFrequencyMagnitudeHz)
  })

  it('emits at most 128 deterministic unit-circle samples including both endpoints', () => {
    const result = evaluateSpinPrecession({ ...protonInput, sampleCount: 128 })
    const table = projectSpinPrecessionTable(result)

    expect(result.samples).toHaveLength(128)
    expect(table).toHaveLength(128)
    expect(table[0]).toEqual({ sample: 0, timeSeconds: 0, phaseRadians: 0, x: 1, y: 0 })
    expect(table.at(-1)?.timeSeconds).toBe(protonInput.timeSeconds)
    expect(table.at(-1)?.phaseRadians).toBe(result.phaseRadians)
    expect(table.every(({ x, y }) => Math.abs(x ** 2 + y ** 2 - 1) < 3e-16)).toBe(true)
  })

  it('publishes bounded conventional presets without treating them as observations', () => {
    expect(SPIN_PRECESSION_PARTICLE_IDS).toEqual(['electron', 'proton', 'muon'])
    expect(SPIN_PRECESSION_PARTICLES.map(({ signedCyclicGammaHzPerTesla }) => Math.sign(signedCyclicGammaHzPerTesla))).toEqual([-1, 1, -1])
    expect(SPIN_PRECESSION_PRESET_IDS).toEqual(['earth-ish', 'proton-nmr-1t', 'proton-nmr-3t', 'electron-resonance'])
    expect(SPIN_PRECESSION_PRESETS.map(({ input }) => input.magneticFieldTesla)).toEqual([50e-6, 1, 3, 0.34])
    expect(SPIN_PRECESSION_PRESETS.every(({ description }) => description.length > 0)).toBe(true)
    expect(SPIN_PRECESSION_PRESETS.every(({ input }) => {
      expectFiniteNumbers(evaluateSpinPrecession(input))
      return true
    })).toBe(true)
  })

  it('enforces field, time, sample, and particle bounds', () => {
    expect(evaluateSpinPrecession({ ...protonInput, magneticFieldTesla: SPIN_PRECESSION_BOUNDS.magneticFieldTesla.min }).signedCyclicFrequencyHz).toBeGreaterThan(0)
    expect(evaluateSpinPrecession({ ...protonInput, magneticFieldTesla: SPIN_PRECESSION_BOUNDS.magneticFieldTesla.max }).signedCyclicFrequencyHz).toBeGreaterThan(0)
    expect(() => evaluateSpinPrecession({ ...protonInput, magneticFieldTesla: 0 })).toThrow('magneticFieldTesla must be within [0.000001, 20]')
    expect(() => evaluateSpinPrecession({ ...protonInput, magneticFieldTesla: Number.NaN })).toThrow('magneticFieldTesla must be finite')
    expect(() => evaluateSpinPrecession({ ...protonInput, timeSeconds: 10.01 })).toThrow('timeSeconds must be within [0, 10]')
    expect(() => evaluateSpinPrecession({ ...protonInput, sampleCount: 129 })).toThrow('sampleCount must be within [2, 128]')
    expect(() => evaluateSpinPrecession({ ...protonInput, sampleCount: 3.5 })).toThrow('sampleCount must be an integer')
    expect(() => evaluateSpinPrecession({ ...protonInput, particle: 'neutron' } as unknown as SpinPrecessionInput)).toThrow('Unknown spin precession particle: neutron')
    expect(() => evaluateSpinPrecession(null as unknown as SpinPrecessionInput)).toThrow('input must be an object')
  })

  it('states sign, moment-field, environment, and empirical-validation limits', () => {
    const finding = evaluateSpinPrecession(protonInput).finding
    const caveats = finding.caveats.join(' ')

    expect(finding.equation).toContain('gamma/(2 pi)')
    expect(finding.equation).toContain('phi(t) = -omega t')
    expect(finding.assumptions.join(' ')).toContain('positive z axis')
    expect(caveats).toContain('positive gamma gives clockwise')
    expect(caveats).toContain('negative gamma gives counterclockwise')
    expect(caveats).toContain('relaxation')
    expect(caveats).toContain('material response')
    expect(finding.doesNotEstablish).toContain('observed resonance')
    expect(finding.evidenceRefs).toEqual(['openstax-university-physics-v3', 'codata-2022'])
    expect(finding.validatesTheory).toBe(false)
  })
})

describe('Tour atomic, particle, and spin engine contracts', () => {
  it('is finite, deterministic, input-preserving, result-independent, and catalog-immutable', () => {
    const atomicInput: AtomicSpectrumInput = { atomicNumber: 10, nUpper: 12, nLower: 1, nucleusModel: 'proton' }
    const particleInput: ParticleScaleInput = { particle: 'neutron', momentumMode: 'si', momentumSi: 1e-20 }
    const spinInput: SpinPrecessionInput = { particle: 'electron', magneticFieldTesla: 20, timeSeconds: 10, sampleCount: 128 }
    const inputsBefore = structuredClone([atomicInput, particleInput, spinInput])
    const first = [evaluateAtomicSpectrum(atomicInput), evaluateParticleScale(particleInput), evaluateSpinPrecession(spinInput)]
    const second = [evaluateAtomicSpectrum(atomicInput), evaluateParticleScale(particleInput), evaluateSpinPrecession(spinInput)]

    expect([atomicInput, particleInput, spinInput]).toEqual(inputsBefore)
    expect(first).toEqual(second)
    expect(first.every((result, index) => result !== second[index])).toBe(true)
    for (const result of first) expectFiniteNumbers(result)
    for (const result of first) {
      expect(result.finding).toMatchObject({
        methodRelationship: 'not-applicable',
        modelOrigin: 'established-physics',
        resultStatus: 'computed',
        validatesTheory: false,
      })
    }

    const firstAtomic = first[0] as ReturnType<typeof evaluateAtomicSpectrum>
    firstAtomic.lineSeriesTable[0].energyJ = 0
    firstAtomic.finding.assumptions[0] = 'caller mutation'
    expect(evaluateAtomicSpectrum(atomicInput)).toEqual(second[0])

    expect([
      ATOMIC_NUCLEUS_MODEL_IDS,
      ATOMIC_SPECTRAL_SERIES,
      ATOMIC_SPECTRUM_BOUNDS,
      PARTICLE_SCALE_IDS,
      PARTICLE_SCALE_CATALOG,
      PARTICLE_SCALE_BOUNDS,
      SPIN_PRECESSION_PARTICLE_IDS,
      SPIN_PRECESSION_PARTICLES,
      SPIN_PRECESSION_PRESET_IDS,
      SPIN_PRECESSION_PRESETS,
      SPIN_PRECESSION_BOUNDS,
    ].every(Object.isFrozen)).toBe(true)
    expect(PARTICLE_SCALE_CATALOG.every(Object.isFrozen)).toBe(true)
    expect(SPIN_PRECESSION_PRESETS.every((preset) => Object.isFrozen(preset) && Object.isFrozen(preset.input))).toBe(true)
  })
})
