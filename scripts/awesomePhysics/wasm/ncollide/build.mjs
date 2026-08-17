#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, stat, symlink, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_REVISION = 'f3c3ecb3c98d1c2698574372b6b0e9d0032bc0c5'
const RUST_VERSION = '1.87.0'
const CARGO_VERSION = '1.87.0'
const WASM_TARGET = 'wasm32-unknown-unknown'
const CARGO_JOBS = 4
const MAX_MEMORY_BYTES = 67_108_864
const CARGO_VIRTUAL_MEMORY_KB = 8 * 1024 * 1024
const ABI_SOURCE_SHA256 = '49b38279e27f693744c4ab1d38eef5d0bab52e673f6d477df85e15d5c60846f8'
const CARGO_LOCK_SHA256 = '6e6a83be59f0f9b7de4b0b355ae0d7fb3a126849f94beb861cf15bf8a9dd4d1c'
const HOST_PATH_NEEDLES = Object.freeze(['/home/braulio', '/tmp/opencode'])
const EXPECTED_EXPORTS = Object.freeze([
  'ncollide_distance',
  'ncollide_contact_depth',
  'ncollide_ray_toi',
  'ncollide_time_of_impact',
  'ncollide_step',
  'memory',
])
const EXPECTED = Object.freeze({
  name: 'ncollide2d.wasm',
  byteSize: 113119,
  sha256: '57ca3a88ae50d98a93221ae161143b991f0f3e0c3c52c687348216ea2c35da6a',
})
const GOLDEN = Object.freeze({
  distance: 2.650214672088623,
  contactDepth: -2.6500000953674316,
  rayToi: 1.75,
  timeOfImpact: 1.5,
  step0: 2,
  step1: 1.9972749948501587,
  step60: -0.75,
})

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, '../../../..')
const persistRoot = resolve(projectRoot, '.wasm-build')
const publicArtifactDirectory = resolve(projectRoot, 'public/wasm/awesomePhysics/ncollide')
const abiDirectory = resolve(scriptDirectory, 'abi')
const defaultSource = resolve(projectRoot, '../awesome-physics-repos/ncollide')

function fail(message) {
  throw new Error(`ncollide2d build rejected: ${message}`)
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function inside(parent, child) {
  const childRelative = relative(parent, child)
  return childRelative === ''
    || (!childRelative.startsWith(`..${sep}`) && childRelative !== '..' && !isAbsolute(childRelative))
}

function optionValue(argumentsList, name) {
  const index = argumentsList.indexOf(name)
  if (index === -1) return null
  const value = argumentsList[index + 1]
  if (!value || value.startsWith('--')) fail(`${name} requires a value`)
  return value
}

function parseOptions(argumentsList) {
  const supported = new Set(['--source', '--output', '--record-artifact', '--install'])
  for (const argument of argumentsList) {
    if (argument.startsWith('--') && !supported.has(argument)) fail(`unsupported option ${argument}`)
  }
  const source = resolve(optionValue(argumentsList, '--source') ?? defaultSource)
  const outputArgument = optionValue(argumentsList, '--output')
  if (outputArgument === null) fail('--output must identify a new or empty persist directory under .wasm-build')
  return {
    source,
    output: resolve(outputArgument),
    recordArtifact: argumentsList.includes('--record-artifact'),
    install: argumentsList.includes('--install'),
  }
}

function run(command, args, options, label) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  })
  if (result.error) fail(`${label}: ${result.error.message}`)
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim()
    fail(`${label}: exited with status ${result.status}${detail ? `: ${detail}` : ''}`)
  }
  return result.stdout ?? ''
}

async function requireDirectory(path, label) {
  let details
  try {
    details = await stat(path)
  } catch (error) {
    fail(`${label} is unavailable at ${path}: ${error.message}`)
  }
  if (!details.isDirectory()) fail(`${label} is not a directory: ${path}`)
}

