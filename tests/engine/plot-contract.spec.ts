import { pointsOf, seriesFromPoints } from '../../src/simphy/plot'
import type { PlotFigure, PlotFigureSeries, PlotLayout } from '../../src/types/plot'

type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false
type AssertFalse<T extends false> = T

type _lineHasNoPlotlyMode = AssertFalse<HasKey<Extract<PlotFigureSeries, { kind: 'line' }>, 'mode'>>
type _lineHasNoPlotlyType = AssertFalse<HasKey<Extract<PlotFigureSeries, { kind: 'line' }>, 'type'>>
type _surfaceHasNoColorscale = AssertFalse<HasKey<Extract<PlotFigureSeries, { kind: 'surface' }>, 'colorscale'>>
type _layoutHasNoHoverMode = AssertFalse<HasKey<PlotLayout, 'hoverMode'>>
type _figureHasNoConfig = AssertFalse<HasKey<PlotFigure, 'config'>>

const typeLevelContract: [
  _lineHasNoPlotlyMode,
  _lineHasNoPlotlyType,
  _surfaceHasNoColorscale,
  _layoutHasNoHoverMode,
  _figureHasNoConfig,
] = [false, false, false, false, false]

const PLOTLY_KEYS = [
  'type',
  'mode',
  'hovertemplate',
  'customdata',
  'colorscale',
  'showscale',
  'hovermode',
  'hoverMode',
  'modeBarButtonsToRemove',
  'removeButtons',
  'scrollZoom',
  'symbol',
  'dash',
] as const

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (value === null || typeof value !== 'object') return keys
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys)
    return keys
  }
  for (const [key, item] of Object.entries(value)) {
    keys.add(key)
    collectKeys(item, keys)
  }
  return keys
}

describe('generic plot contract', () => {
  it('describes line and surface series without Plotly trace keys', () => {
    const figure: PlotFigure = {
      series: [
        {
          kind:   'line-markers',
          name:   'sweep',
          x:      [0, 1],
          y:      [1, 2],
          custom: [[0.5]],
          line:   { color: '#63cbd1', width: 2, style: 'dotted' },
          marker: { color: '#e6b85c', size: 4, shape: 'open-diamond' },
          hover:  [
            { label: 'x', source: 'x', digits: 4, notation: 'fixed' },
            { label: 'aux', source: { custom: 0 }, digits: 3, notation: 'scientific' },
          ],
        },
        {
          kind:           'surface',
          name:           'field',
          x:              new Float64Array([0, 1]),
          y:              [0, 1],
          z:              [1, 2],
          intensity:      [0.1, 0.9],
          colorScale:     [{ at: 0, color: '#111111' }, { at: 1, color: '#ffffff' }],
          showColorScale: true,
          hover:          [{ label: 'z', source: 'z', digits: 6, notation: 'scientific' }],
        },
      ],
      layout: {
        xTitle:     'x',
        yTitle:     'y',
        scene:      { xTitle: 'Re', yTitle: 'Im', zTitle: '|S|', aspect: { x: 1, y: 1, z: 1 } },
        showLegend: true,
        legend:     { orientation: 'horizontal', x: 0, y: 1.11, fontSize: 10 },
        hoverSync:  'x',
        margin:     { top: 72, right: 24, bottom: 58, left: 76 },
      },
    }

    const keys = collectKeys(figure)
    for (const key of PLOTLY_KEYS) expect(keys.has(key)).toBe(false)
    expect(figure.series.map((series) => series.kind)).toEqual(['line-markers', 'surface'])
    expect(figure.series[0]).not.toHaveProperty('type')
    expect(figure.series[1]).not.toHaveProperty('type')
    expect(typeLevelContract).toEqual([false, false, false, false, false])
  })

  it('lifts point lists onto the generic line series and projects them back', () => {
    const series = seriesFromPoints('sweep', [{ x: 0, y: 1 }, { x: 2, y: 3 }], { testId: 'curve' })
    expect(series).toMatchObject({ kind: 'line', id: 'sweep', testId: 'curve', x: [0, 2], y: [1, 3] })
    expect(pointsOf(series)).toEqual([{ x: 0, y: 1 }, { x: 2, y: 3 }])
    expect('points' in series).toBe(false)
  })
})
