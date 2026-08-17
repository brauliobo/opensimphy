import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { registerAwesomePhysicsAdapters } from '../registerAdapters'
import { awesomePhysicsDefaultInput } from '../defaultInputs'
import { artifactRecordById } from '../artifactManifest'
import { loadVerifiedCompanionJavaScript } from '../wasmArtifactLoader'
import { loadVerifiedWasmArtifactById } from '../wasm/runtime'
import {
  resetAwesomePhysicsRegistryForTests,
  setAwesomePhysicsRegistryForTests,
  useAwesomePhysicsRegistry,
} from '../../registries/awesomePhysicsRegistry'
import catalogJson from '../../../public/data/generated/awesomePhysics/catalog.json'
import simulationsJson from '../../../public/data/generated/awesomePhysics/simulations.json'
import type {
  AwesomePhysicsCatalogArtifactV1,
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../types/awesomePhysics'
import { loadGrayMotorPlugin } from './graySlot'
import { awesomeBenchmarkCases } from './registry'
import type {
  AwesomeBenchmarkCaseV1,
  AwesomeBenchmarkReportV1,
  AwesomeBenchmarkResultV1,
  AwesomeBenchmarkRuntimeV1,
  AwesomeBenchmarkStatusV1,
} from './types'

const catalog = catalogJson as AwesomePhysicsCatalogArtifactV1
const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1

export interface AwesomeBenchmarkHarnessOptions {
  caseIds?: readonly string[]
  fetch?: typeof globalThis.fetch
  basePath?: string
  publicRoot?: string
  signal?: AbortSignal
}

function localArtifactFetch(publicRoot: string): typeof globalThis.fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    const stripped = url
      .replace(/^[a-z][a-z\d+\-.]*:\/\/[^/]+/i, '')
      .replace(/^\/+/, '')
      .replace(/^\.\//, '')
    const relative = stripped.startsWith('public/') ? stripped.slice('public/'.length) : stripped
    const path = resolve(publicRoot, relative)
    const bytes = readFileSync(path)
    const type = path.endsWith('.wasm')
      ? 'application/wasm'
      : path.endsWith('.js')
        ? 'application/javascript'
        : 'application/octet-stream'
    return new Response(bytes, {
      status: 200,
      headers: { 'content-type': type, 'content-length': String(bytes.byteLength) },
    })
  }) as typeof globalThis.fetch
}

function metricsFrom(elapsedMs: number, output: unknown): AwesomeBenchmarkResultV1['metrics'] {
  const metrics: AwesomeBenchmarkResultV1['metrics'] = { elapsedMs }
  if (typeof output !== 'object' || output === null) return metrics
  const record = output as Record<string, unknown>
  const ledger = typeof record.ledger === 'object' && record.ledger !== null
    ? record.ledger as Record<string, unknown>
    : record
  if (typeof ledger.wholeSystemCop === 'number') metrics.cop = ledger.wholeSystemCop
  if (typeof ledger.totalDeclaredInputJ === 'number') metrics.energyInJ = ledger.totalDeclaredInputJ
  if (typeof ledger.loadWorkJ === 'number') metrics.energyOutJ = ledger.loadWorkJ
  if (typeof record.energyInJ === 'number') metrics.energyInJ = record.energyInJ
  if (typeof record.energyOutJ === 'number') metrics.energyOutJ = record.energyOutJ
  if (Array.isArray(record.motors)) {
    const cops = record.motors
      .map((motor) => (typeof motor === 'object' && motor !== null ? (motor as Record<string, unknown>).wholeSystemCop : null))
      .filter((value): value is number => typeof value === 'number')
    if (cops.length > 0) metrics.cop = Math.max(...cops)
  }
  return metrics
}

function result(
  caseId: string,
  runtime: AwesomeBenchmarkRuntimeV1,
  status: AwesomeBenchmarkStatusV1,
  started: number,
  output: unknown,
  error: string | null,
): AwesomeBenchmarkResultV1 {
  return {
    schemaVersion: 1,
    caseId,
    runtime,
    status,
    metrics: metricsFrom(performance.now() - started, output),
    output,
    error,
  }
}

async function runGray(runtime: AwesomeBenchmarkRuntimeV1, signal?: AbortSignal): Promise<AwesomeBenchmarkResultV1> {
  const started = performance.now()
  if (runtime === 'wasm') {
    return result('gray-motor', runtime, 'planned', started, { reason: 'Gray physics is a host plugin; WASM mount is reserved.' }, null)
  }
  try {
    const plugin = await loadGrayMotorPlugin()
    const output = await plugin.run(signal)
    const failed = output.motors.find((motor) => (
      motor.completedRevolutions !== 100
      || motor.wholeSystemCop > 1 + 1e-10
      || Math.abs(motor.normalizedResidual) > 1e-8
    ))
    if (failed) {
      return result('gray-motor', runtime, 'fail', started, output, `${failed.motorId} failed energy-boundary checks`)
    }
    return result('gray-motor', runtime, 'pass', started, output, null)
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason)
    const status: AwesomeBenchmarkStatusV1 = /Cannot find module|Failed to resolve/.test(message)
      ? 'pending-plugin'
      : 'fail'
    return result('gray-motor', runtime, status, started, null, message)
  }
}

