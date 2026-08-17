import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_REVISION_FULL = 'a9c460c3509c935e65c5b1196b955d56627c3ffa'
const SOURCE_REVISION = SOURCE_REVISION_FULL.slice(0, 12)
const EMSCRIPTEN_VERSION = '6.0.6-git'
const EMSCRIPTEN_REVISION = 'ce75e06884093bcefb86a6b8fd56a5d62a4cc245'
const COMPILE_MEMORY_MAX_BYTES = 12 * 1024 * 1024 * 1024
const START_MEMORY_MIN_BYTES = 4 * 1024 * 1024 * 1024
const RUNTIME_MEMORY_BYTES = 268435456
const ARTIFACT_NAME = 'newton-dynamics.wasm'
const EXPECTED_EXPORTS = Object.freeze([
  '__indirect_function_table',
  '__wasm_call_ctors',
  'newton_step',
  'newton_version',
  'memory',
])

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const defaultSource = resolve(projectRoot, '../awesome-physics-repos/newton-dynamics')
const defaultToolchain = '/usr/lib/emscripten/cmake/Modules/Platform/Emscripten.cmake'
const abiSource = join(dirname(fileURLToPath(import.meta.url)), 'newton_abi.cpp')

function fail(message) {
  throw new Error(`Newton WASM build failed: ${message}`)
}

function usage() {
  return [
    'Usage: node scripts/awesomePhysics/wasm/newton-dynamics/build.mjs --output <empty out-of-tree-dir> [options]',
    '',
    'Options:',
    `  --source <dir>       Pinned newton-dynamics checkout (default: ${defaultSource})`,
    '  --output <dir>       Empty out-of-tree build/output directory (required)',
    '  --em-cache <dir>     Pinned Emscripten cache (or EM_CACHE)',
    `  --toolchain <file>   Emscripten CMake toolchain file (default: ${defaultToolchain})`,
    '  --help               Show this help',
  ].join('\n')
}

function parseArguments(argv) {
  const values = {
    source: process.env.NEWTON_SOURCE ?? defaultSource,
    output: undefined,
    emCache: process.env.EM_CACHE,
    toolchain: process.env.EMSCRIPTEN_TOOLCHAIN_FILE ?? defaultToolchain,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help') {
      console.log(usage())
      process.exit(0)
    }
    const option = {
      '--source': 'source',
      '--output': 'output',
      '--em-cache': 'emCache',
      '--toolchain': 'toolchain',
    }[argument]
    if (option === undefined) fail(`unknown option ${argument}\n${usage()}`)
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) fail(`${argument} requires a value`)
    values[option] = value
    index += 1
  }
  if (values.output === undefined) fail(`--output is required\n${usage()}`)
  if (values.emCache === undefined) fail('--em-cache or EM_CACHE is required')
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, resolve(value)]))
}

function memAvailableBytes() {
  const text = spawnSync('awk', ['/MemAvailable:/ { print $2 }', '/proc/meminfo'], { encoding: 'utf8' })
  if (text.status !== 0) fail('cannot read MemAvailable')
  return Number(text.stdout.trim()) * 1024
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

function isInside(parent, child) {
  const path = relative(parent, child)
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path))
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

