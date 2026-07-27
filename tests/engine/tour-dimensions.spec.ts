import {
  DIMENSION_AXES,
  DIMENSION_COORDINATE_SYSTEM_IDS,
  DIMENSION_EXPRESSION_PRESET_IDS,
  DIMENSION_EXPRESSION_PRESETS,
  DIMENSION_TARGET_IDS,
  DIMENSION_TARGETS,
  evaluateDimensionBuilder,
  formatDimensionVector,
  projectDimensionAxisTable,
  type DimensionBuilderInput,
  type DimensionExpressionPresetId,
  type DimensionTargetId,
} from '../../src/tour/dimensionEngine'
import type { DimensionVector } from '../../src/types/tour'

function dimension(...numerators: [number, number, number, number, number, number, number]): DimensionVector {
  return numerators.map((numerator) => ({ numerator, denominator: 1 })) as DimensionVector
}

const intendedMatches: Array<{
  target: DimensionTargetId
  expressionPreset: DimensionExpressionPresetId
  expectedDimension: DimensionVector
}> = [
  { target: 'average-speed', expressionPreset: 'path-length-over-elapsed-time', expectedDimension: dimension(-1, 1, 0, 0, 0, 0, 0) },
  { target: 'acceleration', expressionPreset: 'speed-over-elapsed-time', expectedDimension: dimension(-2, 1, 0, 0, 0, 0, 0) },
  { target: 'force', expressionPreset: 'mass-times-acceleration', expectedDimension: dimension(-2, 1, 1, 0, 0, 0, 0) },
  { target: 'energy', expressionPreset: 'force-times-path-length', expectedDimension: dimension(-2, 2, 1, 0, 0, 0, 0) },
  { target: 'power', expressionPreset: 'energy-over-elapsed-time', expectedDimension: dimension(-3, 2, 1, 0, 0, 0, 0) },
  { target: 'torque', expressionPreset: 'force-times-path-length', expectedDimension: dimension(-2, 2, 1, 0, 0, 0, 0) },
]

