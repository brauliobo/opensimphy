import { boundedNumber } from '../simphy/numbers'
import type {
  DimensionAxis,
  DimensionOperationOutput,
  DimensionVector,
  RationalExponent,
  ResultFinding,
  TourRuntimeResultAttribution,
} from '../types/tour'

type ReadonlyDimensionVector = readonly [
  Readonly<RationalExponent>,
  Readonly<RationalExponent>,
  Readonly<RationalExponent>,
  Readonly<RationalExponent>,
  Readonly<RationalExponent>,
  Readonly<RationalExponent>,
  Readonly<RationalExponent>,
]

type DimensionOperation = 'multiply' | 'divide' | 'add'

export const DIMENSION_TARGET_IDS = Object.freeze([
  'average-speed',
  'acceleration',
  'force',
  'energy',
  'power',
  'torque',
] as const)

export const DIMENSION_EXPRESSION_PRESET_IDS = Object.freeze([
  'path-length-over-elapsed-time',
  'speed-over-elapsed-time',
  'mass-times-acceleration',
  'force-times-path-length',
  'energy-over-elapsed-time',
  'length-plus-time',
] as const)

export const DIMENSION_COORDINATE_SYSTEM_IDS = Object.freeze([
  'si',
  'mechanical-cgs',
] as const)

export type DimensionTargetId = typeof DIMENSION_TARGET_IDS[number]
export type DimensionExpressionPresetId = typeof DIMENSION_EXPRESSION_PRESET_IDS[number]
export type DimensionCoordinateSystem = typeof DIMENSION_COORDINATE_SYSTEM_IDS[number]

export interface DimensionBuilderInput {
  target: DimensionTargetId
  expressionPreset: DimensionExpressionPresetId
  coordinateSystem: DimensionCoordinateSystem
  sampleSiMagnitude: number
}

export interface DimensionTargetCatalogEntry {
  id: DimensionTargetId
  label: string
  dimension: ReadonlyDimensionVector
  coordinates: Readonly<Record<DimensionCoordinateSystem, Readonly<{
    unit: string
    factorFromSi: number
  }>>>
}

export interface DimensionOperandCatalogEntry {
  quantityKind: string
  label: string
  dimension: ReadonlyDimensionVector
}

export interface DimensionExpressionCatalogEntry {
  id: DimensionExpressionPresetId
  label: string
  operation: DimensionOperation
  left: Readonly<DimensionOperandCatalogEntry>
  right: Readonly<DimensionOperandCatalogEntry>
}

type FindingNarrative = Pick<
  ResultFinding,
  'changed' | 'cause' | 'equation' | 'assumptions' | 'establishes' | 'doesNotEstablish'
>

export type DimensionBuilderFinding = FindingNarrative & TourRuntimeResultAttribution

export interface DimensionBuilderEvaluation extends DimensionOperationOutput {
  finding: DimensionBuilderFinding
}

export interface DimensionAxisTableRow {
  axisId: DimensionAxis['id']
  axisLabel: string
  axisSymbol: string
  resultExponent: RationalExponent | null
  targetExponent: RationalExponent
  resultText: string
  targetText: string
}

export const ISQ_DIMENSION_AXES = Object.freeze([
  Object.freeze({ id: 'time', symbol: 'T', label: 'Time' }),
  Object.freeze({ id: 'length', symbol: 'L', label: 'Length' }),
  Object.freeze({ id: 'mass', symbol: 'M', label: 'Mass' }),
  Object.freeze({ id: 'electric-current', symbol: 'I', label: 'Electric current' }),
  Object.freeze({ id: 'thermodynamic-temperature', symbol: 'Theta', label: 'Thermodynamic temperature' }),
  Object.freeze({ id: 'amount-of-substance', symbol: 'N', label: 'Amount of substance' }),
  Object.freeze({ id: 'luminous-intensity', symbol: 'J', label: 'Luminous intensity' }),
] as const satisfies readonly (Readonly<DimensionAxis> & { readonly label: string })[])

export const DIMENSION_AXES = ISQ_DIMENSION_AXES

const DIMENSION_INDICES = [0, 1, 2, 3, 4, 5, 6] as const

function readonlyDimension(...numerators: [number, number, number, number, number, number, number]): ReadonlyDimensionVector {
  return Object.freeze(numerators.map((numerator) => Object.freeze({ numerator, denominator: 1 }))) as unknown as ReadonlyDimensionVector
}

