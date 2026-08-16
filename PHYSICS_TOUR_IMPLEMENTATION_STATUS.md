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

Date: 2026-08-16

| Item | State |
| --- | --- |
| Product plan | Recorded |
| Tour implementation | Iterations 0 through 7 technically complete; remaining iterations planned |
| Tour content revision | `2026-07-27` |
| Tour chapters | 20 total; 8 content-ready conventional, 12 planned mathematical/research |
| Tour lessons / simulations | 9 / 9 |
| Tour quick stations | 8/8 content-ready; 27 minutes total |
| Tour glossary / references | 27 / 10 |
| Atlas formulas | 288 meaning-first, evaluated, graphed, and source-audited |
| Formula exact source criterion | 70 total; 68 met, 2 not met; 50 full / 18 almost-full / 2 no match |
| Formula measured source criterion | 218 total; 217 within source 5.2 sigma, 1 outside |
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
| Adjacent Quantum / Gray labs | Delivered outside the numbered Tour iteration ledger |
| Gray machine contracts / generated artifact | 7 / 16,523 bytes (16.5 KiB) |
| Gray production FEM LUT | Absent; production convergence rejected |
| Gray limited FEM calibration | Retained audit values; runtime unavailable on pilot provenance mismatch |
| Core Vue SFC templates | 58/58 Pug; excludes 8 adjacent Fiddle/Awesome Physics bridge SFCs |

Original baseline commit: `57e5b64 earth: add provenance-pure simulation dossier`

Original baseline verification:

- `npm run verify`: passed.
- Vitest: 36 files, 234 tests passed.
- Production PWA build: passed.
- Chromium Playwright: 27 tests passed.
- All 134 runnable EARTH method defaults completed in dedicated workers.
- `git diff --check`: passed.

Historical Iteration 7 checkpoint verification (2026-07-27):

- `npm run verify`: passed.
- Data generation: revision `2026-07-27`; 20 chapters, 9 lessons, 9 simulations, 27 glossary entries, 10 references, and 8/8 content-ready stations totaling 27 minutes.
- TypeScript typecheck: passed.
- Vitest: 63 files, 659 tests passed.
- Production PWA build: passed.
- `npm run check:routes`: passed.
- Default Chromium Playwright: 103 tests passed.
- Production-preview Chromium PWA Playwright: 1 test passed.
- `git diff --check`: passed.
- Independent scientific acceptance: PASS.
- Independent UX acceptance: PASS.

Post-Iteration-7 Gray checkpoint (2026-08-16):

- This is an adjacent-lab checkpoint, not completion of Tour Iterations 8, 9, 10, or 11. Their ledger states remain Planned.
- Seven JSON machine contracts compile deterministically into the 16,523-byte generated runtime artifact. A recorded seven-model/100-revolution run measured about 24.84 ms aggregate median on this host; timing is hardware-sensitive. A later documentation recheck measured 25.96 ms and passed finite-result, energy-closure, COP-at-or-below-one, result-size, and revolution-count gates.
- The dedicated worker returns the full ordered 27-event run boundary used by rotor, circuit, solved recovery, per-event/aggregate energy, URL-owned state, explicit save, and compatible two-snapshot comparison surfaces. Original 500 rpm contact behavior and the illustrative modified electronic rule are separately versioned.
- Source records and modifications remain distinct: patent-described topology/schedule, retained captions, presenter statements, and prototype identities are source evidence; dimensions, materials, surrogate machine parameters, classical RLC/recovery equations, and the modified electronic quench rule are assumptions or illustrative modifications. Modified Schloff winding/trigger/no-load reports do not characterize original-machine efficiency.
- The user-provided diagram reproduces `7,460 / 26.8 = 278.358208955...`, not 282. A 282 target requires 7,557.6 W; the open observed-output and target deficits are 7,433.2 W and 7,530.8 W. The retained source-pack COP-300 statement and raw ambiguous `7 12 kilowatts` caption remain separate and unresolved.
- FEM v1 is immutable rejected evidence: its partition-growth and outer-domain gates failed. The v2 pilot report passed its declared formulation/mesh/energy/current/periodicity criteria and records a 1.1584935659% coarse/fine observation, but its pass tolerance is not an uncertainty bound. Production v2 remains rejected at 18/33 required samples, so no production LUT is published.
- Fast publication infrastructure defines six serial jobs: representative event classes 0, 1, and 2 plus validation partners 3, 4, and 5 before exact 40-degree symmetry expansion. This infrastructure has not produced an accepted production publication in the current evidence.
- The separate three-class run retained useful scalar results, but its pilot model hash, current specification hash, and coarse/fine sample identity do not match. The published audit JSON is `unavailable-provenance-mismatch`, `runtimeAvailable: false`, and `productionEligible: false`; it establishes no uncertainty bound, class 1/2 transfer remains unvalidated, torque is unbounded, and the path cannot write a production LUT.
- Prototype contracts are descriptive/illustrative and FEM-blocked without prototype-specific geometry. The patent topology and runtime are explicitly illustrative, not a replica of a manufactured motor; the FEM model does not solve transient discharge, rotor motion, torque, load, arc physics, thermal effects, or energy recovery.
- Deliberate Gray PWA runtime-cache behavior, Chromium accessibility/reflow/forced-colors coverage, and frontend/Pages CI Gray/FEM gates are recorded in the recent commits. The core OpenSimPhy SFC scope is 58/58 Pug; counting the four Fiddle and four Awesome Physics adjacent bridge SFCs produces the stale-for-this-scope raw total of 66.
- Recent commits record focused Gray engine/UI contracts, 11 Chromium Gray workbench tests, FEM validation contracts, generated-machine checking, and CI wiring. No post-July aggregate `npm run verify` file/test total is asserted.

