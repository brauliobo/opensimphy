import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const stage = process.env.SIMULATION_STAGE || join(root, 'public/simulation')
const lock = JSON.parse(await readFile(join(root, 'tools/wasm/artifacts.lock.json'), 'utf8'))
const manifest = JSON.parse(await readFile(join(stage, 'manifest.json'), 'utf8'))
if (manifest.schema !== 5 || manifest.version !== lock.contentVersion || JSON.stringify(manifest.inputs) !== JSON.stringify(lock.inputs)) {
  throw new Error('staged simulation manifest does not match the tracked artifact lock')
}
const runtimeBytes = await readFile(join(root, 'tools/wasm/getdp/runtime.mjs'))
const catalogBytes = await readFile(join(root, 'tools/wasm/fixtures/projects.json'))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const expectedFiles = [
  ...Object.entries(lock.outputs).filter(([path]) => path.endsWith('.mjs') || path.endsWith('.wasm')).map(([path, metadata]) => ({ path: `${lock.contentVersion}/${path}`, ...metadata })),
  { path: `${lock.contentVersion}/getdp/runtime.mjs`, bytes: runtimeBytes.length, sha256: hash(runtimeBytes) },
  { path: `${lock.contentVersion}/fixtures/projects.json`, bytes: catalogBytes.length, sha256: hash(catalogBytes) },
  ...Object.entries(lock.fixtures).map(([path, metadata]) => ({ path: `${lock.contentVersion}/fixtures/${path}`, ...metadata })),
]
const partitionFiles = Object.values(manifest.partitions).flatMap(({ files }) => files)
const byPath = (left, right) => left.path.localeCompare(right.path)
if (JSON.stringify(partitionFiles.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })).sort(byPath)) !== JSON.stringify(expectedFiles.sort(byPath))) {
  throw new Error('staged simulation manifest file map does not exactly match the artifact lock')
}
for (const [name, partition] of Object.entries(manifest.partitions)) {
  if (partition.name !== name || partition.cacheName !== `opensimphy-onelab-${lock.contentVersion}-${name}`) throw new Error(`invalid ${name} partition identity`)
  const digest = hash(Buffer.from(JSON.stringify(partition.files)))
  if (partition.fileMapDigest !== digest) throw new Error(`staged ${name} partition file-map digest is invalid`)
}
for (const file of partitionFiles) {
  const bytes = await readFile(join(stage, file.path))
  const actualHash = hash(bytes)
  if (bytes.length !== file.bytes || actualHash !== file.sha256) throw new Error(`staged asset verification failed: ${file.path}`)
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
const expectedPaths = ['manifest.json', ...partitionFiles.map(({ path }) => path)].sort()
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) throw new Error(`staged simulation file set is not lock-closed\nexpected: ${expectedPaths.join('\n')}\nactual: ${actualPaths.join('\n')}`)
console.log(`verified ${partitionFiles.length} staged simulation assets in ${Object.keys(manifest.partitions).length} partitions for ${manifest.version}`)
