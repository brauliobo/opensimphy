# Spirit Headless LLG WASM

This directory owns the reproducible, headless proof artifact for the pinned
Spirit checkout. The artifact is a bounded Heun LLG C ABI rather than the
`SPIRIT_BUILD_FOR_JS` ui-web module.

## Pin and scope

- Source: `awesome-physics-repos/spirit`
- Source revision: `e82250d3b14411c2c2fa292d143f13e3e111ad8c`
- Toolchain: Emscripten `6.0.6-git`, revision `ce75e06884093bcefb86a6b8fd56a5d62a4cc245`
- Toolchain CMake file SHA-256: `fdca7d6b6ebe9c087aa7f0a0c7391b0b83fdb081160158f65aa1182cdc964718`
- Build mode: release, C++11, no exceptions, RTTI, OpenMP, pthreads, UI, or filesystem

The build script rejects a dirty source checkout, a source revision mismatch,
the wrong toolchain version/revision, a toolchain file hash mismatch, a
non-empty output directory, or a module hash/size mismatch. It never writes to
the pinned checkout.

## Reproduction

Run from the repository root with an empty scratch directory:

```sh
node scripts/awesomePhysics/wasm/spirit/build.mjs \
  --source <pinned Spirit checkout> \
  --output <empty out-of-tree directory> \
  --emscripten-root <pinned Emscripten root> \
  --em-cache <pinned Emscripten cache>
```

## ABI

The raw module has no JavaScript companion and no browser-visible pointers.
Each export takes the same bounded scalars and either returns `i32` status or
an `f64` result:

- `spirit_llg_status(n, damping, dt, steps, bx, by, bz, J, sx, sy, sz)`
- `spirit_llg_mx(...)`, `spirit_llg_my(...)`, `spirit_llg_mz(...)`
- `spirit_llg_energy(...)`, `spirit_llg_time(...)`, `spirit_llg_norm(...)`

Status `1` means the Heun integrator produced finite magnetization. Status `0`
means the bounded input cannot be solved.

## Artifact

The verified module is published at
`public/wasm/awesomePhysics/spirit/spirit-llg-heun.wasm`.
