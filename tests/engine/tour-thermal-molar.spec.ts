import {
  BLACKBODY_PRESET_IDS,
  BLACKBODY_PRESETS,
  evaluateBlackbody,
  planckSpectralRadiance,
  type BlackbodyInput,
} from '../../src/tour/blackbodyEngine'
import {
  GAS_MODEL_IDS,
  MOLAR_MATTER_PRESET_IDS,
  MOLAR_MATTER_PRESETS,
  MOLAR_SUBSTANCE_PRESET_IDS,
  MOLAR_SUBSTANCES,
  evaluateMolarMatter,
  type MolarMatterInput,
} from '../../src/tour/molarMatterEngine'
import {
  CONVENTIONAL_CONSTANTS,
  EXACT_DERIVED_CONSTANTS,
  SI_EXACT_CONSTANTS,
} from '../../src/tour/physicsConstants'

function relativeError(actual: number, expected: number): number {
  return Math.abs((actual - expected) / expected)
}

function expectOnlyFiniteNumbers(value: unknown, path = 'result'): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value), `${path} must be finite`).toBe(true)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => expectOnlyFiniteNumbers(item, `${path}[${index}]`))
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) expectOnlyFiniteNumbers(child, `${path}.${key}`)
  }
}

function molarInput(overrides: Partial<MolarMatterInput> = {}): MolarMatterInput {
  return {
    substancePreset: 'carbon-12',
    amountMol: 1,
    temperatureKelvin: 298.15,
    pressurePascal: CONVENTIONAL_CONSTANTS.standardAtmosphere.value,
    gasModel: 'none',
    chargeNumber: 0,
    ...overrides,
  }
}

