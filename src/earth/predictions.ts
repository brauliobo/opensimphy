import {
  EARTH_PREDICTION_LABELS,
  EARTH_PREDICTION_SCHEMA,
  assertEarthPredictionRow,
  predictionRowsForDisplay,
  type EarthPredictionAuditStatus,
  type EarthPredictionDisplayRow as EarthPredictionLedgerDisplayRow,
} from '../engine/earth/particle/ledger.js'
import { formatScalar, isJsonObject } from './workbench'

export {
  EARTH_PREDICTION_LABELS,
  EARTH_PREDICTION_SCHEMA,
}

export interface EarthPredictionDisplayRow {
  claimId: string
  observable: string
  unit: string
  earth: string
  thad: string
  nassim: string
  sm: string
  residual: string
  auditStatus: EarthPredictionAuditStatus | string
  outcome: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isJsonObject(value) ? value : null
}

export function predictionOutcomeLabel(status: string): string {
  if (status === 'falsified' || status === 'failed' || status === 'fail') return 'Failed'
  if (status === 'missing' || status === 'absent') return 'None'
  if (status === 'identity') return 'Identity, not a prediction'
  if (status === 'calibration') return 'Calibration, not a prediction'
  if (status === 'blocked') return 'Blocked'
  if (status === 'testable') return 'Testable, not confirmed'
  return status || 'Unknown'
}

function cellText(value: unknown, status?: string): string {
  if (status === 'missing' || status === 'absent' || status === 'blocked') return 'none'
  if (value == null || value === '') return 'none'
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return formatScalar(value)
  return 'none'
}

function residualText(residual: unknown, auditStatus: string): string {
  const record = asRecord(residual)
  const value = record?.earthEvalVsSm ?? record?.earthPrintedVsEval ?? record?.thadVsSm ?? record?.nassimVsSm
  const number = value == null ? '' : formatScalar(value)
  if (auditStatus === 'falsified' || auditStatus === 'failed' || auditStatus === 'fail') {
    return number ? `${number} · Failed` : 'Failed'
  }
  if (auditStatus === 'missing' || auditStatus === 'absent') return 'None'
  return number || predictionOutcomeLabel(auditStatus)
}

function fromLedgerDisplay(row: EarthPredictionLedgerDisplayRow): EarthPredictionDisplayRow {
  const column = (program: 'earth' | 'thad' | 'nassim' | 'sm') => {
    const match = row.columns.find((item) => item.program === program)
    return cellText(match?.value, match?.status)
  }
  return {
    claimId:      row.claimId,
    observable:   row.observable,
    unit:         row.unit,
    earth:        column('earth'),
    thad:         column('thad'),
    nassim:       column('nassim'),
    sm:           column('sm'),
    residual:     residualText(row.residual, row.auditStatus),
    auditStatus:  row.auditStatus,
    outcome:      row.gate === 'fail' || row.auditStatus === 'falsified'
      ? 'Failed'
      : predictionOutcomeLabel(row.auditStatus),
  }
}

function fromLooseRow(raw: Record<string, unknown>, index: number): EarthPredictionDisplayRow {
  const earth = asRecord(raw.earth)
  const thad = asRecord(raw.thad)
  const nassim = asRecord(raw.nassim)
  const sm = asRecord(raw.sm)
  const auditStatus = typeof raw.auditStatus === 'string' ? raw.auditStatus : 'missing'
  return {
    claimId:     typeof raw.claimId === 'string' ? raw.claimId : `prediction-${index + 1}`,
    observable:  typeof raw.observable === 'string' ? raw.observable : `prediction-${index + 1}`,
    unit:        typeof raw.unit === 'string' ? raw.unit : '',
    earth:       cellText(earth?.evaluated ?? earth?.printed ?? raw.earth, typeof earth?.status === 'string' ? earth.status : auditStatus),
    thad:        cellText(thad?.value ?? raw.thad, typeof thad?.status === 'string' ? thad.status : undefined),
    nassim:      cellText(nassim?.value ?? raw.nassim, typeof nassim?.status === 'string' ? nassim.status : undefined),
    sm:          cellText(sm?.value ?? raw.sm, typeof sm?.status === 'string' ? sm.status : undefined),
    residual:    residualText(raw.residual, auditStatus),
    auditStatus,
    outcome:     predictionOutcomeLabel(auditStatus),
  }
}

function predictionList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const record = asRecord(value)
  if (Array.isArray(record?.predictions)) return record.predictions
  return []
}

export function extractPredictions(result: unknown): EarthPredictionDisplayRow[] {
  const root = asRecord(result)
  if (!root) return []
  const output = asRecord(root.output)
  const ledger = asRecord(root.predictionLedger) ?? asRecord(output?.predictionLedger)
  const candidates = [
    ...predictionList(root.predictions),
    ...predictionList(output?.predictions),
    ...predictionList(ledger?.predictions),
  ]
  return candidates.flatMap((item, index) => {
    const record = asRecord(item)
    if (!record) return []
    try {
      return [fromLedgerDisplay(predictionRowsForDisplay([assertEarthPredictionRow(record)])[0]!)]
    } catch {
      return [fromLooseRow(record, index)]
    }
  })
}

export function formatPredictionCell(value: string, unit: string): string {
  if (value === 'none' || !unit) return value
  return `${value} ${unit}`
}