const TIME_DIMENSION         = readonlyDimension(1, 0, 0, 0, 0, 0, 0)
const LENGTH_DIMENSION       = readonlyDimension(0, 1, 0, 0, 0, 0, 0)
const MASS_DIMENSION         = readonlyDimension(0, 0, 1, 0, 0, 0, 0)
const SPEED_DIMENSION        = readonlyDimension(-1, 1, 0, 0, 0, 0, 0)
const ACCELERATION_DIMENSION = readonlyDimension(-2, 1, 0, 0, 0, 0, 0)
const FORCE_DIMENSION        = readonlyDimension(-2, 1, 1, 0, 0, 0, 0)
const ENERGY_DIMENSION       = readonlyDimension(-2, 2, 1, 0, 0, 0, 0)
const POWER_DIMENSION        = readonlyDimension(-3, 2, 1, 0, 0, 0, 0)

function coordinates(siUnit: string, cgsUnit: string, cgsFactor: number): DimensionTargetCatalogEntry['coordinates'] {
  return Object.freeze({
    si: Object.freeze({ unit: siUnit, factorFromSi: 1 }),
    'mechanical-cgs': Object.freeze({ unit: cgsUnit, factorFromSi: cgsFactor }),
  })
}

export const DIMENSION_TARGETS = Object.freeze([
  Object.freeze({ id: 'average-speed', label: 'Average speed', dimension: SPEED_DIMENSION, coordinates: coordinates('m/s', 'cm/s', 1e2) }),
  Object.freeze({ id: 'acceleration', label: 'Acceleration', dimension: ACCELERATION_DIMENSION, coordinates: coordinates('m/s^2', 'cm/s^2', 1e2) }),
  Object.freeze({ id: 'force', label: 'Force', dimension: FORCE_DIMENSION, coordinates: coordinates('N', 'dyn', 1e5) }),
  Object.freeze({ id: 'energy', label: 'Energy', dimension: ENERGY_DIMENSION, coordinates: coordinates('J', 'erg', 1e7) }),
  Object.freeze({ id: 'power', label: 'Power', dimension: POWER_DIMENSION, coordinates: coordinates('W', 'erg/s', 1e7) }),
  Object.freeze({ id: 'torque', label: 'Torque', dimension: ENERGY_DIMENSION, coordinates: coordinates('N m', 'dyn cm', 1e7) }),
] as const satisfies readonly DimensionTargetCatalogEntry[])

function operand(quantityKind: string, label: string, dimension: ReadonlyDimensionVector): Readonly<DimensionOperandCatalogEntry> {
  return Object.freeze({ quantityKind, label, dimension })
}

export const DIMENSION_EXPRESSION_PRESETS = Object.freeze([
  Object.freeze({
    id: 'path-length-over-elapsed-time',
    label: 'path length / elapsed time',
    operation: 'divide',
    left: operand('path-length', 'Path length', LENGTH_DIMENSION),
    right: operand('elapsed-time', 'Elapsed time', TIME_DIMENSION),
  }),
  Object.freeze({
    id: 'speed-over-elapsed-time',
    label: 'speed / elapsed time',
    operation: 'divide',
    left: operand('speed', 'Speed', SPEED_DIMENSION),
    right: operand('elapsed-time', 'Elapsed time', TIME_DIMENSION),
  }),
  Object.freeze({
    id: 'mass-times-acceleration',
    label: 'mass x acceleration',
    operation: 'multiply',
    left: operand('mass', 'Mass', MASS_DIMENSION),
    right: operand('acceleration', 'Acceleration', ACCELERATION_DIMENSION),
  }),
  Object.freeze({
    id: 'force-times-path-length',
    label: 'force x path length',
    operation: 'multiply',
    left: operand('force', 'Force', FORCE_DIMENSION),
    right: operand('path-length', 'Path length', LENGTH_DIMENSION),
  }),
  Object.freeze({
    id: 'energy-over-elapsed-time',
    label: 'energy / elapsed time',
    operation: 'divide',
    left: operand('energy', 'Energy', ENERGY_DIMENSION),
    right: operand('elapsed-time', 'Elapsed time', TIME_DIMENSION),
  }),
  Object.freeze({
    id: 'length-plus-time',
    label: 'path length + elapsed time',
    operation: 'add',
    left: operand('path-length', 'Path length', LENGTH_DIMENSION),
    right: operand('elapsed-time', 'Elapsed time', TIME_DIMENSION),
  }),
] as const satisfies readonly DimensionExpressionCatalogEntry[])

export const DIMENSION_EXPRESSIONS = DIMENSION_EXPRESSION_PRESETS

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left)
  let b = Math.abs(right)
  while (b !== 0) [a, b] = [b, a % b]
  return a || 1
}

function rational(numerator: number, denominator = 1): RationalExponent {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator === 0) {
    throw new Error('Dimension exponents must be finite safe-integer rational components with a nonzero denominator')
  }
  const sign = denominator < 0 ? -1 : 1
  const divisor = greatestCommonDivisor(numerator, denominator)
  return {
    numerator: sign * numerator / divisor,
    denominator: Math.abs(denominator) / divisor,
  }
}

