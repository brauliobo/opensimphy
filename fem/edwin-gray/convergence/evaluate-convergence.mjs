#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SPEC = resolve(SCRIPT_DIR, "convergence-spec-v1.json");
const SHA256 = /^[a-f0-9]{64}$/;
const OBSERVABLES = ["magneticEnergyJ", "coEnergyJ", "inductanceH"];
const TABLES = {
  magneticEnergyJ: "observables.dat",
  coEnergyJ: "coenergy.dat",
  inductanceH: "inductance.dat"
};

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

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readJson(path, label) {
  assert(existsSync(path), `${label} is missing`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error.message}`);
  }
}

function finitePositive(value, label) {
  assert(typeof value === "number" && Number.isFinite(value) && value > 0, `${label} must be finite and positive`);
}

function sameNumber(left, right) {
  return Math.abs(left - right) <= 1e-12 * Math.max(1, Math.abs(left), Math.abs(right));
}

function pathWithin(path, root) {
  const rel = relative(resolve(root), resolve(path));
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
}

function artifactHash(path, label) {
  assert(existsSync(path), `${label} is missing`);
  return sha256Bytes(readFileSync(path));
}

function verifiedArtifact(jobDir, path, expectedHash, label) {
  assert(typeof path === "string" && path.length > 0, `${label} path is invalid`);
  assert(SHA256.test(expectedHash || ""), `${label} hash is invalid`);
  const artifactPath = resolve(jobDir, path);
  assert(pathWithin(artifactPath, jobDir), `${label} escapes its job directory`);
  assert(artifactHash(artifactPath, label) === expectedHash, `${label} hash mismatch`);
  return artifactPath;
}

function parseLastNumber(path, label) {
  const matches = readFileSync(path, "utf8").match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) || [];
  const value = Number(matches.at(-1));
  assert(Number.isFinite(value), `${label} has no finite value`);
  return value;
}

function section(text, name) {
  const start = text.indexOf(`$${name}\n`);
  const end = text.indexOf(`$End${name}`, start + 1);
  assert(start >= 0 && end > start, `attested mesh has no ${name} section`);
  return text.slice(start + name.length + 2, end).trim();
}

function parseMesh(path) {
  const text = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const format = section(text, "MeshFormat").split(/\s+/).map(Number);
  assert(format[0] >= 4 && format[0] < 5, "attested mesh must use Gmsh 4.x format");
  assert(format[1] === 0, "binary Gmsh meshes are not accepted by the convergence evaluator");

  const nodeTokens = section(text, "Nodes").split(/\s+/);
  let cursor = 0;
  const blockCount = Number(nodeTokens[cursor++]);
  const nodeCount = Number(nodeTokens[cursor++]);
  cursor += 2;
  assert(Number.isInteger(blockCount) && blockCount > 0 && Number.isInteger(nodeCount) && nodeCount > 0, "attested mesh node header is invalid");
  let parsedNodes = 0;
  let outerRadiusM = 0;
  for (let block = 0; block < blockCount; block += 1) {
    const entityDimension = Number(nodeTokens[cursor++]);
    cursor += 1;
    const parametric = Number(nodeTokens[cursor++]);
    const count = Number(nodeTokens[cursor++]);
    assert(Number.isInteger(entityDimension) && entityDimension >= 0 && entityDimension <= 3, "attested mesh node block dimension is invalid");
    assert((parametric === 0 || parametric === 1) && Number.isInteger(count) && count > 0, "attested mesh node block is invalid");
    cursor += count;
    for (let index = 0; index < count; index += 1) {
      const x = Number(nodeTokens[cursor++]);
      const y = Number(nodeTokens[cursor++]);
      const z = Number(nodeTokens[cursor++]);
      assert([x, y, z].every(Number.isFinite), "attested mesh contains an invalid coordinate");
      outerRadiusM = Math.max(outerRadiusM, Math.hypot(x, y));
      if (parametric === 1) cursor += entityDimension;
    }
    parsedNodes += count;
  }
  assert(parsedNodes === nodeCount && cursor === nodeTokens.length, "attested mesh node count is inconsistent");

  const elementLines = section(text, "Elements").split("\n").map((line) => line.trim()).filter(Boolean);
  const elementHeader = elementLines[0].split(/\s+/).map(Number);
  const elementBlockCount = elementHeader[0];
  const elementCount = elementHeader[1];
  assert(Number.isInteger(elementBlockCount) && elementBlockCount > 0 && Number.isInteger(elementCount) && elementCount > 0, "attested mesh element header is invalid");
  let elementCursor = 1;
  let parsedElements = 0;
  for (let block = 0; block < elementBlockCount; block += 1) {
    const blockHeader = elementLines[elementCursor++]?.split(/\s+/).map(Number) || [];
    const count = blockHeader[3];
    assert(blockHeader.length === 4 && blockHeader.every(Number.isFinite) && Number.isInteger(count) && count > 0, "attested mesh element block is invalid");
    for (let index = 0; index < count; index += 1) {
      const element = elementLines[elementCursor++]?.split(/\s+/).map(Number) || [];
      assert(element.length >= 2 && element.every(Number.isFinite), "attested mesh contains an invalid element");
    }
    parsedElements += count;
  }
  assert(parsedElements === elementCount && elementCursor === elementLines.length, "attested mesh element count is inconsistent");
  return { nodeCount, elementCount, outerRadiusM };
}

function angleKey(angle) {
  return Number(angle).toFixed(10);
}

function sampleKey(domainId, meshLevelId, current, angle) {
  return `${domainId}|${meshLevelId}|${Number(current).toPrecision(15)}|${angleKey(angle)}`;
}

function eventIndexForAngle(spec, angle) {
  const periodicityRightAngles = new Set(spec.production.periodicityPairsDeg.map((pair) => angleKey(pair[1])));
  return periodicityRightAngles.has(angleKey(angle))
    ? spec.production.convergenceEventIndex + spec.production.periodicityEventIndexOffset
    : spec.production.convergenceEventIndex;
}

export function expectedSampleDefinitions(spec) {
  validateSpec(spec);
  const production = spec.production;
  const base = production.baseDomainId;
  const fine = production.meshLevels.at(-1).id;
  const representative = production.representativeAngles.map((item) => item.angleDeg);
  const productionAngles = new Set([
    ...representative,
    ...production.torqueAnglesDeg,
    ...production.periodicityPairsDeg.flat()
  ].map(angleKey));
  const expected = new Map();
  const add = (domainId, meshLevelId, driveCurrentA, rotorAngleDeg) => {
    const item = { domainId, meshLevelId, driveCurrentA, rotorAngleDeg, eventIndex: eventIndexForAngle(spec, rotorAngleDeg) };
    expected.set(sampleKey(domainId, meshLevelId, driveCurrentA, rotorAngleDeg), item);
  };
  for (const mesh of production.meshLevels) {
    for (const angle of productionAngles) add(base, mesh.id, production.productionCurrentA, Number(angle));
  }
  for (const domain of production.domains) {
    for (const angle of representative) add(domain.id, fine, production.productionCurrentA, angle);
  }
  for (const current of [production.productionCurrentA, production.linearityAuditCurrentA]) {
    for (const angle of representative) add(base, fine, current, angle);
  }
  return [...expected.values()].sort((left, right) => sampleKey(left.domainId, left.meshLevelId, left.driveCurrentA, left.rotorAngleDeg)
    .localeCompare(sampleKey(right.domainId, right.meshLevelId, right.driveCurrentA, right.rotorAngleDeg)));
}

function validateSpec(spec) {
  assert(spec?.contract === "edwin-gray-convergence-spec" && spec.contractVersion === 1, "unsupported convergence specification");
  assert(spec.evidenceContract === "edwin-gray-convergence-evidence@1", "unsupported evidence contract in specification");
  assert(spec.reportContract === "edwin-gray-convergence-report@1", "unsupported report contract in specification");
  assert(spec.resultContract === "edwin-gray-browser-result@1", "unsupported normalized result contract in specification");
  assert(spec.checkpointVersion === "fem-checkpoint-v5", "unsupported checkpoint version in specification");
  assert(spec.excitationContract === "edwin-gray-fem-excitation-event-map/v1", "unsupported excitation contract in specification");
  const production = spec.production;
  assert(production?.ciSmoke === false, "production convergence specification cannot be a CI smoke sweep");
  assert(Array.isArray(production.meshLevels) && production.meshLevels.length >= 3, "at least three mesh levels are required");
  production.meshLevels.forEach((item, index) => {
    assert(typeof item.id === "string" && item.id.length > 0, "mesh level ID is required");
    finitePositive(item.meshSizeM, `mesh level ${item.id}`);
    if (index > 0) assert(item.meshSizeM < production.meshLevels[index - 1].meshSizeM, "mesh levels must refine monotonically");
  });
  assert(new Set(production.meshLevels.map((item) => item.id)).size === production.meshLevels.length, "mesh level IDs must be unique");
  assert(Array.isArray(production.domains) && production.domains.length >= 3, "at least three outer domains are required");
  production.domains.forEach((item, index) => {
    assert(typeof item.id === "string" && item.id.length > 0, "domain ID is required");
    finitePositive(item.outerRadiusM, `domain ${item.id}`);
    if (index > 0) assert(item.outerRadiusM > production.domains[index - 1].outerRadiusM, "outer domains must grow monotonically");
  });
  assert(production.domains.some((item) => item.id === production.baseDomainId), "base domain is not declared");
  finitePositive(production.productionCurrentA, "production current");
  finitePositive(production.linearityAuditCurrentA, "linearity audit current");
  assert(!sameNumber(production.productionCurrentA, production.linearityAuditCurrentA), "linearity audit current must differ from production current");
  assert(Number.isInteger(production.convergenceEventIndex) && production.convergenceEventIndex >= 0 && production.convergenceEventIndex <= 26, "convergence event index is invalid");
  assert(Number.isInteger(production.periodicityEventIndexOffset) && production.periodicityEventIndexOffset > 0, "periodicity event index offset is invalid");
  assert(production.convergenceEventIndex + production.periodicityEventIndexOffset <= 26, "periodicity event index is out of range");
  assert(Array.isArray(production.representativeAngles) && production.representativeAngles.length >= 3, "aligned, transition, and unaligned angles are required");
  assert(["aligned", "transition", "unaligned"].every((role) => production.representativeAngles.some((item) => item.role === role)), "representative angle roles are incomplete");
  assert(Array.isArray(production.torqueAnglesDeg) && production.torqueAnglesDeg.length >= 5, "at least five torque derivative angles are required");
  assert(production.torqueAnglesDeg.every((angle, index) => Number.isFinite(angle) && (index === 0 || angle > production.torqueAnglesDeg[index - 1])), "torque angles must be finite and increasing");
  assert(Array.isArray(production.periodicityPairsDeg) && production.periodicityPairsDeg.length >= 3, "at least three periodicity pairs are required");
  const tolerances = spec.tolerances;
  assert(tolerances && typeof tolerances === "object", "convergence tolerances are required");
  const required = [
    tolerances.meshMetrics?.outerRadiusRelative,
    tolerances.meshMetrics?.minimumNodeGrowthRatio,
    tolerances.meshMetrics?.minimumElementGrowthRatio,
    tolerances.meshMetrics?.maximumElementNodeRatioDrift,
    tolerances.energyCoEnergyRelative,
    tolerances.meshObservableRelative?.coarseToFine,
    tolerances.meshObservableRelative?.mediumToFine,
    tolerances.outerDomainObservableRelative?.baseToFar,
    tolerances.outerDomainObservableRelative?.expandedToFar,
    tolerances.inductanceCurrentRelative,
    tolerances.energyCurrentSquaredRelative,
    tolerances.anglePeriodicityRelative,
    tolerances.torqueDerivative?.normalizedLinf,
    tolerances.torqueDerivative?.absoluteFloorNm
  ];
  assert(required.every((value) => typeof value === "number" && Number.isFinite(value) && value > 0), "all convergence tolerances must be finite and positive");
}

function verifySample(sample, expected, spec, evidenceDir) {
  assert(sample && typeof sample === "object" && typeof sample.id === "string" && sample.id.length > 0, "evidence sample ID is required");
  assert(sample.domainId === expected.domainId && sample.meshLevelId === expected.meshLevelId, `sample ${sample.id} labels do not match its required tuple`);
  assert(sameNumber(sample.driveCurrentA, expected.driveCurrentA) && sameNumber(sample.rotorAngleDeg, expected.rotorAngleDeg), `sample ${sample.id} declared parameters do not match its required tuple`);
  const resultPath = resolve(evidenceDir, sample.result || "");
  const checkpointPath = resolve(evidenceDir, sample.checkpoint || "");
  assert(pathWithin(resultPath, evidenceDir) && pathWithin(checkpointPath, evidenceDir), `sample ${sample.id} evidence path escapes the evidence directory`);
  const result = readJson(resultPath, `sample ${sample.id} normalized result`);
  const checkpoint = readJson(checkpointPath, `sample ${sample.id} checkpoint`);
  const jobDir = dirname(checkpointPath);
  assert(dirname(resultPath) === jobDir, `sample ${sample.id} result and checkpoint must share a job directory`);

  assert(checkpoint.checkpointVersion === spec.checkpointVersion, `sample ${sample.id} checkpoint version is invalid`);
  assert(checkpoint.phases?.mesh === "complete" && checkpoint.phases?.solve === "complete" && checkpoint.phases?.normalize === "complete", `sample ${sample.id} checkpoint phases are incomplete`);
  assert(checkpoint.meshQuality === "passed", `sample ${sample.id} mesh quality was not passed`);
  assert(checkpoint.result === "result.json" && resultPath === resolve(jobDir, "result.json"), `sample ${sample.id} result path is not checkpoint-attested`);
  assert(checkpoint.resultContract === spec.resultContract, `sample ${sample.id} checkpoint result contract is invalid`);
  assert(checkpoint.artifacts?.result === artifactHash(resultPath, `sample ${sample.id} result`), `sample ${sample.id} normalized result hash mismatch`);
  const meshPath = verifiedArtifact(jobDir, "motor.msh", checkpoint.artifacts?.mesh, `sample ${sample.id} mesh`);
  const auditPath = verifiedArtifact(jobDir, "mesh-audit.json", checkpoint.artifacts?.audit, `sample ${sample.id} mesh audit`);
  const environmentPath = verifiedArtifact(jobDir, "solver-environment.json", checkpoint.artifacts?.environment, `sample ${sample.id} solver environment`);
  verifiedArtifact(jobDir, "geometry-wrapper.geo", checkpoint.artifacts?.inputs?.geometry, `sample ${sample.id} geometry wrapper`);
  verifiedArtifact(jobDir, "getdp-wrapper.pro", checkpoint.artifacts?.inputs?.getdp, `sample ${sample.id} GetDP wrapper`);
  verifiedArtifact(jobDir, "gmsh.log", checkpoint.artifacts?.logs?.gmsh, `sample ${sample.id} Gmsh log`);
  verifiedArtifact(jobDir, "getdp.log", checkpoint.artifacts?.logs?.getdp, `sample ${sample.id} GetDP log`);
  assert(stableJson(Object.keys(checkpoint.artifacts.logs).sort()) === stableJson(["getdp", "gmsh"]), `sample ${sample.id} checkpoint log set is invalid`);
  assert(stableJson(Object.keys(checkpoint.artifacts.outputs).sort()) === stableJson(Object.values(TABLES).sort()), `sample ${sample.id} checkpoint output set is invalid`);
  for (const name of Object.values(TABLES)) {
    verifiedArtifact(jobDir, name, checkpoint.artifacts?.outputs?.[name], `sample ${sample.id} ${name}`);
  }
  const audit = readJson(auditPath, `sample ${sample.id} mesh audit`);
  assert(audit.valid === true && audit.source?.meshSha256 === artifactHash(meshPath, `sample ${sample.id} mesh`), `sample ${sample.id} mesh audit is invalid`);

  assert(result.contract === "edwin-gray-browser-result" && result.contractVersion === 1, `sample ${sample.id} normalized contract is invalid`);
  assert(result.caseId === spec.caseId && result.status === "complete", `sample ${sample.id} normalized result is incomplete or belongs to another case`);
  assert(result.provenance?.synthetic === false && Array.isArray(result.entries) && result.entries.length === 1, `sample ${sample.id} normalized evidence is synthetic or not an individual job`);
  const entry = result.entries[0];
  assert(entry.status === "complete" && entry.provenance?.synthetic === false, `sample ${sample.id} normalized entry is incomplete or synthetic`);
  assert(stableJson(entry.parameters) === stableJson(checkpoint.parameters), `sample ${sample.id} normalized and checkpoint parameters differ`);
  assert(entry.parameters.excitationContract === spec.excitationContract && checkpoint.excitationContract === spec.excitationContract, `sample ${sample.id} excitation contract is invalid`);
  assert(Number.isInteger(entry.parameters.eventIndex) && entry.parameters.eventIndex === checkpoint.eventIndex, `sample ${sample.id} event index is invalid`);
  assert(entry.parameters.eventIndex === expected.eventIndex, `sample ${sample.id} event index does not match the convergence excitation schedule`);
  const mesh = spec.production.meshLevels.find((item) => item.id === expected.meshLevelId);
  assert(sameNumber(entry.parameters?.meshSizeM, mesh.meshSizeM), `sample ${sample.id} mesh size is not the specified level`);
  assert(sameNumber(entry.parameters?.driveCurrentA, expected.driveCurrentA) && sameNumber(entry.parameters?.rotorAngleDeg, expected.rotorAngleDeg), `sample ${sample.id} normalized parameters do not match the required tuple`);
  assert(SHA256.test(entry.provenance.modelInputHash || "") && entry.provenance.modelInputHash === checkpoint.modelInputHash, `sample ${sample.id} model input hash is invalid`);
  assert(SHA256.test(entry.provenance.jobInputHash || "") && entry.provenance.jobInputHash === checkpoint.jobInputHash && checkpoint.inputHash === checkpoint.jobInputHash, `sample ${sample.id} job input hash is invalid`);
  assert(entry.provenance.inputHash === undefined || entry.provenance.inputHash === entry.provenance.jobInputHash, `sample ${sample.id} normalized legacy input hash is invalid`);
  assert(entry.provenance.backend === checkpoint.backend && entry.provenance.solver === "getdp", `sample ${sample.id} solver provenance is invalid`);
  assert(checkpoint.solverEnvironment?.identityHash === checkpoint.environmentIdentityHash && SHA256.test(checkpoint.environmentIdentityHash || ""), `sample ${sample.id} solver environment identity is invalid`);
  assert(readJson(environmentPath, `sample ${sample.id} solver environment`).identityHash === checkpoint.environmentIdentityHash, `sample ${sample.id} environment manifest identity is invalid`);
  assert(Array.isArray(entry.provenance.artifacts) && entry.provenance.artifacts.length > 0, `sample ${sample.id} normalized artifact list is missing`);
  assert(new Set(entry.provenance.artifacts.map((item) => item.path)).size === entry.provenance.artifacts.length, `sample ${sample.id} normalized artifact paths are duplicated`);
  const expectedNormalizedArtifacts = ["motor.msh", "mesh-audit.json", "getdp.log", ...Object.values(TABLES)].sort();
  assert(stableJson(entry.provenance.artifacts.map((item) => item.path).sort()) === stableJson(expectedNormalizedArtifacts), `sample ${sample.id} normalized artifact set is invalid`);
  for (const artifact of entry.provenance.artifacts) verifiedArtifact(jobDir, artifact.path, artifact.sha256, `sample ${sample.id} normalized artifact ${artifact.path}`);

  const observables = {};
  for (const observable of OBSERVABLES) {
    const item = entry.observables?.[observable];
    const expectedUnit = observable === "inductanceH" ? "H" : "J";
    finitePositive(item?.value, `sample ${sample.id} ${observable}`);
    assert(item.unit === expectedUnit, `sample ${sample.id} ${observable} unit is invalid`);
    const tableValue = parseLastNumber(resolve(jobDir, TABLES[observable]), `sample ${sample.id} ${TABLES[observable]}`);
    assert(sameNumber(item.value, tableValue), `sample ${sample.id} ${observable} does not match its attested solver table`);
    observables[observable] = item.value;
  }
  const meshMetrics = parseMesh(meshPath);
  const domain = spec.production.domains.find((item) => item.id === expected.domainId);
  const radiusError = relativeDifference(meshMetrics.outerRadiusM, domain.outerRadiusM);
  assert(radiusError <= spec.tolerances.meshMetrics.outerRadiusRelative, `sample ${sample.id} attested mesh radius does not match domain ${domain.id}`);
  return {
    id: sample.id,
    ...expected,
    observables,
    meshMetrics,
    modelInputHash: entry.provenance.modelInputHash,
    jobInputHash: entry.provenance.jobInputHash,
    environmentIdentityHash: checkpoint.environmentIdentityHash
  };
}

function relativeDifference(left, right) {
  return Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right), Number.MIN_VALUE);
}

function maxObservableDifference(left, right) {
  return Math.max(...OBSERVABLES.map((name) => relativeDifference(left.observables[name], right.observables[name])));
}

function derivative(points, index) {
  const left = points[index - 1];
  const right = points[index + 1];
  return (right.observables.coEnergyJ - left.observables.coEnergyJ) / ((right.rotorAngleDeg - left.rotorAngleDeg) * Math.PI / 180);
}

function evaluateMetrics(samples, spec) {
  const checks = [];
  const byKey = new Map(samples.map((sample) => [sampleKey(sample.domainId, sample.meshLevelId, sample.driveCurrentA, sample.rotorAngleDeg), sample]));
  const get = (domain, mesh, current, angle) => {
    const sample = byKey.get(sampleKey(domain, mesh, current, angle));
    assert(sample, `internal coverage error for ${sampleKey(domain, mesh, current, angle)}`);
    return sample;
  };
  const add = (id, observed, tolerance, comparison = "maximum") => {
    const passed = comparison === "minimum" ? observed >= tolerance : observed <= tolerance;
    checks.push({ id, status: passed ? "passed" : "failed", observed, tolerance, comparison });
  };
  const p = spec.production;
  const t = spec.tolerances;
  const base = p.baseDomainId;
  const coarse = p.meshLevels[0].id;
  const medium = p.meshLevels.at(-2).id;
  const fine = p.meshLevels.at(-1).id;
  const representative = p.representativeAngles.map((item) => item.angleDeg);

  add("energy-coenergy-agreement", Math.max(...samples.map((sample) => relativeDifference(sample.observables.magneticEnergyJ, sample.observables.coEnergyJ))), t.energyCoEnergyRelative);
  for (const angle of new Set([...representative, ...p.torqueAnglesDeg, ...p.periodicityPairsDeg.flat()].map(Number))) {
    const chain = p.meshLevels.map((mesh) => get(base, mesh.id, p.productionCurrentA, angle));
    add(`mesh-node-growth:${angleKey(angle)}`, Math.min(...chain.slice(1).map((sample, index) => sample.meshMetrics.nodeCount / chain[index].meshMetrics.nodeCount)), t.meshMetrics.minimumNodeGrowthRatio, "minimum");
    add(`mesh-element-growth:${angleKey(angle)}`, Math.min(...chain.slice(1).map((sample, index) => sample.meshMetrics.elementCount / chain[index].meshMetrics.elementCount)), t.meshMetrics.minimumElementGrowthRatio, "minimum");
    const ratios = chain.map((sample) => sample.meshMetrics.elementCount / sample.meshMetrics.nodeCount);
    add(`mesh-element-node-ratio-drift:${angleKey(angle)}`, (Math.max(...ratios) - Math.min(...ratios)) / Math.max(...ratios), t.meshMetrics.maximumElementNodeRatioDrift);
    add(`mesh-observable-coarse-fine:${angleKey(angle)}`, maxObservableDifference(get(base, coarse, p.productionCurrentA, angle), get(base, fine, p.productionCurrentA, angle)), t.meshObservableRelative.coarseToFine);
    add(`mesh-observable-medium-fine:${angleKey(angle)}`, maxObservableDifference(get(base, medium, p.productionCurrentA, angle), get(base, fine, p.productionCurrentA, angle)), t.meshObservableRelative.mediumToFine);
  }
  const far = p.domains.at(-1).id;
  const expanded = p.domains.at(-2).id;
  for (const angle of representative) {
    add(`domain-base-far:${angleKey(angle)}`, maxObservableDifference(get(base, fine, p.productionCurrentA, angle), get(far, fine, p.productionCurrentA, angle)), t.outerDomainObservableRelative.baseToFar);
    add(`domain-expanded-far:${angleKey(angle)}`, maxObservableDifference(get(expanded, fine, p.productionCurrentA, angle), get(far, fine, p.productionCurrentA, angle)), t.outerDomainObservableRelative.expandedToFar);
    const production = get(base, fine, p.productionCurrentA, angle);
    const audit = get(base, fine, p.linearityAuditCurrentA, angle);
    add(`current-inductance:${angleKey(angle)}`, relativeDifference(production.observables.inductanceH, audit.observables.inductanceH), t.inductanceCurrentRelative);
    const energyScalingError = Math.max(...["magneticEnergyJ", "coEnergyJ"].map((observable) => {
      const productionScaled = production.observables[observable] / p.productionCurrentA ** 2;
      const auditScaled = audit.observables[observable] / p.linearityAuditCurrentA ** 2;
      return relativeDifference(productionScaled, auditScaled);
    }));
    add(`current-energy-i2:${angleKey(angle)}`, energyScalingError, t.energyCurrentSquaredRelative);
  }
  for (const [leftAngle, rightAngle] of p.periodicityPairsDeg) {
    add(`angle-periodicity:${angleKey(leftAngle)}:${angleKey(rightAngle)}`, maxObservableDifference(get(base, fine, p.productionCurrentA, leftAngle), get(base, fine, p.productionCurrentA, rightAngle)), t.anglePeriodicityRelative);
  }
  const torqueByMesh = [medium, fine].map((mesh) => p.torqueAnglesDeg.map((angle) => get(base, mesh, p.productionCurrentA, angle)));
  const mediumTorque = torqueByMesh[0].slice(1, -1).map((_, index) => derivative(torqueByMesh[0], index + 1));
  const fineTorque = torqueByMesh[1].slice(1, -1).map((_, index) => derivative(torqueByMesh[1], index + 1));
  const torqueDifference = Math.max(...fineTorque.map((value, index) => Math.abs(value - mediumTorque[index])));
  const torqueScale = Math.max(t.torqueDerivative.absoluteFloorNm, ...fineTorque.map(Math.abs));
  add("torque-derivative-stability", torqueDifference / torqueScale, t.torqueDerivative.normalizedLinf);
  return checks;
}

export function evaluateConvergence({ spec, specBytes, evidence, evidenceDir }) {
  const report = {
    contract: "edwin-gray-convergence-report",
    contractVersion: 1,
    specification: {
      contract: spec?.contract || null,
      contractVersion: spec?.contractVersion || null,
      sha256: sha256Bytes(specBytes || Buffer.from(stableJson(spec)))
    },
    evidence: {
      contract: evidence?.contract || null,
      contractVersion: evidence?.contractVersion || null,
      sampleCount: Array.isArray(evidence?.samples) ? evidence.samples.length : 0
    },
    status: "rejected",
    checks: [],
    failures: []
  };
  try {
    validateSpec(spec);
    assert(evidence?.contract === "edwin-gray-convergence-evidence" && evidence.contractVersion === 1, "unsupported convergence evidence contract");
    assert(evidence.status === "complete", "convergence evidence is not complete");
    assert(evidence.caseId === spec.caseId, "convergence evidence case ID is invalid");
    assert(Array.isArray(evidence.samples), "convergence evidence samples are missing");
    assert(new Set(evidence.samples.map((sample) => sample?.id)).size === evidence.samples.length, "convergence evidence sample IDs are duplicated");
    const expected = expectedSampleDefinitions(spec);
    const expectedByKey = new Map(expected.map((item) => [sampleKey(item.domainId, item.meshLevelId, item.driveCurrentA, item.rotorAngleDeg), item]));
    assert(evidence.samples.length === expected.length, `evidence sample count ${evidence.samples.length} does not match required production count ${expected.length}`);
    const declared = new Map();
    for (const sample of evidence.samples) {
      const key = sampleKey(sample.domainId, sample.meshLevelId, sample.driveCurrentA, sample.rotorAngleDeg);
      assert(!declared.has(key), `duplicate evidence tuple ${key}`);
      assert(expectedByKey.has(key), `undeclared evidence tuple ${key}`);
      declared.set(key, sample);
    }
    assert(expected.every((item) => declared.has(sampleKey(item.domainId, item.meshLevelId, item.driveCurrentA, item.rotorAngleDeg))), "evidence does not provide exact production coverage");
    const verified = expected.map((item) => verifySample(declared.get(sampleKey(item.domainId, item.meshLevelId, item.driveCurrentA, item.rotorAngleDeg)), item, spec, evidenceDir));
    assert(new Set(verified.map((item) => item.jobInputHash)).size === verified.length, "attested job input hashes are not unique");
    assert(new Set(verified.map((item) => item.environmentIdentityHash)).size === 1, "convergence samples use different solver environments");
    for (const domain of spec.production.domains) {
      const hashes = new Set(verified.filter((item) => item.domainId === domain.id).map((item) => item.modelInputHash));
      assert(hashes.size === 1, `domain ${domain.id} does not use one model input identity`);
    }
    const domainHashes = spec.production.domains.map((domain) => verified.find((item) => item.domainId === domain.id).modelInputHash);
    assert(new Set(domainHashes).size === domainHashes.length, "outer-domain variants are not distinguished by model input hashes");
    report.checks.push({ id: "evidence-integrity-and-coverage", status: "passed", observed: verified.length, tolerance: expected.length, comparison: "exact" });
    report.checks.push(...evaluateMetrics(verified, spec));
    report.failures = report.checks.filter((check) => check.status === "failed").map((check) => check.id);
    report.status = report.failures.length === 0 ? "approved" : "rejected";
  } catch (error) {
    report.checks.push({ id: "evidence-integrity-and-coverage", status: "failed", observed: null, tolerance: null, comparison: "exact" });
    report.failures.push(error.message);
  }
  return report;
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

function main(argv) {
  const options = parseArgs(argv);
  assert(options.evidence, "--evidence is required");
  const specPath = resolve(options.spec || DEFAULT_SPEC);
  const evidencePath = resolve(options.evidence);
  const outputPath = resolve(options.out || "convergence-report.json");
  const specBytes = readFileSync(specPath);
  const report = evaluateConvergence({
    spec: readJson(specPath, "convergence specification"),
    specBytes,
    evidence: readJson(evidencePath, "convergence evidence"),
    evidenceDir: dirname(evidencePath)
  });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: report.status, output: outputPath, failures: report.failures.length }));
  if (report.status !== "approved") process.exitCode = 1;
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`evaluate-convergence: ${error.message}`);
    process.exitCode = 1;
  }
}
