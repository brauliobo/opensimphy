# Spirit Headless LLG WASM Notices

Preserve this notice with the raw WebAssembly module. License evidence below
was reviewed against the pinned Spirit checkout and toolchain. The module does
not link Spirit's ui-web, ImGui, VFRendering, or old Emscripten web assets.

## Spirit

Spirit is distributed under the MIT License.

Copyright (c) 2015 Gideon Müller and collaborators

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Evidence: `awesome-physics-repos/spirit/LICENSE.txt` at source revision
`e82250d3b14411c2c2fa292d143f13e3e111ad8c`. The bounded Heun LLG ABI follows
`core/include/engine/Solver_Heun.hpp`, `core/src/engine/Method_LLG.cpp`, and
`core/include/utility/Constants.hpp`. Spirit core libraries are not linked.

## Emscripten and musl

The build toolchain is Emscripten `6.0.6-git` revision
`ce75e06884093bcefb86a6b8fd56a5d62a4cc245`. Emscripten is available under the
MIT and University of Illinois/NCSA Open Source licenses. Its bundled musl
libc is MIT-licensed. The artifact is raw standalone WASM and does not
redistribute Emscripten's JavaScript runtime.

## Excluded dependencies

This proof build does not configure or link ui-web, ui-cpp, ImGui, VFRendering,
nativefiledialog, stb, nlohmann/json, Eigen, Spectra, PEGTL, OVF, fmt, Python,
or Julia bindings. Their notices are therefore not part of this artifact.