function cloneDimension(vector: ReadonlyDimensionVector | DimensionVector): DimensionVector {
  return vector.map(({ numerator, denominator }) => rational(numerator, denominator)) as DimensionVector
}

function combineDimensions(
  left: ReadonlyDimensionVector,
  right: ReadonlyDimensionVector,
  rightSign: 1 | -1,
): DimensionVector {
  return DIMENSION_INDICES.map((index) => {
    const leftExponent = left[index]
    const rightExponent = right[index]
    const numerator = leftExponent.numerator * rightExponent.denominator
      + rightSign * rightExponent.numerator * leftExponent.denominator
    return rational(numerator, leftExponent.denominator * rightExponent.denominator)
  }) as DimensionVector
}

function dimensionsEqual(left: ReadonlyDimensionVector | DimensionVector, right: ReadonlyDimensionVector | DimensionVector): boolean {
  return DIMENSION_INDICES.every((index) => {
    const leftExponent = left[index]
    const rightExponent = right[index]
    return leftExponent.numerator * rightExponent.denominator === rightExponent.numerator * leftExponent.denominator
  })
}

function evaluateExpression(expression: DimensionExpressionCatalogEntry): {
  operationStatus: DimensionOperationOutput['operationStatus']
  resultDimension: DimensionVector | null
} {
  if (expression.operation === 'multiply') {
    return { operationStatus: 'defined', resultDimension: combineDimensions(expression.left.dimension, expression.right.dimension, 1) }
  }
  if (expression.operation === 'divide') {
    return { operationStatus: 'defined', resultDimension: combineDimensions(expression.left.dimension, expression.right.dimension, -1) }
  }
  if (
    expression.left.quantityKind !== expression.right.quantityKind
    || !dimensionsEqual(expression.left.dimension, expression.right.dimension)
  ) {
    return { operationStatus: 'undefined-unlike-addition', resultDimension: null }
  }
  return { operationStatus: 'defined', resultDimension: cloneDimension(expression.left.dimension) }
}

function formatRationalExponent(exponent: Readonly<RationalExponent>): string {
  const normalized = rational(exponent.numerator, exponent.denominator)
  return normalized.denominator === 1
    ? String(normalized.numerator)
    : `${normalized.numerator}/${normalized.denominator}`
}

export function formatDimensionVector(vector: ReadonlyDimensionVector | DimensionVector | null): string {
  if (vector === null) return 'undefined'
  const terms = DIMENSION_INDICES.flatMap((index) => {
    const exponent = vector[index]
    const normalized = rational(exponent.numerator, exponent.denominator)
    if (normalized.numerator === 0) return []
    const symbol = ISQ_DIMENSION_AXES[index].symbol
    if (normalized.numerator === normalized.denominator) return [symbol]
    const power = formatRationalExponent(normalized)
    return [normalized.denominator === 1 ? `${symbol}^${power}` : `${symbol}^(${power})`]
  })
  return terms.length > 0 ? terms.join(' ') : '1'
}

export function projectDimensionAxisTable(
  output: Pick<DimensionOperationOutput, 'resultDimension' | 'targetDimension'>,
): DimensionAxisTableRow[] {
  return DIMENSION_INDICES.map((index) => {
    const axis = ISQ_DIMENSION_AXES[index]
    const resultExponent = output.resultDimension?.[index] ?? null
    const targetExponent = output.targetDimension[index]
    return {
      axisId: axis.id,
      axisLabel: axis.label,
      axisSymbol: axis.symbol,
      resultExponent: resultExponent ? rational(resultExponent.numerator, resultExponent.denominator) : null,
      targetExponent: rational(targetExponent.numerator, targetExponent.denominator),
      resultText: resultExponent ? formatRationalExponent(resultExponent) : 'undefined',
      targetText: formatRationalExponent(targetExponent),
    }
  })
}

function quantityKindCaveat(
  expression: DimensionExpressionCatalogEntry,
  operationStatus: DimensionOperationOutput['operationStatus'],
  targetMatch: boolean,
): string {
  if (operationStatus === 'undefined-unlike-addition') {
    return 'Path length and elapsed time are unlike quantity kinds, so their sum is undefined; unit conversion cannot rescue the operation.'
  }
  if (expression.id === 'force-times-path-length') {
    return 'Force times path length has the dimension shared by energy and torque; dimension equality alone cannot identify which quantity kind the expression denotes.'
  }
  if (targetMatch) {
    return 'The dimensions match, but dimension equality is necessary and not sufficient for equality of quantity kind or empirical validity.'
  }
  return 'The dimensions do not match the target; even a dimension match would not by itself establish equality of quantity kind or empirical validity.'
}

