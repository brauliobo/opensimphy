import { createHash } from "node:crypto";

const EXPECTED_PROGRAMS = 130;
const EXPECTED_RUNNABLE_METHODS = 136;
const EXPECTED_PREFIXES = 17;
const NO_EXECUTION_ADAPTER_BLOCKER = "No verified execution adapter or immutable offline artifact is available.";

export const EXECUTABLE_EARTH_SIMULATION_IDS = Object.freeze([
  "EARTH-FND-001",
  "EARTH-FND-002",
  "EARTH-FND-003",
  "EARTH-FND-004",
  "EARTH-FND-005",
  "EARTH-FND-006",
  "EARTH-FND-007",
  "EARTH-FND-008",
  "EARTH-FND-009",
  "EARTH-FND-010",
  "EARTH-FND-011",
  "EARTH-FND-012",
  "EARTH-FND-013",
  "EARTH-FND-014",
  "EARTH-GEO-001",
  "EARTH-GEO-002",
  "EARTH-GEO-003",
  "EARTH-GEO-004",
  "EARTH-GEO-005",
  "EARTH-FLD-001",
  "EARTH-FLD-002",
  "EARTH-FLD-003",
  "EARTH-FLD-004",
  "EARTH-FLD-005",
  "EARTH-FLD-006",
  "EARTH-FLD-007",
  "EARTH-FLD-008",
  "EARTH-FLD-009",
  "EARTH-FLD-010",
  "EARTH-NUC-001",
  "EARTH-NUC-002",
  "EARTH-NUC-003",
  "EARTH-NUC-004",
  "EARTH-NUC-005",
  "EARTH-PRT-001",
  "EARTH-PRT-002",
  "EARTH-PRT-003",
  "EARTH-PRT-004",
  "EARTH-PRT-005",
  "EARTH-CHEM-002",
  "EARTH-CHEM-003",
  "EARTH-CHEM-004",
  "EARTH-CHEM-005",
  "EARTH-CHEM-006",
  "EARTH-CHEM-007",
  "EARTH-CHEM-008",
  "EARTH-CHEM-009",
  "EARTH-SPEC-001",
  "EARTH-SPEC-002",
  "EARTH-SPEC-003",
  "EARTH-SPEC-004",
  "EARTH-SPEC-005",
  "EARTH-SPEC-006",
  "EARTH-SPEC-007",
  "EARTH-MAT-001",
  "EARTH-MAT-002",
  "EARTH-MAT-003",
  "EARTH-MAT-004",
  "EARTH-MAT-005",
  "EARTH-MAT-006",
  "EARTH-MAT-007",
  "EARTH-MAT-008",
  "EARTH-MAT-009",
  "EARTH-MAT-010",
  "EARTH-THERM-001",
  "EARTH-THERM-002",
  "EARTH-THERM-004",
  "EARTH-THERM-005",
  "EARTH-THERM-006",
  "EARTH-THERM-007",
  "EARTH-THERM-008",
  "EARTH-THERM-009",
  "EARTH-THERM-010",
  "EARTH-GRV-001",
  "EARTH-GRV-002",
  "EARTH-GRV-003",
  "EARTH-GRV-004",
  "EARTH-GRV-005",
  "EARTH-GRV-006",
  "EARTH-COS-001",
  "EARTH-COS-002",
  "EARTH-COS-003",
  "EARTH-COS-004",
  "EARTH-COS-005",
  "EARTH-COS-006",
  "EARTH-PLAN-001",
  "EARTH-PLAN-002",
  "EARTH-PLAN-003",
  "EARTH-PLAN-004",
  "EARTH-PLAN-005",
  "EARTH-PLAN-006",
  "EARTH-PLAN-007",
  "EARTH-PLAN-008",
  "EARTH-PLAN-009",
  "EARTH-PLAN-010",
  "EARTH-PLAN-011",
  "EARTH-PLAN-012",
  "EARTH-STAR-001",
  "EARTH-STAR-002",
  "EARTH-STAR-003",
  "EARTH-STAR-004",
  "EARTH-STAR-005",
  "EARTH-STAR-006",
  "EARTH-STAR-007",
  "EARTH-STAR-008",
  "EARTH-STAR-009",
  "EARTH-GAL-001",
  "EARTH-GAL-002",
  "EARTH-GAL-003",
  "EARTH-GAL-004",
  "EARTH-GAL-005",
  "EARTH-GAL-006",
  "EARTH-GAL-007",
  "EARTH-BIO-001",
  "EARTH-BIO-002",
  "EARTH-BIO-003",
  "EARTH-BIO-004",
  "EARTH-BIO-005",
  "EARTH-BIO-006",
  "EARTH-BIO-007",
  "EARTH-BIO-008",
  "EARTH-BIO-009",
  "EARTH-NEURO-001",
  "EARTH-NEURO-002",
  "EARTH-NEURO-003",
  "EARTH-NEURO-004",
  "EARTH-NEURO-005",
  "EARTH-NEURO-006",
  "EARTH-X-003",
  "EARTH-X-005",
]);

