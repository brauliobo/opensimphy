import {
  ELECTRICAL_CHARGE_CARRIER_BOUNDS,
  ELECTRICAL_FREQUENCY_BOUNDS_HZ,
  ELECTRICAL_STANDARD_PRESET_IDS,
  ELECTRICAL_STANDARD_PRESETS,
  ELECTRICAL_VOLTAGE_BOUNDS_V,
  HISTORICAL_1990_CONVENTIONAL_CONSTANTS,
  evaluateElectricalStandards,
  projectElectricalStandardsSeries,
  projectElectricalStandardsTable,
  type ElectricalStandardsInput,
} from '../../src/tour/electricalStandardsEngine'
import {
  PHOTON_FREQUENCY_BOUNDS_HZ,
  PHOTON_SOURCE_PRESET_IDS,
  PHOTON_SOURCE_PRESETS,
  evaluatePhotonBridge,
  projectPhotonBridgeSeries,
  projectPhotonBridgeTable,
  type PhotonBridgeInput,
} from '../../src/tour/photonBridgeEngine'
import {
  SCALE_QUANTITY_FAMILY_IDS,
  SCALE_RULER_CATALOG,
  SCALE_RULER_DEFAULT_PRESETS,
  SCALE_RULER_PRESET_IDS,
  evaluateScaleRuler,
  projectScaleRulerSeries,
  projectScaleRulerTable,
  type ScaleRulerInput,
} from '../../src/tour/scaleRulerEngine'
import {
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

describe('Tour scale-ruler engine', () => {
  it('publishes a complete bounded catalog with distinct status and source labels', () => {
    expect(SCALE_QUANTITY_FAMILY_IDS).toEqual(['length', 'time', 'mass'])
    expect(SCALE_RULER_CATALOG.map(({ id }) => id)).toEqual(SCALE_RULER_PRESET_IDS)
    expect(new Set(SCALE_RULER_CATALOG.map(({ status }) => status))).toEqual(new Set([
      'exact-defined',
      'exact-derived',
      'measured',
      'derived-from-measured',
      'illustrative',
    ]))
    expect(SCALE_RULER_CATALOG.every(({ sourceLabel, statusLabel }) => sourceLabel.length > 0 && statusLabel.length > 0)).toBe(true)
    expect(SCALE_RULER_CATALOG.every(({ valueSi }) => Number.isFinite(valueSi) && valueSi > 0)).toBe(true)
    expect(SCALE_RULER_CATALOG.find(({ id }) => id === 'planck-length')?.valueSi).toBeGreaterThan(1e-36)
    expect(SCALE_RULER_CATALOG.find(({ id }) => id === 'planck-time')?.valueSi).toBeGreaterThan(1e-45)
    expect(SCALE_RULER_CATALOG.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'proton-radius',
      'atom-radius',
      'human-height',
      'earth-radius',
      'astronomical-unit',
      'light-year',
      'parsec',
      'observable-universe-radius',
    ]))
  })

  it('carries exact status/evidence provenance per catalog entry and into projections', () => {
    const entries = Object.fromEntries(SCALE_RULER_CATALOG.map((entry) => [entry.id, entry]))
    const output = evaluateScaleRuler({ quantityFamily: 'length', presetId: 'parsec' })
    const table = projectScaleRulerTable(output)
    const series = projectScaleRulerSeries(output)

    expect(entries['astronomical-unit']).toMatchObject({
      status: 'exact-defined',
      sourceId: 'iau-2012-resolution-b2',
      evidenceRefs: ['iau-2012-resolution-b2'],
    })
    expect(entries.parsec).toMatchObject({
      status: 'exact-derived',
      sourceId: 'bipm-si-brochure-9',
      evidenceRefs: ['bipm-si-brochure-9'],
    })
    expect(entries['light-year']).toMatchObject({
      status: 'exact-derived',
      sourceId: 'bipm-si-brochure-9',
      evidenceRefs: ['bipm-si-brochure-9'],
    })
    expect(entries['julian-year']).toMatchObject({
      status: 'exact-defined',
      sourceId: 'bipm-si-brochure-9',
      evidenceRefs: ['bipm-si-brochure-9'],
    })
    expect(entries['solar-mass']).toMatchObject({
      status: 'derived-from-measured',
      evidenceRefs: ['iau-resolution-b3-2015', 'codata-2022'],
    })
    expect(['human-height', 'earth-radius', 'earth-age', 'earth-mass', 'observable-universe-radius', 'universe-age', 'milky-way-mass'].every((id) => (
      entries[id]?.status === 'illustrative'
      && entries[id]?.sourceId === 'opensimphy-scientific-scope'
      && entries[id]?.evidenceRefs.length === 1
      && entries[id]?.evidenceRefs[0] === 'opensimphy-scientific-scope'
    ))).toBe(true)
    expect(SCALE_RULER_CATALOG.filter(({ evidenceRefs }) => evidenceRefs.includes('iau-resolution-b3-2015')).map(({ id }) => id)).toEqual(['solar-mass'])
    expect(output.finding.evidenceRefs).toEqual([
      'codata-2022',
      'opensimphy-scientific-scope',
      'iau-2012-resolution-b2',
      'bipm-si-brochure-9',
    ])
    expect(output.finding.sourceRevision).not.toContain('Resolution B3')
    expect(table.map(({ id, status, evidenceRefs }) => ({ id, status, evidenceRefs }))).toEqual(
      output.entries.map(({ id, status, evidenceRefs }) => ({ id, status, evidenceRefs })),
    )
    expect(series.map(({ id, evidenceRefs }) => ({ id, evidenceRefs }))).toEqual(
      output.entries.map(({ id, evidenceRefs }) => ({ id, evidenceRefs })),
    )
    expect(series.every(({ accessibleLabel, evidenceRefs }) => evidenceRefs.every((reference) => accessibleLabel.includes(reference)))).toBe(true)
  })

  it.each([
    { quantityFamily: 'length', presetId: 'human-height', unit: 'm' },
    { quantityFamily: 'time', presetId: 'human-heartbeat', unit: 's' },
    { quantityFamily: 'mass', presetId: 'human-mass', unit: 'kg' },
  ] as const)('projects the $quantityFamily family on a log10 SI axis', ({ quantityFamily, presetId, unit }) => {
    const output = evaluateScaleRuler({ quantityFamily, presetId })
    const table = projectScaleRulerTable(output)
    const series = projectScaleRulerSeries(output)

    expect(output.axis).toMatchObject({ scale: 'log10', label: `log10(${quantityFamily} / 1 ${unit})` })
    expect(output.selectedLog10).toBe(Math.log10(output.selected.valueSi))
    expect(output.selectedSiDisplay).toContain(unit)
    expect(output.entries.every(({ family }) => family === quantityFamily)).toBe(true)
    expect(table).toHaveLength(output.entries.length)
    expect(series).toHaveLength(output.entries.length)
    expect(table.filter(({ selected }) => selected)).toHaveLength(1)
    expect(series.every(({ accessibleLabel }) => accessibleLabel.length > 0)).toBe(true)
    expect(output.finding.doesNotEstablish).toContain('do not predict')
    expect(output.finding.validatesTheory).toBe(false)
  })

  it('uses sensible family defaults and fails closed for every invalid ID combination', () => {
    expect(SCALE_RULER_DEFAULT_PRESETS).toEqual({
      length: 'human-height',
      time: 'human-heartbeat',
      mass: 'human-mass',
    })
    const base: ScaleRulerInput = { quantityFamily: 'length', presetId: 'human-height' }
    expect(() => evaluateScaleRuler(null as unknown as ScaleRulerInput)).toThrow('input must be an object')
    expect(() => evaluateScaleRuler({ ...base, quantityFamily: 'energy' } as unknown as ScaleRulerInput)).toThrow('Unknown scale ruler quantity family: energy')
    expect(() => evaluateScaleRuler({ ...base, presetId: 'free-form' } as unknown as ScaleRulerInput)).toThrow('Unknown scale ruler preset: free-form')
    expect(() => evaluateScaleRuler({ quantityFamily: 'mass', presetId: 'planck-length' })).toThrow('does not belong to mass')
  })
})

