import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_REVISION = '4db89c1ce8d0b0d98ba7f03594f58a845351cf6a'
const EMSCRIPTEN_VERSION = '6.0.6-git'
const EMSCRIPTEN_REVISION = 'ce75e06884093bcefb86a6b8fd56a5d62a4cc245'
const EXPECTED_ARTIFACTS = Object.freeze({
  javascript: Object.freeze({
    name: 'coolprop.js',
    byteSize: 171012,
    sha256: '0ffde908dc61430b78e02f5b60a1eee04d4b80f69af72739235b3ecb16eac7f6',
  }),
  wasm: Object.freeze({
    name: 'coolprop.wasm',
    byteSize: 9352503,
    sha256: '14a7efa251ea9bd443d37a6629206434689894d12f123202dc9d698a5607f762',
  }),
})
const REQUIRED_CPM_ENTRIES = Object.freeze([
  'eigen/b88d48afc3865e4a87dc2aa33ea6bb27abd7ff6f',
  'msgpack-c/6463fbc0e9b83855e8993486702b92b336ccd82c',
  'nlohmann_json/b88ca108e0b5a597e859a21658d11fa5f1feb410',
  'valijson/c12f264a745d9884a7b08969e884214b9513c5f1',
  'if97/1eddb61ca0f43b871b0b634bb994d6e2fd6e2cbb',
  'refprop_headers/4a1980fd75e1f9f2ff1052454ad3b9c2ebe77267',
  'boost_headers/dde1010b2e20024ecbefff57339ce749b7f129ef',
  'multicomplex/b41b93e0babdab133c77234ee47fc4ba7c75d0ac',
  'fmt/061b919778e4fd42e0892d713069255107b7205b',
])
const LINK_OPTIONS = `# Generated in the out-of-tree build directory; the pinned checkout is never edited.
function(opencode_classic_worker_link_options)
  if(NOT TARGET coolprop)
    message(FATAL_ERROR "CoolProp JavaScript target was not created")
  endif()

  set(CMAKE_EXE_LINKER_FLAGS "" PARENT_SCOPE)
  set_property(TARGET coolprop PROPERTY LINK_OPTIONS "")
  set_property(
    TARGET coolprop
    PROPERTY LINK_FLAGS
      "-lembind -sASSERTIONS=1 -sDISABLE_EXCEPTION_CATCHING=0 -sALLOW_MEMORY_GROWTH=1 -sEXPORT_ES6=0 -sMODULARIZE=1 -sENVIRONMENT=web,worker,node"
  )
endfunction()

cmake_language(DEFER CALL opencode_classic_worker_link_options)
`

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const defaultSource = resolve(projectRoot, '../awesome-physics-repos/CoolProp')

function fail(message) {
  throw new Error(`CoolProp build failed: ${message}`)
}

function usage() {
  return [
    'Usage: node scripts/awesomePhysics/wasm/coolprop/build.mjs --output <out-of-tree-dir> [options]',
    '',
    'Options:',
    `  --source <dir>       Pinned CoolProp checkout (default: ${defaultSource})`,
    '  --output <dir>       Empty out-of-tree build/output directory (required)',
    '  --cpm-cache <dir>    Complete pinned CPM source cache (or CPM_SOURCE_CACHE)',
    '  --em-cache <dir>     Pinned Emscripten cache (or EM_CACHE)',
    '  --toolchain <file>   Emscripten CMake toolchain file',
    '  --help               Show this help',
  ].join('\n')
}

