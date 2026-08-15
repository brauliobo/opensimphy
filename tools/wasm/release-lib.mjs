import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { access, chmod, mkdir, mkdtemp, open, readFile, readdir, rename, rm } from 'node:fs/promises'
import { basename, dirname, join, sep } from 'node:path'
import { spawn } from 'node:child_process'
import { finished } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'

export const RELEASE_ASSETS = [
  'SHA256SUMS',
  'corresponding-source.json',
  'release-metadata.json',
  'reproducibility-report.json',
  'simulation.spdx.json',
]

export const archiveName = (version) => `opensimphy-wasm-${version}.tar.gz`
export const releaseTag = (version) => `wasm-${version}`
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

export async function sha256File(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

export async function run(command, args, options = {}) {
  await new Promise((accept, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options })
    child.once('error', reject)
    child.once('exit', (code, signal) => code === 0 ? accept() : reject(new Error(`${command} failed with ${signal ?? `exit ${code}`}`)))
  })
}

export async function filesUnder(root, directory = root) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(root, path))
    else if (entry.isFile()) files.push(path.slice(root.length + 1).split(sep).join('/'))
    else throw new Error(`staged tree contains a non-regular path: ${path}`)
  }
  return files.sort()
}

function tarString(block, offset, length) {
  const end = block.indexOf(0, offset)
  const bytes = block.subarray(offset, end >= offset && end < offset + length ? end : offset + length)
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

function tarNumber(block, offset, length, label) {
  const field = block.subarray(offset, offset + length)
  if (field[0] & 0x80) throw new Error(`archive uses unsupported base-256 ${label}`)
  const text = field.toString('ascii').replaceAll('\0', '').trim()
  if (!/^[0-7]*$/.test(text)) throw new Error(`archive has invalid ${label}`)
  return text ? Number.parseInt(text, 8) : 0
}

function validateArchivePath(path) {
  if (!path || path.includes('\\') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) throw new Error(`archive has absolute or invalid path: ${path}`)
  const segments = path.replace(/\/$/, '').split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) throw new Error(`archive path traversal or ambiguity: ${path}`)
  if (segments[0] !== 'simulation') throw new Error(`archive path is outside simulation/: ${path}`)
  return segments.join('/')
}

export async function inspectArchive(path) {
  const archive = await open(path, 'r')
  const gzipHeader = Buffer.alloc(10)
  try {
    if ((await archive.read(gzipHeader, 0, gzipHeader.length, 0)).bytesRead !== gzipHeader.length) throw new Error('archive has a truncated gzip header')
  } finally {
    await archive.close()
  }
  if (gzipHeader.toString('hex') !== '1f8b0800000000000203') throw new Error('archive gzip metadata is not normalized')
  const stream = createReadStream(path).pipe(createGunzip())
  let buffer = Buffer.alloc(0)
  let remaining = 0
  let zeroBlocks = 0
  let ended = false
  const entries = []
  const names = new Set()

  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk])
    while (buffer.length >= 512) {
      if (remaining) {
        const consumed = Math.min(buffer.length, remaining)
        buffer = buffer.subarray(consumed)
        remaining -= consumed
        continue
      }
      const block = buffer.subarray(0, 512)
      buffer = buffer.subarray(512)
      if (block.every((byte) => byte === 0)) {
        zeroBlocks += 1
        if (zeroBlocks === 2) ended = true
        continue
      }
      if (ended) throw new Error('archive has data after its end marker')
      zeroBlocks = 0
      const storedChecksum = tarNumber(block, 148, 8, 'header checksum')
      const checksumBlock = Buffer.from(block)
      checksumBlock.fill(0x20, 148, 156)
      const actualChecksum = checksumBlock.reduce((sum, byte) => sum + byte, 0)
      if (storedChecksum !== actualChecksum) throw new Error('archive has an invalid tar header checksum')
      const magic = tarString(block, 257, 6)
      if (magic !== 'ustar') throw new Error('archive is not normalized POSIX ustar')
      const name = tarString(block, 0, 100)
      const prefix = tarString(block, 345, 155)
      const rawPath = prefix ? `${prefix}/${name}` : name
      const archivePath = validateArchivePath(rawPath)
      if (names.has(archivePath)) throw new Error(`archive has duplicate path: ${archivePath}`)
      names.add(archivePath)
      const type = String.fromCharCode(block[156] || 0x30)
      if (type !== '0' && type !== '5') throw new Error(`archive has forbidden entry type ${JSON.stringify(type)}: ${archivePath}`)
      if (tarString(block, 157, 100)) throw new Error(`archive has a link target: ${archivePath}`)
      const size = tarNumber(block, 124, 12, 'size')
      const mode = tarNumber(block, 100, 8, 'mode') & 0o7777
      if (tarNumber(block, 108, 8, 'uid') !== 0 || tarNumber(block, 116, 8, 'gid') !== 0) throw new Error(`archive owner metadata is not normalized: ${archivePath}`)
      if (tarNumber(block, 136, 12, 'mtime') !== 0) throw new Error(`archive timestamp is not normalized: ${archivePath}`)
      if (type === '5' && (size !== 0 || mode !== 0o755)) throw new Error(`archive directory metadata is not normalized: ${archivePath}`)
      if (type === '0' && mode !== 0o644) throw new Error(`archive file mode is not normalized: ${archivePath}`)
      entries.push({ path: archivePath, size, type })
      remaining = Math.ceil(size / 512) * 512
    }
  }
  if (remaining || buffer.some((byte) => byte !== 0) || zeroBlocks < 2) throw new Error('archive is truncated or lacks a complete end marker')
  if (!entries.some(({ path, type }) => path === 'simulation' && type === '5')) throw new Error('archive lacks the simulation/ root directory')
  return entries
}

