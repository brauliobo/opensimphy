import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CATALOG_REVISION = "807186a1235f3b35aa969718e16b04480e4e5f6a";
const DEFAULT_ACQUISITION_DATE = "2026-08-15";
const CATALOG_PATH = "awesome-physics/README.md";
const MANIFEST_PATH = "awesome-physics-repos/CLONE_MANIFEST.tsv";
const PLAN_PATH = "AWESOME_PHYSICS_MIGRATION_PLAN.md";
const WASM_PILOT_MANIFEST_PATH = "scripts/awesomePhysics/wasm-pilots.json";
const NATIVE_CANDIDATE_MANIFEST_PATH = "scripts/awesomePhysics/native-candidates.json";
const EXPECTED_PROJECT_ENTRIES = 75;
const EXPECTED_CLONED_REPOSITORIES = 74;
const EXPECTED_ORGANIZATIONS = 10;
const EXPECTED_ARCHIVE_ENTRIES = 1;
const EXPECTED_SIMULATION_CAPABILITIES = 76;
const NO_ADAPTER_IMPLEMENTATION_REVISION = "phase-0-no-adapters";
const OUTPUT_REVISION = "awesome-physics-descriptor-v1";
const COMPATIBILITY_REVISION = "awesome-physics-compatibility-v1";
const OPEN_SIMPHY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CORPUS_ROOT = resolve(OPEN_SIMPHY_ROOT, "..");

const EXECUTION_KINDS = new Set([
  "browser",
  "wasm",
  "wasm-candidate",
  "typescript",
  "artifact",
  "reference",
  "blocked",
]);

const CATALOG_ALIASES = Object.freeze({
  PhysX: "PhysX-3.4",
  scattpy: "scikits.scattpy",
  Psi4: "psi4",
  QMsolve: "qmsolve",
  ROOT: "root",
  "Shut up and calculate": "shut-up-and-calculate",
});

const PLAN_POLICIES = Object.freeze({
  "scikit-kinematics": {
    licenseStatus: "unclear",
    licenseText: "README BSD-2-Clause and pyproject.toml BSD-3-Clause statements need resolution.",
    maintenance: "unknown",
    maintenanceSignal: "The plan records a source-level license discrepancy; no maintenance claim is made.",
  },
  bullet3: {
    licenseStatus: "restricted",
    licenseText: "zlib license and third-party notices require review before redistribution.",
    maintenance: "active",
    maintenanceSignal: "The plan treats bullet3 as a current native engine with a port gate.",
  },
  "cannon.js": {
    licenseStatus: "verified",
    licenseText: "MIT.",
    maintenance: "stale",
    maintenanceSignal: "The plan explicitly describes the upstream API as stale.",
  },
  "matter-js": {
    licenseStatus: "verified",
    licenseText: "MIT.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a maintained browser-native model boundary for a pilot.",
  },
  "mujoco-py": {
    licenseStatus: "unclear",
    licenseText: "The deprecated wrapper and the maintained MuJoCo engine require a separate license review.",
    maintenance: "archived",
    maintenanceSignal: "The plan identifies mujoco-py as deprecated.",
  },
  myphysicslab: {
    licenseStatus: "verified",
    licenseText: "Apache-2.0.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies an active TypeScript educational collection.",
  },
  ncollide: {
    licenseStatus: "verified",
    licenseText: "Apache-2.0.",
    maintenance: "stale",
    maintenanceSignal: "The plan records old cargo-web/wasm32 evidence and prefers the successor ecosystem.",
  },
  "newton-dynamics": {
    licenseStatus: "restricted",
    licenseText: "zlib license and bundled notices require review.",
    maintenance: "archived",
    maintenanceSignal: "The source README marks the repository discontinued.",
  },
  nphysics: {
    licenseStatus: "verified",
    licenseText: "Apache-2.0.",
    maintenance: "archived",
    maintenanceSignal: "The plan identifies nphysics as superseded by Rapier.",
  },
  "PhysX-3.4": {
    licenseStatus: "restricted",
    licenseText: "BSD-style notices must be retained and reviewed for the selected SDK subset.",
    maintenance: "stale",
    maintenanceSignal: "The plan treats the 3.4 SDK as a low-priority legacy engine reference.",
  },
  PositionBasedDynamics: {
    licenseStatus: "verified",
    licenseText: "MIT.",
    maintenance: "active",
    maintenanceSignal: "The plan explicitly describes the source as active.",
  },
  pydy: {
    licenseStatus: "unclear",
    licenseText: "BSD-style license is recorded in the plan; exact source terms still need review.",
    maintenance: "unknown",
    maintenanceSignal: "The plan gives no definitive maintenance status.",
  },
  pymunk: {
    licenseStatus: "verified",
    licenseText: "MIT.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current Pyodide/Emscripten evaluation path.",
  },
  simbody: {
    licenseStatus: "verified",
    licenseText: "Apache-2.0.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current articulated-body evaluation path.",
  },
  "fluid-engine-dev": {
    licenseStatus: "verified",
    licenseText: "MIT.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current native SDK with a reduced port target.",
  },
  fluids: {
    licenseStatus: "verified",
    licenseText: "MIT.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies an active formulas library and a deferred browser build.",
  },
  pysph: {
    licenseStatus: "unclear",
    licenseText: "The plan says the license requires review before reuse.",
    maintenance: "stale",
    maintenanceSignal: "The plan describes a legacy Python/OpenCL/Cg demo stack.",
  },
  DualSPHysics: {
    licenseStatus: "restricted",
    licenseText: "LGPL-2.1 obligations apply to the source and any redistributed subset.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current CUDA/OpenMP solver with a reduced CPU target.",
  },
  "Gravity-Simulator": {
    licenseStatus: "missing",
    licenseText: "No source license was found; redistribution is blocked pending permission.",
    maintenance: "unknown",
    maintenanceSignal: "The plan records no verified maintenance signal.",
  },
  Gravisim: {
    licenseStatus: "unclear",
    licenseText: "License is unclear and must gate reuse.",
    maintenance: "stale",
    maintenanceSignal: "The plan treats the SDL2 desktop project as a port candidate rather than a current browser target.",
  },
  pycbc: {
    licenseStatus: "restricted",
    licenseText: "GPL-3.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current data-analysis stack whose full workflow remains external.",
  },
  pyrocko: {
    licenseStatus: "restricted",
    licenseText: "GPL-3.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current seismology toolkit with native applications.",
  },
  sw4: {
    licenseStatus: "restricted",
    licenseText: "GPL-2-or-later plus notices.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current MPI seismic propagator whose full solver stays external.",
  },
  "webgl-ripples": {
    licenseStatus: "verified",
    licenseText: "MIT.",
    maintenance: "stale",
    maintenanceSignal: "The plan treats the existing shader as a narrow browser-native source to preserve or modernize.",
  },
  "python-acoustics": {
    licenseStatus: "unclear",
    licenseText: "BSD license text contains a placeholder that must be reviewed.",
    maintenance: "unknown",
    maintenanceSignal: "The plan gives no definitive maintenance status.",
  },
  cantera: {
    licenseStatus: "restricted",
    licenseText: "BSD-3-Clause with government notices that must be retained.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a documented Pyodide wheel path.",
  },
  CoolProp: {
    licenseStatus: "verified",
    licenseText: "MIT.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies an existing Emscripten JavaScript/WASM interface and tests.",
  },
  "RMG-Py": {
    licenseStatus: "restricted",
    licenseText: "MIT source license; database licensing needs a separate review.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current mechanism-generation stack with a fixed lesson target.",
  },
  thermo: {
    licenseStatus: "restricted",
    licenseText: "MIT source license; dependency closure and data packaging remain review gates.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies an alpha/broad dependency surface and a deferred browser build.",
  },
  thermopy: {
    licenseStatus: "restricted",
    licenseText: "GPL-3-or-later from v0.5; license compatibility is a gate.",
    maintenance: "stale",
    maintenanceSignal: "The plan describes thermopy as a small legacy library.",
  },
  ElectricFieldSimulation: {
    licenseStatus: "missing",
    licenseText: "No license file was found; redistribution is blocked pending permission.",
    maintenance: "stale",
    maintenanceSignal: "The plan describes an old Xcode/FORZE/OpenGL example.",
  },
  EMpy: {
    licenseStatus: "verified",
    licenseText: "MIT.",
    maintenance: "stale",
    maintenanceSignal: "The plan gives no current browser build and limits reuse to selected algorithms.",
  },
  gprMax: {
    licenseStatus: "restricted",
    licenseText: "GPL-3+.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current CUDA-capable solver with a reduced lesson target.",
  },
  meep: {
    licenseStatus: "restricted",
    licenseText: "GPL-2.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current FDTD solver whose full dependency graph stays external.",
  },
  openEMS: {
    licenseStatus: "restricted",
    licenseText: "GPL-3.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current FDTD solver with a reduced worker target.",
  },
  openmeeg: {
    licenseStatus: "restricted",
    licenseText: "CeCILL-B requires credit and license review.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current C++23 boundary-element solver.",
  },
  PlasmaPy: {
    licenseStatus: "restricted",
    licenseText: "BSD-3-Clause with a patent notice.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a community plasma package in active development.",
  },
  radis: {
    licenseStatus: "restricted",
    licenseText: "LGPL-3; spectral data licenses require separate review.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current spectral synthesis stack with explicit data acquisition gates.",
  },
  "scikits.scattpy": {
    licenseStatus: "missing",
    licenseText: "No license file was found.",
    maintenance: "archived",
    maintenanceSignal: "The plan describes Python 2-era packaging and obsolete dependencies.",
  },
  "scikit-beam": {
    licenseStatus: "verified",
    licenseText: "BSD-3-Clause.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current analysis library with a bounded kernel target.",
  },
  "scikit-rf": {
    licenseStatus: "verified",
    licenseText: "BSD-3-Clause.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current RF library suitable for a pure TypeScript subset.",
  },
  "scikit-spectra": {
    licenseStatus: "unclear",
    licenseText: "README and LICENSE.txt license wording must be resolved.",
    maintenance: "archived",
    maintenanceSignal: "The source is described as unmaintained Python 2-era software.",
  },
  "scuff-em": {
    licenseStatus: "restricted",
    licenseText: "GPL-2.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current native BEM suite with a small analytic target.",
  },
  spirit: {
    licenseStatus: "restricted",
    licenseText: "MIT root license; bundled notices and the old web toolchain require review.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies an explicit Emscripten ui-web path.",
  },
  euclider: {
    licenseStatus: "unclear",
    licenseText: "MIT/Unlicense signals require source-level review.",
    maintenance: "stale",
    maintenanceSignal: "The plan describes a nightly-Cargo prototype with native rendering dependencies.",
  },
  lightpipes: {
    licenseStatus: "unclear",
    licenseText: "BSD file and MIT classifier metadata disagree and require review.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current wave-optics algorithm source without a browser runtime.",
  },
  odak: {
    licenseStatus: "restricted",
    licenseText: "MPL-2.0.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a broad current toolkit and limits the target to small kernels.",
  },
  opticspy: {
    licenseStatus: "restricted",
    licenseText: "MIT source license; glass database provenance requires review.",
    maintenance: "stale",
    maintenanceSignal: "The plan records a future JavaScript app mention rather than a verified browser build.",
  },
  poppy: {
    licenseStatus: "verified",
    licenseText: "BSD-3-Clause.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current physical-optics library with a bounded subset target.",
  },
  pyRT: {
    licenseStatus: "verified",
    licenseText: "MIT.",
    maintenance: "stale",
    maintenanceSignal: "The upstream project is described as WIP/pre-alpha.",
  },
  rayopt: {
    licenseStatus: "restricted",
    licenseText: "LGPL-3+.",
    maintenance: "stale",
    maintenanceSignal: "The plan limits reuse to a bounded subset of a native Cython/lens stack.",
  },
  raysect: {
    licenseStatus: "verified",
    licenseText: "BSD-3-Clause.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current native ray-tracing framework with a narrow lesson target.",
  },
  OpenRelativity: {
    licenseStatus: "restricted",
    licenseText: "MIT source file; Unity asset rights require review.",
    maintenance: "archived",
    maintenanceSignal: "The plan describes a Unity 5.3 project with legacy shaders.",
  },
  TFG: {
    licenseStatus: "restricted",
    licenseText: "GPL-2.",
    maintenance: "stale",
    maintenanceSignal: "The plan limits the target to a CPU correctness pass before any GPU/WASM work.",
  },
  artiq: {
    licenseStatus: "restricted",
    licenseText: "LGPL-3+/GPL-3 components; hardware and gateware remain external.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current hardware-control system but no browser simulation contract.",
  },
  flavio: {
    licenseStatus: "restricted",
    licenseText: "MIT source license; parameter-table rights require separate review.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current phenomenology library with frozen-table artifact options.",
  },
  hepdata: {
    licenseStatus: "restricted",
    licenseText: "GPL-2 service code; dataset rights require separate review.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current data service whose backend is not a static runtime target.",
  },
  "particle-clicker": {
    licenseStatus: "verified",
    licenseText: "MIT.",
    maintenance: "stale",
    maintenanceSignal: "The plan identifies an AngularJS-era browser game to be rewritten locally.",
  },
  psi4: {
    licenseStatus: "restricted",
    licenseText: "LGPL-3.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current quantum-chemistry stack whose full runtime remains external.",
  },
  pypdt: {
    licenseStatus: "missing",
    licenseText: "Source could not be retrieved, so a license could not be verified.",
    maintenance: "unknown",
    maintenanceSignal: "The access failure prevents a maintenance assessment.",
  },
  qmsolve: {
    licenseStatus: "verified",
    licenseText: "BSD-3-Clause.",
    maintenance: "stale",
    maintenanceSignal: "The plan uses qmsolve as a source reference for an existing bounded quantum-wave engine.",
  },
  "quantum-python-lectures": {
    licenseStatus: "verified",
    licenseText: "MIT.",
    maintenance: "stale",
    maintenanceSignal: "The plan explicitly describes the notebook content as stale.",
  },
  "QuantumOptics.jl": {
    licenseStatus: "verified",
    licenseText: "MIT.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current Julia library used only for reference fixtures.",
  },
  qutip: {
    licenseStatus: "verified",
    licenseText: "BSD-3-Clause.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current quantum toolbox used as an external test oracle.",
  },
  root: {
    licenseStatus: "restricted",
    licenseText: "ROOT LGPL-2.1+ and JSROOT MIT require separate handling.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current analysis framework with a static artifact/viewer boundary.",
  },
  "scikit-hep": {
    licenseStatus: "verified",
    licenseText: "BSD-3-Clause.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current HEP ecosystem metapackage without a simulation runtime.",
  },
  astropy: {
    licenseStatus: "verified",
    licenseText: "BSD-3-Clause.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current astronomy core with bounded conversion targets.",
  },
  gala: {
    licenseStatus: "verified",
    licenseText: "MIT.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current galactic-dynamics library without a verified browser build.",
  },
  galpy: {
    licenseStatus: "verified",
    licenseText: "BSD-3-Clause.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current upstream Pyodide/Emscripten workflow.",
  },
  pynbody: {
    licenseStatus: "unclear",
    licenseText: "pyproject.toml says GPL-3+ but the source license file is missing and must be verified.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current analysis framework with a reviewed snapshot target.",
  },
  sunpy: {
    licenseStatus: "verified",
    licenseText: "BSD-3-Clause.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current solar-data library with a static sample boundary.",
  },
  burnman: {
    licenseStatus: "restricted",
    licenseText: "GPL-2-or-later.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current planetary thermodynamics library.",
  },
  em: {
    licenseStatus: "restricted",
    licenseText: "CC BY 4.0 with third-party exceptions.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies an educational resource whose content and third-party terms must be preserved.",
  },
  simpeg: {
    licenseStatus: "restricted",
    licenseText: "MIT source license; data dependencies require separate review.",
    maintenance: "active",
    maintenanceSignal: "The plan identifies a current geophysics package with a bounded forward-model target.",
  },
  "shut-up-and-calculate": {
    licenseStatus: "verified",
    licenseText: "MIT.",
    maintenance: "stale",
    maintenanceSignal: "The plan limits reuse to a bounded lesson and source fixtures.",
  },
});

