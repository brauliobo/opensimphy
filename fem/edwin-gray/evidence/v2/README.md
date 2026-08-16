# Edwin Gray v2 FEM evidence

This directory retains compact three-class solver data and the incompatible
pilot evidence for audit. The browser copy is
`../../../../public/data/generated/edwin-gray/motor-fem-calibration-pack-v1.json`.
Both copies have SHA-256
`be2f70fe43223444f3db8df7477b0f5a6fb059ed17fc877e04dda6264caec842`.

The pack is not available to the browser runtime. Its status is
`unavailable-provenance-mismatch`, it is not production eligible, and it does
not establish an uncertainty or torque bound. The pilot's `0.02` threshold is a
pass criterion, not an uncertainty bound. The pilot samples use model hash
`b511...`, specification hash `ee85...`, and angle `6.6666666667 deg`; the
calibration data use model hash `a690...`, current specification hash `94db...`,
and class-0 angle `0 deg`. Class 1/2 transfer remains an unvalidated assumption.

`classes/0`, `classes/1`, and `classes/2` contain the independently solved
checkpoint, normalized result, parameters, solver environment and convergence
record, mesh audit, solver/audit logs, wrapper inputs, and scalar tables. The
large mesh, solver-state, and field-plot artifacts are deliberately excluded;
their original sizes and checkpoint-attested hashes are recorded in
`manifest.json`. Before the ignored run trees were removed, the calibration
legacy builder revalidated every original artifact and reproduced the former
pack byte-for-byte. The corrected builder rejects the retained pilot provenance;
the excluded large artifacts also prevent a fresh end-to-end rebuild from this
compact directory alone.

The production evidence remains separate and rejected. The v2 pilot report
passed its declared criteria, while `convergence-report-rejected.json` records
only 18 of the 33 required production samples. No production LUT, complete
production convergence claim, uncertainty bound, or torque-derivative bound
follows from this calibration.

`SHA256SUMS` covers the committed evidence files. The retained solver environment
and mesh-audit copies replace the original workstation root with
`{REPOSITORY_ROOT}`; `manifest.json` preserves their original raw hashes and
identifies this path-only sanitization.
