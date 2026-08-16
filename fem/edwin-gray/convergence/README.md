# FEM convergence gate

`convergence-spec-v1.json` and `pilot-failure-report-v1.json` are immutable
rejected evidence. `convergence-spec-v2.json` is the active production study
definition. It replaces disconnected axial volume currents with a closed
equivalent current potential, couples local feature resolution to each mesh
level, starts at the v1 far radius, and expands both radial and axial air bounds.
The v1 numerical tolerances are retained.

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

The existing-only path recognizes exactly one spec-declared exception:
`base/fine/10 A/120 deg/event 9` may be a
`symmetry-derived-convergence-sample` from the complete `0 deg/event 0` fine
job. It reconstructs and validates the machine-checked event-map proof, requires
the complete independent coarse `0/event 0` and `120/event 9` pair to agree
within one percent, verifies the failed target's mesh checkpoint, and requires
model, environment, solver, domain, mesh, and current identities to match. The
evidence records the 120-degree rotation and source/validation job and artifact
hashes. No other absent tuple is filled or waived. The persisted v2 jobs use the
older `fem-checkpoint-v5` envelope, which v2 accepts explicitly; all artifact,
parameter, environment, and normalized-result checks remain mandatory.

The integrated study runner generates domain-specific case copies, executes
exact event-attested single jobs through `scripts/run.mjs`, reuses a verified
mesh for the 1 A audit, and resumes from content-addressed checkpoints:

```sh
nice -n 10 node fem/edwin-gray/convergence/run-study.mjs \
  --stage pilot \
  --docker-image IMAGE_ID \
  --work-dir /tmp/edwin-gray-study

nice -n 10 node fem/edwin-gray/convergence/run-study.mjs \
  --stage convergence \
  --docker-image IMAGE_ID \
  --work-dir /tmp/edwin-gray-study

nice -n 10 node fem/edwin-gray/convergence/run-study.mjs \
  --stage publication \
  --docker-image IMMUTABLE_IMAGE_ID_OR_DIGEST \
  --work-dir /tmp/edwin-gray-study \
  --solver-profile direct-mumps-publication-v1 \
  --memory-gib 24 \
  --cpus 2 \
  --threads 2
```

Torque-refinement samples hold event 0 fixed. The 120-degree periodicity
partners use event 9, preserving the event-specific excitation after rotating
the complete three-sector source pattern. The runner is intentionally serial.
Publication uses `publication-profile-v1.json`: accepted coarse mesh `0.025 m`
(measured 1,335,000 DOF), direct MUMPS (measured 19.3 GiB peak), an exact Docker
hard cap of 24 GiB, and exactly two CPUs/threads. Missing or different
publication resource/profile arguments fail closed. The six-job solve-time
planning ceiling is 30 minutes, plus mesh generation and normalization.

`pilot-failure-report-v1.json` is the compact retained report from the rejected
v1 pinned-container pilot. Its failed partition-growth and outer-domain gates
blocked the full study and the 27-angle publication slice. The publication
stage now fails closed unless the v2 report is approved and hash-matches the v2
specification. It then solves representatives 0, 1, 2 and validation partners
3, 4, 5. Each pair must agree within the predeclared one-percent tolerance.
Only after those gates pass does the runner derive all 27 entries from the exact
40-degree classes. Every entry is marked `symmetry-derived-from-job` and carries
its rotation plus source event, job, and artifact hashes; the six jobs are never
reported as 27 independent solves.

Detached publication, using a work directory that already contains its approved
`convergence-report.json`:

```sh
export IMAGE_ID='sha256:REPLACE_WITH_PINNED_IMAGE_ID'
nohup nice -n 10 \
  node fem/edwin-gray/convergence/run-study.mjs \
  --stage publication \
  --docker-image "$IMAGE_ID" \
  --work-dir /tmp/edwin-gray-study \
  --solver-profile direct-mumps-publication-v1 \
  --memory-gib 24 \
  --cpus 2 \
  --threads 2 \
  > /tmp/edwin-gray-study/publication.log 2>&1 &
```