describe('Tour photon-bridge engine', () => {
  it('satisfies all four linked identities for a supplied frequency', () => {
    const frequencyHz = 5e14
    const output = evaluatePhotonBridge({ frequencyHz })
    const { boltzmannConstant: kB, planckConstant: h, speedOfLight: c } = SI_EXACT_CONSTANTS

    expect(output.photonEnergyJ).toBe(h.value * frequencyHz)
    expect(output.vacuumWavelengthM).toBe(c.value / frequencyHz)
    expect(output.equivalentMassKg).toBe(output.photonEnergyJ / c.value ** 2)
    expect(output.equivalentTemperatureK).toBe(output.photonEnergyJ / kB.value)
    expect(output.relationStatus).toBe('exact-si-identity-for-stated-frequency')
    expect(output.tier).toBe('immediate')
    expect(output.finding.validatesTheory).toBe(false)
  })

  it('provides bounded radio through gamma presets with known blue and X-ray wavelength scales', () => {
    expect(PHOTON_SOURCE_PRESET_IDS).toEqual(['radio', 'microwave', 'visible-blue', 'x-ray', 'gamma'])
    expect(PHOTON_SOURCE_PRESETS.map(({ id }) => id)).toEqual(PHOTON_SOURCE_PRESET_IDS)

    const radio = evaluatePhotonBridge({ presetId: 'radio' })
    const microwave = evaluatePhotonBridge({ presetId: 'microwave' })
    const blue = evaluatePhotonBridge({ presetId: 'visible-blue' })
    const xray = evaluatePhotonBridge({ presetId: 'x-ray' })
    const gamma = evaluatePhotonBridge({ presetId: 'gamma' })

    expect(relativeError(radio.vacuumWavelengthM, 2.997_924_58)).toBeLessThan(1e-15)
    expect(relativeError(microwave.vacuumWavelengthM, 0.029_979_245_8)).toBeLessThan(1e-15)
    expect(relativeError(blue.vacuumWavelengthM, 450e-9)).toBeLessThan(1e-15)
    expect(relativeError(xray.vacuumWavelengthM, 1e-10)).toBeLessThan(1e-15)
    expect(relativeError(gamma.vacuumWavelengthM, 2.997_924_58e-12)).toBeLessThan(1e-15)
    expect(blue.source).toBe('illustrative-preset')
  })

  it('accepts both frequency bounds and rejects all non-finite, out-of-range, ambiguous, or unknown inputs', () => {
    expect(evaluatePhotonBridge({ frequencyHz: PHOTON_FREQUENCY_BOUNDS_HZ.minimum }).frequencyHz).toBe(1e3)
    expect(evaluatePhotonBridge({ frequencyHz: PHOTON_FREQUENCY_BOUNDS_HZ.maximum }).frequencyHz).toBe(1e25)
    for (const frequencyHz of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => evaluatePhotonBridge({ frequencyHz })).toThrow('frequencyHz must be finite')
    }
    for (const frequencyHz of [1e3 - 1, 1.000_001e25]) {
      expect(() => evaluatePhotonBridge({ frequencyHz })).toThrow('frequencyHz must be within [1e3, 1e25] Hz')
    }
    expect(() => evaluatePhotonBridge({} as PhotonBridgeInput)).toThrow('exactly one')
    expect(() => evaluatePhotonBridge({ frequencyHz: 1e10, presetId: 'radio' } as unknown as PhotonBridgeInput)).toThrow('exactly one')
    expect(() => evaluatePhotonBridge({ presetId: 'infrared' } as unknown as PhotonBridgeInput)).toThrow('Unknown photon source preset: infrared')
    expect(() => evaluatePhotonBridge(null as unknown as PhotonBridgeInput)).toThrow('input must be an object')
  })

  it('labels equivalent scales and uncertainty limits in accessible projections', () => {
    const output = evaluatePhotonBridge({ presetId: 'visible-blue' })
    const table = projectPhotonBridgeTable(output)
    const series = projectPhotonBridgeSeries(output)

    expect(table).toHaveLength(5)
    expect(table.find(({ id }) => id === 'equivalent-mass')?.interpretation).toContain('not photon rest mass')
    expect(table.find(({ id }) => id === 'equivalent-temperature')?.interpretation).toContain('not a thermodynamic state')
    expect(output.uncertaintyNotes.join(' ')).toContain('No input-frequency uncertainty')
    expect(output.finding.doesNotEstablish).toContain('not photon rest mass')
    expect(output.finding.doesNotEstablish).toContain('not a thermodynamic state')
    expect(series.every(({ log10Value, accessibleLabel }) => Number.isFinite(log10Value) && accessibleLabel.length > 0)).toBe(true)
  })
})

