import { loadVerifiedWasmArtifactById } from '../awesomePhysics/wasmArtifactLoader'
import { runAwesomePhysicsInWorker } from '../awesomePhysics/workers/runInWorker'
import type { CaseMount, CaseRecord } from './types'

export const CASE_HARNESS_APIS = Object.freeze({
  gray:    'runGrayInWorker',
  awesome: 'runAwesomePhysicsInWorker',
  wasm:    'loadVerifiedWasmArtifactById',
})

export function describeCaseMount(record: CaseRecord): CaseMount {
  return record.mount
}

export function awesomePhysicsHarness() {
  return {
    run:  runAwesomePhysicsInWorker,
    wasm: loadVerifiedWasmArtifactById,
  }
}
