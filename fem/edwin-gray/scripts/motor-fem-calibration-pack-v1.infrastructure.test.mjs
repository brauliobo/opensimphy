import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { blockedExistingInventory, buildCalibrationPack, expectedSymmetryProof } from "../calibration/build-calibration-pack.mjs";
import { collectSolverEvidence } from "../calibration/solver-evidence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROFILE_PATH = resolve(ROOT, "calibration/profile-v1.json");
const SCENARIOS_PATH = resolve(ROOT, "calibration/fixtures/calibration-pack-scenarios-v1.json");
const SCHEMA_PATH = resolve(ROOT, "schema/motor-fem-calibration-pack.schema.json");
const SPEC_PATH = resolve(ROOT, "convergence/convergence-spec-v2.json");
const EVIDENCE_PATH = resolve(ROOT, "evidence/v2/motor-fem-calibration-pack-v1.json");
const MANIFEST_PATH = resolve(ROOT, "evidence/v2/manifest.json");
const PUBLIC_PACK_PATH = resolve(ROOT, "../../public/data/generated/edwin-gray/motor-fem-calibration-pack-v1.json");
const RUNNER_PATH = resolve(ROOT, "calibration/run-calibration-pack.mjs");
const PROFILE = JSON.parse(readFileSync(PROFILE_PATH, "utf8"));
const SCENARIOS = JSON.parse(readFileSync(SCENARIOS_PATH, "utf8"));
const MODEL_HASH = sha256("one calibration model");
const SOLVER_CONFIG_HASH = sha256("direct MUMPS fixture profile");
const IMAGE_DIGEST = `sha256:${"d".repeat(64)}`;
const PETSC_OPTIONS = [
  "-ksp_type", "preonly",
  "-pc_type", "lu",
  "-pc_factor_mat_solver_type", "mumps",
  "-ksp_monitor_true_residual",
  "-ksp_converged_reason",
  "-ksp_error_if_not_converged"
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function schemaMatches(value, schema, root) {
  try {
    validateSchema(value, schema, "value", root);
    return true;
  } catch {
    return false;
  }
}

function validateSchema(value, schema, path, root) {
  if (schema.$ref) {
    assert.match(schema.$ref, /^#\/\$defs\//, `${path} has an unsupported schema reference`);
    validateSchema(value, root.$defs[schema.$ref.slice("#/$defs/".length)], path, root);
    return;
  }
  if (Object.hasOwn(schema, "const")) assert.deepEqual(value, schema.const, `${path} differs from its schema constant`);
  if (schema.enum) assert.ok(schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value)), `${path} is outside its schema enum`);
  if (schema.type === "object") {
    assert.ok(value && typeof value === "object" && !Array.isArray(value), `${path} must be an object`);
    for (const key of schema.required || []) assert.ok(Object.hasOwn(value, key), `${path}.${key} is required`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) assert.ok(Object.hasOwn(schema.properties || {}, key), `${path}.${key} is not allowed`);
    }
    for (const [key, child] of Object.entries(schema.properties || {})) {
      if (Object.hasOwn(value, key)) validateSchema(value[key], child, `${path}.${key}`, root);
    }
  } else if (schema.type === "array") {
    assert.ok(Array.isArray(value), `${path} must be an array`);
    if (schema.minItems !== undefined) assert.ok(value.length >= schema.minItems, `${path} has too few items`);
    if (schema.maxItems !== undefined) assert.ok(value.length <= schema.maxItems, `${path} has too many items`);
    if (schema.items) value.forEach((item, index) => validateSchema(item, schema.items, `${path}[${index}]`, root));
  } else if (schema.type === "string") {
    assert.equal(typeof value, "string", `${path} must be a string`);
    if (schema.minLength !== undefined) assert.ok(value.length >= schema.minLength, `${path} is too short`);
    if (schema.pattern) assert.match(value, new RegExp(schema.pattern), `${path} has an invalid format`);
  } else if (schema.type === "number" || schema.type === "integer") {
    assert.ok(typeof value === "number" && Number.isFinite(value), `${path} must be finite`);
    if (schema.type === "integer") assert.ok(Number.isInteger(value), `${path} must be an integer`);
    if (schema.minimum !== undefined) assert.ok(value >= schema.minimum, `${path} is below its minimum`);
    if (schema.maximum !== undefined) assert.ok(value <= schema.maximum, `${path} is above its maximum`);
    if (schema.exclusiveMaximum !== undefined) assert.ok(value < schema.exclusiveMaximum, `${path} is above its exclusive maximum`);
  } else if (schema.type === "boolean") {
    assert.equal(typeof value, "boolean", `${path} must be a boolean`);
  }
  if (schema.contains) {
    assert.ok(Array.isArray(value), `${path} contains applies only to arrays`);
    const count = value.filter((item) => schemaMatches(item, schema.contains, root)).length;
    assert.ok(count >= (schema.minContains ?? 1), `${path} has too few matching items`);
    if (schema.maxContains !== undefined) assert.ok(count <= schema.maxContains, `${path} has too many matching items`);
  }
  for (const child of schema.allOf || []) validateSchema(value, child, path, root);
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
    name: "direct-mumps-publication-v1",
    mode: "direct",
    kspType: "preonly",
    pcType: "lu",
    factorSolverType: "mumps",
    petscOptions: PETSC_OPTIONS
  };
  const resources = { memoryGiB: 24, cpus: 2, memorySwapGiB: 24, meshThreads: 1, solverThreads: 2 };
  const commandPlan = {
    mesh: ["gmsh", "{geometry}", "-3", "-nt", "1", "-format", "msh4", "-o", "{mesh}"],
    solve: ["getdp", "{problem}", "-nt", "2", "-name", "{solution}", "-msh", "{mesh}", "-solve", "Magnetostatics3D", "-pos", "MagnetostaticResults", ...PETSC_OPTIONS]
  };
  const environmentIdentity = {
    backend: "docker",
    solver: solverProfile,
    resources,
    commandPlan,
    image: { image: IMAGE_DIGEST, digest: IMAGE_DIGEST }
  };
  const environmentHash = sha256(stableJson(environmentIdentity));
  const environment = {
    schemaVersion: "solver-environment-v3",
    identityHash: environmentHash,
    backend: "docker",
    solver: solverProfile,
    resources,
    commandPlan,
    image: environmentIdentity.image,
    execution: {
      meshThreads: 1,
      solverThreads: 2,
      resources,
      solver: solverProfile,
      commands: {
        mesh: { command: "docker", options: ["run", "-e", "OMP_NUM_THREADS=1", IMAGE_DIGEST, "gmsh", "/workspace/geometry.geo", "-3", "-nt", "1"] },
        solve: { command: "docker", options: ["run", "-e", "OMP_NUM_THREADS=2", IMAGE_DIGEST, "getdp", "/output/problem.pro", "-nt", "2"] }
      }
    }
  };
  const files = {
    "solver-environment.json": `${JSON.stringify(environment)}\n`,
    "geometry-wrapper.geo": `// event ${eventClass} geometry\n`,
    "getdp-wrapper.pro": `// event ${eventClass} GetDP\n`,
    "motor.msh": `$MeshFormat\n4.1 0 8\n$EndMeshFormat\n// event ${eventClass}\n`,
    "mesh-audit.json": `${JSON.stringify({ valid: true, eventClass })}\n`,
    "gmsh.log": `event ${eventClass} mesh complete\n`,
    "getdp.log": [
      "Info    : N: 1320328 - preonly lu mumps",
      "Linear solve converged due to CONVERGED_ITS iterations 1",
      "Info    : SaveSolution[Sys_Mag]",
      `Info    : PostOperation 'MagnetostaticResults' 1/5\n          > '${join(jobDir, "magnetic-potential.pos")}'`,
      `Info    : PostOperation 'MagnetostaticResults' 2/5\n          > '${join(jobDir, "magnetic-flux-density.pos")}'`,
      `Info    : PostOperation 'MagnetostaticResults' 3/5\n          > '${join(jobDir, "observables.dat")}'`,
      `Info    : PostOperation 'MagnetostaticResults' 4/5\n          > '${join(jobDir, "coenergy.dat")}'`,
      `Info    : PostOperation 'MagnetostaticResults' 5/5\n          > '${join(jobDir, "inductance.dat")}'`,
      "E n d   P o s t - P r o c e s s i n g",
      "Info    : Stopped (fixture, Wall = 2.5s, CPU = 2.0s, Mem = 64.0Mb)\n"
    ].join("\n"),
    "magnetic-potential.pos": `event ${eventClass} potential\n`,
    "magnetic-flux-density.pos": `event ${eventClass} flux density\n`,
    "observables.dat": `MagneticEnergyJ ${values.magneticEnergyJ}\n`,
    "coenergy.dat": `CoEnergyJ ${values.coEnergyJ}\n`,
    "inductance.dat": `InductanceH ${values.inductanceH}\n`
  };
  for (const [name, content] of Object.entries(files)) writeFileSync(join(jobDir, name), content, "utf8");
  const solverEvidence = collectSolverEvidence({ jobDir, solver: solverProfile, getdpExitStatus: 0 });
  files["solver-convergence.json"] = `${JSON.stringify(solverEvidence, null, 2)}\n`;
  writeFileSync(join(jobDir, "solver-convergence.json"), files["solver-convergence.json"], "utf8");

  const normalizedArtifacts = ["motor.msh", "mesh-audit.json", "getdp.log", "solver-convergence.json", "magnetic-potential.pos", "magnetic-flux-density.pos", "observables.dat", "coenergy.dat", "inductance.dat"]
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
    resourceLimits: resources,
    environmentIdentityHash: environmentHash,
    solverEnvironment: {
      schemaVersion: "solver-environment-v3",
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
      convergence: sha256(files["solver-convergence.json"]),
      outputs: {
        "magnetic-potential.pos": sha256(files["magnetic-potential.pos"]),
        "magnetic-flux-density.pos": sha256(files["magnetic-flux-density.pos"]),
        "observables.dat": sha256(files["observables.dat"]),
        "coenergy.dat": sha256(files["coenergy.dat"]),
        "inductance.dat": sha256(files["inductance.dat"])
      },
      result: sha256(readFileSync(resultPath))
    },
    solverConvergence: solverEvidence,
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
  const pilotSamples = [
    {
      id: "base-coarse-i10-a0-e0",
      domainId: "base",
      meshLevelId: "coarse",
      driveCurrentA: 10,
      rotorAngleDeg: 0,
      eventIndex: 0,
      observables: {
        magneticEnergyJ: { value: 0.2532810462193057, unit: "J" },
        coEnergyJ: { value: 0.2532810462193057, unit: "J" },
        inductanceH: { value: 0.005065620924386578, unit: "H" }
      },
      modelInputHash: MODEL_HASH
    },
    {
      id: "base-fine-i10-a0-e0",
      domainId: "base",
      meshLevelId: "fine",
      driveCurrentA: 10,
      rotorAngleDeg: 0,
      eventIndex: 0,
      observables: {
        magneticEnergyJ: { value: 0.2562496823014917, unit: "J" },
        coEnergyJ: { value: 0.2562496823014917, unit: "J" },
        inductanceH: { value: 0.005124993646029731, unit: "H" }
      },
      modelInputHash: MODEL_HASH
    }
  ];
  writeJson(pilotReportPath, {
    contract: "edwin-gray-convergence-pilot",
    contractVersion: 2,
    sourceFormulation: "closed-surface-equivalent-current-potential",
    specification: { sha256: sha256(readFileSync(SPEC_PATH)) },
    status: "passed",
    failures: [],
    checks: [{
      id: "mesh-observable-coarse-fine",
      status: "passed",
      observed: 0.011584935659327932,
      tolerance: 0.02
    }],
    samples: pilotSamples
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

function rewriteGetdpLog(job, update) {
  const path = join(job.jobDir, "getdp.log");
  writeFileSync(path, update(readFileSync(path, "utf8")), "utf8");
  rewriteCheckpoint(job, (checkpoint) => {
    checkpoint.artifacts.logs.getdp = sha256(readFileSync(path));
  });
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
    "missing-class",
    "pilot-model-mismatch",
    "pilot-spec-mismatch",
    "pilot-sample-mismatch"
  ]);
});

