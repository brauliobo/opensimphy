import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { expectedSampleDefinitions } from "./evaluate-convergence.mjs";
import { missingDefinitions, run, sampleArguments, selectedDefinitions, studyPlan } from "./run-study.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const SPEC = JSON.parse(readFileSync(resolve(DIR, "convergence-spec-v2.json"), "utf8"));
const PROFILE = JSON.parse(readFileSync(resolve(DIR, "reduced-profile-v1.json"), "utf8"));
const DEFINITIONS = expectedSampleDefinitions(SPEC, PROFILE);

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