describe('Tour electrical-standards engine', () => {
  it('traces exact h/e identities through the complete standards network', () => {
    const output = evaluateElectricalStandards({ presetId: 'single-electron', chargeCarriers: 1, voltageV: 1, frequencyHz: 0 })
    const values = Object.fromEntries(output.nodes.map(({ id, value }) => [id, value]))
    const { elementaryCharge: e, planckConstant: h } = SI_EXACT_CONSTANTS

    expect(values.KJ).toBe(2 * e.value / h.value)
    expect(values.RK).toBe(h.value / e.value ** 2)
    expect(values.G0).toBe(2 * e.value ** 2 / h.value)
    expect(values.Phi0).toBe(h.value / (2 * e.value))
    expect(values.eV).toBe(e.value)
    expect(values.G0 * values.RK).toBeCloseTo(2, 15)
    expect(output.totalChargeC).toBe(e.value)
    expect(output.carrierEnergyJ).toBe(EXACT_DERIVED_CONSTANTS.electronVolt.value)
    expect(output.edges.map(({ equation }) => equation)).toEqual(expect.arrayContaining([
      'KJ = 2e/h',
      'RK = h/e^2',
      'G0 = 2e^2/h = 2/RK',
      'Phi0 = h/(2e)',
      '1 eV = e J',
    ]))
  })

  it('keeps the 1990 conventional values separate and reports signed relative differences', () => {
    const output = evaluateElectricalStandards({ presetId: 'hall', chargeCarriers: 1, voltageV: 0, frequencyHz: 0 })
    const kj = output.historicalComparisons.find(({ id }) => id === 'KJ-90-versus-KJ')!
    const rk = output.historicalComparisons.find(({ id }) => id === 'RK-90-versus-RK')!
    const historicalNodes = output.nodes.filter(({ status }) => status === 'historical-conventional-1990')

    expect(HISTORICAL_1990_CONVENTIONAL_CONSTANTS.josephsonConstant.displayValue).toBe(483_597.9)
    expect(HISTORICAL_1990_CONVENTIONAL_CONSTANTS.josephsonConstant.displayUnit).toBe('GHz V^-1')
    expect(HISTORICAL_1990_CONVENTIONAL_CONSTANTS.vonKlitzingConstant.value).toBe(25_812.807)
    expect(kj.relativeDifference).toBeGreaterThan(0)
    expect(relativeError(kj.relativeDifference, 1.066_66e-7)).toBeLessThan(1e-4)
    expect(rk.relativeDifference).toBeLessThan(0)
    expect(relativeError(rk.relativeDifference, -1.779e-8)).toBeLessThan(1e-3)
    expect(output.kj90DifferencePpm).toBe(kj.partsPerMillion)
    expect(output.rk90DifferencePpm).toBe(rk.partsPerMillion)
    expect(output.networkStatus).toBe('exact-input-dependent-and-historical-layers-separated')
    expect(historicalNodes).toHaveLength(2)
    expect(historicalNodes.every(({ note }) => note.includes('not the current exact SI value'))).toBe(true)
    expect(output.finding.evidenceRefs).toEqual([
      'bipm-si-brochure-9',
      'codata-2022',
      'cipm-1988-electrical-conventional-values',
    ])
    expect(output.nodes.filter(({ id }) => ['h', 'e'].includes(id)).every(({ status }) => status === 'exact-defining-si')).toBe(true)
    expect(output.nodes.filter(({ id }) => ['KJ', 'RK', 'G0', 'Phi0', 'eV'].includes(id)).every(({ status }) => status === 'exact-derived-si')).toBe(true)
    expect(output.frequencyHz).toBe(0)
    expect(output.josephsonFrequencyFromVoltageHz).toBeNull()
    expect(output.josephsonVoltageFromFrequencyV).toBeNull()
    expect(output.nodes.some(({ id }) => id === 'josephson-frequency' || id === 'josephson-voltage')).toBe(false)
  })

  it('evaluates both Josephson frequency and voltage directions without treating the carrier count as a filling factor', () => {
    const input = { presetId: 'josephson', chargeCarriers: 2, frequencyHz: 70e9, voltageV: 1e-3 } as const
    const output = evaluateElectricalStandards(input)

    expect(output.josephsonFrequencyFromVoltageHz).toBe(EXACT_DERIVED_CONSTANTS.josephsonConstant.value * input.voltageV)
    expect(output.josephsonVoltageFromFrequencyV).toBe(input.frequencyHz / EXACT_DERIVED_CONSTANTS.josephsonConstant.value)
    expect(output.totalChargeC).toBe(2 * SI_EXACT_CONSTANTS.elementaryCharge.value)
    expect(output.finding.assumptions.join(' ')).toContain('only to compute total charge')
    expect(output.finding.doesNotEstablish).toContain('Hall filling factor')
    expect(output.finding.validatesTheory).toBe(false)
    expect(output.tier).toBe('immediate')
  })

  it('requires complete inputs and enforces active versus inactive frequency semantics', () => {
    expect(ELECTRICAL_STANDARD_PRESET_IDS).toEqual(['single-electron', 'josephson', 'hall'])
    expect(ELECTRICAL_STANDARD_PRESETS.map(({ id }) => id)).toEqual(ELECTRICAL_STANDARD_PRESET_IDS)
    expect(ELECTRICAL_STANDARD_PRESETS.map(({ defaultInput }) => defaultInput)).toEqual([
      { presetId: 'single-electron', chargeCarriers: 1, voltageV: 1, frequencyHz: 0 },
      { presetId: 'josephson', chargeCarriers: 2, frequencyHz: 70e9, voltageV: 1e-3 },
      { presetId: 'hall', chargeCarriers: 1, voltageV: 0, frequencyHz: 0 },
    ])
    expect(evaluateElectricalStandards({ presetId: 'hall', chargeCarriers: ELECTRICAL_CHARGE_CARRIER_BOUNDS.minimum, voltageV: 0, frequencyHz: 0 }).chargeCarriers).toBe(1)
    expect(evaluateElectricalStandards({ presetId: 'hall', chargeCarriers: ELECTRICAL_CHARGE_CARRIER_BOUNDS.maximum, voltageV: 0, frequencyHz: 0 }).chargeCarriers).toBe(1_000_000)
    expect(evaluateElectricalStandards({ presetId: 'josephson', chargeCarriers: 1, frequencyHz: 1, voltageV: 0 }).frequencyHz).toBe(1)
    expect(evaluateElectricalStandards({ presetId: 'josephson', chargeCarriers: 1, frequencyHz: ELECTRICAL_FREQUENCY_BOUNDS_HZ.maximum, voltageV: 0 }).frequencyHz).toBe(1e15)
    expect(evaluateElectricalStandards({ presetId: 'single-electron', chargeCarriers: 1, voltageV: ELECTRICAL_VOLTAGE_BOUNDS_V.minimum, frequencyHz: 0 }).voltageV).toBe(0)
    expect(evaluateElectricalStandards({ presetId: 'single-electron', chargeCarriers: 1, voltageV: ELECTRICAL_VOLTAGE_BOUNDS_V.maximum, frequencyHz: 0 }).voltageV).toBe(1e6)

    const base: ElectricalStandardsInput = { presetId: 'hall', chargeCarriers: 1, voltageV: 0, frequencyHz: 0 }
    for (const chargeCarriers of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => evaluateElectricalStandards({ ...base, chargeCarriers })).toThrow('chargeCarriers must be finite')
    }
    expect(() => evaluateElectricalStandards({ ...base, chargeCarriers: 1.5 })).toThrow('chargeCarriers must be an integer')
    for (const chargeCarriers of [0, 1_000_001]) {
      expect(() => evaluateElectricalStandards({ ...base, chargeCarriers })).toThrow('chargeCarriers must be within [1, 1000000]')
    }
    for (const frequencyHz of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => evaluateElectricalStandards({ presetId: 'josephson', chargeCarriers: 1, voltageV: 0, frequencyHz })).toThrow('frequencyHz must be finite')
    }
    for (const frequencyHz of [-1, 1e15 + 1]) {
      expect(() => evaluateElectricalStandards({ presetId: 'josephson', chargeCarriers: 1, voltageV: 0, frequencyHz })).toThrow('frequencyHz must be within [0, 1000000000000000] Hz')
    }
    for (const voltageV of [Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(() => evaluateElectricalStandards({ ...base, voltageV })).toThrow('voltageV must be finite')
    }
    for (const voltageV of [-1, 1_000_001]) {
      expect(() => evaluateElectricalStandards({ ...base, voltageV })).toThrow('voltageV must be within [0, 1000000] V')
    }
    expect(() => evaluateElectricalStandards({ ...base, presetId: 'josephson', frequencyHz: 0 })).toThrow('frequencyHz must be greater than 0 Hz')
    expect(() => evaluateElectricalStandards({ ...base, frequencyHz: 1e9 })).toThrow('frequencyHz must be 0 when the josephson calculation is inactive')
    expect(() => evaluateElectricalStandards({ presetId: 'hall', chargeCarriers: 1, voltageV: 0 } as unknown as ElectricalStandardsInput)).toThrow('must provide exactly')
    expect(() => evaluateElectricalStandards({ ...base, extra: 1 } as unknown as ElectricalStandardsInput)).toThrow('must provide exactly')
    expect(() => evaluateElectricalStandards({ ...base, presetId: 'ampere' } as unknown as ElectricalStandardsInput)).toThrow('Unknown electrical standards preset: ampere')
    expect(() => evaluateElectricalStandards(null as unknown as ElectricalStandardsInput)).toThrow('input must be an object')
  })

  it('provides finite accessible node, edge, table, and series projections', () => {
    const output = evaluateElectricalStandards({ presetId: 'josephson', chargeCarriers: 4, frequencyHz: 1e12, voltageV: 2 })
    const table = projectElectricalStandardsTable(output)
    const series = projectElectricalStandardsSeries(output)

    expect(table).toHaveLength(output.nodes.length)
    expect(series).toHaveLength(output.nodes.length)
    expect(output.edges.every(({ from, to, equation }) => from.length > 0 && to.length > 0 && equation.length > 0)).toBe(true)
    expect(table.every(({ statusLabel, note }) => statusLabel.length > 0 && note.length > 0)).toBe(true)
    expect(series.every(({ log10AbsoluteValue, accessibleLabel }) => Number.isFinite(log10AbsoluteValue) && accessibleLabel.length > 0)).toBe(true)
    expectOnlyFiniteNumbers(output)
  })
})

