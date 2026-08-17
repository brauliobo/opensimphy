import type { AwesomePhysicsExecutionKind, AwesomePhysicsLicenseGate } from '../../types/awesomePhysics'

export const AWESOME_BENCHMARK_SCHEMA_VERSION = 1 as const
export const AWESOME_BENCHMARK_CASE_REGISTRY_ID = 'awesome-benchmark-cases-v1'
export const GRAY_MOTOR_CASE_FAMILY = 'gray-motor'

export type AwesomeBenchmarkRuntimeV1 = 'native' | 'wasm'
export type AwesomeBenchmarkStatusV1 = 'pass' | 'fail' | 'blocked' | 'planned' | 'unavailable' | 'pending-plugin'

export interface AwesomeBenchmarkMetricsV1 {
  elapsedMs: number
  energyInJ?: number
  energyOutJ?: number
  cop?: number
  [key: string]: number | undefined
}

export interface AwesomeBenchmarkCaseV1 {
  caseId: string
  title: string
  family: 'awesome-physics' | typeof GRAY_MOTOR_CASE_FAMILY
  descriptorId: string | null
  catalogItemId: string | null
  adapterId: string | null
  execution: AwesomePhysicsExecutionKind | 'gray-motor'
  licenseGate: AwesomePhysicsLicenseGate | 'pending'
  runtimes: readonly AwesomeBenchmarkRuntimeV1[]
  runnable: boolean
  mount: {
    adapterFactory?: string
    wasmManifestId?: string
    grayPlugin: 'gray-motor-v1'
    resultSchema: 'awesome-benchmark-result-v1'
  }
}

export interface AwesomeBenchmarkResultV1 {
  schemaVersion: 1
  caseId: string
  runtime: AwesomeBenchmarkRuntimeV1
  status: AwesomeBenchmarkStatusV1
  metrics: AwesomeBenchmarkMetricsV1
  output: unknown
  error: string | null
}

export interface AwesomeBenchmarkReportV1 {
  schemaVersion: 1
  generatedAt: string
  registryId: typeof AWESOME_BENCHMARK_CASE_REGISTRY_ID
  summary: {
    cases: number
    runnable: number
    passed: number
    failed: number
    planned: number
    blocked: number
    unavailable: number
  }
  results: AwesomeBenchmarkResultV1[]
}
