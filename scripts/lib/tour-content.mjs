import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const EXPECTED_CHAPTERS = 20;
const EXPECTED_LESSONS = 9;
const EXPECTED_SIMULATIONS = 9;
const EXPECTED_STATIONS = 8;
const EXPECTED_GLOSSARY = 27;
const EXPECTED_REFERENCES = 10;
const EXPECTED_CONTENT_REVISION = "2026-07-27";
const CLAIM_CLASSES = [
  "established-definition",
  "established-model",
  "observed-value",
  "source-claim",
  "identity",
  "assumption",
  "calibration",
  "exploratory-hypothesis",
  "prediction",
];
const METHOD_RELATIONSHIPS = ["not-applicable", "literal-reproduction", "traditional-baseline", "contract-validator"];
const MODEL_ORIGINS = ["established-physics", "source-reproduction", "traditional-baseline"];
const RESULT_STATUSES = ["not-evaluated", "computed", "compared", "failure", "blocked-source-model", "unresolved"];
const CONCLUSION_SCOPES = ["activity", "computation", "source", "empirical-evidence", "scientific-conclusion"];
const CONCLUSION_FIELDS = ["seenInActivity", "computedHere", "reproducedFromSource", "comparedWithEvidence", "establishes", "doesNotEstablish"];
const CONCLUSION_SCOPE_MAPPING = {
  seenInActivity: "activity",
  computedHere: "computation",
  reproducedFromSource: "source",
  comparedWithEvidence: "empirical-evidence",
  establishes: "scientific-conclusion",
  doesNotEstablish: "scientific-conclusion",
};
const ATTRIBUTION_KEYS = ["claimClass", "evidenceRefs", "sourceRevision", "sourceLocator", "methodRelationship", "modelOrigin", "resultStatus", "validatesTheory", "caveats"];
const VALIDATION_PROTOCOL_KEYS = ["id", "hypothesis", "calibratedInputIds", "heldOutObservableIds", "datasetRefs", "comparisonMethod", "uncertaintyTreatment", "acceptanceCriteria", "failureHandling"];
const ATTRIBUTED_ROOTS = ["manifest", "chapter", "lesson", "observation-stage", "lesson-block", "equation-step", "checkpoint", "simulation", "finding", "glossary-entry", "claim-vocabulary-entry"];
const INHERITING_RECORD_KINDS = ["quick-station", "lesson-quick-path", "observation-stage-item", "lesson-block-body", "checkpoint-choice", "simulation-equation", "simulation-assumption", "control", "control-option", "preset", "output-field", "visualization", "visualization-alternative", "finding-field", "finding-assumption"];
const DIMENSION_AXES = ["time", "length", "mass", "electric-current", "thermodynamic-temperature", "amount-of-substance", "luminous-intensity"];
const INPUT_ROLES = new Set(["parameter", "preset-selection", "coordinate-selection", "display-option", "target-quantity", "canonical-quantity-value", "fixed-constant", "calibrated-input", "nuisance-parameter", "held-out-observable"]);
const DATASET_STATES = new Set(["not-applicable", "not-loaded", "loaded", "precomputed-artifact", "unavailable"]);
const DATASET_PURPOSES = new Set(["calibration", "comparison", "held-out-evaluation", "visualization"]);
const NUMERICAL_METHOD_KINDS = new Set(["exact-symbolic", "direct-evaluation", "iterative", "optimization", "sampling", "integration", "interpolation", "other"]);
const CHAPTER_STATUSES = new Set(["content-ready", "planned"]);
const CLAIM_CLASS_SET = new Set(CLAIM_CLASSES);
const METHOD_RELATIONSHIP_SET = new Set(METHOD_RELATIONSHIPS);
const MODEL_ORIGIN_SET = new Set(MODEL_ORIGINS);
const RESULT_STATUS_SET = new Set(RESULT_STATUSES);
const CONTROL_TYPES = new Set(["range", "number", "select", "toggle"]);
const READING_DEPTHS = new Set(["guided", "technical"]);
const LESSON_BLOCK_KINDS = new Set(["prose", "definition", "list", "caveat", "derivation"]);
const CHECKPOINT_KINDS = new Set(["prediction", "classification", "explanation"]);
const OBSERVATION_ITEM_ROLES = new Set([
  "fixed-definition",
  "measured-reference",
  "derived-model-value",
  "conventional-value",
  "model-input",
  "illustrative-scale",
  "practical-realization",
]);
const REFERENCE_CLASSIFICATIONS = new Set(["primary-standard", "reference-data", "textbook", "source-corpus", "internal-policy"]);
const ACCESS_STATUSES = new Set(["verified-accessible", "partially-accessible", "blocked", "not-checked"]);
const OUTPUT_TYPES = new Set(["operation-status", "rational-dimension-vector", "boolean", "string", "number"]);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const UNSAFE_PROTOCOL = /(?:\b(?:java|vb)script\s*:|\bdata\s*:\s*text\/html|\bon[a-z]{2,}\s*=)/i;
const HTML_LIKE_TAG = /(?:<!--|-->|<\s*\/?\s*[A-Za-z][^>]*>)/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertObject(value, path) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${path} must be an object`);
}

function assertExactKeys(value, expectedKeys, path) {
  assertObject(value, path);
  const actual = Object.keys(value);
  const expected = new Set(expectedKeys);
  const unknown = actual.filter((key) => !expected.has(key));
  const missing = expectedKeys.filter((key) => !Object.hasOwn(value, key));
  assert(unknown.length === 0, `${path} has unknown properties: ${unknown.join(", ")}`);
  assert(missing.length === 0, `${path} is missing properties: ${missing.join(", ")}`);
}

function keysWithOptionals(value, required, optional) {
  return [...required, ...optional.filter((key) => Object.hasOwn(value, key))];
}

function assertSchema(value, path, keys) {
  assertExactKeys(value, keys, path);
  assert(value.schemaVersion === 1, `${path}.schemaVersion must be 1`);
}

function assertString(value, path) {
  assert(typeof value === "string" && value.trim().length > 0, `${path} must be a non-empty string`);
}

function assertId(value, path) {
  assertString(value, path);
  assert(SAFE_ID.test(value), `${path} must be a safe ID`);
}

function assertStringArray(value, path, { nonEmpty = false } = {}) {
  assert(Array.isArray(value), `${path} must be an array`);
  if (nonEmpty) assert(value.length > 0, `${path} must not be empty`);
  value.forEach((item, index) => assertString(item, `${path}[${index}]`));
}

function assertUnique(values, path) {
  assert(new Set(values).size === values.length, `${path} must contain unique values`);
}

function assertExactValues(actual, expected, path) {
  assert(Array.isArray(actual), `${path} must be an array`);
  assert(actual.length === expected.length && actual.every((value, index) => value === expected[index]), `${path} must equal [${expected.join(", ")}]`);
}

function assertIsoDate(value, path) {
  assertString(value, path);
  const parsed = new Date(`${value}T00:00:00Z`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value, `${path} must be an ISO calendar date`);
}

function assertPositiveInteger(value, path) {
  assert(Number.isInteger(value) && value > 0, `${path} must be a positive integer`);
}

function assertFiniteNumber(value, path) {
  assert(typeof value === "number" && Number.isFinite(value), `${path} must be a finite number`);
}

function assertInertStrings(value, path = "tour source") {
  if (typeof value === "string") {
    const compact = value.replace(/[\u0000-\u0020]+/g, "");
    assert(!HTML_LIKE_TAG.test(value) && !UNSAFE_PROTOCOL.test(compact), `${path} contains HTML-like or executable text`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertInertStrings(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      assertInertStrings(key, `${path} key`);
      assertInertStrings(item, `${path}.${key}`);
    });
  }
}

async function readJson(path) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`Unable to read tour source ${path}: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in tour source ${path}: ${error.message}`);
  }
}

async function readJsonDirectory(directory, label) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  assert(entries.every((entry) => entry.isFile()), `${label} source directory may contain only files`);
  const files = entries.map((entry) => entry.name).sort((left, right) => left.localeCompare(right, "en"));
  assert(files.every((filename) => filename.endsWith(".json")), `${label} source directory may contain only JSON files`);
  return Promise.all(files.map(async (filename) => {
    const record = await readJson(join(directory, filename));
    assertObject(record, `${label} ${filename}`);
    assert(record.id === filename.slice(0, -5), `${label} ${filename} must contain matching id ${filename.slice(0, -5)}`);
    return record;
  }));
}

export async function readTourSource(sourceDirectory) {
  assertString(sourceDirectory, "Tour source directory");
  const [manifest, claimVocabulary, glossary, references, chapters, lessons, simulations] = await Promise.all([
    readJson(join(sourceDirectory, "manifest.json")),
    readJson(join(sourceDirectory, "claim-vocabulary.json")),
    readJson(join(sourceDirectory, "glossary.json")),
    readJson(join(sourceDirectory, "references.json")),
    readJsonDirectory(join(sourceDirectory, "chapters"), "Chapter"),
    readJsonDirectory(join(sourceDirectory, "lessons"), "Lesson"),
    readJsonDirectory(join(sourceDirectory, "simulations"), "Simulation"),
  ]);
  return { manifest, claimVocabulary, glossary, references, chapters, lessons, simulations };
}

function assertEvidenceRefs(evidenceRefs, referencesById, path, { nonEmpty = false } = {}) {
  assertStringArray(evidenceRefs, path, { nonEmpty });
  assertUnique(evidenceRefs, path);
  for (const referenceId of evidenceRefs) {
    assert(referencesById.has(referenceId), `${path} contains unknown evidence reference ${referenceId}`);
  }
}

function validateAttribution(attribution, path, referencesById) {
  assertExactKeys(attribution, ATTRIBUTION_KEYS, path);
  assert(CLAIM_CLASS_SET.has(attribution.claimClass), `${path}.claimClass is not recognized`);
  assertEvidenceRefs(attribution.evidenceRefs, referencesById, `${path}.evidenceRefs`, { nonEmpty: true });
  assertString(attribution.sourceRevision, `${path}.sourceRevision`);
  assertString(attribution.sourceLocator, `${path}.sourceLocator`);
  assert(METHOD_RELATIONSHIP_SET.has(attribution.methodRelationship), `${path}.methodRelationship is not recognized`);
  assert(MODEL_ORIGIN_SET.has(attribution.modelOrigin), `${path}.modelOrigin is not recognized`);
  assert(RESULT_STATUS_SET.has(attribution.resultStatus), `${path}.resultStatus is not recognized`);
  assert(typeof attribution.validatesTheory === "boolean", `${path}.validatesTheory must be boolean`);
  assertStringArray(attribution.caveats, `${path}.caveats`);

  if (attribution.methodRelationship === "literal-reproduction") {
    assert(attribution.modelOrigin === "source-reproduction", `${path} literal-reproduction requires source-reproduction modelOrigin`);
  }
  if (attribution.methodRelationship === "traditional-baseline") {
    assert(attribution.modelOrigin === "traditional-baseline", `${path} traditional-baseline method requires traditional-baseline modelOrigin`);
  }
  if (attribution.resultStatus === "blocked-source-model") {
    assert(attribution.modelOrigin === "source-reproduction", `${path} blocked-source-model requires source-reproduction modelOrigin`);
  }
  if (attribution.claimClass === "observed-value") {
    assert(attribution.evidenceRefs.length > 0, `${path} observed-value requires evidence references`);
    assert(attribution.evidenceRefs.some((id) => referencesById.get(id).classification === "reference-data"), `${path} observed-value requires empirical reference-data context`);
  }
  assert(attribution.resultStatus === "not-evaluated", `${path}.resultStatus must be not-evaluated for static schema-v1 source`);
  assert(attribution.validatesTheory === false, `${path}.validatesTheory must be false for static schema-v1 source`);
}

function validateOptionalAttribution(record, path, referencesById) {
  if (record.attribution !== undefined) validateAttribution(record.attribution, `${path}.attribution`, referencesById);
}

function validateReferences(references) {
  assertSchema(references, "references", ["schemaVersion", "policy", "policyAttribution", "entries"]);
  assertString(references.policy, "references.policy");
  assert(Array.isArray(references.entries), "references.entries must be an array");
  assert(references.entries.length === EXPECTED_REFERENCES, `Expected ${EXPECTED_REFERENCES} references, found ${references.entries.length}`);
  assertUnique(references.entries.map(({ id }) => id), "Reference IDs");
  const referencesById = new Map(references.entries.map((reference) => [reference.id, reference]));
  for (const [index, reference] of references.entries.entries()) {
    const path = `references.entries[${index}]`;
    const keys = keysWithOptionals(reference, ["id", "title", "sourceFamily", "url", "classification", "responsibleOrganization", "publicationYear", "edition", "revision", "sourceLocator", "accessedAt", "accessStatus", "scopeNote", "supersededForCurrentSIDefinitions", "licenseNote"], ["doi"]);
    assertExactKeys(reference, keys, path);
    assertId(reference.id, `${path}.id`);
    assertString(reference.title, `${path}.title`);
    assertString(reference.sourceFamily, `${path}.sourceFamily`);
    assertString(reference.url, `${path}.url`);
    let url;
    try {
      url = new URL(reference.url);
    } catch {
      throw new Error(`${path}.url must be a valid URL`);
    }
    assert(url.protocol === "https:", `${path}.url must use HTTPS`);
    assert(REFERENCE_CLASSIFICATIONS.has(reference.classification), `${path}.classification is not recognized`);
    assertString(reference.responsibleOrganization, `${path}.responsibleOrganization`);
    assertPositiveInteger(reference.publicationYear, `${path}.publicationYear`);
    assert(reference.publicationYear <= 9999, `${path}.publicationYear must have four or fewer digits`);
    assertString(reference.edition, `${path}.edition`);
    assertString(reference.revision, `${path}.revision`);
    if (reference.doi !== undefined) {
      assertString(reference.doi, `${path}.doi`);
      assert(/^10\.\d{4,9}\/\S+$/.test(reference.doi), `${path}.doi must be a DOI without a URL prefix`);
    }
    assertString(reference.sourceLocator, `${path}.sourceLocator`);
    assertIsoDate(reference.accessedAt, `${path}.accessedAt`);
    assert(ACCESS_STATUSES.has(reference.accessStatus), `${path}.accessStatus is not recognized`);
    assertString(reference.scopeNote, `${path}.scopeNote`);
    assert(typeof reference.supersededForCurrentSIDefinitions === "boolean", `${path}.supersededForCurrentSIDefinitions must be boolean`);
    assertString(reference.licenseNote, `${path}.licenseNote`);
  }
  validateAttribution(references.policyAttribution, "references.policyAttribution", referencesById);
  return referencesById;
}

function validateVocabularyAxis(entries, expectedIds, path, referencesById) {
  assert(Array.isArray(entries), `${path} must be an array`);
  assertExactValues(entries.map(({ id }) => id), expectedIds, path);
  for (const [index, entry] of entries.entries()) {
    const entryPath = `${path}[${index}]`;
    assertExactKeys(entry, ["id", "definition", "usageWarning", "attribution"], entryPath);
    assertId(entry.id, `${entryPath}.id`);
    assertString(entry.definition, `${entryPath}.definition`);
    assertString(entry.usageWarning, `${entryPath}.usageWarning`);
    validateAttribution(entry.attribution, `${entryPath}.attribution`, referencesById);
  }
}

function validateVocabulary(vocabulary, referencesById) {
  assertSchema(vocabulary, "claim-vocabulary", ["schemaVersion", "claimClasses", "methodRelationships", "modelOrigins", "resultStatuses", "conclusionScopes", "validatesTheory", "conclusionBoundary"]);
  validateVocabularyAxis(vocabulary.claimClasses, CLAIM_CLASSES, "claim-vocabulary.claimClasses", referencesById);
  validateVocabularyAxis(vocabulary.methodRelationships, METHOD_RELATIONSHIPS, "claim-vocabulary.methodRelationships", referencesById);
  validateVocabularyAxis(vocabulary.modelOrigins, MODEL_ORIGINS, "claim-vocabulary.modelOrigins", referencesById);
  validateVocabularyAxis(vocabulary.resultStatuses, RESULT_STATUSES, "claim-vocabulary.resultStatuses", referencesById);
  validateVocabularyAxis(vocabulary.conclusionScopes, CONCLUSION_SCOPES, "claim-vocabulary.conclusionScopes", referencesById);
  assertExactKeys(vocabulary.validatesTheory, ["definition", "usageWarning", "trueRequires", "attribution"], "claim-vocabulary.validatesTheory");
  assertString(vocabulary.validatesTheory.definition, "claim-vocabulary.validatesTheory.definition");
  assertString(vocabulary.validatesTheory.usageWarning, "claim-vocabulary.validatesTheory.usageWarning");
  assertExactValues(vocabulary.validatesTheory.trueRequires, VALIDATION_PROTOCOL_KEYS, "claim-vocabulary.validatesTheory.trueRequires");
  validateAttribution(vocabulary.validatesTheory.attribution, "claim-vocabulary.validatesTheory.attribution", referencesById);
  const boundary = vocabulary.conclusionBoundary;
  assertExactKeys(boundary, ["required", "statementRequired", "attributionRequired", "scopeMapping", "rule", "attribution"], "claim-vocabulary.conclusionBoundary");
  assertExactValues(boundary.required, CONCLUSION_FIELDS, "claim-vocabulary.conclusionBoundary.required");
  assertExactValues(boundary.statementRequired, ["text", "scope", "attribution"], "claim-vocabulary.conclusionBoundary.statementRequired");
  assertExactValues(boundary.attributionRequired, ATTRIBUTION_KEYS, "claim-vocabulary.conclusionBoundary.attributionRequired");
  assertExactKeys(boundary.scopeMapping, CONCLUSION_FIELDS, "claim-vocabulary.conclusionBoundary.scopeMapping");
  for (const field of CONCLUSION_FIELDS) assert(boundary.scopeMapping[field] === CONCLUSION_SCOPE_MAPPING[field], `claim-vocabulary.conclusionBoundary.scopeMapping.${field} must be ${CONCLUSION_SCOPE_MAPPING[field]}`);
  assertString(boundary.rule, "claim-vocabulary.conclusionBoundary.rule");
  validateAttribution(boundary.attribution, "claim-vocabulary.conclusionBoundary.attribution", referencesById);
}

function validateGlossary(glossary, referencesById) {
  assertSchema(glossary, "glossary", ["schemaVersion", "entries"]);
  assert(Array.isArray(glossary.entries), "glossary.entries must be an array");
  assert(glossary.entries.length === EXPECTED_GLOSSARY, `Expected ${EXPECTED_GLOSSARY} glossary entries, found ${glossary.entries.length}`);
  assertUnique(glossary.entries.map(({ id }) => id), "Glossary IDs");
  for (const [index, entry] of glossary.entries.entries()) {
    const path = `glossary.entries[${index}]`;
    assertExactKeys(entry, ["id", "term", "guidedDefinition", "technicalDefinition", "guided", "evidenceRefs", "attribution"], path);
    assertId(entry.id, `${path}.id`);
    assertString(entry.term, `${path}.term`);
    assertString(entry.guidedDefinition, `${path}.guidedDefinition`);
    assertString(entry.technicalDefinition, `${path}.technicalDefinition`);
    assert(typeof entry.guided === "boolean", `${path}.guided must be boolean`);
    assertEvidenceRefs(entry.evidenceRefs, referencesById, `${path}.evidenceRefs`, { nonEmpty: true });
    validateAttribution(entry.attribution, `${path}.attribution`, referencesById);
  }
}

function validateManifest(manifest, referencesById, glossaryById) {
  assertSchema(manifest, "manifest", ["schemaVersion", "contentRevision", "title", "thesis", "attribution", "readingDepths", "depthComposition", "attributionPolicy", "contentStatusPolicy", "quickStations"]);
  assertIsoDate(manifest.contentRevision, "manifest.contentRevision");
  assert(manifest.contentRevision === EXPECTED_CONTENT_REVISION, `manifest.contentRevision must be ${EXPECTED_CONTENT_REVISION} for the current corpus`);
  assertString(manifest.title, "manifest.title");
  assertString(manifest.thesis, "manifest.thesis");
  validateAttribution(manifest.attribution, "manifest.attribution", referencesById);
  assertExactValues(manifest.readingDepths, ["guided", "technical"], "manifest.readingDepths");
  assert(manifest.depthComposition === "technical-includes-guided", "manifest.depthComposition must be technical-includes-guided");
  const inheritance = manifest.attributionPolicy;
  assertExactKeys(inheritance, ["inheritance", "rule", "attributedRoots", "inheritingRecordKinds", "attribution"], "manifest.attributionPolicy");
  assert(inheritance.inheritance === "nearest-attributed-ancestor", "manifest.attributionPolicy.inheritance must be nearest-attributed-ancestor");
  assertString(inheritance.rule, "manifest.attributionPolicy.rule");
  assertExactValues(inheritance.attributedRoots, ATTRIBUTED_ROOTS, "manifest.attributionPolicy.attributedRoots");
  assertExactValues(inheritance.inheritingRecordKinds, INHERITING_RECORD_KINDS, "manifest.attributionPolicy.inheritingRecordKinds");
  validateAttribution(inheritance.attribution, "manifest.attributionPolicy.attribution", referencesById);
  const statusPolicy = manifest.contentStatusPolicy;
  assertExactKeys(statusPolicy, ["contentReady", "planned", "attribution"], "manifest.contentStatusPolicy");
  assertString(statusPolicy.contentReady, "manifest.contentStatusPolicy.contentReady");
  assertString(statusPolicy.planned, "manifest.contentStatusPolicy.planned");
  validateAttribution(statusPolicy.attribution, "manifest.contentStatusPolicy.attribution", referencesById);
  assert(Array.isArray(manifest.quickStations), "manifest.quickStations must be an array");
  assert(manifest.quickStations.length === EXPECTED_STATIONS, `Expected ${EXPECTED_STATIONS} quick stations, found ${manifest.quickStations.length}`);
  assertUnique(manifest.quickStations.map(({ id }) => id), "Quick station IDs");
  for (const [index, station] of manifest.quickStations.entries()) {
    const path = `manifest.quickStations[${index}]`;
    assertExactKeys(station, keysWithOptionals(station, ["id", "order", "title", "question", "interaction", "chapterId", "lessonId", "simulationId", "estimatedMinutes", "status"], ["glossaryIds"]), path);
    assertId(station.id, `${path}.id`);
    assert(station.order === index + 1, `${path}.order must be ${index + 1}`);
    assertString(station.title, `${path}.title`);
    assertString(station.question, `${path}.question`);
    assertString(station.interaction, `${path}.interaction`);
    assertId(station.chapterId, `${path}.chapterId`);
    if (station.lessonId !== null) assertId(station.lessonId, `${path}.lessonId`);
    if (station.simulationId !== null) assertId(station.simulationId, `${path}.simulationId`);
    if (station.glossaryIds !== undefined) {
      assertStringArray(station.glossaryIds, `${path}.glossaryIds`, { nonEmpty: true });
      assertUnique(station.glossaryIds, `${path}.glossaryIds`);
      for (const id of station.glossaryIds) {
        const entry = glossaryById.get(id);
        assert(entry, `${path}.glossaryIds contains unknown glossary reference ${id}`);
        if (station.status === "content-ready") assert(entry.guided, `${path}.glossaryIds references ${id}, which is not available at guided depth`);
      }
    }
    assertPositiveInteger(station.estimatedMinutes, `${path}.estimatedMinutes`);
    assert(CHAPTER_STATUSES.has(station.status), `${path}.status is not recognized`);
    if (station.status === "content-ready") {
      assert(station.glossaryIds !== undefined, `${path}.glossaryIds is required for a content-ready station`);
      validateGuidedTerms([station.title, station.question, station.interaction], new Set(station.glossaryIds), [...glossaryById.values()], path);
    }
  }
  const minutes = manifest.quickStations.reduce((total, station) => total + station.estimatedMinutes, 0);
  assert(minutes >= 20 && minutes <= 30, `Quick station estimatedMinutes total must be within [20, 30], found ${minutes}`);
}

function validateChapters(chapters, referencesById) {
  assert(chapters.length === EXPECTED_CHAPTERS, `Expected ${EXPECTED_CHAPTERS} chapters, found ${chapters.length}`);
  assertUnique(chapters.map(({ id }) => id), "Chapter IDs");
  const ordered = [...chapters].sort((left, right) => left.order - right.order);
  for (const [index, chapter] of ordered.entries()) {
    const path = `chapters.${chapter.id ?? index}`;
    assertSchema(chapter, path, ["schemaVersion", "id", "order", "act", "title", "question", "summary", "status", "quickStationIds", "lessonIds", "attribution"]);
    assertId(chapter.id, `${path}.id`);
    assert(chapter.order === index, `${path}.order must be ${index}`);
    assert(Number.isInteger(chapter.act) && chapter.act >= 1 && chapter.act <= 4, `${path}.act must be an integer from 1 through 4`);
    assertString(chapter.title, `${path}.title`);
    assertString(chapter.question, `${path}.question`);
    assertString(chapter.summary, `${path}.summary`);
    assert(CHAPTER_STATUSES.has(chapter.status), `${path}.status is not recognized`);
    assertStringArray(chapter.quickStationIds, `${path}.quickStationIds`);
    assertStringArray(chapter.lessonIds, `${path}.lessonIds`);
    assertUnique(chapter.quickStationIds, `${path}.quickStationIds`);
    assertUnique(chapter.lessonIds, `${path}.lessonIds`);
    validateAttribution(chapter.attribution, `${path}.attribution`, referencesById);
  }
  return ordered;
}

function validateBlock(block, path, glossaryById, lessonGlossaryIds, referencesById, guided) {
  assertExactKeys(block, ["id", "kind", "title", "body", "glossaryIds", ...ATTRIBUTION_KEYS], path);
  assertId(block.id, `${path}.id`);
  assert(LESSON_BLOCK_KINDS.has(block.kind), `${path}.kind is not recognized`);
  assertString(block.title, `${path}.title`);
  assertStringArray(block.body, `${path}.body`, { nonEmpty: true });
  assertStringArray(block.glossaryIds, `${path}.glossaryIds`);
  assertUnique(block.glossaryIds, `${path}.glossaryIds`);
  validateAttribution(Object.fromEntries(ATTRIBUTION_KEYS.map((key) => [key, block[key]])), path, referencesById);
  for (const glossaryId of block.glossaryIds) {
    const entry = glossaryById.get(glossaryId);
    assert(entry, `${path}.glossaryIds contains unknown glossary reference ${glossaryId}`);
    assert(lessonGlossaryIds.has(glossaryId), `${path}.glossaryIds contains ${glossaryId}, which is absent from the lesson glossaryIds`);
    if (guided) assert(entry.guided, `${path}.glossaryIds references ${glossaryId}, which is not available at guided depth`);
  }
}

function validateObservationStage(stage, path, referencesById) {
  assertExactKeys(stage, ["title", "question", "items", "conclusion", "attribution"], path);
  assertString(stage.title, `${path}.title`);
  assertString(stage.question, `${path}.question`);
  assert(Array.isArray(stage.items) && stage.items.length > 0, `${path}.items must be a non-empty array`);
  assertUnique(stage.items.map(({ id }) => id), `${path} item IDs`);
  assertString(stage.conclusion, `${path}.conclusion`);
  validateAttribution(stage.attribution, `${path}.attribution`, referencesById);

  for (const [index, item] of stage.items.entries()) {
    const itemPath = `${path}.items[${index}]`;
    assertExactKeys(item, keysWithOptionals(item, ["id", "label", "value", "unit", "role", "explanation", "evidenceRefs"], ["attribution"]), itemPath);
    assertId(item.id, `${itemPath}.id`);
    assertString(item.label, `${itemPath}.label`);
    assertFiniteNumber(item.value, `${itemPath}.value`);
    assertString(item.unit, `${itemPath}.unit`);
    assert(OBSERVATION_ITEM_ROLES.has(item.role), `${itemPath}.role is not recognized`);
    assertString(item.explanation, `${itemPath}.explanation`);
    assertEvidenceRefs(item.evidenceRefs, referencesById, `${itemPath}.evidenceRefs`, { nonEmpty: true });
    validateOptionalAttribution(item, itemPath, referencesById);
  }
}

function validateConclusionStatement(statement, field, path, referencesById) {
  assertExactKeys(statement, ["text", "scope", "attribution"], path);
  assertString(statement.text, `${path}.text`);
  assert(statement.scope === CONCLUSION_SCOPE_MAPPING[field], `${path}.scope must be ${CONCLUSION_SCOPE_MAPPING[field]} for ${field}`);
  validateAttribution(statement.attribution, `${path}.attribution`, referencesById);
}

function technicalTermPattern(term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}(?=$|[^A-Za-z0-9])`, "i");
}

