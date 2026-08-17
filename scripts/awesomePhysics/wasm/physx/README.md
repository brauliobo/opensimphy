# PhysX-3.4 Headless Scalar WASM

Repository-local CMake façade over the pinned PhysX 3.4 CPU SDK. APEX, GPU,
samples, cooking, vehicle, character, cloth, particles, and PVD are excluded.
The selected ABI is scalar/POD-only: version plus one plane/sphere step.

## Pins and RAM gate

- PhysX checkout: `5e42a5f112351a223c19c17bb331e6c55037b8eb`
- Emscripten: `6.0.6-git`, revision `ce75e06884093bcefb86a6b8fd56a5d62a4cc245`
- Compile RSS cap: 12 GiB; refuse to start below 4 GiB `MemAvailable`
- Runtime linear memory cap: 256 MiB (`MAXIMUM_MEMORY`)
- Parallelism: `nice` cmake `--parallel 4`
- Defines: `PX_PHYSX_STATIC_LIB`, `PX_PHYSX_CORE_STATIC_LIB`, `PX_SUPPORT_PVD=0`,
  `DISABLE_CUDA_PHYSX`, `PX_SIMD_DISABLED=1`
- Clang compat: GJK is copied out-of-tree so `getRelativeTransform` can be
  const; foundation `PsHash.h` treats Emscripten like Apple for `size_t`;
  public `PxPhysXConfig.h` turns off particle and cloth APIs so those TUs can
  stay excluded. The checkout is not modified.

The façade parses the Linux64 makefiles for PxFoundation, PxTask, PhysXCommon,
LowLevel, LowLevelAABB, LowLevelDynamics, SimulationController, SceneQuery,
PhysX, and PhysXExtensions, then drops GPU/cloth/particle/PVD/Windows units.
The subset is still hundreds of translation units; the RAM cap is mandatory.

The RAM-capped build verified `physx-3-4.wasm` with a finite `physx_step`.
The public module lives at `public/wasm/awesomePhysics/physx/` with NOTICE.
Sample/APEX third-party names in the root README are out of scope for this
subset.

## Reproduction

```sh
node scripts/awesomePhysics/wasm/physx/build.mjs \
  --source <pinned PhysX-3.4 checkout> \
  --output <empty out-of-tree directory> \
  --em-cache <pinned Emscripten cache> \
  --toolchain <Emscripten CMake toolchain file>
```

The script fails closed on a dirty checkout, toolchain drift, a CPU subset
outside 50–800 files, RAM-gate miss, or a non-finite ABI result. Glue
JavaScript is not promoted.
