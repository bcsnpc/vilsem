import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