describe('Tour conventional engines deterministic immutable contract', () => {
  it.each([
    {
      label: 'scale ruler',
      input: { quantityFamily: 'length', presetId: 'earth-radius' } as const,
      evaluate: (input: { quantityFamily: 'length'; presetId: 'earth-radius' }) => evaluateScaleRuler(input),
    },
    {
      label: 'photon bridge',
      input: { frequencyHz: 5e14 } as const,
      evaluate: (input: { frequencyHz: number }) => evaluatePhotonBridge(input),
    },
    {
      label: 'electrical standards',
      input: { presetId: 'josephson', chargeCarriers: 2, frequencyHz: 70e9, voltageV: 1e-3 } as const,
      evaluate: (input: { presetId: 'josephson'; chargeCarriers: number; frequencyHz: number; voltageV: number }) => evaluateElectricalStandards(input),
    },
  ])('$label is deterministic, leaves input unchanged, and deeply freezes each result', ({ input, evaluate }) => {
    const originalInput = structuredClone(input)
    const first = evaluate(input)
    const second = evaluate(input)

    expect(input).toEqual(originalInput)
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.finding)).toBe(true)
    expect(Object.isFrozen(first.finding.assumptions)).toBe(true)
    expect(first.finding).toMatchObject({
      methodRelationship: 'not-applicable',
      modelOrigin: 'established-physics',
      resultStatus: 'computed',
      validatesTheory: false,
    })
    expect(() => {
      (first.finding.assumptions as unknown as string[])[0] = 'caller mutation'
    }).toThrow(TypeError)
    expect(evaluate(input)).toEqual(second)
    expectOnlyFiniteNumbers(first)
  })
})