function validateGuidedTerms(texts, declaredGlossaryIds, glossaryEntries, path) {
  for (const entry of glossaryEntries) {
    const pattern = technicalTermPattern(entry.term);
    if (!texts.some((text) => pattern.test(text))) continue;
    assert(entry.guided, `${path} Guided text contains technical-only glossary term ${entry.term}`);
    assert(declaredGlossaryIds.has(entry.id), `${path} Guided text uses undeclared glossary term ${entry.term}`);
  }
}

function validateLessonGuidedTerminology(lesson, glossaryEntries, path) {
  const lessonGlossaryIds = new Set(lesson.glossaryIds);
  validateGuidedTerms([lesson.title, lesson.question, lesson.answerPreview, lesson.summary], lessonGlossaryIds, glossaryEntries, path);
  validateGuidedTerms([
    lesson.observationStage.title,
    lesson.observationStage.question,
    lesson.observationStage.conclusion,
    ...lesson.observationStage.items.flatMap(({ label, unit, explanation }) => [label, unit, explanation]),
  ], lessonGlossaryIds, glossaryEntries, `${path}.observationStage`);
  for (const block of lesson.guidedBlocks) {
    validateGuidedTerms([block.title, ...block.body], lessonGlossaryIds, glossaryEntries, `${path}.guidedBlocks.${block.id}`);
  }
  for (const checkpoint of lesson.checkpoints) {
    validateGuidedTerms([checkpoint.prompt, checkpoint.explanation, ...checkpoint.choices.map(({ label }) => label)], lessonGlossaryIds, glossaryEntries, `${path}.checkpoints.${checkpoint.id}`);
  }
  if (lesson.quickPath !== undefined) {
    const selectedIds = new Set(lesson.quickPath.equationStepIds);
    const selected = lesson.equationSteps.filter(({ id }) => selectedIds.has(id));
    validateGuidedTerms(selected.flatMap((step) => [step.label, step.expression, step.explanation]), lessonGlossaryIds, glossaryEntries, `${path}.quickPath.equationStepIds`);
  }
}

