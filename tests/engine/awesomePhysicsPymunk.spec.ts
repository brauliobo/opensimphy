import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  PYMUNK_ADAPTER_ID,
  PYMUNK_ARTIFACT_INTEGRITY,
  PYMUNK_BOUNDS,
  PYMUNK_SOURCE_REVISION,
  createPymunkAdapter,
  instantiatePymunkModule,
  parsePymunkInput,
} from '../../src/awesomePhysics/adapters/wasm/pymunk'
import { WASM_PILOTS } from '../../src/awesomePhysics/artifactManifest'
import { awesomePhysicsAdapterFactoryMap } from '../../src/awesomePhysics/adapterFactories'
import { runAwesomeBenchmarkHarness } from '../../src/awesomePhysics/benchmark/harness'
import type { AwesomePhysicsSimulationArtifactV1 } from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const descriptor = simulations.items.find(({ catalogItemId }) => catalogItemId === 'awesome-pymunk')
if (!descriptor) throw new Error('Missing generated pymunk descriptor')
const manifestRecord = WASM_PILOTS.find(({ id }) => id === 'pymunk')
if (!manifestRecord) throw new Error('Missing pymunk WASM pilot record')

const publicPymunkRoot = resolve(process.cwd(), 'public/wasm/awesomePhysics/pymunk')
const wasmBytes = new Uint8Array(readFileSync(resolve(publicPymunkRoot, 'pymunk.wasm')))

