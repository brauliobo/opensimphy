const EXPECTED_COUNTS = Object.freeze({
  formulas: 2123,
  codeBlocks: 153,
  simulationCandidates: 146,
});

const CLASSIFICATIONS = Object.freeze([
  "duplicate",
  "blocked-source-fragment",
  "non-scientific-example",
]);
const CLASSIFICATION_SET = new Set(CLASSIFICATIONS);

const SERIES_PROGRAMS = Object.freeze({
  BIO: {
    1: "EARTH-BIO-001",
    2: "EARTH-BIO-002",
    3: "EARTH-BIO-004",
    4: "EARTH-BIO-008",
    5: "EARTH-BIO-009",
  },
  CHEM: {
    1: "EARTH-NUC-001",
    2: "EARTH-PRT-001",
    3: "EARTH-CHEM-002",
    4: "EARTH-CHEM-007",
    5: "EARTH-CHEM-004",
    6: "EARTH-SPEC-001",
    7: "EARTH-THERM-001",
    8: "EARTH-THERM-006",
  },
  GALAXY: {
    1: "EARTH-GAL-001",
    2: "EARTH-GAL-002",
    3: "EARTH-GAL-003",
    4: "EARTH-GAL-005",
    5: "EARTH-GAL-006",
  },
  NEURO: {
    1: "EARTH-NEURO-006",
    2: "EARTH-NEURO-006",
    3: "EARTH-NEURO-004",
    4: "EARTH-NEURO-005",
  },
  PLANET: {
    1: "EARTH-PLAN-001",
    2: "EARTH-PLAN-002",
    3: "EARTH-PLAN-010",
    4: "EARTH-PLAN-005",
    5: "EARTH-PLAN-007",
    6: "EARTH-PLAN-008",
    7: "EARTH-PLAN-009",
  },
  STAR: {
    1: "EARTH-STAR-001",
    2: "EARTH-STAR-003",
    3: "EARTH-STAR-004",
    4: "EARTH-STAR-005",
    5: "EARTH-STAR-008",
    6: "EARTH-STAR-009",
  },
});