describe('Tour black-body engine', () => {
  it('publishes bounded conventional temperature presets in stable order', () => {
    expect(BLACKBODY_PRESET_IDS).toEqual([
      'room',
      'human-ish',
      'incandescent',
      'sun-photosphere',
      'hot-star',
    ])
    expect(BLACKBODY_PRESETS.map(({ id }) => id)).toEqual(BLACKBODY_PRESET_IDS)
    expect(BLACKBODY_PRESETS.map(({ input }) => input.temperatureKelvin)).toEqual([
      293.15,
      310,
      2_700,
      5_772,
      10_000,
    ])
    expect(BLACKBODY_PRESETS.every(Object.isFrozen)).toBe(true)
    expect(BLACKBODY_PRESETS.every(({ input }) => Object.isFrozen(input))).toBe(true)
  })

  it('reproduces Wien and Stefan-Boltzmann values and temperature ordering', () => {
    const cool = evaluateBlackbody({ temperatureKelvin: 300 })
    const hot = evaluateBlackbody({ temperatureKelvin: 600 })

    expect(relativeError(cool.wienPeakWavelengthMetres, 9.659_239_85e-6)).toBeLessThan(2e-9)
    expect(relativeError(cool.stefanBoltzmannExitanceWattsPerSquareMetre, 459.300_327_94)).toBeLessThan(2e-9)
    expect(hot.wienPeakWavelengthMetres).toBeLessThan(cool.wienPeakWavelengthMetres)
    expect(hot.wienPeakWavelengthMetres / cool.wienPeakWavelengthMetres).toBeCloseTo(0.5, 14)
    expect(hot.stefanBoltzmannExitanceWattsPerSquareMetre / cool.stefanBoltzmannExitanceWattsPerSquareMetre).toBeCloseTo(16, 13)
  })

  it('returns a finite bounded spectrum with its wavelength peak and SVG normalization', () => {
    const output = evaluateBlackbody({ temperatureKelvin: 5_772 })
    const maximum = output.spectrum.reduce((best, point) => (
      point.spectralRadianceWattsPerSteradianCubicMetre > best.spectralRadianceWattsPerSteradianCubicMetre
        ? point
        : best
    ))

    expect(output.spectrum).toHaveLength(129)
    expect(output.normalizedSeries).toHaveLength(output.spectrum.length)
    expect(output.spectrum.length).toBeLessThanOrEqual(256)
    expect(maximum.wavelengthMetres).toBe(output.wienPeakWavelengthMetres)
    expect(output.spectrum.every(({ wavelengthMetres, spectralRadianceWattsPerSteradianCubicMetre }, index) => (
      Number.isFinite(wavelengthMetres)
      && Number.isFinite(spectralRadianceWattsPerSteradianCubicMetre)
      && spectralRadianceWattsPerSteradianCubicMetre >= 0
      && (index === 0 || wavelengthMetres > output.spectrum[index - 1]!.wavelengthMetres)
    ))).toBe(true)
    expect(output.normalizedSeries.every(({ x, y, wavelengthMetres, normalizedRadiance }) => (
      x === wavelengthMetres
      && y === normalizedRadiance
      && Number.isFinite(x)
      && Number.isFinite(y)
      && y >= 0
      && y <= 1
    ))).toBe(true)
    expect(Math.max(...output.normalizedSeries.map(({ y }) => y))).toBe(1)
    expect(output.table.length).toBeLessThanOrEqual(11)
    expect(output.table.every((row) => Object.values(row).every(Number.isFinite))).toBe(true)
    expect(output.table.some(({ normalizedRadiance }) => normalizedRadiance === 1)).toBe(true)
  })

  it('obeys the wavelength-domain temperature scaling and emits zero for underflow', () => {
    const temperature = 1_000
    const wavelength = EXACT_DERIVED_CONSTANTS.wienWavelengthDisplacementConstant.value / temperature
    const base = planckSpectralRadiance(wavelength, temperature)
    const scaled = planckSpectralRadiance(wavelength / 2, temperature * 2)
    const underflow = evaluateBlackbody({
      temperatureKelvin: 100,
      wavelengthGridMetres: [1e-9, 2e-9],
    })

    expect(relativeError(scaled / base, 32)).toBeLessThan(1e-14)
    expect(underflow.spectrum.map(({ spectralRadianceWattsPerSteradianCubicMetre }) => spectralRadianceWattsPerSteradianCubicMetre)).toEqual([0, 0])
    expect(underflow.normalizedSeries.map(({ y }) => y)).toEqual([0, 0])
  })

  it('retains representable short-wave subnormal-scale radiance when exp(x) overflows', () => {
    const radiance = planckSpectralRadiance(1e-9, 20_000)
    const output = evaluateBlackbody({
      temperatureKelvin: 20_000,
      wavelengthGridMetres: [1e-9, 2e-9],
    })

    expect(radiance).toBeGreaterThan(0)
    expect(relativeError(radiance, 4.46e-284)).toBeLessThan(0.02)
    expect(output.spectrum[0]?.spectralRadianceWattsPerSteradianCubicMetre).toBe(radiance)
    expectOnlyFiniteNumbers(output)
  })

  it('accepts explicit wavelength grids and rejects ambiguous, invalid, or unbounded inputs', () => {
    const explicit = [400e-9, 500e-9, 700e-9]
    expect(evaluateBlackbody({ temperatureKelvin: 4_000, wavelengthGridMetres: explicit }).spectrum.map(({ wavelengthMetres }) => wavelengthMetres)).toEqual(explicit)
    expect(() => evaluateBlackbody({ temperatureKelvin: 99 })).toThrow('temperatureKelvin must be within [100, 20000]')
    expect(() => evaluateBlackbody({ temperatureKelvin: 20_001 })).toThrow('temperatureKelvin must be within [100, 20000]')
    expect(() => evaluateBlackbody({ temperatureKelvin: Number.NaN })).toThrow('temperatureKelvin must be finite')
    expect(() => evaluateBlackbody({ temperatureKelvin: 1_000, sampleCount: 257 })).toThrow('sampleCount must be within [2, 256]')
    expect(() => evaluateBlackbody({ temperatureKelvin: 1_000, sampleCount: 2.5 })).toThrow('sampleCount must be an integer')
    expect(() => evaluateBlackbody({ temperatureKelvin: 1_000, wavelengthMinimumMetres: 1e-5, wavelengthMaximumMetres: 1e-6 })).toThrow('wavelengthMinimumMetres must be less')
    expect(() => evaluateBlackbody({ temperatureKelvin: 1_000, wavelengthGridMetres: [2e-6, 1e-6] })).toThrow('strictly increasing')
    expect(() => evaluateBlackbody({ temperatureKelvin: 1_000, wavelengthGridMetres: explicit, sampleCount: 3 })).toThrow('cannot be combined')
    expect(() => evaluateBlackbody(null as unknown as BlackbodyInput)).toThrow('input must be an object')
  })

  it('states the ideal-model and non-validation caveats and remains deterministic', () => {
    const input: BlackbodyInput = { temperatureKelvin: 2_700, sampleCount: 33 }
    const original = structuredClone(input)
    const first = evaluateBlackbody(input)
    const second = evaluateBlackbody(input)

    expect(input).toEqual(original)
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first.spectrum).not.toBe(second.spectrum)
    expect(first.finding.assumptions.join(' ')).toContain('emissivity 1')
    expect(first.finding.caveats.join(' ')).toContain('wavelength representation')
    expect(first.finding.doesNotEstablish).toContain('measured spectrum')
    expect(first.finding.doesNotEstablish).toContain('color')
    expect(first.finding).toMatchObject({
      evidenceRefs: expect.arrayContaining(['openstax-university-physics-v3']),
      methodRelationship: 'not-applicable',
      modelOrigin: 'established-physics',
      resultStatus: 'computed',
      validatesTheory: false,
    })
    first.spectrum[0]!.wavelengthMetres = 42
    first.finding.caveats[0] = 'caller mutation'
    expect(evaluateBlackbody(input)).toEqual(second)
  })
})