async function requireFile(path, label) {
  let details
  try {
    details = await stat(path)
  } catch (error) {
    fail(`${label} is unavailable at ${path}: ${error.message}`)
  }
  if (!details.isFile()) fail(`${label} is not a file: ${path}`)
}

async function ensureEmptyOutput(output, source) {
  if (inside(source, output)) fail('output must be outside the pinned source checkout')
  if (inside(publicArtifactDirectory, output)) fail('output must not overwrite the public artifact directory')
  if (inside(projectRoot, output) && !inside(persistRoot, output)) {
    fail('in-repo output must stay under .wasm-build')
  }
  try {
    const outputStat = await stat(output)
    if (!outputStat.isDirectory()) fail('output exists but is not a directory')
    if ((await readdir(output)).length !== 0) fail('output directory must be empty')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    await mkdir(output, { recursive: true })
  }
}

function remapPathPrefixes(source, output) {
  const cargoHome = resolve(process.env.CARGO_HOME ?? join(process.env.HOME ?? '/home', '.cargo'))
  const rustupHome = resolve(process.env.RUSTUP_HOME ?? join(process.env.HOME ?? '/home', '.rustup'))
  return [
    [source, '/src/ncollide'],
    [output, '/build/ncollide'],
    [cargoHome, '/cargo'],
    [rustupHome, '/rustup'],
    ['/tmp/opencode', '/tmp/build'],
    ['/home/braulio', '/home'],
  ].map(([from, to]) => `--remap-path-prefix=${from}=${to}`).join(' ')
}

function assertNoHostPaths(bytes, label) {
  const text = Buffer.from(bytes).toString('latin1')
  const hits = HOST_PATH_NEEDLES.filter((needle) => text.includes(needle))
  if (hits.length > 0) fail(`${label} embeds host paths: ${hits.join(', ')}`)
}

function closeEnough(actual, expected, label) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1e-6) {
    fail(`${label} returned ${actual}, expected ${expected}`)
  }
}

async function stageAbi(output, source) {
  const stagedAbi = join(output, 'abi')
  const vendor = join(output, 'vendor')
  await mkdir(join(stagedAbi, 'src'), { recursive: true })
  await mkdir(vendor, { recursive: true })
  await symlink(source, join(vendor, 'ncollide'))
  const cargoTemplate = await readFile(join(abiDirectory, 'Cargo.toml'), 'utf8')
  const cargo = cargoTemplate.replace(
    /ncollide2d = \{ path = "[^"]+\/build\/ncollide2d"/,
    'ncollide2d = { path = "../vendor/ncollide/build/ncollide2d"',
  )
  if (cargo === cargoTemplate) fail('ABI Cargo.toml has no replaceable ncollide2d source path')
  await writeFile(join(stagedAbi, 'Cargo.toml'), cargo)
  await copyFile(join(abiDirectory, 'Cargo.lock'), join(stagedAbi, 'Cargo.lock'))
  await copyFile(join(abiDirectory, 'src', 'lib.rs'), join(stagedAbi, 'src', 'lib.rs'))
  const abiSource = await readFile(join(stagedAbi, 'src', 'lib.rs'))
  if (sha256(abiSource) !== ABI_SOURCE_SHA256) fail('ABI source hash drifted')
  const lock = await readFile(join(stagedAbi, 'Cargo.lock'))
  if (sha256(lock) !== CARGO_LOCK_SHA256) fail('Cargo.lock hash drifted')
  return stagedAbi
}