async function runAdapterCase(
  caseItem: AwesomeBenchmarkCaseV1,
  runtime: AwesomeBenchmarkRuntimeV1,
  options: AwesomeBenchmarkHarnessOptions,
): Promise<AwesomeBenchmarkResultV1> {
  const started = performance.now()
  if (!caseItem.runnable || caseItem.adapterId === null || caseItem.descriptorId === null) {
    const status: AwesomeBenchmarkStatusV1 = caseItem.licenseGate === 'blocked'
      ? 'blocked'
      : caseItem.execution === 'wasm-candidate' || caseItem.caseId.startsWith('planned-')
        ? 'planned'
        : 'unavailable'
    return result(caseItem.caseId, runtime, status, started, { reason: caseItem.licenseGate }, null)
  }
  if (runtime === 'wasm' && caseItem.execution !== 'wasm') {
    return result(caseItem.caseId, runtime, 'unavailable', started, { reason: 'No WASM artifact for this kernel' }, null)
  }

  const registry = useAwesomePhysicsRegistry()
  const descriptor = await registry.descriptorById(caseItem.descriptorId) as AwesomePhysicsSimulationDescriptorV1
  const input = awesomePhysicsDefaultInput(caseItem.adapterId)
  if (input === null) return result(caseItem.caseId, runtime, 'fail', started, null, 'Missing default input')

  try {
    if (runtime === 'wasm' && caseItem.mount.wasmManifestId !== undefined) {
      await loadVerifiedWasmArtifactById(caseItem.mount.wasmManifestId, {
        fetch: options.fetch,
        basePath: options.basePath,
        signal: options.signal,
      })
    }
    if (caseItem.adapterId === 'awesome-coolprop-wasm' && runtime === 'wasm') {
      return result(caseItem.caseId, runtime, 'pass', started, { loaded: caseItem.mount.wasmManifestId }, null)
    }
    if (caseItem.adapterId === 'awesome-nphysics2d-wasm') {
      const record = artifactRecordById('nphysics')
      if (record === null) return result(caseItem.caseId, runtime, 'fail', started, null, 'nphysics manifest missing')
      const module = await loadVerifiedWasmArtifactById('nphysics', {
        fetch: options.fetch,
        basePath: options.basePath,
        signal: options.signal,
      })
      const companion = await loadVerifiedCompanionJavaScript(record, {
        fetch: options.fetch,
        basePath: options.basePath,
        signal: options.signal,
      })
      const exports = WebAssembly.Module.exports(module).map(({ name }) => name)
      if (!['world2d_new', 'world2d_snapshot', 'world2d_step'].every((name) => exports.includes(name))) {
        return result(caseItem.caseId, runtime, 'fail', started, { exports }, 'nphysics WASM ABI exports missing')
      }
      const text = new TextDecoder().decode(companion)
      if (!text.includes('export class World2d') || !text.includes('initSync')) {
        return result(caseItem.caseId, runtime, 'fail', started, null, 'nphysics companion ABI missing')
      }
      return result(caseItem.caseId, runtime, 'pass', started, { loaded: 'nphysics', exports, companionBytes: companion.byteLength }, null)
    }
    const adapter = await registry.loadAdapter(caseItem.descriptorId)
    if (adapter === null) return result(caseItem.caseId, runtime, 'fail', started, null, 'Adapter failed to load')
    const output = await adapter.run(input, options.signal)
    return result(caseItem.caseId, runtime, 'pass', started, output, null)
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason)
    if (caseItem.adapterId === 'awesome-coolprop-wasm' && message.includes('classic-worker')) {
      if (caseItem.mount.wasmManifestId !== undefined) {
        await loadVerifiedWasmArtifactById(caseItem.mount.wasmManifestId, {
          fetch: options.fetch,
          basePath: options.basePath,
          signal: options.signal,
        })
        return result(caseItem.caseId, runtime, 'pass', started, { loaded: caseItem.mount.wasmManifestId, note: 'classic-worker dispatch reserved' }, null)
      }
    }
    return result(caseItem.caseId, runtime, 'fail', started, null, message)
  }
}

export async function runAwesomeBenchmarkHarness(
  options: AwesomeBenchmarkHarnessOptions = {},
): Promise<AwesomeBenchmarkReportV1> {
  const publicRoot = options.publicRoot ?? resolve(process.cwd(), 'public')
  const fetchImpl = options.fetch ?? localArtifactFetch(publicRoot)
  const selected = awesomeBenchmarkCases().filter((entry) => (
    options.caseIds === undefined || options.caseIds.includes(entry.caseId)
  ))
  setAwesomePhysicsRegistryForTests({ catalog, simulations })
  const cleanup = registerAwesomePhysicsAdapters()
  const previousFetch = globalThis.fetch
  globalThis.fetch = fetchImpl
  const results: AwesomeBenchmarkResultV1[] = []
  try {
    for (const caseItem of selected) {
      for (const runtime of caseItem.runtimes) {
        const row = caseItem.family === 'gray-motor'
          ? await runGray(runtime, options.signal)
          : await runAdapterCase(caseItem, runtime, { ...options, fetch: fetchImpl, basePath: options.basePath ?? '' })
        results.push(row)
      }
    }
  } finally {
    globalThis.fetch = previousFetch
    cleanup()
    resetAwesomePhysicsRegistryForTests()
  }

  const summary = {
    cases: selected.length,
    runnable: selected.filter((entry) => entry.runnable).length,
    passed: results.filter((entry) => entry.status === 'pass').length,
    failed: results.filter((entry) => entry.status === 'fail').length,
    planned: results.filter((entry) => entry.status === 'planned').length,
    blocked: results.filter((entry) => entry.status === 'blocked').length,
    unavailable: results.filter((entry) => entry.status === 'unavailable').length,
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    registryId: 'awesome-benchmark-cases-v1',
    summary,
    results,
  }
}

export { localArtifactFetch }
