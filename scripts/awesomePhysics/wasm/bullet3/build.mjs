import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, stat } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_REVISION = '63c4d67e3370'
const SOURCE_REVISION_FULL = '63c4d67e337017f9d8b298c900e9aabdb69296e7'
const EMSCRIPTEN_VERSION = '6.0.6-git'
const EMSCRIPTEN_REVISION = 'ce75e06884093bcefb86a6b8fd56a5d62a4cc245'
const EXPECTED_STEP = 9.997221946716309
const EXPECTED_ARTIFACT = Object.freeze({
  name: 'bullet3.wasm',
  byteSize: 333983,
  sha256: '1f255bb36e7c7a4f14a03cccfb95f13a39fdf50a9c2b2259faa1048e0473b425',
})
const EXPECTED_IMPORTS = Object.freeze([
  'env._abort_js',
  'env.emscripten_resize_heap',
  'wasi_snapshot_preview1.fd_close',
  'wasi_snapshot_preview1.fd_seek',
  'wasi_snapshot_preview1.fd_write',
])
const EXPECTED_EXPORTS = Object.freeze([
  '__indirect_function_table',
  '__wasm_call_ctors',
  'bullet_step',
  'bullet_version',
  'memory',
])
const CMAKE_OPTIONS = Object.freeze([
  '-DBUILD_CPU_DEMOS=OFF',
  '-DBUILD_OPENGL3_DEMOS=OFF',
  '-DBUILD_BULLET2_DEMOS=OFF',
  '-DBUILD_BULLET3=OFF',
  '-DBUILD_EXTRAS=OFF',
  '-DBUILD_UNIT_TESTS=OFF',
  '-DBUILD_EGL=OFF',
  '-DUSE_GRAPHICAL_BENCHMARK=OFF',
  '-DBULLET2_MULTITHREADING=OFF',
  '-DINSTALL_LIBS=ON',
])

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const defaultSource = resolve(projectRoot, '../awesome-physics-repos/bullet3')
const defaultToolchain = '/usr/lib/emscripten/cmake/Modules/Platform/Emscripten.cmake'

function fail(message) {
  throw new Error(`Bullet3 build failed: ${message}`)
}

function usage() {
  return [
    'Usage: node scripts/awesomePhysics/wasm/bullet3/build.mjs --output <empty out-of-tree-dir> [options]',
    '',
    'Options:',
    `  --source <dir>       Pinned Bullet3 checkout (default: ${defaultSource})`,
    '  --output <dir>       Empty out-of-tree build/output directory (required)',
    '  --em-cache <dir>     Pinned Emscripten cache (or EM_CACHE)',
    `  --toolchain <file>   Emscripten CMake toolchain file (default: ${defaultToolchain})`,
    '  --help               Show this help',
  ].join('\n')
}

