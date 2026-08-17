# Cantera Headless WASM Notices

Preserve this notice with the Cantera WASM module and JavaScript companion.
This artifact is a bounded thermo / HP-equilibrium / zero-D reactor proof from
the pinned Cantera C++ sources. It is not the Pyodide wheel, not a 1-D flame,
and not a general Cantera redistribution of every data file.

A finite fixture result is not a validation of a physical theory, model, or
experimental result.

## Cantera

Cantera is BSD-3-Clause with required government notices. The pinned checkout
license (`awesome-physics-repos/cantera/License.txt`) is retained in full:

```
Copyright (c) 2001-2009, California Institute of Technology
All rights reserved.

Copyright (c) 2009 Sandia Corporation. Under the terms of
Contract AC04-94AL85000 with Sandia Corporation, the U.S. Government
retains certain rights in this software.

Copyright (c) 2011-2026, Cantera Developers.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

- Redistributions of source code must retain the above copyright
  notice, this list of conditions and the following disclaimer.

- Redistributions in binary form must reproduce the above copyright
  notice, this list of conditions and the following disclaimer in the
  documentation and/or other materials provided with the distribution.

- Neither the name of the California Institute of Technology, Sandia
  Corporation nor the names of other  contributors may be used to
  endorse or promote products derived from this software without
  specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## Selected mechanism data

`h2o2.yaml` is the Hydrogen-Oxygen submechanism extracted from GRI-Mech 3.0
and shipped by Cantera for illustration. Cite GRI-Mech 3.0 (Smith, Golden,
Frenklach, Moriarty, Eiteneer, Goldenberg, Bowman, Hanson, Song, Gardiner,
Lissianski, and Qin) when this mechanism is used. Cantera's data README
states that bundled input files are for illustration; this adapter packages
only that selected YAML, not `gri30.yaml` or other data files.

## Third-party libraries linked into the WASM module

- Eigen 3.4.0: MPL-2.0. Source is not modified. Retain MPL notices with any
  further distribution of the linked module.
- yaml-cpp 0.8.0: MIT.
- fmt 11.2.0: MIT.
- SUNDIALS 7.4.0 (CVODES/IDAS subset): BSD-3-Clause, Lawrence Livermore
  National Security, LLC.
- Boost headers (algorithm, version): Boost Software License 1.0. Boost.DLL
  is not linked; a WASM stub replaces the Python-extension loader.
- Emscripten/LLVM 6.0.6-git revision `ce75e06884093bcefb86a6b8fd56a5d62a4cc245`:
  MIT/University of Illinois Open Source License, plus third-party notices
  in the Emscripten tree.

`element-standard-entropies.yaml` is Cantera's NIST-JANAF / USGS element
entropy table (Chase 1998; Robie & Hemingway 1995/1979; Guillaumont et al.
2003). It is embedded so the zero-D reactor does not load host files.
