#!/usr/bin/env node

import {
  accessSync,
  copyFileSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  renameSync
} from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { delimiter, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aggregateNormalizedResults, normalizeResults } from "./normalize-results.mjs";
import { proveEventMapSymmetry, validateEventMapSymmetryProof } from "./event-map-symmetry.mjs";
import {
  environmentManifest,
  identifyDockerEnvironment,
  identifyHostEnvironment,
  identifyUnavailableEnvironment,
  resolveDockerImageReference,
  runnerIdentity
} from "./solver-environment.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");
const RUN_SCRIPT = fileURLToPath(import.meta.url);
const ENVIRONMENT_MODULE = resolve(SCRIPT_DIR, "solver-environment.mjs");
const NORMALIZE_SCRIPT = resolve(SCRIPT_DIR, "normalize-results.mjs");
const SYMMETRY_SCRIPT = resolve(SCRIPT_DIR, "event-map-symmetry.mjs");
const DEFAULT_CASE = resolve(ROOT, "cases/patent-3890548-illustrative.json");
const DEFAULT_GEO = resolve(ROOT, "geometry/patent-3890548-3d.geo");
const DEFAULT_PRO = resolve(ROOT, "getdp/magnetostatic.pro");
const DEFAULT_SOLVER_CONFIG = resolve(ROOT, "getdp/solver-profiles-v1.json");
const DEFAULT_EVENT_MAP = resolve(ROOT, "excitation/v1/event-map-v1.json");
const DEFAULT_EVENT_SELECTOR = resolve(ROOT, "excitation/v1/event-map-v1.pro");
const DEFAULT_MESH_AUDIT = resolve(ROOT, "mesh-audit/audit-msh.mjs");
const DEFAULT_RUNS = resolve(ROOT, "runs");
const CHECKPOINT_VERSION = "fem-checkpoint-v6";
const SWEEP_MANIFEST_VERSION = "motor-fem-sweep-v3";
const RESULT_CONTRACT = "edwin-gray-browser-result";
const RESULT_CONTRACT_VERSION = 1;
const SOLVER_OUTPUTS = ["observables.dat", "coenergy.dat", "inductance.dat"];
const SOLVER_CONVERGENCE = "solver-convergence.json";
const RESULT_OBSERVABLES = ["magneticEnergyJ", "coEnergyJ", "inductanceH"];
const MESH_QUALITY_FAILURES = [
  "No elements in volume",
  "WARNING: Intersecting elements",
  "ill-shaped tets are still",
  "nodes not connected to any 3D elements"
];