const TITLE_PROGRAMS = Object.freeze([
  [/^For Your Understanding$/, "EARTH-FND-001", "foundational-leftover", "low"],
  [/^Lexicon$/, "EARTH-FND-001", "safe-paper-leftover", "low"],
  [/^New Maths$/, "EARTH-FND-004", "document-title", "high"],
  [/^Theory Paper$/, "EARTH-FND-001", "safe-paper-leftover", "low"],
  [/^Boson Isomorphism$/, "EARTH-PRT-005", "document-title", "high"],
  [/^Coupling Theorem$/, "EARTH-FND-010", "document-title", "high"],
  [/^Curvature Theorem$/, "EARTH-FLD-001", "document-title", "medium"],
  [/^Fermion Theorem$/, "EARTH-PRT-005", "document-title", "high"],
  [/^Fixed Point Uniqueness$/, "EARTH-FND-006", "document-title", "high"],
  [/^Growth$/, "EARTH-FND-005", "document-title", "high"],
  [/^Master List/, "EARTH-GRV-001", "document-title", "medium"],
  [/^Metric Theorem$/, "EARTH-FND-012", "document-title", "high"],
  [/^Neuroscience Non-emergence$/, "EARTH-NEURO-004", "document-title", "medium"],
  [/^Phase Theorem$/, "EARTH-GEO-005", "document-title", "medium"],
  [/^Phi$/, "EARTH-FND-002", "document-title", "high"],
  [/^Pi$/, "EARTH-FND-003", "document-title", "high"],
  [/^Planck Constant from G-R Twist Counting$/, "EARTH-FND-011", "document-title", "high"],
  [/^Quantum Superposition$/, "EARTH-FLD-005", "document-title", "high"],
  [/^QuantumGravity$/, "EARTH-GRV-001", "document-title", "medium"],
  [/^Quasicrystal Projection$/, "EARTH-GEO-001", "document-title", "high"],
  [/^R\(3\) Theorem$/, "EARTH-GEO-003", "document-title", "high"],
  [/^Response to GOOLSBY777$/, "EARTH-FND-001", "foundational-leftover", "low"],
  [/^Strand-Sharing$/, "EARTH-GEO-003", "document-title", "high"],
  [/^Theory-Zero$/, "EARTH-FND-004", "document-title", "high"],
  [/^Topological Surgery Barrier$/, "EARTH-FLD-007", "document-title", "high"],
  [/^Tube Theorem$/, "EARTH-GEO-004", "document-title", "high"],
  [/^Unification Theorem$/, "EARTH-FLD-001", "document-title", "medium"],
  [/^README$/, "EARTH-FND-001", "foundational-leftover", "low"],
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertUnique(items, label, idFor = ({ id }) => id) {
  const ids = items.map(idFor);
  assert(ids.every((id) => typeof id === "string" && id.length > 0), `${label} contains an unknown ID`);
  assert(new Set(ids).size === ids.length, `${label} contains duplicate IDs`);
}

function assertCount(artifact, expected, label) {
  assert(artifact?.count === expected, `Expected ${expected} ${label}, found ${artifact?.count ?? "unknown"}`);
  assert(Array.isArray(artifact.items) && artifact.items.length === expected, `Expected ${expected} ${label} items, found ${artifact?.items?.length ?? "unknown"}`);
}

function documentRoute(document) {
  const { series, ordinal } = document.classification;
  if (series !== null) {
    const programId = SERIES_PROGRAMS[series]?.[ordinal];
    assert(programId, `Unknown EARTH series owner for ${series}-${ordinal}`);
    return {
      programId,
      confidence: "high",
      basis: [`document-series:${series}-${ordinal}`, `document-title:${document.title}`],
    };
  }

  const match = TITLE_PROGRAMS.find(([pattern]) => pattern.test(document.title));
  assert(match, `Unknown EARTH document owner for ${document.id} (${document.title})`);
  return {
    programId: match[1],
    confidence: match[3],
    basis: [...new Set([`${match[2]}:${document.title}`, `document-title:${document.title}`])],
  };
}

function normalizedFormula(text) {
  return text
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/^[-*+]\s+/, "")
    .trim();
}

function lineGap(formula, codeBlock) {
  if (formula.endLine < codeBlock.startLine) return codeBlock.startLine - formula.endLine;
  if (codeBlock.endLine < formula.startLine) return formula.startLine - codeBlock.endLine;
  return 0;
}

function nearestCodeRelation(formula, codeByDocument) {
  const blocks = codeByDocument.get(formula.documentId) ?? [];
  let nearest = null;
  for (const block of blocks) {
    const gap = lineGap(formula, block);
    if (!nearest || gap < nearest.gap || (gap === nearest.gap && block.id.localeCompare(nearest.block.id, "en") < 0)) {
      nearest = { block, gap };
    }
  }
  return nearest?.gap <= 8 ? nearest : null;
}

function confidenceForFormula(routeConfidence, formulaKind) {
  if (routeConfidence === "low") return "low";
  if (routeConfidence === "medium" || formulaKind === "plain-line-candidate") return "medium";
  return "high";
}

function classifiedAssignment({ item, document, sourceType, classification, basis, confidence = "high", sourceIds, duplicateOf }) {
  return {
    sourceType,
    sourceId: item.id,
    documentId: document.id,
    documentTitle: document.title,
    owner: classification,
    ownerType: "classification",
    assignmentBasis: basis,
    confidence,
    sourceIds,
    ...(duplicateOf ? { duplicateOf } : {}),
  };
}

function programAssignment({ item, document, sourceType, route, basis, confidence, sourceIds }) {
  return {
    sourceType,
    sourceId: item.id,
    documentId: document.id,
    documentTitle: document.title,
    owner: route.programId,
    ownerType: "canonical-program",
    assignmentBasis: [...route.basis, ...basis],
    confidence: confidence ?? route.confidence,
    sourceIds,
  };
}

function summaryFor(assignments) {
  return {
    assigned: assignments.length,
    canonicalPrograms: assignments.filter(({ ownerType }) => ownerType === "canonical-program").length,
    classified: assignments.filter(({ ownerType }) => ownerType === "classification").length,
    lowConfidence: assignments.filter(({ confidence }) => confidence === "low").length,
  };
}

export function buildEarthSimulationCoverage({ manifest, formulas, code, simulations, registry }) {
  assert(Array.isArray(manifest?.documents), "EARTH coverage requires manifest documents");
  assert(Array.isArray(registry?.items), "EARTH coverage requires the scientific simulation registry");
  assertCount(formulas, EXPECTED_COUNTS.formulas, "formula records");
  assertCount(code, EXPECTED_COUNTS.codeBlocks, "code blocks");
  assertCount(simulations, EXPECTED_COUNTS.simulationCandidates, "simulation candidates");
  assert(manifest.summary?.formulas === EXPECTED_COUNTS.formulas, "EARTH manifest formula count drifted");
  assert(manifest.summary?.codeBlocks === EXPECTED_COUNTS.codeBlocks, "EARTH manifest code-block count drifted");
  assert(manifest.summary?.simulationCandidates === EXPECTED_COUNTS.simulationCandidates, "EARTH manifest simulation-candidate count drifted");

  assertUnique(manifest.documents, "EARTH manifest documents");
  assertUnique(registry.items, "EARTH canonical programs");
  assertUnique(formulas.items, "EARTH formula records");
  assertUnique(code.items, "EARTH code blocks");
  assertUnique(simulations.items, "EARTH simulation candidates");

  const documents = new Map(manifest.documents.map((document) => [document.id, document]));
  const canonicalIds = new Set(registry.items.map(({ id }) => id));
  const routes = new Map(manifest.documents.map((document) => [document.id, documentRoute(document)]));
  for (const [documentId, route] of routes) {
    assert(canonicalIds.has(route.programId), `Unknown canonical owner ${route.programId} for ${documentId}`);
  }

  const codeByDocument = new Map();
  for (const block of code.items) {
    assert(documents.has(block.documentId), `Unknown source document ${block.documentId} for ${block.id}`);
    const blocks = codeByDocument.get(block.documentId) ?? [];
    blocks.push(block);
    codeByDocument.set(block.documentId, blocks);
  }

  const formulaContentOwners = new Map();
  const formulaAssignments = formulas.items.map((formula) => {
    const document = documents.get(formula.documentId);
    assert(document, `Unknown source document ${formula.documentId} for ${formula.id}`);
    assert(formula.documentSlug === document.slug, `Formula document slug drift for ${formula.id}`);
    const route = routes.get(formula.documentId);
    const normalized = normalizedFormula(formula.text);
    assert(normalized.length > 0, `Formula ${formula.id} has empty normalized content`);
    const duplicateOf = formulaContentOwners.get(normalized);
    const sourceIds = { documentId: formula.documentId, formulaId: formula.id };
    if (duplicateOf) {
      return classifiedAssignment({
        item: formula,
        document,
        sourceType: "formula",
        classification: "duplicate",
        basis: [...route.basis, "normalized-formula-text", `formula-kind:${formula.kind}`, `line-span:${formula.startLine}-${formula.endLine}`],
        sourceIds,
        duplicateOf,
      });
    }
    formulaContentOwners.set(normalized, formula.id);

    const relation = nearestCodeRelation(formula, codeByDocument);
    const basis = [`formula-kind:${formula.kind}`, `line-span:${formula.startLine}-${formula.endLine}`];
    if (relation) {
      basis.push(`near-code-block:${relation.block.id}`, `section:${relation.block.section ?? "unsectioned"}`, `line-gap:${relation.gap}`);
    }
    return programAssignment({
      item: formula,
      document,
      sourceType: "formula",
      route,
      basis,
      confidence: confidenceForFormula(route.confidence, formula.kind),
      sourceIds,
    });
  });

  const simulationsByCode = new Map();
  for (const simulation of simulations.items) {
    const linked = simulationsByCode.get(simulation.codeBlockId) ?? [];
    linked.push(simulation);
    simulationsByCode.set(simulation.codeBlockId, linked);
  }
  for (const [codeBlockId, linked] of simulationsByCode) {
    assert(linked.length === 1, `Code block ${codeBlockId} has duplicate simulation candidates`);
  }

  const codeContentOwners = new Map();
  const codeAssignments = code.items.map((block) => {
    const document = documents.get(block.documentId);
    const route = routes.get(block.documentId);
    const linked = simulationsByCode.get(block.id) ?? [];
    const sourceIds = {
      documentId: block.documentId,
      codeBlockId: block.id,
      simulationCandidateIds: linked.map(({ id }) => id),
    };
    const duplicateOf = codeContentOwners.get(block.contentSha256);
    if (duplicateOf) {
      return classifiedAssignment({
        item: block,
        document,
        sourceType: "code-block",
        classification: "duplicate",
        basis: [...route.basis, "identical-code-content-sha256", `section:${block.section ?? "unsectioned"}`, `line-span:${block.startLine}-${block.endLine}`],
        sourceIds,
        duplicateOf,
      });
    }
    codeContentOwners.set(block.contentSha256, block.id);

    if (linked.length === 0) {
      const classification = block.language === "python" ? "blocked-source-fragment" : "non-scientific-example";
      return classifiedAssignment({
        item: block,
        document,
        sourceType: "code-block",
        classification,
        basis: ["not-a-simulation-candidate", `language:${block.language ?? "unspecified"}`, `section:${block.section ?? "unsectioned"}`, `line-span:${block.startLine}-${block.endLine}`],
        confidence: "high",
        sourceIds,
      });
    }

    return programAssignment({
      item: block,
      document,
      sourceType: "code-block",
      route,
      basis: [`section:${block.section ?? "unsectioned"}`, `line-span:${block.startLine}-${block.endLine}`, `simulation-candidate:${linked[0].id}`],
      sourceIds,
    });
  });

  const codeAssignmentById = new Map(codeAssignments.map((assignment) => [assignment.sourceId, assignment]));
  const codeById = new Map(code.items.map((block) => [block.id, block]));
  const simulationAssignments = simulations.items.map((simulation) => {
    const block = codeById.get(simulation.codeBlockId);
    assert(block, `Unknown code block ${simulation.codeBlockId} for ${simulation.id}`);
    assert(block.documentId === simulation.documentId, `Simulation/code source document mismatch for ${simulation.id}`);
    assert(block.startLine <= simulation.line && simulation.line <= block.endLine, `Simulation/code line-span mismatch for ${simulation.id}`);
    assert(block.language === "python", `Simulation candidate ${simulation.id} does not link to Python code`);
    const document = documents.get(simulation.documentId);
    const codeAssignment = codeAssignmentById.get(simulation.codeBlockId);
    const sourceIds = {
      documentId: simulation.documentId,
      simulationCandidateId: simulation.id,
      codeBlockId: simulation.codeBlockId,
    };
    if (codeAssignment.ownerType === "classification") {
      return classifiedAssignment({
        item: simulation,
        document,
        sourceType: "simulation-candidate",
        classification: codeAssignment.owner,
        basis: [`linked-code-block:${simulation.codeBlockId}`, `source-document:${simulation.documentId}`, `section:${simulation.section ?? "unsectioned"}`, `line-in-code-span:${simulation.line}:${block.startLine}-${block.endLine}`],
        confidence: codeAssignment.confidence,
        sourceIds,
        duplicateOf: codeAssignment.duplicateOf,
      });
    }
    return programAssignment({
      item: simulation,
      document,
      sourceType: "simulation-candidate",
      route: routes.get(simulation.documentId),
      basis: [`linked-code-block:${simulation.codeBlockId}`, `source-document:${simulation.documentId}`, `section:${simulation.section ?? "unsectioned"}`, `line-in-code-span:${simulation.line}:${block.startLine}-${block.endLine}`],
      confidence: codeAssignment.confidence,
      sourceIds,
    });
  });

  const allAssignments = [...formulaAssignments, ...codeAssignments, ...simulationAssignments];
  assertUnique(allAssignments, "EARTH coverage assignments", ({ sourceId }) => sourceId);
  for (const assignment of allAssignments) {
    const validOwner = assignment.ownerType === "canonical-program"
      ? canonicalIds.has(assignment.owner)
      : CLASSIFICATION_SET.has(assignment.owner);
    assert(validOwner, `Unknown coverage owner ${assignment.owner} for ${assignment.sourceId}`);
  }

  const expectedTotal = Object.values(EXPECTED_COUNTS).reduce((total, count) => total + count, 0);
  assert(allAssignments.length === expectedTotal, `Expected ${expectedTotal} coverage assignments, found ${allAssignments.length}`);
  const classifications = Object.fromEntries(CLASSIFICATIONS.map((classification) => [
    classification,
    allAssignments.filter(({ owner }) => owner === classification).length,
  ]));
  const lowConfidence = allAssignments.filter(({ confidence }) => confidence === "low").length;

  return {
    schemaVersion: 1,
    sourceRevision: manifest.sourceRevision,
    sourceLockSha256: manifest.sourceLockSha256,
    sourcePlan: registry.sourcePlan,
    summary: {
      formulaRecords: EXPECTED_COUNTS.formulas,
      codeBlocks: EXPECTED_COUNTS.codeBlocks,
      simulationCandidates: EXPECTED_COUNTS.simulationCandidates,
      sourceRecords: expectedTotal,
      assignments: allAssignments.length,
      canonicalProgramAssignments: allAssignments.filter(({ ownerType }) => ownerType === "canonical-program").length,
      classifiedAssignments: allAssignments.filter(({ ownerType }) => ownerType === "classification").length,
      classifications,
      lowConfidence,
      exact: true,
      formulas: summaryFor(formulaAssignments),
      code: summaryFor(codeAssignments),
      simulations: summaryFor(simulationAssignments),
    },
    formulas: formulaAssignments,
    code: codeAssignments,
    simulations: simulationAssignments,
  };
}
