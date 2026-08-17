import { createHash } from 'node:crypto'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { documentationBlocks, profileLoadSets } from './measure-profiles.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const stage = process.env.SIMULATION_STAGE || join(root, 'public/simulation')
const partitionNames = ['shared', 'gmsh', 'separate-real', 'separate-complex', 'combined-real', 'combined-complex']
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const sum = (values) => values.reduce((total, value) => total + value, 0)

const [reportBytes, manifestBytes, lockBytes, docs] = await Promise.all([
  readFile(join(root, 'tools/wasm/profile-measurements.json')),
  readFile(join(stage, 'manifest.json')),
  readFile(join(root, 'tools/wasm/artifacts.lock.json')),
  readFile(join(root, 'docs/wasm-toolchain.md'), 'utf8'),
])
const report = JSON.parse(reportBytes)
const manifest = JSON.parse(manifestBytes)
const lock = JSON.parse(lockBytes)
if (report.schema !== 4 || report.contentVersion !== manifest.version || manifest.version !== lock.contentVersion || report.measuredAt !== lock.generationDate.slice(0, 10)) throw new Error('profile measurement identity is stale')
if (report.manifest.path !== 'manifest.json' || report.manifest.bytes !== manifestBytes.length || report.manifest.sha256 !== sha256(manifestBytes)) throw new Error('profile measurement manifest evidence is stale')
if (JSON.stringify(Object.keys(report.partitionMeasurements)) !== JSON.stringify(partitionNames) || JSON.stringify(Object.keys(report.measurements)) !== JSON.stringify(Object.keys(profileLoadSets))) throw new Error('profile measurement set is stale')

for (const name of partitionNames) {
  const partition = manifest.partitions[name]
  const measured = report.partitionMeasurements[name]
  const paths = partition.files.map(({ path }) => path)
  if (measured.fileMapDigest !== partition.fileMapDigest || measured.files !== paths.length || JSON.stringify(measured.filePaths) !== JSON.stringify(paths) || measured.rawBytes !== sum(partition.files.map(({ bytes }) => bytes))) throw new Error(`profile measurement ${name} partition is stale`)
}

const manifestCompression = {
  rawBytes: manifestBytes.length,
  gzipBytes: gzipSync(manifestBytes, { level: 9, mtime: 0 }).length,
  brotliBytes: brotliCompressSync(manifestBytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
}
for (const [name, partitions] of Object.entries(profileLoadSets)) {
  const measured = report.measurements[name]
  const partitionReports = partitions.map((partition) => report.partitionMeasurements[partition])
  const paths = ['manifest.json', ...partitionReports.flatMap(({ filePaths }) => filePaths)]
  if (JSON.stringify(measured.partitions) !== JSON.stringify(partitions) || JSON.stringify(measured.controlFiles) !== JSON.stringify(['manifest.json']) || measured.files !== paths.length || JSON.stringify(measured.filePaths) !== JSON.stringify(paths)) throw new Error(`profile measurement ${name} file set is stale`)
  for (const key of ['rawBytes', 'gzipBytes', 'brotliBytes']) if (measured[key] !== manifestCompression[key] + sum(partitionReports.map((partition) => partition[key]))) throw new Error(`profile measurement ${name} ${key} total is stale`)
}

for (const [name, block] of Object.entries(documentationBlocks(report))) {
  const match = new RegExp(`<!-- profile-measurements:${name}:start -->\\n([\\s\\S]*?)\\n<!-- profile-measurements:${name}:end -->`).exec(docs)
  if (!match || match[1] !== block) throw new Error(`generated ${name} documentation measurements are stale`)
}
console.log(`verified profile evidence sources and documentation for ${report.contentVersion}`)
