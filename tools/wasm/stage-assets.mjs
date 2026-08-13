import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const tools = join(root, 'tools/wasm')
const outputRoot = process.env.WASM_OUT || join(tools, 'out')
const cacheRoot = process.env.WASM_CACHE || join(tools, '.cache')
const verifyLock = process.argv.includes('--verify-lock')
const versions = Object.fromEntries(
  (await readFile(join(tools, 'versions.env'), 'utf8')).trim().split('\n').map((line) => line.split('=', 2)),
)
const lock = JSON.parse(await readFile(join(tools, 'artifacts.lock.json'), 'utf8'))
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

async function verify(path, expected, label = path) {
  const bytes = await readFile(path)
  const actual = sha256(bytes)
  if (actual !== expected) throw new Error(`${label} SHA256 mismatch: expected ${expected}, got ${actual}`)
  return bytes
}

for (const [name, expected] of Object.entries(lock.patches)) await verify(join(tools, name), expected, name)
for (const [name, expected] of Object.entries(lock.outputs)) {
  const bytes = await verify(join(outputRoot, name), expected.sha256, name)
  if (bytes.length !== expected.bytes) throw new Error(`${name} byte length mismatch: expected ${expected.bytes}, got ${bytes.length}`)
}

const fixtureSource = join(cacheRoot, 'src/getdp/tutorials/01-Electrostatics')
const fixturePaths = ['microstrip.geo', 'microstrip.pro']
const assets = []
for (const [path, metadata] of Object.entries(lock.outputs)) {
  const bytes = await readFile(join(outputRoot, path))
  assets.push({ path, bytes, sha256: metadata.sha256 })
}
const runtimeBytes = await verify(join(tools, 'getdp/runtime.mjs'), lock.patches['getdp/runtime.mjs'], 'getdp/runtime.mjs')
assets.push({ path: 'getdp/runtime.mjs', bytes: runtimeBytes, sha256: sha256(runtimeBytes) })
for (const name of fixturePaths) {
  const bytes = await verify(join(fixtureSource, name), lock.fixtures[name], name)
  assets.push({ path: `fixtures/microstrip/${name}`, bytes, sha256: sha256(bytes) })
}

const contentId = sha256(Buffer.from(JSON.stringify(assets.map(({ path, bytes, sha256 }) => ({ path, bytes: bytes.length, sha256 })))))
const version = contentId.slice(0, 20)
const manifest = {
  schema: 2,
  version,
  cacheName: `opensimphy-onelab-${version}`,
  fileMapDigest: contentId,
  scalarType: 'real-double',
  compiler: { image: versions.EMSDK_IMAGE, emscripten: versions.EMSDK_VERSION, clang: '21.0.0git' },
  generation: { command: 'JOBS=4 nice npm run wasm:build', date: lock.generationDate, profile: 'serial-no-occ' },
  revisions: {
    gmshJs: { url: versions.GMSH_JS_URL, commit: versions.GMSH_JS_REVISION, tree: versions.GMSH_JS_TREE },
    gmsh: { url: versions.GMSH_URL, commit: versions.GMSH_REVISION, tree: versions.GMSH_TREE },
    getdp: { url: versions.GETDP_URL, commit: versions.GETDP_REVISION, tree: versions.GETDP_TREE },
    petsc: { url: versions.PETSC_URL, commit: versions.PETSC_REVISION, tree: versions.PETSC_TREE },
  },
  patches: lock.patches,
  files: assets.map(({ path, bytes, sha256 }) => ({ path: `${version}/${path}`, bytes: bytes.length, sha256 })),
}

if (verifyLock && version !== lock.contentVersion) {
  throw new Error(`artifact lock drift: expected content version ${lock.contentVersion}, got ${version}`)
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