Current generated simulation compatibility keys:

- Comparison compatibility keys are derived, never source-authored: SHA-256 over canonical JSON containing exactly the simulation `id`, `contentRevision`, `modelRevision`, `implementationRevision`, and canonical `outputSchema`.

| Simulation | Compatibility key |
| --- | --- |
| `dimensional-equation-builder` | `1ecb7b383154f3daa44bf2d8976fde1edd19131054ff37444842d2a9192f17dc` |
| `physical-scale-ruler` | `c87bed7832b1e0eff330a25ad429de073be89497a2ab2bcc35a101b5831769db` |
| `photon-scale-converter` | `d0089e0d7d0c1ba5b40d11cd1231ed16c3186a5968952d7cf2f15ff1e5684685` |
| `electrical-standards-network` | `e97c4f6a7886840a1e1b3039154b38226bf93e01843cc4cf11c35d6e8484863c` |
| `hydrogen-spectrum-explorer` | `ad0957023e1656a45003c137207e8a18031e3060ce8a099a297516c3895389b7` |
| `particle-scale-comparator` | `2218016a97bd050646f64ece70e33e1753e56cdca87e1b97576d674b5b69db43` |
| `spin-precession-visualizer` | `1b01bcdccd5827cfff17da710b1f5e3da5876ffd51eb82a0f6e4311a313b92c5` |
| `blackbody-spectrum` | `2b300b53db827cff15c17c36fbd7a01a753f0fe64f07644548a984c936844f33` |
| `particle-to-mole-scaler` | `67e4b110368f67d803e04456b9bc3c8a5c2b30c640892c593a79d5e4190dbf0d` |

Current Formula source and compatibility checkpoint:

- Recipes SHA-256: `fe17912cd1915171a3fa9d124f9154ce78f64da7f4a5e99b9b5361d0e4d64fa1`.
- Symbols SHA-256: `fbdbce921c993df9ccd726eade309b8735d5d84446f74c8b649571fa6e3fa9b6`.
- Exact fetched bytes are hash-checked against `registry.json` before JSON parsing.
- Formula compatibility includes Formula ID, both source hashes, implementation revision `formula-evaluator-contract-v1`, and output schema `formula-record-v7`.

Original measured production baseline:

- Main JavaScript: 116.11 kB raw / 45.28 kB gzip.
- Main CSS: 71.81 kB raw / 12.43 kB gzip.
- EARTH simulation route chunk: 270.39 kB raw / 87.05 kB gzip.
- Plotly chunk: 4,682.31 kB raw / 1,429.05 kB gzip, lazy-loaded.
- PWA precache: 50 entries / 4,399.98 KiB.

Current checkpoint production measurements:

