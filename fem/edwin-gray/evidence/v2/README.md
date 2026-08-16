# Edwin Gray v2 FEM evidence

This directory retains the compact evidence needed to audit the completed
three-class limited calibration pack. The browser copy is
`../../../../public/data/generated/edwin-gray/motor-fem-calibration-pack-v1.json`.
Both copies have SHA-256
`3e4594defcb5414c023aa423226f6e35957e840dd9a5dcdf8fa2f63bb1dc5e48`.

The pack is ready for explicit browser opt-in, but its scientific status remains
`limited-not-validated`. It is disabled by default, is not production eligible,
does not establish full convergence, and provides no torque bound. Class 0 uses
the measured 1.1584935659% coarse/fine drift; classes 1 and 2 use that value only
as an explicit transfer assumption for inductance, magnetic energy, and
coenergy.

`classes/0`, `classes/1`, and `classes/2` contain the independently solved
checkpoint, normalized result, parameters, solver environment and convergence
record, mesh audit, solver/audit logs, wrapper inputs, and scalar tables. The
large mesh, solver-state, and field-plot artifacts are deliberately excluded;
their original sizes and checkpoint-attested hashes are recorded in
`manifest.json`. Before the ignored run trees were removed, the calibration
builder revalidated every original artifact and reproduced the committed pack
byte-for-byte.

The production evidence remains separate and rejected. The v2 pilot passed its
bounded checks, while `convergence-report-rejected.json` records only 18 of the
33 required production samples. No production LUT, complete production
convergence claim, or torque-derivative bound follows from this calibration.

`SHA256SUMS` covers the committed evidence files. The retained solver environment
and mesh-audit copies replace the original workstation root with
`{REPOSITORY_ROOT}`; `manifest.json` preserves their original raw hashes and
identifies this path-only sanitization.
