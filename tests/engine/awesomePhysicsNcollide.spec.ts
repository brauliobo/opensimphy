import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  NCOLLIDE_ADAPTER_ID,
  NCOLLIDE_ARTIFACT_INTEGRITY,
  NCOLLIDE_BOUNDS,
  NCOLLIDE_SOURCE_REVISION,
  createNcollideAdapter,
  instantiateNcollideModule,
  parseNcollideInput,
} from '../../src/awesomePhysics/adapters/wasm/ncollide'
import { NATIVE_CANDIDATES } from '../../src/awesomePhysics/artifactManifest'
import { awesomePhysicsAdapterFactoryMap } from '../../src/awesomePhysics/adapterFactories'
import type { AwesomePhysicsSimulationArtifactV1 } from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const descriptor = simulations.items.find(({ catalogItemId }) => catalogItemId === 'awesome-ncollide')
if (!descriptor) throw new Error('Missing generated ncollide descriptor')
const manifestRecord = NATIVE_CANDIDATES.find(({ id }) => id === 'ncollide')
if (!manifestRecord) throw new Error('Missing ncollide native candidate record')

const publicRoot = resolve(process.cwd(), 'public/wasm/awesomePhysics/ncollide')
const wasmBytes = new Uint8Array(readFileSync(resolve(publicRoot, 'ncollide2d.wasm')))

const availableDescriptor = {
  ...descriptor,
  execution: 'wasm' as const,
  executionOptions: ['wasm'],
  availability: 'available' as const,
  runnable: true,
  adapterId: NCOLLIDE_ADAPTER_ID,
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

describe('ncollide2d headless collision WASM artifact', () => {
  it('exposes the verified raw ABI and known finite collision fixtures', async () => {
    const module = await WebAssembly.compile(wasmBytes)
    expect(WebAssembly.Module.imports(module)).toEqual([])
    const exports = WebAssembly.Module.exports(module).map(({ name }) => name)
    expect(exports).toEqual(expect.arrayContaining([
      'ncollide_distance',
      'ncollide_contact_depth',
      'ncollide_ray_toi',
      'ncollide_time_of_impact',
      'ncollide_step',
    ]))

    const wasm = await instantiateNcollideModule(module)
    expect(wasm.ncollide_distance()).toBeCloseTo(2.650214672088623, 6)
    expect(wasm.ncollide_contact_depth()).toBeCloseTo(-2.6500000953674316, 6)
    expect(wasm.ncollide_ray_toi()).toBe(1.75)
    expect(wasm.ncollide_time_of_impact()).toBe(1.5)
    expect(wasm.ncollide_step(0)).toBe(2)
    expect(wasm.ncollide_step(1)).toBeCloseTo(1.9972749948501587, 6)
    expect(wasm.ncollide_step(60)).toBe(-0.75)
    expect(wasm.ncollide_step(600)).toBe(-0.75)
    expect(Number.isFinite(wasm.ncollide_step(601))).toBe(false)
  })

  it('matches the fixed artifact size and SHA-256 metadata', () => {
    expect(NCOLLIDE_SOURCE_REVISION).toBe('f3c3ecb3c98d1c2698574372b6b0e9d0032bc0c5')
    expect(wasmBytes.byteLength).toBe(NCOLLIDE_ARTIFACT_INTEGRITY.byteSize)
    expect(sha256(wasmBytes)).toBe(NCOLLIDE_ARTIFACT_INTEGRITY.sha256)
    expect(NCOLLIDE_ARTIFACT_INTEGRITY.path).toBe('wasm/awesomePhysics/ncollide/ncollide2d.wasm')
    expect(manifestRecord).toMatchObject({
      status: 'available',
      licenseGate: { status: 'pass' },
      source: { revision: NCOLLIDE_SOURCE_REVISION },
      artifact: NCOLLIDE_ARTIFACT_INTEGRITY,
    })
  })

  it('rejects malformed and oversized POD inputs', () => {
    expect(parseNcollideInput({ operation: 'distance' })).toEqual({ operation: 'distance' })
    expect(parseNcollideInput({ operation: 'step', steps: 60 })).toEqual({ operation: 'step', steps: 60 })
    expect(() => parseNcollideInput(null)).toThrow(/JSON object/)
    expect(() => parseNcollideInput({ operation: 'unknown' })).toThrow(/distance, contact, ray, time-of-impact, or step/)
    expect(() => parseNcollideInput({ operation: 'step', extra: 'not allowed' })).toThrow(/unknown properties/)
    expect(() => parseNcollideInput({ operation: 'step', steps: 601 })).toThrow(/between 0 and 600/)
    expect(() => parseNcollideInput({ operation: 'step', steps: 60, padding: 'x'.repeat(NCOLLIDE_BOUNDS.maximumInputBytes) })).toThrow(/input limit/)
  })

  it('returns descriptor compatibility and remains on the generic worker factory path', () => {
    const adapter = createNcollideAdapter(availableDescriptor, new AbortController().signal)
    expect(adapter).toMatchObject({
      adapterId: NCOLLIDE_ADAPTER_ID,
      protocol: 'awesome-physics-adapter-v1',
      compatibility: {
        contentRevision: descriptor.contentRevision,
        modelRevision: descriptor.modelRevision,
        implementationRevision: descriptor.implementationRevision,
        outputRevision: descriptor.outputRevision,
      },
    })
    expect(awesomePhysicsAdapterFactoryMap.has(NCOLLIDE_ADAPTER_ID)).toBe(true)
    expect(descriptor).toMatchObject({
      execution: 'wasm',
      availability: 'available',
      runnable: true,
      adapterId: NCOLLIDE_ADAPTER_ID,
      sourceRevision: NCOLLIDE_SOURCE_REVISION,
    })
  })

  it('rejects incompatible descriptors and cancellation before artifact loading', async () => {
    const signal = new AbortController()
    signal.abort()
    expect(() => createNcollideAdapter(availableDescriptor, signal.signal)).toThrow(/aborted/)

    expect(() => createNcollideAdapter({ ...availableDescriptor, execution: 'browser' }, new AbortController().signal))
      .toThrow(/requires WASM execution/)
    expect(() => createNcollideAdapter({ ...availableDescriptor, adapterId: 'other-adapter' }, new AbortController().signal))
      .toThrow(/adapterId is incompatible/)

    const adapter = createNcollideAdapter(availableDescriptor, new AbortController().signal)
    const runController = new AbortController()
    runController.abort()
    await expect(adapter.run({ operation: 'step', steps: 60 }, runController.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
