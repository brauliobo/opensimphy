import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  CANTERA_ADAPTER_ID,
  CANTERA_ARTIFACT_INTEGRITY,
  CANTERA_BOUNDS,
  CANTERA_SOURCE_REVISION,
  createCanteraAdapter,
  instantiateCanteraModule,
  parseCanteraInput,
} from '../../src/awesomePhysics/adapters/wasm/cantera'
import { WASM_PILOTS } from '../../src/awesomePhysics/artifactManifest'
import { awesomePhysicsAdapterFactoryMap } from '../../src/awesomePhysics/adapterFactories'
import { runAwesomeBenchmarkHarness } from '../../src/awesomePhysics/benchmark/harness'
import type { AwesomePhysicsSimulationArtifactV1 } from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const descriptor = simulations.items.find(({ catalogItemId }) => catalogItemId === 'awesome-cantera')
if (!descriptor) throw new Error('Missing generated Cantera descriptor')
const manifestRecord = WASM_PILOTS.find(({ id }) => id === 'cantera')
if (!manifestRecord) throw new Error('Missing Cantera WASM pilot record')

const publicCanteraRoot = resolve(process.cwd(), 'public/wasm/awesomePhysics/cantera')
const wasmBytes = new Uint8Array(readFileSync(resolve(publicCanteraRoot, 'cantera.wasm')))
const javascriptBytes = new Uint8Array(readFileSync(resolve(publicCanteraRoot, 'cantera.js')))

