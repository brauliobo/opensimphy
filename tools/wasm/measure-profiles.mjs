import { createHash } from 'node:crypto'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const tools = fileURLToPath(new URL('.', import.meta.url))
const root = fileURLToPath(new URL('../..', import.meta.url))
const defaultStage = fileURLToPath(new URL('../../public/simulation', import.meta.url))
const partitionNames = ['shared', 'gmsh', 'separate-real', 'separate-complex', 'combined-real', 'combined-complex']
export const profileLoadSets = {
  'combined-real': ['shared', 'combined-real'],
  'combined-real+complex': ['shared', 'combined-real', 'combined-complex'],
  'separate-real': ['shared', 'gmsh', 'separate-real'],
  'separate-real+complex': ['shared', 'gmsh', 'separate-real', 'separate-complex'],
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const sum = (items, key) => items.reduce((total, item) => total + item[key], 0)
const format = (value) => value.toLocaleString('en-US')
const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`

async function measuredFile(stage, metadata, cache) {
  if (cache.has(metadata.path)) return cache.get(metadata.path)
  const bytes = await readFile(join(stage, metadata.path))
  const actual = { path: metadata.path, rawBytes: bytes.length, sha256: sha256(bytes) }
  if (actual.rawBytes !== metadata.bytes || actual.sha256 !== metadata.sha256) throw new Error(`staged measurement input differs from manifest: ${metadata.path}`)
  const measurement = {
    ...actual,
    gzipBytes: gzipSync(bytes, { level: 9, mtime: 0 }).length,
    brotliBytes: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  }
  cache.set(metadata.path, measurement)
  return measurement
}

function aggregate(files, extra = {}) {
  return {
    ...extra,
    files: files.length,
    filePaths: files.map(({ path }) => path),
    rawBytes: sum(files, 'rawBytes'),
    gzipBytes: sum(files, 'gzipBytes'),
    brotliBytes: sum(files, 'brotliBytes'),
  }
}

export async function buildProfileMeasurements(stage = process.env.SIMULATION_STAGE || defaultStage) {
  const [manifestBytes, lockBytes] = await Promise.all([
    readFile(join(stage, 'manifest.json')),
    readFile(join(tools, 'artifacts.lock.json')),
  ])
  const manifest = JSON.parse(manifestBytes)
  const lock = JSON.parse(lockBytes)
  if (manifest.schema !== 5 || manifest.version !== lock.contentVersion || JSON.stringify(manifest.inputs) !== JSON.stringify(lock.inputs)) throw new Error('measurement manifest does not match the current artifact lock')
  if (JSON.stringify(Object.keys(manifest.partitions).sort()) !== JSON.stringify([...partitionNames].sort())) throw new Error('measurement manifest partition set is invalid')

  const cache = new Map()
  const seen = new Set()
  const partitionMeasurements = {}
  for (const name of partitionNames) {
    const partition = manifest.partitions[name]
    const digest = sha256(Buffer.from(JSON.stringify(partition.files)))
    if (partition.name !== name || partition.cacheName !== `opensimphy-onelab-${manifest.version}-${name}` || partition.fileMapDigest !== digest) throw new Error(`measurement manifest ${name} partition identity is invalid`)
    for (const file of partition.files) {
      if (seen.has(file.path)) throw new Error(`measurement manifest has duplicate browser asset: ${file.path}`)
      seen.add(file.path)
    }
    const files = await Promise.all(partition.files.map((file) => measuredFile(stage, file, cache)))
    partitionMeasurements[name] = aggregate(files, { fileMapDigest: partition.fileMapDigest })
  }

  const manifestFile = {
    path: 'manifest.json',
    rawBytes: manifestBytes.length,
    sha256: sha256(manifestBytes),
    gzipBytes: gzipSync(manifestBytes, { level: 9, mtime: 0 }).length,
    brotliBytes: brotliCompressSync(manifestBytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  }
  const measurements = {}
  for (const [loadSet, partitions] of Object.entries(profileLoadSets)) {
    const files = [manifestFile, ...partitions.flatMap((partition) => partitionMeasurements[partition].filePaths.map((path) => cache.get(path)))]
    measurements[loadSet] = aggregate(files, { partitions, controlFiles: ['manifest.json'] })
  }
  return {
    schema: 4,
    contentVersion: manifest.version,
    measuredAt: lock.generationDate.slice(0, 10),
    manifest: { path: manifestFile.path, bytes: manifestFile.rawBytes, sha256: manifestFile.sha256 },
    compression: { perFile: true, gzipLevel: 9, gzipMtime: 0, brotliQuality: 11 },
    partitionMeasurements,
    measurements,
    defaultProfile: 'combined',
    startupMilliseconds: { 'combined-real': null, 'combined-complex': null, 'separate-real': null, 'separate-complex': null },
    browserRuntimeMetrics: ['profile', 'scalarType', 'startupMilliseconds', 'moduleStartupMilliseconds', 'moduleWasmMemoryBytes', 'wasmMemoryBytes', 'memfsFiles', 'memfsBytes', 'cachedPartitionBytes', 'repeatRunGrowthBytes', 'historyPoints', 'historyBytes'],
  }
}

export function documentationBlocks(report) {
  const partition = report.partitionMeasurements
  const phase4Rows = [
    ['OCC Gmsh', partition.gmsh],
    ['Real GetDP/PETSc', partition['separate-real']],
    ['Complex GetDP/PETSc', partition['separate-complex']],
  ]
  const total = {
    rawBytes: sum(phase4Rows.map(([, value]) => value), 'rawBytes'),
    gzipBytes: sum(phase4Rows.map(([, value]) => value), 'gzipBytes'),
    brotliBytes: sum(phase4Rows.map(([, value]) => value), 'brotliBytes'),
  }
  const phase4 = [
    `Measured from content version \`${report.contentVersion}\` on ${report.measuredAt} with per-file gzip level 9 and Brotli quality 11:`,
    '',
    '| Browser partition | Files | Raw bytes | gzip bytes | Brotli bytes |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...phase4Rows.map(([label, value]) => `| ${label} | ${format(value.files)} | ${format(value.rawBytes)} | ${format(value.gzipBytes)} | ${format(value.brotliBytes)} |`),
    `| Total module partitions | ${format(sum(phase4Rows.map(([, value]) => value), 'files'))} | ${format(total.rawBytes)} | ${format(total.gzipBytes)} | ${format(total.brotliBytes)} |`,
    '',
    `The separate real warm-up fetches exactly ${format(report.measurements['separate-real'].files)} files (the manifest plus \`shared + gmsh + separate-real\`) totaling ${format(report.measurements['separate-real'].brotliBytes)} Brotli bytes. Opening a complex project adds the complete \`separate-complex\` partition; the cumulative exact load set is ${format(report.measurements['separate-real+complex'].brotliBytes)} Brotli bytes.`,
  ].join('\n')

  const labels = {
    'combined-real': 'Combined real',
    'combined-real+complex': 'Combined real + complex',
    'separate-real': 'Separate real',
    'separate-real+complex': 'Separate real + complex',
  }
  const phase5 = [
    `Measured from content version \`${report.contentVersion}\` on ${report.measuredAt} with per-file gzip level 9 and Brotli quality 11. Every cumulative load set includes the fetched \`manifest.json\` exactly once:`,
    '',
    '| Browser load set | Files | Raw bytes | gzip bytes | Brotli bytes |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...Object.entries(report.measurements).map(([name, value]) => `| ${labels[name]} | ${format(value.files)} | ${format(value.rawBytes)} | ${format(value.gzipBytes)} | ${format(value.brotliBytes)} |`),
  ].join('\n')
  return { phase4, phase5 }
}

