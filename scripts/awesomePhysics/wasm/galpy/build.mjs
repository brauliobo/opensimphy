import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_REVISION = '3762e73ef84578f4a911325d283e652eb1886625'
const EMSCRIPTEN_VERSION = '6.0.6-git'
const EMSCRIPTEN_REVISION = 'ce75e06884093bcefb86a6b8fd56a5d62a4cc245'
const ARTIFACT = Object.freeze({
  wasm: Object.freeze({
    name: 'galpy.wasm',
    path: 'wasm/awesomePhysics/galpy/galpy.wasm',
    byteSize: 19591,
    sha256: '0e053c12eaa70b3bf771697505acaa049269c481c7d1f9ac363e8f5cf08f7720',
  }),
  javascript: Object.freeze({
    name: 'galpy.js',
    path: 'wasm/awesomePhysics/galpy/galpy.js',
    byteSize: 594,
    sha256: 'becd50f707575c4e8ad3fb45c67e9e5ffcdfed57401a08c33b4169daad427696',
  }),
})
const ABI_EXPORTS = Object.freeze([
  'galpy_orbit_init',
  'galpy_orbit_step',
  'galpy_orbit_R',
  'galpy_orbit_z',
  'galpy_orbit_phi',
  'galpy_orbit_vR',
  'galpy_orbit_vT',
  'galpy_orbit_vz',
  'galpy_orbit_energy',
  'galpy_orbit_Lz',
  'galpy_rforce',
  'galpy_zforce',
  'galpy_circular_velocity',
])

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const defaultSource = resolve(projectRoot, '../awesome-physics-repos/galpy')
const defaultEmscriptenRoot = process.env.EMSCRIPTEN_ROOT ?? '/usr/lib/emscripten'
const companionSource = resolve(projectRoot, 'scripts/awesomePhysics/wasm/galpy/galpy.js')
const abiSource = resolve(projectRoot, 'scripts/awesomePhysics/wasm/galpy/galpy_abi.c')

function fail(message) {
  throw new Error(`galpy WASM build failed: ${message}`)
}

function usage() {
  return [
    'Usage: node scripts/awesomePhysics/wasm/galpy/build.mjs --output <empty out-of-tree-dir> [options]',
    '',
    'Options:',
    `  --source <dir>             Pinned galpy checkout (default: ${defaultSource})`,
    '  --output <dir>             Empty out-of-tree build/output directory (required)',
    `  --emscripten-root <dir>    Pinned Emscripten root (default: ${defaultEmscriptenRoot})`,
    '  --em-cache <dir>           Pinned Emscripten cache (or EM_CACHE)',
    '  --record                   Write the observed hashes instead of verifying them',
    '  --help                     Show this help',
  ].join('\n')
}

