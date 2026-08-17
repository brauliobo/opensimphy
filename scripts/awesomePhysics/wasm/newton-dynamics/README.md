# Newton Dynamics Headless Scalar WASM

Repository-local CMake façade over the pinned `newton-dynamics` 4.00 CPU SDK.
Sandbox, OpenGL, OpenCL, CUDA, shared libraries, and AVX2/SSE instruction paths
are excluded. The selected ABI is scalar/POD-only.

## Pins and RAM gate

- Newton checkout: `a9c460c3509c935e65c5b1196b955d56627c3ffa`
- Emscripten: `6.0.6-git`, revision `ce75e06884093bcefb86a6b8fd56a5d62a4cc245`
- Compile RSS cap: 12 GiB; refuse to start below 4 GiB `MemAvailable`
- Runtime linear memory cap: 256 MiB (`MAXIMUM_MEMORY`)
- Parallelism: `nice` cmake `--parallel 4`
- Defines: `D_SCALAR_VECTOR_CLASS`, `D_USE_THREAD_EMULATION`, `_D_SINGLE_LIBRARY`
- `ndMesh.cpp` links bundled VHACD; the public NOTICE retains its BSD-3-Clause
- Emscripten has no `FE_*` fenv macros; the façade defines the ISO values so
  `ndFloatExceptions` can parse its unused default mask

The RAM-capped build verified `newton-dynamics.wasm` with a finite
`newton_step`. The public module lives at
`public/wasm/awesomePhysics/newton-dynamics/` with NOTICE covering Newton zlib,
tinyxml zlib, and linked VHACD BSD-3-Clause.

## Reproduction

```sh
node scripts/awesomePhysics/wasm/newton-dynamics/build.mjs \
  --source <pinned newton-dynamics checkout> \
  --output <empty out-of-tree directory> \
  --em-cache <pinned Emscripten cache> \
  --toolchain <Emscripten CMake toolchain file>
```

The script fails closed on a dirty checkout, toolchain drift, missing SDK
files, RAM-gate miss, or a non-finite ABI result. Glue JavaScript is not
promoted.
