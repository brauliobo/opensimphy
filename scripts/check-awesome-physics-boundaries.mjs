import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = join(projectRoot, 'dist')
const manifestPath = join(distRoot, '.vite', 'manifest.json')
const swPath = join(distRoot, 'sw.js')
const failures = []
const manifestAssetPaths = new Set()

const awesomePhysicsDataAssets = [
  'data/generated/awesomePhysics/catalog.json',
  'data/generated/awesomePhysics/simulations.json',
]
const requiredDistAssets = [
  'index.html',
  ...awesomePhysicsDataAssets,
  'wasm/awesomePhysics/position-based-dynamics/NOTICE.md',
  'wasm/awesomePhysics/position-based-dynamics/position-based-dynamics-headless.wasm',
  'wasm/awesomePhysics/bullet3/NOTICE.md',
  'wasm/awesomePhysics/bullet3/bullet3.wasm',
  'wasm/awesomePhysics/coolprop/NOTICE.md',
  'wasm/awesomePhysics/coolprop/coolprop.js',
  'wasm/awesomePhysics/coolprop/coolprop.wasm',
  'wasm/awesomePhysics/coolprop/coolprop.worker.js',
]
const awesomePhysicsOwnedDistAssets = new Set(awesomePhysicsDataAssets)

const lazySources = [
  'src/views/AwesomePhysicsCatalogView.vue',
  'src/views/AwesomePhysicsSimulationView.vue',
  'src/awesomePhysics/workers/runInWorker.ts',
]

const adapterSources = [
  'src/awesomePhysics/adapters/browser/matterJs.ts',
  'src/awesomePhysics/adapters/browser/cannonJs.ts',
  'src/awesomePhysics/adapters/browser/myphysicslab.ts',
  'src/awesomePhysics/adapters/browser/webglRipples.ts',
  'src/awesomePhysics/adapters/browser/particleClicker.ts',
  'src/awesomePhysics/adapters/typescript/qmsolve.ts',
  'src/awesomePhysics/adapters/typescript/empy.ts',
  'src/awesomePhysics/adapters/typescript/pyRt.ts',
  'src/awesomePhysics/adapters/typescript/scikitRf.ts',
  'src/awesomePhysics/adapters/typescript/fluids.ts',
  'src/awesomePhysics/adapters/typescript/gala.ts',
  'src/awesomePhysics/adapters/typescript/tightBinding.ts',
  'src/awesomePhysics/adapters/typescript/poppy.ts',
]

function fail(message) {
  failures.push(message)
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function distRelative(path) {
  return relative(distRoot, path).split(sep).join('/')
}

function trackAwesomePhysicsAsset(path) {
  if (path !== null) awesomePhysicsOwnedDistAssets.add(distRelative(path))
}

function projectRelative(path) {
  return relative(projectRoot, path).split(sep).join('/') || '.'
}

function isInside(parent, path) {
  const child = relative(parent, path)
  return child === '' || (child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child))
}

