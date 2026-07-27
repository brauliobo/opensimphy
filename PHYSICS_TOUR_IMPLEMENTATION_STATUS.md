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
| Tour implementation | Iterations 0 through 4 technically complete; remaining iterations planned |
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

Original baseline commit: `57e5b64 earth: add provenance-pure simulation dossier`

Original baseline verification:

- `npm run verify`: passed.
- Vitest: 36 files, 234 tests passed.
- Production PWA build: passed.
- Chromium Playwright: 27 tests passed.
- All 134 runnable EARTH method defaults completed in dedicated workers.
- `git diff --check`: passed.

Current Iterations 3 and 4 checkpoint verification:

- `npm run verify`: passed.
- Data generation: 20 chapters, 1 lesson, 1 simulation, 11 glossary entries, 5 references, and 8 stations totaling 27 minutes.
- TypeScript typecheck: passed.
- Vitest: 46 files, 419 tests passed.
- Production PWA build: passed.
- `npm run check:routes`: passed.
- Default Chromium Playwright: 65 tests passed.
- Production-preview Chromium PWA Playwright: 1 test passed.
- `git diff --check`: passed.
- Independent code review: PASS.
- Independent scientific/UX acceptance: PASS.

Generated-content checkpoint:

- Comparison compatibility keys are derived, never source-authored: SHA-256 over canonical JSON containing exactly the simulation `id`, `contentRevision`, `modelRevision`, `implementationRevision`, and canonical `outputSchema`.
- Current dimensional-equation-builder compatibility key: `a96ac0f56a99cdcaf9688fce60b65239fed3cdccdf6fad3ee410b26d44e77805`.

Original measured production baseline:

- Main JavaScript: 116.11 kB raw / 45.28 kB gzip.
- Main CSS: 71.81 kB raw / 12.43 kB gzip.
- EARTH simulation route chunk: 270.39 kB raw / 87.05 kB gzip.
- Plotly chunk: 4,682.31 kB raw / 1,429.05 kB gzip, lazy-loaded.
- PWA precache: 50 entries / 4,399.98 KiB.

Current checkpoint production measurements:

- Main JavaScript: 111.29 kB raw / 42.93 kB gzip, still below the initial Tour budget of 200 KB compressed.
- Eager CSS: 75.67 kB raw / 12.96 kB gzip.
- Lazy Tour CSS: 37.92 kB raw / 6.37 kB gzip.
- TourLesson chunk: 48.55 kB raw / 14.29 kB gzip.
- Initial Tour data: about 52.9 KB, below the 100 KB budget.
- PWA precache: 55 entries / 3,555.86 KiB.
- Runtime registry revision: `66041e36e1a4`.
- Explicit Guided pack: 8 validated resources / 146,033 bytes (about 143 KB), revision `2026-07-26`.

## Iteration ledger

| Iteration | Scope | Status | Commit | Exit evidence |
| --- | --- | --- | --- | --- |
| 0 | Scientific/content contracts | Technically complete | containing commit | Separate epistemic, method, origin, and result axes; nearest-ancestor attribution; nonempty evidence; exact references, revisions, and locators; scoped conclusions; distinct source and runtime statuses; general simulation schema |
| 1 | Route-owned data | Technically complete | containing commit | Direct and warm Tour entry plus canonical and legacy EARTH entries, including document routes, do not load formula, Core, or number-wall owners; Formula Atlas/detail, Core, and Number Walls load only their respective owners |
| 2 | Tour content pipeline | Technically complete | containing commit | Foundation exit met: 20 chapter shells; exactly 8 quick stations totaling 27 minutes; first complete 11-minute units lesson linked to its 4-minute quick path; one bounded simulation contract; 11 glossary entries; 5 references; 26 deterministic generated artifacts; exact-key and inert-text policy; closed references and navigation. The other seven planned stations do not yet have full lessons or simulations; those belong to Iteration 5 |
| 3 | Orientation and Tour map | Technically complete | containing commit | Orientation; continuous 8-station spine; 20-chapter/4-act map; persisted Guided/Technical depth; Begin/Resume with real anchors; independent station/lesson progress; evidence, saved, and not-found routes; legacy topic redirects; generated route titles; modal mobile navigation |
| 4 | Units vertical slice | Technically complete | containing commit | 11-minute full units lesson plus 4-minute Guided quick subset; six-stage lesson grammar; exact SI observation anchors; prediction-first dimensional builder with presets, SI/mechanical-CGS coordinates, energy/torque caveat, and unlike-addition rejection; additive Technical content; provenance and conclusion boundary; accessible reflow; explicit Guided offline pack |
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

