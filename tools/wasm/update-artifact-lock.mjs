import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

if (!process.argv.includes('--intentional')) throw new Error('refusing to update artifact lock without --intentional')

const root       = fileURLToPath(new URL('../..', import.meta.url))
const tools      = join(root, 'tools/wasm')
const outputRoot = process.env.WASM_OUT || join(tools, 'out')
const cacheRoot  = process.env.WASM_CACHE || join(tools, '.cache')
const lockPath   = join(tools, 'artifacts.lock.json')
const previous   = JSON.parse(await readFile(lockPath, 'utf8'))
const sha256     = (bytes) => createHash('sha256').update(bytes).digest('hex')

async function filesUnder(directory, base = directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await filesUnder(path, base))
    else result.push(relative(base, path))
  }
  return result.sort()
}

async function metadata(path) {
  const bytes = await readFile(path)
  return { bytes: bytes.length, sha256: sha256(bytes) }
}

const inputPaths = [
  'workspace/package.json', 'workspace/package-lock.json',
  'versions.env', 'build.sh', 'container-build.sh', 'acquire-sources.sh',
  'stage-assets.mjs', 'verify-staged-assets.mjs', 'update-artifact-lock.mjs',
  'verify-reproducible-build.sh', 'compare-builds.mjs', 'native-reference.sh', 'container-native-reference.sh',
  'summarize-phase4.mjs', 'summarize-phase5.mjs', 'native-convergence.mjs', 'measure-profiles.mjs',
  'check-forbidden-boundary.mjs',
  'gmsh/view-bindings.patch', 'gmsh/optional-quad-predicate.patch', 'gmsh/persistent-parser-number.patch', 'gmsh/wasm-boundaries.patch',
  'occt/wasm-boundaries.patch',
  'fixtures/microstrip-onelab.patch', 'fixtures/phase4-onelab.patch', 'fixtures/phase5-onelab.patch', 'fixtures/projects.json',
  'getdp/bridge.cpp', 'getdp/CMakeLists.append.txt', 'getdp/runtime.mjs', 'getdp/wasm-boundaries.patch', 'petsc/wasm-boundaries.patch',
  'getdp/combined-bridge.cpp', 'getdp/CMakeLists.combined.txt', 'getdp/combined-runtime.mjs',
  'native-probe.cpp', 'phase5-native-trace.cpp', 'getdp/CMakeLists.native-trace.txt',
]
const inputFile = (path) => path.startsWith('workspace/') ? join(root, path.slice('workspace/'.length)) : join(tools, path)
const inputs = Object.fromEntries(await Promise.all(inputPaths.map(async (path) => [path, sha256(await readFile(inputFile(path)))])))

const fixtureSources = new Map([
  ['microstrip/microstrip.geo', join(cacheRoot, 'fixtures/microstrip/microstrip.geo')],
  ['microstrip/microstrip.pro', join(cacheRoot, 'fixtures/microstrip/microstrip.pro')],
  ['microstrip/microstrip.json', join(tools, 'fixtures/microstrip.json')],
  ['cube/cube.geo', join(tools, 'fixtures/cube.geo')],
  ['cube/cube.step', join(tools, 'fixtures/cube.step')],
  ['cube/cube.provenance.json', join(tools, 'fixtures/cube.provenance.json')],
])
for (const family of ['radiator', 'electromagnet', 'full-wave', 'global-quantity', 'transfo', 'gmsh-rendering']) {
  const directory = join(cacheRoot, 'fixtures', family)
  for (const name of await filesUnder(directory)) fixtureSources.set(`${family}/${name}`, join(directory, name))
}
const fixtures = Object.fromEntries(await Promise.all([...fixtureSources].map(async ([path, source]) => [path, await metadata(source)])))
const outputs = Object.fromEntries(await Promise.all((await filesUnder(outputRoot)).map(async (path) => [path, await metadata(join(outputRoot, path))])))

const assets = [
  ...Object.entries(outputs).filter(([path]) => path.endsWith('.mjs') || path.endsWith('.wasm')).map(([path, value]) => ({ path, ...value })),
  { path: 'getdp/runtime.mjs', ...await metadata(join(tools, 'getdp/runtime.mjs')) },
  { path: 'fixtures/projects.json', ...await metadata(join(tools, 'fixtures/projects.json')) },
  ...Object.entries(fixtures).map(([path, value]) => ({ path: `fixtures/${path}`, ...value })),
]
const contentVersion = sha256(Buffer.from(JSON.stringify(assets))).slice(0, 20)
const lock = {
  schema: 2,
  generationDate: previous.generationDate,
  contentVersion,
  inputs,
  fixtures,
  outputs,
}
await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
console.log(`intentionally updated artifact lock to ${contentVersion}`)
