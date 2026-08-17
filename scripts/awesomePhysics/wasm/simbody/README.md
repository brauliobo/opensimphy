# Simbody WASM gate

Do not mount `awesome-simbody-wasm`. Unix CMake requires system BLAS/LAPACK.
The vendored LAPACK path is Windows-only. Emscripten has no BLAS/LAPACK, so
configure fails in `try_compile` before SimTKcommon, SimTKmath, or SimTKsimbody
are built. A WASM LAPACK port is outside the 256 MiB linear-memory and 64 MiB
artifact caps. Visualizer/OpenGL, examples, and tests stay excluded.

## Pins and RAM gate

- Simbody checkout: `944fd33fa42301929f760858ba5506affc025d8c`
- Emscripten: `6.0.6-git`, revision `ce75e06884093bcefb86a6b8fd56a5d62a4cc245`
- Configure flags: `SIMBODY_BUILD_SHARED_LIBS=OFF`, `BUILD_VISUALIZER=OFF`,
  `BUILD_EXAMPLES=OFF`, `BUILD_TESTING=OFF`, `INSTALL_DOCS=OFF`
- Compile RSS cap: 8 GiB; refuse to start below 4 GiB `MemAvailable`
- Parallelism: `nice` cmake configure only (`--parallel` is unused because
  configure fails closed)

Do not substitute a reconstructed TypeScript pendulum.

## Reproduction

```sh
node scripts/awesomePhysics/wasm/simbody/build.mjs \
  --source <pinned simbody checkout> \
  --output <empty .wasm-build directory>
```

The script fails closed when BLAS/LAPACK try_compile fails. Glue JavaScript is
not produced. License remains Apache-2.0.
