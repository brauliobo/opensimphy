# Physics Tour Master Plan

## Status and authority

This document is the product contract for transforming OpenSimPhy from a registry-led atlas into a guided field course. `PHYSICS_TOUR_IMPLEMENTATION_STATUS.md` records delivery against this plan.

The numbered curriculum is authoritative: the deep path contains 20 chapters numbered 0 through 19. An earlier prose summary called it an eighteen-chapter path; the explicit chapter sequence supersedes that count.

## Product thesis

OpenSimPhy teaches how physics moves through this chain:

```text
observation
-> physical quantity
-> units and dimensions
-> mathematical relationship
-> model
-> simulation
-> comparison with evidence
-> justified conclusion
```

The tour must not present 288 formula reproductions, 351 number walls, or 130 EARTH programs as equivalent scientific achievements. It teaches users to distinguish:

- Definitions from measurements.
- Unit conversions from physical laws.
- Identities from predictions.
- Reproductions from validations.
- Traditional models from source-specific hypotheses.
- Successful execution from empirical agreement.
- Visually interesting patterns from statistical evidence.
- Missing models from implemented models.

The central learning outcome is the ability to inspect a claim and identify exactly what supports it. The product does not ask the learner to believe or disbelieve a source theory.

## Audience strategy

### One tour, two depths

OpenSimPhy has one curriculum and one scientific verdict. A persistent reading-depth control changes the amount of explanation and evidence without changing conclusions.

| Mode | Purpose | Presentation |
| --- | --- | --- |
| Guided | First-time and lay readers | Phenomenon first, minimal notation, one equation at a time, two or three controls |
| Technical | Experienced students and physicists | Derivations, dimension vectors, uncertainty, dependencies, numerical methods, source spans, raw results |

Users can switch depth anywhere without losing position or progress.

Guided mode assumes basic arithmetic, ratios, percentages, powers of ten, simple graphs, and familiarity with mass, distance, time, temperature, and electricity. Algebra is introduced gradually. Calculus, matrices, differential equations, and topology appear visually before formally.

Technical mode supports undergraduate mechanics, electromagnetism, quantum mechanics, thermodynamics, calculus, linear algebra, differential equations, uncertainty, and statistical inference. Graduate-level extensions are appropriate for field theory, topology, cosmology, and numerical PDEs.

## Product architecture

### Primary destinations

| Destination | User question |
| --- | --- |
| Tour | Teach me how these ideas connect. |
| Atlas | I need a specific constant, formula, or dependency. |
| Workbench | I want to run, vary, or compare a model. |
| Evidence | Where did this claim come from, and what supports it? |

EARTH remains inside Evidence. Runnable EARTH methods can open in the shared Workbench.

### Routes

```text
/                               orientation and resume
/tour                           complete tour map
/tour/:chapter                  chapter overview
/tour/:chapter/:lesson          guided lesson
/atlas                          full formula registry
/atlas/:id                      formula specimen
/labs                           workbench index
/labs/core                      mathematical/core workbench
/labs/walls                     number-wall workbench
/labs/earth/:programId          optional workbench-focused EARTH entry
/evidence                       evidence model and scope
/sources                        source ledger
/earth/*                        EARTH dossier
/saved                          local notebook and saved runs
/not-found                      explicit recovery surface
```

Existing published routes remain aliases. `/topics/:id` redirects to the corresponding tour chapter when a mapping exists.

### Navigation

Primary navigation contains Tour, Atlas, Workbench, and Evidence. Resume and Guided/Technical depth are persistent utilities. EARTH retains its local `03/A-D` dossier navigation.

## Curriculum structure

### Completion paths

The quick path contains eight stations and takes approximately 20-30 minutes. It establishes the conceptual spine with one representative idea and simulation per station.

The deep path contains chapters 0-19, the existing 31 conventional-physics taxonomy categories, mathematical instruments, EARTH and cross-program audits, technical derivations, and extended workbench exercises.

Quick-path completion means the learner explicitly completed the eight core stations. It does not imply mastery.

## Quick tour

