#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HOST_PATH_NEEDLES = ['/home/braulio', '/tmp/opencode']
const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const defaultRoots = [
  resolve(root, 'public/wasm/awesomePhysics'),
  resolve(root, '.wasm-build'),
]

async function walk(directory, files = []) {
  let entries = []
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return files
    throw error
  }
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'cargo-target' || entry.name === 'bindgen') continue
      await walk(path, files)
      continue
    }
    if (!entry.isFile()) continue
    if (!/\.(wasm|js|mjs|ts|json)$/.test(entry.name)) continue
    const size = (await stat(path)).size
    if (size > 40 * 1024 * 1024) continue
    files.push(path)
  }
  return files
}

export async function scanAwesomeWasmHostPaths(roots = defaultRoots) {
  const hits = []
  for (const directory of roots) {
    for (const path of await walk(directory)) {
      const bytes = await readFile(path)
      const text = bytes.toString('latin1')
      const found = HOST_PATH_NEEDLES.filter((needle) => text.includes(needle))
      if (found.length > 0) hits.push({ path: relative(root, path), found })
    }
  }
  return hits
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const hits = await scanAwesomeWasmHostPaths()
  if (hits.length > 0) {
    console.error(JSON.stringify({ status: 'FAIL', hits }, null, 2))
    process.exit(1)
  }
  console.log(JSON.stringify({ status: 'PASS', hostPaths: 'absent', roots: defaultRoots.map((path) => relative(root, path)) }, null, 2))
}
