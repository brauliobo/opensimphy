# Static source and provenance ledger

This workspace uses US3890548A as the canonical topology source. The patent is
an historical disclosure, not a dimensioned CAD drawing for the illustrative
case. The case file therefore keeps source status beside the model rather than
silently presenting assumptions as measured facts.

## Source records

- Patent page: https://patents.google.com/patent/US3890548A/en
- Patent PDF: https://patentimages.storage.googleapis.com/25/6b/42/7b56253608f313/US3890548.pdf
- Publication: US3890548A, `Pulsed capacitor discharge electric engine`.
- Inventor: Edwin V Gray.
- Filing date: 1973-11-02.
- Publication date: 1975-06-17.

The locators below refer to the HTML patent description and figures. They are
stable semantic locators for this contract, not assertions that the source
contains the numerical dimensions used by the model.

## Status vocabulary

- `patent-described`: directly stated or visibly represented by the patent.
- `patent-derived`: a direct count, interval, or relation calculated from
  patent-described elements without adding a physical property.
- `assumption`: chosen to make an executable illustrative model where the
  patent is silent or ambiguous.
- `derived`: calculated from declared assumptions, such as a source density.
- `solver-derived`: emitted by an actual solver run and tied to an input hash.
- `not-run`: a requested calculation for which no solver result exists.

Every non-solver field in the case provenance map has evidence references and
an explanatory note. Solver-derived values must never overwrite the source or
assumption records.

## Field map

| Case path | Status | Evidence or reason |
| --- | --- | --- |
| `model.rotorStatorLayout.statorPairStations` | patent-described | `US3890548A:description:stator-pairs-40-deg`; nine stator pairs are described around the housing. |
| `model.rotorStatorLayout.rotorPairStations` | patent-described | `US3890548A:description:three-rotor-pairs`; three rotor pair assemblies are described. |
| `model.rotorStatorLayout.statorAngularPitchDeg` | patent-described | `US3890548A:description:stator-pairs-40-deg`; the text states 40 degree spacing. |
| `model.rotorStatorLayout.rotorAngularPitchDeg` | patent-described | `US3890548A:description:rotor-120-deg`; the text states 120 degree rotor spacing. |
| `model.rotorStatorLayout.frontBackPlanes` | patent-described | `US3890548A:description:front-back-pairs`; front and back units are described as axial pairs. |
| `geometry.pairOffsetDeg` | patent-derived | `US3890548A:description:major-minor-13-1-3`; the OCR source represents the minor/major separation as 13 1/3 degrees. |
| `model.rotorStatorLayout.expectedAssemblyPhysicalGroups` | patent-derived | 9 x 2 x 2 + 3 x 2 x 2 = 48 named major/minor, front/back assemblies. |
| `model.sequence.dischargeStepDeg` | patent-described | `US3890548A:description:27-steps`; the illustrative sequence advances at 13 1/3 degree steps. |
| `geometry.airOuterRadiusM` | assumption | No manufacturing dimension is used; an outer air boundary is needed for a finite FEM domain. |
| `geometry.rotorCoreInnerRadiusM` | assumption | Chosen illustrative scale, not a patent measurement. |
| `geometry.statorCoreInnerRadiusM` | assumption | Chosen illustrative scale, not a patent measurement. |
| `geometry.minorTangentialWidthM` | assumption | Chosen to keep neighboring 40 degree stations separated in the coarse mesh. |
| `geometry.majorTangentialWidthM` | assumption | Chosen illustrative scale; major/minor size ordering is retained. |
| `geometry.rotorMinorTangentialWidthM` | assumption | Separate rotor-scale width chosen to keep the minor envelope disjoint at the smaller rotor radius. |
| `geometry.rotorMajorTangentialWidthM` | assumption | Separate rotor-scale width chosen to keep the major envelope disjoint from the minor envelope. |
| `geometry.rotorCoilTangentialMarginM` | assumption | Reduced rotor coil margin prevents overlap between adjacent assumed coil envelopes. |
| `geometry.coilRadialMarginM` | assumption | Keeps the homogenized coil shell separated from the core in the illustrative geometry. |
| `geometry.frontPlaneZM` | assumption | Axial placement is illustrative because the patent does not provide a dimensioned axial layout. |
| `materials.core.relativePermeability` | assumption | Linear constant permeability is a solver simplification; no material curve is claimed. |
| `excitation.currentDensityModel` | assumption | Homogenized source replaces unresolved turns and the capacitor discharge circuit. |
| `excitation.effectiveCoilCrossSectionM2` | assumption | Required only to convert the declared current and turns into a source density. |
| `sweep.symmetry.declared` | assumption | Exact symmetry is disabled by default; no reduction is applied unless explicitly declared. |
| `results` | not-run | Generated solver artifacts are excluded from the source workspace; no browser LUT is bundled. |

## Interpretation boundary

The patent description supports a topology contract and a sequence vocabulary.
It does not, by itself, establish the material curve, coil turn count,
manufacturing dimensions, transient waveform, mechanical torque, or energy
balance of a particular surviving motor. The FEM result therefore answers a
narrow classical field question for this declared illustrative geometry. It is
not evidence that the historical machine had these dimensions or that any
non-classical operating claim follows from the solve.