function validateQuickPathShape(quickPath, lesson, path) {
  assertExactKeys(quickPath, ["estimatedMinutes", "guidedBlockIds", "equationStepIds", "checkpointIds", "simulationPresetId"], path);
  assertPositiveInteger(quickPath.estimatedMinutes, `${path}.estimatedMinutes`);
  assert(quickPath.estimatedMinutes <= lesson.estimatedMinutes, `${path}.estimatedMinutes must not exceed lesson estimatedMinutes ${lesson.estimatedMinutes}`);
  for (const field of ["guidedBlockIds", "equationStepIds", "checkpointIds"]) {
    assertStringArray(quickPath[field], `${path}.${field}`, { nonEmpty: true });
    assertUnique(quickPath[field], `${path}.${field}`);
  }
  assertId(quickPath.simulationPresetId, `${path}.simulationPresetId`);
  const guidedIds = new Set(lesson.guidedBlocks.map(({ id }) => id));
  const technicalIds = new Set(lesson.technicalBlocks.map(({ id }) => id));
  const equationIds = new Set(lesson.equationSteps.map(({ id }) => id));
  const checkpointIds = new Set(lesson.checkpoints.map(({ id }) => id));
  for (const id of quickPath.guidedBlockIds) {
    assert(guidedIds.has(id), `${path}.guidedBlockIds contains unknown or non-Guided block ${id}`);
    assert(!technicalIds.has(id), `${path}.guidedBlockIds contains Technical block ${id}`);
  }
  for (const id of quickPath.equationStepIds) assert(equationIds.has(id), `${path}.equationStepIds contains unknown equation step ${id}`);
  for (const id of quickPath.checkpointIds) assert(checkpointIds.has(id), `${path}.checkpointIds contains unknown checkpoint ${id}`);
}

