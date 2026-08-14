import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const [leftRoot, rightRoot, reportPath] = process.argv.slice(2)
if (!reportPath) throw new Error('usage: compare-builds.mjs left-output right-output report.json')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const tools = fileURLToPath(new URL('.', import.meta.url))
const versions = Object.fromEntries((await readFile(join(tools, 'versions.env'), 'utf8')).trim().split('\n').map((line) => line.split('=', 2)))
const patches = Object.fromEntries(await Promise.all([
  'gmsh/view-bindings.patch',
  'gmsh/optional-quad-predicate.patch',
  'gmsh/persistent-parser-number.patch',
].map(async (path) => [path, hash(await readFile(join(tools, path)))])))

async function filesUnder(root, directory = root) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(root, path))
    else files.push(relative(root, path))
  }
  return files.sort()
}

function unsigned(bytes, cursor) {
  let value = 0
  let shift = 0
  while (true) {
    const byte = bytes[cursor.offset++]
    if (byte === undefined) throw new Error('truncated WASM LEB128')
    value |= (byte & 0x7f) << shift
    if (!(byte & 0x80)) return value >>> 0
    shift += 7
  }
}

function wasmSections(bytes) {
  if (bytes.length < 8 || bytes.subarray(0, 4).toString('hex') !== '0061736d') throw new Error('invalid WASM header')
  const names = ['custom', 'type', 'import', 'function', 'table', 'memory', 'global', 'export', 'start', 'element', 'code', 'data', 'data-count', 'tag']
  const sections = []
  const cursor = { offset: 8 }
  while (cursor.offset < bytes.length) {
    const id = bytes[cursor.offset++]
    const size = unsigned(bytes, cursor)
    const content = bytes.subarray(cursor.offset, cursor.offset + size)
    if (content.length !== size) throw new Error('truncated WASM section')
    sections.push({ id, name: names[id] ?? `unknown-${id}`, bytes: size, sha256: hash(content) })
    cursor.offset += size
  }
  return sections
}

const leftFiles = await filesUnder(leftRoot)
const rightFiles = await filesUnder(rightRoot)
if (JSON.stringify(leftFiles) !== JSON.stringify(rightFiles)) throw new Error(`output file maps differ\nleft: ${leftFiles.join(', ')}\nright: ${rightFiles.join(', ')}`)
const outputs = []
const drift = []
for (const path of leftFiles) {
  const [left, right] = await Promise.all([readFile(join(leftRoot, path)), readFile(join(rightRoot, path))])
  const item = { path, bytes: left.length, sha256: hash(left) }
  if (path.endsWith('.wasm')) item.sections = wasmSections(left)
  outputs.push(item)
  if (!left.equals(right)) {
    const mismatch = { path, left: { bytes: left.length, sha256: hash(left) }, right: { bytes: right.length, sha256: hash(right) } }
    if (path.endsWith('.wasm')) mismatch.sections = { left: wasmSections(left), right: wasmSections(right) }
    drift.push(mismatch)
  }
}
const report = {
  schema: 1,
  canonical: {
    jobs: 4,
    isolatedCaches: 2,
    gmshProfile: process.env.GMSH_PROFILE ?? 'occ',
    scalarTypes: ['real-double', 'complex-double'],
    image: versions.EMSDK_IMAGE,
    sources: Object.fromEntries(['GMSH_JS', 'GMSH', 'OCCT', 'GETDP', 'PETSC'].map((name) => [name.toLowerCase().replace('_', '-'), {
      revision: versions[`${name}_REVISION`],
      tree: versions[`${name}_TREE`],
    }])),
    f2cblaslapackSha256: versions.F2CBLASLAPACK_SHA256,
    patches,
  },
  byteIdentical: drift.length === 0,
  outputs,
  drift,
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
if (drift.length) throw new Error(`canonical build drift in ${drift.map(({ path }) => path).join(', ')}; see ${reportPath}`)
console.log(`verified ${outputs.length} byte-identical outputs; report: ${reportPath}`)
