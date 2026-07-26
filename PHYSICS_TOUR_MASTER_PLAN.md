# Physics Tour Master Plan

## Status and authority

This document is the product contract for transforming OpenSimPhy from a registry-led atlas into a guided field course. The internal reference record `opensimphy-scientific-scope` resolves to this file at `https://github.com/brauliobo/opensimphy/blob/main/PHYSICS_TOUR_MASTER_PLAN.md`. `PHYSICS_TOUR_IMPLEMENTATION_STATUS.md` records delivery against this plan.

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
| Technical | Experienced students and physicists | All Guided content plus additive derivations, dimension vectors, uncertainty, dependencies, numerical methods, source spans, raw results, and at most the declared Technical-only controls |

Technical depth includes Guided depth rather than replacing it. Users can switch depth anywhere without losing position or progress, and no conclusion changes with reading depth.

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

The quick path contains eight stations and takes approximately 20-30 minutes. It establishes the conceptual spine with one representative idea and simulation per station. A station linked to a longer lesson uses that lesson's explicit `quickPath` subset rather than claiming the full lesson fits the station estimate.

The deep path contains chapters 0-19, the existing 31 conventional-physics taxonomy categories, mathematical instruments, EARTH and cross-program audits, technical derivations, and extended workbench exercises.

Quick-path completion means the learner explicitly completed the eight core stations. It does not imply mastery.

## Quick tour

| Station | Central question | Primary interaction |
| --- | --- | --- |
| 1. Anchors and scales | How do physicists agree on a second, metre, and quantum of action? | Inspect fixed SI anchors, then test dimensions and quantity kinds in the workshop |
| 2. Unit bridges | How can photon energy map to frequency and vacuum wavelength, then to derived equivalent mass and temperature scales? | Convert one photon energy across labeled representations without assigning rest mass or a thermal state |
| 3. Electrical standards | How do fixed `h` and `e` support quantum electrical reference relationships and their practical realizations? | Separate exact SI relationships, practical devices, and historical conventional values |
| 4. Atoms and materials | How can calibrated spectra constrain an atomic-structure model? | Relate wavelength, frequency, and transition energy under stated models and selection rules |
| 5. Particles and mass | How are massive-particle rest energy, momentum, and quantum wavelengths related? | Compare rest energy and Compton scales while keeping de Broglie wavelength tied to momentum |
| 6. Spin and magnetism | How does a stated spin-moment model predict magnetic response in an applied field? | Predict and calculate precession frequency, then distinguish output from measurement |
| 7. Heat and radiation | How do thermal models connect temperature, microscopic energy scales, and radiation? | Change modeled temperature and calculate a black-body spectrum |
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

Teach the VIM distinctions among quantity, quantity value, numerical value, quantity kind, and quantity dimension; then teach conventional base-quantity dimensions, unit coordinates, cancellation, multiplicative coherent unit changes, natural units, and dimensional versus dimensionless quantities. Matching dimensions are necessary but not sufficient for the same quantity kind: energy and torque are the standard counterexample. Say that the Tour uses seven conventional ISQ base-quantity dimensions, never that nature has seven intrinsic dimensions.

Simulation: predict first, select one bounded named expression, receive immediate dimensional feedback, and switch between SI and explicitly mechanical-cgs coordinates. The sample magnitude is one target-bound canonical SI quantity value. The builder permits rational exponents in its general contract while this activity uses integer exponents; it excludes electromagnetic CGS and affine temperature conversions. Its average-speed example is `average speed = path length / elapsed time`, not unqualified instantaneous speed. Until the imminent vertical slice contains an implementation, its honest implementation revision is the source-contract label `tour-dimension-contract-v1`, not a claim of generated or runnable code.

Technical extension: five-axis and seven-axis dimension vectors, covariant coordinate transformations, amount-of-substance semantics, and the 68 historical source-audit formula-dimension conflicts. Those conflicts retain their source basis and are not recomputed or repaired by this lesson.

#### Chapter 2: Measurement, Uncertainty, and Standards

Question: How precise is a physical number?

Teach defined versus measured values, significant digits, standard uncertainty, shared-input covariance, standard states, and conventions. Exact definitions and algebraic identities are not observations and do not receive z-scores. A z-score is meaningful only for a declared comparison of uncertain values with covariance and dependence handled; values derived from the same exact inputs are not independent evidence.