describe('Tour dimensional-equation engine', () => {
  it('exports the complete stable bounded catalogs in contract order', () => {
    expect(DIMENSION_AXES.map(({ id }) => id)).toEqual([
      'time',
      'length',
      'mass',
      'electric-current',
      'thermodynamic-temperature',
      'amount-of-substance',
      'luminous-intensity',
    ])
    expect(DIMENSION_TARGET_IDS).toEqual(['average-speed', 'acceleration', 'force', 'energy', 'power', 'torque'])
    expect(DIMENSION_EXPRESSION_PRESET_IDS).toEqual([
      'path-length-over-elapsed-time',
      'speed-over-elapsed-time',
      'mass-times-acceleration',
      'force-times-path-length',
      'energy-over-elapsed-time',
      'length-plus-time',
    ])
    expect(DIMENSION_COORDINATE_SYSTEM_IDS).toEqual(['si', 'mechanical-cgs'])
    expect(DIMENSION_TARGETS).toHaveLength(DIMENSION_TARGET_IDS.length)
    expect(DIMENSION_EXPRESSION_PRESETS).toHaveLength(DIMENSION_EXPRESSION_PRESET_IDS.length)
  })

  it.each(intendedMatches)('matches $target with $expressionPreset', ({ target, expressionPreset, expectedDimension }) => {
    const output = evaluateDimensionBuilder({ target, expressionPreset, coordinateSystem: 'si', sampleSiMagnitude: 2 })

    expect(output.operationStatus).toBe('defined')
    expect(output.resultDimension).toEqual(expectedDimension)
    expect(output.targetDimension).toEqual(expectedDimension)
    expect(output.targetMatch).toBe(true)
    expect(output.coordinateValue).toBe(2)
    expect(output.finding.resultStatus).toBe('computed')
    expect(output.finding.validatesTheory).toBe(false)
    expect(output.finding.establishes).toContain('matches')
  })

  it('makes unlike addition undefined and never emits a coordinate for it', () => {
    const output = evaluateDimensionBuilder({
      target: 'average-speed',
      expressionPreset: 'length-plus-time',
      coordinateSystem: 'mechanical-cgs',
      sampleSiMagnitude: 2,
    })

    expect(output).toMatchObject({
      operationStatus: 'undefined-unlike-addition',
      resultDimension: null,
      targetMatch: false,
      coordinateValue: null,
      coordinateUnit: null,
    })
    expect(output.quantityKindCaveat).toContain('unlike quantity kinds')
    expect(output.quantityKindCaveat).toContain('cannot rescue')
    expect(output.finding.cause).toContain('Addition requires')
  })

  it('reports a defined dimension mismatch without converting the target value', () => {
    const output = evaluateDimensionBuilder({
      target: 'average-speed',
      expressionPreset: 'mass-times-acceleration',
      coordinateSystem: 'mechanical-cgs',
      sampleSiMagnitude: 4,
    })

    expect(output.operationStatus).toBe('defined')
    expect(output.resultDimension).toEqual(dimension(-2, 1, 1, 0, 0, 0, 0))
    expect(output.targetDimension).toEqual(dimension(-1, 1, 0, 0, 0, 0, 0))
    expect(output.targetMatch).toBe(false)
    expect(output.coordinateValue).toBeNull()
    expect(output.coordinateUnit).toBeNull()
    expect(output.quantityKindCaveat).toContain('do not match')
  })

  it('states the energy and torque quantity-kind ambiguity for force times length', () => {
    const energy = evaluateDimensionBuilder({
      target: 'energy',
      expressionPreset: 'force-times-path-length',
      coordinateSystem: 'si',
      sampleSiMagnitude: 1,
    })
    const torque = evaluateDimensionBuilder({
      target: 'torque',
      expressionPreset: 'force-times-path-length',
      coordinateSystem: 'si',
      sampleSiMagnitude: 1,
    })

    expect(energy.targetMatch).toBe(true)
    expect(torque.targetMatch).toBe(true)
    expect(energy.targetDimension).toEqual(torque.targetDimension)
    expect(energy.quantityKindCaveat).toContain('energy and torque')
    expect(energy.quantityKindCaveat).toContain('cannot identify')
    expect(torque.quantityKindCaveat).toBe(energy.quantityKindCaveat)
    expect(torque.finding.doesNotEstablish).toContain('quantity-kind identity')
  })

  it.each([
    { target: 'average-speed', expressionPreset: 'path-length-over-elapsed-time', siUnit: 'm/s', cgsUnit: 'cm/s', factor: 1e2 },
    { target: 'acceleration', expressionPreset: 'speed-over-elapsed-time', siUnit: 'm/s^2', cgsUnit: 'cm/s^2', factor: 1e2 },
    { target: 'force', expressionPreset: 'mass-times-acceleration', siUnit: 'N', cgsUnit: 'dyn', factor: 1e5 },
    { target: 'energy', expressionPreset: 'force-times-path-length', siUnit: 'J', cgsUnit: 'erg', factor: 1e7 },
    { target: 'power', expressionPreset: 'energy-over-elapsed-time', siUnit: 'W', cgsUnit: 'erg/s', factor: 1e7 },
    { target: 'torque', expressionPreset: 'force-times-path-length', siUnit: 'N m', cgsUnit: 'dyn cm', factor: 1e7 },
  ] as const)('converts $target only through its declared SI/mechanical-CGS factor', ({ target, expressionPreset, siUnit, cgsUnit, factor }) => {
    const si = evaluateDimensionBuilder({ target, expressionPreset, coordinateSystem: 'si', sampleSiMagnitude: 2.5 })
    const cgs = evaluateDimensionBuilder({ target, expressionPreset, coordinateSystem: 'mechanical-cgs', sampleSiMagnitude: 2.5 })

    expect(si.coordinateValue).toBe(2.5)
    expect(si.coordinateUnit).toBe(siUnit)
    expect(cgs.coordinateValue).toBe(2.5 * factor)
    expect(cgs.coordinateUnit).toBe(cgsUnit)
  })

  it('accepts both magnitude boundaries and rejects non-finite or out-of-bounds values', () => {
    const base = {
      target: 'average-speed',
      expressionPreset: 'path-length-over-elapsed-time',
      coordinateSystem: 'si',
    } as const

    expect(evaluateDimensionBuilder({ ...base, sampleSiMagnitude: 0.1 }).coordinateValue).toBe(0.1)
    expect(evaluateDimensionBuilder({ ...base, sampleSiMagnitude: 100 }).coordinateValue).toBe(100)
    for (const sampleSiMagnitude of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => evaluateDimensionBuilder({ ...base, sampleSiMagnitude })).toThrow('sampleSiMagnitude must be finite')
    }
    for (const sampleSiMagnitude of [0.099, 100.001]) {
      expect(() => evaluateDimensionBuilder({ ...base, sampleSiMagnitude })).toThrow('sampleSiMagnitude must be within [0.1, 100]')
    }
  })

  it('fails closed with useful errors for every unknown ID axis', () => {
    const base: DimensionBuilderInput = {
      target: 'average-speed',
      expressionPreset: 'path-length-over-elapsed-time',
      coordinateSystem: 'si',
      sampleSiMagnitude: 2,
    }

    expect(() => evaluateDimensionBuilder({ ...base, target: 'velocity' } as unknown as DimensionBuilderInput)).toThrow('Unknown dimension builder target: velocity')
    expect(() => evaluateDimensionBuilder({ ...base, expressionPreset: 'free-form' } as unknown as DimensionBuilderInput)).toThrow('Unknown dimension builder expression preset: free-form')
    expect(() => evaluateDimensionBuilder({ ...base, coordinateSystem: 'electromagnetic-cgs' } as unknown as DimensionBuilderInput)).toThrow('Unknown dimension builder coordinate system: electromagnetic-cgs')
    expect(() => evaluateDimensionBuilder(null as unknown as DimensionBuilderInput)).toThrow('input must be an object')
  })

  it('is deterministic, leaves input unchanged, and returns independent mutable results', () => {
    const input: DimensionBuilderInput = {
      target: 'force',
      expressionPreset: 'mass-times-acceleration',
      coordinateSystem: 'mechanical-cgs',
      sampleSiMagnitude: 3,
    }
    const originalInput = structuredClone(input)
    const first = evaluateDimensionBuilder(input)
    const second = evaluateDimensionBuilder(input)

    expect(input).toEqual(originalInput)
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first.resultDimension).not.toBe(second.resultDimension)
    expect(first.targetDimension).not.toBe(second.targetDimension)
    first.resultDimension![0].numerator = 99
    first.finding.assumptions[0] = 'mutated caller copy'
    expect(evaluateDimensionBuilder(input)).toEqual(second)
    expect(Object.isFrozen(DIMENSION_TARGETS)).toBe(true)
    expect(Object.isFrozen(DIMENSION_EXPRESSION_PRESETS)).toBe(true)
  })

  it('emits canonical rational objects and an accessible seven-row axis table', () => {
    const output = evaluateDimensionBuilder({
      target: 'power',
      expressionPreset: 'energy-over-elapsed-time',
      coordinateSystem: 'si',
      sampleSiMagnitude: 2,
    })
    const table = projectDimensionAxisTable(output)

    expect(output.resultDimension).toEqual(dimension(-3, 2, 1, 0, 0, 0, 0))
    expect(output.resultDimension?.every(({ numerator, denominator }) => Number.isInteger(numerator) && denominator === 1)).toBe(true)
    expect(table).toHaveLength(7)
    expect(table[0]).toEqual({
      axisId: 'time',
      axisLabel: 'Time',
      axisSymbol: 'T',
      resultExponent: { numerator: -3, denominator: 1 },
      targetExponent: { numerator: -3, denominator: 1 },
      resultText: '-3',
      targetText: '-3',
    })
    expect(table.map(({ axisLabel }) => axisLabel)).toEqual([
      'Time',
      'Length',
      'Mass',
      'Electric current',
      'Thermodynamic temperature',
      'Amount of substance',
      'Luminous intensity',
    ])
    expect(formatDimensionVector(output.resultDimension)).toBe('T^-3 L^2 M')

    const rationalVector = dimension(0, 0, 0, 0, 0, 0, 0)
    rationalVector[1] = { numerator: 1, denominator: 2 }
    expect(formatDimensionVector(rationalVector)).toBe('L^(1/2)')
    expect(formatDimensionVector(null)).toBe('undefined')
    expect(projectDimensionAxisTable({ resultDimension: null, targetDimension: output.targetDimension }))
      .toSatisfy((rows: ReturnType<typeof projectDimensionAxisTable>) => rows.every(({ resultExponent, resultText }) => resultExponent === null && resultText === 'undefined'))
  })
})
