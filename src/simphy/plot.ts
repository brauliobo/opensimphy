import type { PlotFigureSeries, PlotLineSeries } from '../types/plot'

export interface PlotPoint {
  x: number
  y: number
  z?: number
}

export interface PlotViewport {
  width: number
  height: number
  pad: number
}

export interface PlotBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export const DEFAULT_PLOT_VIEWPORT: PlotViewport = { width: 640, height: 280, pad: 48 }

export function seriesFromPoints(
  id: string,
  points: readonly PlotPoint[],
  extras: { testId?: string, name?: string, kind?: PlotLineSeries['kind'] } = {},
): PlotLineSeries {
  return {
    kind:   extras.kind ?? 'line',
    id,
    name:   extras.name ?? id,
    testId: extras.testId,
    x:      points.map((point) => point.x),
    y:      points.map((point) => point.y),
  }
}

export function pointsOf(series: PlotFigureSeries): PlotPoint[] {
  const points: PlotPoint[] = []
  const length = Math.min(series.x.length, series.y.length)
  for (let index = 0; index < length; index += 1) {
    const x = series.x[index]
    const y = series.y[index]
    if (x === undefined || y === undefined) continue
    const z = series.kind === 'surface' ? series.z[index] : undefined
    points.push(z === undefined ? { x, y } : { x, y, z })
  }
  return points
}

export function boundsOf(points: readonly PlotPoint[], equalAspect = false): PlotBounds {
  const first = points[0]
  if (!first) return { minX: 0, maxX: 1, minY: 0, maxY: 1 }
  let minX = first.x
  let maxX = first.x
  let minY = first.y
  let maxY = first.y
  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }
  if (!equalAspect) {
    if (minX === maxX) { minX -= 1; maxX += 1 }
    if (minY === maxY) { minY -= 1; maxY += 1 }
    return { minX, maxX, minY, maxY }
  }
  const span = Math.max(maxX - minX, maxY - minY, 1)
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  return { minX: midX - span / 2, maxX: midX + span / 2, minY: midY - span / 2, maxY: midY + span / 2 }
}

export function projectPolyline(
  points: readonly PlotPoint[],
  bounds: PlotBounds,
  viewport: PlotViewport = DEFAULT_PLOT_VIEWPORT,
): string {
  const spanX = bounds.maxX - bounds.minX || 1
  const spanY = bounds.maxY - bounds.minY || 1
  const innerW = viewport.width - viewport.pad * 2
  const innerH = viewport.height - viewport.pad * 2
  return points.map((point) => {
    const x = viewport.pad + (point.x - bounds.minX) / spanX * innerW
    const y = viewport.height - viewport.pad - (point.y - bounds.minY) / spanY * innerH
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
}
