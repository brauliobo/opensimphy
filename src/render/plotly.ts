import type { Config, Data, Layout } from 'plotly.js'
import type {
  PlotColorStop,
  PlotFigure,
  PlotFigureSeries,
  PlotHoverEntry,
  PlotLayout,
  PlotLegend,
  PlotLine,
  PlotLineSeries,
  PlotMargin,
  PlotMarker,
  PlotSurfaceSeries,
  PlotTheme,
} from '../types/plot'
import { DEFAULT_PLOT_THEME } from '../types/plot'

export type PlotlyFigure = {
  data: Data[]
  layout: Partial<Layout>
}

export const PLOTLY_UI_CONFIG: Partial<Config> = {
  responsive:  true,
  displaylogo: false,
  scrollZoom:  true,
}

const PLOTLY_MODE = {
  line:           'lines',
  markers:        'markers',
  'line-markers': 'lines+markers',
} as const

const PLOTLY_DASH = {
  solid:  'solid',
  dotted: 'dot',
  dashed: 'dash',
} as const

const PLOTLY_SYMBOL = {
  circle:         'circle',
  'open-circle':  'circle-open',
  'open-diamond': 'diamond-open',
  cross:          'cross',
} as const

const PLOTLY_ORIENTATION = {
  horizontal: 'h',
  vertical:   'v',
} as const

function definedEntries<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T
}

function hoverToken(entry: PlotHoverEntry): string {
  const spec = `.${entry.digits}${entry.notation === 'scientific' ? 'e' : 'f'}`
  if (typeof entry.source === 'object') return `%{customdata[${entry.source.custom}]:${spec}}`
  return `%{${entry.source}:${spec}}`
}

function toPlotlyHover(hover?: readonly PlotHoverEntry[]): string | undefined {
  if (!hover?.length) return undefined
  return `${hover.map((entry) => `${entry.label} ${hoverToken(entry)}`).join('<br>')}<extra></extra>`
}

function toPlotlyLine(line?: PlotLine): Record<string, unknown> | undefined {
  if (!line) return undefined
  return definedEntries({
    color: line.color,
    width: line.width,
    dash:  line.style === undefined ? undefined : PLOTLY_DASH[line.style],
  })
}

function toPlotlyMarker(marker?: PlotMarker): Record<string, unknown> | undefined {
  if (!marker) return undefined
  return definedEntries({
    color:  marker.color,
    size:   marker.size,
    symbol: marker.shape === undefined ? undefined : PLOTLY_SYMBOL[marker.shape],
  })
}

function toPlotlyColorScale(stops?: readonly PlotColorStop[]): Array<[number, string]> | undefined {
  if (!stops) return undefined
  return stops.map((stop) => [stop.at, stop.color])
}

function toPlotlyLineTrace(series: PlotLineSeries): Data {
  return definedEntries({
    type:          'scatter',
    name:          series.name,
    x:             series.x,
    y:             series.y,
    customdata:    series.custom,
    mode:          PLOTLY_MODE[series.kind],
    line:          toPlotlyLine(series.line),
    marker:        toPlotlyMarker(series.marker),
    hovertemplate: toPlotlyHover(series.hover),
  }) as unknown as Data
}

function toPlotlySurfaceTrace(series: PlotSurfaceSeries): Data {
  return definedEntries({
    type:          'mesh3d',
    name:          series.name,
    x:             series.x,
    y:             series.y,
    z:             series.z,
    customdata:    series.custom,
    hovertemplate: toPlotlyHover(series.hover),
    intensity:     series.intensity,
    colorscale:    toPlotlyColorScale(series.colorScale),
    showscale:     series.showColorScale,
  }) as unknown as Data
}

function toPlotlyTrace(series: PlotFigureSeries): Data {
  return series.kind === 'surface' ? toPlotlySurfaceTrace(series) : toPlotlyLineTrace(series)
}

function toPlotlyMargin(margin?: PlotMargin): Record<string, unknown> | undefined {
  if (!margin) return undefined
  return definedEntries({
    t: margin.top,
    r: margin.right,
    b: margin.bottom,
    l: margin.left,
  })
}

function toPlotlyLegend(legend?: PlotLegend): Record<string, unknown> | undefined {
  if (!legend) return undefined
  return definedEntries({
    orientation: legend.orientation === undefined ? undefined : PLOTLY_ORIENTATION[legend.orientation],
    x:           legend.x,
    y:           legend.y,
    font:        legend.fontSize === undefined ? undefined : { size: legend.fontSize },
  })
}

function toPlotlyLayout(layout?: PlotLayout): Partial<Layout> | undefined {
  if (!layout) return undefined
  const scene = layout.scene
  return definedEntries({
    xaxis:      layout.xTitle === undefined ? undefined : { title: { text: layout.xTitle } },
    yaxis:      layout.yTitle === undefined ? undefined : { title: { text: layout.yTitle } },
    scene:      scene === undefined ? undefined : definedEntries({
      xaxis:       scene.xTitle === undefined ? undefined : { title: { text: scene.xTitle } },
      yaxis:       scene.yTitle === undefined ? undefined : { title: { text: scene.yTitle } },
      zaxis:       scene.zTitle === undefined ? undefined : { title: { text: scene.zTitle } },
      aspectratio: scene.aspect,
    }),
    showlegend: layout.showLegend,
    legend:     toPlotlyLegend(layout.legend),
    hovermode:  layout.hoverSync === 'x' ? 'x unified' : undefined,
    margin:     toPlotlyMargin(layout.margin),
  }) as Partial<Layout>
}

function toPlotlyTheme(theme: PlotTheme): Partial<Layout> {
  return {
    autosize:       true,
    paper_bgcolor:  theme.paper,
    plot_bgcolor:   theme.plot,
    font:           { color: theme.font.color, family: theme.font.family, size: theme.font.size },
    margin:         toPlotlyMargin(theme.margin),
  }
}

export function toPlotlyFigure(figure: PlotFigure, theme: PlotTheme = DEFAULT_PLOT_THEME): PlotlyFigure {
  return {
    data:   figure.series.map(toPlotlyTrace),
    layout: { ...toPlotlyTheme(theme), ...toPlotlyLayout(figure.layout) },
  }
}
