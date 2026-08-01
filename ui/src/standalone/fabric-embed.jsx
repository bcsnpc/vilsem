import React from 'react'
import { createRoot } from 'react-dom/client'
import StandaloneApp from './StandaloneApp.jsx'

// ── Fabric embed entry ────────────────────────────────────────────────────────
// Bundled (vite.fabric-embed.config.js) into a single self-contained IIFE that
// exposes window.VilsemRenderer.mount(el, spec). The generated Fabric data-app
// installs window.semantica (mapped to the Fabric semantic-model SDK) FIRST, then
// calls mount() with its App Spec. The renderer itself is the SAME one the web
// export uses — so drill, interactions and every visual behave identically; only
// the data transport (Fabric SDK vs HTTP) differs.
const api = {
  mount(el, spec) {
    if (!el) throw new Error('VilsemRenderer.mount: missing root element')
    if (!spec) throw new Error('VilsemRenderer.mount: missing spec')
    const root = createRoot(el)
    root.render(<StandaloneApp initialSpec={spec} />)
    return root
  },
}

if (typeof window !== 'undefined') window.VilsemRenderer = api
export default api
