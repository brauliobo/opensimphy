import { artifactRecordById } from '../artifactManifest'
import {
  loadVerifiedCompanionJavaScript,
  loadVerifiedWasmArtifact,
} from '../wasmArtifactLoader'
import {
  runParsedInWorker,
  type AwesomePhysicsWorkerFactory,
  type RunAwesomePhysicsInWorkerOptions,
} from '../workers/runInWorker'
import type { AwesomePhysicsWorkerRunRequest } from '../workers/protocol'

const COOLPROP_MANIFEST_ID = 'coolprop'
const COOLPROP_CLASSIC_WORKER_PATH = 'wasm/awesomePhysics/coolprop/coolprop.worker.js'

function abortError(message: string): DOMException {
  return new DOMException(message, 'AbortError')
}

function localWorkerFactory(basePath: string | undefined): AwesomePhysicsWorkerFactory {
  return () => {
    const root = basePath ?? import.meta.env.BASE_URL
    const normalizedRoot = root.endsWith('/') ? root : `${root}/`
    const workerUrl = new URL(`${normalizedRoot}${COOLPROP_CLASSIC_WORKER_PATH}`, globalThis.location.href)
    return new Worker(workerUrl, { type: 'classic' })
  }
}

export async function runCoolPropInWorker<TInput = unknown, TOutput = unknown>(
  request: AwesomePhysicsWorkerRunRequest<TInput>,
  options: RunAwesomePhysicsInWorkerOptions = {},
): Promise<TOutput> {
  const { COOLPROP_ADAPTER_ID, parseCoolPropInput } = await import('../adapters/wasm/coolprop')
  if (request.adapterId !== COOLPROP_ADAPTER_ID) {
    throw new TypeError('The CoolProp runner received an incompatible adapter ID')
  }
  const input = parseCoolPropInput(request.input)
  if (options.signal?.aborted) throw abortError('The CoolProp worker run was aborted')

  const record = artifactRecordById(COOLPROP_MANIFEST_ID)
  if (record === null) throw new Error('The CoolProp artifact manifest record is missing')
  const artifactOptions = {
    fetch: options.fetch,
    basePath: options.basePath,
    maxBytes: record.runtime.maxArtifactBytes,
    signal: options.signal,
  }

  await loadVerifiedCompanionJavaScript(record, artifactOptions)
  await loadVerifiedWasmArtifact(record, artifactOptions)
  if (options.signal?.aborted) throw abortError('The CoolProp worker run was aborted')

  return runParsedInWorker(
    { ...request, input },
    options,
    localWorkerFactory(options.basePath),
  ) as Promise<TOutput>
}

export const runCoolPropAdapterInWorker = runCoolPropInWorker
