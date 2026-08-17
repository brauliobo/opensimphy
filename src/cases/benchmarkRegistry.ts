import { readonly, shallowRef } from 'vue'
import type {
  AwesomeBenchmarkCaseV1,
  AwesomeBenchmarkReportV1,
  AwesomeBenchmarkResultV1,
} from '../awesomePhysics/benchmark/types'

const CASES_URL = `${import.meta.env.BASE_URL}data/generated/awesomePhysics/benchmark-cases.json`
const RESULTS_URL = `${import.meta.env.BASE_URL}data/generated/awesomePhysics/benchmark-results.json`

interface BenchmarkCasesArtifactV1 {
  schemaVersion: 1
  registryId: string
  cases: AwesomeBenchmarkCaseV1[]
}

const cases = shallowRef<AwesomeBenchmarkCaseV1[]>([])
const report = shallowRef<AwesomeBenchmarkReportV1 | null>(null)
const ready = shallowRef(false)
const error = shallowRef<Error | null>(null)
let initialization: Promise<void> | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseCases(value: unknown): AwesomeBenchmarkCaseV1[] {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.cases)) {
    throw new TypeError('Benchmark cases artifact must be schemaVersion 1 with a cases array')
  }
  return value.cases as AwesomeBenchmarkCaseV1[]
}

function parseReport(value: unknown): AwesomeBenchmarkReportV1 {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.results) || !isRecord(value.summary)) {
    throw new TypeError('Benchmark results artifact must be schemaVersion 1 with summary and results')
  }
  return value as unknown as AwesomeBenchmarkReportV1
}

export async function initializeBenchmarkRegistry(fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<void> {
  if (initialization) return initialization
  initialization = (async () => {
    const [casesResponse, resultsResponse] = await Promise.all([
      fetchImpl(CASES_URL, { signal }),
      fetchImpl(RESULTS_URL, { signal }),
    ])
    if (!casesResponse.ok) throw new Error(`Benchmark cases returned HTTP ${casesResponse.status}`)
    if (!resultsResponse.ok) throw new Error(`Benchmark results returned HTTP ${resultsResponse.status}`)
    cases.value = parseCases(await casesResponse.json())
    report.value = parseReport(await resultsResponse.json())
    ready.value = true
  })().catch((reason) => {
    error.value = reason instanceof Error ? reason : new Error(String(reason))
    ready.value = true
    initialization = null
  })
  return initialization
}

export function useBenchmarkRegistry() {
  return {
    cases:  readonly(cases),
    report: readonly(report),
    ready:  readonly(ready),
    error:  readonly(error),
    initialize: initializeBenchmarkRegistry,
  }
}

export function benchmarkCaseForCatalogId(catalogItemId: string): AwesomeBenchmarkCaseV1 | null {
  return cases.value.find((entry) => entry.catalogItemId === catalogItemId || entry.caseId === catalogItemId) ?? null
}

export function benchmarkCaseById(caseId: string): AwesomeBenchmarkCaseV1 | null {
  return cases.value.find((entry) => entry.caseId === caseId) ?? null
}

export function benchmarkResultsFor(caseId: string): AwesomeBenchmarkResultV1[] {
  return report.value?.results.filter((row) => row.caseId === caseId) ?? []
}

export function grayBenchmarkResults(): AwesomeBenchmarkResultV1[] {
  return benchmarkResultsFor('gray-motor')
}

export function setBenchmarkRegistryForTests(fixture: { cases: BenchmarkCasesArtifactV1, report: AwesomeBenchmarkReportV1 }): void {
  cases.value = parseCases(fixture.cases)
  report.value = parseReport(fixture.report)
  ready.value = true
  error.value = null
  initialization = Promise.resolve()
}

export function resetBenchmarkRegistryForTests(): void {
  cases.value = []
  report.value = null
  ready.value = false
  error.value = null
  initialization = null
}
