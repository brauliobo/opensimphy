#!/usr/bin/env node

import {
  accessSync,
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
const DEFAULT_CASE = resolve(ROOT, "cases/patent-3890548-illustrative.json");
const DEFAULT_GEO = resolve(ROOT, "geometry/patent-3890548-3d.geo");
const DEFAULT_PRO = resolve(ROOT, "getdp/magnetostatic.pro");
const DEFAULT_RUNS = resolve(ROOT, "runs");
const CHECKPOINT_VERSION = "fem-checkpoint-v4";
const SWEEP_MANIFEST_VERSION = "motor-fem-sweep-v2";
const RESULT_CONTRACT = "edwin-gray-browser-result";
const RESULT_CONTRACT_VERSION = 1;
const SOLVER_OUTPUTS = ["observables.dat", "coenergy.dat", "inductance.dat"];
const RESULT_OBSERVABLES = ["magneticEnergyJ", "coEnergyJ", "inductanceH"];
const MESH_QUALITY_WARNING = "Gmsh passed the runner's fatal log-pattern gate; this is not a mesh-quality certification";
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
    "  --threads COUNT                    Solver thread count (default: 1)",
    "  --case PATH                        Case JSON path",
    "  --geo PATH                         Gmsh geometry path",
    "  --pro PATH                         GetDP problem path",
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
    join(job.jobDir, "getdp.log"),
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
  assert(geometryText.includes("Mesh.Algorithm3D = 4"), "Geometry must use the robust 3D frontal mesher");
  assert(geometryText.includes("Physical Volume(\"AllCores\""), "Geometry must define AllCores");
  assert(geometryText.includes("Physical Volume(\"AllCoils\""), "Geometry must define AllCoils");
  assert(geometryText.includes(`CoilRadialMarginM = DefineNumber[${geometry.coilRadialMarginM},`), "Geometry default coil radial margin must match the case");
  assert(getdpText.includes("Type Form1"), "GetDP artifact must use an H(curl) edge space");
  assert(getdpText.includes("Magnetostatics3D"), "GetDP magnetostatic formulation is missing");
  assert(getdpText.includes("MagneticEnergyJ"), "GetDP energy postprocessing is missing");
  assert(getdpText.includes("InductanceH"), "GetDP inductance postprocessing is missing");
  assert(!getdpText.includes("radiant") && !getdpText.includes("Radiant"), "GetDP must not include a non-Maxwell force term");
}

