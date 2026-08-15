import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const [root, output] = process.argv.slice(2)
if (!root || !output) throw new Error('usage: summarize-phase5.mjs <native-output> <reference-output>')

const projectIds = ['global-quantity-real-loop', 'transfo-complex-loop']
const traces = Object.fromEntries(await Promise.all(projectIds.map(async (project) => {
  const trace = JSON.parse(await readFile(join(root, `phase5/${project}-native-trace.json`), 'utf8'))
  if (trace.schema !== 1 || trace.project !== project || !trace.sharedServer || trace.serverIdentity !== trace.lastGetdpServerIdentity || !Array.isArray(trace.points)) throw new Error(`invalid native Phase 5 trace for ${project}`)
  if (trace.loopInitializeCalls !== 1 || trace.loopIncrementCalls !== trace.points.length || trace.getdpCalls !== trace.points.length + 1) throw new Error(`invalid native Phase 5 call counts for ${project}`)
  trace.points.forEach((point, index) => {
    if (point.index !== index || !point.values || !point.outputs) throw new Error(`invalid native Phase 5 point ${project}:${index}`)
  })
  return [project, trace]
})))
const reference = {
  schema: 1,
  provenance: 'pinned linked native Gmsh/GetDP singleton loop trace',
  tolerance: { absolute: 1e-15, relative: 1e-4 },
  projects: Object.fromEntries(projectIds.map((project) => [project, traces[project].points.map(({ values, outputs }) => ({ values, outputs }))])),
  nativeTrace: Object.fromEntries(projectIds.map((project) => [project, {
    sharedServer: traces[project].sharedServer,
    getdpCalls: traces[project].getdpCalls,
    loopInitializeCalls: traces[project].loopInitializeCalls,
    loopIncrementCalls: traces[project].loopIncrementCalls,
  }])),
}
await writeFile(output, `${JSON.stringify(reference, null, 2)}\n`)