function validateLessons(lessons, chapterById, glossaryById, referencesById, recipeIds, programIds) {
  assert(lessons.length === EXPECTED_LESSONS, `Expected ${EXPECTED_LESSONS} lessons, found ${lessons.length}`);
  assertUnique(lessons.map(({ id }) => id), "Lesson IDs");
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  for (const [index, lesson] of lessons.entries()) {
    const path = `lessons.${lesson.id ?? index}`;
    const required = ["schemaVersion", "id", "chapterId", "order", "title", "question", "answerPreview", "summary", "attribution", "estimatedMinutes", "depthComposition", "prerequisites", "observationStage", "guidedBlocks", "technicalBlocks", "equationSteps", "simulationId", "formulaIds", "programIds", "glossaryIds", "evidenceRefs", "checkpoints", ...CONCLUSION_FIELDS];
    assertSchema(lesson, path, keysWithOptionals(lesson, required, ["quickPath"]));
    assertId(lesson.id, `${path}.id`);
    assertId(lesson.chapterId, `${path}.chapterId`);
    assert(chapterById.has(lesson.chapterId), `${path}.chapterId references unknown chapter ${lesson.chapterId}`);
    assertPositiveInteger(lesson.order, `${path}.order`);
    assertString(lesson.title, `${path}.title`);
    assertString(lesson.question, `${path}.question`);
    assertString(lesson.answerPreview, `${path}.answerPreview`);
    assertString(lesson.summary, `${path}.summary`);
    validateAttribution(lesson.attribution, `${path}.attribution`, referencesById);
    assertPositiveInteger(lesson.estimatedMinutes, `${path}.estimatedMinutes`);
    assert(lesson.depthComposition === "technical-includes-guided", `${path}.depthComposition must be technical-includes-guided`);
    assertStringArray(lesson.prerequisites, `${path}.prerequisites`);
    assertUnique(lesson.prerequisites, `${path}.prerequisites`);
    validateObservationStage(lesson.observationStage, `${path}.observationStage`, referencesById);
    assert(Array.isArray(lesson.guidedBlocks) && lesson.guidedBlocks.length > 0, `${path}.guidedBlocks must be a non-empty array`);
    assert(Array.isArray(lesson.technicalBlocks) && lesson.technicalBlocks.length > 0, `${path}.technicalBlocks must be a non-empty array`);
    assert(Array.isArray(lesson.equationSteps) && lesson.equationSteps.length > 0, `${path}.equationSteps must be a non-empty array`);
    if (lesson.simulationId !== null) assertId(lesson.simulationId, `${path}.simulationId`);
    assertStringArray(lesson.formulaIds, `${path}.formulaIds`);
    assertStringArray(lesson.programIds, `${path}.programIds`);
    assertStringArray(lesson.glossaryIds, `${path}.glossaryIds`, { nonEmpty: true });
    assertUnique(lesson.formulaIds, `${path}.formulaIds`);
    assertUnique(lesson.programIds, `${path}.programIds`);
    assertUnique(lesson.glossaryIds, `${path}.glossaryIds`);
    assertEvidenceRefs(lesson.evidenceRefs, referencesById, `${path}.evidenceRefs`, { nonEmpty: true });
    const lessonGlossaryIds = new Set(lesson.glossaryIds);
    for (const id of lesson.glossaryIds) assert(glossaryById.has(id), `${path}.glossaryIds contains unknown glossary reference ${id}`);
    for (const id of lesson.formulaIds) assert(recipeIds.has(id), `${path}.formulaIds contains unknown recipe/formula ${id}`);
    for (const id of lesson.programIds) assert(programIds.has(id), `${path}.programIds contains unknown EARTH program ${id}`);
    const blockIds = [...lesson.guidedBlocks, ...lesson.technicalBlocks].map(({ id }) => id);
    assertUnique(blockIds, `${path} block IDs`);
    lesson.guidedBlocks.forEach((block, blockIndex) => validateBlock(block, `${path}.guidedBlocks[${blockIndex}]`, glossaryById, lessonGlossaryIds, referencesById, true));
    lesson.technicalBlocks.forEach((block, blockIndex) => validateBlock(block, `${path}.technicalBlocks[${blockIndex}]`, glossaryById, lessonGlossaryIds, referencesById, false));
    assertUnique(lesson.equationSteps.map(({ id }) => id), `${path} equation step IDs`);
    for (const [stepIndex, step] of lesson.equationSteps.entries()) {
      const stepPath = `${path}.equationSteps[${stepIndex}]`;
      assertExactKeys(step, ["id", "label", "expression", "explanation", ...ATTRIBUTION_KEYS], stepPath);
      assertId(step.id, `${stepPath}.id`);
      assertString(step.label, `${stepPath}.label`);
      assertString(step.expression, `${stepPath}.expression`);
      assertString(step.explanation, `${stepPath}.explanation`);
      validateAttribution(Object.fromEntries(ATTRIBUTION_KEYS.map((key) => [key, step[key]])), stepPath, referencesById);
    }
    assert(Array.isArray(lesson.checkpoints) && lesson.checkpoints.length > 0, `${path}.checkpoints must be a non-empty array`);
    assertUnique(lesson.checkpoints.map(({ id }) => id), `${path} checkpoint IDs`);
    for (const [checkpointIndex, checkpoint] of lesson.checkpoints.entries()) {
      const checkpointPath = `${path}.checkpoints[${checkpointIndex}]`;
      assertExactKeys(checkpoint, ["id", "kind", "prompt", "choices", "answerId", "explanation", "attribution"], checkpointPath);
      assertId(checkpoint.id, `${checkpointPath}.id`);
      assert(CHECKPOINT_KINDS.has(checkpoint.kind), `${checkpointPath}.kind is not recognized`);
      assertString(checkpoint.prompt, `${checkpointPath}.prompt`);
      assert(Array.isArray(checkpoint.choices) && checkpoint.choices.length >= 2, `${checkpointPath}.choices must contain at least two choices`);
      assertUnique(checkpoint.choices.map(({ id }) => id), `${checkpointPath} choice IDs`);
      for (const [choiceIndex, choice] of checkpoint.choices.entries()) {
        const choicePath = `${checkpointPath}.choices[${choiceIndex}]`;
        assertExactKeys(choice, ["id", "label"], choicePath);
        assertId(choice.id, `${choicePath}.id`);
        assertString(choice.label, `${choicePath}.label`);
      }
      assertString(checkpoint.answerId, `${checkpointPath}.answerId`);
      assert(checkpoint.choices.some(({ id }) => id === checkpoint.answerId), `${checkpointPath}.answerId does not resolve to a choice`);
      assertString(checkpoint.explanation, `${checkpointPath}.explanation`);
      validateAttribution(checkpoint.attribution, `${checkpointPath}.attribution`, referencesById);
    }
    for (const field of CONCLUSION_FIELDS) {
      assert(Array.isArray(lesson[field]) && lesson[field].length > 0, `${path}.${field} must be a non-empty array`);
      lesson[field].forEach((statement, statementIndex) => validateConclusionStatement(statement, field, `${path}.${field}[${statementIndex}]`, referencesById));
    }
    if (lesson.quickPath !== undefined) validateQuickPathShape(lesson.quickPath, lesson, `${path}.quickPath`);
    validateLessonGuidedTerminology(lesson, [...glossaryById.values()], path);
  }
  for (const lesson of lessons) {
    for (const prerequisiteId of lesson.prerequisites) {
      assert(lessonById.has(prerequisiteId), `lessons.${lesson.id}.prerequisites contains unknown lesson ${prerequisiteId}`);
      assert(prerequisiteId !== lesson.id, `lessons.${lesson.id}.prerequisites may not reference itself`);
    }
  }
}

