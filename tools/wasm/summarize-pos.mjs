import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [scalarPath, vectorPath, outputPath, metadataPath] = process.argv.slice(2)
if (!metadataPath) throw new Error('usage: summarize-pos.mjs v.pos e.pos output.json metadata.env')
const root = fileURLToPath(new URL('../..', import.meta.url))
const versions = Object.fromEntries((await readFile(join(root, 'tools/wasm/versions.env'), 'utf8')).trim().split('\n').map((line) => line.split('=', 2)))
const lock = JSON.parse(await readFile(join(root, 'tools/wasm/artifacts.lock.json'), 'utf8'))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')

function records(path, components, source) {
  const pattern = components === 1 ? /S([PTQLSHIY])\(([^)]*)\)\{([^}]*)\};/g : /V([PTQLSHIY])\(([^)]*)\)\{([^}]*)\};/g
  const nodeCounts = { P: 1, L: 2, T: 3, Q: 4, S: 4, H: 8, I: 6, Y: 5 }
  const out = []
  for (const match of source.matchAll(pattern)) {
    const nodes = nodeCounts[match[1]]
    const coordinates = match[2].split(',').map(Number)
    const values = match[3].split(',').map(Number)
    for (let node = 0; node < nodes; node++) {
      out.push({
        coordinate: coordinates.slice(node * 3, node * 3 + 3),
        value: values.slice(node * components, (node + 1) * components),
      })
    }
  }
  if (!out.length) throw new Error(`no field values in ${path}`)
  return out
}

function summary(records, components) {
  const values = records.map(({ value }) => components === 1 ? value[0] : Math.hypot(...value))
  return { min: Math.min(...values), max: Math.max(...values), mean: values.reduce((sum, value) => sum + value, 0) / values.length, samples: values.length }
}

function nearest(records, coordinate) {
  return records.reduce((best, record) => {
    const distance = Math.hypot(...record.coordinate.map((value, index) => value - coordinate[index]))
    return distance < best.distance ? { record, distance } : best
  }, { record: records[0], distance: Infinity }).record
}

const scalarBytes = await readFile(scalarPath)
const vectorBytes = await readFile(vectorPath)
const scalarRecords = records(scalarPath, 1, scalarBytes.toString())
const vectorRecords = records(vectorPath, 3, vectorBytes.toString())
const targets = [['ground-near', [0.0004, 0.0002, 0]], ['substrate', [0.0013, 0.0007, 0]], ['air', [0.0032, 0.00055, 0]]]
const samples = targets.map(([key, target]) => {
  const scalar = nearest(scalarRecords, target)
  const vector = nearest(vectorRecords, scalar.coordinate)
  return { key, coordinate: scalar.coordinate, scalar: scalar.value[0], vector: vector.value, magnitude: Math.hypot(...vector.value) }
})
const metadata = Object.fromEntries((await readFile(metadataPath, 'utf8')).trim().split('\n').map((line) => line.split('=', 2)))
const reference = {
  schema: 2,
  provenance: {
    generation: { command: 'JOBS=4 nice npm run wasm:reference', date: lock.generationDate },
    compiler: {
      image: versions.EMSDK_IMAGE,
      native: metadata.compiler,
      executableSha256: metadata.compiler_sha256,
      scalarType: 'real-double',
      petscConfigSha256: metadata.petsc_config_sha256,
      getdpConfigSha256: metadata.getdp_config_sha256,
      blasLapack: { url: versions.F2CBLASLAPACK_URL, sha256: versions.F2CBLASLAPACK_SHA256 },
    },
    sources: {
      gmsh: { url: versions.GMSH_URL, commit: versions.GMSH_REVISION, tree: versions.GMSH_TREE },
      getdp: { url: versions.GETDP_URL, commit: versions.GETDP_REVISION, tree: versions.GETDP_TREE },
      petsc: { url: versions.PETSC_URL, commit: versions.PETSC_REVISION, tree: versions.PETSC_TREE },
    },
    patches: lock.patches,
    fixtures: lock.fixtures,
    outputs: { 'v.pos': hash(scalarBytes), 'e.pos': hash(vectorBytes) },
  },
  nodes: Number(metadata.nodes), elements: Number(metadata.elements),
  initialResidual: Number(metadata.initial_residual), residual: Number(metadata.residual),
  convergenceRatio: Number(metadata.residual) / Number(metadata.initial_residual),
  scalar: summary(scalarRecords, 1), vector: summary(vectorRecords, 3), samples,
  tolerance: {
    residualAbsolute: 2e-29,
    residualRelative: 1e-10,
    scalarSampleAbsolute: 1e-12,
    scalarAggregateAbsolute: 1e-13,
    vectorAbsolute: 1e-10,
    relative: 1e-9,
    coordinateAbsolute: 1e-15,
  },
}
if (!(reference.initialResidual > 0 && reference.residual >= 0 && reference.convergenceRatio < 1e-12)) throw new Error('native PETSc solve did not converge sufficiently')
await writeFile(outputPath, `${JSON.stringify(reference, null, 2)}\n`)
console.log(JSON.stringify(reference, null, 2))
