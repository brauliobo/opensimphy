#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { convergenceSymmetryProof, expectedSampleDefinitions } from "./evaluate-convergence.mjs";
import { proveEventMapSymmetry } from "../scripts/event-map-symmetry.mjs";
import { expandPublicationLut, publicationDefinitions } from "./publication.mjs";
import { validateBundledLut } from "../ci/validate-lut.mjs";

const CONVERGENCE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(CONVERGENCE_DIR, "..");
const RUNNER = resolve(ROOT, "scripts/run.mjs");
const EVALUATOR = resolve(CONVERGENCE_DIR, "evaluate-convergence.mjs");
const SPEC_PATH = resolve(CONVERGENCE_DIR, "convergence-spec-v2.json");
const CASE_PATH = resolve(ROOT, "cases/patent-3890548-illustrative.json");
const LUT_SCHEMA_PATH = resolve(ROOT, "schema/motor-fem-lut.schema.json");
const EVENT_MAP_PATH = resolve(ROOT, "excitation/v1/event-map-v1.json");
const GEOMETRY_PATH = resolve(ROOT, "geometry/patent-3890548-3d.geo");
const PUBLICATION_PROFILE_PATH = resolve(CONVERGENCE_DIR, "publication-profile-v1.json");
const REDUCED_PROFILE_PATH = resolve(CONVERGENCE_DIR, "reduced-profile-v1.json");
const DEFAULT_LUT_PATH = resolve(ROOT, "../../public/data/generated/edwin-gray/motor-fem-lut-v1.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(argv) {
  const options = {};
  const flags = new Set(["missing-only", "plan"]);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    assert(token.startsWith("--"), `unexpected argument ${token}`);
    const key = token.slice(2);
    assert(options[key] === undefined, `duplicate option ${token}`);
    if (flags.has(key)) {
      options[key] = true;
      continue;
    }
    const value = argv[index + 1];
    assert(value && !value.startsWith("--"), `missing value for ${token}`);
    options[key] = value;
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

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function run(command, args, label, timeoutSeconds) {
  const invocation = timeoutSeconds === undefined
    ? { command, args }
    : { command: "timeout", args: ["--foreground", "--signal=TERM", "--kill-after=5s", `${timeoutSeconds}s`, command, ...args] };
  const result = spawnSync(invocation.command, invocation.args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) {
    if (result.status === 124) throw new Error(`${label} exceeded the shared hard timeout`);
    throw new Error(`${label} failed${result.stderr ? `: ${result.stderr.trim()}` : ""}`);
  }
  return result.stdout.trim();
}

function caseVariants(workDir, spec) {
  const source = readJson(CASE_PATH, "source case");
  return Object.fromEntries(spec.production.domains.map((domain) => {
    const variant = structuredClone(source);
    variant.geometry.airOuterRadiusM = domain.outerRadiusM;
    variant.geometry.airZMinM = -domain.axialHalfExtentM;
    variant.geometry.airZMaxM = domain.axialHalfExtentM;
    const path = resolve(workDir, "cases", `${domain.id}.json`);
    writeJson(path, variant);
    return [domain.id, path];
  }));
}

function sampleId(sample) {
  return [sample.domainId, sample.meshLevelId, `i${sample.driveCurrentA}`, `a${sample.rotorAngleDeg}`, `e${sample.eventIndex}`]
    .join("-")
    .replaceAll(".", "p");
}

function sameNumber(left, right) {
  return Math.abs(left - right) <= 1e-12 * Math.max(1, Math.abs(left), Math.abs(right));
}

function sampleKey(sample) {
  return `${sample.domainId}|${sample.meshLevelId}|${Number(sample.driveCurrentA).toPrecision(15)}|${Number(sample.rotorAngleDeg).toFixed(10)}`;
}

function tupleKey(sample) {
  return `${sampleKey(sample)}|${sample.eventIndex}`;
}

export function selectedDefinitions(selection, declared) {
  const tuples = Array.isArray(selection) ? selection : selection?.tuples;
  assert(Array.isArray(tuples) && tuples.length > 0, "selected tuple input must contain a non-empty tuples array");
  const declaredByKey = new Map(declared.map((tuple) => [tupleKey(tuple), tuple]));
  const selected = [];
  const seen = new Set();
  for (const tuple of tuples) {
    assert(tuple && Object.keys(tuple).sort().join(",") === "domainId,driveCurrentA,eventIndex,meshLevelId,rotorAngleDeg", "selected tuple fields are invalid");
    const key = tupleKey(tuple);
    assert(!seen.has(key), `duplicate selected tuple ${key}`);
    assert(declaredByKey.has(key), `selected tuple is not declared by the reduced profile: ${key}`);
    seen.add(key);
    selected.push(declaredByKey.get(key));
  }
  return selected;
}

export function missingDefinitions(definitions, completed) {
  const completedKeys = new Set(completed.map(tupleKey));
  return definitions.filter((sample) => !completedKeys.has(tupleKey(sample)));
}

function wrapperNumber(text, name) {
  const match = text.match(new RegExp(`SetNumber\\("${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}", ([^)]+)\\);`));
  const value = Number(match?.[1]);
  assert(Number.isFinite(value), `existing geometry wrapper has no finite ${name}`);
  return value;
}

function existingJob(workDir, spec, jobId) {
  const jobDir = resolve(workDir, "runs", jobId);
  const checkpointPath = resolve(jobDir, "checkpoint.json");
  const checkpoint = readJson(checkpointPath, `existing checkpoint ${jobId}`);
  const wrapper = readFileSync(resolve(jobDir, "geometry-wrapper.geo"), "utf8");
  const radius = wrapperNumber(wrapper, "Parameters/Air outer radius (m)");
  const axialMinimum = wrapperNumber(wrapper, "Parameters/Air z minimum (m)");
  const axialMaximum = wrapperNumber(wrapper, "Parameters/Air z maximum (m)");
  const domain = spec.production.domains.find((item) => sameNumber(item.outerRadiusM, radius)
    && sameNumber(-item.axialHalfExtentM, axialMinimum) && sameNumber(item.axialHalfExtentM, axialMaximum));
  assert(domain, `existing checkpoint ${jobId} does not match a declared domain`);
  const meshLevel = spec.production.meshLevels.find((item) => sameNumber(item.meshSizeM, checkpoint.parameters?.meshSizeM));
  assert(meshLevel, `existing checkpoint ${jobId} does not match a declared mesh level`);
  return {
    id: sampleId({
      domainId: domain.id,
      meshLevelId: meshLevel.id,
      driveCurrentA: checkpoint.parameters.driveCurrentA,
      rotorAngleDeg: checkpoint.parameters.rotorAngleDeg,
      eventIndex: checkpoint.parameters.eventIndex
    }),
    domainId: domain.id,
    meshLevelId: meshLevel.id,
    driveCurrentA: checkpoint.parameters.driveCurrentA,
    rotorAngleDeg: checkpoint.parameters.rotorAngleDeg,
    eventIndex: checkpoint.parameters.eventIndex,
    jobDir,
    checkpointPath,
    checkpoint,
    result: relative(workDir, resolve(jobDir, "result.json")),
    checkpointRelative: relative(workDir, checkpointPath)
  };
}

function resultAttestation(workDir, sample) {
  const result = readJson(resolve(workDir, sample.result), `existing result ${sample.id}`);
  const entry = result.entries?.[0];
  assert(result.status === "complete" && result.entries?.length === 1 && entry.status === "complete", `existing result ${sample.id} is incomplete`);
  return {
    sampleId: sample.id,
    jobInputHash: entry.provenance.jobInputHash,
    artifactHashes: entry.provenance.artifacts
  };
}

function maximumObservableDifference(workDir, left, right) {
  const leftEntry = readJson(resolve(workDir, left.result), `existing result ${left.id}`).entries[0];
  const rightEntry = readJson(resolve(workDir, right.result), `existing result ${right.id}`).entries[0];
  return Math.max(...["magneticEnergyJ", "coEnergyJ", "inductanceH"].map((name) => relativeDifference(
    leftEntry.observables[name].value,
    rightEntry.observables[name].value
  )));
}

function verifyIncompleteTargetAttempt(target, source) {
  const checkpoint = target.checkpoint;
  assert(checkpoint.phases?.mesh === "complete" && checkpoint.meshQuality === "passed", "declared derived target has no complete mesh checkpoint");
  assert(checkpoint.phases?.solve !== "complete" && checkpoint.phases?.normalize !== "complete" && checkpoint.result === null,
    "declared derived target is not the one incomplete solve attempt");
  assert(checkpoint.modelInputHash === source.checkpoint.modelInputHash, "derived target and source model identities differ");
  assert(checkpoint.environmentIdentityHash === source.checkpoint.environmentIdentityHash, "derived target and source solver environments differ");
  for (const [path, expectedHash] of [
    ["motor.msh", checkpoint.artifacts?.mesh],
    ["mesh-audit.json", checkpoint.artifacts?.audit],
    ["solver-environment.json", checkpoint.artifacts?.environment],
    ["geometry-wrapper.geo", checkpoint.artifacts?.inputs?.geometry],
    ["getdp-wrapper.pro", checkpoint.artifacts?.inputs?.getdp]
  ]) {
    assert(expectedHash && sha256(resolve(target.jobDir, path)) === expectedHash, `derived target ${path} hash mismatch`);
  }
}

function collectExistingEvidence(workDir, spec, definitions) {
  const runs = resolve(workDir, "runs");
  assert(existsSync(runs), "existing-only convergence requires a runs directory");
  const jobs = readdirSync(runs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(runs, entry.name, "checkpoint.json")))
    .map((entry) => existingJob(workDir, spec, entry.name));
  const complete = new Map(jobs
    .filter((job) => job.checkpoint.phases?.mesh === "complete" && job.checkpoint.phases?.solve === "complete"
      && job.checkpoint.phases?.normalize === "complete" && existsSync(resolve(workDir, job.result)))
    .map((job) => [sampleKey(job), job]));
  const samples = definitions.filter((definition) => complete.has(sampleKey(definition))).map((definition) => {
    const job = complete.get(sampleKey(definition));
    assert(job.eventIndex === definition.eventIndex, `existing sample ${job.id} has the wrong event index`);
    return {
      id: job.id,
      ...definition,
      result: job.result,
      checkpoint: job.checkpointRelative
    };
  });

  return samples.sort((left, right) => sampleKey(left).localeCompare(sampleKey(right)));
}

