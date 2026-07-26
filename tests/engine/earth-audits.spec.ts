import {
  DEFAULT_BOND_POTENTIAL_AUDIT_INPUTS,
  DEFAULT_CANONICAL_CONSTANT_AUDIT_INPUTS,
  DEFAULT_CRITICAL_TEMPERATURE_AUDIT_INPUTS,
  DEFAULT_ELECTRON_BOHR_RYDBERG_AUDIT_INPUTS,
  DEFAULT_NUCLEAR_PAIR_ENUMERATION_INPUTS,
  DEFAULT_PROTON_FORMULA_AUDIT_INPUTS,
  DEFAULT_SHELL_CAPACITY_AUDIT_INPUTS,
  DEFAULT_SOURCE_SEQUENCE_AUDIT_INPUTS,
  DEFAULT_STANDING_WAVE_SPECTRUM_AUDIT_INPUTS,
  bondPotentialAudit,
  canonicalConstantAudit,
  criticalTemperatureAudit,
  electronBohrRydbergAudit,
  nuclearPairEnumerationAudit,
  protonFormulaAudit,
  shellCapacityAudit,
  sourceSequenceAudit,
  standingWaveSpectrumAudit,
} from '../../src/engine/earth/audits'

describe('EARTH literal audit source failures', () => {
  it('reports known constant arithmetic, canonical, and dimension conflicts without parsing the corpus', () => {
    const result = canonicalConstantAudit()
    expect(result.diagnostics).toMatchObject({
      provenance: 'reproduction',
      validatesTheory: false,
      occurrences: 8,
    })
    expect(result.output.scope).toBe('literal-known-occurrences')
    expect(result.output.claims.find(({ id }) => id === 'lambda-toolkit')).toMatchObject({
      claimedValue: 44.492,
      reproducedValue: expect.closeTo((4 * Math.PI) ** 3, 12),
      arithmeticMatches: false,
    })
    expect(result.output.claims.find(({ id }) => id === 'golden-twist')?.reproducedValue).toBeCloseTo(0.3568220897730899, 14)
    expect(result.output.claims.find(({ id }) => id === 'xi0-pion-route')?.dimensionsMatch).toBe(false)
    expect(result.output.claims.find(({ id }) => id === 'proton-rest-energy')?.canonicalMatches).toBe(false)
    expect(result.output.findings.some(({ category }) => category === 'dimension')).toBe(true)
  })

  it('compares both source morphisms and falsifies the digit, Beatty, and prime claims deterministically', () => {
    const first = sourceSequenceAudit()
    const second = sourceSequenceAudit()
    expect(first).toEqual(second)
    expect(first.output.morphisms.map(({ rules }) => rules)).toEqual([
      { '1': '12', '2': '13', '3': '21' },
      { '1': '12', '2': '3', '3': '1' },
    ])
    expect(first.output.digitClaim.morphicDigits).toMatch(/^[149]+$/)
    expect(first.output.digitClaim.zeroPositions).toEqual([])
    expect(first.output.beattyClaim.positions.slice(0, 5)).toEqual([3, 6, 8, 11, 14])
    expect(first.output.beattyClaim.allAppearAsMorphicZeros).toBe(false)
    expect(first.output.morphisms[0]?.primeLengthClaims.some(({ length, prime }) => length === 4 && !prime)).toBe(true)
    expect(first.output.findings.every(({ status }) => status === 'failure')).toBe(true)
  })

  it('uses standard torus rules while retaining contradictions in the printed nuclear map', () => {
    const result = nuclearPairEnumerationAudit()
    const proton = result.output.sourceClaims.find(({ label }) => label === 'proton')
    const helium = result.output.sourceClaims.find(({ label }) => label === 'helium-4')
    expect(proton).toMatchObject({ standardKind: 'unknot', standardCrossingNumber: 0, sourceRuleA: 3, sourceRuleZ: 0 })
    expect(helium).toMatchObject({ standardKind: 'link', sourceRuleA: 9, sourceRuleZ: 0 })
    expect(helium?.contradictions).toContain('pair is not coprime')
    expect(result.output.candidates.every(({ gcd }) => gcd === 1)).toBe(true)
    expect(result.output.candidates.every(({ p, q }) => p <= q + 2)).toBe(true)
  })

  it('keeps proton and electron canonical-looking printed outputs separate from evaluated formulas', () => {
    const proton = protonFormulaAudit()
    expect(proton.output.radius.xiFromPrintedRadiusRouteFm).toBeCloseTo(1.536179199616156, 14)
    expect(proton.output.energyVariants.every(({ relativeResidualToCanonical }) => relativeResidualToCanonical > 1)).toBe(true)
    expect(proton.diagnostics.energyUnitConversion).toBe('MeV fm / fm')
    expect(proton.output.findings.every(({ status }) => status === 'failure')).toBe(true)

    const electron = electronBohrRydbergAudit()
    expect(electron.output.dependencies.actualPhi18).toBeCloseTo(5777.999826929732, 10)
    expect(electron.output.dependencies.computedAlphaInverse).toBeCloseTo(2960.9266845258185, 10)
    expect(electron.output.bohr.unit).toBe('m')
    expect(electron.output.electron.unit).toBe('MeV/c^2')
    expect(electron.output.rydberg.unit).toBe('m^-1')
    expect(electron.output.electron.actualDependencies).toBeLessThan(1e-5)
    expect(electron.output.findings.find(({ id }) => id === 'canonical-output-circularity')?.status).toBe('failure')
  })

  it('finds the explicit bond minimum and exposes the shell formula arithmetic error', () => {
    const bond = bondPotentialAudit(DEFAULT_BOND_POTENTIAL_AUDIT_INPUTS)
    expect(bond.output.parameters).toMatchObject({ A: 1, k: 1, d0: 1 })
    expect(Math.abs(bond.output.minimum.firstDerivative)).toBeLessThan(2e-15)
    expect(bond.output.minimum.distance).toBeGreaterThan(1)
    expect(bond.output.minimum.hessian).toBeGreaterThan(0)
    expect(bond.output.series).toHaveLength(129)
    expect(bond.output.findings[0]?.message).toContain('does not physically specify A, k, and d0')

    const shells = shellCapacityAudit()
    expect(shells.output.shells[0]).toMatchObject({
      principalShell: 1,
      printedFormulaCapacity: 4,
      printedSequenceCapacity: 2,
      standardCapacity: 2,
      formulaMatchesPrintedSequence: false,
    })
    expect(shells.output.shells.slice(0, 4).map(({ standardCapacity }) => standardCapacity)).toEqual([2, 8, 18, 32])
    expect(shells.diagnostics.radiusUnit).toBe('fm')
  })

  it('converts the printed spectrum and critical-temperature laws before comparing source examples', () => {
    const spectrum = standingWaveSpectrumAudit()
    const ch = spectrum.output.modes[0]!
    expect(ch.distanceM).toBeCloseTo(1.09e-10, 24)
    expect(ch.standingWavelengthM).toBeCloseTo(2.18e-10, 24)
    expect(ch.printedWavenumberPerCm).toBeGreaterThan(900_000)
    expect(ch.claimedValue).toBe(3030)
    expect(ch.claimedRelativeResidual).toBeGreaterThan(100)
    expect(spectrum.output.findings.every(({ status }) => status === 'failure')).toBe(true)
    expect(spectrum.diagnostics).toMatchObject({ lengthInputUnit: 'angstrom', frequencyOutputUnit: 'Hz' })

    const temperature = criticalTemperatureAudit()
    expect(temperature.output.baseTemperatureKelvin).toBeCloseTo(2.61 / 0.001986, 12)
    expect(temperature.output.examples.map(({ temperatureKelvin }) => temperatureKelvin)).toEqual([
      expect.closeTo(1314.1993957703928, 10),
      expect.closeTo(2628.3987915407856, 10),
      expect.closeTo(3942.5981873111784, 10),
    ])
    expect(temperature.output.findings.every(({ status }) => status === 'failure')).toBe(true)
    expect(temperature.diagnostics).toMatchObject({ energyUnit: 'kcal/mol', temperatureUnit: 'K' })
  })
})

