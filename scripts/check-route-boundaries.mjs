import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = join(projectRoot, 'dist')
const publicRoot = join(projectRoot, 'public')
const manifestPath = join(distRoot, '.vite', 'manifest.json')
const swPath = join(distRoot, 'sw.js')
const failures = []

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

const routes = {
  overview: 'src/views/OverviewView.vue',
  tourMap: 'src/views/TourMapView.vue',
  tourChapter: 'src/views/TourChapterView.vue',
  tourLesson: 'src/views/TourLessonView.vue',
  quantumWaveLab: 'src/views/QuantumWaveLabView.vue',
  edwinGrayLab: 'src/views/EdwinGrayLabView.vue',
  fiddleArchive: 'src/views/FiddleArchiveView.vue',
  fiddleRecord: 'src/views/FiddleRecordView.vue',
  evidence: 'src/views/EvidenceView.vue',
  saved: 'src/views/SavedView.vue',
  notFound: 'src/views/NotFoundView.vue',
  formulaAtlas: 'src/views/FormulaAtlasView.vue',
  formulaDetail: 'src/views/FormulaDetailView.vue',
  coreLab: 'src/views/CoreLabView.vue',
  numberWalls: 'src/views/NumberWallsView.vue',
  earthWorkbench: 'src/views/EarthSimulationDetailView.vue',
  earthOverview: 'src/views/EarthOverviewView.vue',
  earthCorpus: 'src/views/EarthCorpusView.vue',
  earthDocument: 'src/views/EarthDocumentView.vue',
  earthPrograms: 'src/views/EarthSimulationsView.vue',
  earthProgram: 'src/views/EarthSimulationDetailView.vue',
  earthDatasets: 'src/views/EarthDatasetsView.vue',
}

const tourRoutes = ['overview', 'tourMap', 'tourChapter', 'tourLesson']
const nonNumericalRoutes = [...tourRoutes, 'quantumWaveLab', 'evidence', 'saved', 'notFound']
const earthRoutes = ['earthOverview', 'earthCorpus', 'earthDocument', 'earthPrograms', 'earthProgram', 'earthWorkbench', 'earthDatasets']
const fiddleRoutes = ['fiddleArchive', 'fiddleRecord']

const ownershipMarkers = {
  formula: [
    ['formula worker asset', /formula\.worker-[A-Za-z0-9_-]+\.js/],
    ['formula recipes source', /\/recipes\.json/],
    ['formula symbols source', /\/symbols\.json/],
    ['formula worker request', /evaluate-recipes/],
    ['formula evaluator identifier', /evaluateRecipes|evaluateFormula|createPrimitiveSymbols/],
    ['formula evaluator diagnostic', /Invalid expected measurement:|Recipe dependency build exceeded source count/],
  ],
  core: [
    ['core worker asset', /core\.worker-[A-Za-z0-9_-]+\.js/],
    ['core worker request', /evaluate-core/],
    ['core worker failure', /Core worker failed/],
    ['core evaluator identifier', /CORE_CASES|evaluateCoreCase|evaluateCoreRegistry/],
    ['core evaluator diagnostic', /Duplicate core case ID:|Unknown Planck site:/],
  ],
  wall: [
    ['number-wall worker asset', /numberWall\.worker-[A-Za-z0-9_-]+\.js/],
    ['number-wall index', /\/walls\.json/],
    ['number-wall payload source', /\/data\/number-walls/],
    ['number-wall worker request', /simulate-wall/],
    ['number-wall evaluator identifier', /simulateNumberWall|bareissDeterminant/],
    ['number-wall evaluator diagnostic', /Bareiss determinant requires a square matrix|Number-wall simulation cancelled/],
  ],
  earth: [
    ['earth worker asset', /earthSimulation\.worker-[A-Za-z0-9_-]+\.js/],
  ],
  gray: [
    ['Gray worker asset', /edwinGray\.worker-[A-Za-z0-9_-]+\.js/],
    ['Gray worker request', /completed-event-/],
    ['Gray evaluator identifier', /evaluateGrayFullMotor|runGrayFullMotor/],
    ['Gray evaluator diagnostic', /Gray full motor energy boundary failed to close|integrationStepsPerEvent must be in/],
  ],
  plotly: [
    ['Plotly asset', /^assets\/plotly-[A-Za-z0-9_-]+\.js$/],
  ],
}

