import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  root: 'src/renderer',                          // serve index.html from here in dev
  plugins: [react()],
  resolve: {
    alias: {
      'react-router-dom': resolve(__dirname, 'src/lib/react-router-dom.tsx')
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: resolve(__dirname, 'out/renderer'),  // absolute out dir since root changed
    emptyOutDir: true
  }
})