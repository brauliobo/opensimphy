import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { archiveName, inspectArchive, makeDeterministicArchive, releaseTag, validateRelease, verifyReleaseDirectory, verifyReproducibilityEvidence } from '../../tools/wasm/release-lib.mjs'

const execFileAsync = promisify(execFile)

function octal(value: number, length: number) {
  return `${value.toString(8).padStart(length - 1, '0')}\0`
}

function tar(entries: Array<{ name: string, type?: string, link?: string, bytes?: Buffer }>) {
  const blocks: Buffer[] = []
  for (const entry of entries) {
    const bytes = entry.bytes ?? Buffer.alloc(0)
    const header = Buffer.alloc(512)
    header.write(entry.name, 0, 100)
    header.write(octal(entry.type === '5' ? 0o755 : 0o644, 8), 100, 8)
    header.write(octal(0, 8), 108, 8)
    header.write(octal(0, 8), 116, 8)
    header.write(octal(bytes.length, 12), 124, 12)
    header.write(octal(0, 12), 136, 12)
    header.fill(0x20, 148, 156)
    header.write(entry.type ?? '0', 156, 1)
    if (entry.link) header.write(entry.link, 157, 100)
    header.write('ustar\0', 257, 6)
    header.write('00', 263, 2)
    header.write(`${header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0')}\0 `, 148, 8)
    blocks.push(header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512))
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]), { level: 9, mtime: 0 })
}

describe('deterministic WASM release packaging', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'opensimphy-release-test-'))
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('produces byte-identical normalized tar/gzip archives', async () => {
    const stage = join(directory, 'simulation')
    await mkdir(join(stage, 'version', 'fixtures'), { recursive: true })
    await writeFile(join(stage, 'manifest.json'), '{}\n')
    await writeFile(join(stage, 'version', 'fixtures', 'model.geo'), 'Point(1) = {0, 0, 0};\n')
    const first = join(directory, 'first.tar.gz')
    const second = join(directory, 'second.tar.gz')
    await makeDeterministicArchive(stage, first)
    await makeDeterministicArchive(stage, second)
    expect(createHash('sha256').update(await readFile(first)).digest('hex')).toBe(createHash('sha256').update(await readFile(second)).digest('hex'))
    expect((await inspectArchive(first)).map(({ path }) => path)).toEqual([
      'simulation',
      'simulation/manifest.json',
      'simulation/version',
      'simulation/version/fixtures',
      'simulation/version/fixtures/model.geo',
    ])
  })

  it.each([
    ['traversal', [{ name: '../escape', bytes: Buffer.from('x') }]],
    ['absolute path', [{ name: '/tmp/escape', bytes: Buffer.from('x') }]],
    ['symbolic link', [{ name: 'simulation', type: '5' }, { name: 'simulation/link', type: '2', link: '../../escape' }]],
    ['device', [{ name: 'simulation', type: '5' }, { name: 'simulation/device', type: '3' }]],
    ['duplicate', [{ name: 'simulation', type: '5' }, { name: 'simulation/file' }, { name: 'simulation/file' }]],
  ])('rejects malicious archive %s entries', async (_, entries) => {
    const path = join(directory, 'malicious.tar.gz')
    await writeFile(path, tar(entries as Array<{ name: string, type?: string, link?: string, bytes?: Buffer }>))
    await expect(inspectArchive(path)).rejects.toThrow()
  })

  it('rejects non-normalized gzip metadata', async () => {
    const bytes = tar([{ name: 'simulation', type: '5' }])
    bytes[4] = 1
    const path = join(directory, 'timestamped.tar.gz')
    await writeFile(path, bytes)
    await expect(inspectArchive(path)).rejects.toThrow('gzip metadata')
  })
})