const EXECUTABLE_EARTH_SIMULATION_ID_SET = new Set(EXECUTABLE_EARTH_SIMULATION_IDS);
const NUMERICALLY_VERIFIED_SOURCE_MODEL_IDS = new Set([
  "EARTH-CHEM-004",
]);
const LITERAL_SOURCE_AUDIT_IDS = new Set([
  "EARTH-FND-001", "EARTH-FND-002", "EARTH-FND-003", "EARTH-FND-004", "EARTH-FND-005",
  "EARTH-FND-007", "EARTH-FND-008", "EARTH-FND-010", "EARTH-FND-011", "EARTH-FND-014",
  "EARTH-FLD-001", "EARTH-FLD-010",
  "EARTH-NUC-001", "EARTH-NUC-004",
  "EARTH-PRT-001", "EARTH-PRT-005",
  "EARTH-CHEM-002", "EARTH-CHEM-004", "EARTH-CHEM-007",
  "EARTH-SPEC-001",
  "EARTH-THERM-001", "EARTH-THERM-006",
  "EARTH-GRV-001",
  "EARTH-PLAN-005", "EARTH-PLAN-010",
  "EARTH-STAR-003", "EARTH-STAR-008", "EARTH-STAR-009",
  "EARTH-BIO-001", "EARTH-BIO-004", "EARTH-BIO-007", "EARTH-BIO-008", "EARTH-BIO-009",
  "EARTH-NEURO-006",
]);
const EXPLORATORY_COMPARISON_IDS = new Set(
  EXECUTABLE_EARTH_SIMULATION_IDS.filter((id) => !LITERAL_SOURCE_AUDIT_IDS.has(id)),
);
const SOURCE_CONTRACT_VALIDATOR_IDS = new Set([
  "EARTH-FND-006", "EARTH-FND-009", "EARTH-FND-012", "EARTH-FND-013", "EARTH-GEO-001",
  "EARTH-FLD-004", "EARTH-NUC-002", "EARTH-NUC-005", "EARTH-PRT-002", "EARTH-PRT-004",
  "EARTH-CHEM-003", "EARTH-CHEM-005", "EARTH-CHEM-009", "EARTH-THERM-002", "EARTH-COS-006",
  "EARTH-PLAN-001", "EARTH-PLAN-002", "EARTH-PLAN-007", "EARTH-STAR-001", "EARTH-STAR-004",
  "EARTH-STAR-007", "EARTH-GAL-001", "EARTH-GAL-003", "EARTH-GAL-005", "EARTH-GAL-006",
  "EARTH-GAL-007", "EARTH-BIO-003", "EARTH-NEURO-004", "EARTH-X-003", "EARTH-X-005",
]);
const NUMERICAL_BASELINE_IDS = new Set([
  "EARTH-GEO-002", "EARTH-GEO-003", "EARTH-GEO-004", "EARTH-GEO-005", "EARTH-FLD-002",
  "EARTH-FLD-003", "EARTH-FLD-005", "EARTH-FLD-006", "EARTH-FLD-007", "EARTH-FLD-008",
  "EARTH-FLD-009", "EARTH-NUC-003", "EARTH-PRT-003", "EARTH-CHEM-006", "EARTH-CHEM-008",
  "EARTH-SPEC-002", "EARTH-SPEC-003", "EARTH-SPEC-005", "EARTH-MAT-001", "EARTH-MAT-002",
  "EARTH-MAT-004", "EARTH-MAT-009", "EARTH-THERM-005", "EARTH-THERM-007", "EARTH-PLAN-003",
  "EARTH-PLAN-004", "EARTH-PLAN-009", "EARTH-STAR-002", "EARTH-STAR-005", "EARTH-STAR-006",
  "EARTH-GAL-002", "EARTH-GAL-004", "EARTH-BIO-002", "EARTH-BIO-005", "EARTH-BIO-006",
  "EARTH-NEURO-001", "EARTH-NEURO-002", "EARTH-NEURO-003", "EARTH-NEURO-005",
]);
const G2A_REQUIRED_IDS = new Set([
  "EARTH-PLAN-001", "EARTH-PLAN-007", "EARTH-PLAN-008",
  "EARTH-STAR-001", "EARTH-STAR-003", "EARTH-STAR-005",
  "EARTH-GAL-001", "EARTH-GAL-003", "EARTH-GAL-005", "EARTH-GAL-006",
  "EARTH-BIO-002", "EARTH-BIO-003", "EARTH-BIO-004", "EARTH-BIO-005",
  "EARTH-NEURO-001", "EARTH-NEURO-002", "EARTH-NEURO-003", "EARTH-NEURO-004", "EARTH-NEURO-005",
]);

