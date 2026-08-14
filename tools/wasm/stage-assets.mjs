import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root       = fileURLToPath(new URL('../..', import.meta.url))
const tools      = join(root, 'tools/wasm')
const outputRoot = process.env.WASM_OUT || join(tools, 'out')
const cacheRoot  = process.env.WASM_CACHE || join(tools, '.cache')
const verifyLock = process.argv.includes('--verify-lock')
const versions   = Object.fromEntries((await readFile(join(tools, 'versions.env'), 'utf8')).trim().split('\n').map((line) => line.split('=', 2)))
const lock       = JSON.parse(await readFile(join(tools, 'artifacts.lock.json'), 'utf8'))
const sha256     = (bytes) => createHash('sha256').update(bytes).digest('hex')

async function verified(path, expected, label) {
  const bytes = await readFile(path)
  if (bytes.length !== expected.bytes || sha256(bytes) !== expected.sha256) throw new Error(`${label} differs from artifacts.lock.json`)
  return bytes
}

for (const [path, expected] of Object.entries(lock.inputs)) {
  const bytes = await readFile(join(tools, path))
  if (sha256(bytes) !== expected) throw new Error(`${path} differs from artifacts.lock.json`)
}

const fixtureSource = (path) => {
  if (path === 'microstrip/microstrip.json') return join(tools, 'fixtures/microstrip.json')
  if (path.startsWith('microstrip/')) return join(cacheRoot, 'fixtures', path)
  if (path.startsWith('cube/')) return join(tools, 'fixtures', path.slice('cube/'.length))
  return join(cacheRoot, 'fixtures', path)
}
const assets = []
for (const [path, expected] of Object.entries(lock.outputs)) assets.push({ path, bytes: await verified(join(outputRoot, path), expected, path), sha256: expected.sha256 })
const runtime = await readFile(join(tools, 'getdp/runtime.mjs'))
assets.push({ path: 'getdp/runtime.mjs', bytes: runtime, sha256: sha256(runtime) })
const catalog = await readFile(join(tools, 'fixtures/projects.json'))
assets.push({ path: 'fixtures/projects.json', bytes: catalog, sha256: sha256(catalog) })
for (const [path, expected] of Object.entries(lock.fixtures)) assets.push({ path: `fixtures/${path}`, bytes: await verified(fixtureSource(path), expected, path), sha256: expected.sha256 })

const identity = assets.map(({ path, bytes, sha256 }) => ({ path, bytes: bytes.length, sha256 }))
const contentId = sha256(Buffer.from(JSON.stringify(identity)))
const version = contentId.slice(0, 20)
if (verifyLock && version !== lock.contentVersion) throw new Error(`artifact lock drift: expected content version ${lock.contentVersion}, got ${version}`)
const manifest = {
  schema: 4,
  version,
  scalarTypes: ['real-double', 'complex-double'],
  compiler: { image: versions.EMSDK_IMAGE, emscripten: versions.EMSDK_VERSION, clang: '21.0.0git' },
  generation: { command: 'JOBS=4 GMSH_PROFILE=occ nice npm run wasm:build', date: lock.generationDate, profile: 'serial-occ-real-complex' },
  revisions: {
    gmshJs: { url: versions.GMSH_JS_URL, commit: versions.GMSH_JS_REVISION, tree: versions.GMSH_JS_TREE },
    gmsh: { url: versions.GMSH_URL, commit: versions.GMSH_REVISION, tree: versions.GMSH_TREE },
    occt: { url: versions.OCCT_URL, commit: versions.OCCT_REVISION, tree: versions.OCCT_TREE },
    getdp: { url: versions.GETDP_URL, commit: versions.GETDP_REVISION, tree: versions.GETDP_TREE },
    petsc: { url: versions.PETSC_URL, commit: versions.PETSC_REVISION, tree: versions.PETSC_TREE },
  },
  inputs: lock.inputs,
  partitions: Object.fromEntries(['core', 'real', 'complex'].map((name) => {
    const files = identity.filter(({ path }) => name === 'complex' ? path.startsWith('getdp-complex/') : name === 'real' ? path.startsWith('getdp/') : !path.startsWith('getdp/') && !path.startsWith('getdp-complex/'))
      .map((file) => ({ ...file, path: `${version}/${file.path}` }))
    return [name, { name, cacheName: `opensimphy-onelab-${version}-${name}`, fileMapDigest: sha256(Buffer.from(JSON.stringify(files))), files }]
  })),
}

const stage = join(root, 'public/simulation')
await rm(stage, { recursive: true, force: true })
for (const asset of assets) {
  const output = join(stage, version, asset.path)
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, asset.bytes)
}
await writeFile(join(stage, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`staged and verified ${assets.length} simulation assets as ${version}`)
