# ncollide2d Headless Collision WASM Artifact

This directory is the reproducible build path for the verified ncollide2d raw
WASM artifact. The pinned checkout is read-only. Cargo output stays in a
separate `.wasm-build` directory. Only the verified raw `.wasm` file is
promoted to `public/wasm/awesomePhysics/ncollide/`.

## Pins and scope

- ncollide checkout: revision `f3c3ecb3c98d1c2698574372b6b0e9d0032bc0c5`,
  crate `ncollide2d` `0.33.0`.
- Rust/Cargo: `1.87.0`; target `wasm32-unknown-unknown`; `--locked`;
  `--jobs 4`; `ulimit -v` 8 GiB; `-C link-arg=--max-memory=67108864`.
- Release profile: `lto=true`, `codegen-units=1`, `panic=abort`, `opt-level=s`.
- `--cap-lints=warn` is required because the pinned crate denies
  `unused_qualifications` that rustc 1.87.0 reports.

The selected ABI is collision-only:

- `ncollide_distance() -> f32` ball vs cuboid GJK distance.
- `ncollide_contact_depth() -> f32` predicted ball/cuboid contact depth.
- `ncollide_ray_toi() -> f32` downward ray vs ball.
- `ncollide_time_of_impact() -> f32` ball-ball translational TOI.
- `ncollide_step(steps) -> f32` CCD plane-settling loop; rejects `steps > 600`.

No cargo-web testbed, renderer, ncollide3d, pthreads, or shared memory.

## Reproduction

```sh
node scripts/awesomePhysics/wasm/ncollide/build.mjs \
  --source <pinned ncollide checkout> \
  --output <empty .wasm-build directory> \
  --install
```

The script fails before promotion when the checkout, toolchain, ABI hash,
Cargo.lock hash, WASM imports/exports, golden scalars, byte size, or SHA-256
differs.

## Expected artifact

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `ncollide2d.wasm` | `113119` | `57ca3a88ae50d98a93221ae161143b991f0f3e0c3c52c687348216ea2c35da6a` |

A finite collision fixture is not a validation of a physical theory. License
review is in `NOTICE.md`.