| Station | Central question | Primary interaction |
| --- | --- | --- |
| 1. Anchors and scales | How do physicists agree on a second, metre, and quantum of action? | Build a dimensional quantity from base units |
| 2. Unit bridges | How can frequency, energy, mass, and temperature describe one scale? | Convert one photon across representations |
| 3. Electrical standards | How does elementary charge become a measurable electrical standard? | Trace charge through conductance, resistance, voltage, and flux |
| 4. Atoms and materials | How do spectra reveal atomic structure? | Move between wavelength, frequency, and atomic transition energy |
| 5. Particles and mass | How can mass appear as energy, momentum, and wavelength? | Compare electron/proton mass-energy and Compton scales |
| 6. Spin and magnetism | How does microscopic spin produce magnetic response? | Vary field strength and observe precession frequency |
| 7. Heat and radiation | How does microscopic energy become temperature and light? | Change temperature on a black-body spectrum |
| 8. Molar matter | How do particle-scale quantities become laboratory matter? | Scale particles into moles, gas volumes, and bulk quantities |

Each station links to deeper lessons from the 31-category taxonomy.

## Deep curriculum

### Act I: How physics earns a claim

#### Chapter 0: Reproduction Is Not Validation

Question: What does it mean when software reproduces a number?

Teach definition, identity, measurement, calibration, prediction, reproduction, comparison, validation, and blind tests. Guided readers classify ten statements. Technical readers inspect dependency graphs, target-containing inputs, model selection, multiple comparisons, and held-out observables.

Required conclusion: successful computation establishes that an implementation ran under recorded inputs. It does not automatically establish the attached physical theory.

#### Chapter 1: Units, Dimensions, and Physical Quantities

Question: Why can a numerically correct expression still be physically meaningless?

Teach base dimensions, unit coordinates, cancellation, changing units without changing physics, natural units, reference normalization, and dimensional versus dimensionless quantities.

Simulation: compose an equation from quantities, receive immediate dimensional feedback, switch SI/CGS/normalized coordinates, and preserve the physical result while numerical coordinates change.

Technical extension: five-axis and seven-axis dimension vectors, covariant coordinate transformations, amount-of-substance semantics, and the 68 known formula-dimension conflicts.

#### Chapter 2: Measurement, Uncertainty, and Standards

Question: How precise is a physical number?

Teach defined versus measured values, significant digits, standard uncertainty, shared-input covariance, standard states, conventions, and why exact relationships do not require z-scores.

Simulation: compare uncertainty bars and toggle shared versus independent uncertainty. Case study: molar volume and Loschmidt disagreements under differing standard conditions.

#### Chapter 3: Anatomy of a Formula Recipe

Question: Where does the expected result enter the calculation?

Teach the common 288-recipe constructor, scale factors, conversions, dimensionless terms, root corrections, dependency passes, and target-aware expression selection.

Simulation: highlight terms by role, disable factors, compare external scale with correction, and trace the proton-mass dependency chain.

Required conclusion: complexity does not guarantee independence. A target scale may already be embedded in a selected factor.

### Act II: Conventional physics through constants

#### Chapter 4: Clocks, Action, Light, and Gravity

Use caesium-133 frequency, Planck and reduced Planck constants, speed of light, Newtonian gravity, Planck scales, and luminous efficacy. Move from reproducible clocks through spacetime conversion, quantum action, and gravitational coupling.

Simulation: logarithmic physical-scale ruler from laboratory to Planck scales with dimension-preserving conversion.

Technical extension: derive Planck units, distinguish identity from model prediction, and expose reference dependence in normalized coordinates.

#### Chapter 5: Frequency, Energy, Mass, and Temperature

Core relationship:

```text
E = h nu = m c^2 = k_B T = h c / lambda
```

Simulation: lock one representation, vary another, and update frequency, energy, wavelength, equivalent mass, and temperature.

Technical extension: Jacobians, reciprocal conversions, uncertainty propagation, and classification of each relationship.

#### Chapter 6: Charge and Quantum Electrical Standards

Teach elementary charge, conductance quantum, von Klitzing constant, Josephson constant, magnetic flux quantum, vacuum permittivity, and impedance.

Simulation: trace charge and action into electrical standards; compare ideal relationships with historical 1990 conventional values.

Technical extension: `e`, `h`, `K_J`, `R_K`, `G_0`, vacuum response, and dimensional audits of Planck electrical quantities.

#### Chapter 7: Atomic Structure and Spectroscopy

Teach the Rydberg constant, Bohr radius, Hartree energy, atomic units, spectral transitions, silicon lattice spacing, classical electron radius, and Thomson scattering.

