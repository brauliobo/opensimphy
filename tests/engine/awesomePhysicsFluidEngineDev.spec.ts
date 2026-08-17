import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  FLUID_ENGINE_DEV_ADAPTER_ID,
  FLUID_ENGINE_DEV_ARTIFACT_INTEGRITY,
  FLUID_ENGINE_DEV_SOURCE_REVISION,
  createFluidEngineDevAdapter,
  instantiateFluidEngineDevModule,
  parseFluidEngineDevInput,
} from '../../src/awesomePhysics/adapters/wasm/fluidEngineDev'
import { NATIVE_CANDIDATES } from '../../src/awesomePhysics/artifactManifest'
import { awesomePhysicsAdapterFactoryMap } from '../../src/awesomePhysics/adapterFactories'
import type { AwesomePhysicsSimulationArtifactV1 } from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const descriptor = simulations.items.find(({ catalogItemId }) => catalogItemId === 'awesome-fluid-engine-dev')
if (!descriptor) throw new Error('Missing generated fluid-engine-dev descriptor')
const manifestRecord = NATIVE_CANDIDATES.find(({ id }) => id === 'fluid-engine-dev')
if (!manifestRecord) throw new Error('Missing fluid-engine-dev native candidate record')

const publicRoot = resolve(process.cwd(), 'public/wasm/awesomePhysics/fluid-engine-dev')
const wasmBytes = new Uint8Array(readFileSync(resolve(publicRoot, 'fluid-engine-dev.wasm')))

const availableDescriptor = {
  ...descriptor,
  execution: 'wasm' as const,
  executionOptions: ['wasm'],
  availability: 'available' as const,
  runnable: true,
  adapterId: FLUID_ENGINE_DEV_ADAPTER_ID,
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

describe('fluid-engine-dev 2D SPH WASM artifact', () => {
  it('exposes the verified raw ABI and known finite SPH fixtures', async () => {
    const module = await WebAssembly.compile(wasmBytes)
    const exports = await instantiateFluidEngineDevModule(module)
    expect(exports.jet_sph2_step(0)).toBe(1)
    expect(exports.jet_sph2_step(1)).toBeCloseTo(0.9972777962684631, 6)
    expect(exports.jet_sph2_step(60)).toBeCloseTo(-3.981663703918457, 6)
    expect(Number.isFinite(exports.jet_sph2_step(601))).toBe(false)
  })

  it('matches the pinned local artifact', () => {
    expect(sha256(wasmBytes)).toBe(FLUID_ENGINE_DEV_ARTIFACT_INTEGRITY.sha256)
    expect(wasmBytes.byteLength).toBe(FLUID_ENGINE_DEV_ARTIFACT_INTEGRITY.byteSize)
    expect(FLUID_ENGINE_DEV_ARTIFACT_INTEGRITY.path).toBe('wasm/awesomePhysics/fluid-engine-dev/fluid-engine-dev.wasm')
    expect(manifestRecord).toMatchObject({
      status: 'available',
      source: { revision: FLUID_ENGINE_DEV_SOURCE_REVISION },
      artifact: FLUID_ENGINE_DEV_ARTIFACT_INTEGRITY,
    })
  })

  it('parses bounded step input', () => {
    expect(parseFluidEngineDevInput({ operation: 'step', steps: 60 })).toEqual({ operation: 'step', steps: 60 })
    expect(() => parseFluidEngineDevInput(null)).toThrow(/JSON object/)
    expect(() => parseFluidEngineDevInput({ operation: 'unknown' })).toThrow(/must be step/)
    expect(() => parseFluidEngineDevInput({ operation: 'step', steps: 601 })).toThrow(/between 0 and 600/)
    expect(() => parseFluidEngineDevInput({ operation: 'step', extra: 'x' })).toThrow(/unknown properties/)
  })

  it('returns descriptor compatibility and remains on the generic worker factory path', () => {
    const adapter = createFluidEngineDevAdapter(availableDescriptor, new AbortController().signal)
    expect(adapter).toMatchObject({
      adapterId: FLUID_ENGINE_DEV_ADAPTER_ID,
      protocol: 'awesome-physics-adapter-v1',
      compatibility: {
        contentRevision: descriptor.contentRevision,
        modelRevision: descriptor.modelRevision,
        implementationRevision: descriptor.implementationRevision,
        outputRevision: descriptor.outputRevision,
      },
    })
    expect(awesomePhysicsAdapterFactoryMap.has(FLUID_ENGINE_DEV_ADAPTER_ID)).toBe(true)
    expect(descriptor).toMatchObject({
      execution: 'wasm',
      availability: 'available',
      runnable: true,
      adapterId: FLUID_ENGINE_DEV_ADAPTER_ID,
      sourceRevision: FLUID_ENGINE_DEV_SOURCE_REVISION,
    })
  })

  it('rejects incompatible descriptors and cancellation before artifact loading', () => {
    const signal = new AbortController()
    signal.abort()
    expect(() => createFluidEngineDevAdapter(availableDescriptor, signal.signal)).toThrow(/aborted/)
    expect(() => createFluidEngineDevAdapter({ ...availableDescriptor, execution: 'browser' }, new AbortController().signal))
      .toThrow(/requires WASM execution/)
    expect(() => createFluidEngineDevAdapter({ ...availableDescriptor, adapterId: 'other-adapter' }, new AbortController().signal))
      .toThrow(/adapterId is incompatible/)
  })
})
