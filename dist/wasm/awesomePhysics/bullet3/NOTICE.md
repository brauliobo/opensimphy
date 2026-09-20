# Bullet3 Headless WASM Notices

This directory contains the raw `bullet3.wasm` module built from Bullet3
revision `63c4d67e3370` with Emscripten `6.0.6-git` revision
`ce75e06884093bcefb86a6b8fd56a5d62a4cc245`. Preserve this notice with the
module. The module is a narrow headless scalar proof and is not the upstream
ExampleBrowser, OpenGL, VR, extras, tests, or multithreaded build.

## Bullet Physics Library

The linked Bullet CPU subset is covered by the following zlib license from the
pinned checkout (`awesome-physics-repos/bullet3/LICENSE.txt`):

```text
This software is provided 'as-is', without any express or implied warranty.
In no event will the authors be held liable for any damages arising from the
use of this software.
Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter and redistribute it freely,
subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not claim
   that you wrote the original software. If you use this software in a product,
   an acknowledgment in the product documentation would be appreciated but is
   not required.
2. Altered source versions must be plainly marked as such, and must not be
   misrepresented as being the original software.
3. This notice may not be removed or altered from any source distribution.
```

Bullet Physics is created by Erwin Coumans. The pinned `AUTHORS.txt` lists the
following authors and copyright holders:

```text
AMD; Apple; Yunfei Bai; Steve Baker; Gino van den Bergen; Jeff Bingham;
Nicola Candussi; Erin Catto; Lawrence Chai; Erwin Coumans; Disney Animation;
Benjamin Ellenberger; Christer Ericson; Google; Dirk Gregorius; Marcus Hennix;
Jasmine Hsu; MBSim Development Team; Takahiro Harada; Simon Hobbs; John Hsu;
Ole Kniemeyer; Jay Lee; Francisco Leon; lunkhound; Vsevolod Klementjev;
Phil Knight; John McCutchan; Steven Peters; Roman Ponomarev; Nathanael Presson;
Gabor PUHR; Arthur Shek; Russel Smith; Sony; Jakub Stephien;
Marten Svanfeldt; Jie Tan; Pierre Terdiman; Steven Thompson;
Tamas Umenhoffer.
```

## zlib 1.2.8

The pinned checkout includes the selected zlib source at
`examples/ThirdPartyLibs/zlib/zlib.h` and its notice at
`examples/ThirdPartyLibs/zlib/LICENSE.txt`. The zlib source was audited for
the Bullet third-party notice gate; no zlib object is linked into this scalar
module. The notice is reproduced here:

```text
Copyright (C) 1995-2013 Jean-loup Gailly and Mark Adler

This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.
Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
   claim that you wrote the original software. If you use this software
   in a product, an acknowledgment in the product documentation would be
   appreciated but is not required.
2. Altered source versions must be plainly marked as such, and must not be
   misrepresented as being the original software.
3. This notice may not be removed or altered from any source distribution.
```

## Emscripten and LLVM

The module was compiled with the pinned Emscripten distribution. Emscripten
is MIT-licensed; the generated LLVM, libc++, libc++abi, compiler-rt, and
related system components carry their respective LLVM project notices. The
toolchain is not redistributed in this directory. Review evidence is the
pinned toolchain `LICENSE` and `AUTHORS` files plus the license files in its
LLVM/system-library tree. The exact toolchain revision is recorded above and
in `scripts/awesomePhysics/wasm/bullet3/README.md`.

This artifact is an upstream library evaluation path. Its finite fixture result
does not establish or claim validation of a physical theory, model, or
experimental result.
