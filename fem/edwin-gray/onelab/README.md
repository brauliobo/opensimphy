# Edwin Gray ONELAB workflow

This directory is an orchestration layer for the existing illustrative Edwin
Gray FEM case. It does not contain a second geometry, a second GetDP problem,
or copied scientific defaults. `launcher.mjs` reads the authoritative values
from `../cases/patent-3890548-illustrative.json`, while `project.geo` includes
`../geometry/patent-3890548-3d.geo` and registers the existing
`../getdp/magnetostatic.pro` solve through the Gmsh ONELAB solver interface.

This is a desktop/headless Gmsh and GetDP workflow. It is not a browser solver
and does not imply that the web application performs finite-element solves.

## Validate and exchange parameters

Run commands from this directory. Validation requires Node.js but does not
require Gmsh or GetDP:

```sh
node launcher.mjs validate
node launcher.mjs export --output <temporary directory>/edwin-gray-onelab.json
node launcher.mjs validate --config <temporary directory>/edwin-gray-onelab.json
node launcher.mjs import \
  --config <temporary directory>/edwin-gray-onelab.json \
  --output <temporary directory>/edwin-gray-onelab-roundtrip.json
```

The exported JSON is deterministic. It records the authoritative case hash,
the source path for every parameter, the Gmsh/GetDP symbol, the shared ONELAB
name, and the exact JSON number. Import validates the case identity, file and
solver contract, parameter order, names, clients, symbols, and finite values,
then writes the same canonical representation. A changed case must be exported
again; stale configs are rejected by hash.

## Gmsh GUI

With `gmsh`, `getdp`, and `node` available on `PATH`:

```sh
node launcher.mjs gui --work-dir <temporary directory>/edwin-gray-onelab
```

Use the ONELAB parameter panel to inspect or edit the values exposed by the
existing Gmsh geometry and GetDP problem. Generate the 3D mesh, then run
`Edwin Gray Magnetostatics` from the solver panel. The registered client calls
the existing `Magnetostatics3D` resolution and `MagnetostaticResults`
post-operation; it does not implement a solver itself.

Explicit binaries and a previously exported config can be selected with:

```sh
node launcher.mjs gui \
  --config <temporary directory>/edwin-gray-onelab.json \
  --gmsh-bin /path/to/gmsh \
  --getdp-bin /path/to/getdp \
  --work-dir <temporary directory>/edwin-gray-onelab
```

The GUI config initializes Gmsh parameters. Interactive changes subsequently
live in the active ONELAB database; export the source case again when the
authoritative defaults change.

## Headless run

Inspect the exact Gmsh/GetDP commands without executing either tool:

```sh
node launcher.mjs headless --dry-run \
  --config <temporary directory>/edwin-gray-onelab.json \
  --work-dir <temporary directory>/edwin-gray-onelab
```

Run the same project without the GUI:

```sh
node launcher.mjs headless \
  --config <temporary directory>/edwin-gray-onelab.json \
  --work-dir <temporary directory>/edwin-gray-onelab
```

The headless path passes the shared ONELAB names to Gmsh and GetDP with
`-setnumber`, meshes the existing geometry, and invokes the existing GetDP
resolution and post-operation. It writes only to the selected work directory.
The case's documented mesh-quality limitations still apply; ONELAB does not
turn a failed or low-quality mesh into a valid FEM result.
