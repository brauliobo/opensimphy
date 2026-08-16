# OpenSimPhy Reproduction Atlas

OpenSimPhy is a static, browser-only Vue instrument for reproducing and auditing the formula and number-wall claims published by [Physics Monastery](https://www.physicsmonastery.earth/). It is an inspection surface for preserved source data and the local TypeScript engine, not a server client and not an assertion that the source theory is valid.

## Scientific Scope

The atlas covers:

- 288 ordered, meaning-first Formula records recovered from the site's `288` presentation and Transform Dictionary, with source-labelled exact/measured wording and no claim that those labels are authoritative definitions or validation.
- 351 source number-wall inputs: 18 famous sequences, 45 mathematical constants, and 288 constants-of-nature entries.
- Every case in the core simulation registry, including Planck complex surfaces, quartic root loci, invariant checks, companion dynamics, manifold/dilogarithm cases, transform-space, constructor transforms, and coherent/typed units.
- Source metadata for recovered site artifacts and the contextual local PDF corpus.
- A locked, inert inventory of 63 EARTH Markdown documents with syntax-level formula, heading, code, claim-candidate, and simulation-candidate records.
- A source-linked registry of 130 canonical EARTH programs across 17 prefixes. Its 220 declared methods comprise 134 runnable methods and 86 unavailable EARTH source-model records; unavailable records have no kernel and cannot be selected as a default or run.
- An authenticated metadata registry for 19 external dataset candidates and four disputed source claims; no dataset is represented as acquired, frozen, or G0b-passing without bytes and an acquisition record.

**Reproduction is not validation.** A reproduced value shows that the implemented expression and preserved inputs produce the stated result under the recorded conventions. It does not independently establish a derivation, physical mechanism, novelty, prediction, statistical significance, or theory validity.

## Architecture

The application has no API URL and requires no application server:

```text
public/data/generated   source-derived Tour, recipe, taxonomy, wall, symbol, completion, provenance registries
public/data/generated/earth
                         locked EARTH registries, completion, evidence manifest, 130 program shards, and 63 document shards
public/data/number-walls
                         preserved per-input static JSON
data/physics_monastery  non-public recovered PDF/text source artifacts used by generation
content/tour            attributed Tour source content and generated-artifact contracts
src/engine              typed numerical engines, evaluation functions, and the completionReport parser
src/registries          independent route-owned registries and the runtime audit session ledger
src/tour                pure Tour engines, progress model, and transactional offline pack
src/workbench           strict URL state, SHA-256, version-1 snapshots, and saved-run validation
src/workers             dedicated formula, Core, number-wall, and isolated EARTH workers
src/components/tour     lesson grammar, instruments, and ID-based lazy simulation dispatcher
src/quantum-wave        bounded quantum-wave teaching engine and source-map guide
src/edwin-gray          bounded Gray pulsed-motor engine and source-map guide
src/components/quantum  reusable wave, operator, probability, tooltip, and equation instruments
src/components          navigation, shared Workbench shell, coverage, Plotly, and canvas instruments
src/views               lazy-routed tour, atlas, lab, EARTH dossier/program/data, and provenance views
tests/ui                Vitest and Vue Test Utils contracts
tests/e2e               Playwright browser audit
```

Routes own their data directly through `src/registries` rather than a global Atlas initializer or shared worker. Tour owns its manifest, taxonomy, and lazily loaded chapter, lesson, simulation, glossary, and reference artifacts. Formula Atlas and detail routes own exact fetched bytes for `recipes.json`, `symbols.json`, and `registry.json`, plus the dedicated formula worker; all three JSON assets use revisioned runtime caches, and Formula routes load no Tour JSON or other evaluator workers. Core owns only the dedicated Core worker. Number Walls loads its compact index for browsing, then fetches the selected payload and dynamically imports its worker only when the user chooses Run. EARTH remains isolated behind its own registries, evidence shards, and terminating simulation worker.

`src/registries/runtimeAudit.ts` publishes an additive session ledger as route domains become ready, while `src/registries/completionRegistry.ts` validates generated completion data through the strict `completionReport` parser. Formula figures are converted from worker-produced inversion-sweep points and markers. Core plots must come from Core worker results, and wall canvases must come from wall worker results. Missing graph or worker output has no placeholder fallback: coverage and the corresponding panel remain incomplete.

At Tour revision `2026-07-27`, the content pipeline deterministically generates 20 chapter shells in four acts: 8 content-ready conventional-physics chapters and 12 planned mathematical/research chapters. It contains 9 lessons, 9 simulations, 27 glossary entries, 10 references, and a 36,668-byte manifest. All eight quick stations are content-ready and total 27 minutes. The lesson renderer uses six stages: Question, Observe, Explain, Equation ladder, Try, and Interpret. Generation fails closed on attribution, ownership, navigation, current summary counts, compatibility, or reference drift.

Nine pure TypeScript Tour engines evaluate bounded inputs without network calls or Plotly. `TourSimulationStage.vue` dispatches by simulation ID and lazily imports only the selected instrument: units builder, physical scale ruler, photon equivalent converter, electrical standards network, hydrogen spectrum, particle scales, spin precession, blackbody spectrum, or particle-to-mole scaler. The conventional spine establishes standard physics and its limits before later source-specific tracks.

Plotly is dynamically imported into its own lazy chunk and Formula sweeps mount it only when their detail disclosure opens; the complete 65-row sweep table is always available. Number-wall values are rendered with canvas so exact source strings and exact-zero identity can be retained for pointer or keyboard cell inspection without creating a DOM node for every cell. Formula browsing is paginated at 24 rows with debounced result-status announcements; topic, category, search, and basis stay primary while source criterion, dimension audit, constructor, and representation remain in an advanced disclosure.

### Physics Tour

`/` provides orientation, Begin/Resume controls, all eight available station links, and Guided-pack controls. `/tour` presents the 20-chapter/four-act map; `/tour/:chapter` and `/tour/:chapter/:lesson` provide chapter and lesson routes with generated titles and real section anchors. `/evidence`, `/saved`, and `/not-found` provide scope guidance, local progress/offline-pack management, and recovery. Legacy `/topics/:id` links redirect to their mapped Tour chapters.

`/labs/quantum-wave` is a standalone, browser-local teaching lab built from the downloaded and transcribed reference video `3QU-_PSbKlo`. It preserves the source video, Whisper outputs, scene samples, and curated frame inventory under `../research/opensimphy-video/`, while the app ships original SVG recreations for spectral lines, standing waves, operators, Fourier sums, complex-plane rotation, Schrodinger equation assembly, double-slit probability, and hydrogen/materials applications. The page links back to the established Tour, Atlas, Workbench, and Evidence surfaces and keeps all results explicitly modelled/computed rather than validated.

`/labs/edwin-gray` is a second video-derived lab. It reconstructs the Cole/Hackenberger/Gray pulsed-capacitor motors from `Motor Edwin Gray.txt` and YouTube `nC740fpBs4M` as a classical RLC dump through open-core poles, with a presenter-reported 500 rpm quench reference and a COP ledger that does not treat historical COP-300 claims as established physics. Source media belong under `../research/opensimphy-edwin-gray/`.

The post-Iteration-7 Gray checkpoint compiles seven versioned machine contracts into one deterministic 16,523-byte (16.5 KiB) runtime artifact. Its dedicated worker executes the complete 27-event-per-revolution motor schedule and keeps rotor geometry, circuit state, solved recovery branch, event and aggregate energy ledgers, strict URL state, explicit saves, and compatible two-snapshot comparison on one dispatched input/result boundary. A recorded seven-model, 100-revolution benchmark measured about 24.84 ms aggregate median on this host; this is a hardware-sensitive wall-clock observation, not a portable performance guarantee. A later documentation recheck measured 25.96 ms while preserving finite outputs, closed numerical energy boundaries, COP at or below one, and the 100-revolution completion gate.

Gray provenance separates source statements from modifications. Patent-described topology and sequencing, presenter reports, retained captions, and prototype identities remain source records; dimensions, materials, winding/surrogate values, the classical RLC/recovery equations, and the zero-minimum-speed `modified-electronic-v1` quench rule are explicit assumptions or illustrative modifications. The presenter-reported original configuration retains its separate `original-500rpm-contact-v1` boundary, and the Schloff rewind/Zener-trigger/no-load reports are not merged into original-machine efficiency. The user-provided diagram's `7,460 W / 26.8 W` arithmetic is `278.358`, not its displayed 282; a COP-282 target at 26.8 W would require 7,557.6 W. The audit reports 7,433.2 W and 7,530.8 W unaccounted deficits for the observed output and displayed-COP target respectively until a complete energy boundary is supplied. It separately retains the presenter-attributed COP-300 claim and the ambiguous raw caption `7 12 kilowatts`; neither is imported into the motor ledger.

No production Gray FEM lookup table exists. The production v1 pilot was rejected on mesh partition growth and outer-domain sensitivity; the v2 pilot report passed its declared checks, but its `0.02` threshold is a pass criterion rather than an uncertainty bound, and the v2 production convergence report is rejected because only 18 of 33 required samples are present. The fast publication design provides six-job, three-representative-plus-three-validation symmetry infrastructure, not a published production result. Retained three-class calibration values are unavailable at runtime: the pilot model hash, current specification hash, and coarse/fine sample angle do not match the calibration run. They remain audit data with `status: unavailable-provenance-mismatch`, `runtimeAvailable: false`, and `productionEligible: false`; class 1/2 transfer is an unvalidated assumption and torque is unbounded. Compact checksummed evidence is retained under `fem/edwin-gray/evidence/v2/`. Prototype machine contracts remain descriptive and FEM-blocked because prototype-specific geometry is unavailable, while the patent contract and runtime are illustrative rather than a manufactured-machine replica or experimental validation.

Guided or Technical depth persists locally, with Technical content added without replacing Guided material. Visits do not imply completion: quick-station and full-lesson progress are independent, and Resume points to the last real lesson anchor. The spine's instruments cover dimensions and SI/mechanical-CGS coordinates, physical scales, photon equivalents, current and historical electrical standards, hydrogen-like spectra, dependent particle representations, signed spin precession, ideal blackbody radiation, and particle-to-mole scaling.

Every lesson and runtime finding keeps exact, measured, derived, and illustrative statuses distinct and reports `validatesTheory: false`. Scientific corrections remain explicit: equivalent mass and temperature are labels rather than photon rest mass or a thermal state; current SI electrical relationships differ from 1990 conventional values; the Rydberg model has bounded assumptions; linked particle quantities are dependent representations; spin phase uses a declared sign convention; blackbody output is idealized; and mole/standard-state results depend on stated amount, composition, temperature, and pressure assumptions. Official IAU and CIPM records supplement BIPM, CODATA, JCGM, NIST, and textbook references.

### Formula Atlas

All 288 records lead with the named source target, unit, taxonomy context, and preserved-label caveats before revealing the constructor. The authoritative `latest-output` audit records are bound one-to-one to recipe identities with Unicode NFC checks: 70 are source-labelled exact, with 68 meeting the published digit criterion (50 full match and 18 almost-full match) and 2 not meeting it; 218 are source-labelled measured, with 217 within the source's 5.2-sigma criterion and 1 outside it. These are source reproduction criteria, not independent definitions, evidence, or scientific validation.

Formula source bytes are pinned by SHA-256: recipes `fe17912cd1915171a3fa9d124f9154ce78f64da7f4a5e99b9b5361d0e4d64fa1` and symbols `fbdbce921c993df9ccd726eade309b8735d5d84446f74c8b649571fa6e3fa9b6`. The registry hash-checks the exact fetched text before parsing. Each compatibility key includes the Formula ID, both hashes, implementation revision `formula-evaluator-contract-v1`, and output schema `formula-record-v7`.

The detail route provides a progressive equation ladder and separate preserved-source/current-runtime dependency ledgers, including parent edges; constructor literals remain separate from dependencies. Direct dependencies agree for 262 records, while 26 qualified differences are disclosed without merging the ledgers. The historical five-axis audit still reports 68 dimension conflicts and explicitly cannot audit amount of substance because it treats `mol` as dimensionless. Provenance links both `constants.yaml` recipe material and `sources/latest-output.txt`; `V_m_1` preserves the source's 100 kPa wording while disclosing that dependency `p_1` is `101325.003754773 Pa`.

The synthetic inversion-boundary sweep is sensitivity analysis, not uncertainty propagation or a physical trajectory. Its accessible table remains available without Plotly; the plot is lazy. Formula routes support Unicode IDs, Tour return links, generated document titles, keyboard use, and 320 px/400%-equivalent reflow.

### Local Notebook

Formula detail can explicitly save a local version-1 snapshot or freeze up to two in-session comparison states. Snapshots separate the selected synthetic sweep point from nominal scale-one source-comparison outputs. Comparison uses only the compatibility key: incompatible states show findings in parallel with no residual, while compatible Formula states may report only the selected-real delta.

The saved-run registry accepts finite plain JSON only, rejects unsafe keys, non-plain prototypes, cycles, sparse/decorated arrays, and unsupported values, and caps each serialized run at 512 KiB. `/saved` lists, links, deletes, or clears local Formula, Core, Number Walls, and EARTH runs. Run import/export, revision replay, richer storage management, and saved-run migration remain Iteration 10 work; Tour progress import/export is a separate existing feature.

### Shared Workbench

`/labs` links to Core, Number Walls, and a bounded EARTH method route. All three use one capability-driven shell with the same stage, essential controls, action, findings, full-controls, evidence, and raw-result order. URL-owned state is strictly parsed and canonicalized; rejected requested values remain visibly announced instead of silently becoming defaults. Reset, explicit save, immutable two-snapshot comparison, structured findings, progress/cancel state, and advanced disclosures use one action grammar without duplicate domain controls.

Core remains route-evaluated and exposes no fake Run action. It labels external sources as unpinned, prevents 2D/3D plot-state contradictions, and does not expose its case-specific internal diagnostic as a generic scientific residual. Number Walls still defers payload and worker loading until Run; exact determinant zero identity is independent of display transforms, absent display extrema remain absent, valuation mode requires a prime, and modular/valuation compatibility binds the active modulus or prime. `/labs/earth/:programId` is a distinct Workbench surface that does not load dossier evidence shards; canonical `/earth/programs/:id` retains Evidence ownership. Traditional, source-reproduction, validator, and unavailable EARTH methods keep separate source/implementation references, revisions, origins, and conclusion boundaries.

### EARTH Program, Method, and Result Model

- A **program** is one of the 130 canonical scientific questions or audit dossiers identified by `programId`.
- A **method** is a provenance-specific implementation option under a program, identified by `methodId`. The 134 runnable methods split into 37 EARTH source reproductions and 97 traditional analytic/numerical baselines or source-contract validators. The latter are independent tools and are not EARTH-derived results.
- A **result** is one execution of one runnable `(programId, methodId)` pair with explicit inputs. Result schema v2 records both identifiers, execution status, method relationship, model origin, whether the method is EARTH-derived, and `validatesEarthTheory: false`.

`EARTH-THERM-006`, `EARTH-COS-006`, `EARTH-PLAN-008`, and `EARTH-PLAN-012` are provenance-pure two-method pilots: each exposes a source reproduction and a separate traditional analytic baseline, each with its own defaults and result. The remaining unavailable source-model records preserve what the corpus proposes and what is missing; they do not contain executable kernels. See `../research/earth-thad-nassim/TRADITIONAL_PHYSICS_METHODS.md` for the baseline taxonomy and provenance rules.

The EARTH dossier uses canonical routes `/earth`, `/earth/corpus`, `/earth/corpus/:slug`, `/earth/programs`, `/earth/programs/:id`, and `/earth/datasets`. `/earth/simulations`, `/earth/simulations/:id`, and `/earth/:slug` remain legacy aliases. Dossier-local navigation, compact URL-backed ledgers, typed method inputs with advanced JSON editing, structured findings plus raw artifacts, and safe reading/exact-source modes are available across responsive and keyboard-accessible layouts. Runnable records link to the separate `/labs/earth/:programId` Workbench surface.

## Definition of Done

A release is complete only when all of the following are true at the same generated-data revision:

`public/data/generated/completion.json` is narrowly the generated Formula/Number-Wall/Core registry audit. Its `complete: true` does not cover Tour lesson completion, EARTH method completion, Quantum or Gray labs, Gray FEM, PWA behavior, accessibility, CI, or scientific validation. EARTH has its own `public/data/generated/earth/completion.json`; release claims still require the independent checks listed below.

- Formula coverage is exactly `source 288 / implemented 288 / evaluated 288 / graphed 288`.
- Number-wall coverage is exactly `source 351 / implemented 351 / simulatable 351`.
- Core coverage equals the exact core registry count for implemented, graphed, and simulatable cases; the registry must not be empty.
- Every formula reports engine `graphReady`, and first, middle, and last detail routes render a live Plotly graph.
- Every core registry case reports graph readiness and renders through its case tab.
- Every wall input passes the engine’s small-simulation completion audit, and the UI produces a canvas result in all supported worker modes.
- `data-testid="coverage-status"` has `data-status="complete"`; any mismatch must instead render `FAIL CLOSED / INCOMPLETE`.
- Type checking, engine tests, UI tests, the production build, and the Chromium suite pass.
- The production build contains a web manifest and service worker whose precache excludes route-owner JSON, all generated Tour JSON, and the formula, Core, and number-wall worker assets; Atlas registries use bounded, content-revisioned runtime caches, while Tour offline use is explicit.
- EARTH registry and completion schema v2 distinguish 130 programs, 220 declared methods, and 134 runnable methods. Every program default names a runnable method; all 134 runnable `(programId, methodId)` pairs complete through the dedicated browser-worker boundary, while all 86 unavailable source-model records have no kernel and cannot be defaulted or run.
- The compact EARTH evidence manifest indexes exactly 130 program shards, 63 document shards, and 2,422 assignments: 1,984 canonical-program assignments and 438 classified assignments. The large source-coverage ledger remains excluded from precache.
- All 30 dataset-audit programs carry corrected G0b states, and all 19 programs requiring observable-independence review carry explicit G2a states. Dataset assignments remain program-level until acquisition and preregistration freeze them for a specific method.
- EARTH execution completion remains distinct from scientific validation: source limitations stay visible, comparison methods stay labeled as comparisons, and the aggregate `scientificallyValidated` value remains `false` until the applicable external gates pass.

The global strip compares expected, implemented, evaluated, graphed, and simulatable counts. Not every operation applies equally to every domain, but release completion uses the required domain-specific columns above rather than silently treating an inapplicable zero as success.

## Worker Model

Each route registry starts independently, rejects stale in-flight results, exposes retry after failure, and keeps successful data cached for the browser session. Formula and Core registries evaluate through separate cancellable workers; final-owner release cancels unfinished work. Number Walls loads only its index during route initialization, then loads one payload and dynamically imports a fresh number-wall worker on Run. Runnable EARTH methods use their own terminating worker boundary with cloned JSON defaults and no main-thread fallback. The UI does not send inputs to a network service and does not fall back to unbounded main-thread computation when a worker is unavailable.

The PWA precaches the app shell but excludes route-owner JSON, every generated Tour JSON artifact, and the dedicated formula, Core, and number-wall workers. Deterministic Atlas registries use content-revisioned `NetworkFirst` caches with a 5-second timeout and 7-day bound. Per-wall JSON, EARTH document shards, evidence shards, and Plotly retain their bounded runtime policies.

Quantum and Gray remain adjacent, lazy lab routes rather than Tour chapter completions. Gray runtime assets use deliberate bounded runtime caching rather than being promoted into automatic Tour offline packs. Current Pages/frontend CI gates the generated Gray contract check, focused Gray tests, FEM validation, build/route boundaries, and the Chromium Gray journey. The Gray journey records keyboard operation, visible focus, 44 px targets, 320-1440 px reflow, reduced motion, forced-colors distinctions, worker progress association, URL rejection/recovery, and save/compare behavior. The verified core OpenSimPhy set contains 58 Vue SFCs and all 58 use Pug templates; the raw repository total of 66 also includes four Fiddle and four Awesome Physics adjacent-route bridge SFCs, which are outside that core count and also currently use Pug.

Tour offline use is opt-in rather than automatic. The current Guided-only pack contains 31 validated resources totaling 485,129 bytes (about 474 KB) at content revision `2026-07-27`, including every station lesson and simulation. Installation is transactional, the included taxonomy provides a self-contained fallback, and `/` or `/saved` can install, refresh, inspect, or clear it. Generated Tour JSON is never automatically precached. Iteration 10 remains planned for richer packs, saved-run import/export and replay, migration/storage policy, and update warnings.

## Commands

Node 20.19 or newer is required.

```bash
npm install
npm run dev
npm run data:generate
npm run data:lock:earth
npm run typecheck
npm run test:engine
npm run test:ui
npm run test:gray
npm run gray:compile:check
npm run gray:benchmark
npm run fem:validate
npm test
npm run e2e
npm run e2e:chromium
npm run e2e:pwa
npm run verify
```

`npm run verify` runs deterministic data generation, regenerates the Chenopdodium Fiddle registry and normalized runtime ledger from the committed evidence, then runs type checking, all Vitest suites, the production build, and `check:routes`. The route check inspects built transitive closures, dedicated worker isolation, and PWA ownership boundaries. Playwright is separate because it requires Chromium: `npm run e2e` and `npm run e2e:chromium` run the default development-server suite, while `npm run e2e:pwa` builds and runs the service-worker test against production preview.

`npm run data:generate` rebuilds the deterministic browser registries and completion audit from retained source artifacts. It fails if the sibling EARTH corpus differs from `public/data/sources/earth-source-lock.json`. `npm run data:lock:earth` is the explicit acceptance path for a clean new EARTH revision. `npm run data:acquire` is the explicit network refresh path for the 351 source payloads; both update commands are intentionally excluded from routine verification so a source change cannot silently rewrite the corpus.

UI tests cover fail-closed completion, route ownership, Tour progress and offline transactions, all nine Tour instruments, meaning-first Formula records, dependency/provenance audits, strict snapshots and URL state, the shared Workbench, responsive navigation, strict EARTH adapters, and worker lifecycles. The last recorded aggregate Iteration 7 verification remains the 2026-07-27 run: `npm run verify` passed with 63 Vitest files and 659 tests; generation, type checking, production build, and `check:routes` passed; the default Chromium suite passed 103 tests and the production-preview PWA suite passed one test. Post-Iteration-7 commits record focused Gray engine/UI contracts, the current 11-test Chromium Gray workbench journey, FEM contract/convergence/calibration validation, generated-artifact checking, and CI gates; no newer aggregate full-suite count is claimed here. Scientific and UX acceptance statements confirm implementation boundaries, not scientific validation.

## Static Deployment

Build and serve the generated directory from any static host:

```bash
npm run build
npx vite preview --host 127.0.0.1
```

Deploy the contents of `dist/`. `netlify.toml` supplies the build command, publish directory, and SPA history fallback. Other static hosts must route unknown navigation paths to `index.html` while serving asset and data URLs normally. No Node, Python, database, API process, or server-side rendering is used in production.

For GitHub Pages, `npm run build:pages` uses `VITE_BASE_PATH=/opensimphy/` from the deployment workflow and generates `dist/404.html` as an SPA deep-link fallback.

## Browser Support

The tested target is current stable Chromium with ES2022 modules, Web Workers, service workers, canvas, dynamic imports, and BigInt support. Interactive 3D plots require WebGL. The layout supports narrow mobile viewports, keyboard focus, labeled controls, reduced-motion preferences, and touch navigation. A browser that blocks WebGL can still inspect formula/audit text, but graph readiness will not be represented as a successfully rendered Plotly panel.

## Provenance

Direct simulation provenance is limited to recovered Physics Monastery material:

- `https://www.physicsmonastery.earth/`
- `https://www.physicsmonastery.earth/288`
- the 169-page Transform Dictionary
- the recovered `288` and combinatorics PDFs
- `constants.yaml`, `symbols.csv`, and `sources/latest-output.txt`
- `https://www.physicsmonastery.earth/number-walls/data/<file>.json`

The generated recipe and wall registries are derived artifacts, not replacement source records. Formula provenance separately identifies the recipe source (`constants.yaml`) and authoritative source-audit artifact (`sources/latest-output.txt`), with exact fetched-byte hashes recorded in `registry.json`. `public/data/sources/manifest.json` records acquisition date, URL, status, byte size, and SHA256 for wall payloads. `public/data/sources/earth-source-lock.json` pins the EARTH revision, declared license, paths, byte sizes, and SHA256 values. `public/data/generated/earth/manifest.json` records the parser policy and document inventory; its formula, claim, code, and simulation ledgers distinguish exact syntax from heuristic candidates and never execute source code. `public/data/generated/provenance.json` records source/context distinctions and local PDF metadata. The parent corpus `../INDEX.md` remains authoritative for local paths, page counts, byte sizes, hashes, source URLs/DOIs, and failed-access notes.

The Curtis R. Horn Jr. and Nassim Haramein PDFs are contextual cross-links unless a registry case explicitly identifies a concept link. Contextual proximity is not direct formula provenance. No redistribution license is inferred from public accessibility; source rights remain with the relevant authors and publishers.

## Known Limitations and Data Issues

- The preserved published run reports 70 source-labelled exact entries (68 meeting and 2 not meeting its digit criterion) and 218 source-labelled measured entries (217 within and 1 outside its 5.2-sigma criterion). The two exact non-matches concern molar volume and Loschmidt constant reference-condition differences; the measured outlier is a Sackur-Tetrode case. These source labels and criteria are not authoritative definitions or validation.
- Source notation mixes SI definitions, measured constants, mathematical constants, model values, relationship symbols, and author-defined symbols. Unit strings and dimensions require typed audits rather than display-only comparison.
- The current typed engine reports 68 recipe dimension declarations that do not match its resolved five-axis dimension vector. These are audit findings, not silently coerced units.
- A z-score is not meaningful for an exact definition. For measured quantities, correlated CODATA inputs and shared formula dependencies mean displayed z-scores are not necessarily independent statistics.
- Selecting mathematical constants, transforms, formula forms, tolerances, or significant digits after observing target values creates selection and multiple-comparison concerns. A dense set of matches is not by itself evidence of predictive power.
- Float64 execution is a reproduction precision choice. It does not preserve every source decimal and does not replace arbitrary-precision or symbolic verification where those are scientifically required.
- Website content and number-wall JSON can drift after acquisition. Generated registries must be rebuilt and completion rerun when source hashes change.
- Some related papers could not be acquired because of Akamai/Cloudflare protection, HTTP `403`/`429`, or timeout. The corpus records those failures and does not substitute reconstructed or placeholder PDFs.
- The 134 runnable EARTH methods provide bounded technical execution, not blanket implementation of the 86 unavailable source models. Of the runnable methods, 37 reproduce source expressions and 97 are traditional analytic/numerical baselines or source-contract validators. No external dataset has been acquired or frozen, none has passed G0b, assignments are not method-frozen, and aggregate scientific validation remains false.
- Offline Tour use currently covers only the explicit Guided pack. Richer packs, saved-run import/export and replay, migration/storage policy, and update warnings remain Iteration 10 work; final performance, forced-colors, and editorial review remain Iteration 11 work. Clearing site storage removes cached shell, data, progress, and packs.
- Tour generation currently enforces strict summary counts for 20 chapters, 8 content-ready stations, 9 lessons, 9 simulations, 27 glossary entries, and 10 references; those contracts must be updated deliberately when future content expands.
- Formula saved runs are local snapshots, not revision replay or a reproducibility guarantee. Import/export, migration, storage quotas beyond the 512 KiB per-run cap, and revision-aware replay remain Iteration 10 work.