const METHOD_CLASSIFICATIONS = Object.freeze({
  "earth-source-reproduction": {
    id: "earth-source-reproduction-v1",
    modelOrigin: "earth-corpus",
    earthDerived: true,
  },
  "earth-source-model": {
    id: "earth-source-model-v1",
    modelOrigin: "earth-corpus",
    earthDerived: true,
  },
  "traditional-analytic-baseline": {
    id: "traditional-analytic-baseline-v1",
    modelOrigin: "standard-physics",
    earthDerived: false,
  },
  "traditional-numerical-baseline": {
    id: "traditional-numerical-baseline-v1",
    modelOrigin: "standard-physics",
    earthDerived: false,
  },
  "source-contract-validator": {
    id: "source-contract-validator-v1",
    modelOrigin: "engine-audit",
    earthDerived: false,
  },
});

const PILOT_METHODS = Object.freeze({
  "EARTH-THERM-006": {
    defaultMethodId: "earth-source-reproduction-v1",
    methods: [
      ["earth-source-reproduction", "EARTH printed Ksp source expression"],
      ["traditional-analytic-baseline", "Standard ion-activity-product analytic baseline"],
    ],
  },
  "EARTH-COS-006": {
    defaultMethodId: "traditional-analytic-baseline-v1",
    methods: [
      ["earth-source-reproduction", "EARTH printed Planck-length and entropy expressions"],
      ["traditional-analytic-baseline", "Standard Planck and Bekenstein-Hawking analytic baseline"],
    ],
  },
  "EARTH-PLAN-008": {
    defaultMethodId: "traditional-analytic-baseline-v1",
    methods: [
      ["earth-source-reproduction", "EARTH atmospheric density-coherence transform"],
      ["traditional-analytic-baseline", "Standard isothermal hydrostatic scale-height baseline"],
    ],
  },
  "EARTH-PLAN-012": {
    defaultMethodId: "traditional-analytic-baseline-v1",
    methods: [
      ["earth-source-reproduction", "EARTH printed planetary binding and seismic expressions"],
      ["traditional-analytic-baseline", "Standard uniform-sphere gravitational binding baseline"],
    ],
  },
});