const dimensionEngineMarkers = [
  'Unknown dimension builder target:',
  'No quantity-kind identity is inferred from dimension equality.',
]

const coreEvaluatorIdentifiers = [
  'CORE_CASES',
  'evaluateCoreCase',
  'evaluateCoreRegistry',
  'evaluate-core',
  'Duplicate core case ID:',
  'Unknown Planck site:',
]

const recipeEvaluatorIdentifiers = [
  'RECIPE_RELATIVE_TOLERANCE',
  'createPrimitiveSymbols',
  'evaluateFormula',
  'evaluateRecipes',
  'evaluate-recipes',
  'Invalid expected measurement:',
  'Recipe dependency build exceeded source count',
]

const grayEvaluatorIdentifiers = [
  'evaluateGrayFullMotor',
  'runGrayFullMotor',
  'Gray full motor energy boundary failed to close',
  'integrationStepsPerEvent must be in [1, 10000]',
]

const evaluatorSignatures = {
  formula: ['Invalid expected measurement:', 'Recipe dependency build exceeded source count'],
  core: ['Duplicate core case ID:', 'Unknown Planck site:'],
  wall: ['Bareiss determinant requires a square matrix', 'Number-wall simulation cancelled'],
  gray: ['Gray full motor energy boundary failed to close', 'integrationStepsPerEvent must be in [1, 10000]'],
}

function fail(message) {
  failures.push(message)
}

async function readRequired(path, label) {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    fail(`${label} is unavailable at ${relative(projectRoot, path)}: ${error.message}`)
    return null
  }
}

async function computeRuntimeRegistryRevision() {
  const hash = createHash('sha256')
  let complete = true
  for (const file of runtimeRegistryFiles) {
    try {
      const content = await readFile(join(publicRoot, file))
      hash.update(file)
      hash.update('\0')
      hash.update(content)
      hash.update('\0')
    } catch (error) {
      complete = false
      fail(`Runtime registry revision input is unavailable at public/${file}: ${error.message}`)
    }
  }
  return complete ? hash.digest('hex').slice(0, 12) : null
}

async function listFiles(directory) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    fail(`Unable to inspect ${relative(projectRoot, directory)}: ${error.message}`)
    return []
  }

  const files = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(path))
    else if (entry.isFile()) files.push(path)
  }
  return files
}

function manifestEntry(manifest, key) {
  const entry = manifest[key]
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail(`Manifest entry ${key} is missing`)
    return null
  }
  if (typeof entry.file !== 'string' || !entry.file.endsWith('.js')) {
    fail(`Manifest entry ${key} does not identify a JavaScript output`)
    return null
  }
  return entry
}

async function manifestClosure(manifest, rootKey, followDynamicImports) {
  const pending = [rootKey]
  const visited = new Set()
  const chunks = []

  while (pending.length > 0) {
    const key = pending.pop()
    if (visited.has(key)) continue
    visited.add(key)
    const entry = manifestEntry(manifest, key)
    if (!entry) continue

    const outputPath = resolve(distRoot, entry.file)
    if (!outputPath.startsWith(`${distRoot}${sep}`)) {
      fail(`Manifest entry ${key} escapes dist: ${entry.file}`)
      continue
    }
    const content = await readRequired(outputPath, `Output for manifest entry ${key}`)
    if (content !== null) chunks.push({ key, file: entry.file, content })

    const edgeFields = ['imports']
    if (followDynamicImports && key !== 'index.html') edgeFields.push('dynamicImports')
    for (const field of edgeFields) {
      if (entry[field] !== undefined && !Array.isArray(entry[field])) {
        fail(`Manifest entry ${key} has a non-array ${field} field`)
        continue
      }
      for (const importedKey of [...(entry[field] ?? [])].sort().reverse()) {
        if (typeof importedKey !== 'string') fail(`Manifest entry ${key} has a non-string ${field} entry`)
        else if (!manifest[importedKey]) fail(`Manifest entry ${key} ${field} references missing entry ${importedKey}`)
        else pending.push(importedKey)
      }
    }
  }

  return chunks.sort((left, right) => left.file.localeCompare(right.file))
}

