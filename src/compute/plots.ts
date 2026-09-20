import type { PlotFigure, PlotSurfaceSeries } from '../types/plot'

export function plotFunction2d(
  f: (x: number) => number,
  from: number,
  to: number,
  name: string,
  count = 240,
): PlotFigure {
  const x: number[] = []
  const y: number[] = []
  for (const value of linspace(from, to, count)) {
    const sample = f(value)
    if (!Number.isFinite(sample)) continue
    x.push(value)
    y.push(sample)
  }
  if (x.length < 2) throw new RangeError(`2D plot of ${name} produced too few finite samples`)
  return {
    series: [{
      kind:  'line',
      name,
      x,
      y,
      line:  { color: '#63cbd1', width: 2 },
      hover: [
        { label: 'x', source: 'x', digits: 4, notation: 'fixed' },
        { label: 'y', source: 'y', digits: 6, notation: 'scientific' },
      ],
    }],
    layout: { xTitle: 'x', yTitle: name },
  }
}

export function plotFunction3d(
  f: (x: number, y: number) => number,
  xFrom: number,
  xTo: number,
  yFrom: number,
  yTo: number,
  name: string,
  count = 36,
): PlotFigure {
  const xs = linspace(xFrom, xTo, count)
  const ys = linspace(yFrom, yTo, count)
  const x: number[] = []
  const y: number[] = []
  const z: number[] = []
  const intensity: number[] = []
  for (const yValue of ys) {
    for (const xValue of xs) {
      const height = f(xValue, yValue)
      if (!Number.isFinite(height)) throw new RangeError(`3D plot of ${name} produced a non-finite sample`)
      x.push(xValue)
      y.push(yValue)
      z.push(height)
      intensity.push(height)
    }
  }
  const series: PlotSurfaceSeries = {
    kind:           'surface',
    name,
    x,
    y,
    z,
    intensity,
    colorScale:     [{ at: 0, color: '#213c42' }, { at: 0.5, color: '#63cbd1' }, { at: 1, color: '#e6b85c' }],
    showColorScale: true,
    hover:          [
      { label: 'x', source: 'x', digits: 3, notation: 'fixed' },
      { label: 'y', source: 'y', digits: 3, notation: 'fixed' },
      { label: 'z', source: 'z', digits: 6, notation: 'scientific' },
    ],
  }
  return {
    series: [series],
    layout: {
      xTitle: 'x',
      yTitle: 'y',
      scene:  { xTitle: 'x', yTitle: 'y', zTitle: name, aspect: { x: 1, y: 1, z: 0.7 } },
    },
  }
}

function linspace(from: number, to: number, count: number): number[] {
  if (count < 2) throw new RangeError('plot sampling requires at least two points')
  const span = to - from
  return Array.from({ length: count }, (_, index) => from + span * index / (count - 1))
}
