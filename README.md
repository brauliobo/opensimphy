# OpenSimPhy Reproduction Atlas

OpenSimPhy is a static, browser-only Vue instrument for reproducing and auditing the formula and number-wall claims published by [Physics Monastery](https://www.physicsmonastery.earth/). It is an inspection surface for preserved source data and the local TypeScript engine, not a server client and not an assertion that the source theory is valid.

## Scientific Scope

The atlas covers:

- 288 ordered formula recipes recovered from the site’s `288` presentation and Transform Dictionary.
- 351 source number-wall inputs: 18 famous sequences, 45 mathematical constants, and 288 constants-of-nature entries.
- Every case in the core simulation registry, including Planck complex surfaces, quartic root loci, invariant checks, companion dynamics, manifold/dilogarithm cases, transform-space, constructor transforms, and coherent/typed units.
- Source metadata for recovered site artifacts and the contextual local PDF corpus.

**Reproduction is not validation.** A reproduced value shows that the implemented expression and preserved inputs produce the stated result under the recorded conventions. It does not independently establish a derivation, physical mechanism, novelty, prediction, statistical significance, or theory validity.

## Architecture

The application has no API URL and requires no application server:

```text
public/data/generated   source-derived recipe, taxonomy, wall, symbol, completion, provenance registries
public/data/number-walls
                         preserved per-input static JSON
data/physics_monastery  non-public recovered PDF/text source artifacts used by generation
src/engine              typed numerical registries and evaluation functions
src/workers             browser workers for cancellable computation
src/composables         strict UI adapter and completion state
src/components          navigation, coverage, Plotly, and canvas instruments
src/views               eight lazy-routed tour, atlas, lab, and provenance views
tests/ui                Vitest and Vue Test Utils contracts
tests/e2e               Playwright browser audit
```

`src/composables/atlasEngine.ts` is the UI boundary. Formula figures are converted from engine-produced inversion-sweep points and markers. Core plots must come from the core registry. Wall canvases must come from worker results. Missing graph or worker output has no placeholder fallback: coverage and the corresponding panel remain incomplete.

The generated taxonomy classifies every formula into one of eight scientific topics and a subordinate category, then records cross-cutting basis, constructor, dependency-pass, source-unit, representation, entity, and source-topology facets. Generation fails closed if a topic count, category count, or curated tour example drifts from the 288-recipe source snapshot.

Plotly is dynamically imported into its own lazy chunk. Number-wall values are rendered with canvas so exact source strings can be retained for cell inspection without creating a DOM node for every cell. Formula browsing is paginated at 24 rows while preserving deterministic recipe test IDs.

## Definition of Done

A release is complete only when all of the following are true at the same generated-data revision:

- Formula coverage is exactly `source 288 / implemented 288 / evaluated 288 / graphed 288`.
- Number-wall coverage is exactly `source 351 / implemented 351 / simulatable 351`.
- Core coverage equals the exact core registry count for implemented, graphed, and simulatable cases; the registry must not be empty.
- Every formula reports engine `graphReady`, and first, middle, and last detail routes render a live Plotly graph.
- Every core registry case reports graph readiness and renders through its case tab.
- Every wall input passes the engine’s small-simulation completion audit, and the UI produces a canvas result in all supported worker modes.
- `data-testid="coverage-status"` has `data-status="complete"`; any mismatch must instead render `FAIL CLOSED / INCOMPLETE`.
- Type checking, engine tests, UI tests, the production build, and Playwright pass.
- The production build contains a web manifest and service worker with app-shell/generated-registry precache plus number-wall and Plotly runtime caches.

The global strip compares expected, implemented, evaluated, graphed, and simulatable counts. Not every operation applies equally to every domain, but release completion uses the required domain-specific columns above rather than silently treating an inapplicable zero as success.

## Worker Model

Formula registries and their generated completion report are loaded as static assets. Formula and core evaluation passes run in parallel simulation workers; heavy wall determinant work runs in a separate browser worker with staged progress and `AbortController` cancellation. The UI does not send inputs to a network service and does not fall back to an unbounded main-thread computation when a worker is unavailable. Core cases provide deterministic graph-ready figures through their registry.

The PWA precaches the app shell and generated registries. Per-wall JSON under `/data/number-walls/` and the lazily loaded Plotly chunk use year-long cache-first runtime caches. Source updates therefore require a new production build/service-worker revision.

## Commands

Node 20.19 or newer is required.

```bash
npm install
npm run dev
npm run data:generate
npm run typecheck
npm run test:engine
npm run test:ui
npm test
npm run e2e
npm run verify
```

`npm run verify` runs type checking, all Vitest suites, and the production build. Playwright is separate because it requires a Chromium installation. Its only web server command is `npm run dev -- --host 127.0.0.1`.

`npm run data:generate` rebuilds the deterministic browser registries and completion audit from retained source artifacts. `npm run data:acquire` is the explicit network refresh path for the 351 source payloads; it is intentionally excluded from routine verification so a source-site change cannot silently rewrite the corpus.

UI tests cover fail-closed completion, topic isolation, asynchronous graph readiness, formula filtering/detail, canvas drawing and exact cell selection, responsive navigation state, and one real generated-data/engine integration. Playwright checks the topic-to-atlas journey, exact coverage, atlas search, all 288 formula readiness records with sampled routes, all core cases, all 351 wall completion records with a UI simulation, mobile navigation, provenance caveats, and PWA evidence. It records only three representative screenshots rather than one screenshot per formula.

## Static Deployment

Build and serve the generated directory from any static host:

```bash
npm run build
npx vite preview --host 127.0.0.1
```

Deploy the contents of `dist/`. `netlify.toml` supplies the build command, publish directory, and SPA history fallback. Other static hosts must route unknown navigation paths to `index.html` while serving asset and data URLs normally. No Node, Python, database, API process, or server-side rendering is used in production.

For GitHub Pages, `npm run build:pages` uses `VITE_BASE_PATH=/opensimphy/` from the deployment workflow and generates `dist/404.html` as an SPA deep-link fallback.

## Browser Support

The target is current stable Chromium, Firefox, and Safari with ES2022 modules, Web Workers, service workers, canvas, dynamic imports, and BigInt support. Interactive 3D plots require WebGL. The layout supports narrow mobile viewports, keyboard focus, labeled controls, reduced-motion preferences, and touch navigation. A browser that blocks WebGL can still inspect formula/audit text, but graph readiness will not be represented as a successfully rendered Plotly panel.

## Provenance

Direct simulation provenance is limited to recovered Physics Monastery material:

- `https://www.physicsmonastery.earth/`
- `https://www.physicsmonastery.earth/288`
- the 169-page Transform Dictionary
- the recovered `288` and combinatorics PDFs
- `constants.yaml`, `symbols.csv`, and the published evaluation output
- `https://www.physicsmonastery.earth/number-walls/data/<file>.json`

The generated recipe and wall registries are derived artifacts, not replacement source records. `public/data/sources/manifest.json` records acquisition date, URL, status, byte size, and SHA256 for wall payloads. `public/data/generated/provenance.json` records source/context distinctions and local PDF metadata. The parent corpus `../INDEX.md` remains authoritative for local paths, page counts, byte sizes, hashes, source URLs/DOIs, and failed-access notes.

The Curtis R. Horn Jr. and Nassim Haramein PDFs are contextual cross-links unless a registry case explicitly identifies a concept link. Contextual proximity is not direct formula provenance. No redistribution license is inferred from public accessibility; source rights remain with the relevant authors and publishers.

## Known Limitations and Data Issues

- The preserved published run reports 70 exact entries (`68` passed, `2` failed) and 218 measured entries (`217` passed, `1` failed). The two exact failures are the molar volume of ideal gas and Loschmidt constant under differing standard-condition conventions. The measured failure is a Sackur-Tetrode case.
- Source notation mixes SI definitions, measured constants, mathematical constants, model values, relationship symbols, and author-defined symbols. Unit strings and dimensions require typed audits rather than display-only comparison.
- The current typed engine reports 79 recipe dimension declarations that do not match its resolved five-axis dimension vector. These are audit findings, not silently coerced units.
- A z-score is not meaningful for an exact definition. For measured quantities, correlated CODATA inputs and shared formula dependencies mean displayed z-scores are not necessarily independent statistics.
- Selecting mathematical constants, transforms, formula forms, tolerances, or significant digits after observing target values creates selection and multiple-comparison concerns. A dense set of matches is not by itself evidence of predictive power.
- Float64 execution is a reproduction precision choice. It does not preserve every source decimal and does not replace arbitrary-precision or symbolic verification where those are scientifically required.
- Website content and number-wall JSON can drift after acquisition. Generated registries must be rebuilt and completion rerun when source hashes change.
- Some related papers could not be acquired because of Akamai/Cloudflare protection, HTTP `403`/`429`, or timeout. The corpus records those failures and does not substitute reconstructed or placeholder PDFs.
- Offline behavior applies after the initial successful load/service-worker installation. Clearing site storage removes the cached shell and data.
