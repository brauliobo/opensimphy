# Newton Dynamics WASM Notice Ledger

Review scope: the CPU sources selected by
`scripts/awesomePhysics/wasm/newton-dynamics/build.mjs` from the pinned
newton-dynamics checkout. Sandbox, OpenGL, OpenCL, CUDA, dExtensions, and
VHACD are excluded.

| Component | Selected use | License | Evidence | Public notice action |
| --- | --- | --- | --- | --- |
| Newton 4.00 CPU SDK | `dCore`, `dCollision`, `dNewton` minus `dExtensions` | zlib | `awesome-physics-repos/newton-dynamics/newton-4.00/sdk/LICENSE` | Retain the zlib text and Julio Jerez / Alain Suero attribution |
| tinyxml | Compiled with `dCore/tinyxml` | zlib | `awesome-physics-repos/newton-dynamics/newton-4.00/sdk/dCore/tinyxml/tinyxml.h` | Retain the Lee Thomason zlib notice |
| VHACD | Linked by `dCollision/dMesh/ndMesh.cpp` | BSD-3-Clause | `awesome-physics-repos/newton-dynamics/newton-4.00/sdk/dDependencies/hacd/LICENSE` | Retain the Khaled Mamou BSD-3-Clause notice |
| Sandbox / OpenGL / OpenCL / CUDA / dRender / dBrain | Not compiled | n/a | façade CMake excludes `dExtensions` and does not add those trees | No notice obligation |
| Emscripten runtime | Compiler-generated runtime | Emscripten MIT and LLVM notices | pinned toolchain `LICENSE` / `AUTHORS` | Identify revision; toolchain is not redistributed |