Simulation: hydrogen-like energy levels, transition selection, wavelength/frequency conversion, and spectrum rendering.

Technical extension: reduced mass, selection rules, and why dimensional formulas cannot replace a bound-state Hamiltonian.

#### Chapter 8: Particle Mass and Quantum Wavelength

Teach electron, muon, proton, neutron, tau, nuclei, rest energy, relative masses, unified atomic mass, Compton wavelengths, momentum scales, and the Fermi coupling scale.

Simulation: compare particle scales on linked mass-energy-wavelength axes and identify dependent quantities as dependent rather than independent measurements.

Technical extension: `E=mc^2` as conversion, Compton derivation, covariance, and composite versus elementary particles.

#### Chapter 9: Spin, Magnetic Moments, and Anomalies

Teach Bohr/nuclear magnetons, magnetic moments, ratios, gyromagnetic ratios, g-factors, anomalies, and shielding corrections.

Simulation: spin precession under a magnetic field for electron, proton, neutron, and muon with linked moment and gyromagnetic representations.

Technical extension: `mu = gamma S`, composite effects, QED anomaly context, and why a fitted g-factor does not validate a geometric particle model.

#### Chapter 10: Heat, Radiation, and Bulk Matter

Teach the Boltzmann constant, molar gas constant, ideal gas, Wien laws, Planck spectrum, Stefan-Boltzmann law, Avogadro constant, Faraday constant, molar mass, and molar volume.

Simulation: interactive black-body spectrum, peak wavelength, particle-to-mole scaling, gas volume, and standard-pressure comparison.

Technical extension: partition functions, entropy, Sackur-Tetrode, standard-state dependence, and ideal-gas limits.

### Act III: Mathematical instruments

#### Chapter 11: Number Walls and Recurrence Structure

Begin with squares, cubes, powers of two, Fibonacci, Lucas, Thue-Morse, Catalan, and central-binomial sequences. Introduce decimal streams of pi, e, and physical constants only after recurrence behavior is understood.

Simulation: construct determinant cells, predict before rendering, and switch modulo, valuation, signed-log, normalized, exact-value, and zero-window modes.

Technical extension: Bareiss determinants, recurrence rank, vanishing determinants, null models, and base dependence.

Required caveat: a visual pattern in decimal digits is not physical evidence without a preregistered statistic, null model, and unit/base invariance.

#### Chapter 12: Roots, Matrices, and Invariants

Teach complex numbers, quartic roots, root motion, Vieta identities, Newton sums, companion matrices, traces, determinants, spectral transformations, complex dilogarithms, volume identities, and typed units.

Simulation: move polynomial coefficients, watch roots move, inspect fixed invariants, and compare root geometry with matrix spectrum.

Technical extension: characteristic polynomials, spectral mapping, companion flow, complex logarithms, and `SU(2)` eigenvalue constraints.

Required conclusion: a selected matrix has a mathematical spectrum. It becomes a physical spectrum only when a physical model derives the operator.

### Act IV: Model building and EARTH audits

#### Chapter 13: Discrete Rules and Continuous Fields

Use EARTH FND programs to teach substitution systems, matrix growth, fixed points, density-spacing relations, proposed golden-power relations, and continuous scalar fields.

Simulation: iterate substitutions, build incidence matrices, compare `2^n` and `phi^n`, and visualize the valid `n^(-1/3)` spacing relation.

Technical extension: Perron eigenvalues, symbolic dynamics, continuum limits, and requirements for deriving field theory from substitution rules.

#### Chapter 14: Knots, Topology, and Soliton Stability

Use GEO and FLD programs to distinguish knots, links, unknots, torus-knot notation, target spaces, homotopy, Derrick scaling, stabilizing terms, and comparison models.

Simulation: classify torus knots, scale energy terms, compare collapse/expansion/stability, and run sine-Gordon and topology-compatible comparisons.

Technical extension: `pi_3(S^1)=0`, `S^2`, `CP^1`, Faddeev-Skyrme comparisons, finite-energy boundary conditions, mesh convergence, and Hessian modes.

#### Chapter 15: From Fields to Matter

Use NUC and PRT programs to teach the difference between naming and deriving a particle, charge/current operators, finite-energy states, stability, form factors, decay channels, and spectra.