const availableDescriptor = {
  ...descriptor,
  execution: 'wasm' as const,
  executionOptions: ['wasm'],
  availability: 'available' as const,
  runnable: true,
  adapterId: CANTERA_ADAPTER_ID,
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

describe('Cantera headless zero-D WASM artifact', () => {
  it('exposes the verified ABI and finite thermo, HP equilibrium, and reactor results', async () => {
    const module = await WebAssembly.compile(wasmBytes)
    const exports = WebAssembly.Module.exports(module).map(({ name }) => name)
    expect(exports).toEqual(expect.arrayContaining(['cantera_run', 'cantera_out', 'cantera_status']))

    const wasm = await instantiateCanteraModule(module)
    expect(wasm.cantera_run(0, 1001, 101325, 0)).toBe(1)
    expect(Number.isFinite(wasm.cantera_out(0))).toBe(true)
    expect(wasm.cantera_run(1, 1001, 101325, 0)).toBe(1)
    expect(wasm.cantera_out(0)).toBeGreaterThan(1001)
    expect(wasm.cantera_run(2, 1001, 101325, 0.001)).toBe(1)
    expect(Number.isFinite(wasm.cantera_out(0))).toBe(true)
  })

  it('matches the fixed artifact size and SHA-256 metadata', () => {
    expect(CANTERA_SOURCE_REVISION).toBe('11a2381011cb6d42e61cc4c195e0f920864bf8d3')
    expect(wasmBytes.byteLength).toBe(CANTERA_ARTIFACT_INTEGRITY.wasm.byteSize)
    expect(javascriptBytes.byteLength).toBe(CANTERA_ARTIFACT_INTEGRITY.javascript.byteSize)
    expect(sha256(wasmBytes)).toBe(CANTERA_ARTIFACT_INTEGRITY.wasm.sha256)
    expect(sha256(javascriptBytes)).toBe(CANTERA_ARTIFACT_INTEGRITY.javascript.sha256)
    expect(CANTERA_ARTIFACT_INTEGRITY.wasm.path).toBe('wasm/awesomePhysics/cantera/cantera.wasm')
    const wasmText = Buffer.from(wasmBytes).toString('latin1')
    expect(wasmText.includes('/home/braulio')).toBe(false)
    expect(wasmText.includes('/tmp/opencode')).toBe(false)
    expect(manifestRecord).toMatchObject({
      status: 'available',
      licenseGate: { status: 'pass' },
      source: { revision: CANTERA_SOURCE_REVISION },
      artifact: {
        path: CANTERA_ARTIFACT_INTEGRITY.wasm.path,
        sha256: CANTERA_ARTIFACT_INTEGRITY.wasm.sha256,
        byteSize: CANTERA_ARTIFACT_INTEGRITY.wasm.byteSize,
        companion: CANTERA_ARTIFACT_INTEGRITY.javascript,
      },
    })
  })

  it('rejects malformed and oversized POD inputs', () => {
    expect(parseCanteraInput({ operation: 'thermo', temperatureK: 1001, pressurePa: 101325 })).toEqual({
      operation: 'thermo',
      temperatureK: 1001,
      pressurePa: 101325,
    })
    expect(parseCanteraInput({
      operation: 'reactor',
      temperatureK: 1001,
      pressurePa: 101325,
      timeS: CANTERA_BOUNDS.maximumTimeS,
    })).toEqual({
      operation: 'reactor',
      temperatureK: 1001,
      pressurePa: 101325,
      timeS: CANTERA_BOUNDS.maximumTimeS,
    })
    expect(() => parseCanteraInput(null)).toThrow(/JSON object/)
    expect(() => parseCanteraInput({ operation: 'unknown' })).toThrow(/thermo, equilibrate-hp, or reactor/)
    expect(() => parseCanteraInput({ operation: 'thermo', temperatureK: 1001, pressurePa: 101325, extra: true })).toThrow(/unknown properties/)
    expect(() => parseCanteraInput({
      operation: 'thermo',
      temperatureK: 1001,
      pressurePa: 101325,
      padding: 'x'.repeat(CANTERA_BOUNDS.maximumInputBytes),
    })).toThrow(/unknown properties|input limit/)
  })

  it('returns descriptor compatibility and remains on the generic worker factory path', () => {
    const adapter = createCanteraAdapter(availableDescriptor, new AbortController().signal)
    expect(adapter).toMatchObject({
      adapterId: CANTERA_ADAPTER_ID,
      protocol: 'awesome-physics-adapter-v1',
      compatibility: {
        contentRevision: descriptor.contentRevision,
        modelRevision: descriptor.modelRevision,
        implementationRevision: descriptor.implementationRevision,
        outputRevision: descriptor.outputRevision,
      },
    })
    expect(awesomePhysicsAdapterFactoryMap.has(CANTERA_ADAPTER_ID)).toBe(true)
    expect(descriptor).toMatchObject({
      execution: 'wasm',
      availability: 'available',
      runnable: true,
      adapterId: CANTERA_ADAPTER_ID,
      sourceRevision: CANTERA_SOURCE_REVISION,
    })
  })

  it('rejects incompatible descriptors and cancellation before artifact loading', async () => {
    const signal = new AbortController()
    signal.abort()
    expect(() => createCanteraAdapter(availableDescriptor, signal.signal)).toThrow(/aborted/)

    expect(() => createCanteraAdapter({ ...availableDescriptor, execution: 'browser' }, new AbortController().signal))
      .toThrow(/requires WASM execution/)
    expect(() => createCanteraAdapter({ ...availableDescriptor, adapterId: 'other-adapter' }, new AbortController().signal))
      .toThrow(/adapterId is incompatible/)

    const adapter = createCanteraAdapter(availableDescriptor, new AbortController().signal)
    const runController = new AbortController()
    runController.abort()
    await expect(adapter.run({
      operation: 'equilibrate-hp',
      temperatureK: 1001,
      pressurePa: 101325,
    }, runController.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('runs the default HP fixture to a finite JSON-safe result', async () => {
    const previousFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path.endsWith('.js')) {
        return new Response(javascriptBytes, {
          status: 200,
          headers: { 'content-type': 'application/javascript', 'content-length': String(javascriptBytes.byteLength) },
        })
      }
      if (path.endsWith('.wasm')) {
        return new Response(wasmBytes, {
          status: 200,
          headers: { 'content-type': 'application/wasm', 'content-length': String(wasmBytes.byteLength) },
        })
      }
      throw new Error(`Unexpected Cantera URL ${path}`)
    }) as typeof fetch
    try {
      const adapter = createCanteraAdapter(availableDescriptor, new AbortController().signal)
      const output = await adapter.run({ operation: 'equilibrate-hp', temperatureK: 1001, pressurePa: 101325 })
      expect(output).toMatchObject({
        schemaVersion: 1,
        operation: 'equilibrate-hp',
        temperatureK: expect.any(Number),
      })
      if (output && output.operation === 'equilibrate-hp') {
        expect(output.temperatureK).toBeGreaterThan(1001)
        expect(Number.isFinite(output.enthalpyMass)).toBe(true)
      }
      expect(JSON.parse(JSON.stringify(output))).toEqual(output)
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  it('mounts through the existing benchmark harness', async () => {
    const report = await runAwesomeBenchmarkHarness({ caseIds: ['awesome-cantera-capability'] })
    expect(report.summary.failed).toBe(0)
    expect(report.results[0]).toMatchObject({ caseId: 'awesome-cantera-capability', status: 'pass' })
  }, 30_000)
})