Simulation: compare uncertainty bars and toggle shared versus independent uncertainty. Case study: molar volume and Loschmidt disagreements under differing standard conditions.

#### Chapter 3: Anatomy of a Formula Recipe

Question: Where does the expected result enter the calculation?

Teach the common 288-recipe constructor, scale factors, conversions, dimensionless terms, root corrections, dependency passes, and target-aware expression selection.

Simulation: highlight terms by role, disable factors, compare external scale with correction, and trace the proton-mass dependency chain.

Required conclusion: complexity does not guarantee independence. A target scale may already be embedded in a selected factor.

### Act II: Conventional physics through constants

#### Chapter 4: Clocks, Action, Light, and Gravity

Use caesium-133 frequency, Planck and reduced Planck constants, speed of light, Newtonian gravity, Planck scales, and luminous efficacy. Distinguish the fixed defining values of `Delta_nu_Cs`, `c`, and `h` from the practical procedures and uncertainties used to realize the second, metre, and kilogram, then move through spacetime conversion, quantum action, and gravitational coupling.

Simulation: logarithmic physical-scale ruler from laboratory to Planck scales with dimension-preserving conversion.

Technical extension: derive Planck units, distinguish identity from model prediction, and expose reference dependence in normalized coordinates.

#### Chapter 5: Frequency, Energy, Mass, and Temperature

Photon propagation in vacuum:

```text
E_gamma = h nu
nu = c / lambda
therefore E_gamma = h c / lambda
```

Derived scale equivalents for that photon energy:

```text
m_equiv = E_gamma / c^2
T_equiv = E_gamma / k_B
```

These are equivalent mass and temperature scales derived from one photon energy. They do not assign a nonzero rest mass to the photon or assert that a thermal system has temperature `T_equiv`.

For a massive particle at rest:

```text
E_0 = m c^2
```

Simulation: lock one photon-vacuum representation, vary another, and update frequency, photon energy, vacuum wavelength, derived equivalent mass, and derived equivalent temperature. Massive rest energy remains a separately labeled relationship.

Technical extension: Jacobians, reciprocal conversions, uncertainty propagation, and classification of each relationship.

#### Chapter 6: Charge and Quantum Electrical Standards

Teach elementary charge, conductance quantum, von Klitzing constant, Josephson constant, magnetic flux quantum, vacuum permittivity, and impedance. Distinguish exact SI defining-constant relationships from physical realization with Josephson and quantum Hall devices, device corrections and uncertainty, and the pre-2019 conventional `K_J-90` and `R_K-90` values. Since 2019, vacuum permeability and permittivity are not independently fixed exact standards; their values are linked to measured electromagnetic constants.

Simulation: trace fixed `e` and `h` into exact ideal relationships, then place practical device realization and historical 1990 conventional values in separate attributed layers.

Technical extension: `e`, `h`, `K_J`, `R_K`, `G_0`, vacuum response, and dimensional audits of Planck electrical quantities.

#### Chapter 7: Atomic Structure and Spectroscopy

Teach the Rydberg constant, Bohr radius, Hartree energy, atomic units, spectral transitions, silicon lattice spacing, classical electron radius, and Thomson scattering. Spectral inference from a calibrated spectrum constrains transition and structure models only through line identification, calibration, selection rules, broadening assumptions, and competing-model checks; it does not reveal a unique structure by inspection.

Simulation: hydrogen-like energy levels, transition selection, wavelength/frequency conversion, and spectrum rendering.

Technical extension: reduced mass, selection rules, and why dimensional formulas cannot replace a bound-state Hamiltonian.

#### Chapter 8: Particle Mass and Quantum Wavelength

Teach electron, muon, proton, neutron, tau, nuclei, invariant mass, rest energy, relative masses, unified atomic mass, Compton wavelengths, momentum scales, and the Fermi coupling scale. Keep `E_0 = m c^2` for massive rest energy, `lambda_C = h/(m c)` for the Compton scale, and `lambda = h/p` for de Broglie wavelength distinct. Momentum is state-dependent and is not another form of invariant mass; linked axes usually show derived values, not independent measurements.

Simulation: compare particle scales on linked mass-energy-wavelength axes and identify dependent quantities as dependent rather than independent measurements.

Technical extension: the massive-particle rest-energy relationship `E_0 = m c^2`, Compton derivation, covariance, state-dependent momentum, and composite versus elementary particles.

