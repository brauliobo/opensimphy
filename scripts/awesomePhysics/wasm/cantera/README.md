# Cantera headless WASM pilot

Pinned Cantera C++ thermo, HP equilibrium, and one zero-D constant-pressure
reactor on the selected `h2o2.yaml` mechanism. This is not the documented
Pyodide wheel: the shared Awesome Physics harness instantiates a verified
`wasm-module`, so the artifact is a standalone Emscripten module with the same
toolchain as galpy/Bullet3. Export names stay unminified; C++ exceptions stay
inside the module.

## Pins

- Source: `awesome-physics-repos/cantera` revision `11a2381011cb6d42e61cc4c195e0f920864bf8d3`
- Emscripten: `6.0.6-git` revision `ce75e06884093bcefb86a6b8fd56a5d62a4cc245`
- Mechanism: `scripts/awesomePhysics/wasm/cantera/h2o2.yaml` (GRI-Mech 3.0 H2/O2 subset)
- Memory: 256 MiB maximum linear memory, 64 MiB artifact budget
- Parallelism: `cmake --build --parallel 4`

The build refuses a dirty or differently pinned checkout and never writes into
that checkout. Boost.DLL / Python extensions, HDF5, LAPACK, and 1-D flames are
excluded.

## Reproduction

```sh
node scripts/awesomePhysics/wasm/cantera/build.mjs \
  --source <clean pinned cantera checkout> \
  --output <empty out-of-tree directory> \
  --em-cache <pinned Emscripten cache>
```

Promote only `cantera.wasm` and `cantera.js` into
`public/wasm/awesomePhysics/cantera/` together with `NOTICE.md`.
