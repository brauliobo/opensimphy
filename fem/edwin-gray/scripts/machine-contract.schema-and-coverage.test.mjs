import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MACHINE_ROOT = join(ROOT, "machines/v1");
const SCHEMA_PATH = join(ROOT, "schema/motor-machine.schema.json");
const COMPATIBILITY_FIELDS = [
  "topology",
  "geometryRevision",
  "windingTurns",
  "excitationEventSchedule",
  "materials",
  "circuit",
  "mechanicalLoad",
  "femAvailability"
];
const BLOCKING_FIELDS = COMPATIBILITY_FIELDS.filter((field) => field !== "femAvailability");
const EVIDENCE_CLASSES = new Set([
  "measured",
  "patent-described",
  "patent-derived",
  "assumed",
  "calibrated",
  "unavailable"
]);
const EXPECTED_ENGINE_IDENTITIES = new Map([
  ["ema4", "EMA4"],
  ["ema6", "EMA6"],
  ["purple", "Purple 1979"],
  ["gold", "Gold 1979"],
  ["white", "White 1979"],
  ["black", "Black 1979"]
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function deepIncludes(values, expected) {
  return values.some((value) => JSON.stringify(value) === JSON.stringify(expected));
}

function resolveReference(root, reference) {
  assert.match(reference, /^#\//, `Unsupported schema reference ${reference}`);
  return reference.slice(2).split("/").reduce((value, key) => value[key], root);
}

function validateSchema(value, schema, path, root) {
  if (schema.$ref) {
    validateSchema(value, resolveReference(root, schema.$ref), path, root);
    return;
  }
  if (Object.hasOwn(schema, "const")) {
    assert.deepEqual(value, schema.const, `${path} must equal its schema constant`);
  }
  if (schema.enum) {
    assert.ok(deepIncludes(schema.enum, value), `${path} is outside the schema enum`);
  }
  if (schema.type === "object") {
    assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), `${path} must be an object`);
    for (const key of schema.required || []) assert.ok(Object.hasOwn(value, key), `${path}.${key} is required`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) assert.ok(Object.hasOwn(schema.properties || {}, key), `${path}.${key} is not allowed`);
    }
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (Object.hasOwn(value, key)) validateSchema(value[key], childSchema, `${path}.${key}`, root);
    }
  } else if (schema.type === "array") {
    assert.ok(Array.isArray(value), `${path} must be an array`);
    if (schema.minItems !== undefined) assert.ok(value.length >= schema.minItems, `${path} has too few items`);
    if (schema.uniqueItems) assert.equal(new Set(value.map(JSON.stringify)).size, value.length, `${path} items must be unique`);
    value.forEach((item, index) => validateSchema(item, schema.items, `${path}[${index}]`, root));
  } else if (schema.type === "string") {
    assert.equal(typeof value, "string", `${path} must be a string`);
    if (schema.minLength !== undefined) assert.ok(value.length >= schema.minLength, `${path} is too short`);
    if (schema.pattern) assert.match(value, new RegExp(schema.pattern), `${path} does not match its schema pattern`);
  }
}

function assertEvidenceField(field, path) {
  assert.deepEqual(Object.keys(field).sort(), ["evidenceClass", "evidenceRefs", "note", "value"], `${path} must be exactly one evidence field`);
  assert.ok(EVIDENCE_CLASSES.has(field.evidenceClass), `${path} has an unsupported evidence class`);
}

const schema = readJson(SCHEMA_PATH);
const contractFiles = readdirSync(MACHINE_ROOT)
  .filter((name) => name.endsWith(".json"))
  .sort();
const contracts = contractFiles.map((name) => readJson(join(MACHINE_ROOT, name)));

