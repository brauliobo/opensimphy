export const WASM_PAGE_SIZE = 65_536
export const WASM_SHARED_MEMORY = false

export type WasmRuntimeKindV1 = 'raw' | 'bindgen' | 'emscripten'
export type WasmAllocatorKindV1 = 'none' | 'bump' | 'malloc-free' | 'bindgen' | 'emscripten'

export interface WasmMemoryConventionV1 {
  kind: 'linear'
  pageSize: typeof WASM_PAGE_SIZE
  shared: false
  maxMemoryBytes: number
}

export interface WasmAllocatorConventionV1 {
  kind: WasmAllocatorKindV1
}

export interface WasmRuntimeConventionV1 {
  runtimeKind: WasmRuntimeKindV1
  memory: WasmMemoryConventionV1
  allocator: WasmAllocatorConventionV1
  threads: 'single'
}

export function wasmMemoryConvention(maxMemoryBytes: number): WasmMemoryConventionV1 {
  if (!Number.isSafeInteger(maxMemoryBytes) || maxMemoryBytes < WASM_PAGE_SIZE) {
    throw new TypeError('WASM maxMemoryBytes must be a safe integer of at least one page')
  }
  return { kind: 'linear', pageSize: WASM_PAGE_SIZE, shared: WASM_SHARED_MEMORY, maxMemoryBytes }
}

export function wasmRuntimeConvention(
  runtimeKind: WasmRuntimeKindV1,
  maxMemoryBytes: number,
  allocator: WasmAllocatorKindV1 = runtimeKind === 'raw' ? 'none' : runtimeKind,
): WasmRuntimeConventionV1 {
  return {
    runtimeKind,
    memory: wasmMemoryConvention(maxMemoryBytes),
    allocator: { kind: allocator },
    threads: 'single',
  }
}
