import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { archiveName, extractAndVerify, RELEASE_ASSETS, releaseTag, validateRelease, verifyReleaseDirectory } from './release-lib.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const lockBytes = await readFile(join(root, 'tools/wasm/artifacts.lock.json'))
const lock = JSON.parse(lockBytes)
const value = (flag, fallback) => {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : fallback
}
const repo = value('--repo', process.env.WASM_RELEASE_REPO || 'brauliobo/opensimphy')
const token = value('--token', process.env.GITHUB_TOKEN || process.env.GH_TOKEN)
const api = value('--api-url', process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '')
const offlineRelease = value('--release-json')
const offlineAssets = value('--asset-directory')
if ((offlineRelease && !offlineAssets) || (!offlineRelease && offlineAssets)) throw new Error('--release-json and --asset-directory must be used together')
const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'opensimphy-wasm-fetch' }
if (token) headers.Authorization = `Bearer ${token}`
const request = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } })
  if (!response.ok) throw new Error(`GitHub request failed: ${response.status} ${response.statusText}`)
  return response
}
const version = lock.contentVersion
const tag = releaseTag(version)
const release = offlineRelease
  ? JSON.parse(await readFile(offlineRelease, 'utf8'))
  : await (await request(`${api}/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`)).json()
const assets = validateRelease(release, version)
const work = await mkdtemp(join(root, '.wasm-release-download-'))
try {
  for (const name of [...RELEASE_ASSETS, archiveName(version)]) {
    const destination = join(work, name)
    if (offlineAssets) {
      await writeFile(destination, await readFile(join(offlineAssets, name)))
    } else {
      const asset = assets.get(name)
      const response = await request(`${api}/repos/${repo}/releases/assets/${asset.id}`, { headers: { Accept: 'application/octet-stream' }, redirect: 'follow' })
      await writeFile(destination, Buffer.from(await response.arrayBuffer()))
    }
  }
  await verifyReleaseDirectory(work, version, release, { lock, lockBytes })
  await extractAndVerify({
    archive: join(work, archiveName(version)),
    root: join(root, 'public/simulation'),
    verifier: join(root, 'tools/wasm/verify-staged-assets.mjs'),
    install: true,
  })
  console.log(`fetched and atomically installed ${tag} from ${repo}`)
} finally {
  await rm(work, { recursive: true, force: true })
}