- Main JavaScript: 114.08 kB raw / 44.06 kB gzip.
- Eager CSS: 91.53 kB raw / 15.45 kB gzip.
- Shared URL-state/snapshot chunk: 18.56 kB raw / 5.68 kB gzip.
- Core Workbench: 16.67 kB raw / 6.39 kB gzip.
- Number Walls Workbench: 26.35 kB raw / 9.88 kB gzip.
- EARTH Workbench/Evidence detail: 46.76 kB raw / 14.65 kB gzip.
- Formula worker: 15.27 kB raw; Core worker: 18.92 kB raw; number-wall worker: 4.63 kB raw.
- Plotly: still lazy-loaded.
- Initial compressed JavaScript: below the 200 KB budget.
- PWA precache: 79 entries / 3,918.70 KiB.
- Runtime registry revision: `6647c006a9d3`.

## Iteration ledger

| Iteration | Scope | Status | Commit | Exit evidence |
| --- | --- | --- | --- | --- |
| 0 | Scientific/content contracts | Technically complete | containing commit | Separate epistemic, method, origin, and result axes; nearest-ancestor attribution; nonempty evidence; exact references, revisions, and locators; scoped conclusions; distinct source and runtime statuses; general simulation schema |
| 1 | Route-owned data | Technically complete | containing commit | Direct and warm Tour entry plus canonical and legacy EARTH entries, including document routes, do not load formula, Core, or number-wall owners; Formula Atlas/detail, Core, and Number Walls load only their respective owners |
| 2 | Tour content pipeline | Technically complete | containing commit | Foundation exit met: 20 chapter shells; exactly 8 quick stations totaling 27 minutes; first complete 11-minute units lesson linked to its 4-minute quick path; one bounded simulation contract; 11 glossary entries; 5 references; 26 deterministic generated artifacts; exact-key and inert-text policy; closed references and navigation. The remaining seven station lessons and simulations were subsequently delivered in Iteration 5 |
| 3 | Orientation and Tour map | Technically complete | containing commit | Orientation; continuous 8-station spine; 20-chapter/4-act map; persisted Guided/Technical depth; Begin/Resume with real anchors; independent station/lesson progress; evidence, saved, and not-found routes; legacy topic redirects; generated route titles; modal mobile navigation |
| 4 | Units vertical slice | Technically complete | containing commit | 11-minute full units lesson plus 4-minute Guided quick subset; six-stage lesson grammar; exact SI observation anchors; prediction-first dimensional builder with presets, SI/mechanical-CGS coordinates, energy/torque caveat, and unlike-addition rejection; additive Technical content; provenance and conclusion boundary; accessible reflow; explicit Guided offline pack |
| 5 | Conventional-physics spine | Technically complete | containing commit | Revision `2026-07-27`; 8/8 content-ready stations and conventional chapters; 9 lessons and pure-engine simulations; 27-minute spine; status/provenance corrections; official IAU/CIPM references; lazy instruments; 31-resource Guided pack |
| 6 | Formula specimen | Technically complete | containing commit | 288 meaning-first records; authoritative identity/NFC-bound source audits; exact fetched-byte hashes; progressive equation ladder; separate source/runtime dependencies; dimension/mol caveats; accessible table/lazy plot; strict local v1 snapshots and saved-run ledger |
| 7 | Shared Workbench | Technically complete | containing commit | Core, Number Walls, and EARTH share one capability-driven grammar with strict announced URL state, reset, explicit saves, immutable two-state comparison, structured findings, domain-safe compatibility, route ownership, keyboard/reflow support, and no loss of domain behavior |
| 8 | Mathematical instruments | Planned | pending | Null-model/base-dependence caveats enforced |
| 9 | EARTH research track | Planned | pending | Provenance classes remain distinct across all lessons |
| 10 | Notebook/offline packs | Planned | pending | Richer packs, saved-run import/export and revision replay, migration/storage policy, and update warnings pass |
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

`src/App.vue` no longer invokes an aggregate Atlas initializer. Independent modules under `src/registries` give each route direct ownership: Tour loads its generated artifacts on demand; Formula Atlas/detail fetches `recipes.json`, `symbols.json`, and `registry.json`, hash-checks the exact bytes, and evaluates in `formula.worker`; Core evaluates only in `core.worker`; Number Walls defers payload and worker loading until Run. Formula assets use revisioned runtime caches and Formula closures contain no Tour JSON, Core/Wall evaluator, or aggregate worker. EARTH remains isolated behind its existing registries and worker.