Simulation: compare literal source formulas with conventional mass/radius calculations, run bounded population or kinematic models, and display missing-contract requirements for blocked models.

Technical extension: Noether charges, boundary-value problems, Jacobi/Hessian spectra, weak operators, and parton observables.

#### Chapter 16: Chemistry, Materials, and Thermodynamics

Use CHEM, SPEC, MAT, and THERM for bond potentials, geometry, coordination, vibrational modes, spectra, elasticity, dielectric response, Kramers-Kronig, Fresnel interfaces, equations of state, activities, phase equilibrium, and transport.

Preserve provenance-pure comparisons: source Ksp expression versus ion activities, source spectroscopy formulas versus traditional models, and source material claims versus Fresnel/Kramers-Kronig baselines.

Technical extension: Hessians, response tensors, oscillator strengths, causality, chemical potentials, and partition functions.

#### Chapter 17: Planets, Stars, Galaxies, and Cosmology

Use GRV, COS, PLAN, STAR, and GAL for compactness, horizons, planets, atmospheres, seismology, dynamos, stars, pulsations, galaxies, Tully-Fisher, FLRW expansion, CMB, BAO, and dataset integrity.

Primary coordinates:

```text
x = L / l_P
y = m / m_P
chi = 2 y / x = 2 G m / (L c^2)
```

Simulation: compactness map for planets, stars, compact objects, and hypothetical states; source/traditional atmosphere and binding comparisons; direct dataset blocker disclosure.

Technical extension: Kottler, hydrostatic ODEs, Lane-Emden, Jeans models, FLRW, survey selection, and covariance.

#### Chapter 18: Biology, Neuroscience, and Analogy

Use BIO and NEURO to distinguish analogy from mechanism. Teach elastic rods, sine-Gordon analogues, DNA linking/twist/writhe, state graphs, cable models, Hodgkin-Huxley/FitzHugh-Nagumo, connectome modes, EEG inference, and clinical evidence standards.

Simulation: compare toy kink with conventional action potential, vary cable parameters, inspect graph modes, and test spectral peaks against red-noise nulls.

Required safety: no diagnosis, treatment, or consciousness-mechanism claims. Show privacy and controlled-data boundaries prominently.

#### Chapter 19: Blind-Test Capstone

The learner defines an operator or action, dimensions, boundary conditions, free parameters, calibrated inputs, frozen mapping, held-out observable, null family, comparison, failure handling, uncertainty, and provenance.

This chapter connects Roberts, Haramein, Horn, and EARTH without asserting equivalence.

## Lesson interaction model

Every lesson follows the same six-part grammar:

1. **Question**: chapter/lesson number, time estimate, depth selector, and one-sentence answer preview.
2. **Observe**: one full-width scientific stage that answers a stated question. No decorative science graphics.
3. **Explain**: familiar meaning in Guided mode; dimensions, assumptions, uncertainty, dependencies, classification, and method in Technical mode.
4. **Equation ladder**: spoken relationship, symbolic relationship, then full implementation/source expression.
5. **Try**: prediction prompt, one preset selector, two or three ordinary controls, reset, one visualization, and one finding. Advanced JSON remains in Workbench.
6. **Interpret**: `Observed here`, `Reproduced here`, and `Not established here`, followed by explicit completion and related links.

Lesson simulations should feel playful through prediction, manipulable parameters, responsive visual state, meaningful presets, and comparison. They must not use points, streaks, forced completion, decorative motion, or misleading celebration.

## Simulation contract

```ts
interface TourSimulation {
  id: string
  lessonId: string
  question: string
  predictionPrompt: string
  modelOrigin: 'established-physics' | 'source-reproduction' | 'traditional-baseline'
  equations: string[]
  assumptions: string[]
  controls: TourControl[]
  presets: TourPreset[]
  outputSchema: unknown
  finding: ResultFinding
  limits: RuntimeLimits
  evidenceRefs: string[]
}
```

Every result answers:

- What changed?
- Why did it change?
- Which equation produced it?
- Which assumptions matter?
- What does the result establish?
- What remains unverified?

### Tiers

| Tier | Tour use |
| --- | --- |
| Immediate | Pure bounded calculator that updates directly |
| Local worker | Numerical method with explicit Run/Cancel |
| Artifact | Precomputed heavy result with reproducibility metadata |
| Unavailable | Missing contract disclosure with no fake Run control |

