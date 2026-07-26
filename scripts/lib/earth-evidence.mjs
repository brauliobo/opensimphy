const SOURCE_TYPES = Object.freeze(["formula", "code-block", "simulation-candidate"]);
const CONFIDENCES = Object.freeze(["high", "medium", "low"]);
const CLASSIFICATIONS = Object.freeze(["duplicate", "blocked-source-fragment", "non-scientific-example"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function countBy(items, values, keyFor) {
  return Object.fromEntries(values.map((value) => [value, items.filter((item) => keyFor(item) === value).length]));
}

function countsFor(assignments) {
  return {
    total:        assignments.length,
    bySourceType: countBy(assignments, SOURCE_TYPES, ({ sourceType }) => sourceType),
    byConfidence: countBy(assignments, CONFIDENCES, ({ confidence }) => confidence),
  };
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "en"));
}

function compactAssignment(assignment) {
  return {
    sourceType:      assignment.sourceType,
    sourceId:        assignment.sourceId,
    documentId:      assignment.documentId,
    confidence:      assignment.confidence,
    assignmentBasis: assignment.assignmentBasis,
    sourceIds:       assignment.sourceIds,
  };
}

function compactClassification(assignment) {
  return {
    ...compactAssignment(assignment),
    classification: assignment.owner,
    ...(assignment.duplicateOf ? { duplicateOf: assignment.duplicateOf } : {}),
  };
}

function assignmentOrder(left, right) {
  return SOURCE_TYPES.indexOf(left.sourceType) - SOURCE_TYPES.indexOf(right.sourceType)
    || left.sourceId.localeCompare(right.sourceId, "en");
}