test("exactly bound calibration evidence builds a deterministic assumption-only contract", (t) => {
  const context = fixture(t);
  const first = build(context);
  const second = build(context);
  assert.deepEqual(first, second);
  assert.equal(first.contractVersion, 2);
  assert.equal(first.status, "limited-assumption-only");
  assert.equal(first.productionEligible, false);
  assert.equal(first.fullConvergenceClaim, false);
  assert.equal(first.optIn, true);
  assert.equal(first.defaultEnabled, false);
  assert.deepEqual(first.classes.map((item) => item.eventClass), [0, 1, 2]);
  assert.deepEqual(first.uncertainty, {
    established: false,
    relativeBound: null,
    reason: "A pilot pass tolerance is an acceptance criterion, not an established uncertainty bound.",
    quantities: ["L", "W", "W'"],
    classBasis: { "0": "single-pair-observation", "1": "transfer-assumption", "2": "transfer-assumption" }
  });
  assert.equal(first.torque.bounded, false);
  assert.equal(first.evidence.coarseFineDrift.observed, 0.011584935659327932);
  assert.equal(first.evidence.coarseFineDrift.passTolerance, 0.02);
  assert.equal(JSON.stringify(first).includes('"relativeBound":0.02'), false);
});

test("pilot provenance and sample identity mismatches fail closed", async (t) => {
  await t.test("model input hash", () => {
    const context = fixture(t);
    const pilot = JSON.parse(readFileSync(context.pilotReportPath, "utf8"));
    pilot.samples[0].modelInputHash = sha256("different model");
    writeJson(context.pilotReportPath, pilot);
    assert.throws(() => build(context), /pilot coarse sample model input hash does not match the calibration model/);
  });
  await t.test("convergence specification", () => {
    const context = fixture(t);
    const pilot = JSON.parse(readFileSync(context.pilotReportPath, "utf8"));
    pilot.specification.sha256 = sha256("different specification");
    writeJson(context.pilotReportPath, pilot);
    assert.throws(() => build(context), /pilot specification does not match the current convergence specification/);
  });
  for (const [name, field, value] of [
    ["angle", "rotorAngleDeg", 6.6666666667],
    ["event", "eventIndex", 9],
    ["current", "driveCurrentA", 1],
    ["mesh", "meshLevelId", "medium"]
  ]) {
    await t.test(name, () => {
      const context = fixture(t);
      const pilot = JSON.parse(readFileSync(context.pilotReportPath, "utf8"));
      pilot.samples[0][field] = value;
      writeJson(context.pilotReportPath, pilot);
      assert.throws(() => build(context), /pilot coarse sample identity does not match the calibration angle\/event\/current\/mesh pair/);
    });
  }
  await t.test("reported drift", () => {
    const context = fixture(t);
    const pilot = JSON.parse(readFileSync(context.pilotReportPath, "utf8"));
    pilot.samples[0].observables.inductanceH.value *= 0.9;
    writeJson(context.pilotReportPath, pilot);
    assert.throws(() => build(context), /pilot coarse\/fine drift does not match the bound sample pair/);
  });
});

