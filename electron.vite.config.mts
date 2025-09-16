import { defineConfig } from 'electron-vite'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'

const out = (p: string) => resolve(__dirname, p)

export default defineConfig({
  main: {
    build: {
      outDir: out('dist-electron'),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(__dirname, 'electron/main.ts'),
        output: {
          dir: out('dist-electron'),
          entryFileNames: 'main.js',
          format: 'cjs'
        }
      }
    }
  },
  preload: {
    build: {
      outDir: out('dist-electron'),
      emptyOutDir: false,
      rollupOptions: {
        input: resolve(__dirname, 'electron/preload.ts'),
        output: {
          dir: out('dist-electron'),
          entryFileNames: 'preload.js',
          format: 'cjs'
        }
      }
    }
  },
  renderer: {
    plugins: [react()],
    build: {
      outDir: out('out/renderer'),
      rollupOptions: { input: 'src/renderer/index.html' }
    }
  }
})