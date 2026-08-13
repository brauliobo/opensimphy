import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

if (!process.argv.includes('--intentional')) throw new Error('refusing to update artifact lock without --intentional')

const root = fileURLToPath(new URL('../..', import.meta.url))
const tools = join(root, 'tools/wasm')
const outputRoot = process.env.WASM_OUT || join(tools, 'out')
const cacheRoot = process.env.WASM_CACHE || join(tools, '.cache')
const lockPath = join(tools, 'artifacts.lock.json')
const previous = JSON.parse(await readFile(lockPath, 'utf8'))
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const metadata = async (path) => {
  const bytes = await readFile(path)
  return { bytes: bytes.length, sha256: sha256(bytes) }
}

const patches = {}
for (const name of Object.keys(previous.patches)) patches[name] = sha256(await readFile(join(tools, name)))
const fixtures = {}
for (const name of Object.keys(previous.fixtures)) {
  const path = name.startsWith('cube.') || name === 'microstrip.json'
    ? join(tools, 'fixtures', name)
    : join(cacheRoot, 'fixtures/microstrip', name)
  fixtures[name] = sha256(await readFile(path))
}
const outputs = {}
for (const name of Object.keys(previous.outputs)) outputs[name] = await metadata(join(outputRoot, name))

const assets = Object.entries(outputs).map(([path, value]) => ({ path, ...value }))
const runtime = await metadata(join(tools, 'getdp/runtime.mjs'))
assets.push({ path: 'getdp/runtime.mjs', ...runtime })
for (const cube of [false, true]) {
  for (const [name, hash] of Object.entries(fixtures).filter(([name]) => name.startsWith('cube.') === cube)) {
    const bytes = await readFile(cube || name === 'microstrip.json' ? join(tools, 'fixtures', name) : join(cacheRoot, 'fixtures/microstrip', name))
    assets.push({ path: `fixtures/${cube ? 'cube' : 'microstrip'}/${name}`, bytes: bytes.length, sha256: hash })
  }
}
const contentVersion = sha256(Buffer.from(JSON.stringify(assets))).slice(0, 20)
const lock = { ...previous, contentVersion, patches, fixtures, outputs }
await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
console.log(`intentionally updated artifact lock to ${contentVersion}`)
