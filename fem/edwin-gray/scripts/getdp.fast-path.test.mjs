import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUNNER = join(ROOT, "scripts/run.mjs");
const PROFILES = JSON.parse(readFileSync(join(ROOT, "getdp/solver-profiles-v1.json"), "utf8"));

function dryRun(directory, extra = []) {
  const gmsh = join(directory, "gmsh");
  const getdp = join(directory, "getdp");
  writeFileSync(gmsh, "#!/bin/sh\nexit 0\n");
  writeFileSync(getdp, "#!/bin/sh\nexit 0\n");
  chmodSync(gmsh, 0o755);
  chmodSync(getdp, 0o755);
  const result = spawnSync(process.execPath, [
    RUNNER, "--dry-run", "--backend", "host",
    "--gmsh-bin", gmsh, "--getdp-bin", getdp, ...extra
  ], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("default GetDP path writes energy tables only and uses the fast MUMPS profile", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "getdp-fast-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  assert.equal(PROFILES.defaultProfile, "direct-mumps-fast-v1");
  assert.deepEqual(PROFILES.profiles["direct-mumps-fast-v1"].petscOptions.slice(6, 8), ["-mat_mumps_icntl_7", "5"]);
  assert.equal(PROFILES.profiles["direct-mumps-publication-v1"].publicationAllowed, true);
  assert.ok(!PROFILES.profiles["direct-mumps-publication-v1"].petscOptions.includes("-mat_mumps_icntl_7"));

  const plan = dryRun(directory);
  assert.ok(plan.commands.solve.includes("MagnetostaticTables"));
  assert.ok(!plan.commands.solve.includes("MagnetostaticResults"));
  assert.ok(plan.commands.solve.includes("-mat_mumps_icntl_7"));
  assert.equal(plan.commands.solve[plan.commands.solve.indexOf("-nt") + 1], "4");
});

test("study runner defaults to the fast MUMPS profile instead of rejected CG/GAMG", async () => {
  const { studyPlan } = await import("../convergence/run-study.mjs");
  const plan = studyPlan({
    definitions: [{ id: "probe", domainId: "base", meshLevelId: "coarse", eventIndex: 0, rotorAngleDeg: 0, driveCurrentA: 10 }],
    spec: { production: { meshLevels: [{ id: "coarse", meshSizeM: 0.025 }] } },
    cases: { base: "/tmp/base.json" },
    workDir: "/tmp/fast-study",
    options: { "docker-image": "solver@sha256:" + "a".repeat(64), "hard-timeout-seconds": "60" }
  });
  assert(plan.samples[0].command.includes("direct-mumps-fast-v1"));
  assert(plan.samples[0].command.includes("--threads"));
});

test("field maps stay available for COP-280 energy-flow inspection", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "getdp-fields-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const plan = dryRun(directory, ["--write-field-maps", "--solver-profile", "direct-mumps-publication-v1", "--threads", "2"]);
  assert.ok(plan.commands.solve.includes("MagnetostaticResults"));
  assert.ok(!plan.commands.solve.includes("MagnetostaticTables"));
});