function resolveManifestAsset(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} must be a non-empty relative path`)
    return null
  }
  if (value.includes('\\') || value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)) {
    fail(`${label} is not a relative dist path: ${value}`)
    return null
  }
  const path = resolve(distRoot, value)
  if (!isInside(distRoot, path)) {
    fail(`${label} escapes dist: ${value}`)
    return null
  }
  return path
}

async function readRequired(path, label) {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    fail(`${label} is unavailable at ${projectRelative(path)}: ${error.message}`)
    return null
  }
}

async function listFiles(directory) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    fail(`Unable to inspect ${projectRelative(directory)}: ${error.message}`)
    return []
  }

  const files = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(path))
    else if (entry.isFile()) files.push(path)
    else fail(`Emitted path is not a regular file: ${projectRelative(path)}`)
  }
  return files
}

function manifestEntry(manifest, key, label = `Manifest entry ${key}`) {
  const entry = manifest[key]
  if (!isRecord(entry)) {
    fail(`${label} is missing or is not an object`)
    return null
  }
  return entry
}

function manifestArray(entry, key, field) {
  const value = entry[field]
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    fail(`Manifest entry ${key} has a non-array ${field} field`)
    return []
  }
  for (const reference of value) {
    if (typeof reference !== 'string' || reference.length === 0) {
      fail(`Manifest entry ${key} has a non-string ${field} entry`)
    }
  }
  return value.filter((reference) => typeof reference === 'string' && reference.length > 0)
}

function manifestAsset(entry, key) {
  const path = resolveManifestAsset(entry.file, `Manifest entry ${key} file`)
  if (path === null) return null
  manifestAssetPaths.add(path)
  return path
}

function validateManifest(manifest) {
  for (const key of Object.keys(manifest).sort()) {
    const entry = manifestEntry(manifest, key)
    if (entry === null) continue

    manifestAsset(entry, key)
    for (const field of ['css', 'assets']) {
      for (const asset of manifestArray(entry, key, field)) {
        const path = resolveManifestAsset(asset, `Manifest entry ${key} ${field} asset`)
        if (path !== null) manifestAssetPaths.add(path)
      }
    }
    for (const field of ['imports', 'dynamicImports']) {
      for (const reference of manifestArray(entry, key, field)) {
        if (!Object.hasOwn(manifest, reference)) {
          fail(`Manifest entry ${key} ${field} references missing entry ${reference}`)
        }
      }
    }
    if (entry.src !== undefined && (typeof entry.src !== 'string' || entry.src.length === 0)) {
      fail(`Manifest entry ${key} has an invalid src field`)
    }
  }
}

function findLazyEntry(manifest, source) {
  const stem = basename(source, source.endsWith('.vue') ? '.vue' : '.ts')
  const candidates = Object.entries(manifest)
    .filter(([key, entry]) => {
      if (!isRecord(entry)) return false
      if (key === source || entry.src === source) return true
      if (entry.name !== stem || typeof entry.file !== 'string') return false
      return basename(entry.file).startsWith(`${stem}-`) && basename(entry.file).endsWith('.js')
    })
    .map(([key, entry]) => ({ key, entry }))

  if (candidates.length === 0) {
    fail(`Manifest has no lazy candidate for ${source}`)
    return null
  }
  if (candidates.length > 1) {
    fail(`Manifest has ambiguous lazy candidates for ${source}: ${candidates.map(({ key }) => key).sort().join(', ')}`)
    return null
  }

  const [candidate] = candidates
  if (candidate.entry.isDynamicEntry !== true) {
    fail(`Manifest entry ${candidate.key} for ${source} is not marked isDynamicEntry=true`)
  }
  manifestAsset(candidate.entry, candidate.key)
  return candidate
}

function assertDynamicEdge(manifest, source, candidate, rootEntry) {
  if (candidate === null) return
  const rootImports = manifestArray(rootEntry, 'index.html', 'imports')
  const rootDynamicImports = manifestArray(rootEntry, 'index.html', 'dynamicImports')
  const references = new Set([source, candidate.key])
  if ([...references].some((reference) => rootImports.includes(reference))) {
    fail(`Root index.html statically imports Awesome Physics entry ${source}`)
  }
  if (![...references].some((reference) => rootDynamicImports.includes(reference))) {
    fail(`Root index.html does not list Awesome Physics entry ${source} as a dynamic import`)
  }
}

function staticImporters(manifest, key) {
  return Object.entries(manifest)
    .filter(([, entry]) => isRecord(entry) && manifestArray(entry, key, 'imports').includes(key))
    .map(([entryKey]) => entryKey)
    .sort()
}

function dynamicImporters(manifest, key) {
  return Object.entries(manifest)
    .filter(([, entry]) => isRecord(entry) && manifestArray(entry, key, 'dynamicImports').includes(key))
    .map(([entryKey]) => entryKey)
    .sort()
}

function extractPrecacheUrls(sw) {
  const call = /precacheAndRoute\s*\(/.exec(sw)
  if (!call) {
    fail('sw.js does not contain a precacheAndRoute call')
    return []
  }

  const arrayStart = sw.indexOf('[', call.index + call[0].length)
  if (arrayStart < 0) {
    fail('sw.js precacheAndRoute call has no array argument')
    return []
  }

  let quote = null
  let escaped = false
  let depth = 0
  let arrayEnd = -1
  for (let index = arrayStart; index < sw.length; index += 1) {
    const character = sw[index]
    if (quote !== null) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === quote) quote = null
      continue
    }
    if (character === '"' || character === "'" || character === '`') quote = character
    else if (character === '[') depth += 1
    else if (character === ']') {
      depth -= 1
      if (depth === 0) {
        arrayEnd = index
        break
      }
    }
  }
  if (arrayEnd < 0) {
    fail('sw.js precache array is unterminated')
    return []
  }

  const urls = []
  const precache = sw.slice(arrayStart, arrayEnd + 1)
  const urlPattern = /(?:^|[{,])\s*url\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/g
  for (const match of precache.matchAll(urlPattern)) {
    const quoteCharacter = match[1]
    const raw = match[2]
    try {
      urls.push(quoteCharacter === '"'
        ? JSON.parse(`"${raw}"`)
        : raw.replaceAll("\\'", "'").replaceAll('\\"', '"').replaceAll('\\\\', '\\'))
    } catch (error) {
      fail(`Unable to decode a sw.js precache URL: ${error.message}`)
    }
  }
  if (urls.length === 0) fail('sw.js precache array contains no parseable URL entries')
  return urls.sort()
}