function markerHits(chunks, owners) {
  const hits = []
  for (const owner of owners) {
    for (const [label, pattern] of ownershipMarkers[owner]) {
      for (const chunk of chunks) {
        const inspected = owner === 'plotly' ? chunk.file : chunk.content
        if (pattern.test(inspected)) hits.push(`${owner} ${label} in ${chunk.file}`)
      }
    }
  }
  return [...new Set(hits)].sort()
}

function assertContainsAny(label, chunks, markers) {
  if (!chunks.some(({ content }) => markers.some((marker) => content.includes(marker)))) {
    fail(`${label} does not contain any expected markers: ${markers.join(', ')}`)
  }
}

function assertNoOwnership(label, chunks, owners) {
  const hits = markerHits(chunks, owners)
  if (hits.length > 0) fail(`${label} contains forbidden ownership markers: ${hits.join('; ')}`)
}

function assertOwns(label, chunks, owner) {
  const workerPattern = ownershipMarkers[owner][0][1]
  if (!chunks.some(({ content }) => workerPattern.test(content))) {
    fail(`${label} does not reference its ${owner} worker output; inspected ${chunks.map(({ file }) => file).join(', ') || 'no files'}`)
  }
}

function workerOutputs(jsFiles, owner) {
  const pattern = new RegExp(`^${owner}\\.worker-[A-Za-z0-9_-]+\\.js$`)
  return jsFiles.filter((path) => pattern.test(path.slice(path.lastIndexOf(sep) + 1)))
}

function extractPrecacheUrls(sw) {
  const callIndex = sw.indexOf('precacheAndRoute(')
  if (callIndex < 0) {
    fail('sw.js does not contain a precacheAndRoute call')
    return []
  }
  const arrayStart = sw.indexOf('[', callIndex)
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
    if (quote) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === quote) quote = null
      continue
    }
    if (character === '"' || character === "'") quote = character
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
  const urlPattern = /(?:^|[{,])\s*url\s*:\s*"((?:\\.|[^"\\])*)"/g
  for (const match of precache.matchAll(urlPattern)) {
    try {
      urls.push(JSON.parse(`"${match[1]}"`))
    } catch (error) {
      fail(`Unable to decode a sw.js precache URL: ${error.message}`)
    }
  }
  if (urls.length === 0) fail('sw.js precache array contains no parseable URL entries')
  if (!urls.includes('index.html')) fail('sw.js precache array does not contain index.html')
  return urls.sort()
}

function extractCalls(source, name) {
  const calls = []
  const token = `${name}(`
  let searchFrom = 0
  while (searchFrom < source.length) {
    const start = source.indexOf(token, searchFrom)
    if (start < 0) break
    let quote = null
    let escaped = false
    let depth = 1
    let end = -1
    for (let index = start + token.length; index < source.length; index += 1) {
      const character = source[index]
      if (quote) {
        if (escaped) escaped = false
        else if (character === '\\') escaped = true
        else if (character === quote) quote = null
        continue
      }
      if (character === '"' || character === "'" || character === '`') quote = character
      else if (character === '(') depth += 1
      else if (character === ')') {
        depth -= 1
        if (depth === 0) {
          end = index + 1
          break
        }
      }
    }
    if (end < 0) {
      fail(`sw.js ${name} call is unterminated`)
      break
    }
    calls.push(source.slice(start, end))
    searchFrom = end
  }
  return calls
}

