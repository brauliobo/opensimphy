# Edwin Gray FEM workspace

This directory is an isolated, solver-neutral finite-element workspace for a
full 3D illustrative topology derived from US3890548A. It is not an exact
reconstruction of a manufactured motor. The patent supplies the topology and
sequence; dimensions, materials, and the equivalent source model are explicit
assumptions in the case file.

No files outside this directory are required or changed by this workspace.
The workspace has no package dependencies. Node.js is used only through the
built-in modules in `scripts/`.

## Canonical topology

The case models the patent's illustrative arrangement as follows:

- 9 stator pair stations at 40 degree intervals.
- 3 rotor pair stations at 120 degree intervals.
- Each station has a minor and a major element separated by 13 1/3 degrees.
- Each element has a front and a back axial plane.
- 36 stator electromagnets plus 12 rotor electromagnets make 48 named
  `*_CoilCore` physical groups.
- The geometry is full 3D. No symmetry reduction is applied by default.

The 48 named physical groups are assembly groups containing the corresponding
core and coil-shell volumes. Additional aggregate groups named
`StatorCores`, `StatorCoils`, `RotorCores`, `RotorCoils`, `AllCores`, and
`AllCoils` are material/source groups for GetDP.

The excitation contract additionally requires exactly 48 coil-envelope-only
physical volumes: stator IDs `2101` through `2136` and rotor IDs `2201`
through `2212`. These groups exclude core and air. The archived production
audit verifies every one is nonempty and maps it to the corresponding
`event-map-v1.json` identity.

The patent describes a capacitor discharge and a programmed sequence. The FEM
artifact uses a static impressed-current snapshot at a selected rotor angle.
It does not claim to simulate the discharge transient or to validate unusual
energy claims.

## Files

- `cases/patent-3890548-illustrative.json` is the solver-neutral case contract.
- `schema/motor-case.schema.json` defines the case shape and provenance fields.
- `schema/motor-fem-lut.schema.json` defines the browser-facing lookup-table
  result shape.
- `geometry/patent-3890548-3d.geo` creates the full 3D geometry and mesh
  physical groups. `RotorAngleDeg`, `PairOffsetDeg`, phase angles, and
  `MeshSize` are configurable Gmsh parameters.
- `getdp/magnetostatic.pro` contains a basic 3D vector-potential solve and
  field, energy, and inductance-proxy postprocessing.
- `excitation/v1/event-map-v1.json` is the excitation identity contract;
  `event-map-v1.pro` selects the twelve positive/negative coil regions for one
  `EventIndex`. Each selected volume carries a compactly supported local-radial
  equivalent current potential. Its distributional curl is a closed surface
  winding, including return sheets on the same envelope boundary, with exact
  turns/current scaling and opposite front/back polarity.
- `mesh-audit/audit-msh.mjs` independently checks physical-region coverage,
  exact material partitioning, connectivity, face conformity, element
  orientation, degeneracy, shape quality, and feature resolution.
- `scripts/run.mjs` validates inputs, detects host executables first, generates
  finite coarse sweep manifests, runs Gmsh/GetDP, and maintains content-
  addressed checkpoints. The runner invokes the quantitative mesh audit after
  Gmsh and before GetDP, and hashes its report into the checkpoint and result.
- `scripts/normalize-results.mjs` converts solver values into the versioned
  browser result contract.
- `.gitignore` keeps run directories and generated solver artifacts out of the
  source workspace. Generated tables are accepted only when a completed runner
  checkpoint records matching output hashes.
- `browser/README.md` records the optional FEAScript boundary. FEAScript is not
  used as a magnetic solver; complete browser FEM values must come from the
  normalized external GetDP contract.
- `source/README.md` is the static source and provenance ledger.
- `evidence/v2/` retains the completed limited calibration pack, compact
  per-class solver evidence, checksums, and the separate rejected production
  convergence report.

## Local commands

Validate the JSON contracts and the expected geometry markers without any
solver:

```sh
node scripts/run.mjs --validate
```

Inspect host/Docker availability and the exact command plan without running a
solver. A dry run never writes fake results:

```sh
node scripts/run.mjs --dry-run
```

Generate the finite coarse full 3D sweep manifest. The output contains pending
jobs only; it contains no solver output:

```sh
node scripts/run.mjs --sweep --manifest /tmp/edwin-gray-sweep.json
```

After every selected angle has a completed normalized result, aggregate one
mesh/current slice into the browser LUT. Aggregation rejects mixed mesh sizes,
currents, cases, duplicate angles, incomplete manifest jobs, artifact hash
mismatches, and any angle set that differs from the case's exact declared
coverage. `--mesh-size` and `--drive-current` are required when the manifest
declares more than one value for either parameter:

```sh
node scripts/run.mjs --aggregate \
  --manifest /tmp/edwin-gray-sweep.json \
  --mesh-size 0.025 \
  --drive-current 1
```

