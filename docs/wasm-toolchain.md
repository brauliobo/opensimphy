# Browser ONELAB Toolchain

Phase 0 builds independent, serial Emscripten modules and loads them in one long-lived worker. Generated binaries are staged under ignored `public/simulation/`; they are deliberately excluded from the PWA precache and lazily stored in a content-addressed `opensimphy-onelab-<version>` cache.

Phase 1 adds exact runtime pins for `meshstep@0.1.1`, `three@0.180.0`, and `three-mesh-bvh@0.9.2`. meshStep requires Node 22.18 or newer, so the package engine and CI Node profile deliberately use that floor. The locked cube STEP is byte-identical to `CNCKitchen/meshStep@a1a2841633bdb56a54cb91235800d87124af4091:cube.step`; `tools/wasm/fixtures/cube.provenance.json` records its URL, revision, byte count, hash, and geometry. Both files pass through the same content-addressed artifact lock as the Phase 0 modules.

Phase 2 keeps the modules separate. A durable main-thread `ProjectSession` owns complete source files, parser defaults, canonical current ONELAB JSON, revision, and the last successful result. Every check/reset/compute request contains that complete reconstructible state. A response can commit only when its project and revision still match. Hard worker termination therefore loses no edited input state, and an edited revision cannot display a result from an older revision.

The STEP worker performs a real meshStep conversion. The serial Gmsh worker independently opens the locked `cube.geo` built-in-kernel fixture and meshes it. The neutral scene contract carries every 0D-3D entity and element block, each node's lowest-dimensional Gmsh classification, and each rendered surface triangle's entity, element, and adjacent volume-entity region tag; physical groups remain a separate named grouping layer. STEP remains preview-only because arbitrary STEP projects are not yet wired to solver execution, even though the canonical Gmsh module now includes OCC. Preview selection handoff fails closed unless geometric area/centroid/normal signatures produce one complete unique face bijection, then stores the matched Gmsh entity key.

## Reproducibility

`tools/wasm/versions.env` pins the Emscripten image by digest, canonical source URLs/commits/Git trees, and the f2cblaslapack archive by URL and SHA256. `wasm:acquire` fetches and verifies all inputs before compilation; PETSc receives the pre-staged archive through a `file://` URL and cannot silently select a changing network payload. The Docker hostname, source epoch, image, source paths, and Binaryen stripping are fixed so linked bytes do not contain run-specific container identity.

The default `occ` Gmsh profile statically links the pinned OCCT toolkits and remains single-threaded without requiring cross-origin isolation. Set `GMSH_PROFILE=baseline` explicitly for the built-in-kernel-only profile.

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

The Gmsh bindings are generated from the pinned C API after applying `gmsh/view-bindings.patch`; this exposes headless view data and probing rather than hand-writing view calls. The WASM-only `persistent-parser-number.patch` makes `parser.setNumber()` survive `open()` through Gmsh's command-line-number map, matching native `-setnumber` fixture execution. Configure gates require `HAVE_PETSC`, `HAVE_BLAS`, and `HAVE_LAPACK`, reject `HAVE_SPARSKIT`, and both real and complex builds explicitly disable Sparskit.

The GetDP bridge exposes `opensimphy_getdp_run(argc, argv)` plus narrow JSON set/get/clear and changed-flag functions over GetDP's existing ONELAB server. JavaScript owns MEMFS and logging through standard Emscripten hooks. The run bridge passes the persistent server to `getdp()`, which intentionally prevents PETSc finalization between calls. Errors become nonzero status codes and stderr messages. Gmsh and GetDP never share a native singleton in this phase: each boundary transfer serializes and canonicalizes the full JSON database explicitly.

The worker initializes modules through one shared single-flight promise and processes warm/run messages through one serial queue, so Gmsh/GetDP state is never entered concurrently. It writes the upstream `.geo`, generates MSH 2.2 with Gmsh, copies mesh bytes into GetDP MEMFS, runs `-solve Ele -pos Map`, copies all POS outputs into Gmsh MEMFS, and transfers normalized scalar/vector `Float64Array` buffers to the UI. Native calls are synchronous, so cancellation terminates the worker, rejects the targeted request as cancelled and other queued requests as worker-restarted, then creates a fresh queue and module instance.

Check clears and reconstructs both module databases, reparses `.geo` and `.pro`, and returns parser-defined JSON metadata without meshing or solving. Compute follows the same check path and then genuinely remeshes and reruns GetDP. Reset ignores the edited database and reparses both source defaults. Controls render only native number/string metadata, including choices, bounds, step, visibility, read-only, help, and changed values; there is no parallel UI parameter schema.

## Fixture Provenance

