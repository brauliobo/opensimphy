#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'public/data/generated/awesomePhysics/benchmark-results.json')
const casesPath = resolve(root, 'public/data/generated/awesomePhysics/benchmark-cases.json')
const args = new Set(process.argv.slice(2))
const jsonOnly = args.has('--json')
const skipGray = args.has('--skip-gray')

const server = await createServer({ root, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })

try {
  const harness = await server.ssrLoadModule('/src/awesomePhysics/benchmark/index.ts')
  const cases = harness.awesomeBenchmarkCases()
  const caseIds = skipGray ? cases.filter((entry) => entry.caseId !== 'gray-motor').map((entry) => entry.caseId) : undefined
  const report = await harness.runAwesomeBenchmarkHarness({
    publicRoot: resolve(root, 'public'),
    basePath: '',
    caseIds,
  })
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(casesPath, `${JSON.stringify({
    schemaVersion: 1,
    registryId: harness.awesomeBenchmarkRegistryMeta.registryId,
    catalogRevision: harness.awesomeBenchmarkRegistryMeta.catalogRevision,
    cases,
  }, null, 2)}\n`)
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
  const payload = { casesPath, outputPath, summary: report.summary, failed: report.results.filter((row) => row.status === 'fail') }
  if (jsonOnly) console.log(JSON.stringify(payload, null, 2))
  else {
    console.log(`cases ${report.summary.cases} runnable ${report.summary.runnable} pass ${report.summary.passed} fail ${report.summary.failed}`)
    for (const row of report.results.filter((entry) => entry.status === 'fail')) {
      console.error(`${row.caseId} ${row.runtime}: ${row.error}`)
    }
  }
  if (report.summary.failed > 0) process.exitCode = 1
} finally {
  await server.close()
}
