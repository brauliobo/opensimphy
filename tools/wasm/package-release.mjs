import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { archiveName, filesUnder, makeDeterministicArchive, RELEASE_ASSETS, releaseTag, run, sha256File, verifyReproducibilityEvidence } from './release-lib.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const tools = join(root, 'tools/wasm')
const stage = process.env.SIMULATION_STAGE || join(root, 'public/simulation')
const lockBytes = await readFile(join(tools, 'artifacts.lock.json'))
const lock = JSON.parse(lockBytes)
const versions = Object.fromEntries((await readFile(join(tools, 'versions.env'), 'utf8')).trim().split('\n').map((line) => line.split('=', 2)))
const outputIndex = process.argv.indexOf('--output')
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : join(root, 'release', `wasm-${lock.contentVersion}`)
const verifyTwice = process.argv.includes('--verify-determinism')
const sourceCommit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const json = (value) => `${JSON.stringify(value, null, 2)}\n`

await run(process.execPath, [join(tools, 'verify-staged-assets.mjs')], { env: { ...process.env, SIMULATION_STAGE: stage } })
await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
const stagedFiles = await Promise.all((await filesUnder(stage)).map(async (path) => {
  const file = join(stage, path)
  return { path, bytes: (await stat(file)).size, sha256: await sha256File(file) }
}))
const reproducibilityReport = JSON.parse(await readFile(join(tools, 'reproducibility-report.json'), 'utf8'))
verifyReproducibilityEvidence({ report: reproducibilityReport, lock, lockBytes, stagedFiles })
const archive = archiveName(lock.contentVersion)
await makeDeterministicArchive(stage, join(output, archive))
if (verifyTwice) {
  const second = join(output, `${archive}.second`)
  await makeDeterministicArchive(stage, second)
  if (await sha256File(second) !== await sha256File(join(output, archive))) throw new Error('deterministic archive packaging produced different bytes')
  await rm(second)
}

const sources = Object.fromEntries(['GMSH_JS', 'GMSH', 'OCCT', 'GETDP', 'PETSC'].map((name) => [name.toLowerCase().replace('_', '-'), {
  url: versions[`${name}_URL`], revision: versions[`${name}_REVISION`], tree: versions[`${name}_TREE`],
}]))
await writeFile(join(output, 'corresponding-source.json'), json({
  schema: 1,
  contentVersion: lock.contentVersion,
  sourceCommit,
  recipe: ['npm ci', 'JOBS=4 nice npm run wasm:reproducibility', 'npm run simulation:stage -- --verify-lock', 'npm run simulation:verify'],
  toolchain: { image: versions.EMSDK_IMAGE, emscripten: versions.EMSDK_VERSION },
  sources,
  archives: { f2cblaslapack: { url: versions.F2CBLASLAPACK_URL, sha256: versions.F2CBLASLAPACK_SHA256 } },
  buildInputs: lock.inputs,
}))
const spdxFiles = stagedFiles.map((file, index) => ({
  SPDXID: `SPDXRef-File-${index + 1}`,
  fileName: `./simulation/${file.path}`,
  checksums: [{ algorithm: 'SHA256', checksumValue: file.sha256 }],
  licenseConcluded: 'NOASSERTION',
  licenseInfoInFiles: ['NOASSERTION'],
  copyrightText: 'NOASSERTION',
}))
await writeFile(join(output, 'simulation.spdx.json'), json({
  spdxVersion: 'SPDX-2.3',
  dataLicense: 'CC0-1.0',
  SPDXID: 'SPDXRef-DOCUMENT',
  name: `OpenSimPhy WASM ${lock.contentVersion}`,
  documentNamespace: `https://github.com/brauliobo/opensimphy/releases/tag/${releaseTag(lock.contentVersion)}/spdx`,
  creationInfo: { created: lock.generationDate, creators: ['Tool: opensimphy-package-release'] },
  packages: [{ SPDXID: 'SPDXRef-Package', name: 'opensimphy-wasm', versionInfo: lock.contentVersion, downloadLocation: 'NOASSERTION', filesAnalyzed: true, licenseConcluded: 'NOASSERTION', licenseDeclared: 'NOASSERTION', copyrightText: 'NOASSERTION', checksums: [{ algorithm: 'SHA256', checksumValue: createHash('sha256').update(JSON.stringify(stagedFiles)).digest('hex') }] }],
  files: spdxFiles,
  relationships: spdxFiles.map(({ SPDXID }) => ({ spdxElementId: 'SPDXRef-Package', relationshipType: 'CONTAINS', relatedSpdxElement: SPDXID })),
}))
await writeFile(join(output, 'reproducibility-report.json'), json(reproducibilityReport))
const assets = [...RELEASE_ASSETS.filter((name) => name !== 'SHA256SUMS'), archive].sort()
await writeFile(join(output, 'release-metadata.json'), json({
  schema: 1,
  contentVersion: lock.contentVersion,
  tag: releaseTag(lock.contentVersion),
  sourceCommit,
  archive,
  archiveRoot: 'simulation/',
  normalizedTar: { format: 'ustar', uid: 0, gid: 0, mtime: 0, fileMode: '0644', directoryMode: '0755', order: 'sorted-depth-first' },
  normalizedGzip: { filename: false, timestamp: 0, compressionLevel: 9 },
  assets: [...assets, 'SHA256SUMS'].sort(),
  checksummedAssets: assets,
  stagedFiles,
}))
const sums = []
for (const name of assets) sums.push(`${await sha256File(join(output, name))}  ${name}`)
await writeFile(join(output, 'SHA256SUMS'), `${sums.join('\n')}\n`)
console.log(`packaged ${stagedFiles.length} staged files for ${releaseTag(lock.contentVersion)} in ${output}`)