// Release allowlist. Every entry is a local bounded kernel with no external
// package, data, or build requirement at runtime. The module and license
// references are verified before an available descriptor is emitted.
const AWESOME_PHYSICS_IMPLEMENTATION_MAP = Object.freeze({
  "matter-js": {
    adapterId: "matter-js-browser",
    modulePath: "src/awesomePhysics/adapters/browser/matterJs.ts",
    factoryExport: "createMatterJsAdapterFactory",
    execution: "browser",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "bounded explicit Euler stepping with pairwise circle collision impulses",
    inputSchema: "matter-js-input-v1",
    outputSchema: "matter-js-output-v1",
    implementationRevision: "matter-js-browser-adapter-v1",
    transformation: "Independent bounded educational reimplementation; no upstream package, source code, build output, data, or assets are redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/browser/matterJs.ts"],
    licenseRefs: ["awesome-physics-repos/matter-js/LICENSE"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  "cannon.js": {
    adapterId: "cannon-js-browser",
    modulePath: "src/awesomePhysics/adapters/browser/cannonJs.ts",
    factoryExport: "createCannonJsAdapterFactory",
    execution: "browser",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "bounded explicit Euler stepping with pairwise sphere collision impulses",
    inputSchema: "cannon-js-input-v1",
    outputSchema: "cannon-js-output-v1",
    implementationRevision: "cannon-js-browser-adapter-v1",
    transformation: "Independent bounded educational reimplementation; no upstream package, source code, build output, data, or assets are redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/browser/cannonJs.ts"],
    licenseRefs: ["awesome-physics-repos/cannon.js/LICENSE"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  myphysicslab: {
    adapterId: "awesome-myphysicslab-browser-v1",
    modulePath: "src/awesomePhysics/adapters/browser/myphysicslab.ts",
    factoryExport: "createMyphysicslabAdapterFactory",
    execution: "browser",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "bounded classical fourth-order Runge-Kutta integration of a linear spring",
    inputSchema: "myphysicslab-input-v1",
    outputSchema: "myphysicslab-output-v1",
    implementationRevision: "myphysicslab-headless-spring-adapter-v1",
    transformation: "Independent bounded educational reimplementation of a single spring model; no upstream application, source code, build output, data, or assets are redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/browser/myphysicslab.ts"],
    licenseRefs: ["awesome-physics-repos/myphysicslab/LICENSE"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  "webgl-ripples": {
    adapterId: "awesome-webgl-ripples-browser-v1",
    modulePath: "src/awesomePhysics/adapters/browser/webglRipples.ts",
    factoryExport: "createWebglRipplesAdapterFactory",
    execution: "browser",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "bounded explicit second-order finite-difference wave update",
    inputSchema: "webgl-ripples-input-v1",
    outputSchema: "webgl-ripples-output-v1",
    implementationRevision: "webgl-ripples-headless-adapter-v1",
    transformation: "Independent bounded educational reimplementation of the finite-difference wave model; no upstream browser, shader, build output, data, or assets are redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/browser/webglRipples.ts"],
    licenseRefs: ["awesome-physics-repos/webgl-ripples/LICENSE.txt"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  "particle-clicker": {
    adapterId: "awesome-particle-clicker-browser-v1",
    modulePath: "src/awesomePhysics/adapters/browser/particleClicker.ts",
    factoryExport: "createParticleClickerAdapterFactory",
    execution: "browser",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "bounded deterministic click, upgrade, worker, and elapsed-time state transitions",
    inputSchema: "particle-clicker-input-v1",
    outputSchema: "particle-clicker-output-v1",
    implementationRevision: "particle-clicker-bounded-progression-adapter-v1",
    transformation: "Independent bounded educational reimplementation; no upstream application, source code, build output, data, or assets are redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/browser/particleClicker.ts"],
    licenseRefs: ["awesome-physics-repos/particle-clicker/LICENSE"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  qmsolve: {
    adapterId: "awesome-qmsolve-typescript",
    modulePath: "src/awesomePhysics/adapters/typescript/qmsolve.ts",
    factoryExport: "qmsolveAdapterFactory",
    execution: "typescript",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "central finite-difference Crank-Nicolson stepping with a tridiagonal solve",
    inputSchema: "qmsolve-input-v1",
    outputSchema: "qmsolve-output-v1",
    implementationRevision: "qmsolve-typescript-finite-difference-v1",
    transformation: "Independent bounded educational reimplementation of a one-dimensional wave kernel; no upstream Python package, SciPy/CUDA runtime, build output, data, or assets are redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/typescript/qmsolve.ts"],
    licenseRefs: ["awesome-physics-repos/qmsolve/LICENSE"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  EMpy: {
    adapterId: "awesome-empy-typescript",
    modulePath: "src/awesomePhysics/adapters/typescript/empy.ts",
    factoryExport: "empyAdapterFactory",
    execution: "typescript",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "independent bounded 2x2 characteristic-matrix multiplication for finite films",
    inputSchema: "empy-input-v1",
    outputSchema: "empy-output-v1",
    implementationRevision: "empy-thin-film-typescript-v1",
    transformation: "Independent bounded educational reimplementation of a thin-film transfer-matrix subset; no upstream Python package, NumPy/SciPy runtime, build output, data, or assets are redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/typescript/empy.ts"],
    licenseRefs: ["awesome-physics-repos/EMpy/LICENSE"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  pyRT: {
    adapterId: "awesome-pyrt-typescript",
    modulePath: "src/awesomePhysics/adapters/typescript/pyRt.ts",
    factoryExport: "pyRtAdapterFactory",
    execution: "typescript",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "bounded quadratic ray-sphere intersection using the nearest valid root",
    inputSchema: "pyrt-input-v1",
    outputSchema: "pyrt-output-v1",
    implementationRevision: "pyrt-ray-sphere-typescript-v1",
    transformation: "Independent bounded educational reimplementation of a ray-sphere kernel; no upstream Python package, renderer, build output, data, or assets are redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/typescript/pyRt.ts"],
    licenseRefs: ["awesome-physics-repos/pyRT/LICENSE.md"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  "scikit-rf": {
    adapterId: "awesome-scikit-rf-typescript",
    modulePath: "src/awesomePhysics/adapters/typescript/scikitRf.ts",
    factoryExport: "scikitRfAdapterFactory",
    execution: "typescript",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "direct complex scalar impedance-to-reflection conversion with voltage transmission",
    inputSchema: "scikit-rf-input-v1",
    outputSchema: "scikit-rf-output-v1",
    implementationRevision: "scikit-rf-complex-conversion-typescript-v1",
    transformation: "Independent bounded educational reimplementation of a scalar RF conversion subset; no upstream Python package, NumPy/SciPy runtime, build output, data, or assets are redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/typescript/scikitRf.ts"],
    licenseRefs: ["awesome-physics-repos/scikit-rf/LICENSE.txt"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  fluids: {
    adapterId: "awesome-fluids-typescript",
    modulePath: "src/awesomePhysics/adapters/typescript/fluids.ts",
    factoryExport: "fluidsAdapterFactory",
    execution: "typescript",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "direct bounded SI evaluation of sound speed, Reynolds number, and thermal diffusivity",
    inputSchema: "fluids-input-v1",
    outputSchema: "fluids-output-v1",
    implementationRevision: "fluids-core-typescript-v1",
    transformation: "Independent bounded educational reimplementation of selected scalar correlations; no upstream Python package, NumPy/SciPy runtime, build output, data, or assets are redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/typescript/fluids.ts"],
    licenseRefs: ["awesome-physics-repos/fluids/LICENSE.txt"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  gala: {
    adapterId: "awesome-gala-typescript",
    modulePath: "src/awesomePhysics/adapters/typescript/gala.ts",
    factoryExport: "galaAdapterFactory",
    execution: "typescript",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "direct pairwise Newtonian acceleration with bounded velocity-Verlet stepping",
    inputSchema: "gala-input-v1",
    outputSchema: "gala-output-v1",
    implementationRevision: "gala-orbit-velocity-verlet-typescript-v1",
    transformation: "Independent bounded educational reimplementation in normalized units; no upstream Python/Cython runtime, Astropy/GSL data, build output, or assets are redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/typescript/gala.ts"],
    licenseRefs: ["awesome-physics-repos/gala/LICENSE"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  "shut-up-and-calculate": {
    adapterId: "awesome-shut-up-and-calculate-typescript",
    modulePath: "src/awesomePhysics/adapters/typescript/tightBinding.ts",
    factoryExport: "tightBindingAdapterFactory",
    execution: "typescript",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "direct cosine band evaluation and bounded Fermi-Dirac occupancy on a uniform k grid",
    inputSchema: "shut-up-and-calculate-input-v1",
    outputSchema: "shut-up-and-calculate-output-v1",
    implementationRevision: "tight-binding-1d-occupancy-typescript-v1",
    transformation: "Independent bounded educational reimplementation of a one-dimensional tight-binding subset; no upstream Python package, NumPy/SciPy/Numba runtime, build output, data, or assets are redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/typescript/tightBinding.ts"],
    licenseRefs: ["awesome-physics-repos/shut-up-and-calculate/LICENSE"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  poppy: {
    adapterId: "awesome-poppy-typescript",
    modulePath: "src/awesomePhysics/adapters/typescript/poppy.ts",
    factoryExport: "poppyAdapterFactory",
    execution: "typescript",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "analytic normalized Airy or sinc amplitude for bounded Fraunhofer aperture slices",
    inputSchema: "poppy-input-v1",
    outputSchema: "poppy-output-v1",
    implementationRevision: "poppy-fraunhofer-aperture-typescript-v1",
    transformation: "Independent bounded educational reimplementation of circular and rectangular aperture slices; no upstream Python package, Astropy/SciPy runtime, build output, data, or assets are redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/typescript/poppy.ts"],
    licenseRefs: ["awesome-physics-repos/poppy/LICENSE.md"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  "quantum-python-lectures": {
    adapterId: "awesome-quantum-python-lectures-typescript",
    modulePath: "src/awesomePhysics/adapters/typescript/quantumPythonLectures.ts",
    factoryExport: "quantumPythonLecturesAdapterFactory",
    execution: "typescript",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "bounded classical RK4 harmonic-oscillator integration and isolated Lorentzian/Gaussian lineshape evaluation",
    inputSchema: "quantum-python-lectures-input-v1",
    outputSchema: "quantum-python-lectures-output-v1",
    implementationRevision: "quantum-python-lectures-rk4-lineshape-typescript-v1",
    transformation: "Independent bounded educational reimplementation of selected lecture ODE and lineshape instruments; no upstream notebooks, SciPy, QuTiP, CSV, or Jupyter runtime are redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/typescript/quantumPythonLectures.ts"],
    licenseRefs: ["awesome-physics-repos/quantum-python-lectures/LICENSE"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  qutip: {
    adapterId: "awesome-qutip-typescript",
    modulePath: "src/awesomePhysics/adapters/typescript/qutip.ts",
    factoryExport: "qutipAdapterFactory",
    execution: "typescript",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "closed-form two-level Rabi population and bounded RK4 optical Bloch integration with radiative decay",
    inputSchema: "qutip-input-v1",
    outputSchema: "qutip-output-v1",
    implementationRevision: "qutip-two-level-rabi-lindblad-typescript-v1",
    transformation: "Independent bounded educational reimplementation of selected two-level Rabi and Lindblad instruments; no QuTiP package, mesolve, Cython, SciPy, or example dataset is redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/typescript/qutip.ts"],
    licenseRefs: ["awesome-physics-repos/qutip/LICENSE.txt"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  "scikit-beam": {
    adapterId: "awesome-scikit-beam-typescript",
    modulePath: "src/awesomePhysics/adapters/typescript/scikitBeam.ts",
    factoryExport: "scikitBeamAdapterFactory",
    execution: "typescript",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "closed-form spherical Bessel form factor on a uniform q grid and bounded linear lag correlation",
    inputSchema: "scikit-beam-input-v1",
    outputSchema: "scikit-beam-output-v1",
    implementationRevision: "scikit-beam-sphere-form-factor-correlation-typescript-v1",
    transformation: "Independent bounded educational reimplementation of selected diffraction and correlation instruments; no scikit-beam package, Cython, or scientific I/O is redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/typescript/scikitBeam.ts"],
    licenseRefs: ["awesome-physics-repos/scikit-beam/LICENSE"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  raysect: {
    adapterId: "awesome-raysect-typescript",
    modulePath: "src/awesomePhysics/adapters/typescript/raysect.ts",
    factoryExport: "raysectAdapterFactory",
    execution: "typescript",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "bounded Snell prism trace with Cauchy refractive index and a four-point 2D polyline",
    inputSchema: "raysect-input-v1",
    outputSchema: "raysect-output-v1",
    implementationRevision: "raysect-prism-snell-cauchy-typescript-v1",
    transformation: "Independent bounded educational reimplementation of a prism and intersection lesson; no raysect engine, Cython, or multiprocessing runtime is redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/typescript/raysect.ts"],
    licenseRefs: ["awesome-physics-repos/raysect/LICENSE.txt"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  "QuantumOptics.jl": {
    adapterId: "awesome-quantumoptics-jl-typescript",
    modulePath: "src/awesomePhysics/adapters/typescript/quantumOpticsJl.ts",
    factoryExport: "quantumOpticsJlAdapterFactory",
    execution: "typescript",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "closed-form Jaynes-Cummings vacuum Rabi oscillation on the single-excitation manifold",
    inputSchema: "quantumoptics-jl-input-v1",
    outputSchema: "quantumoptics-jl-output-v1",
    implementationRevision: "quantumoptics-jl-jaynes-cummings-typescript-v1",
    transformation: "Independent bounded TypeScript stand-in of selected QuantumOptics.jl reference examples; no Julia runtime or QuantumOptics.jl package is redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/typescript/quantumOpticsJl.ts"],
    licenseRefs: ["awesome-physics-repos/QuantumOptics.jl/LICENSE.md"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  astropy: {
    adapterId: "awesome-astropy-typescript",
    modulePath: "src/awesomePhysics/adapters/typescript/astropy.ts",
    factoryExport: "astropyAdapterFactory",
    execution: "typescript",
    modelOrigin: "educational-reimplementation",
    numericalMethod: "direct bounded SI unit conversion and spherical ICRS-to-Galactic rotation",
    inputSchema: "astropy-input-v1",
    outputSchema: "astropy-output-v1",
    implementationRevision: "astropy-units-galactic-typescript-v1",
    transformation: "Independent bounded educational reimplementation of selected unit and coordinate conversions; no astropy C extensions, FITS, WCS, mmap, or remote data are redistributed.",
    sourceRefs: ["src/awesomePhysics/adapters/typescript/astropy.ts"],
    licenseRefs: ["awesome-physics-repos/astropy/LICENSE.rst"],
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
});

// This path is intentionally separate from local implementations and native
// candidates. Only these named records can become runnable through verified
// WASM, and every entry is checked against its central artifact manifest.
const AWESOME_PHYSICS_VERIFIED_WASM_IMPLEMENTATION_MAP = Object.freeze({
  CoolProp: {
    manifestKind: "wasm-pilots",
    manifestPath: WASM_PILOT_MANIFEST_PATH,
    manifestId: "coolprop",
    sourceRevision: "4db89c1ce8d0b0d98ba7f03594f58a845351cf6a",
    adapterId: "awesome-coolprop-wasm",
    modulePath: "src/awesomePhysics/adapters/wasm/coolprop.ts",
    factoryExport: "createCoolPropAdapter",
    execution: "wasm",
    modelOrigin: "upstream-adaptation",
    numericalMethod: "Pinned CoolProp F2K, PropsSI, and bounded AbstractState evaluations through a local classic worker",
    inputSchema: "coolprop-input-v1",
    outputSchema: "coolprop-output-v1",
    implementationRevision: "coolprop-classic-worker-v1",
    transformation: "Verified pinned CoolProp Emscripten artifact dispatched through a local classic worker; no remote runtime, package, or data fallback is used.",
    availabilityReason: "Available: the pinned CoolProp WASM pilot passed its availability, license, local integrity, and classic-worker gates.",
    sourceRefs: [
      "src/awesomePhysics/adapters/wasm/coolprop.ts",
      "src/awesomePhysics/wasm/coolpropWorker.ts",
      "public/wasm/awesomePhysics/coolprop/coolprop.worker.js",
      "scripts/awesomePhysics/wasm/coolprop/README.md",
    ],
    licenseRefs: [
      "awesome-physics-repos/CoolProp/LICENSE",
      "public/wasm/awesomePhysics/coolprop/NOTICE.md",
      WASM_PILOT_MANIFEST_PATH,
    ],
    noticeRef: "public/wasm/awesomePhysics/coolprop/NOTICE.md",
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  galpy: {
    manifestKind: "wasm-pilots",
    manifestPath: WASM_PILOT_MANIFEST_PATH,
    manifestId: "galpy",
    sourceRevision: "3762e73ef84578f4a911325d283e652eb1886625",
    adapterId: "awesome-galpy-wasm",
    modulePath: "src/awesomePhysics/adapters/wasm/galpy.ts",
    factoryExport: "createGalpyAdapterFactory",
    execution: "wasm",
    modelOrigin: "upstream-adaptation",
    numericalMethod: "Pinned galpy MWPotential2014 leapfrog orbit through a verified local standalone WebAssembly module",
    inputSchema: "galpy-input-v1",
    outputSchema: "galpy-output-v1",
    implementationRevision: "galpy-mwpotential2014-leapfrog-wasm-v1",
    transformation: "Verified pinned galpy MWPotential2014/orbit ABI compiled to a local standalone WASM module; no Pyodide runtime, NumPy, SciPy, or remote package is used.",
    availabilityReason: "Available: the pinned galpy MWPotential2014 WASM pilot passed its availability, license, local integrity, companion, and module-worker gates.",
    sourceRefs: [
      "src/awesomePhysics/adapters/wasm/galpy.ts",
      "scripts/awesomePhysics/wasm/galpy/galpy_abi.c",
      "scripts/awesomePhysics/wasm/galpy/galpy.js",
      "scripts/awesomePhysics/wasm/galpy/build.mjs",
      "scripts/awesomePhysics/wasm/galpy/build-ledger.json",
      "scripts/awesomePhysics/wasm/galpy/README.md",
    ],
    licenseRefs: [
      "awesome-physics-repos/galpy/LICENSE",
      "scripts/awesomePhysics/wasm/galpy/NOTICE.md",
      "public/wasm/awesomePhysics/galpy/NOTICE.md",
      WASM_PILOT_MANIFEST_PATH,
    ],
    noticeRef: "public/wasm/awesomePhysics/galpy/NOTICE.md",
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  cantera: {
    manifestKind: "wasm-pilots",
    manifestPath: WASM_PILOT_MANIFEST_PATH,
    manifestId: "cantera",
    sourceRevision: "11a2381011cb6d42e61cc4c195e0f920864bf8d3",
    adapterId: "awesome-cantera-wasm",
    modulePath: "src/awesomePhysics/adapters/wasm/cantera.ts",
    factoryExport: "createCanteraAdapterFactory",
    execution: "wasm",
    modelOrigin: "upstream-adaptation",
    numericalMethod: "Pinned Cantera ohmech thermo, HP equilibrium, and zero-D constant-pressure reactor through a verified local standalone WebAssembly module",
    inputSchema: "cantera-input-v1",
    outputSchema: "cantera-output-v1",
    implementationRevision: "cantera-h2o2-zerod-wasm-v1",
    transformation: "Verified pinned Cantera C++ thermo/equilibrium/zero-D ABI compiled to a local standalone WASM module; no Pyodide runtime, 1-D flame, or full data directory is used.",
    availabilityReason: "Available: the pinned Cantera headless WASM pilot passed its availability, BSD/government license, local integrity, companion, and module-worker gates.",
    sourceRefs: [
      "src/awesomePhysics/adapters/wasm/cantera.ts",
      "scripts/awesomePhysics/wasm/cantera/cantera_abi.cpp",
      "scripts/awesomePhysics/wasm/cantera/cantera.js",
      "scripts/awesomePhysics/wasm/cantera/build.mjs",
      "scripts/awesomePhysics/wasm/cantera/build-ledger.json",
      "scripts/awesomePhysics/wasm/cantera/README.md",
    ],
    licenseRefs: [
      "awesome-physics-repos/cantera/License.txt",
      "scripts/awesomePhysics/wasm/cantera/NOTICE.md",
      "public/wasm/awesomePhysics/cantera/NOTICE.md",
      WASM_PILOT_MANIFEST_PATH,
    ],
    noticeRef: "public/wasm/awesomePhysics/cantera/NOTICE.md",
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  nphysics: {
    manifestKind: "wasm-pilots",
    manifestPath: WASM_PILOT_MANIFEST_PATH,
    manifestId: "nphysics",
    sourceRevision: "65aa85c5470a5da85e0c13652ce58400ae2e2201",
    adapterId: "awesome-nphysics2d-wasm",
    modulePath: "src/awesomePhysics/adapters/wasm/nphysics2d.ts",
    factoryExport: "createNphysics2dAdapterFactory",
    execution: "wasm",
    modelOrigin: "upstream-adaptation",
    numericalMethod: "Pinned nphysics2d headless ground-and-ball stepping through the verified wasm-bindgen module companion",
    inputSchema: "nphysics2d-input-v1",
    outputSchema: "nphysics2d-output-v1",
    implementationRevision: "nphysics2d-wasm-bindgen-module-worker-v1",
    transformation: "Verified pinned nphysics2d wasm-bindgen artifact dispatched through the existing module worker; no remote runtime, package, or data fallback is used.",
    availabilityReason: "Available: the pinned nphysics2d WASM pilot passed its availability, license, local integrity, companion, and module-worker gates.",
    sourceRefs: [
      "src/awesomePhysics/adapters/wasm/nphysics2d.ts",
      "scripts/awesomePhysics/wasm/nphysics/abi/src/lib.rs",
      "scripts/awesomePhysics/wasm/nphysics/abi/Cargo.toml",
      "scripts/awesomePhysics/wasm/nphysics/abi/Cargo.lock",
      "scripts/awesomePhysics/wasm/nphysics/build.mjs",
      "scripts/awesomePhysics/wasm/nphysics/build-ledger.json",
      "scripts/awesomePhysics/wasm/nphysics/README.md",
    ],
    licenseRefs: [
      "awesome-physics-repos/nphysics/LICENSE",
      "scripts/awesomePhysics/wasm/nphysics/NOTICE.md",
      "public/wasm/awesomePhysics/nphysics/NOTICE.md",
      WASM_PILOT_MANIFEST_PATH,
    ],
    noticeRef: "public/wasm/awesomePhysics/nphysics/NOTICE.md",
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  PositionBasedDynamics: {
    manifestKind: "native-candidates",
    manifestPath: NATIVE_CANDIDATE_MANIFEST_PATH,
    manifestId: "position-based-dynamics",
    sourceRevision: "beafc921e21553515b4f406258e5b16054a45268",
    adapterId: "awesome-positionbaseddynamics-wasm",
    modulePath: "src/awesomePhysics/adapters/wasm/positionBasedDynamics.ts",
    factoryExport: "positionBasedDynamicsAdapterFactory",
    execution: "wasm",
    modelOrigin: "upstream-adaptation",
    numericalMethod: "PositionBasedDynamics scalar distance-constraint correction",
    inputSchema: "position-based-dynamics-distance-input-v1",
    outputSchema: "position-based-dynamics-distance-output-v1",
    implementationRevision: "position-based-dynamics-headless-v1",
    transformation: "Pinned PositionBasedDynamics CPU solver translation units and a narrow scalar C ABI compiled to a verified local standalone WebAssembly module.",
    sourceRefs: [
      "src/awesomePhysics/adapters/wasm/positionBasedDynamics.ts",
      "scripts/awesomePhysics/wasm/position-based-dynamics/build-ledger.json",
      "scripts/awesomePhysics/wasm/position-based-dynamics/README.md",
    ],
    licenseRefs: [
      "awesome-physics-repos/PositionBasedDynamics/LICENSE",
      "scripts/awesomePhysics/wasm/position-based-dynamics/NOTICE.md",
      "public/wasm/awesomePhysics/position-based-dynamics/NOTICE.md",
    ],
    noticeRef: "public/wasm/awesomePhysics/position-based-dynamics/NOTICE.md",
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  bullet3: {
    manifestKind: "native-candidates",
    manifestPath: NATIVE_CANDIDATE_MANIFEST_PATH,
    manifestId: "bullet3",
    sourceRevision: "63c4d67e337017f9d8b298c900e9aabdb69296e7",
    adapterId: "awesome-bullet3-wasm",
    modulePath: "src/awesomePhysics/adapters/wasm/bullet3.ts",
    factoryExport: "createBullet3AdapterFactory",
    execution: "wasm",
    modelOrigin: "upstream-adaptation",
    numericalMethod: "Pinned Bullet3 headless scalar collision/dynamics ABI through the generic module worker",
    inputSchema: "bullet3-input-v1",
    outputSchema: "bullet3-output-v1",
    implementationRevision: "bullet3-headless-scalar-wasm-v1",
    transformation: "Pinned Bullet3 CPU collision/dynamics subset and a narrow scalar C ABI compiled to a verified local standalone WebAssembly module.",
    sourceRefs: [
      "src/awesomePhysics/adapters/wasm/bullet3.ts",
      "scripts/awesomePhysics/wasm/bullet3/README.md",
      "scripts/awesomePhysics/wasm/bullet3/NOTICE-LEDGER.md",
    ],
    licenseRefs: [
      "awesome-physics-repos/bullet3/LICENSE.txt",
      "scripts/awesomePhysics/wasm/bullet3/NOTICE-LEDGER.md",
      "public/wasm/awesomePhysics/bullet3/NOTICE.md",
    ],
    noticeRef: "public/wasm/awesomePhysics/bullet3/NOTICE.md",
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  spirit: {
    manifestKind: "native-candidates",
    manifestPath: NATIVE_CANDIDATE_MANIFEST_PATH,
    manifestId: "spirit-headless",
    sourceRevision: "e82250d3b14411c2c2fa292d143f13e3e111ad8c",
    adapterId: "awesome-spirit-wasm",
    modulePath: "src/awesomePhysics/adapters/wasm/spirit.ts",
    factoryExport: "createSpiritAdapterFactory",
    execution: "wasm",
    modelOrigin: "upstream-adaptation",
    numericalMethod: "Pinned Spirit Heun LLG magnetization through a verified local standalone WebAssembly module",
    inputSchema: "spirit-llg-heun-input-v1",
    outputSchema: "spirit-llg-heun-output-v1",
    implementationRevision: "spirit-llg-heun-headless-v1",
    transformation: "Bounded Heun LLG C ABI compiled to a verified local standalone WebAssembly module; Spirit ui-web, ImGui, and VFRendering are not redistributed.",
    availabilityReason: "Available: the pinned Spirit headless LLG WASM artifact passed its availability, MIT license, local integrity, and worker-boundary gates.",
    sourceRefs: [
      "src/awesomePhysics/adapters/wasm/spirit.ts",
      "scripts/awesomePhysics/wasm/spirit/spirit_abi.cpp",
      "scripts/awesomePhysics/wasm/spirit/build.mjs",
      "scripts/awesomePhysics/wasm/spirit/build-ledger.json",
      "scripts/awesomePhysics/wasm/spirit/README.md",
    ],
    licenseRefs: [
      "awesome-physics-repos/spirit/LICENSE.txt",
      "scripts/awesomePhysics/wasm/spirit/NOTICE.md",
      "public/wasm/awesomePhysics/spirit/NOTICE.md",
    ],
    noticeRef: "public/wasm/awesomePhysics/spirit/NOTICE.md",
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  pymunk: {
    manifestKind: "wasm-pilots",
    manifestPath: WASM_PILOT_MANIFEST_PATH,
    manifestId: "pymunk",
    sourceRevision: "6287ce6d9223d1d79d28b2c26f37499f45b445b8",
    adapterId: "awesome-pymunk-wasm",
    modulePath: "src/awesomePhysics/adapters/wasm/pymunk.ts",
    factoryExport: "createPymunkAdapterFactory",
    execution: "wasm",
    modelOrigin: "upstream-adaptation",
    numericalMethod: "Pinned Chipmunk/Munk2D headless ground-and-ball stepping through a verified local WASM module",
    inputSchema: "pymunk-input-v1",
    outputSchema: "pymunk-output-v1",
    implementationRevision: "pymunk-chipmunk-headless-wasm-v1",
    transformation: "Verified pinned Munk2D/Chipmunk headless ABI compiled to a local raw WASM module; no Pyodide runtime, pygame, or remote package is used.",
    availabilityReason: "Available: the pinned pymunk Chipmunk WASM pilot passed its availability, license, local integrity, and module-worker gates.",
    companionRequired: false,
    sourceRefs: [
      "src/awesomePhysics/adapters/wasm/pymunk.ts",
      "scripts/awesomePhysics/wasm/pymunk/abi/pymunk_headless.c",
      "scripts/awesomePhysics/wasm/pymunk/build.mjs",
      "scripts/awesomePhysics/wasm/pymunk/build-ledger.json",
      "scripts/awesomePhysics/wasm/pymunk/README.md",
    ],
    licenseRefs: [
      "awesome-physics-repos/pymunk/LICENSE.txt",
      "scripts/awesomePhysics/wasm/pymunk/NOTICE.md",
      "public/wasm/awesomePhysics/pymunk/NOTICE.md",
      WASM_PILOT_MANIFEST_PATH,
    ],
    noticeRef: "public/wasm/awesomePhysics/pymunk/NOTICE.md",
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  ncollide: {
    manifestKind: "native-candidates",
    manifestPath: NATIVE_CANDIDATE_MANIFEST_PATH,
    manifestId: "ncollide",
    sourceRevision: "f3c3ecb3c98d1c2698574372b6b0e9d0032bc0c5",
    adapterId: "awesome-ncollide-wasm",
    modulePath: "src/awesomePhysics/adapters/wasm/ncollide.ts",
    factoryExport: "createNcollideAdapterFactory",
    execution: "wasm",
    modelOrigin: "upstream-adaptation",
    numericalMethod: "Pinned ncollide2d headless distance, contact, ray, translational TOI, and CCD plane-settling ABI through the generic module worker",
    inputSchema: "ncollide2d-input-v1",
    outputSchema: "ncollide2d-output-v1",
    implementationRevision: "ncollide2d-headless-collision-wasm-v1",
    transformation: "Pinned ncollide2d collision-only subset and a narrow scalar C ABI compiled to a verified local standalone WebAssembly module.",
    availabilityReason: "Available: the pinned ncollide2d WASM artifact passed its availability, license, local integrity, and worker-boundary gates.",
    sourceRefs: [
      "src/awesomePhysics/adapters/wasm/ncollide.ts",
      "scripts/awesomePhysics/wasm/ncollide/README.md",
      "scripts/awesomePhysics/wasm/ncollide/build-ledger.json",
    ],
    licenseRefs: [
      "awesome-physics-repos/ncollide/LICENSE",
      "scripts/awesomePhysics/wasm/ncollide/NOTICE.md",
      "public/wasm/awesomePhysics/ncollide/NOTICE.md",
    ],
    noticeRef: "public/wasm/awesomePhysics/ncollide/NOTICE.md",
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  "fluid-engine-dev": {
    manifestKind: "native-candidates",
    manifestPath: NATIVE_CANDIDATE_MANIFEST_PATH,
    manifestId: "fluid-engine-dev",
    sourceRevision: "94c300ff5ad8a2f588e5e27e8e9746a424b29863",
    adapterId: "awesome-fluid-engine-dev-wasm",
    modulePath: "src/awesomePhysics/adapters/wasm/fluidEngineDev.ts",
    factoryExport: "createFluidEngineDevAdapterFactory",
    execution: "wasm",
    modelOrigin: "upstream-adaptation",
    numericalMethod: "Pinned Jet 2D SPH serial kernel through the generic module worker",
    inputSchema: "fluid-engine-dev-sph2-input-v1",
    outputSchema: "fluid-engine-dev-sph2-output-v1",
    implementationRevision: "fluid-engine-dev-sph2-headless-wasm-v1",
    transformation: "Pinned fluid-engine-dev 2D SPH subset and a narrow scalar C ABI compiled to a verified local standalone WebAssembly module.",
    availabilityReason: "Available: the pinned fluid-engine-dev 2D SPH WASM artifact passed its availability, license, local integrity, and worker-boundary gates.",
    companionRequired: false,
    sourceRefs: [
      "src/awesomePhysics/adapters/wasm/fluidEngineDev.ts",
      "scripts/awesomePhysics/wasm/fluid-engine-dev/README.md",
      "scripts/awesomePhysics/wasm/fluid-engine-dev/build-ledger.json",
    ],
    licenseRefs: [
      "awesome-physics-repos/fluid-engine-dev/LICENSE.md",
      "scripts/awesomePhysics/wasm/fluid-engine-dev/NOTICE.md",
      "public/wasm/awesomePhysics/fluid-engine-dev/NOTICE.md",
    ],
    noticeRef: "public/wasm/awesomePhysics/fluid-engine-dev/NOTICE.md",
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  "PhysX-3.4": {
    manifestKind: "native-candidates",
    manifestPath: NATIVE_CANDIDATE_MANIFEST_PATH,
    manifestId: "physx-3-4",
    sourceRevision: "5e42a5f112351a223c19c17bb331e6c55037b8eb",
    adapterId: "awesome-physx-3-4-wasm",
    modulePath: "src/awesomePhysics/adapters/wasm/physx.ts",
    factoryExport: "createPhysxAdapterFactory",
    execution: "wasm",
    modelOrigin: "upstream-adaptation",
    numericalMethod: "Pinned PhysX 3.4 headless scalar plane/sphere ABI through the generic module worker",
    inputSchema: "physx-3-4-input-v1",
    outputSchema: "physx-3-4-output-v1",
    implementationRevision: "physx-3-4-headless-scalar-wasm-v1",
    transformation: "Pinned PhysX 3.4 CPU subset and a narrow scalar C ABI compiled to a verified local standalone WebAssembly module.",
    availabilityReason: "Available: the pinned PhysX 3.4 WASM artifact passed its availability, license, local integrity, and worker-boundary gates.",
    companionRequired: false,
    sourceRefs: [
      "src/awesomePhysics/adapters/wasm/physx.ts",
      "scripts/awesomePhysics/wasm/physx/README.md",
      "scripts/awesomePhysics/wasm/physx/NOTICE-LEDGER.md",
      "scripts/awesomePhysics/wasm/physx/build-ledger.json",
    ],
    licenseRefs: [
      "awesome-physics-repos/PhysX-3.4/README.md",
      "scripts/awesomePhysics/wasm/physx/NOTICE.md",
      "public/wasm/awesomePhysics/physx/NOTICE.md",
    ],
    noticeRef: "public/wasm/awesomePhysics/physx/NOTICE.md",
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
  "newton-dynamics": {
    manifestKind: "native-candidates",
    manifestPath: NATIVE_CANDIDATE_MANIFEST_PATH,
    manifestId: "newton-dynamics",
    sourceRevision: "a9c460c3509c935e65c5b1196b955d56627c3ffa",
    adapterId: "awesome-newton-dynamics-wasm",
    modulePath: "src/awesomePhysics/adapters/wasm/newtonDynamics.ts",
    factoryExport: "createNewtonDynamicsAdapterFactory",
    execution: "wasm",
    modelOrigin: "upstream-adaptation",
    numericalMethod: "Pinned Newton 4.00 headless scalar sphere ABI through the generic module worker",
    inputSchema: "newton-dynamics-input-v1",
    outputSchema: "newton-dynamics-output-v1",
    implementationRevision: "newton-dynamics-headless-scalar-wasm-v1",
    transformation: "Pinned Newton 4.00 CPU subset and a narrow scalar C ABI compiled to a verified local standalone WebAssembly module.",
    availabilityReason: "Available: the pinned Newton Dynamics WASM artifact passed its availability, license, local integrity, and worker-boundary gates.",
    companionRequired: false,
    sourceRefs: [
      "src/awesomePhysics/adapters/wasm/newtonDynamics.ts",
      "scripts/awesomePhysics/wasm/newton-dynamics/README.md",
      "scripts/awesomePhysics/wasm/newton-dynamics/NOTICE-LEDGER.md",
      "scripts/awesomePhysics/wasm/newton-dynamics/build-ledger.json",
    ],
    licenseRefs: [
      "awesome-physics-repos/newton-dynamics/newton-4.00/sdk/LICENSE",
      "scripts/awesomePhysics/wasm/newton-dynamics/NOTICE.md",
      "public/wasm/awesomePhysics/newton-dynamics/NOTICE.md",
    ],
    noticeRef: "public/wasm/awesomePhysics/newton-dynamics/NOTICE.md",
    runtime: { externalPackages: [], externalData: [], requiresBuild: false },
  },
});

const ORGANIZATION_METADATA = Object.freeze({
  CERN: { status: "listed", notes: "Organization profile only; the plan makes no build or runtime claim." },
  IOP: { status: "review", notes: "The plan flags the link as resolving to an unrelated individual account." },
  LANL: { status: "listed", notes: "Organization profile only; the plan makes no build or runtime claim." },
  LIGO: { status: "official-source-note", notes: "The plan directs LIGO software references to official GitLab sources where applicable." },
  LLNL: { status: "listed", notes: "Organization profile only; the plan makes no build or runtime claim." },
  MPPMU: { status: "listed", notes: "Organization profile only; the plan makes no build or runtime claim." },
  NIST: { status: "listed", notes: "Organization profile only; the plan makes no build or runtime claim." },
  NREL: { status: "moved", notes: "The plan records that the organization link moved to NatLabRockies." },
  ORNL: { status: "listed", notes: "Organization profile only; the plan makes no build or runtime claim." },
  SLAC: { status: "listed", notes: "Organization profile only; the plan makes no build or runtime claim." },
});

const LANGUAGE_RULES = [
  ["C++", /C\+\+/],
  ["C", /(?:^|[\s/,(])C(?:$|[\s/),.;])/],
  ["C#", /C#/],
  ["Cython", /Cython/],
  ["CUDA", /CUDA/],
  ["Fortran", /Fortran/],
  ["GLSL", /GLSL/],
  ["HTML", /HTML/],
  ["JavaScript", /JavaScript|AngularJS/],
  ["Julia", /Julia/],
  ["Python", /Python/],
  ["Rust", /Rust/],
  ["Scheme", /Scheme/],
  ["TypeScript", /TypeScript/],
];

const RUNTIME_LIMITS = Object.freeze({
  maxGridSize: 256,
  maxParticles: 4096,
  maxIterations: 10000,
  maxMemoryBytes: 64 * 1024 * 1024,
  maxWorkerTimeMs: 5000,
  maxOutputBytes: 4 * 1024 * 1024,
});

const NO_RUNTIME_LIMITS = Object.freeze({
  maxGridSize: 0,
  maxParticles: 0,
  maxIterations: 0,
  maxMemoryBytes: 0,
  maxWorkerTimeMs: 0,
  maxOutputBytes: 0,
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function slug(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripMarkdown(value) {
  return value
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function markdownLinks(value) {
  return [...value.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)].map((match) => ({
    label: match[1],
    url: match[2],
  }));
}

function tableCells(line) {
  return line.split("|").slice(1, -1).map((cell) => cell.trim());
}

function canonicalName(name) {
  return CATALOG_ALIASES[name] ?? name;
}

function assertRelativePath(value, label) {
  if (value === null) return;
  assert(typeof value === "string" && value.length > 0, `${label} must be a non-empty path or null`);
  assert(!value.startsWith("/"), `${label} must be repository-relative`);
  assert(!/^[A-Za-z]:[\\/]/.test(value), `${label} must not be a local absolute path`);
  assert(!value.includes("\\"), `${label} must use POSIX separators`);
  assert(!value.split("/").includes(".."), `${label} must not escape its repository`);
}

function parseCatalogMarkdown(markdown) {
  assert(typeof markdown === "string" && markdown.length > 0, "Awesome Physics README is missing or empty");
  const rows = [];
  let section = null;
  let subsection = null;

  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    const sectionMatch = line.match(/^## (.+)$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      subsection = null;
      continue;
    }
    const subsectionMatch = line.match(/^### (.+)$/);
    if (subsectionMatch) {
      subsection = subsectionMatch[1].trim();
      continue;
    }
    if (!line.startsWith("* [")) continue;
    if (!/^\* \[[^\]]+\]\(https?:\/\//.test(line)) continue;

    const match = line.match(/^\* \[([^\]]+)\]\((https?:\/\/[^)]+)\)(?:\s+-\s+|\s+)(.+)$/);
    assert(match, `Malformed Awesome Physics catalog row at line ${index + 1}`);
    assert(section, `Catalog row has no section at line ${index + 1}`);
    const title = match[1].trim();
    const url = match[2].trim();
    const remainder = match[3]?.trim() ?? "";
    rows.push({
      title,
      url,
      description: stripMarkdown(remainder),
      relatedLinks: markdownLinks(remainder),
      section,
      subsection,
      line: index + 1,
      organization: section === "Organizations",
    });
  }

  assert(rows.length === EXPECTED_PROJECT_ENTRIES + EXPECTED_ARCHIVE_ENTRIES + EXPECTED_ORGANIZATIONS,
    `Expected ${EXPECTED_PROJECT_ENTRIES + EXPECTED_ARCHIVE_ENTRIES + EXPECTED_ORGANIZATIONS} catalog rows, found ${rows.length}`);
  const organizations = rows.filter((row) => row.organization);
  const nonOrganizations = rows.filter((row) => !row.organization);
  const archives = nonOrganizations.filter((row) => row.title === "Solid State Simulations");
  const projects = nonOrganizations.filter((row) => row.title !== "Solid State Simulations");
  assert(projects.length === EXPECTED_PROJECT_ENTRIES, `Expected ${EXPECTED_PROJECT_ENTRIES} project rows, found ${projects.length}`);
  assert(archives.length === EXPECTED_ARCHIVE_ENTRIES, `Expected ${EXPECTED_ARCHIVE_ENTRIES} archive row, found ${archives.length}`);
  assert(organizations.length === EXPECTED_ORGANIZATIONS, `Expected ${EXPECTED_ORGANIZATIONS} organization rows, found ${organizations.length}`);
  return { projects, archive: archives[0], organizations };
}

function parseManifest(manifestText) {
  assert(typeof manifestText === "string" && manifestText.length > 0, "Awesome Physics clone manifest is missing or empty");
  const lines = manifestText.split(/\r?\n/).filter((line) => line.length > 0);
  const expectedHeader = "name\tcategory\tcatalog_url\tupstream_url\tclone_path\trevision\tstatus\tnotes";
  assert(lines[0] === expectedHeader, "Awesome Physics clone manifest header is malformed");
  const rows = lines.slice(1).map((line, index) => {
    const cells = line.split("\t");
    assert(cells.length === 8, `Malformed clone manifest row at line ${index + 2}`);
    const [name, category, catalogUrl, upstreamUrl, clonePath, revision, status, notes] = cells;
    assert(name && category && catalogUrl && upstreamUrl && status && notes, `Incomplete clone manifest row at line ${index + 2}`);
    assert(status === "cloned" || status === "not-cloned", `Unsupported clone status for ${name}: ${status}`);
    const normalizedClonePath = clonePath === "-" ? null : clonePath;
    const normalizedRevision = revision === "-" ? null : revision;
    if (status === "cloned") {
      assertRelativePath(normalizedClonePath, `clone path for ${name}`);
      assert(normalizedClonePath.startsWith("awesome-physics-repos/"), `Clone path for ${name} must stay under awesome-physics-repos`);
      assert(/^[a-f0-9]{12}$/.test(normalizedRevision), `Clone revision for ${name} must be a 12-character lowercase revision`);
    } else {
      assert(normalizedClonePath === null && normalizedRevision === null, `Failed clone ${name} must not have a path or revision`);
    }
    return {
      name,
      category,
      catalogUrl,
      upstreamUrl,
      clonePath: normalizedClonePath,
      revision: normalizedRevision,
      status,
      notes,
      line: index + 2,
    };
  });

  assert(rows.length === EXPECTED_PROJECT_ENTRIES, `Expected ${EXPECTED_PROJECT_ENTRIES} manifest rows, found ${rows.length}`);
  assert(rows.filter(({ status }) => status === "cloned").length === EXPECTED_CLONED_REPOSITORIES,
    `Expected ${EXPECTED_CLONED_REPOSITORIES} cloned repositories`);
  assert(rows.filter(({ status }) => status === "not-cloned").length === 1, "Expected one failed clone record");
  assert(new Set(rows.map(({ name }) => name)).size === rows.length, "Clone manifest names must be unique");
  return rows;
}

function parsePlan(planText) {
  assert(typeof planText === "string" && planText.length > 0, "Awesome Physics migration plan is missing or empty");
  const lines = planText.split(/\r?\n/);
  const rows = [];
  let inMatrix = false;

  for (const [index, line] of lines.entries()) {
    if (line === "## Complete Migration Matrix") {
      inMatrix = true;
      continue;
    }
    if (line === "### Non-repository and organization entries") {
      inMatrix = false;
      continue;
    }
    if (!inMatrix || !line.startsWith("| ")) continue;
    const cells = tableCells(line);
    if (cells[0] === "Entry" || cells.every((cell) => /^-+$/.test(cell))) continue;
    assert(cells.length === 5, `Malformed migration matrix row at line ${index + 1}`);
    const [entryCell, role, routeCell, disposition, priority] = cells;
    const name = entryCell.replace(/^`|`$/g, "").trim();
    const executionOptions = routeCell.split(/\s*\/\s*/).map((value) => value.replace(/`/g, "").trim()).filter(Boolean);
    assert(name && role && disposition, `Incomplete migration matrix row at line ${index + 1}`);
    assert(executionOptions.length > 0 && executionOptions.every((kind) => EXECUTION_KINDS.has(kind)),
      `Unsupported execution route for ${name}`);
    assert(/^P[0-3]$/.test(priority), `Unsupported priority for ${name}: ${priority}`);
    rows.push({ name, role, executionOptions, disposition, priority, line: index + 1 });
  }

  assert(rows.length === EXPECTED_PROJECT_ENTRIES, `Expected ${EXPECTED_PROJECT_ENTRIES} migration rows, found ${rows.length}`);
  assert(new Set(rows.map(({ name }) => name)).size === rows.length, "Migration matrix names must be unique");
  const policyNames = Object.keys(PLAN_POLICIES).sort();
  const rowNames = rows.map(({ name }) => name).sort();
  assert(JSON.stringify(policyNames) === JSON.stringify(rowNames), "Migration policy coverage does not match the pinned matrix");
  return rows;
}

function planRef(row) {
  return `${PLAN_PATH}:${row.line}`;
}

function catalogRef(row) {
  return `${CATALOG_PATH}:${row.line}`;
}

function manifestRef(row) {
  return `${MANIFEST_PATH}:${row.line}`;
}

function findByName(rows, name, label) {
  const row = rows.find((candidate) => candidate.name === name);
  assert(row, `${label} is missing ${name}`);
  return row;
}

function languagesFor(row, plan) {
  const text = `${row.description} ${plan.role} ${plan.disposition}`;
  return LANGUAGE_RULES.filter(([, pattern]) => pattern.test(text)).map(([language]) => language);
}

function licenseGate(status) {
  if (status === "verified") return "pass";
  if (status === "missing") return "blocked";
  return "review";
}

function implementationReferenceExists(reference) {
  const root = /^(?:public|scripts|src)\//.test(reference) ? OPEN_SIMPHY_ROOT : CORPUS_ROOT;
  return existsSync(resolve(root, reference));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readVerifiedWasmRecord(manifestKind, manifestPath, manifestId) {
  const absoluteManifestPath = resolve(OPEN_SIMPHY_ROOT, manifestPath);
  assert(existsSync(absoluteManifestPath), `Verified WASM manifest is missing at ${manifestPath}`);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(absoluteManifestPath, "utf8"));
  } catch (reason) {
    throw new Error(`Verified WASM manifest is not valid JSON: ${reason instanceof Error ? reason.message : String(reason)}`);
  }
  assert(manifest?.manifestKind === manifestKind, `Verified WASM manifest kind is not ${manifestKind}`);
  assert(Array.isArray(manifest.records), `Verified WASM manifest ${manifestPath} records are missing`);
  const record = manifest.records.find(({ id }) => id === manifestId);
  assert(record, `Verified WASM manifest ${manifestPath} is missing ${manifestId}`);
  return record;
}

function verifyLocalWasmArtifact(integrity, label) {
  assert(integrity && typeof integrity === "object" && !Array.isArray(integrity), `${label} integrity is missing`);
  assert(typeof integrity.path === "string", `${label}.path must be a non-empty path`);
  assertRelativePath(integrity.path, `${label}.path`);
  assert(integrity.path.startsWith("wasm/"), `${label}.path must be under the public WASM directory`);
  assert(typeof integrity.sha256 === "string" && /^[a-f0-9]{64}$/.test(integrity.sha256), `${label}.sha256 must be a lowercase SHA-256 digest`);
  assert(Number.isSafeInteger(integrity.byteSize) && integrity.byteSize > 0, `${label}.byteSize must be a positive safe integer`);

  const localPath = resolve(OPEN_SIMPHY_ROOT, "public", integrity.path);
  assert(existsSync(localPath), `${label} is missing its local file at public/${integrity.path}`);
  const bytes = readFileSync(localPath);
  assert(bytes.byteLength === integrity.byteSize, `${label} byte size does not match its local file`);
  assert(sha256(bytes) === integrity.sha256, `${label} SHA-256 does not match its local file`);
  return {
    path: integrity.path,
    sha256: integrity.sha256,
    byteSize: integrity.byteSize,
  };
}

function assertVerifiedWasmImplementationEntry(name, plan, implementation) {
  const manifestPaths = {
    "wasm-pilots": WASM_PILOT_MANIFEST_PATH,
    "native-candidates": NATIVE_CANDIDATE_MANIFEST_PATH,
  };
  assert(Object.hasOwn(manifestPaths, implementation.manifestKind),
    `Verified WASM implementation ${name} has an unsupported artifact manifest kind`);
  assert(implementation.manifestPath === manifestPaths[implementation.manifestKind],
    `Verified WASM implementation ${name} must use its declared artifact manifest`);
  const policy = PLAN_POLICIES[name];
  assert(policy, `No policy for verified WASM implementation ${name}`);
  assert(plan.executionOptions.some((kind) => kind === "wasm" || kind === "wasm-candidate"),
    `Verified WASM implementation ${name} requires a wasm or wasm-candidate migration route`);
  assert(implementation.execution === "wasm", `Verified WASM implementation ${name} must execute as wasm`);
  assert(/^[a-f0-9]{40}$/.test(implementation.sourceRevision),
    `Verified WASM implementation ${name} requires a full lowercase source revision`);
  assert(/^[A-Za-z0-9_-]+$/.test(implementation.adapterId), `Verified WASM implementation ${name} has an unsafe adapter ID`);
  assertRelativePath(implementation.modulePath, `${name}.implementation.modulePath`);
  assert(implementation.modulePath.startsWith("src/"), `Verified WASM implementation ${name} module must be under src`);
  const modulePath = resolve(OPEN_SIMPHY_ROOT, implementation.modulePath);
  assert(existsSync(modulePath), `Verified WASM implementation ${name} points to a missing adapter module`);
  const moduleText = readFileSync(modulePath, "utf8");
  const factoryPattern = new RegExp(`export\\s+(?:const|function)\\s+${escapedRegExp(implementation.factoryExport)}\\b`);
  assert(factoryPattern.test(moduleText), `Verified WASM implementation ${name} points to a missing exported factory ${implementation.factoryExport}`);
  for (const reference of [...implementation.sourceRefs, ...implementation.licenseRefs]) {
    assertRelativePath(reference, `${name}.implementation evidence`);
    assert(implementationReferenceExists(reference), `Verified WASM implementation ${name} evidence is missing ${reference}`);
  }
  assert(implementation.runtime.externalPackages.length === 0, `Verified WASM implementation ${name} requires an external package`);
  assert(implementation.runtime.externalData.length === 0, `Verified WASM implementation ${name} requires external data`);
  assert(implementation.runtime.requiresBuild === false, `Verified WASM implementation ${name} requires an external build`);
  for (const field of ["numericalMethod", "inputSchema", "outputSchema", "implementationRevision", "transformation"]) {
    assert(typeof implementation[field] === "string" && implementation[field].trim().length > 0,
      `Verified WASM implementation ${name}.${field} must be a non-empty string`);
  }

  const record = readVerifiedWasmRecord(implementation.manifestKind, implementation.manifestPath, implementation.manifestId);
  assert(record.project === name, `Verified WASM record ${implementation.manifestId} does not identify ${name}`);
  assert(record.status === "available", `Verified WASM record ${implementation.manifestId} is not available`);
  assert(record.licenseGate?.status === "pass", `Verified WASM record ${implementation.manifestId} does not have a passing license gate`);
  assert(record.output?.artifactKind === "wasm-module", `Verified WASM record ${implementation.manifestId} must declare a wasm-module output`);
  assert(record.source?.revision === implementation.sourceRevision,
    `Verified WASM record ${implementation.manifestId} source revision does not match the verified implementation`);
  for (const field of ["maxMemoryBytes", "maxArtifactBytes", "maxWorkerTimeMs", "maxOutputBytes"]) {
    assert(Number.isSafeInteger(record.runtime?.[field]) && record.runtime[field] > 0,
      `Verified WASM record ${implementation.manifestId}.runtime.${field} must be a positive safe integer`);
  }
  const artifact = verifyLocalWasmArtifact(record.artifact, `${implementation.manifestId} WASM artifact`);
  let companion = null;
  if (implementation.companionRequired === false) {
    assert(record.artifact?.companion === undefined,
      `Verified WASM record ${implementation.manifestId} must not claim a companion artifact`);
  } else if (implementation.manifestKind === "wasm-pilots") {
    companion = verifyLocalWasmArtifact(record.artifact?.companion, `${implementation.manifestId} JavaScript companion`);
  } else {
    assert(record.artifact?.companion === undefined,
      `Verified WASM record ${implementation.manifestId} must not claim a companion artifact`);
  }
  assert(record.evidenceRefs?.includes(implementation.noticeRef),
    `Verified WASM record ${implementation.manifestId} must retain its public notice evidence`);
  return { record, artifact, companion };
}

function escapedRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertImplementationEntry(name, plan, implementation) {
  const policy = PLAN_POLICIES[name];
  assert(policy, `No policy for implementation ${name}`);
  assert(licenseGate(policy.licenseStatus) === "pass", `Implementation ${name} requires a passing plan license gate`);
  assert(plan.executionOptions[0] === implementation.execution,
    `Implementation ${name} execution must match the migration plan`);
  assert(!plan.executionOptions.includes("wasm") && !plan.executionOptions.includes("wasm-candidate"),
    `Implementation ${name} cannot enable a WASM or wasm-candidate entry`);
  assert(EXECUTION_KINDS.has(implementation.execution), `Implementation ${name} has an unsupported execution kind`);
  assert(/^[A-Za-z0-9_-]+$/.test(implementation.adapterId), `Implementation ${name} has an unsafe adapter ID`);
  assertRelativePath(implementation.modulePath, `${name}.implementation.modulePath`);
  assert(implementation.modulePath.startsWith("src/"), `Implementation ${name} module must be under src`);
  assert(existsSync(resolve(OPEN_SIMPHY_ROOT, implementation.modulePath)),
    `Implementation ${name} points to a missing adapter module`);
  const moduleText = readFileSync(resolve(OPEN_SIMPHY_ROOT, implementation.modulePath), "utf8");
  const factoryPattern = new RegExp(`export\\s+(?:const|function)\\s+${escapedRegExp(implementation.factoryExport)}\\b`);
  assert(factoryPattern.test(moduleText), `Implementation ${name} points to a missing exported factory ${implementation.factoryExport}`);
  for (const reference of [...implementation.sourceRefs, ...implementation.licenseRefs]) {
    assertRelativePath(reference, `${name}.implementation evidence`);
    assert(implementationReferenceExists(reference), `Implementation ${name} evidence is missing ${reference}`);
  }
  assert(implementation.runtime.externalPackages.length === 0, `Implementation ${name} requires an external package`);
  assert(implementation.runtime.externalData.length === 0, `Implementation ${name} requires external data`);
  assert(implementation.runtime.requiresBuild === false, `Implementation ${name} requires an external build`);
  for (const field of ["numericalMethod", "inputSchema", "outputSchema", "implementationRevision", "transformation"])
    assert(typeof implementation[field] === "string" && implementation[field].trim().length > 0,
      `Implementation ${name}.${field} must be a non-empty string`);
}

function assertImplementationMap(parsedCatalog, planByName) {
  const verifiedNames = Object.keys(AWESOME_PHYSICS_VERIFIED_WASM_IMPLEMENTATION_MAP).sort();
  assert(JSON.stringify(verifiedNames) === JSON.stringify(["CoolProp", "galpy", "cantera", "nphysics", "PositionBasedDynamics", "bullet3", "spirit", "pymunk", "ncollide", "PhysX-3.4", "newton-dynamics", "fluid-engine-dev"].sort()),
    "Verified WASM implementation allowlist must contain exactly CoolProp, galpy, cantera, nphysics, PositionBasedDynamics, bullet3, spirit, pymunk, ncollide, PhysX-3.4, newton-dynamics, and fluid-engine-dev");
  for (const [name, implementation] of Object.entries(AWESOME_PHYSICS_IMPLEMENTATION_MAP)) {
    assert(!Object.hasOwn(AWESOME_PHYSICS_VERIFIED_WASM_IMPLEMENTATION_MAP, name),
      `Implementation ${name} must not also appear in the verified WASM allowlist`);
    const catalogRow = parsedCatalog.projects.find((row) => canonicalName(row.title) === name);
    assert(catalogRow, `Implementation map points to a missing catalog item ${name}`);
    const plan = planByName.get(name);
    assert(plan, `Implementation map points to a missing migration plan row ${name}`);
    assertImplementationEntry(name, plan, implementation);
  }
  for (const [name, implementation] of Object.entries(AWESOME_PHYSICS_VERIFIED_WASM_IMPLEMENTATION_MAP)) {
    const catalogRow = parsedCatalog.projects.find((row) => canonicalName(row.title) === name);
    assert(catalogRow, `Verified WASM implementation map points to a missing catalog item ${name}`);
    const plan = planByName.get(name);
    assert(plan, `Verified WASM implementation map points to a missing migration plan row ${name}`);
    assertVerifiedWasmImplementationEntry(name, plan, implementation);
  }
}

function modelOrigin(execution) {
  if (execution === "browser" || execution === "wasm" || execution === "wasm-candidate") return "upstream-adaptation";
  if (execution === "typescript") return "educational-reimplementation";
  if (execution === "artifact") return "source-artifact";
  return "reference-only";
}

function limitsFor(execution) {
  if (execution === "browser" || execution === "wasm" || execution === "wasm-candidate" || execution === "typescript") {
    return { ...RUNTIME_LIMITS };
  }
  return { ...NO_RUNTIME_LIMITS };
}

function assertFiniteLimits(limits, id) {
  for (const [key, value] of Object.entries(limits)) {
    assert(Number.isFinite(value) && Number.isInteger(value) && value >= 0, `${id}.limits.${key} must be a finite non-negative integer`);
  }
}

function accessFailureFor(manifest) {
  if (manifest.status !== "not-cloned") return null;
  const attemptedOn = manifest.notes.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? null;
  const observed = [];
  if (/404/.test(manifest.notes)) observed.push("404");
  if (/authentication/i.test(manifest.notes)) observed.push("authentication-unavailable");
  assert(attemptedOn, `Failed clone ${manifest.name} must record an acquisition date`);
  assert(observed.length > 0, `Failed clone ${manifest.name} must record an observed access failure`);
  return { attemptedOn, observed, note: manifest.notes };
}

function buildLinks(row, manifest, archive = false) {
  const links = [{ kind: "catalog", label: row.title, url: row.url }];
  if (manifest && manifest.upstreamUrl !== row.url) links.push({ kind: "upstream", label: "Upstream source", url: manifest.upstreamUrl });
  if (manifest && manifest.upstreamUrl === row.url) links.push({ kind: "upstream", label: "Upstream source", url: manifest.upstreamUrl });
  for (const related of row.relatedLinks) {
    links.push({ kind: archive ? "archive-download" : "related", label: related.label, url: related.url });
  }
  if (manifest?.name === "galpy") {
    links.push({ kind: "documentation", label: "Canonical galpy documentation", url: "https://docs.galpy.org/en/latest/" });
    links.push({ kind: "legacy-documentation", label: "Legacy catalog documentation URL", url: row.url });
  }
  const seen = new Set();
  return links.filter((link) => {
    const key = `${link.kind}:${link.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildCatalogItem(row, manifest, plan, catalogRevision) {
  const policy = PLAN_POLICIES[plan.name];
  assert(policy, `No policy for ${plan.name}`);
  const canonical = canonicalName(row.title);
  assert(canonical === manifest.name, `Catalog name ${row.title} does not map to manifest name ${manifest.name}`);
  assert(manifest.catalogUrl === row.url, `Catalog URL mismatch for ${canonical}`);
  assert(manifest.category, `Missing category for ${canonical}`);
  assertRelativePath(manifest.clonePath, `${canonical}.localPath`);
  const sourceKind = canonical === "galpy" ? "documentation" : "repository";
  const sourceRefs = [catalogRef(row), planRef(plan), manifestRef(manifest)];
  const licenseRefs = [planRef(plan), manifestRef(manifest)];
  const maintenanceRefs = [catalogRef(row), planRef(plan)];
  const failure = accessFailureFor(manifest);
  const substitution = canonical === "galpy" ? {
    kind: "current-upstream-substitution",
    reason: manifest.notes,
    catalogUrl: row.url,
    canonicalUpstreamUrl: manifest.upstreamUrl,
  } : null;

  return {
    id: `awesome-${slug(canonical)}`,
    canonicalName: canonical,
    aliases: Object.entries(CATALOG_ALIASES).filter(([, value]) => value === canonical).map(([key]) => key),
    category: manifest.category,
    catalogSection: row.section,
    title: row.title,
    description: row.description,
    catalogUrl: row.url,
    upstreamUrl: manifest.upstreamUrl,
    catalogRevision,
    upstreamRevision: manifest.revision,
    localPath: manifest.clonePath,
    sourceKind,
    language: languagesFor(row, plan),
    license: {
      status: policy.licenseStatus,
      text: policy.licenseText,
      evidenceRefs: licenseRefs,
    },
    maintenance: policy.maintenance,
    maintenanceSignal: policy.maintenanceSignal,
    evidence: { sourceRefs, licenseRefs, maintenanceRefs },
    links: buildLinks(row, manifest),
    catalogLine: row.line,
    manifestLine: manifest.line,
    planLine: plan.line,
    access: {
      status: manifest.status,
      note: manifest.notes,
      attemptedOn: failure?.attemptedOn ?? null,
    },
    accessFailure: failure,
    upstreamResolution: substitution,
  };
}

function buildArchiveItem(row, planText, catalogRevision) {
  const planLine = planText.split(/\r?\n/).findIndex((line) => line.startsWith("| Solid State Simulations archive |")) + 1;
  assert(planLine > 0, "Solid State Simulations archive is missing from the migration plan");
  const sourceRefs = [catalogRef(row), `${PLAN_PATH}:${planLine}`];
  const licenseRefs = [`${PLAN_PATH}:${planLine}`];
  const maintenanceRefs = [catalogRef(row), `${PLAN_PATH}:${planLine}`];
  return {
    id: "awesome-solid-state-simulations-archive",
    canonicalName: "Solid State Simulations archive",
    aliases: [],
    category: "Condensed matter",
    catalogSection: row.section,
    title: row.title,
    description: row.description,
    catalogUrl: row.url,
    upstreamUrl: row.url,
    catalogRevision,
    upstreamRevision: null,
    localPath: null,
    sourceKind: "archive",
    language: [],
    license: {
      status: "unclear",
      text: "Archive binaries and source rights require review before acquisition or redistribution.",
      evidenceRefs: licenseRefs,
    },
    maintenance: "archived",
    maintenanceSignal: "The catalog marks the Solid State Simulations software as unmaintained.",
    evidence: { sourceRefs, licenseRefs, maintenanceRefs },
    links: buildLinks(row, null, true),
    catalogLine: row.line,
    manifestLine: null,
    planLine,
    access: {
      status: "archived",
      note: "External archive retained as a reference; no binary or reconstructed artifact was acquired.",
      attemptedOn: null,
    },
    accessFailure: null,
    upstreamResolution: null,
  };
}

function buildOrganization(row, planText) {
  const metadata = ORGANIZATION_METADATA[row.title];
  assert(metadata, `No organization metadata for ${row.title}`);
  const planLine = planText.split(/\r?\n/).findIndex((line) => line.startsWith("| CERN, IOP, LANL, LIGO, LLNL, MPPMU, NIST, NREL, ORNL, SLAC |")) + 1;
  assert(planLine > 0, "Organization metadata row is missing from the migration plan");
  return {
    id: `awesome-org-${slug(row.title)}`,
    title: row.title,
    description: row.description,
    url: row.url,
    sourceKind: "organization",
    maintenance: "unknown",
    status: metadata.status,
    notes: metadata.notes,
    evidenceRefs: [catalogRef(row), `${PLAN_PATH}:${planLine}`],
    catalogLine: row.line,
  };
}

function buildSimulation(item, plan, catalogRevision, acquisitionDate) {
  const plannedExecutionOptions = plan?.executionOptions ?? ["artifact", "reference"];
  const localImplementation = plan ? AWESOME_PHYSICS_IMPLEMENTATION_MAP[plan.name] : null;
  const verifiedWasmImplementation = plan ? AWESOME_PHYSICS_VERIFIED_WASM_IMPLEMENTATION_MAP[plan.name] : null;
  const implementation = localImplementation ?? verifiedWasmImplementation;
  const hasImplementation = implementation !== undefined && implementation !== null;
  const verifiedWasm = verifiedWasmImplementation
    ? assertVerifiedWasmImplementationEntry(plan.name, plan, verifiedWasmImplementation)
    : null;
  const execution = implementation?.execution ?? plannedExecutionOptions[0];
  const executionOptions = hasImplementation ? [execution] : plannedExecutionOptions;
  const policy = plan ? PLAN_POLICIES[plan.name] : {
    licenseStatus: "unclear",
    licenseText: "Archive rights require review.",
  };
  const gate = verifiedWasm?.record.licenseGate.status ?? licenseGate(policy.licenseStatus);
  if (hasImplementation && verifiedWasm === null) assertImplementationEntry(plan.name, plan, implementation);
  const availability = hasImplementation
    ? "available"
    : execution === "blocked" || gate === "blocked"
      ? "blocked"
      : "unavailable";
  let availabilityReason;
  if (hasImplementation) {
    availabilityReason = verifiedWasm
      ? implementation.availabilityReason ?? `Available: the pinned ${plan.name} WASM artifact passed its availability, license, local integrity, and worker-boundary gates.`
      : "Available: bounded local kernel passed the plan license gate and requires no external package, data, or build at runtime.";
  } else if (execution === "blocked") {
    availabilityReason = "Blocked: the source access attempt failed and no public canonical source or verified license is available.";
  } else if (gate === "blocked") {
    availabilityReason = "Blocked: the source or license gate has not passed; no adapter or redistributed artifact is permitted.";
  } else if (executionOptions.includes("wasm-candidate")) {
    availabilityReason = "Unavailable: wasm-candidate proof-of-concept gates have not passed and Phase 0 has no adapter.";
  } else if (execution === "reference") {
    availabilityReason = "Unavailable: this is a reference-only source capability with no OpenSimPhy runtime adapter.";
  } else if (execution === "artifact") {
    availabilityReason = "Unavailable: no immutable reviewed artifact has been acquired for Phase 0.";
  } else {
    availabilityReason = "Unavailable: Phase 0 declares no implemented adapter; source presence does not imply runtime availability.";
  }

  const evidenceRefs = [...new Set([
    ...item.evidence.sourceRefs,
    ...item.evidence.licenseRefs,
    ...item.evidence.maintenanceRefs,
    ...(implementation?.sourceRefs ?? []),
    ...(implementation?.licenseRefs ?? []),
    ...(verifiedWasm ? [verifiedWasmImplementation.manifestPath, ...verifiedWasm.record.source.evidenceRefs, ...verifiedWasm.record.evidenceRefs] : []),
  ])];
  const limits = verifiedWasm ? {
    ...limitsFor(execution),
    maxMemoryBytes: verifiedWasm.record.runtime.maxMemoryBytes,
    maxWorkerTimeMs: verifiedWasm.record.runtime.maxWorkerTimeMs,
    maxOutputBytes: verifiedWasm.record.runtime.maxOutputBytes,
  } : limitsFor(execution);
  assertFiniteLimits(limits, item.id);
  const sourceRevision = verifiedWasm?.record.source.revision ?? item.upstreamRevision;
  const transformation = implementation?.transformation ?? (item.sourceKind === "archive"
    ? "none: archive was not acquired or reconstructed"
    : item.accessFailure
      ? "none: source acquisition failed; no artifact was produced"
      : "none: no artifact redistributed in Phase 0");

  return {
    id: `${item.id}-capability`,
    catalogItemId: item.id,
    title: item.title,
    capability: item.sourceKind === "archive" ? "archive-reference" : "catalog-entry",
    execution,
    executionOptions,
    availability,
    runnable: hasImplementation,
    priority: plan?.priority ?? "P3",
    modelOrigin: implementation?.modelOrigin ?? modelOrigin(execution),
    numericalMethod: implementation?.numericalMethod ?? null,
    inputSchema: implementation?.inputSchema ?? null,
    outputSchema: implementation?.outputSchema ?? null,
    sourceRevision,
    implementationRevision: implementation?.implementationRevision ?? NO_ADAPTER_IMPLEMENTATION_REVISION,
    licenseGate: gate,
    availabilityReason,
    planDisposition: plan?.disposition ?? "Preserve the archived links as attributed reference records; do not create placeholder artifacts.",
    limits,
    artifactProvenance: {
      sourceRevision,
      acquisitionDate,
      byteSize: verifiedWasm?.artifact.byteSize ?? null,
      sha256: verifiedWasm?.artifact.sha256 ?? null,
      transformation,
      datasetLicense: null,
      evidenceRefs,
    },
    evidenceRefs,
    ...(hasImplementation ? { adapterId: implementation.adapterId } : {}),
    compatibilityRevision: COMPATIBILITY_REVISION,
    modelRevision: `awesome-physics-plan-${catalogRevision}`,
    contentRevision: `awesome-physics-catalog-${catalogRevision}`,
    outputRevision: OUTPUT_REVISION,
  };
}

function assertNoAbsoluteSourcePaths(catalog, simulations) {
  assertRelativePath(catalog.source.catalogPath, "catalog.source.catalogPath");
  assertRelativePath(catalog.source.manifestPath, "catalog.source.manifestPath");
  assertRelativePath(catalog.source.migrationPlanPath, "catalog.source.migrationPlanPath");
  for (const item of catalog.items) {
    assertRelativePath(item.localPath, `${item.id}.localPath`);
    for (const reference of [...item.evidence.sourceRefs, ...item.evidence.licenseRefs, ...item.evidence.maintenanceRefs]) {
      assert(!reference.startsWith("/"), `${item.id} evidence reference must be repository-relative`);
    }
  }
  for (const organization of catalog.organizations) {
    for (const reference of organization.evidenceRefs) assert(!reference.startsWith("/"), `${organization.id} evidence reference must be repository-relative`);
  }
  for (const descriptor of simulations.items) {
    for (const reference of descriptor.evidenceRefs) assert(!reference.startsWith("/"), `${descriptor.id} evidence reference must be repository-relative`);
  }
}

export function buildAwesomePhysicsArtifacts({
  catalogText,
  manifestText,
  planText,
  catalogRevision = CATALOG_REVISION,
  acquisitionDate = DEFAULT_ACQUISITION_DATE,
} = {}) {
  assert(/^[a-f0-9]{40}$/.test(catalogRevision), "Awesome Physics catalog revision must be a lowercase 40-character revision");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(acquisitionDate), "Awesome Physics acquisition date must be YYYY-MM-DD");
  const parsedCatalog = parseCatalogMarkdown(catalogText);
  const manifest = parseManifest(manifestText);
  const plan = parsePlan(planText);
  const manifestByName = new Map(manifest.map((row) => [row.name, row]));
  const planByName = new Map(plan.map((row) => [row.name, row]));
  assertImplementationMap(parsedCatalog, planByName);

  const items = parsedCatalog.projects.map((row) => {
    const name = canonicalName(row.title);
    const manifestRow = findByName(manifest, name, "Clone manifest");
    const planRow = findByName(plan, name, "Migration plan");
    return buildCatalogItem(row, manifestRow, planRow, catalogRevision);
  });
  const archiveItem = buildArchiveItem(parsedCatalog.archive, planText, catalogRevision);
  items.push(archiveItem);
  items.sort((left, right) => left.catalogLine - right.catalogLine);
  const organizations = parsedCatalog.organizations.map((row) => buildOrganization(row, planText));

  assert(manifestByName.size === EXPECTED_PROJECT_ENTRIES, "Manifest index size changed unexpectedly");
  assert(planByName.size === EXPECTED_PROJECT_ENTRIES, "Plan index size changed unexpectedly");
  assert(new Set(items.map(({ id }) => id)).size === items.length, "Catalog item IDs must be unique");
  assert(new Set(organizations.map(({ id }) => id)).size === organizations.length, "Organization IDs must be unique");
  assert(items.length === EXPECTED_PROJECT_ENTRIES + EXPECTED_ARCHIVE_ENTRIES, "Catalog item count changed unexpectedly");

  const source = {
    catalogPath: CATALOG_PATH,
    manifestPath: MANIFEST_PATH,
    migrationPlanPath: PLAN_PATH,
    acquisitionDate,
    evidenceRefs: [CATALOG_PATH, MANIFEST_PATH, PLAN_PATH],
  };
  const catalog = {
    schemaVersion: 1,
    generatedAt: acquisitionDate,
    catalogRevision,
    source,
    summary: {
      totalEntries: items.length + organizations.length,
      projectEntries: EXPECTED_PROJECT_ENTRIES,
      archiveEntries: EXPECTED_ARCHIVE_ENTRIES,
      organizationEntries: organizations.length,
      clonedRepositories: manifest.filter(({ status }) => status === "cloned").length,
      failedAccessEntries: manifest.filter(({ status }) => status === "not-cloned").length,
      documentationAliases: items.filter(({ sourceKind }) => sourceKind === "documentation").length,
    },
    items,
    organizations,
  };

  const simulationsItems = items.map((item) => buildSimulation(item, planByName.get(item.canonicalName), catalogRevision, acquisitionDate));
  assert(simulationsItems.length === EXPECTED_SIMULATION_CAPABILITIES, `Expected ${EXPECTED_SIMULATION_CAPABILITIES} simulation capabilities`);
  assert(new Set(simulationsItems.map(({ id }) => id)).size === simulationsItems.length, "Simulation descriptor IDs must be unique");
  const inconsistentDescriptors = simulationsItems.filter(({ availability, runnable, adapterId }) => availability === "available"
    ? !(runnable === true && adapterId !== undefined)
    : !(runnable === false && adapterId === undefined));
  assert(inconsistentDescriptors.length === 0, `Descriptor availability and adapter declarations must agree: ${inconsistentDescriptors.map(({ id, availability, runnable, adapterId }) => `${id}=${availability}/${runnable}/${adapterId ?? "none"}`).join(", ")}`);
  const executionKinds = Object.fromEntries([...EXECUTION_KINDS].map((kind) => [kind, simulationsItems.filter(({ execution }) => execution === kind).length]));
  const simulations = {
    schemaVersion: 1,
    generatedAt: acquisitionDate,
    catalogRevision,
    source,
    summary: {
      sourceCapabilities: simulationsItems.length,
      runnable: simulationsItems.filter(({ runnable }) => runnable).length,
      available: simulationsItems.filter(({ availability }) => availability === "available").length,
      unavailable: simulationsItems.filter(({ availability }) => availability === "unavailable").length,
      blocked: simulationsItems.filter(({ availability }) => availability === "blocked").length,
      adapterCount: simulationsItems.filter(({ adapterId }) => adapterId !== undefined).length,
      executionKinds,
    },
    items: simulationsItems,
  };

  assertNoAbsoluteSourcePaths(catalog, simulations);
  return { catalog, simulations };
}

export {
  AWESOME_PHYSICS_IMPLEMENTATION_MAP,
  AWESOME_PHYSICS_VERIFIED_WASM_IMPLEMENTATION_MAP,
  CATALOG_REVISION,
  DEFAULT_ACQUISITION_DATE,
  EXPECTED_CLONED_REPOSITORIES,
  EXPECTED_ORGANIZATIONS,
  EXPECTED_PROJECT_ENTRIES,
};