export const EARTH_GATE_IDS = ["G0", "G0b", "G1", "G1b", "G2", "G2a", "G3", "G4", "G5"];

const HIGH_LEVEL_GOALS = {
  BIO: "Audit biological and biophysical claims without inheriting unvalidated topology.",
  CHEM: "Test atomic, bonding, shell, and molecular-geometry claims.",
  COS: "Audit cosmological identities and models against closed, covariant comparators.",
  FLD: "Establish mathematically closed field and reduced-dynamics models.",
  FND: "Recompute foundational arithmetic, dimensions, substitutions, topology, and scales.",
  GAL: "Test galactic structure and dynamics claims against frozen observations and baselines.",
  GEO: "Test geometric, quasicrystal, strand, knot, and flux constructions.",
  GRV: "Audit gravitational formulas and require a covariant model before prediction.",
  MAT: "Test material wave, response, optical, and magnetic models.",
  NEURO: "Audit neuroscience claims with explicit physical maps and ethical data controls.",
  NUC: "Audit nuclear topology, masses, decays, and hadron observables.",
  PLAN: "Test planetary and geophysical formulas against independent inputs and standard models.",
  PRT: "Audit particle formulas, quantum numbers, and field-model closure.",
  SPEC: "Test spectral formulas and require complete response operators for predictions.",
  STAR: "Test stellar scaling, structure, variability, pulsation, and compact-object claims.",
  THERM: "Audit thermodynamic formulas and require authenticated equations of state and spectra.",
  X: "Run cross-program independence and blind-comparison audits without asserting equivalence.",
};

const SOURCE_TITLE_RULES = {
  BIO: [/^Theorem BIO-[1-5]\b/],
  CHEM: [/^Theorem CHEM-[2-6]\b/],
  COS: [/^(Lexicon|Master List|QuantumGravity|Theory Paper)/],
  FLD: [/^(Boson Isomorphism|Fermion Theorem|Quantum Superposition|Theory Paper|Topological Surgery Barrier)$/],
  FND: [/^(README|Lexicon|New Maths|Theory Paper|Theory-Zero|Phi|Pi|Growth|Fixed Point Uniqueness|Metric Theorem|Coupling Theorem)$/],
  GAL: [/^Theorem GALAXY-[1-5]\b/],
  GEO: [/^(Quasicrystal Projection|R\(3\) Theorem|Tube Theorem|Strand-Sharing|Phase Theorem)$/],
  GRV: [/^(Lexicon|Master List|QuantumGravity|Theory Paper)/],
  MAT: [/^Theorem CHEM-[6-8]\b/, /^Response to GOOLSBY777$/],
  NEURO: [/^Theorem NEURO-[1-4]\b/, /^Neuroscience Non-emergence$/],
  NUC: [/^Theorem CHEM-1\b/, /^(Fermion Theorem|Theory Paper)$/],
  PLAN: [/^Theorem PLANET-[1-7]\b/],
  PRT: [/^Theorem CHEM-2\b/, /^(Boson Isomorphism|Fermion Theorem|Planck Constant from G-R Twist Counting)$/],
  SPEC: [/^Theorem CHEM-6\b/],
  STAR: [/^Theorem STAR-[1-6]\b/],
  THERM: [/^Theorem CHEM-[6-8]\b/, /^Response to GOOLSBY777$/],
  X: [/^(Master List|QuantumGravity|Theory Paper)/],
};

const CROSS_PROGRAM_TYPES = {
  "EARTH-X-003": {
    classification: "audit-only",
    tiers: ["T0"],
    currentState: "Ready as a deterministic cross-program independence ledger.",
  },
  "EARTH-X-005": {
    classification: "dataset-audit",
    tiers: ["T2"],
    currentState: "Blocked until FLD-004 eigenvalues and held-out constants exist.",
  },
};

