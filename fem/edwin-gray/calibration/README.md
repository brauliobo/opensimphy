# Limited FEM calibration pack

This directory defines an opt-in, non-production calibration path. The completed
limited run solved exactly
event classes 0, 1, and 2 at `0.025 m` and `10 A`, serially, with the pinned
direct MUMPS publication profile, 24 GiB, two CPUs, one Gmsh mesh thread, two
GetDP solver threads, and a 1,720 second hard wall deadline. The output is always
`motor-fem-calibration-pack-v1.json`; this path cannot write
`motor-fem-lut-v1.json`.

The pack status is `limited-not-validated`. It does not establish full mesh,
domain, torque-derivative, or production convergence. The measured class-0
coarse/fine drift is transferred as an assumption to classes 1 and 2. The
bounded uncertainty scope is only inductance (`L`), magnetic energy (`W`), and
coenergy (`W'`); torque remains unbounded.

The completed pack is published at
`public/data/generated/edwin-gray/motor-fem-calibration-pack-v1.json`; its
SHA-256 is `3e4594defcb5414c023aa423226f6e35957e840dd9a5dcdf8fa2f63bb1dc5e48`.
Compact class 0/1/2 checkpoints, results, solver metadata, logs, wrapper inputs,
scalar tables, checksums, and the retention manifest are under
`fem/edwin-gray/evidence/v2/`. The original large ignored run artifacts were
verified by the builder before cleanup and are not required by the browser.

Inspect event 0/9 artifacts in a still-present study work tree without running a
solver:

```sh
node fem/edwin-gray/calibration/run-calibration-pack.mjs \
  --existing-only true \
  --work-dir fem/edwin-gray/runs/study-v2 \
  --out /tmp/calibration-blocked-inventory-v1.json
```

Plan a new serial reproduction without executing it:

```sh
node fem/edwin-gray/calibration/run-calibration-pack.mjs \
  --plan true \
  --docker-image IMAGE@sha256:DIGEST \
  --pilot-report fem/edwin-gray/runs/study-v2/pilot-report.json \
  --work-dir /tmp/edwin-gray-calibration \
  --out /tmp/edwin-gray-calibration/motor-fem-calibration-pack-v1.json \
  --solver-profile direct-mumps-publication-v1 \
  --memory-gib 24 --cpus 2 --mesh-threads 1 --threads 2 \
  --hard-timeout-seconds 1720
```

Remove `--plan true` to execute or resume three new jobs. The runner rejects
different resource or deadline arguments and writes the pack only after all
three checkpoints and their artifacts pass the builder. `--mesh-threads 1`
pins Gmsh meshing independently; `--threads 2` applies only to GetDP.
