# PositionBasedDynamics Headless WASM

This directory owns the reproducible, headless proof artifact for the pinned
PositionBasedDynamics checkout. The artifact is intentionally a narrow scalar
ABI rather than a browser port of the demo application.

## Pin and scope

- Source: `awesome-physics-repos/PositionBasedDynamics`
- Source revision: `beafc921e21553515b4f406258e5b16054a45268`
- Vendored Eigen: 3.4.0 from `extern/eigen`
- Toolchain: Emscripten `6.0.6-git`, revision `ce75e06884093bcefb86a6b8fd56a5d62a4cc245`
- Toolchain CMake file SHA-256: `fdca7d6b6ebe9c087aa7f0a0c7391b0b83fdb081160158f65aa1182cdc964718`
- Build mode: release, C++11, double precision, no exceptions, RTTI, OpenMP,
  GUI, Python bindings, or pthreads

The build script rejects a dirty source checkout, a source revision mismatch,
the wrong Eigen version, a toolchain version/revision mismatch, a toolchain
file hash mismatch, a non-empty output directory, or a module hash/size
mismatch. It never writes to the pinned checkout.

## Reproduction

Run from the repository root with an empty scratch directory:

```sh
node scripts/awesomePhysics/wasm/position-based-dynamics/build.mjs \
  --source ../awesome-physics-repos/PositionBasedDynamics \
  --output /tmp/position-based-dynamics-wasm \
  --emscripten-root /usr/lib/emscripten \
  --em-cache "$HOME/.cache/emscripten"
```

The command builds an out-of-tree `libPositionBasedDynamics.a` containing the
two CPU solver translation units needed by the ABI, then links and verifies
`position-based-dynamics-headless.wasm`. The static archive is only an
intermediate link input. It is not a browser artifact and is not copied to
`public/`.

## ABI

The raw module has no JavaScript companion and no browser-visible pointers.
All calls use finite scalar arguments and return either an `i32` status or an
`f64` correction:

- `pbd_solve_distance(x0, x1, rest_length, inv_mass0, inv_mass1, stiffness)`
- `pbd_solve_distance_correction0(...)`
- `pbd_solve_distance_correction1(...)`

Status `1` means the pinned solver produced finite corrections. Status `0`
means the bounded input cannot be solved; both correction exports return zero
in that case. The TypeScript adapter validates the same bounds before loading
the module.

## Artifact

The verified module is published at
`public/wasm/awesomePhysics/position-based-dynamics/position-based-dynamics-headless.wasm`.
Its byte size and SHA-256 are recorded in `build-ledger.json`, the adapter,
and the focused engine spec. Central manifest and adapter registration remain
deferred until the shared integration updates the candidate record.

## Notices

Redistribute `NOTICE.md` with the module. The notice records the PositionBasedDynamics
MIT license, vendored Eigen licensing, the selected Emscripten/musl notices,
and the fact that this build deliberately excludes Discregrid, GLFW, ImGui,
and Python bindings. See the pinned source files listed there for the reviewed
license evidence.
