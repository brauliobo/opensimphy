#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const RESULT_CONTRACT = "edwin-gray-browser-result";
export const RESULT_CONTRACT_VERSION = 1;
export const LUT_CONTRACT = "motor-fem-lut-v1";
const CHECKPOINT_VERSION = "fem-checkpoint-v4";
const SOLVER_OUTPUTS = ["observables.dat", "coenergy.dat", "inductance.dat"];
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    if (key === "help") {
      options.help = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function readJson(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} does not exist: ${path}`);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON in ${label}: ${error.message}`);
  }
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sha256File(path) {
  assert(existsSync(path), `Required solver output is missing: ${path}`);
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function numberValue(value, unit, label) {
  if (typeof value === "number") {
    assert(Number.isFinite(value), `${label} must be finite`);
    return { value, unit };
  }
  assert(value && typeof value === "object", `${label} must be a number or value object`);
  assert(typeof value.value === "number" && Number.isFinite(value.value), `${label}.value must be finite`);
  assert(value.unit === unit, `${label}.unit must be ${unit}`);
  return { value: value.value, unit };
}

function findRawResult(jobDir, explicitPath) {
  if (explicitPath) {
    return resolve(explicitPath);
  }
  const candidates = [
    "result.raw.json",
    "solver-result.json",
    "observables.json"
  ];
  for (const name of candidates) {
    const candidate = resolve(jobDir, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function validateCheckpoint({ jobDir, modelInputHash, jobInputHash, parameters, backend }) {
  const checkpointPath = resolve(jobDir, "checkpoint.json");
  assert(existsSync(checkpointPath), "Solver output requires a runner checkpoint");
  const checkpoint = readJson(checkpointPath, "runner checkpoint");
  assert(checkpoint.checkpointVersion === CHECKPOINT_VERSION, "Runner checkpoint version is invalid");
  assert(checkpoint.modelInputHash === modelInputHash, "Runner checkpoint model input hash does not match normalization input");
  assert(checkpoint.jobInputHash === jobInputHash, "Runner checkpoint job input hash does not match normalization input");
  assert(checkpoint.inputHash === jobInputHash, "Runner checkpoint input hash does not match normalization input");
  assert(stableJson(checkpoint.parameters) === stableJson(parameters), "Runner checkpoint parameters do not match normalization parameters");
  assert(checkpoint.backend === backend, "Runner checkpoint backend does not match normalization backend");
  assert(checkpoint.resultContract === `${RESULT_CONTRACT}@${RESULT_CONTRACT_VERSION}`, "Runner checkpoint result contract is invalid");
  assert(checkpoint.meshQuality === "passed", "Runner checkpoint does not contain a passed mesh-quality gate");
  assert(checkpoint.phases?.solve === "complete", "Runner checkpoint does not contain a completed solver phase");
  assert(checkpoint.artifacts?.outputs && typeof checkpoint.artifacts.outputs === "object", "Runner checkpoint does not record solver output hashes");
  return checkpoint;
}

function validateTableProvenance({ jobDir, modelInputHash, jobInputHash, parameters, solver, backend }) {
  const checkpoint = validateCheckpoint({ jobDir, modelInputHash, jobInputHash, parameters, backend });
  assert(solver === "getdp", "GetDP tables must be normalized with solver getdp");
  for (const name of SOLVER_OUTPUTS) {
    const path = resolve(jobDir, name);
    assert(checkpoint.artifacts?.outputs?.[name] === sha256File(path), `Solver output hash is not recorded in the runner checkpoint: ${name}`);
  }
}

function validateRawProvenance(raw, rawPath, { jobDir, modelInputHash, jobInputHash, parameters, solver, backend }) {
  const checkpoint = validateCheckpoint({ jobDir, modelInputHash, jobInputHash, parameters, backend });
  const artifactPath = relative(jobDir, rawPath) || ".";
  assert(checkpoint.artifacts.outputs[artifactPath] === sha256File(rawPath), "Raw solver JSON hash is not recorded in the runner checkpoint");
  assert(raw.synthetic === false, "Raw solver output must explicitly set synthetic to false");
  assert(raw.parameters && stableJson(raw.parameters) === stableJson(parameters), "Raw solver parameters do not match normalization parameters");
  assert(raw.provenance?.modelInputHash === modelInputHash, "Raw solver model input hash does not match normalization input");
  assert(raw.provenance?.jobInputHash === jobInputHash, "Raw solver job input hash does not match normalization input");
  assert(raw.provenance?.solver === solver, "Raw solver label does not match normalization solver");
  assert(raw.provenance?.backend === backend, "Raw solver backend does not match normalization backend");
}

function parseLastNumber(path) {
  assert(existsSync(path), `Required solver output is missing: ${path}`);
  const text = readFileSync(path, "utf8");
  const matches = text.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) || [];
  const values = matches.map(Number).filter(Number.isFinite);
  assert(values.length > 0, `No numeric value found in solver output: ${path}`);
  return values.at(-1);
}

function readObservables(jobDir, rawPath, provenance) {
  if (rawPath) {
    const raw = readJson(rawPath, "raw solver result");
    validateRawProvenance(raw, rawPath, provenance);
    const source = raw.observables && typeof raw.observables === "object" ? raw.observables : raw;
    return {
      magneticEnergyJ: numberValue(source.magneticEnergyJ, "J", "magneticEnergyJ"),
      coEnergyJ: numberValue(source.coEnergyJ, "J", "coEnergyJ"),
      inductanceH: numberValue(source.inductanceH, "H", "inductanceH")
    };
  }

  return {
    magneticEnergyJ: { value: parseLastNumber(resolve(jobDir, "observables.dat")), unit: "J" },
    coEnergyJ: { value: parseLastNumber(resolve(jobDir, "coenergy.dat")), unit: "J" },
    inductanceH: { value: parseLastNumber(resolve(jobDir, "inductance.dat")), unit: "H" }
  };
}

function artifactRecords(jobDir, artifacts = []) {
  const records = artifacts
    .filter((path) => typeof path === "string" && path.length > 0)
    .map((path) => {
      const resolvedPath = resolve(path);
      assert(existsSync(resolvedPath), `Provenance artifact is missing: ${resolvedPath}`);
      return {
        path: relative(jobDir, resolvedPath) || ".",
        sha256: sha256File(resolvedPath)
      };
    });
  assert(records.length > 0, "At least one hashed provenance artifact is required");
  assert(new Set(records.map((artifact) => artifact.path)).size === records.length, "Provenance artifact paths must be unique");
  return records;
}

function expectedAngles(caseData) {
  assert(Array.isArray(caseData.sweep?.anglesDeg) && caseData.sweep.anglesDeg.length > 0, "caseData.sweep.anglesDeg is required");
  const symmetry = caseData.sweep.symmetry;
  assert(symmetry && typeof symmetry.declared === "boolean", "caseData.sweep.symmetry is required");
  const period = symmetry.declared ? 360 / symmetry.order : 360;
  assert(Number.isFinite(period) && period > 0, "caseData.sweep.symmetry.order is invalid");
  const angles = caseData.sweep.anglesDeg.map((angle) => {
    assert(Number.isFinite(angle) && angle >= 0 && angle < 360, "caseData.sweep.anglesDeg contains an invalid angle");
    return symmetry.declared ? Number((((angle % period) + period) % period).toFixed(10)) : angle;
  });
  return [...new Map(angles.map((angle) => [angle.toFixed(10), angle])).values()];
}

function validateResultSchema(result, schema) {
  assert(schema.$schema && schema.$id, "result schema metadata is incomplete");
  assert(result.contract === schema.properties.contract.const, "normalized result contract is invalid");
  assert(result.contractVersion === schema.properties.contractVersion.const, "normalized result contract version is invalid");
  assert(result.lutContract === schema.properties.lutContract.const, "normalized LUT contract is invalid");
  assert(result.entries.length > 0, "normalized result must contain an entry");
  for (const entry of result.entries) {
    assert(entry.status === "complete", "normalized solver entries must be complete");
    assert(entry.provenance.synthetic === false, "normalized solver output must not be synthetic");
    assert(entry.provenance.sourceFormat === "getdp-table" || entry.provenance.sourceFormat === "solver-json", "normalized source format is invalid");
    assert(SHA256_PATTERN.test(entry.provenance.modelInputHash || ""), "normalized model input hash is invalid");
    assert(SHA256_PATTERN.test(entry.provenance.jobInputHash || ""), "normalized job input hash is invalid");
    assert(entry.provenance.inputHash === undefined || entry.provenance.inputHash === entry.provenance.jobInputHash, "normalized legacy input hash must match the job input hash");
    assert(Array.isArray(entry.provenance.artifacts) && entry.provenance.artifacts.length > 0, "normalized artifact hashes are missing");
    for (const observable of ["magneticEnergyJ", "coEnergyJ", "inductanceH"]) {
      assert(Number.isFinite(entry.observables[observable]?.value), `${observable} is missing from normalized output`);
    }
  }
}

function validateNormalizedDocument(document, index) {
  assert(document && typeof document === "object", `normalized result ${index} must be an object`);
  assert(document.contract === RESULT_CONTRACT, `normalized result ${index} has an invalid contract`);
  assert(document.contractVersion === RESULT_CONTRACT_VERSION, `normalized result ${index} has an invalid contract version`);
  assert(document.lutContract === LUT_CONTRACT, `normalized result ${index} has an invalid LUT contract`);
  assert(document.caseId && typeof document.caseId === "string", `normalized result ${index} has no case ID`);
  assert(document.status === "complete", `normalized result ${index} is not complete`);
  assert(Array.isArray(document.entries) && document.entries.length > 0, `normalized result ${index} has no entries`);
  assert(Array.isArray(document.expectedAnglesDeg) && document.expectedAnglesDeg.length > 0, `normalized result ${index} has no expected angle contract`);
  assert(document.expectedAnglesDeg.every((angle) => Number.isFinite(angle) && angle >= 0 && angle < 360), `normalized result ${index} has an invalid expected angle contract`);
  assert(new Set(document.expectedAnglesDeg.map((angle) => angle.toFixed(10))).size === document.expectedAnglesDeg.length, `normalized result ${index} has duplicate expected angles`);
  assert(document.provenance?.synthetic === false, `normalized result ${index} is synthetic or unmarked`);
  assert(Array.isArray(document.provenance.limitations) && document.provenance.limitations.length > 0, `normalized result ${index} has no limitations`);
  assert(typeof document.provenance.source === "string" && document.provenance.source.length > 0, `normalized result ${index} has no source`);
  document.entries.forEach((entry, entryIndex) => {
    assert(entry?.status === "complete", `normalized result ${index} entry ${entryIndex} is not complete`);
    assert(Number.isFinite(entry.parameters?.rotorAngleDeg), `normalized result ${index} entry ${entryIndex} has no angle`);
    assert(Number.isFinite(entry.parameters?.meshSizeM) && entry.parameters.meshSizeM > 0, `normalized result ${index} entry ${entryIndex} has no mesh size`);
    assert(Number.isFinite(entry.parameters?.driveCurrentA) && entry.parameters.driveCurrentA > 0, `normalized result ${index} entry ${entryIndex} has no drive current`);
    assert(entry.provenance?.synthetic === false, `normalized result ${index} entry ${entryIndex} is synthetic or unmarked`);
    assert(entry.provenance.sourceFormat === "getdp-table" || entry.provenance.sourceFormat === "solver-json", `normalized result ${index} entry ${entryIndex} source format is invalid`);
    assert(typeof entry.provenance.solver === "string" && entry.provenance.solver.length > 0, `normalized result ${index} entry ${entryIndex} solver is invalid`);
    assert(typeof entry.provenance.backend === "string" && entry.provenance.backend.length > 0, `normalized result ${index} entry ${entryIndex} backend is invalid`);
    assert(typeof entry.provenance.symmetryApplied === "boolean", `normalized result ${index} entry ${entryIndex} symmetry provenance is invalid`);
    assert(SHA256_PATTERN.test(entry.provenance.modelInputHash || ""), `normalized result ${index} entry ${entryIndex} model input hash is invalid`);
    assert(SHA256_PATTERN.test(entry.provenance.jobInputHash || ""), `normalized result ${index} entry ${entryIndex} job input hash is invalid`);
    assert(entry.provenance.inputHash === undefined || entry.provenance.inputHash === entry.provenance.jobInputHash, `normalized result ${index} entry ${entryIndex} legacy input hash is inconsistent`);
    assert(Array.isArray(entry.provenance.artifacts) && entry.provenance.artifacts.length > 0, `normalized result ${index} entry ${entryIndex} has no artifact hashes`);
    for (const artifact of entry.provenance.artifacts) {
      assert(artifact && typeof artifact.path === "string" && artifact.path.length > 0, `normalized result ${index} entry ${entryIndex} artifact path is invalid`);
      assert(SHA256_PATTERN.test(artifact.sha256 || ""), `normalized result ${index} entry ${entryIndex} artifact hash is invalid`);
    }
    assert(new Set(entry.provenance.artifacts.map((artifact) => artifact.path)).size === entry.provenance.artifacts.length, `normalized result ${index} entry ${entryIndex} artifact paths are duplicated`);
  });
}

export function aggregateNormalizedResults(documents, { meshSizeM, driveCurrentA, resultSchema } = {}) {
  assert(Array.isArray(documents) && documents.length > 0, "at least one normalized result is required");
  if (meshSizeM !== undefined) {
    assert(Number.isFinite(meshSizeM) && meshSizeM > 0, "meshSizeM must be finite and positive");
  }
  if (driveCurrentA !== undefined) {
    assert(Number.isFinite(driveCurrentA) && driveCurrentA > 0, "driveCurrentA must be finite and positive");
  }
  documents.forEach(validateNormalizedDocument);
  const first = documents[0];
  const selectedEntries = documents.flatMap((document) => document.entries);
  assert(selectedEntries.length > 0, "complete FEM entries are required for aggregation");
  const selectedMeshSizeM = meshSizeM ?? selectedEntries[0].parameters.meshSizeM;
  const selectedDriveCurrentA = driveCurrentA ?? selectedEntries[0].parameters.driveCurrentA;
  assert(selectedEntries.every((entry) => entry.parameters.meshSizeM === selectedMeshSizeM), "aggregated FEM entries must share one mesh size");
  assert(selectedEntries.every((entry) => entry.parameters.driveCurrentA === selectedDriveCurrentA), "aggregated FEM entries must share one drive current");
  assert(documents.every((document) => document.caseId === first.caseId), "aggregated FEM results must share one case ID");
  assert(documents.every((document) => stableJson(document.expectedAnglesDeg) === stableJson(first.expectedAnglesDeg)), "aggregated FEM results must share one expected angle contract");

  const modelInputHash = selectedEntries[0].provenance.modelInputHash;
  assert(selectedEntries.every((entry) => entry.provenance.modelInputHash === modelInputHash), "aggregated FEM entries must share one model input hash");
  assert(selectedEntries.every((entry) => entry.provenance.solver === selectedEntries[0].provenance.solver && entry.provenance.backend === selectedEntries[0].provenance.backend), "aggregated FEM entries must share one solver environment");
  assert(new Set(selectedEntries.map((entry) => entry.provenance.jobInputHash)).size === selectedEntries.length, "aggregated FEM entries must have distinct job input hashes");

  const entries = [...selectedEntries].sort((left, right) => left.parameters.rotorAngleDeg - right.parameters.rotorAngleDeg);
  const angleKeys = entries.map((entry) => entry.parameters.rotorAngleDeg.toFixed(12));
  assert(new Set(angleKeys).size === angleKeys.length, "aggregated FEM entries must have unique angles");
  assert(entries.every((entry, index) => index === 0 || entry.parameters.rotorAngleDeg > entries[index - 1].parameters.rotorAngleDeg), "aggregated FEM angles must be strictly increasing");
  const expectedAngleKeys = [...first.expectedAnglesDeg].sort((left, right) => left - right).map((angle) => angle.toFixed(12));
  assert(stableJson(angleKeys) === stableJson(expectedAngleKeys), "aggregated FEM angles must exactly match the declared sweep contract");
  const limitations = [...new Set(documents.flatMap((document) => document.provenance.limitations || []))];
  const result = {
    contract: RESULT_CONTRACT,
    contractVersion: RESULT_CONTRACT_VERSION,
    lutContract: LUT_CONTRACT,
    caseId: first.caseId,
    status: "complete",
    expectedAnglesDeg: [...first.expectedAnglesDeg],
    entries,
    provenance: {
      synthetic: false,
      limitations,
      source: `${first.provenance.source}; aggregated over ${entries.length} rotor angles`
    }
  };
  if (resultSchema) {
    validateResultSchema(result, resultSchema);
  }
  return result;
}

export const aggregateResults = aggregateNormalizedResults;

export function normalizeResults({
  caseData,
  jobDir,
  parameters,
  inputHash,
  jobInputHash = inputHash,
  modelInputHash,
  solver = "getdp",
  backend = "host",
  rawPath,
  artifacts = [],
  resultSchema,
  symmetryApplied = false
}) {
  assert(caseData && typeof caseData === "object", "caseData is required");
  assert(typeof caseData.caseId === "string", "caseData.caseId is required");
  assert(typeof inputHash === "string" && SHA256_PATTERN.test(inputHash), "inputHash must be a SHA-256 hex string");
  assert(typeof jobInputHash === "string" && SHA256_PATTERN.test(jobInputHash), "jobInputHash must be a SHA-256 hex string");
  assert(inputHash === jobInputHash, "inputHash must match jobInputHash");
  assert(parameters && typeof parameters === "object", "parameters are required");
  assert(Number.isFinite(parameters.rotorAngleDeg), "parameters.rotorAngleDeg is required");
  assert(Number.isFinite(parameters.meshSizeM), "parameters.meshSizeM is required");
  assert(Number.isFinite(parameters.driveCurrentA), "parameters.driveCurrentA is required");
  assert(typeof solver === "string" && solver.length > 0, "solver is required");
  assert(typeof backend === "string" && backend.length > 0, "backend is required");

  assert(typeof modelInputHash === "string" && SHA256_PATTERN.test(modelInputHash), "modelInputHash must be a SHA-256 hex string");
  const provenance = { jobDir, modelInputHash, jobInputHash, parameters, solver, backend };
  if (!rawPath) {
    validateTableProvenance({ jobDir, modelInputHash, jobInputHash, parameters, solver, backend });
  }
  const observables = readObservables(jobDir, rawPath, provenance);
  const provenanceArtifacts = artifactRecords(
    jobDir,
    rawPath && !artifacts.some((artifact) => resolve(artifact) === resolve(rawPath)) ? [...artifacts, rawPath] : artifacts
  );
  const entryId = `angle-${parameters.rotorAngleDeg}-mesh-${parameters.meshSizeM}-current-${parameters.driveCurrentA}`;
  const result = {
    contract: RESULT_CONTRACT,
    contractVersion: RESULT_CONTRACT_VERSION,
    lutContract: LUT_CONTRACT,
    caseId: caseData.caseId,
    status: "complete",
    expectedAnglesDeg: expectedAngles(caseData),
    entries: [
      {
        entryId,
        status: "complete",
        parameters: {
          rotorAngleDeg: parameters.rotorAngleDeg,
          meshSizeM: parameters.meshSizeM,
          driveCurrentA: parameters.driveCurrentA
        },
        observables,
        provenance: {
          synthetic: false,
          sourceFormat: rawPath ? "solver-json" : "getdp-table",
          modelInputHash,
          jobInputHash,
          inputHash: jobInputHash,
          solver,
          backend,
          symmetryApplied,
          artifacts: provenanceArtifacts
        }
      }
    ],
    provenance: {
      synthetic: false,
      limitations: [
        "Linear isotropic magnetostatic snapshot only",
        "Homogenized impressed-current source; no capacitor discharge transient",
        "Inductance is the magnetic-energy proxy 2 W / I^2",
        "No motion, torque, saturation, hysteresis, losses, or energy-recovery model"
      ],
      source: "US3890548A illustrative full 3D topology"
    }
  };
  if (resultSchema) {
    validateResultSchema(result, resultSchema);
  }
  return result;
}

function usage() {
  return [
    "Usage: node scripts/normalize-results.mjs --case CASE.json --job-dir RUN_DIR --model-input-hash SHA256 --input-hash SHA256 --parameters PARAMETERS.json [options]",
    "Options:",
    "  --raw PATH       Explicit raw solver JSON with matching parameters/provenance",
    "  --model-input-hash SHA256  Shared case/geometry/problem/schema/environment identity hash",
    "  --solver NAME    Solver label (default: getdp)",
    "  --backend NAME   Backend label (default: host)",
    "  --out PATH       Output path (default: JOB_DIR/result.json)",
    "  --help           Show this help"
  ].join("\n");
}

function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return;
  }
  for (const required of ["case", "job-dir", "model-input-hash", "input-hash", "parameters"]) {
    if (!options[required]) {
      throw new Error(`Missing required option --${required}`);
    }
  }
  const caseData = readJson(resolve(options.case), "case");
  const resultSchemaPath = resolve(dirname(fileURLToPath(import.meta.url)), "../schema/motor-fem-lut.schema.json");
  const resultSchema = readJson(resultSchemaPath, "result schema");
  const parameters = readJson(resolve(options.parameters), "parameters");
  const jobDir = resolve(options["job-dir"]);
  mkdirSync(jobDir, { recursive: true });
  const rawPath = findRawResult(jobDir, options.raw);
  const result = normalizeResults({
    caseData,
    jobDir,
    parameters,
    inputHash: options["input-hash"],
    modelInputHash: options["model-input-hash"],
    solver: options.solver || "getdp",
    backend: options.backend || "host",
    rawPath,
    resultSchema,
    artifacts: rawPath
      ? [rawPath]
      : [
          resolve(jobDir, "observables.dat"),
          resolve(jobDir, "coenergy.dat"),
          resolve(jobDir, "inductance.dat")
        ]
  });
  const out = resolve(options.out || resolve(jobDir, "result.json"));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: result.status, output: out, contract: RESULT_CONTRACT, contractVersion: RESULT_CONTRACT_VERSION }));
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`normalize-results: ${error.message}`);
    process.exitCode = 1;
  }
}