function replaceGeneratedBlock(document, name, content) {
  const start = `<!-- profile-measurements:${name}:start -->`
  const end = `<!-- profile-measurements:${name}:end -->`
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`)
  if (!pattern.test(document)) throw new Error(`documentation lacks generated ${name} markers`)
  return document.replace(pattern, `${start}\n${content}\n${end}`)
}

export async function generatedArtifacts() {
  const report = await buildProfileMeasurements()
  const docsPath = join(root, 'docs/wasm-toolchain.md')
  const currentDocs = await readFile(docsPath, 'utf8')
  const blocks = documentationBlocks(report)
  const docs = replaceGeneratedBlock(replaceGeneratedBlock(currentDocs, 'phase4', blocks.phase4), 'phase5', blocks.phase5)
  return { report, docs, docsPath, reportPath: join(tools, 'profile-measurements.json') }
}

export async function verifyGeneratedArtifacts() {
  const generated = await generatedArtifacts()
  const [report, docs] = await Promise.all([readFile(generated.reportPath, 'utf8'), readFile(generated.docsPath, 'utf8')])
  if (report !== serialize(generated.report)) throw new Error('profile-measurements.json is stale; run npm run wasm:measure')
  if (docs !== generated.docs) throw new Error('WASM documentation measurements are stale; run npm run wasm:measure')
}

async function main() {
  const generated = await generatedArtifacts()
  if (process.argv.includes('--check')) {
    await verifyGeneratedArtifacts()
    console.log(`verified profile measurements and documentation for ${generated.report.contentVersion}`)
    return
  }
  await Promise.all([
    writeFile(generated.reportPath, serialize(generated.report)),
    writeFile(generated.docsPath, generated.docs),
  ])
  console.log(serialize(generated.report).trim())
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
