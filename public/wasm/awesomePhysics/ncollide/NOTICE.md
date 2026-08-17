# ncollide2d Headless WASM Notices

Preserve this notice with the raw `ncollide2d.wasm` module. The public copy is
`public/wasm/awesomePhysics/ncollide/NOTICE.md`.

## Source and selected code

The headless ABI is an OpenSimPhy build boundary over the `ncollide2d` crate at
source revision `f3c3ecb3c98d1c2698574372b6b0e9d0032bc0c5`:

- Source checkout: `awesome-physics-repos/ncollide`
- Source license: Apache License 2.0, copyright Sébastien Crozet
- Selected crate: `build/ncollide2d`, version `0.33.0`, Apache-2.0
- Linear algebra dependency: `nalgebra` `0.30.1`, BSD-3-Clause
- ABI source: `scripts/awesomePhysics/wasm/ncollide/abi/src/lib.rs`

The ABI adds no cargo-web testbed, renderer, or ncollide3d artifact. It exposes
ball/cuboid distance and contact, a downward ray TOI, ball-ball translational
TOI, and one bounded CCD plane-settling step. Linear memory is capped at
64 MiB. Steps above 600 are rejected.

## Apache License 2.0

Licensed under the Apache License, Version 2.0. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0. Unless required by
applicable law or agreed to in writing, software distributed under the License
is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.

Evidence: `awesome-physics-repos/ncollide/LICENSE` at the pinned revision.

## Complete reviewed dependency inventory

Direct and transitive crates from the verified Cargo.lock/license review:

| Crate | Version | License |
| --- | --- | --- |
| approx | 0.5.1 | Apache-2.0 |
| autocfg | 1.5.1 | Apache-2.0 OR MIT |
| bitflags | 1.3.2 | MIT/Apache-2.0 |
| bytemuck | 1.25.2 | Zlib OR Apache-2.0 OR MIT |
| downcast-rs | 1.2.1 | MIT/Apache-2.0 |
| either | 1.17.0 | MIT OR Apache-2.0 |
| equivalent | 1.0.2 | Apache-2.0 OR MIT |
| fixedbitset | 0.4.2 | MIT/Apache-2.0 |
| hashbrown | 0.17.1 | MIT OR Apache-2.0 |
| indexmap | 2.14.0 | Apache-2.0 OR MIT |
| matrixmultiply | 0.3.11 | MIT/Apache-2.0 |
| nalgebra | 0.30.1 | BSD-3-Clause |
| nalgebra-macros | 0.1.0 | Apache-2.0 |
| ncollide2d | 0.33.0 | Apache-2.0 |
| num-complex | 0.4.6 | MIT OR Apache-2.0 |
| num-integer | 0.1.47 | MIT OR Apache-2.0 |
| num-rational | 0.4.2 | MIT OR Apache-2.0 |
| num-traits | 0.2.19 | MIT OR Apache-2.0 |
| paste | 1.0.15 | MIT OR Apache-2.0 |
| petgraph | 0.6.5 | MIT OR Apache-2.0 |
| proc-macro2 | 1.0.107 | MIT OR Apache-2.0 |
| quote | 1.0.47 | MIT OR Apache-2.0 |
| rawpointer | 0.2.1 | MIT/Apache-2.0 |
| safe_arch | 0.7.4 | Zlib OR Apache-2.0 OR MIT |
| simba | 0.7.3 | Apache-2.0 |
| slab | 0.4.12 | MIT |
| slotmap | 1.1.1 | Zlib |
| smallvec | 1.15.2 | MIT OR Apache-2.0 |
| syn | 1.0.109 | MIT OR Apache-2.0 |
| typenum | 1.20.1 | MIT OR Apache-2.0 |
| unicode-ident | 1.0.24 | (MIT OR Apache-2.0) AND Unicode-3.0 |
| version_check | 0.9.5 | MIT/Apache-2.0 |
| wide | 0.7.33 | Zlib OR Apache-2.0 OR MIT |

`ncollide2d` is Apache-2.0; `nalgebra` is BSD-3-Clause; `slotmap` is Zlib.
Retain this inventory with any redistributed module. The optional 3D crate,
obsolete cargo-web testbed, and successor Rapier/parry ecosystem are outside
this artifact.