function evaluateEvidence(workDir, evidencePath, reportPath) {
  const evaluation = spawnSync(process.execPath, [EVALUATOR, "--evidence", evidencePath, "--out", reportPath], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert(existsSync(reportPath), "convergence evaluator did not write a report");
  const report = readJson(reportPath, "convergence report");
  return { report, evaluation };
}

function pilotDefinitions(definitions, spec) {
  const angle = spec.production.representativeAngles.find((item) => item.role === "transition").angleDeg;
  const fine = spec.production.meshLevels.at(-1).id;
  const far = spec.production.domains.at(-1).id;
  const periodic = spec.production.periodicityPairsDeg.find((pair) => pair[0] === angle)?.[1];
  const selected = definitions.filter((sample) => (
    (sample.domainId === spec.production.baseDomainId && sample.driveCurrentA === spec.production.productionCurrentA && sample.rotorAngleDeg === angle)
    || (sample.domainId === spec.production.baseDomainId && sample.meshLevelId === fine && sample.driveCurrentA === spec.production.linearityAuditCurrentA && sample.rotorAngleDeg === angle)
    || (sample.domainId === far && sample.meshLevelId === fine && sample.rotorAngleDeg === angle)
    || (sample.domainId === spec.production.baseDomainId && sample.meshLevelId === fine && sample.rotorAngleDeg === periodic)
  ));
  if (!selected.some((sample) => sample.domainId === spec.production.baseDomainId && sample.meshLevelId === fine
      && sample.driveCurrentA === spec.production.productionCurrentA && sample.rotorAngleDeg === periodic)) {
    selected.push({
      domainId: spec.production.baseDomainId,
      meshLevelId: fine,
      driveCurrentA: spec.production.productionCurrentA,
      rotorAngleDeg: periodic,
      eventIndex: eventIndexForAngle(spec, periodic)
    });
  }
  return selected;
}

function eventIndexForAngle(spec, angle) {
  const periodic = spec.production.periodicityPairsDeg.some((pair) => sameNumber(pair[1], angle));
  return spec.production.convergenceEventIndex + (periodic ? spec.production.periodicityEventIndexOffset : 0);
}

export function sampleArguments({ sample, mesh, cases, runs, image, threads, meshThreads, cpus, memoryGiB, solverProfile, publication, source }) {
  const args = [
    RUNNER,
    "--resume",
    "--backend", "docker",
    "--docker-image", image,
    "--threads", String(threads),
    "--mesh-threads", String(meshThreads),
    "--cpus", String(cpus),
    "--memory-gib", String(memoryGiB),
    "--solver-profile", solverProfile,
    "--case", cases[sample.domainId],
    "--run-dir", runs,
    "--rotor-angle", String(sample.rotorAngleDeg),
    "--event-index", String(sample.eventIndex),
    "--mesh-size", String(mesh.meshSizeM),
    "--drive-current", String(sample.driveCurrentA)
  ];
  if (publication) args.splice(2, 0, "--publication");
  if (source) args.push("--reuse-mesh-checkpoint", source);
  return args;
}

function executeSamples({ definitions, spec, cases, workDir, image, threads, meshThreads, cpus, memoryGiB, solverProfile, publication = false, hardTimeoutSeconds, expectedEnvironmentIdentityHash = null }) {
  const runs = resolve(workDir, "runs");
  const completed = [];
  const meshSources = new Map();
  const started = Date.now();
  let environmentIdentityHash = expectedEnvironmentIdentityHash;
  for (const sample of definitions) {
    const mesh = spec.production.meshLevels.find((item) => item.id === sample.meshLevelId);
    const meshKey = `${sample.domainId}|${sample.meshLevelId}|${sample.rotorAngleDeg}|${sample.eventIndex}`;
    const source = meshSources.get(meshKey);
    const args = sampleArguments({ sample, mesh, cases, runs, image, threads, meshThreads, cpus, memoryGiB, solverProfile, publication, source });
    const remainingSeconds = hardTimeoutSeconds === undefined
      ? undefined
      : hardTimeoutSeconds - Math.ceil((Date.now() - started) / 1000);
    assert(remainingSeconds === undefined || remainingSeconds > 0, "shared hard timeout expired before all samples completed");
    const output = JSON.parse(run(process.execPath, args, `sample ${sampleId(sample)}`, remainingSeconds));
    const checkpoint = join(output.jobDir, "checkpoint.json");
    const checkpointData = readJson(checkpoint, `sample ${sampleId(sample)} checkpoint`);
    environmentIdentityHash ||= checkpointData.environmentIdentityHash;
    assert(checkpointData.environmentIdentityHash === environmentIdentityHash, `sample ${sampleId(sample)} solver environment identity mismatch`);
    meshSources.set(meshKey, checkpoint);
    completed.push({
      id: sampleId(sample),
      ...sample,
      result: relative(workDir, join(output.jobDir, "result.json")),
      checkpoint: relative(workDir, checkpoint)
    });
  }
  return completed;
}

export function studyPlan({ definitions, spec, cases, workDir, options }) {
  const runs = resolve(workDir, "runs");
  const timeout = Number(options["hard-timeout-seconds"]);
  return {
    contract: "edwin-gray-reduced-convergence-run-plan",
    contractVersion: 1,
    profile: "illustrative-linear-numerical-convergence-v1",
    execution: { serial: true, sharedHardTimeoutSeconds: timeout },
    samples: definitions.map((sample) => {
      const mesh = spec.production.meshLevels.find((item) => item.id === sample.meshLevelId);
      return {
        id: sampleId(sample),
        tuple: sample,
        timeout: ["timeout", "--foreground", "--signal=TERM", "--kill-after=5s", `${timeout}s`],
        command: [process.execPath, ...sampleArguments({
          sample,
          mesh,
          cases,
          runs,
          image: options["docker-image"],
          threads: Number(options.threads || 1),
          meshThreads: Number(options["mesh-threads"] || 1),
          cpus: Number(options.cpus || 2),
          memoryGiB: Number(options["memory-gib"] || 24),
          solverProfile: options["solver-profile"] || "iterative-cg-gamg-v1",
          publication: false
        })]
      };
    })
  };
}

function relativeDifference(left, right) {
  return Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right), Number.MIN_VALUE);
}

