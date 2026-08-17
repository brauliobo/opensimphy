export const WASM_PAGE_SIZE = 65536
export const WASM_SHARED_MEMORY = false
export const DEFAULT_MAX_MEMORY_BYTES = 134217728
export const CARGO_JOBS = 4
export const CARGO_VIRTUAL_MEMORY_KB = 16 * 1024 * 1024

export const AWESOME_WASM_CONVENTION_V1 = Object.freeze({
  memory: Object.freeze({
    kind: 'linear',
    pageSize: WASM_PAGE_SIZE,
    shared: WASM_SHARED_MEMORY,
    maxMemoryBytes: DEFAULT_MAX_MEMORY_BYTES,
  }),
  allocator: Object.freeze({
    kinds: Object.freeze(['none', 'bump', 'malloc-free', 'bindgen', 'emscripten']),
  }),
  threads: 'single',
  persistRoot: '.wasm-build',
  publicRoot: 'public/wasm/awesomePhysics',
  hostPathNeedles: Object.freeze(['/home/braulio', '/tmp/opencode']),
  harness: Object.freeze({
    cases: 'public/data/generated/awesomePhysics/benchmark-cases.json',
    results: 'public/data/generated/awesomePhysics/benchmark-results.json',
    registryModule: 'src/awesomePhysics/benchmark/index.ts',
  }),
})