function resolvePrecacheAsset(url) {
  if (typeof url !== 'string' || url.length === 0) {
    fail('sw.js precache contains an invalid URL entry')
    return null
  }
  const pathPart = url.split(/[?#]/, 1)[0]
  if (pathPart.length === 0 || /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(pathPart) || pathPart.startsWith('//')) {
    fail(`sw.js precache URL is not a dist-relative asset: ${url}`)
    return null
  }
  let decodedPath
  try {
    decodedPath = decodeURIComponent(pathPart)
  } catch (error) {
    fail(`sw.js precache URL cannot be decoded: ${url}: ${error.message}`)
    return null
  }
  const relativePath = decodedPath.replace(/^\/+/, '')
  const path = resolveManifestAsset(relativePath, `sw.js precache URL ${url}`)
  return path === null ? null : distRelative(path)
}

const localPathPatterns = [
  /file:\/\/\/[^\s"'`<>]+/i,
  /(?:^|[^A-Za-z0-9/:])\/(?:home|Users|private|tmp|var|opt|root|mnt|workspace|workspaces)\/[^\s"'`<>]*/,
  /(?:^|[^A-Za-z0-9])[A-Za-z]:[\\/][A-Za-z0-9._~-]{2,}(?:[\\/][A-Za-z0-9._~-]+)+/,
]

function assertNoAbsoluteLocalPaths(path, content) {
  if (localPathPatterns.some((pattern) => pattern.test(content))) {
    fail(`${projectRelative(path)} contains an absolute local path`)
  }
}

function isAwesomePhysicsOwnedAsset(path) {
  const relativePath = distRelative(path)
  return awesomePhysicsOwnedDistAssets.has(relativePath)
    || /^assets\/awesomePhysics\.worker-[A-Za-z0-9_-]+\.js$/.test(relativePath)
}

const manifestText = await readRequired(manifestPath, 'Vite build manifest')
let manifest = null
if (manifestText !== null) {
  try {
    const parsed = JSON.parse(manifestText)
    if (!isRecord(parsed)) {
      fail('Vite build manifest root is not an object')
    } else {
      manifest = parsed
    }
  } catch (error) {
    fail(`Vite build manifest is invalid JSON: ${error.message}`)
  }
}

for (const asset of requiredDistAssets) await readRequired(join(distRoot, asset), `Required dist asset ${asset}`)

if (manifest !== null) {
  validateManifest(manifest)

  const rootEntry = manifestEntry(manifest, 'index.html', 'Manifest root index.html entry')
  if (rootEntry !== null) {
    if (rootEntry.isEntry !== true) fail('Manifest root index.html entry is not marked isEntry=true')
    const rootAsset = manifestAsset(rootEntry, 'index.html')
    if (rootAsset !== null) await readRequired(rootAsset, 'Root JavaScript asset')
    await readRequired(join(distRoot, 'index.html'), 'Built root index.html')

    const lazyEntries = new Map()
    for (const source of lazySources) {
      const candidate = findLazyEntry(manifest, source)
      lazyEntries.set(source, candidate)
      const asset = candidate === null ? null : manifestAsset(candidate.entry, candidate.key)
      trackAwesomePhysicsAsset(asset)
      if (asset !== null) await readRequired(asset, `Lazy asset ${source}`)
    }
    for (const source of lazySources.slice(0, 2)) assertDynamicEdge(manifest, source, lazyEntries.get(source), rootEntry)

    for (const source of adapterSources) {
      const entry = manifestEntry(manifest, source, `Manifest adapter entry ${source}`)
      if (entry === null) continue
      if (entry.isDynamicEntry !== true) fail(`Manifest adapter entry ${source} is not marked isDynamicEntry=true`)
      const asset = manifestAsset(entry, source)
      trackAwesomePhysicsAsset(asset)
      if (asset !== null) await readRequired(asset, `Adapter asset ${source}`)
      const dynamic = dynamicImporters(manifest, source)
      if (dynamic.length === 0) fail(`Manifest adapter entry ${source} has no dynamic importer`)
      const staticImportersForEntry = staticImporters(manifest, source)
      if (staticImportersForEntry.length > 0) fail(`Manifest adapter entry ${source} has static importers: ${staticImportersForEntry.join(', ')}`)
    }
  }
}

const allFiles = await listFiles(distRoot)
const emittedFileSet = new Set(allFiles.map(distRelative))
for (const path of manifestAssetPaths) {
  if (!emittedFileSet.has(distRelative(path))) fail(`Manifest asset is missing from dist: ${distRelative(path)}`)
}
const emittedContents = new Map()
for (const path of allFiles.sort((left, right) => projectRelative(left).localeCompare(projectRelative(right)))) {
  if (!isInside(distRoot, path)) fail(`Emitted file escapes dist: ${projectRelative(path)}`)
  try {
    const content = await readFile(path, 'utf8')
    emittedContents.set(path, content)
    if (isAwesomePhysicsOwnedAsset(path)) assertNoAbsoluteLocalPaths(path, content)
  } catch (error) {
    fail(`Unable to read emitted file ${projectRelative(path)}: ${error.message}`)
  }
}

const workerFiles = allFiles
  .filter((path) => /^assets\/awesomePhysics\.worker-[A-Za-z0-9_-]+\.js$/.test(distRelative(path)))
  .sort((left, right) => distRelative(left).localeCompare(distRelative(right)))
if (workerFiles.length !== 1) {
  fail(`Expected exactly one emitted Awesome Physics worker asset, found ${workerFiles.length}: ${workerFiles.map(distRelative).join(', ') || 'none'}`)
}
const workerAsset = workerFiles.length === 1 ? distRelative(workerFiles[0]) : null

const sw = await readRequired(swPath, 'Generated service worker')
let precacheUrls = []
if (sw !== null) {
  precacheUrls = extractPrecacheUrls(sw)
  const precacheAssets = precacheUrls.map((url) => ({ url, path: resolvePrecacheAsset(url) }))
  for (const { url, path } of precacheAssets) {
    if (path !== null) await readRequired(join(distRoot, path), `sw.js precache asset ${url}`)
  }
  for (const forbidden of awesomePhysicsDataAssets) {
    if (precacheAssets.some(({ path }) => path === forbidden)) {
      fail(`sw.js precache contains lazy Awesome Physics data ${forbidden}`)
    }
  }
  if (workerAsset !== null && precacheAssets.some(({ path }) => path === workerAsset)) {
    fail(`sw.js precache contains lazy Awesome Physics worker ${workerAsset}`)
  }
}

const sortedFailures = [...new Set(failures)].sort()
const summary = `Summary: manifest=${manifest === null ? 'unavailable' : `${Object.keys(manifest).length} entries`}; required lazy entries=${lazySources.length}; adapters=${adapterSources.length}; worker=${workerAsset ?? 'missing'}; emitted files=${emittedContents.size}; precache URLs=${precacheUrls.length}.`
if (sortedFailures.length > 0) {
  console.error(`Awesome Physics boundary check failed with ${sortedFailures.length} problem${sortedFailures.length === 1 ? '' : 's'}:`)
  console.error(summary)
  for (const failure of sortedFailures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('Awesome Physics boundary check passed.')
  console.log(summary)
  console.log(`PWA: ${precacheUrls.length} precache URLs; Awesome Physics catalog data and worker excluded.`)
}