`/labs/quantum-wave` and `/labs/edwin-gray` are adjacent teaching labs linked from Labs, not generated Tour chapters or evidence that Iterations 8-11 are complete. Gray compiles seven machine contracts into a small generated artifact and dispatches full-motor work through its own worker. Strict machine/revision/model/topology/excitation/hash compatibility keeps absent or incompatible FEM data disabled instead of relabeling the illustrative surrogate as FEM.

Registry initialization is generation-guarded so stale in-flight results cannot publish. Failed attempts clear their initialization promise and may be retried; successful registries remain session-cached. Formula and Core routes use owner counts, and release by the final owner cancels unfinished initialization. Each wall run owns a fresh deferred worker and terminates it on result, failure, or cancellation. The additive runtime audit session ledger records only domains that have loaded, and the completion registry uses the strict `completionReport` parser rather than rebuilding a global engine state.

The Tour now has orientation, chapter map, chapter, lesson, evidence, saved, and not-found surfaces; legacy topics redirect into chapters. Guided/Technical depth and anchor-aware Resume persist locally. Station and lesson progress remain independent, explicit, exportable, and clearable. All eight quick stations are content-ready across eight conventional-physics chapters; 12 mathematical/research chapters remain planned. The nine lessons render Question, Observe, Explain, Equation ladder, Try, and Interpret stages, with Technical material additive to Guided content and no change to the verdict.

Nine pure engines own the units builder, physical scale ruler, photon equivalent converter, electrical standards network, hydrogen spectrum, particle scales, spin precession, blackbody spectrum, and particle-to-mole scaler. `TourSimulationStage.vue` dispatches by validated simulation ID and asynchronously loads only the selected instrument; Tour has no Plotly dependency. This conventional spine establishes standard physics and its limitations before source-specific tracks.

Scientific status and correction boundaries are part of the generated contracts and runtime findings. Exact, measured, derived, and illustrative values remain distinct; photon mass/temperature outputs are equivalent labels; current SI and 1990 electrical values are separated; Rydberg, particle, signed-spin, ideal-blackbody, amount, and standard-state assumptions stay visible; official IAU/CIPM references are linked; and every Tour runtime result keeps `validatesTheory: false`. The Tour does not alter the five-axis source-audit engine or hide the Atlas's 68 dimension conflicts.

Formula records lead with source-labelled meaning and caveats, never an independently authoritative definition. The authoritative `latest-output` audit is identity/NFC-bound to all 288 recipes: 70 exact records divide into 50 full, 18 almost-full, and 2 no-match assessments; 218 measured records divide into 217 within and 1 outside the source's 5.2-sigma criterion. Formula provenance separately locates `constants.yaml` and `sources/latest-output.txt`; the `V_m_1` caveat preserves 100 kPa source wording while disclosing `p_1 = 101325.003754773 Pa`.

Each v7 Formula record has a progressive constructor, separate source/runtime dependency graphs with parent edges, and separate constructor literals. Direct ledgers agree for 262 records; 26 differences remain disclosed. The 68 historical five-axis dimension conflicts stay visible, including the explicit inability to audit amount-of-substance semantics while `mol` is treated as dimensionless. The complete 65-row synthetic sensitivity table is always available, Plotly remains lazy, and the route supports Unicode identity, Tour return context, actual titles, and narrow/400%-equivalent reflow.

The local snapshot foundation uses strict schema version 1, finite plain JSON, safe keys/prototypes, cycle rejection, and a 512 KiB per-run cap. Formula snapshots separate selected sweep output from nominal scale-one comparison output; in-session comparison holds at most two states and uses compatibility key equality only. Incompatible states have no residual, while compatible Formula states may report only selected-real delta. The Local Notebook lists, links, deletes, and clears saved runs. Saved-run import/export, revision replay, migration, and broader storage management remain Iteration 10 work.

Core, Number Walls, and EARTH now share a capability-driven Workbench shell and one semantic mobile order. Strict scalar/base64url state preserves unrelated query values, canonicalizes invalid requests with an announced rejection, and follows browser history. Core is honestly route-evaluated, discloses unpinned external source identity, and keeps plot/projection state consistent. Number Walls defers source/worker work, carries exact-zero identity independently of display values, rejects composite valuation bases, and binds modular/valuation compatibility to the active base. The distinct `/labs/earth/:programId` surface skips dossier evidence shards while preserving exact method relationship, model origin, source/implementation revision, immutable dispatched inputs, progress/cancel, unavailable-method boundaries, saves, and comparisons. Output-schema revisions remain distinct from content revisions.

