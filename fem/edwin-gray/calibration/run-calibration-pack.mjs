#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCalibrationPack, expectedSymmetryProof, writeJsonAtomic } from "./build-calibration-pack.mjs";
import { residualOnlyRunnerFailure, validateSolveForAttestation } from "./solver-evidence.mjs";

const CALIBRATION_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(CALIBRATION_DIR, "..");
const RUNNER = resolve(ROOT, "scripts/run.mjs");
const PROFILE_PATH = resolve(CALIBRATION_DIR, "profile-v1.json");
const EVENT_MAP_PATH = resolve(ROOT, "excitation/v1/event-map-v1.json");
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

function fixedConfiguration(options, profile) {
  assert(options["solver-profile"] === profile.solverProfile, `--solver-profile must be ${profile.solverProfile}`);
  assert(Number(options["memory-gib"]) === profile.resources.memoryGiB, `--memory-gib must be ${profile.resources.memoryGiB}`);
  assert(Number(options.cpus) === profile.resources.cpus, `--cpus must be ${profile.resources.cpus}`);
  assert(Number(options.threads) === profile.resources.threads, `--threads must be ${profile.resources.threads}`);
  assert(Number(options["hard-timeout-seconds"]) === profile.hardDeadlineSeconds, `--hard-timeout-seconds must be ${profile.hardDeadlineSeconds}`);
  assert(profile.resources.serial === true && profile.hardDeadlineSeconds < 29 * 60, "profile is not a serial sub-29-minute execution contract");
}

function runArguments({ options, profile, event, runDir }) {
  return [
    RUNNER,
    "--resume",
    "--publication",
    "--backend", "docker",
    "--docker-image", options["docker-image"],
    "--run-dir", runDir,
    "--event-index", String(event.eventIndex),
    "--rotor-angle", String(event.angleDegNumerator / 3),
    "--mesh-size", String(profile.meshSizeM),
    "--drive-current", String(profile.driveCurrentA),
    "--solver-profile", profile.solverProfile,
    "--memory-gib", String(profile.resources.memoryGiB),
    "--cpus", String(profile.resources.cpus),
    "--threads", String(profile.resources.threads)
  ];
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function pendingCheckpoint(runDir, eventClass) {
  if (!existsSync(runDir)) return null;
  const matches = readdirSync(runDir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    const path = join(runDir, entry.name, "checkpoint.json");
    if (!existsSync(path)) return [];
    const checkpoint = readJson(path, `event class ${eventClass} checkpoint`);
    return checkpoint.parameters?.eventIndex === eventClass && checkpoint.phases?.solve === "pending"
      ? [{ path, checkpoint }]
      : [];
  });
  assert(matches.length <= 1, `event class ${eventClass} has multiple pending checkpoints`);
  return matches[0] || null;
}

function attestPendingDirectSolve(runDir, eventClass, failureOutput) {
  assert(residualOnlyRunnerFailure(failureOutput), `event class ${eventClass} did not fail only on the inapplicable direct residual check`);
  const pending = pendingCheckpoint(runDir, eventClass);
  assert(pending, `event class ${eventClass} does not have a pending solve checkpoint`);
  const jobDir = dirname(pending.path);
  const evidence = validateSolveForAttestation(jobDir, pending.checkpoint, 0);
  const evidencePath = join(jobDir, "solver-convergence.json");
  writeJsonAtomic(evidencePath, evidence);
  pending.checkpoint.phases.solve = "complete";
  pending.checkpoint.artifacts.logs.getdp = evidence.getdpLogSha256;
  pending.checkpoint.artifacts.convergence = sha256File(evidencePath);
  pending.checkpoint.artifacts.outputs = evidence.outputHashes;
  pending.checkpoint.solverConvergence = evidence;
  const temporary = `${pending.path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(pending.checkpoint, null, 2)}\n`, "utf8");
  renameSync(temporary, pending.path);
}

function priorResidualFailure(output, eventClass) {
  return new RegExp(`calibration-run: event class ${eventClass} failed: run: GetDP log does not contain the final true residual\\s*$`, "m")
    .test(output || "");
}

function spawnWithDeadline(args, remainingSeconds) {
  return spawnSync("timeout", [
    "--foreground",
    "--signal=TERM",
    "--kill-after=5s",
    `${remainingSeconds}s`,
    process.execPath,
    ...args
  ], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function executeWithDeadline(args, remainingSeconds, eventClass, runDir, priorFailure = "") {
  assert(remainingSeconds > 0, "calibration hard deadline expired before all event classes completed");
  const started = Date.now();
  if (pendingCheckpoint(runDir, eventClass) && priorResidualFailure(priorFailure, eventClass)) {
    attestPendingDirectSolve(runDir, eventClass, priorFailure);
  }
  let result = spawnWithDeadline(args, remainingSeconds);
  if (result.status !== 0 && residualOnlyRunnerFailure(result.stderr)) {
    attestPendingDirectSolve(runDir, eventClass, result.stderr);
    const retrySeconds = remainingSeconds - Math.ceil((Date.now() - started) / 1000);
    assert(retrySeconds > 0, "calibration hard deadline expired before direct solve normalization");
    result = spawnWithDeadline(args, retrySeconds);
  }
  assert(result.status === 0, result.status === 124
    ? `event class ${eventClass} exceeded the calibration hard deadline`
    : `event class ${eventClass} failed${result.stderr ? `: ${result.stderr.trim()}` : ""}`);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`event class ${eventClass} runner output is invalid: ${error.message}`);
  }
}

