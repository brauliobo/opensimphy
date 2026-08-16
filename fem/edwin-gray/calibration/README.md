# Limited FEM calibration pack

This directory defines a non-production calibration evidence path. The retained
limited run solved event classes 0, 1, and 2 at `0.025 m` and `10 A`, serially, with the pinned
direct MUMPS publication profile, 24 GiB, two CPUs, one Gmsh mesh thread, two
GetDP solver threads, and a 1,720 second hard wall deadline. The output is always
`motor-fem-calibration-pack-v1.json`; this path cannot write
`motor-fem-lut-v1.json`.

The corrected builder requires a pilot report whose current specification hash,
model input hash, and exact coarse/fine angle/event/current/mesh identity match
the calibration class. A compatible build is `limited-assumption-only`: it may
record an observed drift and the pilot pass criterion, but it does not emit that
criterion as an uncertainty bound. Classes 1 and 2 remain transfer assumptions,
and torque remains unbounded.

The retained pack at
`public/data/generated/edwin-gray/motor-fem-calibration-pack-v1.json` is audit
data only. Its status is `unavailable-provenance-mismatch`, its
`runtimeAvailable` flag is false, and its SHA-256 is
`be2f70fe43223444f3db8df7477b0f5a6fb059ed17fc877e04dda6264caec842`.
The retained pilot used a different model hash and specification hash and sampled
`6.6666666667 deg/event 0`, not calibration class 0 at `0 deg/event 0`. No
matching result has been fabricated.
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
three checkpoints, their artifacts, and exact pilot provenance pass the builder. `--mesh-threads 1`
pins Gmsh meshing independently; `--threads 2` applies only to GetDP.