async function verifyWasm(path, recordArtifact) {
  const bytes = await readFile(path)
  const digest = sha256(bytes)
  if (!recordArtifact) {
    if (bytes.byteLength !== EXPECTED.byteSize) fail(`WASM size is ${bytes.byteLength}, expected ${EXPECTED.byteSize}`)
    if (digest !== EXPECTED.sha256) fail(`WASM SHA-256 is ${digest}, expected ${EXPECTED.sha256}`)
  }
  assertNoHostPaths(bytes, 'ncollide2d WASM')
  const module = await WebAssembly.compile(bytes)
  const imports = WebAssembly.Module.imports(module)
  if (imports.length !== 0) fail(`WASM imports must be empty, got ${imports.map((entry) => `${entry.module}.${entry.name}`).join(', ')}`)
  const exports = WebAssembly.Module.exports(module).map(({ name }) => name)
  for (const name of EXPECTED_EXPORTS) {
    if (!exports.includes(name)) fail(`WASM is missing ABI export ${name}`)
  }
  const instance = await WebAssembly.instantiate(module, {})
  const wasmExports = instance.exports
  closeEnough(wasmExports.ncollide_distance(), GOLDEN.distance, 'ncollide_distance')
  closeEnough(wasmExports.ncollide_contact_depth(), GOLDEN.contactDepth, 'ncollide_contact_depth')
  closeEnough(wasmExports.ncollide_ray_toi(), GOLDEN.rayToi, 'ncollide_ray_toi')
  closeEnough(wasmExports.ncollide_time_of_impact(), GOLDEN.timeOfImpact, 'ncollide_time_of_impact')
  closeEnough(wasmExports.ncollide_step(0), GOLDEN.step0, 'ncollide_step(0)')
  closeEnough(wasmExports.ncollide_step(1), GOLDEN.step1, 'ncollide_step(1)')
  closeEnough(wasmExports.ncollide_step(60), GOLDEN.step60, 'ncollide_step(60)')
  closeEnough(wasmExports.ncollide_step(600), GOLDEN.step60, 'ncollide_step(600)')
  const rejected = wasmExports.ncollide_step(601)
  if (Number.isFinite(rejected)) fail(`ncollide_step(601) returned ${rejected}, expected NaN`)
  if (wasmExports.memory.buffer.byteLength > MAX_MEMORY_BYTES) {
    fail(`WASM linear memory is ${wasmExports.memory.buffer.byteLength}, above the ${MAX_MEMORY_BYTES}-byte cap`)
  }
  return { byteSize: bytes.byteLength, sha256: digest }
}

