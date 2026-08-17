import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import { NATIVE_CANDIDATES } from '../../src/awesomePhysics/artifactManifest'
import {
  createSpiritAdapter,
  createSpiritAdapterFromRecord,
  parseSpiritInput,
  SPIRIT_ADAPTER_ID,
  SPIRIT_ARTIFACT_INTEGRITY,
  SPIRIT_BOUNDS,
  SPIRIT_IMPLEMENTATION_REVISION,
  SPIRIT_MANIFEST_ID,
  SPIRIT_OUTPUT_REVISION,
  SPIRIT_PROVENANCE,
  SPIRIT_SOURCE_REVISION,
} from '../../src/awesomePhysics/adapters/wasm/spirit'
import { awesomePhysicsAdapterFactoryMap } from '../../src/awesomePhysics/adapterFactories'
import type { ArtifactRecordV1 } from '../../src/awesomePhysics/artifactManifest'
import type {
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const descriptor = simulations.items.find(({ catalogItemId }) => catalogItemId === 'awesome-spirit')
if (!descriptor) throw new Error('Missing generated spirit descriptor')
const manifestRecord = NATIVE_CANDIDATES.find(({ id }) => id === SPIRIT_MANIFEST_ID)
if (!manifestRecord) throw new Error('Missing Spirit native candidate record')

const publicArtifactPath = resolve(process.cwd(), 'public/wasm/awesomePhysics/spirit/spirit-llg-heun.wasm')
const artifactBytes = new Uint8Array(readFileSync(publicArtifactPath))

const availableDescriptor: AwesomePhysicsSimulationDescriptorV1 = {
  ...descriptor,
  execution: 'wasm',
  executionOptions: ['wasm'],
  availability: 'available',
  runnable: true,
  adapterId: SPIRIT_ADAPTER_ID,
  implementationRevision: SPIRIT_IMPLEMENTATION_REVISION,
  outputRevision: SPIRIT_OUTPUT_REVISION,
}

const fixtureRecord: ArtifactRecordV1 = {
  ...manifestRecord,
  artifact: { ...manifestRecord.artifact },
}

const defaultInput = {
  operation: 'llg-heun' as const,
  spinCount: 1,
  damping: 0.3,
  timeStep: 0.002,
  steps: 400,
  field: { x: 0, y: 0, z: 1 },
  exchange: 0,
  initialSpin: { x: 1, y: 0, z: 0 },
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function wasmResponse(bytes = artifactBytes): Response {
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': 'application/wasm',
      'content-length': String(bytes.byteLength),
    },
  })
}

