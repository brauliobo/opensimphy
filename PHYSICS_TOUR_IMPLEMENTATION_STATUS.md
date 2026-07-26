# Physics Tour Implementation Status

## Reporting contract

This is the living implementation ledger for `PHYSICS_TOUR_MASTER_PLAN.md`. Update it in the same commit as each completed implementation step.

Status terms:

- **Planned**: contract recorded; implementation has not started.
- **Active**: work exists but the iteration exit criterion is not met.
- **Technically complete**: exit criterion and automated verification pass.
- **Scientifically blocked**: software is bounded and honest, but required equations, data, validation, or independent evidence are absent.

No iteration is marked complete from file presence alone. Completion requires its exit criterion and recorded verification.

## Current baseline

Date: 2026-07-26

| Item | State |
| --- | --- |
| Product plan | Recorded |
| Tour implementation | Planned |
| Atlas formulas | 288 evaluated, 288 graphed |
| Known Atlas dimension conflicts | 68; must remain visible in relevant lessons |
| Number-wall inputs | 351 bounded and simulatable |
| Core mathematical cases | 37 evaluated and graphed |
| EARTH programs | 130 registered |
| EARTH methods | 220 declared, 134 runnable |
| EARTH source reproductions | 37 runnable |
| EARTH traditional baselines/validators | 97 runnable |
| Unavailable EARTH source models | 86 records without fake kernels |
| EARTH evidence assignments | 2,422 |
| EARTH datasets | 19 metadata-authenticated, 0 acquired/frozen |
| Scientific validation | False |
| Automated browser target | Chromium only |

Baseline commit: `57e5b64 earth: add provenance-pure simulation dossier`

Baseline verification:

- `npm run verify`: passed.
- Vitest: 36 files, 234 tests passed.
- Production PWA build: passed.
- Chromium Playwright: 27 tests passed.
- All 134 runnable EARTH method defaults completed in dedicated workers.
- `git diff --check`: passed.

Measured production baseline:

- Main JavaScript: 116.11 kB raw / 45.28 kB gzip.
- Main CSS: 71.81 kB raw / 12.43 kB gzip.
- EARTH simulation route chunk: 270.39 kB raw / 87.05 kB gzip.
- Plotly chunk: 4,682.31 kB raw / 1,429.05 kB gzip, lazy-loaded.
- PWA precache: 50 entries / 4,399.98 KiB.

## Iteration ledger

| Iteration | Scope | Status | Commit | Exit evidence |
| --- | --- | --- | --- | --- |
| 0 | Scientific/content contracts | Active | pending | Master plan recorded; executable schemas and validation pending |
| 1 | Route-owned data | Planned | pending | `/`, `/tour`, EARTH direct entry must avoid full Atlas workers |
| 2 | Tour content pipeline | Planned | pending | Eight stations plus first lesson generate and fail closed |
| 3 | Orientation and Tour map | Planned | pending | First-use begin/resume journey passes |
| 4 | Units vertical slice | Planned | pending | Responsive, keyboard, reduced-motion, resume, offline journey passes |
| 5 | Conventional-physics spine | Planned | pending | Eight quick stations complete with bounded simulations |
| 6 | Formula specimen | Planned | pending | Meaning-first and dependency-complete views pass |
| 7 | Shared Workbench | Planned | pending | Core/walls/EARTH share declared interaction grammar |
| 8 | Mathematical instruments | Planned | pending | Null-model/base-dependence caveats enforced |
| 9 | EARTH research track | Planned | pending | Provenance classes remain distinct across all lessons |
| 10 | Notebook/offline packs | Planned | pending | Saved revisioned state and explicit packs pass |
| 11 | Accessibility/performance/editorial | Planned | pending | Final budgets and Chromium audit pass |

## Locked decisions

1. One curriculum has Guided and Technical depth. The verdict never changes with depth.
2. The explicit curriculum contains 20 chapters numbered 0-19.
3. The quick path has exactly eight stations and does not imply mastery.
4. Lesson prose is generated structured content, not hardcoded view markup.
5. Simulation playfulness comes from prediction, controls, presets, immediate visual response, and comparison, not points or streaks.
6. Every simulation is bounded and carries a model origin.
7. Unavailable models have no Run control.
8. Compare compatibility is declared, never inferred from shape.
9. Completion is explicit; a visit is not completion.
10. Progress and runs remain local, optional, revisioned, exportable, and telemetry-free.
11. Chromium is the sole automated browser target.
12. Scientific validation remains independent of implementation completeness.

## Known architecture work

Current `src/App.vue` still invokes the aggregate Atlas initializer on all routes. That initializer fetches recipes, symbols, wall index, completion, and taxonomy, then evaluates all 288 formulas and 37 Core cases. Route ownership must split this behavior before Tour orientation is considered performant.

Current reusable simulation foundations:

- Five-axis dimensional expression engine, plus a separate seven-axis EARTH dimension representation.
- 53 frequency/energy/mass/temperature bridge formula records.
- 64 particle formula records.
- Gyromagnetic and magneton records, but no spin-time evolution kernel.
- Frequency-domain Planck spectrum baseline, but no wavelength-domain guided visualizer.
- Complete bounded number-wall engine and worker.
- Quartic roots and companion invariants inside Core, not yet a generic exported solver.
- Compactness/Kottler calculators with two conventions that need explicit normalization.
- 134 runnable EARTH methods with provenance-pure method identities.

Required root-cause refactors:

- Unify physical-quantity conversion semantics rather than layering scale factors over dimension-only unit symbols.
- Represent amount of substance explicitly instead of treating `mol` as dimensionless in the Tour model.
- Keep the existing source-audit dimension engine stable while adding a correct Tour quantity abstraction.
- Add shared series-to-visual/table adapters before reusing EARTH numerical results in lessons.
- Extract generic root and polynomial behavior before building a user-controlled roots lesson.

## Scientific boundaries

- Technical execution does not validate EARTH or Physics Monastery claims.
- No external dataset has passed G0b; immutable bytes, schema, row count, license snapshot, and SHA256 are not frozen.
- The scalar-vacuum target published as `S^1` has `pi_3(S^1)=0` and cannot support the claimed Hopf sector.
- Proton screening near `chi = 2.9530747e-39` is not independently derived by the framework.
- Horn lacks a consistent algebra, action-derived stress tensor, solved soliton, and physical Jacobi spectrum.
- Many source claims lack equations, parameters, boundary conditions, observables, uncertainty models, or independent data.
- Controlled and proprietary datasets cannot be publicly bundled without permission.

## Progress history

### 2026-07-26: baseline recorded

- Committed schema-v2 EARTH program/method registry, 193 lazy evidence shards, 19-dataset ledger, route dossier, worker execution, accessibility hardening, and PWA cache boundaries.
- Confirmed 130 programs, 220 methods, 134 runnable methods, 86 unavailable source records, and `scientificallyValidated: false`.
- Recorded the Physics Tour product contract and initialized this implementation ledger.

## Next implementation step

Complete Iteration 0 and Iteration 2 foundations together:

1. Add TypeScript claim, lesson, block, checkpoint, simulation, control, preset, finding, runtime-limit, glossary, reference, manifest, and progress contracts.
2. Add strict source content for 20 chapter shells, eight quick stations, the complete units lesson, glossary, references, and dimensional-builder simulation.
3. Generate deterministic manifest/chapter/lesson/simulation shards.
4. Validate formula, program, evidence, glossary, navigation, conclusion, and bounds references.
5. Add schema tests that prove malformed content fails closed.