function parseArguments(argv) {
  const values = {
    source: process.env.GALPY_SOURCE ?? defaultSource,
    output: undefined,
    emscriptenRoot: defaultEmscriptenRoot,
    emCache: process.env.EM_CACHE,
    record: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help') {
      console.log(usage())
      process.exit(0)
    }
    if (argument === '--record') {
      values.record = true
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
    ...Object.fromEntries(Object.entries(values).map(([key, value]) => (
      key === 'record' || value === undefined || typeof value === 'boolean' ? [key, value] : [key, resolve(value)]
    ))),
  }
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

async function verifyArtifact(path, expected, label, record) {
  const actual = await sha256(path)
  if (record) return actual
  if (actual.byteSize !== expected.byteSize || actual.sha256 !== expected.sha256) {
    fail(`${label} differs: expected ${expected.byteSize} bytes/${expected.sha256}, got ${actual.byteSize} bytes/${actual.sha256}`)
  }
  return actual
}

async function assertSourceClean(source, options, label) {
  const head = capture('git', ['-C', source, 'rev-parse', 'HEAD'], options, `${label} revision`).trim()
  if (head !== SOURCE_REVISION) fail(`${label} is at ${head}, expected ${SOURCE_REVISION}`)
  const status = capture('git', ['-C', source, 'status', '--porcelain=v1'], options, `${label} status`).trim()
  if (status.length > 0) fail(`${label} is not clean:\n${status}`)
}

async function proveOrbit(wasmPath) {
  const bytes = await readFile(wasmPath)
  const module = await WebAssembly.compile(bytes)
  const imports = WebAssembly.Module.imports(module)
  if (imports.length > 0) fail(`standalone module has imports: ${imports.map(({ module: name, name: exportName }) => `${name}.${exportName}`).join(', ')}`)
  const exports = WebAssembly.Module.exports(module).map(({ name }) => name)
  for (const name of ABI_EXPORTS) {
    if (!exports.includes(name)) fail(`missing export ${name}`)
  }
  const instance = await WebAssembly.instantiate(module, {})
  const abi = instance.exports
  const vc = abi.galpy_circular_velocity(1)
  if (!Number.isFinite(vc) || Math.abs(vc - 1) > 1e-8) fail(`MWPotential2014 circular velocity at R=1 is ${vc}, expected 1`)
  if (abi.galpy_orbit_init(1, 0.1, 0, 0, 1, 0) !== 1) fail('orbit init rejected a bounded MWPotential2014 state')
  const energy0 = abi.galpy_orbit_energy()
  const lz0 = abi.galpy_orbit_Lz()
  for (let step = 0; step < 200; step += 1) {
    if (abi.galpy_orbit_step(0.01) !== 1) fail(`orbit step ${step} failed`)
  }
  const energy1 = abi.galpy_orbit_energy()
  const lz1 = abi.galpy_orbit_Lz()
  if (!Number.isFinite(energy0) || !Number.isFinite(energy1)) fail('orbit energy is not finite')
  if (Math.abs(lz1 - lz0) > 1e-10) fail(`Lz drifted from ${lz0} to ${lz1}`)
  if (Math.abs(energy1 - energy0) > 1e-4) fail(`energy drifted from ${energy0} to ${energy1}`)
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const source = options.source
  const output = options.output
  const emscriptenRoot = options.emscriptenRoot
  const emcc = join(emscriptenRoot, 'emcc')
  const emconfig = join(emscriptenRoot, 'em-config')

  await requireDirectory(source, 'galpy source checkout')
  await requireFile(join(source, 'LICENSE'), 'galpy LICENSE')
  await requireFile(join(source, 'galpy/potential/mwpotentials.py'), 'MWPotential2014 source')
  await requireFile(abiSource, 'ABI source')
  await requireFile(companionSource, 'companion JavaScript')
  await requireDirectory(emscriptenRoot, 'Emscripten root')
  await requireFile(emcc, 'Emscripten C compiler')
  await requireFile(emconfig, 'Emscripten configuration tool')
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

  await assertSourceClean(source, commandOptions, 'galpy source checkout')

  const wasmPath = join(output, ARTIFACT.wasm.name)
  const javascriptPath = join(output, ARTIFACT.javascript.name)
  const exported = ABI_EXPORTS.map((name) => `_${name}`).join(',')
  run('nice', [
    '-n', '10',
    emcc,
    '-std=c11',
    '-O3',
    '-DNDEBUG',
    '-fno-exceptions',
    `-ffile-prefix-map=${projectRoot}=/opensimphy`,
    `--no-entry`,
    '-sSTANDALONE_WASM=1',
    `-sEXPORTED_FUNCTIONS=[${exported.split(',').map((name) => `"${name}"`).join(',')}]`,
    '-sFILESYSTEM=0',
    '-sMALLOC=none',
    '-sSTACK_SIZE=65536',
    '-sINITIAL_MEMORY=1048576',
    '-sALLOW_MEMORY_GROWTH=0',
    '-Wl,--gc-sections',
    abiSource,
    '-o', wasmPath,
  ], commandOptions, 'standalone WASM link')
  await copyFile(companionSource, javascriptPath)

  await proveOrbit(wasmPath)
  const wasm = await verifyArtifact(wasmPath, ARTIFACT.wasm, 'standalone WASM artifact', options.record)
  const javascript = await verifyArtifact(javascriptPath, ARTIFACT.javascript, 'companion JavaScript artifact', options.record)
  await assertSourceClean(source, commandOptions, 'galpy source checkout after build')

  const ledger = {
    schemaVersion: 1,
    artifact: {
      wasm: { name: ARTIFACT.wasm.name, path: ARTIFACT.wasm.path, ...wasm },
      javascript: { name: ARTIFACT.javascript.name, path: ARTIFACT.javascript.path, ...javascript },
    },
    source: {
      checkout: 'awesome-physics-repos/galpy',
      revision: SOURCE_REVISION,
      translationUnits: [
        'scripts/awesomePhysics/wasm/galpy/galpy_abi.c',
        'scripts/awesomePhysics/wasm/galpy/galpy.js',
      ],
    },
    toolchain: {
      name: 'Emscripten',
      version: EMSCRIPTEN_VERSION,
      revision: EMSCRIPTEN_REVISION,
    },
    abi: {
      exports: [...ABI_EXPORTS],
      memory: 'standalone linear memory; no browser pointer ABI',
      status: 'i32 0 or 1',
    },
    build: {
      script: 'scripts/awesomePhysics/wasm/galpy/build.mjs',
      parallelism: 1,
      flags: [
        '-sSTANDALONE_WASM=1',
        '-sFILESYSTEM=0',
        '-sMALLOC=none',
        '-sINITIAL_MEMORY=1048576',
        '-sALLOW_MEMORY_GROWTH=0',
      ],
    },
    verification: [
      'source checkout is clean before and after the build',
      'source revision and toolchain version/revision are pinned',
      'raw module has no imports and contains the scalar ABI exports',
      'MWPotential2014 circular velocity at R=1 is 1',
      'bounded leapfrog conserves Lz and keeps energy drift below 1e-4',
      'artifact byte size and SHA-256 are fixed',
    ],
  }
  await writeFile(join(output, 'build-ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`)

  console.log(`galpy standalone WASM artifact verified in ${output}`)
  console.log(`  ${ARTIFACT.wasm.name}: ${wasm.byteSize} bytes, ${wasm.sha256}`)
  console.log(`  ${ARTIFACT.javascript.name}: ${javascript.byteSize} bytes, ${javascript.sha256}`)
  console.log(`  exports: ${ABI_EXPORTS.join(', ')}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
