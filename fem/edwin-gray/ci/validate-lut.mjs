import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function validateSchema(value, schema, path, root) {
  if (schema.$ref) {
    const prefix = "#/$defs/";
    assert(schema.$ref.startsWith(prefix), `${path} uses an unsupported schema reference`);
    const definition = root.$defs?.[schema.$ref.slice(prefix.length)];
    assert(definition, `${path} references a missing schema definition`);
    validateSchema(value, definition, path, root);
    return;
  }

  if (schema.const !== undefined) assert(stableJson(value) === stableJson(schema.const), `${path} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum) assert(schema.enum.some((item) => stableJson(item) === stableJson(value)), `${path} has an unsupported value`);

  if (schema.type === "object") {
    assert(value && typeof value === "object" && !Array.isArray(value), `${path} must be an object`);
    for (const key of schema.required || []) assert(Object.hasOwn(value, key), `${path}.${key} is required`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) assert(Object.hasOwn(schema.properties || {}, key), `${path}.${key} is not allowed`);
    }
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (Object.hasOwn(value, key)) validateSchema(value[key], childSchema, `${path}.${key}`, root);
    }
  } else if (schema.type === "array") {
    assert(Array.isArray(value), `${path} must be an array`);
    if (schema.minItems !== undefined) assert(value.length >= schema.minItems, `${path} must contain at least ${schema.minItems} items`);
    if (schema.uniqueItems) assert(new Set(value.map(stableJson)).size === value.length, `${path} must contain unique items`);
    value.forEach((item, index) => validateSchema(item, schema.items, `${path}[${index}]`, root));
  } else if (schema.type === "string") {
    assert(typeof value === "string", `${path} must be a string`);
    if (schema.minLength !== undefined) assert(value.length >= schema.minLength, `${path} must not be empty`);
    if (schema.pattern) assert(new RegExp(schema.pattern).test(value), `${path} has an invalid format`);
  } else if (schema.type === "number" || schema.type === "integer") {
    assert(typeof value === "number" && Number.isFinite(value), `${path} must be a finite number`);
    if (schema.type === "integer") assert(Number.isInteger(value), `${path} must be an integer`);
    if (schema.minimum !== undefined) assert(value >= schema.minimum, `${path} must be >= ${schema.minimum}`);
    if (schema.maximum !== undefined) assert(value <= schema.maximum, `${path} must be <= ${schema.maximum}`);
    if (schema.exclusiveMinimum !== undefined) assert(value > schema.exclusiveMinimum, `${path} must be > ${schema.exclusiveMinimum}`);
    if (schema.exclusiveMaximum !== undefined) assert(value < schema.exclusiveMaximum, `${path} must be < ${schema.exclusiveMaximum}`);
  } else if (schema.type === "boolean") {
    assert(typeof value === "boolean", `${path} must be a boolean`);
  }
}

export function validateBundledLut(document, schema) {
  validateSchema(document, schema, "lut", schema);
  assert(document.status === "complete", "lut.status must be complete");
  assert(document.entries.every((entry) => entry.status === "complete"), "all LUT entries must be complete");

  const angles = document.entries.map((entry) => entry.parameters.rotorAngleDeg);
  assert(stableJson(angles) === stableJson(document.expectedAnglesDeg), "LUT entries must exactly cover expectedAnglesDeg in order");
  assert(angles.every((angle, index) => index === 0 || angle > angles[index - 1]), "LUT entry angles must be strictly increasing");

  const first = document.entries[0];
  assert(document.entries.every((entry) => entry.parameters.meshSizeM === first.parameters.meshSizeM), "LUT entries must share one mesh size");
  assert(document.entries.every((entry) => entry.parameters.driveCurrentA === first.parameters.driveCurrentA), "LUT entries must share one drive current");
  assert(document.entries.every((entry) => entry.provenance.modelInputHash === first.provenance.modelInputHash), "LUT entries must share one model input hash");
  assert(document.entries.every((entry) => entry.provenance.solver === first.provenance.solver && entry.provenance.backend === first.provenance.backend), "LUT entries must share one solver environment");
  assert(new Set(document.entries.map((entry) => entry.provenance.jobInputHash)).size === document.entries.length, "LUT entries must have distinct job input hashes");
}

export function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}