test("direct calibration solver evidence fails closed", async (t) => {
  await t.test("valid direct log", () => {
    const context = fixture(t);
    assert.doesNotThrow(() => build(context));
  });
  await t.test("missing completion", () => {
    const context = fixture(t);
    rewriteGetdpLog(context.jobs[0], (log) => log.replace(/Info    : Stopped[^\n]+\n$/, ""));
    assert.throws(() => build(context), /truncated|final stopped record/);
  });
  await t.test("wrong solver", () => {
    const context = fixture(t);
    rewriteGetdpLog(context.jobs[0], (log) => log.replace("preonly lu mumps", "gmres ilu"));
    assert.throws(() => build(context), /selected gmres\/ilu instead of preonly\/lu/);
  });
  for (const [name, failure] of [
    ["PETSc error", "[0]PETSC ERROR: factorization failed"],
    ["GetDP error", "Error   : failed to write solution"],
    ["out of memory", "Out of memory: Killed process 42 (getdp)"]
  ]) {
    await t.test(name, () => {
      const context = fixture(t);
      rewriteGetdpLog(context.jobs[0], (log) => log.replace("Info    : Stopped", `${failure}\nInfo    : Stopped`));
      assert.throws(() => build(context), /PETSc\/GetDP error or out-of-memory/);
    });
  }
});