async function writeLedger(artifact) {
  const ledger = {
    schemaVersion: 1,
    artifact: {
      name: EXPECTED.name,
      path: `wasm/awesomePhysics/ncollide/${EXPECTED.name}`,
      byteSize: artifact.byteSize,
      sha256: artifact.sha256,
    },
    source: {
      checkout: 'awesome-physics-repos/ncollide',
      revision: SOURCE_REVISION,
      crate: 'build/ncollide2d/Cargo.toml',
      abiSource: 'scripts/awesomePhysics/wasm/ncollide/abi/src/lib.rs',
      abiScope: '2D ball/cuboid distance and contact, ray TOI, ball-ball translational TOI, and a CCD plane-settling step.',
    },
    lock: {
      path: 'scripts/awesomePhysics/wasm/ncollide/abi/Cargo.lock',
      sha256: CARGO_LOCK_SHA256,
    },
    toolchain: {
      rust: RUST_VERSION,
      cargo: CARGO_VERSION,
      target: WASM_TARGET,
      cargoJobs: CARGO_JOBS,
      maxMemoryBytes: MAX_MEMORY_BYTES,
      virtualMemoryKb: CARGO_VIRTUAL_MEMORY_KB,
      releaseProfile: 'lto=true, codegen-units=1, panic=abort, opt-level=s',
    },
    abi: {
      sourceSha256: ABI_SOURCE_SHA256,
      exports: [...EXPECTED_EXPORTS.filter((name) => name !== 'memory')],
      limits: { maximumStepsPerCall: 600, maxMemoryBytes: MAX_MEMORY_BYTES },
    },
    golden: GOLDEN,
  }
  await writeFile(join(scriptDirectory, 'build-ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`)
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  await requireDirectory(options.source, 'ncollide source checkout')
  await requireFile(join(options.source, 'LICENSE'), 'ncollide license')
  await requireFile(join(options.source, 'build/ncollide2d/Cargo.toml'), 'ncollide2d crate')
  await ensureEmptyOutput(options.output, options.source)

  const head = run('git', ['-C', options.source, 'rev-parse', 'HEAD'], { cwd: options.output }, 'ncollide revision').trim()
  if (head !== SOURCE_REVISION) fail(`source revision is ${head}, expected ${SOURCE_REVISION}`)
  const status = run('git', ['-C', options.source, 'status', '--porcelain=v1'], { cwd: options.output }, 'ncollide status').trim()
  if (status.length > 0) fail(`source checkout is not clean:\n${status}`)

  const rustc = run('rustc', ['--version'], { cwd: options.output }, 'rustc version').trim()
  if (!rustc.startsWith(`rustc ${RUST_VERSION} `)) fail(`Rust toolchain is not ${RUST_VERSION}`)
  const cargo = run('cargo', ['--version'], { cwd: options.output }, 'cargo version').trim()
  if (!cargo.startsWith(`cargo ${CARGO_VERSION} `)) fail(`Cargo toolchain is not ${CARGO_VERSION}`)
  const targets = run('rustup', ['target', 'list', '--installed'], { cwd: options.output }, 'rustup targets')
  if (!targets.split(/\r?\n/).includes(WASM_TARGET)) fail(`Rust target ${WASM_TARGET} is not installed`)

  const stagedAbi = await stageAbi(options.output, options.source)
  const targetDirectory = join(options.output, 'cargo-target')
  const env = {
    ...process.env,
    CARGO_BUILD_JOBS: String(CARGO_JOBS),
    CARGO_TARGET_DIR: targetDirectory,
    CARGO_INCREMENTAL: '0',
    RUSTFLAGS: `${remapPathPrefixes(options.source, options.output)} --cap-lints=warn -C panic=abort -C link-arg=--max-memory=${MAX_MEMORY_BYTES}`,
  }
  delete env.CARGO_ENCODED_RUSTFLAGS
  run('bash', [
    '-lc',
    `ulimit -v ${CARGO_VIRTUAL_MEMORY_KB} && exec nice cargo build --manifest-path ${JSON.stringify(join(stagedAbi, 'Cargo.toml'))} --target ${WASM_TARGET} --release --locked --jobs ${CARGO_JOBS}`,
  ], { cwd: options.output, env, stdio: 'inherit' }, 'ncollide2d wasm cargo build')

  const rawWasm = join(targetDirectory, WASM_TARGET, 'release', 'ncollide2d_headless.wasm')
  await requireFile(rawWasm, 'compiled ncollide2d WASM')
  const promoted = join(options.output, EXPECTED.name)
  await copyFile(rawWasm, promoted)
  const artifact = await verifyWasm(promoted, options.recordArtifact)
  if (options.recordArtifact) await writeLedger(artifact)
  if (options.install) {
    await mkdir(publicArtifactDirectory, { recursive: true })
    await copyFile(promoted, join(publicArtifactDirectory, EXPECTED.name))
    await copyFile(join(scriptDirectory, 'NOTICE.md'), join(publicArtifactDirectory, 'NOTICE.md'))
  }

  const finalStatus = run('git', ['-C', options.source, 'status', '--porcelain=v1'], { cwd: options.output }, 'ncollide status after build').trim()
  if (finalStatus.length > 0) fail('pinned source checkout changed during the build')
  console.log(JSON.stringify({
    status: 'PASS',
    sourceRevision: SOURCE_REVISION,
    output: options.output,
    wasm: { name: EXPECTED.name, ...artifact },
    cargoJobs: CARGO_JOBS,
    maxMemoryBytes: MAX_MEMORY_BYTES,
    virtualMemoryKb: CARGO_VIRTUAL_MEMORY_KB,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