function parseArguments(argv) {
  const values = {
    source: process.env.COOLPROP_SOURCE ?? defaultSource,
    output: undefined,
    cpmCache: process.env.CPM_SOURCE_CACHE,
    emCache: process.env.EM_CACHE,
    toolchain: process.env.EMSCRIPTEN_TOOLCHAIN_FILE ?? '/usr/lib/emscripten/cmake/Modules/Platform/Emscripten.cmake',
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
      '--cpm-cache': 'cpmCache',
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
  if (values.cpmCache === undefined) fail('--cpm-cache or CPM_SOURCE_CACHE is required')
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
  if (head !== SOURCE_REVISION) fail(`${label} is at ${head}, expected ${SOURCE_REVISION}`)
  const status = capture('git', ['-C', source, 'status', '--porcelain=v1'], gitOptions, `${label} status`).trim()
  if (status.length > 0) fail(`${label} is not clean:\n${status}`)
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const source = options.source
  const output = options.output
  const cpmCache = options.cpmCache
  const emCache = options.emCache
  const toolchain = options.toolchain

  await requireDirectory(source, 'CoolProp source checkout')
  await requireDirectory(cpmCache, 'CPM source cache')
  await requireDirectory(emCache, 'Emscripten cache')
  if (!isAbsolute(toolchain)) fail(`Emscripten toolchain must be an absolute path: ${toolchain}`)
  try {
    await stat(toolchain)
  } catch (error) {
    fail(`Emscripten toolchain is unavailable at ${toolchain}: ${error.message}`)
  }
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
  for (const entry of REQUIRED_CPM_ENTRIES) await requireDirectory(join(cpmCache, entry), `Pinned CPM dependency ${entry}`)

  const emscriptenRoot = resolve(dirname(toolchain), '../../..')
  const env = {
    ...process.env,
    PATH: `${emscriptenRoot}:${process.env.PATH ?? ''}`,
    CPM_SOURCE_CACHE: cpmCache,
    EM_CACHE: emCache,
  }
  const commandOptions = { cwd: output, env }
  const emccVersion = capture('emcc', ['--version'], commandOptions, 'Emscripten version')
  if (!emccVersion.includes(EMSCRIPTEN_VERSION) || !emccVersion.includes(EMSCRIPTEN_REVISION)) {
    fail(`Emscripten must be ${EMSCRIPTEN_VERSION} revision ${EMSCRIPTEN_REVISION}`)
  }

  const gitOptions = { cwd: output, env }
  await assertSourceClean(source, gitOptions, 'CoolProp source checkout')

  const sourceStage = join(output, 'source')
  const buildDirectory = join(output, 'build')
  const installDirectory = join(output, 'install_root')
  const linkOptionsPath = join(output, 'classic-worker-link-options.cmake')
  run('cp', ['-a', source, sourceStage], commandOptions, 'source copy')
  for (const entry of ['.git', '.cpm_cache', 'build', 'build-wasm', 'install_root']) {
    await rm(join(sourceStage, entry), { recursive: true, force: true })
  }
  for (const cacheName of ['.fluiddepcache', '.incompdepcache']) {
    const cachePath = join(sourceStage, 'dev', cacheName)
    try {
      const cache = JSON.parse(await readFile(cachePath, 'utf8'))
      if (Array.isArray(cache.sorted_sources)) {
        cache.sorted_sources = cache.sorted_sources.map((path) => {
          if (typeof path !== 'string') return path
          const suffix = relative(source, path)
          return isAbsolute(suffix) || suffix === '..' || suffix.startsWith(`..${sep}`)
            ? path
            : join(sourceStage, suffix)
        })
        await writeFile(cachePath, JSON.stringify(cache), 'utf8')
      }
    } catch (error) {
      if (error.code !== 'ENOENT') fail(`cannot normalize ${cacheName}: ${error.message}`)
    }
  }
  await writeFile(join(sourceStage, 'dev', 'gitrevision.txt'), `${SOURCE_REVISION}\n`, 'utf8')
  await writeFile(linkOptionsPath, LINK_OPTIONS, 'utf8')

  run('cmake', [
    '-S', sourceStage,
    '-B', buildDirectory,
    '-G', 'Ninja',
    `-DCMAKE_TOOLCHAIN_FILE=${toolchain}`,
    '-DCOOLPROP_JAVASCRIPT_MODULE:BOOL=ON',
    '-DCMAKE_BUILD_TYPE=Release',
    `-DCOOLPROP_INSTALL_PREFIX=${installDirectory}`,
    `-DCPM_SOURCE_CACHE=${cpmCache}`,
    `-DCMAKE_CXX_FLAGS:STRING=-DEMSCRIPTEN -ffile-prefix-map=${sourceStage}=${source}`,
    `-DCMAKE_PROJECT_TOP_LEVEL_INCLUDES=${linkOptionsPath}`,
    '-DCMAKE_EXPORT_COMPILE_COMMANDS:BOOL=ON',
  ], commandOptions, 'CMake configure')
  run('nice', [
    '-n', '10',
    'cmake', '--build', buildDirectory,
    '--target', 'install',
    '--parallel', '4',
    '--config', 'Release',
  ], commandOptions, 'CMake build')

  const buildJavaScript = join(buildDirectory, EXPECTED_ARTIFACTS.javascript.name)
  const buildWasm = join(buildDirectory, EXPECTED_ARTIFACTS.wasm.name)
  await verifyArtifact(buildJavaScript, EXPECTED_ARTIFACTS.javascript, 'built JavaScript')
  await verifyArtifact(buildWasm, EXPECTED_ARTIFACTS.wasm, 'built WASM')
  await verifyArtifact(join(installDirectory, 'Javascript', EXPECTED_ARTIFACTS.javascript.name), EXPECTED_ARTIFACTS.javascript, 'installed JavaScript')
  await verifyArtifact(join(installDirectory, 'Javascript', EXPECTED_ARTIFACTS.wasm.name), EXPECTED_ARTIFACTS.wasm, 'installed WASM')

  await copyFile(buildJavaScript, join(output, EXPECTED_ARTIFACTS.javascript.name))
  await copyFile(buildWasm, join(output, EXPECTED_ARTIFACTS.wasm.name))
  await verifyArtifact(join(output, EXPECTED_ARTIFACTS.javascript.name), EXPECTED_ARTIFACTS.javascript, 'promoted JavaScript')
  await verifyArtifact(join(output, EXPECTED_ARTIFACTS.wasm.name), EXPECTED_ARTIFACTS.wasm, 'promoted WASM')
  await assertSourceClean(source, gitOptions, 'CoolProp source checkout after build')

  console.log(`CoolProp classic-worker artifacts verified in ${output}`)
  console.log(`  ${EXPECTED_ARTIFACTS.javascript.name}: ${EXPECTED_ARTIFACTS.javascript.byteSize} bytes, ${EXPECTED_ARTIFACTS.javascript.sha256}`)
  console.log(`  ${EXPECTED_ARTIFACTS.wasm.name}: ${EXPECTED_ARTIFACTS.wasm.byteSize} bytes, ${EXPECTED_ARTIFACTS.wasm.sha256}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
