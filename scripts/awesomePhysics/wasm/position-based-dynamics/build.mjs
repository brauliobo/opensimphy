import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_REVISION = 'beafc921e21553515b4f406258e5b16054a45268'
const EIGEN_VERSION = 'Eigen 3.4.0'
const EMSCRIPTEN_VERSION = '6.0.6-git'
const EMSCRIPTEN_REVISION = 'ce75e06884093bcefb86a6b8fd56a5d62a4cc245'
const EMSCRIPTEN_TOOLCHAIN_SHA256 = 'fdca7d6b6ebe9c087aa7f0a0c7391b0b83fdb081160158f65aa1182cdc964718'
const ARTIFACT = Object.freeze({
  name: 'position-based-dynamics-headless.wasm',
  byteSize: 1256,
  sha256: '3182948748996ee1f755a4092bde52cea0c8ba586d66d5c54690b8a63d8362df',
})
const ABI_EXPORTS = Object.freeze([
  'pbd_solve_distance',
  'pbd_solve_distance_correction0',
  'pbd_solve_distance_correction1',
])

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const defaultSource = resolve(projectRoot, '../awesome-physics-repos/PositionBasedDynamics')
const defaultEmscriptenRoot = process.env.EMSCRIPTEN_ROOT ?? '/usr/lib/emscripten'

function fail(message) {
  throw new Error(`PositionBasedDynamics WASM build failed: ${message}`)
}

function usage() {
  return [
    'Usage: node scripts/awesomePhysics/wasm/position-based-dynamics/build.mjs --output <empty out-of-tree-dir> [options]',
    '',
    'Options:',
    `  --source <dir>             Pinned PositionBasedDynamics checkout (default: ${defaultSource})`,
    '  --output <dir>             Empty out-of-tree build/output directory (required)',
    `  --emscripten-root <dir>    Pinned Emscripten root (default: ${defaultEmscriptenRoot})`,
    '  --em-cache <dir>           Pinned Emscripten cache (or EM_CACHE)',
    '  --help                     Show this help',
  ].join('\n')
}

function parseArguments(argv) {
  const values = {
    source: process.env.POSITION_BASED_DYNAMICS_SOURCE ?? defaultSource,
    output: undefined,
    emscriptenRoot: defaultEmscriptenRoot,
    emCache: process.env.EM_CACHE,
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
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === undefined ? value : resolve(value)]))
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
  if (!details.isFile()) fail(`${label} is not a regular file: ${path}`)
}

