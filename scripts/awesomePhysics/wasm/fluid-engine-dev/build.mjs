#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_REVISION = '94c300ff5ad8a2f588e5e27e8e9746a424b29863'
const EMSCRIPTEN_VERSION = '6.0.6-git'
const EMSCRIPTEN_REVISION = 'ce75e06884093bcefb86a6b8fd56a5d62a4cc245'
const EMSCRIPTEN_TOOLCHAIN_SHA256 = 'fdca7d6b6ebe9c087aa7f0a0c7391b0b83fdb081160158f65aa1182cdc964718'
const COMPILE_MEMORY_MAX_KB = 12 * 1024 * 1024
const START_MEMORY_MIN_BYTES = 4 * 1024 * 1024 * 1024
const MAX_MEMORY_BYTES = 134217728
const MAX_ARTIFACT_BYTES = 67108864
const ARTIFACT = Object.freeze({
  name: 'fluid-engine-dev.wasm',
  byteSize: 230684,
  sha256: 'd8bdd5c4841ab009e0b008cacbee88660c09bf8906714c388decd548934e389e',
})
const GOLDEN = Object.freeze({
  step0: 1,
  step1: 0.9972777962684631,
  step60: -3.981663703918457,
})
const ABI_EXPORTS = Object.freeze(['jet_sph2_step', '_initialize'])
const JET_SOURCES = Object.freeze([
  'src/jet/animation.cpp',
  'src/jet/physics_animation.cpp',
  'src/jet/parallel.cpp',
  'src/jet/logging.cpp',
  'src/jet/timer.cpp',
  'src/jet/sph_solver2.cpp',
  'src/jet/sph_system_data2.cpp',
  'src/jet/particle_system_solver2.cpp',
  'src/jet/particle_system_data2.cpp',
  'src/jet/constant_vector_field2.cpp',
  'src/jet/vector_field2.cpp',
  'src/jet/field2.cpp',
  'src/jet/collider2.cpp',
  'src/jet/particle_emitter2.cpp',
  'src/jet/point_parallel_hash_grid_searcher2.cpp',
  'src/jet/point_neighbor_searcher2.cpp',
  'src/jet/triangle_point_generator.cpp',
  'src/jet/point_generator2.cpp',
  'src/jet/surface2.cpp',
])

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const defaultSource = resolve(projectRoot, '../awesome-physics-repos/fluid-engine-dev')
const defaultEmscriptenRoot = process.env.EMSCRIPTEN_ROOT ?? '/usr/lib/emscripten'

function fail(message) {
  throw new Error(`fluid-engine-dev WASM build failed: ${message}`)
}

function usage() {
  return [
    'Usage: node scripts/awesomePhysics/wasm/fluid-engine-dev/build.mjs --output <empty out-of-tree-dir> [options]',
    '',
    'Options:',
    `  --source <dir>             Pinned fluid-engine-dev checkout (default: ${defaultSource})`,
    '  --output <dir>             Empty out-of-tree build/output directory (required)',
    `  --emscripten-root <dir>    Pinned Emscripten root (default: ${defaultEmscriptenRoot})`,
    '  --em-cache <dir>           Pinned Emscripten cache (or EM_CACHE)',
    '  --record-artifact          Record size/hash instead of requiring a pinned digest',
    '  --install                  Copy the verified module and NOTICE into public/wasm',
    '  --help                     Show this help',
  ].join('\n')
}

function parseArguments(argv) {
  const values = {
    source: process.env.FLUID_ENGINE_DEV_SOURCE ?? defaultSource,
    output: undefined,
    emscriptenRoot: defaultEmscriptenRoot,
    emCache: process.env.EM_CACHE,
    recordArtifact: false,
    install: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help') {
      console.log(usage())
      process.exit(0)
    }
    if (argument === '--record-artifact') {
      values.recordArtifact = true
      continue
    }
    if (argument === '--install') {
      values.install = true
      continue
    }
    const option = {
      '--source': 'source',
      '--output': 'output',
      '--emscripten-root': 'emscriptenRoot',
      '--em-cache': 'emCache',
    }[argument]
    if (option === undefined) fail(`unknown option ${argument}\n${usage()}`)
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) fail(`${argument} requires a value`)
    values[option] = value
    index += 1
  }
  if (values.output === undefined) fail(`--output is required\n${usage()}`)
  return {
    source: resolve(values.source),
    output: resolve(values.output),
    emscriptenRoot: resolve(values.emscriptenRoot),
    emCache: values.emCache === undefined ? undefined : resolve(values.emCache),
    recordArtifact: values.recordArtifact,
    install: values.install,
  }
}

