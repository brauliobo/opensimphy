# CoolProp Classic Worker Artifact

This is the reproducible build path for the verified CoolProp browser artifact. It
does not modify the pinned source checkout. The script copies the exact pinned
checkout, including CoolProp's ignored generated dependency inputs, into an
out-of-tree staging directory while omitting VCS/build metadata. It configures
CMake against the provided CPM and Emscripten caches, and promotes output only
after checking the expected byte sizes and SHA-256 digests.

## Pins

- CoolProp: `4db89c1ce8d0b0d98ba7f03594f58a845351cf6a`
- Emscripten: `6.0.6-git`, revision `ce75e06884093bcefb86a6b8fd56a5d62a4cc245`
- CMake generator: Ninja, Release, maximum build parallelism `4`
- C++ target define: `-DEMSCRIPTEN`
- Final link settings: `-sEXPORT_ES6=0 -sMODULARIZE=1 -sENVIRONMENT=web,worker,node`

The CPM cache must contain the pinned revisions declared by
`awesome-physics-repos/CoolProp/cmake/dependencies.cmake`: Eigen, msgpack-c,
nlohmann/json, valijson, IF97, REFPROP headers, Boost headers, multicomplex, and
fmt. The script fails before configuration when any required cache entry is
missing. The supplied source directory must be the clean pinned checkout used
for the verified build, including its ignored generated dependency inputs; the
script preserves their timestamps, disables CoolProp's unused upstream REFPROP
installation default in the staged source, and normalizes the staged source prefix so
compiler file names do not change the expected artifact bytes. No REFPROP
runtime or fluid files are redistributed by this artifact.

## Reproduction

Use an empty directory outside the CoolProp checkout. The source and cache paths
below are placeholders and must be local paths supplied by the build environment.

```sh
node scripts/awesomePhysics/wasm/coolprop/build.mjs \
  --source <pinned CoolProp checkout> \
  --output <empty out-of-tree directory> \
  --cpm-cache <pinned CPM cache> \
  --em-cache <pinned Emscripten cache> \
  --toolchain <Emscripten CMake toolchain file>
```

The command writes verified `coolprop.js` and `coolprop.wasm` files at the output
root. It also retains the staged source, CMake build, and install directories for
inspection. Only the two verified files belong in the public artifact directory;
do not copy the staging tree or caches.

## Expected outputs

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `coolprop.js` | `171012` | `0ffde908dc61430b78e02f5b60a1eee04d4b80f69af72739235b3ecb16eac7f6` |
| `coolprop.wasm` | `9352013` | `57742e874984ad5cddb12db534ea3a9c9903e5c5c518a08e18a099827a3a9829` |

The classic worker uses `importScripts('./coolprop.js')` and the factory's
`locateFile` callback to resolve `./coolprop.wasm`. The main-side runner verifies
both local files before constructing that worker. There is no CDN, remote
fallback, or module-worker path.

The artifact exposes bounded F2K, PropsSI, and AbstractState calls. Its provenance
identifies the upstream revision, implementation revision, artifact digests, and
MIT gate. These numerical calls do not validate a physical theory, model, or
experimental result.

Build/source evidence is recorded in the pinned CoolProp files
`CMakeLists.txt`, `cmake/dependencies.cmake`, `src/emscripten_interface.cxx`, and
`LICENSE`, plus the artifact `NOTICE.md`.
