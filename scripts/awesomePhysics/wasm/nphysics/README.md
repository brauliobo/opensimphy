# nphysics2d WASM Pilot

This directory owns a narrow, headless nphysics2d proof artifact. It is not a
general nphysics port and it does not promote the scratch 3D build. The ABI
creates one static ground cuboid and one dynamic ball, then exposes a bounded
snapshot and step surface to the OpenSimPhy module worker.

## Pins and scope

- Source checkout: `awesome-physics-repos/nphysics`
- Full source revision: `65aa85c5470a5da85e0c13652ce58400ae2e2201`
- Rust and Cargo: `1.87.0`
- Target: `wasm32-unknown-unknown`
- wasm-bindgen CLI: `0.2.127`
- Cargo parallelism: `4` jobs maximum
- WASM linker memory maximum: `134217728` bytes (128 MiB)
- Cargo mode: release, `--locked`, `debug=true`, LTO, one codegen unit
- Scope: `nphysics2d` only, with `use-wasm-bindgen`; no testbed, `kiss3d`,
  `stdweb`, nphysics3d, 3D artifact, remote package, or CDN fallback

The build script refuses a dirty or differently pinned source checkout, a
missing toolchain target, a non-empty output directory, ABI or lockfile drift,
and any artifact size or SHA-256 drift. It stages the ABI and Cargo manifest
under the requested output directory and never writes to the pinned checkout.

## Reproduction

Run from the OpenSimPhy repository with an empty directory outside both the
repository and the source checkout:

```sh
node scripts/awesomePhysics/wasm/nphysics/build.mjs \
  --source <clean pinned nphysics checkout> \
  --output <empty out-of-tree directory>
```

The script builds the ABI with the pinned Cargo lock, runs wasm-bindgen, emits
`generated/nphysics2d_worker_probe.js` and
`generated/nphysics2d_worker_probe.wasm`, imports the generated companion with
the verified module in a Node smoke check, and verifies the exact outputs:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `nphysics2d_worker_probe.wasm` | `367036` | `ac0450e94ecf9a6f56e3b097734af646e8ba298dab77a3ad285a88f5726047e1` |
| `nphysics2d_worker_probe.js` | `12916` | `364889e36d2218a7da8fcd55e1c4c97b227ceb68b4dfcf840b1d934c6b96bc26` |

The generated JavaScript retains wasm-bindgen's default adjacent `_bg.wasm`
URL for compatibility with the upstream generator, but the OpenSimPhy adapter
never uses that URL. It imports the verified companion from a temporary Blob
URL inside the existing module worker and calls `initSync` with the separately
verified `WebAssembly.Module`.

## ABI and limits

`World2d.snapshot()` returns `[x, y, angle, cumulative_steps]` as a copied
`Float32Array`. `World2d.step(steps)` returns the ball Y coordinate. The ABI
rejects more than `600` steps per call or more than `6000` cumulative steps.
The TypeScript adapter validates the same schema before loading either local
artifact and converts every result to plain JSON-safe numbers.

The published pair is available only at
`public/wasm/awesomePhysics/nphysics/`. The public descriptor is explicitly
2D-only and the plan route remains `wasm`; the scratch 3D hashes are not a
runtime claim.

## Evidence and notices

- `abi/src/lib.rs` is the pinned ABI source; its SHA-256 is recorded in
  `build-ledger.json`.
- `abi/Cargo.toml` and `abi/Cargo.lock` define the locked direct build.
- `build-ledger.json` records the source, toolchain, ABI, output, and checks.
- `NOTICE.md` retains the source license and complete reviewed direct/transitive
  license inventory. Preserve the matching public notice with both files.
- The source is legacy and superseded by Rapier. A finite fixture result is not
  validation of a physical theory, model, or experimental result.