`tools/wasm/fixtures/microstrip.json` records source URL, revision, license, and source hashes. `stage-assets.mjs` reads fixtures from the verified source export, verifies all output hashes and byte lengths, and stages them under an immutable content version. Runtime warm-up uses per-worker staging caches and one origin-global Web Lock: repair/publication/deletion holds it exclusively, while readers hold it shared across exact cache validation and copying every verified byte into an immutable in-worker snapshot. Module loading and solves use only that coherent snapshot, never cache entries that another tab can delete mid-read. A worker deletes only its own staging cache; completed obsolete versions are removed only by an exclusive writer. Simulation assets are excluded from Workbox precaching.

The Phase 2 microstrip geometry is generated from the same pinned upstream bytes by `microstrip-onelab.patch`. Provenance records the upstream hashes, patch hash, and derived hashes. The patch bounds the existing physical `s` factor and adds parser-native choice, string, conditional visibility, help, and read-only declarations. It does not replace meshing with a UI option: `s` still multiplies every target point mesh size in the upstream geometry. Native references record factor 1 and factor 2 mesh counts, canonical topology hashes, DOFs, residuals, POS hashes, aggregates, and field samples. Raw MSH byte hashes are not compared across native and Emscripten serializers; browser E2E requires exact canonical topology hashes and compares numerical output to the corresponding native references.

`npm run wasm:reference` independently compiles native Gmsh, GetDP, and real-double PETSc from the same revisions. It records the actual compiler identity and executable hash, PETSc/GetDP configuration hashes, and pinned BLAS/LAPACK provenance. It compares regenerated reference bytes with the tracked file and fails on drift; `UPDATE_REFERENCE=1` is required for an intentional replacement. Browser and native log parsers are separate implementations. Both fail closed on explicit PETSc divergence, malformed or non-finite evidence, unexpected solve structure, and unmet fixture-owned absolute/relative criteria when PETSc emits no reason. Nonlinear certification additionally requires contiguous bounded iterations, monotone finite absolute/relative histories, and explicit final absolute and relative limits. The production Playwright gate compares every structured solve boundary and uses dedicated scalar-sample, scalar-aggregate, and vector tolerances at deterministic physical coordinates. Final KSP norms near machine precision are not compared as raw x86/WASM values because BLAS reduction order differs between those targets.

Deployment has two explicit profiles. GitHub Pages and the local production gate use `npm run build:deploy`; Pages wraps it with SPA fallback generation. The command verifies an already staged exact runtime and invokes Vite with `VITE_ONELAB_ENABLED=true`; it never compiles or generates a release. Compilation, staging, deterministic candidate packaging, and guarded publication are explicit commands and workflows described in [WASM release distribution](wasm-releases.md). `VITE_BASE_PATH` remains inherited by the Vite build, and source CI still performs two isolated canonical builds, native-reference drift, and production E2E.

Netlify sets `VITE_ONELAB_ENABLED=false` and runs the ordinary no-Docker `npm run build`. That profile omits the ONELAB Labs navigation card and route, so `/labs/onelab` reaches the ordinary catch-all instead of loading simulation code. Netlify may enable the flag only after an external process stages this exact immutable locked asset tree before its Vite build; there is intentionally no invented download URL or committed binary fallback.

The baseline Gmsh build applies `optional-quad-predicate.patch`: in an upstream no-QuadMeshingTools build, the ordinary optional-feature predicate emits a fatal Gmsh error instead of returning false. The patch restores the predicate semantics; it does not route meshing through a fallback algorithm.

## Phase 4 Artifact Size

<!-- profile-measurements:phase4:start -->
Measured from content version `8b4dd5c93e4141bd5be9` on 2026-08-13 with per-file gzip level 9 and Brotli quality 11:

| Browser partition | Files | Raw bytes | gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: | ---: |
| OCC Gmsh | 5 | 43,034,272 | 10,271,181 | 6,953,724 |
| Real GetDP/PETSc | 3 | 34,894,073 | 7,312,670 | 4,708,965 |
| Complex GetDP/PETSc | 2 | 35,181,042 | 7,663,616 | 4,845,730 |
| Total module partitions | 10 | 113,109,387 | 25,247,467 | 16,508,419 |

The separate real warm-up fetches exactly 43 files (the manifest plus `shared + gmsh + separate-real`) totaling 11,743,225 Brotli bytes. Opening a complex project adds the complete `separate-complex` partition; the cumulative exact load set is 16,588,955 Brotli bytes.
<!-- profile-measurements:phase4:end -->

## Phase 5 Combined Profiles

The canonical build now also emits `combined-real` and `combined-complex`. GetDP is configured with `ENABLE_GMSH=ON`; its generated `GetDPConfig.h` must contain `HAVE_GMSH`, while the installed Gmsh private SDK provides the exact generated `GmshConfig.h` and developer headers. This suppresses GetDP's duplicate allocation/list/tree implementations. Gmsh's canonical `HAVE_ONELAB` definition suppresses GetDP's singleton definition, and the build gate requires exactly one strong `onelab::server::_server` plus at most one strong utility definition across both archives. SLEPc is explicitly disabled.

