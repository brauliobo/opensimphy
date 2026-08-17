# galpy Headless WASM Notices

Preserve this notice with the generated JavaScript companion and WebAssembly
module. The public copy is `public/wasm/awesomePhysics/galpy/NOTICE.md`.

## Source and selected code

The headless ABI is an OpenSimPhy build boundary over galpy MWPotential2014
at source revision `3762e73ef84578f4a911325d283e652eb1886625`:

- Source checkout: `awesome-physics-repos/galpy`
- Source license: BSD-3-Clause, copyright 2010 Jo Bovy
- Selected physics: `galpy/potential/mwpotentials.py` MWPotential2014
  (PowerSphericalPotentialwCutoff bulge, MiyamotoNagai disk, NFW halo)
  plus a bounded symplectic leapfrog orbit stepper
- ABI source: `scripts/awesomePhysics/wasm/galpy/galpy_abi.c`

The ABI adds no Python runtime, Pyodide, NumPy, SciPy, Astropy, Matplotlib,
action-angle machinery, or remote package/data fallback. A finite MWPotential2014
orbit is not a validation of a galactic mass model or observational result.

## galpy BSD-3-Clause

Copyright (c) 2010, Jo Bovy
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

1. Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright
notice, this list of conditions and the following disclaimer in the
documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
contributors may be used to endorse or promote products derived from
this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

Evidence: `awesome-physics-repos/galpy/LICENSE` at the pinned revision.

## Emscripten and musl

The build toolchain is Emscripten `6.0.6-git` revision
`ce75e06884093bcefb86a6b8fd56a5d62a4cc245`. Emscripten is available under the
MIT and University of Illinois/NCSA Open Source licenses. Its bundled musl
libc is MIT-licensed. The artifact is raw standalone WASM plus a tiny local
JavaScript companion and does not redistribute Emscripten's JS runtime, GSL,
or a Pyodide interpreter.
