import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../dist/ui',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Bind to 127.0.0.1 explicitly. On some Windows configs, 'localhost'
    // resolves only to IPv6 (::1), but Electron's loadURL connects to IPv4
    // (127.0.0.1) → ERR_CONNECTION_REFUSED. Forcing IPv4 binding makes
    // both Electron and a browser window work consistently.
    host: '127.0.0.1',
    strictPort: true,
  },
})
