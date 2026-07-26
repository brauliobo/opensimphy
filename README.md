# OpenSimPhy Reproduction Atlas

OpenSimPhy is a static, browser-only Vue instrument for reproducing and auditing the formula and number-wall claims published by [Physics Monastery](https://www.physicsmonastery.earth/). It is an inspection surface for preserved source data and the local TypeScript engine, not a server client and not an assertion that the source theory is valid.

## Scientific Scope

The atlas covers:

- 288 ordered formula recipes recovered from the site’s `288` presentation and Transform Dictionary.
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
public/data/generated   source-derived recipe, taxonomy, wall, symbol, completion, provenance registries
public/data/generated/earth
                         locked EARTH registries, completion, evidence manifest, 130 program shards, and 63 document shards
public/data/number-walls
                         preserved per-input static JSON
data/physics_monastery  non-public recovered PDF/text source artifacts used by generation
src/engine              typed numerical registries and evaluation functions
src/workers             browser workers for cancellable computation
src/composables         strict UI adapter and completion state
src/components          navigation, coverage, Plotly, and canvas instruments
src/views               lazy-routed tour, atlas, lab, EARTH dossier/program/data, and provenance views
tests/ui                Vitest and Vue Test Utils contracts
tests/e2e               Playwright browser audit
```

`src/composables/atlasEngine.ts` is the UI boundary. Formula figures are converted from engine-produced inversion-sweep points and markers. Core plots must come from the core registry. Wall canvases must come from worker results. Missing graph or worker output has no placeholder fallback: coverage and the corresponding panel remain incomplete.

The generated taxonomy classifies every formula into one of eight scientific topics and a subordinate category, then records cross-cutting basis, constructor, dependency-pass, source-unit, representation, entity, and source-topology facets. Generation fails closed if a topic count, category count, or curated tour example drifts from the 288-recipe source snapshot.

Plotly is dynamically imported into its own lazy chunk and formula sweeps are mounted only when their detail disclosure is opened. Number-wall values are rendered with canvas so exact source strings can be retained for cell inspection without creating a DOM node for every cell. Formula browsing is paginated at 24 rows; topic, category, search, and basis stay primary while source topology, audit state, constructor, and representation remain in an advanced disclosure.

### EARTH Program, Method, and Result Model

- A **program** is one of the 130 canonical scientific questions or audit dossiers identified by `programId`.
- A **method** is a provenance-specific implementation option under a program, identified by `methodId`. The 134 runnable methods split into 37 EARTH source reproductions and 97 traditional analytic/numerical baselines or source-contract validators. The latter are independent tools and are not EARTH-derived results.
- A **result** is one execution of one runnable `(programId, methodId)` pair with explicit inputs. Result schema v2 records both identifiers, execution status, method relationship, model origin, whether the method is EARTH-derived, and `validatesEarthTheory: false`.

`EARTH-THERM-006`, `EARTH-COS-006`, `EARTH-PLAN-008`, and `EARTH-PLAN-012` are provenance-pure two-method pilots: each exposes a source reproduction and a separate traditional analytic baseline, each with its own defaults and result. The remaining unavailable source-model records preserve what the corpus proposes and what is missing; they do not contain executable kernels. See `../research/earth-thad-nassim/TRADITIONAL_PHYSICS_METHODS.md` for the baseline taxonomy and provenance rules.

The EARTH dossier uses canonical routes `/earth`, `/earth/corpus`, `/earth/corpus/:slug`, `/earth/programs`, `/earth/programs/:id`, and `/earth/datasets`. `/earth/simulations`, `/earth/simulations/:id`, and `/earth/:slug` remain legacy aliases. Dossier-local navigation, compact URL-backed ledgers, a multi-method workbench, typed inputs initialized from each method's defaults with advanced JSON editing, structured findings plus raw artifacts, and safe reading/exact-source modes are available across responsive and keyboard-accessible layouts.

## Definition of Done

A release is complete only when all of the following are true at the same generated-data revision:

- Formula coverage is exactly `source 288 / implemented 288 / evaluated 288 / graphed 288`.
- Number-wall coverage is exactly `source 351 / implemented 351 / simulatable 351`.
- Core coverage equals the exact core registry count for implemented, graphed, and simulatable cases; the registry must not be empty.
- Every formula reports engine `graphReady`, and first, middle, and last detail routes render a live Plotly graph.
- Every core registry case reports graph readiness and renders through its case tab.
- Every wall input passes the engine’s small-simulation completion audit, and the UI produces a canvas result in all supported worker modes.
- `data-testid="coverage-status"` has `data-status="complete"`; any mismatch must instead render `FAIL CLOSED / INCOMPLETE`.
- Type checking, engine tests, UI tests, the production build, and the Chromium suite pass.
- The production build contains a web manifest and service worker with app-shell/generated-registry precache plus number-wall and Plotly runtime caches.
- EARTH registry and completion schema v2 distinguish 130 programs, 220 declared methods, and 134 runnable methods. Every program default names a runnable method; all 134 runnable `(programId, methodId)` pairs complete through the dedicated browser-worker boundary, while all 86 unavailable source-model records have no kernel and cannot be defaulted or run.
- The compact EARTH evidence manifest indexes exactly 130 program shards, 63 document shards, and 2,422 assignments: 1,984 canonical-program assignments and 438 classified assignments. The large source-coverage ledger remains excluded from precache.
- All 30 dataset-audit programs carry corrected G0b states, and all 19 programs requiring observable-independence review carry explicit G2a states. Dataset assignments remain program-level until acquisition and preregistration freeze them for a specific method.
- EARTH execution completion remains distinct from scientific validation: source limitations stay visible, comparison methods stay labeled as comparisons, and the aggregate `scientificallyValidated` value remains `false` until the applicable external gates pass.

The global strip compares expected, implemented, evaluated, graphed, and simulatable counts. Not every operation applies equally to every domain, but release completion uses the required domain-specific columns above rather than silently treating an inapplicable zero as success.

## Worker Model

Formula registries and their generated completion report are loaded as static assets. Formula and core evaluation passes run in parallel simulation workers; heavy wall determinant work runs in a separate browser worker with staged progress and `AbortController` cancellation. Runnable EARTH methods run through their own terminating worker boundary with cloned JSON defaults and no main-thread fallback. The UI does not send inputs to a network service and does not fall back to an unbounded main-thread computation when a worker is unavailable. Core cases provide deterministic graph-ready figures through their registry.

The PWA precaches the app shell and compact generated registries. Per-wall JSON, EARTH document shards, and the lazily loaded Plotly chunk use year-long cache-first runtime caches; evidence shards use a bounded 30-day cache. The large EARTH scientific-coverage ledger, evidence shards, and future result/dataset payload directories are excluded from precaching. Source updates therefore require a new production build/service-worker revision.

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
npm test
npm run e2e
npm run e2e:chromium
npm run verify
```

`npm run verify` runs type checking, all Vitest suites, and the production build. Playwright is separate because it requires Chromium. `npm run e2e` and `npm run e2e:chromium` run the same Chromium-only browser suite. Their only web server command is `npm run dev -- --host 127.0.0.1`.

`npm run data:generate` rebuilds the deterministic browser registries and completion audit from retained source artifacts. It fails if the sibling EARTH corpus differs from `public/data/sources/earth-source-lock.json`. `npm run data:lock:earth` is the explicit acceptance path for a clean new EARTH revision. `npm run data:acquire` is the explicit network refresh path for the 351 source payloads; both update commands are intentionally excluded from routine verification so a source change cannot silently rewrite the corpus.

UI tests cover fail-closed completion, topic isolation, asynchronous graph readiness, formula filtering/detail, canvas drawing and exact cell selection, responsive navigation state, strict EARTH registry/dataset adapters, multi-method execution, provenance labeling, and worker lifecycle behavior. Verification recorded on 2026-07-20: `npm run verify` passed with 36 Vitest files and 234 tests, and the production PWA build passed. The Chromium Playwright run passed all 27 tests, including all 134 runnable EARTH methods.

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
- `constants.yaml`, `symbols.csv`, and the published evaluation output
- `https://www.physicsmonastery.earth/number-walls/data/<file>.json`

The generated recipe and wall registries are derived artifacts, not replacement source records. `public/data/sources/manifest.json` records acquisition date, URL, status, byte size, and SHA256 for wall payloads. `public/data/sources/earth-source-lock.json` pins the EARTH revision, declared license, paths, byte sizes, and SHA256 values. `public/data/generated/earth/manifest.json` records the parser policy and document inventory; its formula, claim, code, and simulation ledgers distinguish exact syntax from heuristic candidates and never execute source code. `public/data/generated/provenance.json` records source/context distinctions and local PDF metadata. The parent corpus `../INDEX.md` remains authoritative for local paths, page counts, byte sizes, hashes, source URLs/DOIs, and failed-access notes.

The Curtis R. Horn Jr. and Nassim Haramein PDFs are contextual cross-links unless a registry case explicitly identifies a concept link. Contextual proximity is not direct formula provenance. No redistribution license is inferred from public accessibility; source rights remain with the relevant authors and publishers.

## Known Limitations and Data Issues

- The preserved published run reports 70 exact entries (`68` passed, `2` failed) and 218 measured entries (`217` passed, `1` failed). The two exact failures are the molar volume of ideal gas and Loschmidt constant under differing standard-condition conventions. The measured failure is a Sackur-Tetrode case.
- Source notation mixes SI definitions, measured constants, mathematical constants, model values, relationship symbols, and author-defined symbols. Unit strings and dimensions require typed audits rather than display-only comparison.
- The current typed engine reports 68 recipe dimension declarations that do not match its resolved five-axis dimension vector. These are audit findings, not silently coerced units.
- A z-score is not meaningful for an exact definition. For measured quantities, correlated CODATA inputs and shared formula dependencies mean displayed z-scores are not necessarily independent statistics.
- Selecting mathematical constants, transforms, formula forms, tolerances, or significant digits after observing target values creates selection and multiple-comparison concerns. A dense set of matches is not by itself evidence of predictive power.
- Float64 execution is a reproduction precision choice. It does not preserve every source decimal and does not replace arbitrary-precision or symbolic verification where those are scientifically required.
- Website content and number-wall JSON can drift after acquisition. Generated registries must be rebuilt and completion rerun when source hashes change.
- Some related papers could not be acquired because of Akamai/Cloudflare protection, HTTP `403`/`429`, or timeout. The corpus records those failures and does not substitute reconstructed or placeholder PDFs.
- The 134 runnable EARTH methods provide bounded technical execution, not blanket implementation of the 86 unavailable source models. Of the runnable methods, 37 reproduce source expressions and 97 are traditional analytic/numerical baselines or source-contract validators. No external dataset has been acquired or frozen, none has passed G0b, assignments are not method-frozen, and aggregate scientific validation remains false.
- Offline behavior applies after the initial successful load/service-worker installation. Clearing site storage removes the cached shell and data.