### High-value simulations

| Lesson | Simulation |
| --- | --- |
| Units | Dimensional equation builder |
| Measurement | Shared versus independent uncertainty |
| Formula anatomy | Dependency/target-contamination explorer |
| Unit bridges | Frequency-energy-mass-temperature converter |
| Electrical standards | Charge/action standards network |
| Atoms | Spectral transition explorer |
| Particles | Mass-energy-Compton scale comparator |
| Magnetism | Spin-precession visualizer |
| Heat | Black-body spectrum |
| Molar matter | Particle-to-mole scaler |
| Number walls | Recurrence/determinant wall |
| Roots | Quartic root locus and invariants |
| Discrete foundations | Substitution growth explorer |
| Fields | Derrick scaling |
| Chemistry | Ksp versus activity comparison |
| Planetary | Hydrostatic scale height |
| Gravity | Compactness/Kottler map |
| Biology | Cable/kink comparison |
| Capstone | Frozen blind-test protocol builder |

## Shared Workbench

Desktop layout:

```text
+ Instrument identity / provenance / conclusion boundary +
| Controls | Main scientific stage | Findings             |
| Run / cancel / progress / reset / save / compare       |
| Method details / data / raw result disclosures         |
```

Desktop columns are approximately 280px / flexible / 320px in a shell no wider than 1600px. Mobile order is stage, essential controls, run/cancel, findings, full controls, evidence, raw data.

Compare mode contains at most two snapshots. Compatibility is declared, never inferred from object keys. Incomparable outputs receive parallel findings with no residual.

Saved runs are stored only after explicit action and contain instrument/program ID, method ID, inputs, outputs, finding, provenance, schema version, source revision, implementation revision, timestamp, and user label. Preferences and progress use versioned local storage. Larger artifacts use IndexedDB. There is no account, telemetry, or automatic synchronization.

## Visual direction

The visual metaphor is a modern scientific field notebook combined with a precision instrument.

Preserve dark ink surfaces, cream paper inserts, serif exposition, monospaced data, one-pixel rules, square geometry, amber source context, cyan computational traces, red blockers, and green bounded-execution completion.

Avoid generic dashboards, rounded card grids, large decorative statistics, glassmorphism, ambient particles, excessive badges, simultaneous chart walls, points, and streaks.

The home screen uses an orientation question, primary begin/resume action, continuous eight-station physical scale, current chapter preview, and scientific-scope plate. The stations are ticks on one continuous line, not interchangeable cards.

The Tour map uses a chapter spine and sticky preview on desktop; mobile uses a vertical ruled sequence with indented optional technical branches.

Lesson pages give unframed space to one question, one visual stage, one primary equation, one interaction, and one conclusion.

### Typography

| Role | Size |
| --- | --- |
| Metadata | 12px minimum |
| Interface | 14-16px |
| Body | 17-19px |
| Lead | 21-25px |
| Section heading | 30-42px |
| Lesson title | 46-72px |

Guided reading width is approximately 64 characters; Technical is approximately 88. Measurements use tabular numerals. Scientific titles must retain readable line height.

Motion explains state: marker movement, trace appearance, progress rules, chapter transitions, and compare opening. There is no bouncing, parallax, count-up animation, or decorative orbit. Reduced motion renders final state immediately.

## Claim and provenance vocabulary

Every major statement has one explicit class:

- Established definition
- Established model
- Observed value
- Source claim
- Identity
- Assumption
- Calibration
- Literal reproduction
- Traditional baseline
- Exploratory hypothesis
- Prediction
- Failure
- Blocked source model
- Unresolved

Each record exposes source family, exact source span, source revision, claim class, method relationship, model origin, input roles, dataset state, precision/numerical method, result status, caveats, and whether it validates a theory. Ambiguous `pass` labels are not acceptable.

## Content architecture

Lesson prose does not live in Vue templates.

```text
content/tour/
  manifest.json
  chapters/
  lessons/
  simulations/
  glossary.json
  references.json

scripts/lib/tour-content.mjs

public/data/generated/tour/
  manifest.json
  chapters/*.json
  lessons/*.json
  simulations/*.json
  glossary.json
  references.json
```

JSON is the initial source format to avoid adding a YAML/Markdown parser dependency. The strict generator emits normalized, deterministic, sanitized structured JSON. Markdown with strict front matter remains an optional later authoring layer.