function parseArgs(argv) {
  const options = { backend: "auto" };
  const flags = new Set(["validate", "dry-run", "sweep", "resume", "aggregate", "publication", "help"]);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    if (flags.has(key)) {
      options[key] = true;
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

function usage() {
  return [
    "Usage: node scripts/run.mjs [options]",
    "",
    "Modes:",
    "  --validate                         Validate local JSON and static FEM contracts",
    "  --dry-run                          Print backend and command plan without running solvers",
    "  --sweep --manifest PATH            Write a finite pending full 3D sweep manifest",
    "  --resume [--manifest PATH]         Run or resume one job, or jobs from a manifest",
    "  --aggregate --manifest PATH        Combine completed angle results into one browser LUT",
    "",
    "Backend and paths:",
    "  --backend auto|host|docker         Host is probed before Docker in auto mode",
    "  --gmsh-bin PATH                    Override host Gmsh executable",
    "  --getdp-bin PATH                   Override host GetDP executable",
    "  --docker-bin PATH                  Override Docker executable",
    "  --docker-image IMAGE               Enable the optional Docker backend",
    "  --publication                      Require a resolved immutable Docker image digest",
    "  --solver-profile NAME              PETSc profile (required for publication)",
    "  --solver-config PATH               Versioned PETSc profile configuration",
    "  --memory-gib GIB                   Docker hard memory/swap limit (default: 24)",
    "  --cpus COUNT                       Docker CPU quota (default: thread count)",
    "  --threads COUNT                    GetDP solver thread count (default: 2 for Docker)",
    "  --mesh-threads COUNT               Gmsh thread count (default: --threads)",
    "  --case PATH                        Case JSON path",
    "  --geo PATH                         Gmsh geometry path",
    "  --pro PATH                         GetDP problem path",
    "  --event-index INDEX                Excitation event for a single run (default: case value)",
    "  --rotor-angle DEG                 Rotor angle for a single run (default: case value)",
    "  --mesh-size METERS                Mesh size for a single run (default: case value)",
    "  --drive-current AMPS              Drive current for a single run (default: case value)",
    "  --reuse-mesh-checkpoint PATH      Reuse an attested mesh from an otherwise identical job",
    "  --mesh-audit PATH                  Override the quantitative mesh-audit script",
    "  --manifest PATH                    Input/output sweep manifest",
    "  --run-dir PATH                    Content-addressed run root",
    "",
    "Validation, dry-run, and sweep modes never create numerical values. A real",
    "run fails explicitly when the required Gmsh/GetDP executables are unavailable."
  ].join("\n");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(path, label) {
  assert(existsSync(path), `${label} does not exist: ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON in ${label}: ${error.message}`);
  }
}

function schemaRef(rootSchema, reference) {
  assert(reference.startsWith("#/$defs/"), `Unsupported schema reference: ${reference}`);
  const definition = reference.slice("#/$defs/".length);
  assert(rootSchema.$defs?.[definition], `Missing schema definition: ${definition}`);
  return rootSchema.$defs[definition];
}

function validateSchemaValue(value, schema, path, rootSchema) {
  if (schema.$ref) {
    validateSchemaValue(value, schemaRef(rootSchema, schema.$ref), path, rootSchema);
    return;
  }
  if (schema.const !== undefined) {
    assert(stableJson(value) === stableJson(schema.const), `${path} must equal ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum) {
    assert(schema.enum.some((allowed) => stableJson(value) === stableJson(allowed)), `${path} has an unsupported value`);
  }
  if (schema.type === "object") {
    assert(value && typeof value === "object" && !Array.isArray(value), `${path} must be an object`);
    if (schema.required) {
      for (const key of schema.required) {
        assert(Object.prototype.hasOwnProperty.call(value, key), `${path}.${key} is required by the schema`);
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(value)) {
        assert(Object.prototype.hasOwnProperty.call(schema.properties, key), `${path}.${key} is not allowed by the schema`);
      }
    }
    for (const [key, propertySchema] of Object.entries(schema.properties || {})) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        validateSchemaValue(value[key], propertySchema, `${path}.${key}`, rootSchema);
      }
    }
    if (schema.minProperties !== undefined) {
      assert(Object.keys(value).length >= schema.minProperties, `${path} must have at least ${schema.minProperties} properties`);
    }
  } else if (schema.type === "array") {
    assert(Array.isArray(value), `${path} must be an array`);
    if (schema.minItems !== undefined) {
      assert(value.length >= schema.minItems, `${path} must contain at least ${schema.minItems} items`);
    }
    if (schema.uniqueItems) {
      assert(new Set(value.map(stableJson)).size === value.length, `${path} must contain unique items`);
    }
    value.forEach((item, index) => validateSchemaValue(item, schema.items, `${path}[${index}]`, rootSchema));
  } else if (schema.type === "string") {
    assert(typeof value === "string", `${path} must be a string`);
    if (schema.minLength !== undefined) {
      assert(value.length >= schema.minLength, `${path} must not be empty`);
    }
    if (schema.pattern) {
      assert(new RegExp(schema.pattern).test(value), `${path} has an invalid format`);
    }
    if (schema.format === "date") {
      assert(/^\d{4}-\d{2}-\d{2}$/.test(value), `${path} must be an ISO date`);
    }
    if (schema.format === "uri") {
      assert(/^[a-z][a-z\d+.-]*:\/\//i.test(value), `${path} must be a URI`);
    }
  } else if (schema.type === "number" || schema.type === "integer") {
    assert(typeof value === "number" && Number.isFinite(value), `${path} must be a finite number`);
    if (schema.type === "integer") {
      assert(Number.isInteger(value), `${path} must be an integer`);
    }
    if (schema.minimum !== undefined) {
      assert(value >= schema.minimum, `${path} must be >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined) {
      assert(value <= schema.maximum, `${path} must be <= ${schema.maximum}`);
    }
    if (schema.exclusiveMinimum !== undefined) {
      assert(value > schema.exclusiveMinimum, `${path} must be > ${schema.exclusiveMinimum}`);
    }
    if (schema.exclusiveMaximum !== undefined) {
      assert(value < schema.exclusiveMaximum, `${path} must be < ${schema.exclusiveMaximum}`);
    }
  } else if (schema.type === "boolean") {
    assert(typeof value === "boolean", `${path} must be a boolean`);
  }
  for (const condition of schema.allOf || []) {
    if (condition.if && matchesSchema(value, condition.if, rootSchema)) {
      validateSchemaValue(value, condition.then || {}, path, rootSchema);
    } else if (condition.else && !matchesSchema(value, condition.if, rootSchema)) {
      validateSchemaValue(value, condition.else, path, rootSchema);
    }
  }
}

function matchesSchema(value, schema, rootSchema) {
  try {
    validateSchemaValue(value, schema, "value", rootSchema);
    return true;
  } catch {
    return false;
  }
}

function validateLutResultSchema(result, schema) {
  assert(result.contract === schema.properties.contract.const, "normalized result contract is invalid");
  assert(result.contractVersion === schema.properties.contractVersion.const, "normalized result contract version is invalid");
  assert(result.lutContract === schema.properties.lutContract.const, "normalized LUT contract is invalid");
  assert(result.status === "complete" && result.entries.length > 0, "normalized result must contain complete entries");
  for (const entry of result.entries) {
    assert(entry.status === "complete", "normalized solver entries must be complete");
    assert(entry.provenance.synthetic === false, "normalized solver output must not be synthetic");
    assert(entry.provenance.backend && entry.provenance.symmetryApplied !== undefined, "normalized provenance is incomplete");
    for (const observable of RESULT_OBSERVABLES) {
      assert(Number.isFinite(entry.observables[observable]?.value), `${observable} is missing from normalized output`);
    }
  }
}

function validateNormalizedProvenance(result, job) {
  assert(result.entries.length === 1, "normalized solver result must contain exactly one job entry");
  const entry = result.entries[0];
  assert(entry.provenance.modelInputHash === job.modelInputHash, "normalized result model input hash does not match the job");
  assert(entry.provenance.jobInputHash === job.hash, "normalized result job input hash does not match the job");
  assert(entry.provenance.solver === "getdp", "normalized result solver is invalid");
  assert(entry.provenance.backend === job.plan.kind, "normalized result backend does not match the job");
  assert(entry.parameters && stableJson(entry.parameters) === stableJson(job.parameters), "normalized result parameters do not match the job");
  const expectedArtifacts = [
    job.meshPath,
    job.auditPath,
    join(job.jobDir, "getdp.log"),
    join(job.jobDir, SOLVER_CONVERGENCE),
    ...commandOutputs(job)
  ].map((path) => relative(job.jobDir, path));
  assert(Array.isArray(entry.provenance.artifacts), "normalized result artifact provenance is missing");
  assert(stableJson(entry.provenance.artifacts.map((artifact) => artifact.path).sort()) === stableJson(expectedArtifacts.sort()), "normalized result artifact paths do not match the job");
  for (const artifact of entry.provenance.artifacts) {
    const path = resolve(job.jobDir, artifact.path);
    assert(pathWithin(path, job.jobDir), `normalized result artifact escapes the job directory: ${artifact.path}`);
    assert(artifactMatches(path, artifact.sha256), `normalized result artifact hash is invalid: ${artifact.path}`);
  }
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256File(path) {
  assert(existsSync(path), `Input file does not exist: ${path}`);
  return sha256Bytes(readFileSync(path));
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

function writeAtomic(path, value) {
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, `${typeof value === "string" ? value : JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporary, path);
}

function isExecutable(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findExecutable(explicit, name) {
  if (explicit) {
    const candidate = resolve(explicit);
    return isExecutable(candidate) ? candidate : null;
  }
  const pathValue = process.env.PATH || "";
  for (const directory of pathValue.split(delimiter)) {
    if (!directory) {
      continue;
    }
    const candidate = join(directory, name);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }
  return null;
}

function detectHost(options) {
  return {
    gmsh: findExecutable(options["gmsh-bin"], "gmsh"),
    getdp: findExecutable(options["getdp-bin"], "getdp")
  };
}

function detectDocker(options) {
  return findExecutable(options["docker-bin"], "docker");
}

function probeDockerTools(docker, image) {
  for (const command of ["gmsh", "getdp"]) {
    const result = spawnSync(docker, [
      "run",
      "--rm",
      "--entrypoint",
      command,
      image,
      "--version"
    ], { encoding: "utf8" });
    if (result.error) {
      return { available: false, reason: `Docker ${command} probe failed to start: ${result.error.message}` };
    }
    if (result.status !== 0) {
      return { available: false, reason: `Docker image does not provide ${command}: ${image}` };
    }
  }
  return { available: true, reason: null };
}

function validateNumber(value, path, { minimum, exclusiveMinimum, exclusiveMaximum } = {}) {
  assert(typeof value === "number" && Number.isFinite(value), `${path} must be a finite number`);
  if (minimum !== undefined) {
    assert(value >= minimum, `${path} must be >= ${minimum}`);
  }
  if (exclusiveMinimum !== undefined) {
    assert(value > exclusiveMinimum, `${path} must be > ${exclusiveMinimum}`);
  }
  if (exclusiveMaximum !== undefined) {
    assert(value < exclusiveMaximum, `${path} must be < ${exclusiveMaximum}`);
  }
}

function validateArray(values, path, options) {
  assert(Array.isArray(values) && values.length > 0, `${path} must be a non-empty array`);
  values.forEach((value, index) => validateNumber(value, `${path}[${index}]`, options));
}

function validateCase(caseData, geometryText, getdpText, schemaData, lutSchemaData) {
  assert(caseData.schemaVersion === "motor-case-v1", "Unsupported case schemaVersion");
  assert(caseData.caseId === "patent-3890548-illustrative", "Unexpected caseId");
  assert(caseData.source?.patent?.publicationNumber === "US3890548A", "US3890548A source is required");
  assert(caseData.model?.domain === "full-3d", "Case must be full 3D");
  assert(caseData.model?.physics === "magnetostatic-linear", "Case physics must be magnetostatic-linear");
  assert(caseData.model?.solverNeutral === true, "Case must be solver neutral");
  const layout = caseData.model.rotorStatorLayout;
  assert(layout.statorPairStations === 9, "Case must have 9 stator pair stations");
  assert(layout.rotorPairStations === 3, "Case must have 3 rotor pair stations");
  assert(layout.statorAngularPitchDeg === 40, "Case stator pitch must be 40 degrees");
  assert(layout.rotorAngularPitchDeg === 120, "Case rotor pitch must be 120 degrees");
  assert(layout.expectedAssemblyPhysicalGroups === 48, "Case must expect 48 assembly physical groups");
  assert(caseData.model.sequence.dischargesPerRevolution === 27, "Case must declare 27 discharges per revolution");
  validateNumber(caseData.model.sequence.dischargeStepDeg, "model.sequence.dischargeStepDeg", { exclusiveMinimum: 0 });

  const geometry = caseData.geometry;
  assert(geometry.units === "m" && geometry.axis === "z", "Geometry must use meters and z axis");
  validateNumber(geometry.rotorAngleDeg, "geometry.rotorAngleDeg", { minimum: 0, exclusiveMaximum: 360 });
  validateNumber(geometry.pairOffsetDeg, "geometry.pairOffsetDeg", { exclusiveMinimum: 0, exclusiveMaximum: 40 });
  validateNumber(geometry.airZMinM, "geometry.airZMinM");
  validateNumber(geometry.airZMaxM, "geometry.airZMaxM");
  validateNumber(geometry.frontPlaneZM, "geometry.frontPlaneZM");
  validateNumber(geometry.backPlaneZM, "geometry.backPlaneZM");
  for (const [key, value] of Object.entries(geometry)) {
    if (key.endsWith("M") && !["airZMinM", "airZMaxM", "frontPlaneZM", "backPlaneZM"].includes(key)) {
      validateNumber(value, `geometry.${key}`, { exclusiveMinimum: 0 });
    }
  }
  validateArray(caseData.sweep.anglesDeg, "sweep.anglesDeg", { minimum: 0, exclusiveMaximum: 360 });
  assert(Array.isArray(caseData.sweep.eventIndices), "sweep.eventIndices must be an array");
  assert(caseData.sweep.eventIndices.length === caseData.sweep.anglesDeg.length, "sweep.eventIndices must pair exactly with sweep.anglesDeg");
  assert(new Set(caseData.sweep.eventIndices).size === caseData.sweep.eventIndices.length, "sweep.eventIndices must be unique");
  caseData.sweep.eventIndices.forEach((value, index) => assert(Number.isInteger(value) && value >= 0 && value <= 26, `sweep.eventIndices[${index}] must be in [0, 26]`));
  validateArray(caseData.sweep.meshSizesM, "sweep.meshSizesM", { exclusiveMinimum: 0 });
  validateArray(caseData.sweep.driveCurrentA, "sweep.driveCurrentA", { exclusiveMinimum: 0 });
  const symmetry = caseData.sweep.symmetry;
  assert(typeof symmetry.declared === "boolean", "sweep.symmetry.declared must be boolean");
  assert(Number.isInteger(symmetry.order) && symmetry.order >= 1, "sweep.symmetry.order must be a positive integer");
  assert(!symmetry.declared || symmetry.order >= 2, "Declared exact symmetry must have order >= 2");
  assert(symmetry.axis === "z", "Only z-axis symmetry is supported");
  assert(typeof symmetry.justification === "string" && symmetry.justification.trim().length > 0, "Symmetry justification is required");
  assert(caseData.results.contract === RESULT_CONTRACT && caseData.results.contractVersion === RESULT_CONTRACT_VERSION, "Result contract must be version 1");
  assert(stableJson(caseData.results.observables) === stableJson(RESULT_OBSERVABLES), "Case observables must match the normalized result contract");
  assert(caseData.results.noSyntheticOutput === true, "Synthetic output must be disabled");
  assert(caseData.excitation.contract === "edwin-gray-fem-excitation-event-map/v1", "Excitation contract is invalid");
  assert(Number.isInteger(caseData.excitation.eventIndex) && caseData.excitation.eventIndex >= 0 && caseData.excitation.eventIndex <= 26, "Excitation event index is invalid");
  assert(caseData.excitation.currentPotentialThicknessM === geometry.coilRadialDepthM, "Current-potential thickness must equal the coil radial depth");
  assert(caseData.provenance.ledgerVersion === "source-ledger-v1", "Provenance ledger must be version 1");
  assert(Array.isArray(caseData.provenance.fieldEntries) && caseData.provenance.fieldEntries.length > 0, "Provenance entries are required");
  for (const entry of caseData.provenance.fieldEntries) {
    assert(typeof entry.path === "string" && entry.path.length > 0, "Every provenance path is required");
    assert(Array.isArray(entry.evidenceRefs) && entry.evidenceRefs.length > 0, `Evidence is required for ${entry.path}`);
    assert(typeof entry.note === "string" && entry.note.length > 0, `Provenance note is required for ${entry.path}`);
  }

  assert(schemaData.$schema && schemaData.$id, "Case schema metadata is incomplete");
  assert(lutSchemaData.$schema && lutSchemaData.$id, "Result schema metadata is incomplete");
  assert(/For station In \{0:8\}/.test(geometryText), "Geometry must define nine stator stations");
  assert(/For station In \{0:2\}/.test(geometryText), "Geometry must define three rotor stations");
  assert(geometryText.includes("Physical Volume(StrCat(Sprintf(\"Stator_"), "Geometry must define the stator assembly group loop");
  assert(geometryText.includes("Physical Volume(StrCat(Sprintf(\"Rotor_"), "Geometry must define the rotor assembly group loop");
  assert(geometryText.includes("Volume In BoundingBox"), "Geometry must rebuild groups from post-boolean fragments");
  assert(geometryText.includes("Mesh.Algorithm3D = 1"), "Geometry must use the pinned-build-compatible 3D mesher");
  assert(geometryText.includes("Physical Volume(\"AllCores\""), "Geometry must define AllCores");
  assert(geometryText.includes("Physical Volume(\"AllCoils\""), "Geometry must define AllCoils");
  assert(geometryText.includes("2101 + index") && geometryText.includes("2201 + index"), "Geometry must define explicit coil-only event regions");
  assert(geometryText.includes(`CoilRadialMarginM = DefineNumber[${geometry.coilRadialMarginM},`), "Geometry default coil radial margin must match the case");
  assert(getdpText.includes("Type Form1"), "GetDP artifact must use an H(curl) edge space");
  assert(getdpText.includes("Magnetostatics3D"), "GetDP magnetostatic formulation is missing");
  assert(getdpText.includes("MagneticEnergyJ"), "GetDP energy postprocessing is missing");
  assert(getdpText.includes("InductanceH"), "GetDP inductance postprocessing is missing");
  assert(getdpText.includes("J = Curl T") && getdpText.includes("{Curl a}"), "GetDP must use the closed equivalent current-potential source");
  assert(!getdpText.includes("SourceCurrentDensity"), "GetDP must not retain disconnected volume-current sources");
  assert(!getdpText.includes("radiant") && !getdpText.includes("Radiant"), "GetDP must not include a non-Maxwell force term");
}

function loadInputs(options) {
  const casePath = resolve(options.case || DEFAULT_CASE);
  const geoPath = resolve(options.geo || DEFAULT_GEO);
  const proPath = resolve(options.pro || DEFAULT_PRO);
  const schemaPath = resolve(ROOT, "schema/motor-case.schema.json");
  const lutSchemaPath = resolve(ROOT, "schema/motor-fem-lut.schema.json");
  const eventMapPath = DEFAULT_EVENT_MAP;
  const eventSelectorPath = DEFAULT_EVENT_SELECTOR;
  const meshAuditPath = resolve(options["mesh-audit"] || DEFAULT_MESH_AUDIT);
  const solverConfigPath = resolve(options["solver-config"] || DEFAULT_SOLVER_CONFIG);
  const caseData = readJson(casePath, "case");
  const geometryText = readFileSync(geoPath, "utf8");
  const getdpText = readFileSync(proPath, "utf8");
  const schemaData = readJson(schemaPath, "case schema");
  const lutSchemaData = readJson(lutSchemaPath, "result schema");
  const eventMapData = readJson(eventMapPath, "excitation event map");
  const solverConfigData = readJson(solverConfigPath, "PETSc solver configuration");
  assert(solverConfigData.schemaVersion === "edwin-gray-petsc-solver-profiles-v1", "Unsupported PETSc solver configuration");
  assert(solverConfigData.profiles?.[solverConfigData.defaultProfile], "Default PETSc solver profile is missing");
  assert(eventMapData.contractVersion === caseData.excitation.contract, "Case excitation contract does not match the event map");
  assert(eventMapData.eventCount === 27 && eventMapData.events?.length === 27, "Excitation event map must define 27 events");
  assert(existsSync(eventSelectorPath), `Excitation selector does not exist: ${eventSelectorPath}`);
  assert(existsSync(meshAuditPath), `Mesh audit does not exist: ${meshAuditPath}`);
  validateCase(caseData, geometryText, getdpText, schemaData, lutSchemaData);
  return { casePath, geoPath, proPath, schemaPath, lutSchemaPath, eventMapPath, eventSelectorPath, meshAuditPath, solverConfigPath, solverConfigData, caseData, geometryText, getdpText, schemaData, lutSchemaData, eventMapData };
}

function canonicalAngle(angle, order) {
  const period = 360 / order;
  const reduced = ((angle % period) + period) % period;
  return Number(reduced.toFixed(10));
}

function buildSweep(caseData, baseHash) {
  const symmetry = caseData.sweep.symmetry;
  const seenAngles = new Set();
  const angles = [];
  for (let index = 0; index < caseData.sweep.anglesDeg.length; index += 1) {
    const angle = caseData.sweep.anglesDeg[index];
    const eventIndex = caseData.sweep.eventIndices[index];
    const canonical = symmetry.declared ? canonicalAngle(angle, symmetry.order) : angle;
    const key = canonical.toFixed(10);
    if (!seenAngles.has(key)) {
      seenAngles.add(key);
      angles.push({ rotorAngleDeg: canonical, eventIndex });
    }
  }
  const jobs = [];
  for (const { rotorAngleDeg, eventIndex } of angles) {
    for (const meshSizeM of caseData.sweep.meshSizesM) {
      for (const driveCurrentA of caseData.sweep.driveCurrentA) {
        const parameters = { rotorAngleDeg, eventIndex, excitationContract: caseData.excitation.contract, meshSizeM, driveCurrentA };
        const jobId = sha256Bytes(Buffer.from(stableJson({ inputHash: baseHash, parameters }))).slice(0, 24);
        jobs.push({
          jobId,
          status: "pending",
          parameters,
          symmetryApplied: symmetry.declared,
          result: null
        });
      }
    }
  }
  return {
    manifestVersion: SWEEP_MANIFEST_VERSION,
    caseId: caseData.caseId,
    inputHash: baseHash,
    domain: "full-3d",
    noSyntheticOutput: true,
    status: "pending",
    resultContract: {
      contract: RESULT_CONTRACT,
      contractVersion: RESULT_CONTRACT_VERSION,
      lutContract: "motor-fem-lut-v1"
    },
    symmetry: {
      declared: symmetry.declared,
      order: symmetry.order,
      axis: symmetry.axis,
      applied: symmetry.declared,
      justification: symmetry.justification
    },
    jobs
  };
}

function inputHash(inputs, caseData, parameters, environmentIdentityHash) {
  const baseHash = baseInputHash(inputs, caseData);
  return sha256Bytes(Buffer.from(stableJson({ baseHash, environmentIdentityHash, parameters })));
}

function baseInputHash(inputs, caseData) {
  const payload = {
    case: sha256Bytes(Buffer.from(stableJson(caseData))),
    geometry: sha256File(inputs.geoPath),
    getdp: sha256File(inputs.proPath),
    schema: sha256File(inputs.schemaPath),
    resultSchema: sha256File(inputs.lutSchemaPath),
    excitationEventMap: sha256File(inputs.eventMapPath),
    excitationSelector: sha256File(inputs.eventSelectorPath),
    meshAudit: sha256File(inputs.meshAuditPath),
    normalizer: sha256File(NORMALIZE_SCRIPT),
    eventMapSymmetryProof: sha256File(SYMMETRY_SCRIPT),
    caseId: caseData.caseId
  };
  return sha256Bytes(Buffer.from(stableJson(payload)));
}

function gmshOverrides(parameters, caseData) {
  const g = caseData.geometry;
  return [
    ["Parameters/Mesh size (m)", parameters.meshSizeM],
    ["Parameters/Rotor angle (deg)", parameters.rotorAngleDeg],
    ["Parameters/Excitation event index", parameters.eventIndex],
    ["Parameters/Major-minor offset (deg)", g.pairOffsetDeg],
    ["Parameters/Stator phase (deg)", g.statorPhaseDeg],
    ["Parameters/Rotor phase (deg)", g.rotorPhaseDeg],
    ["Parameters/Air outer radius (m)", g.airOuterRadiusM],
    ["Parameters/Air z minimum (m)", g.airZMinM],
    ["Parameters/Air z maximum (m)", g.airZMaxM],
    ["Parameters/Front plane z (m)", g.frontPlaneZM],
    ["Parameters/Back plane z (m)", g.backPlaneZM],
    ["Parameters/Rotor core inner radius (m)", g.rotorCoreInnerRadiusM],
    ["Parameters/Rotor core radial depth (m)", g.rotorCoreRadialDepthM],
    ["Parameters/Stator core inner radius (m)", g.statorCoreInnerRadiusM],
    ["Parameters/Stator core radial depth (m)", g.statorCoreRadialDepthM],
    ["Parameters/Coil radial depth (m)", g.coilRadialDepthM],
    ["Parameters/Coil radial margin (m)", g.coilRadialMarginM],
    ["Parameters/Minor tangential width (m)", g.minorTangentialWidthM],
    ["Parameters/Major tangential width (m)", g.majorTangentialWidthM],
    ["Parameters/Rotor minor tangential width (m)", g.rotorMinorTangentialWidthM],
    ["Parameters/Rotor major tangential width (m)", g.rotorMajorTangentialWidthM],
    ["Parameters/Electromagnet axial length (m)", g.electromagnetAxialLengthM],
    ["Parameters/Coil tangential margin (m)", g.coilTangentialMarginM],
    ["Parameters/Rotor coil tangential margin (m)", g.rotorCoilTangentialMarginM],
    ["Parameters/Coil axial margin (m)", g.coilAxialMarginM]
  ];
}

function getdpOverrides(parameters, caseData) {
  return [
    ["CoreRelativePermeability", caseData.materials.core.relativePermeability],
    ["DriveCurrentA", parameters.driveCurrentA],
    ["Turns", caseData.excitation.turns],
    ["CoilRadialDepthM", caseData.excitation.currentPotentialThicknessM],
    ["EventIndex", parameters.eventIndex]
  ];
}

function parameterWrapper(source, overrides) {
  return `${overrides.map(([name, value]) => `SetNumber(${JSON.stringify(name)}, ${value});`).join("\n")}\nInclude ${JSON.stringify(source)};`;
}

function problemWrapper(source, overrides) {
  return `${overrides.map(([name, value]) => `${name} = ${value};`).join("\n")}\nInclude ${JSON.stringify(source)};`;
}

function backendPlan(options, host, { allowUnavailable = false } = {}) {
  const requested = options.backend || "auto";
  const docker = detectDocker(options);
  const hostAvailable = Boolean(host.gmsh && host.getdp);
  if (requested === "host") {
    if (!hostAvailable) {
      if (allowUnavailable) {
        return {
          kind: "unavailable",
          reason: `Host backend is missing: ${[
            !host.gmsh && "gmsh",
            !host.getdp && "getdp"
          ].filter(Boolean).join(", ")}`,
          gmsh: host.gmsh || "gmsh",
          getdp: host.getdp || "getdp",
          docker: null
        };
      }
      throw new Error(`Host backend requested but required executables are missing: ${[
        !host.gmsh && "gmsh",
        !host.getdp && "getdp"
      ].filter(Boolean).join(", ")}`);
    }
    return { kind: "host", gmsh: host.gmsh, getdp: host.getdp, docker: null };
  }
  if (requested === "docker") {
    if (!docker || !options["docker-image"]) {
      if (allowUnavailable) {
        return {
          kind: "unavailable",
          reason: !docker ? "Docker executable is missing" : "--docker-image is required",
          gmsh: "gmsh",
          getdp: "getdp",
          docker: docker || null,
          image: options["docker-image"] || null
        };
      }
      assert(docker, "Docker backend requested but docker executable is missing");
      assert(options["docker-image"], "Docker backend requires --docker-image");
    }
    const tools = probeDockerTools(docker, options["docker-image"]);
    if (!tools.available) {
      if (allowUnavailable) {
        return {
          kind: "unavailable",
          reason: tools.reason,
          gmsh: "gmsh",
          getdp: "getdp",
          docker,
          image: options["docker-image"]
        };
      }
      throw new Error(tools.reason);
    }
    return { kind: "docker", gmsh: "gmsh", getdp: "getdp", docker, image: options["docker-image"] };
  }
  assert(requested === "auto", `Unsupported backend: ${requested}`);
  if (hostAvailable) {
    return { kind: "host", gmsh: host.gmsh, getdp: host.getdp, docker: null };
  }
  if (options["docker-image"] && docker) {
    const tools = probeDockerTools(docker, options["docker-image"]);
    if (!tools.available) {
      if (allowUnavailable) {
        return {
          kind: "unavailable",
          reason: tools.reason,
          gmsh: host.gmsh || "gmsh",
          getdp: host.getdp || "getdp",
          docker,
          image: options["docker-image"]
        };
      }
      throw new Error(tools.reason);
    }
    return { kind: "docker", gmsh: "gmsh", getdp: "getdp", docker, image: options["docker-image"] };
  }
  if (allowUnavailable) {
    const missing = [!host.gmsh && "gmsh", !host.getdp && "getdp"].filter(Boolean).join(", ");
    return {
      kind: "unavailable",
      reason: `Host is missing ${missing}; no Docker image was supplied`,
      gmsh: host.gmsh || "gmsh",
      getdp: host.getdp || "getdp",
      docker: docker || null,
      image: null
    };
  }
  const missing = [!host.gmsh && "gmsh", !host.getdp && "getdp"].filter(Boolean).join(", ");
  throw new Error(`No solver backend available: host is missing ${missing}; provide --docker-image IMAGE and a working Docker executable for the optional fallback`);
}

function positiveInteger(value, label) {
  const parsed = Number(value);
  assert(Number.isInteger(parsed) && parsed > 0, `${label} must be a positive integer`);
  return parsed;
}

function positiveNumber(value, label) {
  const parsed = Number(value);
  assert(Number.isFinite(parsed) && parsed > 0, `${label} must be finite and positive`);
  return parsed;
}

function solverProfile(inputs, options) {
  if (options.publication) {
    assert(options["solver-profile"], "Publication requires an explicit --solver-profile");
  }
  const name = options["solver-profile"] || inputs.solverConfigData.defaultProfile;
  const profile = inputs.solverConfigData.profiles[name];
  assert(profile, `Unknown PETSc solver profile: ${name}`);
  assert(["iterative", "direct"].includes(profile.mode), `Solver profile ${name} has an invalid mode`);
  assert(Array.isArray(profile.petscOptions) && profile.petscOptions.length > 0, `Solver profile ${name} has no PETSc options`);
  if (options.publication) {
    assert(profile.mode === "direct" && profile.publicationAllowed === true, "Publication requires a publication-eligible direct solver profile");
  }
  return {
    configSchemaVersion: inputs.solverConfigData.schemaVersion,
    configSha256: sha256File(inputs.solverConfigPath),
    name,
    ...profile
  };
}

function runnerRevision() {
  if (process.env.SOLVER_RUNNER_REVISION) {
    return process.env.SOLVER_RUNNER_REVISION;
  }
  const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: ROOT, encoding: "utf8" });
  if (top.status !== 0) return "unknown";
  const repositoryRoot = top.stdout.trim();
  const treePath = relative(repositoryRoot, ROOT);
  const result = spawnSync("git", ["rev-parse", `HEAD:${treePath}`], { cwd: repositoryRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function identifyBackend(plan, options, inputs) {
  const solverThreads = positiveInteger(options.threads || process.env.SOLVER_THREADS || (plan.kind === "docker" ? "2" : "1"), "--threads");
  const meshThreads = positiveInteger(options["mesh-threads"] || solverThreads, "--mesh-threads");
  const cpus = positiveNumber(options.cpus || solverThreads, "--cpus");
  const memoryGiB = plan.kind === "docker" ? positiveNumber(options["memory-gib"] || "24", "--memory-gib") : null;
  const solver = solverProfile(inputs, options);
  const commandPlan = {
    mesh: ["gmsh", "{geometry}", "-3", "-nt", String(meshThreads), "-format", "msh4", "-o", "{mesh}"],
    solve: ["getdp", "{problem}", "-nt", String(solverThreads), "-name", "{solution}", "-msh", "{mesh}", "-solve", "Magnetostatics3D", "-pos", "MagnetostaticResults", ...solver.petscOptions]
  };
  if (options.publication) {
    assert(plan.kind === "docker", "Publication requires the memory-bounded Docker backend");
    assert(options["memory-gib"] && options.cpus && options.threads && options["mesh-threads"],
      "Publication requires explicit --memory-gib, --cpus, --threads, and --mesh-threads limits");
    assert(memoryGiB === solver.requiredMemoryGiB && memoryGiB === 24, "Publication Docker memory must be exactly 24 GiB");
    assert(cpus === solver.requiredCpus && solverThreads === solver.requiredThreads && cpus === 2 && solverThreads === 2,
      "Publication CPU and solver thread limits must be exactly 2");
    assert(meshThreads === 1, "Publication mesh thread limit must be exactly 1");
  }
  const resources = { memoryGiB, cpus, memorySwapGiB: memoryGiB, meshThreads, solverThreads };
  const runner = runnerIdentity({
    revision: runnerRevision(),
    runScript: RUN_SCRIPT,
    environmentModule: ENVIRONMENT_MODULE,
    solverConfig: inputs.solverConfigPath
  });
  if (plan.kind === "host") {
    return {
      ...plan,
      meshThreads,
      solverThreads,
      cpus,
      memoryGiB,
      solver,
      environment: identifyHostEnvironment({ gmsh: plan.gmsh, getdp: plan.getdp, solver, resources, commandPlan, runner })
    };
  }
  if (plan.kind === "docker") {
    const image = resolveDockerImageReference(plan.docker, plan.image, { publication: options.publication === true });
    return {
      ...plan,
      image: image.image,
      requestedImage: image.requestedImage,
      imageDigest: image.digest,
      meshThreads,
      solverThreads,
      cpus,
      memoryGiB,
      solver,
      environment: identifyDockerEnvironment({ image, solver, resources, commandPlan, runner })
    };
  }
  return {
    ...plan,
    meshThreads,
    solverThreads,
    cpus,
    memoryGiB,
    solver,
    environment: identifyUnavailableEnvironment({ reason: plan.reason, solver, resources, commandPlan, runner })
  };
}

function pathWithin(path, root) {
  const resolvedPath = resolve(path);
  const resolvedRoot = resolve(root);
  return resolvedPath === resolvedRoot || resolvedPath.startsWith(`${resolvedRoot}/`);
}

function dockerPath(path, root, runRoot) {
  if (runRoot && pathWithin(path, runRoot)) {
    return `/output/${relative(runRoot, path)}`;
  }
  assert(pathWithin(path, root), `Docker path is outside the mounted workspace: ${path}`);
  return `/workspace/${relative(root, path)}`;
}

function dockerCommand(plan, root, cwd, command, args, runRoot, threadCount) {
  const mountCwd = "/workspace";
  const translatedArgs = args.map((arg) => {
    if (typeof arg !== "string") {
      return arg;
    }
    if (isAbsolute(arg)) {
      return dockerPath(arg, root, runRoot);
    }
    return arg;
  });
  return [
    plan.docker,
    "run",
    "--rm",
    "--memory",
    `${plan.memoryGiB}g`,
    "--memory-swap",
    `${plan.memoryGiB}g`,
    "--cpus",
    String(plan.cpus),
    "--user",
    `${process.getuid()}:${process.getgid()}`,
    "--read-only",
    "--network",
    "none",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=64m",
    "-v",
    `${root}:${mountCwd}:ro`,
    "-v",
    `${runRoot}:/output:rw`,
    "-e",
    `OMP_NUM_THREADS=${threadCount}`,
    "-e",
    `SOLVER_IMAGE_REFERENCE=${plan.image}`,
    "-e",
    `SOLVER_RUNNER_REVISION=${plan.environment.identity.runner.revision}`,
    "-e",
    `SOLVER_SOURCE_REVISION=${plan.environment.identity.runner.runScriptSha256}`,
    "-w",
    dockerPath(cwd, root, runRoot),
    plan.image,
    command,
    ...translatedArgs
  ];
}

function runCommand({ plan, root, cwd, command, args, logName, runRoot, commandLine }) {
  const threadCount = command === plan.gmsh ? plan.meshThreads : plan.solverThreads;
  const fullArgs = commandLine || (plan.kind === "docker" ? dockerCommand(plan, root, cwd, command, args, runRoot, threadCount) : [command, ...args]);
  const executable = fullArgs[0];
  const executableArgs = fullArgs.slice(1);
  const result = spawnSync(executable, executableArgs, {
    cwd,
    encoding: "utf8"
  });
  const logPath = logName.startsWith("/") ? logName : join(cwd, logName);
  mkdirSync(dirname(logPath), { recursive: true });
  writeFileSync(logPath, `${result.stdout || ""}${result.stderr || ""}`, "utf8");
  if (result.error) {
    throw new Error(`${command} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}; see ${logPath}`);
  }
  return { command: [executable, ...executableArgs], log: logPath };
}

function assertMeshQuality(logPath) {
  const log = readFileSync(logPath, "utf8");
  const findings = MESH_QUALITY_FAILURES.filter((pattern) => log.includes(pattern));
  assert(findings.length === 0, `Gmsh mesh-quality gate failed: ${findings.join(", ")}; see ${logPath}`);
}

function commandOutputs(job) {
  return SOLVER_OUTPUTS.map((name) => join(job.jobDir, name));
}

function outputsComplete(job) {
  return commandOutputs(job).every((path) => existsSync(path) && statSync(path).size > 0);
}

function artifactMatches(path, expectedHash) {
  return Boolean(expectedHash && existsSync(path) && sha256File(path) === expectedHash);
}

function meshCheckpointValid(job, checkpoint) {
  return checkpoint.phases.mesh === "complete"
    && checkpoint.meshQuality === "passed"
    && artifactMatches(job.meshPath, checkpoint.artifacts?.mesh)
    && artifactMatches(job.auditPath, checkpoint.artifacts?.audit)
    && artifactMatches(join(job.jobDir, "gmsh.log"), checkpoint.artifacts?.logs?.gmsh);
}

function solveCheckpointValid(job, checkpoint) {
  if (checkpoint.phases.solve !== "complete" || !outputsComplete(job)) {
    return false;
  }
  return artifactMatches(join(job.jobDir, "getdp.log"), checkpoint.artifacts?.logs?.getdp)
    && artifactMatches(join(job.jobDir, SOLVER_CONVERGENCE), checkpoint.artifacts?.convergence)
    && commandOutputs(job).every((path) => artifactMatches(path, checkpoint.artifacts?.outputs?.[relative(job.jobDir, path)]));
}

function normalizeCheckpointValid(job, checkpoint) {
  if (checkpoint.phases.normalize !== "complete"
    || !artifactMatches(join(job.jobDir, "result.json"), checkpoint.artifacts?.result)) {
    return false;
  }
  try {
    const result = readJson(join(job.jobDir, "result.json"), "normalized FEM result");
    validateNormalizedProvenance(result, job);
    validateLutResultSchema(result, job.inputs.lutSchemaData);
    return true;
  } catch {
    return false;
  }
}

function checkpointMatches(checkpoint, job) {
  return checkpoint
    && checkpoint.checkpointVersion === CHECKPOINT_VERSION
    && checkpoint.inputHash === job.hash
    && checkpoint.modelInputHash === job.modelInputHash
    && checkpoint.jobInputHash === job.hash
    && checkpoint.jobId === job.jobId
    && checkpoint.solverEnvironment?.identityHash === job.plan.environment.identityHash
    && checkpoint.environmentIdentityHash === job.plan.environment.identityHash
    && artifactMatches(join(job.jobDir, "solver-environment.json"), checkpoint.artifacts?.environment)
    && stableJson(checkpoint.parameters) === stableJson(job.parameters)
    && checkpoint.excitationContract === job.parameters.excitationContract
    && checkpoint.eventIndex === job.parameters.eventIndex
    && checkpoint.backend === job.plan.kind
    && checkpoint.solverProfile?.configSha256 === job.plan.solver.configSha256
    && checkpoint.solverProfile?.name === job.plan.solver.name
    && stableJson(checkpoint.resourceLimits) === stableJson(job.plan.environment.identity.resources)
    && checkpoint.resultContract === `${RESULT_CONTRACT}@${RESULT_CONTRACT_VERSION}`
    && checkpoint.phases && typeof checkpoint.phases === "object"
    && checkpoint.artifacts && typeof checkpoint.artifacts === "object"
    && artifactMatches(job.geoWrapperPath, checkpoint.artifacts.inputs?.geometry)
    && artifactMatches(job.proWrapperPath, checkpoint.artifacts.inputs?.getdp)
    && checkpoint.artifacts.logs && typeof checkpoint.artifacts.logs === "object";
}

function resetPhase(checkpoint, phase) {
  const phases = Object.keys(checkpoint.phases);
  const start = phases.indexOf(phase);
  for (const name of phases.slice(start)) {
    checkpoint.phases[name] = "pending";
  }
  if (phase === "mesh") {
    checkpoint.meshQuality = null;
    checkpoint.artifacts.mesh = null;
    checkpoint.artifacts.audit = null;
    checkpoint.artifacts.logs.gmsh = null;
  }
  if (phase === "mesh" || phase === "solve") {
    checkpoint.artifacts.outputs = {};
    checkpoint.artifacts.logs.getdp = null;
    checkpoint.artifacts.convergence = null;
    checkpoint.solverConvergence = null;
  }
  checkpoint.artifacts.result = null;
  checkpoint.result = null;
}

function removePhaseArtifacts(job, phase) {
  if (phase === "mesh") {
    rmSync(job.meshPath, { force: true });
    rmSync(job.auditPath, { force: true });
    rmSync(join(job.jobDir, "gmsh.log"), { force: true });
  }
  if (phase === "mesh" || phase === "solve") {
    for (const path of commandOutputs(job)) {
      rmSync(path, { force: true });
    }
    rmSync(join(job.jobDir, "getdp.log"), { force: true });
    rmSync(join(job.jobDir, SOLVER_CONVERGENCE), { force: true });
  }
  rmSync(join(job.jobDir, "result.json"), { force: true });
}

function reuseMesh(job, checkpoint, sourceCheckpointPath, commands) {
  const sourcePath = resolve(sourceCheckpointPath);
  const sourceDir = dirname(sourcePath);
  const source = readJson(sourcePath, "reusable mesh checkpoint");
  const meshParameters = ({ rotorAngleDeg, eventIndex, excitationContract, meshSizeM }) => ({
    rotorAngleDeg,
    eventIndex,
    excitationContract,
    meshSizeM
  });
  assert(["fem-checkpoint-v5", CHECKPOINT_VERSION].includes(source.checkpointVersion), "Reusable mesh checkpoint version is invalid");
  assert(source.phases?.mesh === "complete" && source.meshQuality === "passed", "Reusable mesh checkpoint is incomplete");
  assert(source.artifacts?.inputs?.geometry === sha256File(job.geoWrapperPath), "Reusable mesh geometry input does not match the job");
  assert(source.backend === job.plan.kind, "Reusable mesh backend does not match the job");
  assert(source.solverEnvironment?.identity?.resources?.meshThreads === job.plan.meshThreads,
    "Reusable mesh thread count does not match the job");
  assert(stableJson(source.solverEnvironment?.identity?.commandPlan?.mesh) === stableJson(job.plan.environment.identity.commandPlan.mesh),
    "Reusable mesh command plan does not match the job");
  if (job.plan.kind === "docker") {
    assert(source.solverEnvironment?.identity?.image?.digest === job.plan.environment.identity.image.digest, "Reusable mesh Docker image does not match the job");
  } else {
    assert(stableJson(source.solverEnvironment?.identity?.tools) === stableJson(job.plan.environment.identity.tools), "Reusable mesh tool binaries do not match the job");
  }
  assert(stableJson(meshParameters(source.parameters || {})) === stableJson(meshParameters(job.parameters)), "Reusable mesh parameters do not match the job geometry");
  const sourceMesh = join(sourceDir, "motor.msh");
  const sourceLog = join(sourceDir, "gmsh.log");
  assert(artifactMatches(sourceMesh, source.artifacts?.mesh), "Reusable mesh artifact hash is invalid");
  assert(artifactMatches(join(sourceDir, "mesh-audit.json"), source.artifacts?.audit), "Reusable mesh audit hash is invalid");
  assert(artifactMatches(sourceLog, source.artifacts?.logs?.gmsh), "Reusable Gmsh log hash is invalid");
  copyFileSync(sourceMesh, job.meshPath);
  copyFileSync(sourceLog, join(job.jobDir, "gmsh.log"));
  assertMeshQuality(join(job.jobDir, "gmsh.log"));
  runCommand({
    plan: job.plan,
    root: ROOT,
    cwd: job.jobDir,
    command: process.execPath,
    args: commands.audit.slice(1),
    commandLine: commands.audit,
    logName: "mesh-audit.log",
    runRoot: job.runRoot
  });
  const audit = readJson(job.auditPath, "reused mesh audit");
  assert(audit.valid === true && audit.source?.meshSha256 === sha256File(job.meshPath), "Quantitative mesh audit rejected the reused mesh");
  checkpoint.phases.mesh = "complete";
  checkpoint.meshQuality = "passed";
  checkpoint.artifacts.mesh = sha256File(job.meshPath);
  checkpoint.artifacts.audit = sha256File(job.auditPath);
  checkpoint.artifacts.logs.gmsh = sha256File(join(job.jobDir, "gmsh.log"));
  saveCheckpoint(job.jobDir, checkpoint);
}

function commandPlan(job) {
  const { inputs, parameters, plan, jobDir, meshPath, runRoot } = job;
  const geoPath = job.geoWrapperPath;
  const proPath = job.proWrapperPath;
  const outputName = join(jobDir, "motor.msh");
  const gmshArgs = [geoPath, "-3", "-nt", String(plan.meshThreads), "-format", "msh4", "-o", outputName];
  const getdpArgs = [
    proPath,
    "-nt",
    String(plan.solverThreads),
    "-name",
    join(jobDir, "solve"),
    "-msh",
    meshPath,
    "-solve",
    "Magnetostatics3D",
    "-pos",
    "MagnetostaticResults",
    ...plan.solver.petscOptions
  ];
  const auditArgs = [
    inputs.meshAuditPath,
    meshPath,
    "--output", job.auditPath,
    "--mode", "production",
    "--geometry-sha256", sha256File(inputs.geoPath),
    "--command", [plan.gmsh, ...gmshArgs].join(" ")
  ];
  const identityPlan = {
    mesh: ["gmsh", "{geometry}", ...gmshArgs.slice(1, -1), "{mesh}"],
    solve: ["getdp", "{problem}", ...getdpArgs.slice(1).map((value) => {
      if (value === join(jobDir, "solve")) return "{solution}";
      if (value === meshPath) return "{mesh}";
      return value;
    })]
  };
  assert(stableJson(identityPlan) === stableJson(plan.environment.identity.commandPlan), "Command plan differs from the solver environment identity");
  return {
    mesh: plan.kind === "docker" ? dockerCommand(plan, ROOT, ROOT, "gmsh", gmshArgs, runRoot, plan.meshThreads) : [plan.gmsh, ...gmshArgs],
    audit: [process.execPath, ...auditArgs],
    solve: plan.kind === "docker" ? dockerCommand(plan, ROOT, jobDir, "getdp", getdpArgs, runRoot, plan.solverThreads) : [plan.getdp, ...getdpArgs]
  };
}

function checkpointPath(jobDir) {
  return join(jobDir, "checkpoint.json");
}

function readCheckpoint(jobDir) {
  const path = checkpointPath(jobDir);
  return existsSync(path) ? readJson(path, "checkpoint") : null;
}

function saveCheckpoint(jobDir, checkpoint) {
  writeAtomic(checkpointPath(jobDir), checkpoint);
}

function planJob(inputs, parameters, options, plan, runRoot, symmetryApplied = false) {
  assert(plan.environment?.identityHash, "Solver environment identity is required to plan a job");
  const hash = inputHash(inputs, inputs.caseData, parameters, plan.environment.identityHash);
  const modelInputHash = baseInputHash(inputs, inputs.caseData);
  const jobId = sha256Bytes(Buffer.from(stableJson({ inputHash: modelInputHash, parameters }))).slice(0, 24);
  const jobDir = resolve(runRoot, jobId);
  const meshPath = join(jobDir, "motor.msh");
  const auditPath = join(jobDir, "mesh-audit.json");
  const parametersPath = join(jobDir, "parameters.json");
  const geoWrapperPath = join(jobDir, "geometry-wrapper.geo");
  const proWrapperPath = join(jobDir, "getdp-wrapper.pro");
  const checkpoint = readCheckpoint(jobDir);
  if (plan.solver.publicationProfile) {
    assert(parameters.meshSizeM === plan.solver.requiredMeshSizeM,
      `Solver profile ${plan.solver.name} requires mesh size ${plan.solver.requiredMeshSizeM} m`);
  }
  if (plan.solver.mode === "direct") {
    assert(parameters.meshSizeM >= plan.solver.safeMinimumMeshSizeM, `Direct MUMPS profile is restricted to smoke meshes >= ${plan.solver.safeMinimumMeshSizeM} m`);
  }
  return { hash, modelInputHash, jobId, jobDir, meshPath, auditPath, parametersPath, geoWrapperPath, proWrapperPath, checkpoint, parameters, plan, inputs, options, runRoot, symmetryApplied };
}

function parseSolverConvergence(logPath, solver) {
  const log = readFileSync(logPath, "utf8");
  const selected = [...log.matchAll(/Info\s+: N: (\d+) - (\S+) (\S+)(?: (\S+))?/g)].at(-1);
  assert(selected, "GetDP log does not record the selected PETSc KSP/PC");
  assert(selected[2] === solver.kspType && selected[3] === solver.pcType, `GetDP selected ${selected[2]}/${selected[3]} instead of ${solver.kspType}/${solver.pcType}`);
  if (solver.factorSolverType) {
    assert(selected[4] === solver.factorSolverType, `GetDP selected ${selected[4] || "no factor solver"} instead of ${solver.factorSolverType}`);
  }
  const reason = [...log.matchAll(/Linear solve (did not converge|converged) due to (\S+) iterations (\d+)/g)].at(-1);
  assert(reason, "GetDP log does not contain a PETSc convergence reason");
  assert(reason[1] === "converged" && reason[2].startsWith("CONVERGED_"), `PETSc solve did not converge: ${reason[2]}`);
  const residual = [...log.matchAll(/(\d+) KSP unpreconditioned resid norm ([\deE+.-]+) true resid norm ([\deE+.-]+) \|\|r\(i\)\|\|\/\|\|b\|\| ([\deE+.-]+)/g)].at(-1);
  assert(residual, "GetDP log does not contain the final true residual");
  const memory = [...log.matchAll(/Mem = ([\d.]+)Mb/g)].map((match) => Number(match[1]));
  const wall = [...log.matchAll(/Wall = ([\deE+.-]+)s/g)].map((match) => Number(match[1]));
  return {
    schemaVersion: "edwin-gray-solver-convergence-v1",
    status: "converged",
    profile: solver.name,
    configSha256: solver.configSha256,
    kspType: selected[2],
    pcType: selected[3],
    factorSolverType: solver.factorSolverType || null,
    reason: reason[2],
    iterations: Number(reason[3]),
    finalResidualNorm: Number(residual[3]),
    finalRelativeResidual: Number(residual[4]),
    tolerances: solver.mode === "iterative" ? {
      relative: solver.relativeTolerance,
      absolute: solver.absoluteTolerance,
      maximumIterations: solver.maximumIterations
    } : null,
    peakGetdpMemoryMiB: memory.length ? Math.max(...memory) : null,
    runtimeSeconds: wall.length ? Math.max(...wall) : null
  };
}

function runJob(job) {
  const { jobDir, parameters, hash, plan, inputs, runRoot } = job;
  mkdirSync(jobDir, { recursive: true });
  writeAtomic(job.parametersPath, parameters);
  const geometrySource = plan.kind === "docker" ? dockerPath(inputs.geoPath, ROOT, runRoot) : inputs.geoPath;
  const getdpSource = plan.kind === "docker" ? dockerPath(inputs.proPath, ROOT, runRoot) : inputs.proPath;
  writeAtomic(job.geoWrapperPath, parameterWrapper(geometrySource, gmshOverrides(parameters, inputs.caseData)));
  writeAtomic(job.proWrapperPath, problemWrapper(getdpSource, getdpOverrides(parameters, inputs.caseData)));
  const commands = commandPlan(job);
  const environmentPath = join(jobDir, "solver-environment.json");
  writeAtomic(environmentPath, environmentManifest(plan.environment, commands));
  let checkpoint = job.checkpoint;
  if (!checkpointMatches(checkpoint, job)) {
    checkpoint = {
      checkpointVersion: CHECKPOINT_VERSION,
      jobId: job.jobId,
      inputHash: hash,
      modelInputHash: job.modelInputHash,
      jobInputHash: hash,
      parameters,
      backend: plan.kind,
      solverProfile: plan.solver,
      resourceLimits: plan.environment.identity.resources,
      environmentIdentityHash: plan.environment.identityHash,
      solverEnvironment: plan.environment,
      resultContract: `${RESULT_CONTRACT}@${RESULT_CONTRACT_VERSION}`,
      excitationContract: parameters.excitationContract,
      eventIndex: parameters.eventIndex,
      meshQuality: null,
      phases: { mesh: "pending", solve: "pending", normalize: "pending" },
      artifacts: {
        environment: sha256File(environmentPath),
        inputs: { geometry: sha256File(job.geoWrapperPath), getdp: sha256File(job.proWrapperPath) },
        mesh: null,
        audit: null,
        logs: { gmsh: null, getdp: null },
        convergence: null,
        outputs: {},
        result: null
      },
      result: null
    };
    saveCheckpoint(jobDir, checkpoint);
  }

  if (!meshCheckpointValid(job, checkpoint)) {
    resetPhase(checkpoint, "mesh");
    removePhaseArtifacts(job, "mesh");
    saveCheckpoint(jobDir, checkpoint);
    if (job.options["reuse-mesh-checkpoint"]) {
      reuseMesh(job, checkpoint, job.options["reuse-mesh-checkpoint"], commands);
    } else {
      const meshRun = runCommand({
        plan,
        root: ROOT,
        cwd: ROOT,
        command: plan.gmsh,
        args: commands.mesh.slice(1),
        commandLine: commands.mesh,
        logName: join(jobDir, "gmsh.log"),
        runRoot
      });
      assertMeshQuality(meshRun.log);
      assert(existsSync(job.meshPath), "Gmsh completed without producing a mesh");
      runCommand({
        plan,
        root: ROOT,
        cwd: jobDir,
        command: process.execPath,
        args: commands.audit.slice(1),
        commandLine: commands.audit,
        logName: "mesh-audit.log",
        runRoot
      });
      const audit = readJson(job.auditPath, "mesh audit");
      assert(audit.valid === true, "Quantitative mesh audit rejected the generated mesh");
      assert(audit.source?.meshSha256 === sha256File(job.meshPath), "Mesh audit does not attest the generated mesh");
      checkpoint.phases.mesh = "complete";
      checkpoint.meshQuality = "passed";
      checkpoint.artifacts.mesh = sha256File(job.meshPath);
      checkpoint.artifacts.audit = sha256File(job.auditPath);
      checkpoint.artifacts.logs.gmsh = sha256File(meshRun.log);
      saveCheckpoint(jobDir, checkpoint);
    }
  }

  if (!solveCheckpointValid(job, checkpoint)) {
    resetPhase(checkpoint, "solve");
    removePhaseArtifacts(job, "solve");
    saveCheckpoint(jobDir, checkpoint);
    const solveRun = runCommand({
      plan,
      root: ROOT,
      cwd: jobDir,
      command: plan.getdp,
      args: commands.solve.slice(1),
      commandLine: commands.solve,
      logName: "getdp.log",
      runRoot
    });
    assert(outputsComplete(job), "GetDP completed without producing all declared table outputs");
    const convergence = parseSolverConvergence(solveRun.log, plan.solver);
    writeAtomic(join(jobDir, SOLVER_CONVERGENCE), convergence);
    checkpoint.phases.solve = "complete";
    checkpoint.artifacts.logs.getdp = sha256File(solveRun.log);
    checkpoint.artifacts.convergence = sha256File(join(jobDir, SOLVER_CONVERGENCE));
    checkpoint.solverConvergence = convergence;
    checkpoint.artifacts.outputs = Object.fromEntries(commandOutputs(job).map((path) => [relative(job.jobDir, path), sha256File(path)]));
    saveCheckpoint(jobDir, checkpoint);
  }

  if (!normalizeCheckpointValid(job, checkpoint)) {
    resetPhase(checkpoint, "normalize");
    removePhaseArtifacts(job, "normalize");
    saveCheckpoint(jobDir, checkpoint);
    const result = normalizeResults({
      caseData: inputs.caseData,
      jobDir,
      parameters,
      inputHash: hash,
      modelInputHash: job.modelInputHash,
      jobInputHash: hash,
      solver: "getdp",
      backend: plan.kind,
      artifacts: [job.meshPath, job.auditPath, join(jobDir, "getdp.log"), join(jobDir, SOLVER_CONVERGENCE), ...commandOutputs(job)],
      resultSchema: inputs.lutSchemaData,
      symmetryApplied: job.symmetryApplied
    });
    validateNormalizedProvenance(result, job);
    validateLutResultSchema(result, inputs.lutSchemaData);
    writeAtomic(join(jobDir, "result.json"), result);
    checkpoint.phases.normalize = "complete";
    checkpoint.artifacts.result = sha256File(join(jobDir, "result.json"));
    checkpoint.result = "result.json";
    saveCheckpoint(jobDir, checkpoint);
  }
  return { jobId: job.jobId, status: "complete", jobDir, inputHash: hash };
}

function printPlan(inputs, options, host, plan, parameters) {
  const job = planJob(inputs, parameters, options, plan, resolve(options["run-dir"] || DEFAULT_RUNS));
  const commands = plan.kind === "unavailable" ? { mesh: null, solve: null } : commandPlan(job);
  console.log(JSON.stringify({
    mode: "dry-run",
    status: plan.kind === "unavailable" ? "unavailable" : "ready",
    host: { gmsh: host.gmsh, getdp: host.getdp },
    backend: { kind: plan.kind, reason: plan.reason || null, docker: plan.docker || null, image: plan.image || null },
    inputHash: job.hash,
    environmentIdentityHash: plan.environment.identityHash,
    jobId: job.jobId,
    commands: { mesh: commands.mesh, audit: commands.audit, solve: commands.solve },
    noSyntheticOutput: true
  }, null, 2));
}

function validateOnly(options) {
  const inputs = loadInputs(options);
  validateSchemaValue(inputs.caseData, inputs.schemaData, "case", inputs.schemaData);
  validateEventMapSymmetryProof(proveEventMapSymmetry({
    eventMap: inputs.eventMapData,
    caseData: inputs.caseData,
    geometryText: inputs.geometryText,
    eventMapBytes: readFileSync(inputs.eventMapPath),
    caseBytes: readFileSync(inputs.casePath),
    geometryBytes: readFileSync(inputs.geoPath)
  }));
  const asciiPaths = [inputs.casePath, inputs.geoPath, inputs.proPath, inputs.schemaPath, inputs.lutSchemaPath, inputs.solverConfigPath, SYMMETRY_SCRIPT];
  for (const path of asciiPaths) {
    const bytes = readFileSync(path);
    assert(!bytes.some((byte) => byte > 127), `Non-ASCII byte found in ${path}`);
  }
  console.log(JSON.stringify({ status: "valid", caseId: inputs.caseData.caseId, expectedAssemblyPhysicalGroups: 48, full3d: true, resultContract: `${RESULT_CONTRACT}@${RESULT_CONTRACT_VERSION}`, noSyntheticOutput: true }));
}

function eventIndexOption(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  assert(Number.isInteger(parsed) && parsed >= 0 && parsed <= 26, "--event-index must be an integer in [0, 26]");
  return parsed;
}

function finiteOption(value, fallback, label, { minimum = -Infinity, exclusiveMinimum = -Infinity, exclusiveMaximum = Infinity } = {}) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  assert(Number.isFinite(parsed), `${label} must be finite`);
  assert(parsed >= minimum && parsed > exclusiveMinimum && parsed < exclusiveMaximum, `${label} is outside its allowed range`);
  return parsed;
}

function defaultParameters(caseData, options = {}) {
  return {
    rotorAngleDeg: finiteOption(options["rotor-angle"], caseData.geometry.rotorAngleDeg, "--rotor-angle", { minimum: 0, exclusiveMaximum: 360 }),
    eventIndex: eventIndexOption(options["event-index"], caseData.excitation.eventIndex),
    excitationContract: caseData.excitation.contract,
    meshSizeM: finiteOption(options["mesh-size"], caseData.geometry.meshSizeM, "--mesh-size", { exclusiveMinimum: 0 }),
    driveCurrentA: finiteOption(options["drive-current"], caseData.excitation.driveCurrentA, "--drive-current", { exclusiveMinimum: 0 })
  };
}

function writeSweep(inputs, manifestPath) {
  const hash = baseInputHash(inputs, inputs.caseData);
  const manifest = buildSweep(inputs.caseData, hash);
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeAtomic(manifestPath, manifest);
  console.log(JSON.stringify({ status: "manifest-written", path: manifestPath, jobs: manifest.jobs.length, inputHash: hash, noSyntheticOutput: true }));
}

function validateSweepManifest(inputs, manifest) {
  assert(manifest.manifestVersion === SWEEP_MANIFEST_VERSION, "Unsupported sweep manifest version");
  assert(baseInputHash(inputs, inputs.caseData) === manifest.inputHash, "Sweep manifest input hash does not match current inputs");
  assert(manifest.caseId === inputs.caseData.caseId, "Sweep manifest case ID does not match current inputs");
  assert(manifest.resultContract?.contract === RESULT_CONTRACT && manifest.resultContract.contractVersion === RESULT_CONTRACT_VERSION, "Sweep result contract does not match current inputs");
  assert(Array.isArray(manifest.jobs) && manifest.jobs.length > 0, "Sweep manifest jobs are required");

  const declaredJobs = buildSweep(inputs.caseData, manifest.inputHash).jobs;
  const declaredById = new Map(declaredJobs.map((job) => [job.jobId, job]));
  assert(declaredById.size === declaredJobs.length, "Declared sweep contains duplicate job IDs");
  assert(manifest.jobs.length === declaredJobs.length, "Sweep manifest does not contain the exact declared parameter coverage");
  assert(new Set(manifest.jobs.map((job) => job.jobId)).size === manifest.jobs.length, "Sweep manifest contains duplicate job IDs");
  for (const job of manifest.jobs) {
    const declared = declaredById.get(job.jobId);
    assert(declared, `Sweep manifest contains an undeclared job: ${job.jobId}`);
    assert(stableJson(job.parameters) === stableJson(declared.parameters), `Sweep manifest parameters do not match job ID ${job.jobId}`);
    assert(job.symmetryApplied === declared.symmetryApplied, `Sweep manifest symmetry does not match job ID ${job.jobId}`);
  }
  return declaredJobs;
}

function validateCompleteJob(job, manifestPath, resultReference) {
  assert(typeof resultReference === "string", `Completed manifest job ${job.jobId} has no result path`);
  const expectedResultPath = join(job.jobDir, "result.json");
  assert(resolve(dirname(manifestPath), resultReference) === expectedResultPath, `Manifest result path is not the content-addressed result for ${job.jobId}`);
  const checkpoint = readCheckpoint(job.jobDir);
  assert(checkpointMatches(checkpoint, job), `Runner checkpoint does not match completed job ${job.jobId}`);
  assert(checkpoint.result === "result.json", `Runner checkpoint result path is invalid for ${job.jobId}`);
  assert(meshCheckpointValid(job, checkpoint), `Mesh checkpoint or artifact hash is invalid for ${job.jobId}`);
  assert(solveCheckpointValid(job, checkpoint), `Solver checkpoint or artifact hashes are invalid for ${job.jobId}`);
  assert(normalizeCheckpointValid(job, checkpoint), `Normalized result checkpoint or artifact hash is invalid for ${job.jobId}`);
  const result = readJson(expectedResultPath, "normalized FEM result");
  validateNormalizedProvenance(result, job);
  validateLutResultSchema(result, job.inputs.lutSchemaData);
  return result;
}

function completedManifestJobValid(job, manifestPath, resultReference) {
  try {
    validateCompleteJob(job, manifestPath, resultReference);
    return true;
  } catch {
    return false;
  }
}

function optionalPositiveNumber(value, label) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  assert(Number.isFinite(parsed) && parsed > 0, `${label} must be finite and positive`);
  return parsed;
}

function selectedSweepValue(declaredJobs, key, requested, label) {
  const values = [...new Set(declaredJobs.map((job) => job.parameters[key]))];
  if (requested !== undefined) {
    assert(values.includes(requested), `${label} is not declared by the sweep manifest`);
    return requested;
  }
  assert(values.length === 1, `${label} is required when the sweep declares multiple values`);
  return values[0];
}

function aggregateManifest(inputs, manifestPath, options) {
  const manifest = readJson(manifestPath, "sweep manifest");
  const declaredJobs = validateSweepManifest(inputs, manifest);
  const meshSizeM = selectedSweepValue(
    declaredJobs,
    "meshSizeM",
    optionalPositiveNumber(options["mesh-size"], "--mesh-size"),
    "--mesh-size"
  );
  const driveCurrentA = selectedSweepValue(
    declaredJobs,
    "driveCurrentA",
    optionalPositiveNumber(options["drive-current"], "--drive-current"),
    "--drive-current"
  );
  const selectedDeclared = declaredJobs.filter((job) => (
    job.parameters.meshSizeM === meshSizeM && job.parameters.driveCurrentA === driveCurrentA
  ));
  const manifestById = new Map(manifest.jobs.map((job) => [job.jobId, job]));
  const runRoot = resolve(options["run-dir"] || DEFAULT_RUNS);
  const documents = selectedDeclared.map((declared) => {
    const item = manifestById.get(declared.jobId);
    assert(item.status === "complete", `Declared aggregation job is not complete: ${declared.jobId}`);
    const checkpoint = readCheckpoint(resolve(runRoot, item.jobId));
    const job = planJob(inputs, item.parameters, options, {
      kind: checkpoint?.backend,
      solver: checkpoint?.solverProfile,
      environment: checkpoint?.solverEnvironment
    }, runRoot, item.symmetryApplied === true);
    return validateCompleteJob(job, manifestPath, item.result);
  });
  const resultAngles = documents.map((document) => document.entries[0].parameters.rotorAngleDeg.toFixed(10));
  const declaredAngles = selectedDeclared.map((job) => job.parameters.rotorAngleDeg.toFixed(10));
  assert(stableJson([...resultAngles].sort()) === stableJson([...declaredAngles].sort()), "Completed results do not provide exact declared angle coverage");
  const result = aggregateNormalizedResults(documents, {
    meshSizeM,
    driveCurrentA,
    resultSchema: inputs.lutSchemaData
  });
  const out = resolve(options.out || resolve(ROOT, "../../public/data/generated/edwin-gray/motor-fem-lut-v1.json"));
  mkdirSync(dirname(out), { recursive: true });
  writeAtomic(out, result);
  console.log(JSON.stringify({ status: result.status, output: out, entries: result.entries.length, contract: `${RESULT_CONTRACT}@${RESULT_CONTRACT_VERSION}`, noSyntheticOutput: true }));
}

function runManifest(inputs, manifestPath, options, plan) {
  const manifest = readJson(manifestPath, "sweep manifest");
  validateSweepManifest(inputs, manifest);
  const runRoot = resolve(options["run-dir"] || DEFAULT_RUNS);
  mkdirSync(runRoot, { recursive: true });
  const results = [];
  for (const item of manifest.jobs) {
    const job = planJob(inputs, item.parameters, options, plan, runRoot, item.symmetryApplied === true);
    assert(job.jobId === item.jobId, `Manifest job ID does not match content address for ${item.jobId}`);
    if (item.status === "complete" && options.resume && completedManifestJobValid(job, manifestPath, item.result)) {
      results.push({ jobId: item.jobId, status: "complete", skipped: true });
      continue;
    }
    item.status = "pending";
    item.result = null;
    manifest.status = "pending";
    writeAtomic(manifestPath, manifest);
    const result = runJob(job);
    item.status = result.status;
    item.result = relative(dirname(manifestPath), join(result.jobDir, "result.json"));
    validateCompleteJob(job, manifestPath, item.result);
    manifest.status = manifest.jobs.every((jobItem) => jobItem.status === "complete") ? "complete" : "pending";
    results.push(result);
    writeAtomic(manifestPath, manifest);
  }
  console.log(JSON.stringify({ status: "complete", manifest: manifestPath, results }, null, 2));
}

function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return;
  }
  if (options.validate) {
    validateOnly(options);
    if (!options["dry-run"] && !options.sweep && !options.resume) {
      return;
    }
  }
  const inputs = loadInputs(options);
  if (options.aggregate) {
    assert(options.manifest, "--aggregate requires --manifest PATH");
    aggregateManifest(inputs, resolve(options.manifest), options);
    return;
  }
  if (options.sweep) {
    const manifestPath = resolve(options.manifest || join(ROOT, "sweep-manifest.json"));
    writeSweep(inputs, manifestPath);
    return;
  }
  const host = detectHost(options);
  if (options["dry-run"]) {
    const plan = identifyBackend(backendPlan(options, host, { allowUnavailable: true }), options, inputs);
    printPlan(inputs, options, host, plan, defaultParameters(inputs.caseData, options));
    return;
  }
  const plan = identifyBackend(backendPlan(options, host), options, inputs);
  const manifestPath = options.manifest ? resolve(options.manifest) : null;
  if (manifestPath) {
    runManifest(inputs, manifestPath, options, plan);
    return;
  }
  const parameters = defaultParameters(inputs.caseData, options);
  const job = planJob(inputs, parameters, options, plan, resolve(options["run-dir"] || DEFAULT_RUNS));
  console.log(JSON.stringify(runJob(job), null, 2));
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`run: ${error.message}`);
    process.exitCode = 1;
  }
}

export { baseInputHash, loadInputs };