function validateControlValue(control, value, path) {
  if (control.type === "range" || control.type === "number") {
    assertFiniteNumber(value, path);
    assert(value >= control.min && value <= control.max, `${path} must be within [${control.min}, ${control.max}]`);
    const steps = (value - control.min) / control.step;
    assert(Math.abs(steps - Math.round(steps)) <= 1e-9 * Math.max(1, Math.abs(steps)), `${path} must align with step ${control.step}`);
  } else if (control.type === "select") {
    assert(typeof value === "string" && control.options.some((option) => option.value === value), `${path} must match a select option`);
  } else {
    assert(typeof value === "boolean", `${path} must be boolean`);
  }
}

function validateControl(control, path, referencesById) {
  const base = ["id", "label", "type", "inputRole", "readingDepth", "description", "default"];
  const optional = ["playfulPrompt", "attribution"];
  const variant = control.type === "select" ? ["options"] : (control.type === "range" || control.type === "number" ? ["unit", "min", "max", "step"] : []);
  assertExactKeys(control, keysWithOptionals(control, [...base, ...variant], optional), path);
  assertId(control.id, `${path}.id`);
  assertString(control.label, `${path}.label`);
  assert(CONTROL_TYPES.has(control.type), `${path}.type is not recognized`);
  assert(INPUT_ROLES.has(control.inputRole), `${path}.inputRole is not recognized`);
  assert(READING_DEPTHS.has(control.readingDepth), `${path}.readingDepth is not recognized`);
  assertString(control.description, `${path}.description`);
  if (control.playfulPrompt !== undefined) assertString(control.playfulPrompt, `${path}.playfulPrompt`);
  validateOptionalAttribution(control, path, referencesById);
  if (control.type === "range" || control.type === "number") {
    assertString(control.unit, `${path}.unit`);
    for (const field of ["min", "max", "step"]) assertFiniteNumber(control[field], `${path}.${field}`);
    assert(control.min < control.max, `${path}.min must be less than max`);
    assert(control.step > 0 && control.step <= control.max - control.min, `${path}.step must be positive and no greater than the control span`);
  } else if (control.type === "select") {
    assert(Array.isArray(control.options) && control.options.length > 0, `${path}.options must be a non-empty array`);
    assertUnique(control.options.map(({ value }) => value), `${path} option values`);
    for (const [index, option] of control.options.entries()) {
      const optionPath = `${path}.options[${index}]`;
      assertExactKeys(option, keysWithOptionals(option, ["value", "label"], ["description"]), optionPath);
      assertString(option.value, `${optionPath}.value`);
      assertString(option.label, `${optionPath}.label`);
      if (option.description !== undefined) assertString(option.description, `${optionPath}.description`);
    }
  }
  validateControlValue(control, control.default, `${path}.default`);
}

