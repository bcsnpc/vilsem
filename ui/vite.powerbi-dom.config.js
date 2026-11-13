import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Records which node_modules packages end up in powerbiDom.js, so the renderer's
// third-party notices are generated from what is actually bundled.
function recordBundledPackages() {
  const dirs = new Set()
  return {
    name: 'vilsem-record-bundled-packages',
    moduleParsed(info) {
      const parts = info.id.split(/[\\/]/)
      const i = parts.lastIndexOf('node_modules')
      if (i < 0) return
      dirs.add(parts.slice(0, i + (parts[i + 1]?.startsWith('@') ? 3 : 2)).join('/'))
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'powerbiDom.packages.json', source: JSON.stringify([...dirs].sort(), null, 1) })
    },
  }
}

export default defineConfig({
  plugins: [react(), recordBundledPackages()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: '../cache/powerbi-dom',
    emptyOutDir: true,
    lib: {
      entry: 'src/standalone/powerbi-dom.jsx',
      formats: ['es'],
      fileName: () => 'powerbiDom.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
