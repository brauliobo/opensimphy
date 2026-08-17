import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  createGalpyAdapterFromRecord,
  GALPY_ADAPTER_ID,
  GALPY_ARTIFACT_INTEGRITY,
  GALPY_BOUNDS,
  GALPY_IMPLEMENTATION_REVISION,
  GALPY_MANIFEST_ID,
  GALPY_PROVENANCE,
  GALPY_SOURCE_REVISION,
  parseGalpyInput,
} from '../../src/awesomePhysics/adapters/wasm/galpy'
import { awesomePhysicsAdapterFactoryMap } from '../../src/awesomePhysics/adapterFactories'
import { WASM_PILOTS } from '../../src/awesomePhysics/artifactManifest'
import { instantiateVerifiedWasm } from '../../src/awesomePhysics/wasm/runtime'
import type { ArtifactRecordV1 } from '../../src/awesomePhysics/artifactManifest'
import type {
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const descriptor = simulations.items.find(({ catalogItemId }) => catalogItemId === 'awesome-galpy')
if (!descriptor) throw new Error('Missing generated galpy descriptor')
const manifestRecord = WASM_PILOTS.find(({ id }) => id === GALPY_MANIFEST_ID)
if (!manifestRecord) throw new Error('Missing galpy WASM pilot record')

const publicRoot = resolve(process.cwd(), 'public/wasm/awesomePhysics/galpy')
const wasmBytes = new Uint8Array(readFileSync(resolve(publicRoot, 'galpy.wasm')))
const javascriptBytes = new Uint8Array(readFileSync(resolve(publicRoot, 'galpy.js')))

const availableDescriptor: AwesomePhysicsSimulationDescriptorV1 = {
  ...descriptor,
  execution: 'wasm',
  executionOptions: ['wasm'],
  availability: 'available',
  runnable: true,
  adapterId: GALPY_ADAPTER_ID,
  implementationRevision: GALPY_IMPLEMENTATION_REVISION,
}

const fixtureRecord: ArtifactRecordV1 = {
  ...manifestRecord,
  artifact: {
    ...manifestRecord.artifact,
    companion: manifestRecord.artifact.companion === undefined
      ? undefined
      : { ...manifestRecord.artifact.companion },
  },
}

const defaultInput = {
  operation: 'integrate-orbit' as const,
  R: 1,
  z: 0.1,
  phi: 0,
  vR: 0,
  vT: 1,
  vz: 0,
  timeStep: 0.01,
  steps: 200,
  sampleEvery: 20,
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function response(bytes: Uint8Array, contentType: string): Response {
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-length': String(bytes.byteLength),
    },
  })
}

function localFetch(): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string | URL) => {
    const path = String(url)
    if (path.endsWith('.js')) return response(javascriptBytes, 'application/javascript')
    if (path.endsWith('.wasm')) return response(wasmBytes, 'application/wasm')
    throw new Error(`Unexpected galpy URL ${path}`)
  })
}