function parseArguments(argv) {
  const values = {
    source: process.env.BULLET3_SOURCE ?? defaultSource,
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

async function verifyArtifact(path, expected, label) {
  const actual = await sha256(path)
  if (actual.byteSize !== expected.byteSize || actual.sha256 !== expected.sha256) {
    fail(`${label} differs: expected ${expected.byteSize} bytes/${expected.sha256}, got ${actual.byteSize} bytes/${actual.sha256}`)
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

function wasmImportKey(value) {
  return `${value.module}.${value.name}`
}

function wasmExportNames(module) {
  return WebAssembly.Module.exports(module).map(({ name }) => name).sort()
}

function createWasmImports() {
  return {
    env: {
      _abort_js() {
        throw new Error('Bullet3 WASM aborted')
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

async function verifyWasmModule(path) {
  const bytes = await readFile(path)
  let module
  try {
    module = await WebAssembly.compile(bytes)
  } catch (error) {
    fail(`WASM module is not compilable: ${error instanceof Error ? error.message : String(error)}`)
  }

  const imports = WebAssembly.Module.imports(module).map(wasmImportKey).sort()
  if (JSON.stringify(imports) !== JSON.stringify([...EXPECTED_IMPORTS].sort())) {
    fail(`WASM imports differ: expected ${EXPECTED_IMPORTS.join(', ')}, got ${imports.join(', ')}`)
  }
  const exports = wasmExportNames(module)
  for (const expected of EXPECTED_EXPORTS) {
    if (!exports.includes(expected)) fail(`WASM export ${expected} is missing`)
  }

  const instance = await WebAssembly.instantiate(module, createWasmImports())
  const wasmExports = instance.exports
  if (typeof wasmExports.__wasm_call_ctors !== 'function'
    || typeof wasmExports.bullet_version !== 'function'
    || typeof wasmExports.bullet_step !== 'function') {
    fail('WASM scalar ABI exports have the wrong types')
  }
  wasmExports.__wasm_call_ctors()
  const version = wasmExports.bullet_version()
  const step = wasmExports.bullet_step()
  if (version !== 327) fail(`bullet_version returned ${version}, expected 327`)
  if (!Number.isFinite(step) || Math.abs(step - EXPECTED_STEP) > 1e-6) {
    fail(`bullet_step returned ${step}, expected ${EXPECTED_STEP}`)
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const source = options.source
  const output = options.output
  const emCache = options.emCache
  const toolchain = options.toolchain

  await requireDirectory(source, 'Bullet3 source checkout')
  await requireDirectory(emCache, 'Emscripten cache')
  if (!isAbsolute(toolchain)) fail(`Emscripten toolchain must be an absolute path: ${toolchain}`)
  await requireFile(toolchain, 'Emscripten toolchain')
  if (isInside(source, output) || isInside(output, source)) {
    fail(`source and output must be separate out-of-tree paths: ${source} / ${output}`)
  }

  for (const [relativePath, kind] of [
    ['CMakeLists.txt', 'Bullet3 root CMake file'],
    ['LICENSE.txt', 'Bullet3 license'],
    ['AUTHORS.txt', 'Bullet3 authors metadata'],
    ['src/BulletCollision', 'BulletCollision source'],
    ['src/BulletDynamics', 'BulletDynamics source'],
    ['src/LinearMath', 'LinearMath source'],
    ['src/btBulletDynamicsCommon.h', 'Bullet dynamics public header'],
    ['examples/ThirdPartyLibs/zlib/zlib.h', 'selected zlib source'],
    ['examples/ThirdPartyLibs/zlib/LICENSE.txt', 'selected zlib notice'],
  ]) {
    const path = join(source, relativePath)
    if (relativePath.endsWith('.txt') || relativePath.endsWith('.h')) await requireFile(path, kind)
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

  const emscriptenRoot = resolve(dirname(toolchain), '../../..')
  const env = {
    ...process.env,
    EM_CACHE: emCache,
    PATH: `${emscriptenRoot}:${process.env.PATH ?? ''}`,
    GIT_OPTIONAL_LOCKS: '0',
  }
  const commandOptions = { cwd: output, env }
  const emccVersion = capture('emcc', ['--version'], commandOptions, 'Emscripten C compiler version')
  const emxxVersion = capture('em++', ['--version'], commandOptions, 'Emscripten C++ compiler version')
  for (const [label, version] of [['emcc', emccVersion], ['em++', emxxVersion]]) {
    if (!version.includes(`Emscripten gcc/clang-like replacement + linker emulating GNU ld) ${EMSCRIPTEN_VERSION}`)) {
      fail(`${label} must be Emscripten ${EMSCRIPTEN_VERSION}`)
    }
    if (!version.includes(EMSCRIPTEN_REVISION)) fail(`${label} must use Emscripten revision ${EMSCRIPTEN_REVISION}`)
  }

  const gitOptions = { cwd: output, env }
  await assertSourceClean(source, gitOptions, 'Bullet3 source checkout')

  const buildDirectory = join(output, 'build')
  const installDirectory = join(output, 'install_root')
  const linkDirectory = join(output, 'link')
  const linkJavaScript = join(linkDirectory, 'bullet3.js')
  const linkWasm = join(linkDirectory, EXPECTED_ARTIFACT.name)
  await mkdir(linkDirectory, { recursive: true })

  run('emcmake', [
    'cmake',
    '-S', source,
    '-B', buildDirectory,
    '-G', 'Ninja',
    `-DCMAKE_TOOLCHAIN_FILE=${toolchain}`,
    '-DCMAKE_BUILD_TYPE=Release',
    `-DCMAKE_INSTALL_PREFIX=${installDirectory}`,
    ...CMAKE_OPTIONS,
  ], commandOptions, 'CMake configure')
  run('nice', [
    '-n', '10',
    'cmake', '--build', buildDirectory,
    '--target', 'install',
    '--parallel', '4',
    '--config', 'Release',
  ], commandOptions, 'Bullet3 CPU library build')

  for (const library of ['BulletDynamics', 'BulletCollision', 'LinearMath']) {
    await requireFile(join(buildDirectory, 'src', library, `lib${library}.a`), `${library} static library`)
  }

  run('em++', [
    '-O2',
    '-DNDEBUG',
    '-std=c++11',
    `-I${join(source, 'src')}`,
    '-s', 'MODULARIZE=1',
    '-s', 'EXPORT_ES6=1',
    '-s', 'ENVIRONMENT=web,node',
    '-s', 'ASSERTIONS=1',
    '-s', 'ALLOW_MEMORY_GROWTH=1',
    '-s', 'EXPORTED_FUNCTIONS=["_bullet_version","_bullet_step"]',
    '-o', linkJavaScript,
    join(dirname(fileURLToPath(import.meta.url)), 'bullet_abi.cpp'),
    join(buildDirectory, 'src', 'BulletDynamics', 'libBulletDynamics.a'),
    join(buildDirectory, 'src', 'BulletCollision', 'libBulletCollision.a'),
    join(buildDirectory, 'src', 'LinearMath', 'libLinearMath.a'),
  ], commandOptions, 'Bullet3 ABI link')

  await verifyArtifact(linkWasm, EXPECTED_ARTIFACT, 'linked WASM')
  await verifyWasmModule(linkWasm)
  await copyFile(linkWasm, join(output, EXPECTED_ARTIFACT.name))
  await verifyArtifact(join(output, EXPECTED_ARTIFACT.name), EXPECTED_ARTIFACT, 'promoted WASM')
  await assertSourceClean(source, gitOptions, 'Bullet3 source checkout after build')

  console.log(`Bullet3 raw WASM artifact verified in ${output}`)
  console.log(`  ${EXPECTED_ARTIFACT.name}: ${EXPECTED_ARTIFACT.byteSize} bytes, ${EXPECTED_ARTIFACT.sha256}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
