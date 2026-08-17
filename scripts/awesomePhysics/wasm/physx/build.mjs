import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const SOURCE_REVISION_FULL = '5e42a5f112351a223c19c17bb331e6c55037b8eb'
const SOURCE_REVISION = SOURCE_REVISION_FULL.slice(0, 12)
const EMSCRIPTEN_VERSION = '6.0.6-git'
const EMSCRIPTEN_REVISION = 'ce75e06884093bcefb86a6b8fd56a5d62a4cc245'
const COMPILE_MEMORY_MAX_BYTES = 12 * 1024 * 1024 * 1024
const START_MEMORY_MIN_BYTES = 4 * 1024 * 1024 * 1024
const RUNTIME_MEMORY_BYTES = 268435456
const ARTIFACT_NAME = 'physx-3-4.wasm'
const PX_PHYSICS_VERSION = (3 << 24) + (4 << 16) + (2 << 8)
const EXPECTED_EXPORTS = Object.freeze([
  '__indirect_function_table',
  '__wasm_call_ctors',
  'physx_step',
  'physx_version',
  'memory',
])
const MAKEFILE_PROJECTS = Object.freeze([
  'PxFoundation',
  'PxTask',
  'PhysXCommon',
  'LowLevel',
  'LowLevelAABB',
  'LowLevelDynamics',
  'SimulationController',
  'SceneQuery',
  'PhysX',
  'PhysXExtensions',
])
const EXCLUDE_RE = /gpu|Gpu|cloth|Cloth|particle|Particle|windows|Pvd|pvd|serialization|MetaData|vehicle|Vehicle|character|Character|cooking|Cooking|ExtExtensions/i

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const defaultSource = resolve(projectRoot, '../awesome-physics-repos/PhysX-3.4')
const defaultToolchain = '/usr/lib/emscripten/cmake/Modules/Platform/Emscripten.cmake'
const abiSource = join(dirname(fileURLToPath(import.meta.url)), 'physx_abi.cpp')

function fail(message) {
  throw new Error(`PhysX WASM build failed: ${message}`)
}

function usage() {
  return [
    'Usage: node scripts/awesomePhysics/wasm/physx/build.mjs --output <empty out-of-tree-dir> [options]',
    '',
    'Options:',
    `  --source <dir>       Pinned PhysX-3.4 checkout (default: ${defaultSource})`,
    '  --output <dir>       Empty out-of-tree build/output directory (required)',
    '  --em-cache <dir>     Pinned Emscripten cache (or EM_CACHE)',
    `  --toolchain <file>   Emscripten CMake toolchain file (default: ${defaultToolchain})`,
    '  --help               Show this help',
  ].join('\n')
}