#### Chapter 9: Spin, Magnetic Moments, and Anomalies

Teach Bohr/nuclear magnetons, magnetic moments, ratios, gyromagnetic ratios, g-factors, anomalies, and shielding corrections. A calculated spin response requires a declared spin-moment model, field, state, environment, and applicable shielding or composite corrections. An empirical response requires a separately identified measurement and uncertainty.

Simulation: predict and calculate model precession under a specified magnetic field for electron, proton, neutron, and muon with linked moment and gyromagnetic representations; do not label the computed motion an observation.

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

Simulation: iterate substitutions, build incidence matrices, compare `2^n` and `phi^n`, and visualize `ell = n^(-1/3)` only when `n` is a uniform three-dimensional number density and `ell` is the resulting characteristic spacing. The relation is an assumption-based scale estimate, not a universal spacing law for clustered, anisotropic, lower-dimensional, or correlated systems.

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

Compactness here is the dimensionless mass-to-size combination `chi = 2 G m/(L c^2)`. Do not call bare `L/m` compactness: in SI it is dimensional, and even its inverse becomes a compactness coordinate only after the declared `G/c^2` conversion and the stated choice of characteristic length `L`. The normalized `x` and `y` axes are reference coordinates, not independent physical observables.

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
6. **Interpret**: scoped, attributed statements under `Seen in activity`, `Computed here`, `Reproduced from source`, `Compared with evidence`, `Establishes`, and `Does not establish`, followed by explicit completion and related links. Interface state and computed traces are never mislabeled as empirical observations.

Lesson simulations should feel playful through prediction, manipulable parameters, responsive visual state, meaningful presets, and comparison. They must not use points, streaks, forced completion, decorative motion, or misleading celebration.

## Simulation contract

```ts
type TourSourceSimulation = TourSourceAttribution & {
  id: string
  lessonId: string
  question: string
  predictionPrompt: string
  revision: SimulationRevision
  dimensionBasis?: DimensionBasis
  numericalMethod?: NumericalMethodMetadata
  datasetState?: DatasetStateMetadata
  modelComponents: ModelComponent[]
  equations: string[]
  assumptions: string[]
  glossaryIds: NonEmptyArray<string>
  controls: TourControl[]
  presets: TourPreset[]
  outputSchema: TourOutputField[]
  comparison: TourSourceComparisonContract
  visualization: VisualizationContract
  finding: ResultFinding
  limits: RuntimeLimits
}

type TourGeneratedSimulation = Omit<TourSourceSimulation, 'comparison'> & {
  comparison: TourGeneratedComparisonContract // adds derived compatibilityKey
}
```

Controls are discriminated by `type`, declare an `inputRole`, and state whether they enter at Guided or additive Technical depth. Roles are not unique and cover `parameter`, `preset-selection`, `coordinate-selection`, `display-option`, `target-quantity`, `canonical-quantity-value`, `fixed-constant`, `calibrated-input`, `nuisance-parameter`, and `held-out-observable`. This supports uncertainty, black-body, spectroscopy, spin, empirical-comparison, and blind-test instruments without forcing unrelated inputs into dimensional-builder roles. Output fields declare `id`, `label`, `type`, `unit`, nullability, and description.

The source comparison contract declares the compatibility rule and incompatible behavior but never carries a manually editable key. Generation derives `compatibilityKey` as a SHA-256 over canonical JSON containing exactly the simulation `id`, `contentRevision`, `modelRevision`, `implementationRevision`, and canonical `outputSchema`, then adds the key only to `TourGeneratedSimulation`. Every visualization supplies textual and table alternatives. Immediate-tier activities perform one exact bounded operation per update; worker, artifact, and unavailable tiers carry different limit contracts. Optional numerical-method metadata identifies exact, direct, iterative, optimization, sampling, integration, interpolation, or other methods; optional dataset-state metadata distinguishes no dataset, not loaded, loaded, precomputed artifact, and unavailable data with declared purposes and revisions.

Every source and generated simulation content record declares a non-empty, resolvable `glossaryIds` list covering the scientific and specialist terminology intentionally exposed by that simulation. Guided simulation surfaces may use only entries available at Guided depth; Technical metadata may additionally declare Technical entries. A quick station may declare `glossaryIds` when its own title, question, or interaction introduces terminology before the linked lesson loads.

