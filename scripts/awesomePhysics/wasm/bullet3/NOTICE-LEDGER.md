# Bullet3 WASM Notice Ledger

Review scope: the exact CPU sources linked into the scalar ABI, the pinned
Bullet checkout's bundled zlib source, and the Emscripten toolchain used to
produce the raw module. The checkout and toolchain are not modified by the
build. The public binary is accompanied by `public/wasm/awesomePhysics/bullet3/NOTICE.md`.

| Component | Selected use | License or attribution | Evidence | Public notice action |
| --- | --- | --- | --- | --- |
| Bullet3 CPU libraries | `BulletDynamics`, `BulletCollision`, and `LinearMath` are linked; `Bullet3Common`, `BulletSoftBody`, and `BulletInverseDynamics` may be built by the upstream CMake install target but are not linked by the ABI | Bullet zlib license | `awesome-physics-repos/bullet3/LICENSE.txt` | Retain the license text and identify the linked subset |
| Bullet3 authors | Attribution metadata for the pinned source checkout | Authors and copyright-holder attribution | `awesome-physics-repos/bullet3/AUTHORS.txt` | Retain the author list in the public notice |
| zlib 1.2.8 source | Audited bundled third-party source required by the Bullet notice gate; no zlib object is linked into this scalar module | zlib license | `awesome-physics-repos/bullet3/examples/ThirdPartyLibs/zlib/zlib.h` and `examples/ThirdPartyLibs/zlib/LICENSE.txt` | Retain the zlib notice and state that the source is not linked |
| Emscripten runtime | Compiler-generated runtime and system-library code used by the raw module | Emscripten MIT notice and LLVM/libc++/compiler-rt notices | `/usr/lib/emscripten/LICENSE`, `/usr/lib/emscripten/AUTHORS`, and the pinned toolchain license files | Identify the exact toolchain revision; the toolchain itself is not redistributed |

The following source families were explicitly excluded and do not create a
selected binary notice obligation: ExampleBrowser, OpenGL/GLU/EGL, OpenVR,
VR examples, examples, extras, tests, Bullet3 OpenCL, pthreads, OpenMP, TBB,
and other multithreading integrations. The CMake configure step may probe host
OpenGL while generating build files, but no graphical target or OpenGL library
is linked.

The root Bullet license requires the notice to remain with redistributed source
distributions. This ledger therefore keeps the root license, author metadata,
zlib notice, and toolchain provenance together with the public module rather
than describing an upstream static library as the browser artifact.