Run the host tools when both are available. Host detection is attempted before
any Docker fallback:

```sh
node scripts/run.mjs --resume
```

Supply explicit compatible binaries when they are not on `PATH`:

```sh
node scripts/run.mjs --backend host \
  --gmsh-bin /path/to/gmsh \
  --getdp-bin /path/to/getdp \
  --run-dir /tmp/edwin-gray-runs \
  --resume
```

Use an explicit Docker image only when the image contains both `gmsh` and
`getdp`:

```sh
node scripts/run.mjs --backend docker --docker-image IMAGE --resume
```

Select a specific event for a single run with `--event-index 0..26`. Sweep
jobs pair each declared angle with the same-position `sweep.eventIndices`
entry; the event index and excitation contract participate in job IDs, input
hashes, commands, checkpoints, manifests, and normalized results.

The Docker executable can be selected explicitly with `--docker-bin PATH`.
An actual run fails if required binaries are unavailable. `--validate`,
`--sweep`, and `--dry-run` remain usable without solver binaries.

## Sweep and symmetry rule

`--sweep` expands the finite angle, mesh-size, and current lists in the case.
The default case declares no exact symmetry, so every requested full 3D angle
is retained. The generator only canonicalizes angles and removes equivalent
entries when `sweep.symmetry.declared` is `true`, the order is an integer at
least 2, and a non-empty exactness justification is present. A visual or
engineering guess is not treated as an exact symmetry declaration.

## Result and checkpoint behavior

The runner hashes the case, geometry, GetDP problem, excitation map/selector,
mesh-audit implementation, schemas, environment, and run parameters with
SHA-256. A job is stored under a hash-named directory beneath
`runs/`. Its checkpoint records the completed phases, the shared model input
hash, the parameter-point job input hash, and exact mesh, audit-report,
solver-output, and normalized-result hashes. `--resume` does not trust a manifest's `complete`
status: it revalidates the content-addressed result path, checkpoint identity,
all phase statuses, every artifact hash, normalized parameters, and both
provenance hashes. A mismatch reruns the invalid phase and its dependents.
Before a mesh or solve attempt, the runner removes that phase's prior outputs,
so a successful process that produces nothing cannot satisfy the checkpoint
with stale files. Results are normalized only from files produced by GetDP in
a completed runner job, with output hashes recorded by that job, or from an
explicitly supplied raw solver JSON document carrying matching parameters and
provenance.
The runner never invents FEM values.

Each normalized job result uses `contract: "edwin-gray-browser-result"` and
`contractVersion: 1`, and carries one `motor-fem-lut-v1` entry. The explicit
aggregation command combines those job documents into one multi-angle LUT. A
browser can reject an unknown contract version instead of guessing at field
meanings. The browser-facing production LUT remains absent. A separate
three-class calibration pack is published for explicit opt-in with status
`limited-not-validated`; it is not the complete converged production sweep
required by `convergence/convergence-spec-v2.json`. See `evidence/v2/`.

## Pinned solver image

`container/Dockerfile` pins the Debian base digest, Debian snapshot, and Gmsh
package. Debian's GetDP package cannot read MSH 4.1 because it lacks Gmsh
support, so the image installs the official GetDP 3.5.0 Linux binary from a
URL protected by an explicit SHA-256 checksum. This preserves the audited MSH
4.1 mesh instead of converting or bypassing it.

Run the runner integrity integration tests with deterministic local solver
stubs:

```sh
node --test scripts/run.integrity.test.mjs
```

## Solver limitations

The GetDP file is intentionally conservative and clearly limited:

- It is a linear, isotropic, magnetostatic vector-potential solve.
- The core uses a configurable constant relative permeability; saturation,
  hysteresis, lamination loss, conductivity, and eddy currents are absent.
- The source is a closed-surface homogenized equivalent current potential in
  the coil regions, with `J = curl(T)` distributionally. Individual winding
  conductors, commutator contacts, spark gaps, and capacitor charging are not
  resolved.
- Rotor motion, torque, force, mechanical load, air flow, arc physics, EMI,
  thermal effects, and energy recovery are not solved.
- The reported inductance is the linear magnetic-energy proxy
  `2 W / I^2`, not a transient or measured motor inductance.
- No extraordinary, radiant-event, or non-Maxwell force term is present.
- Rotor tangential widths and coil margin are explicit assumptions distinct
  from the stator dimensions. This removes the former overlapping rotor
  major/minor envelopes at the geometric source.

The GetDP syntax is based on the documented 3D `Hcurl` vector-potential
 formulation. Because GetDP and Gmsh are optional external executables and are
not included by this workspace, a host run requires compatible versions to be
provided explicitly or found on `PATH`. A successful GetDP solve is not a
convergence result; mesh refinement, outer-domain convergence, current
linearity, periodicity, and torque-derivative gates still require a complete
production evidence set.
