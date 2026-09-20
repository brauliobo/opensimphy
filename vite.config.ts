/// <reference types="vitest/config" />

import { createHash } from 'node:crypto'
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'
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

function vueDist(pkg: string, file: string): string {
  return fileURLToPath(new URL(`./node_modules/${pkg}/dist/${file}`, import.meta.url))
}

// Vue's package `node` condition is CJS without runtime-vapor `template` and
// without runtime-dom `ensureRenderer`. Vitest (jsdom in Node) must use the
// bundler graph, and those files must be inlined so nested `@vue/*` imports
// are not re-resolved by Node to a second CJS copy.
const vueRuntimeAliases = {
  vue: vueDist('vue', 'vue.runtime.esm-bundler.js'),
  '@vue/runtime-dom': vueDist('@vue/runtime-dom', 'runtime-dom.esm-bundler.js'),
  '@vue/runtime-core': vueDist('@vue/runtime-core', 'runtime-core.esm-bundler.js'),
  '@vue/runtime-vapor': vueDist('@vue/runtime-vapor', 'runtime-vapor.esm-bundler.js'),
  '@vue/reactivity': vueDist('@vue/reactivity', 'reactivity.esm-bundler.js'),
  '@vue/shared': vueDist('@vue/shared', 'shared.esm-bundler.js'),
  '@vue/test-utils': fileURLToPath(
    new URL('./node_modules/@vue/test-utils/dist/vue-test-utils.esm-bundler.mjs', import.meta.url),
  ),
  'vue-router': fileURLToPath(new URL('./node_modules/vue-router/dist/vue-router.mjs', import.meta.url)),
}

const vueRuntimeInline = [
  /\/node_modules\/vue\/dist\//,
  /\/node_modules\/@vue\/runtime-/,
  /\/node_modules\/@vue\/reactivity\//,
  /\/node_modules\/@vue\/shared\//,
  /\/node_modules\/@vue\/test-utils\//,
  /\/node_modules\/vue-router\//,
]

const vtuVueWrapperFactory =
  'registerFactory(WrapperType.VueWrapper, (app, vm, setProps) => new VueWrapper(app, vm, setProps));'
const vtuVaporVmHelper = fileURLToPath(new URL('./tests/ui/withVtuVaporVm.ts', import.meta.url))

function vueTestUtilsVaporCompat(): Plugin {
  return {
    name: 'vue-test-utils-vapor-compat',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('vue-test-utils.esm-bundler')) return
      if (!code.includes(vtuVueWrapperFactory)) {
        throw new Error('Vue Test Utils VueWrapper factory text changed; update vueTestUtilsVaporCompat')
      }
      return {
        code:
          `import { withVtuVaporVm } from ${JSON.stringify(vtuVaporVmHelper)};\n` +
          code.replace(
            vtuVueWrapperFactory,
            'registerFactory(WrapperType.VueWrapper, (app, vm, setProps) => new VueWrapper(app, withVtuVaporVm(vm, app), setProps));',
          ),
        map: null,
      }
    },
  }
}

function giacWasmAsset(): Plugin {
  const source = fileURLToPath(new URL('./vendor/giacjs/giacwasm.js', import.meta.url))
  return {
    name: 'giac-wasm-asset',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if (!path.endsWith('/giac/giacwasm.js')) {
          next()
          return
        }
        if (!existsSync(source)) {
          res.statusCode = 404
          res.end('Giac WASM is not acquired. Run node scripts/acquire-giac.mjs')
          return
        }
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        createReadStream(source).pipe(res)
      })
    },
    closeBundle() {
      copyGiacAsset()
    },
    writeBundle() {
      copyGiacAsset()
    },
  }
}

function copyGiacAsset(): void {
  const source = fileURLToPath(new URL('./vendor/giacjs/giacwasm.js', import.meta.url))
  const license = fileURLToPath(new URL('./vendor/giacjs/LICENSE', import.meta.url))
  if (!existsSync(source)) throw new Error('Giac WASM is missing; run node scripts/acquire-giac.mjs')
  const destDir = fileURLToPath(new URL('./dist/giac', import.meta.url))
  mkdirSync(destDir, { recursive: true })
  copyFileSync(source, join(destDir, 'giacwasm.js'))
  if (existsSync(license)) copyFileSync(license, join(destDir, 'LICENSE'))
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    vue({ features: { vapor: true } }),
    vueTestUtilsVaporCompat(),
    giacWasmAsset(),
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
        globPatterns: ['**/*.{js,css,html,svg,json,txt,woff,woff2,ttf}'],
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
          'data/generated/edwin-gray/**',
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
          'simulation/**',
          'giac/**',
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
          {
            urlPattern: /\/giac\/giacwasm\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'opensimphy-giac-wasm',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      ...vueRuntimeAliases,
    },
  },
  ssr: {
    noExternal: [/^vue$/, /^@vue\//, /^vue-router$/],
    resolve: {
      conditions: ['module', 'browser', 'development|production'],
    },
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
          if (id.includes('node_modules/mathjs')) return 'mathjs'
          if (id.includes('node_modules/katex')) return 'katex'
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
    alias: vueRuntimeAliases,
    server: {
      deps: {
        inline: vueRuntimeInline,
      },
    },
  },
})
