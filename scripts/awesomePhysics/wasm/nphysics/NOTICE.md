# nphysics2d WASM Pilot Notices

Preserve this notice with the generated JavaScript companion and WebAssembly
module. The public copy is
`public/wasm/awesomePhysics/nphysics/NOTICE.md`.

## Source and selected code

The headless ABI is an OpenSimPhy build boundary over the `nphysics2d` crate at
source revision `65aa85c5470a5da85e0c13652ce58400ae2e2201`:

- Source checkout: `awesome-physics-repos/nphysics`
- Source license: Apache License 2.0, copyright 2020 Sebastien Crozet
- Selected crate: `build/nphysics2d`, version `0.23.0`, Apache-2.0
- Collision dependency: `ncollide2d` `0.31.0`, Apache-2.0
- Linear algebra dependency: `nalgebra` `0.28.0`, BSD-3-Clause
- ABI source: `scripts/awesomePhysics/wasm/nphysics/abi/src/lib.rs`

The ABI adds no testbed renderer, browser UI, `kiss3d`, `stdweb`, nphysics3d,
or 3D artifact. The module contains one ground cuboid and one dynamic ball and
is bounded to 600 steps per call and 6000 cumulative steps.

## Complete reviewed dependency inventory

The following inventory is retained from the verified Cargo.lock/license
review. Direct and transitive crates are included even when their license is a
permissive dual license:

| Crate | Version | License |
| --- | --- | --- |
| approx | 0.5.1 | Apache-2.0 |
| autocfg | 1.5.1 | Apache-2.0 OR MIT |
| bitflags | 1.3.2 | MIT/Apache-2.0 |
| bumpalo | 3.20.3 | MIT OR Apache-2.0 |
| cfg-if | 1.0.4 | MIT OR Apache-2.0 |
| downcast-rs | 1.2.1 | MIT/Apache-2.0 |
| either | 1.17.0 | MIT OR Apache-2.0 |
| fixedbitset | 0.2.0 | MIT/Apache-2.0 |
| futures-core | 0.3.34 | MIT OR Apache-2.0 |
| futures-task | 0.3.34 | MIT OR Apache-2.0 |
| futures-util | 0.3.34 | MIT OR Apache-2.0 |
| generational-arena | 0.2.9 | MPL-2.0 |
| hashbrown | 0.12.3 | MIT OR Apache-2.0 |
| indexmap | 1.9.3 | Apache-2.0 OR MIT |
| instant | 0.1.13 | BSD-3-Clause |
| js-sys | 0.3.104 | MIT OR Apache-2.0 |
| lazy_static | 1.5.0 | MIT OR Apache-2.0 |
| matrixmultiply | 0.3.11 | MIT/Apache-2.0 |
| nalgebra | 0.28.0 | BSD-3-Clause |
| nalgebra-macros | 0.1.0 | Apache-2.0 |
| ncollide2d | 0.31.0 | Apache-2.0 |
| nphysics2d | 0.23.0 | Apache-2.0 |
| num-complex | 0.4.6 | MIT OR Apache-2.0 |
| num-integer | 0.1.47 | MIT OR Apache-2.0 |
| num-rational | 0.4.2 | MIT OR Apache-2.0 |
| num-traits | 0.2.19 | MIT OR Apache-2.0 |
| once_cell | 1.21.4 | MIT OR Apache-2.0 |
| paste | 1.0.15 | MIT OR Apache-2.0 |
| petgraph | 0.5.1 | MIT/Apache-2.0 |
| pin-project-lite | 0.2.17 | Apache-2.0 OR MIT |
| proc-macro2 | 1.0.107 | MIT OR Apache-2.0 |
| quote | 1.0.47 | MIT OR Apache-2.0 |
| rawpointer | 0.2.1 | MIT/Apache-2.0 |
| rustversion | 1.0.23 | MIT OR Apache-2.0 |
| simba | 0.5.1 | Apache-2.0 |
| slab | 0.4.12 | MIT |
| slotmap | 1.1.1 | Zlib |
| smallvec | 1.15.2 | MIT OR Apache-2.0 |
| syn | 1.0.109 | MIT OR Apache-2.0 |
| syn | 2.0.119 | MIT OR Apache-2.0 |
| typenum | 1.20.1 | MIT OR Apache-2.0 |
| unicode-ident | 1.0.24 | (MIT OR Apache-2.0) AND Unicode-3.0 |
| version_check | 0.9.5 | MIT/Apache-2.0 |
| wasm-bindgen | 0.2.127 | MIT OR Apache-2.0 |
| wasm-bindgen-macro | 0.2.127 | MIT OR Apache-2.0 |
| wasm-bindgen-macro-support | 0.2.127 | MIT OR Apache-2.0 |
| wasm-bindgen-shared | 0.2.127 | MIT OR Apache-2.0 |
| web-sys | 0.3.104 | MIT OR Apache-2.0 |

`nphysics2d` and `ncollide2d` are Apache-2.0; `nalgebra` is BSD-3-Clause;
`generational-arena` is MPL-2.0; and `slotmap` is Zlib. The remaining entries
are the MIT/Apache-2.0, BSD-3-Clause, or Unicode-3.0 terms shown above. The
complete source Apache-2.0 text is retained by the pinned source checkout at
`awesome-physics-repos/nphysics/LICENSE`; the required notice and attribution
are preserved here for this redistributed object-form artifact.

## Toolchain and provenance

- Rust/Cargo `1.87.0`
- wasm-bindgen CLI `0.2.127`
- Target `wasm32-unknown-unknown`
- Build uses `--locked` and at most four Cargo jobs
- Artifact evidence: `scripts/awesomePhysics/wasm/nphysics/build-ledger.json`

This legacy source is passively maintained and superseded by Rapier. The
artifact is an upstream numerical evaluation path and does not establish or
claim validation of a physical theory, model, or experimental result.