```ts
interface TourLessonRecord {
  schemaVersion: 1
  id: string
  chapterId: string
  order: number
  title: string
  question: string
  summary: string
  estimatedMinutes: number
  prerequisites: string[]
  guidedBlocks: LessonBlock[]
  technicalBlocks: LessonBlock[]
  equationSteps: EquationStep[]
  simulationId: string | null
  formulaIds: string[]
  programIds: string[]
  glossaryIds: string[]
  evidenceRefs: string[]
  checkpoints: Checkpoint[]
  establishes: string[]
  doesNotEstablish: string[]
}
```

Generation fails when a lesson lacks a question, evidence does not resolve, a simulation lacks bounds, formula/program IDs are unknown, a conclusion boundary is absent, navigation is broken, glossary references do not resolve, or Guided content depends on undefined Technical terminology.

## Progress and local notebook

```ts
interface TourProgress {
  version: 1
  readingDepth: 'guided' | 'technical'
  chapters: Record<string, {
    status: 'not-started' | 'visited' | 'complete'
    lastLessonId?: string
    updatedAt?: string
  }>
  lessons: Record<string, {
    visited: boolean
    complete: boolean
    lastAnchor?: string
  }>
  resumeRoute?: string
}
```

Completion is explicit. Visiting is not completion. State remains local, exportable, and clearable. There are no streaks, scores, or mastery claims. Registry revisions do not silently invalidate learning state.

Knowledge checks ask for prediction and explanation rather than trivia. Users can reveal explanations without punishment.

## Performance plan

The highest-priority refactor removes unconditional `atlas.initialize()` from `src/App.vue` and creates route-owned registries:

- `useTourRegistry()`
- `useFormulaRegistry()`
- `useFormulaEvaluation(id)`
- `useCoreRegistry()`
- `useWallRegistry()`
- `useCompletionRegistry()`

Taxonomy and tour manifest load on home/tour; formula registry on Atlas; one evaluation on formula detail where practical; Core only in Core Workbench; wall index only in Number Walls; EARTH only in EARTH/Evidence.

Budgets:

- Initial tour JavaScript below 200KB compressed, excluding service worker.
- Initial tour data below 100KB.
- No Plotly on orientation or ordinary lessons until requested.
- No non-computation navigation long task above 100ms.
- LCP below 2.5 seconds on a mid-range mobile profile.
- INP below 200ms for ordinary controls.
- Worker startup measured separately.
- Large visualizations have reduced-data alternatives.

## PWA and offline

Offline packs are explicit: Guided tour, Formula atlas, Core workbench, Number-wall index, and EARTH evidence. Heavy artifacts are not automatically cached.

Expose online/offline state, source revision, update availability, download size, storage usage, and clear controls. Runtime cache names are revisioned. Production-preview service-worker tests are required.

## Accessibility

Chromium is the automated browser target.

Requirements:

- Correct tablist/tabpanel semantics in Core.
- Complete listbox semantics or selected buttons for number-wall browsing.
- Keyboard navigation for number-wall cells.
- Textual findings and data-table alternatives for Plotly.
- Debounced search announcements.
- Native radio or pressed-button semantics for reading depth.
- One completion announcement.
- Dynamic route titles using actual lesson/record names.
- Navigation drawers close on outside activation and make background inert.
- Forced-colors styles preserve distinctions.
- External links identify external context.
- Specialist abbreviations expand on first use.
- Interactive targets are at least 44px.
- 200% and 400% reflow remain operable.
- Reduced motion receives final-state visualizations.

## Testing

Schema tests cover eight quick stations, chapter ownership, Guided content, conclusion boundaries, references, simulation bounds, navigation, glossary, and deterministic progress migration.

Component tests cover depth, progress, resume, predictions, equation ladders, method provenance, compare compatibility, saved-run revisions, keyboard semantics, data alternatives, offline/update state, dynamic titles, and not-found behavior.

Chromium journeys cover first use, completion/reload resume, depth switching, formula round trips, Atlas back-state, URL-shareable workbenches, number-wall keyboard use, provenance separation, saved runs, explicit offline download, revision consistency, recovery, 320/390/768/1440 layouts, reduced motion, and 200%/400% reflow.

