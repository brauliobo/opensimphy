# PositionBasedDynamics Headless WASM Notices

Preserve this notice with the raw WebAssembly module. License evidence below
was reviewed against the pinned source checkout and toolchain; no dependency
source checkout is modified by the build.

## PositionBasedDynamics

PositionBasedDynamics is distributed under the MIT License.

Copyright (c) 2015-present, PositionBasedDynamics contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Evidence: `awesome-physics-repos/PositionBasedDynamics/LICENSE` at source
revision `beafc921e21553515b4f406258e5b16054a45268`.

## Eigen 3.4.0

The module uses the vendored Eigen headers under
`awesome-physics-repos/PositionBasedDynamics/extern/eigen`. Eigen is primarily
licensed under the Mozilla Public License 2.0. The build defines
`EIGEN_MPL2_ONLY`, so Eigen code marked LGPL is excluded. Preserve the Eigen
`COPYING.MPL2`, `COPYING.README`, `COPYING.BSD`, and `COPYING.MINPACK` notices
from that vendored directory when redistributing corresponding source.

## Emscripten and musl

The build toolchain is Emscripten `6.0.6-git` revision
`ce75e06884093bcefb86a6b8fd56a5d62a4cc245`. Emscripten is available under the
MIT and University of Illinois/NCSA Open Source licenses. Its bundled musl
libc is MIT-licensed. Evidence is the pinned toolchain `LICENSE` and
`system/lib/libc/musl/COPYRIGHT`. The artifact is raw standalone WASM and does
not redistribute Emscripten's JavaScript runtime.

## Excluded dependencies

This proof build does not configure or link Discregrid, GenericParameters,
GLFW, ImGui, GUI demos, or Python bindings. Their notices are therefore not
part of this artifact's dependency set.