const BLOCKING_STATE = /^(?:BX\b|Data(?:\/license)?-blocked\b|Dependency-blocked\b|Depends\b|Needs\b|Missing\b|Prediction BX\b|Requires\b)|\b(?:BX|blocked|missing|absent|undefined|until|cannot|hard gate|not currently in EARTH|after equation repair|access required)\b|\bno (?:complete|governing|authenticated|operational|EARTH|derived EARTH)\b/i;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function parseClassification(sourceClass) {
  if (/^Exact\b/.test(sourceClass)) return "exact-calculator";
  if (/^Numerical\b/.test(sourceClass)) return "numerical-simulation";
  if (/^Dataset\b/.test(sourceClass)) return "dataset-audit";
  if (/^Audit\b/.test(sourceClass)) return "audit-only";
  if (/^Exploratory\b/.test(sourceClass)) return "exploratory";
  if (/^Blocked model\b/.test(sourceClass)) return "blocked-model";
  throw new Error(`Unsupported EARTH program class: ${sourceClass}`);
}

function parseTiers(sourceTier) {
  const tiers = sourceTier.split("/");
  assert(tiers.length > 0 && tiers.every((tier) => /^(?:T[0-3]|BX)$/.test(tier)), `Unsupported EARTH execution tier: ${sourceTier}`);
  return tiers;
}