describe('galpy MWPotential2014 WASM artifact', () => {
  it('matches the fixed artifact ledger without host paths', async () => {
    const ledger = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/awesomePhysics/wasm/galpy/build-ledger.json'), 'utf8')) as {
      source: { revision: string }
      artifact: {
        wasm: { name: string; path: string; byteSize: number; sha256: string }
        javascript: { name: string; path: string; byteSize: number; sha256: string }
      }
    }
    expect(ledger.source.revision).toBe(GALPY_SOURCE_REVISION)
    expect(ledger.artifact.wasm).toEqual({
      name: 'galpy.wasm',
      path: GALPY_ARTIFACT_INTEGRITY.wasm.path,
      byteSize: GALPY_ARTIFACT_INTEGRITY.wasm.byteSize,
      sha256: GALPY_ARTIFACT_INTEGRITY.wasm.sha256,
    })
    expect(ledger.artifact.javascript).toEqual({
      name: 'galpy.js',
      path: GALPY_ARTIFACT_INTEGRITY.javascript.path,
      byteSize: GALPY_ARTIFACT_INTEGRITY.javascript.byteSize,
      sha256: GALPY_ARTIFACT_INTEGRITY.javascript.sha256,
    })
    expect(wasmBytes.byteLength).toBe(19591)
    expect(javascriptBytes.byteLength).toBe(594)
    expect(sha256(wasmBytes)).toBe(GALPY_ARTIFACT_INTEGRITY.wasm.sha256)
    expect(sha256(javascriptBytes)).toBe(GALPY_ARTIFACT_INTEGRITY.javascript.sha256)
    const wasmText = Buffer.from(wasmBytes).toString('latin1')
    expect(wasmText.includes('/home/braulio')).toBe(false)
    expect(wasmText.includes('/tmp/opencode')).toBe(false)
    expect(wasmText.includes('/tmp/galpy-wasm-build')).toBe(false)

    const module = await WebAssembly.compile(wasmBytes)
    expect(WebAssembly.Module.imports(module)).toEqual([])
    expect(WebAssembly.Module.exports(module).map(({ name }) => name)).toEqual(expect.arrayContaining([
      'galpy_orbit_init',
      'galpy_orbit_step',
      'galpy_orbit_energy',
      'galpy_orbit_Lz',
      'galpy_circular_velocity',
    ]))
  })

  it('keeps MWPotential2014 circular velocity at R=1 equal to 1 and conserves Lz', async () => {
    const module = await WebAssembly.compile(wasmBytes)
    const instance = await WebAssembly.instantiate(module, {})
    const exports = instance.exports as {
      galpy_orbit_init: (...args: number[]) => number
      galpy_orbit_step: (dt: number) => number
      galpy_orbit_energy: () => number
      galpy_orbit_Lz: () => number
      galpy_circular_velocity: (R: number) => number
    }
    expect(exports.galpy_circular_velocity(1)).toBeCloseTo(1, 8)
    expect(exports.galpy_orbit_init(1, 0.1, 0, 0, 1, 0)).toBe(1)
    const energy0 = exports.galpy_orbit_energy()
    const lz0 = exports.galpy_orbit_Lz()
    for (let step = 0; step < 200; step += 1) expect(exports.galpy_orbit_step(0.01)).toBe(1)
    expect(exports.galpy_orbit_Lz()).toBeCloseTo(lz0, 10)
    expect(Math.abs(exports.galpy_orbit_energy() - energy0)).toBeLessThan(1e-4)
  })

  it('parses bounded orbit and circular-velocity input', () => {
    expect(parseGalpyInput(defaultInput)).toEqual(defaultInput)
    expect(parseGalpyInput({ operation: 'circular-velocity', R: 1 })).toEqual({ operation: 'circular-velocity', R: 1 })
    expect(() => parseGalpyInput({ ...defaultInput, extra: true })).toThrow(/unknown properties/)
    expect(() => parseGalpyInput({ ...defaultInput, steps: 0 })).toThrow(/between/)
    expect(() => parseGalpyInput({ ...defaultInput, steps: GALPY_BOUNDS.maximumSteps + 1 })).toThrow(/between/)
    expect(() => parseGalpyInput({ ...defaultInput, steps: 1.5 })).toThrow(/integer/)
    expect(() => parseGalpyInput({ ...defaultInput, R: 0 })).toThrow(/between/)
    expect(() => parseGalpyInput({ ...defaultInput, timeStep: Number.NaN })).toThrow(/finite number/)
    expect(() => parseGalpyInput({ operation: 'unknown', R: 1 })).toThrow(/integrate-orbit or circular-velocity/)
  })

  it('loads the verified pair through the shared WASM runtime and integrates an orbit', async () => {
    const fetch = localFetch()
    const loaded = await instantiateVerifiedWasm(fixtureRecord, { fetch, basePath: '/' })
    expect(loaded.companionBytes).toEqual(javascriptBytes)
    expect(fetch).toHaveBeenNthCalledWith(1, '/wasm/awesomePhysics/galpy/galpy.wasm', { signal: undefined })
    expect(fetch).toHaveBeenNthCalledWith(2, '/wasm/awesomePhysics/galpy/galpy.js', { signal: undefined })

    const adapter = createGalpyAdapterFromRecord(
      availableDescriptor,
      new AbortController().signal,
      fixtureRecord,
      { fetch: localFetch(), basePath: '/' },
    )
    expect(adapter).toMatchObject({
      adapterId: GALPY_ADAPTER_ID,
      protocol: 'awesome-physics-adapter-v1',
      compatibility: {
        contentRevision: availableDescriptor.contentRevision,
        modelRevision: availableDescriptor.modelRevision,
        implementationRevision: availableDescriptor.implementationRevision,
        outputRevision: availableDescriptor.outputRevision,
      },
    })
    const circular = await adapter.run({ operation: 'circular-velocity', R: 1 })
    expect(circular).toMatchObject({
      schemaVersion: 1,
      operation: 'circular-velocity',
      value: expect.closeTo(1, 8),
      units: 'natural',
      provenance: GALPY_PROVENANCE,
    })
    const output = await adapter.run(defaultInput)
    expect(output).toMatchObject({
      schemaVersion: 1,
      operation: 'integrate-orbit',
      model: 'mwpotential2014-orbit-v1',
      provenance: GALPY_PROVENANCE,
    })
    if (output.operation !== 'integrate-orbit') throw new Error('expected orbit output')
    expect(output.circularVelocityAtR0).toBeCloseTo(1, 8)
    expect(output.samples).toHaveLength(11)
    expect(output.invariants.LzRelativeDrift).toBeLessThan(1e-10)
    expect(output.invariants.energyRelativeDrift).toBeLessThan(GALPY_BOUNDS.maximumEnergyDrift)
  })

  it('fails closed on compatibility, cancellation, and unavailable records', async () => {
    expect(() => createGalpyAdapterFromRecord(
      { ...availableDescriptor, catalogItemId: 'wrong-catalog-item' },
      new AbortController().signal,
      fixtureRecord,
    )).toThrow(/requires the galpy simulation descriptor/)
    expect(() => createGalpyAdapterFromRecord(
      { ...availableDescriptor, adapterId: 'wrong-adapter' },
      new AbortController().signal,
      fixtureRecord,
    )).toThrow(/adapterId is incompatible/)

    const abortedFactory = new AbortController()
    abortedFactory.abort()
    expect(() => createGalpyAdapterFromRecord(
      availableDescriptor,
      abortedFactory.signal,
      fixtureRecord,
    )).toThrow(/aborted/)

    const fetch = localFetch()
    const adapter = createGalpyAdapterFromRecord(
      availableDescriptor,
      new AbortController().signal,
      fixtureRecord,
      { fetch },
    )
    const abortedRun = new AbortController()
    abortedRun.abort()
    await expect(adapter.run(defaultInput, abortedRun.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).not.toHaveBeenCalled()

    expect(() => createGalpyAdapterFromRecord(
      availableDescriptor,
      new AbortController().signal,
      { ...fixtureRecord, status: 'planned', artifact: { path: null, sha256: null, byteSize: null } },
    )).toThrow(/is planned, not available/)
  })

  it('publishes the verified descriptor and central adapter registration', () => {
    expect(descriptor).toMatchObject({
      execution: 'wasm',
      availability: 'available',
      runnable: true,
      adapterId: GALPY_ADAPTER_ID,
      sourceRevision: GALPY_SOURCE_REVISION,
      implementationRevision: GALPY_IMPLEMENTATION_REVISION,
    })
    expect(manifestRecord).toMatchObject({
      status: 'available',
      licenseGate: { status: 'pass' },
      source: { revision: GALPY_SOURCE_REVISION },
      artifact: {
        path: GALPY_ARTIFACT_INTEGRITY.wasm.path,
        sha256: GALPY_ARTIFACT_INTEGRITY.wasm.sha256,
        byteSize: GALPY_ARTIFACT_INTEGRITY.wasm.byteSize,
        companion: GALPY_ARTIFACT_INTEGRITY.javascript,
      },
    })
    expect(awesomePhysicsAdapterFactoryMap.has(GALPY_ADAPTER_ID)).toBe(true)
  })
})
