export type PlotHoverSource = 'x' | 'y' | 'z' | { custom: number }

export interface PlotHoverEntry {
  label: string
  source: PlotHoverSource
  digits: number
  notation: 'fixed' | 'scientific'
}

export type PlotLineStyle = 'solid' | 'dotted' | 'dashed'

export interface PlotLine {
  color?: string
  width?: number
  style?: PlotLineStyle
}

export type PlotMarkerShape = 'circle' | 'open-circle' | 'open-diamond' | 'cross'

export interface PlotMarker {
  color?: string
  size?: number
  shape?: PlotMarkerShape
}

export interface PlotColorStop {
  at: number
  color: string
}

export type PlotPanelStatus = 'loading' | 'ready' | 'error'

interface PlotFigureSeriesBase {
  id?: string
  testId?: string
  name?: string
  x: ArrayLike<number>
  y: ArrayLike<number>
  custom?: unknown
  hover?: readonly PlotHoverEntry[]
}

export interface PlotLineSeries extends PlotFigureSeriesBase {
  kind: 'line' | 'markers' | 'line-markers'
  line?: PlotLine
  marker?: PlotMarker
}

export interface PlotSurfaceSeries extends PlotFigureSeriesBase {
  kind: 'surface'
  z: ArrayLike<number>
  intensity?: ArrayLike<number>
  colorScale?: readonly PlotColorStop[]
  showColorScale?: boolean
}

export type PlotFigureSeries = PlotLineSeries | PlotSurfaceSeries

export interface PlotScene {
  xTitle?: string
  yTitle?: string
  zTitle?: string
  aspect?: { x: number, y: number, z: number }
}

export interface PlotLegend {
  orientation?: 'horizontal' | 'vertical'
  x?: number
  y?: number
  fontSize?: number
}

export interface PlotMargin {
  top?: number
  right?: number
  bottom?: number
  left?: number
}

export interface PlotTheme {
  paper: string
  plot: string
  font: { color: string, family: string, size: number }
  margin: PlotMargin
}

export const DEFAULT_PLOT_THEME: PlotTheme = {
  paper:  '#15191b',
  plot:   '#15191b',
  font:   { color: '#d8d1bf', family: 'ui-monospace, SFMono-Regular, Menlo, monospace', size: 11 },
  margin: { top: 42, right: 24, bottom: 48, left: 56 },
}

export interface PlotLayout {
  xTitle?: string
  yTitle?: string
  scene?: PlotScene
  showLegend?: boolean
  legend?: PlotLegend
  hoverSync?: 'x'
  margin?: PlotMargin
}

export interface PlotFigure {
  series: PlotFigureSeries[]
  layout?: PlotLayout
}
