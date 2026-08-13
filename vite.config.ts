/// <reference types="vitest/config" />

import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true, suppressWarnings: true },
      includeAssets: ['instrument-mark.svg'],
      manifest: {
        name: 'OpenSimPhy Reproduction Atlas',
        short_name: 'OpenSimPhy',
        description: 'A static audit instrument for site-proposed physics formulae and number walls.',
        theme_color: '#111315',
        background_color: '#111315',
        display: 'standalone',
        start_url: './',
        icons: [
          {
            src: 'instrument-mark.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,txt}'],
        globIgnores: ['data/number-walls/**/*.json', 'assets/plotly-*.js', 'simulation/**'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /\/data\/number-walls\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'opensimphy-number-walls',
              expiration: { maxEntries: 351, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /plotly[^/]*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'opensimphy-plotly',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('plotly.js-dist-min')) return 'plotly'
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/ui/setup.ts'],
    css: true,
    restoreMocks: true,
    include: ['tests/ui/**/*.spec.ts', 'tests/engine/**/*.spec.ts'],
    coverage: { reporter: ['text', 'html'] },
  },
})
