import {
  DEFAULT_PLOT_VIEWPORT,
  pointsOf,
  projectPolyline,
  type PlotBounds,
  type PlotPoint,
  type PlotViewport,
} from '../simphy/plot'
import type { PlotFigureSeries } from '../types/plot'

export interface SvgPolyline {
  id: string
  testId?: string
  points: string
}

export interface SvgCircle {
  id: string
  testId?: string
  cx: number
  cy: number
  radius: number
}

export interface SvgOverlayCircle {
  id: string
  x: number
  y: number
  r: number
  testId?: string
}

export interface SvgOverlayPolygon {
  id: string
  points: readonly PlotPoint[]
  testId?: string
}

export function seriesPoints(series: readonly PlotFigureSeries[]): PlotPoint[] {
  return series.flatMap((item) => item.kind === 'surface' ? [] : pointsOf(item))
}

export function toSvgPolylines(
  series: readonly PlotFigureSeries[],
  bounds: PlotBounds,
  viewport: PlotViewport = DEFAULT_PLOT_VIEWPORT,
): SvgPolyline[] {
  return series.flatMap((item, index) => {
    if (item.kind === 'surface') return []
    return [{
      id:     item.id ?? item.name ?? String(index),
      testId: item.testId,
      points: projectPolyline(pointsOf(item), bounds, viewport),
    }]
  })
}

export function toSvgPolygons(
  polygons: readonly SvgOverlayPolygon[],
  bounds: PlotBounds,
  viewport: PlotViewport = DEFAULT_PLOT_VIEWPORT,
): Array<SvgOverlayPolygon & { pointsAttr: string }> {
  return polygons.map((polygon) => ({
    ...polygon,
    pointsAttr: projectPolyline(polygon.points, bounds, viewport),
  }))
}

export function toSvgCircles(
  circles: readonly SvgOverlayCircle[],
  bounds: PlotBounds,
  viewport: PlotViewport = DEFAULT_PLOT_VIEWPORT,
): SvgCircle[] {
  const spanX = bounds.maxX - bounds.minX || 1
  const spanY = bounds.maxY - bounds.minY || 1
  const innerW = viewport.width - viewport.pad * 2
  const innerH = viewport.height - viewport.pad * 2
  return circles.map((circle) => ({
    id:     circle.id,
    testId: circle.testId,
    cx:     viewport.pad + (circle.x - bounds.minX) / spanX * innerW,
    cy:     viewport.height - viewport.pad - (circle.y - bounds.minY) / spanY * innerH,
    radius: Math.max(4, circle.r / spanX * innerW),
  }))
}