describe('Spirit headless LLG WASM artifact', () => {
  it('matches the fixed artifact ledger without ui-web or host paths', async () => {
    const ledger = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/awesomePhysics/wasm/spirit/build-ledger.json'), 'utf8')) as {
      artifact: { name: string; path: string; byteSize: number; sha256: string }
      source: { revision: string }
    }
    expect(ledger.artifact).toEqual({
      name: 'spirit-llg-heun.wasm',
      path: SPIRIT_ARTIFACT_INTEGRITY.path,
      byteSize: SPIRIT_ARTIFACT_INTEGRITY.byteSize,
      sha256: SPIRIT_ARTIFACT_INTEGRITY.sha256,
    })
    expect(ledger.source.revision).toBe(SPIRIT_SOURCE_REVISION)
    expect(artifactBytes.byteLength).toBe(3821)
    expect(sha256(artifactBytes)).toBe(SPIRIT_ARTIFACT_INTEGRITY.sha256)
    const wasmText = Buffer.from(artifactBytes).toString('latin1')
    expect(wasmText.includes('/home/braulio')).toBe(false)
    expect(wasmText.includes('/tmp/opencode')).toBe(false)

    const module = await WebAssembly.compile(artifactBytes)
    expect(WebAssembly.Module.imports(module)).toEqual([])
    expect(WebAssembly.Module.exports(module).map(({ name }) => name)).toEqual(expect.arrayContaining([
      'spirit_llg_status',
      'spirit_llg_mx',
      'spirit_llg_my',
      'spirit_llg_mz',
      'spirit_llg_energy',
      'spirit_llg_time',
      'spirit_llg_norm',
    ]))
  })

  it('runs a damped single-spin Heun LLG and a ferromagnetic chain', async () => {
    const module = await WebAssembly.compile(artifactBytes)
    const instance = await WebAssembly.instantiate(module, {})
    const exports = instance.exports as unknown as {
      spirit_llg_status: (...args: number[]) => number
      spirit_llg_mz: (...args: number[]) => number
      spirit_llg_energy: (...args: number[]) => number
      spirit_llg_norm: (...args: number[]) => number
      spirit_llg_time: (...args: number[]) => number
    }
    const damped = [1, 0.3, 0.002, 400, 0, 0, 1, 0, 1, 0, 0]
    expect(exports.spirit_llg_status(...damped)).toBe(1)
    expect(exports.spirit_llg_mz(...damped)).toBeGreaterThan(0.5)
    expect(exports.spirit_llg_norm(...damped)).toBeCloseTo(1, 12)
    expect(exports.spirit_llg_time(...damped)).toBeCloseTo(0.8, 12)

    const undamped = [1, 0, 0.002, 400, 0, 0, 1, 0, 1, 0, 0]
    expect(exports.spirit_llg_mz(...undamped)).toBeCloseTo(0, 12)
    expect(exports.spirit_llg_norm(...undamped)).toBeCloseTo(1, 12)

    const chain = [8, 0.1, 0.002, 200, 0, 0, 0.2, 1, 0, 0, 1]
    expect(exports.spirit_llg_status(...chain)).toBe(1)
    expect(exports.spirit_llg_mz(...chain)).toBeCloseTo(1, 12)
    expect(exports.spirit_llg_energy(...chain)).toBeCloseTo(-8.6, 12)
    expect(exports.spirit_llg_status(0, 0.1, 0.002, 10, 0, 0, 1, 0, 1, 0, 0)).toBe(0)
  })

  it('parses bounded llg-heun input', () => {
    expect(parseSpiritInput(defaultInput)).toEqual(defaultInput)
    expect(() => parseSpiritInput({ ...defaultInput, extra: true })).toThrow(/unknown properties/)
    expect(() => parseSpiritInput({ ...defaultInput, spinCount: 0 })).toThrow(/between/)
    expect(() => parseSpiritInput({ ...defaultInput, spinCount: SPIRIT_BOUNDS.spinCount.max + 1 })).toThrow(/between/)
    expect(() => parseSpiritInput({ ...defaultInput, steps: 1.5 })).toThrow(/integer/)
    expect(() => parseSpiritInput({ ...defaultInput, damping: -0.1 })).toThrow(/between/)
    expect(() => parseSpiritInput({ ...defaultInput, timeStep: Number.NaN })).toThrow(/finite number/)
  })

  it('loads the verified module through the existing loader', async () => {
    const fetch = vi.fn(async () => wasmResponse())
    const adapter = createSpiritAdapterFromRecord(
      availableDescriptor,
      new AbortController().signal,
      fixtureRecord,
      { fetch, basePath: '/' },
    )
    expect(adapter).toMatchObject({
      adapterId: SPIRIT_ADAPTER_ID,
      protocol: 'awesome-physics-adapter-v1',
      compatibility: {
        contentRevision: availableDescriptor.contentRevision,
        modelRevision: availableDescriptor.modelRevision,
        implementationRevision: availableDescriptor.implementationRevision,
        outputRevision: availableDescriptor.outputRevision,
      },
    })
    const output = await adapter.run(defaultInput)
    expect(output).toMatchObject({
      schemaVersion: 1,
      operation: 'llg-heun',
      status: 1,
      solved: true,
      provenance: SPIRIT_PROVENANCE,
    })
    expect(output.magnetization.z).toBeGreaterThan(0.5)
    expect(output.spinNorm).toBeCloseTo(1, 12)
    expect(fetch).toHaveBeenCalledWith(
      '/wasm/awesomePhysics/spirit/spirit-llg-heun.wasm',
      { signal: expect.any(AbortSignal) },
    )
  })

  it('fails closed on compatibility, cancellation, and unavailable records', async () => {
    expect(() => createSpiritAdapterFromRecord(
      { ...availableDescriptor, catalogItemId: 'wrong-catalog-item' },
      new AbortController().signal,
      fixtureRecord,
    )).toThrow(/requires the spirit simulation descriptor/)
    expect(() => createSpiritAdapterFromRecord(
      { ...availableDescriptor, adapterId: 'wrong-adapter' },
      new AbortController().signal,
      fixtureRecord,
    )).toThrow(/adapterId is incompatible/)

    const abortedFactory = new AbortController()
    abortedFactory.abort()
    expect(() => createSpiritAdapterFromRecord(
      availableDescriptor,
      abortedFactory.signal,
      fixtureRecord,
    )).toThrow(/aborted/)

    const fetch = vi.fn(async () => wasmResponse())
    const adapter = createSpiritAdapterFromRecord(
      availableDescriptor,
      new AbortController().signal,
      fixtureRecord,
      { fetch },
    )
    const abortedRun = new AbortController()
    abortedRun.abort()
    await expect(adapter.run(defaultInput, abortedRun.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).not.toHaveBeenCalled()

    expect(() => createSpiritAdapterFromRecord(
      availableDescriptor,
      new AbortController().signal,
      { ...fixtureRecord, status: 'planned', artifact: { path: null, sha256: null, byteSize: null } },
    )).toThrow(/requires an available manifest record/)
  })

  it('publishes the verified descriptor and central adapter registration', () => {
    expect(descriptor).toMatchObject({
      execution: 'wasm',
      availability: 'available',
      runnable: true,
      adapterId: SPIRIT_ADAPTER_ID,
      sourceRevision: SPIRIT_SOURCE_REVISION,
      implementationRevision: SPIRIT_IMPLEMENTATION_REVISION,
    })
    expect(manifestRecord).toMatchObject({
      status: 'available',
      licenseGate: { status: 'pass' },
      source: { revision: SPIRIT_SOURCE_REVISION },
      artifact: SPIRIT_ARTIFACT_INTEGRITY,
    })
    expect(awesomePhysicsAdapterFactoryMap.has(SPIRIT_ADAPTER_ID)).toBe(true)
  })
})
