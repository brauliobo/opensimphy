import { createWriteStream } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const vendorDir = join(root, 'vendor', 'giacjs')
const wasmPath = join(vendorDir, 'giacwasm.js')
const sourceUrl = 'https://www-fourier.univ-grenoble-alpes.fr/~parisse/giacjs.tar.gz'
const execFileAsync = promisify(execFile)

export async function acquireGiac(): Promise<string> {
  try {
    const info = await stat(wasmPath)
    if (info.size > 1_000_000) return wasmPath
  } catch {
    // Missing vendor copy is acquired below.
  }
  await mkdir(vendorDir, { recursive: true })
  const tarPath = join(tmpdir(), 'giacjs.tar.gz')
  const response = await fetch(sourceUrl)
  if (!response.ok || !response.body) throw new Error(`Giac download failed: ${response.status} ${response.statusText}`)
  await pipeline(response.body, createWriteStream(tarPath))
  await execFileAsync('tar', [
    '-xzf',
    tarPath,
    '-C',
    join(root, 'vendor'),
    'giacjs/giacwasm.js',
    'giacjs/LICENSE',
    'giacjs/README.md',
    'giacjs/package.json',
  ])
  const info = await stat(wasmPath)
  if (info.size <= 1_000_000) throw new Error('Giac WASM copy is smaller than expected')
  return wasmPath
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await acquireGiac()
  console.log(wasmPath)
}