describe('Tour particle-to-mole engine', () => {
  it('publishes complete frozen substance, scenario, and gas-model catalogs', () => {
    expect(MOLAR_SUBSTANCE_PRESET_IDS).toEqual(['electron', 'proton', 'carbon-12', 'generic-particle'])
    expect(MOLAR_MATTER_PRESET_IDS).toEqual(['one-mole', 'micromole', 'standard-ideal-gas', 'electrolysis'])
    expect(GAS_MODEL_IDS).toEqual(['none', 'ideal'])
    expect(MOLAR_SUBSTANCES.map(({ id }) => id)).toEqual(MOLAR_SUBSTANCE_PRESET_IDS)
    expect(MOLAR_MATTER_PRESETS.map(({ id }) => id)).toEqual(MOLAR_MATTER_PRESET_IDS)
    expect(MOLAR_SUBSTANCES.every(Object.isFrozen)).toBe(true)
    expect(MOLAR_MATTER_PRESETS.every(Object.isFrozen)).toBe(true)
    expect(MOLAR_MATTER_PRESETS.every(({ input }) => Object.isFrozen(input))).toBe(true)
  })

  it('satisfies the exact Avogadro and Faraday scaling identities', () => {
    const amountMol = 2.5
    const chargeNumber = -3
    const output = evaluateMolarMatter(molarInput({ amountMol, chargeNumber }))

    expect(output.amountOfSubstanceMol).toBe(amountMol)
    expect(output.entityCount).toBe(amountMol * SI_EXACT_CONSTANTS.avogadroConstant.value)
    expect(output.faradayChargeCoulombs).toBe(chargeNumber * amountMol * EXACT_DERIVED_CONSTANTS.faradayConstant.value)
    expect(output.faradayChargeCoulombs).toBe(chargeNumber * output.entityCount * SI_EXACT_CONSTANTS.elementaryCharge.value)
    expect(output.table[0]).toEqual({
      quantity: 'amount-of-substance',
      label: 'Amount of substance',
      value: amountMol,
      unit: 'mol',
    })
  })

  it('returns about 22.414 litres for one mole of standard ideal gas', () => {
    const output = evaluateMolarMatter(molarInput({
      substancePreset: 'generic-particle',
      molarMassKgPerMol: 28.97e-3,
      temperatureKelvin: 273.15,
      pressurePascal: CONVENTIONAL_CONSTANTS.standardAtmosphere.value,
      gasModel: 'ideal',
    }))

    expect(output.standardAtmospherePascal).toBe(101_325)
    expect(output.idealGasVolumeCubicMetres).not.toBeNull()
    expect(output.idealGasVolumeCubicMetres! * 1_000).toBeCloseTo(22.414, 3)
    expect(output.table.some(({ quantity }) => quantity === 'ideal-gas-volume')).toBe(true)
    expect(output.finding.caveats.join(' ')).toContain('exact convention 101325 Pa')
    expect(output.finding.caveats.join(' ')).toContain('ideal-gas law')
  })

  it('scales bulk mass from preset, particle, and direct molar masses', () => {
    const carbon = evaluateMolarMatter(molarInput({ amountMol: 2 }))
    const fromParticle = evaluateMolarMatter(molarInput({
      substancePreset: 'generic-particle',
      genericParticleMassKg: SI_EXACT_CONSTANTS.avogadroConstant.value ** -1,
      amountMol: 3,
    }))
    const fromMolarMass = evaluateMolarMatter(molarInput({
      substancePreset: 'generic-particle',
      molarMassKgPerMol: 0.018,
      amountMol: 4,
    }))

    expect(carbon.bulkMassKg).toBe(2 * carbon.molarMassKgPerMol)
    expect(carbon.molarMassKgPerMol).toBeCloseTo(0.012, 10)
    expect(fromParticle.molarMassKgPerMol).toBeCloseTo(1, 14)
    expect(fromParticle.bulkMassKg).toBeCloseTo(3, 14)
    expect(fromMolarMass.bulkMassKg).toBe(0.072)
    expect(MOLAR_SUBSTANCES.find(({ id }) => id === 'carbon-12')!.wording).toContain('not an exact molar mass')
  })

  it('optionally converts per-particle energy to per-mole and selected-amount energy', () => {
    const perParticleEnergyJoule = 2.4e-19
    const output = evaluateMolarMatter(molarInput({ amountMol: 0.25, perParticleEnergyJoule }))

    expect(output.molarEnergyJoulePerMol).toBe(perParticleEnergyJoule * SI_EXACT_CONSTANTS.avogadroConstant.value)
    expect(output.sampleEnergyJoule).toBe(output.molarEnergyJoulePerMol! * 0.25)
    expect(output.table.map(({ quantity }) => quantity)).toContain('molar-energy')
    expect(output.table.map(({ quantity }) => quantity)).toContain('sample-energy')
  })

  it('accepts inclusive physical bounds and rejects malformed or out-of-range values', () => {
    expect(evaluateMolarMatter(molarInput({ amountMol: 1e-12, temperatureKelvin: 1, pressurePascal: 1, chargeNumber: -100 })).amountOfSubstanceMol).toBe(1e-12)
    expect(evaluateMolarMatter(molarInput({ amountMol: 1e3, temperatureKelvin: 5_000, pressurePascal: 1e8, chargeNumber: 100 })).amountOfSubstanceMol).toBe(1e3)
    expect(() => evaluateMolarMatter(molarInput({ amountMol: 0 }))).toThrow('amountMol must be within [1e-12, 1000]')
    expect(() => evaluateMolarMatter(molarInput({ temperatureKelvin: 5_001 }))).toThrow('temperatureKelvin must be within [1, 5000]')
    expect(() => evaluateMolarMatter(molarInput({ pressurePascal: Number.POSITIVE_INFINITY }))).toThrow('pressurePascal must be finite')
    expect(() => evaluateMolarMatter(molarInput({ chargeNumber: 0.5 }))).toThrow('chargeNumber must be an integer')
    expect(() => evaluateMolarMatter(molarInput({ chargeNumber: 101 }))).toThrow('chargeNumber must be within [-100, 100]')
    expect(() => evaluateMolarMatter(molarInput({ gasModel: 'real' as never }))).toThrow('Unknown molar-matter gas model: real')
    expect(() => evaluateMolarMatter(molarInput({ substancePreset: 'neutron' as never }))).toThrow('Unknown molar-matter substance preset: neutron')
    expect(() => evaluateMolarMatter(molarInput({ substancePreset: 'generic-particle' }))).toThrow('requires exactly one')
    expect(() => evaluateMolarMatter(molarInput({ substancePreset: 'generic-particle', molarMassKgPerMol: 1, genericParticleMassKg: 1e-24 }))).toThrow('requires exactly one')
    expect(() => evaluateMolarMatter(molarInput({ molarMassKgPerMol: 1 }))).toThrow('custom mass is only valid')
    expect(() => evaluateMolarMatter(null as unknown as MolarMatterInput)).toThrow('input must be an object')
  })

  it('keeps every emitted number finite and states assumptions without empirical claims', () => {
    for (const preset of MOLAR_MATTER_PRESETS) {
      const output = evaluateMolarMatter(preset.input)
      const optionalNumbers = [
        output.idealGasVolumeCubicMetres,
        output.perParticleEnergyJoule,
        output.molarEnergyJoulePerMol,
        output.sampleEnergyJoule,
      ].filter((value): value is number => value !== null)

      expect([
        output.amountOfSubstanceMol,
        output.entityCount,
        output.molarMassKgPerMol,
        output.bulkMassKg,
        output.faradayChargeCoulombs,
        output.standardAtmospherePascal,
        ...optionalNumbers,
      ].every(Number.isFinite)).toBe(true)
      expect(output.table.every(({ value }) => Number.isFinite(value))).toBe(true)
      expect(output.finding.assumptions.join(' ')).toContain('Amount of substance')
      expect(output.finding.doesNotEstablish).toContain('not empirical validation')
      expect(output.finding).toMatchObject({
        evidenceRefs: expect.arrayContaining(['iupac-green-book-3']),
        methodRelationship: 'not-applicable',
        modelOrigin: 'established-physics',
        resultStatus: 'computed',
        validatesTheory: false,
      })
    }
  })

  it('does not mutate inputs and returns deterministic independent result objects', () => {
    const input = molarInput({ amountMol: 0.75, chargeNumber: 2, perParticleEnergyJoule: 1e-20 })
    const original = structuredClone(input)
    const first = evaluateMolarMatter(input)
    const second = evaluateMolarMatter(input)

    expect(input).toEqual(original)
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first.table).not.toBe(second.table)
    expect(first.substance).not.toBe(second.substance)
    first.table[0]!.value = 99
    first.substance.wording = 'caller mutation'
    first.finding.assumptions[0] = 'caller mutation'
    expect(evaluateMolarMatter(input)).toEqual(second)
  })
})