function validateDimensionBasis(basis, path) {
  assertExactKeys(basis, ["system", "axes", "exponentType", "activityExponentSubset"], path);
  assert(basis.system === "ISQ", `${path}.system must be ISQ`);
  assert(Array.isArray(basis.axes), `${path}.axes must be an array`);
  assertExactValues(basis.axes.map(({ id }) => id), DIMENSION_AXES, `${path}.axes`);
  for (const [index, axis] of basis.axes.entries()) {
    const axisPath = `${path}.axes[${index}]`;
    assertExactKeys(axis, ["id", "symbol"], axisPath);
    assertId(axis.id, `${axisPath}.id`);
    assertString(axis.symbol, `${axisPath}.symbol`);
  }
  assert(basis.exponentType === "rational", `${path}.exponentType must be rational`);
  assert(basis.activityExponentSubset === "integer", `${path}.activityExponentSubset must be integer`);
}

function validateNumericalMethod(method, path) {
  assertExactKeys(method, keysWithOptionals(method, ["kind", "name", "description", "deterministic"], ["implementationRef", "tolerance", "maxIterations"]), path);
  assert(NUMERICAL_METHOD_KINDS.has(method.kind), `${path}.kind is not recognized`);
  assertString(method.name, `${path}.name`);
  assertString(method.description, `${path}.description`);
  assert(typeof method.deterministic === "boolean", `${path}.deterministic must be boolean`);
  if (method.implementationRef !== undefined) assertString(method.implementationRef, `${path}.implementationRef`);
  if (method.tolerance !== undefined) {
    assertFiniteNumber(method.tolerance, `${path}.tolerance`);
    assert(method.tolerance > 0, `${path}.tolerance must be positive`);
  }
  if (method.maxIterations !== undefined) assertPositiveInteger(method.maxIterations, `${path}.maxIterations`);
}

function validateDatasetState(datasetState, path, referencesById) {
  assertExactKeys(datasetState, keysWithOptionals(datasetState, ["state", "datasetRefs", "purposes"], ["revision", "selection"]), path);
  assert(DATASET_STATES.has(datasetState.state), `${path}.state is not recognized`);
  assertEvidenceRefs(datasetState.datasetRefs, referencesById, `${path}.datasetRefs`);
  assertStringArray(datasetState.purposes, `${path}.purposes`);
  assertUnique(datasetState.purposes, `${path}.purposes`);
  for (const purpose of datasetState.purposes) assert(DATASET_PURPOSES.has(purpose), `${path}.purposes contains unrecognized purpose ${purpose}`);
  if (datasetState.revision !== undefined) assertString(datasetState.revision, `${path}.revision`);
  if (datasetState.selection !== undefined) assertString(datasetState.selection, `${path}.selection`);
  if (datasetState.state === "not-applicable") {
    assert(datasetState.datasetRefs.length === 0 && datasetState.purposes.length === 0, `${path} not-applicable state requires empty datasetRefs and purposes`);
  }
}

function validateModelComponents(components, path, referencesById) {
  assert(Array.isArray(components) && components.length > 0, `${path} must be a non-empty array`);
  assertUnique(components.map(({ id }) => id), `${path} IDs`);
  for (const [index, component] of components.entries()) {
    const componentPath = `${path}[${index}]`;
    assertExactKeys(component, ["id", "label", "modelOrigin", "description", "attribution"], componentPath);
    assertId(component.id, `${componentPath}.id`);
    assertString(component.label, `${componentPath}.label`);
    assert(MODEL_ORIGIN_SET.has(component.modelOrigin), `${componentPath}.modelOrigin is not recognized`);
    assertString(component.description, `${componentPath}.description`);
    validateAttribution(component.attribution, `${componentPath}.attribution`, referencesById);
    assert(component.attribution.modelOrigin === component.modelOrigin, `${componentPath}.attribution.modelOrigin must match modelOrigin`);
  }
}

function validateOutputSchema(outputSchema, path, referencesById) {
  assert(Array.isArray(outputSchema) && outputSchema.length > 0, `${path} must be a non-empty array`);
  assertUnique(outputSchema.map(({ id }) => id), `${path} IDs`);
  for (const [index, field] of outputSchema.entries()) {
    const fieldPath = `${path}[${index}]`;
    assertExactKeys(field, keysWithOptionals(field, ["id", "label", "type", "unit", "nullable", "description"], ["attribution"]), fieldPath);
    assertId(field.id, `${fieldPath}.id`);
    assertString(field.label, `${fieldPath}.label`);
    assert(OUTPUT_TYPES.has(field.type), `${fieldPath}.type is not recognized`);
    assert(field.unit === null || (typeof field.unit === "string" && field.unit.trim().length > 0), `${fieldPath}.unit must be null or a non-empty string`);
    assert(typeof field.nullable === "boolean", `${fieldPath}.nullable must be boolean`);
    assertString(field.description, `${fieldPath}.description`);
    validateOptionalAttribution(field, fieldPath, referencesById);
  }
}

function validateSourceComparison(comparison, path, referencesById) {
  assertExactKeys(comparison, keysWithOptionals(comparison, ["compatibility", "incompatibleBehavior"], ["attribution"]), path);
  assert(comparison.compatibility === "same-simulation-revision-and-output-schema", `${path}.compatibility is not recognized`);
  assertString(comparison.incompatibleBehavior, `${path}.incompatibleBehavior`);
  validateOptionalAttribution(comparison, path, referencesById);
}

function validateVisualization(visualization, path, referencesById) {
  assertExactKeys(visualization, keysWithOptionals(visualization, ["kind", "description", "alternatives", "reducedMotionBehavior"], ["attribution"]), path);
  assertString(visualization.kind, `${path}.kind`);
  assertString(visualization.description, `${path}.description`);
  validateOptionalAttribution(visualization, path, referencesById);
  assert(Array.isArray(visualization.alternatives), `${path}.alternatives must be an array`);
  assertExactValues(visualization.alternatives.map(({ type }) => type), ["text", "table"], `${path}.alternatives`);
  for (const [index, alternative] of visualization.alternatives.entries()) {
    const alternativePath = `${path}.alternatives[${index}]`;
    assertExactKeys(alternative, keysWithOptionals(alternative, ["type", "description"], ["attribution"]), alternativePath);
    assertString(alternative.description, `${alternativePath}.description`);
    validateOptionalAttribution(alternative, alternativePath, referencesById);
  }
  assertString(visualization.reducedMotionBehavior, `${path}.reducedMotionBehavior`);
}

function validateRevision(revision, contentRevision, path) {
  assertExactKeys(revision, ["contentRevision", "modelRevision", "implementationRevision"], path);
  assertIsoDate(revision.contentRevision, `${path}.contentRevision`);
  assert(revision.contentRevision === contentRevision, `${path}.contentRevision must match manifest.contentRevision`);
  assertString(revision.modelRevision, `${path}.modelRevision`);
  assertString(revision.implementationRevision, `${path}.implementationRevision`);
}

function validateRuntimeLimits(limits, path) {
  assertObject(limits, path);
  if (limits.tier === "immediate") {
    assertExactKeys(limits, ["tier", "maxOperations", "maxDurationMs"], path);
    assertPositiveInteger(limits.maxOperations, `${path}.maxOperations`);
    assertPositiveInteger(limits.maxDurationMs, `${path}.maxDurationMs`);
  } else if (limits.tier === "local-worker") {
    assertExactKeys(limits, ["tier", "maxOperations", "maxDurationMs", "maxIterations"], path);
    assertPositiveInteger(limits.maxOperations, `${path}.maxOperations`);
    assertPositiveInteger(limits.maxDurationMs, `${path}.maxDurationMs`);
    assertPositiveInteger(limits.maxIterations, `${path}.maxIterations`);
  } else if (limits.tier === "artifact") {
    assertExactKeys(limits, ["tier", "maxArtifactBytes"], path);
    assertPositiveInteger(limits.maxArtifactBytes, `${path}.maxArtifactBytes`);
  } else if (limits.tier === "unavailable") {
    assertExactKeys(limits, ["tier", "reason"], path);
    assertString(limits.reason, `${path}.reason`);
  } else {
    throw new Error(`${path}.tier is not recognized`);
  }
}

function validateFinding(finding, path, referencesById) {
  assertExactKeys(finding, ["changed", "cause", "equation", "assumptions", "establishes", "doesNotEstablish", ...ATTRIBUTION_KEYS], path);
  for (const field of ["changed", "cause", "equation", "establishes", "doesNotEstablish"]) assertString(finding[field], `${path}.${field}`);
  assertStringArray(finding.assumptions, `${path}.assumptions`, { nonEmpty: true });
  validateAttribution(Object.fromEntries(ATTRIBUTION_KEYS.map((key) => [key, finding[key]])), path, referencesById);
}

