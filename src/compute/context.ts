import type { EvaluationSymbol } from '../types/engine'
import { complex } from '../engine/complex'
import { DIMENSIONLESS } from '../engine/dimensions'
import type { FormulaRecord } from '../types/formula'
import { EMPTY_COMPUTE_CONTEXT, NAMED_QUANTITY_CAVEAT, type ComputeContext } from './types'

export const COMPUTE_CONTEXT_KEY = 'opensimphy-compute-context'

export function besideLabNote(beside: string): string {
  return `Prompt evaluations are local SI/Planck calculations beside ${beside}.`
}

export function computeContext(sourceId: string, sourceLabel: string, symbols: Record<string, EvaluationSymbol> = {}, notes: readonly string[] = EMPTY_COMPUTE_CONTEXT.notes): ComputeContext {
  return { sourceId, sourceLabel, symbols, notes }
}

export function formulaComputeContext(record: FormulaRecord): ComputeContext {
  const symbols: Record<string, EvaluationSymbol> = {
    computed: {
      value:     complex(record.runtimeEvaluation.computed),
      dimension: record.dimensionAudit.computedVector,
      source:    'parameter',
    },
  }
  return computeContext(
    `formula:${record.id}`,
    `Formula ${record.symbol}: ${record.name}`,
    symbols,
    [
      `Bound computed = ${record.computed} ${record.units} from the monastery formula record.`,
      NAMED_QUANTITY_CAVEAT,
    ],
  )
}

export function labeledComputeContext(sourceId: string, sourceLabel: string, note: string): ComputeContext {
  return computeContext(sourceId, sourceLabel, {}, [note, NAMED_QUANTITY_CAVEAT])
}

export function labComputeContext(sourceId: string, sourceLabel: string, beside: string): ComputeContext {
  return labeledComputeContext(sourceId, sourceLabel, besideLabNote(beside))
}

export function dimensionlessBinding(name: string, value: number): EvaluationSymbol {
  return { value: complex(value), dimension: DIMENSIONLESS, source: 'parameter' }
}