test("iterative calibration solver evidence rejects nonconvergence", (t) => {
  const context = fixture(t);
  const job = context.jobs[0];
  rewriteGetdpLog(job, (log) => log
    .replace("preonly lu mumps", "cg gamg")
    .replace("Linear solve converged due to CONVERGED_ITS iterations 1", [
      "0 KSP unpreconditioned resid norm 1.0 true resid norm 1.0 ||r(i)||/||b|| 1.0",
      "750 KSP unpreconditioned resid norm 0.2 true resid norm 0.2 ||r(i)||/||b|| 0.2",
      "Linear solve did not converge due to DIVERGED_ITS iterations 750"
    ].join("\n")));
  assert.throws(() => collectSolverEvidence({
    jobDir: job.jobDir,
    solver: {
      name: "iterative-cg-gamg-v1",
      configSha256: SOLVER_CONFIG_HASH,
      mode: "iterative",
      kspType: "cg",
      pcType: "gamg"
    },
    getdpExitStatus: 0
  }), /PETSc solve did not converge: DIVERGED_ITS/);
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
  await t.test("mesh command plan", () => {
    const context = fixture(t);
    rewriteCheckpoint(context.jobs[1], (checkpoint) => {
      checkpoint.solverEnvironment.identity.commandPlan.mesh[4] = "2";
    });
    assert.throws(() => build(context), /environment identity hash mismatch/);
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
    "--mesh-threads", "1",
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
  assert(plan.commands.every((item) => item.command.includes("--mesh-threads") && item.command.includes("1")));
  assert(!JSON.stringify(plan).includes("motor-fem-lut-v1.json"));
});

test("calibration runner rejects mesh and solver thread drift", () => {
  const image = `fixture@sha256:${"a".repeat(64)}`;
  const run = (meshThreads, solverThreads) => spawnSync(process.execPath, [
    RUNNER_PATH,
    "--plan", "true",
    "--docker-image", image,
    "--pilot-report", "/not-read-in-plan.json",
    "--work-dir", "/tmp/calibration-plan",
    "--out", "/tmp/calibration-plan/motor-fem-calibration-pack-v1.json",
    "--solver-profile", "direct-mumps-publication-v1",
    "--memory-gib", "24",
    "--cpus", "2",
    "--mesh-threads", String(meshThreads),
    "--threads", String(solverThreads),
    "--hard-timeout-seconds", "1720"
  ], { cwd: ROOT, encoding: "utf8" });
  let result = run(2, 2);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--mesh-threads must be 1/);
  result = run(1, 1);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--threads must be 2/);
});