## Current architecture and remaining work

`src/App.vue` no longer invokes an aggregate Atlas initializer. Independent modules under `src/registries` give each route direct ownership: Tour loads its manifest and taxonomy first, then chapter, lesson, simulation, glossary, and reference artifacts on demand; Formula Atlas/detail loads recipes and symbols and evaluates them in `formula.worker`; Core evaluates only in `core.worker`; Number Walls loads the index for browsing, then defers the selected payload and dynamic `numberWall.worker` import until Run. EARTH remains isolated behind its existing registries and worker.

Registry initialization is generation-guarded so stale in-flight results cannot publish. Failed attempts clear their initialization promise and may be retried; successful registries remain session-cached. Formula and Core routes use owner counts, and release by the final owner cancels unfinished initialization. Each wall run owns a fresh deferred worker and terminates it on result, failure, or cancellation. The additive runtime audit session ledger records only domains that have loaded, and the completion registry uses the strict `completionReport` parser rather than rebuilding a global engine state.

The Tour now has orientation, chapter map, chapter, lesson, evidence, saved, and not-found surfaces; legacy topics redirect into chapters. Guided/Technical depth and anchor-aware Resume persist locally. Station and lesson progress remain independent, explicit, exportable, and clearable. The units lesson renders Question, Observe, Explain, Equation ladder, Try, and Interpret stages, with Technical material additive to Guided content and no change to the verdict.

The separate seven-axis Tour dimension engine handles bounded multiplication, division, and unlike-addition rejection; compares quantity dimensions without inferring quantity-kind identity; and converts target-bound values between SI and mechanical CGS. The lesson records exact SI defining observations, practical-realization caveats, complete provenance, runtime findings, and the scientific conclusion boundary. It does not alter the five-axis source-audit engine or hide the Atlas's 68 dimension conflicts.

Generated Tour JSON is not automatically precached. The explicit Guided-only pack transactionally installs and validates 8 resources totaling 146,033 bytes at revision `2026-07-26`, includes taxonomy as a self-contained fallback, preserves the prior complete pack on failure, and supports explicit clearing. Iteration 10 remains planned: richer packs, saved runs, storage/revision management, and update warnings are not complete.

Production closure checks cover all Tour, Formula Atlas, Core, and Number Wall route groups and six EARTH view groups, including canonical and legacy document navigation. Evaluator signatures occur only in their dedicated workers; no aggregate Atlas or shared simulation worker remains.

Later residuals do not reopen completed iterations: Formula detail still evaluates all 288 recipes; successful registries intentionally remain session-cached; strict Tour summary counts must expand deliberately with Iteration 5; richer revision/storage behavior belongs to Iteration 10; and final performance, forced-colors, and editorial work belongs to Iteration 11. Chromium remains the sole automated browser target.

Current reusable simulation foundations:

- Stable five-axis Atlas source-audit engine, separate seven-axis Tour dimension engine, and separate seven-axis EARTH dimension representation.
- Exact SI observation anchors, bounded SI/mechanical-CGS quantity coordinates, prediction-first presets, and explicit quantity-kind caveats.
- A transactional Guided Tour pack with validated manifest, taxonomy, vocabulary, glossary, references, chapter, lesson, and simulation resources.
- 53 frequency/energy/mass/temperature bridge formula records.
- 64 particle formula records.
- Gyromagnetic and magneton records, but no spin-time evolution kernel.
- Frequency-domain Planck spectrum baseline, but no wavelength-domain guided visualizer.
- Complete bounded number-wall engine and worker.
- Quartic roots and companion invariants inside Core, not yet a generic exported solver.
- Compactness/Kottler calculators with two conventions that need explicit normalization.
- 134 runnable EARTH methods with provenance-pure method identities.

Required future abstractions:

- Unify physical-quantity conversion semantics rather than layering scale factors over dimension-only unit symbols.
- Keep the existing source-audit and Tour dimension engines stable while expanding reusable quantity behavior for later lessons.
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

### 2026-07-26: orientation and units vertical slice accepted

