import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LAUNCHER = join(ROOT, "onelab/launcher.mjs");
const CASE_PATH = join(ROOT, "cases/patent-3890548-illustrative.json");

function launch(...args) {
  return spawnSync(process.execPath, [LAUNCHER, ...args], {
    cwd: join(ROOT, "onelab"),
    encoding: "utf8"
  });
}

function valueAt(value, sourcePath) {
  return sourcePath.split(".").reduce((current, key) => current[key], value);
}

test("ONELAB config round-trips authoritative case parameters exactly", (t) => {
  const temporary = mkdtempSync(join(tmpdir(), "edwin-gray-onelab-test-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const exportedPath = join(temporary, "exported.json");
  const importedPath = join(temporary, "imported.json");

  let result = launch("export", "--output", exportedPath);
  assert.equal(result.status, 0, result.stderr);
  result = launch("import", "--config", exportedPath, "--output", importedPath);
  assert.equal(result.status, 0, result.stderr);

  const exportedBytes = readFileSync(exportedPath, "utf8");
  assert.equal(readFileSync(importedPath, "utf8"), exportedBytes);
  const config = JSON.parse(exportedBytes);
  const caseData = JSON.parse(readFileSync(CASE_PATH, "utf8"));
  for (const parameter of config.parameters) {
    assert.equal(parameter.value, valueAt(caseData, parameter.sourcePath), parameter.sourcePath);
  }
});

test("ONELAB validation resolves existing files, parameters and solver names", () => {
  const result = launch("validate");
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.caseId, "patent-3890548-illustrative");
  assert.equal(report.parameters, 25);
});

test("ONELAB headless plan invokes the existing Gmsh and GetDP contracts", () => {
  const workDir = join(tmpdir(), "edwin-gray-onelab-plan");
  const result = launch(
    "headless",
    "--dry-run",
    "--gmsh-bin", "/tools/gmsh",
    "--getdp-bin", "/tools/getdp",
    "--work-dir", workDir
  );
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.gmsh[0], "/tools/gmsh");
  assert.equal(plan.getdp[0], "/tools/getdp");
  assert.ok(plan.gmsh[1].endsWith("/onelab/project.geo"));
  assert.ok(plan.getdp[1].endsWith("/getdp/magnetostatic.pro"));
  assert.ok(plan.getdp.includes("Magnetostatics3D"));
  assert.ok(plan.getdp.includes("MagnetostaticResults"));
  assert.equal(plan.gmsh.filter((value) => value === "-setnumber").length, 21);
  assert.equal(plan.getdp.filter((value) => value === "-setnumber").length, 4);
});

test("ONELAB GUI plan seeds the complete shared parameter database", () => {
  const result = launch("gui", "--dry-run", "--work-dir", join(tmpdir(), "edwin-gray-onelab-gui"));
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.ok(plan.command[1].endsWith("/onelab/project.geo"));
  assert.equal(plan.command.filter((value) => value === "-setnumber").length, 25);
  assert.ok(plan.command.includes("Parameters/Drive current (A)"));
});