test("legacy calibration schema cannot represent the provenance-safe contract", () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.properties.status.const, "limited-not-validated");
  assert.equal(schema.properties.productionEligible.const, false);
  assert.equal(schema.properties.fullConvergenceClaim.const, false);
  assert.equal(schema.properties.defaultEnabled.const, false);
  assert.deepEqual(schema.properties.configuration.properties.eventClasses.const, [0, 1, 2]);
  assert.equal(schema.properties.configuration.properties.hardDeadlineSeconds.exclusiveMaximum, 1740);
  assert.equal(PROFILE.hardDeadlineSeconds, 1720);
  assert.equal(PROFILE.resources.meshThreads, 1);
  assert.equal(PROFILE.resources.solverThreads, 2);
  assert.equal(PROFILE.coarseFineDrift.passTolerance, 0.02);
});

test("retained calibration values are published unavailable with explicit provenance mismatches", () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const publishedBytes = readFileSync(PUBLIC_PACK_PATH);
  const published = JSON.parse(publishedBytes);
  const evidence = JSON.parse(readFileSync(EVIDENCE_PATH, "utf8"));
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

  assert.equal(schemaMatches(published, schema, schema), false);
  assert.deepEqual(published, evidence);
  assert.equal(sha256(publishedBytes), manifest.pack.sha256);
  assert.equal(published.status, "unavailable-provenance-mismatch");
  assert.equal(published.productionEligible, false);
  assert.equal(published.runtimeAvailable, false);
  assert.equal(published.optIn, false);
  assert.equal(published.uncertainty.established, false);
  assert.equal(published.uncertainty.relativeBound, null);
  assert.equal(manifest.validation.currentBuilderRebuildable, false);
  assert.equal(manifest.validation.legacyBuilderReproducedPack, true);
  assert.equal(manifest.validation.builderValidatedOriginalArtifactsBeforeCleanup, true);
  assert.deepEqual(manifest.provenanceMismatch.fields, ["modelInputHash", "specificationSha256", "sampleIdentity"]);
  for (const calibrationClass of published.classes) {
    const retained = manifest.retention.classes[calibrationClass.eventClass];
    assert.equal(sha256(readFileSync(resolve(ROOT, "evidence/v2", retained.checkpoint))), calibrationClass.checkpointSha256);
    assert.equal(sha256(readFileSync(resolve(ROOT, "evidence/v2", retained.result))), calibrationClass.resultSha256);
    assert.equal(retained.jobInputHash, calibrationClass.jobInputHash);
  }
});
