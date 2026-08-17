#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_REVISION = '6287ce6d9223d1d79d28b2c26f37499f45b445b8'
const CHIPMUNK_REVISION = '47b0e6b200c1aedb7b9ee09a998a2ef0bbad8f82'
const EMSCRIPTEN_VERSION = '6.0.6-git'
const EMSCRIPTEN_REVISION = 'ce75e06884093bcefb86a6b8fd56a5d62a4cc245'
const MAX_MEMORY_BYTES = 134217728
const INITIAL_MEMORY_BYTES = 16 * 1024 * 1024
const COMPILE_VIRTUAL_MEMORY_KB = 4 * 1024 * 1024
const HOST_PATH_NEEDLES = Object.freeze(['/home/braulio', '/tmp/opencode'])
const ABI_EXPORTS = Object.freeze(['pymunk_version', 'pymunk_step', 'pymunk_x', 'pymunk_angle', 'pymunk_steps'])
const EXPECTED = Object.freeze({
  name: 'pymunk.wasm',
  byteSize: 76555,
  sha256: '0166b68c54e17b3892ca675749afdc065806e8df5636fc55e89d8d4badb67158',
})

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '../../../../')
const persistRoot = resolve(repositoryRoot, '.wasm-build')
const publicArtifactDirectory = resolve(repositoryRoot, 'public/wasm/awesomePhysics/pymunk')
const abiSource = resolve(scriptDirectory, 'abi/pymunk_headless.c')
const defaultSource = resolve(repositoryRoot, '../awesome-physics-repos/pymunk')
const defaultEmscriptenRoot = process.env.EMSCRIPTEN_ROOT ?? '/usr/lib/emscripten'
const munk2dUrl = 'https://github.com/viblo/Munk2D.git'

function fail(message) {
  throw new Error(`pymunk WASM build rejected: ${message}`)
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
  const supported = new Set(['--source', '--output', '--emscripten-root', '--em-cache', '--record-artifact', '--install'])
  for (const argument of argumentsList) {
    if (argument.startsWith('--') && !supported.has(argument)) fail(`unsupported option ${argument}`)
  }
  const source = resolve(optionValue(argumentsList, '--source') ?? defaultSource)
  const outputArgument = optionValue(argumentsList, '--output')
  if (outputArgument === null) fail('--output must identify a new or empty persist directory under .wasm-build')
  return {
    source,
    output: resolve(outputArgument),
    emscriptenRoot: resolve(optionValue(argumentsList, '--emscripten-root') ?? defaultEmscriptenRoot),
    emCache: optionValue(argumentsList, '--em-cache'),
    recordArtifact: argumentsList.includes('--record-artifact'),
    install: argumentsList.includes('--install'),
  }
}

function run(command, argumentsList, options, label) {
  const result = spawnSync(command, argumentsList, {
    cwd: options.cwd,
    env: options.env,
    stdio: options.stdio ?? 'inherit',
    encoding: options.encoding,
  })
  if (result.error) fail(`${label}: ${result.error.message}`)
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim()
    fail(`${label} failed${detail ? `: ${detail}` : ''}`)
  }
  return result.stdout ?? ''
}

function capture(command, argumentsList, options, label) {
  return run(command, argumentsList, { ...options, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }, label)
}

