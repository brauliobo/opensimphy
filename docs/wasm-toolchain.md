# Browser ONELAB Toolchain

Phase 0 builds two independent, serial Emscripten modules and loads them in one long-lived worker. Generated binaries are staged under ignored `public/simulation/`; they are deliberately excluded from the PWA precache and lazily stored in a content-addressed `opensimphy-onelab-<version>` cache.

Phase 1 adds exact runtime pins for `meshstep@0.1.1`, `three@0.180.0`, and `three-mesh-bvh@0.9.2`. meshStep requires Node 22.18 or newer, so the package engine and CI Node profile deliberately use that floor. The locked cube STEP is byte-identical to `CNCKitchen/meshStep@a1a2841633bdb56a54cb91235800d87124af4091:cube.step`; `tools/wasm/fixtures/cube.provenance.json` records its URL, revision, byte count, hash, and geometry. Both files pass through the same content-addressed artifact lock as the Phase 0 modules.

The STEP worker performs a real meshStep conversion. The serial no-OCC Gmsh worker independently opens the locked `cube.geo` built-in-kernel fixture and meshes it. The neutral scene contract carries every 0D-3D entity and element block, each node's lowest-dimensional Gmsh classification, and each rendered surface triangle's entity, element, and adjacent volume-entity region tag; physical groups remain a separate named grouping layer. STEP remains preview-only: arbitrary STEP simulation is unavailable until an OCC Gmsh profile exists. Preview selection handoff fails closed unless geometric area/centroid/normal signatures produce one complete unique face bijection, then stores the matched Gmsh entity key.

## Reproducibility

`tools/wasm/versions.env` pins the Emscripten image by digest, canonical source URLs/commits/Git trees, and the f2cblaslapack archive by URL and SHA256. `wasm:acquire` fetches and verifies all inputs before compilation; PETSc receives the pre-staged archive through a `file://` URL and cannot silently select a changing network payload. The Docker hostname, source epoch, image, source paths, and Binaryen stripping are fixed so linked bytes do not contain run-specific container identity.

The default `baseline` Gmsh profile is single-threaded and does not require cross-origin isolation. `GMSH_PROFILE=occ` is retained for a future OpenCASCADE build and expects a wasm OCCT prefix in `tools/wasm/.cache/occt`; the Phase 0 microstrip fixture uses the built-in kernel and does not require OCC.

```sh
JOBS=4 nice npm run wasm:build
node tools/wasm/verify-staged-assets.mjs
nice npm run build
nice npm run test:simulation
```

Builds reject more than four workers. The PETSc configuration is explicit and inspected for real scalars, double precision, 32-bit indices, and the pinned f2cblaslapack provider. The GetDP configuration must report `PETSc`, `Blas[petsc]`, and `Lapack[petsc]`; a Sparskit or solver-free build does not satisfy the gate.

`artifacts.lock.json` is never refreshed by a normal build. After reviewing intentional output changes, regenerate it with `npm run wasm:lock:update`, then run `npm run simulation:stage && npm run simulation:verify`. The update command requires its explicit `--intentional` argument internally. Staged verification derives the expected manifest from the lock, verifies the file-map digest, bytes and hashes, and rejects every extra or missing file under `public/simulation/`.

`JOBS=4 nice npm run wasm:reproducibility` performs two canonical builds from separate empty download, repository, source, build, and output caches. It compares every output byte and records output hashes plus WASM section hashes in `tools/wasm/reproducibility-report.json`; any mismatch fails without changing `artifacts.lock.json`. After that gate passes, copy one verified output tree to `tools/wasm/out`, run `npm run wasm:lock:update`, and restage. `WASM_CACHE` and `WASM_OUT` relocate build state without changing its fixed `/workspace/cache` and `/workspace/out` container paths.

## Runtime Contract

The Gmsh bindings are generated from the pinned C API after applying `gmsh/view-bindings.patch`; this exposes headless `view.getModelData`, `view.getHomogeneousModelData`, and `view.getListData` rather than hand-writing view calls. Configure gates require `HAVE_PETSC`, `HAVE_BLAS`, and `HAVE_LAPACK`, reject `HAVE_SPARSKIT`, and both builds explicitly disable Sparskit.

`opensimphy_getdp_run(argc, argv)` is the only GetDP bridge. JavaScript owns MEMFS and logging through standard Emscripten hooks. The bridge passes a persistent ONELAB server to `getdp()`, which intentionally prevents PETSc finalization between calls. Errors become nonzero status codes and stderr messages.

The worker initializes modules through one shared single-flight promise and processes warm/run messages through one serial queue, so Gmsh/GetDP state is never entered concurrently. It writes the upstream `.geo`, generates MSH 2.2 with Gmsh, copies mesh bytes into GetDP MEMFS, runs `-solve Ele -pos Map`, copies all POS outputs into Gmsh MEMFS, and transfers normalized scalar/vector `Float64Array` buffers to the UI. Native calls are synchronous, so cancellation terminates the worker, rejects the targeted request as cancelled and other queued requests as worker-restarted, then creates a fresh queue and module instance.

## Fixture Provenance

`tools/wasm/fixtures/microstrip.json` records source URL, revision, license, and source hashes. `stage-assets.mjs` reads fixtures from the verified source export, verifies all output hashes and byte lengths, and stages them under an immutable content version. Runtime warm-up uses per-worker staging caches and one origin-global Web Lock: repair/publication/deletion holds it exclusively, while readers hold it shared across exact cache validation and copying every verified byte into an immutable in-worker snapshot. Module loading and solves use only that coherent snapshot, never cache entries that another tab can delete mid-read. A worker deletes only its own staging cache; completed obsolete versions are removed only by an exclusive writer. Simulation assets are excluded from Workbox precaching.

`npm run wasm:reference` independently compiles native Gmsh, GetDP, and real-double PETSc from the same revisions. It records the actual compiler identity and executable hash, PETSc/GetDP configuration hashes, and pinned BLAS/LAPACK provenance. It compares regenerated reference bytes with the tracked file and fails on drift; `UPDATE_REFERENCE=1` is required for an intentional replacement. The production Playwright gate uses dedicated residual, scalar-sample, scalar-aggregate, and vector tolerances at three deterministic physical coordinates.

Deployment has two explicit profiles. GitHub Pages, Docker-capable CI, and the local production gate use `npm run build:deploy`; Pages wraps it with SPA fallback generation. The command removes source/build/output/staging caches, builds canonical sources in Docker, verifies staging, and invokes Vite with `VITE_ONELAB_ENABLED=true`. The production Playwright server also sets the flag explicitly. `VITE_BASE_PATH` remains inherited by the Vite build, and `.github/workflows/browser-onelab.yml` also runs native-reference drift and production E2E.

Netlify sets `VITE_ONELAB_ENABLED=false` and runs the ordinary no-Docker `npm run build`. That profile omits the ONELAB Labs navigation card and route, so `/labs/onelab` reaches the ordinary catch-all instead of loading simulation code. Netlify may enable the flag only after an external process stages this exact immutable locked asset tree before its Vite build; there is intentionally no invented download URL or committed binary fallback.

The baseline Gmsh build applies `optional-quad-predicate.patch`: in an upstream no-QuadMeshingTools build, the ordinary optional-feature predicate emits a fatal Gmsh error instead of returning false. The patch restores the predicate semantics; it does not route meshing through a fallback algorithm.