export function parseChecksumManifest(text) {
  const checksums = new Map()
  const lines = text.split('\n').filter(Boolean)
  if (!lines.length) throw new Error('SHA256SUMS is empty')
  for (const line of lines) {
    const match = /^([a-f0-9]{64})  ([A-Za-z0-9][A-Za-z0-9._-]*)$/.exec(line)
    if (!match) throw new Error(`invalid SHA256SUMS line: ${line}`)
    if (checksums.has(match[2])) throw new Error(`duplicate SHA256SUMS entry: ${match[2]}`)
    checksums.set(match[2], match[1])
  }
  return checksums
}

export function validateRelease(release, version) {
  const tag = releaseTag(version)
  if (!release || release.tag_name !== tag) throw new Error(`release tag mismatch: expected ${tag}`)
  if (release.draft) throw new Error(`release ${tag} is a draft`)
  if (release.prerelease) throw new Error(`release ${tag} is a prerelease`)
  const assets = new Map()
  for (const asset of release.assets ?? []) {
    if (!asset?.name || assets.has(asset.name)) throw new Error(`release ${tag} has duplicate or unnamed assets`)
    assets.set(asset.name, asset)
  }
  const expected = [...RELEASE_ASSETS, archiveName(version)].sort()
  const actual = [...assets.keys()].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`release ${tag} asset set mismatch\nexpected: ${expected.join(', ')}\nactual: ${actual.join(', ')}`)
  return assets
}

export function verifyReproducibilityEvidence({ report, lock, lockBytes, stagedFiles }) {
  if (report.schema !== 1 || report.byteIdentical !== true || !Array.isArray(report.drift) || report.drift.length !== 0) throw new Error('reproducibility evidence does not prove a byte-identical build')
  if (report.canonical?.artifactLockSha256 !== sha256(lockBytes)) throw new Error('reproducibility evidence artifact lock is stale')
  if (JSON.stringify(report.canonical.inputs) !== JSON.stringify(lock.inputs)) throw new Error('reproducibility evidence canonical inputs differ from the artifact lock')
  const expectedOutputs = Object.entries(lock.outputs).map(([path, metadata]) => ({ path, bytes: metadata.bytes, sha256: metadata.sha256 })).sort((left, right) => left.path.localeCompare(right.path))
  const outputNames = new Set()
  const actualOutputs = report.outputs?.map(({ path, bytes, sha256 }) => {
    if (outputNames.has(path)) throw new Error(`reproducibility evidence has duplicate output: ${path}`)
    outputNames.add(path)
    return { path, bytes, sha256 }
  }).sort((left, right) => left.path.localeCompare(right.path))
  if (JSON.stringify(actualOutputs) !== JSON.stringify(expectedOutputs)) throw new Error('reproducibility evidence canonical outputs differ from the artifact lock')
  const expectedStagedOutputs = expectedOutputs
    .filter(({ path }) => path.endsWith('.mjs') || path.endsWith('.wasm'))
    .map((file) => ({ ...file, path: `${lock.contentVersion}/${file.path}` }))
    .sort((left, right) => left.path.localeCompare(right.path))
  const stagedByPath = new Map(stagedFiles.map((file) => [file.path, file]))
  const actualStagedOutputs = expectedStagedOutputs.map(({ path }) => stagedByPath.get(path)).filter(Boolean).map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 }))
  if (JSON.stringify(actualStagedOutputs) !== JSON.stringify(expectedStagedOutputs)) throw new Error('reproducibility evidence outputs differ from the staged simulation tree')
}