function loadInputs(options) {
  const casePath = resolve(options.case || DEFAULT_CASE);
  const geoPath = resolve(options.geo || DEFAULT_GEO);
  const proPath = resolve(options.pro || DEFAULT_PRO);
  const schemaPath = resolve(ROOT, "schema/motor-case.schema.json");
  const lutSchemaPath = resolve(ROOT, "schema/motor-fem-lut.schema.json");
  const caseData = readJson(casePath, "case");
  const geometryText = readFileSync(geoPath, "utf8");
  const getdpText = readFileSync(proPath, "utf8");
  const schemaData = readJson(schemaPath, "case schema");
  const lutSchemaData = readJson(lutSchemaPath, "result schema");
  validateCase(caseData, geometryText, getdpText, schemaData, lutSchemaData);
  return { casePath, geoPath, proPath, schemaPath, lutSchemaPath, caseData, geometryText, getdpText, schemaData, lutSchemaData };
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
  for (const angle of caseData.sweep.anglesDeg) {
    const canonical = symmetry.declared ? canonicalAngle(angle, symmetry.order) : angle;
    const key = canonical.toFixed(10);
    if (!seenAngles.has(key)) {
      seenAngles.add(key);
      angles.push(canonical);
    }
  }
  const jobs = [];
  for (const rotorAngleDeg of angles) {
    for (const meshSizeM of caseData.sweep.meshSizesM) {
      for (const driveCurrentA of caseData.sweep.driveCurrentA) {
        const parameters = { rotorAngleDeg, meshSizeM, driveCurrentA };
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
    case: sha256File(inputs.casePath),
    geometry: sha256File(inputs.geoPath),
    getdp: sha256File(inputs.proPath),
    schema: sha256File(inputs.schemaPath),
    resultSchema: sha256File(inputs.lutSchemaPath),
    caseId: caseData.caseId
  };
  return sha256Bytes(Buffer.from(stableJson(payload)));
}

function gmshOverrides(parameters, caseData) {
  const g = caseData.geometry;
  return [
    ["Parameters/Mesh size (m)", parameters.meshSizeM],
    ["Parameters/Rotor angle (deg)", parameters.rotorAngleDeg],
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
    ["Parameters/Electromagnet axial length (m)", g.electromagnetAxialLengthM],
    ["Parameters/Coil tangential margin (m)", g.coilTangentialMarginM],
    ["Parameters/Coil axial margin (m)", g.coilAxialMarginM]
  ];
}

function getdpOverrides(parameters, caseData) {
  return [
    ["Parameters/Core relative permeability", caseData.materials.core.relativePermeability],
    ["Parameters/Drive current (A)", parameters.driveCurrentA],
    ["Parameters/Turns", caseData.excitation.turns],
    ["Parameters/Effective coil cross-section (m^2)", caseData.excitation.effectiveCoilCrossSectionM2]
  ];
}

function commandWithOverrides(command, args, overrides) {
  const result = [command, ...args];
  for (const [name, value] of overrides) {
    result.push("-setnumber", name, String(value));
  }
  return result;
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

function runnerRevision() {
  if (process.env.SOLVER_RUNNER_REVISION) {
    return process.env.SOLVER_RUNNER_REVISION;
  }
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function identifyBackend(plan, options) {
  const threads = positiveInteger(options.threads || process.env.SOLVER_THREADS || "1", "--threads");
  const runner = runnerIdentity({
    revision: runnerRevision(),
    runScript: RUN_SCRIPT,
    environmentModule: ENVIRONMENT_MODULE
  });
  if (plan.kind === "host") {
    return {
      ...plan,
      threads,
      environment: identifyHostEnvironment({ gmsh: plan.gmsh, getdp: plan.getdp, threads, runner })
    };
  }
  if (plan.kind === "docker") {
    const image = resolveDockerImageReference(plan.docker, plan.image, { publication: options.publication === true });
    return {
      ...plan,
      image: image.image,
      requestedImage: image.requestedImage,
      imageDigest: image.digest,
      threads,
      environment: identifyDockerEnvironment({ image, threads, runner })
    };
  }
  return {
    ...plan,
    threads,
    environment: identifyUnavailableEnvironment({ reason: plan.reason, threads, runner })
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

function dockerCommand(plan, root, cwd, command, args, runRoot) {
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
    `OMP_NUM_THREADS=${plan.threads}`,
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
  const fullArgs = commandLine || (plan.kind === "docker" ? dockerCommand(plan, root, cwd, command, args, runRoot) : [command, ...args]);
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
    && artifactMatches(join(job.jobDir, "gmsh.log"), checkpoint.artifacts?.logs?.gmsh);
}

function solveCheckpointValid(job, checkpoint) {
  if (checkpoint.phases.solve !== "complete" || !outputsComplete(job)) {
    return false;
  }
  return artifactMatches(join(job.jobDir, "getdp.log"), checkpoint.artifacts?.logs?.getdp)
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
    && checkpoint.backend === job.plan.kind
    && checkpoint.resultContract === `${RESULT_CONTRACT}@${RESULT_CONTRACT_VERSION}`
    && checkpoint.phases && typeof checkpoint.phases === "object"
    && checkpoint.artifacts && typeof checkpoint.artifacts === "object"
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
    checkpoint.artifacts.logs.gmsh = null;
  }
  if (phase === "mesh" || phase === "solve") {
    checkpoint.artifacts.outputs = {};
    checkpoint.artifacts.logs.getdp = null;
  }
  checkpoint.artifacts.result = null;
  checkpoint.result = null;
}

function removePhaseArtifacts(job, phase) {
  if (phase === "mesh") {
    rmSync(job.meshPath, { force: true });
    rmSync(join(job.jobDir, "gmsh.log"), { force: true });
  }
  if (phase === "mesh" || phase === "solve") {
    for (const path of commandOutputs(job)) {
      rmSync(path, { force: true });
    }
    rmSync(join(job.jobDir, "getdp.log"), { force: true });
  }
  rmSync(join(job.jobDir, "result.json"), { force: true });
}

function commandPlan(job) {
  const { inputs, parameters, plan, jobDir, meshPath, runRoot } = job;
  const geoPath = inputs.geoPath;
  const proPath = inputs.proPath;
  const outputName = join(jobDir, "motor.msh");
  const gmshArgs = commandWithOverrides(
    geoPath,
    ["-3", "-nt", String(plan.threads), "-format", "msh4", "-o", outputName],
    gmshOverrides(parameters, inputs.caseData)
  );
  const getdpArgs = [
    proPath,
    "-nt",
    String(plan.threads),
    "-name",
    join(jobDir, "solve"),
    "-msh",
    meshPath,
    "-solve",
    "Magnetostatics3D",
    "-pos",
    "MagnetostaticResults",
    ...getdpOverrides(parameters, inputs.caseData).flatMap(([name, value]) => ["-setnumber", name, String(value)])
  ];
  return {
    mesh: plan.kind === "docker" ? dockerCommand(plan, ROOT, ROOT, "gmsh", gmshArgs, runRoot) : [plan.gmsh, ...gmshArgs],
    solve: plan.kind === "docker" ? dockerCommand(plan, ROOT, jobDir, "getdp", getdpArgs, runRoot) : [plan.getdp, ...getdpArgs]
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
  const parametersPath = join(jobDir, "parameters.json");
  const checkpoint = readCheckpoint(jobDir);
  return { hash, modelInputHash, jobId, jobDir, meshPath, parametersPath, checkpoint, parameters, plan, inputs, options, runRoot, symmetryApplied };
}

function runJob(job) {
  const { jobDir, parameters, hash, plan, inputs, runRoot } = job;
  mkdirSync(jobDir, { recursive: true });
  writeAtomic(job.parametersPath, parameters);
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
      environmentIdentityHash: plan.environment.identityHash,
      solverEnvironment: plan.environment,
      resultContract: `${RESULT_CONTRACT}@${RESULT_CONTRACT_VERSION}`,
      meshQuality: null,
      phases: { mesh: "pending", solve: "pending", normalize: "pending" },
      artifacts: { environment: sha256File(environmentPath), mesh: null, logs: { gmsh: null, getdp: null }, outputs: {}, result: null },
      result: null
    };
    saveCheckpoint(jobDir, checkpoint);
  }

  if (!meshCheckpointValid(job, checkpoint)) {
    resetPhase(checkpoint, "mesh");
    removePhaseArtifacts(job, "mesh");
    saveCheckpoint(jobDir, checkpoint);
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
    checkpoint.phases.mesh = "complete";
    checkpoint.meshQuality = "passed";
    checkpoint.artifacts.mesh = sha256File(job.meshPath);
    checkpoint.artifacts.logs.gmsh = sha256File(meshRun.log);
    saveCheckpoint(jobDir, checkpoint);
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
    checkpoint.phases.solve = "complete";
    checkpoint.artifacts.logs.getdp = sha256File(solveRun.log);
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
      artifacts: [job.meshPath, join(jobDir, "getdp.log"), ...commandOutputs(job)],
      resultSchema: inputs.lutSchemaData,
      symmetryApplied: job.symmetryApplied
    });
    result.provenance.limitations.push(MESH_QUALITY_WARNING);
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
    commands: { mesh: commands.mesh, solve: commands.solve },
    noSyntheticOutput: true
  }, null, 2));
}

