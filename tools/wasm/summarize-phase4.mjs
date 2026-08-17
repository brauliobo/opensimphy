import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nativeConvergenceOracle } from './native-convergence.mjs'

const [resultsPath, outputPath, metadataPath] = process.argv.slice(2)
if (!metadataPath) throw new Error('usage: summarize-phase4.mjs results-directory output.json metadata.env')
const root = fileURLToPath(new URL('../..', import.meta.url))
const versions = Object.fromEntries((await readFile(join(root, 'tools/wasm/versions.env'), 'utf8')).trim().split('\n').map((line) => line.split('=', 2)))
const catalog = JSON.parse(await readFile(join(root, 'tools/wasm/fixtures/projects.json'), 'utf8'))
const metadata = Object.fromEntries((await readFile(metadataPath, 'utf8')).trim().split('\n').map((line) => line.split('=', 2)))
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

async function summarize(project) {
  const directory = join(resultsPath, project.id)
  const meshPath = join(directory, `${project.id}.msh`)
  const mesh = await readFile(meshPath, 'utf8')
  const log = await readFile(join(directory, 'getdp.log'), 'utf8')
  const files = (await readdir(directory)).filter((name) => name.endsWith('.pos')).sort()
  const convergence = nativeConvergenceOracle(log, project)
  const residuals = convergence.filter(({ kind }) => kind === 'linear').flatMap(({ residuals: values }) => values)
  const nonlinear = convergence.filter(({ kind }) => kind === 'nonlinear').map(({ nonlinearIteration, residuals: values, relativeResidual }) => ({ iteration: nonlinearIteration, absolute: values[0], relative: relativeResidual }))
  const dofs = [...log.matchAll(/System \d+\/\d+: (\d+) Dofs/g)].map((match) => Number(match[1]))
  const outputs = Object.fromEntries(await Promise.all(files.map(async (name) => {
    const bytes = await readFile(join(directory, name))
    const source = bytes.toString(), kind = /\b([SVT])[PTQLSHIY]\(/.exec(source)?.[1]
    const times = /\bTIME\s*\{([^}]*)\}/i.exec(source)?.[1].split(',').map(Number) ?? []
    return [name, { bytes: bytes.length, sha256: sha256(bytes), records: (source.match(/\b[SVT][PTQLSHIY]\(/g) ?? []).length, components: kind === 'S' ? 1 : kind === 'V' ? 3 : kind === 'T' ? 9 : 0, times }]
  })))
  const probeSource = await readFile(join(directory, 'probes.txt'), 'utf8').catch(() => '')
  const probes = probeSource.trim().split('\n').filter(Boolean).map((line) => {
    const [file, x, y, z, distance, ...values] = line.trim().split(/\s+/)
    if (Number(distance) !== 0 || !values.length) throw new Error(`native probe is not an exact interior sample: ${line}`)
    return { file, coordinate: [Number(x), Number(y), Number(z)], values: values.map(Number) }
  })
  const complexProbes = project.scalarType === 'complex-double' ? probes.flatMap((probe) => {
    const output = outputs[probe.file]
    if (!output?.components || probe.values.length % (output.components * 2)) throw new Error(`invalid complex probe ${probe.file}`)
    const pairs = probe.values.length / output.components / 2
    return Array.from({ length: pairs }, (_, pair) => {
      const offset = pair * output.components * 2, real = probe.values.slice(offset, offset + output.components), imaginary = probe.values.slice(offset + output.components, offset + output.components * 2)
      const sourceTimes = output.times.slice(pair * 2, pair * 2 + 2)
      if (output.times.length && sourceTimes.length !== 2) throw new Error(`complex output ${probe.file} has incomplete source times`)
      const time = sourceTimes.length && sourceTimes[0] === sourceTimes[1] ? sourceTimes[0] : pair
      return (['real', 'imaginary', 'magnitude', 'phase']).map((representation) => ({
        file: probe.file, coordinate: probe.coordinate, representation, time, sourceTimes,
        values: real.map((value, component) => representation === 'real' ? value : representation === 'imaginary' ? imaginary[component] : representation === 'magnitude' ? Math.hypot(value, imaginary[component]) : Math.atan2(imaginary[component], value)),
      }))
    }).flat()
  }) : []
  return {
    id: project.id,
    parameters: project.setNumbers,
    scalarType: project.scalarType,
    referenceField: project.referenceField,
    referenceRelative: project.referenceRelative,
    topology: {
      nodes: Number(/\$Nodes\s+(\d+)/.exec(mesh)?.[1]),
      elements: Number(/\$Elements\s+(\d+)/.exec(mesh)?.[1]),
      canonicalSha256: execFileSync(process.execPath, [join(root, 'tools/wasm/canonical-msh-hash.mjs'), meshPath], { encoding: 'utf8' }).trim(),
    },
    degreesOfFreedom: Math.max(...dofs),
    convergence: { linearResiduals: residuals, nonlinear, groups: convergence },
    outputs,
    probes,
    complexProbes,
  }
}

const projects = []
for (const project of catalog.projects.filter(({ id }) => ['radiator-3d-transient', 'electromagnet-2d-nonlinear', 'full-wave-2d-edge-complex'].includes(id))) projects.push(await summarize(project))
const reference = {
  schema: 1,
  tolerance: {
    numericAbsolute: 1e-8,
    numericRelative: 5e-3,
    finalResidualAbsolute: 1e-6,
  },
  provenance: {
    command: 'JOBS=4 UPDATE_REFERENCE=1 nice npm run wasm:reference',
    compiler: metadata,
    sources: {
      gmsh: { revision: versions.GMSH_REVISION, tree: versions.GMSH_TREE },
      occt: { revision: versions.OCCT_REVISION, tree: versions.OCCT_TREE },
      getdp: { revision: versions.GETDP_REVISION, tree: versions.GETDP_TREE },
      petsc: { revision: versions.PETSC_REVISION, tree: versions.PETSC_TREE },
    },
  },
  projects,
}
await writeFile(outputPath, `${JSON.stringify(reference, null, 2)}\n`)