async function ensureEmptyOutput(output, source) {
  if (inside(source, output)) fail('output must be outside the pinned source checkout')
  if (inside(publicArtifactDirectory, output)) fail('output must not overwrite the public artifact directory')
  if (inside(repositoryRoot, output) && !inside(persistRoot, output)) {
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

async function sourceRevisionAndStatus(source, options) {
  const status = capture('git', ['-C', source, 'status', '--porcelain', '--untracked-files=all'], options, 'pymunk status').trim()
  if (status.length > 0) fail('pinned source checkout is dirty')
  const revision = capture('git', ['-C', source, 'rev-parse', 'HEAD'], options, 'pymunk revision').trim()
  if (revision !== SOURCE_REVISION) fail(`source revision is ${revision}, expected ${SOURCE_REVISION}`)
  const gitlink = capture('git', ['-C', source, 'ls-tree', 'HEAD', 'Munk2D'], options, 'Munk2D gitlink').trim()
  if (!gitlink.includes(CHIPMUNK_REVISION)) fail(`Munk2D gitlink is ${gitlink}, expected ${CHIPMUNK_REVISION}`)
}

function assertNoHostPaths(bytes, label) {
  const text = Buffer.from(bytes).toString('latin1')
  const hits = HOST_PATH_NEEDLES.filter((needle) => text.includes(needle))
  if (hits.length > 0) fail(`${label} embeds host paths: ${hits.join(', ')}`)
}

async function verifyArtifact(path, recordArtifact) {
  const bytes = await readFile(path)
  const digest = sha256(bytes)
  if (!recordArtifact) {
    if (bytes.byteLength !== EXPECTED.byteSize) fail(`WASM size is ${bytes.byteLength}, expected ${EXPECTED.byteSize}`)
    if (digest !== EXPECTED.sha256) fail(`WASM SHA-256 is ${digest}, expected ${EXPECTED.sha256}`)
  }
  assertNoHostPaths(bytes, 'pymunk WASM')
  return { bytes, digest, byteSize: bytes.byteLength }
}

function createWasmImports() {
  return {
    env: {
      _abort_js() {
        throw new Error('pymunk WASM aborted')
      },
      emscripten_resize_heap() {
        return 0
      },
    },
    wasi_snapshot_preview1: {
      fd_close() {
        return 0
      },
      fd_seek() {
        return 0
      },
      fd_write() {
        return 0
      },
    },
  }
}

async function verifyAbi(wasmPath, recordArtifact) {
  const artifact = await verifyArtifact(wasmPath, recordArtifact)
  const module = await WebAssembly.compile(artifact.bytes)
  const exports = WebAssembly.Module.exports(module).map(({ name }) => name)
  for (const name of ABI_EXPORTS) {
    if (!exports.includes(name)) fail(`WASM is missing ABI export ${name}`)
  }
  const imports = WebAssembly.Module.imports(module)
  const instance = await WebAssembly.instantiate(module, createWasmImports())
  const wasmExports = instance.exports
  if (typeof wasmExports.__wasm_call_ctors === 'function') wasmExports.__wasm_call_ctors()
  for (const name of ABI_EXPORTS) {
    if (typeof wasmExports[name] !== 'function') fail(`WASM export ${name} has the wrong type`)
  }
  if (wasmExports.pymunk_version() !== 730) fail(`pymunk_version returned ${wasmExports.pymunk_version()}`)
  const initialY = wasmExports.pymunk_step(0)
  const initialX = wasmExports.pymunk_x()
  const initialAngle = wasmExports.pymunk_angle()
  if (!Number.isFinite(initialY) || Math.abs(initialY - 2) > 1e-5) fail(`initial y drifted: ${initialY}`)
  if (!Number.isFinite(initialX) || Math.abs(initialX) > 1e-5) fail(`initial x drifted: ${initialX}`)
  if (!Number.isFinite(initialAngle) || Math.abs(initialAngle) > 1e-5) fail(`initial angle drifted: ${initialAngle}`)
  const falling = wasmExports.pymunk_step(15)
  if (!Number.isFinite(falling) || falling >= 2 || falling <= 1) fail(`falling y drifted: ${falling}`)
  const settled = wasmExports.pymunk_step(600)
  if (!Number.isFinite(settled) || settled <= 0.3 || settled >= 0.7) fail(`settled y drifted: ${settled}`)
  const rejected = wasmExports.pymunk_step(601)
  assert.equal(Number.isNaN(rejected), true)
  return {
    wasm: { path: wasmPath, name: EXPECTED.name, byteSize: artifact.byteSize, sha256: artifact.digest },
    imports: imports.map((entry) => `${entry.module}.${entry.name}`).sort(),
    exports,
  }
}

async function cloneMunk2D(output, options) {
  const munk2d = join(output, 'munk2d')
  run('git', ['clone', '--quiet', munk2dUrl, munk2d], options, 'Munk2D clone')
  run('git', ['-C', munk2d, 'checkout', '--quiet', CHIPMUNK_REVISION], options, 'Munk2D checkout')
  const head = capture('git', ['-C', munk2d, 'rev-parse', 'HEAD'], options, 'Munk2D revision').trim()
  if (head !== CHIPMUNK_REVISION) fail(`Munk2D revision is ${head}, expected ${CHIPMUNK_REVISION}`)
  const sourcesDirectory = join(munk2d, 'src')
  const includeDirectory = join(munk2d, 'include')
  const entries = await readdir(sourcesDirectory)
  const sources = entries
    .filter((name) => name.endsWith('.c') && name !== 'cpHastySpace.c')
    .map((name) => join(sourcesDirectory, name))
    .sort()
  if (sources.length < 8) fail(`Munk2D src yielded too few C files: ${sources.length}`)
  return { munk2d, includeDirectory, sources }
}

async function installPublicArtifacts(wasmPath, noticePath) {
  await mkdir(publicArtifactDirectory, { recursive: true })
  await copyFile(wasmPath, join(publicArtifactDirectory, EXPECTED.name))
  await copyFile(noticePath, join(publicArtifactDirectory, 'NOTICE.md'))
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  const { source, output, emscriptenRoot, recordArtifact, install } = options
  const emcc = join(emscriptenRoot, 'emcc')
  const emconfig = join(emscriptenRoot, 'em-config')
  await ensureEmptyOutput(output, source)
  const tmpDirectory = join(output, 'tmp')
  await mkdir(tmpDirectory, { recursive: true })
  const env = {
    ...process.env,
    PATH: `${emscriptenRoot}:${process.env.PATH ?? ''}`,
    TMPDIR: tmpDirectory,
    TMP: tmpDirectory,
    TEMP: tmpDirectory,
    GIT_OPTIONAL_LOCKS: '0',
  }
  const commandOptions = { cwd: output, env }
  await sourceRevisionAndStatus(source, commandOptions)
  const emCache = options.emCache ?? capture(emconfig, ['CACHE'], commandOptions, 'Emscripten cache').trim()
  env.EM_CACHE = emCache
  const emccVersion = capture(emcc, ['--version'], commandOptions, 'Emscripten version')
  if (!emccVersion.includes(EMSCRIPTEN_VERSION) || !emccVersion.includes(EMSCRIPTEN_REVISION)) {
    fail(`Emscripten must be ${EMSCRIPTEN_VERSION} revision ${EMSCRIPTEN_REVISION}`)
  }

  const { includeDirectory, sources } = await cloneMunk2D(output, commandOptions)
  const linkDirectory = join(output, 'link')
  const generatedDirectory = join(output, 'generated')
  await mkdir(linkDirectory, { recursive: true })
  await mkdir(generatedDirectory, { recursive: true })
  const linkJavaScript = join(linkDirectory, 'pymunk.js')
  const linkWasm = join(linkDirectory, EXPECTED.name)
  const exportedFunctions = `[${ABI_EXPORTS.map((name) => `"_${name}"`).join(',')}]`
  run('nice', [
    '-n', '10',
    emcc,
    '-O2',
    '-std=c99',
    '-DNDEBUG',
    `-I${includeDirectory}`,
    `-ffile-prefix-map=${source}=/src/pymunk`,
    `-ffile-prefix-map=${output}=/build/pymunk`,
    `-ffile-prefix-map=${repositoryRoot}=/opensimphy`,
    '-s', 'MODULARIZE=1',
    '-s', 'EXPORT_ES6=1',
    '-s', 'ENVIRONMENT=web,node',
    '-s', 'ASSERTIONS=0',
    '-s', 'ALLOW_MEMORY_GROWTH=1',
    `-sINITIAL_MEMORY=${INITIAL_MEMORY_BYTES}`,
    `-sMAXIMUM_MEMORY=${MAX_MEMORY_BYTES}`,
    `-sEXPORTED_FUNCTIONS=${exportedFunctions}`,
    '-s', 'EXPORTED_RUNTIME_METHODS=[]',
    '-o', linkJavaScript,
    abiSource,
    ...sources,
  ], commandOptions, 'pymunk Chipmunk ABI link')

  const wasmPath = join(generatedDirectory, EXPECTED.name)
  await copyFile(linkWasm, wasmPath)
  const verified = await verifyAbi(wasmPath, recordArtifact)
  const noticePath = join(scriptDirectory, 'NOTICE.md')
  if (install) await installPublicArtifacts(wasmPath, noticePath)

  const finalStatus = capture('git', ['-C', source, 'status', '--porcelain', '--untracked-files=all'], commandOptions, 'pymunk final status').trim()
  if (finalStatus.length > 0) fail('pinned source checkout changed during the build')
  await writeFile(join(generatedDirectory, 'build-report.json'), `${JSON.stringify({
    status: 'PASS',
    sourceRevision: SOURCE_REVISION,
    chipmunkRevision: CHIPMUNK_REVISION,
    output: generatedDirectory,
    hostPaths: 'absent',
    wasm: verified.wasm,
    imports: verified.imports,
    exports: verified.exports,
    maxMemoryBytes: MAX_MEMORY_BYTES,
    virtualMemoryKb: COMPILE_VIRTUAL_MEMORY_KB,
  }, null, 2)}\n`)
  console.log(JSON.stringify({
    status: 'PASS',
    sourceRevision: SOURCE_REVISION,
    chipmunkRevision: CHIPMUNK_REVISION,
    output: generatedDirectory,
    hostPaths: 'absent',
    wasm: verified.wasm,
    imports: verified.imports,
    maxMemoryBytes: MAX_MEMORY_BYTES,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