describe('EARTH literal audit bounds and defaults', () => {
  it('exports complete default inputs and produces deterministic defaults', () => {
    expect(DEFAULT_CANONICAL_CONSTANT_AUDIT_INPUTS.claims).toHaveLength(8)
    expect(DEFAULT_SOURCE_SEQUENCE_AUDIT_INPUTS).toMatchObject({ generations: 12, digitCount: 256, beattyCount: 64 })
    expect(DEFAULT_NUCLEAR_PAIR_ENUMERATION_INPUTS.sourceClaims).toHaveLength(3)
    expect(DEFAULT_PROTON_FORMULA_AUDIT_INPUTS.lambdaClaims).toHaveLength(3)
    expect(DEFAULT_ELECTRON_BOHR_RYDBERG_AUDIT_INPUTS.atomicNumber).toBe(1)
    expect(DEFAULT_BOND_POTENTIAL_AUDIT_INPUTS).toMatchObject({ A: 1, k: 1, d0: 1 })
    expect(DEFAULT_SHELL_CAPACITY_AUDIT_INPUTS.shells).toBe(8)
    expect(DEFAULT_STANDING_WAVE_SPECTRUM_AUDIT_INPUTS.modes).toHaveLength(5)
    expect(DEFAULT_CRITICAL_TEMPERATURE_AUDIT_INPUTS.examples).toHaveLength(3)
    expect(standingWaveSpectrumAudit()).toEqual(standingWaveSpectrumAudit())
    expect(criticalTemperatureAudit()).toEqual(criticalTemperatureAudit())
  })

  it('rejects non-finite, missing, and unbounded work requests', () => {
    expect(() => canonicalConstantAudit({
      claims: Array.from({ length: 129 }, (_, index) => ({
        id: String(index),
        symbol: 'x',
        expression: 'x',
        claimedValue: 1,
        reproducedValue: 1,
        unit: '1',
        claimedDimensions: [0, 0, 0, 0, 0, 0, 0],
        reproducedDimensions: [0, 0, 0, 0, 0, 0, 0],
      })),
    })).toThrow('claims must contain 1 to 128 entries')
    expect(() => sourceSequenceAudit({ generations: 19 })).toThrow('generations must be an integer from 0 to 18')
    expect(() => nuclearPairEnumerationAudit({ maximumP: 512, maximumQ: 512 })).toThrow('maximumP*maximumQ must not exceed 65536')
    expect(() => protonFormulaAudit({ xi0Fm: Number.NaN })).toThrow('xi0Fm must be finite')
    expect(() => bondPotentialAudit({ A: 1, k: 1 } as never)).toThrow('A, k, and d0 are required')
    expect(() => bondPotentialAudit({ ...DEFAULT_BOND_POTENTIAL_AUDIT_INPUTS, samples: 4097 })).toThrow('samples must be an integer from 2 to 4096')
    expect(() => shellCapacityAudit({ shells: 65 })).toThrow('shells must be an integer from 1 to 64')
    expect(() => standingWaveSpectrumAudit({ modes: [{ label: 'bad', distanceAngstrom: 1, harmonic: 0 }] })).toThrow('harmonic must be an integer from 1 to 10000')
    expect(() => criticalTemperatureAudit({ examples: [{ multiplier: 1.5 }] })).toThrow('multiplier must be an integer from 1 to 1000000')
  })
})
