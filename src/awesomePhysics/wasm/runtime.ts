import { artifactRecordById } from '../artifactManifest'
import type { ArtifactRecordV1 } from '../artifactManifest'
import {
  loadVerifiedCompanionJavaScript,
  loadVerifiedWasmArtifact,
  type WasmArtifactLoadOptions,
} from '../wasmArtifactLoader'
import {
  wasmRuntimeConvention,
  type WasmAllocatorKindV1,
  type WasmRuntimeConventionV1,
  type WasmRuntimeKindV1,
} from './conventions'

export interface SharedWasmLoadOptions extends WasmArtifactLoadOptions {
  runtimeKind?: WasmRuntimeKindV1
  allocator?: WasmAllocatorKindV1
  imports?: WebAssembly.Imports
}

export interface SharedWasmInstanceV1 {
  record: ArtifactRecordV1
  convention: WasmRuntimeConventionV1
  module: WebAssembly.Module
  instance: WebAssembly.Instance
  companionBytes: Uint8Array | null
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  const error = signal.reason instanceof Error ? signal.reason : new Error('The shared WASM load was aborted')
  error.name = 'AbortError'
  throw error
}

export function wasmRuntimeKindFor(record: ArtifactRecordV1): WasmRuntimeKindV1 {
  if (record.build.family === 'rust-cargo-wasm' || record.build.family === 'rust-wasm-bindgen-headless') return 'bindgen'
  if (record.build.family === 'emscripten' || record.build.family === 'emscripten-headless') return 'emscripten'
  return 'raw'
}

export async function instantiateVerifiedWasm(
  record: ArtifactRecordV1,
  options: SharedWasmLoadOptions = {},
): Promise<SharedWasmInstanceV1> {
  throwIfAborted(options.signal)
  const runtimeKind = options.runtimeKind ?? wasmRuntimeKindFor(record)
  const convention = wasmRuntimeConvention(runtimeKind, record.runtime.maxMemoryBytes, options.allocator)
  const module = await loadVerifiedWasmArtifact(record, options)
  throwIfAborted(options.signal)
  const companionBytes = record.artifact.companion === undefined
    ? null
    : await loadVerifiedCompanionJavaScript(record, options)
  throwIfAborted(options.signal)
  const instance = await WebAssembly.instantiate(module, options.imports ?? {})
  return { record, convention, module, instance, companionBytes }
}

export async function instantiateVerifiedWasmById(
  id: string,
  options: SharedWasmLoadOptions = {},
): Promise<SharedWasmInstanceV1> {
  const record = artifactRecordById(id)
  if (record === null) throw new Error(`No WASM manifest record exists for ${id}`)
  return instantiateVerifiedWasm(record, options)
}

export { loadVerifiedCompanionJavaScript, loadVerifiedWasmArtifact, loadVerifiedWasmArtifactById } from '../wasmArtifactLoader'