function operationEquation(operation: DimensionOperation): string {
  if (operation === 'multiply') return 'dim(A B) = dim(A) + dim(B)'
  if (operation === 'divide') return 'dim(A / B) = dim(A) - dim(B)'
  return 'A + B is defined only for quantities of the same kind'
}

function buildFinding(
  target: DimensionTargetCatalogEntry,
  expression: DimensionExpressionCatalogEntry,
  operationStatus: DimensionOperationOutput['operationStatus'],
  resultDimension: DimensionVector | null,
  targetMatch: boolean,
  caveat: string,
): DimensionBuilderFinding {
  const resultText = formatDimensionVector(resultDimension)
  const targetText = formatDimensionVector(target.dimension)
  const establishes = operationStatus === 'undefined-unlike-addition'
    ? `The bounded expression ${expression.label} is undefined because its addends have unlike quantity kinds.`
    : `The bounded expression has dimension ${resultText} and ${targetMatch ? 'matches' : 'does not match'} the ${target.label} target dimension ${targetText}.`

  return {
    changed: `Evaluating ${expression.label} against ${target.label} produced operation status ${operationStatus}.`,
    cause: operationStatus === 'undefined-unlike-addition'
      ? 'Addition requires operands of the same quantity kind; path length and elapsed time are unlike.'
      : 'Multiplication adds dimension exponents and division subtracts them in the declared ISQ-axis order.',
    equation: operationEquation(expression.operation),
    assumptions: [
      'The named expression operand quantity kinds are declared correctly.',
      'The selected target value is supplied in its canonical SI unit.',
      'No quantity-kind identity is inferred from dimension equality.',
    ],
    establishes,
    doesNotEstablish: 'The result does not establish quantity-kind identity, empirical validity, agreement with a dataset, or electromagnetic-CGS or affine conversion behavior.',
    claimClass: 'identity',
    evidenceRefs: ['jcgm-vim-3', 'nist-sp811'],
    sourceRevision: 'JCGM 200:2012; NIST SP 811e2008',
    sourceLocator: 'VIM3 entries 1.2, 1.7, and 1.19-1.21; NIST SP 811 chapter 8 and Appendix B',
    methodRelationship: 'contract-validator',
    modelOrigin: 'established-physics',
    resultStatus: 'computed',
    validatesTheory: false,
    caveats: [
      caveat,
      'Electromagnetic CGS and affine temperature conversions are outside this bounded engine.',
    ],
  }
}

function validateInput(input: DimensionBuilderInput): void {
  if (!input || typeof input !== 'object') throw new Error('Dimension builder input must be an object')
  if (!(DIMENSION_TARGET_IDS as readonly unknown[]).includes(input.target)) {
    throw new Error(`Unknown dimension builder target: ${String(input.target)}`)
  }
  if (!(DIMENSION_EXPRESSION_PRESET_IDS as readonly unknown[]).includes(input.expressionPreset)) {
    throw new Error(`Unknown dimension builder expression preset: ${String(input.expressionPreset)}`)
  }
  if (!(DIMENSION_COORDINATE_SYSTEM_IDS as readonly unknown[]).includes(input.coordinateSystem)) {
    throw new Error(`Unknown dimension builder coordinate system: ${String(input.coordinateSystem)}`)
  }
  boundedNumber(input.sampleSiMagnitude, 'sampleSiMagnitude', 0.1, 100)
}

export function evaluateDimensionBuilder(input: DimensionBuilderInput): DimensionBuilderEvaluation {
  validateInput(input)
  const target = DIMENSION_TARGETS.find(({ id }) => id === input.target)!
  const expression = DIMENSION_EXPRESSION_PRESETS.find(({ id }) => id === input.expressionPreset)!
  const { operationStatus, resultDimension } = evaluateExpression(expression)
  const targetDimension = cloneDimension(target.dimension)
  const targetMatch = resultDimension !== null && dimensionsEqual(resultDimension, targetDimension)
  const caveat = quantityKindCaveat(expression, operationStatus, targetMatch)
  const coordinate = targetMatch ? target.coordinates[input.coordinateSystem] : null

  return {
    operationStatus,
    resultDimension,
    targetDimension,
    targetMatch,
    quantityKindCaveat: caveat,
    coordinateValue: coordinate ? input.sampleSiMagnitude * coordinate.factorFromSi : null,
    coordinateUnit: coordinate?.unit ?? null,
    finding: buildFinding(target, expression, operationStatus, resultDimension, targetMatch, caveat),
  }
}