function pilotReport(samples, workDir, spec) {
  const verified = samples.map((sample) => {
    const result = readJson(resolve(workDir, sample.result), `pilot result ${sample.id}`);
    const checkpoint = readJson(resolve(workDir, sample.checkpoint), `pilot checkpoint ${sample.id}`);
    const audit = readJson(resolve(dirname(resolve(workDir, sample.checkpoint)), "mesh-audit.json"), `pilot audit ${sample.id}`);
    return {
      id: sample.id,
      domainId: sample.domainId,
      meshLevelId: sample.meshLevelId,
      driveCurrentA: sample.driveCurrentA,
      rotorAngleDeg: sample.rotorAngleDeg,
      eventIndex: sample.eventIndex,
      observables: result.entries[0].observables,
      mesh: { nodes: audit.mesh.nodes, elements: audit.mesh.elements, minimumMeanRatio: audit.quality.minimumMeanRatio, sha256: checkpoint.artifacts.mesh },
      modelInputHash: checkpoint.modelInputHash,
      jobInputHash: checkpoint.jobInputHash,
      environmentIdentityHash: checkpoint.environmentIdentityHash
    };
  });
  const transition = spec.production.representativeAngles.find((item) => item.role === "transition").angleDeg;
  const base = spec.production.baseDomainId;
  const far = spec.production.domains.at(-1).id;
  const levels = spec.production.meshLevels.map((item) => item.id);
  const current = spec.production.productionCurrentA;
  const auditCurrent = spec.production.linearityAuditCurrentA;
  const get = (domain, level, amps, angle) => verified.find((sample) => sample.domainId === domain && sample.meshLevelId === level && sample.driveCurrentA === amps && sample.rotorAngleDeg === angle);
  const chain = levels.map((level) => get(base, level, current, transition));
  const fine = chain.at(-1);
  const lowCurrent = get(base, levels.at(-1), auditCurrent, transition);
  const farSample = get(far, levels.at(-1), current, transition);
  const periodicAngle = spec.production.periodicityPairsDeg.find((pair) => pair[0] === transition)[1];
  const periodic = get(base, levels.at(-1), current, periodicAngle);
  const observableDifference = (left, right) => Math.max(...Object.keys(left.observables).map((name) => relativeDifference(left.observables[name].value, right.observables[name].value)));
  const checks = [];
  const add = (id, observed, tolerance, comparison = "maximum") => checks.push({
    id,
    status: comparison === "minimum" ? (observed >= tolerance ? "passed" : "failed") : (observed <= tolerance ? "passed" : "failed"),
    observed,
    tolerance,
    comparison
  });
  add("mesh-quality-and-partition", verified.every((sample) => sample.mesh.minimumMeanRatio > 0) ? 1 : 0, 1, "minimum");
  add("environment-identity", new Set(verified.map((sample) => sample.environmentIdentityHash)).size, 1);
  add("energy-coenergy-agreement", Math.max(...verified.map((sample) => relativeDifference(sample.observables.magneticEnergyJ.value, sample.observables.coEnergyJ.value))), spec.tolerances.energyCoEnergyRelative);
  add("mesh-node-growth", Math.min(...chain.slice(1).map((sample, index) => sample.mesh.nodes / chain[index].mesh.nodes)), spec.tolerances.meshMetrics.minimumNodeGrowthRatio, "minimum");
  add("mesh-element-growth", Math.min(...chain.slice(1).map((sample, index) => sample.mesh.elements / chain[index].mesh.elements)), spec.tolerances.meshMetrics.minimumElementGrowthRatio, "minimum");
  add("mesh-observable-coarse-fine", observableDifference(chain[0], fine), spec.tolerances.meshObservableRelative.coarseToFine);
  add("mesh-observable-medium-fine", observableDifference(chain.at(-2), fine), spec.tolerances.meshObservableRelative.mediumToFine);
  add("domain-base-far", observableDifference(fine, farSample), spec.tolerances.outerDomainObservableRelative.baseToFar);
  add("current-inductance", relativeDifference(fine.observables.inductanceH.value, lowCurrent.observables.inductanceH.value), spec.tolerances.inductanceCurrentRelative);
  add("current-energy-i2", Math.max(...["magneticEnergyJ", "coEnergyJ"].map((name) => relativeDifference(
    fine.observables[name].value / current ** 2,
    lowCurrent.observables[name].value / auditCurrent ** 2
  ))), spec.tolerances.energyCurrentSquaredRelative);
  add("angle-periodicity", observableDifference(fine, periodic), spec.tolerances.anglePeriodicityRelative);
  checks.push({ id: "expanded-domain-convergence", status: "not-run", reason: "evaluated only by the full convergence study" });
  checks.push({ id: "torque-derivative-stability", status: "not-run", reason: "evaluated only by the full convergence study" });
  const failures = checks.filter((check) => check.status === "failed").map((check) => check.id);
  return {
    contract: "edwin-gray-convergence-pilot",
    contractVersion: 2,
    sourceFormulation: spec.sourceFormulation,
    specification: { sha256: sha256(SPEC_PATH) },
    status: failures.length === 0 ? "passed" : "rejected",
    checks,
    failures,
    samples: verified
  };
}