function parseRows(planText) {
  const rows = [];
  for (const [index, line] of planText.split("\n").entries()) {
    if (!/^\| EARTH-[A-Z]+-\d{3} \|/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    assert(cells.length === 4 || cells.length === 6, `Malformed canonical EARTH row at line ${index + 1}`);
    rows.push({ cells, line: index + 1 });
  }
  return rows;
}

function deriveMinorGoals(goal, outputAcceptance) {
  const acceptanceGoals = outputAcceptance
    .split(/;|\. (?=[A-Z`])/)
    .map((value) => value.trim().replace(/\.$/, ""))
    .filter(Boolean)
    .slice(0, 3);
  return [...new Set([goal, ...acceptanceGoals])];
}

function dependencyIds(text, ownId, canonicalIds) {
  const dependencies = [];
  for (const match of text.matchAll(/\b(?:EARTH-)?([A-Z]+-\d{3})\b/g)) {
    const id = `EARTH-${match[1]}`;
    if (id !== ownId && canonicalIds.has(id) && !dependencies.includes(id)) dependencies.push(id);
  }
  return dependencies;
}

function sourceDocumentIds(prefix, manifest) {
  const rules = SOURCE_TITLE_RULES[prefix];
  assert(rules, `Missing EARTH source-title rules for prefix ${prefix}`);
  const ids = manifest.documents
    .filter((document) => rules.some((rule) => rule.test(document.title)))
    .map((document) => document.id);
  assert(ids.length > 0, `No locked EARTH source documents matched prefix ${prefix}`);
  return ids;
}

function currentStateStatus(currentState) {
  return BLOCKING_STATE.test(currentState) ? "blocked" : "ready";
}

function executionFor(tiers) {
  if (tiers[0] === "T0") return "calculator";
  return "browser-worker";
}

function relationshipForProgram(id) {
  if (LITERAL_SOURCE_AUDIT_IDS.has(id)) return "earth-source-reproduction";
  if (SOURCE_CONTRACT_VALIDATOR_IDS.has(id)) return "source-contract-validator";
  if (NUMERICAL_BASELINE_IDS.has(id)) return "traditional-numerical-baseline";
  return "traditional-analytic-baseline";
}

function methodSummary(relationship, title = relationship.replaceAll("-", " ")) {
  const classification = METHOD_CLASSIFICATIONS[relationship];
  assert(classification, `Unsupported EARTH method relationship: ${relationship}`);
  return {
    id: classification.id,
    title,
    relationship,
    modelOrigin: classification.modelOrigin,
    runtime: "browser-worker",
    runnable: true,
    earthDerived: classification.earthDerived,
    validatesEarthTheory: false,
  };
}

function unavailableSourceMethod(sourceStateText) {
  const classification = METHOD_CLASSIFICATIONS["earth-source-model"];
  return {
    id: classification.id,
    title: "EARTH source formulation (unavailable)",
    relationship: "earth-source-model",
    modelOrigin: classification.modelOrigin,
    runtime: "unavailable",
    runnable: false,
    earthDerived: classification.earthDerived,
    validatesEarthTheory: false,
    precision: null,
    model: `The governing EARTH source contract is incomplete: ${sourceStateText}`,
  };
}

function executionMethodsFor(id) {
  if (id === "EARTH-PRT-001") {
    return {
      defaultMethodId: "earth-source-reproduction-v1",
      executionMethods: [
        methodSummary("earth-source-reproduction"),
        {
          id: "chem6-chiral-lines-v1",
          title: "CHEM-6 chiral-spiral line ledger",
          relationship: "earth-source-reproduction",
          modelOrigin: "earth-corpus",
          runtime: "browser-worker",
          runnable: true,
          earthDerived: true,
          validatesEarthTheory: false,
        },
      ],
    };
  }
  if (id === "EARTH-NUC-004") {
    return {
      defaultMethodId: "earth-source-reproduction-v1",
      executionMethods: [
        methodSummary("earth-source-reproduction"),
        {
          id: "coupling-force-hierarchy",
          title: "coupling force hierarchy",
          relationship: "earth-source-reproduction",
          modelOrigin: "earth-corpus",
          runtime: "browser-worker",
          runnable: true,
          earthDerived: true,
          validatesEarthTheory: false,
        },
      ],
    };
  }
  const pilot = PILOT_METHODS[id];
  if (pilot) {
    return {
      defaultMethodId: pilot.defaultMethodId,
      executionMethods: pilot.methods.map(([relationship, title]) => methodSummary(relationship, title)),
    };
  }
  const method = methodSummary(relationshipForProgram(id));
  return { defaultMethodId: method.id, executionMethods: [method] };
}

function initialGateStates({ id, implemented, sourceBlocked, classification, dependencies }) {
  const requiresExternalData = classification === "dataset-audit";
  const requiresObservableIndependence = G2A_REQUIRED_IDS.has(id);
  const sourceModelVerified = NUMERICALLY_VERIFIED_SOURCE_MODEL_IDS.has(id);
  if (implemented) {
    const executesSourceModel = relationshipForProgram(id) === "earth-source-reproduction";
    return {
      G0: "pass",
      G0b: requiresExternalData ? (sourceBlocked ? "blocked" : "pending") : "not-applicable",
      G1: "pass",
      G1b: dependencies.length > 0 ? "pending" : "not-applicable",
      G2: sourceModelVerified ? "pass" : executesSourceModel ? "not-applicable" : sourceBlocked ? "blocked" : "pending",
      G2a: requiresObservableIndependence ? (sourceBlocked ? "blocked" : "pending") : "not-applicable",
      G3: sourceModelVerified ? "pass" : executesSourceModel ? "not-applicable" : "not-evaluated",
      G4: "not-evaluated",
      G5: "not-evaluated",
    };
  }
  return {
    G0: "partial",
    G0b: requiresExternalData ? (sourceBlocked ? "blocked" : "pending") : "not-applicable",
    G1: "pending",
    G1b: dependencies.length > 0 ? "pending" : "not-applicable",
    G2: "blocked",
    G2a: requiresObservableIndependence ? (sourceBlocked ? "blocked" : "pending") : "not-applicable",
    G3: "not-evaluated",
    G4: "not-evaluated",
    G5: "not-evaluated",
  };
}

export function buildEarthSimulationRegistry(planText, manifest, { planPath = "research/earth-thad-nassim/EARTH_SIMULATION_PLAN.md" } = {}) {
  assert(typeof planText === "string", "EARTH simulation plan must be text");
  assert(Array.isArray(manifest?.documents), "Generated EARTH manifest must contain documents");
  assert(typeof manifest.sourceRevision === "string" && manifest.sourceRevision.length > 0, "Generated EARTH manifest must contain a source revision");

  const sourceRows = parseRows(planText);
  const ids = sourceRows.map(({ cells }) => cells[0]);
  const canonicalIds = new Set(ids);
  const executableIds = new Set(EXECUTABLE_EARTH_SIMULATION_IDS);
  const prefixes = [...new Set(ids.map((id) => id.split("-")[1]))].sort();
  assert(sourceRows.length === EXPECTED_PROGRAMS, `Expected ${EXPECTED_PROGRAMS} canonical EARTH rows, found ${sourceRows.length}`);
  assert(canonicalIds.size === EXPECTED_PROGRAMS, `Expected ${EXPECTED_PROGRAMS} unique EARTH IDs, found ${canonicalIds.size}`);
  assert(prefixes.length === EXPECTED_PREFIXES, `Expected ${EXPECTED_PREFIXES} EARTH prefixes, found ${prefixes.length}`);
  assert(prefixes.every((prefix) => HIGH_LEVEL_GOALS[prefix]), "Every EARTH prefix must have a high-level goal");
  assert(executableIds.size === EXECUTABLE_EARTH_SIMULATION_IDS.length, "Executable EARTH allowlist contains duplicate IDs");
  assert(EXECUTABLE_EARTH_SIMULATION_IDS.every((id) => canonicalIds.has(id)), "Every executable EARTH ID must exist in the canonical plan");

  const revisionMatch = planText.match(/^Updated:\s*(\d{4}-\d{2}-\d{2})$/m);
  assert(revisionMatch, "EARTH simulation plan must declare an Updated revision");
  const sourcePlan = {
    path: planPath,
    revision: revisionMatch[1],
    sha256: sha256(planText),
  };

  const items = sourceRows.map(({ cells, line }) => {
    const [id, goal] = cells;
    const prefix = id.split("-")[1];
    const crossType = CROSS_PROGRAM_TYPES[id];
    const sixColumn = cells.length === 6;
    assert(sixColumn || crossType, `Missing typed metadata for cross-program row ${id}`);

    const sourceClass = sixColumn ? cells[2].split(" / ")[0] : null;
    const sourceTier = sixColumn ? cells[2].split(" / ")[1] : null;
    assert(!sixColumn || sourceTier, `Missing class/tier separator for ${id} at line ${line}`);
    const classification = sixColumn ? parseClassification(sourceClass) : crossType.classification;
    const executionTiers = sixColumn ? parseTiers(sourceTier) : crossType.tiers;
    const methodInput = sixColumn ? cells[3] : cells[2];
    const outputAcceptance = sixColumn ? cells[4] : cells[3];
    const currentStateText = sixColumn ? cells[5] : crossType.currentState;
    const status = currentStateStatus(currentStateText);
    const implemented = EXECUTABLE_EARTH_SIMULATION_ID_SET.has(id);
    const execution = implemented ? executionFor(executionTiers) : "blocked";
    const dependencies = dependencyIds(methodInput, id, canonicalIds);
    const sourceBlocked = status === "blocked";
    const blockers = sourceBlocked ? [currentStateText] : [];
    if (!implemented) blockers.push(NO_EXECUTION_ADAPTER_BLOCKER);
    const scientificStatus = EXPLORATORY_COMPARISON_IDS.has(id)
      ? sourceBlocked ? "blocked-source" : "exploratory"
      : implemented ? "unresolved" : "blocked";
    const { defaultMethodId, executionMethods } = executionMethodsFor(id);
    if (
      scientificStatus === "blocked-source"
      && !executionMethods.some((method) => method.runnable && method.relationship === "earth-source-reproduction")
    ) {
      executionMethods.push(unavailableSourceMethod(currentStateText));
    }

    return {
      id,
      prefix,
      goal,
      highLevelGoal: HIGH_LEVEL_GOALS[prefix],
      minorGoals: deriveMinorGoals(goal, outputAcceptance),
      classification,
      classificationSource: sourceClass,
      executionTiers,
      tierSource: sourceTier,
      inferredTypeMetadata: !sixColumn,
      methodInput,
      outputAcceptance,
      sourceState: {
        text: currentStateText,
        status,
      },
      execution,
      runnable: implemented,
      scientificStatus,
      defaultMethodId,
      executionMethods,
      sourceDocumentIds: sourceDocumentIds(prefix, manifest),
      dependencyIds: dependencies,
      gateStates: initialGateStates({ id, implemented, sourceBlocked, classification, dependencies }),
      blockers,
    };
  });

  const byId = new Map(items.map((item) => [item.id, item]));
  for (const item of items) {
    if (/\bdepends? on\b/i.test(item.sourceState.text)) {
      for (const id of dependencyIds(item.sourceState.text, item.id, canonicalIds)) {
        if (!item.dependencyIds.includes(id)) item.dependencyIds.push(id);
      }
    }
    const reverseDependencyText = `${item.outputAcceptance} ${item.sourceState.text}`;
    if (/\b(?:hard dependency for|output for|before(?: any)?)\b/i.test(reverseDependencyText)) {
      for (const id of dependencyIds(reverseDependencyText, item.id, canonicalIds)) {
        const dependent = byId.get(id);
        if (!dependent.dependencyIds.includes(item.id)) dependent.dependencyIds.push(item.id);
      }
    }
  }
  for (const item of items) {
    if (item.dependencyIds.length === 0) item.gateStates.G1b = "not-applicable";
    else if (item.dependencyIds.some((id) => byId.get(id).execution === "blocked")) item.gateStates.G1b = "blocked";
    else item.gateStates.G1b = item.runnable ? "pass" : "pending";
  }

  const sourceLinked = items.filter((item) => item.sourceDocumentIds.length > 0).length;
  const runnable = items.filter((item) => item.runnable).length;
  const blocked = items.length - runnable;
  const totalMethods = items.reduce((total, item) => total + item.executionMethods.length, 0);
  const runnableMethods = items.reduce(
    (total, item) => total + item.executionMethods.filter((method) => method.runnable).length,
    0,
  );
  assert(runnableMethods === EXPECTED_RUNNABLE_METHODS, `Expected ${EXPECTED_RUNNABLE_METHODS} runnable EARTH execution methods, found ${runnableMethods}`);
  for (const item of items) {
    assert(item.executionMethods.some(({ id, runnable: methodRunnable }) => id === item.defaultMethodId && methodRunnable), `Runnable default method missing for ${item.id}`);
    assert(new Set(item.executionMethods.map(({ id }) => id)).size === item.executionMethods.length, `Duplicate method ID for ${item.id}`);
  }
  const runnableIds = new Set(items.filter((item) => item.runnable).map((item) => item.id));
  const executableCoverageExact = runnableIds.size === executableIds.size
    && [...runnableIds].every((id) => executableIds.has(id));
  const structuralCoverageExact = sourceRows.length === EXPECTED_PROGRAMS
    && items.length === EXPECTED_PROGRAMS
    && canonicalIds.size === EXPECTED_PROGRAMS
    && prefixes.length === EXPECTED_PREFIXES
    && sourceLinked === EXPECTED_PROGRAMS;

  const summary = {
    sourceRows: sourceRows.length,
    registered: items.length,
    prefixes: prefixes.length,
    sourceLinked,
    runnable,
    blocked,
    totalMethods,
    runnableMethods,
  };
  const registry = {
    schemaVersion: 2,
    sourceRevision: manifest.sourceRevision,
    sourcePlan,
    gateIds: EARTH_GATE_IDS,
    summary,
    items,
  };
  const completion = {
    schemaVersion: 2,
    sourceRevision: manifest.sourceRevision,
    sourcePlan,
    source: sourceRows.length,
    registered: items.length,
    sourceLinked,
    implemented: executableIds.size,
    runnable,
    blocked,
    methods: totalMethods,
    runnableMethods,
    prefixes: prefixes.length,
    structuralCoverageExact,
    executableCoverageExact,
    scientificallyValidated: false,
    complete: structuralCoverageExact,
  };

  return { registry, completion };
}