export async function verifyReleaseDirectory(directory, version, release = undefined, evidence = undefined) {
  const expectedReleaseNames = [...RELEASE_ASSETS, archiveName(version)].sort()
  const localNames = await filesUnder(directory)
  if (JSON.stringify(localNames) !== JSON.stringify(expectedReleaseNames)) throw new Error(`local release asset set mismatch\nexpected: ${expectedReleaseNames.join(', ')}\nactual: ${localNames.join(', ')}`)
  const metadata = JSON.parse(await readFile(join(directory, 'release-metadata.json'), 'utf8'))
  const expectedNames = [...RELEASE_ASSETS.filter((name) => name !== 'SHA256SUMS'), archiveName(version)].sort()
  if (metadata.schema !== 1 || metadata.contentVersion !== version || metadata.tag !== releaseTag(version) || metadata.archive !== archiveName(version)) throw new Error('release metadata identity mismatch')
  if (JSON.stringify(metadata.assets) !== JSON.stringify(expectedReleaseNames) || JSON.stringify(metadata.checksummedAssets) !== JSON.stringify(expectedNames)) throw new Error('release metadata asset set mismatch')
  const checksumPath = join(directory, 'SHA256SUMS')
  const checksums = parseChecksumManifest(await readFile(checksumPath, 'utf8'))
  if (JSON.stringify([...checksums.keys()].sort()) !== JSON.stringify(expectedNames)) throw new Error('SHA256SUMS asset set mismatch')
  const githubAssets = release ? validateRelease(release, version) : undefined
  if (release && (typeof metadata.sourceCommit !== 'string' || !/^[a-f0-9]{40}$/.test(metadata.sourceCommit) || release.target_commitish !== metadata.sourceCommit)) throw new Error('release target does not match release metadata source commit')
  for (const [name, expected] of checksums) {
    const actual = await sha256File(join(directory, name))
    if (actual !== expected) throw new Error(`SHA256SUMS mismatch for ${name}`)
    const digest = githubAssets?.get(name)?.digest
    if (digest && digest !== `sha256:${actual}`) throw new Error(`GitHub asset digest mismatch for ${name}`)
  }
  if (githubAssets?.get('SHA256SUMS')?.digest) {
    const actual = await sha256File(checksumPath)
    if (githubAssets.get('SHA256SUMS').digest !== `sha256:${actual}`) throw new Error('GitHub asset digest mismatch for SHA256SUMS')
  }
  const entries = await inspectArchive(join(directory, archiveName(version)))
  const archivedFiles = entries.filter(({ type }) => type === '0').map(({ path }) => path.slice('simulation/'.length)).sort()
  if (JSON.stringify(archivedFiles) !== JSON.stringify(metadata.stagedFiles.map(({ path }) => path).sort())) throw new Error('archive file set differs from release metadata')
  if (evidence) {
    const report = JSON.parse(await readFile(join(directory, 'reproducibility-report.json'), 'utf8'))
    verifyReproducibilityEvidence({ ...evidence, report, stagedFiles: metadata.stagedFiles })
  }
  return { entries, metadata }
}

export async function extractAndVerify({ archive, root, verifier, install = false }) {
  const parent = dirname(root)
  await mkdir(parent, { recursive: true })
  const work = await mkdtemp(join(parent, '.simulation-release-'))
  try {
    await run('tar', ['-xzf', archive, '--directory', work, '--no-same-owner', '--no-same-permissions'])
    const extracted = join(work, 'simulation')
    await run(process.execPath, [verifier], { env: { ...process.env, SIMULATION_STAGE: extracted } })
    if (!install) return extracted
    const backup = `${root}.previous-${process.pid}`
    await rm(backup, { recursive: true, force: true })
    let hadPrevious = false
    try {
      await access(root)
      await rename(root, backup)
      hadPrevious = true
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    try {
      await rename(extracted, root)
      await rm(backup, { recursive: true, force: true })
    } catch (error) {
      if (hadPrevious) await rename(backup, root)
      throw error
    }
    return root
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

export async function makeDeterministicArchive(stage, output) {
  const parent = dirname(output)
  await mkdir(parent, { recursive: true })
  const tarPath = `${output}.tar`
  await rm(tarPath, { force: true })
  await run('tar', [
    '--format=ustar', '--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner',
    '--mode=u=rwX,go=rX', '-cf', tarPath,
    '--directory', dirname(stage), basename(stage),
  ])
  const input = createReadStream(tarPath)
  const child = spawn('gzip', ['-n', '-9', '-c'], { stdio: ['pipe', 'pipe', 'inherit'] })
  const destination = createWriteStream(output, { mode: 0o644 })
  input.pipe(child.stdin)
  child.stdout.pipe(destination)
  await Promise.all([
    new Promise((accept, reject) => {
      child.once('error', reject)
      child.once('exit', (code) => code === 0 ? accept() : reject(new Error(`gzip failed with exit ${code}`)))
    }),
    finished(destination),
  ])
  await rm(tarPath, { force: true })
  await chmod(output, 0o644)
  await inspectArchive(output)
}
