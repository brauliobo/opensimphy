import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'
import {
  COOLPROP_ADAPTER_ID,
  parseCoolPropInput,
} from '../../src/awesomePhysics/adapters/wasm/coolprop'
import {
  WASM_PILOT_MANIFEST,
  WASM_PILOTS,
  parseWasmPilotManifest,
} from '../../src/awesomePhysics/artifactManifest'
import { loadVerifiedCompanionJavaScript } from '../../src/awesomePhysics/wasmArtifactLoader'
import { awesomePhysicsDefaultInput } from '../../src/awesomePhysics/defaultInputs'
import { runInWorker } from '../../src/awesomePhysics/workers/runInWorker'
import type {
  AwesomePhysicsWorkerRequest,
  AwesomePhysicsWorkerResponse,
} from '../../src/awesomePhysics/workers/protocol'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import type { AwesomePhysicsSimulationArtifactV1 } from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const coolpropRecord = WASM_PILOTS.find(({ id }) => id === 'coolprop')
if (!coolpropRecord) throw new Error('Missing CoolProp WASM pilot record')

const descriptor = simulations.items.find(({ catalogItemId }) => catalogItemId === 'awesome-coolprop')
if (!descriptor) throw new Error('Missing generated CoolProp descriptor')

const fixtureDescriptor = {
  ...descriptor,
  adapterId: COOLPROP_ADAPTER_ID,
  availability: 'available' as const,
  runnable: true,
}

const publicCoolPropRoot = resolve(process.cwd(), 'public/wasm/awesomePhysics/coolprop')
const javascriptBytes = new Uint8Array(readFileSync(resolve(publicCoolPropRoot, 'coolprop.js')))
const wasmBytes = new Uint8Array(readFileSync(resolve(publicCoolPropRoot, 'coolprop.wasm')))

type Listener = (event: Event) => void

class FakeWorker {
  readonly requests: AwesomePhysicsWorkerRequest[] = []
  readonly messageListeners = new Set<Listener>()
  readonly errorListeners = new Set<Listener>()
  readonly respond: boolean
  terminated = false

  constructor(respond = true) {
    this.respond = respond
  }

  postMessage(message: AwesomePhysicsWorkerRequest): void {
    this.requests.push(message)
    if (message.type !== 'run' || !this.respond) return
    queueMicrotask(() => {
      this.emit({
        type: 'completed',
        requestId: message.requestId,
        adapterId: message.adapterId,
        descriptor: message.descriptor,
        progress: 100,
        result: {
          operation: 'F2K',
          value: 273.15,
          provenance: { execution: 'verified-local-classic-worker', validatesTheory: false },
        },
      })
    })
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== 'function') return
    if (type === 'message') this.messageListeners.add(listener as Listener)
    if (type === 'error') this.errorListeners.add(listener as Listener)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== 'function') return
    if (type === 'message') this.messageListeners.delete(listener as Listener)
    if (type === 'error') this.errorListeners.delete(listener as Listener)
  }

  terminate(): void {
    this.terminated = true
  }

  emit(response: AwesomePhysicsWorkerResponse): void {
    for (const listener of this.messageListeners) listener({ data: response } as MessageEvent<unknown>)
  }
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

function localArtifactFetch(): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith('/coolprop.js')) return response(javascriptBytes, 'application/javascript')
    if (url.endsWith('/coolprop.wasm')) return response(wasmBytes, 'application/wasm')
    throw new Error(`Unexpected CoolProp URL ${url}`)
  })
}

function runRequest(input: unknown = { operation: 'F2K', celsius: 0 }) {
  return {
    type: 'run' as const,
    requestId: 'coolprop-test-request',
    adapterId: COOLPROP_ADAPTER_ID,
    descriptor: fixtureDescriptor,
    input,
  }
}

