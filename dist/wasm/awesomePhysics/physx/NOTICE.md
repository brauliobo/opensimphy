# PhysX-3.4 Headless WASM Notices

Preserve this notice with any redistributed `physx-3-4.wasm`. The module is a
narrow headless CPU proof from PhysX 3.4 revision
`5e42a5f112351a223c19c17bb331e6c55037b8eb` compiled with Emscripten
`6.0.6-git` revision `ce75e06884093bcefb86a6b8fd56a5d62a4cc245`. APEX, GPU,
samples, cooking, vehicle, character, cloth, particles, and PVD are excluded.

## NVIDIA PhysX SDK 3.4 (selected CPU subset)

The selected sources are covered by the NVIDIA BSD-style license from the
pinned checkout (`awesome-physics-repos/PhysX-3.4/README.md`):

```text
Copyright (c) 2018 NVIDIA Corporation. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:
 * Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.
 * Neither the name of NVIDIA CORPORATION nor the names of its
   contributors may be used to endorse or promote products derived
   from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ``AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR
CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

Selected source headers such as
`PxShared/include/foundation/PxPreprocessor.h` also retain
`Copyright (c) 2008-2018 NVIDIA Corporation`,
`Copyright (c) 2004-2008 AGEIA Technologies, Inc.`, and
`Copyright (c) 2001-2004 NovodeX AG`.

Selected libraries: PxFoundation, PxTask, PhysXCommon/GeomUtils, LowLevel,
LowLevelAABB, LowLevelDynamics, SimulationController, SceneQuery, PhysX, and
the headless PhysXExtensions factory/dispatcher/filter/rigid-body units.

## Excluded depot notices

The root README lists additional third-party names (FreeImage, GLEW, ASSIMP,
clang, glut, and others) that belong to APEX, samples, or tooling. Those
components are not compiled or linked into this module and are not
redistributed here.

## Emscripten and LLVM

The module is compiled with the pinned Emscripten distribution. Emscripten is
MIT-licensed; generated LLVM, libc++, libc++abi, and compiler-rt components
carry their respective notices. The toolchain is not redistributed in this
directory.

This artifact is an upstream library evaluation path. A finite fixture result
does not establish or claim validation of a physical theory, model, or
experimental result.
