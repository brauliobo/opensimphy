import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { expectedSampleDefinitions } from "./evaluate-convergence.mjs";
import {
  missingDefinitions,
  productionConvergenceAttestation,
  run,
  sampleArguments,
  selectedDefinitions,
  studyPlan
} from "./run-study.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const RUN_STUDY = resolve(DIR, "run-study.mjs");
const SPEC_PATH = resolve(DIR, "convergence-spec-v2.json");
const PROFILE_PATH = resolve(DIR, "reduced-profile-v1.json");
const SPEC = JSON.parse(readFileSync(SPEC_PATH, "utf8"));
const PROFILE = JSON.parse(readFileSync(PROFILE_PATH, "utf8"));
const DEFINITIONS = expectedSampleDefinitions(SPEC, PROFILE);

function fileHash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function runStudy(args) {
  return spawnSync(process.execPath, [RUN_STUDY, ...args], { encoding: "utf8" });
}

test("reduced profile declares exactly the bounded 23 independent tuples", () => {
  assert.equal(DEFINITIONS.length, 23);
  assert.equal(PROFILE.productionEligible, false);
  assert.equal(PROFILE.scope, "Illustrative linear numerical convergence only.");
  assert.deepEqual(PROFILE.claims, { physicalValidation: false, lutPublication: false });
  assert(DEFINITIONS.every((tuple) => tuple.kind === undefined));
});

test("selected tuple input accepts a declared subset and rejects duplicates", () => {
  assert.deepEqual(selectedDefinitions({ tuples: [DEFINITIONS[2], DEFINITIONS[8]] }, DEFINITIONS), [DEFINITIONS[2], DEFINITIONS[8]]);
  assert.throws(() => selectedDefinitions({ tuples: [DEFINITIONS[2], DEFINITIONS[2]] }, DEFINITIONS), /duplicate selected tuple/);
  assert.throws(() => selectedDefinitions({ tuples: [{ ...DEFINITIONS[2], eventIndex: 1 }] }, DEFINITIONS), /not declared/);
});

test("missing-only selection excludes only completed declared tuples", () => {
  assert.deepEqual(missingDefinitions(DEFINITIONS.slice(0, 4), [DEFINITIONS[1], DEFINITIONS[3]]), [DEFINITIONS[0], DEFINITIONS[2]]);
});

test("study planning is deterministic and publication-safe mesh threading is explicit", () => {
  const cases = { base: "/tmp/base.json", expanded: "/tmp/expanded.json", far: "/tmp/far.json" };
  const options = {
    "docker-image": "solver@sha256:" + "a".repeat(64),
    "hard-timeout-seconds": "60",
    "mesh-threads": "1",
    threads: "2",
    cpus: "2",
    "memory-gib": "24",
    "solver-profile": "iterative-cg-gamg-v1"
  };
  const input = { definitions: DEFINITIONS.slice(0, 2), spec: SPEC, cases, workDir: "/tmp/reduced-study", options };
  const first = studyPlan(input);
  const second = studyPlan(input);
  assert.deepEqual(first, second);
  assert.equal(first.execution.sharedHardTimeoutSeconds, 60);
  assert.equal(first.samples.length, 2);
  assert(first.samples.every((item) => item.command.includes("--resume") && item.command.includes("--mesh-threads")));

  const publication = sampleArguments({
    sample: DEFINITIONS[0],
    mesh: SPEC.production.meshLevels[0],
    cases,
    runs: "/tmp/runs",
    image: options["docker-image"],
    threads: 2,
    meshThreads: 1,
    cpus: 2,
    memoryGiB: 24,
    solverProfile: "direct-mumps-publication-v1",
    publication: true
  });
  assert(publication.includes("--publication"));
  assert.deepEqual(publication.slice(publication.indexOf("--mesh-threads"), publication.indexOf("--mesh-threads") + 2), ["--mesh-threads", "1"]);
});

test("the shared hard timeout terminates a non-solver child", () => {
  assert.throws(() => run(process.execPath, ["-e", "setTimeout(() => {}, 5000)"], "fixture child", 1), /exceeded the shared hard timeout/);
});

test("existing-only evaluation does not require a solver hard timeout", () => {
  const workDir = mkdtempSync(resolve(tmpdir(), "edwin-gray-existing-only-"));
  mkdirSync(resolve(workDir, "runs"));
  try {
    const result = runStudy(["--stage", "convergence", "--existing-only", "true", "--work-dir", workDir]);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /hard-timeout-seconds/);
    assert(existsSync(resolve(workDir, "convergence-report.json")));
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test("the actual publication gate rejects reduced and profile-hash-tampered reports before solver or LUT work", () => {
  const production = productionConvergenceAttestation(SPEC);
  const reports = [
    {
      label: "reduced report with a tampered eligibility boolean",
      profile: {
        contract: PROFILE.contract,
        contractVersion: PROFILE.contractVersion,
        profileId: PROFILE.profileId,
        sha256: fileHash(PROFILE_PATH),
        productionEligible: true
      }
    },
    {
      label: "production identity with the reduced profile hash",
      profile: { ...production, sha256: fileHash(PROFILE_PATH), productionEligible: true }
    }
  ];

  for (const fixture of reports) {
    const workDir = mkdtempSync(resolve(tmpdir(), "edwin-gray-publication-gate-"));
    const lutPath = resolve(workDir, "must-not-exist.json");
    writeFileSync(resolve(workDir, "convergence-report.json"), `${JSON.stringify({
      contract: "edwin-gray-convergence-report",
      contractVersion: 2,
      specification: {
        contract: SPEC.contract,
        contractVersion: SPEC.contractVersion,
        sha256: fileHash(SPEC_PATH)
      },
      profile: fixture.profile,
      status: "approved"
    }, null, 2)}\n`);
    try {
      const result = runStudy([
        "--stage", "publication",
        "--docker-image", "must-not-run",
        "--work-dir", workDir,
        "--solver-profile", "direct-mumps-publication-v1",
        "--memory-gib", "24",
        "--cpus", "2",
        "--threads", "2",
        "--mesh-threads", "1",
        "--hard-timeout-seconds", "60",
        "--lut-out", lutPath
      ]);
      assert.equal(result.status, 1, fixture.label);
      assert.match(result.stderr, /exact attested 33-sample production convergence profile/, fixture.label);
      assert.equal(existsSync(resolve(workDir, "cases")), false, fixture.label);
      assert.equal(existsSync(lutPath), false, fixture.label);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
});
