import type { CaseMetric, CaseTableColumn } from '../cases/types'
import type { PlotLineSeries } from '../types/plot'
import {
  boundsOf,
  projectPolyline,
  seriesFromPoints,
  type PlotPoint,
} from '../simphy/plot'

export { boundsOf, projectPolyline, seriesFromPoints, type PlotPoint }

export interface CaseFigureTable {
  caption: string
  columns: readonly CaseTableColumn[]
  rows: readonly Record<string, string | number>[]
  testId: string
}

export interface ScikitBeamFigure {
  operation: 'sphere-form-factor' | 'lag-correlation'
  metrics: readonly CaseMetric[]
  series: readonly PlotLineSeries[]
  xLabel: string
  yLabel: string
  table: CaseFigureTable
}

export interface RaysectFigure {
  metrics: readonly CaseMetric[]
  ray: readonly PlotPoint[]
  prism: readonly PlotPoint[]
}

export interface QuantumOpticsJlFigure {
  metrics: readonly CaseMetric[]
  series: readonly PlotLineSeries[]
  table: CaseFigureTable
}

export interface AstropyFigure {
  operation: 'unit-convert' | 'icrs-to-galactic'
  metrics: readonly CaseMetric[]
  marker: PlotPoint | null
}

export interface PymunkFigure {
  metrics: readonly CaseMetric[]
  x: number
  y: number
  angle: number
}

export interface GalpyFigure {
  operation: 'integrate-orbit' | 'circular-velocity'
  metrics: readonly CaseMetric[]
  series: readonly PlotLineSeries[]
  table: CaseFigureTable | null
}

export interface HeadlessSphereDropFigure {
  operation: 'step' | 'version'
  metrics: readonly CaseMetric[]
  y: number | null
}

export type PhysxFigure = HeadlessSphereDropFigure
export type NewtonFigure = HeadlessSphereDropFigure
export type FluidEngineDevFigure = HeadlessSphereDropFigure

export interface NcollideFigure {
  operation: 'step' | 'distance' | 'contact' | 'ray' | 'time-of-impact'
  metrics: readonly CaseMetric[]
  y: number | null
}

export interface CanteraFigure {
  operation: 'thermo' | 'equilibrate-hp' | 'reactor'
  metrics: readonly CaseMetric[]
  marker: PlotPoint
  xLabel: string
  yLabel: string
}