function assertRuntimeRegistryPolicies(sw, revision) {
  if (revision === null) return []
  const registrations = extractCalls(sw, 'registerRoute')
  const routeOwnedCacheNames = new Set(['opensimphy-gray-fem-lut', 'opensimphy-gray-worker'])
  const policies = [
    { prefix: 'opensimphy-taxonomy', marker: 'taxonomy\\.json$', maxEntries: 1 },
    { prefix: 'opensimphy-formula-sources', marker: '(?:recipes|symbols)\\.json$', maxEntries: 2 },
    { prefix: 'opensimphy-wall-index', marker: 'walls\\.json$', maxEntries: 1 },
    { prefix: 'opensimphy-completion', marker: 'completion\\.json$', maxEntries: 1 },
    { prefix: 'opensimphy-registry', marker: 'registry\\.json$', maxEntries: 1 },
    { prefix: 'opensimphy-fiddles', marker: 'fiddles\\/(?:registry|runtime-verification)\\.json$', maxEntries: 2 },
  ]

  for (const policy of policies) {
    const cacheName = `${policy.prefix}-${revision}`
    const matches = registrations.filter((call) => call.includes(`cacheName:"${cacheName}"`))
    if (matches.length !== 1) {
      fail(`Expected one sw.js runtime route for ${cacheName}, found ${matches.length}`)
      continue
    }
    const [registration] = matches
    if (!registration.includes(policy.marker)) fail(`Runtime cache ${cacheName} is not attached to its expected URL group ${policy.marker}`)
    if (!/\bNetworkFirst\s*\(/.test(registration)) fail(`Runtime cache ${cacheName} does not use NetworkFirst`)
    const timeout = registration.match(/networkTimeoutSeconds:(\d+(?:\.\d+)?)/)
    if (!timeout || Number(timeout[1]) <= 0 || Number(timeout[1]) > 10) fail(`Runtime cache ${cacheName} does not have a bounded network timeout from 1 through 10 seconds`)
    if (!registration.includes(`maxEntries:${policy.maxEntries}`)) fail(`Runtime cache ${cacheName} does not bound maxEntries at ${policy.maxEntries}`)
    if (!registration.includes('maxAgeSeconds:604800')) fail(`Runtime cache ${cacheName} does not use the seven-day max age`)
  }

  const cacheNames = [...sw.matchAll(/cacheName:"([^"]+)"/g)].map((match) => match[1]).sort()
  if (cacheNames.length === 0) fail('sw.js contains no parseable runtime cache names')
  for (const cacheName of cacheNames) {
    if (!routeOwnedCacheNames.has(cacheName) && !cacheName.endsWith(`-${revision}`)) {
      fail(`Runtime cache ${cacheName} does not include registry revision ${revision}`)
    }
  }
  return policies.map(({ prefix }) => `${prefix}-${revision}`)
}

const runtimeRegistryRevision = await computeRuntimeRegistryRevision()
const manifestText = await readRequired(manifestPath, 'Vite build manifest')
let manifest = null
if (manifestText !== null) {
  try {
    manifest = JSON.parse(manifestText)
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      fail('Vite build manifest root is not an object')
      manifest = null
    }
  } catch (error) {
    fail(`Vite build manifest is invalid JSON: ${error.message}`)
  }
}

const closures = {}
if (manifest) {
  closures.root = await manifestClosure(manifest, 'index.html', false)
  for (const [name, key] of Object.entries(routes)) closures[name] = await manifestClosure(manifest, key, true)

  assertNoOwnership('Root entry static closure', closures.root, ['formula', 'core', 'wall', 'gray', 'plotly'])
  for (const route of nonNumericalRoutes) {
    assertNoOwnership(`${route} route closure`, closures[route], ['formula', 'core', 'wall', 'gray', 'plotly'])
  }
  assertContainsAny('tourLesson route closure', closures.tourLesson, dimensionEngineMarkers)

  assertOwns('EdwinGrayLabView route closure', closures.edwinGrayLab, 'gray')
  assertNoOwnership('EdwinGrayLabView route closure', closures.edwinGrayLab, ['formula', 'core', 'wall', 'earth', 'plotly'])

  assertOwns('FormulaAtlasView route closure', closures.formulaAtlas, 'formula')
  assertOwns('FormulaDetailView route closure', closures.formulaDetail, 'formula')
  assertNoOwnership('FormulaAtlasView route closure', closures.formulaAtlas, ['core', 'wall', 'gray'])
  assertNoOwnership('FormulaDetailView route closure', closures.formulaDetail, ['core', 'wall', 'gray'])

  assertOwns('CoreLabView route closure', closures.coreLab, 'core')
  assertNoOwnership('CoreLabView route closure', closures.coreLab, ['formula', 'wall', 'gray'])

  assertOwns('NumberWallsView route closure', closures.numberWalls, 'wall')
  assertNoOwnership('NumberWallsView route closure', closures.numberWalls, ['formula', 'core', 'gray'])

  for (const route of earthRoutes) assertNoOwnership(`${route} route closure`, closures[route], ['formula', 'core', 'wall', 'gray'])
  for (const route of fiddleRoutes) assertNoOwnership(`${route} route closure`, closures[route], ['formula', 'core', 'wall', 'earth', 'gray', 'plotly'])
}

