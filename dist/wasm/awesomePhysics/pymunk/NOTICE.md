# pymunk Headless Chipmunk WASM Notices

Preserve this notice with `pymunk.wasm`. The source-side build notice is
retained at `scripts/awesomePhysics/wasm/pymunk/NOTICE.md`.

This is a narrow headless Chipmunk space built from
`awesome-physics-repos/pymunk` revision
`6287ce6d9223d1d79d28b2c26f37499f45b445b8` and the pinned Munk2D/Chipmunk
gitlink `47b0e6b200c1aedb7b9ee09a998a2ef0bbad8f82`. Drawing utilities, pygame,
desktop examples, threaded spaces, and the Pyodide wheel are outside this
artifact. A finite fixture result is not validation of a physical theory,
model, or experimental result.

## Pymunk

Pymunk is distributed under the MIT License.

Copyright (c) 2007-2025 Victor Blomqvist

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

Evidence: `awesome-physics-repos/pymunk/LICENSE.txt`.

## Chipmunk / Munk2D

The linked 2D solver is Chipmunk Physics as vendored by Munk2D at gitlink
`47b0e6b200c1aedb7b9ee09a998a2ef0bbad8f82`, distributed under the MIT License:

Copyright (c) 2025 Victor Blomqvist
Copyright (c) 2007-2024 Scott Lembcke and Howling Moon Software

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Evidence: Munk2D `LICENSE.txt` at the pinned gitlink. Pymunk attribution for
Chipmunk is also recorded in `awesome-physics-repos/pymunk/THANKS.txt`.

## cffi

cffi is a Pymunk build dependency for the Python extension. This headless
artifact does not redistribute cffi; it links Chipmunk C directly.

## Emscripten and musl

The build toolchain is Emscripten `6.0.6-git` revision
`ce75e06884093bcefb86a6b8fd56a5d62a4cc245`. Emscripten is available under the
MIT and University of Illinois/NCSA Open Source licenses. Its bundled musl
libc is MIT-licensed. The promoted artifact is the raw `.wasm` module; the
temporary Emscripten JavaScript factory is not shipped.