- Marked Iterations 3 and 4 technically complete in the containing commit.
- Accepted orientation, the continuous eight-station spine, 20 chapters across four acts, persisted Guided/Technical depth, anchor-aware Begin/Resume, independent station and lesson progress, evidence/saved/not-found routes, legacy topic redirects, generated titles, and modal mobile navigation.
- Accepted the 11-minute full units lesson and four-minute Guided quick subset with six-stage grammar, exact SI anchors, prediction and presets, SI/mechanical-CGS coordinates, energy-versus-torque and unlike-addition boundaries, additive Technical content, complete provenance/conclusions, keyboard/reduced-motion/reflow support, and the explicit Guided pack.
- Confirmed the Guided pack contains 8 transactionally validated resources totaling 146,033 bytes (about 143 KB) at revision `2026-07-26`, includes a self-contained taxonomy fallback, is never installed by automatic Tour JSON precache, and can be cleared. Iteration 10 remains planned for richer packs and persistence/storage policy.
- `npm run verify` passed: generation, typecheck, 46 Vitest files with 419 tests, production build, and route checker passed. The default Chromium suite passed 65 tests and the production-preview Chromium PWA suite passed 1 test; independent code review and scientific/UX acceptance: PASS; `git diff --check`: passed.
- Measured main JavaScript at 111.29 kB raw / 42.93 kB gzip, eager CSS at 75.67/12.96 kB, lazy Tour CSS at 37.92/6.37 kB, TourLesson at 48.55/14.29 kB, initial Tour data at about 52.9 KB, and PWA precache at 55 entries / 3,555.86 KiB. Runtime registry revision is `66041e36e1a4`; dimension compatibility is `a96ac0f56a99cdcaf9688fce60b65239fed3cdccdf6fad3ee410b26d44e77805`.
- Preserved `scientificallyValidated: false`, all dataset blockers, all scientific caveats, and the visible 68-conflict Atlas boundary.

### 2026-07-26: route-owned data accepted

- Marked Iteration 1 technically complete in the containing commit.
- Confirmed direct and warm Tour navigation and canonical and legacy EARTH navigation, including document routes, do not load formula, Core, or number-wall owners.
- Confirmed Formula Atlas/detail, Core, and Number Walls route closures load only their respective owners; all Tour/Atlas/Core/Wall route groups and six EARTH view groups are checked, and no aggregate/shared worker remains.
- `npm run verify` passed: deterministic generation, typecheck, 40 Vitest files with 279 tests, production build, and `check:routes` all passed. The separate Chromium run passed 41 tests; independent functional review: PASS; `git diff --check`: passed.
- Measured main JavaScript at 96.36 kB raw / 38.26 kB gzip versus 116.11 kB / 45.28 kB previously; CSS at 71.81 kB / 12.43 kB; formula, Core, and number-wall workers at 15.27 kB, 18.92 kB, and 4.30 kB raw; and PWA precache at 71 entries / 3,493.49 KiB with runtime revision `465cc706fe72`.
- Preserved `scientificallyValidated: false`; route isolation and functional acceptance do not establish scientific validity.

### 2026-07-26: scientific contracts and content foundation accepted

- Marked Iteration 0 technically complete with separate epistemic, method, origin, and result axes; nearest-ancestor attribution; nonempty evidence; exact references, revisions, and locators; scoped conclusions; source-vs-runtime statuses; and a general simulation schema.
- Marked Iteration 2 technically complete for its stated foundation exit: 20 chapter shells, exactly eight quick stations totaling 27 minutes, the first complete 11-minute units lesson linked to its 4-minute quick path, one bounded simulation contract, 11 glossary entries, five references, and 26 deterministic generated artifacts.
- Confirmed exact-key and inert-text enforcement, closed references and navigation, and generated-only compatibility-key derivation. The seven other station lessons and simulations remain Iteration 5 work.
- Full `npm run verify` passed: generation produced 20 chapters, 1 lesson, 1 simulation, 11 glossary entries, 5 references, and 8 stations totaling 27 minutes; Vitest passed 37 files and 252 tests; typecheck and the production PWA build passed.
- Current production measurements are 116.11 kB raw / 45.28 kB gzip for main JavaScript, 71.81 kB raw / 12.43 kB gzip for main CSS, and 76 precache entries / 4,538.81 KiB.
- Focused verification passed 18/18; `git diff --check` passed; independent acceptance review: PASS.
- Preserved `scientificallyValidated: false`; technical acceptance does not change any scientific boundary.

### 2026-07-26: baseline recorded

- Committed schema-v2 EARTH program/method registry, 193 lazy evidence shards, 19-dataset ledger, route dossier, worker execution, accessibility hardening, and PWA cache boundaries.
- Confirmed 130 programs, 220 methods, 134 runnable methods, 86 unavailable source records, and `scientificallyValidated: false`.
- Recorded the Physics Tour product contract and initialized this implementation ledger.

## Next implementation step

Implement Iteration 5's conventional-physics spine by completing the remaining seven stations and bounded simulations, then proceed to the formula specimen and shared Workbench work in Iterations 6 and 7.
