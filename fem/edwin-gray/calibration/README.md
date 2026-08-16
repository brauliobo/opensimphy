# Limited FEM calibration pack

This directory is an opt-in, non-production calibration path. It solves exactly
event classes 0, 1, and 2 at `0.025 m` and `10 A`, serially, with the pinned
direct MUMPS publication profile, 24 GiB, two CPUs/threads, and a 1,720 second
hard wall deadline. The output is always
`motor-fem-calibration-pack-v1.json`; this path cannot write
`motor-fem-lut-v1.json`.

The pack status is `limited-not-validated`. It does not establish full mesh,
domain, torque-derivative, or production convergence. The measured class-0
coarse/fine drift is transferred as an assumption to classes 1 and 2. The
bounded uncertainty scope is only inductance (`L`), magnetic energy (`W`), and
coenergy (`W'`); torque remains unbounded.

Inspect current event 0/9 artifacts without running a solver:

```sh
node fem/edwin-gray/calibration/run-calibration-pack.mjs \
  --existing-only true \
  --work-dir fem/edwin-gray/runs/study-v2 \
  --out /tmp/calibration-blocked-inventory-v1.json
```

Plan the fresh serial run without executing it:

```sh
node fem/edwin-gray/calibration/run-calibration-pack.mjs \
  --plan true \
  --docker-image IMAGE@sha256:DIGEST \
  --pilot-report fem/edwin-gray/runs/study-v2/pilot-report.json \
  --work-dir /tmp/edwin-gray-calibration \
  --out /tmp/edwin-gray-calibration/motor-fem-calibration-pack-v1.json \
  --solver-profile direct-mumps-publication-v1 \
  --memory-gib 24 --cpus 2 --threads 2 \
  --hard-timeout-seconds 1720
```

Remove `--plan true` to execute the three fresh jobs. The runner rejects
different resource or deadline arguments and writes the pack only after all
three checkpoints and their artifacts pass the builder.