function parseArguments(argv) {
  const values = {
    source: process.env.PHYSX_SOURCE ?? defaultSource,
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

function parseMakefile(makefileDir, project) {
  const makefile = join(makefileDir, `Makefile.${project}.mk`)
  const text = readFileSync(makefile, 'utf8')
  const sources = []
  const includes = []
  const sourceRe = new RegExp(`${project}_cppfiles\\s+\\+=\\s+(\\S+)`, 'g')
  const includeRe = new RegExp(`${project}_release_hpaths\\s+\\+=\\s+(\\S+)`, 'g')
  for (const match of text.matchAll(sourceRe)) sources.push(match[1])
  for (const match of text.matchAll(includeRe)) includes.push(match[1])
  if (sources.length === 0) fail(`${project} makefile listed no C++ files`)
  return { sources, includes }
}

function collectSources(source, makefileDir) {
  const files = []
  const includeDirs = new Set()
  for (const project of MAKEFILE_PROJECTS) {
    const parsed = parseMakefile(makefileDir, project)
    for (const relativePath of parsed.sources) {
      if (EXCLUDE_RE.test(relativePath)) continue
      const absolute = resolve(makefileDir, relativePath)
      files.push(absolute)
    }
    for (const relativePath of parsed.includes) {
      includeDirs.add(resolve(makefileDir, relativePath))
    }
  }
  includeDirs.add(join(source, 'PhysX_3.4/Include'))
  includeDirs.add(join(source, 'PxShared/include'))
  includeDirs.add(join(source, 'PxShared/src/foundation/include'))
  if (files.length < 50) fail(`PhysX CPU subset is unexpectedly small: ${files.length} files`)
  if (files.length > 800) fail(`PhysX CPU subset is too large to compile under the RAM cap: ${files.length} files`)
  return { files, includeDirs: [...includeDirs] }
}

const GJK_CONST_REF_NEEDLE = 'PX_FORCE_INLINE Ps::aos::PsMatTransformV& getRelativeTransform(){ return mAToB; }'
const GJK_CONST_REF_REPLACEMENT = 'PX_FORCE_INLINE const Ps::aos::PsMatTransformV& getRelativeTransform() const { return mAToB; }'
const HASH_SIZE_T_NEEDLE = '#if PX_APPLE_FAMILY'
const HASH_SIZE_T_REPLACEMENT = '#if PX_APPLE_FAMILY || PX_EMSCRIPTEN'
const PARTICLE_API_NEEDLE = '#define PX_USE_PARTICLE_SYSTEM_API 1'
const CLOTH_API_NEEDLE = '#define PX_USE_CLOTH_API 1'

async function copyTree(from, to) {
  await mkdir(to, { recursive: true })
  for (const name of await readdir(from)) {
    const src = join(from, name)
    const dest = join(to, name)
    const details = await stat(src)
    if (details.isDirectory()) await copyTree(src, dest)
    else if (details.isFile()) await writeFile(dest, await readFile(src))
    else fail(`unexpected entry ${src}`)
  }
}

async function writeClangCompatGjk(source, output, files) {
  const gjkSource = join(source, 'PhysX_3.4/Source/GeomUtils/src/gjk')
  const gjkDest = join(output, 'clang-compat', 'gjk')
  await mkdir(gjkDest, { recursive: true })
  for (const name of await readdir(gjkSource)) {
    const from = join(gjkSource, name)
    if (!(await stat(from)).isFile()) fail(`unexpected non-file in GJK tree: ${from}`)
    let text = await readFile(from, 'utf8')
    if (name === 'GuGJKType.h') {
      if (!text.includes(GJK_CONST_REF_NEEDLE)) {
        fail('GuGJKType.h no longer has the expected const-ref method; refuse to guess a patch')
      }
      text = text.replace(GJK_CONST_REF_NEEDLE, GJK_CONST_REF_REPLACEMENT)
    }
    await writeFile(join(gjkDest, name), text)
  }
  return {
    includeDir: gjkDest,
    files: files.map((file) => (isInside(gjkSource, file) ? join(gjkDest, relative(gjkSource, file)) : file)),
  }
}

async function writeClangCompatFoundation(source, output) {
  const foundationSource = join(source, 'PxShared/src/foundation/include')
  const foundationDest = join(output, 'clang-compat', 'foundation')
  await copyTree(foundationSource, foundationDest)
  const hashPath = join(foundationDest, 'PsHash.h')
  const text = await readFile(hashPath, 'utf8')
  if (!text.includes(HASH_SIZE_T_NEEDLE)) fail('PsHash.h no longer has the Apple size_t hash gate')
  await writeFile(hashPath, text.replace(HASH_SIZE_T_NEEDLE, HASH_SIZE_T_REPLACEMENT), 'utf8')
  return foundationDest
}

async function writeClangCompatPublicInclude(source, output) {
  const includeSource = join(source, 'PhysX_3.4/Include')
  const includeDest = join(output, 'clang-compat', 'include')
  await copyTree(includeSource, includeDest)
  const configPath = join(includeDest, 'PxPhysXConfig.h')
  const text = await readFile(configPath, 'utf8')
  if (!text.includes(PARTICLE_API_NEEDLE) || !text.includes(CLOTH_API_NEEDLE)) {
    fail('PxPhysXConfig.h no longer has the expected particle/cloth API defaults')
  }
  await writeFile(configPath, text
    .replace(PARTICLE_API_NEEDLE, '#define PX_USE_PARTICLE_SYSTEM_API 0')
    .replace(CLOTH_API_NEEDLE, '#define PX_USE_CLOTH_API 0'), 'utf8')
  return includeDest
}

function cmakeDriver(files, includeDirs, abiPath) {
  const sources = files.map((file) => `  "${cmakePath(file)}"`).join('\n')
  const includes = includeDirs.map((dir) => `  "${cmakePath(dir)}"`).join('\n')
  return `cmake_minimum_required(VERSION 3.10)
project(PhysXHeadless LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
add_compile_options(-fno-exceptions -fno-rtti -fvisibility=hidden)
add_definitions(
  -DNDEBUG
  -DPX_PHYSX_STATIC_LIB
  -DPX_PHYSX_CORE_STATIC_LIB
  -DPX_SUPPORT_PVD=0
  -DDISABLE_CUDA_PHYSX
  -DPX_SIMD_DISABLED=1
  -DPX_NVTX=0
)
include_directories(
${includes}
)
add_library(physx_cpu STATIC
${sources}
)
`
}

function wasmImportKey(value) {
  return `${value.module}.${value.name}`
}

function createWasmImports() {
  return {
    env: {
      _abort_js() {
        throw new Error('PhysX WASM aborted')
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
        throw new Error(`PhysX WASM exit ${status}`)
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
  const instance = await WebAssembly.instantiate(module, createWasmImports())
  const wasmExports = instance.exports
  if (typeof wasmExports.__wasm_call_ctors !== 'function'
    || typeof wasmExports.physx_version !== 'function'
    || typeof wasmExports.physx_step !== 'function') {
    fail('WASM scalar ABI exports have the wrong types')
  }
  wasmExports.__wasm_call_ctors()
  const version = wasmExports.physx_version()
  const step = wasmExports.physx_step()
  if (version !== PX_PHYSICS_VERSION) fail(`physx_version returned ${version}, expected ${PX_PHYSICS_VERSION}`)
  if (!Number.isFinite(step)) fail(`physx_step returned a non-finite value: ${step}`)
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
    run('nice', args, env, 'PhysX CPU library build')
    return
  }
  if (scoped.status !== 0) fail(`PhysX CPU library build: exited with status ${scoped.status}`)
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const available = memAvailableBytes()
  if (available < START_MEMORY_MIN_BYTES) {
    fail(`MemAvailable ${available} bytes is below the ${START_MEMORY_MIN_BYTES}-byte start gate`)
  }
  console.log(`PhysX compile RAM gate: MemAvailable=${available} cap=${COMPILE_MEMORY_MAX_BYTES}`)

  const source = options.source
  const output = options.output
  const emCache = options.emCache
  const toolchain = options.toolchain
  const makefileDir = join(source, 'PhysX_3.4/Source/compiler/linux64')

  await requireDirectory(source, 'PhysX source checkout')
  await requireDirectory(emCache, 'Emscripten cache')
  if (!isAbsolute(toolchain)) fail(`Emscripten toolchain must be an absolute path: ${toolchain}`)
  await requireFile(toolchain, 'Emscripten toolchain')
  await requireFile(abiSource, 'PhysX ABI')
  if (isInside(source, output) || isInside(output, source)) {
    fail(`source and output must be separate out-of-tree paths: ${source} / ${output}`)
  }

  for (const [relativePath, kind] of [
    ['README.md', 'PhysX license/README'],
    ['PxShared/include/foundation/PxPreprocessor.h', 'PhysX preprocessor'],
    ['PhysX_3.4/Include/PxPhysicsAPI.h', 'PhysX public API'],
    ['PhysX_3.4/Source/PhysX', 'PhysX CPU source'],
  ]) {
    const path = join(source, relativePath)
    if (relativePath.endsWith('.md') || relativePath.endsWith('.h')) await requireFile(path, kind)
    else await requireDirectory(path, kind)
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

  const collected = collectSources(source, makefileDir)
  const gjkCompat = await writeClangCompatGjk(source, output, collected.files)
  collected.files = gjkCompat.files
  collected.includeDirs.unshift(
    await writeClangCompatPublicInclude(source, output),
    await writeClangCompatFoundation(source, output),
    gjkCompat.includeDir,
  )
  console.log(`PhysX CPU subset: ${collected.files.length} translation units`)

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

  await assertSourceClean(source, commandOptions, 'PhysX source checkout')

  const driverDirectory = join(output, 'cmake-driver')
  const buildDirectory = join(output, 'build')
  const linkDirectory = join(output, 'link')
  await mkdir(driverDirectory, { recursive: true })
  await mkdir(linkDirectory, { recursive: true })
  await writeFile(join(driverDirectory, 'CMakeLists.txt'), cmakeDriver(collected.files, collected.includeDirs, abiSource), 'utf8')

  run('emcmake', [
    'cmake',
    '-S', driverDirectory,
    '-B', buildDirectory,
    '-G', 'Ninja',
    `-DCMAKE_TOOLCHAIN_FILE=${toolchain}`,
    '-DCMAKE_BUILD_TYPE=Release',
  ], commandOptions, 'CMake configure')
  buildCommand(buildDirectory, commandOptions)

  const archive = join(buildDirectory, 'libphysx_cpu.a')
  await requireFile(archive, 'PhysX CPU static library')

  const includeFlags = collected.includeDirs.flatMap((dir) => ['-I', dir])
  const linkJavaScript = join(linkDirectory, 'physx-3-4.js')
  const linkWasm = join(linkDirectory, ARTIFACT_NAME)
  run('em++', [
    '-O2',
    '-DNDEBUG',
    '-std=c++11',
    '-fno-exceptions',
    '-fno-rtti',
    '-DPX_PHYSX_STATIC_LIB',
    '-DPX_PHYSX_CORE_STATIC_LIB',
    '-DPX_SUPPORT_PVD=0',
    '-DDISABLE_CUDA_PHYSX',
    '-DPX_SIMD_DISABLED=1',
    ...includeFlags,
    '-s', 'MODULARIZE=1',
    '-s', 'EXPORT_ES6=1',
    '-s', 'ENVIRONMENT=web,node',
    '-s', 'ASSERTIONS=1',
    '-s', 'ALLOW_MEMORY_GROWTH=1',
    '-s', `MAXIMUM_MEMORY=${RUNTIME_MEMORY_BYTES}`,
    '-s', 'USE_PTHREADS=0',
    '-s', 'EXPORTED_FUNCTIONS=["_physx_version","_physx_step"]',
    '-o', linkJavaScript,
    abiSource,
    archive,
  ], commandOptions, 'PhysX ABI link')

  const proof = await verifyWasmModule(linkWasm)
  const integrity = await sha256(linkWasm)
  await writeFile(join(output, ARTIFACT_NAME), await readFile(linkWasm))
  await writeFile(join(output, 'build-ledger.json'), `${JSON.stringify({
    schemaVersion: 1,
    artifact: { name: ARTIFACT_NAME, ...integrity },
    source: { revision: SOURCE_REVISION_FULL, translationUnits: collected.files.length },
    toolchain: { version: EMSCRIPTEN_VERSION, revision: EMSCRIPTEN_REVISION },
    proof,
    compileMemoryMaxBytes: COMPILE_MEMORY_MAX_BYTES,
  }, null, 2)}\n`)
  await assertSourceClean(source, commandOptions, 'PhysX source checkout after build')
  console.log(`PhysX raw WASM artifact verified in ${output}`)
  console.log(`  ${ARTIFACT_NAME}: ${integrity.byteSize} bytes, ${integrity.sha256}`)
  console.log(`  physx_version=${proof.version} physx_step=${proof.step}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