describe('exact GitHub release fetch validation', () => {
  const version = '8b4dd5c93e4141bd5be9'
  const sourceCommit = '1'.repeat(40)
  const names = ['SHA256SUMS', 'corresponding-source.json', 'release-metadata.json', 'reproducibility-report.json', 'simulation.spdx.json', archiveName(version)]
  const release = { tag_name: releaseTag(version), target_commitish: sourceCommit, draft: false, prerelease: false, assets: names.map((name, id) => ({ id, name })) }

  it('accepts only the exact stable tag and unique required assets', () => {
    expect(validateRelease(release, version).size).toBe(names.length)
    expect(() => validateRelease({ ...release, tag_name: `${release.tag_name}-other` }, version)).toThrow('tag mismatch')
    expect(() => validateRelease({ ...release, draft: true }, version)).toThrow('draft')
    expect(() => validateRelease({ ...release, prerelease: true }, version)).toThrow('prerelease')
    expect(() => validateRelease({ ...release, assets: [...release.assets, release.assets[0]] }, version)).toThrow('duplicate')
    expect(() => validateRelease({ ...release, assets: release.assets.slice(1) }, version)).toThrow('asset set mismatch')
    expect(() => validateRelease({ ...release, assets: [...release.assets, { id: 99, name: 'unexpected' }] }, version)).toThrow('asset set mismatch')
  })

  it('rejects an offline draft before reading assets or attempting a network request', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'opensimphy-fetch-test-'))
    try {
      const releasePath = join(directory, 'release.json')
      await writeFile(releasePath, JSON.stringify({ ...release, draft: true }))
      await expect(execFileAsync(process.execPath, [
        join(process.cwd(), 'tools/wasm/fetch-release.mjs'),
        '--release-json', releasePath,
        '--asset-directory', directory,
      ], { env: { ...process.env, GITHUB_TOKEN: '', GH_TOKEN: '' } })).rejects.toMatchObject({ stderr: expect.stringContaining('is a draft') })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects extra local release assets before parsing their contents', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'opensimphy-local-assets-test-'))
    try {
      for (const name of names) await writeFile(join(directory, name), '')
      await writeFile(join(directory, 'unexpected'), '')
      await expect(verifyReleaseDirectory(directory, version)).rejects.toThrow('local release asset set mismatch')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})

describe('current reproducibility evidence', () => {
  const version = '8b4dd5c93e4141bd5be9'
  const lock = {
    contentVersion: version,
    inputs: { 'build.sh': 'a'.repeat(64) },
    outputs: { 'combined-real/combined.wasm': { bytes: 3, sha256: 'b'.repeat(64) } },
  }
  const lockBytes = Buffer.from(`${JSON.stringify(lock)}\n`)
  const stagedFiles = [{ path: `${version}/combined-real/combined.wasm`, bytes: 3, sha256: 'b'.repeat(64) }]
  const report = {
    schema: 1,
    canonical: { artifactLockSha256: createHash('sha256').update(lockBytes).digest('hex'), inputs: lock.inputs },
    byteIdentical: true,
    outputs: [{ path: 'combined-real/combined.wasm', bytes: 3, sha256: 'b'.repeat(64) }],
    drift: [],
  }

  it('requires the exact lock hash, canonical inputs/outputs, staged outputs and empty drift', () => {
    expect(() => verifyReproducibilityEvidence({ report, lock, lockBytes, stagedFiles })).not.toThrow()
    expect(() => verifyReproducibilityEvidence({ report: { ...report, byteIdentical: false }, lock, lockBytes, stagedFiles })).toThrow('byte-identical')
    expect(() => verifyReproducibilityEvidence({ report: { ...report, drift: [{}] }, lock, lockBytes, stagedFiles })).toThrow('byte-identical')
    expect(() => verifyReproducibilityEvidence({ report: { ...report, canonical: { ...report.canonical, artifactLockSha256: '0'.repeat(64) } }, lock, lockBytes, stagedFiles })).toThrow('stale')
    expect(() => verifyReproducibilityEvidence({ report: { ...report, canonical: { ...report.canonical, inputs: {} } }, lock, lockBytes, stagedFiles })).toThrow('canonical inputs')
    expect(() => verifyReproducibilityEvidence({ report: { ...report, outputs: [] }, lock, lockBytes, stagedFiles })).toThrow('canonical outputs')
    expect(() => verifyReproducibilityEvidence({ report, lock, lockBytes, stagedFiles: [] })).toThrow('staged simulation tree')
  })
})
