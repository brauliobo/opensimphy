# CoolProp Artifact Notices

This directory contains the verified CoolProp classic-worker JavaScript factory
and WebAssembly module. Preserve this notice with both files. The listed paths
are source evidence from the pinned checkout or its pinned CPM/toolchain cache;
the cache itself is not redistributed here.

- **CoolProp, MIT.** Evidence: `awesome-physics-repos/CoolProp/LICENSE`,
  `awesome-physics-repos/CoolProp/CMakeLists.txt`, and
  `awesome-physics-repos/CoolProp/src/emscripten_interface.cxx`.
- **Emscripten and LLVM, MIT and University of Illinois/NCSA licenses.**
  Evidence: the pinned Emscripten distribution `LICENSE`, `AUTHORS`, and
  `emscripten-revision.txt`; the exact toolchain pin is recorded in
  `scripts/awesomePhysics/wasm/coolprop/README.md`.
- **Eigen, MPL-2.0.** Evidence: pinned CPM entry
  `eigen/b88d48afc3865e4a87dc2aa33ea6bb27abd7ff6f/LICENSE`.
- **msgpack-c, Boost Software License 1.0; bundled Boost Predef and Boost
  Preprocessor, Boost Software License 1.0.** Evidence: pinned CPM entry
  `msgpack-c/6463fbc0e9b83855e8993486702b92b336ccd82c/COPYING` and `NOTICE`.
- **Boost headers, Boost Software License 1.0.** Evidence: pinned CPM entry
  `boost_headers/dde1010b2e20024ecbefff57339ce749b7f129ef/LICENSE`.
- **nlohmann/json, MIT.** Evidence: pinned CPM entry
  `nlohmann_json/b88ca108e0b5a597e859a21658d11fa5f1feb410/LICENSE.MIT`.
- **valijson, BSD-3-Clause.** Evidence: pinned CPM entry
  `valijson/c12f264a745d9884a7b08969e884214b9513c5f1/LICENSE`.
- **IF97, MIT.** Evidence: pinned CPM entry
  `if97/1eddb61ca0f43b871b0b634bb994d6e2fd6e2cbb/LICENSE`.
- **REFPROP headers, MIT.** Evidence: pinned CPM entry
  `refprop_headers/4a1980fd75e1f9f2ff1052454ad3b9c2ebe77267/LICENSE`.
- **multicomplex, MIT; pybind11 source retained by the pinned dependency,
  BSD-3-Clause.** Evidence: pinned CPM entry
  `multicomplex/b41b93e0babdab133c77234ee47fc4ba7c75d0ac/README.md` and
  `multicomplex/b41b93e0babdab133c77234ee47fc4ba7c75d0ac/multicomplex/externals/pybind11/LICENSE`.
- **fmt, MIT with its embedded-code exception.** Evidence: pinned CPM entry
  `fmt/061b919778e4fd42e0892d713069255107b7205b/LICENSE`.
- **miniz, permissive MIT-style notice.** Evidence:
  `awesome-physics-repos/CoolProp/externals/miniz-3.1.1/LICENSE`.

The artifact is an upstream library evaluation path. It does not establish or
claim validation of a physical theory, model, or experimental result.