function capture(command, args, options, label) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.error) fail(`${label}: ${result.error.message}`)
  if (result.status !== 0) fail(`${label}: exited with status ${result.status}: ${result.stderr.trim()}`)
  return result.stdout
}

function run(command, args, options, label) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: 'inherit',
  })
  if (result.error) fail(`${label}: ${result.error.message}`)
  if (result.status !== 0) fail(`${label}: exited with status ${result.status}`)
}

function memAvailableBytes() {
  const text = spawnSync('awk', ['/MemAvailable:/ { print $2 }', '/proc/meminfo'], { encoding: 'utf8' })
  if (text.status !== 0) fail('cannot read MemAvailable')
  return Number(text.stdout.trim()) * 1024
}

function isInside(parent, child) {
  const path = relative(parent, child)
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path))
}

function cmakePath(path) {
  return path.replaceAll('\\', '/')
}

function closeEnough(actual, expected, label) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1e-6) {
    fail(`${label} returned ${actual}, expected ${expected}`)
  }
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
  if (!details.isFile()) fail(`${label} is not a regular file: ${path}`)
}

async function sha256(path) {
  const bytes = await readFile(path)
  return {
    byteSize: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

function cmakeDriver(source, factorySource, buildDirectory) {
  const sourcePath = cmakePath(source)
  const factoryPath = cmakePath(factorySource)
  const archivePath = cmakePath(buildDirectory)
  const units = JET_SOURCES.map((file) => `  "${sourcePath}/${file}"`).join('\n')
  return `cmake_minimum_required(VERSION 3.10)
project(JetSph2Headless LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY "${archivePath}/lib")
add_library(jet_sph2 STATIC
${units}
  "${factoryPath}"
)
target_include_directories(jet_sph2 PRIVATE
  "${sourcePath}/include"
  "${sourcePath}/src/jet"
  "${sourcePath}/src/jet/3rdparty"
)
target_compile_options(jet_sph2 PRIVATE
  -O2
  -DNDEBUG
  -fwasm-exceptions
  -fno-openmp
  -include sys/types.h
  -ffile-prefix-map=${sourcePath}=/jet-source
)
`
}

function wasmImports(runtime) {
  const nop = () => 0
  const memoryView = () => new DataView(runtime.memory.buffer)
  const writeU32 = (ptr, value) => { memoryView().setUint32(ptr, value, true) }
  const writeU64 = (ptr, value) => { memoryView().setBigUint64(ptr, BigInt(value), true) }
  return {
    env: {
      emscripten_notify_memory_growth: nop,
    },
    wasi_snapshot_preview1: {
      clock_time_get(_clock, _precision, ptr) {
        writeU64(ptr, 0)
        return 0
      },
      environ_sizes_get(countPtr, sizePtr) {
        writeU32(countPtr, 0)
        writeU32(sizePtr, 0)
        return 0
      },
      environ_get: nop,
      fd_close: nop,
      fd_seek: nop,
      fd_write(_fd, iovs, iovsLen, nwrittenPtr) {
        let written = 0
        const bytes = memoryView()
        for (let index = 0; index < iovsLen; index += 1) {
          written += bytes.getUint32(iovs + index * 8 + 4, true)
        }
        writeU32(nwrittenPtr, written)
        return 0
      },
      fd_read: nop,
    },
  }
}

async function verifyWasm(path, recordArtifact) {
  const bytes = await readFile(path)
  const digest = createHash('sha256').update(bytes).digest('hex')
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) {
    fail(`WASM size ${bytes.byteLength} exceeds the ${MAX_ARTIFACT_BYTES}-byte artifact cap`)
  }
  if (!recordArtifact) {
    if (ARTIFACT.byteSize === 0) fail('pinned artifact digest is unset; rebuild with --record-artifact')
    if (bytes.byteLength !== ARTIFACT.byteSize || digest !== ARTIFACT.sha256) {
      fail(`WASM differs: expected ${ARTIFACT.byteSize} bytes/${ARTIFACT.sha256}, got ${bytes.byteLength} bytes/${digest}`)
    }
  }
  const module = await WebAssembly.compile(bytes)
  const exports = WebAssembly.Module.exports(module).map(({ name }) => name)
  for (const name of ABI_EXPORTS) {
    if (!exports.includes(name)) fail(`WASM is missing ABI export ${name}`)
  }
  const runtime = { memory: null }
  const availableImports = wasmImports(runtime)
  const imports = {}
  for (const entry of WebAssembly.Module.imports(module)) {
    const table = availableImports[entry.module]
    if (table === undefined || table[entry.name] === undefined) {
      fail(`WASM import ${entry.module}.${entry.name} is not in the local adapter set`)
    }
    imports[entry.module] ??= {}
    imports[entry.module][entry.name] = table[entry.name]
  }
  const instance = await WebAssembly.instantiate(module, imports)
  runtime.memory = instance.exports.memory
  if (typeof instance.exports._initialize === 'function') instance.exports._initialize()
  const step = instance.exports.jet_sph2_step
  if (typeof step !== 'function') fail('jet_sph2_step is not a function')
  const y0 = step(0)
  const y1 = step(1)
  const y60 = step(60)
  closeEnough(y0, GOLDEN.step0, 'jet_sph2_step(0)')
  closeEnough(y1, GOLDEN.step1, 'jet_sph2_step(1)')
  closeEnough(y60, GOLDEN.step60, 'jet_sph2_step(60)')
  if (Number.isFinite(step(601))) fail('jet_sph2_step(601) must be rejected')
  if (instance.exports.memory.buffer.byteLength > MAX_MEMORY_BYTES) {
    fail(`WASM linear memory is ${instance.exports.memory.buffer.byteLength}, above the ${MAX_MEMORY_BYTES}-byte cap`)
  }
  return { byteSize: bytes.byteLength, sha256: digest, y0, y1 }
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const source = options.source
  const output = options.output
  const emscriptenRoot = options.emscriptenRoot
  const emcc = join(emscriptenRoot, 'emcc')
  const emxx = join(emscriptenRoot, 'em++')
  const emconfig = join(emscriptenRoot, 'em-config')
  const toolchain = join(emscriptenRoot, 'cmake/Modules/Platform/Emscripten.cmake')
  const abiSource = join(scriptDirectory, 'jet_sph2_abi.cpp')
  const factorySource = join(scriptDirectory, 'factory_sph2.cpp')

  const available = memAvailableBytes()
  if (available < START_MEMORY_MIN_BYTES) fail(`MemAvailable ${available} bytes is below the ${START_MEMORY_MIN_BYTES}-byte start gate`)

  await requireDirectory(source, 'fluid-engine-dev source checkout')
  await requireFile(join(source, 'LICENSE.md'), 'Jet MIT license')
  for (const file of JET_SOURCES) await requireFile(join(source, file), file)
  await requireFile(abiSource, 'ABI source')
  await requireFile(factorySource, '2D Factory façade')
  await requireDirectory(emscriptenRoot, 'Emscripten root')
  await requireFile(emcc, 'Emscripten C compiler')
  await requireFile(emxx, 'Emscripten C++ compiler')
  await requireFile(emconfig, 'Emscripten configuration tool')
  await requireFile(toolchain, 'Emscripten CMake toolchain')
  if (isInside(source, output) || isInside(output, source)) fail(`source and output must be separate: ${source} / ${output}`)

  const outputEntries = await (async () => {
    try {
      return await readdir(output)
    } catch (error) {
      if (error.code !== 'ENOENT') fail(`cannot inspect output directory ${output}: ${error.message}`)
      return []
    }
  })()
  if (outputEntries.length > 0) fail(`output directory must be empty: ${output}`)
  await mkdir(output, { recursive: true })

  const env = {
    ...process.env,
    PATH: `${emscriptenRoot}:${process.env.PATH ?? ''}`,
  }
  const commandOptions = { cwd: output, env }
  const emCache = options.emCache ?? capture(emconfig, ['CACHE'], commandOptions, 'Emscripten cache path').trim()
  await requireDirectory(emCache, 'Emscripten cache')
  env.EM_CACHE = emCache

  const emccVersion = capture(emcc, ['--version'], commandOptions, 'Emscripten version')
  if (!emccVersion.includes(EMSCRIPTEN_VERSION) || !emccVersion.includes(EMSCRIPTEN_REVISION)) {
    fail(`Emscripten must be ${EMSCRIPTEN_VERSION} revision ${EMSCRIPTEN_REVISION}`)
  }
  const toolchainIntegrity = await sha256(toolchain)
  if (toolchainIntegrity.sha256 !== EMSCRIPTEN_TOOLCHAIN_SHA256) {
    fail(`Emscripten CMake toolchain hash differs: expected ${EMSCRIPTEN_TOOLCHAIN_SHA256}, got ${toolchainIntegrity.sha256}`)
  }

  const head = capture('git', ['-C', source, 'rev-parse', 'HEAD'], commandOptions, 'fluid-engine-dev revision').trim()
  if (head !== SOURCE_REVISION) fail(`source revision is ${head}, expected ${SOURCE_REVISION}`)
  const status = capture('git', ['-C', source, 'status', '--porcelain=v1'], commandOptions, 'fluid-engine-dev status').trim()
  if (status.length > 0) fail(`source checkout is not clean:\n${status}`)

  const driverDirectory = join(output, 'cmake-driver')
  const buildDirectory = join(output, 'jet-build')
  const staticLibrary = join(buildDirectory, 'lib/libjet_sph2.a')
  const wasmPath = join(output, ARTIFACT.name)
  await mkdir(driverDirectory, { recursive: true })
  await writeFile(join(driverDirectory, 'CMakeLists.txt'), cmakeDriver(source, factorySource, buildDirectory), 'utf8')

  run('bash', ['--noprofile', '--norc', '-c', `ulimit -v ${COMPILE_MEMORY_MAX_KB} && exec nice cmake -S ${JSON.stringify(driverDirectory)} -B ${JSON.stringify(buildDirectory)} -G Ninja -DCMAKE_TOOLCHAIN_FILE=${JSON.stringify(toolchain)} -DCMAKE_BUILD_TYPE=Release`], commandOptions, 'CMake configure')
  run('bash', ['--noprofile', '--norc', '-c', `ulimit -v ${COMPILE_MEMORY_MAX_KB} && exec nice cmake --build ${JSON.stringify(buildDirectory)} --parallel 4 --config Release`], commandOptions, 'Jet 2D SPH static-library build')
  await requireFile(staticLibrary, 'out-of-tree Jet SPH static library')

  run('bash', ['--noprofile', '--norc', '-c', [
    `ulimit -v ${COMPILE_MEMORY_MAX_KB} && exec nice`,
    JSON.stringify(emxx),
    '-std=c++11 -O2 -DNDEBUG -fwasm-exceptions -fno-openmp -include sys/types.h',
    `-I${JSON.stringify(join(source, 'include'))}`,
    `-I${JSON.stringify(join(source, 'src/jet'))}`,
    `-I${JSON.stringify(join(source, 'src/jet/3rdparty'))}`,
    `--no-entry -sSTANDALONE_WASM=1`,
    `-sEXPORTED_FUNCTIONS=["_jet_sph2_step"]`,
    '-sERROR_ON_UNDEFINED_SYMBOLS=1',
    '-sALLOW_MEMORY_GROWTH=1',
    `-sMAXIMUM_MEMORY=${MAX_MEMORY_BYTES}`,
    '-sINITIAL_MEMORY=16777216',
    '-sASSERTIONS=0',
    JSON.stringify(abiSource),
    JSON.stringify(staticLibrary),
    '-o', JSON.stringify(wasmPath),
  ].join(' ')], commandOptions, 'standalone WASM link')

  const artifact = await verifyWasm(wasmPath, options.recordArtifact)
  if (options.recordArtifact) {
    await writeFile(join(scriptDirectory, 'build-ledger.json'), `${JSON.stringify({
      schemaVersion: 1,
      artifact: { name: ARTIFACT.name, path: `wasm/awesomePhysics/fluid-engine-dev/${ARTIFACT.name}`, ...artifact },
      source: { checkout: 'awesome-physics-repos/fluid-engine-dev', revision: SOURCE_REVISION },
      golden: GOLDEN,
      toolchain: { emscripten: EMSCRIPTEN_VERSION, revision: EMSCRIPTEN_REVISION, maxMemoryBytes: MAX_MEMORY_BYTES },
    }, null, 2)}\n`)
  }
  if (options.install) {
    const publicRoot = join(projectRoot, 'public/wasm/awesomePhysics/fluid-engine-dev')
    await mkdir(publicRoot, { recursive: true })
    await copyFile(wasmPath, join(publicRoot, ARTIFACT.name))
    await copyFile(join(scriptDirectory, 'NOTICE.md'), join(publicRoot, 'NOTICE.md'))
  }
  const finalStatus = capture('git', ['-C', source, 'status', '--porcelain=v1'], commandOptions, 'fluid-engine-dev status after build').trim()
  if (finalStatus.length > 0) fail('pinned source checkout changed during the build')
  console.log(JSON.stringify({
    status: 'PASS',
    sourceRevision: SOURCE_REVISION,
    output,
    wasm: { name: ARTIFACT.name, ...artifact },
    maxMemoryBytes: MAX_MEMORY_BYTES,
    maxArtifactBytes: MAX_ARTIFACT_BYTES,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
