import type { Config, Data, Layout } from 'plotly.js'

export interface PlotFigure {
  data: Data[]
  layout?: Partial<Layout>
  config?: Partial<Config>
}