function runConvergence(options, spec, definitions, workDir) {
  if (options["existing-only"] === "true") {
    const evidencePath = resolve(workDir, "convergence-evidence.json");
    const reportPath = resolve(workDir, "convergence-report.json");
    const samples = collectExistingEvidence(workDir, spec, definitions);
    writeJson(evidencePath, {
      contract: "edwin-gray-convergence-evidence",
      contractVersion: 2,
      status: "complete",
      caseId: spec.caseId,
      samples
    });
    const { report, evaluation } = evaluateEvidence(workDir, evidencePath, reportPath);
    return {
      status: report.status,
      stage: "convergence",
      execution: "existing-artifacts-only",
      jobs: samples.length,
      report: reportPath,
      reportSha256: sha256(reportPath),
      evidenceSha256: sha256(evidencePath),
      evaluatorExitCode: evaluation.status
    };
  }
  const cases = caseVariants(workDir, spec);
  let completedBeforeRun = [];
  if (options["missing-only"] && existsSync(resolve(workDir, "runs"))) {
    completedBeforeRun = collectExistingEvidence(workDir, spec, definitions);
    definitions = missingDefinitions(definitions, completedBeforeRun);
  }
  if (options.plan) return studyPlan({ definitions, spec, cases, workDir, options });
  if (options.stage === "publication") {
    const convergenceReportPath = resolve(workDir, "convergence-report.json");
    const convergenceReport = readJson(convergenceReportPath, "approved convergence report");
    assert(convergenceReport.status === "approved", "publication requires an approved convergence report");
    assert(convergenceReport.profile?.productionEligible === true, "reduced illustrative convergence cannot authorize LUT publication");
    assert(convergenceReport.contract === "edwin-gray-convergence-report" && convergenceReport.contractVersion === 2, "publication convergence report contract is invalid");
    assert(convergenceReport.specification?.sha256 === sha256(SPEC_PATH), "publication convergence report does not match convergence spec v2");
    const caseData = readJson(cases[spec.production.baseDomainId], "publication case");
    const profile = readJson(PUBLICATION_PROFILE_PATH, "fast publication profile");
    const selected = publicationDefinitions(profile, spec, caseData);
    const eventMapBytes = readFileSync(EVENT_MAP_PATH);
    const caseBytes = readFileSync(cases[spec.production.baseDomainId]);
    const geometryBytes = readFileSync(GEOMETRY_PATH);
    const symmetryProof = proveEventMapSymmetry({
      eventMap: JSON.parse(eventMapBytes),
      caseData,
      geometryText: geometryBytes.toString("utf8"),
      eventMapBytes,
      caseBytes,
      geometryBytes
    });
    const samples = executeSamples({
      definitions: selected,
      spec,
      cases,
      workDir,
      image: options["docker-image"],
      threads: Number(options.threads),
      meshThreads: Number(options["mesh-threads"]),
      cpus: Number(options.cpus),
      memoryGiB: Number(options["memory-gib"]),
      solverProfile: options["solver-profile"],
      publication: true,
      hardTimeoutSeconds: Number(options["hard-timeout-seconds"])
    });
    const documents = samples.map((sample) => readJson(resolve(workDir, sample.result), `publication result ${sample.id}`));
    const lut = expandPublicationLut({ documents, profile, caseData, symmetryProof });
    validateBundledLut(lut, readJson(LUT_SCHEMA_PATH, "LUT schema"));
    const reportHash = sha256(convergenceReportPath);
    const specHash = sha256(SPEC_PATH);
    lut.provenance.source += `; convergence-report sha256:${reportHash}; convergence-spec-v2 sha256:${specHash}`;
    const lutPath = resolve(options["lut-out"] || DEFAULT_LUT_PATH);
    writeJson(lutPath, lut);
    const publicationEvidencePath = resolve(workDir, "publication-evidence.json");
    writeJson(publicationEvidencePath, {
      contract: "edwin-gray-production-publication-evidence",
      contractVersion: 1,
      status: "published",
      independentlySolvedJobCount: samples.length,
      symmetryDerivedEntryCount: lut.entries.length,
      solvedEventIndices: samples.map((sample) => sample.eventIndex),
      symmetryProofSha256: symmetryProof.proofSha256,
      specificationSha256: specHash,
      convergenceReportSha256: reportHash,
      lutSha256: sha256(lutPath),
      samples
    });
    return { status: "published", stage: "publication", independentlySolvedJobs: samples.length, symmetryDerivedEntries: lut.entries.length, lut: lutPath, lutSha256: sha256(lutPath), evidence: publicationEvidencePath };
  }
  const selected = options.stage === "pilot" ? pilotDefinitions(definitions, spec) : definitions;
  const priorEnvironmentHashes = new Set(completedBeforeRun.map((sample) => readJson(resolve(workDir, sample.checkpoint), `existing checkpoint ${sample.id}`).environmentIdentityHash));
  assert(priorEnvironmentHashes.size <= 1, "existing convergence samples use different solver environments");
  const samples = executeSamples({
    definitions: selected,
    spec,
    cases,
    workDir,
    image: options["docker-image"],
    threads: Number(options.threads || 1),
    meshThreads: Number(options["mesh-threads"] || 1),
    cpus: Number(options.cpus || 2),
    memoryGiB: Number(options["memory-gib"] || 24),
    solverProfile: options["solver-profile"] || "iterative-cg-gamg-v1",
    hardTimeoutSeconds: Number(options["hard-timeout-seconds"]),
    expectedEnvironmentIdentityHash: [...priorEnvironmentHashes][0] || null
  });
  if (options.stage === "pilot") {
    const reportPath = resolve(workDir, "pilot-report.json");
    const report = pilotReport(samples, workDir, spec);
    writeJson(reportPath, report);
    return { status: report.status, stage: "pilot", jobs: samples.length, report: reportPath, reportSha256: sha256(reportPath), failures: report.failures };
  }
  const allSamples = collectExistingEvidence(workDir, spec, expectedSampleDefinitions(spec));
  if (allSamples.length !== expectedSampleDefinitions(spec).length) {
    return { status: "pending", stage: "convergence", jobs: samples.length, completedReducedTuples: allSamples.length, requiredReducedTuples: expectedSampleDefinitions(spec).length };
  }
  const evidencePath = resolve(workDir, "convergence-evidence.json");
  const reportPath = resolve(workDir, "convergence-report.json");
  writeJson(evidencePath, {
    contract: "edwin-gray-convergence-evidence",
    contractVersion: 2,
    status: "complete",
    caseId: spec.caseId,
    samples: allSamples
  });
  const { report, evaluation } = evaluateEvidence(workDir, evidencePath, reportPath);
  return {
    status: report.status,
    stage: "convergence",
    jobs: samples.length,
    report: reportPath,
    reportSha256: sha256(reportPath),
    evidenceSha256: sha256(evidencePath),
    evaluatorExitCode: evaluation.status
  };
}

