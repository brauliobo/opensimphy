# Bullet3 Headless Scalar WASM Artifact

This directory is the reproducible build path for the verified Bullet3 raw WASM
artifact. The build uses the pinned checkout read-only and puts CMake output,
intermediate Bullet static libraries, and the temporary Emscripten JavaScript
glue in a separate output directory. Only the verified raw `.wasm` file is
promoted to `public/wasm/awesomePhysics/bullet3/`. An upstream `.a` file is an
intermediate library, not a browser artifact.

## Pins and scope

- Bullet3 checkout: revision `63c4d67e3370` (full commit
  `63c4d67e337017f9d8b298c900e9aabdb69296e7`), version `3.27`.
- Emscripten: `6.0.6-git`, revision
  `ce75e06884093bcefb86a6b8fd56a5d62a4cc245`.
- CMake generator: Ninja, Release, maximum build parallelism `4`.
- ABI link: `-O2 -DNDEBUG -std=c++11`, `MODULARIZE=1`, `EXPORT_ES6=1`,
  `ENVIRONMENT=web,node`, `ASSERTIONS=1`, and `ALLOW_MEMORY_GROWTH=1`.
- CPU configuration: `BUILD_CPU_DEMOS=OFF`, `BUILD_OPENGL3_DEMOS=OFF`,
  `BUILD_BULLET2_DEMOS=OFF`, `BUILD_BULLET3=OFF`, `BUILD_EXTRAS=OFF`,
  `BUILD_UNIT_TESTS=OFF`, `BUILD_EGL=OFF`, `USE_GRAPHICAL_BENCHMARK=OFF`,
  and `BULLET2_MULTITHREADING=OFF`.

The selected ABI is deliberately small and scalar/POD-only. It creates a
headless Bullet dynamics world containing a static plane and a sphere, steps
one fixed simulation interval, and exposes only:

- `bullet_version() -> int`, which returns `327`.
- `bullet_step() -> float`, which returns the sphere Y coordinate
  `9.997221946716309` for the fixed fixture.

ExampleBrowser, OpenGL, VR, Bullet3 OpenCL, extras, tests, pthreads, OpenMP,
TBB, and other multithreading paths are not part of the build. Emscripten emits
temporary glue to link the module; that JavaScript is not promoted or shipped.
The adapter supplies the small local Emscripten/WASI import set when it
instantiates the raw module.

## Reproduction

Run from the `opensimphy` checkout with an empty output directory outside both
the source checkout and this repository:

```sh
node scripts/awesomePhysics/wasm/bullet3/build.mjs \
  --source ../awesome-physics-repos/bullet3 \
  --output /tmp/opencode/awesome-physics-builds/bullet3-repro \
  --em-cache /home/braulio/.cache/emscripten \
  --toolchain /usr/lib/emscripten/cmake/Modules/Platform/Emscripten.cmake
```

The script fails before promotion when the checkout, toolchain, source notice
files, output cleanliness, compiler revision, source revision, WASM imports or
exports, known scalar result, byte size, or SHA-256 digest differs. It also
checks that the pinned source checkout is clean after the build.

## Expected artifact

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `bullet3.wasm` | `333983` | `1f255bb36e7c7a4f14a03cccfb95f13a39fdf50a9c2b2259faa1048e0473b425` |

The artifact is an upstream Bullet numerical evaluation path. A finite scalar
fixture result does not validate a physical theory, model, or experimental
result. The ABI and adapter are a proof boundary, not a general Bullet API.

License and attribution review is recorded in `NOTICE-LEDGER.md`. The public
artifact retains `public/wasm/awesomePhysics/bullet3/NOTICE.md`, including the
Bullet zlib license, the pinned `AUTHORS.txt` attribution, the selected zlib
notice, and the Emscripten/LLVM toolchain notice references.
