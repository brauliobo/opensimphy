import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { convergenceSymmetryProof, evaluateConvergence, expectedSampleDefinitions } from "../convergence/evaluate-convergence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_PATH = join(ROOT, "convergence/convergence-spec-v2.json");
const SPEC_BYTES = readFileSync(SPEC_PATH);
const SPEC = JSON.parse(SPEC_BYTES);
const ENVIRONMENT_HASH = sha256("one deterministic solver environment");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function meshText(nodeCount, elementCount, radius, axialHalfExtent) {
  const tags = Array.from({ length: nodeCount }, (_, index) => index + 1);
  const coordinates = tags.map((tag, index) => {
    const angle = 2 * Math.PI * index / nodeCount;
    const radial = index === 0 ? radius : radius * (0.2 + 0.7 * index / nodeCount);
    const z = index === 0 ? axialHalfExtent : index === 1 ? -axialHalfExtent : (index % 2 ? 0.05 : -0.05);
    return `${radial * Math.cos(angle)} ${radial * Math.sin(angle)} ${z}`;
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
  const domain = SPEC.production.domains.find((item) => item.id === definition.domainId);
  const mesh = meshText(meshCounts[0], meshCounts[1], domain.outerRadiusM, domain.axialHalfExtentM);
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
    contractVersion: 2,
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

function attestation(context, predicate) {
  const files = sampleFiles(context, predicate);
  return {
    sampleId: files.sample.id,
    jobInputHash: files.result.entries[0].provenance.jobInputHash,
    artifactHashes: files.result.entries[0].provenance.artifacts
  };
}

function applyFinePeriodicityDerivation(context) {
  const declaration = SPEC.production.symmetryDerivedConvergenceSample;
  const targetIndex = context.evidence.samples.findIndex((sample) => (
    sample.domainId === declaration.target.domainId
      && sample.meshLevelId === declaration.target.meshLevelId
      && sample.driveCurrentA === declaration.target.driveCurrentA
      && sample.rotorAngleDeg === declaration.target.rotorAngleDeg
  ));
  assert.notEqual(targetIndex, -1, "fixture derivation target not found");
  const sourcePredicate = (sample) => (
    sample.domainId === declaration.source.domainId
      && sample.meshLevelId === declaration.source.meshLevelId
      && sample.driveCurrentA === declaration.source.driveCurrentA
      && sample.rotorAngleDeg === declaration.source.rotorAngleDeg
  );
  const validation = (angle) => (sample) => (
    sample.domainId === declaration.source.domainId
      && sample.meshLevelId === declaration.validationMeshLevelId
      && sample.driveCurrentA === declaration.source.driveCurrentA
      && sample.rotorAngleDeg === angle
  );
  const validationSourceFiles = sampleFiles(context, validation(declaration.source.rotorAngleDeg));
  const validationPartnerFiles = sampleFiles(context, validation(declaration.target.rotorAngleDeg));
  const sourceObservables = validationSourceFiles.result.entries[0].observables;
  const partnerObservables = validationPartnerFiles.result.entries[0].observables;
  const maximumRelativeDifference = Math.max(...Object.keys(sourceObservables).map((name) => relativeDifference(
    sourceObservables[name].value,
    partnerObservables[name].value
  )));
  context.evidence.samples[targetIndex] = {
    id: "derived-fine-120-event-9",
    kind: declaration.kind,
    ...declaration.target,
    derivation: {
      symmetryProofSha256: convergenceSymmetryProof().proofSha256,
      rotationDeg: declaration.rotationDeg,
      source: attestation(context, sourcePredicate),
      validation: {
        maximumRelativeDifference,
        tolerance: declaration.validationRelativeTolerance,
        source: attestation(context, validation(declaration.source.rotorAngleDeg)),
        partner: attestation(context, validation(declaration.target.rotorAngleDeg))
      }
    }
  };
  return context.evidence.samples[targetIndex];
}

function relativeDifference(left, right) {
  return Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right), Number.MIN_VALUE);
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

test("v2 responds to v1 failures without loosening numerical acceptance", () => {
  const v1 = JSON.parse(readFileSync(join(ROOT, "convergence/convergence-spec-v1.json"), "utf8"));
  assert.match(SPEC.justification, /v1.*rejected/i);
  assert.deepEqual(SPEC.tolerances.energyCoEnergyRelative, v1.tolerances.energyCoEnergyRelative);
  assert.deepEqual(SPEC.tolerances.meshObservableRelative, v1.tolerances.meshObservableRelative);
  assert.deepEqual(SPEC.tolerances.outerDomainObservableRelative, v1.tolerances.outerDomainObservableRelative);
  assert.deepEqual(SPEC.tolerances.inductanceCurrentRelative, v1.tolerances.inductanceCurrentRelative);
  assert.deepEqual(SPEC.tolerances.energyCurrentSquaredRelative, v1.tolerances.energyCurrentSquaredRelative);
  assert.deepEqual(SPEC.tolerances.anglePeriodicityRelative, v1.tolerances.anglePeriodicityRelative);
  assert.deepEqual(SPEC.tolerances.torqueDerivative, v1.tolerances.torqueDerivative);
  assert(SPEC.production.meshLevels.every((level, index, levels) => index === 0 || level.featureMeshSizeM < levels[index - 1].featureMeshSizeM));
  assert(SPEC.production.domains[0].outerRadiusM >= v1.production.domains.at(-1).outerRadiusM);
  assert(SPEC.production.domains.every((domain) => domain.axialHalfExtentM > 0.12));
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
  assert.equal(report.contractVersion, 2);
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

test("the one declared fine periodic partner may use an exactly attested symmetry derivation", (t) => {
  const context = fixture(t);
  applyFinePeriodicityDerivation(context);
  const first = evaluate(context);
  const second = evaluate(context);
  assert.equal(first.status, "approved");
  assert.deepEqual(first, second);
  assert.equal(first.evidence.independentlySolvedSampleCount, expectedSampleDefinitions(SPEC).length - 1);
  assert.equal(first.evidence.symmetryDerivedSampleCount, 1);
});

test("a symmetry derivation without the event-map proof hash is rejected", (t) => {
  const context = fixture(t);
  const derived = applyFinePeriodicityDerivation(context);
  delete derived.derivation.symmetryProofSha256;
  const report = evaluate(context);
  assert.equal(report.status, "rejected");
  assert.match(report.failures[0], /derivation attestation is absent or tampered/);
});

test("a tampered event-map proof hash is rejected", (t) => {
  const context = fixture(t);
  const derived = applyFinePeriodicityDerivation(context);
  derived.derivation.symmetryProofSha256 = "f".repeat(64);
  const report = evaluate(context);
  assert.equal(report.status, "rejected");
  assert.match(report.failures[0], /derivation attestation is absent or tampered/);
});

test("a coarse validation pair above one percent cannot authorize derivation", (t) => {
  const context = fixture(t);
  const declaration = SPEC.production.symmetryDerivedConvergenceSample;
  const files = sampleFiles(context, (sample) => (
    sample.domainId === declaration.target.domainId
      && sample.meshLevelId === declaration.validationMeshLevelId
      && sample.driveCurrentA === declaration.target.driveCurrentA
      && sample.rotorAngleDeg === declaration.target.rotorAngleDeg
  ));
  const current = files.result.entries[0].observables;
  reattestObservables(files, Object.fromEntries(Object.entries(current).map(([name, item]) => [name, item.value * 1.02])));
  applyFinePeriodicityDerivation(context);
  const report = evaluate(context);
  assert.equal(report.status, "rejected");
  assert.match(report.failures[0], /coarse symmetry validation differs.*above 0.01/);
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