function validateOnly(options) {
  const inputs = loadInputs(options);
  validateSchemaValue(inputs.caseData, inputs.schemaData, "case", inputs.schemaData);
  const asciiPaths = [inputs.casePath, inputs.geoPath, inputs.proPath, inputs.schemaPath, inputs.lutSchemaPath];
  for (const path of asciiPaths) {
    const bytes = readFileSync(path);
    assert(!bytes.some((byte) => byte > 127), `Non-ASCII byte found in ${path}`);
  }
  console.log(JSON.stringify({ status: "valid", caseId: inputs.caseData.caseId, expectedAssemblyPhysicalGroups: 48, full3d: true, resultContract: `${RESULT_CONTRACT}@${RESULT_CONTRACT_VERSION}`, noSyntheticOutput: true }));
}

function defaultParameters(caseData) {
  return {
    rotorAngleDeg: caseData.geometry.rotorAngleDeg,
    meshSizeM: caseData.geometry.meshSizeM,
    driveCurrentA: caseData.excitation.driveCurrentA
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
    const plan = identifyBackend(backendPlan(options, host, { allowUnavailable: true }), options);
    printPlan(inputs, options, host, plan, defaultParameters(inputs.caseData));
    return;
  }
  const plan = identifyBackend(backendPlan(options, host), options);
  const manifestPath = options.manifest ? resolve(options.manifest) : null;
  if (manifestPath) {
    runManifest(inputs, manifestPath, options, plan);
    return;
  }
  const parameters = defaultParameters(inputs.caseData);
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
