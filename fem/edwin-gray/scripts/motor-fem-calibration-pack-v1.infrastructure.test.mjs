import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { blockedExistingInventory, buildCalibrationPack, expectedSymmetryProof } from "../calibration/build-calibration-pack.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROFILE_PATH = resolve(ROOT, "calibration/profile-v1.json");
const SCENARIOS_PATH = resolve(ROOT, "calibration/fixtures/calibration-pack-scenarios-v1.json");
const SCHEMA_PATH = resolve(ROOT, "schema/motor-fem-calibration-pack.schema.json");
const RUNNER_PATH = resolve(ROOT, "calibration/run-calibration-pack.mjs");
const PROFILE = JSON.parse(readFileSync(PROFILE_PATH, "utf8"));
const SCENARIOS = JSON.parse(readFileSync(SCENARIOS_PATH, "utf8"));
const MODEL_HASH = sha256("one calibration model");
const SOLVER_CONFIG_HASH = sha256("direct MUMPS fixture profile");
const IMAGE_DIGEST = `sha256:${"d".repeat(64)}`;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function jobFixture(root, eventClass) {
  const jobDir = join(root, "jobs", `event-${eventClass}`);
  mkdirSync(jobDir, { recursive: true });
  const jobInputHash = sha256(`calibration job ${eventClass}`);
  const rotorAngleDeg = eventClass * 40 / 3;
  const parameters = {
    rotorAngleDeg,
    eventIndex: eventClass,
    excitationContract: "edwin-gray-fem-excitation-event-map/v1",
    meshSizeM: 0.025,
    driveCurrentA: 10
  };
  const values = {
    magneticEnergyJ: 0.25 + eventClass * 0.01,
    coEnergyJ: (0.25 + eventClass * 0.01) * 1.005,
    inductanceH: 0.005 + eventClass * 0.0001
  };
  const solverProfile = {
    configSha256: SOLVER_CONFIG_HASH,
    name: "direct-mumps-publication-v1"
  };
  const environmentIdentity = {
    backend: "docker",
    threadCount: 2,
    solver: solverProfile,
    resources: { memoryGiB: 24, cpus: 2, memorySwapGiB: 24 },
    image: { image: IMAGE_DIGEST, digest: IMAGE_DIGEST }
  };
  const environmentHash = sha256(stableJson(environmentIdentity));
  const environment = {
    schemaVersion: "solver-environment-v2",
    identityHash: environmentHash,
    backend: "docker",
    threadCount: 2,
    solver: solverProfile,
    resources: environmentIdentity.resources,
    image: environmentIdentity.image,
    execution: { threadCount: 2 }
  };
  const files = {
    "solver-environment.json": `${JSON.stringify(environment)}\n`,
    "geometry-wrapper.geo": `// event ${eventClass} geometry\n`,
    "getdp-wrapper.pro": `// event ${eventClass} GetDP\n`,
    "motor.msh": `$MeshFormat\n4.1 0 8\n$EndMeshFormat\n// event ${eventClass}\n`,
    "mesh-audit.json": `${JSON.stringify({ valid: true, eventClass })}\n`,
    "gmsh.log": `event ${eventClass} mesh complete\n`,
    "getdp.log": `event ${eventClass} solve complete\n`,
    "observables.dat": `MagneticEnergyJ ${values.magneticEnergyJ}\n`,
    "coenergy.dat": `CoEnergyJ ${values.coEnergyJ}\n`,
    "inductance.dat": `InductanceH ${values.inductanceH}\n`
  };
  for (const [name, content] of Object.entries(files)) writeFileSync(join(jobDir, name), content, "utf8");

  const normalizedArtifacts = ["motor.msh", "mesh-audit.json", "getdp.log", "observables.dat", "coenergy.dat", "inductance.dat"]
    .map((path) => ({ path, sha256: sha256(files[path]) }));
  const result = {
    contract: "edwin-gray-browser-result",
    contractVersion: 1,
    lutContract: "motor-fem-lut-v1",
    caseId: "patent-3890548-illustrative",
    status: "complete",
    expectedAnglesDeg: [rotorAngleDeg],
    entries: [{
      entryId: `event-${eventClass}`,
      status: "complete",
      parameters,
      observables: {
        magneticEnergyJ: { value: values.magneticEnergyJ, unit: "J" },
        coEnergyJ: { value: values.coEnergyJ, unit: "J" },
        inductanceH: { value: values.inductanceH, unit: "H" }
      },
      provenance: {
        synthetic: false,
        sourceFormat: "getdp-table",
        modelInputHash: MODEL_HASH,
        jobInputHash,
        inputHash: jobInputHash,
        solver: "getdp",
        backend: "docker",
        symmetryApplied: false,
        artifacts: normalizedArtifacts
      }
    }],
    provenance: { synthetic: false, limitations: ["calibration test fixture"], source: "calibration test fixture" }
  };
  const resultPath = join(jobDir, "result.json");
  writeJson(resultPath, result);
  const checkpoint = {
    checkpointVersion: "fem-checkpoint-v6",
    jobId: `event-${eventClass}`,
    inputHash: jobInputHash,
    modelInputHash: MODEL_HASH,
    jobInputHash,
    parameters,
    backend: "docker",
    solverProfile,
    resourceLimits: { memoryGiB: 24, cpus: 2, memorySwapGiB: 24 },
    environmentIdentityHash: environmentHash,
    solverEnvironment: {
      schemaVersion: "solver-environment-v2",
      identityHash: environmentHash,
      identity: environmentIdentity
    },
    resultContract: "edwin-gray-browser-result@1",
    excitationContract: parameters.excitationContract,
    eventIndex: eventClass,
    meshQuality: "passed",
    phases: { mesh: "complete", solve: "complete", normalize: "complete" },
    artifacts: {
      environment: sha256(files["solver-environment.json"]),
      inputs: {
        geometry: sha256(files["geometry-wrapper.geo"]),
        getdp: sha256(files["getdp-wrapper.pro"])
      },
      mesh: sha256(files["motor.msh"]),
      audit: sha256(files["mesh-audit.json"]),
      logs: { gmsh: sha256(files["gmsh.log"]), getdp: sha256(files["getdp.log"]) },
      convergence: null,
      outputs: {
        "observables.dat": sha256(files["observables.dat"]),
        "coenergy.dat": sha256(files["coenergy.dat"]),
        "inductance.dat": sha256(files["inductance.dat"])
      },
      result: sha256(readFileSync(resultPath))
    },
    result: "result.json"
  };
  const checkpointPath = join(jobDir, "checkpoint.json");
  writeJson(checkpointPath, checkpoint);
  return { eventClass, jobDir, checkpointPath, resultPath };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "motor-fem-calibration-pack-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const jobs = [0, 1, 2].map((eventClass) => jobFixture(root, eventClass));
  const inventoryPath = join(root, "calibration-inventory-v1.json");
  writeJson(inventoryPath, {
    contract: "edwin-gray-motor-fem-calibration-inventory",
    contractVersion: 1,
    status: "complete",
    execution: { serial: true, hardDeadlineSeconds: 1720 },
    jobs: jobs.map((job) => ({
      eventClass: job.eventClass,
      checkpoint: relative(root, job.checkpointPath),
      result: relative(root, job.resultPath)
    }))
  });
  const pilotReportPath = join(root, "pilot-report.json");
  writeJson(pilotReportPath, {
    contract: "edwin-gray-convergence-pilot",
    contractVersion: 2,
    status: "passed",
    failures: [],
    checks: [{
      id: "mesh-observable-coarse-fine",
      status: "passed",
      observed: 0.011584935659327932,
      tolerance: 0.02
    }]
  });
  const symmetryProofPath = join(root, "event-map-symmetry-proof-v1.json");
  writeJson(symmetryProofPath, expectedSymmetryProof());
  return { root, jobs, inventoryPath, pilotReportPath, symmetryProofPath };
}

