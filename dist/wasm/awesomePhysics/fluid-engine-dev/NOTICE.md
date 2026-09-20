# fluid-engine-dev reduced 2D SPH WASM Notices

Preserve this notice with the raw `fluid-engine-dev.wasm` module. The public
copy is `public/wasm/awesomePhysics/fluid-engine-dev/NOTICE.md`.

## Source and selected code

The headless ABI is an OpenSimPhy build boundary over Jet at source revision
`94c300ff5ad8a2f588e5e27e8e9746a424b29863`:

- Source checkout: `awesome-physics-repos/fluid-engine-dev`
- Source license: MIT, copyright Doyub Kim
- Selected units: 2D SPH solver, particle system, physics animation, serial
  parallel helpers, and neighbor search. 3D factory/grid sources, gtest,
  pybind11, examples, and resource unpacking are not linked.
- In-tree FlatBuffers headers used by particle serialization: Apache-2.0
- ABI source: `scripts/awesomePhysics/wasm/fluid-engine-dev/jet_sph2_abi.cpp`

Linear memory is capped at 128 MiB. Steps above 600 are rejected.

## MIT License

Copyright (c) 2018 Doyub Kim

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

Evidence: `awesome-physics-repos/fluid-engine-dev/LICENSE.md` at the pinned
revision.

## Apache License 2.0 (in-tree FlatBuffers)

The selected SPH path includes generated FlatBuffers headers under
`src/jet/generated` and `src/jet/3rdparty/flatbuffers`. Those headers are
Apache-2.0, copyright Google Inc. See
`awesome-physics-repos/fluid-engine-dev/3RD_PARTY.md`.