Generated Tour JSON is not automatically precached. The explicit Guided-only pack transactionally installs and validates 31 resources totaling 485,129 bytes at revision `2026-07-27`, includes all station lessons and simulations plus taxonomy as a self-contained fallback, preserves the prior complete pack on failure, and supports explicit clearing. Iteration 10 remains planned: richer packs, saved-run import/export and revision replay, migration/storage policy, and update warnings are not complete.

Production closure checks cover all Tour, Formula Atlas, Core, and Number Wall route groups and six EARTH view groups, including canonical and legacy document navigation. Evaluator signatures occur only in their dedicated workers; no aggregate Atlas or shared simulation worker remains.

The generated top-level `completion.json` reports only Formula, Number Wall, and Core registry coverage. Its `complete` field does not attest Tour learning completion, EARTH methods, Quantum/Gray labs, Gray FEM, PWA, accessibility, CI, or scientific validity; EARTH keeps a separate completion artifact and the other boundaries require their own tests and evidence.

Later residuals do not reopen completed iterations: Formula detail still evaluates all 288 recipes; successful registries intentionally remain session-cached; strict current Tour summary/count validation must update deliberately with future content; Formula saved-run import/export, revision replay, migration, and richer storage behavior belong to Iteration 10; and final budgets, forced-colors, and editorial work belongs to Iteration 11. Chromium remains the sole automated browser target.

Current reusable simulation foundations:

- Stable five-axis Atlas source-audit engine, nine pure Tour engines, and a separate seven-axis EARTH dimension representation.
- Units/dimensions, physical scales, photon equivalents, electrical standards, hydrogen spectra, particle scales, signed spin precession, ideal blackbody radiation, and particle-to-mole instruments.
- Exact, measured, derived, and illustrative statuses with explicit assumptions, provenance, conclusion boundaries, and `validatesTheory: false`.
- A transactional Guided Tour pack with validated manifest, taxonomy, vocabulary, glossary, references, chapter, lesson, and simulation resources.
- Meaning-first v7 Formula records with byte-pinned sources, dual provenance, progressive equations, dependency/dimension audits, complete sweep tables, and strict local snapshots.
- A shared responsive Workbench shell, strict announced URL state, explicit local saves, and declared two-snapshot compatibility for Core, Number Walls, and EARTH.
- 53 frequency/energy/mass/temperature bridge formula records.
- 64 particle formula records.
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

### 2026-08-16: post-Iteration-7 Gray checkpoint recorded

- Recorded the adjacent `/labs/edwin-gray` worker-backed 27-event workbench, seven compiled machine contracts, generated artifact and hardware-sensitive benchmark without changing the Iteration 8-11 statuses.
- Recorded original-versus-modified and source-versus-assumption boundaries, corrected diagram arithmetic and deficits, retained COP-300/raw-caption ambiguity, and preserved `validatesTheory: false`.
- Recorded rejected v1 and 18/33-rejected v2 production FEM evidence, the v2 pilot criteria, six-job symmetry infrastructure, retained but runtime-unavailable calibration values with explicit provenance mismatches, absent production LUT, blocked prototype FEM, and illustrative patent scope.
- Recorded PWA, accessibility, CI, Pug, and completion-artifact boundaries. No new aggregate full-suite total is claimed.

### 2026-07-27: Shared Workbench accepted

- Marked Iteration 7 technically complete in the containing commit.
- Accepted one capability-driven shell and action grammar for Core, Number Walls, and EARTH: stage, essential controls, run/cancel or route-evaluated state, reset, explicit save, immutable two-snapshot comparison, findings, full controls, evidence, and raw output.
- Accepted strict canonical scalar/base64url state with preserved foreign query values, browser-history restoration, explicit warnings for rejected requested state, and no automatic save or synchronization.
- Accepted route-evaluated Core with all 37 cases, consistent 2D/3D projection state, unpinned-source disclosure, no undefined generic residual, and compatibility-bound snapshots.
- Accepted deferred Number Walls payload/worker execution, exact payload hashes, exact-zero identity independent of all six display transforms, absent display extrema, prime-only valuations, mode-aware modulus/prime compatibility, stale-result disclosure, and pointer/keyboard cell inspection.
- Accepted distinct EARTH Workbench and Evidence surfaces: `/labs/earth/:programId` does not fetch dossier evidence shards; methods retain separate relationship, origin, source/implementation references and revisions; unavailable methods have no Run; worker inputs remain immutable; save and comparison feedback stays visible in Findings.
- `npm run verify` passed: generation, typecheck, 63 Vitest files with 659 tests, production build, and route checker passed. The default Chromium suite passed 103 tests and the production-preview PWA suite passed 1 test; independent scientific and UX acceptance: PASS; `git diff --check`: passed.
- Measured main JavaScript at 114.08 kB raw / 44.06 kB gzip, eager CSS at 91.53/15.45 kB, shared URL-state/snapshot chunk at 18.56/5.68 kB, Core at 16.67/6.39 kB, Number Walls at 26.35/9.88 kB, EARTH detail at 46.76/14.65 kB, and PWA precache at 79 entries / 3,918.70 KiB. Plotly remains lazy, runtime revision is `6647c006a9d3`, and initial compressed JavaScript remains below 200 KB.
- Preserved `scientificallyValidated: false`, all EARTH dataset/topology/derivation blockers, all source caveats, and the visible 68-conflict Atlas boundary.