function validateSimulations(simulations, lessonById, glossaryById, referencesById, contentRevision) {
  assert(simulations.length === EXPECTED_SIMULATIONS, `Expected ${EXPECTED_SIMULATIONS} simulations, found ${simulations.length}`);
  assertUnique(simulations.map(({ id }) => id), "Simulation IDs");
  const required = ["schemaVersion", "id", "lessonId", "title", "question", "predictionPrompt", ...ATTRIBUTION_KEYS, "revision", "modelComponents", "equations", "assumptions", "glossaryIds", "controls", "presets", "outputSchema", "comparison", "visualization", "finding", "limits"];
  const optional = ["dimensionBasis", "numericalMethod", "datasetState"];
  for (const [index, simulation] of simulations.entries()) {
    const path = `simulations.${simulation.id ?? index}`;
    assertSchema(simulation, path, keysWithOptionals(simulation, required, optional));
    assertId(simulation.id, `${path}.id`);
    assertId(simulation.lessonId, `${path}.lessonId`);
    assert(lessonById.has(simulation.lessonId), `${path}.lessonId references unknown lesson ${simulation.lessonId}`);
    assertString(simulation.title, `${path}.title`);
    assertString(simulation.question, `${path}.question`);
    assertString(simulation.predictionPrompt, `${path}.predictionPrompt`);
    validateAttribution(Object.fromEntries(ATTRIBUTION_KEYS.map((key) => [key, simulation[key]])), path, referencesById);
    validateRevision(simulation.revision, contentRevision, `${path}.revision`);
    if (simulation.dimensionBasis !== undefined) validateDimensionBasis(simulation.dimensionBasis, `${path}.dimensionBasis`);
    if (simulation.numericalMethod !== undefined) validateNumericalMethod(simulation.numericalMethod, `${path}.numericalMethod`);
    if (simulation.datasetState !== undefined) validateDatasetState(simulation.datasetState, `${path}.datasetState`, referencesById);
    validateModelComponents(simulation.modelComponents, `${path}.modelComponents`, referencesById);
    assertStringArray(simulation.equations, `${path}.equations`, { nonEmpty: true });
    assertStringArray(simulation.assumptions, `${path}.assumptions`, { nonEmpty: true });
    assertStringArray(simulation.glossaryIds, `${path}.glossaryIds`, { nonEmpty: true });
    assertUnique(simulation.glossaryIds, `${path}.glossaryIds`);
    for (const id of simulation.glossaryIds) assert(glossaryById.has(id), `${path}.glossaryIds contains unknown glossary reference ${id}`);
    const simulationGlossaryIds = new Set(simulation.glossaryIds);
    const glossaryEntries = [...glossaryById.values()];
    assert(Array.isArray(simulation.controls) && simulation.controls.length > 0, `${path}.controls must be a non-empty array`);
    assertUnique(simulation.controls.map(({ id }) => id), `${path} control IDs`);
    simulation.controls.forEach((control, controlIndex) => validateControl(control, `${path}.controls[${controlIndex}]`, referencesById));
    const guidedControls = simulation.controls.filter(({ readingDepth }) => readingDepth === "guided");
    assert(guidedControls.length <= 3, `${path}.controls may expose at most 3 Guided controls, found ${guidedControls.length}`);
    assert(Array.isArray(simulation.presets) && simulation.presets.length > 0, `${path}.presets must be a non-empty array`);
    assertUnique(simulation.presets.map(({ id }) => id), `${path} preset IDs`);
    const controlIds = simulation.controls.map(({ id }) => id);
    for (const [presetIndex, preset] of simulation.presets.entries()) {
      const presetPath = `${path}.presets[${presetIndex}]`;
      assertExactKeys(preset, keysWithOptionals(preset, ["id", "label", "description", "inspectionPrompt", "inputs"], ["attribution"]), presetPath);
      assertId(preset.id, `${presetPath}.id`);
      assertString(preset.label, `${presetPath}.label`);
      assertString(preset.description, `${presetPath}.description`);
      assertString(preset.inspectionPrompt, `${presetPath}.inspectionPrompt`);
      assertExactKeys(preset.inputs, controlIds, `${presetPath}.inputs`);
      for (const control of simulation.controls) validateControlValue(control, preset.inputs[control.id], `${presetPath}.inputs.${control.id}`);
      validateOptionalAttribution(preset, presetPath, referencesById);
    }
    validateOutputSchema(simulation.outputSchema, `${path}.outputSchema`, referencesById);
    validateSourceComparison(simulation.comparison, `${path}.comparison`, referencesById);
    validateVisualization(simulation.visualization, `${path}.visualization`, referencesById);
    validateFinding(simulation.finding, `${path}.finding`, referencesById);
    validateRuntimeLimits(simulation.limits, `${path}.limits`);
    for (const control of guidedControls) {
      const texts = [control.label, control.description, control.playfulPrompt, ...(control.options ?? []).flatMap((option) => [option.label, option.description])].filter((value) => typeof value === "string");
      validateGuidedTerms(texts, simulationGlossaryIds, glossaryEntries, `${path}.controls.${control.id}`);
    }
    const lesson = lessonById.get(simulation.lessonId);
    if (lesson.quickPath !== undefined) {
      const preset = simulation.presets.find(({ id }) => id === lesson.quickPath.simulationPresetId);
      if (preset) validateGuidedTerms([preset.label, preset.description, preset.inspectionPrompt], simulationGlossaryIds, glossaryEntries, `${path}.presets.${preset.id}`);
    }
    validateGuidedTerms([
      simulation.visualization.description,
      simulation.visualization.reducedMotionBehavior,
      ...simulation.visualization.alternatives.map(({ description }) => description),
    ], simulationGlossaryIds, glossaryEntries, `${path}.visualization`);
  }
}

function validateOwnershipAndQuickPaths(manifest, chapters, lessons, simulations) {
  const chapterById    = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const lessonById     = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const simulationById = new Map(simulations.map((simulation) => [simulation.id, simulation]));
  for (const chapter of chapters) {
    const stationIds = manifest.quickStations.filter(({ chapterId }) => chapterId === chapter.id).map(({ id }) => id);
    const lessonIds  = lessons.filter(({ chapterId }) => chapterId === chapter.id).sort((left, right) => left.order - right.order).map(({ id }) => id);
    assertExactValues(chapter.quickStationIds, stationIds, `chapters.${chapter.id}.quickStationIds`);
    assertExactValues(chapter.lessonIds, lessonIds, `chapters.${chapter.id}.lessonIds`);
    lessonIds.forEach((lessonId, index) => assert(lessonById.get(lessonId).order === index + 1, `lessons.${lessonId}.order must be ${index + 1} within chapter ${chapter.id}`));
    if (chapter.status === "content-ready") assert(lessonIds.length > 0, `Content-ready chapter ${chapter.id} must own at least one lesson`);
  }
  for (const lesson of lessons) {
    const owned = simulations.filter(({ lessonId }) => lesson.id === lessonId);
    assert(owned.length <= 1, `Lesson ${lesson.id} owns more than one simulation`);
    assert((lesson.simulationId === null && owned.length === 0) || (owned.length === 1 && owned[0].id === lesson.simulationId), `Lesson ${lesson.id} simulation ownership is not reciprocal`);
    const simulation = lesson.simulationId === null ? null : simulationById.get(lesson.simulationId);
    if (lesson.quickPath !== undefined) {
      assert(simulation, `Lesson ${lesson.id} quickPath requires its linked simulation`);
      assert(simulation.presets.some(({ id }) => id === lesson.quickPath.simulationPresetId), `lessons.${lesson.id}.quickPath.simulationPresetId references unknown preset ${lesson.quickPath.simulationPresetId}`);
    }
  }
  for (const station of manifest.quickStations) {
    const chapter = chapterById.get(station.chapterId);
    assert(chapter, `Quick station ${station.id} references unknown chapter ${station.chapterId}`);
    const lesson = station.lessonId === null ? null : lessonById.get(station.lessonId);
    const simulation = station.simulationId === null ? null : simulationById.get(station.simulationId);
    if (station.lessonId !== null) {
      assert(lesson, `Quick station ${station.id} references unknown lesson ${station.lessonId}`);
      assert(lesson.chapterId === station.chapterId, `Quick station ${station.id} lesson is owned by chapter ${lesson.chapterId}, not ${station.chapterId}`);
    }
    if (station.simulationId !== null) {
      assert(simulation, `Quick station ${station.id} references unknown simulation ${station.simulationId}`);
      assert(lesson && simulation.lessonId === lesson.id, `Quick station ${station.id} simulation is not owned by its lesson`);
    }
    if (station.status === "content-ready") {
      assert(chapter.status === "content-ready", `Content-ready station ${station.id} requires a content-ready chapter`);
      assert(lesson, `Content-ready station ${station.id} requires a linked lesson`);
      assert(simulation, `Content-ready station ${station.id} requires a linked simulation`);
      assert(lesson.quickPath !== undefined, `Content-ready station ${station.id} requires a lesson quickPath`);
      assert(lesson.simulationId === simulation.id, `Content-ready station ${station.id} requires a complete lesson/simulation chain`);
      assert(simulation.limits.tier !== "unavailable", `Content-ready station ${station.id} cannot use an unavailable simulation`);
      assert(station.estimatedMinutes === lesson.quickPath.estimatedMinutes, `Content-ready station ${station.id} estimatedMinutes must equal lesson quickPath estimatedMinutes`);
    }
  }
}

