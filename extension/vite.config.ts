import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// The panel and the background worker (ES modules). The content script is a
// separate IIFE build (vite.content.config.ts): Chrome injects it as a classic script.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { alias: { '@': fileURLToPath(new URL('../resources/js', import.meta.url)) } },
  server: { port: 5174 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome116',
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        panel: fileURLToPath(new URL('panel.html', import.meta.url)),
        background: fileURLToPath(new URL('src/background.ts', import.meta.url)),
      },
      output: { entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js', assetFileNames: 'assets/[name][extname]' },
    },
  },
})
