import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_REVISION_FULL = '11a2381011cb6d42e61cc4c195e0f920864bf8d3'
const SOURCE_REVISION = SOURCE_REVISION_FULL.slice(0, 12)
const EMSCRIPTEN_VERSION = '6.0.6-git'
const EMSCRIPTEN_REVISION = 'ce75e06884093bcefb86a6b8fd56a5d62a4cc245'
const ARTIFACT_NAME = 'cantera.wasm'
const COMPANION_NAME = 'cantera.js'
const MAX_MEMORY_BYTES = 268435456
const MAX_ARTIFACT_BYTES = 67108864

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const defaultSource = resolve(projectRoot, '../awesome-physics-repos/cantera')
const defaultToolchain = '/usr/lib/emscripten/cmake/Modules/Platform/Emscripten.cmake'
const scriptDirectory = dirname(fileURLToPath(import.meta.url))

function fail(message) {
  throw new Error(`Cantera build failed: ${message}`)
}

function usage() {
  return [
    'Usage: node scripts/awesomePhysics/wasm/cantera/build.mjs --output <empty out-of-tree-dir> [options]',
    '',
    'Options:',
    `  --source <dir>       Pinned Cantera checkout (default: ${defaultSource})`,
    '  --output <dir>       Empty out-of-tree build/output directory (required)',
    '  --em-cache <dir>     Pinned Emscripten cache (or EM_CACHE)',
    `  --toolchain <file>   Emscripten CMake toolchain file (default: ${defaultToolchain})`,
    '  --help               Show this help',
  ].join('\n')
}