const allFiles = await listFiles(distRoot)
const jsFiles = allFiles.filter((path) => path.endsWith('.js'))
const jsContents = new Map(await Promise.all(jsFiles.map(async (path) => [
  path,
  await readRequired(path, `Built JavaScript ${relative(distRoot, path)}`),
])))
const formulaWorkers = workerOutputs(jsFiles, 'formula')
const coreWorkers = workerOutputs(jsFiles, 'core')
const wallWorkers = workerOutputs(jsFiles, 'numberWall')
const grayWorkers = workerOutputs(jsFiles, 'edwinGray')
const evaluatorChunks = Object.fromEntries(Object.entries(evaluatorSignatures).map(([owner, signatures]) => [
  owner,
  jsFiles.filter((path) => {
    const content = jsContents.get(path)
    return content !== null && signatures.some((signature) => content.includes(signature))
  }),
]))

if (formulaWorkers.length !== 1) fail(`Expected exactly one formula worker output, found ${formulaWorkers.length}: ${formulaWorkers.map((path) => relative(distRoot, path)).join(', ') || 'none'}`)
if (coreWorkers.length !== 1) fail(`Expected exactly one core worker output, found ${coreWorkers.length}: ${coreWorkers.map((path) => relative(distRoot, path)).join(', ') || 'none'}`)
if (wallWorkers.length === 0) fail('Expected at least one numberWall worker output, found none')
if (grayWorkers.length !== 1) fail(`Expected exactly one Edwin Gray worker output, found ${grayWorkers.length}: ${grayWorkers.map((path) => relative(distRoot, path)).join(', ') || 'none'}`)

for (const [owner, chunks] of Object.entries(evaluatorChunks)) {
  if (chunks.length !== 1) {
    fail(`Expected exactly one ${owner} evaluator-bearing chunk, found ${chunks.length}: ${chunks.map((path) => relative(distRoot, path)).join(', ') || 'none'}`)
    continue
  }
  const expectedOwner = owner === 'wall' ? 'numberWall' : owner === 'gray' ? 'edwinGray' : owner
  if (!new RegExp(`^${expectedOwner}\\.worker-[A-Za-z0-9_-]+\\.js$`).test(chunks[0].slice(chunks[0].lastIndexOf(sep) + 1))) {
    fail(`Unexpected ${owner} evaluator-bearing chunk outside its dedicated worker: ${relative(distRoot, chunks[0])}`)
  }
}

if (evaluatorChunks.formula.length === 1) {
  const [path] = evaluatorChunks.formula
  const content = jsContents.get(path)
  for (const identifier of coreEvaluatorIdentifiers) {
    if (content?.includes(identifier)) fail(`Formula worker ${relative(distRoot, path)} contains core evaluator identifier ${JSON.stringify(identifier)}`)
  }
}
if (evaluatorChunks.core.length === 1) {
  const [path] = evaluatorChunks.core
  const content = jsContents.get(path)
  for (const identifier of recipeEvaluatorIdentifiers) {
    if (content?.includes(identifier)) fail(`Core worker ${relative(distRoot, path)} contains recipe evaluator identifier ${JSON.stringify(identifier)}`)
  }
}
for (const owner of ['formula', 'core', 'wall']) {
  if (evaluatorChunks[owner].length !== 1) continue
  const [path] = evaluatorChunks[owner]
  const content = jsContents.get(path)
  for (const identifier of grayEvaluatorIdentifiers) {
    if (content?.includes(identifier)) fail(`${owner} worker ${relative(distRoot, path)} contains Gray evaluator identifier ${JSON.stringify(identifier)}`)
  }
}
if (evaluatorChunks.gray.length === 1) {
  const [path] = evaluatorChunks.gray
  const content = jsContents.get(path)
  for (const identifier of [...coreEvaluatorIdentifiers, ...recipeEvaluatorIdentifiers]) {
    if (content?.includes(identifier)) fail(`Gray worker ${relative(distRoot, path)} contains unrelated evaluator identifier ${JSON.stringify(identifier)}`)
  }
}