function withNavigation(records, previousField, nextField) {
  return records.map((record, index) => ({
    ...record,
    [previousField]: records[index - 1]?.id ?? null,
    [nextField]: records[index + 1]?.id ?? null,
  }));
}

function assertAcyclicNavigation(records, previousField, nextField, label) {
  const byId = new Map(records.map((record) => [record.id, record]));
  const visited = new Set();
  let current = records[0] ?? null;
  while (current) {
    assert(!visited.has(current.id), `${label} next navigation contains a cycle at ${current.id}`);
    visited.add(current.id);
    const nextId = current[nextField];
    if (nextId === null) break;
    const next = byId.get(nextId);
    assert(next, `${label} ${current.id} references unknown next item ${nextId}`);
    assert(next[previousField] === current.id, `${label} navigation is not reciprocal between ${current.id} and ${nextId}`);
    current = next;
  }
  assert(visited.size === records.length, `${label} navigation does not reach every item`);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort((left, right) => left.localeCompare(right, "en")).map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function compatibilityKey(simulation) {
  const contract = {
    id: simulation.id,
    contentRevision: simulation.revision.contentRevision,
    modelRevision: simulation.revision.modelRevision,
    implementationRevision: simulation.revision.implementationRevision,
    outputSchema: simulation.outputSchema,
  };
  return createHash("sha256").update(canonicalJson(contract), "utf8").digest("hex");
}

function iterableIds(values, path) {
  assert(values && typeof values[Symbol.iterator] === "function", `${path} must be iterable`);
  const ids = [...values];
  ids.forEach((id, index) => assertString(id, `${path}[${index}]`));
  assertUnique(ids, path);
  return new Set(ids);
}

function validateGeneratedArtifacts(artifacts) {
  const manifestKeys = ["schemaVersion", "contentRevision", "title", "thesis", "attribution", "readingDepths", "depthComposition", "attributionPolicy", "contentStatusPolicy", "quickStations", "chapters", "counts"];
  assertExactKeys(artifacts.manifest, manifestKeys, "generated manifest");
  assertExactKeys(artifacts.manifest.counts, ["chapters", "lessons", "simulations", "glossary", "references"], "generated manifest.counts");
  for (const chapter of artifacts.chapters) {
    assertExactKeys(chapter, ["schemaVersion", "id", "order", "act", "title", "question", "summary", "status", "quickStationIds", "lessonIds", "attribution", "previousChapterId", "nextChapterId"], `generated chapters.${chapter.id}`);
  }
  for (const lesson of artifacts.lessons) {
    const required = ["schemaVersion", "id", "chapterId", "order", "title", "question", "answerPreview", "summary", "attribution", "estimatedMinutes", "depthComposition", "prerequisites", "observationStage", "guidedBlocks", "technicalBlocks", "equationSteps", "simulationId", "formulaIds", "programIds", "glossaryIds", "evidenceRefs", "checkpoints", ...CONCLUSION_FIELDS, "previousLessonId", "nextLessonId"];
    assertExactKeys(lesson, keysWithOptionals(lesson, required, ["quickPath"]), `generated lessons.${lesson.id}`);
  }
  for (const simulation of artifacts.simulations) {
    const required = ["schemaVersion", "id", "lessonId", "title", "question", "predictionPrompt", ...ATTRIBUTION_KEYS, "revision", "modelComponents", "equations", "assumptions", "glossaryIds", "controls", "presets", "outputSchema", "comparison", "visualization", "finding", "limits"];
    assertExactKeys(simulation, keysWithOptionals(simulation, required, ["dimensionBasis", "numericalMethod", "datasetState"]), `generated simulations.${simulation.id}`);
    assertExactKeys(simulation.comparison, keysWithOptionals(simulation.comparison, ["compatibility", "incompatibleBehavior", "compatibilityKey"], ["attribution"]), `generated simulations.${simulation.id}.comparison`);
    assert(/^[a-f0-9]{64}$/.test(simulation.comparison.compatibilityKey), `generated simulations.${simulation.id}.comparison.compatibilityKey must be a SHA-256`);
  }
}

export function buildTourArtifacts(source, { recipeIds, programIds } = {}) {
  assertExactKeys(source, ["manifest", "claimVocabulary", "glossary", "references", "chapters", "lessons", "simulations"], "Tour source");
  assertInertStrings(source);
  const knownRecipeIds = iterableIds(recipeIds, "recipeIds");
  const knownProgramIds = iterableIds(programIds, "programIds");
  const referencesById = validateReferences(source.references);
  validateVocabulary(source.claimVocabulary, referencesById);
  validateGlossary(source.glossary, referencesById);
  const glossaryById = new Map(source.glossary.entries.map((entry) => [entry.id, entry]));
  validateManifest(source.manifest, referencesById, glossaryById);
  assert(Array.isArray(source.chapters), "Tour source chapters must be an array");
  assert(Array.isArray(source.lessons), "Tour source lessons must be an array");
  assert(Array.isArray(source.simulations), "Tour source simulations must be an array");
  const chapters      = validateChapters(source.chapters, referencesById);
  const chapterById   = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const lessonById    = new Map(source.lessons.map((lesson) => [lesson.id, lesson]));
  validateLessons(source.lessons, chapterById, glossaryById, referencesById, knownRecipeIds, knownProgramIds);
  validateSimulations(source.simulations, lessonById, glossaryById, referencesById, source.manifest.contentRevision);
  validateOwnershipAndQuickPaths(source.manifest, chapters, source.lessons, source.simulations);
  const orderedLessons = [...source.lessons].sort((left, right) => {
    const chapterOrder = chapterById.get(left.chapterId).order - chapterById.get(right.chapterId).order;
    return chapterOrder || left.order - right.order;
  });
  const orderedSourceSimulations = [...source.simulations].sort((left, right) => {
    const leftIndex = orderedLessons.findIndex(({ id }) => id === left.lessonId);
    const rightIndex = orderedLessons.findIndex(({ id }) => id === right.lessonId);
    return leftIndex - rightIndex || left.id.localeCompare(right.id, "en");
  });
  const chapterArtifacts = withNavigation(chapters, "previousChapterId", "nextChapterId");
  const lessonArtifacts  = withNavigation(orderedLessons, "previousLessonId", "nextLessonId");
  const simulationArtifacts = orderedSourceSimulations.map((simulation) => ({
    ...simulation,
    comparison: {
      ...simulation.comparison,
      compatibilityKey: compatibilityKey(simulation),
    },
  }));
  assertAcyclicNavigation(chapterArtifacts, "previousChapterId", "nextChapterId", "Chapter");
  assertAcyclicNavigation(lessonArtifacts, "previousLessonId", "nextLessonId", "Lesson");
  const counts = {
    chapters: chapterArtifacts.length,
    lessons: lessonArtifacts.length,
    simulations: simulationArtifacts.length,
    glossary: source.glossary.entries.length,
    references: source.references.entries.length,
  };
  const artifacts = {
    manifest: {
      ...source.manifest,
      quickStations: [...source.manifest.quickStations],
      chapters: chapterArtifacts,
      counts,
    },
    chapters: chapterArtifacts,
    lessons: lessonArtifacts,
    simulations: simulationArtifacts,
    glossary: source.glossary,
    references: source.references,
    claimVocabulary: source.claimVocabulary,
    summary: {
      ...counts,
      quickStations: source.manifest.quickStations.length,
      quickStationMinutes: source.manifest.quickStations.reduce((total, station) => total + station.estimatedMinutes, 0),
    },
  };
  assertInertStrings(artifacts, "generated tour artifacts");
  validateGeneratedArtifacts(artifacts);
  return artifacts;
}
