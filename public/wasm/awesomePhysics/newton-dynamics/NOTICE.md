# Newton Dynamics Headless WASM Notices

Preserve this notice with any redistributed `newton-dynamics.wasm`. The module
is a narrow headless CPU proof from newton-dynamics revision
`a9c460c3509c935e65c5b1196b955d56627c3ffa` compiled with Emscripten
`6.0.6-git` revision `ce75e06884093bcefb86a6b8fd56a5d62a4cc245`. Sandbox,
OpenGL, OpenCL, CUDA, shared libraries, and AVX2/SSE instruction paths are
excluded.

## Newton Game Dynamics 4.00 (selected CPU SDK)

The selected `dCore`, `dCollision`, and `dNewton` sources are covered by the
zlib license from the pinned checkout
(`awesome-physics-repos/newton-dynamics/newton-4.00/sdk/LICENSE`):

```text
Newton zlib license
Copyright (c) <2003-2011>
Julio Jerez and Alain Suero

This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
claim that you wrote the original software. If you use this software
in a product, an acknowledgment in the product documentation would be
appreciated but is not required.

2. Altered source versions must be plainly marked as such, and must not be
misrepresented as being the original software.

3. This notice may not be removed or altered from any source distribution.
```

## tinyxml

The selected `dCore/tinyxml` sources are covered by the zlib license in
`awesome-physics-repos/newton-dynamics/newton-4.00/sdk/dCore/tinyxml/tinyxml.h`:

```text
www.sourceforge.net/projects/tinyxml
Original code (2.0 and earlier) copyright (c) 2000-2006 Lee Thomason
(www.grinninglizard.com)

This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any
damages arising from the use of this software.

Permission is granted to anyone to use this software for any
purpose, including commercial applications, and to alter it and
redistribute it freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must
not claim that you wrote the original software. If you use this
software in a product, an acknowledgment in the product documentation
would be appreciated but is not required.

2. Altered source versions must be plainly marked as such, and
must not be misrepresented as being the original software.

3. This notice may not be removed or altered from any source
distribution.
```

## VHACD

`ndMesh.cpp` links the bundled VHACD library from
`awesome-physics-repos/newton-dynamics/newton-4.00/sdk/dDependencies/hacd`.
The selected binary therefore retains this BSD-3-Clause notice from
`sdk/dDependencies/hacd/LICENSE`:

```text
BSD 3-Clause License

Copyright (c) 2011, Khaled Mamou (kmamou at gmail dot com)
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.
```

## Emscripten and LLVM

The module is compiled with the pinned Emscripten distribution. Emscripten is
MIT-licensed; generated LLVM, libc++, libc++abi, and compiler-rt components
carry their respective notices. The toolchain is not redistributed in this
directory.

This artifact is an upstream library evaluation path. A finite fixture result
does not establish or claim validation of a physical theory, model, or
experimental result.