All authored simulation roots, findings, lesson conclusions, and checkpoint attributions have `resultStatus: 'not-evaluated'`. Prediction prompts remain predictive interactions, but source JSON does not claim that a user ran them. The runtime engine creates computed, compared, failure, blocked, or unresolved status only for an actual run or audit. An unlike-quantity addition is a declared identity/assumption boundary classified by the contract validator; it is not a physical prediction or software-execution failure.

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

Compare mode contains at most two snapshots. Compatibility is declared by the source rule and checked with the generated compatibility key, never inferred from arbitrary object keys. Incomparable outputs receive parallel findings with no residual.

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

Proposition type, method relationship, model origin, and result state are independent axes. Every major statement exposes all four rather than compressing them into one label.

Claim class describes the epistemic proposition type:

- Established definition
- Established model
- Observed value
- Source claim
- Identity
- Assumption
- Calibration
- Exploratory hypothesis
- Prediction

Method relationship describes what a computational method does relative to a source or comparison:

- Not applicable
- Literal reproduction
- Traditional baseline
- Contract validator

Model origin remains typed per component:

- Established physics
- Source reproduction
- Traditional baseline

Result status describes execution or comparison state:

- Not evaluated
- Computed
- Compared
- Failure
- Blocked source model
- Unresolved

Each attribution contains `claimClass`, non-empty resolvable `evidenceRefs`, exact `sourceLocator`, `sourceRevision`, `methodRelationship`, typed `modelOrigin`, `resultStatus`, `validatesTheory`, and `caveats`. `TourSourceAttribution` permits only `resultStatus: 'not-evaluated'`, `validatesTheory: false`, and no `validationProtocol`. A separate `TourRuntimeResultAttribution` may represent evaluated statuses; its future `validatesTheory: true` branch is structurally invalid without a `validationProtocol` that identifies the hypothesis, calibrated inputs, held-out observables, datasets, comparison method, uncertainty treatment, acceptance criteria, and failure handling. A bare boolean can never assert validation. Simulation controls also expose input roles; simulation records expose revision metadata, optional dimension basis, attributed model components, numerical method where applicable, declared comparison compatibility, terminology, and dataset state. Ambiguous `pass` labels are not acceptable.

Source attribution follows one explicit policy: `AttributionInheritance = 'nearest-attributed-ancestor'`. The source manifest and lesson records are attributed roots, so their titles, summaries, station text, and quick-path metadata have an ancestor. Chapters, checkpoints, glossary entries, model components, and every claim-vocabulary axis entry carry direct attribution. Lesson blocks, equation steps, conclusions, simulation roots, and findings remain directly attributed. Descendant body text and checkpoint choices inherit from those roots. Control, option, preset, output, equation/assumption, and visualization text may inherit from the nearest attributed simulation ancestor; generation fails if no such ancestor exists. Inheritance supplies provenance but never strengthens a claim.

The reference registry pins the BIPM SI Brochure 9th edition updated in 2026, JCGM VIM3 terminology, the visibly pre-2019 NIST SP 811 guidance, the CODATA 2022 adjustment, and the internal `opensimphy-scientific-scope` policy reference. Reference records identify responsible organization, publication year, edition, revision, DOI where available, exact source locator, access date and status, scope, current-SI supersession state, and license note. Reference URLs remain HTTPS-only.

## Content architecture

Lesson prose does not live in Vue templates.

```text
content/tour/
  manifest.json
  chapters/
  lessons/
  simulations/
  claim-vocabulary.json
  glossary.json
  references.json

scripts/lib/tour-content.mjs

public/data/generated/tour/
  manifest.json
  chapters/*.json
  lessons/*.json
  simulations/*.json
  claim-vocabulary.json
  glossary.json
  references.json
```

JSON is the initial source format to avoid adding a YAML/Markdown parser dependency. `TourSourceManifest` carries `contentRevision`, attribution/content-status policies, and quick stations; it does not pretend that the revision is a generation time. `TourGeneratedManifest` adds the actual generated chapter records and counts. There is no `generatedAt` until a real deterministic generation timestamp exists; `contentRevision` must never be copied or renamed into one. Generated chapter and lesson records add `previousChapterId`/`nextChapterId` and `previousLessonId`/`nextLessonId` respectively. Generated simulations add only the derived comparison compatibility key.

