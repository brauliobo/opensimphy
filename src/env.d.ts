/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'plotly.js-dist-min' {
  import Plotly from 'plotly.js'
  export default Plotly
}

interface Window {
  __OPENSIMPHY_AUDIT__?: import('./registries/runtimeAudit').RuntimeAudit
}
