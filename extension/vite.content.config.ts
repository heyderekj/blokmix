import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// The content script: one self-contained classic script (no imports at runtime).
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { alias: { '@': fileURLToPath(new URL('../resources/js', import.meta.url)) } },
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome116',
    lib: { entry: fileURLToPath(new URL('src/content.ts', import.meta.url)), formats: ['iife'], name: 'blokmixClipper', fileName: () => 'content.js' },
  },
})
