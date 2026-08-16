# FEM convergence gate

`convergence-spec-v1.json` is the immutable production study definition. It is
deliberately separate from CI smoke fixtures: CI only exercises the evaluator,
while approval requires every production tuple declared by the specification.

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
  "contractVersion": 1,
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
```

Torque-refinement samples hold event 0 fixed. The 120-degree periodicity
partners use event 9, preserving the event-specific excitation after rotating
the complete three-sector source pattern. The runner is intentionally serial;
each pinned-container job uses at most the requested four solver threads.

`pilot-failure-report-v1.json` is the compact retained report from the latest
real pinned-container pilot. Its failed partition-growth and outer-domain gates
blocked the full study and the 27-angle publication slice; no LUT was emitted.