function build(context) {
  return buildCalibrationPack({
    inventoryPath: context.inventoryPath,
    pilotReportPath: context.pilotReportPath,
    symmetryProofPath: context.symmetryProofPath,
    profilePath: PROFILE_PATH
  });
}

function rewriteCheckpoint(job, update) {
  const checkpoint = JSON.parse(readFileSync(job.checkpointPath, "utf8"));
  update(checkpoint);
  writeJson(job.checkpointPath, checkpoint);
}

test("calibration fixture declarations cover every required pass and failure mode", () => {
  assert.equal(SCENARIOS.contractVersion, 1);
  assert.deepEqual(SCENARIOS.scenarios.map((scenario) => scenario.id), [
    "pass",
    "blocked-current-inventory",
    "tampering",
    "mixed-environment",
    "resource-limit",
    "wall-limit",
    "missing-class"
  ]);
});

test("complete calibration evidence builds the deterministic limited contract", (t) => {
  const context = fixture(t);
  const first = build(context);
  const second = build(context);
  assert.deepEqual(first, second);
  assert.equal(first.status, "limited-not-validated");
  assert.equal(first.productionEligible, false);
  assert.equal(first.fullConvergenceClaim, false);
  assert.equal(first.optIn, true);
  assert.equal(first.defaultEnabled, false);
  assert.deepEqual(first.classes.map((item) => item.eventClass), [0, 1, 2]);
  assert.deepEqual(first.uncertainty, {
    relativeBound: 0.02,
    quantities: ["L", "W", "W'"],
    classBasis: { "0": "measured", "1": "transfer-assumed", "2": "transfer-assumed" }
  });
  assert.equal(first.torque.bounded, false);
  assert.equal(first.evidence.coarseFineDrift.measured, 0.011584935659327932);
});