const availableDescriptor = {
  ...descriptor,
  execution: 'wasm' as const,
  executionOptions: ['wasm'],
  availability: 'available' as const,
  runnable: true,
  adapterId: PYMUNK_ADAPTER_ID,
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

describe('pymunk headless Chipmunk WASM artifact', () => {
  it('exposes the verified ABI and known finite ball steps', async () => {
    const module = await WebAssembly.compile(wasmBytes)
    const exports = WebAssembly.Module.exports(module).map(({ name }) => name)
    expect(exports).toEqual(expect.arrayContaining(['pymunk_version', 'pymunk_step', 'pymunk_x', 'pymunk_angle', 'pymunk_steps']))

    const wasm = await instantiatePymunkModule(module)
    expect(wasm.pymunk_version()).toBe(730)
    expect(wasm.pymunk_step(0)).toBeCloseTo(2, 5)
    expect(wasm.pymunk_step(15)).toBeCloseTo(1.7138750553131104, 6)
    expect(wasm.pymunk_step(60)).toBeCloseTo(0.4712750017642975, 6)
    expect(Number.isFinite(wasm.pymunk_step(600))).toBe(true)
    expect(Number.isNaN(wasm.pymunk_step(601))).toBe(true)
  })

  it('matches the fixed artifact size and SHA-256 metadata', () => {
    expect(PYMUNK_SOURCE_REVISION).toBe('6287ce6d9223d1d79d28b2c26f37499f45b445b8')
    expect(wasmBytes.byteLength).toBe(PYMUNK_ARTIFACT_INTEGRITY.byteSize)
    expect(sha256(wasmBytes)).toBe(PYMUNK_ARTIFACT_INTEGRITY.sha256)
    expect(PYMUNK_ARTIFACT_INTEGRITY.path).toBe('wasm/awesomePhysics/pymunk/pymunk.wasm')
    const wasmText = Buffer.from(wasmBytes).toString('latin1')
    expect(wasmText.includes('/home/braulio')).toBe(false)
    expect(wasmText.includes('/tmp/opencode')).toBe(false)
    expect(manifestRecord).toMatchObject({
      status: 'available',
      licenseGate: { status: 'pass' },
      source: { revision: PYMUNK_SOURCE_REVISION },
      artifact: PYMUNK_ARTIFACT_INTEGRITY,
    })
  })

  it('rejects malformed and oversized POD inputs', () => {
    expect(parsePymunkInput({ operation: 'snapshot' })).toEqual({ operation: 'snapshot' })
    expect(parsePymunkInput({ operation: 'step', steps: 0 })).toEqual({ operation: 'step', steps: 0 })
    expect(parsePymunkInput({ operation: 'step', steps: PYMUNK_BOUNDS.maximumStepsPerCall })).toEqual({
      operation: 'step',
      steps: PYMUNK_BOUNDS.maximumStepsPerCall,
    })
    expect(() => parsePymunkInput({ operation: 'step', steps: -1 })).toThrow(/between 0 and 600/)
    expect(() => parsePymunkInput({ operation: 'step', steps: 601 })).toThrow(/between 0 and 600/)
    expect(() => parsePymunkInput({ operation: 'unknown' })).toThrow(/snapshot or step/)
    expect(() => parsePymunkInput({ operation: 'step', extra: true })).toThrow(/unknown properties/)
    expect(() => parsePymunkInput({ operation: 'step', steps: 1, padding: 'x'.repeat(PYMUNK_BOUNDS.maximumInputBytes) })).toThrow(/input limit/)
  })

  it('returns descriptor compatibility and remains on the generic worker factory path', () => {
    const adapter = createPymunkAdapter(availableDescriptor, new AbortController().signal)
    expect(adapter).toMatchObject({
      adapterId: PYMUNK_ADAPTER_ID,
      protocol: 'awesome-physics-adapter-v1',
      compatibility: {
        contentRevision: descriptor.contentRevision,
        modelRevision: descriptor.modelRevision,
        implementationRevision: descriptor.implementationRevision,
        outputRevision: descriptor.outputRevision,
      },
    })
    expect(awesomePhysicsAdapterFactoryMap.has(PYMUNK_ADAPTER_ID)).toBe(true)
    expect(descriptor).toMatchObject({
      execution: 'wasm',
      availability: 'available',
      runnable: true,
      adapterId: PYMUNK_ADAPTER_ID,
      sourceRevision: PYMUNK_SOURCE_REVISION,
    })
  })

  it('rejects incompatible descriptors and cancellation before artifact loading', async () => {
    const signal = new AbortController()
    signal.abort()
    expect(() => createPymunkAdapter(availableDescriptor, signal.signal)).toThrow(/aborted/)

    expect(() => createPymunkAdapter({ ...availableDescriptor, execution: 'browser' }, new AbortController().signal))
      .toThrow(/requires WASM execution/)
    expect(() => createPymunkAdapter({ ...availableDescriptor, adapterId: 'other-adapter' }, new AbortController().signal))
      .toThrow(/adapterId is incompatible/)

    const adapter = createPymunkAdapter(availableDescriptor, new AbortController().signal)
    const runController = new AbortController()
    runController.abort()
    await expect(adapter.run({ operation: 'step', steps: 60 }, runController.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('runs the default settled fixture to a finite JSON-safe result', async () => {
    const previousFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const path = String(input)
      if (!path.endsWith('.wasm')) throw new Error(`Unexpected pymunk URL ${path}`)
      return new Response(wasmBytes, {
        status: 200,
        headers: {
          'content-type': 'application/wasm',
          'content-length': String(wasmBytes.byteLength),
        },
      })
    }) as typeof fetch
    try {
      const adapter = createPymunkAdapter(availableDescriptor, new AbortController().signal)
      const output = await adapter.run({ operation: 'step', steps: 60 })
      expect(output).toMatchObject({
        schemaVersion: 1,
        dimension: 2,
        operation: 'step',
        y: expect.any(Number),
      })
      expect(Number.isFinite(output && 'y' in output ? output.y : Number.NaN)).toBe(true)
      if (output && output.operation === 'step') {
        expect(output.y).toBeCloseTo(0.4712750017642975, 6)
        expect(output.snapshot.steps).toBe(60)
      }
      expect(JSON.parse(JSON.stringify(output))).toEqual(output)
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  it('mounts through the existing benchmark harness', async () => {
    const report = await runAwesomeBenchmarkHarness({ caseIds: ['awesome-pymunk-capability'] })
    expect(report.summary.failed).toBe(0)
    expect(report.results.length).toBeGreaterThan(0)
    expect(report.results.every(({ status }) => status === 'pass')).toBe(true)
  })
})
