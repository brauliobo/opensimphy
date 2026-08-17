import { toPlotlyFigure } from '../../src/render/plotly'
import type { PlotFigure } from '../../src/types/plot'

describe('Plotly adapter', () => {
  it('maps generic line and surface figures onto Plotly traces only at the adapter', () => {
    const figure: PlotFigure = {
      series: [
        {
          kind:   'line-markers',
          name:   'sweep',
          x:      [0, 1],
          y:      [1, 2],
          custom: [[0.5, 1.5]],
          line:   { color: '#63cbd1', width: 2, style: 'dotted' },
          marker: { color: '#e6b85c', size: 4, shape: 'open-circle' },
          hover:  [
            { label: 'parameter', source: 'x', digits: 4, notation: 'fixed' },
            { label: 'metric', source: 'y', digits: 8, notation: 'scientific' },
            { label: '|metric|', source: { custom: 0 }, digits: 8, notation: 'scientific' },
          ],
        },
        {
          kind:           'surface',
          name:           'field',
          x:              new Float64Array([0, 1]),
          y:              [0, 1],
          z:              [1, 2],
          custom:         [[new Date('2026-01-01T00:00:00Z'), null]],
          intensity:      [0.1, 0.9],
          colorScale:     [{ at: 0, color: '#111111' }, { at: 1, color: '#ffffff' }],
          showColorScale: true,
          hover:          [{ label: 'z', source: 'z', digits: 6, notation: 'scientific' }],
        },
        {
          kind:   'markers',
          name:   'expected',
          x:      [1],
          y:      [2],
          marker: { color: '#e6b85c', size: 11, shape: 'open-diamond' },
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

    const plotly = toPlotlyFigure(figure)
    expect(plotly.data[0]).toMatchObject({
      type:          'scatter',
      mode:          'lines+markers',
      name:          'sweep',
      customdata:    [[0.5, 1.5]],
      line:          { color: '#63cbd1', width: 2, dash: 'dot' },
      marker:        { color: '#e6b85c', size: 4, symbol: 'circle-open' },
      hovertemplate: 'parameter %{x:.4f}<br>metric %{y:.8e}<br>|metric| %{customdata[0]:.8e}<extra></extra>',
    })
    expect(plotly.data[1]).toMatchObject({
      type:          'mesh3d',
      name:          'field',
      hovertemplate: 'z %{z:.6e}<extra></extra>',
      colorscale:    [[0, '#111111'], [1, '#ffffff']],
      showscale:     true,
    })
    expect(ArrayBuffer.isView((plotly.data[1] as { x: Float64Array }).x)).toBe(true)
    expect(plotly.data[2]).toMatchObject({
      type:   'scatter',
      mode:   'markers',
      marker: { symbol: 'diamond-open' },
    })
    expect(plotly.layout).toMatchObject({
      autosize:      true,
      paper_bgcolor: '#15191b',
      plot_bgcolor:  '#15191b',
      xaxis:         { title: { text: 'x' } },
      yaxis:         { title: { text: 'y' } },
      scene:         { aspectratio: { x: 1, y: 1, z: 1 } },
      showlegend:    true,
      legend:        { orientation: 'h', x: 0, y: 1.11, font: { size: 10 } },
      hovermode:     'x unified',
      margin:        { t: 72, r: 24, b: 58, l: 76 },
    })
    expect(plotly).not.toHaveProperty('config')
    expect(figure.series[0]?.kind).toBe('line-markers')
    expect(figure.series[1]?.kind).toBe('surface')
    expect('type' in figure.series[0]!).toBe(false)
    expect('mode' in figure.series[0]!).toBe(false)
  })

  it('maps remaining line styles and legend orientation', () => {
    const plotly = toPlotlyFigure({
      series: [{
        kind:   'line',
        x:      [0],
        y:      [1],
        line:   { style: 'dashed' },
        marker: { shape: 'cross' },
        hover:  [{ label: 'y', source: 'y', digits: 2, notation: 'fixed' }],
      }],
      layout: { legend: { orientation: 'vertical' } },
    })
    expect(plotly.data[0]).toMatchObject({
      type:          'scatter',
      mode:          'lines',
      line:          { dash: 'dash' },
      marker:        { symbol: 'cross' },
      hovertemplate: 'y %{y:.2f}<extra></extra>',
    })
    expect(plotly.layout).toMatchObject({ legend: { orientation: 'v' } })
  })
})