Focused files are `tour.spec.ts`, `atlas.spec.ts`, `workbench.spec.ts`, `evidence.spec.ts`, `storage.spec.ts`, `accessibility.spec.ts`, and `pwa.spec.ts`.

## Implementation iterations

### Iteration 0: Scientific and content contracts

Deliver claim vocabulary, lesson schema, simulation schema, conclusion rules, glossary schema, and reference policy.

Exit: every instructional statement can identify claim class, source family, method origin, and conclusion boundary.

### Iteration 1: Route-owned data

Remove unconditional full-atlas initialization, add route-owned registries, preserve behavior/tests, and measure loading.

Exit: `/`, `/tour`, and an EARTH document do not evaluate all 288 formulas or all Core cases.

### Iteration 2: Tour content pipeline

Deliver `content/tour`, strict generator, lesson shards, glossary, and chapter graph.

Exit: all eight stations and the first complete lesson generate deterministically and broken references fail closed.

### Iteration 3: Orientation and Tour map

Deliver homepage, continuous station spine, depth preference, begin/resume, and local-progress disclosure.

Exit: a first-time user understands the product and starts the first lesson without seeing a registry wall.

### Iteration 4: First complete vertical slice

Implement Chapter 1 with question, stage, explanation, equation ladder, dimensional builder, prediction, completion, links, and both depths.

Exit: lesson works from 320px through desktop, keyboard-only, reduced motion, reload/resume, and offline after explicit download.

### Iteration 5: Conventional-physics spine

Deliver chapters 4-10 and all eight quick stations with anchors, unit bridges, electrical standards, atoms, particles, magnetism, heat, and molar matter.

Exit: every quick-path simulation uses established physics or is explicitly labeled source reproduction.

### Iteration 6: Formula specimen redesign

Deliver meaning-first formula records, residual scale, equation ladder, dependency trace, accessible plot/table, Tour return context, save, and compare.

Exit: Guided users can explain meaning before seeing the full constructor; Technical users can inspect every dependency.

### Iteration 7: Shared Workbench

Deliver common shell, URL state, presets, reset, save, two-state compare, structured findings, and advanced disclosures.

Exit: Core, number walls, and EARTH share an interaction grammar without losing domain behavior.

### Iteration 8: Mathematical instruments

Deliver number-wall and quartic/root curricula, keyboard wall inspection, and null/base-dependence lessons.

Exit: no visual pattern or matrix spectrum is presented as physical evidence without its caveat.

### Iteration 9: EARTH research track

Deliver foundations, topology/fields, matter, chemistry/materials, astronomy/cosmology, biology/neuroscience, and blind-test capstone.

Exit: traditional methods, source reproductions, unavailable source models, and validators remain unmistakably distinct.

### Iteration 10: Notebook and offline packs

Deliver versioned progress, saved runs, compare snapshots, export/import, explicit packs, storage management, and revision warnings.

Exit: users can leave, return, reproduce saved state, and identify registry revision without an account.

### Iteration 11: Accessibility, performance, and editorial audit

Deliver Chromium accessibility suite, forced colors, 400% reflow, production PWA tests, bundle budgets, title audit, scientific editorial review, glossary review, and visual regression.

Exit: the Tour is scientifically honest, keyboard operable, responsive, performant, and technically complete on the tested target.

## Definition of done

- A lay user can finish eight stations without confronting an unexplained registry.
- An experienced user can inspect dimensions, assumptions, uncertainty, dependencies, methods, and raw evidence.
- Every lesson has a question, interaction, equation ladder, and conclusion boundary.
- Established physics appears before source-specific claims.
- Every simulation has bounded controls and explicit provenance.
- No visual pattern is evidence without statistic and null model.
- Ambiguous formula `pass` language is replaced with specific audit language.
- The 68 known dimension conflicts are visible where relevant.
- Traditional baselines are never presented as EARTH-derived.
- Unavailable source models never receive fake Run controls.
- Dataset metadata is never presented as acquired evidence.
- Progress and runs are local, exportable, revisioned, and optional.
- Orientation does not initialize unrelated engines.
- Tour, Atlas, Workbench, and Evidence have distinct purposes.
- Chromium covers learning, simulation, evidence, storage, responsive, accessibility, and production-PWA journeys.
- Scientific validation remains separate from technical completion.

The finished product should feel like a field guide to how physics turns measurements, mathematics, simulations, and evidence into justified knowledge.
