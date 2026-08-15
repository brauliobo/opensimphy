import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { archiveName, extractAndVerify, verifyReleaseDirectory } from './release-lib.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const lockBytes = await readFile(join(root, 'tools/wasm/artifacts.lock.json'))
const lock = JSON.parse(lockBytes)
const directory = process.argv[2]
if (!directory) throw new Error('usage: verify-release.mjs RELEASE_DIRECTORY [--release-json FILE]')
const releaseIndex = process.argv.indexOf('--release-json')
const release = releaseIndex >= 0 ? JSON.parse(await readFile(process.argv[releaseIndex + 1], 'utf8')) : undefined
await verifyReleaseDirectory(directory, lock.contentVersion, release, { lock, lockBytes })
await extractAndVerify({
  archive: join(directory, archiveName(lock.contentVersion)),
  root: join(root, 'public/simulation'),
  verifier: join(root, 'tools/wasm/verify-staged-assets.mjs'),
})
console.log(`verified release ${lock.contentVersion} without installing it`)
