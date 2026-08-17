# fluid-engine-dev reduced 2D SPH WASM

Out-of-tree serial 2D SPH kernel over pinned Jet sources. Upstream CMake
resource unpacking, gtest, pybind11, examples, TBB/OpenMP/C++11 tasking, and
the 3D factory/grid graph are excluded. A local `Factory::buildPointNeighborSearcher2`
façade supplies the deserialize symbol used by `ParticleSystemData2`.

## Pins and RAM gate

- fluid-engine-dev checkout: `94c300ff5ad8a2f588e5e27e8e9746a424b29863`
- Emscripten: `6.0.6-git`, revision `ce75e06884093bcefb86a6b8fd56a5d62a4cc245`
- Tasking: serial (no `JET_TASKING_*` defines); `-fwasm-exceptions`
- Compile RSS cap: 12 GiB; refuse to start below 4 GiB `MemAvailable`
- Runtime linear memory cap: 128 MiB; artifact cap: 64 MiB
- Parallelism: `nice` cmake `--parallel 4`

The ABI is `jet_sph2_step(steps) -> f32`: four SPH particles, one fixed
sub-step per frame, at most 600 frames. WASI `fd_write` must report nwritten
or libc logging retries hang.

## Reproduction

```sh
node scripts/awesomePhysics/wasm/fluid-engine-dev/build.mjs \
  --source <pinned fluid-engine-dev checkout> \
  --output <empty .wasm-build directory> \
  --install
```

## Expected artifact

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `fluid-engine-dev.wasm` | `230684` | `d8bdd5c4841ab009e0b008cacbee88660c09bf8906714c388decd548934e389e` |

| Call | Result |
| --- | ---: |
| `jet_sph2_step(0)` | `1` |
| `jet_sph2_step(1)` | `0.9972777962684631` |
| `jet_sph2_step(60)` | `-3.981663703918457` |
| `jet_sph2_step(601)` | NaN |

A finite SPH fixture is not a validation of a physical theory. License review
is in `NOTICE.md`.
