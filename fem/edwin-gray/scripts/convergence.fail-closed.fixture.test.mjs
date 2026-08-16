import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { evaluateConvergence, expectedSampleDefinitions } from "../convergence/evaluate-convergence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_PATH = join(ROOT, "convergence/convergence-spec-v1.json");
const SPEC_BYTES = readFileSync(SPEC_PATH);
const SPEC = JSON.parse(SPEC_BYTES);
const ENVIRONMENT_HASH = sha256("one deterministic solver environment");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function meshText(nodeCount, elementCount, radius) {
  const tags = Array.from({ length: nodeCount }, (_, index) => index + 1);
  const coordinates = tags.map((tag, index) => {
    const angle = 2 * Math.PI * index / nodeCount;
    const radial = index === 0 ? radius : radius * (0.2 + 0.7 * index / nodeCount);
    return `${radial * Math.cos(angle)} ${radial * Math.sin(angle)} ${index % 2 ? 0.05 : -0.05}`;
  });
  const elements = Array.from({ length: elementCount }, (_, index) => {
    const nodes = [0, 1, 2, 3].map((offset) => tags[(index + offset) % tags.length]);
    return `${index + 1} ${nodes.join(" ")}`;
  });
  return [
    "$MeshFormat",
    "4.1 0 8",
    "$EndMeshFormat",
    "$Nodes",
    `1 ${nodeCount} 1 ${nodeCount}`,
    `3 1 0 ${nodeCount}`,
    ...tags.map(String),
    ...coordinates,
    "$EndNodes",
    "$Elements",
    `1 ${elementCount} 1 ${elementCount}`,
    `3 1 4 ${elementCount}`,
    ...elements,
    "$EndElements",
    ""
  ].join("\n");
}

function observableValues(definition) {
  const meshFactor = { coarse: 1.012, medium: 1.004, fine: 1 }[definition.meshLevelId];
  const domainFactor = { base: 1.006, expanded: 1.002, far: 1 }[definition.domainId];
  const theta = definition.rotorAngleDeg * Math.PI / 180;
  const inductance = (2 + 0.1 * Math.cos(3 * theta)) * meshFactor * domainFactor;
  const magneticEnergy = 0.5 * inductance * definition.driveCurrentA ** 2;
  return {
    magneticEnergyJ: magneticEnergy,
    coEnergyJ: magneticEnergy * 1.002,
    inductanceH: inductance
  };
}

