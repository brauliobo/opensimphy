# FEM convergence gate

`convergence-spec-v1.json` and `pilot-failure-report-v1.json` are immutable
rejected evidence. `convergence-spec-v2.json` defines the attempted production
study. It replaces disconnected axial volume currents with a closed
equivalent current potential, couples local feature resolution to each mesh
level, starts at the v1 far radius, and expands both radial and axial air bounds.
The v1 numerical tolerances are retained.

The retained v2 pilot passed its bounded checks, but the historical production
report is rejected because only 18 of its 33 required samples are present.
Compact copies are stored under `../evidence/v2/`. The current
`reduced-profile-v1.json` instead declares exactly 23 independently solved
tuples for illustrative linear numerical convergence. It is not production
eligible and cannot authorize LUT publication. No production LUT, full
production convergence result, or torque bound was published. A 2026-08-16
recheck with the pinned solver image and the 24 GiB GetDP cap left this
unchanged; see `production-lut-blocker.json`. The retained
three-class calibration values are
`unavailable-provenance-mismatch`: their pilot evidence does not match the
calibration model, current specification, or sample identity, and therefore
does not satisfy this production gate or establish an uncertainty bound.

Run the evaluator after all individual runner jobs are complete:

```sh
node fem/edwin-gray/convergence/evaluate-convergence.mjs \
  --evidence /path/to/convergence-evidence.json \
  --out /path/to/convergence-report.json
```

The evidence document has this shape:

```json
{
  "contract": "edwin-gray-convergence-evidence",
  "contractVersion": 2,
  "status": "complete",
  "caseId": "patent-3890548-illustrative",
  "samples": [
    {
      "id": "unique-stable-id",
      "domainId": "base",
      "meshLevelId": "fine",
      "driveCurrentA": 10,
      "rotorAngleDeg": 0,
      "result": "relative/job/result.json",
      "checkpoint": "relative/job/checkpoint.json"
    }
  ]
}
```

Paths are resolved relative to the evidence document. A label only selects a
required tuple. Approval additionally requires the normalized parameters to
match, the mesh radius to match the selected domain, all checkpoint artifacts
to hash correctly, and normalized values to match the hashed GetDP tables.

The outer-domain jobs require case copies with the specified air outer radius;
the source case is not modified. All jobs should use one solver environment.
The evaluator supports ASCII Gmsh 4.x meshes because it derives mesh counts and
radius from the attested mesh. Binary meshes are rejected rather than guessed.

The resulting `convergence-report.json` is deterministic: it contains no clock
or absolute-path data. A rejected report is still written and the command exits
nonzero.

To assemble evidence and evaluate only checkpoints already present in a
persistent work directory, without invoking Docker, Gmsh, or GetDP:

```sh
node fem/edwin-gray/convergence/run-study.mjs \
  --stage convergence \
  --existing-only true \
  --work-dir fem/edwin-gray/runs/study-v2
```

The existing-only path evaluates only the 23 tuples declared by the reduced
profile. Every tuple must be independently solved; absent tuples are not filled,
derived, or waived. The persisted v2 jobs use the older `fem-checkpoint-v5`
envelope, which v2 accepts explicitly; all artifact, parameter, environment,
and normalized-result checks remain mandatory. Because this path runs no
solver, it does not require `--hard-timeout-seconds`.

The integrated study runner generates domain-specific case copies, executes
exact event-attested single jobs through `scripts/run.mjs`, reuses a verified
mesh for the 1 A audit, and resumes from content-addressed checkpoints:

```sh
nice -n 10 node fem/edwin-gray/convergence/run-study.mjs \
  --stage pilot \
  --docker-image IMAGE_ID \
  --work-dir <temporary directory>/edwin-gray-study \
  --hard-timeout-seconds 1800

nice -n 10 node fem/edwin-gray/convergence/run-study.mjs \
  --stage convergence \
  --docker-image IMAGE_ID \
  --work-dir <temporary directory>/edwin-gray-study \
  --hard-timeout-seconds 7200

nice -n 10 node fem/edwin-gray/convergence/run-study.mjs \
  --stage publication \
  --docker-image IMMUTABLE_IMAGE_ID_OR_DIGEST \
  --work-dir <temporary directory>/edwin-gray-study \
  --solver-profile direct-mumps-publication-v1 \
  --memory-gib 24 \
  --cpus 2 \
  --threads 2 \
  --mesh-threads 1 \
  --hard-timeout-seconds 1800
```

The reduced profile's torque-refinement samples hold event 0 fixed. Its coarse
120-degree periodicity partners use event 9, preserving the event-specific
excitation after rotating the complete three-sector source pattern. All 23 are
independent solver tuples. The runner is intentionally serial.
Publication uses `publication-profile-v1.json`: accepted coarse mesh `0.025 m`
(measured 1,335,000 DOF), direct MUMPS (measured 19.3 GiB peak), an exact Docker
hard cap of 24 GiB, and exactly two CPUs/threads. Missing or different
publication resource/profile arguments fail closed. The six-job solve-time
planning ceiling is 30 minutes, plus mesh generation and normalization.

`pilot-failure-report-v1.json` is the compact retained report from the rejected
v1 pinned-container pilot. Its failed partition-growth and outer-domain gates
blocked the full study and the 27-angle publication slice. The publication
stage fails closed unless a report is approved and attests the exact canonical
historical 33-sample production profile: its specification contract/version and
hash plus its production profile contract/version, ID, and hash must all match
values recomputed from `convergence-spec-v2.json`. The mutable
`profile.productionEligible` field is not authorization. Consequently, a
current 23-tuple reduced-profile report cannot publish even if that boolean is
changed to `true`. After authorization, publication solves representatives 0,
1, 2 and validation partners 3, 4, 5. Each pair must agree within the
predeclared one-percent tolerance. Only then does the runner derive all 27 LUT
entries from the exact 40-degree classes. The six publication jobs are never
reported as 27 independent solves.

Detached publication, using a work directory that already contains its approved
`convergence-report.json`:

```sh
export IMAGE_ID='sha256:REPLACE_WITH_PINNED_IMAGE_ID'
nohup nice -n 10 \
  node fem/edwin-gray/convergence/run-study.mjs \
  --stage publication \
  --docker-image "$IMAGE_ID" \
  --work-dir <temporary directory>/edwin-gray-study \
  --solver-profile direct-mumps-publication-v1 \
  --memory-gib 24 \
  --cpus 2 \
  --threads 2 \
  --mesh-threads 1 \
  --hard-timeout-seconds 1800 \
  > <temporary directory>/edwin-gray-study/publication.log 2>&1 &
```