async function sha256(path) {
  const bytes = await readFile(path)
  return {
    byteSize: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

async function verifyArtifact(path, expected, label) {
  const actual = await sha256(path)
  if (actual.byteSize !== expected.byteSize || actual.sha256 !== expected.sha256) {
    fail(`${label} differs: expected ${expected.byteSize} bytes/${expected.sha256}, got ${actual.byteSize} bytes/${actual.sha256}`)
  }
}

async function assertSourceClean(source, options, label) {
  const head = capture('git', ['-C', source, 'rev-parse', 'HEAD'], options, `${label} revision`).trim()
  if (head !== SOURCE_REVISION) fail(`${label} is at ${head}, expected ${SOURCE_REVISION}`)
  const status = capture('git', ['-C', source, 'status', '--porcelain=v1'], options, `${label} status`).trim()
  if (status.length > 0) fail(`${label} is not clean:\n${status}`)
}

function cmakePath(path) {
  return path.replaceAll('\\', '/')
}

function cmakeDriver(source, abiSource, buildDirectory) {
  const sourcePath = cmakePath(source)
  const abiPath = cmakePath(abiSource)
  const archivePath = cmakePath(buildDirectory)
  return `cmake_minimum_required(VERSION 3.10)
project(PositionBasedDynamicsHeadless LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY "${archivePath}/lib")

add_library(PositionBasedDynamics STATIC
  "${sourcePath}/PositionBasedDynamics/PositionBasedDynamics.cpp"
  "${sourcePath}/PositionBasedDynamics/MathFunctions.cpp"
)
target_include_directories(PositionBasedDynamics PRIVATE
  "${sourcePath}"
  "${sourcePath}/extern/eigen"
)
target_compile_definitions(PositionBasedDynamics PRIVATE
  USE_DOUBLE
  EIGEN_MPL2_ONLY
  EIGEN_NO_DEBUG
)
target_compile_options(PositionBasedDynamics PRIVATE
  -O3
  -DNDEBUG
  -fno-exceptions
  -fno-rtti
  -fno-openmp
  -ffile-prefix-map=${sourcePath}=/pbd-source
)

set_target_properties(PositionBasedDynamics PROPERTIES
  OUTPUT_NAME PositionBasedDynamics
  POSITION_INDEPENDENT_CODE OFF
)
`
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
  const abiSource = resolve(projectRoot, 'scripts/awesomePhysics/wasm/position-based-dynamics/pbd_abi.cpp')

  await requireDirectory(source, 'PositionBasedDynamics source checkout')
  await requireDirectory(join(source, 'extern/eigen'), 'vendored Eigen checkout')
  await requireFile(join(source, 'extern/eigen/version.txt'), 'vendored Eigen version file')
  const eigenVersion = (await readFile(join(source, 'extern/eigen/version.txt'), 'utf8')).trim()
  if (eigenVersion !== EIGEN_VERSION) fail(`vendored Eigen is ${eigenVersion}, expected ${EIGEN_VERSION}`)
  await requireFile(abiSource, 'ABI source')
  await requireDirectory(emscriptenRoot, 'Emscripten root')
  await requireFile(emcc, 'Emscripten C compiler')
  await requireFile(emxx, 'Emscripten C++ compiler')
  await requireFile(emconfig, 'Emscripten configuration tool')
  await requireFile(toolchain, 'Emscripten CMake toolchain')
  if (isInside(source, output) || isInside(output, source)) fail(`source and output must be separate out-of-tree paths: ${source} / ${output}`)

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

  await assertSourceClean(source, commandOptions, 'PositionBasedDynamics source checkout')

  const driverDirectory = join(output, 'cmake-driver')
  const buildDirectory = join(output, 'pbd-build')
  const driverPath = join(driverDirectory, 'CMakeLists.txt')
  const staticLibrary = join(buildDirectory, 'lib/libPositionBasedDynamics.a')
  const wasmPath = join(output, ARTIFACT.name)
  await mkdir(driverDirectory, { recursive: true })
  await writeFile(driverPath, cmakeDriver(source, abiSource, buildDirectory), 'utf8')

  run('cmake', [
    '-S', driverDirectory,
    '-B', buildDirectory,
    '-G', 'Ninja',
    `-DCMAKE_TOOLCHAIN_FILE=${toolchain}`,
    '-DCMAKE_BUILD_TYPE=Release',
    '-DCMAKE_EXPORT_COMPILE_COMMANDS=ON',
  ], commandOptions, 'CMake configure')
  run('nice', [
    '-n', '10',
    'cmake', '--build', buildDirectory,
    '--parallel', '4',
    '--config', 'Release',
  ], commandOptions, 'PBD static-library build')
  await requireFile(staticLibrary, 'out-of-tree PBD static library')

  run(emxx, [
    '-std=c++11',
    '-O3',
    '-DNDEBUG',
    '-DUSE_DOUBLE',
    '-DEIGEN_MPL2_ONLY',
    '-DEIGEN_NO_DEBUG',
    '-fno-exceptions',
    '-fno-rtti',
    '-fno-openmp',
    `-I${source}`,
    `-I${join(source, 'extern/eigen')}`,
    `-ffile-prefix-map=${source}=/pbd-source`,
    `-ffile-prefix-map=${projectRoot}=/opensimphy`,
    '--no-entry',
    '-sSTANDALONE_WASM=1',
    '-sEXPORTED_FUNCTIONS=["_pbd_solve_distance","_pbd_solve_distance_correction0","_pbd_solve_distance_correction1"]',
    '-sERROR_ON_UNDEFINED_SYMBOLS=1',
    '-sDISABLE_EXCEPTION_CATCHING=1',
    '-sASSERTIONS=0',
    '-sFILESYSTEM=0',
    '-sMALLOC=none',
    '-sSTACK_SIZE=65536',
    '-Wl,--gc-sections',
    abiSource,
    staticLibrary,
    '-o', wasmPath,
  ], commandOptions, 'standalone WASM link')

  await verifyArtifact(wasmPath, ARTIFACT, 'standalone WASM artifact')
  await assertSourceClean(source, commandOptions, 'PositionBasedDynamics source checkout after build')

  console.log(`PositionBasedDynamics standalone WASM artifact verified in ${output}`)
  console.log(`  ${ARTIFACT.name}: ${ARTIFACT.byteSize} bytes, ${ARTIFACT.sha256}`)
  console.log(`  exports: ${ABI_EXPORTS.join(', ')}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