export function buildEarthEvidenceArtifacts({ manifest, coverage, registry, datasets }) {
  assert(manifest?.schemaVersion === 1 && Array.isArray(manifest.documents), "EARTH evidence requires the source manifest");
  assert(coverage?.schemaVersion === 1 && coverage.summary?.exact === true, "EARTH evidence requires exact scientific coverage");
  assert(registry?.schemaVersion === 2 && Array.isArray(registry.items), "EARTH evidence requires the canonical program registry");
  assert(datasets?.schemaVersion === 1 && Array.isArray(datasets.datasets) && Array.isArray(datasets.disputedClaims), "EARTH evidence requires the dataset registry");
  assert(manifest.sourceRevision === coverage.sourceRevision, "EARTH evidence source revision mismatch between manifest and coverage");
  assert(manifest.sourceRevision === registry.sourceRevision, "EARTH evidence source revision mismatch between manifest and program registry");
  assert(JSON.stringify(coverage.sourcePlan) === JSON.stringify(registry.sourcePlan), "EARTH evidence source plan mismatch between coverage and program registry");
  assert(JSON.stringify(datasets.sourcePlan) === JSON.stringify(registry.sourcePlan), "EARTH evidence source plan mismatch between dataset and program registries");
  assert(manifest.documents.length === 63, `Expected 63 EARTH evidence documents, found ${manifest.documents.length}`);
  assert(registry.items.length === 130, `Expected 130 EARTH evidence programs, found ${registry.items.length}`);

  const documents = new Map(manifest.documents.map((document) => [document.id, document]));
  const programs = new Map(registry.items.map((program) => [program.id, program]));
  const datasetIds = new Set(datasets.datasets.map(({ datasetId }) => datasetId));
  const disputeIds = new Set(datasets.disputedClaims.map(({ claimId }) => claimId));
  assert(documents.size === 63, "EARTH evidence document IDs must be unique");
  assert(programs.size === 130, "EARTH evidence program IDs must be unique");
  assert(datasetIds.size === datasets.datasets.length, "EARTH evidence dataset IDs must be unique");
  assert(disputeIds.size === datasets.disputedClaims.length, "EARTH evidence disputed claim IDs must be unique");

  for (const program of registry.items) {
    for (const documentId of program.sourceDocumentIds) {
      assert(documents.has(documentId), `Unknown source document ${documentId} linked from ${program.id}`);
    }
  }
  for (const dataset of datasets.datasets) {
    for (const programId of dataset.simulationIds) {
      assert(programs.has(programId), `Unknown canonical program ${programId} linked from ${dataset.datasetId}`);
    }
  }
  for (const claim of datasets.disputedClaims) {
    for (const programId of claim.simulationIds) {
      assert(programs.has(programId), `Unknown canonical program ${programId} linked from ${claim.claimId}`);
    }
  }

  const allAssignments = [...coverage.formulas, ...coverage.code, ...coverage.simulations];
  assert(allAssignments.length === 2422, `Expected 2,422 EARTH evidence assignments, found ${allAssignments.length}`);
  assert(new Set(allAssignments.map(({ sourceId }) => sourceId)).size === 2422, "EARTH evidence source assignments must be unique");
  for (const assignment of allAssignments) {
    assert(documents.has(assignment.documentId), `Unknown evidence document ${assignment.documentId} for ${assignment.sourceId}`);
    assert(SOURCE_TYPES.includes(assignment.sourceType), `Unknown evidence source type ${assignment.sourceType}`);
    assert(CONFIDENCES.includes(assignment.confidence), `Unknown evidence confidence ${assignment.confidence}`);
    assert(Array.isArray(assignment.assignmentBasis) && assignment.assignmentBasis.length > 0, `Missing assignment basis for ${assignment.sourceId}`);
    assert(assignment.sourceIds?.documentId === assignment.documentId, `Source identity mismatch for ${assignment.sourceId}`);
    if (assignment.ownerType === "canonical-program") {
      assert(programs.has(assignment.owner), `Unknown evidence program ${assignment.owner} for ${assignment.sourceId}`);
    } else {
      assert(assignment.ownerType === "classification" && CLASSIFICATIONS.includes(assignment.owner), `Unknown evidence classification ${assignment.owner}`);
    }
  }

  const canonicalAssignments = allAssignments.filter(({ ownerType }) => ownerType === "canonical-program");
  const classifiedAssignments = allAssignments.filter(({ ownerType }) => ownerType === "classification");
  assert(canonicalAssignments.length === coverage.summary.canonicalProgramAssignments, "EARTH canonical assignment summary drifted");
  assert(classifiedAssignments.length === coverage.summary.classifiedAssignments, "EARTH classified assignment summary drifted");

  const programShards = registry.items.map((program) => {
    const assignments = canonicalAssignments
      .filter(({ owner }) => owner === program.id)
      .sort(assignmentOrder)
      .map(compactAssignment);
    const linkedDatasetIds = uniqueSorted(datasets.datasets
      .filter(({ simulationIds }) => simulationIds.includes(program.id))
      .map(({ datasetId }) => datasetId));
    const disputedClaimIds = uniqueSorted(datasets.disputedClaims
      .filter(({ simulationIds }) => simulationIds.includes(program.id))
      .map(({ claimId }) => claimId));
    const linkedDocumentIds = uniqueSorted([
      ...program.sourceDocumentIds,
      ...assignments.map(({ documentId }) => documentId),
    ]);
    const artifact = {
      schemaVersion:     1,
      sourceRevision:    manifest.sourceRevision,
      sourcePlanSha256:  registry.sourcePlan.sha256,
      programId:         program.id,
      counts:            countsFor(assignments),
      linkedDocumentIds,
      linkedDatasetIds,
      disputedClaimIds,
      assignments,
    };
    return { id: program.id, artifact };
  });

  const documentShards = manifest.documents.map((document) => {
    const documentCanonical = canonicalAssignments.filter(({ documentId }) => documentId === document.id);
    const documentClassified = classifiedAssignments.filter(({ documentId }) => documentId === document.id);
    const linkedProgramIds = uniqueSorted([
      ...registry.items.filter(({ sourceDocumentIds }) => sourceDocumentIds.includes(document.id)).map(({ id }) => id),
      ...documentCanonical.map(({ owner }) => owner),
    ]);
    const canonicalPrograms = linkedProgramIds.map((programId) => {
      const assignments = documentCanonical.filter(({ owner }) => owner === programId);
      return { programId, counts: countsFor(assignments) };
    });
    const classifiedRecords = documentClassified.sort(assignmentOrder).map(compactClassification);
    const artifact = {
      schemaVersion:    1,
      sourceRevision:   manifest.sourceRevision,
      sourcePlanSha256: registry.sourcePlan.sha256,
      document: {
        id:    document.id,
        slug:  document.slug,
        title: document.title,
      },
      summary: {
        coverageAssignments:          documentCanonical.length + classifiedRecords.length,
        canonicalProgramAssignments:  documentCanonical.length,
        classifiedAssignments:        classifiedRecords.length,
        relatedCanonicalPrograms:     canonicalPrograms.length,
        classificationCounts:         countBy(classifiedRecords, CLASSIFICATIONS, ({ classification }) => classification),
      },
      canonicalPrograms,
      classifiedRecords,
    };
    return { id: document.id, slug: document.slug, artifact };
  });

  const programIndex = programShards.map(({ id, artifact }) => ({
    id,
    dataUrl:             `/data/generated/earth/evidence/programs/${id}.json`,
    counts:              artifact.counts,
    linkedDocuments:     artifact.linkedDocumentIds.length,
    linkedDatasets:      artifact.linkedDatasetIds.length,
    disputedClaims:      artifact.disputedClaimIds.length,
  }));
  const documentIndex = documentShards.map(({ id, slug, artifact }) => {
    const document = documents.get(id);
    return {
      id,
      slug,
      dataUrl:                  `/data/generated/earth/evidence/documents/${slug}.json`,
      relatedCanonicalPrograms: artifact.summary.relatedCanonicalPrograms,
      coverageAssignments:      artifact.summary.coverageAssignments,
      simulationCandidates:     document.counts.simulations,
      diagnostics:              document.counts.diagnostics,
    };
  });
  const evidenceManifest = {
    schemaVersion:    1,
    sourceRevision:   manifest.sourceRevision,
    sourceLockSha256: manifest.sourceLockSha256,
    sourcePlan:       registry.sourcePlan,
    datasetRegistry: {
      sha256: datasets.sourceRegistry.sha256,
    },
    summary: {
      programs:                    programShards.length,
      documents:                   documentShards.length,
      assignments:                 allAssignments.length,
      canonicalProgramAssignments: canonicalAssignments.length,
      classifiedAssignments:       classifiedAssignments.length,
      datasets:                    datasets.datasets.length,
      disputedClaims:              datasets.disputedClaims.length,
      classifications:             countBy(classifiedAssignments, CLASSIFICATIONS, ({ owner }) => owner),
    },
    programs:  programIndex,
    documents: documentIndex,
  };

  const emittedCanonicalIds = programShards.flatMap(({ artifact }) => artifact.assignments.map(({ sourceId }) => sourceId));
  const emittedClassifiedIds = documentShards.flatMap(({ artifact }) => artifact.classifiedRecords.map(({ sourceId }) => sourceId));
  assert(new Set([...emittedCanonicalIds, ...emittedClassifiedIds]).size === 2422, "EARTH evidence shards do not cover every assignment exactly once");
  assert(emittedCanonicalIds.length === canonicalAssignments.length, "EARTH program shard assignment count drifted");
  assert(emittedClassifiedIds.length === classifiedAssignments.length, "EARTH document classification count drifted");

  return { manifest: evidenceManifest, programShards, documentShards };
}
