# galpy Headless WASM

This directory owns the reproducible, headless proof artifact for the pinned
galpy checkout. The artifact is a narrow MWPotential2014 / leapfrog-orbit ABI
rather than a Pyodide wheel of the full Python package.

## Pin and scope

- Source: `awesome-physics-repos/galpy`
- Source revision: `3762e73ef84578f4a911325d283e652eb1886625`
- Toolchain: Emscripten `6.0.6-git`, revision `ce75e06884093bcefb86a6b8fd56a5d62a4cc245`
- Build mode: release, standalone WASM, no filesystem, no pthreads, no malloc

The build script rejects a dirty source checkout, a source revision mismatch,
the wrong toolchain version/revision, a non-empty output directory, or a
module hash/size drift. It never writes to the pinned checkout.

## Reproduction

Run from the repository root with an empty scratch directory:

```sh
node scripts/awesomePhysics/wasm/galpy/build.mjs \
  --source <pinned galpy checkout> \
  --output <empty out-of-tree directory> \
  --emscripten-root <pinned Emscripten root>
```

The command writes verified `galpy.wasm` and copies the pinned companion
`galpy.js`. Only those two files plus `NOTICE.md` belong in
`public/wasm/awesomePhysics/galpy/`.

## ABI

The raw module has no imports. All calls use finite scalar arguments:

- `galpy_orbit_init(R, z, phi, vR, vT, vz)`
- `galpy_orbit_step(dt)`
- `galpy_orbit_R`, `galpy_orbit_z`, `galpy_orbit_phi`, `galpy_orbit_vR`, `galpy_orbit_vT`, `galpy_orbit_vz`
- `galpy_orbit_energy`, `galpy_orbit_Lz`
- `galpy_circular_velocity(R)`, `galpy_rforce(R, z)`, `galpy_zforce(R, z)`

Status `1` means the bounded input was accepted. Status `0` means rejection.
`galpy_circular_velocity(1)` is 1 in MWPotential2014 natural units.

## Notices

Redistribute `NOTICE.md` with the module. The notice records the galpy
BSD-3-Clause license and the selected Emscripten/musl notices.