### 2026-07-27: Formula specimen accepted

- Marked Iteration 6 technically complete in the containing commit.
- Accepted all 288 meaning-first Formula records with source-labelled exact/measured wording and no claim that source labels are definitions or validation. The identity/NFC-bound latest-output audit reports 70 exact records (68 criterion met, 2 not met; 50 full, 18 almost-full, 2 no match) and 218 measured records (217 within the source 5.2-sigma criterion, 1 outside).
- Bound exact fetched bytes to recipes SHA `fe17912cd1915171a3fa9d124f9154ce78f64da7f4a5e99b9b5361d0e4d64fa1` and symbols SHA `fbdbce921c993df9ccd726eade309b8735d5d84446f74c8b649571fa6e3fa9b6`; compatibility includes Formula ID, both hashes, implementation revision, and output schema v7.
- Accepted the progressive equation ladder, separate source/runtime parent-aware dependency ledgers with 262 direct matches and 26 disclosed differences, separate constructor literals, 68 visible historical five-axis conflicts, explicit `mol`/amount limitation, dual `constants.yaml`/`latest-output` provenance, and the `V_m_1` pressure wording correction.
- Accepted the always-available 65-row sweep table, lazy Plotly view, synthetic-sensitivity caveat, debounced search status, Unicode route/Tour round trip/actual title, 320 px and 400%-equivalent reflow, strict version-1 snapshots, two-state compatibility-only comparison, and local saved-run list/delete/clear.
- Confirmed Formula route ownership of recipes, symbols, registry, and formula worker only; all three JSON assets are revision-cached, with no Tour JSON or other evaluator worker in Formula closures.
- `npm run verify` passed: generation, typecheck, 58 Vitest files with 600 tests, production build, and route checker passed. The default Chromium suite passed 91 tests and the production-preview PWA suite passed 1 test; independent scientific and UX acceptance: PASS; `git diff --check`: passed.
- Measured main JavaScript at 113.05 kB raw / 43.71 kB gzip, eager CSS at 85.37/14.54 kB, Formula Atlas at 14.07/4.62 kB, Formula registry at 19.80/7.56 kB, Formula detail at 29.00/8.90 kB, saved-run registry at 8.43/2.99 kB, Saved view at 11.83/3.89 kB, formula worker at 15.27 kB raw, and PWA precache at 75 entries / 3,856.34 KiB. Plotly remains lazy, runtime revision is `6647c006a9d3`, and initial compressed JavaScript remains below 200 KB.
- Preserved Iteration 5 content, `scientificallyValidated: false`, all EARTH/data/topology blockers, all scientific caveats, and the visible 68-conflict boundary.

### 2026-07-27: conventional-physics spine accepted

