# Browser ONELAB Roadmap

## Decision

Build the future simulation workbench around the actual ONELAB stack:

- Gmsh WebAssembly for geometry, physical groups, finite-element meshing, the ONELAB parameter database, and loading post-processing views.
- GetDP + PETSc WebAssembly for the existing `.pro` model language and finite-element solves.
- A Vue/Three.js viewer adapted from meshStep's web studio for CAD interaction and finite-element pre/post-processing.
- Web Workers, MEMFS, transferable typed arrays, and hard worker termination for isolation and cancellation.

Do not replace GetDP with a narrow JavaScript FEM library if ONELAB feature parity remains the goal. The browser port is feasible and an end-to-end electrostatic solve has been demonstrated locally.

meshStep should be the rendering and CAD-interaction base, not the solver mesh authority. Gmsh entity tags and physical groups must remain authoritative once a model enters the simulation pipeline.

## Validated Feasibility

Exploration was performed on 2026-08-13 with these revisions:

| Component | Revision | Finding |
| --- | --- | --- |
| OpenSimPhy | `6c1c5f9` | Existing worker-first, static-browser architecture is a good host. |
| meshStep | `a1a2841` | Strong STEP surface import and engineering viewer, but no general FE/result model. |
| Gmsh | `29726e7` | ONELAB, parser, meshing, post-processing, and stable APIs are available headlessly. |
| GetDP | `8850e98` | Kernel cross-compiles with Emscripten after wasm32 CMake type-size hints. |
| PETSc | `d2a0018` | Official Emscripten configuration builds; GetDP requires PETSc to be configured with `em++` too. |
| GMSH-JS | `3fdabee` | Existing typed browser package covers Gmsh geometry and meshing, including OpenCASCADE. |
| FEAScript | `57d94ff` | Useful narrow JS FEM reference, not an ONELAB/GetDP replacement. |

### GetDP parser/kernel proof

A minimal GetDP kernel built with Emscripten 4.0.10 to a 1.5 MB `getdp.wasm`. It loaded and checked `tutorials/01-Electrostatics/microstrip.pro` through MEMFS.

Two build details were required:

- Set `SIZEOF_VOID_P=4`, `SOCKLEN_T_SIZE=4`, and `INTPTR_T_SIZE=4`. CMake's cross-compilation probes do not populate them, and a missing `SOCKLEN_T_SIZE` makes `GmshSocket.h` redefine `socklen_t`.
- Stage model files in MEMFS. A production module should expose `FS` rather than preload fixtures.

### GetDP + PETSc solve proof

PETSc was built with:

```sh
./configure \
  PETSC_ARCH=arch-opensimphy-wasm-cxx \
  --with-cc=emcc \
  --with-cxx=em++ \
  --with-fc=0 \
  --with-ranlib=emranlib \
  --with-ar=emar \
  --with-shared-libraries=0 \
  --download-f2cblaslapack=1 \
  --with-mpi=0 \
  --with-batch \
  COPTFLAGS=-O2 \
  CXXOPTFLAGS=-O2
```

The PETSc C++ compiler is necessary because GetDP includes PETSc headers from C++ translation units. PETSc's documented C-only browser profile does not define the C++ function-name macros expected by current headers.

GetDP was then linked against the static PETSc and f2c BLAS/LAPACK archives. The resulting artifact was:

| File | Size |
| --- | ---: |
| `getdp.js` | 105 KB |
| `getdp.wasm` | 31.1 MB |
| fixture-only `getdp.data` | 82 KB |

The module loaded a Gmsh-generated MSH2 mesh and ran:

```sh
getdp /microstrip.pro -solve Ele -pos Map
```

Observed result:

- 727 mesh nodes and 1,491 elements from Gmsh.
- 634 GetDP degrees of freedom.
- Matrix generation and PETSc solve completed.
- Residual decreased from `4.996054940160e-13` to `4.503046812882e-28`.
- GetDP saved the solution and generated `v.pos`, `e.pos`, `d.pos`, and `e_cut.pos` in MEMFS.

This proves the geometry-file to assembly, sparse solve, and post-processing path. It does not yet prove browser packaging, repeated in-process calls, complex arithmetic, eigensolves, large models, or mobile memory limits.

### Existing Gmsh browser package

