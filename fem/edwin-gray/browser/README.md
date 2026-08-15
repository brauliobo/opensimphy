# Browser FEM boundary

FEAScript `0.2.0` is an optional MIT-licensed browser FEM library, but its
published models are heat conduction, creeping flow, and front propagation.
It does not implement 3D magnetostatics, nonlinear B-H materials, rotating
interfaces, or circuit-coupled motor fields.

OpenSimPhy therefore does not use FEAScript as an Edwin Gray motor solver.
The authoritative path remains the offline Gmsh/GetDP workspace. A future
browser feature may use FEAScript for a small generic PDE demonstration or
mesh/result inspection, but it must not label that computation as magnetic FEM.

The TypeScript engine accepts only a complete normalized
`edwin-gray-browser-result@1` document produced by the external workspace. It
rejects pending, synthetic, incomplete, or unprovenanced entries rather than
falling back silently.

No normalized FEM LUT is bundled in this repository. The browser status remains
`not-run` until a deliberately produced LUT is added with its complete solver
checkpoint provenance.

References:

- https://www.npmjs.com/package/feascript
- https://github.com/FEAScript/FEAScript-core
- `../README.md`
- `../schema/motor-fem-lut.schema.json`