describe('CoolProp verified classic-worker artifact path', () => {
  it('publishes only the verified raw WASM plus an optional verified JS companion', () => {
    expect(coolpropRecord).toMatchObject({
      status: 'available',
      licenseGate: { status: 'pass' },
      artifact: {
        path: 'wasm/awesomePhysics/coolprop/coolprop.wasm',
        sha256: '14a7efa251ea9bd443d37a6629206434689894d12f123202dc9d698a5607f762',
        byteSize: 9352503,
        companion: {
          path: 'wasm/awesomePhysics/coolprop/coolprop.js',
          sha256: '0ffde908dc61430b78e02f5b60a1eee04d4b80f69af72739235b3ecb16eac7f6',
          byteSize: 171012,
        },
      },
    })
    expect(simulations.items.find(({ catalogItemId }) => catalogItemId === 'awesome-coolprop')).toMatchObject({
      execution: 'wasm',
      availability: 'available',
      runnable: true,
      adapterId: COOLPROP_ADAPTER_ID,
      licenseGate: 'pass',
      artifactProvenance: {
        byteSize: 9352503,
        sha256: '14a7efa251ea9bd443d37a6629206434689894d12f123202dc9d698a5607f762',
      },
    })
    expect(awesomePhysicsDefaultInput(COOLPROP_ADAPTER_ID)).toEqual({ operation: 'F2K', celsius: 0 })

    const legacyManifest = JSON.parse(JSON.stringify(WASM_PILOT_MANIFEST)) as typeof WASM_PILOT_MANIFEST
    delete legacyManifest.records[0]!.artifact.companion
    expect(() => parseWasmPilotManifest(legacyManifest)).not.toThrow()
  })

  it('bounds the explicit F2K, PropsSI, and AbstractState input schemas', () => {
    expect(parseCoolPropInput({ operation: 'F2K', celsius: 0 })).toEqual({ operation: 'F2K', celsius: 0 })
    expect(parseCoolPropInput({
      operation: 'PropsSI',
      output: 'T',
      input1: 'P',
      value1: 101325,
      input2: 'Q',
      value2: 0,
      fluid: 'Water',
    })).toMatchObject({ operation: 'PropsSI', fluid: 'Water' })
    expect(parseCoolPropInput({
      operation: 'AbstractState',
      backend: 'HEOS',
      fluid: 'Water',
      inputPair: 'PQ_INPUTS',
      value1: 101325,
      value2: 0,
      outputs: ['T', 'p'],
    })).toMatchObject({ operation: 'AbstractState', outputs: ['T', 'p'] })
    expect(() => parseCoolPropInput({ operation: 'F2K', celsius: Number.NaN })).toThrow(/finite number/)
    expect(() => parseCoolPropInput({ operation: 'AbstractState', backend: 'HEOS', fluid: 'Water', inputPair: 'PQ_INPUTS', value1: 1, value2: 0, outputs: ['not-an-output'] })).toThrow(/supported AbstractState output/)
  })

  it('verifies the local companion before a CoolProp worker is constructed', async () => {
    const fetch = localArtifactFetch()
    const createWorker = vi.fn(() => new FakeWorker() as unknown as Worker)
    const workerRun = runInWorker(runRequest(), { fetch, basePath: '/', createWorker })

    await expect(workerRun).resolves.toMatchObject({
      operation: 'F2K',
      value: 273.15,
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/coolprop.js')
    expect(String(fetch.mock.calls[1]?.[0])).toContain('/coolprop.wasm')
    expect(createWorker).toHaveBeenCalledOnce()
  })

  it('fails closed on a companion hash mismatch without constructing a worker', async () => {
    const fetch = localArtifactFetch()
    fetch.mockImplementationOnce(async () => response(new Uint8Array([1, 2, 3]), 'application/javascript'))
    const createWorker = vi.fn(() => new FakeWorker() as unknown as Worker)

    await expect(runInWorker(runRequest(), { fetch, basePath: '/', createWorker })).rejects.toThrow(/content-length|SHA-256/)
    expect(createWorker).not.toHaveBeenCalled()
  })

  it('exposes the verified companion loader with local MIME and size checks', async () => {
    const fetch = localArtifactFetch()
    const bytes = await loadVerifiedCompanionJavaScript(coolpropRecord, { fetch, basePath: '/' })
    expect(bytes.byteLength).toBe(171012)
    expect(fetch).toHaveBeenCalledWith('/wasm/awesomePhysics/coolprop/coolprop.js', { signal: undefined })
  })

  it('keeps cancellation on the dedicated classic worker boundary', async () => {
    const fetch = localArtifactFetch()
    const worker = new FakeWorker(false)
    const createWorker = vi.fn(() => worker as unknown as Worker)
    const controller = new AbortController()
    const workerRun = runInWorker(runRequest(), {
      fetch,
      basePath: '/',
      createWorker,
      signal: controller.signal,
    })

    await vi.waitFor(() => expect(createWorker).toHaveBeenCalledOnce())
    controller.abort()
    await expect(workerRun).rejects.toMatchObject({ name: 'AbortError' })
    expect(worker.requests.at(-1)).toEqual({ type: 'cancel', requestId: 'coolprop-test-request' })
    expect(worker.terminated).toBe(true)
  })
})