[`@loumalouomega/gmsh-wasm`](https://github.com/loumalouomega/GMSH-JS) already provides:

- Generated TypeScript bindings for the flat Gmsh C API.
- Built-in and OpenCASCADE geometry, STEP/IGES/BREP import, and 1D/2D/3D meshing.
- Gmsh parser and ONELAB API bindings.
- MEMFS access and real-browser Playwright coverage.
- A 41.4 MB uncompressed WASM artifact with OpenCASCADE, about 12 MB without it.

Its generated bindings currently omit the Gmsh `view` namespace even though the native build enables post-processing. OpenSimPhy needs either an upstream binding-generator extension or its own generated build exposing `view.getHomogeneousModelData`, `view.getModelData`, and `view.getListData`.

The July 2026 Gmsh user meeting included “Gmsh and GetDP in the browser (WebAssembly)” by A. Sepahvand of Insim.ai. No public implementation artifact was found in the upstream Gmsh/GetDP branches or public Insim repositories. Contacting the author before maintaining a separate combined build is worthwhile.

## Target Architecture

```text
Vue simulation workbench
  |
  +-- parameter tree and model workspace
  +-- mesh/field/selection stores
  +-- meshStep-derived Three.js viewer
  |
  +-- simulation.worker
        |
        +-- Gmsh WASM
        |     geometry, physical groups, mesh, ONELAB, POS/view loading
        |
        +-- GetDP + PETSc WASM
        |     .pro parser, assembly, solve, post-operations
        |
        +-- MEMFS workspace
              .geo/.step -> .msh -> .res/.pos
```

### Module strategy

Start with separate Gmsh and GetDP modules in one long-lived worker:

1. Write source files to each module's MEMFS as needed.
2. Generate the mesh with Gmsh and copy the `.msh` bytes into GetDP MEMFS.
3. Run GetDP and copy `.pos` outputs back into Gmsh MEMFS.
4. Merge the views in Gmsh and extract typed arrays through the Gmsh API.
5. Transfer normalized mesh and result buffers to the UI.

This is simpler than immediately linking Gmsh and GetDP into one binary. It duplicates the small ONELAB database and copies files, but establishes the numerical and rendering contracts first.

Phase 2 implements check/compute with separate modules and explicit canonical JSON synchronization; it does not claim a shared-server loop. Revisit a monolithic module only when a representative workflow requires tighter in-process client semantics. The mobile application demonstrates that future path: run the Gmsh client, set `GetDP/Action`, and call `getdp(args, onelab::server::instance())`. A combined build must use one canonical ONELAB implementation and exactly one `onelab::server::_server` singleton.

### Worker protocol

Extend OpenSimPhy's existing request-id and termination pattern. Suggested commands:

```ts
type SimulationCommand =
  | { type: 'open-project'; requestId: string; files: ProjectFile[] }
  | { type: 'check'; requestId: string; parameters: ParameterValue[] }
  | { type: 'mesh'; requestId: string; dimension: 1 | 2 | 3 }
  | { type: 'solve'; requestId: string; resolution: string; postOperations: string[] }
  | { type: 'set-parameters'; requestId: string; parameters: ParameterValue[] }
  | { type: 'get-scene'; requestId: string }
  | { type: 'cancel'; requestId: string }
```

Native calls are synchronous, so a worker cannot reliably receive a cancellation message while Gmsh/GetDP is executing. Terminate and recreate the worker for the first implementation. Preserve the project input files and parameter state on the main thread so cancellation can reconstruct the session.

### Deployment profiles

Use lazy, separately cached simulation assets. Do not add 70+ MB of uncompressed WASM to the current PWA precache.

Provide two profiles:

- Baseline: single-threaded Gmsh and GetDP, no cross-origin isolation requirement, broad static-host compatibility.
- Accelerated: pthread/OpenMP builds with `SharedArrayBuffer`, served with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.

The published GMSH-JS package is threaded even when Gmsh uses one runtime thread, so it always requires those headers. Build a serial variant if GitHub Pages compatibility is important. Netlify can provide the headers directly.

Build separate real and complex GetDP/PETSc artifacts and lazy-load the model-required scalar type. Add SLEPc only when an eigenvalue model becomes an acceptance fixture.

## Viewer Architecture

meshStep's viewer already provides the right engineering interactions:

- STEP/STL/3MF loading in a worker.
- Body visibility and isolation.
- Feature and open-edge rendering.
- BVH picking.
- Section plane with stencil caps.
- Exact CAD measurement geometry.
- Perspective/orthographic engineering navigation.
- Assembly exploded views.
- Reference-mesh deviation coloring.

It should be adapted, not embedded unchanged. The current `Viewer` owns rendering, navigation, selection, measurement, clipping, explosion, and global listeners in one class. It lacks a top-level disposal lifecycle, a generalized result-field abstraction, face selection, mobile layout, and web interaction tests.

### Neutral scene model

The renderer must not depend directly on meshStep or Gmsh output shapes:

```ts
interface SimulationScene {
  referencePositions: Float64Array
  surfaceTriangles: Uint32Array
  triangleEntityTags: Uint32Array
  triangleElementTags?: Uint32Array
  triangleRegionTags?: Uint32Array
  nodeTags?: BigUint64Array
  elementBlocks: ElementBlock[]
  groups: PhysicalGroup[]
  fields: ResultField[]
}

interface ResultField {
  id: string
  name: string
  association: 'node' | 'element' | 'element-node' | 'integration-point'
  components: 1 | 2 | 3 | 6 | 9
  values: Float32Array | Float64Array
  time: number
  step: number
  units?: string
  complexPart?: 'real' | 'imaginary' | 'magnitude' | 'phase'
}
```

Keep explicit `display -> source` mappings whenever vertices are split for smooth normals, face colors, discontinuous fields, or clipping. Persist entity, node, element, and physical-group tags; never persist display triangle or vertex indices.

### Geometry responsibilities

- meshStep adapter: fast STEP preview, CAD colors, assemblies, face metadata, import diagnostics, and exact measurement geometry.
- Gmsh adapter: authoritative geometry entity tags, physical groups, solver surface mesh, volume elements, and high-order nodes.
- GetDP adapter: result fields and simulation state.

Boundary conditions should ultimately bind to Gmsh entity tags or physical groups. A meshStep preview selection cannot safely be assumed to share face identifiers with an OpenCASCADE import. Until a robust geometric/topological correspondence layer exists, switch to the Gmsh-rendered surface before allowing simulation-bound selections.

### Refactor boundaries

Extract meshStep concepts into Vue-owned components:

- `SceneHost`: renderer, cameras, lights, resize observer, animation scheduling, context loss, and `dispose()`.
- `GeometryLayer`: reference surface, edges, wireframe, body/face visibility, source mappings.
- `ResultLayer`: scalar colors, deformation, contours, glyphs, and timestep selection.
- `SelectionController`: body, face, physical group, node, and element selection.
- `ClipController`: one or more planes and volume-element section extraction.
- `MeasurementController`: geometry dimensions and field probes.
- `AnnotationLayer`: labels, legends, min/max markers, and probe values.

Implement deformation from immutable reference coordinates, preferably in a shader:

```text
display position = reference position + scale * displacement
```

Do not mutate the only position buffer as the current exploded-view implementation does.

## ONELAB Parity Definition

“Parity” should be tracked by capability rather than visual similarity to the desktop UI.

| Area | Browser target | Notes |
| --- | --- | --- |
| Parameter database | JSON number/string parameters, metadata, choices, changed flags | Already exposed by Gmsh API. |
| Check/compute actions | Gmsh + GetDP in-process action loop | Follow the mobile implementation. |
| Geometry | `.geo`, built-in CAD, OpenCASCADE, STEP import | Existing Gmsh WASM covers this. |
| Meshing | 1D/2D/3D, physical groups, high order | Existing Gmsh WASM covers the core. |
| Problem language | Existing GetDP `.pro` files | Parser and kernel compile to WASM. |
| Solves | Real/complex, steady, transient, nonlinear | PETSc path validated for a real linear solve. |
| Eigenproblems | SLEPc or a bounded alternative | Separate milestone. |
| Post-processing | `.res`/`.pos`, model/list data, timesteps | GetDP generation validated; Gmsh view bindings still needed. |
| Rendering | Surface/volume mesh, fields, deformation, sections, probes | Build on meshStep viewer concepts. |
| Sweeps | ONELAB loops with progress and result history | Implement after repeatable in-process solves. |
| Persistence | Project import/export and optional OPFS cache | MEMFS first; OPFS later. |
| External clients | Browser adapters only | Arbitrary native executables and POSIX socket clients cannot run unchanged. |

Arbitrary external ONELAB clients are the only fundamental non-parity area. Browsers cannot `fork`, `exec`, or open arbitrary TCP/Unix sockets. Supported clients must be compiled into WASM, rewritten as workers, or reached through an explicit remote HTTP/WebSocket service.

## Alternatives

| Option | Browser maturity | Breadth | Recommendation |
| --- | --- | --- | --- |
| GetDP + PETSc WASM | End-to-end solve validated | Closest to ONELAB parity | Primary solver path. |
| FEAScript | Native JS, worker/WebGPU work in progress | Heat, Stokes, front propagation; 1D/2D | Use only for isolated experiments, not as the core. |
| MFEM WASM port | No maintained browser package | Broad, high-order multiphysics | Revisit only if GetDP becomes unmaintainable. |
| NGSolve/Netgen WASM | Upstream Emscripten work, incomplete browser solver API | Broad symbolic FEM | Useful research comparison, high integration cost. |
| scikit-fem in Pyodide | Feasible prototype | Flexible Python FEM | Too much runtime overhead for the primary path. |
| FEniCSx, Firedrake, deal.II, libMesh, Elmer, CalculiX | No credible complete browser distribution | Broad or domain-specific | Do not pursue for direct browser integration. |

The principal advantage of the alternatives is permissive or higher-level custom development, not ONELAB compatibility. Reimplementing GetDP's function spaces, formulations, resolutions, transient loops, and post-operations would be a larger and riskier program than completing the validated port.

## Delivery Phases

### Phase 0: package the proof

- Create reproducible pinned Docker build scripts for serial Gmsh and real GetDP/PETSc modules.
- Export modular ES modules with `FS`, stdout/stderr callbacks, and a narrow C bridge around repeated `getdp()` calls.
- Add the microstrip tutorial as the first browser integration fixture.
- Gate: Chromium runs mesh, solve, and post-process entirely offline after asset caching.

### Phase 1: meshStep-based viewer shell

- Adapt camera/navigation, feature edges, picking, sectioning, measurement, and exploded-view concepts.
- Add Vue lifecycle disposal, `ResizeObserver`, mobile controls, and interaction tests.
- Introduce the neutral scene model and meshStep/Gmsh adapters.
- Gate: STEP preview and Gmsh MSH surface render identically enough for selection handoff, with no route-navigation leaks.

### Phase 2: ONELAB parameter/check flow

- Render JSON parameter metadata as Vue controls.
- Support choices, ranges, visibility, read-only state, changed flags, check, reset, and compute actions.
- Preserve files and parameter state across worker recreation.
- Gate: editing the tutorial mesh-size parameter remeshes and reruns without a page reload.

### Phase 3: scalar/vector post-processing

- Expose Gmsh view APIs in the WASM bindings.
- Normalize `.pos` model/list data into result fields.
- Add scalar maps, legends, vectors, timesteps, probes, ranges, and export.
- Gate: microstrip potential and electric field match native GetDP reference samples within recorded tolerance.

### Phase 4: representative multiphysics parity

- Add real and complex builds.
- Cover one fixture each for 2D/3D, nodal/edge elements, steady/transient, nonlinear, and time-harmonic solves.
- Add deformed geometry, contours/isosurfaces, multiple clipping planes, and physical-group authoring.
- Gate: every fixture compares mesh counts, selected parameter metadata, solver convergence, and sampled field values against native Gmsh/GetDP.

### Phase 5: advanced ONELAB workflows

- Combine Gmsh/GetDP around one ONELAB server.
- Add parameter loops, result histories, repeated solve memory audits, and optional OPFS project persistence.
- Add SLEPc/eigen fixtures only when required.
- Gate: representative ONELAB models execute check/compute loops without process or socket emulation.

## Immediate Next Work

The next implementation should be Phase 0, not the full viewer:

1. Add a reproducible `tools/wasm/` build workspace outside the Vite application bundle.
2. Build a serial Gmsh variant with view bindings.
3. Turn the validated GetDP/PETSc executable into a modular worker-loaded library.
4. Run the microstrip solve in Playwright and extract one scalar and one vector view.
5. Record startup time, compressed transfer size, peak WASM memory, repeat-run memory growth, cancellation recovery, and mobile Chromium behavior.

Those measurements determine whether Gmsh and GetDP should remain separate modules or be linked into one ONELAB runtime before larger UI work begins.

## Sources

- [Gmsh](https://gitlab.onelab.info/gmsh/gmsh)
- [GetDP](https://gitlab.onelab.info/getdp/getdp)
- [PETSc Emscripten installation](https://petsc.org/main/install/install/#installing-to-run-in-browser-with-emscripten)
- [GMSH-JS](https://github.com/loumalouomega/GMSH-JS)
- [meshStep](https://github.com/CNCKitchen/meshStep)
- [FEAScript](https://github.com/FEAScript/FEAScript-core)
- [NGSolve Emscripten directory](https://github.com/NGSolve/ngsolve/tree/master/emscripten)
- [MFEM](https://github.com/mfem/mfem)
- [Gmsh 2026 user meeting program](https://gmsh.info/doc/news/gmsh_user_meeting_2026.html)
