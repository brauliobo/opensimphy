#!/usr/bin/env node

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_REVISION = '944fd33fa42301929f760858ba5506affc025d8c'
const EMSCRIPTEN_VERSION = '6.0.6-git'
const EMSCRIPTEN_REVISION = 'ce75e06884093bcefb86a6b8fd56a5d62a4cc245'
const EMSCRIPTEN_TOOLCHAIN_SHA256 = 'fdca7d6b6ebe9c087aa7f0a0c7391b0b83fdb081160158f65aa1182cdc964718'
const COMPILE_MEMORY_MAX_KB = 8 * 1024 * 1024
const START_MEMORY_MIN_BYTES = 4 * 1024 * 1024 * 1024
const LAPACK_GATE = /Failed to compile using the BLAS\/LAPACK libraries/

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const defaultSource = resolve(projectRoot, '../awesome-physics-repos/simbody')
const defaultEmscriptenRoot = process.env.EMSCRIPTEN_ROOT ?? '/usr/lib/emscripten'

function fail(message) {
  throw new Error(`Simbody WASM build failed: ${message}`)
}

function usage() {
  return [
    'Usage: node scripts/awesomePhysics/wasm/simbody/build.mjs --output <empty out-of-tree-dir> [options]',
    '',
    'Options:',
    `  --source <dir>             Pinned Simbody checkout (default: ${defaultSource})`,
    '  --output <dir>             Empty out-of-tree build/output directory (required)',
    `  --emscripten-root <dir>    Pinned Emscripten root (default: ${defaultEmscriptenRoot})`,
    '  --em-cache <dir>           Pinned Emscripten cache (or EM_CACHE)',
    '  --help                     Show this help',
  ].join('\n')
}

function parseArguments(argv) {
  const values = {
    source: process.env.SIMBODY_SOURCE ?? defaultSource,
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

function capture(command, args, options, label) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.error) fail(`${label}: ${result.error.message}`)
  return result
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

async function sha256File(path) {
  const { createHash } = await import('node:crypto')
  const bytes = await readFile(path)
  return createHash('sha256').update(bytes).digest('hex')
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const source = options.source
  const output = options.output
  const emscriptenRoot = options.emscriptenRoot
  const emcc = join(emscriptenRoot, 'emcc')
  const emconfig = join(emscriptenRoot, 'em-config')
  const toolchain = join(emscriptenRoot, 'cmake/Modules/Platform/Emscripten.cmake')

  await requireDirectory(source, 'Simbody source checkout')
  await requireFile(join(source, 'LICENSE.txt'), 'Simbody Apache-2.0 license')
  await requireFile(join(source, 'CMakeLists.txt'), 'Simbody CMakeLists')
  await requireDirectory(emscriptenRoot, 'Emscripten root')
  await requireFile(emcc, 'Emscripten C compiler')
  await requireFile(emconfig, 'Emscripten configuration tool')
  await requireFile(toolchain, 'Emscripten CMake toolchain')
  if (isInside(source, output) || isInside(output, source)) fail(`source and output must be separate: ${source} / ${output}`)

  const available = memAvailableBytes()
  if (available < START_MEMORY_MIN_BYTES) fail(`MemAvailable ${available} bytes is below the ${START_MEMORY_MIN_BYTES}-byte start gate`)

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
  const emCache = options.emCache ?? capture(emconfig, ['CACHE'], commandOptions, 'Emscripten cache path').stdout.trim()
  await requireDirectory(emCache, 'Emscripten cache')
  env.EM_CACHE = emCache

  const emccVersion = capture(emcc, ['--version'], commandOptions, 'Emscripten version').stdout
  if (!emccVersion.includes(EMSCRIPTEN_VERSION) || !emccVersion.includes(EMSCRIPTEN_REVISION)) {
    fail(`Emscripten must be ${EMSCRIPTEN_VERSION} revision ${EMSCRIPTEN_REVISION}`)
  }
  const toolchainHash = await sha256File(toolchain)
  if (toolchainHash !== EMSCRIPTEN_TOOLCHAIN_SHA256) {
    fail(`Emscripten CMake toolchain hash differs: expected ${EMSCRIPTEN_TOOLCHAIN_SHA256}, got ${toolchainHash}`)
  }

  const head = capture('git', ['-C', source, 'rev-parse', 'HEAD'], commandOptions, 'Simbody revision').stdout.trim()
  if (head !== SOURCE_REVISION) fail(`source revision is ${head}, expected ${SOURCE_REVISION}`)
  const status = capture('git', ['-C', source, 'status', '--porcelain=v1'], commandOptions, 'Simbody status').stdout.trim()
  if (status.length > 0) fail(`source checkout is not clean:\n${status}`)

  const buildDirectory = join(output, 'simbody-build')
  const configure = spawnSync('bash', ['--noprofile', '--norc', '-c', [
    `ulimit -v ${COMPILE_MEMORY_MAX_KB}`,
    '&& exec nice cmake',
    `-S ${JSON.stringify(source)}`,
    `-B ${JSON.stringify(buildDirectory)}`,
    '-G Ninja',
    `-DCMAKE_TOOLCHAIN_FILE=${JSON.stringify(toolchain)}`,
    '-DCMAKE_BUILD_TYPE=Release',
    '-DSIMBODY_BUILD_SHARED_LIBS=OFF',
    '-DBUILD_VISUALIZER=OFF',
    '-DBUILD_EXAMPLES=OFF',
    '-DBUILD_TESTING=OFF',
    '-DINSTALL_DOCS=OFF',
  ].join(' ')], {
    cwd: output,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const log = `${configure.stdout}\n${configure.stderr}`
  await writeFile(join(output, 'configure.log'), log)
  if (configure.status === 0) {
    fail('CMake configure succeeded; a BLAS/LAPACK-capable Emscripten port must not be silently promoted')
  }
  if (!LAPACK_GATE.test(log)) {
    fail(`CMake configure failed without the BLAS/LAPACK gate:\n${log.slice(-4000)}`)
  }
  const gate = {
    schemaVersion: 1,
    status: 'blocked',
    reason: 'Unix CMake BLAS/LAPACK try_compile fails under Emscripten; vendored LAPACK is Windows-only.',
    sourceRevision: SOURCE_REVISION,
    emscripten: { version: EMSCRIPTEN_VERSION, revision: EMSCRIPTEN_REVISION },
    maxArtifactBytes: 67108864,
    maxMemoryBytes: 268435456,
  }
  await writeFile(join(output, 'gate-result.json'), `${JSON.stringify(gate, null, 2)}\n`)
  fail(`${gate.reason} Do not mount awesome-simbody-wasm.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