function writeSample(root, definition, index) {
  const id = `sample-${String(index).padStart(3, "0")}`;
  const jobDir = join(root, "jobs", id);
  mkdirSync(jobDir, { recursive: true });
  const meshCounts = {
    coarse: [20, 40],
    medium: [30, 62],
    fine: [45, 95]
  }[definition.meshLevelId];
  const radius = SPEC.production.domains.find((item) => item.id === definition.domainId).outerRadiusM;
  const mesh = meshText(meshCounts[0], meshCounts[1], radius);
  const meshAudit = `${JSON.stringify({ valid: true, source: { meshSha256: sha256(mesh) } })}\n`;
  const values = observableValues(definition);
  const files = {
    "motor.msh": mesh,
    "mesh-audit.json": meshAudit,
    "geometry-wrapper.geo": "SetNumber(\"Parameters/Mesh size (m)\", 0.01);\n",
    "getdp-wrapper.pro": "SetNumber(\"Parameters/Drive current (A)\", 10);\n",
    "solver-environment.json": `${JSON.stringify({ identityHash: ENVIRONMENT_HASH })}\n`,
    "gmsh.log": "fixture mesh completed\n",
    "getdp.log": "fixture solve completed\n",
    "observables.dat": `MagneticEnergyJ ${values.magneticEnergyJ}\n`,
    "coenergy.dat": `CoEnergyJ ${values.coEnergyJ}\n`,
    "inductance.dat": `InductanceH ${values.inductanceH}\n`
  };
  for (const [name, content] of Object.entries(files)) writeFileSync(join(jobDir, name), content, "utf8");

  const meshSizeM = SPEC.production.meshLevels.find((item) => item.id === definition.meshLevelId).meshSizeM;
  const parameters = {
    rotorAngleDeg: definition.rotorAngleDeg,
    eventIndex: definition.eventIndex,
    excitationContract: SPEC.excitationContract,
    meshSizeM,
    driveCurrentA: definition.driveCurrentA
  };
  const modelInputHash = sha256(`model:${definition.domainId}`);
  const jobInputHash = sha256(`job:${definition.domainId}:${definition.meshLevelId}:${definition.driveCurrentA}:${definition.rotorAngleDeg}`);
  const normalizedArtifacts = ["motor.msh", "mesh-audit.json", "getdp.log", "observables.dat", "coenergy.dat", "inductance.dat"]
    .map((name) => ({ path: name, sha256: sha256(files[name]) }));
  const result = {
    contract: "edwin-gray-browser-result",
    contractVersion: 1,
    lutContract: "motor-fem-lut-v1",
    caseId: SPEC.caseId,
    status: "complete",
    expectedAnglesDeg: [definition.rotorAngleDeg],
    entries: [{
      entryId: id,
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
        modelInputHash,
        jobInputHash,
        inputHash: jobInputHash,
        solver: "getdp",
        backend: "host",
        symmetryApplied: false,
        artifacts: normalizedArtifacts
      }
    }],
    provenance: {
      synthetic: false,
      limitations: ["generated evaluator fixture; not production FEM evidence"],
      source: "convergence evaluator fixture"
    }
  };
  const resultPath = join(jobDir, "result.json");
  writeJson(resultPath, result);
  const checkpoint = {
    checkpointVersion: SPEC.checkpointVersion,
    jobId: id,
    inputHash: jobInputHash,
    modelInputHash,
    jobInputHash,
    parameters,
    backend: "host",
    environmentIdentityHash: ENVIRONMENT_HASH,
    solverEnvironment: { identityHash: ENVIRONMENT_HASH },
    resultContract: SPEC.resultContract,
    excitationContract: SPEC.excitationContract,
    eventIndex: parameters.eventIndex,
    meshQuality: "passed",
    phases: { mesh: "complete", solve: "complete", normalize: "complete" },
    artifacts: {
      environment: sha256(files["solver-environment.json"]),
      inputs: {
        geometry: sha256(files["geometry-wrapper.geo"]),
        getdp: sha256(files["getdp-wrapper.pro"])
      },
      mesh: sha256(mesh),
      audit: sha256(meshAudit),
      logs: {
        gmsh: sha256(files["gmsh.log"]),
        getdp: sha256(files["getdp.log"])
      },
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
  return {
    id,
    ...definition,
    result: `jobs/${id}/result.json`,
    checkpoint: `jobs/${id}/checkpoint.json`
  };
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "edwin-gray-convergence-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const samples = expectedSampleDefinitions(SPEC).map((definition, index) => writeSample(root, definition, index));
  const evidence = {
    contract: "edwin-gray-convergence-evidence",
    contractVersion: 1,
    status: "complete",
    caseId: SPEC.caseId,
    samples
  };
  writeJson(join(root, "evidence.json"), evidence);
  return { root, evidence };
}

function evaluate(context) {
  return evaluateConvergence({
    spec: SPEC,
    specBytes: SPEC_BYTES,
    evidence: context.evidence,
    evidenceDir: context.root
  });
}

function sampleFiles(context, predicate) {
  const sample = context.evidence.samples.find(predicate);
  assert(sample, "fixture sample not found");
  const resultPath = resolve(context.root, sample.result);
  const checkpointPath = resolve(context.root, sample.checkpoint);
  return {
    sample,
    jobDir: dirname(resultPath),
    resultPath,
    checkpointPath,
    result: JSON.parse(readFileSync(resultPath, "utf8")),
    checkpoint: JSON.parse(readFileSync(checkpointPath, "utf8"))
  };
}

function reattestObservables(files, values) {
  const tableValues = {
    "observables.dat": ["MagneticEnergyJ", values.magneticEnergyJ],
    "coenergy.dat": ["CoEnergyJ", values.coEnergyJ],
    "inductance.dat": ["InductanceH", values.inductanceH]
  };
  for (const [name, [label, value]] of Object.entries(tableValues)) {
    const content = `${label} ${value}\n`;
    writeFileSync(join(files.jobDir, name), content, "utf8");
    files.checkpoint.artifacts.outputs[name] = sha256(content);
    files.result.entries[0].provenance.artifacts.find((artifact) => artifact.path === name).sha256 = sha256(content);
  }
  for (const [name, value] of Object.entries(values)) files.result.entries[0].observables[name].value = value;
  writeJson(files.resultPath, files.result);
  files.checkpoint.artifacts.result = sha256(readFileSync(files.resultPath));
  writeJson(files.checkpointPath, files.checkpoint);
}

test("complete attested production coverage is approved deterministically", (t) => {
  const context = fixture(t);
  const first = evaluate(context);
  const second = evaluate(context);
  assert.equal(first.status, "approved");
  assert.deepEqual(first, second);
  assert.equal(first.evidence.sampleCount, expectedSampleDefinitions(SPEC).length);
  assert.deepEqual(first.failures, []);
});

test("required convergence tuples bind fixed torque and rotated periodicity events", () => {
  const definitions = expectedSampleDefinitions(SPEC);
  const eventAt = (angle) => new Set(definitions.filter((item) => item.rotorAngleDeg === angle).map((item) => item.eventIndex));
  assert.deepEqual(eventAt(6.6666666667), new Set([0]));
  assert.deepEqual(eventAt(126.6666666667), new Set([9]));
});

test("CLI writes the deterministic convergence-report.json contract", (t) => {
  const context = fixture(t);
  const reportPath = join(context.root, "convergence-report.json");
  const run = spawnSync(process.execPath, [
    join(ROOT, "convergence/evaluate-convergence.mjs"),
    "--evidence", join(context.root, "evidence.json"),
    "--out", reportPath
  ], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  assert.equal(report.contract, "edwin-gray-convergence-report");
  assert.equal(report.status, "approved");
  assert.equal(report.specification.sha256, sha256(SPEC_BYTES));
  assert(!JSON.stringify(report).includes(context.root), "report must not contain fixture paths");
});

test("missing production evidence is rejected", (t) => {
  const context = fixture(t);
  context.evidence.samples.pop();
  const report = evaluate(context);
  assert.equal(report.status, "rejected");
  assert.match(report.failures[0], /sample count/);
});

test("tampered checkpoint artifact is rejected", (t) => {
  const context = fixture(t);
  const files = sampleFiles(context, () => true);
  writeFileSync(join(files.jobDir, "observables.dat"), "MagneticEnergyJ 999\n", "utf8");
  const report = evaluate(context);
  assert.equal(report.status, "rejected");
  assert.match(report.failures[0], /observables\.dat hash mismatch/);
});

test("incomplete checkpoint is rejected", (t) => {
  const context = fixture(t);
  const files = sampleFiles(context, () => true);
  files.checkpoint.phases.normalize = "pending";
  writeJson(files.checkpointPath, files.checkpoint);
  const report = evaluate(context);
  assert.equal(report.status, "rejected");
  assert.match(report.failures[0], /checkpoint phases are incomplete/);
});

test("domain labels cannot approve a mesh from another domain", (t) => {
  const context = fixture(t);
  const expandedIndex = context.evidence.samples.findIndex((sample) => sample.domainId === "expanded");
  const expanded = context.evidence.samples[expandedIndex];
  const base = sampleFiles(context, (sample) => (
    sample.domainId === "base"
      && sample.meshLevelId === expanded.meshLevelId
      && sample.driveCurrentA === expanded.driveCurrentA
      && sample.rotorAngleDeg === expanded.rotorAngleDeg
  ));
  context.evidence.samples[expandedIndex].result = base.sample.result;
  context.evidence.samples[expandedIndex].checkpoint = base.sample.checkpoint;
  const report = evaluate(context);
  assert.equal(report.status, "rejected");
  assert.match(report.failures[0], /attested mesh radius does not match domain expanded/);
});

test("coherently attested but nonconverged values are rejected numerically", (t) => {
  const context = fixture(t);
  const files = sampleFiles(context, (sample) => (
    sample.domainId === "base"
      && sample.meshLevelId === "fine"
      && sample.driveCurrentA === SPEC.production.productionCurrentA
      && sample.rotorAngleDeg === 0
  ));
  const current = files.result.entries[0].observables;
  const values = {
    magneticEnergyJ: current.magneticEnergyJ.value * 1.2,
    coEnergyJ: current.coEnergyJ.value * 1.2,
    inductanceH: current.inductanceH.value * 1.2
  };
  reattestObservables(files, values);
  const report = evaluate(context);
  assert.equal(report.status, "rejected");
  assert(report.failures.some((failure) => failure.startsWith("mesh-observable")));
});
