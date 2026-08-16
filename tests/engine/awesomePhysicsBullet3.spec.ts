import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  BULLET3_ADAPTER_ID,
  BULLET3_ARTIFACT_INTEGRITY,
  BULLET3_BOUNDS,
  BULLET3_SOURCE_REVISION,
  createBullet3Adapter,
  instantiateBullet3Module,
  parseBullet3Input,
} from '../../src/awesomePhysics/adapters/wasm/bullet3'
import { NATIVE_CANDIDATES } from '../../src/awesomePhysics/artifactManifest'
import { awesomePhysicsAdapterFactoryMap } from '../../src/awesomePhysics/adapterFactories'
import type { AwesomePhysicsSimulationArtifactV1 } from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const descriptor = simulations.items.find(({ catalogItemId }) => catalogItemId === 'awesome-bullet3')
if (!descriptor) throw new Error('Missing generated Bullet3 descriptor')
const manifestRecord = NATIVE_CANDIDATES.find(({ id }) => id === 'bullet3')
if (!manifestRecord) throw new Error('Missing Bullet3 native candidate record')

const publicBullet3Root = resolve(process.cwd(), 'public/wasm/awesomePhysics/bullet3')
const wasmBytes = new Uint8Array(readFileSync(resolve(publicBullet3Root, 'bullet3.wasm')))

const availableDescriptor = {
  ...descriptor,
  execution: 'wasm' as const,
  executionOptions: ['wasm'],
  availability: 'available' as const,
  runnable: true,
  adapterId: BULLET3_ADAPTER_ID,
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

describe('Bullet3 headless scalar WASM artifact', () => {
  it('exposes the verified raw ABI and known finite sphere step', async () => {
    const module = await WebAssembly.compile(wasmBytes)
    const exports = WebAssembly.Module.exports(module).map(({ name }) => name)
    expect(exports).toEqual(expect.arrayContaining(['bullet_version', 'bullet_step']))

    const wasm = await instantiateBullet3Module(module)
    expect(wasm.bullet_version()).toBe(327)
    expect(wasm.bullet_step()).toBeCloseTo(9.997221946716309, 6)
    expect(Number.isFinite(wasm.bullet_step())).toBe(true)
  })

  it('matches the fixed artifact size and SHA-256 metadata', () => {
    expect(BULLET3_SOURCE_REVISION).toBe('63c4d67e337017f9d8b298c900e9aabdb69296e7')
    expect(wasmBytes.byteLength).toBe(BULLET3_ARTIFACT_INTEGRITY.byteSize)
    expect(sha256(wasmBytes)).toBe(BULLET3_ARTIFACT_INTEGRITY.sha256)
    expect(BULLET3_ARTIFACT_INTEGRITY.path).toBe('wasm/awesomePhysics/bullet3/bullet3.wasm')
    expect(manifestRecord).toMatchObject({
      status: 'available',
      licenseGate: { status: 'pass' },
      source: { revision: BULLET3_SOURCE_REVISION },
      artifact: BULLET3_ARTIFACT_INTEGRITY,
    })
  })

  it('rejects malformed and oversized POD inputs', () => {
    expect(parseBullet3Input({ operation: 'version' })).toEqual({ operation: 'version' })
    expect(parseBullet3Input({ operation: 'step' })).toEqual({ operation: 'step' })
    expect(() => parseBullet3Input(null)).toThrow(/JSON object/)
    expect(() => parseBullet3Input({ operation: 'unknown' })).toThrow(/version or step/)
    expect(() => parseBullet3Input({ operation: 'step', extra: 'not allowed' })).toThrow(/unknown properties/)
    expect(() => parseBullet3Input({ operation: 'step', padding: 'x'.repeat(BULLET3_BOUNDS.maximumInputBytes) })).toThrow(/input limit/)
  })

  it('returns descriptor compatibility and remains on the generic worker factory path', () => {
    const adapter = createBullet3Adapter(availableDescriptor, new AbortController().signal)
    expect(adapter).toMatchObject({
      adapterId: BULLET3_ADAPTER_ID,
      protocol: 'awesome-physics-adapter-v1',
      compatibility: {
        contentRevision: descriptor.contentRevision,
        modelRevision: descriptor.modelRevision,
        implementationRevision: descriptor.implementationRevision,
        outputRevision: descriptor.outputRevision,
      },
    })
    expect(awesomePhysicsAdapterFactoryMap.has(BULLET3_ADAPTER_ID)).toBe(true)
    expect(descriptor).toMatchObject({
      execution: 'wasm',
      availability: 'available',
      runnable: true,
      adapterId: BULLET3_ADAPTER_ID,
      sourceRevision: BULLET3_SOURCE_REVISION,
    })
  })

  it('rejects incompatible descriptors and cancellation before artifact loading', async () => {
    const signal = new AbortController()
    signal.abort()
    expect(() => createBullet3Adapter(availableDescriptor, signal.signal)).toThrow(/aborted/)

    expect(() => createBullet3Adapter({ ...availableDescriptor, execution: 'browser' }, new AbortController().signal))
      .toThrow(/requires WASM execution/)
    expect(() => createBullet3Adapter({ ...availableDescriptor, adapterId: 'other-adapter' }, new AbortController().signal))
      .toThrow(/adapterId is incompatible/)

    const adapter = createBullet3Adapter(availableDescriptor, new AbortController().signal)
    const runController = new AbortController()
    runController.abort()
    await expect(adapter.run({ operation: 'step' }, runController.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('publishes the verified descriptor and generic worker registration', () => {
    expect(descriptor).toMatchObject({
      execution: 'wasm',
      availability: 'available',
      runnable: true,
      adapterId: BULLET3_ADAPTER_ID,
      sourceRevision: BULLET3_SOURCE_REVISION,
    })
    expect(descriptor).toHaveProperty('adapterId', BULLET3_ADAPTER_ID)
    expect(awesomePhysicsAdapterFactoryMap.has(BULLET3_ADAPTER_ID)).toBe(true)
  })
})
