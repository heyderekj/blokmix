/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import laravel from 'laravel-vite-plugin'
import { fileURLToPath, URL } from 'node:url'
import { jevDevProxy } from './scripts/jev/devProxy.ts'

// BLOKMIX_HOST=laravel builds for Laravel (public/build, Inertia pages through resources/views/app.blade.php,
// dev server on 5174 so it runs beside the Vite-only one). Without it, Vite serves index.html on its own.
const hosted = process.env.BLOKMIX_HOST === 'laravel'

export default defineConfig({
  // Hosted, Laravel answers /api/jev; the Vite-only dev server proxies it itself (the key stays on this machine).
  plugins: [...(hosted ? [laravel({ input: ['resources/js/app.tsx'], refresh: true })] : [jevDevProxy()]), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
      '~samples': fileURLToPath(new URL('./samples', import.meta.url)),
    },
  },
  server: hosted ? { port: 5174, strictPort: true } : { port: 5173 },
  test: {
    // Some tests render every layout or draw every fill: fine alone, slow when the whole suite shares the machine.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: ['tests/**/*.test.ts'],
    // Clip stylesheets load as text (?raw); without this Vitest hands them over empty.
    css: { include: [/samples\/clips\//] },
  },
})
