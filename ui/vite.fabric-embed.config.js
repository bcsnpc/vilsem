import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Builds vilsem's renderer into ONE self-contained IIFE for the Deploy-to-Fabric
// path: dist/fabric-embed/vilsem-renderer.js (+ .css). It exposes
// window.VilsemRenderer.mount(el, spec) and reads window.semantica (installed by
// the generated Fabric app). React/ReactDOM/ECharts are bundled in — the file
// drops into the Fabric app's public/ with no extra dependencies.
export default defineConfig({
  plugins: [react()],
  // React's dev/prod branch reads process.env.NODE_ENV; there is no `process`
  // in a browser IIFE, so pin it here or the bundle throws at load.
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: '../dist/fabric-embed',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/standalone/fabric-embed.jsx',
      name: 'VilsemRenderer',
      formats: ['iife'],
      fileName: () => 'vilsem-renderer.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: 'vilsem-renderer.[ext]',
      },
    },
  },
})