test("machine-contract schema validates every versioned contract and evidence field", () => {
  assert.equal(contracts.length, 7);
  for (const contract of contracts) {
    validateSchema(contract, schema, contract.contractId, schema);
    for (const [name, field] of Object.entries(contract.identity)) assertEvidenceField(field, `${contract.contractId}.identity.${name}`);
    for (const name of COMPATIBILITY_FIELDS) assertEvidenceField(contract.compatibilityIdentity[name], `${contract.contractId}.compatibilityIdentity.${name}`);
    contract.limitations.forEach((field, index) => assertEvidenceField(field, `${contract.contractId}.limitations[${index}]`));
  }
});

test("machine-contract IDs and machine identities are unique and cover the current engine catalog", () => {
  const contractIds = contracts.map(({ contractId }) => contractId);
  const machineIds = contracts.map(({ identity }) => identity.machineId.value);
  assert.equal(new Set(contractIds).size, contracts.length, "contract IDs must be unique");
  assert.equal(new Set(machineIds).size, contracts.length, "machine IDs must be unique");
  assert.deepEqual(contractFiles, contractIds.map((id) => `${id}.json`).sort(), "contract filenames must match contract IDs");

  const prototypes = contracts.filter(({ machineKind }) => machineKind === "engine-prototype");
  const actualIdentities = new Map(prototypes.map(({ identity }) => [identity.machineId.value, identity.name.value]));
  assert.deepEqual(actualIdentities, EXPECTED_ENGINE_IDENTITIES);

  const runtimeIdentities = new Map(prototypes.map(({ runtimeModel }) => [
    runtimeModel.catalog.engineMotorId,
    runtimeModel.catalog.label
  ]));
  assert.deepEqual(runtimeIdentities, EXPECTED_ENGINE_IDENTITIES);
});

test("machine-contract FEM compatibility is exclusive to the illustrative patent topology", () => {
  const compatible = contracts.filter(({ compatibilityIdentity }) => compatibilityIdentity.femAvailability.value.compatible);
  assert.deepEqual(compatible.map(({ contractId }) => contractId), ["us3890548a-illustrative-topology-v1"]);
  const patent = compatible[0];
  assert.equal(patent.compatibilityIdentity.femAvailability.value.caseId, "patent-3890548-illustrative");
  assert.equal(patent.compatibilityIdentity.femAvailability.value.scope, "illustrative-not-replica");
  assert.equal(patent.compatibilityIdentity.femAvailability.value.runStatus, "not-run");
  assert.deepEqual(patent.compatibilityIdentity.femAvailability.value.blockedBy, []);
});

test("machine-contract prototypes block unavailable physical identity without patent inheritance", () => {
  const prototypes = contracts.filter(({ machineKind }) => machineKind === "engine-prototype");
  assert.equal(prototypes.length, EXPECTED_ENGINE_IDENTITIES.size);
  for (const contract of prototypes) {
    const { compatibilityIdentity } = contract;
    for (const field of BLOCKING_FIELDS) {
      assert.equal(compatibilityIdentity[field].value, null, `${contract.contractId}.${field} must not inherit patent values`);
      assert.equal(compatibilityIdentity[field].evidenceClass, "unavailable", `${contract.contractId}.${field} must block on unavailable evidence`);
    }
    assert.equal(compatibilityIdentity.femAvailability.evidenceClass, "unavailable");
    assert.equal(compatibilityIdentity.femAvailability.value.compatible, false);
    assert.equal(compatibilityIdentity.femAvailability.value.caseId, null);
    assert.equal(compatibilityIdentity.femAvailability.value.scope, "blocked-unavailable-identity");
    assert.deepEqual(compatibilityIdentity.femAvailability.value.blockedBy, BLOCKING_FIELDS);
    assert.equal(contract.runtimeModel.sourceClassification.sourceStatus, "descriptive");
    assert.equal(contract.runtimeModel.sourceClassification.surrogateStatus, "illustrative-not-fem-calibrated");
    assert.equal(contract.runtimeModel.profile.femCompatible, false);
    assert.equal(contract.runtimeModel.profile.modelInputHash, null);
  }
});
