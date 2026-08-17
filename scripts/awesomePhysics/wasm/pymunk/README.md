# pymunk Headless Chipmunk WASM Pilot

This directory owns a narrow, headless Chipmunk proof artifact for the pymunk
catalog item. It is the small direct TypeScript/WASM adapter compared against
the upstream Pyodide wheel path. It does not ship pygame, drawing utilities,
threaded spaces, or a Pyodide runtime.

## Pins and scope

- Pymunk checkout: `awesome-physics-repos/pymunk`
- Full source revision: `6287ce6d9223d1d79d28b2c26f37499f45b445b8`
- Munk2D/Chipmunk gitlink: `47b0e6b200c1aedb7b9ee09a998a2ef0bbad8f82`
- Emscripten: `6.0.6-git` revision `ce75e06884093bcefb86a6b8fd56a5d62a4cc245`
- WASM memory maximum: `134217728` bytes (128 MiB)
- Compile virtual-memory cap: `4` GiB
- Compile parallelism: Emscripten default under `nice`; no pthreads
- Path remap: `-ffile-prefix-map` for source, output, and OpenSimPhy roots; artifacts must not embed `/home/braulio` or `/tmp/opencode`
- Scope: one static ground segment and one dynamic ball; snapshot/step only

The pinned pymunk checkout is not modified. Munk2D is cloned into the empty
out-of-tree output directory at the gitlink revision because the shallow
checkout does not materialize the submodule.

## Reproduction

Run from the OpenSimPhy repository with an empty directory under `.wasm-build`:

```sh
node scripts/awesomePhysics/wasm/pymunk/build.mjs \
  --source <clean pinned pymunk checkout> \
  --output <empty .wasm-build/pymunk directory> \
  --install
```

The script fails before promotion when the checkout, Munk2D pin, toolchain,
ABI smoke, byte size, SHA-256, or host-path scan differs.

## Expected artifact

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `pymunk.wasm` | `76555` | `0166b68c54e17b3892ca675749afdc065806e8df5636fc55e89d8d4badb67158` |

## ABI and limits

`pymunk_version()` returns `730`. `pymunk_step(steps)` creates a Chipmunk
space with gravity `(0, -9.81)`, a static ground segment, and a ball of radius
`0.5` at `(0, 2)`, steps `1/60` s, and returns the ball Y coordinate.
`pymunk_x()` and `pymunk_angle()` return the last simulated pose.
`pymunk_steps()` returns the last accepted step count. More than `600` steps
per call returns NaN.

The TypeScript adapter validates the same schema before loading the local
artifact and converts every result to plain JSON-safe numbers.