The generated Gmsh API and the combined bridge are exported from one Emscripten module per scalar profile. They share one `wasmMemory`, MEMFS and the single strong `onelab::server::_server`. Check and compute import UI state through Gmsh's API into that server and pass its exact pointer to `getdp()`; no database is serialized between module copies. Native counters expose the server pointer, last pointer passed to GetDP, GetDP calls, upstream loop calls, and bridge JSON imports/exports. Production E2E requires equal nonzero server pointers and zero bridge JSON counts. Browser builds compile out native subprocess/socket facilities and retain link-time names until deterministic certification evidence is emitted. Every standalone and combined module is checked against its pre-strip symbol inventory, linker map, and final `wasm-objdump -x` import section; process, socket, and Emscripten syscall boundaries fail the build. Controlled checker fixtures prove each evidence path rejects a forbidden symbol. `VITE_ONELAB_PROFILE=separate` retains the Phase 4 modules strictly for regression comparison; combined is the default and the Phase 5 gate. CI runs the full Phase 0-4 production suite against both profiles, while Phase 5 loop tests remain combined-only.

Loop execution calls the pinned upstream `onelabUtils::initializeLoops()` and `onelabUtils::incrementLoops()` exports. An independent native executable links Gmsh and GetDP against one singleton for each PETSc scalar profile, invokes those exact loop functions, runs GetDP at every point, and emits ordered values, outputs, call counts, and pointer identities. `phase5-reference.json` is derived directly from that trace; JavaScript neither enumerates nor reorders loop coordinates. The real fixture covers levels `3 -> 2 -> 1` in native order and the complex fixture covers a level-1 loop. Point ordinals are replayed through those native calls after worker recreation, so cancellation retains completed history and resumes the first uncommitted point without a JavaScript loop implementation. The browser gate performs eight real and two complex loop computes, verifies progress and full output histories against the pinned native Phase 5 reference, and checks the native call counters.

<!-- profile-measurements:phase5:start -->
Measured from content version `8b4dd5c93e4141bd5be9` on 2026-08-13 with per-file gzip level 9 and Brotli quality 11. Every cumulative load set includes the fetched `manifest.json` exactly once:

| Browser load set | Files | Raw bytes | gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: | ---: |
| Combined real | 40 | 78,283,472 | 17,558,386 | 11,622,565 |
| Combined real + complex | 45 | 156,523,603 | 35,373,372 | 23,297,051 |
| Separate real | 43 | 78,273,246 | 17,681,536 | 11,743,225 |
| Separate real + complex | 45 | 113,454,288 | 25,345,152 | 16,588,955 |
<!-- profile-measurements:phase5:end -->

The manifest separates `shared` fixtures/catalog data, standalone `gmsh`, separate scalar solvers, and combined scalar modules; declarations, linker maps, symbol inventories, and object dumps remain reproducible build outputs but are not staged for browsers. Combined warm-up loads `shared + combined-real`; separate warm-up loads `shared + gmsh + separate-real`. Complex partitions stay lazy. `npm run wasm:measure` deterministically rewrites `profile-measurements.json` and both generated tables from the exact staged path sets; `node tools/wasm/measure-profiles.mjs --check` fully recompresses them, while the focused test verifies the current manifest fingerprint, partition/load-set identities, totals, and documentation blocks. Startup timing is measured independently in the production browser; unavailable offline measurements remain `null`, never inferred from transfer size. Runtime audits report per-module startup and memory, aggregate bytes across all unique resident `wasmMemory.buffer` objects, project MEMFS files/bytes, cached partition bytes, repeat-run aggregate WASM growth, model entities, views, and history points/bytes. Production E2E requires the expected aggregate step-up when the complex module becomes resident and stability over repeated alternating runs and cancellation/recreation.

Project archive v2 export is canonical UTF-8 JSON with sorted file entries and SHA256 for every byte payload. It preserves the edited current ONELAB database separately from the parser-native default database used for read-only restoration and reset. Import canonicalizes and validates both databases, validates current editable values against the defaults, and restores both into `ProjectSession`; no v1 migration is supported. Import also rejects unsafe/duplicate paths, invalid hashes/base64, descriptor/file-list or entry-file mismatches, project/scalar identity drift, invalid physical-group sidecars, and histories whose coordinates or outputs do not match their ONELAB databases. Browser E2E downloads, imports after reload, edits the restored state, and verifies reset returns to parser-native defaults. OPFS persistence is optional: supported browsers store and verify the same canonical archive bytes; unsupported browsers report `unsupported` and leave import/export functional.

SLEPc remains disabled and deferred because Phase 5 adds no eigen fixture. It will be introduced only with an explicit eigenproblem requirement and native reference gate.