async function sha256(path) {
  const bytes = await readFile(path)
  return {
    byteSize: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

async function assertSourceClean(source, gitOptions, label) {
  const head = capture('git', ['-C', source, 'rev-parse', 'HEAD'], gitOptions, `${label} revision`).trim()
  if (head !== SOURCE_REVISION_FULL || !head.startsWith(SOURCE_REVISION)) {
    fail(`${label} is at ${head}, expected ${SOURCE_REVISION_FULL}`)
  }
  const status = capture('git', ['-C', source, 'status', '--porcelain=v1'], gitOptions, `${label} status`).trim()
  if (status.length > 0) fail(`${label} is not clean:\n${status}`)
}

function cmakePath(path) {
  return path.replaceAll('\\', '/')
}

const HEIGHTFIELD_CEILING_NEEDLE = 'boxP1 = (invScale * (p1 + scale).Ceiling()) * scale;'
const HEIGHTFIELD_CEILING_REPLACEMENT = 'boxP1 = (invScale * ndVector(ndCeil((p1 + scale).m_x), ndCeil((p1 + scale).m_y), ndCeil((p1 + scale).m_z), ndCeil((p1 + scale).m_w))) * scale;'

async function writeClangCompatSources(source, output) {
  const original = join(source, 'newton-4.00/sdk/dCollision/ndShapeHeightfield.cpp')
  const destDir = join(output, 'clang-compat')
  await mkdir(destDir, { recursive: true })
  const text = await readFile(original, 'utf8')
  if (!text.includes(HEIGHTFIELD_CEILING_NEEDLE)) fail('ndShapeHeightfield.cpp no longer has the expected Ceiling call')
  const dest = join(destDir, 'ndShapeHeightfield.cpp')
  await writeFile(dest, text.replace(HEIGHTFIELD_CEILING_NEEDLE, HEIGHTFIELD_CEILING_REPLACEMENT), 'utf8')
  return dest
}

function cmakeDriver(sdk, heightfieldSource) {
  const root = cmakePath(sdk)
  const hacd = `${root}/dDependencies/hacd/src/VHACD_Lib`
  return `cmake_minimum_required(VERSION 3.10)
project(NewtonHeadless LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
add_definitions(
  -DD_SCALAR_VECTOR_CLASS
  -DD_USE_THREAD_EMULATION
  -D_D_SINGLE_LIBRARY
  -DNDEBUG
  -DFE_INVALID=1
  -DFE_DIVBYZERO=4
  -DFE_INEXACT=32
)
include_directories(
  "${root}/dCore"
  "${root}/dCore/tinyxml"
  "${root}/dNewton"
  "${root}/dNewton/dJoints"
  "${root}/dNewton/dModels"
  "${root}/dNewton/dIkSolver"
  "${root}/dNewton/dModels/dVehicle"
  "${root}/dCollision"
  "${root}/dCollision/dMesh"
  "${hacd}/public"
  "${hacd}/inc"
)
file(GLOB_RECURSE ND_SOURCES
  "${root}/dCore/*.cpp"
  "${root}/dCollision/*.cpp"
  "${root}/dNewton/*.cpp"
  "${hacd}/src/*.cpp"
)
list(FILTER ND_SOURCES EXCLUDE REGEX "/dExtensions/")
list(FILTER ND_SOURCES EXCLUDE REGEX "/ndShapeHeightfield\\.cpp$")
list(APPEND ND_SOURCES "${cmakePath(heightfieldSource)}")
add_library(ndNewton STATIC \${ND_SOURCES})
`
}

function wasmImportKey(value) {
  return `${value.module}.${value.name}`
}

function createWasmImports() {
  const memoryBox = { memory: null }
  return {
    env: {
      _abort_js() {
        throw new Error('Newton WASM aborted')
      },
      emscripten_resize_heap() {
        return 0
      },
      emscripten_date_now() {
        return Date.now()
      },
      emscripten_get_now() {
        return performance.now()
      },
      exit(status) {
        throw new Error(`Newton WASM exit ${status}`)
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
      clock_time_get(_clockId, _precision, timePtr) {
        if (memoryBox.memory !== null) {
          const ns = BigInt(Date.now()) * 1_000_000n
          new DataView(memoryBox.memory.buffer).setBigUint64(timePtr, ns, true)
        }
        return 0
      },
    },
    memoryBox,
  }
}

async function verifyWasmModule(path) {
  const bytes = await readFile(path)
  if (bytes.byteLength > 67_108_864) fail(`artifact ${bytes.byteLength} bytes exceeds the 64 MiB cap`)
  let module
  try {
    module = await WebAssembly.compile(bytes)
  } catch (error) {
    fail(`WASM module is not compilable: ${error instanceof Error ? error.message : String(error)}`)
  }
  const exports = WebAssembly.Module.exports(module).map(({ name }) => name)
  for (const expected of EXPECTED_EXPORTS) {
    if (!exports.includes(expected)) fail(`WASM export ${expected} is missing`)
  }
  const imports = WebAssembly.Module.imports(module).map(wasmImportKey)
  const wasmImports = createWasmImports()
  const instance = await WebAssembly.instantiate(module, wasmImports)
  wasmImports.memoryBox.memory = instance.exports.memory
  const wasmExports = instance.exports
  if (typeof wasmExports.__wasm_call_ctors !== 'function'
    || typeof wasmExports.newton_version !== 'function'
    || typeof wasmExports.newton_step !== 'function') {
    fail('WASM scalar ABI exports have the wrong types')
  }
  wasmExports.__wasm_call_ctors()
  const version = wasmExports.newton_version()
  const step = wasmExports.newton_step()
  if (version !== 400) fail(`newton_version returned ${version}, expected 400`)
  if (!Number.isFinite(step)) fail(`newton_step returned a non-finite value: ${step}`)
  return { imports, exports, version, step, byteSize: bytes.byteLength }
}

function buildCommand(buildDirectory, env) {
  const args = ['-n', '10', 'cmake', '--build', buildDirectory, '--parallel', '4', '--config', 'Release']
  const scoped = spawnSync('systemd-run', ['--user', '--scope', '-p', `MemoryMax=${COMPILE_MEMORY_MAX_BYTES}`, '--', 'nice', ...args], {
    cwd: env.cwd,
    env: env.env,
    stdio: 'inherit',
  })
  if (scoped.error && scoped.error.code === 'ENOENT') {
    run('nice', args, env, 'Newton CPU library build')
    return
  }
  if (scoped.status !== 0) fail(`Newton CPU library build: exited with status ${scoped.status}`)
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const available = memAvailableBytes()
  if (available < START_MEMORY_MIN_BYTES) {
    fail(`MemAvailable ${available} bytes is below the ${START_MEMORY_MIN_BYTES}-byte start gate`)
  }
  console.log(`Newton compile RAM gate: MemAvailable=${available} cap=${COMPILE_MEMORY_MAX_BYTES}`)

  const source = options.source
  const output = options.output
  const emCache = options.emCache
  const toolchain = options.toolchain
  const sdk = join(source, 'newton-4.00/sdk')

  await requireDirectory(source, 'Newton source checkout')
  await requireDirectory(sdk, 'Newton 4.00 SDK')
  await requireDirectory(emCache, 'Emscripten cache')
  if (!isAbsolute(toolchain)) fail(`Emscripten toolchain must be an absolute path: ${toolchain}`)
  await requireFile(toolchain, 'Emscripten toolchain')
  await requireFile(abiSource, 'Newton ABI')
  if (isInside(source, output) || isInside(output, source)) {
    fail(`source and output must be separate out-of-tree paths: ${source} / ${output}`)
  }

  for (const [relativePath, kind] of [
    ['newton-4.00/CMakeLists.txt', 'Newton root CMake file'],
    ['newton-4.00/sdk/LICENSE', 'Newton SDK license'],
    ['newton-4.00/sdk/dNewton/ndWorld.h', 'Newton world header'],
    ['newton-4.00/sdk/dCollision/ndShapeSphere.h', 'Newton sphere header'],
  ]) {
    await requireFile(join(source, relativePath), kind)
  }

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

  const emscriptenRoot = resolve(dirname(toolchain), '../../..')
  const env = {
    ...process.env,
    EM_CACHE: emCache,
    PATH: `${emscriptenRoot}:${process.env.PATH ?? ''}`,
    GIT_OPTIONAL_LOCKS: '0',
  }
  const commandOptions = { cwd: output, env }
  const emxxVersion = capture('em++', ['--version'], commandOptions, 'Emscripten C++ compiler version')
  if (!emxxVersion.includes(`Emscripten gcc/clang-like replacement + linker emulating GNU ld) ${EMSCRIPTEN_VERSION}`)) {
    fail(`em++ must be Emscripten ${EMSCRIPTEN_VERSION}`)
  }
  if (!emxxVersion.includes(EMSCRIPTEN_REVISION)) fail(`em++ must use Emscripten revision ${EMSCRIPTEN_REVISION}`)

  await assertSourceClean(source, commandOptions, 'Newton source checkout')

  const driverDirectory = join(output, 'cmake-driver')
  const buildDirectory = join(output, 'build')
  const linkDirectory = join(output, 'link')
  await mkdir(driverDirectory, { recursive: true })
  await mkdir(linkDirectory, { recursive: true })
  const heightfieldSource = await writeClangCompatSources(source, output)
  await writeFile(join(driverDirectory, 'CMakeLists.txt'), cmakeDriver(sdk, heightfieldSource), 'utf8')

  run('emcmake', [
    'cmake',
    '-S', driverDirectory,
    '-B', buildDirectory,
    '-G', 'Ninja',
    `-DCMAKE_TOOLCHAIN_FILE=${toolchain}`,
    '-DCMAKE_BUILD_TYPE=Release',
  ], commandOptions, 'CMake configure')
  buildCommand(buildDirectory, commandOptions)

  const archive = join(buildDirectory, 'libndNewton.a')
  await requireFile(archive, 'ndNewton static library')

  const linkJavaScript = join(linkDirectory, 'newton-dynamics.js')
  const linkWasm = join(linkDirectory, ARTIFACT_NAME)
  run('em++', [
    '-O2',
    '-DNDEBUG',
    '-std=c++11',
    '-DD_SCALAR_VECTOR_CLASS',
    '-DD_USE_THREAD_EMULATION',
    '-D_D_SINGLE_LIBRARY',
    '-DFE_INVALID=1',
    '-DFE_DIVBYZERO=4',
    '-DFE_INEXACT=32',
    `-I${join(sdk, 'dCore')}`,
    `-I${join(sdk, 'dNewton')}`,
    `-I${join(sdk, 'dCollision')}`,
    `-I${join(sdk, 'dNewton/dJoints')}`,
    `-I${join(sdk, 'dNewton/dModels')}`,
    `-I${join(sdk, 'dNewton/dIkSolver')}`,
    `-I${join(sdk, 'dNewton/dModels/dVehicle')}`,
    `-I${join(sdk, 'dCollision/dMesh')}`,
    `-I${join(sdk, 'dCore/tinyxml')}`,
    '-s', 'MODULARIZE=1',
    '-s', 'EXPORT_ES6=1',
    '-s', 'ENVIRONMENT=web,node',
    '-s', 'ASSERTIONS=1',
    '-s', 'ALLOW_MEMORY_GROWTH=1',
    '-s', `MAXIMUM_MEMORY=${RUNTIME_MEMORY_BYTES}`,
    '-s', 'USE_PTHREADS=0',
    '-s', 'EXPORTED_FUNCTIONS=["_newton_version","_newton_step"]',
    '-o', linkJavaScript,
    abiSource,
    archive,
  ], commandOptions, 'Newton ABI link')

  const proof = await verifyWasmModule(linkWasm)
  const integrity = await sha256(linkWasm)
  await writeFile(join(output, ARTIFACT_NAME), await readFile(linkWasm))
  await writeFile(join(output, 'build-ledger.json'), `${JSON.stringify({
    schemaVersion: 1,
    artifact: { name: ARTIFACT_NAME, ...integrity },
    source: { revision: SOURCE_REVISION_FULL },
    toolchain: { version: EMSCRIPTEN_VERSION, revision: EMSCRIPTEN_REVISION },
    proof,
    compileMemoryMaxBytes: COMPILE_MEMORY_MAX_BYTES,
  }, null, 2)}\n`)
  await assertSourceClean(source, commandOptions, 'Newton source checkout after build')
  console.log(`Newton raw WASM artifact verified in ${output}`)
  console.log(`  ${ARTIFACT_NAME}: ${integrity.byteSize} bytes, ${integrity.sha256}`)
  console.log(`  newton_version=${proof.version} newton_step=${proof.step}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
