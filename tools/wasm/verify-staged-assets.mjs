import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const stage = join(root, 'public/simulation')
const lock = JSON.parse(await readFile(join(root, 'tools/wasm/artifacts.lock.json'), 'utf8'))
const manifest = JSON.parse(await readFile(join(stage, 'manifest.json'), 'utf8'))
if (manifest.schema !== 2 || manifest.version !== lock.contentVersion || manifest.cacheName !== `opensimphy-onelab-${lock.contentVersion}`) {
  throw new Error('staged simulation manifest does not match the tracked artifact lock')
}
const runtimeBytes = await readFile(join(root, 'tools/wasm/getdp/runtime.mjs'))
const fixtureRoot = join(root, 'tools/wasm/.cache/src/getdp/tutorials/01-Electrostatics')
const expectedFiles = [
  ...Object.entries(lock.outputs).map(([path, metadata]) => ({ path: `${lock.contentVersion}/${path}`, ...metadata })),
  { path: `${lock.contentVersion}/getdp/runtime.mjs`, bytes: runtimeBytes.length, sha256: lock.patches['getdp/runtime.mjs'] },
  ...await Promise.all(Object.entries(lock.fixtures).map(async ([name, sha256]) => ({
    path: `${lock.contentVersion}/fixtures/microstrip/${name}`,
    bytes: (await readFile(join(fixtureRoot, name))).length,
    sha256,
  }))),
]
if (JSON.stringify(manifest.files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 }))) !== JSON.stringify(expectedFiles.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256: String(sha256) })))) {
  throw new Error('staged simulation manifest file map does not exactly match the artifact lock')
}
const fileMapDigest = createHash('sha256').update(JSON.stringify(manifest.files.map(({ path, bytes, sha256 }) => ({ path: path.slice(lock.contentVersion.length + 1), bytes, sha256 })))).digest('hex')
if (manifest.fileMapDigest !== fileMapDigest) throw new Error('staged simulation manifest file-map digest is invalid')
for (const file of manifest.files) {
  const bytes = await readFile(join(stage, file.path))
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (bytes.length !== file.bytes || hash !== file.sha256) throw new Error(`staged asset verification failed: ${file.path}`)
}
async function filesUnder(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(path))
    else files.push(relative(stage, path))
  }
  return files
}
const actualPaths = (await filesUnder(stage)).sort()
const expectedPaths = ['manifest.json', ...manifest.files.map(({ path }) => path)].sort()
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) throw new Error(`staged simulation file set is not lock-closed\nexpected: ${expectedPaths.join('\n')}\nactual: ${actualPaths.join('\n')}`)
console.log(`verified ${manifest.files.length} staged simulation assets for ${manifest.version}`)