- Marked Iteration 5 technically complete in the containing commit at content revision `2026-07-27`.
- Accepted 20 chapters split into 8 content-ready conventional and 12 planned mathematical/research chapters; 9 lessons; 9 simulations; all 8 quick stations content-ready at 27 minutes; 27 glossary entries; 10 references; and the 36,668-byte manifest.
- Accepted the units builder, physical scale ruler, photon equivalent converter, electrical standards network, hydrogen spectrum, particle scales, spin precession, blackbody spectrum, and particle-to-mole instruments as pure engines behind the lazy ID dispatcher, with no Plotly in Tour.
- Preserved equivalent-label, current-versus-1990 electrical, Rydberg-domain, dependent-representation, signed-phase, ideal-blackbody, amount, and standard-state boundaries; exact/measured/derived/illustrative statuses; official IAU/CIPM references; and runtime `validatesTheory: false`.
- Confirmed the explicit Guided pack contains 31 transactionally validated resources totaling 485,129 bytes (about 474 KB), covers every station lesson and simulation, and remains separate from automatic Tour JSON precache.
- `npm run verify` passed: generation, typecheck, 53 Vitest files with 544 tests, production build, and route checker passed. The default Chromium suite passed 85 tests and the production-preview PWA suite passed 1 test; independent scientific and UX acceptance: PASS; `git diff --check`: passed.
- Measured main JavaScript at 112.97 kB raw / 43.67 kB gzip, eager CSS at 75.67/12.96 kB, Tour CSS at 37.92/6.37 kB, base lesson at 24.64/7.86 kB, each lazy instrument at about 19.32-30.50/6.71-9.53 kB, and PWA precache at 73 entries / 3,789.31 KiB. Initial compressed JavaScript remains below 200 KB and the manifest remains below 100 KB.
- Preserved `scientificallyValidated: false`, all EARTH/data/topology blockers, all scientific caveats, and the visible 68-conflict Atlas boundary.

### 2026-07-26: orientation and units vertical slice accepted

- Marked Iterations 3 and 4 technically complete in the containing commit.
- Accepted orientation, the continuous eight-station spine, 20 chapters across four acts, persisted Guided/Technical depth, anchor-aware Begin/Resume, independent station and lesson progress, evidence/saved/not-found routes, legacy topic redirects, generated titles, and modal mobile navigation.
- Accepted the 11-minute full units lesson and four-minute Guided quick subset with six-stage grammar, exact SI anchors, prediction and presets, SI/mechanical-CGS coordinates, energy-versus-torque and unlike-addition boundaries, additive Technical content, complete provenance/conclusions, keyboard/reduced-motion/reflow support, and the explicit Guided pack.
- Confirmed the Guided pack contains 8 transactionally validated resources totaling 146,033 bytes (about 143 KB) at revision `2026-07-26`, includes a self-contained taxonomy fallback, is never installed by automatic Tour JSON precache, and can be cleared. Iteration 10 remains planned for richer packs and persistence/storage policy.
- `npm run verify` passed: generation, typecheck, 46 Vitest files with 419 tests, production build, and route checker passed. The default Chromium suite passed 65 tests and the production-preview Chromium PWA suite passed 1 test; independent code review and scientific/UX acceptance: PASS; `git diff --check`: passed.
- Measured main JavaScript at 111.29 kB raw / 42.93 kB gzip, eager CSS at 75.67/12.96 kB, lazy Tour CSS at 37.92/6.37 kB, TourLesson at 48.55/14.29 kB, initial Tour data at about 52.9 KB, and PWA precache at 55 entries / 3,555.86 KiB. Runtime registry revision was `66041e36e1a4`.
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
- Confirmed exact-key and inert-text enforcement, closed references and navigation, and generated-only compatibility-key derivation. The seven other station lessons and simulations were later delivered in Iteration 5.
- Full `npm run verify` passed: generation produced 20 chapters, 1 lesson, 1 simulation, 11 glossary entries, 5 references, and 8 stations totaling 27 minutes; Vitest passed 37 files and 252 tests; typecheck and the production PWA build passed.
- Current production measurements are 116.11 kB raw / 45.28 kB gzip for main JavaScript, 71.81 kB raw / 12.43 kB gzip for main CSS, and 76 precache entries / 4,538.81 KiB.
- Focused verification passed 18/18; `git diff --check` passed; independent acceptance review: PASS.
- Preserved `scientificallyValidated: false`; technical acceptance does not change any scientific boundary.

### 2026-07-26: baseline recorded

- Committed schema-v2 EARTH program/method registry, 193 lazy evidence shards, 19-dataset ledger, route dossier, worker execution, accessibility hardening, and PWA cache boundaries.
- Confirmed 130 programs, 220 methods, 134 runnable methods, 86 unavailable source records, and `scientificallyValidated: false`.
- Recorded the Physics Tour product contract and initialized this implementation ledger.

## Next implementation step

Implement Iteration 8's mathematical-instrument curriculum, including number-wall and quartic/root lessons plus null-model and base-dependence caveats. Iterations 9 through 11 remain planned.