function main(argv) {
  const options = parseArgs(argv);
  assert(["pilot", "convergence", "publication"].includes(options.stage), "--stage must be pilot, convergence, or publication");
  const existingOnly = options["existing-only"] === "true";
  assert(options["existing-only"] === undefined || (existingOnly && options.stage === "convergence"), "--existing-only true is valid only for convergence");
  assert(!options["missing-only"] || options.stage === "convergence", "--missing-only is valid only for convergence");
  assert(!options.plan || options.stage === "convergence", "--plan is valid only for convergence");
  if (!existingOnly) assert(options["docker-image"], "--docker-image is required");
  if (options.stage === "publication") {
    for (const required of ["solver-profile", "memory-gib", "cpus", "threads", "mesh-threads"]) {
      assert(options[required], `publication requires explicit --${required}`);
    }
    assert(options["solver-profile"] === "direct-mumps-publication-v1", "publication requires solver profile direct-mumps-publication-v1");
  }
  const threads = Number(options.threads || 2);
  const cpus = Number(options.cpus || 2);
  const memoryGiB = Number(options["memory-gib"] || 24);
  const meshThreads = Number(options["mesh-threads"] || 1);
  const hardTimeoutSeconds = Number(options["hard-timeout-seconds"]);
  assert(Number.isInteger(threads) && threads >= 1 && threads <= 2, "--threads must be an integer in [1, 2]");
  assert(Number.isFinite(cpus) && cpus > 0 && cpus <= 2, "--cpus must be in (0, 2]");
  assert(Number.isFinite(memoryGiB) && memoryGiB > 0 && memoryGiB <= 24, "--memory-gib must be in (0, 24]");
  assert(Number.isInteger(meshThreads) && meshThreads >= 1 && meshThreads <= 2, "--mesh-threads must be an integer in [1, 2]");
  assert(Number.isFinite(hardTimeoutSeconds) && hardTimeoutSeconds > 0, "--hard-timeout-seconds must be finite and positive");
  if (options.stage === "publication") {
    assert(threads === 2 && meshThreads === 1 && cpus === 2 && memoryGiB === 24, "publication requires exactly 2 solver threads, 1 mesh thread, 2 CPUs, and 24 GiB");
  }
  const workDir = resolve(options["work-dir"] || "edwin-gray-study");
  mkdirSync(workDir, { recursive: true });
  const spec = readJson(SPEC_PATH, "convergence specification");
  const profile = readJson(REDUCED_PROFILE_PATH, "reduced convergence profile");
  let definitions = expectedSampleDefinitions(spec, profile);
  if (options["selected-tuples"]) definitions = selectedDefinitions(readJson(resolve(options["selected-tuples"]), "selected tuples"), definitions);
  const started = Date.now();
  const result = runConvergence(options, spec, definitions, workDir);
  if (!options.plan) result.runtimeSeconds = (Date.now() - started) / 1000;
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "rejected") process.exitCode = 1;
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`run-study: ${error.message}`);
    process.exitCode = 1;
  }
}

export { pilotDefinitions, sampleId };