test("current event 0/9 inventory blocks deterministically without inventing classes", (t) => {
  const root = mkdtempSync(join(tmpdir(), "motor-fem-calibration-existing-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const eventIndex of [9, 0]) {
    writeJson(join(root, `event-${eventIndex}`, "checkpoint.json"), {
      checkpointVersion: "fem-checkpoint-v6",
      jobId: `event-${eventIndex}`,
      modelInputHash: MODEL_HASH,
      environmentIdentityHash: sha256(`existing environment ${eventIndex}`),
      parameters: { eventIndex },
      phases: { mesh: "complete", solve: eventIndex === 0 ? "complete" : "pending", normalize: eventIndex === 0 ? "complete" : "pending" }
    });
  }
  const first = blockedExistingInventory(root);
  const second = blockedExistingInventory(root);
  assert.deepEqual(first, second);
  assert.equal(first.status, "blocked-missing-event-classes");
  assert.deepEqual(first.sourceEventIndices, [0, 9]);
  assert.deepEqual(first.availableClasses, [0]);
  assert.deepEqual(first.missingClasses, [1, 2]);
  assert.deepEqual(first.jobs.map((job) => job.eventIndex).sort((left, right) => left - right), [0, 9]);
});

test("artifact tampering is rejected after checkpoint attestation", (t) => {
  const context = fixture(t);
  writeFileSync(join(context.jobs[0].jobDir, "observables.dat"), "MagneticEnergyJ 999\n", "utf8");
  assert.throws(() => build(context), /artifact hash mismatch/);
});

test("coherently attested mixed solver environments are rejected", (t) => {
  const context = fixture(t);
  const environmentPath = join(context.jobs[2].jobDir, "solver-environment.json");
  const environment = JSON.parse(readFileSync(environmentPath, "utf8"));
  rewriteCheckpoint(context.jobs[2], (checkpoint) => {
    checkpoint.solverEnvironment.identity.image = { image: `sha256:${"e".repeat(64)}`, digest: `sha256:${"e".repeat(64)}` };
    const coherentHash = sha256(stableJson(checkpoint.solverEnvironment.identity));
    checkpoint.environmentIdentityHash = coherentHash;
    checkpoint.solverEnvironment.identityHash = coherentHash;
    environment.identityHash = coherentHash;
    writeJson(environmentPath, environment);
    checkpoint.artifacts.environment = sha256(readFileSync(environmentPath));
  });
  assert.throws(() => build(context), /do not share one solver environment/);
});

test("resource and hard wall limit drift fail closed", async (t) => {
  await t.test("resource cap", () => {
    const context = fixture(t);
    rewriteCheckpoint(context.jobs[1], (checkpoint) => {
      checkpoint.resourceLimits.memoryGiB = 23;
    });
    assert.throws(() => build(context), /resource limits are invalid/);
  });
  await t.test("hard deadline", () => {
    const context = fixture(t);
    const inventory = JSON.parse(readFileSync(context.inventoryPath, "utf8"));
    inventory.execution.hardDeadlineSeconds = 1740;
    writeJson(context.inventoryPath, inventory);
    assert.throws(() => build(context), /resource\/wall execution contract is invalid/);
  });
});

test("missing event class cannot produce a calibration pack", (t) => {
  const context = fixture(t);
  const inventory = JSON.parse(readFileSync(context.inventoryPath, "utf8"));
  inventory.jobs.pop();
  writeJson(context.inventoryPath, inventory);
  assert.throws(() => build(context), /exactly three jobs/);
});

test("runner plan is serial, resource-bounded, deadline-bounded, and LUT-safe", () => {
  const image = `fixture@sha256:${"a".repeat(64)}`;
  const run = spawnSync(process.execPath, [
    RUNNER_PATH,
    "--plan", "true",
    "--docker-image", image,
    "--pilot-report", "/not-read-in-plan.json",
    "--work-dir", "/tmp/calibration-plan",
    "--out", "/tmp/calibration-plan/motor-fem-calibration-pack-v1.json",
    "--solver-profile", "direct-mumps-publication-v1",
    "--memory-gib", "24",
    "--cpus", "2",
    "--threads", "2",
    "--hard-timeout-seconds", "1720"
  ], { cwd: ROOT, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const plan = JSON.parse(run.stdout);
  assert.deepEqual(plan.execution, { serial: true, hardDeadlineSeconds: 1720 });
  assert.deepEqual(plan.commands.map((item) => item.eventClass), [0, 1, 2]);
  assert(plan.commands.every((item) => item.timeout.includes("1720s")));
  assert(plan.commands.every((item) => item.command.includes("--publication")));
  assert(plan.commands.every((item) => item.command.includes("direct-mumps-publication-v1")));
  assert(!JSON.stringify(plan).includes("motor-fem-lut-v1.json"));
});

test("calibration schema fixes the non-production output contract", () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.properties.status.const, "limited-not-validated");
  assert.equal(schema.properties.productionEligible.const, false);
  assert.equal(schema.properties.fullConvergenceClaim.const, false);
  assert.equal(schema.properties.defaultEnabled.const, false);
  assert.deepEqual(schema.properties.configuration.properties.eventClasses.const, [0, 1, 2]);
  assert.equal(schema.properties.configuration.properties.hardDeadlineSeconds.exclusiveMaximum, 1740);
  assert.equal(PROFILE.hardDeadlineSeconds, 1720);
});
