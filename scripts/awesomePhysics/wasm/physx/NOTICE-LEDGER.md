# PhysX-3.4 WASM Notice Ledger

Review scope: the CPU sources selected by
`scripts/awesomePhysics/wasm/physx/build.mjs` from the pinned PhysX-3.4
checkout. APEX, GPU, samples, cooking, vehicle, character, cloth, particles,
PVD, and Windows units are excluded.

| Component | Selected use | License | Evidence | Public notice action |
| --- | --- | --- | --- | --- |
| PhysX 3.4 CPU SDK | PxFoundation, PxTask, PhysXCommon/GeomUtils, LowLevel*, SimulationController, SceneQuery, PhysX, headless PhysXExtensions | NVIDIA BSD-style | `awesome-physics-repos/PhysX-3.4/README.md` | Retain the NVIDIA/AGEIA/NovodeX copyright, conditions, and disclaimer |
| APEX / samples / GPU / cooking / vehicle / character / cloth / particles / PVD | Not compiled | n/a | Linux64 makefile filter in `build.mjs` | No notice obligation |
| Root README third-party list | Depot-wide sample/APEX names | various | `awesome-physics-repos/PhysX-3.4/README.md` acknowledgements | Explicitly excluded; not redistributed |
| Emscripten runtime | Compiler-generated runtime | Emscripten MIT and LLVM notices | pinned toolchain `LICENSE` / `AUTHORS` | Identify revision; toolchain is not redistributed |