function recordOf(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function finiteOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function arrayOf(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null
}

export function formatCaseScalar(value: number): string {
  if (Object.is(value, -0) || value === 0) return '0'
  if (Number.isInteger(value) && Math.abs(value) < 1e15) return String(value)
  const abs = Math.abs(value)
  if (abs >= 1e6 || abs < 1e-3) return value.toExponential(6)
  return value.toFixed(6)
}

function sampleRow(index: number, cells: Record<string, string | number>): Record<string, string | number> {
  return { id: String(index), ...cells }
}

export function scikitBeamFigure(result: unknown): ScikitBeamFigure | null {
  const record = recordOf(result)
  if (record?.operation === 'sphere-form-factor') {
    const samples = arrayOf(record.samples)
    if (!samples) return null
    const points: PlotPoint[] = []
    const rows: Record<string, string | number>[] = []
    for (const [index, entry] of samples.entries()) {
      const sample = recordOf(entry)
      const qNmInv = finiteOf(sample?.qNmInv)
      const formFactor = finiteOf(sample?.formFactor)
      const intensity = finiteOf(sample?.intensity)
      if (qNmInv === null || formFactor === null || intensity === null) return null
      points.push({ x: qNmInv, y: intensity })
      rows.push(sampleRow(index, {
        q:           formatCaseScalar(qNmInv),
        formFactor:  formatCaseScalar(formFactor),
        intensity:   formatCaseScalar(intensity),
      }))
    }
    const firstMinimum = finiteOf(record.firstMinimumQNmInv)
    return {
      operation: 'sphere-form-factor',
      metrics:   [
        { label: 'Samples', value: String(points.length) },
        { label: 'I(0)', value: points[0] ? formatCaseScalar(points[0].y) : 'n/a', tone: 'ok' },
        { label: 'First minimum q', value: firstMinimum === null ? 'none' : formatCaseScalar(firstMinimum) },
      ],
      series:  [seriesFromPoints('intensity', points, { testId: 'awesome-case-scikit-beam-curve' })],
      xLabel:  'q (nm⁻¹)',
      yLabel:  'I(q)',
      table:   {
        caption: 'Sphere form-factor samples',
        columns: [{ key: 'q', label: 'q' }, { key: 'formFactor', label: 'F(q)' }, { key: 'intensity', label: 'I(q)' }],
        rows,
        testId:  'awesome-case-scikit-beam-table',
      },
    }
  }
  if (record?.operation === 'lag-correlation') {
    const lags = arrayOf(record.lags)
    const correlation = arrayOf(record.correlation)
    if (!lags || !correlation || lags.length !== correlation.length) return null
    const points: PlotPoint[] = []
    const rows: Record<string, string | number>[] = []
    for (const [index, lagValue] of lags.entries()) {
      const lag = finiteOf(lagValue)
      const value = finiteOf(correlation[index])
      if (lag === null || value === null) return null
      points.push({ x: lag, y: value })
      rows.push(sampleRow(index, { lag, correlation: formatCaseScalar(value) }))
    }
    const peakLag = finiteOf(record.peakLag)
    return {
      operation: 'lag-correlation',
      metrics:   [
        { label: 'Lags', value: String(points.length) },
        { label: 'C(0)', value: points[0] ? formatCaseScalar(points[0].y) : 'n/a', tone: 'ok' },
        { label: 'Peak lag', value: peakLag === null ? 'n/a' : String(peakLag) },
      ],
      series:  [seriesFromPoints('correlation', points, { testId: 'awesome-case-scikit-beam-curve' })],
      xLabel:  'lag',
      yLabel:  'C(k)',
      table:   {
        caption: 'Normalized lag correlation',
        columns: [{ key: 'lag', label: 'Lag' }, { key: 'correlation', label: 'C(k)' }],
        rows,
        testId:  'awesome-case-scikit-beam-table',
      },
    }
  }
  return null
}

export function raysectFigure(result: unknown): RaysectFigure | null {
  const record = recordOf(result)
  if (record?.operation !== 'prism-trace') return null
  const polyline = arrayOf(record.polyline)
  if (!polyline) return null
  const ray: PlotPoint[] = []
  for (const entry of polyline) {
    const point = recordOf(entry)
    const x = finiteOf(point?.x)
    const y = finiteOf(point?.y)
    if (x === null || y === null) return null
    ray.push({ x, y })
  }
  if (ray.length < 4) return null
  const prismA = ray[1]
  const prismB = ray[2]
  if (!prismA || !prismB) return null
  const n = finiteOf(record.refractiveIndex)
  const deviation = finiteOf(record.deviationDeg)
  const transmitted = record.transmitted === true
  return {
    metrics: [
      { label: 'n(λ)', value: n === null ? 'n/a' : formatCaseScalar(n) },
      { label: 'Deviation', value: deviation === null ? 'n/a' : `${formatCaseScalar(deviation)}°`, tone: 'ok' },
      { label: 'Transmitted', value: transmitted ? 'true' : 'false', tone: transmitted ? 'ok' : 'warn' },
    ],
    ray,
    prism: [ { x: 0, y: 0 }, prismA, prismB ],
  }
}

export function quantumOpticsJlFigure(result: unknown): QuantumOpticsJlFigure | null {
  const record = recordOf(result)
  if (record?.operation !== 'jaynes-cummings') return null
  const samples = arrayOf(record.samples)
  if (!samples) return null
  const points: PlotPoint[] = []
  const rows: Record<string, string | number>[] = []
  for (const [index, entry] of samples.entries()) {
    const sample = recordOf(entry)
    const time = finiteOf(sample?.time)
    const excited = finiteOf(sample?.excitedPopulation)
    const photons = finiteOf(sample?.cavityPhotons)
    const inversion = finiteOf(sample?.inversion)
    const step = finiteOf(sample?.step)
    if (time === null || excited === null || photons === null || inversion === null || step === null) return null
    points.push({ x: time, y: excited })
    rows.push(sampleRow(index, {
      step,
      time:       formatCaseScalar(time),
      excited:    formatCaseScalar(excited),
      photons:    formatCaseScalar(photons),
      inversion:  formatCaseScalar(inversion),
    }))
  }
  const vacuumRabi = finiteOf(record.vacuumRabiFrequency)
  const peak = finiteOf(record.peakExcitedPopulation)
  return {
    metrics: [
      { label: 'Ω', value: vacuumRabi === null ? 'n/a' : formatCaseScalar(vacuumRabi), tone: 'ok' },
      { label: 'Peak P_e', value: peak === null ? 'n/a' : formatCaseScalar(peak) },
      { label: 'Samples', value: String(points.length) },
    ],
    series: [seriesFromPoints('excited', points, { testId: 'awesome-case-quantumoptics-jl-curve' })],
    table:  {
      caption: 'Jaynes-Cummings samples',
      columns: [
        { key: 'step', label: 'Step' },
        { key: 'time', label: 'Time' },
        { key: 'excited', label: 'P_e' },
        { key: 'photons', label: '⟨n⟩' },
        { key: 'inversion', label: 'Inversion' },
      ],
      rows,
      testId: 'awesome-case-quantumoptics-jl-table',
    },
  }
}

export function astropyFigure(result: unknown): AstropyFigure | null {
  const record = recordOf(result)
  if (record?.operation === 'unit-convert') {
    const value = finiteOf(record.value)
    const dimension = typeof record.dimension === 'string' ? record.dimension : null
    if (value === null || dimension === null) return null
    return {
      operation: 'unit-convert',
      metrics:   [
        { label: 'Dimension', value: dimension },
        { label: 'Value', value: formatCaseScalar(value), tone: 'ok' },
      ],
      marker: null,
    }
  }
  if (record?.operation === 'icrs-to-galactic') {
    const lDeg = finiteOf(record.lDeg)
    const bDeg = finiteOf(record.bDeg)
    if (lDeg === null || bDeg === null) return null
    return {
      operation: 'icrs-to-galactic',
      metrics:   [
        { label: 'l', value: `${formatCaseScalar(lDeg)}°`, tone: 'ok' },
        { label: 'b', value: `${formatCaseScalar(bDeg)}°` },
      ],
      marker: { x: lDeg, y: bDeg },
    }
  }
  return null
}

export function pymunkFigure(result: unknown): PymunkFigure | null {
  const record = recordOf(result)
  if (record?.operation !== 'step' && record?.operation !== 'snapshot') return null
  const snapshot = recordOf(record.snapshot)
  const x = finiteOf(snapshot?.x)
  const y = finiteOf(snapshot?.y)
  const angle = finiteOf(snapshot?.angle)
  const steps = finiteOf(snapshot?.steps)
  if (x === null || y === null || angle === null || steps === null) return null
  return {
    metrics: [
      { label: 'x', value: formatCaseScalar(x) },
      { label: 'y', value: formatCaseScalar(y), tone: 'ok' },
      { label: 'angle', value: formatCaseScalar(angle) },
      { label: 'steps', value: String(steps) },
    ],
    x,
    y,
    angle,
  }
}

export function galpyFigure(result: unknown): GalpyFigure | null {
  const record = recordOf(result)
  if (record?.operation === 'circular-velocity') {
    const value = finiteOf(record.value)
    if (value === null) return null
    return {
      operation: 'circular-velocity',
      metrics:   [{ label: 'v_c(R)', value: formatCaseScalar(value), tone: 'ok' }],
      series:    [],
      table:     null,
    }
  }
  if (record?.operation !== 'integrate-orbit') return null
  const samples = arrayOf(record.samples)
  const invariants = recordOf(record.invariants)
  if (!samples || !invariants) return null
  const rz: PlotPoint[] = []
  const rows: Record<string, string | number>[] = []
  for (const [index, entry] of samples.entries()) {
    const sample = recordOf(entry)
    const R = finiteOf(sample?.R)
    const z = finiteOf(sample?.z)
    const phi = finiteOf(sample?.phi)
    const time = finiteOf(sample?.time)
    const energy = finiteOf(sample?.energy)
    if (R === null || z === null || phi === null || time === null || energy === null) return null
    rz.push({ x: R, y: z })
    rows.push(sampleRow(index, {
      time:   formatCaseScalar(time),
      R:      formatCaseScalar(R),
      z:      formatCaseScalar(z),
      phi:    formatCaseScalar(phi),
      energy: formatCaseScalar(energy),
    }))
  }
  const energyDrift = finiteOf(invariants.energyRelativeDrift)
  const lzDrift = finiteOf(invariants.LzRelativeDrift)
  const circular = finiteOf(record.circularVelocityAtR0)
  return {
    operation: 'integrate-orbit',
    metrics:   [
      { label: 'Samples', value: String(rz.length) },
      { label: 'ΔE/E', value: energyDrift === null ? 'n/a' : formatCaseScalar(energyDrift), tone: 'ok' },
      { label: 'ΔL_z/L_z', value: lzDrift === null ? 'n/a' : formatCaseScalar(lzDrift) },
      { label: 'v_c(R₀)', value: circular === null ? 'n/a' : formatCaseScalar(circular) },
    ],
    series: [seriesFromPoints('meridional', rz, { testId: 'awesome-case-galpy-curve' })],
    table:  {
      caption: 'MWPotential2014 orbit samples',
      columns: [
        { key: 'time', label: 'Time' },
        { key: 'R', label: 'R' },
        { key: 'z', label: 'z' },
        { key: 'phi', label: 'φ' },
        { key: 'energy', label: 'E' },
      ],
      rows,
      testId: 'awesome-case-galpy-table',
    },
  }
}

function headlessSphereDropFigure(result: unknown): HeadlessSphereDropFigure | null {
  const record = recordOf(result)
  if (record?.operation === 'version') {
    const version = finiteOf(record.version)
    if (version === null) return null
    return {
      operation: 'version',
      metrics:   [{ label: 'version', value: formatCaseScalar(version), tone: 'ok' }],
      y:         null,
    }
  }
  if (record?.operation !== 'step') return null
  const y = finiteOf(record.y)
  if (y === null) return null
  if (record.units !== 'world-units') return null
  return {
    operation: 'step',
    metrics:   [
      { label: 'y', value: formatCaseScalar(y), tone: 'ok' },
      { label: 'units', value: 'world-units' },
    ],
    y,
  }
}

export function physxFigure(result: unknown): PhysxFigure | null {
  return headlessSphereDropFigure(result)
}

export function newtonFigure(result: unknown): NewtonFigure | null {
  return headlessSphereDropFigure(result)
}

export function ncollideFigure(result: unknown): NcollideFigure | null {
  const record = recordOf(result)
  if (record?.operation === 'step') {
    const figure = headlessSphereDropFigure(result)
    return figure === null ? null : { ...figure, operation: 'step' }
  }
  if (
    record?.operation !== 'distance'
    && record?.operation !== 'contact'
    && record?.operation !== 'ray'
    && record?.operation !== 'time-of-impact'
  ) return null
  const value = finiteOf(record.value)
  if (value === null) return null
  return {
    operation: record.operation,
    metrics:   [{ label: 'value', value: formatCaseScalar(value), tone: 'ok' }],
    y:         null,
  }
}

export function fluidEngineDevFigure(result: unknown): FluidEngineDevFigure | null {
  return headlessSphereDropFigure(result)
}

export function canteraFigure(result: unknown): CanteraFigure | null {
  const record = recordOf(result)
  if (record?.operation === 'thermo') {
    const temperatureK = finiteOf(record.temperatureK)
    const pressurePa = finiteOf(record.pressurePa)
    const enthalpyMass = finiteOf(record.enthalpyMass)
    const cpMass = finiteOf(record.cpMass)
    const density = finiteOf(record.density)
    if (temperatureK === null || pressurePa === null || enthalpyMass === null || cpMass === null || density === null) return null
    return {
      operation: 'thermo',
      metrics:   [
        { label: 'T', value: `${formatCaseScalar(temperatureK)} K`, tone: 'ok' },
        { label: 'P', value: `${formatCaseScalar(pressurePa)} Pa` },
        { label: 'h', value: `${formatCaseScalar(enthalpyMass)} J/kg` },
        { label: 'cp', value: `${formatCaseScalar(cpMass)} J/kg/K` },
        { label: 'ρ', value: `${formatCaseScalar(density)} kg/m^3` },
      ],
      marker: { x: pressurePa, y: temperatureK },
      xLabel: 'P (Pa)',
      yLabel: 'T (K)',
    }
  }
  if (record?.operation === 'equilibrate-hp') {
    const temperatureK = finiteOf(record.temperatureK)
    const pressurePa = finiteOf(record.pressurePa)
    const enthalpyMass = finiteOf(record.enthalpyMass)
    const density = finiteOf(record.density)
    if (temperatureK === null || pressurePa === null || enthalpyMass === null || density === null) return null
    return {
      operation: 'equilibrate-hp',
      metrics:   [
        { label: 'T', value: `${formatCaseScalar(temperatureK)} K`, tone: 'ok' },
        { label: 'P', value: `${formatCaseScalar(pressurePa)} Pa` },
        { label: 'h', value: `${formatCaseScalar(enthalpyMass)} J/kg` },
        { label: 'ρ', value: `${formatCaseScalar(density)} kg/m^3` },
      ],
      marker: { x: pressurePa, y: temperatureK },
      xLabel: 'P (Pa)',
      yLabel: 'T (K)',
    }
  }
  if (record?.operation !== 'reactor') return null
  const temperatureK = finiteOf(record.temperatureK)
  const enthalpyMass = finiteOf(record.enthalpyMass)
  const moleFractionOH = finiteOf(record.moleFractionOH)
  const timeS = finiteOf(record.timeS)
  if (temperatureK === null || enthalpyMass === null || moleFractionOH === null || timeS === null) return null
  return {
    operation: 'reactor',
    metrics:   [
      { label: 'T', value: `${formatCaseScalar(temperatureK)} K`, tone: 'ok' },
      { label: 'h', value: `${formatCaseScalar(enthalpyMass)} J/kg` },
      { label: 'X_OH', value: formatCaseScalar(moleFractionOH) },
      { label: 't', value: `${formatCaseScalar(timeS)} s` },
    ],
    marker: { x: timeS, y: moleFractionOH },
    xLabel: 't (s)',
    yLabel: 'X_OH',
  }
}
