import type { ComplexValue, DimensionVector, EvaluationSymbol } from '../types/engine'
import type { PlotFigure } from '../types/plot'

export type ComputeIntentKind =
  | 'evaluate'
  | 'differentiate'
  | 'integrate'
  | 'solve'
  | 'simplify'
  | 'plot2d'
  | 'plot3d'
  | 'matrix'

export interface ComputeIntent {
  kind: ComputeIntentKind
  expression: string
  variable?: string
  order?: number
  from?: string
  to?: string
  xFrom?: number
  xTo?: number
  yFrom?: number
  yTo?: number
  equation?: string
}

export interface ComputeContext {
  sourceId: string
  sourceLabel: string
  symbols: Readonly<Record<string, EvaluationSymbol>>
  notes: readonly string[]
}

export interface QuantityInterpretation {
  name: string
  kind: string
}

export interface ComputeResult {
  query: string
  rewritten: string
  intent: ComputeIntent
  value?: ComplexValue
  dimension?: DimensionVector
  siUnit?: string
  basicDimensions?: string
  formatted?: string
  symbolic?: string
  latex?: string
  interpretations: readonly QuantityInterpretation[]
  interpretationCaveat?: string
  figure?: PlotFigure
  steps: readonly string[]
  warnings: readonly string[]
  error?: string
}

export const NAMED_QUANTITY_CAVEAT = 'Named quantity lists share a dimension; they do not establish quantity-kind identity.'

export const EMPTY_COMPUTE_CONTEXT: ComputeContext = Object.freeze({
  sourceId:    'si-planck',
  sourceLabel: 'SI defining constants and derived Planck units',
  symbols:     Object.freeze({}),
  notes:       Object.freeze([NAMED_QUANTITY_CAVEAT]),
})