const legacyIdentifiers = ['simulation.worker', 'atlasEngine']
const legacyFiles = [...jsFiles]
if (manifestText !== null) legacyFiles.push(manifestPath)
for (const path of legacyFiles.sort()) {
  const content = path === manifestPath ? manifestText : jsContents.get(path)
  for (const identifier of legacyIdentifiers) {
    if (content?.includes(identifier)) fail(`${relative(distRoot, path)} contains legacy aggregate identifier ${identifier}`)
  }
}

if (manifestText?.includes('TopicView')) fail('Vite build manifest still contains the deleted TopicView route chunk')
for (const path of jsFiles) {
  if (relative(distRoot, path).includes('TopicView') || jsContents.get(path)?.includes('TopicView')) {
    fail(`${relative(distRoot, path)} still contains the deleted TopicView or old topic route chunk`)
  }
}

const sw = await readRequired(swPath, 'Generated service worker')
const precacheUrls = sw === null ? [] : extractPrecacheUrls(sw)
const runtimeCacheNames = sw === null ? [] : assertRuntimeRegistryPolicies(sw, runtimeRegistryRevision)
const tourJsonUrls = (await listFiles(join(publicRoot, 'data', 'generated', 'tour')))
  .filter((path) => path.endsWith('.json'))
  .map((path) => relative(publicRoot, path).split(sep).join('/'))
const excludedPrecacheUrls = [
  'data/generated/recipes.json',
  'data/generated/symbols.json',
  'data/generated/taxonomy.json',
  'data/generated/walls.json',
  'data/generated/completion.json',
  'data/generated/registry.json',
  'data/generated/fiddles/registry.json',
  'data/generated/fiddles/runtime-verification.json',
  ...tourJsonUrls,
]
for (const url of excludedPrecacheUrls) {
  if (precacheUrls.some((candidate) => candidate === url || candidate.endsWith(`/${url}`))) {
    fail(`sw.js precache still contains route-owned artifact ${url}`)
  }
}
for (const url of precacheUrls) {
  if (/(?:^|\/)assets\/(?:formula|core|numberWall|edwinGray)\.worker-[A-Za-z0-9_-]+\.js$/.test(url)) {
    fail(`sw.js precache still contains route-owned worker ${url}`)
  }
}

if (failures.length > 0) {
  console.error(`Route boundary check failed with ${failures.length} problem${failures.length === 1 ? '' : 's'}:`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  const routeSummary = Object.entries(closures)
    .filter(([name]) => name !== 'root')
    .map(([name, chunks]) => `${name}=${chunks.length}`)
    .join(', ')
  const workerSummary = [...formulaWorkers, ...coreWorkers, ...wallWorkers, ...grayWorkers]
    .map((path) => relative(distRoot, path))
    .sort()
    .join(', ')
  console.log('Route boundary check passed.')
  console.log(`Runtime registry revision: ${runtimeRegistryRevision}.`)
  console.log(`Manifest: ${Object.keys(manifest).length} entries; root static closure=${closures.root.length}; transitive route closures: ${routeSummary}.`)
  console.log(`Workers: ${workerSummary}.`)
  console.log(`PWA: ${precacheUrls.length} precache URLs; ${runtimeCacheNames.length} revisioned NetworkFirst registry routes; ${tourJsonUrls.length} Tour JSON files, owner JSON, and formula/core/numberWall/edwinGray workers excluded.`)
}
