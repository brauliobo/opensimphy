/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'plotly.js-dist-min' {
  import Plotly from 'plotly.js'
  export default Plotly
}

interface Window {
  __OPENSIMPHY_AUDIT__?: {
    coverage: Array<{ key: string; expected: number; implemented: number; evaluated: number; graphed: number; simulatable: number }>
    formulas: Array<{ id: string; ordinal: number; graphReady: boolean }>
    core: Array<{ id: string; graphReady: boolean }>
    walls: string[]
    topics: Array<{ id: string; count: number }>
  }
}
