/// <reference types="vitest/config" />

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const runtimeRegistryFiles = [
  'data/generated/taxonomy.json',
  'data/generated/recipes.json',
  'data/generated/symbols.json',
  'data/generated/walls.json',
  'data/generated/completion.json',
  'data/generated/registry.json',
  'data/generated/fiddles/registry.json',
  'data/generated/fiddles/runtime-verification.json',
]

function computeRuntimeRegistryRevision(): string {
  const hash = createHash('sha256')
  for (const file of runtimeRegistryFiles) {
    const path = fileURLToPath(new URL(`./public/${file}`, import.meta.url))
    let content: Buffer
    try {
      content = readFileSync(path)
    } catch (error) {
      throw new Error(`Runtime registry revision input is unavailable: ${file}`, { cause: error })
    }
    hash.update(file)
    hash.update('\0')
    hash.update(content)
    hash.update('\0')
  }
  return hash.digest('hex').slice(0, 12)
}

const runtimeRegistryRevision = computeRuntimeRegistryRevision()

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
        globIgnores: [
          'data/generated/recipes.json',
          'data/generated/symbols.json',
          'data/generated/taxonomy.json',
          'data/generated/walls.json',
          'data/generated/completion.json',
          'data/generated/registry.json',
          'data/generated/fiddles/registry.json',
          'data/generated/fiddles/runtime-verification.json',
          'data/generated/awesomePhysics/**/*.json',
          'data/generated/edwin-gray/**/*.json',
          'data/generated/tour/**/*.json',
          'data/generated/earth/documents/**/*.json',
          'data/generated/earth/evidence/programs/**/*.json',
          'data/generated/earth/evidence/documents/**/*.json',
          'data/generated/earth/scientific-coverage.json',
          'data/generated/earth/results/**/*',
          'data/generated/earth/datasets/**/*',
          'data/number-walls/**/*.json',
          'assets/formula.worker-*.js',
          'assets/core.worker-*.js',
          'assets/numberWall.worker-*.js',
          'assets/awesomePhysics.worker-*.js',
          'assets/edwinGray.worker-*.js',
          'assets/plotly-*.js',
        ],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /\/data\/generated\/taxonomy\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: `opensimphy-taxonomy-${runtimeRegistryRevision}`,
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /\/data\/generated\/(?:recipes|symbols)\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: `opensimphy-formula-sources-${runtimeRegistryRevision}`,
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /\/data\/generated\/walls\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: `opensimphy-wall-index-${runtimeRegistryRevision}`,
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /\/data\/generated\/completion\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: `opensimphy-completion-${runtimeRegistryRevision}`,
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /\/data\/generated\/registry\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: `opensimphy-registry-${runtimeRegistryRevision}`,
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /\/data\/generated\/fiddles\/(?:registry|runtime-verification)\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: `opensimphy-fiddles-${runtimeRegistryRevision}`,
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /\/assets\/edwinGray\.worker-[^/]+\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'opensimphy-gray-worker',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\/data\/generated\/edwin-gray\/motor-fem-lut-v1\.json(?:\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'opensimphy-gray-fem-lut',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /\/data\/generated\/edwin-gray\/motor-fem-calibration-pack-v1\.json(?:\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: `opensimphy-gray-fem-calibration-${runtimeRegistryRevision}`,
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /\/data\/generated\/earth\/documents\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: `opensimphy-earth-documents-${runtimeRegistryRevision}`,
              expiration: { maxEntries: 63, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\/data\/generated\/earth\/evidence\/(?:programs|documents)\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'opensimphy-earth-evidence-shards' + `-${runtimeRegistryRevision}`,
              expiration: { maxEntries: 48, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /\/data\/generated\/earth\/(?:results|datasets)\/.*$/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/data\/number-walls\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: `opensimphy-number-walls-${runtimeRegistryRevision}`,
              expiration: { maxEntries: 351, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /plotly[^/]*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: `opensimphy-plotly-${runtimeRegistryRevision}`,
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
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    manifest: true,
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
