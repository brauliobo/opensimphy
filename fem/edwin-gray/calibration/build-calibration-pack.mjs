#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { proveEventMapSymmetry, validateEventMapSymmetryProof } from "../scripts/event-map-symmetry.mjs";
import { validateCheckpointSolverEvidence } from "./solver-evidence.mjs";

const CALIBRATION_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(CALIBRATION_DIR, "..");
const DEFAULT_PROFILE = resolve(CALIBRATION_DIR, "profile-v1.json");
const EVENT_MAP_PATH = resolve(ROOT, "excitation/v1/event-map-v1.json");
const CASE_PATH = resolve(ROOT, "cases/patent-3890548-illustrative.json");
const GEOMETRY_PATH = resolve(ROOT, "geometry/patent-3890548-3d.geo");
const CONVERGENCE_SPEC_PATH = resolve(ROOT, "convergence/convergence-spec-v2.json");
const SHA256 = /^[a-f0-9]{64}$/;
const IMMUTABLE_IMAGE = /(?:@sha256:|^sha256:)[a-f0-9]{64}$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    assert(token.startsWith("--"), `unexpected argument ${token}`);
    const value = argv[index + 1];
    assert(value && !value.startsWith("--"), `missing value for ${token}`);
    options[token.slice(2)] = value;
    index += 1;
  }
  return options;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} is invalid: ${error.message}`);
  }
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path) {
  return sha256Bytes(readFileSync(path));
}

function sameNumber(left, right) {
  return Number.isFinite(left) && Number.isFinite(right)
    && Math.abs(left - right) <= 1e-12 * Math.max(1, Math.abs(left), Math.abs(right));
}

function relativeDifference(left, right) {
  return Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right), Number.MIN_VALUE);
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporary, path);
}

function validateProfile(profile) {
  assert(profile.contract === "edwin-gray-motor-fem-calibration-profile" && profile.contractVersion === 1, "calibration profile contract is invalid");
  assert(profile.profileId === "fast-limited-calibration-v1", "calibration profile ID is invalid");
  assert(stableJson(profile.eventClasses) === stableJson([0, 1, 2]), "calibration profile must contain exactly event classes 0, 1, and 2");
  assert(profile.meshSizeM === 0.025 && profile.driveCurrentA === 10, "calibration mesh/current profile is invalid");
  assert(profile.solverProfile === "direct-mumps-publication-v1", "calibration solver profile is invalid");
  assert(stableJson(profile.resources) === stableJson({ memoryGiB: 24, memorySwapGiB: 24, cpus: 2, meshThreads: 1, solverThreads: 2, serial: true }), "calibration resource profile is invalid");
  assert(Number.isInteger(profile.hardDeadlineSeconds) && profile.hardDeadlineSeconds > 0 && profile.hardDeadlineSeconds < 29 * 60, "calibration hard deadline must be below 29 minutes");
  assert(profile.energyCoenergyRelativeTolerance === 0.01, "energy/coenergy tolerance must be one percent");
  assert(profile.coarseFineDrift?.observed === 0.011584935659327932 && profile.coarseFineDrift.passTolerance === 0.02, "calibration coarse/fine drift profile is invalid");
  assert(stableJson(profile.coarseFineDrift.sample) === stableJson({
    domainId: "base",
    eventIndex: 0,
    rotorAngleDeg: 0,
    driveCurrentA: 10,
    coarseMeshLevelId: "coarse",
    fineMeshLevelId: "fine"
  }), "calibration pilot sample profile is invalid");
  assert(profile.outputFileName === "motor-fem-calibration-pack-v1.json", "calibration output file name is invalid");
}

function expectedSymmetryProof() {
  const eventMapBytes = readFileSync(EVENT_MAP_PATH);
  const caseBytes = readFileSync(CASE_PATH);
  const geometryBytes = readFileSync(GEOMETRY_PATH);
  return proveEventMapSymmetry({
    eventMap: JSON.parse(eventMapBytes),
    caseData: JSON.parse(caseBytes),
    geometryText: geometryBytes.toString("utf8"),
    eventMapBytes,
    caseBytes,
    geometryBytes
  });
}

function validatePilot(report, profile, modelInputHash, calibrationClass) {
  assert(report.contract === "edwin-gray-convergence-pilot" && report.contractVersion === 2, "pilot report contract is invalid");
  assert(report.status === "passed" && Array.isArray(report.failures) && report.failures.length === 0, "pilot report did not pass");
  const specification = readJson(CONVERGENCE_SPEC_PATH, "current convergence specification");
  assert(report.specification?.sha256 === sha256File(CONVERGENCE_SPEC_PATH), "pilot specification does not match the current convergence specification");
  assert(report.sourceFormulation === specification.sourceFormulation, "pilot source formulation does not match the current convergence specification");
  const sampleIdentity = profile.coarseFineDrift.sample;
  const expectedClass = calibrationClass.entry.parameters;
  assert(sampleIdentity.eventIndex === expectedClass.eventIndex
    && sameNumber(sampleIdentity.rotorAngleDeg, expectedClass.rotorAngleDeg)
    && sampleIdentity.driveCurrentA === expectedClass.driveCurrentA,
  "calibration pilot sample profile does not match calibration class 0");
  const meshLevels = Object.fromEntries(specification.production?.meshLevels?.map((level) => [level.id, level]) || []);
  assert(meshLevels[sampleIdentity.coarseMeshLevelId]?.meshSizeM === expectedClass.meshSizeM
    && Number.isFinite(meshLevels[sampleIdentity.fineMeshLevelId]?.meshSizeM)
    && meshLevels[sampleIdentity.fineMeshLevelId].meshSizeM < expectedClass.meshSizeM,
  "calibration pilot mesh pair does not match the current convergence specification");

  const samples = [sampleIdentity.coarseMeshLevelId, sampleIdentity.fineMeshLevelId].map((meshLevelId) => {
    const matches = report.samples?.filter((sample) => sample.domainId === sampleIdentity.domainId
      && sample.meshLevelId === meshLevelId
      && sample.eventIndex === sampleIdentity.eventIndex
      && sameNumber(sample.rotorAngleDeg, sampleIdentity.rotorAngleDeg)
      && sample.driveCurrentA === sampleIdentity.driveCurrentA) || [];
    assert(matches.length === 1, `pilot ${meshLevelId} sample identity does not match the calibration angle/event/current/mesh pair`);
    assert(matches[0].modelInputHash === modelInputHash, `pilot ${meshLevelId} sample model input hash does not match the calibration model`);
    return matches[0];
  });
  const observed = Math.max(...["magneticEnergyJ", "coEnergyJ", "inductanceH"].map((quantity) => {
    const coarse = samples[0].observables?.[quantity]?.value;
    const fine = samples[1].observables?.[quantity]?.value;
    assert(Number.isFinite(coarse) && Number.isFinite(fine), `pilot coarse/fine ${quantity} values are invalid`);
    return relativeDifference(coarse, fine);
  }));
  const check = report.checks?.find((item) => item.id === "mesh-observable-coarse-fine");
  assert(check?.status === "passed", "pilot coarse/fine drift check did not pass");
  assert(sameNumber(check.observed, observed) && sameNumber(check.observed, profile.coarseFineDrift.observed), "pilot coarse/fine drift does not match the bound sample pair");
  assert(check.tolerance === profile.coarseFineDrift.passTolerance, "pilot coarse/fine pass tolerance is invalid");
  return { observed, passTolerance: check.tolerance, sampleIdentity, specificationSha256: report.specification.sha256 };
}

function artifactPath(jobDir, category, name) {
  if (category === "inputs") return join(jobDir, name === "geometry" ? "geometry-wrapper.geo" : "getdp-wrapper.pro");
  if (category === "logs") return join(jobDir, `${name}.log`);
  return join(jobDir, name);
}

function validateCommandThreads(environment, eventClass) {
  for (const [phase, executable, threads] of [["mesh", "gmsh", 1], ["solve", "getdp", 2]]) {
    const command = environment.execution?.commands?.[phase];
    const args = [command?.command, ...(command?.options || [])];
    const executableIndex = args.lastIndexOf(executable);
    const threadIndex = args.indexOf("-nt", executableIndex);
    assert(executableIndex >= 0 && threadIndex > executableIndex && args[threadIndex + 1] === String(threads)
      && args.includes(`OMP_NUM_THREADS=${threads}`), `event class ${eventClass} ${executable} command thread count is invalid`);
  }
}

function validateCheckpointArtifacts(jobDir, checkpoint) {
  const direct = {
    environment: "solver-environment.json",
    mesh: "motor.msh",
    audit: "mesh-audit.json",
    convergence: "solver-convergence.json",
    result: "result.json"
  };
  for (const [name, file] of Object.entries(direct)) {
    const hash = checkpoint.artifacts?.[name];
    if (name === "convergence" && hash == null) continue;
    assert(SHA256.test(hash || ""), `checkpoint ${name} artifact hash is missing`);
    const path = join(jobDir, file);
    assert(existsSync(path) && sha256File(path) === hash, `checkpoint ${file} artifact hash mismatch`);
  }
  for (const category of ["inputs", "logs", "outputs"]) {
    const records = checkpoint.artifacts?.[category];
    assert(records && typeof records === "object" && Object.keys(records).length > 0, `checkpoint ${category} artifact hashes are incomplete`);
    for (const [name, hash] of Object.entries(records)) {
      assert(SHA256.test(hash || ""), `checkpoint ${category}/${name} artifact hash is missing`);
      const path = artifactPath(jobDir, category, name);
      assert(existsSync(path) && sha256File(path) === hash, `checkpoint ${relative(jobDir, path)} artifact hash mismatch`);
    }
  }
}

function validateJob(job, inventoryDir, profile, eventMap) {
  assert(Number.isInteger(job.eventClass), "inventory event class is invalid");
  const checkpointPath = resolve(inventoryDir, job.checkpoint);
  const resultPath = resolve(inventoryDir, job.result);
  assert(dirname(checkpointPath) === dirname(resultPath), `event class ${job.eventClass} checkpoint and result must share a job directory`);
  const jobDir = dirname(checkpointPath);
  const checkpoint = readJson(checkpointPath, `event class ${job.eventClass} checkpoint`);
  const result = readJson(resultPath, `event class ${job.eventClass} result`);
  const parameters = checkpoint.parameters;
  const event = eventMap.events.find((item) => item.eventIndex === job.eventClass);

  assert(checkpoint.checkpointVersion === "fem-checkpoint-v6", `event class ${job.eventClass} checkpoint version is invalid`);
  assert(checkpoint.phases?.mesh === "complete" && checkpoint.phases.solve === "complete" && checkpoint.phases.normalize === "complete", `event class ${job.eventClass} checkpoint is incomplete`);
  assert(checkpoint.meshQuality === "passed" && checkpoint.result === "result.json", `event class ${job.eventClass} checkpoint did not pass mesh/normalization gates`);
  assert(parameters?.eventIndex === job.eventClass && event, `event class ${job.eventClass} is not independently solved by its representative event`);
  assert(sameNumber(parameters.rotorAngleDeg, event.angleDegNumerator / 3), `event class ${job.eventClass} rotor angle is invalid`);
  assert(parameters.meshSizeM === profile.meshSizeM && parameters.driveCurrentA === profile.driveCurrentA, `event class ${job.eventClass} mesh/current is invalid`);
  assert(checkpoint.eventIndex === parameters.eventIndex && checkpoint.excitationContract === parameters.excitationContract, `event class ${job.eventClass} excitation checkpoint is invalid`);
  assert(SHA256.test(checkpoint.modelInputHash || "") && SHA256.test(checkpoint.jobInputHash || ""), `event class ${job.eventClass} model/job hash is invalid`);
  assert(checkpoint.inputHash === checkpoint.jobInputHash, `event class ${job.eventClass} input hash is invalid`);
  assert(checkpoint.backend === "docker", `event class ${job.eventClass} backend is not resource-bounded Docker`);
  assert(checkpoint.solverProfile?.name === profile.solverProfile && SHA256.test(checkpoint.solverProfile.configSha256 || ""), `event class ${job.eventClass} solver profile is invalid`);
  const expectedResources = { memoryGiB: 24, cpus: 2, memorySwapGiB: 24, meshThreads: 1, solverThreads: 2 };
  const expectedCommandPlan = {
    mesh: ["gmsh", "{geometry}", "-3", "-nt", "1", "-format", "msh4", "-o", "{mesh}"],
    solve: ["getdp", "{problem}", "-nt", "2", "-name", "{solution}", "-msh", "{mesh}", "-solve", "Magnetostatics3D", "-pos", "MagnetostaticResults", ...checkpoint.solverProfile.petscOptions]
  };
  assert(stableJson(checkpoint.resourceLimits) === stableJson(expectedResources), `event class ${job.eventClass} resource limits are invalid`);
  assert(checkpoint.solverEnvironment?.identityHash === checkpoint.environmentIdentityHash && SHA256.test(checkpoint.environmentIdentityHash || ""), `event class ${job.eventClass} environment identity is invalid`);
  assert(checkpoint.solverEnvironment.schemaVersion === "solver-environment-v3", `event class ${job.eventClass} environment version is invalid`);
  assert(checkpoint.environmentIdentityHash === sha256Bytes(Buffer.from(stableJson(checkpoint.solverEnvironment.identity))), `event class ${job.eventClass} environment identity hash mismatch`);
  assert(checkpoint.solverEnvironment.identity?.backend === "docker", `event class ${job.eventClass} environment backend is invalid`);
  assert(stableJson(checkpoint.solverEnvironment.identity?.commandPlan) === stableJson(expectedCommandPlan), `event class ${job.eventClass} command plan is invalid`);
  assert(stableJson(checkpoint.solverEnvironment.identity?.solver) === stableJson(checkpoint.solverProfile), `event class ${job.eventClass} environment solver profile differs from checkpoint`);
  assert(stableJson(checkpoint.solverEnvironment.identity?.resources) === stableJson(checkpoint.resourceLimits), `event class ${job.eventClass} environment resources differ from checkpoint limits`);
  assert(IMMUTABLE_IMAGE.test(checkpoint.solverEnvironment.identity?.image?.image || "")
    && IMMUTABLE_IMAGE.test(checkpoint.solverEnvironment.identity?.image?.digest || ""), `event class ${job.eventClass} environment image is not immutable`);
  validateCheckpointArtifacts(jobDir, checkpoint);
  validateCheckpointSolverEvidence(jobDir, checkpoint);

  const environment = readJson(join(jobDir, "solver-environment.json"), `event class ${job.eventClass} environment`);
  assert(environment.identityHash === checkpoint.environmentIdentityHash, `event class ${job.eventClass} environment manifest identity differs`);
  assert(stableJson(environment.resources) === stableJson(expectedResources)
    && stableJson(environment.commandPlan) === stableJson(expectedCommandPlan), `event class ${job.eventClass} environment manifest plan differs`);
  validateCommandThreads(environment, job.eventClass);
  const entry = result.entries?.[0];
  assert(result.contract === "edwin-gray-browser-result" && result.contractVersion === 1 && result.status === "complete" && result.entries?.length === 1 && entry?.status === "complete", `event class ${job.eventClass} normalized result is incomplete`);
  assert(stableJson(entry.parameters) === stableJson(parameters), `event class ${job.eventClass} result parameters differ from checkpoint`);
  assert(entry.provenance?.modelInputHash === checkpoint.modelInputHash && entry.provenance.jobInputHash === checkpoint.jobInputHash, `event class ${job.eventClass} result model/job hashes differ`);
  assert(Array.isArray(entry.provenance.artifacts) && entry.provenance.artifacts.length > 0, `event class ${job.eventClass} normalized artifact hashes are incomplete`);
  for (const artifact of entry.provenance.artifacts) {
    assert(SHA256.test(artifact.sha256 || ""), `event class ${job.eventClass} normalized artifact hash is invalid`);
    const path = resolve(jobDir, artifact.path);
    assert(path.startsWith(`${jobDir}/`) && existsSync(path) && sha256File(path) === artifact.sha256, `event class ${job.eventClass} normalized artifact ${artifact.path} hash mismatch`);
  }
  const energy = entry.observables?.magneticEnergyJ?.value;
  const coenergy = entry.observables?.coEnergyJ?.value;
  assert(Number.isFinite(energy) && Number.isFinite(coenergy) && relativeDifference(energy, coenergy) <= profile.energyCoenergyRelativeTolerance, `event class ${job.eventClass} energy/coenergy agreement exceeds one percent`);
  assert(Number.isFinite(entry.observables?.inductanceH?.value), `event class ${job.eventClass} inductance is invalid`);
  return { checkpointPath, resultPath, checkpoint, entry };
}

export function buildCalibrationPack({ inventoryPath, pilotReportPath, symmetryProofPath, profilePath = DEFAULT_PROFILE }) {
  const profile = readJson(resolve(profilePath), "calibration profile");
  validateProfile(profile);
  const inventory = readJson(resolve(inventoryPath), "calibration inventory");
  assert(inventory.contract === "edwin-gray-motor-fem-calibration-inventory" && inventory.contractVersion === 1, "calibration inventory contract is invalid");
  assert(inventory.status === "complete", "calibration inventory is incomplete");
  assert(stableJson(inventory.execution) === stableJson({ serial: true, hardDeadlineSeconds: profile.hardDeadlineSeconds }), "calibration inventory resource/wall execution contract is invalid");
  assert(Array.isArray(inventory.jobs) && inventory.jobs.length === 3, "calibration inventory must contain exactly three jobs");
  const classes = inventory.jobs.map((job) => job.eventClass).sort((left, right) => left - right);
  assert(stableJson(classes) === stableJson(profile.eventClasses), "calibration inventory must cover exactly event classes 0, 1, and 2");

  const suppliedProof = readJson(resolve(symmetryProofPath), "event-map symmetry proof");
  validateEventMapSymmetryProof(suppliedProof);
  assert(stableJson(suppliedProof) === stableJson(expectedSymmetryProof()), "event-map 40-degree symmetry proof does not match current model inputs");

  const eventMap = readJson(EVENT_MAP_PATH, "event map");
  const verified = inventory.jobs
    .map((job) => ({ eventClass: job.eventClass, ...validateJob(job, dirname(resolve(inventoryPath)), profile, eventMap) }))
    .sort((left, right) => left.eventClass - right.eventClass);
  const modelHashes = new Set(verified.map((item) => item.checkpoint.modelInputHash));
  const environmentHashes = new Set(verified.map((item) => item.checkpoint.environmentIdentityHash));
  assert(modelHashes.size === 1, "calibration jobs do not share one model input hash");
  assert(environmentHashes.size === 1, "calibration jobs do not share one solver environment");
  const pilotPath = resolve(pilotReportPath);
  const pilot = readJson(pilotPath, "pilot report");
  const pilotEvidence = validatePilot(pilot, profile, verified[0].checkpoint.modelInputHash, verified[0]);

  return {
    contract: "edwin-gray-motor-fem-calibration-pack",
    contractVersion: 2,
    profileId: profile.profileId,
    status: "limited-assumption-only",
    productionEligible: false,
    fullConvergenceClaim: false,
    optIn: true,
    defaultEnabled: false,
    configuration: {
      eventClasses: profile.eventClasses,
      meshSizeM: profile.meshSizeM,
      driveCurrentA: profile.driveCurrentA,
      solverProfile: profile.solverProfile,
      resources: {
        memoryGiB: profile.resources.memoryGiB,
        memorySwapGiB: profile.resources.memorySwapGiB,
        cpus: profile.resources.cpus,
        threads: profile.resources.solverThreads,
        serial: profile.resources.serial
      },
      hardDeadlineSeconds: profile.hardDeadlineSeconds
    },
    evidence: {
      modelInputHash: verified[0].checkpoint.modelInputHash,
      environmentIdentityHash: verified[0].checkpoint.environmentIdentityHash,
      pilotReportSha256: sha256File(pilotPath),
      pilotSpecificationSha256: pilotEvidence.specificationSha256,
      symmetryProofSha256: suppliedProof.proofSha256,
      coarseFineDrift: {
        observed: pilotEvidence.observed,
        passTolerance: pilotEvidence.passTolerance,
        status: "single-pair-observation",
        sample: pilotEvidence.sampleIdentity
      }
    },
    classes: verified.map((item) => ({
      eventClass: item.eventClass,
      eventIndex: item.entry.parameters.eventIndex,
      rotorAngleDeg: item.entry.parameters.rotorAngleDeg,
      jobInputHash: item.checkpoint.jobInputHash,
      checkpointSha256: sha256File(item.checkpointPath),
      resultSha256: sha256File(item.resultPath),
      observables: item.entry.observables,
      evidenceBasis: item.eventClass === 0 ? "single-pair-observation" : "transfer-assumption"
    })),
    uncertainty: {
      established: false,
      relativeBound: null,
      reason: "A pilot pass tolerance is an acceptance criterion, not an established uncertainty bound.",
      quantities: ["L", "W", "W'"],
      classBasis: { "0": "single-pair-observation", "1": "transfer-assumption", "2": "transfer-assumption" }
    },
    torque: { bounded: false, reason: "No torque-derivative convergence evidence is included in this limited calibration pack." },
    limitations: [
      "Limited coarse calibration evidence only; not a production FEM lookup table.",
      "The class 0 pilot records one coarse/fine observation, not an established uncertainty bound.",
      "Classes 1 and 2 have no matching mesh-pair evidence; transfer is an explicit assumption only.",
      "No full mesh, outer-domain, or torque convergence claim is made."
    ]
  };
}

function checkpointFiles(root) {
  const found = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === "checkpoint.json") found.push(path);
    }
  }
  visit(root);
  return found.sort();
}

export function blockedExistingInventory(runsPath) {
  const root = resolve(runsPath);
  assert(existsSync(root), `existing runs path does not exist: ${runsPath}`);
  const jobs = checkpointFiles(root).flatMap((path) => {
    const checkpoint = readJson(path, `existing checkpoint ${relative(root, path)}`);
    const eventIndex = checkpoint.parameters?.eventIndex;
    if (eventIndex !== 0 && eventIndex !== 9) return [];
    return [{
      checkpoint: relative(root, path),
      jobId: checkpoint.jobId || basename(dirname(path)),
      eventIndex,
      eventClass: eventIndex % 3,
      phases: checkpoint.phases || {},
      modelInputHash: SHA256.test(checkpoint.modelInputHash || "") ? checkpoint.modelInputHash : null,
      environmentIdentityHash: SHA256.test(checkpoint.environmentIdentityHash || "") ? checkpoint.environmentIdentityHash : null
    }];
  }).sort((left, right) => left.checkpoint.localeCompare(right.checkpoint));
  const availableClasses = [...new Set(jobs.map((job) => job.eventClass))].sort((left, right) => left - right);
  const missingClasses = [0, 1, 2].filter((eventClass) => !availableClasses.includes(eventClass));
  return {
    contract: "edwin-gray-motor-fem-calibration-blocked-inventory",
    contractVersion: 1,
    status: "blocked-missing-event-classes",
    sourceEventIndices: [0, 9],
    availableClasses,
    missingClasses,
    productionEligible: false,
    jobs
  };
}

function main(argv) {
  const options = parseArgs(argv);
  assert(options.out, "--out is required");
  const output = resolve(options.out);
  if (options["existing-only"] === "true") {
    assert(options.runs, "--existing-only requires --runs");
    assert(basename(output) !== "motor-fem-lut-v1.json", "calibration infrastructure cannot write motor-fem-lut-v1.json");
    const blocked = blockedExistingInventory(options.runs);
    writeJsonAtomic(output, blocked);
    console.log(JSON.stringify({ status: blocked.status, output, jobs: blocked.jobs.length, missingClasses: blocked.missingClasses }));
    process.exitCode = 2;
    return;
  }
  assert(basename(output) === "motor-fem-calibration-pack-v1.json", "complete calibration output must be motor-fem-calibration-pack-v1.json");
  assert(options.inventory && options["pilot-report"] && options["symmetry-proof"], "complete calibration requires --inventory, --pilot-report, and --symmetry-proof");
  const pack = buildCalibrationPack({
    inventoryPath: options.inventory,
    pilotReportPath: options["pilot-report"],
    symmetryProofPath: options["symmetry-proof"],
    profilePath: options.profile
  });
  writeJsonAtomic(output, pack);
  console.log(JSON.stringify({ status: pack.status, output, sha256: sha256File(output), classes: pack.classes.length }));
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`calibration-pack: ${error.message}`);
    process.exitCode = 1;
  }
}

export { expectedSymmetryProof, sha256Bytes, writeJsonAtomic };