function plan(options, profile, events, runDir) {
  return {
    contract: "edwin-gray-motor-fem-calibration-run-plan",
    contractVersion: 1,
    execution: { serial: true, hardDeadlineSeconds: profile.hardDeadlineSeconds },
    output: resolve(options.out),
    commands: events.map((event) => ({
      eventClass: event.eventIndex,
      timeout: ["timeout", "--foreground", "--signal=TERM", "--kill-after=5s", `${profile.hardDeadlineSeconds}s`],
      command: [process.execPath, ...runArguments({ options, profile, event, runDir })]
    }))
  };
}

function main(argv) {
  const options = parseArgs(argv);
  assert(options.out && options["work-dir"], "--out and --work-dir are required");
  assert(basename(resolve(options.out)) !== "motor-fem-lut-v1.json", "calibration infrastructure cannot write motor-fem-lut-v1.json");

  if (options["existing-only"] === "true") {
    const builder = spawnSync(process.execPath, [
      resolve(CALIBRATION_DIR, "build-calibration-pack.mjs"),
      "--existing-only", "true",
      "--runs", resolve(options["work-dir"]),
      "--out", resolve(options.out)
    ], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (builder.stdout) process.stdout.write(builder.stdout);
    if (builder.stderr) process.stderr.write(builder.stderr);
    process.exitCode = builder.status;
    return;
  }

  assert(basename(resolve(options.out)) === "motor-fem-calibration-pack-v1.json", "fresh calibration output must be motor-fem-calibration-pack-v1.json");
  assert(options["pilot-report"], "fresh calibration requires --pilot-report");
  assert(IMMUTABLE_IMAGE.test(options["docker-image"] || ""), "fresh calibration requires an immutable Docker image digest");
  const profile = readJson(PROFILE_PATH, "calibration profile");
  fixedConfiguration(options, profile);
  const eventMap = readJson(EVENT_MAP_PATH, "event map");
  const events = profile.eventClasses.map((eventClass) => eventMap.events.find((event) => event.eventIndex === eventClass));
  assert(events.every(Boolean), "event map does not contain all calibration classes");
  const workDir = resolve(options["work-dir"]);
  const runDir = resolve(workDir, "runs");
  const calibrationLogPath = resolve(workDir, "calibration.log");

  if (options.plan === "true") {
    console.log(JSON.stringify(plan(options, profile, events, runDir), null, 2));
    return;
  }

  mkdirSync(runDir, { recursive: true });
  const started = Date.now();
  const jobs = [];
  for (const event of events) {
    const elapsedSeconds = Math.ceil((Date.now() - started) / 1000);
    const remainingSeconds = profile.hardDeadlineSeconds - elapsedSeconds;
    const priorFailure = existsSync(calibrationLogPath) ? readFileSync(calibrationLogPath, "utf8") : "";
    const output = executeWithDeadline(runArguments({ options, profile, event, runDir }), remainingSeconds, event.eventIndex, runDir, priorFailure);
    assert(output.status === "complete" && output.jobDir, `event class ${event.eventIndex} did not complete`);
    jobs.push({
      eventClass: event.eventIndex,
      checkpoint: relative(workDir, resolve(output.jobDir, "checkpoint.json")),
      result: relative(workDir, resolve(output.jobDir, "result.json"))
    });
  }
  assert(Date.now() - started < profile.hardDeadlineSeconds * 1000, "calibration hard deadline expired before pack validation");

  const inventoryPath = resolve(workDir, "calibration-inventory-v1.json");
  const proofPath = resolve(workDir, "event-map-symmetry-proof-v1.json");
  writeJsonAtomic(inventoryPath, {
    contract: "edwin-gray-motor-fem-calibration-inventory",
    contractVersion: 1,
    status: "complete",
    execution: { serial: true, hardDeadlineSeconds: profile.hardDeadlineSeconds },
    jobs
  });
  writeJsonAtomic(proofPath, expectedSymmetryProof());
  const pack = buildCalibrationPack({
    inventoryPath,
    pilotReportPath: resolve(options["pilot-report"]),
    symmetryProofPath: proofPath,
    profilePath: PROFILE_PATH
  });
  assert(Date.now() - started < profile.hardDeadlineSeconds * 1000, "calibration hard deadline expired during pack validation");
  writeJsonAtomic(resolve(options.out), pack);
  console.log(JSON.stringify({ status: pack.status, output: resolve(options.out), classes: pack.classes.length }));
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`calibration-run: ${error.message}`);
  process.exitCode = 1;
}