The source manifest declares `depthComposition: 'technical-includes-guided'`, assigns each quick station an explicit estimate totaling 20-30 minutes, and uses `content-ready` or `planned`. `content-ready` means the required source chapter, lesson, and simulation records exist and resolve; it never means that a route, view, style, or runtime implementation exists. The strict generator emits normalized, deterministic, sanitized structured JSON. Markdown with strict front matter remains an optional later authoring layer.

```ts
interface TourSourceManifest extends TourManifestBase {}

interface TourGeneratedManifest extends TourManifestBase {
  chapters: TourGeneratedChapterRecord[]
  counts: {
    chapters: number
    lessons: number
    simulations: number
    glossary: number
    references: number
  }
}

interface TourGeneratedChapterRecord extends TourSourceChapterRecord {
  previousChapterId: string | null
  nextChapterId: string | null
}

interface TourGeneratedLessonRecord extends TourSourceLessonRecord {
  previousLessonId: string | null
  nextLessonId: string | null
}
```

`TourClaimVocabularySource`, `TourGlossarySource`, and `TourReferencesSource` are explicit schema wrappers aligned with their source JSON roots. The vocabulary wrapper requires attribution on every axis entry and a structured `trueRequires` validation-protocol contract. The glossary wrapper requires direct attribution on every term. The reference wrapper attributes its policy and contains the resolvable entries.

```ts
interface TourSourceLessonRecord {
  schemaVersion: 1
  id: string
  chapterId: string
  order: number
  title: string
  question: string
  summary: string
  estimatedMinutes: number
  quickPath?: {
    estimatedMinutes: number
    guidedBlockIds: string[]
    equationStepIds: string[]
    checkpointIds: string[]
    simulationPresetId: string
  }
  depthComposition: 'technical-includes-guided'
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
  seenInActivity: ConclusionStatement<'activity'>[]
  computedHere: ConclusionStatement<'computation'>[]
  reproducedFromSource: ConclusionStatement<'source'>[]
  comparedWithEvidence: ConclusionStatement<'empirical-evidence'>[]
  establishes: ConclusionStatement<'scientific-conclusion'>[]
  doesNotEstablish: ConclusionStatement<'scientific-conclusion'>[]
}
```

The scope map is strict: `seenInActivity = activity`, `computedHere = computation`, `reproducedFromSource = source`, `comparedWithEvidence = empirical-evidence`, and both `establishes` and `doesNotEstablish = scientific-conclusion`. Each `ConclusionStatement` contains attributed text and its mapped scope. Empty evidential categories remain explicit through a negative statement, such as “No external result is reproduced” or “No empirical dataset is compared,” rather than disappearing from the record.

`simulationId` remains nullable and `quickPath` optional because ordinary text-only lessons are valid. A content-ready quick station, by contrast, requires a linked lesson quick path and simulation preset. `LessonQuickPath.estimatedMinutes` is a positive number bounded by the full lesson estimate, not a type-level literal tied to the first station.

The current 11-minute `physical-quantities` lesson defines a separate four-minute `quickPath`: Guided blocks `si-defining-anchors` and `dimensions-and-kinds`, equation step `fixed-si-anchors`, prediction checkpoint `centimetre-prediction`, and simulation preset `average-speed-from-path`. This sequence answers how fixed `Delta_nu_Cs`, `c`, and `h` anchor SI definitions, preserves the definition-versus-realization caveat, then moves through dimensions and quantity kinds into dimensional play. The four-minute `anchors-scales` station links to that subset; it does not represent the full lesson as four minutes.

Generation fails when a lesson lacks a question, attribution evidence is empty or does not resolve, an instructional statement has neither explicit nor inherited attribution, source attribution is not `not-evaluated`/`validatesTheory: false` or carries `validationProtocol`, a simulation lacks bounds or a non-empty terminology declaration, source comparison declares a compatibility key, formula/program IDs are unknown, a conclusion scope violates the strict map, a conclusion boundary is absent, navigation is broken, glossary references do not resolve, or Guided content depends on undefined or Technical-only terminology.

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

Exit: every instructional statement can identify claim class, resolvable evidence, source revision and locator, method relationship, model origin, source-time `not-evaluated` status, caveats, structured theory-validation state, and exact scoped conclusion boundary through explicit attribution or nearest-attributed-ancestor inheritance.

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