function parseArguments(argv) {
  const values = {
    source: process.env.CANTERA_SOURCE ?? defaultSource,
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

async function assertSourceClean(source, gitOptions, label) {
  const head = capture('git', ['-C', source, 'rev-parse', 'HEAD'], gitOptions, `${label} revision`).trim()
  if (head !== SOURCE_REVISION_FULL || !head.startsWith(SOURCE_REVISION)) {
    fail(`${label} is at ${head}, expected ${SOURCE_REVISION_FULL}`)
  }
  const status = capture('git', ['-C', source, 'status', '--porcelain=v1'], gitOptions, `${label} status`).trim()
  if (status.length > 0) fail(`${label} is not clean:\n${status}`)
}

function createWasmImports() {
  const nop = () => 0
  return {
    env: {
      _abort_js() {
        throw new Error('Cantera WASM aborted')
      },
      emscripten_resize_heap() {
        return 0
      },
      emscripten_notify_memory_growth: nop,
      __cxa_throw() {
        throw new Error('Cantera WASM exception')
      },
      __cxa_begin_catch: nop,
      __cxa_end_catch: nop,
      __cxa_find_matching_catch_2: nop,
      __cxa_find_matching_catch_3: nop,
      __resumeException: nop,
      _setjmp: nop,
      _longjmp() {
        throw new Error('Cantera WASM longjmp')
      },
    },
    wasi_snapshot_preview1: {
      fd_close: nop,
      fd_seek: nop,
      fd_write: nop,
      fd_read: nop,
      fd_fdstat_get: nop,
      environ_get: nop,
      environ_sizes_get: nop,
      clock_time_get: nop,
      random_get: nop,
      proc_exit() {
        throw new Error('Cantera WASM proc_exit')
      },
    },
  }
}

async function smokeWasm(path) {
  const bytes = await readFile(path)
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) {
    fail(`WASM is ${bytes.byteLength} bytes, over the ${MAX_ARTIFACT_BYTES}-byte artifact budget`)
  }
  const module = await WebAssembly.compile(bytes)
  const imports = {}
  for (const entry of WebAssembly.Module.imports(module)) {
    if (!Object.hasOwn(imports, entry.module)) imports[entry.module] = {}
    const provided = createWasmImports()[entry.module]?.[entry.name]
    imports[entry.module][entry.name] = provided ?? (() => 0)
  }
  const instance = await WebAssembly.instantiate(module, imports)
  const exports = instance.exports
  if (typeof exports._initialize === 'function') exports._initialize()
  else if (typeof exports.__wasm_call_ctors === 'function') exports.__wasm_call_ctors()
  if (typeof exports.cantera_run !== 'function' || typeof exports.cantera_out !== 'function') {
    fail('WASM scalar ABI exports are missing')
  }
  const thermoOk = exports.cantera_run(0, 1001, 101325, 0)
  const enthalpy = exports.cantera_out(0)
  if (thermoOk !== 1 || !Number.isFinite(enthalpy)) fail(`thermo smoke failed: status=${thermoOk} h=${enthalpy}`)
  const eqOk = exports.cantera_run(1, 1001, 101325, 0)
  const tEq = exports.cantera_out(0)
  if (eqOk !== 1 || !Number.isFinite(tEq) || tEq <= 1001) fail(`equilibrate smoke failed: status=${eqOk} T=${tEq}`)
  const reactorOk = exports.cantera_run(2, 1001, 101325, 0.001)
  const tReactor = exports.cantera_out(0)
  if (reactorOk !== 1 || !Number.isFinite(tReactor)) fail(`reactor smoke failed: status=${reactorOk} T=${tReactor}`)
  return {
    imports: WebAssembly.Module.imports(module).map((entry) => `${entry.module}.${entry.name}`).sort(),
    exports: WebAssembly.Module.exports(module).map(({ name }) => name).sort(),
    smoke: {
      enthalpy,
      equilibriumTemperature: tEq,
      reactorTemperature: tReactor,
    },
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const source = options.source
  const output = options.output
  const emCache = options.emCache
  const toolchain = options.toolchain

  await requireDirectory(source, 'Cantera source checkout')
  await mkdir(emCache, { recursive: true })
  await requireDirectory(emCache, 'Emscripten cache')
  if (!isAbsolute(toolchain)) fail(`Emscripten toolchain must be an absolute path: ${toolchain}`)
  await requireFile(toolchain, 'Emscripten toolchain')
  if (isInside(source, output) || isInside(output, source)) {
    fail(`source and output must be separate out-of-tree paths: ${source} / ${output}`)
  }

  for (const [relativePath, kind] of [
    ['License.txt', 'Cantera license'],
    ['include/cantera/core.h', 'Cantera core header'],
    ['include/cantera/zerodim.h', 'Cantera zero-D header'],
    ['src/thermo', 'Cantera thermo source'],
    ['src/equil', 'Cantera equilibrium source'],
    ['src/zeroD', 'Cantera zero-D source'],
    ['data/h2o2.yaml', 'selected h2o2 mechanism'],
  ]) {
    const path = join(source, relativePath)
    if (relativePath.endsWith('.txt') || relativePath.endsWith('.h') || relativePath.endsWith('.yaml')) {
      await requireFile(path, kind)
    } else {
      await requireDirectory(path, kind)
    }
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
  await assertSourceClean(source, gitOptions, 'Cantera source checkout')

  const buildDirectory = join(output, 'build')
  const linkDirectory = join(output, 'link')
  await mkdir(linkDirectory, { recursive: true })

  run('emcmake', [
    'cmake',
    '-S', scriptDirectory,
    '-B', buildDirectory,
    '-G', 'Ninja',
    `-DCMAKE_TOOLCHAIN_FILE=${toolchain}`,
    '-DCMAKE_BUILD_TYPE=Release',
    '-DCMAKE_POLICY_VERSION_MINIMUM=3.5',
    `-DCANTERA_SOURCE=${source}`,
    `-DCANTERA_H2O2_YAML=${join(scriptDirectory, 'h2o2.yaml')}`,
  ], commandOptions, 'CMake configure')
  run('nice', [
    '-n', '10',
    'cmake', '--build', buildDirectory,
    '--target', 'cantera_abi',
    '--parallel', '4',
    '--config', 'Release',
  ], commandOptions, 'Cantera static library and ABI link')

  const linkWasm = join(buildDirectory, ARTIFACT_NAME)
  const companionSource = join(scriptDirectory, COMPANION_NAME)

  await requireFile(linkWasm, 'linked WASM')
  await requireFile(companionSource, 'companion JavaScript source')
  const wasmIntegrity = await sha256(linkWasm)
  const jsIntegrity = await sha256(companionSource)
  const smoke = await smokeWasm(linkWasm)

  const ledger = {
    source: { path: 'awesome-physics-repos/cantera', revision: SOURCE_REVISION_FULL },
    toolchain: { emscripten: EMSCRIPTEN_VERSION, revision: EMSCRIPTEN_REVISION },
    artifact: {
      wasm: { name: ARTIFACT_NAME, path: `wasm/awesomePhysics/cantera/${ARTIFACT_NAME}`, ...wasmIntegrity },
      javascript: { name: COMPANION_NAME, path: `wasm/awesomePhysics/cantera/${COMPANION_NAME}`, ...jsIntegrity },
    },
    smoke,
  }
  await writeFile(join(output, 'build-ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`)
  await copyFile(linkWasm, join(output, ARTIFACT_NAME))
  await copyFile(companionSource, join(output, COMPANION_NAME))
  await assertSourceClean(source, gitOptions, 'Cantera source checkout after build')
  console.log(JSON.stringify(ledger, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
